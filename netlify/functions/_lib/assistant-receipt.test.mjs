import test from 'node:test';
import assert from 'node:assert/strict';
import { addChoice, addWarnings, checkReceipt, linesTotal, notFoundMessage, planFormat, planInstructions, readReceipt, receiptMessage, signReceipt, verifyReceipt } from './assistant-receipt.mjs';
import { resolveSplits, SplitInputError } from './assistant-split.mjs';

// The shape the model returns: short keys, a discount as a negative line.
const line = (n, a, t = false) => ({ n, a, t });
const raw = (overrides = {}) => ({
  is_receipt: true,
  wants: 'change_recorded',
  merchant: 'COSTCO WHOLESALE',
  date: '2026-11-21',
  subtotal: 80.96,
  tax: 4.03,
  total: 84.99,
  lines: [line('EGGPLANT', 6.99), line('1323118 KS PARCHMENT', 19.99, true), line('GREEN GRAPES', 12.99), line('BOWL CLEANER', 13.99, true), line('399319 / 937319', -3, true), line('GROUND BEEF', 30)],
  ...overrides,
});
const receipt = () => checkReceipt(raw()).receipt;

test('a receipt whose lines add up to the printed subtotal is accepted and numbered', () => {
  const { receipt: read, problem, wants } = checkReceipt(raw());
  assert.equal(problem, null);
  assert.equal(wants, 'change_recorded');
  assert.deepEqual(read.lines.map(({ line: number, name, amount, taxable }) => [number, name, amount, taxable]), [
    [1, 'EGGPLANT', 6.99, false], [2, 'KS PARCHMENT', 19.99, true], [3, 'GREEN GRAPES', 12.99, false],
    [4, 'BOWL CLEANER', 13.99, true], [5, 'Discount', -3, true], [6, 'GROUND BEEF', 30, false],
  ]);
  assert.deepEqual([read.subtotal, read.tax, read.extra, read.total, read.byTaxMark], [80.96, 4.03, 4.03, 84.99, true]);
});

test('a missed line is caught by the printed subtotal', () => {
  const missing = raw({ lines: raw().lines.slice(0, 5) });
  const { receipt: read, problem } = checkReceipt(missing);
  assert.equal(read, null);
  assert.match(problem, /6?5 lines add up to 50\.96, the printed subtotal is 80\.96/);
});

test('figures that do not agree, a missing total and an empty receipt are rejected, keeping what the user wants', () => {
  assert.match(checkReceipt(raw({ tax: 5 })).problem, /figures do not agree/);
  assert.match(checkReceipt(raw({ total: 70 })).problem, /figures do not agree/);
  assert.match(checkReceipt(raw({ total: null })).problem, /total paid was not found/);
  assert.match(checkReceipt(raw({ lines: [] })).problem, /No priced lines/);
  assert.match(checkReceipt(raw({ lines: [line('X', 0.005)] })).problem, /no usable price/);
  assert.equal(checkReceipt(raw({ wants: 'add_as_new', lines: raw().lines.slice(1) })).wants, 'add_as_new');
});

test('a receipt without a printed subtotal is checked against the total less tax', () => {
  assert.equal(checkReceipt(raw({ subtotal: null })).problem, null);
  assert.match(checkReceipt(raw({ subtotal: null, tax: 4 })).problem, /figures do not agree/);
});

test('prices that already include tax are accepted, with nothing left to share', () => {
  const inclusive = checkReceipt(raw({ subtotal: null, tax: 9.31, total: 80.96 })).receipt;
  assert.deepEqual([inclusive.subtotal, inclusive.tax, inclusive.extra, inclusive.total, inclusive.byTaxMark], [80.96, 0, 0, 80.96, false]);
  assert.equal(checkReceipt(raw({ subtotal: 80.96, tax: null, total: 80.96 })).receipt.extra, 0);
});

