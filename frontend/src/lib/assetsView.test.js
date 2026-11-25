import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assetGroups, balanceSheet, emergencyFund, healthScore, liabilityPayments, measures, paidOff, payoff, snapshotRows, spaced, trend,
} from './assetsView.js';

const categories = [
  { id: 'home', name: 'Real Estate' },
  { id: 'cash', name: 'Cash' },
  { id: 'tfsa', name: 'TFSA' },
  { id: 'car', name: 'Vehicle' },
  { id: 'rrsp', name: 'RRSP' },
];
const types = [{ id: 'mortgage', name: 'Mortgage' }, { id: 'card', name: 'Credit Card' }];
const assets = [
  { id: 1, category_id: 'home', name: 'House', amount: 600000 },
  { id: 2, category_id: 'cash', name: 'Chequing', amount: '10000' },
  { id: 3, category_id: 'tfsa', name: 'TFSA', amount: 20000 },
  { id: 4, category_id: 'car', name: 'Car', amount: 15000 },
  { id: 5, category_id: 'cash', name: 'Wallet', amount: 5000 },
];
const liabilities = [
  { id: 1, type_id: 'mortgage', creditor: 'Bank', outstanding_balance: 500000 },
  { id: 2, type_id: 'card', creditor: 'Card', outstanding_balance: 2000 },
];

test('assets are grouped by category, largest first, with shares that add up', () => {
  const groups = assetGroups(assets, categories);
  assert.deepEqual(groups.map(({ name }) => name), ['Real Estate', 'TFSA', 'Cash', 'Vehicle']);
  assert.equal(groups[2].amount, 15000);
  assert.deepEqual(groups[2].items.map(({ name }) => name), ['Chequing', 'Wallet']);
  assert.ok(Math.abs(groups.reduce((total, { share }) => total + share, 0) - 1) < 1e-9);
  assert.equal(assetGroups([{ id: 9, category_id: 'gone', amount: 5 }], categories)[0].name, 'Other');
});

test('liquid savings, investments and home equity come from the named categories', () => {
  assert.deepEqual(measures(assets, liabilities, categories, types), { liquid: 35000, investments: 20000, homeEquity: 100000 });
});

test('an RRSP is both an investment and part of the emergency fund', () => {
  const withRrsp = [...assets, { id: 6, category_id: 'rrsp', name: 'RRSP', amount: 19000 }];
  assert.deepEqual(measures(withRrsp, liabilities, categories, types), { liquid: 54000, investments: 39000, homeEquity: 100000 });
});

test('the balance sheet puts both bars on one scale', () => {
  const sheet = balanceSheet(assetGroups(assets, categories), liabilities, 650000, 502000);
  assert.equal(sheet.ownedPart, 1);
  assert.ok(Math.abs(sheet.owned.reduce((total, { part }) => total + part, 0) - 1) < 1e-9);
  assert.deepEqual(sheet.owed.map(({ name }) => name), ['Bank', 'Card']);
  assert.equal(sheet.yours.amount, 148000);
  // What is owed and what is left fill the same width as what is owned.
  assert.ok(Math.abs(sheet.owed.reduce((total, { part }) => total + part, 0) + sheet.yours.part - 1) < 1e-9);
  assert.equal(sheet.short, 0);
});

test('debts beyond the assets stretch the scale and leave nothing over', () => {
  const sheet = balanceSheet(assetGroups([assets[3]], categories), [liabilities[0]], 15000, 500000);
  assert.equal(sheet.yours, null);
  assert.equal(sheet.short, 485000);
  assert.equal(sheet.owed[0].part, 1);
  assert.equal(sheet.ownedPart, 0.03);
  assert.equal(balanceSheet([], [], 0, 0), null);
});

test('totals from a snapshot that today\'s debts do not add up to are drawn as one debt', () => {
  const sheet = balanceSheet(assetGroups(assets, categories), liabilities, 650000, 510000);
  assert.deepEqual(sheet.owed.map(({ name, amount }) => [name, amount]), [['All debts', 510000]]);
});

test('the health score adds three parts and names its level', () => {
  const health = healthScore({ totalAssets: 706490, totalLiabilities: 528819, liquid: 31490, investments: 18990, monthlyExpenses: 7446 });
  assert.deepEqual(health.parts.map(({ points, max }) => [points, max]), [[10, 40], [21, 30], [4, 30]]);
  assert.equal(health.score, 35);
  assert.equal(health.label, 'Needs work');
  assert.equal(health.tone, 'bad');
  assert.match(health.parts[0].sum, /\$528\.8K ÷ \$706\.5K = 74\.9% borrowed/);
  assert.equal(health.parts.reduce((total, { max }) => total + max, 0), 100);
});

test('paying a debt off never lowers the score', () => {
  const base = { totalAssets: 700000, liquid: 20000, investments: 100000, monthlyExpenses: 5000 };
  const scores = [600000, 400000, 200000, 0].map((totalLiabilities) => healthScore({ ...base, totalLiabilities }).score);
  assert.deepEqual(scores, [...scores].sort((a, b) => a - b));
  // Nothing borrowed, six months saved and a fifth invested is a full score.
  assert.equal(healthScore({ totalAssets: 500000, totalLiabilities: 0, liquid: 30000, investments: 100000, monthlyExpenses: 5000 }).score, 100);
});

test('the name and the colour of the score change together', () => {
  const at = (totalLiabilities) => healthScore({ totalAssets: 100000, totalLiabilities, liquid: 30000, investments: 20000, monthlyExpenses: 5000 });
  assert.deepEqual([at(0).score, at(0).label, at(0).tone], [100, 'Excellent', 'good']);
  assert.deepEqual([at(75000).score, at(75000).label, at(75000).tone], [70, 'Good', 'good']);
  assert.deepEqual([at(100000).score, at(100000).label, at(100000).tone], [60, 'Good', 'good']);
  assert.deepEqual([at(150000).score, at(150000).label], [60, 'Good']);
});

