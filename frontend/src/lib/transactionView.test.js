import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_FILTERS, applyFilters, dayHeading, groupByDay, narrowedBy, periodLabel, periodRange, summary, timeline } from './transactionView.js';

const now = new Date(2026, 10, 24); // Tuesday, 24 November 2026
const tx = (id, date, amount, type = 'expense') => ({ id, date, amount, type });
// Newest first, as the page holds them.
const november = [
  tx('f', '2026-11-24', 18.07),
  tx('e', '2026-11-24', 40.09),
  tx('d', '2026-11-21', 359.99),
  tx('c', '2026-11-20', 1918.07, 'income'),
  tx('b', '2026-11-05', 2720.26),
  tx('a', '2026-11-02', 50),
];

test('the totals of what is in view', () => {
  const totals = summary(november);
  assert.equal(totals.count, 6);
  assert.equal(totals.income, 1918.07);
  assert.ok(Math.abs(totals.expenses - 3188.41) < 1e-9);
  assert.ok(Math.abs(totals.net - (1918.07 - 3188.41)) < 1e-9);
  assert.equal(totals.largest.id, 'b');
  assert.deepEqual(summary([]), { income: 0, expenses: 0, net: 0, count: 0, largest: null });
  assert.equal(summary([tx('x', '2026-11-01', 10, 'income')]).largest, null);
});

test('a period is named the way it would be said', () => {
  assert.equal(periodLabel('2026-11-01', '2026-11-30'), 'November 2026');
  assert.equal(periodLabel('2026-02-01', '2026-02-28'), 'February 2026');
  assert.equal(periodLabel('2026-11-03', '2026-11-20'), 'Nov 3 – Nov 20, 2026');
  assert.equal(periodLabel('2025-12-15', '2026-01-15'), 'Dec 15, 2025 – Jan 15, 2026');
  assert.equal(periodLabel('', ''), 'all time');
  assert.equal(periodLabel('2026-11-03', ''), 'since Nov 3, 2026');
  assert.equal(periodLabel('', '2026-11-20'), 'until Nov 20, 2026');
});

test('a month is cut into its days, and the line stops at today', () => {
  const line = timeline(november, { start: '2026-11-01', end: '2026-11-30', now });
  assert.equal(line.unit, 'day');
  assert.equal(line.buckets.length, 30);
  const day = (number) => line.buckets[number - 1];
  assert.deepEqual([day(1).short, day(1).weekend, day(2).weekend], ['1', true, false]);
  assert.equal(day(1).spentSoFar, 0);
  assert.equal(day(2).spentSoFar, 50);
  assert.equal(day(4).spentSoFar, 50);
  assert.equal(day(5).spentSoFar, 2770.26);
  assert.deepEqual([day(20).income, day(20).expenses, day(20).count], [1918.07, 0, 1]);
  assert.ok(Math.abs(day(24).spentSoFar - 3188.41) < 1e-9);
  assert.deepEqual([day(24).today, day(24).future, day(25).today, day(25).future], [true, false, false, true]);
  assert.equal(day(25).spentSoFar, null);
  assert.equal(day(24).count, 2);
});

test('without dates the period runs from the first transaction to the last', () => {
  const line = timeline(november, { now });
  assert.equal(line.buckets[0].key, '2026-11-02');
  assert.equal(line.buckets.at(-1).key, '2026-11-24');
  assert.equal(line.buckets.length, 23);
  assert.equal(timeline([], { now }), null);
  // A month with nothing in it still has its days.
  assert.equal(timeline([], { start: '2026-11-01', end: '2026-11-30', now }).buckets.length, 30);
});

