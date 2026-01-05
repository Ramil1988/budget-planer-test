import { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Spinner,
  Badge,
  Button,
  Progress,
  Input,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Month picker state - default to current month
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [monthlySummary, setMonthlySummary] = useState({ income: 0, expenses: 0, net: 0 });
  const [budgetProgress, setBudgetProgress] = useState({ used: 0, total: 0, percent: 0 });
  const [categoryBudgets, setCategoryBudgets] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [daysLeft, setDaysLeft] = useState(0);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, selectedMonth]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      // Parse selected month
      const [year, month] = selectedMonth.split('-').map(Number);

      // Calculate days left only for current month
      const now = new Date();
      const isCurrentMonth = now.getFullYear() === year && (now.getMonth() + 1) === month;
      const lastDay = new Date(year, month, 0).getDate();
      if (isCurrentMonth) {
        setDaysLeft(lastDay - now.getDate());
      } else {
        setDaysLeft(0);
      }

      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      const nextMonthStart = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;

      const [transactionsResult, budgetResult, categoriesResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, description, date, amount, type, category_id, categories(name)')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),

        supabase
          .from('budgets')
          .select(`id, total, budget_categories (category_id, limit_amount)`)
          .eq('user_id', user.id)
          .gte('month', startDate)
          .lt('month', nextMonthStart)
          .maybeSingle(),

        supabase
          .from('categories')
          .select('id, name')
          .eq('user_id', user.id)
          .eq('type', 'expense')
      ]);

      if (transactionsResult.error) throw transactionsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      const transactions = transactionsResult.data || [];
      const budget = budgetResult.data;
      const categories = categoriesResult.data || [];

      // Calculate income and expenses
      let income = 0;
      let expenses = 0;
      transactions.forEach(tx => {
        if (tx.type === 'income') {
          income += Number(tx.amount);
        } else {
          expenses += Number(tx.amount);
        }
      });
      setMonthlySummary({ income, expenses, net: income - expenses });

      // Overall budget progress
      const budgetTotal = budget?.total || 0;
      const budgetUsedPercent = budgetTotal > 0 ? (expenses / budgetTotal) * 100 : 0;
      setBudgetProgress({
        used: expenses,
        total: budgetTotal,
        percent: budgetUsedPercent
      });

      // Build category spending and limits
      const categorySpending = {};
      const categoryLimits = {};

      if (budget?.budget_categories) {
        budget.budget_categories.forEach(bc => {
          categoryLimits[bc.category_id] = Number(bc.limit_amount);
        });
      }

      transactions.forEach(tx => {
        if (tx.type === 'expense' && tx.category_id) {
          categorySpending[tx.category_id] = (categorySpending[tx.category_id] || 0) + Number(tx.amount);
        }
      });

      const categoryNameMap = {};
      categories.forEach(cat => {
        categoryNameMap[cat.id] = cat.name;
      });

      // Build category budgets list - include all categories with limits OR spending
      const allCategoryIds = new Set([
        ...Object.keys(categorySpending),
        ...Object.keys(categoryLimits)
      ]);

      const catBudgets = Array.from(allCategoryIds)
        .map(catId => {
          const spent = categorySpending[catId] || 0;
          const limit = categoryLimits[catId] || 0;
          const percent = limit > 0 ? (spent / limit) * 100 : (spent > 0 ? 100 : 0);
          return {
            id: catId,
            name: categoryNameMap[catId] || 'Unknown',
            spent,
            limit,
            percent,
            remaining: limit - spent
          };
        })
        .filter(cat => cat.spent > 0 || cat.limit > 0) // Only show categories with activity or budget
        .sort((a, b) => b.spent - a.spent);

      setCategoryBudgets(catBudgets);

      // Recent transactions
      const recent = transactions.slice(0, 8).map(tx => ({
        id: tx.id,
        description: tx.description,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        category: tx.categories?.name || 'Uncategorized'
      }));
      setRecentTransactions(recent);

    } catch (err) {
      setError('Failed to load dashboard: ' + err.message);
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getMonthName = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const isCurrentMonth = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return selectedMonth === currentMonth;
  };

  if (loading) {
    return (
      <Flex w="100%" h="100%" align="center" justify="center">
        <VStack gap={4}>
          <Spinner size="xl" />
          <Text>Loading dashboard...</Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Box w="100%" h="100%" bg="gray.50" p={6}>
      <Box w="100%">
        <VStack gap={6} align="stretch" w="100%">
          {/* Header with Month Picker */}
          <Flex justify="space-between" align="center" w="100%" flexWrap="wrap" gap={4}>
            <Box>
              <Heading size="xl">Dashboard</Heading>
              <Text color="gray.500" fontSize="sm">
                Welcome back, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
              </Text>
            </Box>
            <HStack gap={4}>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                size="md"
                w="180px"
                bg="white"
                borderColor="gray.300"
              />
              <Button as={RouterLink} to="/add-transaction" colorScheme="green" size="md">
                + Add Transaction
              </Button>
            </HStack>
          </Flex>

          {/* Error Message */}
          {error && (
            <Box p={3} bg="red.50" borderRadius="md" borderColor="red.200" borderWidth="1px" w="100%">
              <Text color="red.700" fontSize="sm">{error}</Text>
            </Box>
          )}

          {/* Monthly Summary & Budget Progress - Full Width Row */}
          <Flex gap={6} w="100%" direction={{ base: 'column', md: 'row' }}>
            {/* Monthly Summary Card */}
            <Box flex="1" p={6} borderRadius="lg" borderWidth="1px" borderColor="gray.200" bg="white">
              <Flex justify="space-between" align="center" mb={4}>
                <Heading size="md">{getMonthName(selectedMonth)}</Heading>
                {isCurrentMonth() && daysLeft > 0 && (
                  <Text fontSize="sm" color="gray.500">{daysLeft} days left</Text>
                )}
              </Flex>

              <Flex gap={4} w="100%">
                <Box flex="1" textAlign="center" p={4} bg="green.50" borderRadius="md">
                  <Text fontSize="sm" color="gray.600" mb={1}>Income</Text>
                  <Text fontSize="2xl" fontWeight="bold" color="green.600">
                    {formatCurrency(monthlySummary.income)}
                  </Text>
                </Box>

                <Box flex="1" textAlign="center" p={4} bg="red.50" borderRadius="md">
                  <Text fontSize="sm" color="gray.600" mb={1}>Expenses</Text>
                  <Text fontSize="2xl" fontWeight="bold" color="red.600">
                    {formatCurrency(monthlySummary.expenses)}
                  </Text>
                </Box>

                <Box flex="1" textAlign="center" p={4} bg={monthlySummary.net >= 0 ? "blue.50" : "orange.50"} borderRadius="md">
                  <Text fontSize="sm" color="gray.600" mb={1}>Net</Text>
                  <Text fontSize="2xl" fontWeight="bold" color={monthlySummary.net >= 0 ? "blue.600" : "orange.600"}>
                    {formatCurrency(monthlySummary.net)}
                  </Text>
                </Box>
              </Flex>
            </Box>

            {/* Overall Budget Progress Card */}
            <Box flex="1" p={6} borderRadius="lg" borderWidth="1px" borderColor="gray.200" bg="white">
              <Flex justify="space-between" align="center" mb={4}>
                <Heading size="md">Overall Budget</Heading>
                <Text fontSize="lg" fontWeight="bold" color={budgetProgress.percent > 100 ? 'red.600' : budgetProgress.percent > 80 ? 'yellow.600' : 'green.600'}>
                  {budgetProgress.total > 0 ? `${budgetProgress.percent.toFixed(0)}%` : '-'}
                </Text>
              </Flex>

              {budgetProgress.total > 0 ? (
                <VStack align="stretch" gap={4}>
                  <Box>
                    <Flex justify="space-between" mb={2}>
                      <Text fontSize="md" color="gray.600">
                        Spent: <Text as="span" fontWeight="bold">{formatCurrency(budgetProgress.used)}</Text>
                      </Text>
                      <Text fontSize="md" color="gray.600">
                        Limit: <Text as="span" fontWeight="bold">{formatCurrency(budgetProgress.total)}</Text>
                      </Text>
                    </Flex>
                    <Progress.Root value={Math.min(budgetProgress.percent, 100)} size="lg" borderRadius="full">
                      <Progress.Track>
                        <Progress.Range
                          style={{
                            backgroundColor: budgetProgress.percent > 100 ? '#E53E3E' : budgetProgress.percent > 80 ? '#D69E2E' : '#38A169'
                          }}
                        />
                      </Progress.Track>
                    </Progress.Root>
                  </Box>
                  <Text fontSize="md" fontWeight="medium" color={budgetProgress.percent > 100 ? 'red.600' : 'green.600'}>
                    {budgetProgress.percent <= 100
                      ? `${formatCurrency(budgetProgress.total - budgetProgress.used)} remaining`
                      : `${formatCurrency(budgetProgress.used - budgetProgress.total)} over budget`
                    }
                  </Text>
                </VStack>
              ) : (
                <Flex direction="column" align="center" justify="center" py={6}>
                  <Text color="gray.500" mb={3}>No budget set for this month</Text>
                  <Button as={RouterLink} to="/budget" colorScheme="blue">
                    Set Budget
                  </Button>
                </Flex>
              )}
            </Box>
          </Flex>

          {/* Category Budgets & Recent Transactions - Full Width Row */}
          <Flex gap={6} w="100%" direction={{ base: 'column', lg: 'row' }}>
            {/* Category Spending with Limits */}
            <Box flex="1" p={6} borderRadius="lg" borderWidth="1px" borderColor="gray.200" bg="white">
              <Flex justify="space-between" align="center" mb={4}>
                <Heading size="md">Spending by Category</Heading>
                <Button as={RouterLink} to="/budget" variant="ghost" size="sm">
                  Manage
                </Button>
              </Flex>

              {categoryBudgets.length > 0 ? (
                <VStack align="stretch" gap={3}>
                  {categoryBudgets.map((cat) => (
                    <Box key={cat.id} p={3} bg="gray.50" borderRadius="md">
                      <Flex justify="space-between" align="center" mb={2}>
                        <Text fontWeight="medium">{cat.name}</Text>
                        <HStack gap={2}>
                          {cat.limit > 0 && (
                            <Badge
                              colorScheme={cat.percent > 100 ? 'red' : cat.percent > 80 ? 'yellow' : 'green'}
                              fontSize="sm"
                            >
                              {cat.percent.toFixed(0)}%
                            </Badge>
                          )}
                        </HStack>
                      </Flex>
                      <Flex justify="space-between" align="center" mb={2}>
                        <Text fontSize="sm" color="gray.600">
                          {formatCurrency(cat.spent)} {cat.limit > 0 ? `of ${formatCurrency(cat.limit)}` : '(no limit)'}
                        </Text>
                        {cat.limit > 0 && (
                          <Text
                            fontSize="sm"
                            fontWeight="medium"
                            color={cat.remaining >= 0 ? 'green.600' : 'red.600'}
                          >
                            {cat.remaining >= 0 ? `${formatCurrency(cat.remaining)} left` : `${formatCurrency(Math.abs(cat.remaining))} over`}
                          </Text>
                        )}
                      </Flex>
                      {cat.limit > 0 && (
                        <Progress.Root value={Math.min(cat.percent, 100)} size="sm" borderRadius="full">
                          <Progress.Track>
                            <Progress.Range
                              style={{
                                backgroundColor: cat.percent > 100 ? '#E53E3E' : cat.percent > 80 ? '#D69E2E' : '#38A169'
                              }}
                            />
                          </Progress.Track>
                        </Progress.Root>
                      )}
                    </Box>
                  ))}
                </VStack>
              ) : (
                <Flex justify="center" align="center" py={8}>
                  <Text color="gray.500">No spending this month</Text>
                </Flex>
              )}
            </Box>

            {/* Top Spending - Simple List */}
            <Box flex="1" p={6} borderRadius="lg" borderWidth="1px" borderColor="gray.200" bg="white" alignSelf="flex-start">
              <Flex justify="space-between" align="center" mb={4}>
                <Heading size="md">Top Spending</Heading>
                <Button as={RouterLink} to="/transactions" variant="ghost" size="sm">
                  View All
                </Button>
              </Flex>

              {categoryBudgets.length > 0 ? (
                <VStack align="stretch" gap={0}>
                  {categoryBudgets.slice(0, 8).map((cat, index) => (
                    <Flex
                      key={cat.id}
                      justify="space-between"
                      align="center"
                      py={3}
                      borderBottomWidth="1px"
                      borderColor="gray.100"
                      _last={{ borderBottomWidth: 0 }}
                    >
                      <HStack>
                        <Text fontSize="sm" color="gray.400" w="24px">{index + 1}.</Text>
                        <Text fontWeight="medium">{cat.name}</Text>
                      </HStack>
                      <Text fontWeight="bold" color="red.600">{formatCurrency(cat.spent)}</Text>
                    </Flex>
                  ))}
                </VStack>
              ) : (
                <Flex justify="center" align="center" py={8}>
                  <Text color="gray.500">No spending this month</Text>
                </Flex>
              )}
            </Box>
          </Flex>

          {/* Quick Actions */}
          <HStack gap={4} flexWrap="wrap">
            <Button as={RouterLink} to="/import" colorScheme="teal" size="md">
              Import Transactions
            </Button>
            <Button as={RouterLink} to="/budget" colorScheme="blue" size="md">
              Manage Budget
            </Button>
            <Button as={RouterLink} to="/transactions" variant="outline" size="md">
              All Transactions
            </Button>
            <Button as={RouterLink} to="/categories" variant="outline" size="md">
              Categories
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}
