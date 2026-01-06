import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Spinner,
  Table,
  Flex,
  SimpleGrid,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PageContainer from '../components/PageContainer';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Bar Chart Component for Income vs Expenses
const MonthlyBarChart = ({ data, formatCurrency }) => {
  const maxValue = Math.max(
    ...data.map(d => Math.max(d.income, d.expenses)),
    1
  );
  const barHeight = 160;

  return (
    <Box overflowX="auto" pb={2}>
      <Flex gap={2} minW="700px" align="flex-end" h={`${barHeight + 60}px`} pt={4}>
        {data.map((month, index) => {
          const incomeHeight = (month.income / maxValue) * barHeight;
          const expenseHeight = (month.expenses / maxValue) * barHeight;
          const hasData = month.income > 0 || month.expenses > 0;

          return (
            <Flex
              key={index}
              direction="column"
              align="center"
              flex="1"
              gap={1}
            >
              {/* Bars container */}
              <Flex gap={1} align="flex-end" h={`${barHeight}px`}>
                {/* Income bar */}
                <Box
                  w="20px"
                  h={`${Math.max(incomeHeight, hasData ? 2 : 0)}px`}
                  bg="linear-gradient(180deg, #34D399 0%, #059669 100%)"
                  borderRadius="4px 4px 0 0"
                  transition="height 0.5s ease"
                  title={`Income: ${formatCurrency(month.income)}`}
                  cursor="pointer"
                  _hover={{ opacity: 0.8 }}
                />
                {/* Expense bar */}
                <Box
                  w="20px"
                  h={`${Math.max(expenseHeight, hasData ? 2 : 0)}px`}
                  bg="linear-gradient(180deg, #F87171 0%, #DC2626 100%)"
                  borderRadius="4px 4px 0 0"
                  transition="height 0.5s ease"
                  title={`Expenses: ${formatCurrency(month.expenses)}`}
                  cursor="pointer"
                  _hover={{ opacity: 0.8 }}
                />
              </Flex>
              {/* Month label */}
              <Text fontSize="xs" color="gray.500" fontWeight="500">
                {MONTH_ABBR[index]}
              </Text>
            </Flex>
          );
        })}
      </Flex>
    </Box>
  );
};

