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
const amountOf = (transaction) => transaction.type === 'expense' ? Math.abs(transaction.amount) || 0 : Number(transaction.amount) || 0;

export const today = (now = new Date()) => iso(now);

// ---- Filters -------------------------------------------------------------------------------
// One object holds every filter, and one function applies them all. Nothing is "applied"
// by a button: what the object says is what the list shows.

export const PERIODS = [
  ['this-month', 'This month'],
  ['last-month', 'Last month'],
  ['last-3-months', 'Last 3 months'],
  ['this-year', 'This year'],
  ['all', 'All time'],
  ['custom', 'Custom range'],
];

// `category` and `bank` hold an id or a name, or 'none' for transactions that have neither.
export const NO_FILTERS = { query: '', period: 'this-month', from: '', to: '', type: '', category: '', bank: '', min: '', max: '' };

export function transactionCategoryUrl(categoryId, from, to) {
  return `/transactions?${new URLSearchParams({ category: categoryId, type: 'expense', from, to })}`;
}

export function transactionFiltersFromSearch(search) {
  const params = new URLSearchParams(search);
  const category = params.get('category');
  const type = params.get('type');
  const from = params.get('from');
  const to = params.get('to');
  const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && iso(parse(value)) === value;
  if (!category || type !== 'expense' || !isDate(from) || !isDate(to) || from > to) return NO_FILTERS;
  return { ...NO_FILTERS, category, type, period: 'custom', from, to };
}

// The first and the last day a period covers; an empty string is an open end.
export function periodRange({ period, from, to }, now = new Date()) {
  const month = (offset) => new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const endOf = (first) => iso(new Date(first.getFullYear(), first.getMonth() + 1, 0));
  switch (period) {
    case 'this-month': return [iso(month(0)), endOf(month(0))];
    case 'last-month': return [iso(month(-1)), endOf(month(-1))];
    case 'last-3-months': return [iso(month(-2)), endOf(month(0))];
    case 'this-year': return [`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`];
    case 'custom': return from && to && from > to ? [to, from] : [from || '', to || ''];
    default: return ['', ''];
  }
}

// What is typed into the search box is looked for in the description, the category and the
// bank; a number is also looked for in the amount ("34", "34.00", "$1,918").
function matches(transaction, query) {
  const text = [transaction.description, transaction.category, transaction.bank].filter(Boolean).join('\n').toLowerCase();
  if (text.includes(query)) return true;
  const digits = query.replace(/[$,\s]/g, '');
  return /^\d+\.?\d*$/.test(digits) && amountOf(transaction).toFixed(2).includes(digits);
}

export function applyFilters(transactions, filters, now = new Date()) {
  const [start, end] = periodRange(filters, now);
  const query = filters.query.trim().toLowerCase();
  const min = filters.min === '' ? NaN : parseFloat(filters.min);
  const max = filters.max === '' ? NaN : parseFloat(filters.max);
  return transactions.filter((transaction) => {
    const amount = amountOf(transaction);
    if (start && transaction.date < start) return false;
    if (end && transaction.date > end) return false;
    if (filters.type && transaction.type !== filters.type) return false;
    if (filters.category && (filters.category === 'none' ? transaction.category_id : transaction.category_id !== filters.category)) return false;
    if (filters.bank && (filters.bank === 'none' ? transaction.bank : transaction.bank !== filters.bank)) return false;
    if (!Number.isNaN(min) && amount < min) return false;
    if (!Number.isNaN(max) && amount > max) return false;
    return !query || matches(transaction, query);
  });
}

// How many filters narrow the list beyond the period.
export function narrowedBy(filters) {
  return [filters.query.trim(), filters.type, filters.category, filters.bank, filters.min !== '' || filters.max !== ''].filter(Boolean).length;
}

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
  let received = 0;
  for (const bucket of buckets) {
    const inside = transactions.filter(({ date }) => date >= bucket.from && date <= bucket.to);
    const totals = summary(inside);
    spent += totals.expenses;
    received += totals.income;
    bucket.income = totals.income;
    bucket.expenses = totals.expenses;
    bucket.count = totals.count;
    bucket.today = current >= bucket.from && current <= bucket.to;
    bucket.future = bucket.from > current;
    bucket.spentSoFar = bucket.future ? null : spent;
    bucket.incomeSoFar = bucket.future ? null : received;
  }
  return { unit, buckets, total: spent, received };
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
