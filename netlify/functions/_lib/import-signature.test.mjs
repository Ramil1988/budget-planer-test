import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFixtureChanges } from './test-support/transaction-change-rpc.mjs';
import {
  importSignature,
  isMissingImportSignatureColumn,
  knownImportSignatures,
  loadKnownImportSignatures,
} from '../../../frontend/src/lib/importSignature.js';
import { commitAssistantImport } from './assistant-import-data.mjs';
import { confirmAssistantChanges, proposeAssistantChanges } from './assistant-transaction.mjs';

// An in-memory stand-in for the parts of supabase-js these modules use. With
// `signatureColumn: false` it answers like PostgREST on a database without migration 010.
function fakeSupabase(tables, { signatureColumn = true } = {}) {
  const missingColumn = (code) => ({
    data: null,
    error: {
      code,
      message: code === '42703'
        ? 'column transactions.import_signature does not exist'
        : "Could not find the 'import_signature' column of 'transactions' in the schema cache",
    },
  });

  return {
    rpc(name, { plan }) {
      assert.equal(name, 'apply_assistant_transaction_changes');
      return applyFixtureChanges(tables.transactions, userId, plan);
    },
    from(table) {
      const rows = tables[table] ?? (tables[table] = []);
      const filters = [];
      let action = 'select';
      let columns = '';
      let payload = null;
      let window = null;
      let single = false;

      const run = () => {
        if (!signatureColumn && table === 'transactions') {
          if (columns.includes('import_signature')) return missingColumn('42703');
          if ([].concat(payload ?? []).some((row) => 'import_signature' in row)) return missingColumn('PGRST204');
        }
        const matching = () => rows.filter((row) => filters.every((accepts) => accepts(row)));
        let data;
        if (action === 'select') {
          data = matching();
          if (window) data = data.slice(window[0], window[1] + 1);
        } else if (action === 'update') {
          data = matching();
          data.forEach((row) => Object.assign(row, payload));
        } else {
          data = [].concat(payload).filter((row) => action === 'insert' || !rows.some(({ id }) => id === row.id));
          data.forEach((row) => rows.push({ deleted_at: null, ...row }));
        }
        data = data.map((row) => ({ ...row }));
        return single ? { data: data[0] ?? null, error: null } : { data, error: null };
      };

      const builder = {
        select(selected = '') { columns = selected; return builder; },
        insert(values) { action = 'insert'; payload = values; return builder; },
        upsert(values) { action = 'upsert'; payload = values; return builder; },
        update(values) { action = 'update'; payload = values; return builder; },
        eq(column, value) { filters.push((row) => row[column] === value); return builder; },
        in(column, values) { filters.push((row) => values.includes(row[column])); return builder; },
        is(column, value) { filters.push((row) => (row[column] ?? null) === value); return builder; },
        not(column, _operator, value) { filters.push((row) => (row[column] ?? null) !== value); return builder; },
        order() { return builder; },
        range(from, to) { window = [from, to]; return builder; },
        single() { single = true; return builder; },
        then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); },
      };
      return builder;
    },
  };
}

const userId = 'user-1';
const signingKey = 'test-signing-key';
const bankRowId = '11111111-1111-4111-8111-111111111111';
const bankRow = { date: '2026-11-01', description: 'COSTCO WHOLESALE #12', amount: 45.5 };

function ledger(transaction = {}) {
  return {
    accounts: [{ id: 'account-1', user_id: userId, name: 'Main Account' }],
    categories: [
      { id: 'category-food', user_id: userId, name: 'Food', type: 'expense' },
      { id: 'category-home', user_id: userId, name: 'Home', type: 'expense' },
    ],
    liabilities: [],
    transactions: [{
      id: bankRowId,
      assistant_change_version: 1,
      user_id: userId,
      account_id: 'account-1',
      category_id: 'category-food',
      type: 'expense',
      provider: 'RBC',
      recurring_payment_id: null,
      deleted_at: null,
      ...bankRow,
      ...transaction,
    }],
  };
}

async function applyChanges(supabase, args) {
  let created = 0;
  const { changeReview } = await proposeAssistantChanges({
    supabase,
    userId,
    signingKey,
    args,
    newId: () => `22222222-2222-4222-8222-${String(created++).padStart(12, '0')}`,
  });
  await confirmAssistantChanges({ token: changeReview.token, userId, supabase, signingKey, language: 'en' });
}

test('the signature normalises case, whitespace and the sign of the amount', () => {
  assert.equal(
    importSignature({ date: '2026-11-01', description: '  costco   wholesale\t#12 ', amount: -45.5 }),
    '2026-11-01|COSTCO WHOLESALE #12|45.50',
  );
  assert.equal(importSignature({ date: '2026-11-01', description: 'Costco Wholesale #12', amount: '45.50' }),
    '2026-11-01|COSTCO WHOLESALE #12|45.50');
  assert.equal(importSignature({ date: '2026-11-01', description: null, amount: 7 }), '2026-11-01||7.00');
});

