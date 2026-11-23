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
