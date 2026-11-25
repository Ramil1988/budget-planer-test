import test from 'node:test';
import assert from 'node:assert/strict';
import { allocation, categoryStatus, groupCategories, monthProgress, paceSummary } from './budgetMath.js';

const money = (amount) => `$${amount.toFixed(2)}`;
const november24 = new Date(2026, 10, 24);

test('the month knows where today falls in it', () => {
  assert.deepEqual(monthProgress('2026-11', november24), { state: 'current', day: 24, daysInMonth: 30, daysLeft: 6, elapsed: 0.8 });
  assert.deepEqual(monthProgress('2026-10', november24), { state: 'past', day: 31, daysInMonth: 31, daysLeft: 0, elapsed: 1 });
  assert.deepEqual(monthProgress('2026-12', november24), { state: 'future', day: 0, daysInMonth: 31, daysLeft: 31, elapsed: 0 });
  // February of a leap year, and the year boundary.
  assert.equal(monthProgress('2028-02', november24).daysInMonth, 29);
  assert.equal(monthProgress('2027-01', november24).state, 'future');
});

test('categories are grouped by how much attention they need', () => {
  assert.equal(categoryStatus({ limit: 0, spent: 40 }), 'none');
  assert.equal(categoryStatus({ limit: 100, spent: 100.01 }), 'over');
  assert.equal(categoryStatus({ limit: 100, spent: 100 }), 'close');
  assert.equal(categoryStatus({ limit: 100, spent: 80 }), 'ok');
  const groups = groupCategories([
    { name: 'Food', limit: 200, spent: 40 },
    { name: 'Massage', limit: 30, spent: 49 },
    { name: 'Autocredit', limit: 0, spent: 0 },
    { name: 'Fuel', limit: 300, spent: 120 },
  ]);
  assert.deepEqual(groups.map(({ status, items }) => [status, items.map(({ name }) => name)]), [
    ['over', ['Massage']],
    ['ok', ['Food', 'Fuel']],
    ['none', ['Autocredit']],
  ]);
});

test('the summary compares spending with the calendar and says what is left', () => {
  const progress = monthProgress('2026-11', november24);
  const onPace = paceSummary({ limit: 7446, spent: 6013.88, scheduled: 380.1, progress, monthName: 'November', money });
  assert.equal(onPace.headline, 'On pace');
  assert.equal(onPace.tone, 'good');
  assert.equal(onPace.detail, '81% of the budget used with 80% of the month gone. $1052.02 is free after scheduled payments, about $175.34 a day for 6 days.');

  const ahead = paceSummary({ limit: 1000, spent: 950, scheduled: 0, progress, monthName: 'November', money });
  assert.equal(ahead.headline, '$150.00 ahead of pace');
  assert.equal(ahead.tone, 'warn');

  const under = paceSummary({ limit: 1000, spent: 500, scheduled: 0, progress, monthName: 'November', money });
  assert.equal(under.headline, '$300.00 under pace');

  // What is left does not cover the payments that are still due.
  const squeezed = paceSummary({ limit: 1000, spent: 800, scheduled: 300, progress, monthName: 'November', money });
  assert.equal(squeezed.tone, 'warn');
  assert.match(squeezed.detail, /Scheduled payments need \$300\.00, which is \$100\.00 more than what is left\./);

  const over = paceSummary({ limit: 1000, spent: 1200, scheduled: 50, progress, monthName: 'November', money });
  assert.deepEqual(over, { tone: 'bad', headline: 'Over budget by $200.00', detail: '6 days left, and $50.00 more is scheduled.' });
});

test('past, future and unplanned months get their own summary', () => {
  const past = monthProgress('2026-10', november24);
  assert.equal(paceSummary({ limit: 1000, spent: 900, progress: past, monthName: 'October', money }).headline, 'October closed $100.00 under budget');
  assert.equal(paceSummary({ limit: 1000, spent: 1100, progress: past, monthName: 'October', money }).tone, 'bad');
  const future = monthProgress('2026-12', november24);
  assert.equal(paceSummary({ limit: 1000, spent: 0, scheduled: 420, progress: future, monthName: 'December', money }).detail, '$420.00 is already scheduled in recurring payments.');
  assert.equal(paceSummary({ limit: 0, spent: 12, progress: past, monthName: 'October', money }).headline, 'No limits set for this month');
  // The last day of the month still divides by one day, not by zero.
  const lastDay = monthProgress('2026-11', new Date(2026, 10, 30));
  assert.match(paceSummary({ limit: 1000, spent: 990, progress: lastDay, monthName: 'November', money }).detail, /about \$10\.00 a day for 1 day\./);
});

test('the plan is shown as its largest parts and the rest', () => {
  const categories = ['A', 'B', 'C', 'D'].map((name) => ({ id: name, name }));
  const limits = { A: 50, B: 30, C: 20, D: '' };
  assert.deepEqual(allocation(categories, limits).map(({ name, share }) => [name, share]), [['A', 0.5], ['B', 0.3], ['C', 0.2]]);
  const many = allocation(categories, { A: 40, B: 30, C: 20, D: 10 }, 3);
  assert.deepEqual(many.map(({ name, amount }) => [name, amount]), [['A', 40], ['B', 30], ['2 more', 30]]);
  assert.deepEqual(allocation(categories, {}), []);
});
