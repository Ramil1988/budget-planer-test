/**
 * Utility functions for calculating recurring payment dates and projections
 */

/**
 * Frequency configuration with days/months and display labels
 */
export const FREQUENCY_CONFIG = {
  daily: { days: 1, label: 'Daily' },
  weekly: { days: 7, label: 'Weekly' },
  biweekly: { days: 14, label: 'Biweekly' },
  monthly: { months: 1, label: 'Monthly' },
  quarterly: { months: 3, label: 'Quarterly' },
  yearly: { months: 12, label: 'Yearly' },
};

/**
 * Calculate the next payment date from a given start date and frequency
 * @param {Date|string} startDate - The start date of the recurring payment
 * @param {string} frequency - One of: daily, weekly, biweekly, monthly, quarterly, yearly
 * @param {Date|string} fromDate - Calculate next date from this date (default: today)
 * @param {Date|string|null} endDate - Optional end date (null = no end)
 * @returns {Date|null} - Next payment date or null if ended
 */
export function getNextPaymentDate(startDate, frequency, fromDate = new Date(), endDate = null) {
  const start = new Date(startDate);
  const from = new Date(fromDate);
  const end = endDate ? new Date(endDate) : null;

  // Normalize to start of day
  start.setHours(0, 0, 0, 0);
  from.setHours(0, 0, 0, 0);

  // If start date is in the future, that's the next payment
  if (start >= from) {
    if (end && start > end) return null;
    return start;
  }

  const config = FREQUENCY_CONFIG[frequency];
  if (!config) return null;

  let nextDate = new Date(start);

  if (config.days) {
    // Day-based frequencies (daily, weekly, biweekly)
    const daysDiff = Math.floor((from - start) / (1000 * 60 * 60 * 24));
    const periodsElapsed = Math.floor(daysDiff / config.days);
    nextDate.setDate(start.getDate() + (periodsElapsed + 1) * config.days);
  } else if (config.months) {
    // Month-based frequencies (monthly, quarterly, yearly)
    const monthsDiff = (from.getFullYear() - start.getFullYear()) * 12 +
                       (from.getMonth() - start.getMonth());
    const periodsElapsed = Math.floor(monthsDiff / config.months);

    // Start from the original date and add months
    nextDate = new Date(start);
    const targetMonths = (periodsElapsed + 1) * config.months;
    nextDate.setMonth(start.getMonth() + targetMonths);

    // If this date is still in the past or today, add one more period
    if (nextDate <= from) {
      nextDate.setMonth(nextDate.getMonth() + config.months);
    }
  }

  // Check end date
  if (end && nextDate > end) return null;

  return nextDate;
}

/**
 * Get all payment dates within a date range
 * @param {Date|string} startDate - Recurring payment start date
 * @param {string} frequency - Payment frequency
 * @param {Date|string} rangeStart - Start of range to check
 * @param {Date|string} rangeEnd - End of range to check
 * @param {Date|string|null} endDate - Optional recurring payment end date
 * @returns {Date[]} - Array of payment dates within the range
 */
export function getPaymentDatesInRange(startDate, frequency, rangeStart, rangeEnd, endDate = null) {
  const dates = [];
  const start = new Date(startDate);
  const rStart = new Date(rangeStart);
  const rEnd = new Date(rangeEnd);
  const end = endDate ? new Date(endDate) : null;

  // Normalize times
  start.setHours(0, 0, 0, 0);
  rStart.setHours(0, 0, 0, 0);
  rEnd.setHours(23, 59, 59, 999);

  // Get first payment date that could be in range
  let currentDate = getNextPaymentDate(startDate, frequency, rStart, endDate);

  // If no next date (ended), return empty
  if (!currentDate) return dates;

  // Collect all dates in range
  while (currentDate && currentDate <= rEnd) {
    if (end && currentDate > end) break;
    dates.push(new Date(currentDate));

    // Get next date (from day after current)
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    currentDate = getNextPaymentDate(startDate, frequency, nextDay, endDate);

    // Safety: prevent infinite loops
    if (dates.length > 366) break;
  }

  return dates;
}

/**
 * Get upcoming payments for a list of recurring payments
 * @param {Array} recurringPayments - Array of recurring payment objects
 * @param {number} daysAhead - Number of days to look ahead (default: 30)
 * @returns {Array} - Array of upcoming payment objects with dates
 */
export function getUpcomingPayments(recurringPayments, daysAhead = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endRange = new Date(today);
  endRange.setDate(endRange.getDate() + daysAhead);

  const upcoming = [];

  for (const payment of recurringPayments) {
    if (!payment.is_active) continue;

    const dates = getPaymentDatesInRange(
      payment.start_date,
      payment.frequency,
      today,
      endRange,
      payment.end_date
    );

    for (const date of dates) {
      upcoming.push({
        ...payment,
        nextDate: date,
        daysUntil: Math.ceil((date - today) / (1000 * 60 * 60 * 24)),
      });
    }
  }

  // Sort by date
  upcoming.sort((a, b) => a.nextDate - b.nextDate);

  return upcoming;
}

/**
 * Calculate monthly projection totals
 * @param {Array} recurringPayments - Array of recurring payment objects
 * @param {string} month - Month in 'YYYY-MM' format
 * @returns {Object} - { income, expenses, net, payments }
 */
export function getMonthlyProjection(recurringPayments, month) {
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0); // Last day of month

  let income = 0;
  let expenses = 0;
  const payments = [];

  for (const payment of recurringPayments) {
    if (!payment.is_active) continue;

    const dates = getPaymentDatesInRange(
      payment.start_date,
      payment.frequency,
      startDate,
      endDate,
      payment.end_date
    );

    for (const date of dates) {
      const amount = Number(payment.amount);
      if (payment.type === 'income') {
        income += amount;
      } else {
        expenses += amount;
      }

      payments.push({
        ...payment,
        date,
      });
    }
  }

  return {
    income,
    expenses,
    net: income - expenses,
    payments: payments.sort((a, b) => a.date - b.date),
  };
}

/**
 * Format frequency for display
 * @param {string} frequency - Frequency key
 * @returns {string} - Human-readable label
 */
export function formatFrequency(frequency) {
  return FREQUENCY_CONFIG[frequency]?.label || frequency;
}

/**
 * Format a date for display
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  });
}
