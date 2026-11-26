import test from 'node:test';
import assert from 'node:assert/strict';
import { flowLayout, moneyFlow } from './dashboardView.js';

const income = (name, amount) => ({ type: 'income', amount, categories: name ? { name } : null });
const expense = (amount) => ({ type: 'expense', amount });
const category = (id, spent) => ({ id, name: `Category ${id}`, spent, color: '#000' });
const sum = (nodes) => Math.round(nodes.reduce((total, { amount }) => total + amount, 0) * 100) / 100;

test('moneyFlow: more spent than came in leaves a shortfall on the income side', () => {
  const flow = moneyFlow(
    [income('Salary', 2000), income('Salary', '1000'), income(null, 377.16), expense(6000), expense(147.34)],
    [category(1, 2720.26), category(2, 753.28), category(3, 2673.8)],
  );
  assert.equal(flow.income, 3377.16);
  assert.equal(flow.spent, 6147.34);
  assert.equal(flow.total, 6147.34);
  assert.deepEqual(flow.left.map(({ name, amount, kind }) => [name, amount, kind]), [
    ['Salary', 3000, 'income'],
    ['Other income', 377.16, 'income'],
    ['Shortfall', 2770.18, 'shortfall'],
  ]);
  assert.equal(sum(flow.left), flow.total);
  assert.equal(sum(flow.right), flow.total);
  assert.equal(flow.right.some(({ kind }) => kind === 'leftover'), false);
});

test('moneyFlow: less spent than came in leaves something over on the spending side', () => {
  const flow = moneyFlow([income('Salary', 5000), expense(1200)], [category(1, 1200)]);
  assert.equal(flow.total, 5000);
  assert.deepEqual(flow.left.map(({ kind }) => kind), ['income']);
  assert.deepEqual(flow.right.map(({ name, amount }) => [name, amount]), [['Category 1', 1200], ['Left over', 3800]]);
  assert.equal(flow.right[0].share, 100);
  assert.equal(flow.right[1].share, undefined);
});

test('moneyFlow: categories beyond the limit are shown together, and listed', () => {
  const spending = [50, 400, 300, 200, 100, 30, 20].map((spent, index) => category(index + 1, spent));
  const flow = moneyFlow([expense(1100)], spending, { limit: 4 });
  assert.deepEqual(flow.right.map(({ name, amount }) => [name, amount]), [
    ['Category 2', 400], ['Category 3', 300], ['Category 4', 200], ['Category 5', 100], ['3 other categories', 100],
  ]);
  assert.deepEqual(flow.others.map(({ amount }) => amount), [50, 30, 20]);
  assert.equal(Math.round(flow.right[0].share * 100) / 100, 36.36);
  assert.equal(sum(flow.right), 1100);
});

test('moneyFlow: one category past the limit is shown as itself, not as "others"', () => {
  const flow = moneyFlow([expense(60)], [category(1, 30), category(2, 20), category(3, 10)], { limit: 2 });
  assert.deepEqual(flow.right.map(({ kind }) => kind), ['category', 'category', 'category']);
  assert.deepEqual(flow.others, []);
});

test('moneyFlow: spending without a category has a part of its own', () => {
  const flow = moneyFlow([expense(100), expense(40.1)], [category(1, 100), category(2, 0)]);
  assert.deepEqual(flow.right.map(({ name, amount }) => [name, amount]), [['Category 1', 100], ['No category', 40.1]]);
});

test('moneyFlow: an empty month has nothing on either side', () => {
  assert.deepEqual(moneyFlow([], []), { income: 0, spent: 0, other: 0, total: 0, left: [], right: [], others: [], outside: [] });
});

test('moneyFlow: a category paid from other money is kept apart, out of the shortfall', () => {
  const mortgage = { ...category(1, 2720.26), outside: true };
  const flow = moneyFlow(
    [income('Salary', 3377.16), expense(2720.26), expense(3427.08)],
    [mortgage, category(2, 3000), category(3, 427.08)],
  );
  assert.equal(flow.other, 2720.26);
  // Income had 3,427.08 to pay for: only 49.92 of it was not covered.
  assert.equal(flow.total, 3427.08);
  assert.deepEqual(flow.left.map(({ name, amount }) => [name, amount]), [['Salary', 3377.16], ['Shortfall', 49.92]]);
  assert.deepEqual(flow.right.map(({ name }) => name), ['Category 2', 'Category 3']);
  assert.deepEqual(flow.outside.map(({ name, amount }) => [name, amount]), [['Category 1', 2720.26]]);
  // Shares stay shares of everything spent.
  assert.equal(Math.round(flow.outside[0].share), 44);
  assert.equal(sum(flow.left), sum(flow.right));
});

