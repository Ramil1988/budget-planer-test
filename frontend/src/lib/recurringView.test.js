import test from 'node:test';
import assert from 'node:assert/strict';
import { agendaDays, dueGroup, groupByDue, monthDays, withNextDue } from './recurringView.js';
import { getMonthlyProjection, getUpcomingPayments } from './recurringUtils.js';

const today = new Date(2026, 10, 24); // Tuesday, 24 November 2026
const payment = (name, overrides = {}) => ({
  id: name, name, amount: 10, type: 'expense', frequency: 'monthly', frequency_interval: 1,
  start_date: '2026-01-27', end_date: null, is_active: true, business_days_only: false, last_business_day_of_month: false, ...overrides,
});

test('each payment knows when it is next due', () => {
  const [soon, dueToday, over] = withNextDue([
    payment('Youtube'),
    payment('Bell', { start_date: '2026-01-24' }),
    payment('Old loan', { end_date: '2026-06-01' }),
  ], today);
  assert.equal(soon.daysUntil, 3);
  assert.equal(soon.nextDate.getDate(), 27);
  assert.equal(dueToday.daysUntil, 0);
  assert.equal(over.nextDate, null);
  assert.equal(over.daysUntil, null);
});

test('payments are grouped by how soon they are due', () => {
  const groups = groupByDue(withNextDue([
    payment('Mortgage', { start_date: '2026-01-07' }),
    payment('Youtube'),
    payment('Bell', { start_date: '2026-01-24' }),
    payment('Gym', { is_active: false }),
    payment('Old loan', { end_date: '2026-06-01' }),
    payment('Apple', { start_date: '2026-01-27' }),
  ], today));
  assert.deepEqual(groups.map(({ status, items }) => [status, items.map(({ name }) => name)]), [
    // Soonest first, and by name on the same day.
    ['week', ['Bell', 'Apple', 'Youtube']],
    ['later', ['Mortgage']],
    ['paused', ['Gym']],
    ['ended', ['Old loan']],
  ]);
  assert.equal(dueGroup({ is_active: true, daysUntil: 7 }), 'week');
  assert.equal(dueGroup({ is_active: true, daysUntil: 8 }), 'later');
});

test('a month is laid out day by day with what moves on each', () => {
  const projection = getMonthlyProjection([
    payment('Rent', { amount: 900, start_date: '2026-01-01' }),
    payment('Salary', { amount: 2000, type: 'income', frequency: 'biweekly', start_date: '2026-10-30' }),
    payment('Youtube', { amount: 34.82 }),
  ], '2026-11');
  const days = monthDays(projection.payments, '2026-11', today);
  assert.equal(days.length, 30);
  assert.deepEqual(days.filter(({ payments }) => payments.length).map(({ day, income, expenses }) => [day, income, expenses]), [
    [1, 0, 900],
    [13, 2000, 0],
    [27, 2000, 34.82],
  ]);
  assert.equal(days.find(({ isToday }) => isToday).day, 24);
  // 1 November 2026 is a Sunday.
  assert.equal(days[0].weekend, true);
  assert.equal(days[1].weekend, false);
  // The totals of the strip are the totals of the projection.
  assert.equal(days.reduce((sum, { expenses }) => sum + expenses, 0), projection.expenses);
  assert.equal(days.reduce((sum, { income }) => sum + income, 0), projection.income);
  assert.equal(monthDays([], '2026-12', today).some(({ isToday }) => isToday), false);
});

test('the next occurrences are grouped by day with their net', () => {
  const upcoming = [
    { ...payment('Salary', { amount: 1940, type: 'income' }), nextDate: new Date(2026, 10, 27), daysUntil: 3 },
    { ...payment('Bell', { amount: 90.4 }), nextDate: new Date(2026, 10, 24), daysUntil: 0 },
    { ...payment('Youtube', { amount: 34.82 }), nextDate: new Date(2026, 10, 27), daysUntil: 3 },
  ];
  const days = agendaDays(upcoming);
  assert.deepEqual(days.map(({ daysUntil, items, net }) => [daysUntil, items.map(({ name }) => name), Math.round(net * 100) / 100]), [
    [0, ['Bell'], -90.4],
    [3, ['Salary', 'Youtube'], 1905.18],
  ]);
  assert.deepEqual(agendaDays(getUpcomingPayments([], 30)), []);
});
