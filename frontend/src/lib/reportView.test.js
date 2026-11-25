import test from 'node:test';
import assert from 'node:assert/strict';
import { averageMonth, heatRows, monthCategories, rankCategories, treemap, withRunningTotal, yearSummary } from './reportView.js';

const money = (amount) => `$${Math.round(amount).toLocaleString('en-US')}`;
const month = (monthIndex, income, expenses, extra = {}) => ({ monthIndex, income, expenses, balance: income - expenses, ...extra });

test('categories are ranked with "Others" unfolded and a share each', () => {
  const ranked = rankCategories([
    { name: 'Food', amount: 500 },
    { name: 'Mortgage', amount: 300 },
    { name: 'Others', amount: 200, otherCategories: [{ name: 'Fuel', amount: 150 }, { name: 'Haircut', amount: 50 }] },
  ]);
  assert.deepEqual(ranked.map(({ name, amount, share }) => [name, amount, share]), [
    ['Food', 500, 0.5], ['Mortgage', 300, 0.3], ['Fuel', 150, 0.15], ['Haircut', 50, 0.05],
  ]);
  assert.deepEqual(rankCategories([]), []);
  // A category that nets to nothing is left out.
  assert.deepEqual(rankCategories([{ name: 'Refunds', amount: 0 }, { name: 'Food', amount: 10 }]).map(({ name }) => name), ['Food']);
});

test('a month lists its own categories, largest first', () => {
  const august = month(7, 4638, 8109, { incomeCategories: { Cashback: 280, Salary: 4358 }, expenseCategories: { 'Food/Costco': 1718, Mortgage: 2720 } });
  assert.deepEqual(monthCategories(august), {
    income: [{ name: 'Salary', amount: 4358 }, { name: 'Cashback', amount: 280 }],
    expenses: [{ name: 'Mortgage', amount: 2720 }, { name: 'Food/Costco', amount: 1718 }],
  });
  assert.deepEqual(monthCategories(month(11, 0, 0)), { income: [], expenses: [] });
});

test('the running total stops at months with nothing recorded', () => {
  const months = withRunningTotal([month(0, 3757, 7507), month(1, 7225, 6400), month(2, 0, 0), month(3, 100, 40)]);
  assert.deepEqual(months.map(({ recorded, running }) => [recorded, running]), [[true, -3750], [true, -2925], [false, null], [true, -2865]]);
});

test('an average month counts only the months that have records', () => {
  const average = averageMonth([month(0, 3000, 7000), month(1, 7000, 6000), month(2, 5000, 8000), month(3, 0, 0)]);
  assert.deepEqual(average, {
    months: 3,
    income: 5000,
    expenses: 7000,
    net: -2000,
    most: { name: 'March', expenses: 8000 },
    least: { name: 'February', expenses: 6000 },
  });
  assert.equal(averageMonth([month(0, 0, 0)]), null);
});

test('the heat map has the largest categories as rows and the months as cells', () => {
  const months = [
    month(0, 0, 150, { expenseCategories: { Food: 100, Fuel: 50 } }),
    month(1, 0, 400, { expenseCategories: { Food: 300, Gifts: 100 } }),
    month(2, 0, 0),
  ];
  assert.deepEqual(heatRows(months), [
    { name: 'Food', total: 400, cells: [100, 300, 0] },
    { name: 'Gifts', total: 100, cells: [0, 100, 0] },
    { name: 'Fuel', total: 50, cells: [50, 0, 0] },
  ]);
  assert.deepEqual(heatRows(months, 1).map(({ name }) => name), ['Food']);
  assert.deepEqual(heatRows([]), []);
});

test('the treemap gives every value a rectangle of its share, inside the frame', () => {
  const values = [500, 300, 120, 50, 30];
  const rects = treemap(values, 100, 60);
  assert.equal(rects.length, values.length);
  rects.forEach((rect, index) => {
    // Area in proportion to the value.
    assert.ok(Math.abs(rect.width * rect.height - (values[index] / 1000) * 6000) < 1e-6);
    // Inside the frame.
    assert.ok(rect.x >= -1e-9 && rect.y >= -1e-9 && rect.x + rect.width <= 100 + 1e-9 && rect.y + rect.height <= 60 + 1e-9);
  });
  // No two rectangles overlap.
  for (let a = 0; a < rects.length; a += 1) {
    for (let b = a + 1; b < rects.length; b += 1) {
      const apart = rects[a].x + rects[a].width <= rects[b].x + 1e-9 || rects[b].x + rects[b].width <= rects[a].x + 1e-9
        || rects[a].y + rects[a].height <= rects[b].y + 1e-9 || rects[b].y + rects[b].height <= rects[a].y + 1e-9;
      assert.ok(apart, `rectangles ${a} and ${b} overlap`);
    }
  }
  // The largest value is not squeezed into a sliver.
  const ratio = Math.max(rects[0].width / rects[0].height, rects[0].height / rects[0].width);
  assert.ok(ratio < 2.5);
  assert.deepEqual(treemap([42], 10, 5), [{ x: 0, y: 0, width: 10, height: 5 }]);
  assert.deepEqual(treemap([], 10, 5), []);
  assert.deepEqual(treemap([0, 0], 10, 5), []);
});

test('the year is summed up in a headline and a sentence', () => {
  const months = [month(0, 3757, 7507), month(1, 7225, 6400), month(2, 4344, 6921), month(3, 0, 0)];
  const totals = { income: 15326, expenses: 20828, balance: -5502 };
  assert.deepEqual(yearSummary(months, totals, money), {
    tone: 'bad',
    headline: 'Spent $5,502 more than came in',
    detail: '1 of 3 months ended with money left over. Best: February (+$825). Hardest: January (−$3,750). For every $1.00 that came in, $1.36 went out.',
  });

  const good = yearSummary([month(0, 5000, 4000)], { income: 5000, expenses: 4000, balance: 1000 }, money);
  assert.equal(good.headline, 'Kept $1,000 of what came in');
  // One month has no best and hardest.
  assert.equal(good.detail, '1 of 1 month ended with money left over. For every $1.00 that came in, $0.80 went out.');

  assert.equal(yearSummary([month(0, 0, 0)], { income: 0, expenses: 0, balance: 0 }, money).headline, 'Nothing is recorded for this year');
  // Expenses without any income: no ratio to give.
  assert.doesNotMatch(yearSummary([month(0, 0, 50)], { income: 0, expenses: 50, balance: -50 }, money).detail, /For every/);
});
