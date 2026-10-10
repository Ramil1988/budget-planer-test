import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNextPaymentDate, getPaymentDatesInRange, getUpcomingPayments,
  getMonthlyProjection, formatFrequency, getMonthlyEquivalent,
  getPaymentsPerYear, isValidFrequencyInterval,
} from './recurringUtils.js';
import { generateDueRecurringTransactions } from './recurringAutoAdd.js';

const key = date => date && [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const water = {
  id: 'water', name: 'Water', amount: 114, type: 'expense', is_active: true,
  frequency: 'monthly', frequency_interval: 2, start_date: '2026-01-30',
};

test('water every two months keeps the start month as its anchor', () => {
  assert.deepEqual(getPaymentDatesInRange(water.start_date, 'monthly', '2026-01-01', '2026-12-31', null, false, false, 2).map(key),
    ['2026-01-30', '2026-03-30', '2026-05-30', '2026-07-30', '2026-09-30', '2026-11-30']);
  assert.equal(key(getNextPaymentDate(water.start_date, 'monthly', '2026-02-01', null, false, false, 2)), '2026-03-30');
  assert.equal(key(getNextPaymentDate(water.start_date, 'monthly', '2026-03-30', null, false, false, 2)), '2026-03-30');
});

test('projections charge the full bill only in scheduled months', () => {
  assert.equal(getMonthlyProjection([water], '2026-02').expenses, 0);
  assert.equal(getMonthlyProjection([water], '2026-03').expenses, 114);
  assert.equal(getMonthlyProjection([{ ...water, is_active: false }], '2026-03').expenses, 0);
  assert.equal(getMonthlyProjection([{ ...water, type: 'income' }], '2026-03').income, 114);
  assert.equal(getMonthlyEquivalent(114, 'monthly', 2), 57);
});

test('short months clamp without permanently losing the original day', () => {
  assert.deepEqual(getPaymentDatesInRange('2026-12-31', 'monthly', '2026-12-01', '2027-06-30', null, false, false, 2).map(key),
    ['2026-12-31', '2027-02-28', '2027-04-30', '2027-06-30']);
  assert.deepEqual(getPaymentDatesInRange('2026-01-31', 'monthly', '2026-01-01', '2026-04-30').map(key),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  assert.equal(key(getNextPaymentDate('2024-02-29', 'yearly', '2026-03-01', null, false, false, 2)), '2028-02-29');
});

test('custom days and weeks retain cadence across daylight-saving changes', () => {
  assert.deepEqual(getPaymentDatesInRange('2026-03-01', 'daily', '2026-03-01', '2026-03-16', null, false, false, 5).map(key),
    ['2026-03-01', '2026-03-06', '2026-03-11', '2026-03-16']);
  assert.deepEqual(getPaymentDatesInRange('2026-03-01', 'weekly', '2026-03-01', '2026-04-15', null, false, false, 3).map(key),
    ['2026-03-01', '2026-03-22', '2026-04-12']);
});

test('last business day respects interval, start boundary and end date', () => {
  assert.deepEqual(getPaymentDatesInRange('2026-01-01', 'monthly', '2026-01-01', '2026-12-31', null, true, true, 2).map(key),
    ['2026-01-30', '2026-03-31', '2026-05-29', '2026-07-31', '2026-09-30', '2026-11-30']);
  assert.equal(key(getNextPaymentDate('2026-05-01', 'monthly', '2026-01-01', null, false, true, 2)), '2026-05-29');
  assert.equal(getNextPaymentDate(water.start_date, 'monthly', '2026-04-01', '2026-04-30', false, false, 2), null);
  assert.deepEqual(getPaymentDatesInRange(water.start_date, 'monthly', '2026-01-01', '2026-12-31', '2026-03-30', false, false, 2).map(key), ['2026-01-30', '2026-03-30']);
});

test('weekend shifts keep calendar and scheduled-month totals consistent', () => {
  const payment = { ...water, start_date: '2026-08-01', business_days_only: true };
  assert.equal(key(getNextPaymentDate(payment.start_date, 'monthly', '2026-07-31', null, true, false, 2)), '2026-07-31');
  assert.deepEqual(getPaymentDatesInRange(payment.start_date, 'monthly', '2026-07-01', '2026-07-31', null, true, false, 2).map(key), ['2026-07-31']);
  assert.equal(getMonthlyProjection([payment], '2026-07').expenses, 0);
  assert.equal(getMonthlyProjection([payment], '2026-08').expenses, 114);
  assert.equal(getMonthlyProjection([payment], '2026-09').expenses, 0);
  // Sunday's payment is still due on Monday; Saturday's must not appear overdue.
  assert.equal(key(getNextPaymentDate('2026-03-01', 'monthly', '2026-03-02', null, true, false, 2)), '2026-03-02');
  assert.equal(key(getNextPaymentDate('2026-08-01', 'monthly', '2026-08-01', null, true, false, 2)), '2026-10-01');
});

test('existing preset schedules default to interval one', () => {
  for (const [frequency, next] of Object.entries({ daily: '2026-01-02', weekly: '2026-01-08', biweekly: '2026-01-15', monthly: '2026-02-01', quarterly: '2026-04-01', yearly: '2027-01-01' })) {
    assert.equal(key(getNextPaymentDate('2026-01-01', frequency, '2026-01-02')), next);
    assert.equal(key(getNextPaymentDate('2026-01-01', frequency, '2026-01-02', null, false, false, null)), next);
  }
  assert.equal(getMonthlyEquivalent(1200, 'yearly'), 100);
  assert.equal(getPaymentsPerYear('weekly', 2), 26);
});

test('last-business-day regression: all months, quarterly, yearly and leap year', () => {
  const expected = [30, 27, 31, 30, 29, 30, 31, 31, 30, 30, 30, 31];
  expected.forEach((day, month) => assert.equal(getNextPaymentDate('2026-01-01', 'monthly', new Date(2026, month, 1), null, false, true).getDate(), day));
  assert.deepEqual(getPaymentDatesInRange('2026-01-01', 'quarterly', '2026-01-01', '2026-12-31', null, false, true).map(key), ['2026-01-30', '2026-04-30', '2026-07-31', '2026-10-30']);
  assert.deepEqual(getPaymentDatesInRange('2026-01-01', 'yearly', '2026-01-01', '2028-12-31', null, false, true).map(key), ['2026-01-30', '2027-01-29', '2028-01-31']);
  assert.equal(key(getNextPaymentDate('2028-01-01', 'monthly', '2028-02-01', null, false, true)), '2028-02-29');
});

test('labels and invalid interval handling', () => {
  assert.equal(formatFrequency('monthly'), 'Monthly');
  assert.equal(formatFrequency('monthly', 2), 'Every 2 months');
  assert.equal(formatFrequency('weekly', 3), 'Every 3 weeks');
  assert.equal(formatFrequency('daily', 5), 'Every 5 days');
  assert.equal(formatFrequency('yearly', 2), 'Every 2 years');
  for (const interval of [0, -1, 1.5, '', 'abc', Infinity, 1000]) {
    assert.equal(isValidFrequencyInterval(interval), false);
    assert.equal(getNextPaymentDate(water.start_date, 'monthly', '2026-01-01', null, false, false, interval), null);
  }
});

test('upcoming payments use the custom interval', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 1, 28, 12) });
  const upcoming = getUpcomingPayments([water], 35);
  assert.deepEqual(upcoming.map(p => key(p.nextDate)), ['2026-03-30']);
});

test('auto-add generates only due custom occurrences and remains idempotent', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 6, 1, 12) });
  const transactions = [];
  const recurring = { ...water, auto_add: true, auto_add_from: '2026-01-01', user_id: 'test-user' };
  const supabase = {
    from(table) {
      let pending;
      const query = {
        select() { return query; }, eq() { return query; }, gte() { return query; }, lte() { return query; }, limit() { return query; },
        upsert(rows) { pending = rows; return query; },
        then(resolve) {
          if (pending) { transactions.push(...pending); return Promise.resolve(resolve({ data: pending })); }
          const data = table === 'recurring_payments' ? [recurring] : table === 'accounts' ? [{ id: 'account' }] : [...transactions];
          return Promise.resolve(resolve({ data }));
        },
      };
      return query;
    },
  };
  assert.equal(await generateDueRecurringTransactions(supabase, 'test-user'), 3);
  assert.deepEqual(transactions.map(tx => tx.date), ['2026-01-30', '2026-03-30', '2026-05-30']);
  assert.equal(await generateDueRecurringTransactions(supabase, 'test-user'), 0);
  assert.equal(transactions.length, 3);
});