// Trend Line Chart Component
const TrendLineChart = ({ data, formatCurrency }) => {
  const values = data.map(d => d.balance);
  const maxVal = Math.max(...values.map(Math.abs), 1);
  const width = 700;
  const height = 120;
  const padding = 20;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Generate points for the line
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight / 2 - (d.balance / maxVal) * (chartHeight / 2);
    return { x, y, balance: d.balance };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Area fill
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding + chartHeight / 2} L ${padding} ${padding + chartHeight / 2} Z`;

  return (
    <Box overflowX="auto">
      <svg width={width} height={height} style={{ minWidth: '100%' }}>
        {/* Zero line */}
        <line
          x1={padding}
          y1={padding + chartHeight / 2}
          x2={width - padding}
          y2={padding + chartHeight / 2}
          stroke="#E5E7EB"
          strokeWidth="1"
          strokeDasharray="4,4"
        />
        {/* Area under the line */}
        <path
          d={areaD}
          fill="url(#balanceGradient)"
          opacity="0.3"
        />
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="5"
              fill={p.balance >= 0 ? '#10B981' : '#EF4444'}
              stroke="white"
              strokeWidth="2"
            />
            <title>{`${MONTH_ABBR[i]}: ${formatCurrency(p.balance)}`}</title>
          </g>
        ))}
        {/* Gradient definition */}
        <defs>
          <linearGradient id="balanceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </Box>
  );
};

// Category Donut Chart with hover effects (matching Dashboard style)
const CategoryDonutChart = ({ categories, total, formatCurrency, hoveredCategory, onHoverCategory }) => {
  const size = 180;
  const strokeWidth = 35;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const center = size / 2;

  const colors = [
    '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#10B981',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
  ];

  // Get color for a category
  const getCategoryColor = (name, index) => {
    if (name === 'Others') return '#9CA3AF';
    return colors[index % colors.length];
  };

  // Find hovered category data
  const hoveredCat = hoveredCategory
    ? categories.find(c => c.name === hoveredCategory)
    : null;

  // Calculate segments
  let currentAngle = 0;
  const segments = categories.map((cat, index) => {
    const percent = total > 0 ? (cat.amount / total) * 100 : 0;
    const angle = (percent / 100) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    return { ...cat, percent, startAngle, angle, index };
  });

  return (
    <Flex direction="column" align="center" gap={4}>
      <Box position="relative">
        <svg width={size} height={size} style={{ overflow: 'visible' }}>
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth={strokeWidth}
          />
          {/* Category segments */}
          {segments.map((seg) => {
            const dashLength = (seg.percent / 100) * circumference;
            const dashOffset = -(seg.startAngle / 360) * circumference;
            const isHovered = hoveredCategory === seg.name;
            const isOtherHovered = hoveredCategory && !isHovered;

            return (
              <circle
                key={seg.name}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={getCategoryColor(seg.name, seg.index)}
                strokeWidth={isHovered ? strokeWidth + 8 : strokeWidth}
                strokeDasharray={`${dashLength} ${circumference}`}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${center} ${center})`}
                style={{
                  transition: 'all 0.2s ease',
                  opacity: isOtherHovered ? 0.3 : 1,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => onHoverCategory(seg.name)}
                onMouseLeave={() => onHoverCategory(null)}
              />
            );
          })}
        </svg>
        {/* Center text */}
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          textAlign="center"
          pointerEvents="none"
        >
          {hoveredCat ? (
            <>
              <Text fontSize="xs" color="gray.500" fontWeight="500" noOfLines={1} maxW="80px">
                {hoveredCat.name}
              </Text>
              <Text fontSize="lg" fontWeight="800" color="gray.800">
                {formatCurrency(hoveredCat.amount)}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {total > 0 ? ((hoveredCat.amount / total) * 100).toFixed(0) : 0}%
              </Text>
            </>
          ) : (
            <>
              <Text fontSize="xs" color="gray.500">Total Spent</Text>
              <Text fontSize="xl" fontWeight="800" color="gray.800">
                {formatCurrency(total)}
              </Text>
            </>
          )}
        </Box>
      </Box>
      {/* Legend */}
      <VStack gap={1} align="stretch" w="100%">
        {categories.map((cat, index) => {
          const isHovered = hoveredCategory === cat.name;
          const isOtherHovered = hoveredCategory && !isHovered;
          return (
            <Flex
              key={cat.name}
              justify="space-between"
              align="center"
              fontSize="sm"
              py={1}
              px={2}
              borderRadius="6px"
              bg={isHovered ? '#F4F4F5' : 'transparent'}
              opacity={isOtherHovered ? 0.4 : 1}
              transition="all 0.15s"
              cursor="pointer"
              onMouseEnter={() => onHoverCategory(cat.name)}
              onMouseLeave={() => onHoverCategory(null)}
            >
              <HStack gap={2}>
                <Box w="10px" h="10px" borderRadius="full" bg={getCategoryColor(cat.name, index)} flexShrink={0} />
                <Text color="gray.700" noOfLines={1} fontWeight={isHovered ? '600' : '500'}>{cat.name}</Text>
              </HStack>
              <HStack gap={2}>
                <Text fontWeight="600" color="gray.800">{formatCurrency(cat.amount)}</Text>
                <Text fontSize="xs" color="gray.500">
                  {total > 0 ? ((cat.amount / total) * 100).toFixed(0) : 0}%
                </Text>
              </HStack>
            </Flex>
          );
        })}
      </VStack>
    </Flex>
  );
};

