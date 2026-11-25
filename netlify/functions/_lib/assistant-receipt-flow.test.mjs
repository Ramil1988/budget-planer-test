import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFixtureChanges } from './test-support/transaction-change-rpc.mjs';
import { checkReceipt, signReceipt, verifyReceipt } from './assistant-receipt.mjs';

// The receipt path of the handler itself, with the model and the database scripted: what
// reaches a card has to come from the checked receipt and the server's own rows.
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const KEY = 'test-key-not-real';
process.env.SUPABASE_URL = 'https://stub.supabase.test';
process.env.SUPABASE_ANON_KEY = `${b64({ alg: 'HS256' })}.${b64({ role: 'anon' })}.sig`;
process.env.OPENAI_API_KEY = KEY;

const USER = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = '55555555-5555-4555-8555-555555555555';
const OWN = '33333333-3333-4333-8333-333333333331';
const HOUSEHOLD = '33333333-3333-4333-8333-333333333332';
const FOOD = '33333333-3333-4333-8333-333333333333';
const categories = ['Food', 'Household', 'Clothes'].map((name, index) => ({ id: `44444444-4444-4444-8444-44444444444${index}`, name, type: 'expense' }));
const recordedRow = (id, amount, description, category, deleted = null) => ({
  id, user_id: USER, assistant_change_version: 1, type: 'expense', amount: -amount, date: '2026-11-21', description, account_id: ACCOUNT,
  category_id: categories.find(({ name }) => name === category).id, category: { name: category }, deleted_at: deleted, provider: null, recurring_payment_id: null,
});
// A payment at the same store that is not this purchase.
const unrelated = () => [recordedRow(OWN, 9.5, 'CORNER STORE #12', 'Food')];
let transactions = unrelated();

// What the copy step returns for the file: three lines, 13.00, no tax.
const copy = {
  is_receipt: true, wants: 'change_recorded', merchant: 'CORNER STORE', date: '2026-11-21', subtotal: null, tax: null, total: 13,
  lines: [{ n: 'BREAD', a: 5, t: false }, { n: 'SOAP', a: 5, t: false }, { n: 'SOCKS', a: 3, t: false }],
};
const { receipt } = checkReceipt(copy);
const byCategory = [{ category: 'Food', lines: [1] }, { category: 'Household', lines: [2] }, { category: 'Clothes', lines: [3] }];
const plan = (overrides) => ({ action: 'add', transaction_ids: [], remove_ids: [], groups: byCategory, unsure: [], reply: '', account: '', sum_lines: [], ...overrides });

let script = [];
let modelRequests = [];
globalThis.fetch = async (input, init) => {
  const url = String(input?.url ?? input);
  if (url.startsWith('https://api.openai.com')) {
    modelRequests.push(JSON.parse(init.body));
    const next = script.shift();
    if (!next) return new Response('{}', { status: 500 });
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(next) }] }] });
  }
  if (url.includes('/auth/v1/user')) return Response.json({ id: USER, aud: 'authenticated', email: 'user@example.test' });
  if (url.endsWith('/rpc/apply_assistant_transaction_changes')) {
    const { plan } = JSON.parse(init.body);
    const { error } = applyFixtureChanges(transactions, USER, plan);
    return error ? Response.json(error, { status: 409 }) : new Response(null, { status: 204 });
  }
  const table = /\/rest\/v1\/([a-z_]+)/.exec(url)?.[1];
  if (table === 'transactions') {
    // A small in-memory ledger: reads filtered by id and by trash state, inserts and edits applied to it.
    const query = new URL(url).searchParams;
    const ids = /^(?:in\.\((.*)\)|eq\.(.*))$/.exec(query.get('id') ?? '')?.slice(1).find(Boolean)?.split(',').map((id) => id.replaceAll('"', ''));
    const trash = query.get('deleted_at');
    const matching = transactions.filter(({ id, deleted_at: deleted }) => (!ids || ids.includes(id))
      && (trash === 'is.null' ? !deleted : trash === 'not.is.null' ? Boolean(deleted) : true));
    if (init?.method === 'POST') {
      const added = JSON.parse(init.body).filter(({ id }) => !transactions.some((row) => row.id === id));
      transactions.push(...added.map((row) => ({ deleted_at: null, ...row })));
      return Response.json(added.map(({ id }) => ({ id })));
    }
    if (init?.method === 'PATCH') {
      for (const row of matching) Object.assign(row, JSON.parse(init.body));
      return Response.json(matching.map(({ id }) => ({ id })));
    }
    return Response.json(matching);
  }
  if (table === 'categories') return Response.json(categories);
  if (table === 'accounts') return Response.json([{ id: ACCOUNT, name: 'Main Account' }]);
  return Response.json([]);
};
const { default: handler } = await import('../budget-assistant.mjs');