test('moneyFlow: with the mortgage apart, income can be left over', () => {
  const flow = moneyFlow([income('Salary', 1000), expense(900), expense(400)], [{ ...category(1, 900), outside: true }, category(2, 400)]);
  assert.deepEqual(flow.left.map(({ kind }) => kind), ['income']);
  assert.deepEqual(flow.right.map(({ name, amount }) => [name, amount]), [['Category 2', 400], ['Left over', 600]]);
});

test('flowLayout puts money from outside the income under the rest, to the same scale', () => {
  const flow = moneyFlow([income('Salary', 600), expense(1000)], [{ ...category(1, 400), outside: true }, { ...category(2, 100), outside: true }, category(3, 500)]);
  const layout = flowLayout(flow, { base: 220, slot: 20, gap: 10 });
  // 0.2 px a dollar over 600 + 500: the middle is 120 high, the source below it 100.
  assert.equal(Math.round(layout.middle.height), 120);
  // Above: 100 + 20 and a gap on the spending side (what was spent, and what was left over).
  assert.equal(layout.height, 130 + 30 + 110);
  const { source, parts } = layout.apart;
  assert.deepEqual([source.name, Math.round(source.height)], ['Other money', 100]);
  assert.deepEqual(parts.map(({ height }) => Math.round(height)), [80, 20]);
  // The source is centred beside its two parts; each band leaves it where the one before ended.
  assert.equal(Math.round(source.top), 165);
  assert.deepEqual(parts.map(({ top }) => Math.round(top)), [160, 250]);
  assert.deepEqual(parts.map(({ fromTop }) => Math.round(fromTop)), [165, 245]);
});

test('flowLayout without money from outside has nothing apart', () => {
  assert.equal(flowLayout(moneyFlow([expense(10)], [category(1, 10)])).apart, null);
});

test('flowLayout draws both sides and the middle to one scale', () => {
  const flow = moneyFlow([income('Salary', 600), expense(1000)], [category(1, 700), category(2, 300)]);
  const layout = flowLayout(flow, { base: 200, slot: 20, gap: 10 });
  // 0.2 px a dollar: 120 + 80 on the left, 140 + 60 on the right, and one gap on each side.
  assert.deepEqual(layout.left.map(({ height }) => Math.round(height)), [120, 80]);
  assert.deepEqual(layout.right.map(({ height }) => Math.round(height)), [140, 60]);
  assert.equal(layout.height, 210);
  assert.deepEqual(layout.middle, { top: 5, height: 200 });
  assert.deepEqual(layout.left.map(({ top }) => Math.round(top)), [0, 130]);
  // In the middle the parts of a side follow one another without gaps.
  assert.deepEqual(layout.left.map(({ joinTop }) => Math.round(joinTop)), [5, 125]);
  assert.deepEqual(layout.right.map(({ joinTop }) => Math.round(joinTop)), [5, 145]);
});

test('flowLayout gives a thin part room for its label without drawing it thicker', () => {
  const flow = moneyFlow([expense(1000)], [category(1, 980), category(2, 20)]);
  const layout = flowLayout(flow, { base: 200, slot: 40, gap: 10 });
  const thin = layout.right[1];
  assert.equal(Math.round(thin.height), 4);
  assert.equal(thin.slotHeight, 40);
  // The bar sits in the middle of its label's room.
  assert.equal(Math.round(thin.top - thin.slotTop), 18);
  assert.equal(layout.height, 196 + 10 + 40);
  // The shorter side is centred on the taller one.
  assert.equal(Math.round(layout.left[0].top), 23);
});

test('flowLayout of an empty month has no parts', () => {
  const layout = flowLayout(moneyFlow([], []));
  assert.deepEqual([layout.left, layout.right], [[], []]);
});
