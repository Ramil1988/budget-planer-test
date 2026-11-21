import { useState, useEffect, useRef } from 'react';
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
  IconButton,
  Input,
  SimpleGrid,
} from '@chakra-ui/react';
import {
  FiArrowDownLeft,
  FiArrowUpRight,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiList,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import DashboardSpending from '../components/DashboardSpending';
import { getUpcomingPayments, formatFrequency, getPaymentDatesInRange, getPaymentsUntilSalary } from '../lib/recurringUtils';
import { useDarkModeColors } from '../lib/useDarkModeColors';
import '../styles/dashboard.css';

// Category color mapping for visual distinction
const categoryColors = new Map(Object.entries({
  'Mortgage': '#6366F1',
  'Food/Costco': '#F59E0B',
  'Food': '#F59E0B',
  'Subscriptions': '#8B5CF6',
  'Mobile/Internet': '#3B82F6',
  'Electricity': '#EF4444',
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
}));

const getCategoryColor = (name) => categoryColors.get(name) ?? categoryColors.get('default');

const customSpendingColors = [
  '#4059C7', '#C77918', '#168373', '#A344B8', '#CC5144', '#247CA8',
  '#71851F', '#BE487B', '#7652B4', '#97623A', '#268990', '#25834D',
];

function getCustomSpendingColors(categories) {
  // Use the full category list so monthly totals and chart order do not change a category's color.
  const customCategories = categories
    .filter(({ name }) => !categoryColors.has(name))
    .sort((a, b) => a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id)));

  return new Map(customCategories.map(({ id }, index) => {
    const color = customSpendingColors[index] ?? `hsl(${(index * 137.508) % 360} 58% 45%)`;
    return [String(id), color];
  }));
}

const formatMonthValue = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

