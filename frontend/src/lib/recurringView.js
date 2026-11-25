// What the Recurring page shows, worked out from the payments: when each is next due,
// how they group by urgency, and what moves on each day of a month.
import { getNextPaymentDate, parseLocalDate } from './recurringUtils.js';

const DAY = 86_400_000;

// Each payment with the date it is next due and the whole days until then.
export function withNextDue(payments, today = new Date()) {
  const from = parseLocalDate(today);
  return payments.map((payment) => {
    const nextDate = getNextPaymentDate(
      payment.start_date, payment.frequency, from, payment.end_date,
      payment.business_days_only || false, payment.last_business_day_of_month || false, payment.frequency_interval,
    );
    return { ...payment, nextDate, daysUntil: nextDate ? Math.round((parseLocalDate(nextDate) - from) / DAY) : null };
  });
}

const GROUPS = ['week', 'later', 'paused', 'ended'];

// 'week' is due within seven days; 'ended' is active but has no date left.
export function dueGroup(payment) {
  if (!payment.is_active) return 'paused';
  if (payment.daysUntil == null) return 'ended';
  return payment.daysUntil <= 7 ? 'week' : 'later';
}

// Payments in the order they come due, as non-empty groups. Takes the output of withNextDue.
export function groupByDue(payments) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const byDate = (a, b) => a.daysUntil - b.daysUntil || byName(a, b);
  return GROUPS
    .map((status) => ({
      status,
      items: payments.filter((payment) => dueGroup(payment) === status).sort(status === 'week' || status === 'later' ? byDate : byName),
    }))
    .filter((group) => group.items.length > 0);
}

// Every day of 'YYYY-MM' with the income and expenses that fall on it. `payments` are the
// occurrences of getMonthlyProjection: one entry per payment per date.
export function monthDays(payments, month, today = new Date()) {
  const [year, monthNumber] = month.split('-').map(Number);
  const count = new Date(year, monthNumber, 0).getDate();
  const now = parseLocalDate(today);
  const days = Array.from({ length: count }, (_, index) => {
    const date = new Date(year, monthNumber - 1, index + 1);
    return {
      day: index + 1,
      date,
      weekend: date.getDay() === 0 || date.getDay() === 6,
      isToday: +date === +now,
      income: 0,
      expenses: 0,
      payments: [],
    };
  });
  for (const payment of payments) {
    const date = parseLocalDate(payment.date);
    // A weekday adjustment can move a payment just outside its month; it still belongs to it.
    const inMonth = date.getFullYear() === year && date.getMonth() === monthNumber - 1;
    const slot = days[inMonth ? date.getDate() - 1 : date < days[0].date ? 0 : count - 1];
    slot.payments.push(payment);
    slot[payment.type === 'income' ? 'income' : 'expenses'] += Number(payment.amount);
  }
  return days;
}

// The next occurrences grouped by day, with what each day adds up to.
// Takes the output of getUpcomingPayments.
export function agendaDays(upcoming) {
  const days = new Map();
  for (const payment of upcoming) {
    const key = +parseLocalDate(payment.nextDate);
    if (!days.has(key)) days.set(key, { date: parseLocalDate(payment.nextDate), daysUntil: payment.daysUntil, items: [], net: 0 });
    const day = days.get(key);
    day.items.push(payment);
    day.net += (payment.type === 'income' ? 1 : -1) * Number(payment.amount);
  }
  return [...days.values()].sort((a, b) => a.date - b.date);
}
