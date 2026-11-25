// What the Assets & Liabilities page shows, worked out from the records: the balance sheet
// drawn to scale, the health score and how it is reached, the emergency cushion, when each
// debt is paid off, and the net worth over time.
import { getPaymentsPerYear } from './recurringUtils.js';

const number = (value) => parseFloat(value) || 0;
const sum = (list, pick) => list.reduce((total, item) => total + number(pick(item)), 0);

// Asset categories that can be turned into money in an emergency, and those that are invested.
// An RRSP counts as liquid at the value it is recorded with, so it is meant to be recorded
// at what would be left after the tax on taking it out.
const LIQUID = ['Cash', 'Savings Account', 'TFSA', 'RRSP'];
const INVESTED = ['RRSP', 'TFSA', 'Investment'];

// A snapshot keeps the lists it was taken from as JSON; older ones may hold a string.
export function snapshotRows(breakdown) {
  if (Array.isArray(breakdown)) return breakdown;
  if (typeof breakdown !== 'string') return [];
  try {
    const rows = JSON.parse(breakdown);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

// Assets by category, largest first, each with its share of all assets.
export function assetGroups(assets, categories) {
  const total = sum(assets, ({ amount }) => amount);
  const groups = new Map();
  for (const asset of assets) {
    const category = categories.find(({ id }) => id === asset.category_id);
    const name = category?.name || 'Other';
    if (!groups.has(name)) groups.set(name, { name, amount: 0, items: [] });
    const group = groups.get(name);
    group.amount += number(asset.amount);
    group.items.push(asset);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      share: total > 0 ? group.amount / total : 0,
      items: [...group.items].sort((a, b) => number(b.amount) - number(a.amount)),
    }))
    .sort((a, b) => b.amount - a.amount);
}

// The totals the page leads with, and the sums the health score is made of.
export function measures(assets, liabilities, categories, types) {
  const inCategories = (names) => sum(
    assets.filter((asset) => names.includes(categories.find(({ id }) => id === asset.category_id)?.name)),
    ({ amount }) => amount,
  );
  const mortgages = sum(
    liabilities.filter((liability) => types.find(({ id }) => id === liability.type_id)?.name === 'Mortgage'),
    ({ outstanding_balance }) => outstanding_balance,
  );
  return {
    liquid: inCategories(LIQUID),
    investments: inCategories(INVESTED),
    homeEquity: inCategories(['Real Estate']) - mortgages,
  };
}

// Two bars on one scale: what is owned, by category, and under it what is owed, by debt,
// with what is left over. Every segment carries its part of the scale, 0 to 1.
export function balanceSheet(groups, liabilities, totalAssets, totalLiabilities) {
  const scale = Math.max(totalAssets, totalLiabilities);
  if (scale <= 0) return null;
  const owed = [...liabilities]
    .map((liability) => ({ name: liability.creditor || 'Debt', amount: number(liability.outstanding_balance) }))
    .filter(({ amount }) => amount > 0)
    .sort((a, b) => b.amount - a.amount);
  // Totals taken from a snapshot may not match today's lists; the bars follow the totals.
  const listed = sum(owed, ({ amount }) => amount);
  const debts = listed > 0 && Math.abs(listed - totalLiabilities) < 0.5
    ? owed
    : totalLiabilities > 0 ? [{ name: 'All debts', amount: totalLiabilities }] : [];
  const net = totalAssets - totalLiabilities;
  const categories = Math.abs(sum(groups, ({ amount }) => amount) - totalAssets) < 0.5
    ? groups
    : totalAssets > 0 ? [{ name: 'All assets', amount: totalAssets }] : [];
  return {
    owned: categories.map(({ name, amount }) => ({ name, amount, part: amount / scale, share: totalAssets > 0 ? amount / totalAssets : 0 })),
    owed: debts.map(({ name, amount }) => ({ name, amount, part: amount / scale, share: totalAssets > 0 ? amount / totalAssets : 0 })),
    yours: net > 0 ? { amount: net, part: net / scale, share: net / totalAssets } : null,
    // Debts beyond everything that is owned.
    short: net < 0 ? -net : 0,
    ownedPart: totalAssets / scale,
  };
}