function MonthlySummary({ summary, budget, daysLeft, formatCurrency }) {
  const budgetPercent = Math.round(budget.percent);
  const cappedPercent = Math.max(0, Math.min(100, budget.percent));

  return (
    <section className="dashboard-ledger" aria-label="Monthly summary">
      <dl className="dashboard-ledger__figures">
        <div className="dashboard-figure dashboard-figure--balance">
          <dt>Net Balance</dt>
          <dd data-negative={summary.net < 0}>{formatCurrency(summary.net)}</dd>
        </div>
        <div className="dashboard-figure">
          <dt><FiArrowDownLeft aria-hidden="true" color="var(--dashboard-positive)" /> Income</dt>
          <dd>{formatCurrency(summary.income)}</dd>
        </div>
        <div className="dashboard-figure">
          <dt><FiArrowUpRight aria-hidden="true" color="var(--dashboard-negative)" /> Expenses</dt>
          <dd>{formatCurrency(summary.expenses)}</dd>
        </div>
      </dl>
      {(budget.total > 0 || daysLeft > 0) && (
        <div className="dashboard-ledger-meta">
          {budget.total > 0 && (
            <div className="dashboard-budget">
              <span>Monthly budget</span>
              <div
                className="dashboard-budget-meter"
                role="progressbar"
                aria-label="Monthly budget used"
                aria-valuenow={Math.round(cappedPercent)}
                aria-valuetext={`${budgetPercent}% used`}
                data-over-budget={budget.percent > 100}
              >
                <span style={{ width: `${cappedPercent}%` }} />
              </div>
              <strong>{formatCurrency(budget.used)} / {formatCurrency(budget.total)}</strong>
            </div>
          )}
          {daysLeft > 0 && <span>{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left this month</span>}
        </div>
      )}
    </section>
  );
}

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
      <Flex align="center" justify="space-between" h={`${barHeight * 2 + 60}px`} gap={{ base: 0.5, sm: 2 }}>
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
              minW="0"
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
                  fontSize={{ base: "8px", sm: "10px" }}
                  maxW="100%"
                  truncate
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
                px={{ base: 0.5, sm: 1 }}
                w="100%"
                borderRadius="6px"
                bg={isSelected ? colors.rowHoverBg : 'transparent'}
                border={isToday ? '2px solid #2563EB' : isSelected ? '1px solid' : 'none'}
                borderColor={isSelected ? colors.borderColor : 'transparent'}
              >
                <Text
                  fontSize={{ base: "10px", sm: "xs" }}
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
                  fontSize={{ base: "8px", sm: "10px" }}
                  maxW="100%"
                  truncate
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
  const barHeight = 120;
  const maxAmount = Math.max(...dailyData, 1);
  const [year, month] = selectedMonth.split('-').map(Number);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
  const todayDate = isCurrentMonth ? today.getDate() : -1;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
        <Flex gap={1} minW={`${dailyData.length * 36}px`} align="flex-end" h={`${barHeight + 50}px`}>
          {dailyData.map((amount, index) => {
            const dayNum = index + 1;
            const heightPercent = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
            const isToday = dayNum === todayDate;
            const isSelected = selectedDay === index;
            const hasSpending = amount > 0;
            // Get day of week for this date
            const dayOfWeek = new Date(year, month - 1, dayNum).getDay();
            const dayName = dayNames[dayOfWeek];

            return (
              <VStack
                key={dayNum}
                gap={0.5}
                flex="1"
                minW="32px"
                align="center"
                cursor={hasSpending ? 'pointer' : 'default'}
                onClick={() => hasSpending && onDayClick(index)}
                opacity={selectedDay !== null && !isSelected ? 0.4 : 1}
                transition="opacity 0.2s"
              >
                <Box
                  w="100%"
                  maxW="28px"
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
                <VStack gap={0} spacing={0}>
                  <Text
                    fontSize={{ base: '11px', md: '13px' }}
                    fontWeight={isToday || isSelected ? '700' : '600'}
                    color={isToday ? colors.primary : isSelected ? colors.textPrimary : colors.textSecondary}
                  >
                    {dayNum}
                  </Text>
                  <Text
                    fontSize={{ base: '9px', md: '11px' }}
                    fontWeight="500"
                    color={isToday ? colors.primary : colors.textMuted}
                  >
                    {dayName}
                  </Text>
                </VStack>
              </VStack>
            );
          })}
        </Flex>
      </Box>
    </Box>
  );
};

