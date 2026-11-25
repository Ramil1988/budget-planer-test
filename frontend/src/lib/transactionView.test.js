import test from 'node:test';
import assert from 'node:assert/strict';
import { dayHeading, groupByDay, periodLabel, summary, timeline } from './transactionView.js';

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