test('a tip on top of the tax is shared between all lines by price', () => {
  const dinner = checkReceipt({
    is_receipt: true, wants: 'change_recorded', merchant: 'BISTRO', date: '2026-11-20', subtotal: 40, tax: 5.2, total: 52,
    lines: [line('PASTA', 30, true), line('WINE', 10, true)],
  }).receipt;
  assert.deepEqual([dinner.tax, dinner.extra, dinner.byTaxMark], [5.2, 12, false]);
  const { args } = resolveSplits({ splits: [{ ids: ['a'], receipt_groups: [{ category: 'Food', lines: [1] }, { category: 'Alcohol', lines: [2] }] }] }, dinner);
  assert.deepEqual(args.splits[0].parts.map(({ amount }) => amount), [39, 13]);
  assert.match(receiptMessage('ru', dinner, resolveSplits({ splits: [{ ids: ['a'], receipt_groups: [{ category: 'Food', lines: [1, 2] }] }] }, dinner).breakdown, 'CAD'),
    /40\.00 \+ налог и сборы 12\.00 = 52\.00 CAD[\s\S]*Налог и сборы разделены между всеми позициями/);
});

test('a total far above subtotal and tax is treated as a misread figure', () => {
  assert.equal(checkReceipt(raw({ total: 94.99 })).problem, null);
  assert.match(checkReceipt(raw({ total: 194.99 })).problem, /figures do not agree/);
});

test('lines that tie to tax and total are accepted even when the printed subtotal leaves a line out', () => {
  const coupon = raw({ subtotal: 85.96, total: 84.99 });
  assert.equal(checkReceipt(coupon).problem, null);
  assert.equal(checkReceipt(raw({ subtotal: 0 })).problem, null);
});

test('a tax line copied as an item is caught', () => {
  const withTaxLine = raw({ lines: [...raw().lines, line('HST 13%', 4.03)] });
  assert.match(checkReceipt(withTaxLine).problem, /tax line was listed as an item/);
});

test('a free item is dropped and an impossible date is not kept', () => {
  const read = checkReceipt(raw({ date: '2026-21-11', lines: [...raw().lines, line('FREE BAG', 0)] })).receipt;
  assert.equal(read.lines.length, 6);
  assert.equal(read.date, null);
});

test('a file that is not a receipt is neither a receipt nor a problem', () => {
  assert.deepEqual(checkReceipt({ is_receipt: false, lines: [] }), { receipt: null, problem: null, wants: null });
  assert.deepEqual(checkReceipt(null), { receipt: null, problem: null, wants: null });
});

test('a wrong first reading is retried once with the reason', async () => {
  const corrections = [];
  const answers = [raw({ lines: raw().lines.slice(1) }), raw()];
  const read = await readReceipt(async (correction) => { corrections.push(correction); return answers.shift(); });
  assert.equal(read.receipt.lines.length, 6);
  assert.equal(corrections[0], '');
  assert.match(corrections[1], /previous attempt was wrong/);

  const failed = await readReceipt(async () => raw({ lines: raw().lines.slice(1) }));
  assert.equal(failed.receipt, null);
  assert.match(failed.problem, /figures do not agree/);

  // A purchase to be added as new is split by category from its lines, so it gets the second read too.
  let reads = 0;
  const toAdd = await readReceipt(async () => { reads += 1; return raw({ wants: 'add_as_new', lines: reads === 1 ? raw().lines.slice(1) : raw().lines }); });
  assert.deepEqual([reads, toAdd.wants, toAdd.receipt.lines.length], [2, 'add_as_new', 6]);
});

test('lines grouped by category become exact parts, with the tax shared between taxed lines', () => {
  const { args, breakdown } = resolveSplits({
    updates: [], additions: [], removals: [],
    splits: [{ ids: ['a'], parts: [], items: [], extra: null, receipt_groups: [{ category: 'Food', lines: [1, 3, 6] }, { category: 'Household', lines: [2, 4, 5] }], unsure_lines: [2] }],
  }, receipt());
  assert.deepEqual(args.splits, [{ ids: ['a'], parts: [
    { amount: 49.98, category: 'Food', description: null },
    { amount: 35.01, category: 'Household', description: null },
  ], receipt_total: true }]);
  assert.deepEqual(breakdown.map(({ category, amount, beforeTax, tax }) => [category, amount, beforeTax, tax]), [
    ['Food', 49.98, 49.98, 0], ['Household', 35.01, 30.98, 4.03],
  ]);
  assert.deepEqual(breakdown[1].lines.map(({ name, unsure }) => [name, unsure]), [['KS PARCHMENT', true], ['BOWL CLEANER', false], ['Discount', false]]);
});