test('a period longer than two months is cut into months', () => {
  const year = [tx('c', '2026-11-05', 300), tx('b', '2026-08-31', 200), tx('a', '2026-08-01', 100), tx('z', '2026-06-15', 50, 'income')];
  const line = timeline(year, { now });
  assert.equal(line.unit, 'month');
  assert.deepEqual(line.buckets.map(({ key }) => key), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  assert.deepEqual(line.buckets.map(({ spentSoFar }) => spentSoFar), [0, 0, 300, 300, 300, 600]);
  assert.deepEqual([line.buckets[2].from, line.buckets[2].to, line.buckets[2].short], ['2026-08-01', '2026-08-31', 'Aug']);
  assert.equal(line.buckets[0].income, 50);
  assert.equal(line.buckets.at(-1).today, true);
  assert.equal(line.total, 600);
});

test('the list is cut into days, each with what had been spent by its end', () => {
  const groups = groupByDay(november);
  assert.deepEqual(groups.map(({ date }) => date), ['2026-11-24', '2026-11-21', '2026-11-20', '2026-11-05', '2026-11-02']);
  assert.deepEqual(groups[0].items.map(({ id }) => id), ['f', 'e']);
  assert.ok(Math.abs(groups[0].expenses - 58.16) < 1e-9);
  assert.ok(Math.abs(groups[0].spentSoFar - 3188.41) < 1e-9);
  // An income day leaves what was spent where it was, and its net is positive.
  assert.equal(groups[2].net, 1918.07);
  assert.equal(groups[2].spentSoFar, groups[3].spentSoFar);
  assert.equal(groups.at(-1).spentSoFar, 50);
  assert.deepEqual(groupByDay([]), []);
});

test('a day is headed by how far back it is', () => {
  assert.equal(dayHeading('2026-11-24', now), 'Today');
  assert.equal(dayHeading('2026-11-23', now), 'Yesterday');
  assert.equal(dayHeading('2026-11-21', now), 'Sat, Nov 21');
  assert.equal(dayHeading('2025-12-31', now), 'Wed, Dec 31, 2025');
});

const ledger = [
  { id: 1, date: '2026-11-24', amount: 18.07, type: 'expense', description: 'AMAZON', category: 'Subscriptions', category_id: 'subs', bank: 'Rogers' },
  { id: 2, date: '2026-11-21', amount: 359.99, type: 'expense', description: 'Costco Wholesale', category: 'Food/Costco', category_id: 'costco', bank: null },
  { id: 3, date: '2026-11-20', amount: 1918.07, type: 'income', description: 'Payroll', category: 'Salary', category_id: 'salary', bank: 'Scotiabank' },
  { id: 4, date: '2026-10-31', amount: 34, type: 'expense', description: 'COSTCO GAS W1362', category: 'Fuel', category_id: 'fuel', bank: 'Rogers' },
  { id: 5, date: '2026-09-02', amount: 2720.26, type: 'expense', description: 'Mortgage Meridian', category: 'Mortgage', category_id: 'mortgage', bank: 'Scotiabank' },
  { id: 6, date: '2025-12-30', amount: 12, type: 'expense', description: 'Coffee', category: 'Unknown', category_id: null, bank: null },
];
const ids = (filters) => applyFilters(ledger, { ...NO_FILTERS, ...filters }, now).map(({ id }) => id);

test('a period names its first and last day', () => {
  const range = (period, extra = {}) => periodRange({ period, from: '', to: '', ...extra }, now);
  assert.deepEqual(range('this-month'), ['2026-11-01', '2026-11-30']);
  assert.deepEqual(range('last-month'), ['2026-10-01', '2026-10-31']);
  assert.deepEqual(range('last-3-months'), ['2026-09-01', '2026-11-30']);
  assert.deepEqual(range('this-year'), ['2026-01-01', '2026-12-31']);
  assert.deepEqual(range('all'), ['', '']);
  assert.deepEqual(range('custom', { from: '2026-11-03', to: '2026-11-20' }), ['2026-11-03', '2026-11-20']);
  // One end may be left open, and ends typed the wrong way round are swapped.
  assert.deepEqual(range('custom', { from: '2026-11-03' }), ['2026-11-03', '']);
  assert.deepEqual(range('custom', { from: '2026-11-20', to: '2026-11-03' }), ['2026-11-03', '2026-11-20']);
  // January looks back into the year before.
  assert.deepEqual(periodRange({ period: 'last-month' }, new Date(2026, 0, 15)), ['2025-12-01', '2025-12-31']);
});

test('with nothing set the list is this month', () => {
  assert.deepEqual(ids({}), [1, 2, 3]);
  assert.deepEqual(ids({ period: 'last-month' }), [4]);
  assert.deepEqual(ids({ period: 'last-3-months' }), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids({ period: 'this-year' }), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids({ period: 'all' }), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(ids({ period: 'custom', from: '2026-10-01', to: '2026-11-20' }), [3, 4]);
  assert.deepEqual(ids({ period: 'custom', to: '2026-01-01' }), [6]);
});

test('every filter narrows what the others leave', () => {
  const all = { period: 'all' };
  assert.deepEqual(ids({ ...all, type: 'income' }), [3]);
  assert.deepEqual(ids({ ...all, category: 'fuel' }), [4]);
  assert.deepEqual(ids({ ...all, category: 'none' }), [6]);
  assert.deepEqual(ids({ ...all, bank: 'Rogers' }), [1, 4]);
  assert.deepEqual(ids({ ...all, bank: 'none' }), [2, 6]);
  assert.deepEqual(ids({ ...all, min: '300' }), [2, 3, 5]);
  assert.deepEqual(ids({ ...all, min: '300', max: '2000' }), [2, 3]);
  assert.deepEqual(ids({ ...all, max: '20' }), [1, 6]);
  assert.deepEqual(ids({ ...all, type: 'expense', bank: 'Scotiabank', min: '100' }), [5]);
  // A filter that nothing passes leaves nothing; it is not ignored.
  assert.deepEqual(ids({ ...all, type: 'income', category: 'fuel' }), []);
});

test('the search looks in the description, the category, the bank and the amount', () => {
  const all = { period: 'all' };
  assert.deepEqual(ids({ ...all, query: 'costco' }), [2, 4]);
  assert.deepEqual(ids({ ...all, query: '  COSTCO  ' }), [2, 4]);
  assert.deepEqual(ids({ ...all, query: 'salary' }), [3]);
  assert.deepEqual(ids({ ...all, query: 'rogers' }), [1, 4]);
  assert.deepEqual(ids({ ...all, query: '2720' }), [5]);
  assert.deepEqual(ids({ ...all, query: '$1,918' }), [3]);
  assert.deepEqual(ids({ ...all, query: '34.00' }), [4]);
  // "1362" is in a description; as a number it is in no amount, and that is still a match.
  assert.deepEqual(ids({ ...all, query: '1362' }), [4]);
  assert.deepEqual(ids({ ...all, query: 'nothing like this' }), []);
});

test('the filters that narrow the list are counted, the period is not', () => {
  assert.equal(narrowedBy(NO_FILTERS), 0);
  assert.equal(narrowedBy({ ...NO_FILTERS, period: 'all' }), 0);
  assert.equal(narrowedBy({ ...NO_FILTERS, query: ' ' }), 0);
  assert.equal(narrowedBy({ ...NO_FILTERS, query: 'x', type: 'expense', category: 'fuel', bank: 'none', min: '5' }), 5);
  assert.equal(narrowedBy({ ...NO_FILTERS, min: '5', max: '9' }), 1);
});
