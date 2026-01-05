import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Spinner,
  Table,
  Flex,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState([]);
  const [totals, setTotals] = useState({ income: 0, expenses: 0, balance: 0 });

  // Generate year options - only 2025 and 2026
  const yearOptions = [2026, 2025];

  useEffect(() => {
    if (user) {
      loadYearlyData();
    }
  }, [user, selectedYear]);

  const loadYearlyData = async () => {
    setLoading(true);
    try {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      const { data, error } = await supabase
        .from('transactions')
        .select('date, amount, type')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

      // Initialize monthly data
      const monthly = MONTHS.map((month, index) => ({
        month,
        monthIndex: index,
        income: 0,
        expenses: 0,
        balance: 0,
      }));

      // Aggregate transactions by month
      (data || []).forEach(tx => {
        const txDate = new Date(tx.date + 'T00:00:00'); // Avoid timezone issues
        const monthIndex = txDate.getMonth();

        if (tx.type === 'income') {
          monthly[monthIndex].income += Number(tx.amount);
        } else {
          monthly[monthIndex].expenses += Number(tx.amount);
        }
      });

      // Calculate balance for each month
      monthly.forEach(m => {
        m.balance = m.income - m.expenses;
      });

      // Calculate totals
      const totalIncome = monthly.reduce((sum, m) => sum + m.income, 0);
      const totalExpenses = monthly.reduce((sum, m) => sum + m.expenses, 0);

      setMonthlyData(monthly);
      setTotals({
        income: totalIncome,
        expenses: totalExpenses,
        balance: totalIncome - totalExpenses,
      });
    } catch (err) {
      console.error('Error loading yearly data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  if (loading) {
    return (
      <Flex w="100%" minH="calc(100vh - 140px)" align="center" justify="center">
        <VStack gap={4}>
          <Spinner size="xl" />
          <Text>Loading report...</Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Box minH="calc(100vh - 140px)" bg="gray.50" py={8}>
      <Container maxW="container.lg">
        <VStack gap={6} align="stretch">
          {/* Header */}
          <Flex justify="space-between" align="center">
            <Heading size="xl">Yearly Report</Heading>
            <HStack gap={2}>
              <Text fontWeight="medium">Year:</Text>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  padding: '8px 16px',
                  fontSize: '16px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </HStack>
          </Flex>

          {/* Summary Table */}
          <Box
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            bg="white"
            boxShadow="sm"
          >
            <Table.Root size="md">
              <Table.Header>
                <Table.Row bg="gray.100">
                  <Table.ColumnHeader py={4} px={6} fontWeight="bold">Month</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={6} textAlign="right" fontWeight="bold">Income</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={6} textAlign="right" fontWeight="bold">Expenses</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={6} textAlign="right" fontWeight="bold">Balance</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {monthlyData.map((row) => (
                  <Table.Row key={row.month} _hover={{ bg: 'gray.50' }}>
                    <Table.Cell py={3} px={6}>
                      <Text fontWeight="medium">{row.month}</Text>
                    </Table.Cell>
                    <Table.Cell py={3} px={6} textAlign="right">
                      <Text color={row.income > 0 ? 'gray.700' : 'gray.400'}>
                        {formatCurrency(row.income)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell py={3} px={6} textAlign="right">
                      <Text color={row.expenses > 0 ? 'gray.700' : 'gray.400'}>
                        {formatCurrency(row.expenses)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell py={3} px={6} textAlign="right">
                      <Box
                        display="inline-block"
                        px={3}
                        py={1}
                        borderRadius="md"
                        bg={row.balance >= 0 ? 'green.100' : 'red.100'}
                        color={row.balance >= 0 ? 'green.700' : 'red.700'}
                        fontWeight="bold"
                      >
                        {row.balance < 0 ? '-' : ''}{formatCurrency(row.balance)}
                      </Box>
                    </Table.Cell>
                  </Table.Row>
                ))}
                {/* Overall Total Row */}
                <Table.Row bg="gray.800">
                  <Table.Cell py={4} px={6}>
                    <Text fontWeight="bold" color="white">Overall</Text>
                  </Table.Cell>
                  <Table.Cell py={4} px={6} textAlign="right">
                    <Text fontWeight="bold" color="white">
                      {formatCurrency(totals.income)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell py={4} px={6} textAlign="right">
                    <Text fontWeight="bold" color="white">
                      {formatCurrency(totals.expenses)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell py={4} px={6} textAlign="right">
                    <Box
                      display="inline-block"
                      px={3}
                      py={1}
                      borderRadius="md"
                      bg={totals.balance >= 0 ? 'green.500' : 'red.500'}
                      color="white"
                      fontWeight="bold"
                    >
                      {totals.balance < 0 ? '-' : ''}{formatCurrency(totals.balance)}
                    </Box>
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
