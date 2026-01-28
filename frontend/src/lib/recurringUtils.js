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
 * Adjust a date to a business day if it falls on a weekend
 * Saturday -> Friday (subtract 1 day)
 * Sunday -> Monday (add 1 day)
 * @param {Date} date - Date to adjust
 * @returns {Date} - Adjusted date (or original if already a business day)
 */
function adjustToBusinessDay(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay();

  if (dayOfWeek === 6) {
    // Saturday -> Friday
    d.setDate(d.getDate() - 1);
  } else if (dayOfWeek === 0) {
    // Sunday -> Monday
    d.setDate(d.getDate() + 1);
  }

  return d;
}

/**
 * Get the last business day (Mon-Fri) of a specific month
 * @param {number} year - Full year (e.g., 2026)
 * @param {number} month - Month (0-11, JavaScript month index)
 * @returns {Date} - Last business day of the month
 */
function getLastBusinessDayOfMonth(year, month) {
  // Get the last day of the month (day 0 of next month)
  const lastDay = new Date(year, month + 1, 0);
  const dayOfWeek = lastDay.getDay();

  // Move back from weekend to Friday
  if (dayOfWeek === 0) {
    // Sunday -> Friday (subtract 2)
    lastDay.setDate(lastDay.getDate() - 2);
  } else if (dayOfWeek === 6) {
    // Saturday -> Friday (subtract 1)
    lastDay.setDate(lastDay.getDate() - 1);
  }

  return lastDay;
}

/**
 * Parse a date string or Date object into a local-time Date at midnight
 * This avoids timezone issues where "2026-01-02" parsed as UTC becomes Jan 1 in local time
 * @param {Date|string} date - Date to parse
 * @returns {Date} - Date object in local time at midnight
 */
