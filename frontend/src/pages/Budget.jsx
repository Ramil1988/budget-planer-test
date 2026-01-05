import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  VStack,
  HStack,
  Text,
  Spinner,
  Table,
  Input,
  Button,
  Tabs,
  Badge,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function Budget() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [categories, setCategories] = useState([]);
  const [budgetLimits, setBudgetLimits] = useState({});
  const [budgetData, setBudgetData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeTab, setActiveTab] = useState('tracking');

  useEffect(() => {
    if (user) {
      loadCategories();
    }
  }, [user]);

  useEffect(() => {
    if (user && categories.length > 0) {
      loadBudget();
    }
  }, [user, selectedMonth, categories]);

  const loadCategories = async () => {
    try {
      const { data, error: catError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .order('name');

      if (catError) throw catError;
      setCategories(data || []);
    } catch (err) {
      setError('Failed to load categories: ' + err.message);
    }
  };

  const loadBudget = async () => {
    setLoading(true);
    setError('');
    try {
      // Parse year and month from 'YYYY-MM' format to avoid timezone issues
      const [year, month] = selectedMonth.split('-').map(Number);

      // Create date strings for queries (YYYY-MM-DD format)
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
      const nextMonthStart = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;

      // Load existing budget for this month
      const { data: budgetRow, error: budgetError } = await supabase
        .from('budgets')
        .select(`
          id,
          total,
          budget_categories (
            category_id,
            limit_amount
          )
        `)
        .eq('user_id', user.id)
        .gte('month', startDate)
        .lt('month', nextMonthStart)
        .maybeSingle();

      if (budgetError) throw budgetError;

      // Create limits map from existing budget
      let limitsMap = {};
      if (budgetRow?.budget_categories) {
        budgetRow.budget_categories.forEach(bc => {
          limitsMap[bc.category_id] = bc.limit_amount;
        });
      } else {
        // No budget for this month - try to load from previous month
        const prevYear = month === 1 ? year - 1 : year;
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
        const prevNextMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;

        const { data: prevBudgetRow } = await supabase
          .from('budgets')
          .select(`
            id,
            budget_categories (
              category_id,
              limit_amount
            )
          `)
          .eq('user_id', user.id)
          .gte('month', prevStartDate)
          .lt('month', prevNextMonthStart)
          .maybeSingle();

        if (prevBudgetRow?.budget_categories) {
          prevBudgetRow.budget_categories.forEach(bc => {
            limitsMap[bc.category_id] = bc.limit_amount;
          });
        }
      }
      setBudgetLimits(limitsMap);

      // Load transactions for this month to calculate spent
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('category_id, amount')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', startDate)
        .lte('date', endDate);

      if (txError) throw txError;

      // Calculate spent per category
      const spentMap = {};
      (transactions || []).forEach(tx => {
        if (tx.category_id) {
          spentMap[tx.category_id] = (spentMap[tx.category_id] || 0) + Number(tx.amount);
        }
      });

      // Build budget data for display
      const totalBudget = Object.values(limitsMap).reduce((sum, val) => sum + Number(val || 0), 0);

      const data = categories.map(cat => {
        const limit = Number(limitsMap[cat.id] || 0);
        const spent = Number(spentMap[cat.id] || 0);
        const remaining = limit - spent;
        const percentOfLimit = limit > 0 ? (spent / limit) * 100 : 0;
        const percentOfBudget = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;

        return {
          id: cat.id,
          name: cat.name,
          limit,
          spent,
          remaining,
          percentOfLimit,
          percentOfBudget,
        };
      });

      // Sort by spent (descending) for tracking view
      data.sort((a, b) => b.spent - a.spent);
      setBudgetData(data);
    } catch (err) {
      setError('Failed to load budget: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLimitChange = (categoryId, value) => {
    setBudgetLimits(prev => ({
      ...prev,
      [categoryId]: value === '' ? '' : Number(value),
    }));
  };

  const saveBudget = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // Parse year and month from 'YYYY-MM' format to avoid timezone issues
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonthStart = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;

      const total = Object.values(budgetLimits).reduce((sum, val) => sum + Number(val || 0), 0);

      // Check if budget exists for this month
      const { data: existingBudget } = await supabase
        .from('budgets')
        .select('id')
        .eq('user_id', user.id)
        .gte('month', startDate)
        .lt('month', nextMonthStart)
        .maybeSingle();

      let budgetId;

      if (existingBudget) {
        // Update existing budget
        const { error: updateError } = await supabase
          .from('budgets')
          .update({ total })
          .eq('id', existingBudget.id);
        if (updateError) throw updateError;
        budgetId = existingBudget.id;

        // Delete existing budget categories
        await supabase
          .from('budget_categories')
          .delete()
          .eq('budget_id', budgetId);
      } else {
        // Create new budget
        const { data: newBudget, error: insertError } = await supabase
          .from('budgets')
          .insert({
            user_id: user.id,
            month: startDate,
            total,
          })
          .select('id')
          .single();
        if (insertError) throw insertError;
        budgetId = newBudget.id;
      }

      // Insert budget categories
      const budgetCategories = Object.entries(budgetLimits)
        .filter(([_, limit]) => Number(limit) > 0)
        .map(([categoryId, limit]) => ({
          budget_id: budgetId,
          category_id: categoryId,
          limit_amount: Number(limit),
        }));

      if (budgetCategories.length > 0) {
        const { error: catError } = await supabase
          .from('budget_categories')
          .insert(budgetCategories);
        if (catError) throw catError;
      }

      setSuccess('Budget saved successfully!');
      loadBudget(); // Reload to refresh data
    } catch (err) {
      setError('Failed to save budget: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercent = (percent) => {
    return percent.toFixed(2) + '%';
  };

  const getMonthName = (monthStr) => {
    // Parse year and month from 'YYYY-MM' format to avoid timezone issues
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1); // month is 0-indexed
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Calculate totals
  const totalLimit = budgetData.reduce((sum, item) => sum + item.limit, 0);
  const totalSpent = budgetData.reduce((sum, item) => sum + item.spent, 0);
  const totalRemaining = totalLimit - totalSpent;
  const totalPercentSpent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

  if (loading && categories.length === 0) {
    return (
      <Flex w="100%" minH="calc(100vh - 140px)" align="center" justify="center">
        <VStack gap={4}>
          <Spinner size="xl" />
          <Text>Loading budget...</Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Box w="100%" h="100%" bg="gray.50" p={6}>
      <Box w="100%">
        <VStack gap={6} align="stretch" w="100%">
        {/* Header */}
        <HStack justify="space-between" wrap="wrap" gap={4}>
          <Heading size="xl">Monthly Budget</Heading>
          <HStack>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              size="md"
              w="200px"
              bg="white"
            />
          </HStack>
        </HStack>

        {/* Month Display */}
        <Text fontSize="lg" color="gray.600">
          {getMonthName(selectedMonth)}
        </Text>

        {/* Messages */}
        {error && (
          <Box p={4} bg="red.50" borderRadius="md" borderColor="red.200" borderWidth="1px">
            <Text color="red.700">{error}</Text>
          </Box>
        )}
        {success && (
          <Box p={4} bg="green.50" borderRadius="md" borderColor="green.200" borderWidth="1px">
            <Text color="green.700">{success}</Text>
          </Box>
        )}

        {/* Tabs */}
        <Tabs.Root
          value={activeTab}
          onValueChange={(e) => setActiveTab(e.value)}
          variant="enclosed"
        >
          <Tabs.List>
            <Tabs.Trigger value="tracking" px={6} py={3}>
              Budget Tracking
            </Tabs.Trigger>
            <Tabs.Trigger value="setup" px={6} py={3}>
              Budget Setup
            </Tabs.Trigger>
          </Tabs.List>

          {/* Tracking Tab */}
          <Tabs.Content value="tracking" pt={4}>
            {loading ? (
              <VStack py={8}>
                <Spinner />
                <Text>Loading...</Text>
              </VStack>
            ) : (
              <Box borderWidth="1px" borderRadius="lg" overflow="hidden" bg="white">
                <Table.Root size="sm" style={{ fontSize: '13px' }}>
                  <Table.Header bg="gray.100">
                    <Table.Row>
                      <Table.ColumnHeader fontWeight="bold" py={2} px={3} fontSize="xs">Expense Item</Table.ColumnHeader>
                      <Table.ColumnHeader fontWeight="bold" textAlign="right" py={2} px={3} fontSize="xs">SPENT</Table.ColumnHeader>
                      <Table.ColumnHeader fontWeight="bold" textAlign="right" py={2} px={3} fontSize="xs">Limit</Table.ColumnHeader>
                      <Table.ColumnHeader fontWeight="bold" textAlign="right" py={2} px={3} fontSize="xs">Remaining</Table.ColumnHeader>
                      <Table.ColumnHeader fontWeight="bold" textAlign="center" py={2} px={3} fontSize="xs">% of Limit</Table.ColumnHeader>
                      <Table.ColumnHeader fontWeight="bold" textAlign="right" py={2} px={3} fontSize="xs">% of Budget</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {budgetData.map((item) => (
                      <Table.Row key={item.id} _hover={{ bg: 'gray.50' }}>
                        <Table.Cell py={1.5} px={3} fontWeight="medium" fontSize="sm">{item.name}</Table.Cell>
                        <Table.Cell py={1.5} px={3} textAlign="right" fontWeight="bold" fontSize="sm">
                          {formatCurrency(item.spent)}
                        </Table.Cell>
                        <Table.Cell py={1.5} px={3} textAlign="right" fontSize="sm">
                          {item.limit > 0 ? formatCurrency(item.limit) : '-'}
                        </Table.Cell>
                        <Table.Cell py={1.5} px={3} textAlign="right">
                          <Text
                            color={item.remaining < 0 ? 'red.600' : 'green.600'}
                            fontWeight="medium"
                            fontSize="sm"
                          >
                            {formatCurrency(item.remaining)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell py={1.5} px={3} textAlign="center">
                          {item.limit > 0 ? (
                            <Badge
                              colorPalette={item.percentOfLimit > 100 ? 'red' : item.percentOfLimit > 80 ? 'yellow' : 'green'}
                              size="sm"
                            >
                              {formatPercent(item.percentOfLimit)}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </Table.Cell>
                        <Table.Cell py={1.5} px={3} textAlign="right" fontSize="sm">
                          {formatPercent(item.percentOfBudget)}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                    {/* Grand Total Row */}
                    <Table.Row bg="gray.100" fontWeight="bold">
                      <Table.Cell py={2} px={3} fontSize="sm">GRAND TOTAL</Table.Cell>
                      <Table.Cell py={2} px={3} textAlign="right" fontSize="sm">
                        {formatCurrency(totalSpent)}
                      </Table.Cell>
                      <Table.Cell py={2} px={3} textAlign="right" fontSize="sm">
                        {formatCurrency(totalLimit)}
                      </Table.Cell>
                      <Table.Cell py={2} px={3} textAlign="right">
                        <Text
                          color={totalRemaining < 0 ? 'red.600' : 'green.600'}
                          fontWeight="medium"
                          fontSize="sm"
                        >
                          {formatCurrency(totalRemaining)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell py={2} px={3} textAlign="center">
                        <Badge
                          colorPalette={totalPercentSpent > 100 ? 'red' : totalPercentSpent > 80 ? 'yellow' : 'green'}
                          size="sm"
                        >
                          {formatPercent(totalPercentSpent)}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell py={2} px={3} textAlign="right" fontSize="sm">100%</Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table.Root>
              </Box>
            )}
          </Tabs.Content>

          {/* Setup Tab */}
          <Tabs.Content value="setup" pt={4}>
            <VStack gap={4} align="flex-start">
              <Box borderWidth="1px" borderRadius="lg" overflow="hidden" bg="white" maxW="400px" w="100%">
                <Table.Root size="sm">
                  <Table.Header bg="gray.100">
                    <Table.Row>
                      <Table.ColumnHeader fontWeight="bold" py={2} px={3} fontSize="xs">Name of Expense</Table.ColumnHeader>
                      <Table.ColumnHeader fontWeight="bold" textAlign="right" py={2} px={3} fontSize="xs" w="120px">Limit</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {categories
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((cat) => (
                        <Table.Row key={cat.id} _hover={{ bg: 'gray.50' }}>
                          <Table.Cell py={1.5} px={3} fontWeight="medium" fontSize="sm">{cat.name}</Table.Cell>
                          <Table.Cell py={1.5} px={3} textAlign="right">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={budgetLimits[cat.id] ?? ''}
                              onChange={(e) => handleLimitChange(cat.id, e.target.value)}
                              placeholder="0.00"
                              size="sm"
                              w="100px"
                              textAlign="right"
                            />
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    {/* Total Row */}
                    <Table.Row bg="gray.100" fontWeight="bold">
                      <Table.Cell py={2} px={3} fontSize="sm">OVERALL</Table.Cell>
                      <Table.Cell py={2} px={3} textAlign="right" fontSize="sm">
                        {formatCurrency(
                          Object.values(budgetLimits).reduce((sum, val) => sum + Number(val || 0), 0)
                        )}
                      </Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table.Root>
              </Box>

              <Button
                colorPalette="blue"
                size="md"
                onClick={saveBudget}
                loading={saving}
                loadingText="Saving..."
              >
                Save Budget
              </Button>
            </VStack>
          </Tabs.Content>
        </Tabs.Root>
        </VStack>
      </Box>
    </Box>
  );
}