const short = (amount) => {
  const size = Math.abs(amount);
  if (size >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
};

// The health score, 0 to 100, as three parts that measure three different things: how much
// of what is owned is borrowed (40), how long the savings would last (30) and how much is
// invested (30). Each part says what it measures, the sum behind it, and what would raise it.
export function healthScore({ totalAssets, totalLiabilities, liquid, investments, monthlyExpenses }) {
  const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 1;
  const debtPercent = totalAssets > 0 ? debtRatio * 100 : 0;
  const months = monthlyExpenses > 0 ? liquid / monthlyExpenses : 0;
  const invested = totalAssets > 0 ? investments / totalAssets : 0;

  const debtPoints = Math.min(40, Math.max(0, Math.round(40 * (1 - debtRatio))));
  const fundPoints = Math.min(30, Math.round(months * 5));
  const investPoints = Math.min(30, Math.round(invested * 150));

  const parts = [
    {
      label: 'Debt against assets',
      points: debtPoints,
      max: 40,
      what: 'How much of what you own is yours and not borrowed.',
      sum: `${short(totalLiabilities)} ÷ ${short(totalAssets)} = ${debtPercent.toFixed(1)}% borrowed`,
      scoring: `40 × (1 − ${debtPercent.toFixed(1)}%) = ${debtPoints} points`,
      tip: debtRatio > 0.5 ? 'Paying debt down raises this part.' : 'Most of what you own is yours.',
    },
    {
      label: 'Emergency fund',
      points: fundPoints,
      max: 30,
      what: 'How many months of spending your cash, savings, TFSA and RRSP would cover. Record an RRSP at what you would keep after tax.',
      sum: `${short(liquid)} ÷ ${short(monthlyExpenses)} a month = ${months.toFixed(1)} months`,
      scoring: `${months.toFixed(1)} months × 5 = ${fundPoints} points, 30 at six months`,
      tip: months >= EMERGENCY_TARGET ? 'Six months are covered.' : 'Six months of spending within reach gives full marks.',
    },
    {
      label: 'Investments',
      points: investPoints,
      max: 30,
      what: 'How much of what you own is invested to grow: RRSP, TFSA and investments.',
      sum: `${short(investments)} ÷ ${short(totalAssets)} = ${(invested * 100).toFixed(1)}% of what you own`,
      scoring: `${(invested * 100).toFixed(1)}% × 1.5 = ${investPoints} points, 30 at 20%`,
      tip: invested >= 0.2 ? 'A strong share is invested.' : 'Investing a fifth of what you own gives full marks.',
    },
  ];
  const score = parts.reduce((total, part) => total + part.points, 0);
  // The name and the colour change at the same scores.
  const level = score >= 80 ? ['Excellent', 'good'] : score >= 60 ? ['Good', 'good'] : score >= 40 ? ['Fair', 'caution'] : ['Needs work', 'bad'];
  return { score, label: level[0], tone: level[1], parts };
}

// Months of spending the savings should cover: the upper end of the usual three to six.
const EMERGENCY_TARGET = 6;

// How long the savings would last, against the target.
export function emergencyFund(liquid, monthlyExpenses) {
  const months = monthlyExpenses > 0 ? liquid / monthlyExpenses : 0;
  const status = months >= EMERGENCY_TARGET ? ['Excellent', 'good'] : months >= 3 ? ['Good', 'good'] : months >= 1 ? ['Building', 'caution'] : ['Critical', 'bad'];
  return { months, target: EMERGENCY_TARGET, progress: Math.min(months / EMERGENCY_TARGET, 1), label: status[0], tone: status[1] };
}

// When a debt is paid off at its current payment. Follows the schedule of the recurring
// payment linked to it, when there is one; otherwise the payment is taken as monthly.
export function payoff(liability, linkedRecurring, today = new Date()) {
  const balanceNow = number(liability.outstanding_balance);
  const monthly = number(liability.monthly_payment);
  if (monthly <= 0 || balanceNow <= 0) return { known: false };

  const frequency = linkedRecurring?.frequency || 'monthly';
  const interval = linkedRecurring?.frequency_interval ?? 1;
  const periods = getPaymentsPerYear(frequency, interval);
  const payment = linkedRecurring?.amount ? number(linkedRecurring.amount) : monthly;
  const rate = number(liability.interest_rate) / 100 / periods;

  let balance = balanceNow;
  let count = 0;
  let interest = 0;
  while (balance > 0.01 && count < periods * 50) {
    const charged = balance * rate;
    interest += charged;
    if (charged >= payment) return { known: true, never: true };
    balance = balance + charged - payment;
    count += 1;
  }

  const months = Math.round((count / periods) * 12);
  const date = new Date(today);
  date.setMonth(date.getMonth() + months);
  return {
    known: true,
    never: false,
    months,
    years: Math.floor(months / 12),
    remainingMonths: months % 12,
    date,
    interest,
    principal: balanceNow,
    payment,
    frequency,
    interval,
    scheduled: frequency !== 'monthly' || interval > 1,
  };
}

// How much of a debt is already paid, when its starting balance is known.
export function paidOff(liability) {
  const original = number(liability.original_balance);
  const outstanding = number(liability.outstanding_balance);
  if (original <= 0 || outstanding >= original) return null;
  return { paid: original - outstanding, original, share: (original - outstanding) / original };
}

// The payments of a debt's linked category made since the debt started: an older debt
// can share the category.
export function liabilityPayments(liability, paymentsByCategory) {
  if (!liability.linked_category_id) return null;
  const payments = paymentsByCategory[liability.linked_category_id];
  if (!payments) return null;
  if (!liability.start_date) return payments;
  return payments.filter((payment) => payment.date >= liability.start_date);
}

const DAY = 86_400_000;
const dayOf = (date) => new Date(`${date}T00:00:00`).getTime();

// Net worth over time: the snapshots oldest first, placed by date across the width and by
// value up the height, both 0 to 100. Zero is always inside the range.
export function trend(snapshots) {
  const ordered = [...snapshots].sort((a, b) => a.record_date.localeCompare(b.record_date));
  if (ordered.length === 0) return null;
  const values = ordered.map(({ equity }) => number(equity));
  const high = Math.max(0, ...values);
  const low = Math.min(0, ...values);
  const span = high - low || 1;
  const first = dayOf(ordered[0].record_date);
  const days = (dayOf(ordered.at(-1).record_date) - first) / DAY;
  const points = ordered.map((snapshot, index) => ({
    id: snapshot.id,
    date: snapshot.record_date,
    equity: values[index],
    assets: number(snapshot.total_assets),
    liabilities: number(snapshot.total_liabilities),
    x: days > 0 ? ((dayOf(snapshot.record_date) - first) / DAY / days) * 100 : 50,
    y: ((high - values[index]) / span) * 100,
  }));
  return { points, zero: (high / span) * 100, change: values.at(-1) - values[0] };
}

// A date as written on the page: "Nov 24, 2026".
export const formatDay = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// A number as typed into an amount field: 320000 reads "320 000".
export function spaced(value) {
  if (value === '' || value === 0) return '';
  const parts = String(value).replace(/\s/g, '').split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return parts.join('.');
}
