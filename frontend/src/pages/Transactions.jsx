import { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  VStack,
  HStack,
  Text,
  Spinner,
  Table,
  Icon,
  Collapsible,
} from '@chakra-ui/react';
import { LuFilter, LuX } from 'react-icons/lu';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PageContainer from '../components/PageContainer';
import { useDarkModeColors } from '../lib/useDarkModeColors';

export default function Transactions() {
  const { user } = useAuth();
  const colors = useDarkModeColors();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  // Custom filter states
  const [showCustomFilters, setShowCustomFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [customFiltersApplied, setCustomFiltersApplied] = useState(false);

  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user]);

  useEffect(() => {
    filterTransactions();
  }, [transactions, searchQuery, selectedPeriod, customFiltersApplied, startDate, endDate, minAmount, maxAmount]);

  const loadTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: txError } = await supabase
        .from('transactions')
        .select(`
          id,
          description,
          date,
          amount,
          type,
          provider,
          category_id,
          created_at,
          categories (name)
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (txError) throw txError;

      // Sort chronologically (oldest first) for balance calculation
      const sortedData = [...(data || [])].sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        // Secondary sort by created_at for same-day transactions
        return new Date(a.created_at) - new Date(b.created_at);
      });

      // Calculate cumulative spending (expenses only, not affected by income)
      let runningSpend = 0;
      const balanceMap = new Map();
      sortedData.forEach((t) => {
        if (t.type === 'expense') {
          runningSpend += t.amount;
        }
        balanceMap.set(t.id, -runningSpend); // Show as negative for expenses
      });

      const transformedTransactions = (data || []).map((t) => ({
        id: t.id,
        description: t.description,
        date: t.date,
        amount: t.amount,
        type: t.type,
        category: t.categories?.name || 'Unknown',
        bank: t.provider || null,
        balance: balanceMap.get(t.id),
      }));

      setTransactions(transformedTransactions);
    } catch (err) {
      setError(err.message);
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterTransactions = () => {
    let filtered = [...transactions];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
      );
    }

    // Apply custom filters if enabled
    if (customFiltersApplied) {
      // Date range filter
      if (startDate) {
        filtered = filtered.filter(t => t.date >= startDate);
      }
      if (endDate) {
        filtered = filtered.filter(t => t.date <= endDate);
      }
      // Amount range filter
      if (minAmount !== '') {
        const min = parseFloat(minAmount);
        if (!isNaN(min)) {
          filtered = filtered.filter(t => t.amount >= min);
        }
      }
      if (maxAmount !== '') {
        const max = parseFloat(maxAmount);
        if (!isNaN(max)) {
          filtered = filtered.filter(t => t.amount <= max);
        }
      }
    } else if (selectedPeriod === 'current') {
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // 1-indexed
      const currentYear = now.getFullYear();
      filtered = filtered.filter(t => {
        // Parse YYYY-MM-DD directly to avoid timezone issues
        const [year, month] = t.date.split('-').map(Number);
        return month === currentMonth && year === currentYear;
      });
    } else if (selectedPeriod === 'last-month') {
      const now = new Date();
      let lastMonth = now.getMonth(); // Current month is 0-indexed, so this gives us last month 1-indexed
      let lastYear = now.getFullYear();
      if (lastMonth === 0) {
        lastMonth = 12;
        lastYear -= 1;
      }
      filtered = filtered.filter(t => {
        // Parse YYYY-MM-DD directly to avoid timezone issues
        const [year, month] = t.date.split('-').map(Number);
        return month === lastMonth && year === lastYear;
      });
    }

    // Calculate cumulative spending (expenses only, not affected by income)
    const oldestFirst = [...filtered].reverse();
    let runningSpend = 0;
    const balanceMap = new Map();
    oldestFirst.forEach((t) => {
      if (t.type === 'expense') {
        runningSpend += t.amount;
      }
      balanceMap.set(t.id, -runningSpend); // Show as negative for expenses
    });

    const filteredWithBalance = filtered.map(t => ({
      ...t,
      balance: balanceMap.get(t.id),
    }));

    setFilteredTransactions(filteredWithBalance);
  };

  const formatDate = (dateString) => {
    // Parse YYYY-MM-DD without timezone conversion issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatAmount = (amount, type) => {
    const formatted = Math.abs(amount).toFixed(2);
    return type === 'expense' ? `-$${formatted}` : `+$${formatted}`;
  };

  const formatBalance = (balance) => {
    const formatted = Math.abs(balance).toFixed(2);
    return balance < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;
      setTransactions(prev => prev.filter(t => t.id !== transactionId));
    } catch (err) {
      setError('Failed to delete transaction: ' + err.message);
      console.error('Delete error:', err);
    }
  };

  const applyCustomFilters = () => {
    setCustomFiltersApplied(true);
    setSelectedPeriod('custom');
    setShowCustomFilters(false);
  };

  const clearCustomFilters = () => {
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setCustomFiltersApplied(false);
    setSelectedPeriod('current');
    setShowCustomFilters(false);
  };

  const toggleCustomFilters = () => {
    setShowCustomFilters(!showCustomFilters);
  };

  const downloadCSV = () => {
    if (filteredTransactions.length === 0) return;

    // CSV header
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Type', 'Bank'];

    // CSV rows
    const rows = filteredTransactions.map(t => [
      t.date,
      t.category,
      `"${(t.description || '').replace(/"/g, '""')}"`, // Escape quotes in description
      t.amount.toFixed(2),
      t.type,
      t.bank || '',
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Generate filename with period info
    let periodLabel = 'all-time';
    if (selectedPeriod === 'current') {
      const now = new Date();
      periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    } else if (selectedPeriod === 'last-month') {
      const now = new Date();
      let month = now.getMonth();
      let year = now.getFullYear();
      if (month === 0) {
        month = 12;
        year -= 1;
      }
      periodLabel = `${year}-${String(month).padStart(2, '0')}`;
    }

    const filename = `transactions-${periodLabel}.csv`;

    // Create blob with BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });

    // Use modern download approach
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Cleanup after a short delay
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }, 100);
  };

  if (loading) {
    return (
      <PageContainer>
        <Flex w="100%" minH="60vh" align="center" justify="center">
          <VStack gap={4}>
            <Spinner size="xl" />
            <Text>Loading transactions...</Text>
          </VStack>
        </Flex>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <VStack gap={4} align="stretch" w="100%">
          {/* Header */}
          <Flex justify="space-between" align="center" w="100%" flexWrap="wrap" gap={2}>
            <Heading size={{ base: 'lg', md: 'xl' }}>Transactions</Heading>
            <HStack gap={2}>
              <Button
                onClick={downloadCSV}
                variant="outline"
                size={{ base: 'sm', md: 'md' }}
                disabled={filteredTransactions.length === 0}
                _hover={{ bg: colors.rowStripedBg }}
              >
                Download CSV
              </Button>
              <Button
                as={RouterLink}
                to="/add-transaction"
                colorScheme="green"
                size={{ base: 'sm', md: 'md' }}
              >
                + Add Transaction
              </Button>
            </HStack>
          </Flex>

          {/* Error Message */}
          {error && (
            <Box p={3} bg={colors.dangerBg} borderRadius="md" borderColor={colors.dangerBorder} borderWidth="1px" w="100%">
              <Text color={colors.danger} fontSize="sm">{error}</Text>
            </Box>
          )}

          {/* Filters Row */}
          <Flex gap={{ base: 2, md: 4 }} align="center" flexWrap="wrap" w="100%">
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size={{ base: 'sm', md: 'md' }}
              bg={colors.cardBg}
              borderColor={colors.borderColor}
              color={colors.textPrimary}
              maxW={{ base: '100%', md: '400px' }}
              flex="1"
              minW={{ base: '100%', sm: '200px' }}
            />
            {!customFiltersApplied && (
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: `1px solid ${colors.borderColor}`,
                  backgroundColor: colors.cardBg,
                  color: colors.textPrimary,
                  minWidth: '130px',
                }}
              >
                <option value="current">This month</option>
                <option value="last-month">Last month</option>
                <option value="all">All time</option>
              </select>
            )}
            <Button
              variant={showCustomFilters || customFiltersApplied ? 'solid' : 'outline'}
              colorScheme={customFiltersApplied ? 'blue' : 'gray'}
              size={{ base: 'sm', md: 'md' }}
              onClick={toggleCustomFilters}
            >
              <Icon as={LuFilter} mr={2} />
              {customFiltersApplied ? 'Custom filters' : 'Filters'}
            </Button>
            {customFiltersApplied && (
              <Button
                variant="ghost"
                size={{ base: 'sm', md: 'md' }}
                onClick={clearCustomFilters}
                color="red.500"
              >
                <Icon as={LuX} mr={1} />
                Reset
              </Button>
            )}
            <Text fontSize="sm" color={colors.textMuted}>
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
            </Text>
          </Flex>

          {/* Custom Filters Panel */}
          <Collapsible.Root open={showCustomFilters}>
            <Collapsible.Content>
              <Box
                bg={colors.cardBg}
                borderRadius="xl"
                borderWidth="1px"
                borderColor={colors.borderColor}
                p={{ base: 4, md: 6 }}
                w="100%"
              >
                <VStack gap={5} align="stretch">
                  {/* Date Range */}
                  <Box>
                    <Text fontWeight="600" color={colors.textPrimary} mb={3}>Date range</Text>
                    <Flex gap={4} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
                      <Box flex="1" minW={{ base: '100%', md: '200px' }}>
                        <Text fontSize="sm" color={colors.textSecondary} mb={1}>Start date</Text>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          bg={colors.cardBg}
                          borderColor={colors.borderColor}
                          color={colors.textPrimary}
                          size="md"
                        />
                      </Box>
                      <Box flex="1" minW={{ base: '100%', md: '200px' }}>
                        <Text fontSize="sm" color={colors.textSecondary} mb={1}>End date</Text>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          bg={colors.cardBg}
                          borderColor={colors.borderColor}
                          color={colors.textPrimary}
                          size="md"
                        />
                      </Box>
                    </Flex>
                  </Box>

                  {/* Amount Range */}
                  <Box>
                    <Text fontWeight="600" color={colors.textPrimary} mb={3}>Amount range</Text>
                    <Flex gap={4} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
                      <Box flex="1" minW={{ base: '100%', md: '200px' }}>
                        <Text fontSize="sm" color={colors.textSecondary} mb={1}>Minimum amount</Text>
                        <Input
                          type="number"
                          placeholder="$0.00"
                          value={minAmount}
                          onChange={(e) => setMinAmount(e.target.value)}
                          bg={colors.cardBg}
                          borderColor={colors.borderColor}
                          color={colors.textPrimary}
                          size="md"
                          min="0"
                          step="0.01"
                        />
                      </Box>
                      <Box flex="1" minW={{ base: '100%', md: '200px' }}>
                        <Text fontSize="sm" color={colors.textSecondary} mb={1}>Maximum amount</Text>
                        <Input
                          type="number"
                          placeholder="$999,999.00"
                          value={maxAmount}
                          onChange={(e) => setMaxAmount(e.target.value)}
                          bg={colors.cardBg}
                          borderColor={colors.borderColor}
                          color={colors.textPrimary}
                          size="md"
                          min="0"
                          step="0.01"
                        />
                      </Box>
                    </Flex>
                  </Box>

                  {/* Action Buttons */}
                  <Flex gap={3} justify="flex-end" pt={2}>
                    <Button
                      variant="outline"
                      onClick={clearCustomFilters}
                    >
                      Clear filters
                    </Button>
                    <Button
                      colorScheme="red"
                      onClick={applyCustomFilters}
                    >
                      Apply filters
                    </Button>
                  </Flex>
                </VStack>
              </Box>
            </Collapsible.Content>
          </Collapsible.Root>

          {/* Mobile Card View */}
          <VStack display={{ base: 'flex', md: 'none' }} gap={3} align="stretch" w="100%">
            {filteredTransactions.length === 0 ? (
              <Box p={6} bg={colors.cardBg} borderRadius="lg" borderWidth="1px" borderColor={colors.borderColor} textAlign="center">
                <Text color={colors.textMuted}>No transactions found</Text>
              </Box>
            ) : (
              filteredTransactions.map((transaction) => (
                <Box
                  key={transaction.id}
                  p={4}
                  bg={colors.cardBg}
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor={colors.borderColor}
                >
                  <Flex justify="space-between" align="flex-start" mb={2}>
                    <Box flex="1">
                      <Text fontWeight="semibold" fontSize="sm" color={colors.textPrimary}>{transaction.category}</Text>
                      <Text fontSize="xs" color={colors.textSecondary} noOfLines={2}>
                        {transaction.description}
                      </Text>
                    </Box>
                    <Text
                      fontWeight="bold"
                      fontSize="md"
                      color={transaction.type === 'income' ? 'green.600' : 'red.600'}
                      ml={2}
                    >
                      {formatAmount(transaction.amount, transaction.type)}
                    </Text>
                  </Flex>
                  <Flex justify="space-between" align="center">
                    <Text fontSize="xs" color={colors.textMuted}>{formatDate(transaction.date)}</Text>
                    <HStack gap={2}>
                      <Text fontSize="xs" color={transaction.balance < 0 ? 'red.500' : colors.textMuted}>
                        Bal: {formatBalance(transaction.balance)}
                      </Text>
                      <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => handleDeleteTransaction(transaction.id)}
                        opacity={0.6}
                        _hover={{ opacity: 1 }}
                      >
                        ×
                      </Button>
                    </HStack>
                  </Flex>
                </Box>
              ))
            )}
          </VStack>

          {/* Desktop Table View */}
          <Box
            display={{ base: 'none', md: 'block' }}
            borderWidth="1px"
            borderColor={colors.borderColor}
            borderRadius="lg"
            overflow="hidden"
            bg={colors.cardBg}
            w="100%"
          >
            <Table.Root size="md" w="100%" style={{ tableLayout: 'fixed' }}>
              <Table.Header>
                <Table.Row bg={colors.rowStripedBg}>
                  <Table.ColumnHeader py={4} px={6} w="12%" color={colors.textSecondary}>Date</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={6} w="auto" color={colors.textSecondary}>Description</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={6} textAlign="right" w="12%" color={colors.textSecondary}>Amount</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={6} textAlign="right" w="12%" color={colors.textSecondary}>Balance</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={3} w="5%"></Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredTransactions.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={5} textAlign="center" py={12}>
                      <Text color={colors.textMuted}>No transactions found</Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <Table.Row key={transaction.id} bg={colors.cardBg} _hover={{ bg: colors.rowHoverBg }}>
                      <Table.Cell py={4} px={6}>
                        <Text color={colors.textSecondary}>{formatDate(transaction.date)}</Text>
                      </Table.Cell>
                      <Table.Cell py={4} px={6}>
                        <Text fontWeight="medium" color={colors.textPrimary}>{transaction.category}</Text>
                        <Text fontSize="sm" color={colors.textSecondary} noOfLines={1}>
                          {transaction.description}
                          {transaction.bank && transaction.bank !== transaction.description && (
                            <Text as="span" color="blue.500" ml={2}>• {transaction.bank}</Text>
                          )}
                        </Text>
                      </Table.Cell>
                      <Table.Cell textAlign="right" py={4} px={6}>
                        <Text
                          fontWeight="bold"
                          color={transaction.type === 'income' ? 'green.600' : 'red.600'}
                        >
                          {formatAmount(transaction.amount, transaction.type)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell textAlign="right" py={4} px={6}>
                        <Text color={transaction.balance < 0 ? 'red.600' : colors.textSecondary}>
                          {formatBalance(transaction.balance)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell py={4} px={3}>
                        <Button
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          opacity={0.4}
                          _hover={{ opacity: 1 }}
                        >
                          ×
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>
          </Box>

          {/* Summary Footer - shows total expenses only */}
          {filteredTransactions.length > 0 && (
            <Flex justify="flex-end" px={4} w="100%">
              <HStack gap={2}>
                <Text color={colors.textSecondary}>Period total:</Text>
                <Text
                  fontWeight="bold"
                  fontSize="lg"
                  color="red.600"
                >
                  -${filteredTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + t.amount, 0)
                    .toFixed(2)}
                </Text>
              </HStack>
            </Flex>
          )}
      </VStack>
    </PageContainer>
  );
}