async function post(body, steps = []) {
  script = [...steps];
  modelRequests = [];
  const response = await handler(new Request('https://app.test/', { method: 'POST', headers: { authorization: 'Bearer token' }, body: JSON.stringify(body) }));
  return response.json();
}
// A receipt sent with a request: the copy of the file, then the plan (and a second plan after a correction).
const png = `data:image/png;base64,${Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(16)]).toString('base64')}`;
const withFile = (text, plans) => post({
  mode: 'prepare_import', attachmentNote: true, attachment: { kind: 'image', content: png },
  requestId: crypto.randomUUID(), timeZone: 'UTC', messages: [{ role: 'user', content: text }],
}, [copy, ...plans]);
// The next message, with the signed receipt of the reply before it and no file.
const followUp = (text, plans, proposal = null) => post({
  requestId: crypto.randomUUID(), timeZone: 'UTC', receiptToken: signReceipt(receipt, USER, KEY, proposal),
  messages: [{ role: 'user', content: 'Split this purchase' }, { role: 'assistant', content: 'Here is the receipt.' }, { role: 'user', content: text }],
}, plans);
const named = (draft) => draft.rows.map((row) => [draft.categories.find(({ id }) => id === row.category_id)?.name, row.amount, row.status]);

test('a receipt is added as one new transaction per category, with amounts from the checked receipt', async () => {
  const out = await withFile('Add this receipt as new transactions by category', [plan()]);
  const rows = out.importDraft.rows;
  assert.deepEqual(named(out.importDraft), [['Food', 5, 'ready'], ['Household', 5, 'ready'], ['Clothes', 3, 'ready']]);
  // Two categories with the same amount stay two transactions.
  assert.equal(new Set(rows.map(({ description }) => description)).size, 3);
  assert.equal(rows.reduce((sum, { amount }) => sum + amount, 0), receipt.total);
  assert.ok(rows.every(({ date, type }) => date === '2026-11-21' && type === 'expense'));
  assert.equal(verifyReceipt(out.receiptToken, USER, KEY).proposal.action, 'add');
  assert.match(out.message, /^Receipt CORNER STORE, 2026-11-21: 3 lines/);

  // Nothing is written until the card is confirmed; then exactly these rows are, and only once.
  const before = transactions.length;
  try {
    const selection = rows.map(({ rowId }) => ({ rowId }));
    const saved = await post({ mode: 'commit_import', importToken: out.importDraft.token, selection });
    assert.equal(saved.importResult.counts.inserted, 3);
    const added = transactions.slice(before);
    assert.deepEqual(added.map(({ amount, date, type, account_id: account }) => [amount, date, type, account]), [[5, '2026-11-21', 'expense', ACCOUNT], [5, '2026-11-21', 'expense', ACCOUNT], [3, '2026-11-21', 'expense', ACCOUNT]]);
    assert.deepEqual(added.map(({ category_id: category }) => categories.find(({ id }) => id === category).name), ['Food', 'Household', 'Clothes']);
    const again = await post({ mode: 'commit_import', importToken: out.importDraft.token, selection });
    assert.equal(again.importResult.counts.inserted, 0);
    assert.equal(transactions.length, before + 3);
  } finally {
    transactions.length = before;
  }
});