test('every receipt line has to be assigned exactly once', () => {
  const plan = (groups) => () => resolveSplits({ splits: [{ ids: ['a'], receipt_groups: groups, unsure_lines: [] }] }, receipt());
  assert.throws(plan([{ category: 'Food', lines: [1, 2, 3, 4, 5] }]), /Missing lines: 6/);
  assert.throws(plan([{ category: 'Food', lines: [1, 2, 3, 4, 5, 6, 6] }]), /assigned twice/);
  assert.throws(plan([{ category: 'Food', lines: [1, 2, 3, 4, 5, 6, 7] }]), /not on the receipt/);
  assert.throws(() => resolveSplits({ splits: [{ ids: ['a'], receipt_groups: [{ category: 'Food', lines: [1] }] }] }, null), SplitInputError);
});

test('the reply names every line, the tax share and the lines the model was unsure of', () => {
  const { breakdown } = resolveSplits({
    splits: [{ ids: ['a'], receipt_groups: [{ category: 'Food', lines: [1, 3, 6] }, { category: 'Household', lines: [2, 4, 5] }], unsure_lines: [2] }],
  }, receipt());
  const text = receiptMessage('ru', receipt(), breakdown, 'CAD', new Map([[2, 'бумага для выпечки']]));
  assert.match(text, /^Чек COSTCO WHOLESALE от 21\.11\.2026: строк — 6, 80\.96 \+ налог 4\.03 = 84\.99 CAD\./);
  assert.match(text, /Food — 49\.98\nEGGPLANT 6\.99, GREEN GRAPES 12\.99, GROUND BEEF 30\.00/);
  assert.match(text, /Household — 35\.01 \(30\.98 \+ налог 4\.03\)\nKS PARCHMENT 19\.99, BOWL CLEANER 13\.99, Скидка −3\.00/);
  assert.match(text, /KS PARCHMENT \(бумага для выпечки\) → Household/);
  assert.match(receiptMessage('en', receipt(), breakdown, 'CAD'), /^Receipt COSTCO WHOLESALE, 2026-11-21: 6 lines/);
});

test('the total of named lines includes their share of the tax', () => {
  assert.deepEqual(linesTotal(receipt(), [1, 3]), { count: 2, beforeTax: 19.98, tax: 0, total: 19.98 });
  assert.deepEqual(linesTotal(receipt(), [2, 4, 5]), { count: 3, beforeTax: 30.98, tax: 4.03, total: 35.01 });
  assert.equal(linesTotal(receipt(), [99]), null);
  // Without tax marks the tax follows the price, exactly as in a split.
  const unmarked = checkReceipt({ is_receipt: true, wants: 'other', merchant: null, date: null, subtotal: 100, tax: 13, total: 113, lines: [line('HAMMER', 60), line('NAILS', 40)] }).receipt;
  assert.deepEqual(linesTotal(unmarked, [2]), { count: 1, beforeTax: 40, tax: 5.2, total: 45.2 });
  assert.deepEqual(resolveSplits({ splits: [{ ids: ['a'], receipt_groups: [{ category: 'Tools', lines: [1] }, { category: 'Home', lines: [2] }] }] }, unmarked).args.splits[0].parts.map(({ amount }) => amount), [67.8, 45.2]);
});

test('a receipt token is accepted only unchanged, unexpired and for the same user', () => {
  const proposal = { transaction_ids: ['a'], remove_ids: [], groups: [{ category: 'Food', lines: [1, 2, 3, 4, 5, 6] }] };
  const token = signReceipt(receipt(), 'user-1', 'secret', proposal);
  assert.deepEqual(verifyReceipt(token, 'user-1', 'secret'), { receipt: receipt(), proposal });
  assert.equal(verifyReceipt(signReceipt(receipt(), 'user-1', 'secret'), 'user-1', 'secret').proposal, null);
  assert.equal(verifyReceipt(token, 'user-2', 'secret'), null);
  assert.equal(verifyReceipt(token, 'user-1', 'other-secret'), null);
  const [payload, hash] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ userId: 'user-1', receipt: { ...receipt(), total: 1 }, expires: Date.now() + 60_000 })).toString('base64url');
  assert.equal(verifyReceipt(`${forged}.${hash}`, 'user-1', 'secret'), null);
  assert.equal(verifyReceipt(`${payload}.${hash}.x`, 'user-1', 'secret'), null);
  assert.equal(verifyReceipt(undefined, 'user-1', 'secret'), null);
});