function parseLocalDate(date) {
  if (date instanceof Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  // For string dates like "2026-01-02", parse components to avoid UTC interpretation
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}/)) {
    const [year, month, day] = date.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  // Fallback: parse and normalize
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculate the next payment date from a given start date and frequency
 * @param {Date|string} startDate - The start date of the recurring payment
 * @param {string} frequency - One of: daily, weekly, biweekly, monthly, quarterly, yearly
 * @param {Date|string} fromDate - Calculate next date from this date (default: today)
 * @param {Date|string|null} endDate - Optional end date (null = no end)
 * @param {boolean} businessDaysOnly - If true, adjust weekend dates to nearest business day
 * @param {boolean} lastBusinessDayOfMonth - If true, always use last business day of month (overrides start day)
 * @returns {Date|null} - Next payment date or null if ended
 */
export function getNextPaymentDate(startDate, frequency, fromDate = new Date(), endDate = null, businessDaysOnly = false, lastBusinessDayOfMonth = false) {
  const start = parseLocalDate(startDate);
  const from = parseLocalDate(fromDate);
  const end = endDate ? parseLocalDate(endDate) : null;

  const config = FREQUENCY_CONFIG[frequency];
  if (!config) return null;

  // Handle "last business day of month" for month-based frequencies
  if (lastBusinessDayOfMonth && config.months) {
    // Calculate the target month based on elapsed periods
    const monthsDiff = (from.getFullYear() - start.getFullYear()) * 12 +
                       (from.getMonth() - start.getMonth());
    const periodsElapsed = Math.floor(monthsDiff / config.months);

    // Get the target year/month for the current period
    let targetYear = start.getFullYear();
    let targetMonth = start.getMonth() + periodsElapsed * config.months;

    // Normalize year/month
    targetYear += Math.floor(targetMonth / 12);
    targetMonth = targetMonth % 12;

    let nextDate = getLastBusinessDayOfMonth(targetYear, targetMonth);

    // If this date is in the past, move to next period
    if (nextDate < from) {
      targetMonth += config.months;
      targetYear += Math.floor(targetMonth / 12);
      targetMonth = targetMonth % 12;
      nextDate = getLastBusinessDayOfMonth(targetYear, targetMonth);
    }

    // Check end date
    if (end && nextDate > end) return null;

    return nextDate;
  }

  // If start date is in the future, that's the next payment
  if (start >= from) {
    if (end && start > end) return null;
    const result = new Date(start);
    return businessDaysOnly ? adjustToBusinessDay(result) : result;
  }

  let nextDate = new Date(start);

  if (config.days) {
    // Day-based frequencies (daily, weekly, biweekly)
    // Use time difference to calculate days more accurately
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysDiff = Math.floor((from.getTime() - start.getTime()) / msPerDay);
    const periodsElapsed = Math.floor(daysDiff / config.days);

    // Calculate next date by adding days to start date
    nextDate = new Date(start);
    nextDate.setDate(start.getDate() + periodsElapsed * config.days);

    // If this date is in the past, move to next period (keep today's payments)
    if (nextDate < from) {
      nextDate.setDate(nextDate.getDate() + config.days);
    }
  } else if (config.months) {
    // Month-based frequencies (monthly, quarterly, yearly)
    const monthsDiff = (from.getFullYear() - start.getFullYear()) * 12 +
                       (from.getMonth() - start.getMonth());
    const periodsElapsed = Math.floor(monthsDiff / config.months);

    // Start from the original date and add months
    // Use periodsElapsed (not +1) to check current period first
    nextDate = new Date(start);
    nextDate.setMonth(start.getMonth() + periodsElapsed * config.months);

    // If this date is in the past, move to next period
    if (nextDate < from) {
      nextDate.setMonth(nextDate.getMonth() + config.months);
    }
  }

  // Apply business day adjustment if needed
  if (businessDaysOnly) {
    nextDate = adjustToBusinessDay(nextDate);
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
 * @param {boolean} businessDaysOnly - If true, adjust weekend dates to nearest business day
 * @param {boolean} lastBusinessDayOfMonth - If true, always use last business day of month
 * @returns {Date[]} - Array of payment dates within the range
 */
export function getPaymentDatesInRange(startDate, frequency, rangeStart, rangeEnd, endDate = null, businessDaysOnly = false, lastBusinessDayOfMonth = false) {
  const dates = [];
  const start = parseLocalDate(startDate);
  const rStart = parseLocalDate(rangeStart);
  const rEnd = parseLocalDate(rangeEnd);
  rEnd.setHours(23, 59, 59, 999); // End of day for range end
  const end = endDate ? parseLocalDate(endDate) : null;

  // For lastBusinessDayOfMonth, dates are already calculated correctly, no need for post-adjustment
  const skipBusinessDayAdjustment = lastBusinessDayOfMonth;

  // IMPORTANT: Get dates WITHOUT business day adjustment first to ensure proper loop advancement.
  // If we adjust to business days inside the loop, weekend dates get pulled back to Friday,
  // but then the next iteration starts from Saturday again, causing infinite loops.
  // We collect the raw scheduled dates first, then adjust at the end.
  // Exception: lastBusinessDayOfMonth already calculates correct dates internally.
  let currentDate = getNextPaymentDate(startDate, frequency, rStart, endDate, false, lastBusinessDayOfMonth);

  // If no next date (ended), return empty
  if (!currentDate) return dates;

  // Collect all dates in range (unadjusted or already correctly adjusted for lastBusinessDayOfMonth)
  const rawDates = [];
  let lastDateKey = null;

  while (currentDate && currentDate <= rEnd) {
    if (end && currentDate > end) break;

    // Safety check: detect stuck loop (same date appearing twice)
    const currentDateKey = currentDate.toISOString().split('T')[0];
    if (currentDateKey === lastDateKey) {
      console.warn('getPaymentDatesInRange: Detected stuck loop, breaking', { startDate, frequency, currentDateKey });
      break;
    }
    lastDateKey = currentDateKey;

    rawDates.push(new Date(currentDate));

    // Get next date (from day after current date)
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    currentDate = getNextPaymentDate(startDate, frequency, nextDay, endDate, false, lastBusinessDayOfMonth);

    // Safety: prevent infinite loops (max ~1 year of daily payments)
    if (rawDates.length > 366) {
      console.warn('getPaymentDatesInRange: Hit 366 date limit, breaking', { startDate, frequency });
      break;
    }
  }

  // Now apply business day adjustment if needed, and filter to range
  // (adjustment might move dates slightly, so re-check range bounds)
  // Use a Set to deduplicate - when businessDaysOnly is true, multiple weekend dates
  // could get adjusted to the same Friday (e.g., both Sat and Sun -> Fri)
  const seenDates = new Set();

  for (const date of rawDates) {
    let finalDate = date;
    if (businessDaysOnly && !skipBusinessDayAdjustment) {
      finalDate = adjustToBusinessDay(date);
    }

    // Create a date key for deduplication (YYYY-MM-DD format)
    const dateKey = finalDate.toISOString().split('T')[0];

    // Only include if still in range after adjustment AND not already added
    if (finalDate >= rStart && finalDate <= rEnd && !seenDates.has(dateKey)) {
      seenDates.add(dateKey);
      dates.push(finalDate);
    }
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
  const today = parseLocalDate(new Date());

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
      payment.end_date,
      payment.business_days_only || false,
      payment.last_business_day_of_month || false
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
      payment.end_date,
      payment.business_days_only || false,
      payment.last_business_day_of_month || false
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
  const d = parseLocalDate(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  });
}