// Summary Card Component
const SummaryCard = ({ title, value, subtitle, color, bgGradient, icon }) => (
  <Box
    p={5}
    borderRadius="20px"
    bg={bgGradient}
    color="white"
    position="relative"
    overflow="hidden"
    boxShadow="0 4px 20px rgba(0,0,0,0.1)"
  >
    <Box
      position="absolute"
      top="-20px"
      right="-20px"
      w="80px"
      h="80px"
      borderRadius="full"
      bg="rgba(255,255,255,0.1)"
    />
    <Text fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="0.05em" opacity={0.8}>
      {title}
    </Text>
    <Text fontSize="2xl" fontWeight="800" mt={1}>
      {value}
    </Text>
    {subtitle && (
      <Text fontSize="xs" opacity={0.7} mt={1}>
        {subtitle}
      </Text>
    )}
  </Box>
);

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [totals, setTotals] = useState({ income: 0, expenses: 0, balance: 0 });
  const [hoveredCategory, setHoveredCategory] = useState(null);

  // Generate year options
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

      // Load transactions with categories
      const { data, error } = await supabase
        .from('transactions')
        .select('date, amount, type, category_id, categories(name)')
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

      // Category spending map
      const categoryMap = {};

      // Aggregate transactions by month and category
      (data || []).forEach(tx => {
        const txDate = new Date(tx.date + 'T00:00:00');
        const monthIndex = txDate.getMonth();

        if (tx.type === 'income') {
          monthly[monthIndex].income += Number(tx.amount);
        } else {
          monthly[monthIndex].expenses += Number(tx.amount);

          // Track category spending
          const catName = tx.categories?.name || 'Uncategorized';
          categoryMap[catName] = (categoryMap[catName] || 0) + Number(tx.amount);
        }
      });

      // Calculate balance for each month
      monthly.forEach(m => {
        m.balance = m.income - m.expenses;
      });

      // Convert category map to sorted array and combine small categories into "Others"
      const sortedCategories = Object.entries(categoryMap)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);

      // Take top 5 and combine rest into "Others"
      let categoryArray;
      if (sortedCategories.length > 5) {
        const top5 = sortedCategories.slice(0, 5);
        const othersAmount = sortedCategories.slice(5).reduce((sum, cat) => sum + cat.amount, 0);
        categoryArray = [...top5, { name: 'Others', amount: othersAmount }];
      } else {
        categoryArray = sortedCategories;
      }

      // Calculate totals
      const totalIncome = monthly.reduce((sum, m) => sum + m.income, 0);
      const totalExpenses = monthly.reduce((sum, m) => sum + m.expenses, 0);

      setMonthlyData(monthly);
      setCategoryData(categoryArray);
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
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyShort = (amount) => {
    if (Math.abs(amount) >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return formatCurrency(amount);
  };

  // Calculate additional metrics
  const avgMonthlyExpense = totals.expenses / 12;
  const avgMonthlyIncome = totals.income / 12;
  const savingsRate = totals.income > 0 ? ((totals.balance / totals.income) * 100).toFixed(1) : 0;
  const monthsWithData = monthlyData.filter(m => m.income > 0 || m.expenses > 0).length;

  if (loading) {
    return (
      <PageContainer>
        <Flex w="100%" minH="60vh" align="center" justify="center">
          <VStack gap={4}>
            <Spinner size="xl" />
            <Text>Loading report...</Text>
          </VStack>
        </Flex>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <VStack gap={6} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
          <Box>
            <Heading size="xl">Financial Report</Heading>
            <Text color="gray.500" mt={1}>Your yearly financial overview</Text>
          </Box>
          <HStack gap={2}>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                fontWeight: '600',
                borderRadius: '12px',
                border: '2px solid #E2E8F0',
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

        {/* Summary Cards */}
        <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
          <SummaryCard
            title="Total Income"
            value={formatCurrency(totals.income)}
            subtitle={`~${formatCurrencyShort(avgMonthlyIncome)}/month`}
            bgGradient="linear-gradient(135deg, #10B981 0%, #059669 100%)"
          />
          <SummaryCard
            title="Total Expenses"
            value={formatCurrency(totals.expenses)}
            subtitle={`~${formatCurrencyShort(avgMonthlyExpense)}/month`}
            bgGradient="linear-gradient(135deg, #EF4444 0%, #DC2626 100%)"
          />
          <SummaryCard
            title="Net Balance"
            value={formatCurrency(totals.balance)}
            subtitle={totals.balance >= 0 ? 'Surplus' : 'Deficit'}
            bgGradient={totals.balance >= 0
              ? "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)"
              : "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
            }
          />
          <SummaryCard
            title="Savings Rate"
            value={`${savingsRate}%`}
            subtitle={`${monthsWithData} months tracked`}
            bgGradient="linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)"
          />
        </SimpleGrid>

        {/* Charts Row */}
        <Flex gap={6} direction={{ base: 'column', lg: 'row' }}>
          {/* Monthly Bar Chart */}
          <Box
            flex="2"
            p={6}
            bg="white"
            borderRadius="20px"
            boxShadow="0 1px 3px rgba(0,0,0,0.05)"
            border="1px solid #F3F4F6"
          >
            <Flex justify="space-between" align="center" mb={4}>
              <Box>
                <Heading size="md" color="gray.800">Income vs Expenses</Heading>
                <Text fontSize="sm" color="gray.500">Monthly comparison</Text>
              </Box>
              <HStack gap={4}>
                <HStack gap={1}>
                  <Box w="12px" h="12px" borderRadius="3px" bg="linear-gradient(180deg, #34D399 0%, #059669 100%)" />
                  <Text fontSize="xs" color="gray.500">Income</Text>
                </HStack>
                <HStack gap={1}>
                  <Box w="12px" h="12px" borderRadius="3px" bg="linear-gradient(180deg, #F87171 0%, #DC2626 100%)" />
                  <Text fontSize="xs" color="gray.500">Expenses</Text>
                </HStack>
              </HStack>
            </Flex>
            <MonthlyBarChart data={monthlyData} formatCurrency={formatCurrency} />
          </Box>

          {/* Category Breakdown */}
          <Box
            flex="1"
            p={6}
            bg="white"
            borderRadius="20px"
            boxShadow="0 1px 3px rgba(0,0,0,0.05)"
            border="1px solid #F3F4F6"
            minW={{ base: '100%', lg: '280px' }}
          >
            <Heading size="md" color="gray.800" mb={1}>Top Categories</Heading>
            <Text fontSize="sm" color="gray.500" mb={4}>Expense breakdown</Text>
            {categoryData.length > 0 ? (
              <CategoryDonutChart
                categories={categoryData}
                total={totals.expenses}
                formatCurrency={formatCurrency}
                hoveredCategory={hoveredCategory}
                onHoverCategory={setHoveredCategory}
              />
            ) : (
              <Flex justify="center" align="center" h="200px">
                <Text color="gray.400">No expense data</Text>
              </Flex>
            )}
          </Box>
        </Flex>

        {/* Balance Trend */}
        <Box
          p={6}
          bg="white"
          borderRadius="20px"
          boxShadow="0 1px 3px rgba(0,0,0,0.05)"
          border="1px solid #F3F4F6"
        >
          <Heading size="md" color="gray.800" mb={1}>Balance Trend</Heading>
          <Text fontSize="sm" color="gray.500" mb={4}>Monthly net balance throughout the year</Text>
          <TrendLineChart data={monthlyData} formatCurrency={formatCurrency} />
        </Box>

        {/* Detailed Table */}
        <Box
          borderRadius="20px"
          overflow="hidden"
          bg="white"
          boxShadow="0 1px 3px rgba(0,0,0,0.05)"
          border="1px solid #F3F4F6"
        >
          <Box p={5} borderBottomWidth="1px" borderColor="gray.100">
            <Heading size="md" color="gray.800">Monthly Breakdown</Heading>
            <Text fontSize="sm" color="gray.500">Detailed view of each month</Text>
          </Box>
          <Table.Root size="md">
            <Table.Header>
              <Table.Row bg="gray.50">
                <Table.ColumnHeader py={3} px={5} fontWeight="600" color="gray.600">Month</Table.ColumnHeader>
                <Table.ColumnHeader py={3} px={5} textAlign="right" fontWeight="600" color="gray.600">Income</Table.ColumnHeader>
                <Table.ColumnHeader py={3} px={5} textAlign="right" fontWeight="600" color="gray.600">Expenses</Table.ColumnHeader>
                <Table.ColumnHeader py={3} px={5} textAlign="right" fontWeight="600" color="gray.600">Balance</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {monthlyData.map((row) => (
                <Table.Row key={row.month} _hover={{ bg: 'gray.50' }}>
                  <Table.Cell py={3} px={5}>
                    <Text fontWeight="500" color="gray.700">{row.month}</Text>
                  </Table.Cell>
                  <Table.Cell py={3} px={5} textAlign="right">
                    <Text color={row.income > 0 ? 'green.600' : 'gray.400'} fontWeight="500">
                      {row.income > 0 ? formatCurrency(row.income) : '-'}
                    </Text>
                  </Table.Cell>
                  <Table.Cell py={3} px={5} textAlign="right">
                    <Text color={row.expenses > 0 ? 'red.500' : 'gray.400'} fontWeight="500">
                      {row.expenses > 0 ? formatCurrency(row.expenses) : '-'}
                    </Text>
                  </Table.Cell>
                  <Table.Cell py={3} px={5} textAlign="right">
                    <Box
                      display="inline-block"
                      px={3}
                      py={1}
                      borderRadius="full"
                      bg={row.balance >= 0 ? 'green.50' : 'red.50'}
                      color={row.balance >= 0 ? 'green.600' : 'red.600'}
                      fontWeight="600"
                      fontSize="sm"
                    >
                      {row.balance !== 0 ? (row.balance < 0 ? '-' : '+') + formatCurrency(Math.abs(row.balance)) : '-'}
                    </Box>
                  </Table.Cell>
                </Table.Row>
              ))}
              {/* Total Row */}
              <Table.Row bg="linear-gradient(135deg, #1E293B 0%, #334155 100%)">
                <Table.Cell py={4} px={5}>
                  <Text fontWeight="700" color="white">TOTAL</Text>
                </Table.Cell>
                <Table.Cell py={4} px={5} textAlign="right">
                  <Text fontWeight="700" color="green.300">
                    {formatCurrency(totals.income)}
                  </Text>
                </Table.Cell>
                <Table.Cell py={4} px={5} textAlign="right">
                  <Text fontWeight="700" color="red.300">
                    {formatCurrency(totals.expenses)}
                  </Text>
                </Table.Cell>
                <Table.Cell py={4} px={5} textAlign="right">
                  <Box
                    display="inline-block"
                    px={4}
                    py={1}
                    borderRadius="full"
                    bg={totals.balance >= 0 ? 'green.500' : 'red.500'}
                    color="white"
                    fontWeight="700"
                  >
                    {totals.balance < 0 ? '-' : '+'}{formatCurrency(Math.abs(totals.balance))}
                  </Box>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
        </Box>
      </VStack>
    </PageContainer>
  );
}
