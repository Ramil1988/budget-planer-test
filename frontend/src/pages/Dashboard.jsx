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
  Button,
  Input,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PageContainer from '../components/PageContainer';

// Category color mapping for visual distinction
const categoryColors = {
  'Mortgage': '#6366F1',
  'Food/Costco': '#F59E0B',
  'Food': '#F59E0B',
  'Subscriptions': '#8B5CF6',
  'Mobile/Internet': '#3B82F6',
  'NB Power': '#EF4444',
  'Autocredit': '#10B981',
  'Fuel': '#F97316',
  'Unexpected': '#EC4899',
  'Clothes': '#14B8A6',
  'Insurance': '#6366F1',
  'Pharmacy': '#22C55E',
  'Household items/Car': '#64748B',
  'Weekend': '#A855F7',
  'Haircut': '#06B6D4',
  'Massage': '#D946EF',
  'Afterschool': '#0EA5E9',
  'Government Loan': '#78716C',
  'Property tax': '#84CC16',
  'default': '#94A3B8'
};

const getCategoryColor = (name) => categoryColors[name] || categoryColors.default;

// Donut Chart Component
const DonutChart = ({ data, total, size = 200, formatCurrency }) => {
  const strokeWidth = 35;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const center = size / 2;

  // Calculate segments
  let currentOffset = 0;
  const segments = data.map((item, index) => {
    const percent = total > 0 ? (item.spent / total) * 100 : 0;
    const segmentLength = (percent / 100) * circumference;
    const segment = {
      ...item,
      percent,
      offset: currentOffset,
      length: segmentLength,
      color: getCategoryColor(item.name)
    };
    currentOffset += segmentLength;
    return segment;
  });

  return (
    <Box position="relative" w={size} h={size}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#F4F4F5"
          strokeWidth={strokeWidth}
        />
        {/* Segments */}
        {segments.map((segment, index) => (
          <circle
            key={segment.id || index}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${segment.length} ${circumference - segment.length}`}
            strokeDashoffset={-segment.offset}
            style={{
              transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease',
            }}
          />
        ))}
      </svg>
      {/* Center text - Total Amount */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        textAlign="center"
      >
        <Text fontSize="xs" color="#71717A" fontWeight="500" mb={0.5}>
          Total Spent
        </Text>
        <Text fontSize="xl" fontWeight="800" color="#18181B" letterSpacing="-0.02em">
          {formatCurrency ? formatCurrency(total) : `$${total.toFixed(0)}`}
        </Text>
      </Box>
    </Box>
  );
};

// Weekly Spending Bar Chart Component
const WeeklyBarChart = ({ dailyData, maxAmount, formatCurrency, weekOffset = 0 }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const barHeight = 100;

  // Get current day (0 = Sunday, so we need to adjust for Mon-Sun array)
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1; // Convert to Mon=0, Sun=6

  return (
    <VStack gap={3} align="stretch">
      <Flex align="flex-end" justify="space-between" h={`${barHeight + 30}px`} gap={2}>
        {days.map((day, index) => {
          const amount = dailyData[index] || 0;
          const heightPercent = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
          // Only highlight "today" when viewing current week
          const isToday = weekOffset === 0 && index === todayIndex;
          const hasSpending = amount > 0;

          return (
            <VStack key={day} gap={1} flex="1" align="center">
              {/* Amount label above bar */}
              <Text
                fontSize="xs"
                fontWeight="600"
                color={hasSpending ? '#18181B' : '#A1A1AA'}
                h="16px"
              >
                {hasSpending ? `$${amount.toFixed(0)}` : ''}
              </Text>
              <Box
                w="100%"
                maxW="40px"
                h={`${barHeight - 20}px`}
                bg="#F4F4F5"
                borderRadius="8px"
                overflow="hidden"
                position="relative"
              >
                <Box
                  position="absolute"
                  bottom="0"
                  left="0"
                  right="0"
                  h={`${Math.max(heightPercent, hasSpending ? 8 : 0)}%`}
                  bg={isToday
                    ? 'linear-gradient(180deg, #3B82F6 0%, #2563EB 100%)'
                    : hasSpending
                      ? 'linear-gradient(180deg, #A855F7 0%, #7C3AED 100%)'
                      : '#E4E4E7'
                  }
                  borderRadius="8px"
                  transition="height 0.5s ease"
                />
              </Box>
              <Text
                fontSize="xs"
                fontWeight={isToday ? '700' : '500'}
                color={isToday ? '#2563EB' : '#71717A'}
              >
                {day}
              </Text>
            </VStack>
          );
        })}
      </Flex>
    </VStack>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [monthlySummary, setMonthlySummary] = useState({ income: 0, expenses: 0, net: 0 });
  const [budgetProgress, setBudgetProgress] = useState({ used: 0, total: 0, percent: 0 });
  const [categoryBudgets, setCategoryBudgets] = useState([]);
  const [daysLeft, setDaysLeft] = useState(0);
  const [weeklySpending, setWeeklySpending] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [maxDailySpending, setMaxDailySpending] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [allTransactions, setAllTransactions] = useState([]); // Store for week navigation

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, selectedMonth]);

  // Recalculate weekly spending when week offset changes
  useEffect(() => {
    if (allTransactions.length > 0) {
      calculateWeeklySpending(allTransactions, weekOffset);
    }
  }, [weekOffset, allTransactions]);

  // Calculate weekly spending for a given week offset
  const calculateWeeklySpending = (transactions, offset) => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset + (offset * 7));
    monday.setHours(0, 0, 0, 0);

    const dailySpending = [0, 0, 0, 0, 0, 0, 0]; // Mon to Sun

    transactions.forEach(tx => {
      if (tx.type === 'expense') {
        const txDate = new Date(tx.date + 'T00:00:00');
        const dayDiff = Math.floor((txDate - monday) / (1000 * 60 * 60 * 24));
        if (dayDiff >= 0 && dayDiff < 7) {
          dailySpending[dayDiff] += Number(tx.amount);
        }
      }
    });

    setWeeklySpending(dailySpending);
    setMaxDailySpending(Math.max(...dailySpending, 1));
  };

  // Get the date range label for the current week view
  const getWeekLabel = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset + (weekOffset * 7));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatDate = (date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (weekOffset === 0) {
      return 'This Week';
    } else if (weekOffset === -1) {
      return 'Last Week';
    } else {
      return `${formatDate(monday)} - ${formatDate(sunday)}`;
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
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

      const budgetTotal = budget?.total || 0;
      const budgetUsedPercent = budgetTotal > 0 ? (expenses / budgetTotal) * 100 : 0;
      setBudgetProgress({
        used: expenses,
        total: budgetTotal,
        percent: budgetUsedPercent
      });

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
        .filter(cat => cat.spent > 0 || cat.limit > 0)
        .sort((a, b) => b.spent - a.spent);

      setCategoryBudgets(catBudgets);

      // Store transactions for week navigation and calculate initial weekly spending
      setAllTransactions(transactions);
      setWeekOffset(0); // Reset to current week when month changes
      calculateWeeklySpending(transactions, 0);

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

  const getProgressColor = (percent) => {
    if (percent > 100) return 'danger';
    if (percent > 80) return 'warning';
    return 'success';
  };

  if (loading) {
    return (
      <PageContainer>
        <Flex w="100%" minH="60vh" align="center" justify="center">
          <VStack gap={4}>
            <Spinner size="xl" color="blue.500" thickness="3px" />
            <Text color="gray.500" fontWeight="500">Loading your dashboard...</Text>
          </VStack>
        </Flex>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <VStack gap={{ base: 5, md: 6 }} align="stretch" w="100%">

          {/* Header */}
          <Flex
            justify="space-between"
            align={{ base: 'stretch', md: 'center' }}
            direction={{ base: 'column', sm: 'row' }}
            gap={4}
          >
            <Box>
              <Heading
                size={{ base: 'lg', md: 'xl' }}
                color="#18181B"
                letterSpacing="-0.02em"
              >
                Dashboard
              </Heading>
              <Text color="#71717A" fontSize="sm" mt={1}>
                Welcome back, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
              </Text>
            </Box>
            <Flex gap={3} align="center" flexWrap="wrap">
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                size="md"
                w={{ base: '140px', md: '160px' }}
                bg="white"
                borderColor="#E4E4E7"
                borderRadius="12px"
                _hover={{ borderColor: '#2563EB' }}
                _focus={{ borderColor: '#2563EB', boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)' }}
              />
              <Button
                as={RouterLink}
                to="/add-transaction"
                bg="linear-gradient(135deg, #18181B 0%, #2563EB 100%)"
                color="white"
                size="md"
                borderRadius="12px"
                fontWeight="600"
                px={5}
                _hover={{
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                }}
                transition="all 0.2s"
              >
                + Add Transaction
              </Button>
            </Flex>
          </Flex>

          {error && (
            <Box
              p={4}
              bg="#FEF2F2"
              borderRadius="12px"
              borderLeft="4px solid #EF4444"
            >
              <Text color="#DC2626" fontSize="sm" fontWeight="500">{error}</Text>
            </Box>
          )}

          {/* Monthly Summary Cards */}
          <Box
            p={{ base: 5, md: 6 }}
            borderRadius="16px"
            bg="white"
            boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)"
            border="1px solid #F4F4F5"
          >
            <Flex justify="space-between" align="center" mb={5}>
              <Heading size={{ base: 'sm', md: 'md' }} color="#18181B" letterSpacing="-0.01em">
                {getMonthName(selectedMonth)}
              </Heading>
              {isCurrentMonth() && daysLeft > 0 && (
                <Box
                  bg="#F4F4F5"
                  px={3}
                  py={1}
                  borderRadius="full"
                >
                  <Text fontSize="xs" fontWeight="600" color="#71717A">
                    {daysLeft} days left
                  </Text>
                </Box>
              )}
            </Flex>

            <Flex gap={{ base: 3, md: 4 }} direction={{ base: 'column', sm: 'row' }}>
              {/* Income Card */}
              <Box
                flex="1"
                p={{ base: 4, md: 5 }}
                borderRadius="14px"
                bg="linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)"
                position="relative"
                overflow="hidden"
              >
                <Box
                  position="absolute"
                  top="-20px"
                  right="-20px"
                  w="80px"
                  h="80px"
                  borderRadius="full"
                  bg="rgba(16, 185, 129, 0.1)"
                />
                <Text fontSize="xs" fontWeight="600" color="#059669" textTransform="uppercase" letterSpacing="0.05em" mb={1}>
                  Income
                </Text>
                <Text
                  fontSize={{ base: 'xl', md: '2xl' }}
                  fontWeight="700"
                  color="#059669"
                  fontFamily="'Plus Jakarta Sans', sans-serif"
                  letterSpacing="-0.02em"
                >
                  {formatCurrency(monthlySummary.income)}
                </Text>
              </Box>

              {/* Expenses Card */}
              <Box
                flex="1"
                p={{ base: 4, md: 5 }}
                borderRadius="14px"
                bg="linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)"
                position="relative"
                overflow="hidden"
              >
                <Box
                  position="absolute"
                  top="-20px"
                  right="-20px"
                  w="80px"
                  h="80px"
                  borderRadius="full"
                  bg="rgba(225, 29, 72, 0.1)"
                />
                <Text fontSize="xs" fontWeight="600" color="#E11D48" textTransform="uppercase" letterSpacing="0.05em" mb={1}>
                  Expenses
                </Text>
                <Text
                  fontSize={{ base: 'xl', md: '2xl' }}
                  fontWeight="700"
                  color="#E11D48"
                  fontFamily="'Plus Jakarta Sans', sans-serif"
                  letterSpacing="-0.02em"
                >
                  {formatCurrency(monthlySummary.expenses)}
                </Text>
              </Box>

              {/* Net Card */}
              <Box
                flex="1"
                p={{ base: 4, md: 5 }}
                borderRadius="14px"
                bg={monthlySummary.net >= 0
                  ? "linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)"
                  : "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)"
                }
                position="relative"
                overflow="hidden"
              >
                <Box
                  position="absolute"
                  top="-20px"
                  right="-20px"
                  w="80px"
                  h="80px"
                  borderRadius="full"
                  bg={monthlySummary.net >= 0 ? "rgba(14, 165, 233, 0.1)" : "rgba(234, 88, 12, 0.1)"}
                />
                <Text
                  fontSize="xs"
                  fontWeight="600"
                  color={monthlySummary.net >= 0 ? "#0284C7" : "#EA580C"}
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                  mb={1}
                >
                  Net Balance
                </Text>
                <Text
                  fontSize={{ base: 'xl', md: '2xl' }}
                  fontWeight="700"
                  color={monthlySummary.net >= 0 ? "#0284C7" : "#EA580C"}
                  fontFamily="'Plus Jakarta Sans', sans-serif"
                  letterSpacing="-0.02em"
                >
                  {formatCurrency(monthlySummary.net)}
                </Text>
              </Box>
            </Flex>
          </Box>

          {/* Charts Row - Donut & Weekly */}
          <Flex gap={{ base: 5, md: 6 }} direction={{ base: 'column', lg: 'row' }}>
            {/* Spending Breakdown Donut Chart */}
            <Box
              flex="1"
              p={{ base: 5, md: 6 }}
              borderRadius="16px"
              bg="white"
              boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)"
              border="1px solid #F4F4F5"
            >
              <Flex justify="space-between" align="center" mb={5}>
                <Heading size={{ base: 'sm', md: 'md' }} color="#18181B" letterSpacing="-0.01em">
                  Spending Breakdown
                </Heading>
                <Button
                  as={RouterLink}
                  to="/budget"
                  variant="ghost"
                  size="sm"
                  color="#2563EB"
                  fontWeight="600"
                  _hover={{ bg: '#EFF6FF' }}
                >
                  Details
                </Button>
              </Flex>

              {categoryBudgets.length > 0 ? (
                <Flex direction={{ base: 'column', md: 'row' }} align="center" gap={6}>
                  {/* Donut Chart */}
                  <Box flexShrink={0}>
                    <DonutChart
                      data={categoryBudgets.slice(0, 8)}
                      total={monthlySummary.expenses}
                      size={180}
                    />
                  </Box>

                  {/* Legend */}
                  <VStack align="stretch" gap={2} flex="1" w="100%">
                    {categoryBudgets.slice(0, 6).map((cat) => (
                      <Flex
                        key={cat.id}
                        align="center"
                        justify="space-between"
                        py={1.5}
                        px={2}
                        borderRadius="8px"
                        _hover={{ bg: '#FAFAFA' }}
                        transition="all 0.15s"
                      >
                        <HStack gap={2}>
                          <Box
                            w="10px"
                            h="10px"
                            borderRadius="full"
                            bg={getCategoryColor(cat.name)}
                            flexShrink={0}
                          />
                          <Text fontSize="sm" fontWeight="500" color="#18181B" noOfLines={1}>
                            {cat.name}
                          </Text>
                        </HStack>
                        <HStack gap={2}>
                          <Text fontSize="sm" fontWeight="600" color="#18181B">
                            {formatCurrency(cat.spent)}
                          </Text>
                          <Text fontSize="xs" color="#71717A">
                            {monthlySummary.expenses > 0
                              ? `${((cat.spent / monthlySummary.expenses) * 100).toFixed(0)}%`
                              : '0%'
                            }
                          </Text>
                        </HStack>
                      </Flex>
                    ))}
                    {categoryBudgets.length > 6 && (
                      <Text fontSize="xs" color="#71717A" textAlign="center" pt={1}>
                        +{categoryBudgets.length - 6} more categories
                      </Text>
                    )}
                  </VStack>
                </Flex>
              ) : (
                <Flex justify="center" align="center" py={12}>
                  <Text color="#71717A">No spending this month</Text>
                </Flex>
              )}
            </Box>

            {/* Weekly Spending Chart */}
            <Box
              flex="1"
              p={{ base: 5, md: 6 }}
              borderRadius="16px"
              bg="white"
              boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)"
              border="1px solid #F4F4F5"
            >
              <Flex justify="space-between" align="center" mb={5}>
                <HStack gap={2}>
                  {/* Previous Week Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setWeekOffset(prev => prev - 1)}
                    p={1}
                    minW="28px"
                    h="28px"
                    borderRadius="8px"
                    color="#71717A"
                    _hover={{ bg: '#F4F4F5', color: '#18181B' }}
                  >
                    ←
                  </Button>
                  <Heading size={{ base: 'sm', md: 'md' }} color="#18181B" letterSpacing="-0.01em" minW="100px" textAlign="center">
                    {getWeekLabel()}
                  </Heading>
                  {/* Next Week Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setWeekOffset(prev => prev + 1)}
                    p={1}
                    minW="28px"
                    h="28px"
                    borderRadius="8px"
                    color="#71717A"
                    _hover={{ bg: '#F4F4F5', color: '#18181B' }}
                    disabled={weekOffset >= 0}
                    opacity={weekOffset >= 0 ? 0.3 : 1}
                    cursor={weekOffset >= 0 ? 'not-allowed' : 'pointer'}
                  >
                    →
                  </Button>
                </HStack>
                <Box bg="#F4F4F5" px={3} py={1} borderRadius="full">
                  <Text fontSize="xs" fontWeight="600" color="#71717A">
                    {formatCurrency(weeklySpending.reduce((a, b) => a + b, 0))} total
                  </Text>
                </Box>
              </Flex>

              <WeeklyBarChart dailyData={weeklySpending} maxAmount={maxDailySpending} weekOffset={weekOffset} />

              <Box mt={4} p={3} borderRadius="10px" bg="#F4F4F5">
                <Flex justify="space-between" align="center">
                  <Text fontSize="sm" color="#71717A">
                    Daily average
                  </Text>
                  <Text fontSize="sm" fontWeight="700" color="#18181B">
                    {formatCurrency(weeklySpending.reduce((a, b) => a + b, 0) / 7)}
                  </Text>
                </Flex>
              </Box>
            </Box>
          </Flex>

          {/* Budget Progress & Top Spending Row */}
          <Flex gap={{ base: 5, md: 6 }} direction={{ base: 'column', lg: 'row' }}>

            {/* Overall Budget Progress */}
            <Box
              flex="1"
              p={{ base: 5, md: 6 }}
              borderRadius="16px"
              bg="white"
              boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)"
              border="1px solid #F4F4F5"
            >
              <Flex justify="space-between" align="center" mb={5}>
                <Heading size={{ base: 'sm', md: 'md' }} color="#18181B" letterSpacing="-0.01em">
                  Budget Overview
                </Heading>
                {budgetProgress.total > 0 && (
                  <Box
                    bg={budgetProgress.percent > 100 ? '#FEF2F2' : budgetProgress.percent > 80 ? '#FFFBEB' : '#ECFDF5'}
                    px={3}
                    py={1}
                    borderRadius="full"
                  >
                    <Text
                      fontSize="sm"
                      fontWeight="700"
                      color={budgetProgress.percent > 100 ? '#DC2626' : budgetProgress.percent > 80 ? '#D97706' : '#059669'}
                    >
                      {budgetProgress.percent.toFixed(0)}%
                    </Text>
                  </Box>
                )}
              </Flex>

              {budgetProgress.total > 0 ? (
                <VStack align="stretch" gap={4}>
                  <Box>
                    <Flex justify="space-between" mb={3}>
                      <Text fontSize="sm" color="#71717A">
                        Spent <Text as="span" fontWeight="700" color="#18181B">{formatCurrency(budgetProgress.used)}</Text>
                      </Text>
                      <Text fontSize="sm" color="#71717A">
                        of <Text as="span" fontWeight="700" color="#18181B">{formatCurrency(budgetProgress.total)}</Text>
                      </Text>
                    </Flex>

                    {/* Custom Progress Bar */}
                    <Box h="10px" bg="#F4F4F5" borderRadius="full" overflow="hidden">
                      <Box
                        h="100%"
                        w={`${Math.min(budgetProgress.percent, 100)}%`}
                        borderRadius="full"
                        bg={
                          budgetProgress.percent > 100
                            ? 'linear-gradient(90deg, #FB7185 0%, #E11D48 100%)'
                            : budgetProgress.percent > 80
                              ? 'linear-gradient(90deg, #FBBF24 0%, #D97706 100%)'
                              : 'linear-gradient(90deg, #34D399 0%, #059669 100%)'
                        }
                        transition="width 0.5s ease"
                      />
                    </Box>
                  </Box>

                  <Box
                    p={3}
                    borderRadius="10px"
                    bg={budgetProgress.percent > 100 ? '#FEF2F2' : '#ECFDF5'}
                  >
                    <Text
                      fontSize="sm"
                      fontWeight="600"
                      color={budgetProgress.percent > 100 ? '#DC2626' : '#059669'}
                    >
                      {budgetProgress.percent <= 100
                        ? `${formatCurrency(budgetProgress.total - budgetProgress.used)} remaining this month`
                        : `${formatCurrency(budgetProgress.used - budgetProgress.total)} over budget`
                      }
                    </Text>
                  </Box>
                </VStack>
              ) : (
                <Flex direction="column" align="center" justify="center" py={8}>
                  <Box
                    w="48px"
                    h="48px"
                    borderRadius="12px"
                    bg="#F4F4F5"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    mb={3}
                  >
                    <Text fontSize="xl">📊</Text>
                  </Box>
                  <Text color="#71717A" mb={3} textAlign="center">No budget set for this month</Text>
                  <Button
                    as={RouterLink}
                    to="/budget"
                    size="sm"
                    bg="#2563EB"
                    color="white"
                    borderRadius="10px"
                    _hover={{ bg: '#1D4ED8' }}
                  >
                    Set Budget
                  </Button>
                </Flex>
              )}
            </Box>

            {/* Top Spending */}
            <Box
              flex="1"
              p={{ base: 5, md: 6 }}
              borderRadius="16px"
              bg="white"
              boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)"
              border="1px solid #F4F4F5"
            >
              <Flex justify="space-between" align="center" mb={4}>
                <Heading size={{ base: 'sm', md: 'md' }} color="#18181B" letterSpacing="-0.01em">
                  Top Spending
                </Heading>
                <Button
                  as={RouterLink}
                  to="/transactions"
                  variant="ghost"
                  size="sm"
                  color="#2563EB"
                  fontWeight="600"
                  _hover={{ bg: '#EFF6FF' }}
                >
                  View All
                </Button>
              </Flex>

              {categoryBudgets.length > 0 ? (
                <VStack align="stretch" gap={0}>
                  {categoryBudgets.slice(0, 6).map((cat, index) => (
                    <Flex
                      key={cat.id}
                      align="center"
                      py={3}
                      borderBottomWidth="1px"
                      borderColor="#F4F4F5"
                      _last={{ borderBottomWidth: 0 }}
                      _hover={{ bg: '#FAFAFA', mx: -3, px: 3, borderRadius: '8px' }}
                      transition="all 0.15s"
                      cursor="pointer"
                    >
                      {/* Rank */}
                      <Flex
                        w="28px"
                        h="28px"
                        borderRadius="full"
                        bg={index < 3 ? 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)' : '#F4F4F5'}
                        color={index < 3 ? 'white' : '#A1A1AA'}
                        align="center"
                        justify="center"
                        fontSize="xs"
                        fontWeight="700"
                        mr={3}
                        flexShrink={0}
                      >
                        {index + 1}
                      </Flex>

                      {/* Category dot & name */}
                      <HStack flex="1" gap={2}>
                        <Box
                          w="8px"
                          h="8px"
                          borderRadius="full"
                          bg={getCategoryColor(cat.name)}
                          flexShrink={0}
                        />
                        <Text
                          fontWeight="500"
                          fontSize="sm"
                          color="#18181B"
                          noOfLines={1}
                        >
                          {cat.name}
                        </Text>
                      </HStack>

                      {/* Amount */}
                      <Text
                        fontWeight="700"
                        fontSize="sm"
                        color="#E11D48"
                        fontFamily="'Plus Jakarta Sans', sans-serif"
                        ml={2}
                      >
                        {formatCurrency(cat.spent)}
                      </Text>
                    </Flex>
                  ))}
                </VStack>
              ) : (
                <Flex justify="center" align="center" py={8}>
                  <Text color="#71717A">No spending this month</Text>
                </Flex>
              )}
            </Box>
          </Flex>

          {/* Category Budgets */}
          <Box
            p={{ base: 5, md: 6 }}
            borderRadius="16px"
            bg="white"
            boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)"
            border="1px solid #F4F4F5"
          >
            <Flex justify="space-between" align="center" mb={5}>
              <Heading size={{ base: 'sm', md: 'md' }} color="#18181B" letterSpacing="-0.01em">
                Spending by Category
              </Heading>
              <Button
                as={RouterLink}
                to="/budget"
                variant="ghost"
                size="sm"
                color="#2563EB"
                fontWeight="600"
                _hover={{ bg: '#EFF6FF' }}
              >
                Manage
              </Button>
            </Flex>

            {categoryBudgets.length > 0 ? (
              <VStack align="stretch" gap={3}>
                {categoryBudgets.map((cat) => (
                  <Box
                    key={cat.id}
                    p={4}
                    bg="#FAFAFA"
                    borderRadius="12px"
                    border="1px solid #F4F4F5"
                    _hover={{ borderColor: '#E4E4E7' }}
                    transition="all 0.15s"
                  >
                    <Flex justify="space-between" align="center" mb={2}>
                      <HStack gap={2}>
                        <Box
                          w="10px"
                          h="10px"
                          borderRadius="full"
                          bg={getCategoryColor(cat.name)}
                        />
                        <Text fontWeight="600" fontSize="sm" color="#18181B">{cat.name}</Text>
                      </HStack>
                      {cat.limit > 0 && (
                        <Box
                          px={2}
                          py={0.5}
                          borderRadius="full"
                          bg={cat.percent > 100 ? '#FEF2F2' : cat.percent > 80 ? '#FFFBEB' : '#ECFDF5'}
                        >
                          <Text
                            fontSize="xs"
                            fontWeight="700"
                            color={cat.percent > 100 ? '#DC2626' : cat.percent > 80 ? '#D97706' : '#059669'}
                          >
                            {cat.percent.toFixed(0)}%
                          </Text>
                        </Box>
                      )}
                    </Flex>

                    <Flex justify="space-between" align="center" mb={2}>
                      <Text fontSize="sm" color="#71717A">
                        <Text as="span" fontWeight="600" color="#18181B">{formatCurrency(cat.spent)}</Text>
                        {cat.limit > 0 ? ` of ${formatCurrency(cat.limit)}` : ' (no limit)'}
                      </Text>
                      {cat.limit > 0 && (
                        <Text
                          fontSize="xs"
                          fontWeight="600"
                          color={cat.remaining >= 0 ? '#059669' : '#DC2626'}
                        >
                          {cat.remaining >= 0 ? `${formatCurrency(cat.remaining)} left` : `${formatCurrency(Math.abs(cat.remaining))} over`}
                        </Text>
                      )}
                    </Flex>

                    {cat.limit > 0 && (
                      <Box h="6px" bg="#E4E4E7" borderRadius="full" overflow="hidden">
                        <Box
                          h="100%"
                          w={`${Math.min(cat.percent, 100)}%`}
                          borderRadius="full"
                          bg={
                            cat.percent > 100
                              ? 'linear-gradient(90deg, #FB7185 0%, #E11D48 100%)'
                              : cat.percent > 80
                                ? 'linear-gradient(90deg, #FBBF24 0%, #D97706 100%)'
                                : 'linear-gradient(90deg, #34D399 0%, #059669 100%)'
                          }
                          transition="width 0.3s ease"
                        />
                      </Box>
                    )}
                  </Box>
                ))}
              </VStack>
            ) : (
              <Flex justify="center" align="center" py={8}>
                <Text color="#71717A">No spending this month</Text>
              </Flex>
            )}
          </Box>

          {/* Quick Actions */}
          <Flex gap={3} flexWrap="wrap">
            <Button
              as={RouterLink}
              to="/import"
              bg="white"
              color="#18181B"
              size="md"
              borderRadius="12px"
              fontWeight="600"
              border="1px solid #E4E4E7"
              _hover={{ borderColor: '#2563EB', bg: '#EFF6FF' }}
              transition="all 0.2s"
            >
              Import Transactions
            </Button>
            <Button
              as={RouterLink}
              to="/budget"
              bg="white"
              color="#18181B"
              size="md"
              borderRadius="12px"
              fontWeight="600"
              border="1px solid #E4E4E7"
              _hover={{ borderColor: '#2563EB', bg: '#EFF6FF' }}
              transition="all 0.2s"
            >
              Manage Budget
            </Button>
            <Button
              as={RouterLink}
              to="/transactions"
              bg="white"
              color="#18181B"
              size="md"
              borderRadius="12px"
              fontWeight="600"
              border="1px solid #E4E4E7"
              _hover={{ borderColor: '#2563EB', bg: '#EFF6FF' }}
              transition="all 0.2s"
            >
              All Transactions
            </Button>
            <Button
              as={RouterLink}
              to="/categories"
              bg="white"
              color="#18181B"
              size="md"
              borderRadius="12px"
              fontWeight="600"
              border="1px solid #E4E4E7"
              _hover={{ borderColor: '#2563EB', bg: '#EFF6FF' }}
              transition="all 0.2s"
            >
              Categories
            </Button>
          </Flex>
      </VStack>
    </PageContainer>
  );
}
