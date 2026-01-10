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
  SimpleGrid,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PageContainer from '../components/PageContainer';
import { getUpcomingPayments, formatFrequency, getPaymentDatesInRange } from '../lib/recurringUtils';
import { useDarkModeColors } from '../lib/useDarkModeColors';

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
  'Others': '#9CA3AF',
  'default': '#94A3B8'
};

const getCategoryColor = (name) => categoryColors[name] || categoryColors.default;

// Donut Chart Component with hover effects
const DonutChart = ({ data, total, size = 200, formatCurrency, hoveredCategory, onHoverCategory }) => {
  const colors = useDarkModeColors();
  const strokeWidth = 35;
  const hoverExpand = 8; // Extra space for hover effect
  const padding = hoverExpand; // Padding to prevent clipping on hover
  const svgSize = size + padding * 2; // Larger SVG to accommodate hover
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const center = svgSize / 2;

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

  const hoveredSegment = hoveredCategory ? segments.find(s => s.name === hoveredCategory) : null;

  return (
    <Box position="relative" w={svgSize} h={svgSize}>
      <svg width={svgSize} height={svgSize} style={{ transform: 'rotate(-90deg)' }}>
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
        {segments.map((segment, index) => {
          const isHovered = hoveredCategory === segment.name;
          const isOtherHovered = hoveredCategory && !isHovered;
          return (
            <circle
              key={segment.id || index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={isHovered ? strokeWidth + hoverExpand : strokeWidth}
              strokeDasharray={`${segment.length} ${circumference - segment.length}`}
              strokeDashoffset={-segment.offset}
              style={{
                transition: 'all 0.2s ease',
                opacity: isOtherHovered ? 0.3 : 1,
                cursor: 'pointer',
              }}
              onMouseEnter={() => onHoverCategory(segment.name)}
              onMouseLeave={() => onHoverCategory(null)}
            />
          );
        })}
      </svg>
      {/* Center text - Shows hovered category or total */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        textAlign="center"
        pointerEvents="none"
      >
        {hoveredSegment ? (
          <>
            <Text fontSize="10px" color={hoveredSegment.color} fontWeight="600" mb={0.5} noOfLines={1} maxW="90px">
              {hoveredSegment.name}
            </Text>
            <Text fontSize="lg" fontWeight="800" color={colors.textPrimary} letterSpacing="-0.02em">
              {formatCurrency ? formatCurrency(hoveredSegment.spent) : `$${hoveredSegment.spent.toFixed(0)}`}
            </Text>
            <Text fontSize="10px" color={colors.textMuted} fontWeight="600">
              {hoveredSegment.percent.toFixed(0)}%
            </Text>
          </>
        ) : (
          <>
            <Text fontSize="xs" color={colors.textMuted} fontWeight="500" mb={0.5}>
              Total Spent
            </Text>
            <Text fontSize="xl" fontWeight="800" color={colors.textPrimary} letterSpacing="-0.02em">
              {formatCurrency ? formatCurrency(total) : `$${total.toFixed(0)}`}
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
};

// Weekly Spending Bar Chart Component
const WeeklyBarChart = ({ dailyExpenses, dailyIncome, maxAmount, weekOffset = 0, weekDates, selectedDayIndex, onDayClick }) => {
  const colors = useDarkModeColors();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const barHeight = 80;

  // Get current day (0 = Sunday, so we need to adjust for Mon-Sun array)
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1; // Convert to Mon=0, Sun=6

  return (
    <VStack gap={3} align="stretch">
      <Flex align="center" justify="space-between" h={`${barHeight * 2 + 60}px`} gap={2}>
        {days.map((day, index) => {
          const expense = dailyExpenses[index] || 0;
          const income = dailyIncome[index] || 0;
          const expensePercent = maxAmount > 0 ? (expense / maxAmount) * 100 : 0;
          const incomePercent = maxAmount > 0 ? (income / maxAmount) * 100 : 0;
          // Only highlight "today" when viewing current week
          const isToday = weekOffset === 0 && index === todayIndex;
          const hasActivity = expense > 0 || income > 0;
          const isSelected = selectedDayIndex === index;
          const dateNum = weekDates[index];

          return (
            <VStack
              key={day}
              gap={0}
              flex="1"
              align="center"
              cursor={hasActivity ? 'pointer' : 'default'}
              onClick={() => hasActivity && onDayClick(index)}
              opacity={selectedDayIndex !== null && !isSelected ? 0.5 : 1}
              transition="opacity 0.2s"
            >
              {/* Income bar (goes up) */}
              <Box position="relative" w="100%" h={`${barHeight}px`}>
                {/* Amount label */}
                <Text
                  position="absolute"
                  top="0"
                  left="50%"
                  transform="translateX(-50%)"
                  fontSize="10px"
                  fontWeight="600"
                  color={income > 0 ? '#059669' : 'transparent'}
                  whiteSpace="nowrap"
                >
                  {income > 0 ? `+$${income.toFixed(0)}` : ''}
                </Text>
                <Box
                  position="absolute"
                  bottom="0"
                  left="50%"
                  transform="translateX(-50%)"
                  w="70%"
                  maxW="32px"
                  h={`${Math.max(incomePercent * 0.8, income > 0 ? 8 : 0)}%`}
                  bg={income > 0 ? 'linear-gradient(180deg, #10B981 0%, #059669 100%)' : 'transparent'}
                  borderRadius="4px 4px 0 0"
                  transition="height 0.5s ease"
                />
              </Box>

              {/* Day label and date in the middle */}
              <Box
                py={1}
                px={2}
                borderRadius="6px"
                bg={isSelected ? colors.rowHoverBg : 'transparent'}
                border={isToday ? '2px solid #2563EB' : isSelected ? '1px solid' : 'none'}
                borderColor={isSelected ? colors.borderColor : 'transparent'}
              >
                <Text
                  fontSize="xs"
                  fontWeight={isToday || isSelected ? '700' : '500'}
                  color={isToday ? colors.primary : isSelected ? colors.textPrimary : colors.textMuted}
                  textAlign="center"
                >
                  {day}
                </Text>
                <Text
                  fontSize="9px"
                  fontWeight="500"
                  color={colors.textMuted}
                  textAlign="center"
                >
                  {dateNum}
                </Text>
              </Box>

              {/* Expense bar (goes down) */}
              <Box position="relative" w="100%" h={`${barHeight}px`}>
                <Box
                  position="absolute"
                  top="0"
                  left="50%"
                  transform="translateX(-50%)"
                  w="70%"
                  maxW="32px"
                  h={`${Math.max(expensePercent * 0.8, expense > 0 ? 8 : 0)}%`}
                  bg={expense > 0 ? 'linear-gradient(180deg, #7C3AED 0%, #A855F7 100%)' : 'transparent'}
                  borderRadius="0 0 4px 4px"
                  transition="height 0.5s ease"
                />
                {/* Amount label */}
                <Text
                  position="absolute"
                  bottom="0"
                  left="50%"
                  transform="translateX(-50%)"
                  fontSize="10px"
                  fontWeight="600"
                  color={expense > 0 ? '#7C3AED' : 'transparent'}
                  whiteSpace="nowrap"
                >
                  {expense > 0 ? `-$${expense.toFixed(0)}` : ''}
                </Text>
              </Box>
            </VStack>
          );
        })}
      </Flex>
    </VStack>
  );
};

// Monthly Spending Bar Chart Component
const MonthlyBarChart = ({ dailyData, selectedDay, onDayClick, selectedMonth, formatCurrency }) => {
  const colors = useDarkModeColors();
  const barHeight = 80;
  const maxAmount = Math.max(...dailyData, 1);
  const [year, month] = selectedMonth.split('-').map(Number);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
  const todayDate = isCurrentMonth ? today.getDate() : -1;

  return (
    <Box>
      <Box
        overflowX="auto"
        pb={2}
        css={{
          '&::-webkit-scrollbar': { height: '6px' },
          '&::-webkit-scrollbar-track': { background: '#F4F4F5', borderRadius: '3px' },
          '&::-webkit-scrollbar-thumb': { background: '#D4D4D8', borderRadius: '3px' },
        }}
      >
        <Flex gap={1} minW={`${dailyData.length * 28}px`} align="flex-end" h={`${barHeight + 40}px`}>
          {dailyData.map((amount, index) => {
            const dayNum = index + 1;
            const heightPercent = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
            const isToday = dayNum === todayDate;
            const isSelected = selectedDay === index;
            const hasSpending = amount > 0;

            return (
              <VStack
                key={dayNum}
                gap={0.5}
                flex="1"
                minW="24px"
                align="center"
                cursor={hasSpending ? 'pointer' : 'default'}
                onClick={() => hasSpending && onDayClick(index)}
                opacity={selectedDay !== null && !isSelected ? 0.4 : 1}
                transition="opacity 0.2s"
              >
                <Box
                  w="100%"
                  maxW="20px"
                  h={`${barHeight}px`}
                  bg={colors.rowStripedBg}
                  borderRadius="4px"
                  overflow="hidden"
                  position="relative"
                  border={isSelected ? '2px solid #2563EB' : 'none'}
                >
                  <Box
                    position="absolute"
                    bottom="0"
                    left="0"
                    right="0"
                    h={`${Math.max(heightPercent, hasSpending ? 5 : 0)}%`}
                    bg={isToday
                      ? 'linear-gradient(180deg, #3B82F6 0%, #2563EB 100%)'
                      : hasSpending
                        ? 'linear-gradient(180deg, #10B981 0%, #059669 100%)'
                        : '#E4E4E7'
                    }
                    borderRadius="3px"
                    transition="height 0.3s ease"
                  />
                </Box>
                <Text
                  fontSize="9px"
                  fontWeight={isToday || isSelected ? '700' : '500'}
                  color={isToday ? colors.primary : isSelected ? colors.textPrimary : colors.textMuted}
                >
                  {dayNum}
                </Text>
              </VStack>
            );
          })}
        </Flex>
      </Box>
    </Box>
  );
};

// Mini Calendar Component for Upcoming Payments
const MiniCalendar = ({ recurringPayments, onDayClick, selectedDate, formatCurrency }) => {
  const colors = useDarkModeColors();
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  // Get first day of month and total days
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Calculate payment dates for this month
  const monthStart = new Date(viewYear, viewMonth, 1);
  const monthEnd = new Date(viewYear, viewMonth + 1, 0);

  const paymentsByDate = {};
  recurringPayments.forEach(payment => {
    if (!payment.is_active) return;
    const dates = getPaymentDatesInRange(
      payment.start_date,
      payment.frequency,
      monthStart,
      monthEnd,
      payment.end_date
    );
    dates.forEach(date => {
      const key = date.getDate();
      if (!paymentsByDate[key]) {
        paymentsByDate[key] = [];
      }
      paymentsByDate[key].push(payment);
    });
  });

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const isToday = (day) => {
    return day === today.getDate() &&
           viewMonth === today.getMonth() &&
           viewYear === today.getFullYear();
  };

  const isSelected = (day) => {
    return selectedDate &&
           day === selectedDate.getDate() &&
           viewMonth === selectedDate.getMonth() &&
           viewYear === selectedDate.getFullYear();
  };

  // Build calendar grid
  const calendarDays = [];

  // Previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarDays.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      payments: []
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: true,
      payments: paymentsByDate[day] || []
    });
  }

  // Next month days (fill to complete 6 rows)
  const remainingDays = 42 - calendarDays.length;
  for (let i = 1; i <= remainingDays; i++) {
    calendarDays.push({
      day: i,
      isCurrentMonth: false,
      payments: []
    });
  }

  // Short day names for mobile
  const shortDayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <Box>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={{ base: 2, md: 3 }}>
        <Button
          size="xs"
          variant="ghost"
          onClick={goToPrevMonth}
          color={colors.textMuted}
          _hover={{ bg: '#F4F4F5' }}
          p={1}
          minW={{ base: '28px', md: '32px' }}
          h={{ base: '28px', md: '32px' }}
        >
          ←
        </Button>
        <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="600" color={colors.textPrimary}>
          {monthNames[viewMonth]} {viewYear}
        </Text>
        <Button
          size="xs"
          variant="ghost"
          onClick={goToNextMonth}
          color={colors.textMuted}
          _hover={{ bg: '#F4F4F5' }}
          p={1}
          minW={{ base: '28px', md: '32px' }}
          h={{ base: '28px', md: '32px' }}
        >
          →
        </Button>
      </Flex>

      {/* Day headers */}
      <SimpleGrid columns={7} gap={{ base: 0, md: 1 }} mb={1}>
        {dayNames.map((day, idx) => (
          <Box key={day} textAlign="center" py={{ base: 1, md: 2 }}>
            <Text fontSize={{ base: '10px', md: 'xs' }} fontWeight="600" color={colors.textMuted}>
              <Box as="span" display={{ base: 'inline', md: 'none' }}>{shortDayNames[idx]}</Box>
              <Box as="span" display={{ base: 'none', md: 'inline' }}>{day}</Box>
            </Text>
          </Box>
        ))}
      </SimpleGrid>

      {/* Calendar grid */}
      <SimpleGrid columns={7} gap={{ base: 0, md: 1 }}>
        {calendarDays.map((item, index) => {
          const hasPayments = item.payments.length > 0;
          const hasExpense = item.payments.some(p => p.type === 'expense');
          const hasIncome = item.payments.some(p => p.type === 'income');

          // Check if this day is in the past
          const cellDate = new Date(viewYear, viewMonth, item.day);
          cellDate.setHours(0, 0, 0, 0);
          const todayStart = new Date(today);
          todayStart.setHours(0, 0, 0, 0);
          const isPast = item.isCurrentMonth && cellDate < todayStart;

          return (
            <Box
              key={index}
              textAlign="center"
              py={{ base: 1.5, md: 2 }}
              px={{ base: 0.5, md: 1 }}
              position="relative"
              cursor={hasPayments && item.isCurrentMonth ? 'pointer' : 'default'}
              onClick={() => {
                if (hasPayments && item.isCurrentMonth) {
                  onDayClick(new Date(viewYear, viewMonth, item.day), item.payments);
                }
              }}
              borderRadius={{ base: '6px', md: '8px' }}
              bg={
                isSelected(item.day) && item.isCurrentMonth
                  ? '#DBEAFE'
                  : hasPayments && item.isCurrentMonth && !isPast
                    ? hasExpense && hasIncome
                      ? '#FEF3C7' // Yellow for both
                      : hasExpense
                        ? '#FEE2E2' // Light red for expenses
                        : '#D1FAE5' // Light green for income
                    : 'transparent'
              }
              opacity={isPast ? 0.4 : 1}
              _hover={hasPayments && item.isCurrentMonth ? { bg: isSelected(item.day) ? '#BFDBFE' : '#F4F4F5' } : {}}
              transition="background 0.15s, opacity 0.15s"
            >
              <Text
                fontSize={{ base: 'xs', md: 'sm' }}
                fontWeight={
                  (isToday(item.day) && item.isCurrentMonth) || (hasPayments && item.isCurrentMonth && !isPast)
                    ? '700'
                    : '500'
                }
                color={
                  !item.isCurrentMonth
                    ? colors.textMuted
                    : isPast
                      ? colors.textMuted
                      : isToday(item.day)
                        ? colors.primary
                        : hasPayments
                          ? '#18181B' // Always dark text on colored backgrounds
                          : colors.textSecondary
                }
                mb={{ base: 0.5, md: 1 }}
              >
                {item.day}
              </Text>
              {/* Payment indicators */}
              {item.isCurrentMonth && hasPayments && (
                <Flex justify="center" gap={0.5} position="absolute" bottom={{ base: '2px', md: '4px' }} left="0" right="0">
                  {hasExpense && (
                    <Box w={{ base: '4px', md: '6px' }} h={{ base: '4px', md: '6px' }} borderRadius="full" bg="#E11D48" />
                  )}
                  {hasIncome && (
                    <Box w={{ base: '4px', md: '6px' }} h={{ base: '4px', md: '6px' }} borderRadius="full" bg="#059669" />
                  )}
                </Flex>
              )}
            </Box>
          );
        })}
      </SimpleGrid>

      {/* Legend */}
      <Flex justify="center" gap={{ base: 3, md: 4 }} mt={{ base: 2, md: 3 }} pt={2} borderTop="1px solid #F4F4F5">
        <HStack gap={1}>
          <Box w={{ base: '5px', md: '6px' }} h={{ base: '5px', md: '6px' }} borderRadius="full" bg="#E11D48" />
          <Text fontSize={{ base: '9px', md: '10px' }} color={colors.textMuted}>Expense</Text>
        </HStack>
        <HStack gap={1}>
          <Box w={{ base: '5px', md: '6px' }} h={{ base: '5px', md: '6px' }} borderRadius="full" bg="#059669" />
          <Text fontSize={{ base: '9px', md: '10px' }} color={colors.textMuted}>Income</Text>
        </HStack>
      </Flex>
    </Box>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const colors = useDarkModeColors();
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
  const [weeklyIncome, setWeeklyIncome] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [maxDailySpending, setMaxDailySpending] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [allTransactions, setAllTransactions] = useState([]); // Store for week navigation
  const [weekDates, setWeekDates] = useState(['', '', '', '', '', '', '']); // Date numbers for each day
  const [dailyTransactions, setDailyTransactions] = useState([[], [], [], [], [], [], []]); // Transactions by day
  const [selectedDayIndex, setSelectedDayIndex] = useState(null); // Selected day for details
  const [hoveredCategory, setHoveredCategory] = useState(null); // Hovered category for donut chart
  const [othersExpanded, setOthersExpanded] = useState(false); // Whether "Others" breakdown is expanded
  const [monthlyDailySpending, setMonthlyDailySpending] = useState([]); // Daily spending for entire month
  const [selectedMonthDay, setSelectedMonthDay] = useState(null); // Selected day in monthly chart
  const [monthlyDailyTransactions, setMonthlyDailyTransactions] = useState([]); // Transactions by day for month
  const [upcomingPayments, setUpcomingPayments] = useState([]); // Upcoming recurring payments
  const [allRecurringPayments, setAllRecurringPayments] = useState([]); // All recurring payments for calendar
  const [paymentsViewMode, setPaymentsViewMode] = useState('list'); // 'list' or 'calendar'
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null); // Selected date in calendar
  const [selectedCalendarPayments, setSelectedCalendarPayments] = useState([]); // Payments for selected date

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

    const dailySpending = [0, 0, 0, 0, 0, 0, 0]; // Mon to Sun (expenses)
    const dailyIncome = [0, 0, 0, 0, 0, 0, 0]; // Mon to Sun (income)
    const dailyTxs = [[], [], [], [], [], [], []]; // Transactions by day (all types)
    const dates = []; // Date strings for each day

    // Calculate date numbers for the week
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }

    transactions.forEach(tx => {
      const txDate = new Date(tx.date + 'T00:00:00');
      const dayDiff = Math.floor((txDate - monday) / (1000 * 60 * 60 * 24));
      if (dayDiff >= 0 && dayDiff < 7) {
        if (tx.type === 'expense') {
          dailySpending[dayDiff] += Number(tx.amount);
        } else if (tx.type === 'income') {
          dailyIncome[dayDiff] += Number(tx.amount);
        }
        dailyTxs[dayDiff].push(tx);
      }
    });

    setWeeklySpending(dailySpending);
    setWeeklyIncome(dailyIncome);
    const maxExpense = Math.max(...dailySpending);
    const maxIncome = Math.max(...dailyIncome);
    setMaxDailySpending(Math.max(maxExpense, maxIncome, 1));
    setWeekDates(dates);
    setDailyTransactions(dailyTxs);
    setSelectedDayIndex(null); // Reset selection when week changes
  };

  // Calculate monthly spending for all days in the month
  const calculateMonthlySpending = (transactions, monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const dailySpending = Array(daysInMonth).fill(0);
    const dailyTxs = Array(daysInMonth).fill(null).map(() => []);

    transactions.forEach(tx => {
      if (tx.type === 'expense') {
        const txDate = new Date(tx.date + 'T00:00:00');
        const dayOfMonth = txDate.getDate() - 1; // 0-indexed
        if (dayOfMonth >= 0 && dayOfMonth < daysInMonth) {
          dailySpending[dayOfMonth] += Number(tx.amount);
          dailyTxs[dayOfMonth].push(tx);
        }
      }
    });

    setMonthlyDailySpending(dailySpending);
    setMonthlyDailyTransactions(dailyTxs);
    setSelectedMonthDay(null);
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

    return `${formatDate(monday)} - ${formatDate(sunday)}`;
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

      // Calculate monthly daily spending
      calculateMonthlySpending(transactions, selectedMonth);

      // Fetch recurring payments for upcoming payments widget
      const recurringResult = await supabase
        .from('recurring_payments')
        .select('*, categories(name)')
        .eq('user_id', user.id);

      if (!recurringResult.error && recurringResult.data) {
        // Store all recurring payments for calendar view
        setAllRecurringPayments(recurringResult.data);
        // Filter active ones for upcoming list
        const activePayments = recurringResult.data.filter(p => p.is_active);
        const upcoming = getUpcomingPayments(activePayments, 14);
        setUpcomingPayments(upcoming);
      }

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
            <Text color={colors.textMuted} fontWeight="500">Loading your dashboard...</Text>
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
                color={colors.textPrimary}
                letterSpacing="-0.02em"
              >
                Dashboard
              </Heading>
              <Text color={colors.textMuted} fontSize="sm" mt={1}>
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
                bg={colors.inputBg}
                color={colors.textPrimary}
                borderColor={colors.borderColor}
                borderRadius="12px"
                _hover={{ borderColor: colors.primary }}
                _focus={{ borderColor: colors.primary, boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)' }}
              />
              <Button
                as={RouterLink}
                to="/add-transaction"
                bg="#2563EB"
                color="white"
                size="md"
                borderRadius="12px"
                fontWeight="600"
                px={5}
                _hover={{
                  bg: '#1D4ED8',
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
            bg={colors.cardBg}
            boxShadow={colors.cardShadow}
            border="1px solid"
            borderColor={colors.borderSubtle}
          >
            <Flex justify="space-between" align="center" mb={5}>
              <Heading size={{ base: 'sm', md: 'md' }} color={colors.textPrimary} letterSpacing="-0.01em">
                {getMonthName(selectedMonth)}
              </Heading>
              {isCurrentMonth() && daysLeft > 0 && (
                <Box
                  bg={colors.rowStripedBg}
                  px={3}
                  py={1}
                  borderRadius="full"
                >
                  <Text fontSize="xs" fontWeight="600" color={colors.textMuted}>
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

          {/* Upcoming Recurring Payments Widget */}
          {(upcomingPayments.length > 0 || allRecurringPayments.length > 0) && (
            <Box
              p={{ base: 5, md: 6 }}
              borderRadius="16px"
              bg={colors.cardBg}
              boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)"
              border="1px solid" borderColor={colors.borderSubtle}
            >
              <Flex justify="space-between" align="center" mb={4}>
                <HStack gap={2}>
                  <Box
                    w="8px"
                    h="8px"
                    borderRadius="full"
                    bg="#F59E0B"
                  />
                  <Heading size={{ base: 'sm', md: 'md' }} color={colors.textPrimary} letterSpacing="-0.01em">
                    Upcoming Payments
                  </Heading>
                </HStack>
                <HStack gap={2}>
                  {/* View Toggle */}
                  <HStack
                    bg={colors.rowStripedBg}
                    borderRadius="10px"
                    p="2px"
                    gap={0}
                  >
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        setPaymentsViewMode('list');
                        setSelectedCalendarDate(null);
                        setSelectedCalendarPayments([]);
                      }}
                      bg={paymentsViewMode === 'list' ? colors.toggleActiveBg : colors.toggleInactiveBg}
                      color={paymentsViewMode === 'list' ? colors.toggleActiveText : colors.toggleInactiveText}
                      borderRadius="8px"
                      px={2}
                      h="28px"
                      fontWeight="500"
                      fontSize="xs"
                      boxShadow={paymentsViewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'}
                      _hover={{ bg: paymentsViewMode === 'list' ? colors.toggleActiveBg : colors.toggleHoverBg }}
                    >
                      ☰
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setPaymentsViewMode('calendar')}
                      bg={paymentsViewMode === 'calendar' ? colors.toggleActiveBg : colors.toggleInactiveBg}
                      color={paymentsViewMode === 'calendar' ? colors.toggleActiveText : colors.toggleInactiveText}
                      borderRadius="8px"
                      px={2}
                      h="28px"
                      fontWeight="500"
                      fontSize="xs"
                      boxShadow={paymentsViewMode === 'calendar' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'}
                      _hover={{ bg: paymentsViewMode === 'calendar' ? colors.toggleActiveBg : colors.toggleHoverBg }}
                    >
                      📅
                    </Button>
                  </HStack>
                  <Button
                    as={RouterLink}
                    to="/recurring"
                    variant="ghost"
                    size="sm"
                    color="#2563EB"
                    fontWeight="600"
                    _hover={{ bg: colors.primaryBg }}
                  >
                    Manage
                  </Button>
                </HStack>
              </Flex>

              {paymentsViewMode === 'list' ? (
                <>
                  <VStack align="stretch" gap={2}>
                    {upcomingPayments.slice(0, 5).map((payment, index) => (
                      <Flex
                        key={`${payment.id}-${index}`}
                        align="center"
                        justify="space-between"
                        p={3}
                        borderRadius="12px"
                        bg={payment.daysUntil === 0 ? colors.itemDueTodayBg : payment.daysUntil <= 3 ? colors.itemDueSoonBg : colors.rowNormalBg}
                        border="1px solid"
                        borderColor={payment.daysUntil === 0 ? colors.itemDueTodayBorder : payment.daysUntil <= 3 ? colors.itemDueSoonBorder : 'transparent'}
                      >
                        <HStack gap={3}>
                          <Box
                            w="40px"
                            h="40px"
                            borderRadius="10px"
                            bg={payment.type === 'expense' ? colors.expenseIconBg : colors.incomeIconBg}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <Box
                              w="10px"
                              h="10px"
                              borderRadius="full"
                              bg={getCategoryColor(payment.categories?.name)}
                            />
                          </Box>
                          <Box>
                            <Text fontWeight="600" fontSize="sm" color={colors.textPrimary}>
                              {payment.name}
                            </Text>
                            <Text fontSize="xs" color={colors.textMuted}>
                              {payment.categories?.name || 'Uncategorized'} • {formatFrequency(payment.frequency)}
                            </Text>
                          </Box>
                        </HStack>
                        <Box textAlign="right">
                          <Text
                            fontWeight="700"
                            fontSize="sm"
                            color={payment.type === 'expense' ? '#E11D48' : '#059669'}
                          >
                            {payment.type === 'expense' ? '-' : '+'}{formatCurrency(payment.amount)}
                          </Text>
                          <Text
                            fontSize="xs"
                            color={payment.daysUntil === 0 ? colors.danger : colors.textMuted}
                            fontWeight={payment.daysUntil <= 1 ? '600' : '400'}
                          >
                            {payment.nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {payment.daysUntil === 0 ? 'Today' : payment.daysUntil === 1 ? 'Tomorrow' : `In ${payment.daysUntil} days`}
                          </Text>
                        </Box>
                      </Flex>
                    ))}
                  </VStack>

                  {upcomingPayments.length > 5 && (
                    <Text fontSize="xs" color={colors.textMuted} textAlign="center" mt={3}>
                      +{upcomingPayments.length - 5} more upcoming payments
                    </Text>
                  )}
                  {upcomingPayments.length === 0 && (
                    <Text fontSize="sm" color={colors.textMuted} textAlign="center" py={4}>
                      No upcoming payments in the next 14 days
                    </Text>
                  )}
                </>
              ) : (
                <Flex direction={{ base: 'column', lg: 'row' }} gap={{ base: 3, md: 4 }}>
                  {/* Calendar - 70% width on desktop, full width on mobile */}
                  <Box flex={{ base: 'auto', lg: '7' }} w={{ base: '100%', lg: 'auto' }}>
                    <MiniCalendar
                      recurringPayments={allRecurringPayments}
                      onDayClick={(date, payments) => {
                        setSelectedCalendarDate(date);
                        setSelectedCalendarPayments(payments);
                      }}
                      selectedDate={selectedCalendarDate}
                      formatCurrency={formatCurrency}
                    />
                  </Box>

                  {/* Selected Day Details - 30% width on desktop, full width on mobile */}
                  <Box
                    flex={{ base: 'auto', lg: '3' }}
                    w={{ base: '100%', lg: 'auto' }}
                    borderTop={{ base: `1px solid ${colors.borderSubtle}`, lg: 'none' }}
                    borderLeft={{ base: 'none', lg: `1px solid ${colors.borderSubtle}` }}
                    pt={{ base: 3, lg: 0 }}
                    pl={{ base: 0, lg: 4 }}
                  >
                    {selectedCalendarDate && selectedCalendarPayments.length > 0 ? (
                      <VStack align="stretch" gap={2}>
                        <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="600" color={colors.textPrimary} mb={1}>
                          {selectedCalendarDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </Text>
                        {selectedCalendarPayments.map((payment, index) => (
                          <Flex
                            key={`${payment.id}-cal-${index}`}
                            align="center"
                            justify="space-between"
                            p={{ base: 2, md: 2 }}
                            borderRadius="8px"
                            bg={payment.type === 'expense' ? colors.expenseIconBg : colors.incomeIconBg}
                          >
                            <HStack gap={2}>
                              <Box
                                w={{ base: '6px', md: '8px' }}
                                h={{ base: '6px', md: '8px' }}
                                borderRadius="full"
                                bg={getCategoryColor(payment.categories?.name)}
                              />
                              <Box>
                                <Text fontSize={{ base: '11px', md: 'xs' }} fontWeight="500" color={colors.textPrimary} noOfLines={1}>
                                  {payment.name}
                                </Text>
                                {payment.categories?.name && (
                                  <Text fontSize={{ base: '10px', md: '11px' }} color={colors.textMuted} noOfLines={1}>
                                    {payment.categories.name}
                                  </Text>
                                )}
                              </Box>
                            </HStack>
                            <Text
                              fontSize={{ base: '11px', md: 'xs' }}
                              fontWeight="600"
                              color={payment.type === 'expense' ? '#E11D48' : '#059669'}
                            >
                              {payment.type === 'expense' ? '-' : '+'}{formatCurrency(payment.amount)}
                            </Text>
                          </Flex>
                        ))}
                        <Box pt={2} borderTop={`1px solid ${colors.borderSubtle}`} mt={1}>
                          <Flex justify="space-between">
                            <Text fontSize={{ base: '11px', md: 'xs' }} color={colors.textMuted}>Total for day</Text>
                            <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="700" color={colors.textPrimary}>
                              {formatCurrency(selectedCalendarPayments.reduce((sum, p) => {
                                const amount = Number(p.amount);
                                return sum + (p.type === 'expense' ? -amount : amount);
                              }, 0))}
                            </Text>
                          </Flex>
                        </Box>
                      </VStack>
                    ) : (
                      <Flex
                        direction="column"
                        align="center"
                        justify="center"
                        h={{ base: 'auto', lg: '100%' }}
                        minH={{ base: '80px', lg: '150px' }}
                        py={{ base: 2, lg: 0 }}
                        color={colors.textMuted}
                      >
                        <Text fontSize={{ base: 'xl', md: '2xl' }} mb={2}>📅</Text>
                        <Text fontSize={{ base: 'xs', md: 'sm' }} textAlign="center">
                          Tap a day with payments to see details
                        </Text>
                      </Flex>
                    )}
                  </Box>
                </Flex>
              )}
            </Box>
          )}

          {/* Charts Row - Donut & Weekly */}
          <Flex gap={{ base: 5, md: 6 }} direction={{ base: 'column', lg: 'row' }}>
            {/* Spending Breakdown Donut Chart */}
            <Box
              flex="1"
              p={{ base: 5, md: 6 }}
              borderRadius="16px"
              bg={colors.cardBg}
              boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)"
              border="1px solid" borderColor={colors.borderSubtle}
            >
              <Flex justify="space-between" align="center" mb={5}>
                <Heading size={{ base: 'sm', md: 'md' }} color={colors.textPrimary} letterSpacing="-0.01em">
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
                  {/* Donut Chart - show top 5 + Others */}
                  <Box flexShrink={0}>
                    {(() => {
                      const TOP_COUNT = 5;
                      const topCategories = categoryBudgets.slice(0, TOP_COUNT);
                      const otherCategories = categoryBudgets.slice(TOP_COUNT);
                      const othersTotal = otherCategories.reduce((sum, cat) => sum + cat.spent, 0);

                      const chartData = othersTotal > 0
                        ? [...topCategories, { id: 'others', name: 'Others', spent: othersTotal }]
                        : topCategories;

                      return (
                        <DonutChart
                          data={chartData}
                          total={monthlySummary.expenses}
                          size={180}
                          formatCurrency={formatCurrency}
                          hoveredCategory={hoveredCategory}
                          onHoverCategory={setHoveredCategory}
                        />
                      );
                    })()}
                  </Box>

                  {/* Legend - show top 5 + Others */}
                  <VStack align="stretch" gap={2} flex="1" w="100%">
                    {(() => {
                      const TOP_COUNT = 5;
                      const topCategories = categoryBudgets.slice(0, TOP_COUNT);
                      const otherCategories = categoryBudgets.slice(TOP_COUNT);
                      const othersTotal = otherCategories.reduce((sum, cat) => sum + cat.spent, 0);

                      // Filter out zero-spending categories from Others
                      const otherCategoriesWithSpending = otherCategories.filter(cat => cat.spent > 0);
                      const legendItems = othersTotal > 0
                        ? [...topCategories, { id: 'others', name: 'Others', spent: othersTotal, otherCategories: otherCategoriesWithSpending }]
                        : topCategories;

                      return legendItems.map((cat) => {
                        const isHovered = hoveredCategory === cat.name;
                        const isOtherHovered = hoveredCategory && !isHovered;
                        const isOthersCategory = cat.name === 'Others';
                        return (
                          <Box key={cat.id}>
                            <Flex
                              align="center"
                              justify="space-between"
                              py={1.5}
                              px={2}
                              borderRadius="8px"
                              bg={isHovered || (isOthersCategory && othersExpanded) ? colors.rowHoverBg : 'transparent'}
                              opacity={isOtherHovered ? 0.4 : 1}
                              transition="all 0.15s"
                              cursor="pointer"
                              onClick={isOthersCategory ? () => setOthersExpanded(!othersExpanded) : undefined}
                              onMouseEnter={() => setHoveredCategory(cat.name)}
                              onMouseLeave={() => setHoveredCategory(null)}
                            >
                              <HStack gap={2}>
                                <Box
                                  w="10px"
                                  h="10px"
                                  borderRadius="full"
                                  bg={getCategoryColor(cat.name)}
                                  flexShrink={0}
                                />
                                <Text fontSize="sm" fontWeight={isHovered ? '600' : '500'} color={colors.textPrimary} noOfLines={1}>
                                  {cat.name}
                                </Text>
                                {isOthersCategory && (
                                  <Text fontSize="xs" color={colors.textMuted} ml={-1}>
                                    {othersExpanded ? '▼' : '▶'}
                                  </Text>
                                )}
                              </HStack>
                              <HStack gap={2}>
                                <Text fontSize="sm" fontWeight="600" color={colors.textPrimary}>
                                  {formatCurrency(cat.spent)}
                                </Text>
                                <Text fontSize="xs" color={colors.textMuted}>
                                  {monthlySummary.expenses > 0
                                    ? `${((cat.spent / monthlySummary.expenses) * 100).toFixed(0)}%`
                                    : '0%'
                                  }
                                </Text>
                              </HStack>
                            </Flex>
                            {/* Show breakdown when "Others" is expanded (click to toggle) */}
                            {isOthersCategory && othersExpanded && cat.otherCategories && cat.otherCategories.length > 0 && (
                              <VStack
                                align="stretch"
                                gap={0.5}
                                pl={{ base: 4, md: 6 }}
                                pr={{ base: 1, md: 2 }}
                                py={2}
                                mt={1}
                                bg={colors.rowStripedBg}
                                borderRadius="6px"
                                maxH={{ base: '120px', md: '150px' }}
                                overflowY="auto"
                              >
                                {cat.otherCategories.map((otherCat) => (
                                  <Flex
                                    key={otherCat.id}
                                    justify="space-between"
                                    align="center"
                                    px={{ base: 1, md: 2 }}
                                    py={0.5}
                                    fontSize={{ base: '11px', md: 'xs' }}
                                  >
                                    <HStack gap={1.5} flex="1" minW="0">
                                      <Box
                                        w="6px"
                                        h="6px"
                                        borderRadius="full"
                                        bg={getCategoryColor(otherCat.name)}
                                        flexShrink={0}
                                      />
                                      <Text color={colors.textSecondary} noOfLines={1} flex="1" minW="0">
                                        {otherCat.name}
                                      </Text>
                                    </HStack>
                                    <Text fontWeight="500" color={colors.textPrimary} flexShrink={0} ml={2}>
                                      {formatCurrency(otherCat.spent)}
                                    </Text>
                                  </Flex>
                                ))}
                              </VStack>
                            )}
                          </Box>
                        );
                      });
                    })()}
                  </VStack>
                </Flex>
              ) : (
                <Flex justify="center" align="center" py={12}>
                  <Text color={colors.textMuted}>No spending this month</Text>
                </Flex>
              )}
            </Box>

            {/* Cash-flow Chart */}
            <Box
              flex="1"
              p={{ base: 5, md: 6 }}
              borderRadius="16px"
              bg={colors.cardBg}
              boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)"
              border="1px solid" borderColor={colors.borderSubtle}
            >
              <Flex justify="space-between" align="center" mb={3}>
                <HStack gap={1}>
                  <Heading size={{ base: 'sm', md: 'md' }} color={colors.textPrimary} letterSpacing="-0.01em">
                    Cash-flow
                  </Heading>
                </HStack>
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
                    color={colors.textMuted}
                    _hover={{ bg: colors.rowHoverBg }}
                  >
                    ←
                  </Button>
                  <Text fontSize="xs" fontWeight="600" color={colors.textMuted} minW="120px" textAlign="center">
                    {getWeekLabel()}
                  </Text>
                  {/* Next Week Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setWeekOffset(prev => prev + 1)}
                    p={1}
                    minW="28px"
                    h="28px"
                    borderRadius="8px"
                    color={colors.textMuted}
                    _hover={{ bg: colors.rowHoverBg }}
                    disabled={weekOffset >= 0}
                    opacity={weekOffset >= 0 ? 0.3 : 1}
                    cursor={weekOffset >= 0 ? 'not-allowed' : 'pointer'}
                  >
                    →
                  </Button>
                </HStack>
              </Flex>

              {/* Net summary */}
              <Flex gap={4} mb={4} justify="center">
                <HStack gap={1}>
                  <Box w="8px" h="8px" borderRadius="full" bg="#10B981" />
                  <Text fontSize="xs" color={colors.textMuted}>Income:</Text>
                  <Text fontSize="xs" fontWeight="600" color="#059669">
                    +{formatCurrency(weeklyIncome.reduce((a, b) => a + b, 0))}
                  </Text>
                </HStack>
                <HStack gap={1}>
                  <Box w="8px" h="8px" borderRadius="full" bg="#7C3AED" />
                  <Text fontSize="xs" color={colors.textMuted}>Expenses:</Text>
                  <Text fontSize="xs" fontWeight="600" color="#7C3AED">
                    -{formatCurrency(weeklySpending.reduce((a, b) => a + b, 0))}
                  </Text>
                </HStack>
              </Flex>

              <WeeklyBarChart
                dailyExpenses={weeklySpending}
                dailyIncome={weeklyIncome}
                maxAmount={maxDailySpending}
                weekOffset={weekOffset}
                weekDates={weekDates}
                selectedDayIndex={selectedDayIndex}
                onDayClick={(index) => setSelectedDayIndex(selectedDayIndex === index ? null : index)}
              />

              {/* Transaction Details Section */}
              <Box mt={4} p={3} borderRadius="10px" bg={colors.rowStripedBg}>
                {selectedDayIndex !== null && dailyTransactions[selectedDayIndex]?.length > 0 ? (
                  <VStack align="stretch" gap={2}>
                    <Flex justify="space-between" align="center" mb={1}>
                      <Text fontSize="sm" fontWeight="600" color={colors.textPrimary}>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][selectedDayIndex]}, {weekDates[selectedDayIndex]}
                      </Text>
                      <Text fontSize="sm" fontWeight="700" color={weeklyIncome[selectedDayIndex] - weeklySpending[selectedDayIndex] >= 0 ? '#059669' : '#7C3AED'}>
                        {weeklyIncome[selectedDayIndex] - weeklySpending[selectedDayIndex] >= 0 ? '+' : ''}{formatCurrency(weeklyIncome[selectedDayIndex] - weeklySpending[selectedDayIndex])}
                      </Text>
                    </Flex>
                    <Box maxH="150px" overflowY="auto">
                      {dailyTransactions[selectedDayIndex].map((tx, idx) => (
                        <Flex
                          key={tx.id || idx}
                          justify="space-between"
                          align="center"
                          py={1.5}
                          borderBottomWidth={idx < dailyTransactions[selectedDayIndex].length - 1 ? '1px' : '0'}
                          borderColor={colors.borderColor}
                        >
                          <HStack gap={2} flex="1" minW="0">
                            <Box
                              w="6px"
                              h="6px"
                              borderRadius="full"
                              bg={tx.type === 'income' ? '#10B981' : getCategoryColor(tx.categories?.name || 'default')}
                              flexShrink={0}
                            />
                            <VStack align="start" gap={0} flex="1" minW="0">
                              <Text fontSize="xs" color={colors.textPrimary} fontWeight="600" noOfLines={1}>
                                {tx.categories?.name || 'Uncategorized'}
                              </Text>
                              <Text fontSize="10px" color={colors.textMuted} noOfLines={1}>
                                {tx.description || 'No description'}
                              </Text>
                            </VStack>
                          </HStack>
                          <Text fontSize="xs" fontWeight="600" color={tx.type === 'income' ? '#059669' : '#E11D48'} flexShrink={0} ml={2}>
                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </Text>
                        </Flex>
                      ))}
                    </Box>
                  </VStack>
                ) : (
                  <Flex justify="space-between" align="center">
                    <Text fontSize="sm" color={colors.textMuted}>
                      {selectedDayIndex !== null ? 'No transactions' : 'Click a day to see details'}
                    </Text>
                    <Text fontSize="sm" fontWeight="700" color={weeklyIncome.reduce((a, b) => a + b, 0) - weeklySpending.reduce((a, b) => a + b, 0) >= 0 ? '#059669' : '#7C3AED'}>
                      Net: {weeklyIncome.reduce((a, b) => a + b, 0) - weeklySpending.reduce((a, b) => a + b, 0) >= 0 ? '+' : ''}{formatCurrency(weeklyIncome.reduce((a, b) => a + b, 0) - weeklySpending.reduce((a, b) => a + b, 0))}
                    </Text>
                  </Flex>
                )}
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
              bg={colors.cardBg}
              boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)"
              border="1px solid" borderColor={colors.borderSubtle}
            >
              <Flex justify="space-between" align="center" mb={5}>
                <Heading size={{ base: 'sm', md: 'md' }} color={colors.textPrimary} letterSpacing="-0.01em">
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
                      <Text fontSize="sm" color={colors.textMuted}>
                        Spent <Text as="span" fontWeight="700" color={colors.textPrimary}>{formatCurrency(budgetProgress.used)}</Text>
                      </Text>
                      <Text fontSize="sm" color={colors.textMuted}>
                        of <Text as="span" fontWeight="700" color={colors.textPrimary}>{formatCurrency(budgetProgress.total)}</Text>
                      </Text>
                    </Flex>

                    {/* Custom Progress Bar */}
                    <Box h="10px" bg={colors.rowStripedBg} borderRadius="full" overflow="hidden">
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
                    bg={colors.rowStripedBg}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    mb={3}
                  >
                    <Text fontSize="xl">📊</Text>
                  </Box>
                  <Text color={colors.textMuted} mb={3} textAlign="center">No budget set for this month</Text>
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
              bg={colors.cardBg}
              boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)"
              border="1px solid" borderColor={colors.borderSubtle}
            >
              <Flex justify="space-between" align="center" mb={4}>
                <Heading size={{ base: 'sm', md: 'md' }} color={colors.textPrimary} letterSpacing="-0.01em">
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
                      borderColor={colors.borderSubtle}
                      _last={{ borderBottomWidth: 0 }}
                      _hover={{ bg: colors.rowHoverBg, mx: -3, px: 3, borderRadius: '8px' }}
                      transition="all 0.15s"
                      cursor="pointer"
                    >
                      {/* Rank */}
                      <Flex
                        w="28px"
                        h="28px"
                        borderRadius="full"
                        bg={index < 3 ? 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)' : colors.borderSubtle}
                        color={index < 3 ? 'white' : colors.textMuted}
                        align="center"
                        justify="center"
                        fontSize="xs"
                        fontWeight="700"
                        mr={3}
                        flexShrink={0}
                      >
                        {index + 1}
                      </Flex>

                      {/* Category name */}
                      <Text
                        flex="1"
                        fontWeight="500"
                        fontSize="sm"
                        color={colors.textPrimary}
                        noOfLines={1}
                      >
                        {cat.name}
                      </Text>

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
                  <Text color={colors.textMuted}>No spending this month</Text>
                </Flex>
              )}
            </Box>
          </Flex>

          {/* Monthly Daily Spending Chart */}
          <Box
            p={{ base: 5, md: 6 }}
            borderRadius="16px"
            bg={colors.cardBg}
            boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)"
            border="1px solid" borderColor={colors.borderSubtle}
          >
            <Flex justify="space-between" align="center" mb={4}>
              <Heading size={{ base: 'sm', md: 'md' }} color={colors.textPrimary} letterSpacing="-0.01em">
                Daily Spending
              </Heading>
              <Box bg={colors.rowStripedBg} px={3} py={1} borderRadius="full">
                <Text fontSize="xs" fontWeight="600" color={colors.textMuted}>
                  {formatCurrency(monthlyDailySpending.reduce((a, b) => a + b, 0))} total
                </Text>
              </Box>
            </Flex>

            {monthlyDailySpending.length > 0 ? (
              <MonthlyBarChart
                dailyData={monthlyDailySpending}
                selectedDay={selectedMonthDay}
                onDayClick={(index) => setSelectedMonthDay(selectedMonthDay === index ? null : index)}
                selectedMonth={selectedMonth}
                formatCurrency={formatCurrency}
              />
            ) : (
              <Flex justify="center" align="center" h="100px">
                <Text color={colors.textMuted}>No spending data</Text>
              </Flex>
            )}

            {/* Transaction Details Section */}
            <Box mt={3} p={3} borderRadius="10px" bg={colors.rowStripedBg}>
              {selectedMonthDay !== null && monthlyDailyTransactions[selectedMonthDay]?.length > 0 ? (
                <VStack align="stretch" gap={2}>
                  <Flex justify="space-between" align="center" mb={1}>
                    <Text fontSize="sm" fontWeight="600" color={colors.textPrimary}>
                      {new Date(selectedMonth.split('-')[0], selectedMonth.split('-')[1] - 1, selectedMonthDay + 1)
                        .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text fontSize="sm" fontWeight="700" color="#059669">
                      {formatCurrency(monthlyDailySpending[selectedMonthDay])}
                    </Text>
                  </Flex>
                  <Box maxH="120px" overflowY="auto">
                    {monthlyDailyTransactions[selectedMonthDay].map((tx, idx) => (
                      <Flex
                        key={tx.id || idx}
                        justify="space-between"
                        align="center"
                        py={1.5}
                        borderBottomWidth={idx < monthlyDailyTransactions[selectedMonthDay].length - 1 ? '1px' : '0'}
                        borderColor={colors.borderColor}
                      >
                        <HStack gap={2} flex="1" minW="0">
                          <Box
                            w="6px"
                            h="6px"
                            borderRadius="full"
                            bg={getCategoryColor(tx.categories?.name || 'default')}
                            flexShrink={0}
                          />
                          <VStack align="start" gap={0} flex="1" minW="0">
                            <Text fontSize="xs" color={colors.textPrimary} fontWeight="600" noOfLines={1}>
                              {tx.categories?.name || 'Uncategorized'}
                            </Text>
                            <Text fontSize="10px" color={colors.textMuted} noOfLines={1}>
                              {tx.description || 'No description'}
                            </Text>
                          </VStack>
                        </HStack>
                        <Text fontSize="xs" fontWeight="600" color="#E11D48" flexShrink={0} ml={2}>
                          {formatCurrency(tx.amount)}
                        </Text>
                      </Flex>
                    ))}
                  </Box>
                </VStack>
              ) : (
                <Flex justify="space-between" align="center">
                  <Text fontSize="sm" color={colors.textMuted}>
                    {selectedMonthDay !== null ? 'No transactions' : 'Click a bar to see details'}
                  </Text>
                  <Text fontSize="sm" fontWeight="600" color={colors.textPrimary}>
                    Avg: {formatCurrency(monthlyDailySpending.reduce((a, b) => a + b, 0) / monthlyDailySpending.length || 0)}/day
                  </Text>
                </Flex>
              )}
            </Box>
          </Box>

          {/* Category Budgets */}
          <Box
            p={{ base: 5, md: 6 }}
            borderRadius="16px"
            bg={colors.cardBg}
            boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)"
            border="1px solid" borderColor={colors.borderSubtle}
          >
            <Flex justify="space-between" align="center" mb={5}>
              <Heading size={{ base: 'sm', md: 'md' }} color={colors.textPrimary} letterSpacing="-0.01em">
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
                    bg={colors.rowStripedBg}
                    borderRadius="12px"
                    border="1px solid" borderColor={colors.borderSubtle}
                    _hover={{ borderColor: colors.borderStrong }}
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
                        <Text fontWeight="600" fontSize="sm" color={colors.textPrimary}>{cat.name}</Text>
                      </HStack>
                      {cat.limit > 0 && (
                        <Box
                          px={2}
                          py={0.5}
                          borderRadius="full"
                          bg={cat.percent > 100 ? colors.dangerBg : cat.percent > 80 ? colors.warningBg : colors.successBg}
                        >
                          <Text
                            fontSize="xs"
                            fontWeight="700"
                            color={cat.percent > 100 ? colors.danger : cat.percent > 80 ? colors.warning : colors.success}
                          >
                            {cat.percent.toFixed(0)}%
                          </Text>
                        </Box>
                      )}
                    </Flex>

                    <Flex justify="space-between" align="center" mb={2}>
                      <Text fontSize="sm" color={colors.textMuted}>
                        <Text as="span" fontWeight="600" color={colors.textPrimary}>{formatCurrency(cat.spent)}</Text>
                        {cat.limit > 0 ? ` of ${formatCurrency(cat.limit)}` : ' (no limit)'}
                      </Text>
                      {cat.limit > 0 && (
                        <Text
                          fontSize="xs"
                          fontWeight="600"
                          color={cat.remaining >= 0 ? colors.success : colors.danger}
                        >
                          {cat.remaining >= 0 ? `${formatCurrency(cat.remaining)} left` : `${formatCurrency(Math.abs(cat.remaining))} over`}
                        </Text>
                      )}
                    </Flex>

                    {cat.limit > 0 && (
                      <Box h="6px" bg={colors.borderColor} borderRadius="full" overflow="hidden">
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
                <Text color={colors.textMuted}>No spending this month</Text>
              </Flex>
            )}
          </Box>

          {/* Quick Actions */}
          <Flex gap={3} flexWrap="wrap">
            <Button
              as={RouterLink}
              to="/import"
              bg={colors.cardBg}
              color={colors.textPrimary}
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
              bg={colors.cardBg}
              color={colors.textPrimary}
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
              bg={colors.cardBg}
              color={colors.textPrimary}
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
              bg={colors.cardBg}
              color={colors.textPrimary}
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
