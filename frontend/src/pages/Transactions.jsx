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
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user]);

  useEffect(() => {
    filterTransactions();
  }, [transactions, searchQuery, selectedPeriod]);

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
          categories (name)
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('id', { ascending: false });

      if (txError) throw txError;

      const sortedData = [...(data || [])].sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.id - b.id;
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

    if (selectedPeriod === 'current') {
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

  if (loading) {
    return (
      <Flex w="100%" minH="calc(100vh - 140px)" align="center" justify="center">
        <VStack gap={4}>
          <Spinner size="xl" />
          <Text>Loading transactions...</Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Box w="100%" h="100%" bg="gray.50" p={{ base: 3, md: 6 }}>
      <Box w="100%">
        <VStack gap={4} align="stretch" w="100%">
          {/* Header */}
          <Flex justify="space-between" align="center" w="100%" flexWrap="wrap" gap={2}>
            <Heading size={{ base: 'lg', md: 'xl' }}>Transactions</Heading>
            <Button
              as={RouterLink}
              to="/add-transaction"
              colorScheme="green"
              size={{ base: 'sm', md: 'md' }}
            >
              + Add Transaction
            </Button>
          </Flex>

          {/* Error Message */}
          {error && (
            <Box p={3} bg="red.50" borderRadius="md" borderColor="red.200" borderWidth="1px" w="100%">
              <Text color="red.700" fontSize="sm">{error}</Text>
            </Box>
          )}

          {/* Filters Row */}
          <Flex gap={{ base: 2, md: 4 }} align="center" flexWrap="wrap" w="100%">
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size={{ base: 'sm', md: 'md' }}
              bg="white"
              maxW={{ base: '100%', md: '400px' }}
              flex="1"
              minW={{ base: '100%', sm: '200px' }}
            />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                backgroundColor: 'white',
                minWidth: '130px',
              }}
            >
              <option value="current">This month</option>
              <option value="last-month">Last month</option>
              <option value="all">All time</option>
            </select>
            <Text fontSize="sm" color="gray.500">
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
            </Text>
          </Flex>

          {/* Mobile Card View */}
          <VStack display={{ base: 'flex', md: 'none' }} gap={3} align="stretch" w="100%">
            {filteredTransactions.length === 0 ? (
              <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" textAlign="center">
                <Text color="gray.500">No transactions found</Text>
              </Box>
            ) : (
              filteredTransactions.map((transaction) => (
                <Box
                  key={transaction.id}
                  p={4}
                  bg="white"
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor="gray.200"
                >
                  <Flex justify="space-between" align="flex-start" mb={2}>
                    <Box flex="1">
                      <Text fontWeight="semibold" fontSize="sm">{transaction.category}</Text>
                      <Text fontSize="xs" color="gray.500" noOfLines={2}>
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
                    <Text fontSize="xs" color="gray.500">{formatDate(transaction.date)}</Text>
                    <HStack gap={2}>
                      <Text fontSize="xs" color={transaction.balance < 0 ? 'red.500' : 'gray.500'}>
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
            borderRadius="lg"
            overflow="hidden"
            bg="white"
            w="100%"
          >
            <Table.Root size="md" w="100%" style={{ tableLayout: 'fixed' }}>
              <Table.Header>
                <Table.Row bg="gray.50">
                  <Table.ColumnHeader py={4} px={6} w="12%">Date</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={6} w="auto">Description</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={6} textAlign="right" w="12%">Amount</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={6} textAlign="right" w="12%">Balance</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={3} w="5%"></Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredTransactions.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={5} textAlign="center" py={12}>
                      <Text color="gray.500">No transactions found</Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <Table.Row key={transaction.id} _hover={{ bg: 'gray.50' }}>
                      <Table.Cell py={4} px={6}>
                        <Text color="gray.600">{formatDate(transaction.date)}</Text>
                      </Table.Cell>
                      <Table.Cell py={4} px={6}>
                        <Text fontWeight="medium">{transaction.category}</Text>
                        <Text fontSize="sm" color="gray.500" noOfLines={1}>
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
                        <Text color={transaction.balance < 0 ? 'red.600' : 'gray.700'}>
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
                <Text color="gray.600">Period total:</Text>
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
      </Box>
    </Box>
  );
}
