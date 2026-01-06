import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  VStack,
  HStack,
  Text,
  Spinner,
  Input,
  Button,
  Tabs,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PageContainer from '../components/PageContainer';

// Circular Progress Ring Component
const ProgressRing = ({ percent, size = 120, strokeWidth = 8, color = '#3B82F6' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const cappedPercent = Math.min(percent, 100);
  const offset = circumference - (cappedPercent / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E5E7EB"
        strokeWidth={strokeWidth}
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={percent > 100 ? '#EF4444' : percent > 80 ? '#F59E0B' : color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.3s ease',
        }}
      />
    </svg>
  );
};

// Progress Bar Component
const ProgressBar = ({ percent, height = '8px', showOverflow = true }) => {
  const cappedPercent = Math.min(percent, 100);
  const isOver = percent > 100;
  const isWarning = percent > 80 && percent <= 100;

  return (
    <Box
      w="100%"
      h={height}
      bg="#E5E7EB"
      borderRadius="full"
      overflow="hidden"
      position="relative"
    >
      <Box
        h="100%"
        w={`${cappedPercent}%`}
        bg={isOver ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981'}
        borderRadius="full"
        transition="width 0.6s ease-out, background-color 0.3s ease"
      />
      {showOverflow && isOver && (
        <Box
          position="absolute"
          right="0"
          top="0"
          h="100%"
          w="4px"
          bg="#DC2626"
          animation="pulse 1.5s infinite"
        />
      )}
    </Box>
  );
};

// Category Budget Card Component
const BudgetCard = ({ item, formatCurrency, index }) => {
  const isOver = item.percentOfLimit > 100;
  const isWarning = item.percentOfLimit > 80 && item.percentOfLimit <= 100;
  const hasLimit = item.limit > 0;

  return (
    <Box
      p={5}
      bg="white"
      borderRadius="16px"
      boxShadow="0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)"
      border="1px solid"
      borderColor={isOver ? 'red.200' : 'gray.100'}
      transition="all 0.3s ease"
      _hover={{
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}
      style={{
        animation: `fadeSlideIn 0.4s ease-out ${index * 0.05}s both`,
      }}
    >
      <Flex justify="space-between" align="flex-start" mb={3}>
        <Box flex="1">
          <Text
            fontWeight="600"
            fontSize="md"
            color="gray.800"
            mb={1}
          >
            {item.name}
          </Text>
          <Text fontSize="2xl" fontWeight="700" color="gray.900">
            {formatCurrency(item.spent)}
          </Text>
        </Box>
        {hasLimit && (
          <Box textAlign="right">
            <Text
              fontSize="xs"
              fontWeight="600"
              textTransform="uppercase"
              letterSpacing="0.05em"
              color={isOver ? 'red.500' : isWarning ? 'yellow.600' : 'green.500'}
              mb={1}
            >
              {isOver ? 'Over Budget' : isWarning ? 'Warning' : 'On Track'}
            </Text>
            <Text fontSize="sm" color="gray.500">
              of {formatCurrency(item.limit)}
            </Text>
          </Box>
        )}
      </Flex>

      {hasLimit ? (
        <>
          <ProgressBar percent={item.percentOfLimit} />
          <Flex justify="space-between" mt={3}>
            <Text fontSize="sm" color="gray.500">
              {item.percentOfLimit.toFixed(0)}% used
            </Text>
            <Text
              fontSize="sm"
              fontWeight="600"
              color={item.remaining < 0 ? 'red.500' : 'green.500'}
            >
              {item.remaining < 0 ? '-' : '+'}{formatCurrency(Math.abs(item.remaining))} {item.remaining < 0 ? 'over' : 'left'}
            </Text>
          </Flex>
        </>
      ) : (
        <Text fontSize="sm" color="gray.400" mt={2}>
          No limit set
        </Text>
      )}
    </Box>
  );
};

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
      const categoryData = data || [];
      setCategories(categoryData);

      // If no categories exist, stop loading immediately
      if (categoryData.length === 0) {
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to load categories: ' + err.message);
      setLoading(false);
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

      // Sort: Over budget first, then by percent used (descending)
      data.sort((a, b) => {
        const aOverBudget = a.limit > 0 && a.spent > a.limit;
        const bOverBudget = b.limit > 0 && b.spent > b.limit;

        // Over budget items come first
        if (aOverBudget && !bOverBudget) return -1;
        if (!aOverBudget && bOverBudget) return 1;

        // Then sort by percent of limit used (descending)
        return b.percentOfLimit - a.percentOfLimit;
      });
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
      <PageContainer>
        <Flex w="100%" minH="60vh" align="center" justify="center">
          <VStack gap={4}>
            <Spinner size="xl" />
            <Text>Loading budget...</Text>
          </VStack>
        </Flex>
      </PageContainer>
    );
  }

  if (!loading && categories.length === 0) {
    return (
      <PageContainer>
        <Flex w="100%" minH="60vh" align="center" justify="center">
          <VStack gap={4} textAlign="center" p={6}>
            <Heading size="lg">No Budget Categories</Heading>
            <Text color="gray.600">
              You need to create expense categories first before setting up a budget.
            </Text>
            <Text color="gray.500" fontSize="sm">
              Go to Categories and add some expense categories to get started.
            </Text>
          </VStack>
        </Flex>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <VStack gap={{ base: 4, md: 6 }} align="stretch" w="100%">
        {/* Header */}
        <Flex justify="space-between" align={{ base: 'stretch', sm: 'center' }} direction={{ base: 'column', sm: 'row' }} wrap="wrap" gap={{ base: 3, md: 4 }}>
          <Heading size={{ base: 'lg', md: 'xl' }}>Monthly Budget</Heading>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            size="md"
            w={{ base: '100%', sm: '200px' }}
            bg="white"
          />
        </Flex>

        {/* Month Display */}
        <Text fontSize={{ base: 'md', md: 'lg' }} color="gray.600">
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
              <VStack gap={6} align="stretch">
                {/* Summary Section */}
                <Box
                  p={{ base: 5, md: 8 }}
                  bg="linear-gradient(135deg, #1E293B 0%, #334155 100%)"
                  borderRadius="24px"
                  color="white"
                  position="relative"
                  overflow="hidden"
                  style={{ animation: 'fadeSlideIn 0.5s ease-out' }}
                >
                  {/* Background decoration */}
                  <Box
                    position="absolute"
                    top="-50%"
                    right="-10%"
                    w="300px"
                    h="300px"
                    bg="rgba(255,255,255,0.03)"
                    borderRadius="full"
                    pointerEvents="none"
                  />
                  <Box
                    position="absolute"
                    bottom="-30%"
                    left="-5%"
                    w="200px"
                    h="200px"
                    bg="rgba(255,255,255,0.02)"
                    borderRadius="full"
                    pointerEvents="none"
                  />

                  <Flex
                    direction={{ base: 'column', md: 'row' }}
                    align={{ base: 'center', md: 'center' }}
                    justify="space-between"
                    gap={{ base: 6, md: 8 }}
                    position="relative"
                    zIndex={1}
                  >
                    {/* Left side - Main stats */}
                    <VStack align={{ base: 'center', md: 'flex-start' }} gap={1}>
                      <Text
                        fontSize="xs"
                        fontWeight="600"
                        textTransform="uppercase"
                        letterSpacing="0.1em"
                        color="rgba(255,255,255,0.6)"
                      >
                        Total Spent
                      </Text>
                      <Text
                        fontSize={{ base: '3xl', md: '4xl' }}
                        fontWeight="800"
                        letterSpacing="-0.02em"
                      >
                        {formatCurrency(totalSpent)}
                      </Text>
                      <Text fontSize="sm" color="rgba(255,255,255,0.7)">
                        of {formatCurrency(totalLimit)} budget
                      </Text>
                    </VStack>

                    {/* Center - Progress Ring */}
                    <Box position="relative">
                      <ProgressRing
                        percent={totalPercentSpent}
                        size={140}
                        strokeWidth={10}
                        color="#10B981"
                      />
                      <Box
                        position="absolute"
                        top="50%"
                        left="50%"
                        transform="translate(-50%, -50%)"
                        textAlign="center"
                      >
                        <Text fontSize="2xl" fontWeight="800">
                          {totalPercentSpent.toFixed(0)}%
                        </Text>
                        <Text fontSize="xs" color="rgba(255,255,255,0.6)">
                          used
                        </Text>
                      </Box>
                    </Box>

                    {/* Right side - Remaining */}
                    <VStack align={{ base: 'center', md: 'flex-end' }} gap={1}>
                      <Text
                        fontSize="xs"
                        fontWeight="600"
                        textTransform="uppercase"
                        letterSpacing="0.1em"
                        color="rgba(255,255,255,0.6)"
                      >
                        Remaining
                      </Text>
                      <Text
                        fontSize={{ base: '2xl', md: '3xl' }}
                        fontWeight="700"
                        color={totalRemaining < 0 ? '#F87171' : '#34D399'}
                      >
                        {totalRemaining < 0 ? '-' : ''}{formatCurrency(Math.abs(totalRemaining))}
                      </Text>
                      <Text
                        fontSize="sm"
                        px={3}
                        py={1}
                        borderRadius="full"
                        bg={totalRemaining < 0 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}
                        color={totalRemaining < 0 ? '#FCA5A5' : '#6EE7B7'}
                      >
                        {totalRemaining < 0 ? 'Over budget' : 'Under budget'}
                      </Text>
                    </VStack>
                  </Flex>
                </Box>

                {/* Category Cards Grid */}
                <Box>
                  <Text
                    fontSize="sm"
                    fontWeight="600"
                    textTransform="uppercase"
                    letterSpacing="0.05em"
                    color="gray.500"
                    mb={4}
                  >
                    By Category
                  </Text>
                  <Box
                    display="grid"
                    gridTemplateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }}
                    gap={4}
                  >
                    {budgetData.map((item, index) => (
                      <BudgetCard
                        key={item.id}
                        item={item}
                        formatCurrency={formatCurrency}
                        index={index}
                      />
                    ))}
                  </Box>
                </Box>
              </VStack>
            )}
          </Tabs.Content>

          {/* Setup Tab */}
          <Tabs.Content value="setup" pt={4}>
            <VStack gap={6} align="stretch" w="100%">
              {/* Total Budget Summary Card */}
              <Box
                p={6}
                bg="linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)"
                borderRadius="20px"
                color="white"
                position="relative"
                overflow="hidden"
                style={{ animation: 'fadeSlideIn 0.4s ease-out' }}
              >
                <Box
                  position="absolute"
                  top="-30%"
                  right="-10%"
                  w="200px"
                  h="200px"
                  bg="rgba(255,255,255,0.1)"
                  borderRadius="full"
                  pointerEvents="none"
                />
                <Flex justify="space-between" align="center" position="relative" zIndex={1}>
                  <Box>
                    <Text
                      fontSize="xs"
                      fontWeight="600"
                      textTransform="uppercase"
                      letterSpacing="0.1em"
                      color="rgba(255,255,255,0.7)"
                      mb={1}
                    >
                      Total Monthly Budget
                    </Text>
                    <Text fontSize="3xl" fontWeight="800">
                      {formatCurrency(
                        Object.values(budgetLimits).reduce((sum, val) => sum + Number(val || 0), 0)
                      )}
                    </Text>
                  </Box>
                  <Box
                    p={3}
                    bg="rgba(255,255,255,0.2)"
                    borderRadius="full"
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                  </Box>
                </Flex>
              </Box>

              {/* Category Limit Cards */}
              <Box>
                <Text
                  fontSize="sm"
                  fontWeight="600"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                  color="gray.500"
                  mb={4}
                >
                  Set Category Limits
                </Text>
                <Box
                  display="grid"
                  gridTemplateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }}
                  gap={3}
                >
                  {categories
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((cat, index) => (
                      <Box
                        key={cat.id}
                        p={4}
                        bg="white"
                        borderRadius="12px"
                        border="1px solid"
                        borderColor="gray.200"
                        transition="all 0.2s ease"
                        _hover={{ borderColor: 'blue.300', boxShadow: '0 2px 8px rgba(59,130,246,0.1)' }}
                        style={{ animation: `fadeSlideIn 0.3s ease-out ${index * 0.03}s both` }}
                      >
                        <Text fontWeight="600" fontSize="sm" color="gray.700" mb={3}>
                          {cat.name}
                        </Text>
                        <HStack>
                          <Text color="gray.400" fontSize="lg" fontWeight="500">$</Text>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={budgetLimits[cat.id] ?? ''}
                            onChange={(e) => handleLimitChange(cat.id, e.target.value)}
                            placeholder="0.00"
                            size="md"
                            border="none"
                            bg="gray.50"
                            borderRadius="8px"
                            fontWeight="600"
                            fontSize="lg"
                            _focus={{ bg: 'blue.50', boxShadow: 'none' }}
                            _placeholder={{ color: 'gray.300' }}
                          />
                        </HStack>
                      </Box>
                    ))}
                </Box>
              </Box>

              {/* Save Button */}
              <Box pt={2}>
                <Button
                  bg="linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)"
                  color="white"
                  size="lg"
                  px={8}
                  borderRadius="12px"
                  fontWeight="600"
                  onClick={saveBudget}
                  loading={saving}
                  loadingText="Saving..."
                  _hover={{ transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
                  transition="all 0.2s ease"
                  w={{ base: '100%', md: 'auto' }}
                >
                  Save Budget
                </Button>
              </Box>
            </VStack>
          </Tabs.Content>
        </Tabs.Root>
      </VStack>
    </PageContainer>
  );
}
