// What the Transactions page shows, worked out from the transactions in view: the totals,
// the spending as it built up over the period, and the list grouped by day.

const DAY = 86_400_000;
const pad = (value) => String(value).padStart(2, '0');
// Dates are YYYY-MM-DD and are read as local days, never through UTC.
const parse = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const amountOf = (transaction) => Number(transaction.amount) || 0;

export const today = (now = new Date()) => iso(now);

// Income, expenses and what is left of the transactions in view, and the largest expense.
export function summary(transactions) {
  let income = 0;
  let expenses = 0;
  let largest = null;
  for (const transaction of transactions) {
    if (transaction.type === 'income') {
      income += amountOf(transaction);
    } else {
      expenses += amountOf(transaction);
      if (!largest || amountOf(transaction) > amountOf(largest)) largest = transaction;
    }
  }
  return { income, expenses, net: income - expenses, count: transactions.length, largest };
}

// The period in words: "November 2026", "Nov 3 – Nov 20, 2026", "all time".
export function periodLabel(start, end) {
  const long = (date) => parse(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (!start && !end) return 'all time';
  if (!end) return `since ${long(start)}`;
  if (!start) return `until ${long(end)}`;
  const from = parse(start);
  const to = parse(end);
  const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
  const lastDay = new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate();
  if (sameMonth && from.getDate() === 1 && to.getDate() === lastDay) {
    return from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  const short = from.getFullYear() === to.getFullYear()
    ? from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : long(start);
  return `${short} – ${long(end)}`;
}

// The period cut into days, or into months when it is longer than two months. Each part
// has what came in and went out in it and what had been spent by its end. A part that has
// not begun yet has no running total: the line stops at today.
export function timeline(transactions, { start, end, now = new Date() } = {}) {
  const dates = transactions.map(({ date }) => date).sort();
  const from = start || dates[0];
  const to = end || dates.at(-1);
  if (!from || !to || from > to) return null;

  const current = today(now);
  const days = Math.round((parse(to) - parse(from)) / DAY) + 1;
  const unit = days > 62 ? 'month' : 'day';
  const buckets = [];

  if (unit === 'day') {
    for (let index = 0; index < days; index += 1) {
      const day = parse(from);
      day.setDate(day.getDate() + index);
      const key = iso(day);
      buckets.push({
        key,
        from: key,
        to: key,
        label: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        short: String(day.getDate()),
        weekend: day.getDay() === 0 || day.getDay() === 6,
      });
    }
  } else {
    const first = parse(from);
    const last = parse(to);
    for (let month = new Date(first.getFullYear(), first.getMonth(), 1); month <= last; month = new Date(month.getFullYear(), month.getMonth() + 1, 1)) {
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      buckets.push({
        key: `${month.getFullYear()}-${pad(month.getMonth() + 1)}`,
        from: iso(month),
        to: iso(monthEnd),
        label: month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        short: month.toLocaleDateString('en-US', { month: 'short' }),
        weekend: false,
      });
    }
  }

  let spent = 0;
  for (const bucket of buckets) {
    const inside = transactions.filter(({ date }) => date >= bucket.from && date <= bucket.to);
    const totals = summary(inside);
    spent += totals.expenses;
    bucket.income = totals.income;
    bucket.expenses = totals.expenses;
    bucket.count = totals.count;
    bucket.today = current >= bucket.from && current <= bucket.to;
    bucket.future = bucket.from > current;
    bucket.spentSoFar = bucket.future ? null : spent;
  }
  return { unit, buckets, total: spent };
}

// The list, newest first, cut into days. Each day has its own totals and what had been
// spent in the whole list by the end of that day.
export function groupByDay(transactions) {
  const groups = [];
  for (const transaction of transactions) {
    const last = groups.at(-1);
    if (last && last.date === transaction.date) last.items.push(transaction);
    else groups.push({ date: transaction.date, items: [transaction] });
  }
  let spent = 0;
  for (const group of [...groups].sort((a, b) => a.date.localeCompare(b.date))) {
    const totals = summary(group.items);
    spent += totals.expenses;
    Object.assign(group, { income: totals.income, expenses: totals.expenses, net: totals.net, spentSoFar: spent });
  }
  return groups;
}

// A day as a heading: "Today", "Yesterday", "Tue, Nov 24", and the year when it is not this one.
export function dayHeading(date, now = new Date()) {
  const day = parse(date);
  const difference = Math.round((parse(today(now)) - day) / DAY);
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  return day.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', ...(day.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}
