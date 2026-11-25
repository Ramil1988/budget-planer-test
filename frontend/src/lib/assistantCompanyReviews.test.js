import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCompanyReviewStore } from './assistantCompanyReviews.js';

const makeRow = (reviewKey) => ({
  reviewKey, description: 'private bank wording', actualAmount: 17.84,
  companyCandidates: [{ scheduleId: 'plan-a' }, { scheduleId: 'plan-b' }],
});

function fixtureStorage() {
  const items = new Map();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  };
}

test('confirmed and separate charges survive another visit, are user scoped and can be undone', () => {
  const storage = fixtureStorage();
  const row = makeRow('a'.repeat(64));
  const other = makeRow('b'.repeat(64));
  const tab = createCompanyReviewStore('user', storage);
  const anotherTab = createCompanyReviewStore('user', storage);
  assert.equal(tab.read(row), undefined);
  assert.equal(tab.write(row, 'plan-b'), true);
  assert.equal(anotherTab.write(other, null), true);
  assert.equal(anotherTab.read(row), 'plan-b');
  assert.equal(tab.read(other), null);
  assert.equal(createCompanyReviewStore('other user', storage).read(row), undefined);
  const saved = JSON.stringify([...storage.items]);
  assert.ok(!saved.includes(row.description) && !saved.includes(String(row.actualAmount)));
  assert.equal(tab.write(row, undefined), true);
  assert.equal(anotherTab.read(row), undefined);
  assert.equal(anotherTab.read(other), null);
});

test('a review can only select a current candidate of a well-formed user-scoped charge', () => {
  const storage = fixtureStorage();
  const store = createCompanyReviewStore('user', storage);
  const row = makeRow('c'.repeat(64));
  assert.equal(createCompanyReviewStore(null, storage).write(row, null), false);
  assert.equal(store.write({ ...row, reviewKey: 'invalid' }, null), false);
  assert.equal(store.write({ ...row, companyCandidates: [] }, null), false);
  assert.equal(store.write(row, 'unknown'), false);
  assert.equal(storage.items.size, 0);
  store.write(row, 'plan-a');
  assert.equal(store.read({ ...row, companyCandidates: [{ scheduleId: 'plan-b' }] }), undefined);
  const [key] = storage.items.keys();
  storage.setItem(key, JSON.stringify({ unexpected: 'shape' }));
  assert.equal(store.read(row), undefined);
});

test('read-only or disabled storage keeps choices and undo usable during the current session', () => {
  const storage = fixtureStorage();
  const row = makeRow('d'.repeat(64));
  const store = createCompanyReviewStore('user', storage);
  store.write(row, 'plan-a');
  const deny = () => { throw new Error('Storage unavailable'); };
  storage.setItem = deny;
  storage.removeItem = deny;
  store.write(row, null);
  assert.equal(store.read(row), null);
  store.write(row, undefined);
  assert.equal(store.read(row), undefined);
  storage.getItem = deny;
  store.write(row, 'plan-b');
  assert.equal(store.read(row), 'plan-b');
});