const recorded = (amount, description = 'COSTCO WHOLESALE W1362') => ({ id: `t-${amount}`, date: '2026-11-21', type: 'expense', amount, description, category: 'Food/Costco' });
const period = { from: '2026-11-18', to: '2026-12-01' };

test('a purchase that is not in the records is answered with what the records do hold', () => {
  const text = notFoundMessage('ru', receipt(), [recorded(50), recorded(20.5, 'COSTCO GAS')], period, 'CAD');
  assert.match(text, /^В записях нет операций, которые вместе дают сумму этого чека \(84\.99 CAD\)/);
  assert.match(text, /Похожее в записях за 18\.11\.2026 – 01\.12\.2026:\n• 21\.11\.2026 · COSTCO WHOLESALE W1362 · 50\.00 · Food\/Costco\n• 21\.11\.2026 · COSTCO GAS · 20\.50 · Food\/Costco\nВместе: 70\.50 CAD\./);
  assert.match(text, /добавлю покупку сейчас новыми транзакциями/);
  assert.match(notFoundMessage('ru', receipt(), [], period, 'CAD'), /Похожих на эту покупку операций за 18\.11\.2026 – 01\.12\.2026 в записях не нашлось\./);
  assert.match(notFoundMessage('en', receipt(), [recorded(50)], period, 'CAD'), /Similar entries recorded between 2026-11-18 – 2026-12-01:\n• 2026-11-21 · COSTCO WHOLESALE W1362 · 50\.00 · Food\/Costco\nTogether: 50\.00 CAD\./);
  // Without the right to save, the reply does not offer to add anything.
  assert.doesNotMatch(notFoundMessage('ru', receipt(), [], period, 'CAD', false), /добавлю/);
  assert.equal(typeof addChoice('ru'), 'string');
  assert.notEqual(addChoice('ru'), addChoice('en'));
});

test('adding a receipt as new warns about entries that may already be this purchase', () => {
  // Nothing from this merchant in the records: only the note about a bank feed.
  assert.equal(addWarnings('ru', receipt(), [], 'CAD', '2026-11-23').length, 1);
  const some = addWarnings('ru', receipt(), [recorded(50)], 'CAD', '2026-11-23');
  assert.equal(some.length, 2);
  assert.match(some[0], /^В записях уже есть похожие операции\. Если среди них оплата этой покупки, новые транзакции её задвоят\. 21\.11\.2026 COSTCO WHOLESALE W1362 50\.00 CAD\.$/);
  // Entries that add up to the receipt total are the purchase itself, and that is said first.
  const whole = addWarnings('en', receipt(), [recorded(50), recorded(34.99)], 'CAD', '2026-11-23');
  assert.match(whole[0], /^The purchase looks recorded already/);
  // Amounts rounded by hand are the purchase too: 85.00 recorded for a receipt of 84.99.
  assert.match(addWarnings('en', receipt(), [recorded(85)], 'CAD', '2026-11-23')[0], /^The purchase looks recorded already/);
  assert.match(addWarnings('en', receipt(), [recorded(88)], 'CAD', '2026-11-23')[0], /^Similar entries are already recorded/);
  // A receipt without a date is dated today, and the card says so.
  assert.match(addWarnings('ru', { ...receipt(), date: null }, [], 'CAD', '2026-11-23')[0], /датированы сегодняшним днём \(23\.11\.2026\)/);
});

test('the plan can add a purchase as new or report it missing, on a follow-up too', () => {
  assert.deepEqual(planFormat.schema.properties.action.enum, ['propose', 'add', 'not_found', 'answer', 'not_about_receipt']);
  const first = planInstructions({ today: '2026-11-23', currency: 'CAD', followUp: false });
  assert.match(first, /action "add"/);
  assert.match(first, /action "not_found"/);
  assert.doesNotMatch(first, /not_about_receipt/);
  assert.match(planInstructions({ today: '2026-11-23', currency: 'CAD', followUp: true, hasProposal: true }), /Keep its action/);
});
