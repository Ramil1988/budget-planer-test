import test from 'node:test';
import assert from 'node:assert/strict';
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
  id, user_id: USER, type: 'expense', amount: -amount, date: '2026-11-21', description, account_id: ACCOUNT,
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