test('no assets and no spending score nothing instead of dividing by zero', () => {
  const health = healthScore({ totalAssets: 0, totalLiabilities: 0, liquid: 0, investments: 0, monthlyExpenses: 0 });
  assert.equal(health.score, 0);
  assert.ok(health.parts.every(({ sum }) => !sum.includes('NaN')));
});

test('the emergency fund is measured in months against six', () => {
  assert.deepEqual(emergencyFund(22500, 7500), { months: 3, target: 6, progress: 0.5, label: 'Good', tone: 'good' });
  assert.equal(emergencyFund(500, 1000).label, 'Critical');
  assert.equal(emergencyFund(1700, 1000).label, 'Building');
  assert.equal(emergencyFund(6000, 1000).label, 'Excellent');
  assert.equal(emergencyFund(50000, 1000).progress, 1);
  assert.equal(emergencyFund(5000, 0).months, 0);
});

test('a debt without interest is paid off in balance over payment', () => {
  const result = payoff({ outstanding_balance: 1200, monthly_payment: 100, interest_rate: 0 }, null, new Date(2026, 10, 24));
  assert.equal(result.months, 12);
  assert.equal(result.interest, 0);
  assert.deepEqual([result.date.getFullYear(), result.date.getMonth()], [2027, 10]);
  assert.equal(result.scheduled, false);
});

test('interest lengthens a payoff, and a linked biweekly payment sets the schedule', () => {
  const monthly = payoff({ outstanding_balance: 10000, monthly_payment: 500, interest_rate: 12 }, null);
  assert.equal(monthly.months, 23);
  assert.ok(monthly.interest > 1100 && monthly.interest < 1300);

  const biweekly = payoff(
    { outstanding_balance: 10000, monthly_payment: 500, interest_rate: 12 },
    { amount: '250', frequency: 'biweekly', frequency_interval: 1 },
  );
  assert.equal(biweekly.payment, 250);
  assert.equal(biweekly.scheduled, true);
  // 26 payments of 250 a year is more than 12 of 500, so it ends sooner.
  assert.ok(biweekly.months < monthly.months);
});

test('a payment that does not cover the interest never pays the debt off', () => {
  assert.deepEqual(payoff({ outstanding_balance: 100000, monthly_payment: 100, interest_rate: 12 }, null), { known: true, never: true });
  assert.deepEqual(payoff({ outstanding_balance: 100000, monthly_payment: 0, interest_rate: 5 }, null), { known: false });
});

test('progress on a debt needs a starting balance above what is still owed', () => {
  assert.deepEqual(paidOff({ original_balance: 1000, outstanding_balance: 750 }), { paid: 250, original: 1000, share: 0.25 });
  assert.equal(paidOff({ original_balance: 0, outstanding_balance: 750 }), null);
  assert.equal(paidOff({ original_balance: 750, outstanding_balance: 750 }), null);
});

test('payments count from the day the debt started', () => {
  const byCategory = { c1: [{ id: 1, date: '2026-10-06' }, { id: 2, date: '2025-03-01' }] };
  assert.equal(liabilityPayments({ linked_category_id: null }, byCategory), null);
  assert.equal(liabilityPayments({ linked_category_id: 'c2' }, byCategory), null);
  assert.equal(liabilityPayments({ linked_category_id: 'c1' }, byCategory).length, 2);
  assert.deepEqual(liabilityPayments({ linked_category_id: 'c1', start_date: '2026-01-01' }, byCategory).map(({ id }) => id), [1]);
});

test('the trend places snapshots by date and keeps zero in range', () => {
  const result = trend([
    { id: 'c', record_date: '2026-03-01', equity: 150, total_assets: 400, total_liabilities: 250 },
    { id: 'a', record_date: '2026-01-01', equity: 100, total_assets: 300, total_liabilities: 200 },
    { id: 'b', record_date: '2026-01-31', equity: 200, total_assets: 400, total_liabilities: 200 },
  ]);
  assert.deepEqual(result.points.map(({ id }) => id), ['a', 'b', 'c']);
  assert.deepEqual(result.points.map(({ x }) => Math.round(x)), [0, 51, 100]);
  assert.deepEqual(result.points.map(({ y }) => y), [50, 0, 25]);
  assert.equal(result.zero, 100);
  assert.equal(result.change, 50);
  assert.equal(trend([]), null);
});

test('a single snapshot sits in the middle, and a negative net worth puts zero above it', () => {
  const result = trend([{ id: 'a', record_date: '2026-01-01', equity: -100, total_assets: 0, total_liabilities: 100 }]);
  assert.equal(result.points[0].x, 50);
  assert.equal(result.points[0].y, 100);
  assert.equal(result.zero, 0);
});

test('a snapshot\'s lists are read whether stored as JSON or as text', () => {
  assert.deepEqual(snapshotRows([{ id: 1 }]), [{ id: 1 }]);
  assert.deepEqual(snapshotRows('[{"id":1}]'), [{ id: 1 }]);
  assert.deepEqual(snapshotRows('not json'), []);
  assert.deepEqual(snapshotRows(null), []);
});

test('amounts are spaced by thousands as they are typed', () => {
  assert.equal(spaced(320000), '320 000');
  assert.equal(spaced('1234567.5'), '1 234 567.5');
  assert.equal(spaced(0), '');
  assert.equal(spaced(''), '');
});
