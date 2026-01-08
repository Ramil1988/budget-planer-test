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
import { useDarkModeColors } from '../lib/useDarkModeColors';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Bar Chart Component for Income vs Expenses
const MonthlyBarChart = ({ data, formatCurrency, colors }) => {
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
              <Text fontSize="xs" color={colors.textMuted} fontWeight="500">
                {MONTH_ABBR[index]}
              </Text>
            </Flex>
          );
        })}
      </Flex>
    </Box>
  );
};

// Trend Line Chart Component with hover effects
const TrendLineChart = ({ data, formatCurrency, hoveredMonth, onHoverMonth, colors }) => {
  const values = data.map(d => d.balance);
  const maxVal = Math.max(...values.map(Math.abs), 1);
  const width = 800;
  const height = 220;
  const paddingTop = 30;
  const paddingBottom = 45;
  const paddingLeft = 60;
  const paddingRight = 30;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const zeroY = paddingTop + chartHeight / 2;

  // Find last month with data
  const lastMonthWithData = data.reduce((last, d, i) => (d.income > 0 || d.expenses > 0) ? i : last, 0);

  // Generate points for the line
  const points = data.map((d, i) => {
    const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
    const y = zeroY - (d.balance / maxVal) * (chartHeight / 2);
    return { x, y, balance: d.balance, month: MONTH_ABBR[i], income: d.income, expenses: d.expenses, hasData: d.income > 0 || d.expenses > 0 };
  });

  // Only draw line up to last month with data
  const pointsWithData = points.slice(0, lastMonthWithData + 1);

  const pathD = pointsWithData
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Area fill paths - only up to last month with data
  const areaD = pointsWithData.length > 0
    ? `${pathD} L ${pointsWithData[pointsWithData.length - 1].x} ${zeroY} L ${paddingLeft} ${zeroY} Z`
    : '';

  // Y-axis labels
  const yLabels = [
    { value: maxVal, y: paddingTop },
    { value: maxVal / 2, y: paddingTop + chartHeight / 4 },
    { value: 0, y: zeroY },
    { value: -maxVal / 2, y: zeroY + chartHeight / 4 },
    { value: -maxVal, y: paddingTop + chartHeight },
  ];

  const formatShort = (val) => {
    if (Math.abs(val) >= 1000) {
      return `$${(val / 1000).toFixed(0)}k`;
    }
    return `$${val.toFixed(0)}`;
  };

  const hoveredPoint = hoveredMonth !== null ? points[hoveredMonth] : null;

  return (
    <Box overflowX={{ base: 'auto', md: 'visible' }} position="relative">
      <Box minW={{ base: '700px', md: 'auto' }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', maxWidth: '100%' }}
        >
        {/* Grid lines */}
        {yLabels.map((label, i) => (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={label.y}
              x2={width - paddingRight}
              y2={label.y}
              stroke={label.value === 0 ? '#9CA3AF' : '#F3F4F6'}
              strokeWidth={label.value === 0 ? 1.5 : 1}
              strokeDasharray={label.value === 0 ? '0' : '4,4'}
            />
            <text
              x={paddingLeft - 10}
              y={label.y + 4}
              textAnchor="end"
              fontSize="11"
              fill="#9CA3AF"
            >
              {formatShort(label.value)}
            </text>
          </g>
        ))}

        {/* Area gradient fill */}
        <path
          d={areaD}
          fill="url(#balanceTrendGradient)"
          opacity="0.4"
        />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover vertical line */}
        {hoveredPoint && (
          <line
            x1={hoveredPoint.x}
            y1={paddingTop}
            x2={hoveredPoint.x}
            y2={height - paddingBottom}
            stroke="#6B7280"
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        )}

        {/* Points and month labels */}
        {points.map((p, i) => {
          const isHovered = hoveredMonth === i;
          const hasData = p.income > 0 || p.expenses > 0;
          return (
            <g key={i}>
              {/* Clickable area */}
              <rect
                x={p.x - 25}
                y={paddingTop}
                width={50}
                height={chartHeight}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => onHoverMonth(i)}
                onMouseLeave={() => onHoverMonth(null)}
              />
              {/* Point - only show if has data */}
              {hasData && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 8 : 6}
                  fill={p.balance >= 0 ? '#10B981' : '#EF4444'}
                  stroke="white"
                  strokeWidth={isHovered ? 3 : 2}
                  style={{ transition: 'all 0.15s ease', cursor: 'pointer' }}
                  onMouseEnter={() => onHoverMonth(i)}
                  onMouseLeave={() => onHoverMonth(null)}
                />
              )}
              {/* Month label - always show */}
              <text
                x={p.x}
                y={height - paddingBottom + 20}
                textAnchor="middle"
                fontSize="11"
                fontWeight={isHovered ? '600' : '400'}
                fill={isHovered ? '#1F2937' : '#9CA3AF'}
              >
                {p.month}
              </text>
            </g>
          );
        })}

        {/* Gradient definitions */}
        <defs>
          <linearGradient id="balanceTrendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        </svg>
      </Box>

      {/* Hover tooltip */}
      {hoveredPoint && (
        <Box
          position="absolute"
          top={{ base: '5px', md: '10px' }}
          right={{ base: '10px', md: '20px' }}
          bg={colors.cardBg}
          p={{ base: 3, md: 4 }}
          borderRadius="12px"
          boxShadow="0 4px 16px rgba(0,0,0,0.15)"
          border="1px solid #E5E7EB"
          minW={{ base: '150px', md: '180px' }}
          zIndex={10}
        >
          <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="700" color={colors.textPrimary} mb={2}>
            {data[hoveredMonth]?.month}
          </Text>
          <Flex justify="space-between" mb={2} gap={4}>
            <Text fontSize={{ base: 'sm', md: 'md' }} color={colors.textSecondary}>Income:</Text>
            <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="600" color="green.600">
              {formatCurrency(hoveredPoint.income)}
            </Text>
          </Flex>
          <Flex justify="space-between" mb={2} gap={4}>
            <Text fontSize={{ base: 'sm', md: 'md' }} color={colors.textSecondary}>Expenses:</Text>
            <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="600" color="red.500">
              {formatCurrency(hoveredPoint.expenses)}
            </Text>
          </Flex>
          <Box h="1px" bg={colors.borderColor} my={2} />
          <Flex justify="space-between" gap={4}>
            <Text fontSize={{ base: 'sm', md: 'md' }} color={colors.textSecondary}>Balance:</Text>
            <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="700" color={hoveredPoint.balance >= 0 ? 'green.600' : 'red.500'}>
              {hoveredPoint.balance >= 0 ? '+' : ''}{formatCurrency(hoveredPoint.balance)}
            </Text>
          </Flex>
        </Box>
      )}
    </Box>
  );
};

