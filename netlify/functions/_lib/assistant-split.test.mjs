import test from 'node:test';
import assert from 'node:assert/strict';
import { spreadExtra, SplitInputError } from './assistant-split.mjs';

const part = (amount, category, taxable_amount = null) => ({ amount, category, description: null, taxable_amount });
const amounts = (args) => spreadExtra(args).splits[0].parts.map(({ amount }) => amount);

test('tax goes to the taxed parts in proportion, and food stays untaxed', () => {
  // Costco receipt: 526.68 before tax, 31.00 HST on the 206.68 of taxed items, 557.68 paid.
  const result = spreadExtra({
    updates: [], additions: [], removals: [],
    splits: [{ ids: ['a', 'b'], extra: 31, parts: [part(320, 'Food', 0), part(163.2, 'Household', 163.2), part(43.48, 'Clothes', 43.48)] }],
  });
  assert.deepEqual(result.splits[0].parts, [
    { amount: 320, category: 'Food', description: null },
    { amount: 187.68, category: 'Household', description: null },
    { amount: 50, category: 'Clothes', description: null },
  ]);
  assert.deepEqual(result.splits[0].ids, ['a', 'b']);
});

test('the shares always add up to the extra charge to the cent', () => {
  const split = { ids: ['a'], extra: 0.1, parts: [part(10, 'A', 10), part(10, 'B', 10), part(10, 'C', 10)] };
  const result = amounts({ splits: [split] });
  assert.equal(Math.round(result.reduce((sum, amount) => sum + amount, 0) * 100), 3010);
  assert.deepEqual(result, [10.04, 10.03, 10.03]);
});

test('a partly taxed part is weighted by its taxed amount only', () => {
  assert.deepEqual(amounts({ splits: [{ ids: ['a'], extra: 3, parts: [part(100, 'Food', 10), part(20, 'Household', 20)] }] }), [101, 22]);
});

test('without taxed amounts the extra follows the size of each part', () => {
  assert.deepEqual(amounts({ splits: [{ ids: ['a'], extra: 10, parts: [part(75, 'A'), part(25, 'B')] }] }), [82.5, 27.5]);
});

test('no extra charge leaves the parts as they are, without the helper field', () => {
  const result = spreadExtra({ splits: [{ ids: ['a'], extra: null, parts: [part(320, 'Food', 0), part(237.68, 'Household', 5)] }] });
  assert.deepEqual(result.splits[0].parts, [
    { amount: 320, category: 'Food', description: null },
    { amount: 237.68, category: 'Household', description: null },
  ]);
});

test('requests without splits pass through untouched', () => {
  const args = { updates: [{ id: 'x' }], additions: [], removals: [] };
  assert.equal(spreadExtra(args), args);
});

test('negative or over-precise amounts are rejected', () => {
  assert.throws(() => spreadExtra({ splits: [{ ids: ['a'], extra: -1, parts: [part(10, 'A')] }] }), SplitInputError);
  assert.throws(() => spreadExtra({ splits: [{ ids: ['a'], extra: 1.005, parts: [part(10, 'A')] }] }), SplitInputError);
  assert.throws(() => spreadExtra({ splits: [{ ids: ['a'], extra: 1, parts: [part(0, 'A')] }] }), SplitInputError);
});

const item = (amount, category, taxable = false) => ({ amount, category, taxable });

test('receipt lines are added up per category on the server', () => {
  const result = spreadExtra({
    splits: [{
      ids: ['a', 'b'],
      parts: [],
      extra: 31,
      items: [
        item(45.99, 'Food'), item(39.99, 'Food'), item(62.49, 'Food'), item(12.98, 'Food'), item(15.49, 'Food'),
        item(28.99, 'Food'), item(34.59, 'Food'), item(27.49, 'Food'), item(29.99, 'Food'), item(22, 'Food'),
        item(27.99, 'Household', true), item(24.99, 'Household', true), item(12.49, 'Household', true), item(19.99, 'Household', true),
        item(22.99, 'Household', true), item(26.99, 'Household', true), item(27.76, 'Household', true),
        item(16.99, 'Clothes', true), item(26.49, 'Clothes', true),
      ],
    }],
  });
  assert.deepEqual(result.splits[0].parts, [
    { amount: 320, category: 'Food', description: null },
    { amount: 187.68, category: 'Household', description: null },
    { amount: 50, category: 'Clothes', description: null },
  ]);
});

test('a discount line lowers its category, and spelling differences do not split one', () => {
  const [food, household] = spreadExtra({
    splits: [{ ids: ['a'], parts: [], extra: null, items: [item(10, 'Food'), item(-2.5, 'food'), item(5, 'Household', true)] }],
  }).splits[0].parts;
  assert.deepEqual([food, household], [
    { amount: 7.5, category: 'Food', description: null },
    { amount: 5, category: 'Household', description: null },
  ]);
});

test('items win over parts, and items that cancel out are rejected', () => {
  assert.deepEqual(amounts({ splits: [{ ids: ['a'], extra: null, parts: [part(99, 'Wrong')], items: [item(4, 'Food')] }] }), [4]);
  assert.throws(() => spreadExtra({ splits: [{ ids: ['a'], parts: [], extra: null, items: [item(3, 'Food'), item(-3, 'Food')] }] }), SplitInputError);
  assert.throws(() => spreadExtra({ splits: [{ ids: ['a'], parts: [], extra: null, items: [item(3.005, 'Food')] }] }), SplitInputError);
  assert.throws(() => spreadExtra({ splits: [{ ids: ['a'], parts: [], extra: null, items: [item(3, ' ')] }] }), SplitInputError);
});
