import assert from 'node:assert/strict';
import test from 'node:test';
import { commitRecurringScheduleChanges, prepareRecurringScheduleChanges, recurringScheduleSetHash } from './assistant-recurring-writes.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const categoryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const today = '2027-02-18';
const source = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', user_id: userId, category_id: categoryId,
  date: '2027-02-13', amount: 24.35, description: 'LATTICE KITE *STUDIO', type: 'expense',
  assistant_change_version: 2, recurring_payment_id: null, deleted_at: null };
const rule = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user_id: userId, category_id: categoryId, type: 'expense',
  amount: 24.70, name: 'Lattice Kite Studio', frequency: 'monthly', frequency_interval: 1, start_date: '2026-05-13',
  is_active: true, end_date: null, business_days_only: true, last_business_day_of_month: false,
  auto_add: true, auto_add_from: '2026-06-01', match_description: null };
const candidate = { kind: 'update', scheduleSetHash: recurringScheduleSetHash([rule]), categoryId, category: 'Subscriptions', name: rule.name, scheduleId: rule.id,
  transactionId: source.id, actualDate: source.date, actualAmount: source.amount, description: source.description,
  expectedDate: '2027-02-12', expectedAmount: 24.70 };

function database(entry, schedule) {
  return { from(table) {
    const rows = table === 'transactions' ? [entry] : [schedule];
    const filters = [];
    return {
      select() { return this; },
      eq(key, expected) { filters.push((row) => row[key] === expected); return this; },
      in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
      is(key, value) { return this.eq(key, value); },
      then(resolve) { resolve({ data: rows.filter((row) => row && filters.every((check) => check(row))) }); },
    };
  } };
}

function prepare(candidates, entry = source, schedule = rule) {
  return prepareRecurringScheduleChanges({ userId, today, candidates, supabase: database(entry, schedule) });
}

test('a true date difference retains price, history and monthly cadence and prevents retroactive auto-posting', async () => {
  const { changes: [edit], items: [preview] } = await prepare([candidate]);
  assert.deepEqual(edit.patch, {
    start_date: '2026-05-13', business_days_only: false, last_business_day_of_month: false, auto_add_from: '2027-02-19',
  });
  assert.equal(edit.sourceVersion, '2');
  assert.equal(preview.amount, 24.70);
  assert.equal(preview.actualDate, '2027-02-13');
  assert.equal(preview.previousBusinessDaysOnly, true);
});

test('a generated row contributes the independently recorded bank evidence, never a new rule', async () => {
  const generated = { ...source, recurring_payment_id: rule.id, date: '2027-02-12', amount: 24.70, description: rule.name,
    recurring_bank_posting: { date: source.date, amount: source.amount, description: source.description } };
  const { items } = await prepare([candidate], generated);
  assert.equal(items.length, 1);
  await assert.rejects(prepare([{ ...candidate, kind: 'create' }], generated), { status: 409 });
  await assert.rejects(prepare([candidate], { ...generated, recurring_bank_posting: null }), { status: 409 });
});

test('an unmatched statement row produces a stable monthly schedule with auto-add off', async () => {
  const item = { ...candidate, kind: 'create', scheduleId: undefined, expectedDate: null, name: source.description };
  const first = await prepare([item]);
  assert.deepEqual(await prepare([item]), first);
  assert.equal(first.changes[0].patch.start_date, source.date);
  assert.equal(first.items[0].frequency, 'monthly');
  assert.equal(first.items[0].autoAddFrom, null);
  assert.equal(first.items[0].amount, 24.35);
});

test('a moved charge across a month boundary retains its quarterly phase', async () => {
  const schedule = { ...rule, frequency: 'quarterly', start_date: '2025-12-01', business_days_only: false };
  const entry = { ...source, date: '2026-08-31' };
  const shifted = { ...candidate, expectedDate: '2026-09-01', actualDate: entry.date };
  const { items: [preview] } = await prepare([shifted], entry, schedule);
  assert.equal(preview.startDate, '2026-05-31'); // February does not have a 31st.
  assert.equal(preview.frequency, 'quarterly');
});

test('deleted, recategorized, repriced or foreign sources and duplicate rule edits invalidate the proposal', async () => {
  for (const changes of [{ deleted_at: today }, { category_id: 'other' }, { amount: 12 }, { user_id: 'other' }]) {
    await assert.rejects(prepare([candidate], { ...source, ...changes }), { status: 409 });
  }
  await assert.rejects(prepare([candidate, candidate]), { status: 409 });
  await assert.rejects(prepare([candidate], source, { ...rule, amount: 99 }), { status: 409 });
});

test('SQL retries report saved recurring links, including when the original response was lost', async () => {
  const { changes } = await prepare([candidate]);
  let params;
  const supabase = { async rpc(name, args) { assert.equal(name, 'apply_assistant_recurring_changes'); params = args; return { data: true }; } };
  const result = await commitRecurringScheduleChanges({ supabase, changes, userId, today, cardKey: 'a'.repeat(64) });
  assert.equal(params.plan, changes);
  assert.equal(result.alreadyApplied, true);
  assert.deepEqual(result.actions, [{ id: rule.id, title: rule.name, type: 'recurring' }]);
});

test('audit schedule fingerprint matches PostgreSQL, including an empty category', () => {
  const fixture = { ...rule, id: '00000000-0000-4000-8000-000000000010' };
  assert.equal(recurringScheduleSetHash([fixture]), '326135d3b32a92d2fe5429efc3443a89');
  assert.equal(recurringScheduleSetHash([]), 'd41d8cd98f00b204e9800998ecf8427e');
  assert.notEqual(recurringScheduleSetHash([{ ...fixture, match_description: 'PAPER FERN BOX' }]), recurringScheduleSetHash([fixture]));
});