// Category Donut Chart with hover effects (matching Dashboard style)
const CategoryDonutChart = ({ categories, total, formatCurrency, hoveredCategory, onHoverCategory, themeColors }) => {
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
              <Text fontSize="xs" color={themeColors.textMuted} fontWeight="500" noOfLines={1} maxW="80px">
                {hoveredCat.name}
              </Text>
              <Text fontSize="lg" fontWeight="800" color={themeColors.textPrimary}>
                {formatCurrency(hoveredCat.amount)}
              </Text>
              <Text fontSize="xs" color={themeColors.textMuted}>
                {total > 0 ? ((hoveredCat.amount / total) * 100).toFixed(0) : 0}%
              </Text>
            </>
          ) : (
            <>
              <Text fontSize="xs" color={themeColors.textMuted}>Total Spent</Text>
              <Text fontSize="xl" fontWeight="800" color={themeColors.textPrimary}>
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
              bg={isHovered ? themeColors.rowStripedBg : 'transparent'}
              opacity={isOtherHovered ? 0.4 : 1}
              transition="all 0.15s"
              cursor="pointer"
              onMouseEnter={() => onHoverCategory(cat.name)}
              onMouseLeave={() => onHoverCategory(null)}
            >
              <HStack gap={2}>
                <Box w="10px" h="10px" borderRadius="full" bg={getCategoryColor(cat.name, index)} flexShrink={0} />
                <Text color={themeColors.textSecondary} noOfLines={1} fontWeight={isHovered ? '600' : '500'}>{cat.name}</Text>
              </HStack>
              <HStack gap={2}>
                <Text fontWeight="600" color={themeColors.textPrimary}>{formatCurrency(cat.amount)}</Text>
                <Text fontSize="xs" color={themeColors.textMuted}>
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
  const colors = useDarkModeColors();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [totals, setTotals] = useState({ income: 0, expenses: 0, balance: 0 });
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [hoveredMonth, setHoveredMonth] = useState(null);

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
            <Heading size="xl" color={colors.textPrimary}>Financial Report</Heading>
            <Text color={colors.textSecondary} mt={1}>Your yearly financial overview</Text>
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
                border: `2px solid ${colors.borderColor}`,
                backgroundColor: colors.cardBg,
                color: colors.textPrimary,
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
            bg={colors.cardBg}
            borderRadius="20px"
            boxShadow="0 1px 3px rgba(0,0,0,0.05)"
            border="1px solid" borderColor={colors.borderSubtle}
          >
            <Flex justify="space-between" align="center" mb={4}>
              <Box>
                <Heading size="md" color={colors.textPrimary}>Income vs Expenses</Heading>
                <Text fontSize="sm" color={colors.textSecondary}>Monthly comparison</Text>
              </Box>
              <HStack gap={4}>
                <HStack gap={1}>
                  <Box w="12px" h="12px" borderRadius="3px" bg="linear-gradient(180deg, #34D399 0%, #059669 100%)" />
                  <Text fontSize="xs" color={colors.textMuted}>Income</Text>
                </HStack>
                <HStack gap={1}>
                  <Box w="12px" h="12px" borderRadius="3px" bg="linear-gradient(180deg, #F87171 0%, #DC2626 100%)" />
                  <Text fontSize="xs" color={colors.textMuted}>Expenses</Text>
                </HStack>
              </HStack>
            </Flex>
            <MonthlyBarChart data={monthlyData} formatCurrency={formatCurrency} colors={colors} />
          </Box>

          {/* Category Breakdown */}
          <Box
            flex="1"
            p={6}
            bg={colors.cardBg}
            borderRadius="20px"
            boxShadow="0 1px 3px rgba(0,0,0,0.05)"
            border="1px solid" borderColor={colors.borderSubtle}
            minW={{ base: '100%', lg: '280px' }}
          >
            <Heading size="md" color={colors.textPrimary} mb={1}>Top Categories</Heading>
            <Text fontSize="sm" color={colors.textSecondary} mb={4}>Expense breakdown</Text>
            {categoryData.length > 0 ? (
              <CategoryDonutChart
                categories={categoryData}
                total={totals.expenses}
                formatCurrency={formatCurrency}
                hoveredCategory={hoveredCategory}
                onHoverCategory={setHoveredCategory}
                themeColors={colors}
              />
            ) : (
              <Flex justify="center" align="center" h="200px">
                <Text color={colors.textMuted}>No expense data</Text>
              </Flex>
            )}
          </Box>
        </Flex>

        {/* Balance Trend */}
        <Box
          p={6}
          bg={colors.cardBg}
          borderRadius="20px"
          boxShadow="0 1px 3px rgba(0,0,0,0.05)"
          border="1px solid" borderColor={colors.borderSubtle}
        >
          <Heading size="md" color={colors.textPrimary} mb={1}>Balance Trend</Heading>
          <Text fontSize="sm" color={colors.textSecondary} mb={4}>Monthly net balance throughout the year</Text>
          <TrendLineChart
              data={monthlyData}
              formatCurrency={formatCurrency}
              hoveredMonth={hoveredMonth}
              onHoverMonth={setHoveredMonth}
              colors={colors}
            />
        </Box>

        {/* Detailed Table */}
        <Box
          borderRadius={{ base: '12px', md: '20px' }}
          overflow="hidden"
          bg={colors.cardBg}
          boxShadow="0 1px 3px rgba(0,0,0,0.05)"
          border="1px solid" borderColor={colors.borderSubtle}
        >
          <Box p={{ base: 3, md: 5 }} borderBottomWidth="1px" borderColor={colors.borderSubtle}>
            <Heading size={{ base: 'sm', md: 'md' }} color={colors.textPrimary}>Monthly Breakdown</Heading>
            <Text fontSize={{ base: 'xs', md: 'sm' }} color={colors.textSecondary}>Detailed view of each month</Text>
          </Box>
          <Box>
            <Table.Root size="sm" w="100%">
              <Table.Header>
                <Table.Row bg={colors.rowStripedBg}>
                  <Table.ColumnHeader py={2} px={{ base: 2, md: 5 }} fontWeight="600" color={colors.textSecondary} fontSize={{ base: '11px', md: 'sm' }} w={{ base: '70px', md: 'auto' }}>Month</Table.ColumnHeader>
                  <Table.ColumnHeader py={2} px={{ base: 1, md: 5 }} textAlign="right" fontWeight="600" color={colors.textSecondary} fontSize={{ base: '11px', md: 'sm' }}>Income</Table.ColumnHeader>
                  <Table.ColumnHeader py={2} px={{ base: 1, md: 5 }} textAlign="right" fontWeight="600" color={colors.textSecondary} fontSize={{ base: '11px', md: 'sm' }}>Expenses</Table.ColumnHeader>
                  <Table.ColumnHeader py={2} px={{ base: 1, md: 5 }} textAlign="right" fontWeight="600" color={colors.textSecondary} fontSize={{ base: '11px', md: 'sm' }}>Balance</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {monthlyData.map((row, index) => (
                  <Table.Row key={row.month} _hover={{ bg: colors.rowStripedBg }}>
                    <Table.Cell py={2} px={{ base: 2, md: 5 }}>
                      <Text fontWeight="500" color={colors.textSecondary} fontSize={{ base: '11px', md: 'sm' }}>
                        <Box as="span" display={{ base: 'none', md: 'inline' }}>{row.month}</Box>
                        <Box as="span" display={{ base: 'inline', md: 'none' }}>{MONTH_ABBR[index]}</Box>
                      </Text>
                    </Table.Cell>
                    <Table.Cell py={2} px={{ base: 1, md: 5 }} textAlign="right">
                      <Text color={row.income > 0 ? 'green.600' : colors.textMuted} fontWeight="500" fontSize={{ base: '11px', md: 'sm' }}>
                        {row.income > 0 ? formatCurrency(row.income) : '-'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell py={2} px={{ base: 1, md: 5 }} textAlign="right">
                      <Text color={row.expenses > 0 ? 'red.500' : colors.textMuted} fontWeight="500" fontSize={{ base: '11px', md: 'sm' }}>
                        {row.expenses > 0 ? formatCurrency(row.expenses) : '-'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell py={2} px={{ base: 1, md: 5 }} textAlign="right">
                      <Box
                        display="inline-block"
                        px={{ base: 1.5, md: 3 }}
                        py={0.5}
                        borderRadius="full"
                        bg={row.balance >= 0 ? 'green.50' : 'red.50'}
                        color={row.balance >= 0 ? 'green.600' : 'red.600'}
                        fontWeight="600"
                        fontSize={{ base: '10px', md: 'sm' }}
                      >
                        {row.balance !== 0 ? (row.balance < 0 ? '-' : '+') + formatCurrency(Math.abs(row.balance)) : '-'}
                      </Box>
                    </Table.Cell>
                  </Table.Row>
                ))}
                {/* Total Row */}
                <Table.Row bg="linear-gradient(135deg, #1E293B 0%, #334155 100%)">
                  <Table.Cell py={{ base: 2, md: 4 }} px={{ base: 2, md: 5 }}>
                    <Text fontWeight="700" color="white" fontSize={{ base: '11px', md: 'sm' }}>TOTAL</Text>
                  </Table.Cell>
                  <Table.Cell py={{ base: 2, md: 4 }} px={{ base: 1, md: 5 }} textAlign="right">
                    <Text fontWeight="700" color="green.300" fontSize={{ base: '11px', md: 'sm' }}>
                      {formatCurrency(totals.income)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell py={{ base: 2, md: 4 }} px={{ base: 1, md: 5 }} textAlign="right">
                    <Text fontWeight="700" color="red.300" fontSize={{ base: '11px', md: 'sm' }}>
                      {formatCurrency(totals.expenses)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell py={{ base: 2, md: 4 }} px={{ base: 1, md: 5 }} textAlign="right">
                    <Box
                      display="inline-block"
                      px={{ base: 1.5, md: 4 }}
                      py={0.5}
                      borderRadius="full"
                      bg={totals.balance >= 0 ? 'green.500' : 'red.500'}
                      color="white"
                      fontWeight="700"
                      fontSize={{ base: '10px', md: 'sm' }}
                    >
                      {totals.balance < 0 ? '-' : '+'}{formatCurrency(Math.abs(totals.balance))}
                    </Box>
                  </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
        </Box>
      </Box>
      </VStack>
    </PageContainer>
  );
}