// Mini Calendar Component for Upcoming Payments
const MiniCalendar = ({ recurringPayments, onDayClick, selectedDate, viewMonth, viewYear, onMonthChange }) => {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

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
      payment.end_date,
      payment.business_days_only || false,
      payment.last_business_day_of_month || false,
      payment.frequency_interval
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
      onMonthChange(11, viewYear - 1);
    } else {
      onMonthChange(viewMonth - 1, viewYear);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      onMonthChange(0, viewYear + 1);
    } else {
      onMonthChange(viewMonth + 1, viewYear);
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
          aria-label="Previous payment calendar month"
          color="var(--dashboard-muted)"
          _hover={{ bg: 'var(--dashboard-hover)' }}
          p={1}
          minW={{ base: '44px', md: '32px' }}
          h={{ base: '44px', md: '32px' }}
        >
          <FiChevronLeft />
        </Button>
        <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="600" color="var(--dashboard-ink)">
          {monthNames[viewMonth]} {viewYear}
        </Text>
        <Button
          size="xs"
          variant="ghost"
          onClick={goToNextMonth}
          aria-label="Next payment calendar month"
          color="var(--dashboard-muted)"
          _hover={{ bg: 'var(--dashboard-hover)' }}
          p={1}
          minW={{ base: '44px', md: '32px' }}
          h={{ base: '44px', md: '32px' }}
        >
          <FiChevronRight />
        </Button>
      </Flex>

      {/* Day headers */}
      <SimpleGrid columns={7} gap={{ base: 0, md: 1 }} mb={1}>
        {dayNames.map((day, idx) => (
          <Box key={day} textAlign="center" py={{ base: 1, md: 2 }}>
            <Text fontSize={{ base: '10px', md: 'xs' }} fontWeight="600" color="var(--dashboard-muted)">
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

          const cellDate = new Date(viewYear, viewMonth, item.day);
          const isPast = item.isCurrentMonth && cellDate < todayStart;

          const selectable = hasPayments && item.isCurrentMonth;
          const selected = selectable && isSelected(item.day);
          const currentDay = item.isCurrentMonth && isToday(item.day);
          const label = cellDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
          const normalBackground = selectable && !isPast ? 'var(--dashboard-muted-surface)' : 'transparent';
          const background = currentDay ? 'var(--dashboard-calendar-today)' : normalBackground;
          const outline = currentDay ? 'inset 0 0 0 2px var(--dashboard-accent)' : 'inset 0 0 0 1px var(--dashboard-accent)';
          const dateColor = currentDay
            ? 'var(--dashboard-accent)'
            : (isPast || !item.isCurrentMonth) && !selected
              ? 'var(--dashboard-calendar-muted)'
              : 'var(--dashboard-ink)';

          return (
            <Box
              as={selectable ? 'button' : 'div'}
              key={index}
              type={selectable ? 'button' : undefined}
              aria-label={selectable ? `${label}, ${item.payments.length} ${item.payments.length === 1 ? 'payment' : 'payments'}` : undefined}
              aria-pressed={selectable ? Boolean(selected) : undefined}
              aria-current={currentDay ? 'date' : undefined}
              textAlign="center"
              py={1.5}
              minH={{ base: '40px', md: '34px' }}
              position="relative"
              cursor={selectable ? 'pointer' : 'default'}
              onClick={selectable ? () => onDayClick(cellDate, item.payments) : undefined}
              borderRadius="6px"
              bg={selected ? 'var(--dashboard-hover)' : background}
              boxShadow={currentDay || selected ? outline : undefined}
              _hover={selectable ? { bg: 'var(--dashboard-hover)' } : undefined}
              _focusVisible={{ outline: '2px solid var(--dashboard-accent)', outlineOffset: '2px' }}
            >
              <Text
                as="span"
                display="block"
                fontSize="xs"
                fontWeight={currentDay || (selectable && !isPast) ? '700' : '500'}
                color={dateColor}
                mb={1}
              >
                {item.day}
              </Text>
              {/* Payment indicators */}
              {item.isCurrentMonth && hasPayments && (
                <Flex as="span" justify="center" gap={0.5} position="absolute" bottom={{ base: '2px', md: '4px' }} left="0" right="0">
                  {hasExpense && (
                    <Box as="span" w={{ base: '4px', md: '6px' }} h={{ base: '4px', md: '6px' }} borderRadius="full" bg="var(--dashboard-negative)" />
                  )}
                  {hasIncome && (
                    <Box as="span" w={{ base: '4px', md: '6px' }} h={{ base: '4px', md: '6px' }} borderRadius="full" bg="var(--dashboard-positive)" />
                  )}
                </Flex>
              )}
            </Box>
          );
        })}
      </SimpleGrid>

      {/* Legend */}
      <Flex justify="center" gap={{ base: 3, md: 4 }} mt={{ base: 2, md: 3 }} pt={2} borderTop="1px solid var(--dashboard-border)">
        <HStack gap={1}>
          <Box w={{ base: '5px', md: '6px' }} h={{ base: '5px', md: '6px' }} borderRadius="full" bg="var(--dashboard-negative)" />
          <Text fontSize={{ base: '9px', md: '10px' }} color="var(--dashboard-muted)">Expense</Text>
        </HStack>
        <HStack gap={1}>
          <Box w={{ base: '5px', md: '6px' }} h={{ base: '5px', md: '6px' }} borderRadius="full" bg="var(--dashboard-positive)" />
          <Text fontSize={{ base: '9px', md: '10px' }} color="var(--dashboard-muted)">Income</Text>
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

  const [selectedMonth, setSelectedMonth] = useState(() => formatMonthValue(new Date()));

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
  const [monthlyDailySpending, setMonthlyDailySpending] = useState([]); // Daily spending for entire month
  const [selectedMonthDay, setSelectedMonthDay] = useState(null); // Selected day in monthly chart
  const [monthlyDailyTransactions, setMonthlyDailyTransactions] = useState([]); // Transactions by day for month
  const [upcomingPayments, setUpcomingPayments] = useState([]); // Upcoming recurring payments
  const [allRecurringPayments, setAllRecurringPayments] = useState([]); // All recurring payments for calendar
  const [paymentsViewMode, setPaymentsViewMode] = useState('calendar'); // 'list' or 'calendar'
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null); // Selected date in calendar
  const [selectedCalendarPayments, setSelectedCalendarPayments] = useState([]); // Payments for selected date
  const [calendarViewMonth, setCalendarViewMonth] = useState(new Date().getMonth()); // Calendar displayed month (0-11)
  const [calendarViewYear, setCalendarViewYear] = useState(new Date().getFullYear()); // Calendar displayed year

  // Sync calendar view when the month picker changes
  useEffect(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    setCalendarViewMonth(month - 1); // convert 1-indexed to 0-indexed
    setCalendarViewYear(year);
    setSelectedCalendarDate(null);
    setSelectedCalendarPayments([]);
  }, [selectedMonth]);

  // Refs for chart click-away
  const dailySpendingRef = useRef(null);
  const cashFlowRef = useRef(null);

  // Click-away listener to deselect Daily Spending chart
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dailySpendingRef.current && !dailySpendingRef.current.contains(event.target)) {
        setSelectedMonthDay(null);
      }
    };

    if (selectedMonthDay !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedMonthDay]);

  // Click-away listener to deselect Cash-flow chart
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (cashFlowRef.current && !cashFlowRef.current.contains(event.target)) {
        setSelectedDayIndex(null);
      }
    };

    if (selectedDayIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedDayIndex]);

  useEffect(() => {
    if (!user) return;

    let stale = false;
    loadDashboardData(() => stale);
    return () => { stale = true; };
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

  const loadDashboardData = async (isStale) => {
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

      if (isStale()) return;
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

      const spendingColors = getCustomSpendingColors(categories);
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
            color: spendingColors.get(catId) ?? getCategoryColor(categoryNameMap[catId]),
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

      if (isStale()) return;
      if (!recurringResult.error && recurringResult.data) {
        // Store all recurring payments for calendar view
        setAllRecurringPayments(recurringResult.data);
        // Filter active ones for upcoming list
        const activePayments = recurringResult.data.filter(p => p.is_active);
        // Ensure we cover at least the rest of the current month for the "left" calculation
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const daysUntilEndOfMonth = Math.ceil((endOfMonth - now) / (1000 * 60 * 60 * 24));
        const daysAhead = Math.max(daysUntilEndOfMonth + 1, 14);
        const upcoming = getUpcomingPayments(activePayments, daysAhead);
        setUpcomingPayments(upcoming);
      }

    } catch (err) {
      if (isStale()) return;
      setError('Failed to load dashboard: ' + err.message);
      console.error('Dashboard error:', err);
    } finally {
      if (!isStale()) setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const changeMonth = (step) => {
    setSelectedMonth(previousMonth => {
      const [year, month] = previousMonth.split('-').map(Number);
      return formatMonthValue(new Date(year, month - 1 + step, 1));
    });
  };

  return (
    <Box className="dashboard-page">
      <Box className="dashboard-layout">
        <header className="dashboard-masthead">
          <Heading as="h1" className="dashboard-title">Dashboard</Heading>

          <div className="dashboard-toolbar">
            <div className="dashboard-month-control">
              <IconButton
                variant="ghost"
                aria-label="Previous dashboard month"
                onClick={() => changeMonth(-1)}
                minW="36px"
                h="40px"
                color="var(--dashboard-muted)"
                _hover={{ bg: 'var(--dashboard-hover)' }}
              >
                <FiChevronLeft />
              </IconButton>
              <Input
                type="month"
                aria-label="Dashboard month"
                value={selectedMonth}
                onChange={(event) => {
                  if (event.target.value) setSelectedMonth(event.target.value);
                }}
                variant="flushed"
                w="166px"
                minW="0"
                px={2}
                h="40px"
                color="var(--dashboard-ink)"
                border="0"
                fontSize="sm"
                fontWeight="600"
                css={{ colorScheme: 'light', '.dark &': { colorScheme: 'dark' } }}
                _focusVisible={{ outline: '2px solid', outlineColor: 'var(--dashboard-accent)', outlineOffset: '-2px', boxShadow: 'none' }}
              />
              <IconButton
                variant="ghost"
                aria-label="Next dashboard month"
                onClick={() => changeMonth(1)}
                minW="36px"
                h="40px"
                color="var(--dashboard-muted)"
                _hover={{ bg: 'var(--dashboard-hover)' }}
              >
                <FiChevronRight />
              </IconButton>
            </div>
          </div>
        </header>

        {loading ? (
          <Flex minH="35vh" align="center" justify="center" role="status">
            <HStack gap={3} color={colors.textSecondary}>
              <Spinner size="sm" color="currentColor" />
              <Text fontSize="sm">Loading your dashboard…</Text>
            </HStack>
          </Flex>
        ) : error ? (
          <Box role="alert" p={4} bg={colors.dangerBg} borderRadius="12px" borderLeft="4px solid" borderColor={colors.danger}>
            <Text color={colors.danger} fontSize="sm" fontWeight="500">{error}</Text>
          </Box>
        ) : (
          <>
            <MonthlySummary
              summary={monthlySummary}
              budget={budgetProgress}
              daysLeft={daysLeft}
              formatCurrency={formatCurrency}
            />

            <div className="dashboard-insights">
              <Box as="section" className="dashboard-panel" aria-labelledby="dashboard-payments-heading">
                <Box mb={4}>
                  <div className="dashboard-panel-heading">
                    <Heading as="h2" id="dashboard-payments-heading">Upcoming Payments</Heading>
                    <HStack gap={1}>
                      <HStack bg="var(--dashboard-muted-surface)" borderRadius="8px" p="2px" gap={0}>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setPaymentsViewMode('list');
                            setSelectedCalendarDate(null);
                            setSelectedCalendarPayments([]);
                          }}
                          aria-label="Payment list"
                          aria-pressed={paymentsViewMode === 'list'}
                          bg={paymentsViewMode === 'list' ? 'var(--dashboard-paper)' : 'transparent'}
                          color={paymentsViewMode === 'list' ? 'var(--dashboard-ink)' : 'var(--dashboard-muted)'}
                          borderRadius="8px"
                          px={2}
                          minW={{ base: '44px', md: '28px' }}
                          h={{ base: '44px', md: '28px' }}
                          fontWeight="500"
                          fontSize="xs"
                          boxShadow={paymentsViewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'}
                          _hover={{ bg: paymentsViewMode === 'list' ? 'var(--dashboard-paper)' : 'var(--dashboard-hover)' }}
                        >
                          <FiList aria-hidden="true" />
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setPaymentsViewMode('calendar')}
                          aria-label="Payment calendar"
                          aria-pressed={paymentsViewMode === 'calendar'}
                          bg={paymentsViewMode === 'calendar' ? 'var(--dashboard-paper)' : 'transparent'}
                          color={paymentsViewMode === 'calendar' ? 'var(--dashboard-ink)' : 'var(--dashboard-muted)'}
                          borderRadius="8px"
                          px={2}
                          minW={{ base: '44px', md: '28px' }}
                          h={{ base: '44px', md: '28px' }}
                          fontWeight="500"
                          fontSize="xs"
                          boxShadow={paymentsViewMode === 'calendar' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'}
                          _hover={{ bg: paymentsViewMode === 'calendar' ? 'var(--dashboard-paper)' : 'var(--dashboard-hover)' }}
                        >
                          <FiCalendar aria-hidden="true" />
                        </Button>
                      </HStack>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        color="var(--dashboard-accent)"
                        fontWeight="600"
                        minH={{ base: '44px', md: '36px' }}
                        _hover={{ bg: 'var(--dashboard-hover)' }}
                      >
                        <RouterLink to="/recurring">Manage <FiArrowUpRight aria-hidden="true" /></RouterLink>
                      </Button>
                    </HStack>
                  </div>
                  {(() => {
                      const now = new Date();
                      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                      const listMode = paymentsViewMode === 'list';
                      const shownMonth = listMode ? now.getMonth() : calendarViewMonth;
                      const shownYear = listMode ? now.getFullYear() : calendarViewYear;
                      const isCurrentMonth = shownMonth === now.getMonth() && shownYear === now.getFullYear();
                      const isPastMonth = shownYear < now.getFullYear() ||
                        (shownYear === now.getFullYear() && shownMonth < now.getMonth());

                      // Don't show "left" for past months
                      if (isPastMonth) return null;

                      // Calculate payments for the displayed month
                      const monthStart = new Date(shownYear, shownMonth, 1);
                      const monthEnd = new Date(shownYear, shownMonth + 1, 0);

                      let total = 0;
                      allRecurringPayments.forEach(payment => {
                        if (!payment.is_active || payment.type !== 'expense') return;
                        const dates = getPaymentDatesInRange(
                          payment.start_date,
                          payment.frequency,
                          monthStart,
                          monthEnd,
                          payment.end_date,
                          payment.business_days_only || false,
                          payment.last_business_day_of_month || false,
                          payment.frequency_interval
                        );
                        dates.forEach(date => {
                          // For current month, only count dates >= today
                          // For future months, count all dates
                          if (!isCurrentMonth || date >= today) {
                            total += Number(payment.amount);
                          }
                        });
                      });

                      const salaryPlan = isCurrentMonth ? getPaymentsUntilSalary(allRecurringPayments, today) : null;
                      const daysUntilSalary = salaryPlan?.daysUntilSalary ?? null;
                      const untilSalary = salaryPlan?.totalCents == null ? null : salaryPlan.totalCents / 100;

                      if (total === 0 && daysUntilSalary === null) return null;
                      return (
                        <Flex wrap="wrap" gap={2} mt={2}>
                          {total > 0 && (
                            <Text bg="var(--dashboard-muted-surface)" color="var(--dashboard-muted)" px={2.5} py={1} borderRadius="6px" fontSize="xs" fontWeight="600">
                              {formatCurrency(total)} left this month
                            </Text>
                          )}
                          {daysUntilSalary !== null && (
                            <Text bg="var(--dashboard-muted-surface)" color="var(--dashboard-accent)" px={2.5} py={1} borderRadius="6px" fontSize="xs" fontWeight="600">
                              {untilSalary > 0
                                ? `${formatCurrency(untilSalary)} before salary`
                                : daysUntilSalary === 1
                                  ? 'Salary tomorrow'
                                  : `Salary in ${daysUntilSalary} days`
                              }
                            </Text>
                          )}
                        </Flex>
                      );
                    })()}
                </Box>

                {paymentsViewMode === 'list' ? (
                  <>
                    <Box as="ul" listStyle="none" m={0} p={0}>
                      {upcomingPayments.slice(0, 5).map((payment, index) => (
                        <li className="dashboard-payment-line" key={`${payment.id}-${index}`}>
                          <time className="dashboard-payment-date" dateTime={`${formatMonthValue(payment.nextDate)}-${String(payment.nextDate.getDate()).padStart(2, '0')}`}>
                            <strong>{payment.nextDate.getDate()}</strong>
                            <span>{payment.nextDate.toLocaleDateString('en-US', { month: 'short' })}</span>
                          </time>
                          <Box minW="0">
                            <Text fontWeight="700" fontSize="sm" lineClamp={2} color="var(--dashboard-ink)" overflowWrap="anywhere">
                              {payment.name}
                            </Text>
                            <Text fontSize="xs" color="var(--dashboard-muted)" truncate>
                              {payment.categories?.name || 'Uncategorized'} · {formatFrequency(payment.frequency, payment.frequency_interval)}
                            </Text>
                          </Box>
                          <div className="dashboard-payment-total">
                            <Text fontWeight="700" fontSize="sm" color={payment.type === 'expense' ? 'var(--dashboard-ink)' : 'var(--dashboard-positive)'}>
                              {payment.type === 'expense' ? '−' : '+'}{formatCurrency(payment.amount)}
                            </Text>
                            <Text fontSize="xs" color={payment.daysUntil === 0 ? 'var(--dashboard-negative)' : 'var(--dashboard-muted)'}>
                              {payment.daysUntil === 0 ? 'Today' : payment.daysUntil === 1 ? 'Tomorrow' : `In ${payment.daysUntil} days`}
                            </Text>
                          </div>
                        </li>
                      ))}
                    </Box>

                    {upcomingPayments.length > 5 && (
                      <Text fontSize="xs" color={colors.textMuted} textAlign="center" mt={3}>
                        +{upcomingPayments.length - 5} more upcoming payments
                      </Text>
                    )}
                    {upcomingPayments.length === 0 && (
                      <Text fontSize="sm" color={colors.textMuted} textAlign="center" py={4}>
                        No upcoming payments
                      </Text>
                    )}
                  </>
                ) : (
                  <Box
                    display="grid"
                    gridTemplateColumns={{ base: 'minmax(0, 1fr)', lg: 'minmax(0, 7fr) minmax(0, 3fr)' }}
                    gap={{ base: 3, lg: 5 }}
                  >
                    <Box minW="0">
                      <MiniCalendar
                        recurringPayments={allRecurringPayments}
                        onDayClick={(date, payments) => {
                          setSelectedCalendarDate(date);
                          setSelectedCalendarPayments(payments);
                        }}
                        selectedDate={selectedCalendarDate}
                        viewMonth={calendarViewMonth}
                        viewYear={calendarViewYear}
                        onMonthChange={(month, year) => {
                          setCalendarViewMonth(month);
                          setCalendarViewYear(year);
                          setSelectedCalendarDate(null);
                          setSelectedCalendarPayments([]);
                        }}
                      />
                    </Box>

                    <Box
                      as="aside"
                      aria-label="Selected day details"
                      aria-live="polite"
                      minW="0"
                      borderTop={{ base: '1px solid var(--dashboard-border)', lg: 'none' }}
                      borderInlineStart={{ base: 'none', lg: '1px solid var(--dashboard-border)' }}
                      pt={{ base: 2.5, lg: 0 }}
                      ps={{ base: 0, lg: 5 }}
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
                              <HStack gap={2} minW="0">
                                <Box
                                  w={{ base: '6px', md: '8px' }}
                                  h={{ base: '6px', md: '8px' }}
                                  borderRadius="full"
                                  bg={getCategoryColor(payment.categories?.name)}
                                />
                                <Box minW="0">
                                  <Text fontSize="xs" fontWeight="500" color={colors.textPrimary}
                                    overflowWrap="anywhere" lineClamp={{ base: 2, lg: 1 }}>
                                    {payment.name}
                                  </Text>
                                  {payment.categories?.name && (
                                    <Text fontSize={{ base: '10px', md: '11px' }} color={colors.textMuted} truncate>
                                      {payment.categories.name}
                                    </Text>
                                  )}
                                </Box>
                              </HStack>
                              <Text
                                fontSize={{ base: '11px', md: 'xs' }}
                                fontWeight="600"
                                flexShrink={0}
                                maxW="50%"
                                overflowWrap="anywhere"
                                textAlign="end"
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
                        <Flex align="center" justify="center" h={{ base: 'auto', lg: '100%' }}>
                          <Text fontSize="xs" textAlign="center" color="var(--dashboard-muted)">
                            Select a marked day to see its payments
                          </Text>
                        </Flex>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>

              <DashboardSpending
                key={selectedMonth}
                categories={categoryBudgets}
                total={monthlySummary.expenses}
                formatCurrency={formatCurrency}
              />
            </div>

            <div className="dashboard-activity">
              {/* Cash-flow Chart */}
              <Box
                ref={cashFlowRef}
                as="section"
                className="dashboard-panel"
                aria-labelledby="dashboard-cashflow-heading"
              >
                <Box className="dashboard-panel-heading" mb={3}>
                  <Heading as="h2" id="dashboard-cashflow-heading">Cash-flow</Heading>
                  <HStack gap={2}>
                    {/* Previous Week Button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Previous cash-flow week"
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
                      aria-label="Next cash-flow week"
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
                </Box>

                {/* Net summary */}
                <Flex gap={{ base: 2, sm: 4 }} mb={4} justify="center" wrap="wrap">
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
                      <Box maxH="150px" overflowY="auto" pr={3}>
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
              <Box
                ref={dailySpendingRef}
                as="section"
                className="dashboard-panel"
                aria-labelledby="dashboard-daily-spending-heading"
              >
                <Box className="dashboard-panel-heading" mb={4}>
                  <Heading as="h2" id="dashboard-daily-spending-heading">Daily Spending</Heading>
                  <Box bg={colors.rowStripedBg} px={3} py={1} borderRadius="full">
                    <Text fontSize="xs" fontWeight="600" color={colors.textMuted}>
                      {formatCurrency(monthlyDailySpending.reduce((a, b) => a + b, 0))} total
                    </Text>
                  </Box>
                </Box>

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
                <Box mt={3} p={{ base: 3, md: 4 }} borderRadius="10px" bg={colors.rowStripedBg}>
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
                      <Box maxH="120px" overflowY="auto" pr={2}>
                        {monthlyDailyTransactions[selectedMonthDay].map((tx, idx) => (
                          <Flex
                            key={tx.id || idx}
                            justify="space-between"
                            align="center"
                            py={1.5}
                            pr={2}
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
                            <Text fontSize="xs" fontWeight="600" color="#E11D48" flexShrink={0} ml={3}>
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
                        Avg: {(() => {
                          const [year, month] = selectedMonth.split('-').map(Number);
                          const today = new Date();
                          const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
                          const daysElapsed = isCurrentMonth ? today.getDate() : monthlyDailySpending.length;
                          const total = monthlyDailySpending.reduce((a, b) => a + b, 0);
                          return formatCurrency(daysElapsed > 0 ? total / daysElapsed : 0);
                        })()}/day
                      </Text>
                    </Flex>
                  )}
                </Box>
              </Box>
            </div>

            <nav aria-label="Dashboard shortcuts" className="dashboard-links">
              {[
                ['/import', 'Import Transactions'],
                ['/budget', 'Manage Budget'],
                ['/transactions', 'All Transactions'],
                ['/categories', 'Categories'],
              ].map(([to, label]) => (
                <RouterLink key={to} to={to}>{label} <FiArrowUpRight aria-hidden="true" /></RouterLink>
              ))}
            </nav>
          </>
        )}
      </Box>
    </Box>
  );
}