test('an edited row is still recognised through its stored signature', () => {
  const known = knownImportSignatures([{
    date: '2026-11-01',
    description: 'Costco, groceries only',
    amount: 30,
    import_signature: importSignature(bankRow),
  }]);
  assert.ok(known.has(importSignature(bankRow)));
  assert.ok(known.has('2026-11-01|COSTCO, GROCERIES ONLY|30.00'));
  assert.ok(!known.has(importSignature({ ...bankRow, amount: 99 })));
});

test('only a missing import_signature column counts as a missing migration', () => {
  assert.ok(isMissingImportSignatureColumn({ code: '42703', message: 'column transactions.import_signature does not exist' }));
  assert.ok(isMissingImportSignatureColumn({ code: 'PGRST204', message: "Could not find the 'import_signature' column" }));
  assert.ok(!isMissingImportSignatureColumn({ code: '42703', message: 'column transactions.other does not exist' }));
  assert.ok(!isMissingImportSignatureColumn({ code: '42501', message: 'permission denied for table transactions' }));
  assert.ok(!isMissingImportSignatureColumn(null));
});

test('loading known signatures falls back to current values without the column', async () => {
  const withColumn = await loadKnownImportSignatures(
    fakeSupabase(ledger({ amount: 30, import_signature: importSignature(bankRow) })), userId);
  assert.equal(withColumn.hasColumn, true);
  assert.ok(withColumn.known.has(importSignature(bankRow)));

  const without = await loadKnownImportSignatures(fakeSupabase(ledger(), { signatureColumn: false }), userId);
  assert.equal(without.hasColumn, false);
  assert.ok(without.known.has(importSignature(bankRow)));
});

test('the assistant edits an imported row in place and a later sync still recognises the bank row', async () => {
  const tables = ledger();
  const supabase = fakeSupabase(tables);
  await applyChanges(supabase, { updates: [{ id: bankRowId, amount: 30, description: 'Costco, groceries only' }] });

  assert.equal(tables.transactions.length, 1);
  const [row] = tables.transactions;
  assert.equal(row.id, bankRowId);
  assert.equal(row.amount, 30);
  assert.equal(row.deleted_at, null);
  assert.equal(row.import_signature, importSignature(bankRow));

  // A second edit keeps the signature of the bank row, not of the first correction.
  await applyChanges(supabase, { updates: [{ id: bankRowId, amount: 25 }] });
  assert.equal(row.amount, 25);
  assert.equal(row.import_signature, importSignature(bankRow));

  const { known } = await loadKnownImportSignatures(supabase, userId);
  assert.ok(known.has(importSignature(bankRow)));
});

test('a category change alone does not stamp a signature', async () => {
  const tables = ledger();
  await applyChanges(fakeSupabase(tables), { updates: [{ id: bankRowId, category: 'Home' }] });
  assert.equal(tables.transactions[0].category_id, 'category-home');
  assert.equal(tables.transactions[0].import_signature, undefined);
});

test('without the column the assistant still replaces an imported row', async () => {
  const tables = ledger();
  const supabase = fakeSupabase(tables, { signatureColumn: false });
  await applyChanges(supabase, { updates: [{ id: bankRowId, amount: 30 }] });

  assert.equal(tables.transactions.length, 2);
  const [original, copy] = tables.transactions;
  assert.ok(original.deleted_at);
  assert.equal(original.amount, 45.5);
  assert.equal(copy.amount, 30);
  assert.equal(copy.deleted_at, null);
  assert.ok(!('import_signature' in copy));

  const { known } = await loadKnownImportSignatures(supabase, userId);
  assert.ok(known.has(importSignature(bankRow)));
});

test('the assistant import recognises an edited row and stores the signature on new ones', async () => {
  const statementRow = (rowId, values) => ({
    rowId,
    type: 'expense',
    provider: 'RBC',
    account_id: 'account-1',
    category_id: 'category-food',
    ...bankRow,
    ...values,
  });
  const rows = [statementRow(1), statementRow(2, { description: 'SHELL 4471', amount: 61.2 })];

  const tables = ledger({ description: 'Costco, groceries only', amount: 30, import_signature: importSignature(bankRow) });
  const result = await commitAssistantImport({ supabase: fakeSupabase(tables), userId, rows });
  assert.deepEqual(result.counts, { inserted: 1, duplicate: 1, needs_review: 0 });
  assert.equal(tables.transactions.at(-1).import_signature, '2026-11-01|SHELL 4471|61.20');

  const legacy = ledger();
  const legacyResult = await commitAssistantImport({
    supabase: fakeSupabase(legacy, { signatureColumn: false }), userId, rows,
  });
  assert.deepEqual(legacyResult.counts, { inserted: 1, duplicate: 1, needs_review: 0 });
  assert.ok(!('import_signature' in legacy.transactions.at(-1)));
});