test('asked to split a purchase that is not recorded, the reply still gives the receipt by category and a card', async () => {
  // The model points at its own pick of entries; only the server's rows can reach the reply.
  const out = await withFile('Split the two recorded payments by this receipt', [plan({ action: 'not_found', transaction_ids: [OWN, 'someone-elses-id'] })]);
  assert.match(out.message, /^Receipt CORNER STORE, 2026-11-21: 3 lines, 13\.00 CAD\.\n\nFood — 5\.00\nBREAD 5\.00/);
  assert.match(out.message, /No recorded transactions add up to this receipt, so there is nothing to split\. The card below adds the purchase/);
  assert.deepEqual(named(out.importDraft), [['Food', 5, 'ready'], ['Household', 5, 'ready'], ['Clothes', 3, 'ready']]);
  assert.deepEqual(out.choices, []);
  assert.match(out.importDraft.warnings[0], /Similar entries are already recorded.*CORNER STORE #12 9\.50/);
  assert.doesNotMatch(JSON.stringify(out), /someone-elses-id/);
  // A correction in the next message starts from this card.
  assert.equal(verifyReceipt(out.receiptToken, USER, KEY).proposal.action, 'add');
});

test('entries in the trash that look like the purchase are named in the reply', async () => {
  transactions = [...unrelated(), recordedRow(FOOD, 8, 'Corner store', 'Food', '2026-11-24T20:09:00Z'), recordedRow(HOUSEHOLD, 5.2, 'Somewhere else', 'Household', '2026-11-24T20:09:00Z')];
  try {
    const out = await withFile('Split the two recorded payments by this receipt', [plan({ action: 'not_found' })]);
    assert.match(out.message, /Similar entries are in the trash: 2026-11-21 Corner store 8\.00\. If those are the ones to split, restore them and ask again\./);
    // An entry in the trash is only mentioned: it is not offered to the model and not changed.
    assert.doesNotMatch(JSON.stringify(modelRequests.at(-1).input), /Somewhere else|"Corner store"/);
    assert.equal(out.importDraft.rows.length, 3);
  } finally {
    transactions = unrelated();
  }
});

test('a category that is not the user\'s is sent back to the model, not into the draft', async () => {
  const wrong = plan({ groups: [{ category: 'Groceries', lines: [1, 2, 3] }] });
  const out = await withFile('Add this receipt as new transactions', [wrong, plan()]);
  assert.equal(modelRequests.length, 3);
  assert.match(modelRequests[2].instructions, /"Groceries" is not one of the user's expense categories/);
  assert.equal(out.importDraft.rows.length, 3);
  // Without a usable second answer the user gets a message and the same receipt, and nothing is drafted.
  const failed = await withFile('Add this receipt as new transactions', [wrong, wrong]);
  assert.equal(failed.importDraft, undefined);
  assert.match(failed.message, /could not be assigned to your categories/);
  assert.ok(verifyReceipt(failed.receiptToken, USER, KEY));
});

test('a corrected card keeps the warning about entries that may be this purchase', async () => {
  const current = { action: 'add', account: '', transaction_ids: [OWN], remove_ids: [], groups: byCategory };
  const out = await followUp('Put the socks in Household', [plan({ groups: [{ category: 'Food', lines: [1] }, { category: 'Household', lines: [2, 3] }] })], current);
  assert.deepEqual(out.importDraft.rows.map(({ amount }) => amount), [5, 8]);
  assert.match(out.importDraft.warnings[0], /Similar entries are already recorded.*CORNER STORE #12 9\.50/);
  assert.deepEqual(verifyReceipt(out.receiptToken, USER, KEY).proposal.transaction_ids, [OWN]);
});

test('nothing is drafted in read-only mode', async () => {
  process.env.BUDGET_ASSISTANT_READ_ONLY = 'true';
  try {
    for (const action of ['add', 'not_found']) {
      const out = await followUp('Add it as new transactions by category', [plan({ action })]);
      assert.equal(out.importDraft, undefined);
      assert.match(out.message, /read-only/);
    }
  } finally {
    delete process.env.BUDGET_ASSISTANT_READ_ONLY;
  }
});

test('recorded amounts that were rounded by hand are still this purchase, and the difference is shown', async () => {
  // The receipt says 13.00; the ledger holds 8.00 and 5.20, entered by hand.
  const rounded = () => [recordedRow(HOUSEHOLD, 5.2, 'Corner store household', 'Household'), recordedRow(FOOD, 8, 'Corner store', 'Food')];
  const split = plan({ action: 'propose', transaction_ids: [HOUSEHOLD, FOOD] });
  transactions = rounded();
  try {
    const out = await followUp('Split the two recorded payments by this receipt', [split]);
    const [card] = out.changeReviews;
    assert.deepEqual(card.totals, { before: -13.2, after: -13 });
    // Each part goes to the row that already has its category, whatever order the ids came in,
    // and the new row is named after the plainer of the two.
    assert.deepEqual(card.items.map(({ kind, description, amount, newAmount, category, newCategory }) => [kind, description, amount, newAmount ?? null, newCategory ?? category]), [
      ['update', 'Corner store household', 5.2, 5, 'Household'],
      ['update', 'Corner store', 8, 5, 'Food'],
      ['add', 'Corner store', 3, null, 'Clothes'],
    ]);
    assert.match(out.message, /The records hold this purchase as 13\.20 CAD; the receipt says 13\.00 CAD/);

    // Applying the card leaves the ledger holding the receipt's total, in the receipt's categories.
    const applied = await post({ mode: 'confirm_changes', changesToken: card.token });
    assert.match(applied.message, /changes were applied/);
    assert.deepEqual(transactions.map(({ description, amount, category_id: category }) => [description, Number(amount), categories.find(({ id }) => id === category).name]), [
      ['Corner store household', -5, 'Household'],
      ['Corner store', -5, 'Food'],
      ['Corner store', -3, 'Clothes'],
    ]);

    // Further off than rounding, they are not taken for this purchase.
    transactions = [recordedRow(HOUSEHOLD, 5.2, 'Corner store household', 'Household'), recordedRow(FOOD, 12, 'Corner store', 'Food')];
    const far = await followUp('Split the two recorded payments by this receipt', [split]);
    assert.equal(far.changeReviews, undefined);
    assert.match(far.message, /receipt total is 13\.00 CAD, but the recorded transactions found add up to 17\.20 CAD/);

    // A plan that calls a rounded purchase "not found" is sent back once, where there is time.
    transactions = rounded();
    const corrected = await withFile('Split the two recorded payments by this receipt', [plan({ action: 'not_found', transaction_ids: [HOUSEHOLD, FOOD] }), split]);
    assert.equal(corrected.changeReviews.length, 1);
    assert.equal(corrected.importDraft, undefined);
    assert.match(modelRequests[2].instructions, /add up to 13\.20, which is the receipt total within rounding/);
  } finally {
    transactions = unrelated();
  }
});

const csvImport = (csv, rows) => post({
  mode: 'prepare_import', attachment: { kind: 'csv', content: csv }, requestId: crypto.randomUUID(),
  timeZone: 'UTC', messages: [{ role: 'user', content: 'Import these posted rows' }],
}, [{ rows, warnings: [] }]);
const confirmImport = (draft, selection) => post({ mode: 'commit_import', importToken: draft.token, selection });
const purchase = { source_row: 2, date: '2026-11-20', type: 'expense', amount: 25, currency: null,
  description: 'UNKNOWN VENDOR', provider: null, category: 'Food', account: 'Main Account' };

test('a foreign CSV row with no recognised category requires both a category and a confirmed CAD amount', async () => {
  transactions = [];
  categories.push({ id: 'catch-all', name: 'Unexpected', type: 'expense' });
  try {
    const { importDraft: draft } = await csvImport('date,description,amount,currency\n2026-11-20,UNKNOWN VENDOR,25,EUR',
      [{ ...purchase, category: null }]);
    const [row] = draft.rows;
    assert.deepEqual([row.status, row.sourceCurrency, row.sourceAmount, row.amount, row.category_id],
      ['needs_review', 'EUR', 25, null, null]);
    for (const fields of [{}, { category_id: categories[0].id, amount: 25, sourceCurrency: 'CAD' },
      { category_id: categories[0].id, cadAmount: 35.678 }, { cadAmount: 35.42 }]) {
      const out = await confirmImport(draft, [{ rowId: row.rowId, ...fields }]);
      assert.equal(out.importResult.counts.inserted, 0);
    }
    const selection = [{ rowId: row.rowId, category_id: categories[0].id, cadAmount: 35.42 }];
    assert.equal((await confirmImport(draft, selection)).importResult.counts.inserted, 1);
    assert.equal((await confirmImport(draft, selection)).importResult.counts.inserted, 0);
    assert.deepEqual(transactions.map(({ amount, category_id }) => [amount, category_id]), [[35.42, categories[0].id]]);
  } finally { categories.pop(); transactions = unrelated(); }
});

test('CAD confirmation rechecks the booked amount against the ledger before allowing a foreign row', async () => {
  transactions = [recordedRow(OWN, 39.43, 'Same Shop', 'Food')];
  try {
    const { importDraft: draft } = await csvImport('date,category,description,amount,type,bank,currency\n2026-11-21,Food,OTHER STORE,25,expense,RBC,EUR', [purchase]);
    const selection = [{ rowId: draft.rows[0].rowId, cadAmount: 39.43, allowDuplicate: true }];
    const checked = await confirmImport(draft, selection);
    assert.equal(checked.importResult.counts.inserted, 0);
    assert.equal(checked.importDraft.rows[0].duplicates[0].id, OWN);
    assert.equal(checked.importDraft.rows[0].cadAmount, 39.43);
    assert.equal((await confirmImport(checked.importDraft, selection)).importResult.counts.inserted, 1);
  } finally { transactions = unrelated(); }
});

test('same-file repeated payments require explicit per-row approval including for a subset, with replay-safe IDs', async () => {
  transactions = [];
  try {
    const csv = 'date,amount,description\n2026-11-20,25,UNKNOWN VENDOR\n2026-11-20,25,UNKNOWN VENDOR';
    const { importDraft: draft } = await csvImport(csv, [purchase, { ...purchase, source_row: 3 }]);
    const [first, second] = draft.rows;
    assert.equal(first.status, 'ready');
    assert.equal(second.status, 'duplicate');
    assert.equal(second.fileRepeatOf, first.rowId);
    assert.equal((await confirmImport(draft, [{ rowId: second.rowId }])).importResult.counts.inserted, 0);
    const selection = [{ rowId: first.rowId }, { rowId: second.rowId, allowDuplicate: true }];
    assert.equal((await confirmImport(draft, selection)).importResult.counts.inserted, 2);
    assert.equal((await confirmImport(draft, selection)).importResult.counts.inserted, 0);
    assert.equal(new Set(transactions.map(({ id }) => id)).size, 2);
  } finally { transactions = unrelated(); }
});

test('a foreign receipt with a note waits for the posted CAD total and apportions exactly that total', async () => {
  transactions = [];
  try {
    const question = 'Add this purchase by category.';
    const first = await post({ mode: 'prepare_import', requestId: crypto.randomUUID(), attachmentNote: true,
      attachment: { kind: 'image', content: png }, messages: [{ role: 'user', content: question }] }, [{ ...copy, currency: 'EUR' }]);
    assert.match(first.message, /13.00 EUR/);
    assert.equal(first.importDraft, undefined);
    assert.equal(first.changeReviews, undefined);
    const answer = (content, plans) => post({ requestId: crypto.randomUUID(), receiptToken: first.receiptToken,
      messages: [{ role: 'user', content: question }, { role: 'assistant', content: first.message }, { role: 'user', content }] }, plans);
    assert.equal((await answer('13 EUR', [])).importDraft, undefined);
    const priced = await answer('20.01 CAD', [plan()]);
    assert.equal(priced.importDraft.rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0), 2001);
    assert.match(priced.message, /13.00 EUR/);
    assert.match(priced.message, /20.01 CAD/);
    assert.equal(transactions.length, 0);
    const out = await confirmImport(priced.importDraft, priced.importDraft.rows.map(({ rowId }) => ({ rowId })));
    assert.equal(out.importResult.counts.inserted, 3);
    assert.equal(transactions.reduce((sum, row) => sum + Math.round(row.amount * 100), 0), 2001);
  } finally { transactions = unrelated(); }
});

test('explicit currency on a CSV amount is protected even when extraction omits it', async () => {
  for (const csv of [
    'date,category,description,amount,type,bank\n2026-11-20,Food,UNKNOWN VENDOR,€25.00,expense,RBC',
    'date,description,Amount (USD)\n2026-11-20,UNKNOWN VENDOR,25',
  ]) {
    const { importDraft } = await csvImport(csv, [purchase]);
    const [row] = importDraft.rows;
    assert.equal(row.status, 'needs_review');
    assert.equal(row.sourceAmount, 25);
    assert.equal(row.amount, null);
  }
});

test('an uncertain receipt category stays empty until the customer chooses it', async () => {
  const out = await withFile('Record this receipt', [plan({ unsure: [{ line: 2, guess: 'item' }] })]);
  assert.deepEqual(out.importDraft.rows.map(({ status }) => status), ['ready', 'needs_review', 'ready']);
  assert.equal(out.importDraft.rows[1].category_id, null);
});

test('independent confirmations of the same foreign payment converge; a different CAD booking shows the prior one', async () => {
  transactions = [];
  try {
    const read = () => csvImport('date,description,amount,currency\n2026-11-20,UNKNOWN VENDOR,25,EUR', [purchase]);
    const { importDraft: a } = await read();
    const { importDraft: b } = await read();
    const pick = (cadAmount, allowDuplicate = false) => [{ rowId: '1', cadAmount, allowDuplicate }];
    const saved = await Promise.all([confirmImport(a, pick(39.43)), confirmImport(b, pick(39.43))]);
    assert.equal(saved.reduce((sum, o) => sum + o.importResult.counts.inserted, 0), 1);
    const { importDraft: next } = await read();
    assert.equal(next.rows[0].status, 'duplicate');
    assert.equal(next.rows[0].duplicates[0].amount, 39.43);
    assert.equal((await confirmImport(next, [{ rowId: '1', allowDuplicate: true }])).importResult.counts.inserted, 0);
    assert.equal((await confirmImport(next, pick(38.52))).importResult.counts.inserted, 0);
    assert.equal((await confirmImport(next, pick(38.52, true))).importResult.counts.inserted, 1);
    assert.equal((await confirmImport(next, pick(38.52, true))).importResult.counts.inserted, 0);
    assert.deepEqual(transactions.map(({ amount }) => amount), [39.43, 38.52]);
  } finally { transactions = unrelated(); }
});

test('different CAD amounts confirmed at the same time get a fresh disclosure before a separate entry', async () => {
  transactions = [];
  try {
    const read = () => csvImport('date,description,amount,currency\n2026-11-20,UNKNOWN VENDOR,25,EUR', [purchase]);
    const { importDraft: a } = await read();
    const { importDraft: b } = await read();
    const pick = (cadAmount) => [{ rowId: '1', cadAmount }];
    const confirmations = await Promise.all([confirmImport(a, pick(39.43)), confirmImport(b, pick(38.52))]);
    assert.equal(transactions.length, 1);
    const review = confirmations.find((out) => out.importDraft)?.importDraft;
    assert.ok(review);
    assert.equal(review.rows[0].duplicates[0].amount, transactions[0].amount);
    assert.notEqual(review.rows[0].cadAmount, transactions[0].amount);
    const separate = await confirmImport(review, [{ rowId: '1', allowDuplicate: true }]);
    assert.equal(separate.importResult.counts.inserted, 1);
    assert.deepEqual(transactions.map(({ amount }) => amount).sort(), [38.52, 39.43]);
  } finally { transactions = unrelated(); }
});
