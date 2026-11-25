import { test, expect } from '@playwright/test';
import { loginUser } from './test-utils.js';

/**
 * Budget assistant window.
 * The assistant function is replaced with scripted replies, so these tests need
 * no OpenAI key and write nothing to the database.
 */

async function openAssistant(page, reply) {
  const requests = [];
  await page.route('**/.netlify/functions/budget-assistant', (route) => {
    const body = route.request().postDataJSON();
    const response = reply(body);
    if (!response) return route.fulfill({ status: 503, json: { error: 'Not scripted.' } });
    requests.push(body);
    return route.fulfill({ json: response });
  });
  await page.getByRole('button', { name: 'Budget assistant', exact: true }).click();
  return { dialog: page.getByRole('dialog', { name: 'Budget assistant' }), requests };
}

async function say(dialog, text) {
  await dialog.getByRole('textbox', { name: 'Message' }).fill(text);
  await dialog.getByTitle('Send message').click();
}

test.describe('Budget assistant', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test('offered choices are buttons that send the chosen reply', async ({ page }) => {
    const { dialog, requests } = await openAssistant(page, (body) => {
      if (body.mode) return null;
      return body.messages.length === 1
        ? { message: 'How should I split it?', choices: ['Split it evenly', 'Leave it as it is'], actions: [] }
        : { message: 'The split is ready.', choices: [], actions: [] };
    });

    await say(dialog, 'Split my Costco purchase');
    const choice = dialog.getByRole('button', { name: 'Split it evenly' });
    await choice.click();

    await expect(dialog.getByText('The split is ready.')).toBeVisible();
    // A choice from an earlier reply can no longer be picked.
    await expect(choice).toBeDisabled();
    expect(requests[1].messages.at(-1)).toEqual({ role: 'user', content: 'Split it evenly' });
    expect(requests[1].messages.at(-2).content).toContain('1) Split it evenly');
  });

  test('proposed changes wait in a card until they are applied', async ({ page }) => {
    const { dialog, requests } = await openAssistant(page, (body) => {
      if (body.mode === 'confirm_changes') {
        return {
          message: 'Done, the changes were applied.',
          actions: [{ type: 'transaction', id: 'changed', title: 'COSTCO WHOLESALE' }],
        };
      }
      if (body.mode) return null;
      return {
        message: 'The changes are waiting in the card.',
        choices: [],
        actions: [],
        changeReviews: [{
          token: 'signed-token',
          totals: { before: -877.68, after: -557.68 },
          items: [
            { kind: 'update', type: 'expense', date: '2026-11-21', description: 'COSTCO WHOLESALE', newDescription: null, amount: 307.68, newAmount: 187.68, category: 'Food/Costco', newCategory: 'Household' },
            { kind: 'add', type: 'expense', date: '2026-11-21', description: 'COSTCO WHOLESALE', amount: 50, category: 'Clothes', account: 'Main Account' },
            { kind: 'remove', type: 'expense', date: '2026-11-21', description: 'COSTCO split', amount: 320, category: 'Food/Costco' },
          ],
        }],
      };
    });

    await say(dialog, 'Split my Costco purchase');
    const card = dialog.getByRole('region', { name: /Review changes/ });
    await expect(card.getByText('Food/Costco → Household')).toBeVisible();
    await expect(card.getByText('−$307.68 → −$187.68')).toBeVisible();
    await expect(card.getByText('Total of these transactions: −$877.68 → −$557.68')).toBeVisible();
    expect(requests.some(({ mode }) => mode === 'confirm_changes')).toBe(false);

    await card.getByRole('button', { name: 'Apply changes' }).click();
    await expect(dialog.getByText('Done, the changes were applied.')).toBeVisible();
    await expect(card).toHaveCount(0);
    expect(requests.at(-1)).toMatchObject({ mode: 'confirm_changes', changesToken: 'signed-token' });
  });

  test('a file sent with a request can come back as a change card', async ({ page }) => {
    const { dialog, requests } = await openAssistant(page, (body) => {
      if (body.mode !== 'prepare_import') return null;
      // With a request the server may answer like a chat turn; a file on its own is an import.
      return body.attachmentNote
        ? {
          message: 'The split is waiting in the card.',
          choices: [],
          actions: [],
          changeReviews: [{
            token: 'signed-token',
            totals: { before: -557.68, after: -557.68 },
            items: [{ kind: 'update', type: 'expense', date: '2026-11-21', description: 'COSTCO WHOLESALE', newDescription: null, amount: 307.68, newAmount: 187.68, category: 'Food/Costco', newCategory: 'Household' }],
          }],
        }
        : {
          message: 'Review the transactions found in your file.',
          actions: [],
          importDraft: { token: 'draft', rows: [], warnings: ['Used the receipt total.'], accounts: [], categories: [] },
        };
    });
    const receipt = { name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) };

    await dialog.locator('input[type=file]').setInputFiles(receipt);
    await dialog.getByRole('textbox').fill('Split the purchase that is already recorded');
    await dialog.getByTitle('Analyze attachment').click();
    await expect(dialog.getByRole('region', { name: /Review changes/ })).toBeVisible();
    await expect(dialog.getByRole('region', { name: 'Review transactions' })).toHaveCount(0);
    expect(requests.at(-1)).toMatchObject({ mode: 'prepare_import', attachmentNote: true, attachment: { kind: 'image' } });

    await dialog.locator('input[type=file]').setInputFiles(receipt);
    await dialog.getByTitle('Analyze attachment').click();
    await expect(dialog.getByRole('region', { name: 'Review transactions' })).toBeVisible();
    expect(requests.at(-1)).toMatchObject({ mode: 'prepare_import', attachmentNote: false });
  });

  test('a correction after a receipt reply needs no second upload and replaces the card', async ({ page }) => {
    const card = (category) => ({
      token: `card-${category}`,
      totals: { before: -557.68, after: -557.68 },
      items: [{ kind: 'update', type: 'expense', date: '2026-11-21', description: 'COSTCO WHOLESALE', newDescription: null, amount: 307.68, newAmount: 73.44, category: 'Food/Costco', newCategory: category }],
    });
    const { dialog, requests } = await openAssistant(page, (body) => {
      if (body.mode === 'prepare_import') {
        return { message: 'Receipt read.', choices: [], actions: [], receiptToken: 'signed-receipt', changeReviews: [card('Entertainment')] };
      }
      if (body.mode) return null;
      return body.receiptToken === 'signed-receipt'
        ? { message: 'Moved.', choices: [], actions: [], receiptToken: 'signed-receipt', changeReviews: [card('Gifts')] }
        : { message: 'No receipt came with that.', choices: [], actions: [] };
    });

    await dialog.locator('input[type=file]').setInputFiles({
      name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    await dialog.getByRole('textbox').fill('Split the purchase that is already recorded');
    await dialog.getByTitle('Analyze attachment').click();
    const cards = dialog.getByRole('region', { name: /Review changes/ });
    await expect(cards.getByText('Food/Costco → Entertainment')).toBeVisible();

    await say(dialog, 'Move the Lego to Gifts');
    await expect(dialog.getByText('Moved.')).toBeVisible();
    expect(requests.at(-1).receiptToken).toBe('signed-receipt');
    expect(requests.at(-1).attachment).toBeUndefined();
    // The corrected proposal takes the place of the first one.
    await expect(cards).toHaveCount(1);
    await expect(cards.getByText('Food/Costco → Gifts')).toBeVisible();
  });

  test('a receipt for a purchase that is not recorded comes back with the card to add it, and a correction replaces that card', async ({ page }) => {
    const draft = (warning) => ({ token: `draft-${warning}`, rows: [], warnings: [warning], accounts: [], categories: [] });
    const { dialog, requests } = await openAssistant(page, (body) => {
      if (body.mode === 'prepare_import') {
        return { message: 'Receipt by category. Nothing recorded adds up to it.', choices: [], actions: [], receiptToken: 'signed-receipt', importDraft: draft('First split.') };
      }
      if (body.mode) return null;
      return { message: 'Moved.', choices: [], actions: [], receiptToken: 'signed-receipt', importDraft: draft('Corrected split.') };
    });

    await dialog.locator('input[type=file]').setInputFiles({
      name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    await dialog.getByRole('textbox').fill('Split the purchase that is already recorded');
    await dialog.getByTitle('Analyze attachment').click();
    const card = dialog.getByRole('region', { name: 'Review transactions' });
    await expect(card.getByText('First split.')).toBeVisible();

    // The correction is answered from the receipt that was already read: no second upload.
    await say(dialog, 'Move the Lego to Gifts');
    await expect(card).toHaveCount(1);
    await expect(card.getByText('Corrected split.')).toBeVisible();
    expect(requests.at(-1).receiptToken).toBe('signed-receipt');
    expect(requests.at(-1).attachment).toBeUndefined();
  });

  test('switching a receipt from a split to new transactions leaves one card', async ({ page }) => {
    const { dialog } = await openAssistant(page, (body) => {
      const split = {
        token: 'signed-token',
        totals: { before: -557.68, after: -557.68 },
        items: [{ kind: 'update', type: 'expense', date: '2026-11-21', description: 'COSTCO WHOLESALE', newDescription: null, amount: 307.68, newAmount: 73.44, category: 'Food/Costco', newCategory: 'Gifts' }],
      };
      if (body.mode === 'prepare_import') return { message: 'Receipt read.', choices: [], actions: [], receiptToken: 'signed-receipt', changeReviews: [split] };
      if (body.mode) return null;
      return body.messages.at(-1).content.startsWith('Add')
        ? { message: 'One new transaction per category.', choices: [], actions: [], receiptToken: 'signed-receipt', importDraft: { token: 'draft', rows: [], warnings: ['Check for a double entry.'], accounts: [], categories: [] } }
        : { message: 'Split again.', choices: [], actions: [], receiptToken: 'signed-receipt', changeReviews: [split] };
    });
    const changeCard = dialog.getByRole('region', { name: /Review changes/ });
    const importCard = dialog.getByRole('region', { name: 'Review transactions' });

    await dialog.locator('input[type=file]').setInputFiles({
      name: 'receipt.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    await dialog.getByRole('textbox').fill('Split the purchase that is already recorded');
    await dialog.getByTitle('Analyze attachment').click();
    await expect(changeCard).toBeVisible();

    // Both cards are about the same purchase: applying both would count it twice.
    await say(dialog, 'Add it as new transactions instead');
    await expect(importCard).toBeVisible();
    await expect(changeCard).toHaveCount(0);

    await say(dialog, 'No, split the recorded one after all');
    await expect(changeCard).toBeVisible();
    await expect(importCard).toHaveCount(0);
  });

  test('a pending import stays with the reply that produced it', async ({ page }) => {
    const { dialog } = await openAssistant(page, (body) => {
      if (body.mode === 'prepare_import') {
        return {
          message: 'Review the transactions found in your file.',
          actions: [],
          importDraft: { token: 'draft', rows: [], warnings: ['Used the receipt total.'], accounts: [], categories: [] },
        };
      }
      if (body.mode) return null;
      return { message: 'Anything else?', choices: [], actions: [] };
    });

    await dialog.locator('input[type=file]').setInputFiles({
      name: 'receipt.csv', mimeType: 'text/csv', buffer: Buffer.from('date,amount\n2026-11-21,5'),
    });
    await dialog.getByTitle('Analyze attachment').click();
    await expect(dialog.getByRole('region', { name: 'Review transactions' })).toBeVisible();

    await say(dialog, 'Thanks');
    await expect(dialog.getByText('Anything else?')).toBeVisible();

    // Later replies come after the card, so they do not look like a new proposal of the same import.
    const cardComesFirst = await dialog.evaluate((element) => {
      const card = element.querySelector('.budget-assistant__import');
      const latest = [...element.querySelectorAll('.budget-assistant__message')].at(-1);
      return Boolean(card.compareDocumentPosition(latest) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(cardComesFirst).toBe(true);
  });

  test('correcting one of two uploaded receipts preserves the other approval', async ({ page }) => {
    const proposal = (title) => ({
      token: title, totals: { before: -10, after: -10 },
      items: [{ kind: 'update', type: 'expense', date: '2026-11-21', description: title, amount: 10, newAmount: 10, category: 'Food', newCategory: 'Gifts' }],
    });
    const { dialog } = await openAssistant(page, (body) => {
      if (body.mode === 'prepare_import') {
        return { message: 'Review the receipt.', receiptToken: body.attachment.name, changeReviews: [proposal(body.attachment.name)] };
      }
      if (body.mode || body.receiptToken !== 'B.png') return null;
      return { message: 'Corrected the second receipt.', receiptToken: 'B-corrected', changeReviews: [proposal('Corrected B')] };
    });
    for (const name of ['A.png', 'B.png']) {
      await dialog.locator('input[type=file]').setInputFiles({ name, mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
      await dialog.getByRole('textbox').fill('Split this receipt');
      await dialog.getByTitle('Analyze attachment').click();
      await expect(dialog.getByRole('region', { name: /Review changes/ }).getByText(`Change: ${name}`, { exact: true })).toBeVisible();
    }
    await say(dialog, 'Update the second split');
    const cards = dialog.getByRole('region', { name: /Review changes/ });
    await expect(cards.getByText('Change: Corrected B', { exact: true })).toBeVisible();
    await expect(cards).toHaveCount(2);
    await expect(cards.getByText('Change: A.png', { exact: true })).toBeVisible();
  });

  test('the next question carries the month selected on the comparison chart', async ({ page }) => {
    const period = (month, total) => ({ startDate: `2026-${month}-01`, endDate: `2026-${month}-25`, total });
    const chart = (earlier) => ({
      kind: 'category-comparison', currency: 'CAD', earlier, latest: period('11', 80), scope: { account: 'Checking' },
      categories: [{ label: 'Subscriptions', earlier: 100, latest: 80, change: -20, percentChange: -20 }],
    });
    const { dialog, requests } = await openAssistant(page, (body) => {
      if ((body.mode && body.mode !== 'category_comparison') || body.messages?.at(-1).content.startsWith('Why')) {
        return body.mode ? null : { message: 'Here are the records.' };
      }
      return { message: 'Spending decreased by CAD 20.00.', visuals: [chart(body.periods ? { ...body.periods[0], total: 100 } : period('10', 100))] };
    });
    await say(dialog, 'Compare spending for two periods');
    await dialog.getByLabel('Comparison month').fill('2026-09');
    await expect(dialog.getByText('01.09.2026 – 25.09.2026')).toBeVisible();
    await say(dialog, 'Why was the earlier period higher?');
    await expect(dialog.getByText('Here are the records.')).toBeVisible();
    const earlierReply = requests.at(-1).messages.at(-2).content;
    expect(earlierReply).toContain('2026-09-01');
    expect(earlierReply).toContain('2026-11-25');
    expect(earlierReply).toContain('Checking');
    expect(earlierReply).not.toContain('2026-10-01');
  });

  test('recurring audit groups additional merchant charges with their statement evidence', async ({ page }) => {
    const { dialog } = await openAssistant(page, (body) => body.mode ? null : {
      message: 'Сверка готова.', visuals: [{
        kind: 'recurring-date-audit', currency: 'CAD', language: 'ru', category: 'Subscriptions',
        month: '2026-04', startDate: '2026-04-01', endDate: '2026-04-30', relatedChargeCount: 1,
        categoryId: 'f5d5e546-5cf8-4fad-a504-000000000123', transactionCount: 4, transactionTotal: 120.05,
        transactions: [
          { id: 'calendar', date: '2026-04-12', amount: 45, description: 'Cobalt', generated: true },
          { id: 'other', date: '2026-04-08', amount: 51.30, description: 'at ORIOLE STUDIO' },
          { id: 'primary', date: '2026-04-06', amount: 18.75, description: 'ORIOLE STUDIO' },
          { id: 'unmatched', date: '2026-04-02', amount: 5, description: 'Unknown charge' },
        ],
        rows: [
          { name: 'Unknown charge', status: 'unmatched', actualDate: '2026-04-02', actualAmount: 5 },
          { name: 'Oriole', status: 'on_schedule', matchSource: 'merchant_name', expectedDate: '2026-04-06', expectedAmount: 19,
            actualDate: '2026-04-06', actualAmount: 18.75, description: 'ORIOLE STUDIO',
            relatedCharges: [{ description: 'at ORIOLE STUDIO', date: '2026-04-08', amount: 51.30 }],
            totalPostedAmount: 70.05, differenceFromPlan: 51.05 },
          { name: 'Cobalt', status: 'amount_mismatch', matchSource: 'merchant_name', expectedDate: '2026-04-12',
            expectedAmount: 25, actualDate: '2026-04-12', actualAmount: 90, description: 'COBALT MONTHLY' },
        ],
      }],
    });
    await say(dialog, 'Сверь подписки за апрель');
    const card = dialog.getByRole('region', { name: 'Сверка дат Recurring' });
    await expect(card.getByText('Доп. списания')).toBeVisible();
    const recurringRows = card.getByRole('list', { name: 'Операции и расписание' }).locator(':scope > li');
    const group = recurringRows.first();
    await expect(group.getByText('Oriole', { exact: true })).toBeVisible();
    await expect(group.getByText('Дата совпала')).toBeVisible();
    await expect(group.getByText('ORIOLE STUDIO', { exact: true })).toBeVisible();
    const extra = group.getByRole('listitem');
    await expect(extra).toHaveCount(1);
    await expect(extra.getByText('2 дн. после плановой даты')).toBeVisible();
    await expect(extra).toHaveText(/at ORIOLE STUDIO.*08\.04\.2026.*51\.30\s*CAD/);
    await expect(group.getByText('70.05 CAD', { exact: true })).toBeVisible();
    await expect(group.getByText('+51.05 CAD', { exact: true })).toBeVisible();
    const discrepancy = recurringRows.filter({ hasText: 'Cobalt' });
    await expect(discrepancy.getByText('Возможная пара · сумма отличается')).toBeVisible();
    await expect(discrepancy.getByText(/близкой сумме/)).toHaveCount(0);
    await card.getByText('Все операции категории (4)').click();
    const ledger = card.locator('details[open]');
    await expect(ledger.getByRole('listitem')).toHaveCount(4);
    await expect(ledger.getByText('120.05 CAD')).toBeVisible();
    await expect(ledger.getByText(/Автозапись Recurring/)).toBeVisible();
    const link = ledger.getByRole('link', { name: 'Открыть в Transactions' });
    await link.click();
    await expect(page).toHaveURL(/\/transactions\?/);
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toMatchObject({
      category: 'f5d5e546-5cf8-4fad-a504-000000000123', type: 'expense', from: '2026-04-01', to: '2026-04-30',
    });
    await expect(dialog).toBeHidden();
  });

  test('a company-only charge asks for confirmation and lets the user revise the link', async ({ page }) => {
    const first = {
      scheduleId: '96ba9d04-922b-4de6-b114-9dba3a1db730', name: 'Studio Plus',
      expectedDate: '2026-04-08', expectedAmount: 24, actualDate: '2026-04-09',
      actualAmount: 23.50, description: 'POLAR STUDIO SUBSCRIPTION',
    };
    const second = { ...first, scheduleId: '0782be1d-8364-474d-9ccb-dcf055a16408', name: 'Studio Business', actualDate: null, actualAmount: null, description: null };
    const charge = {
      id: 'actual:test-bank-entry', status: 'company_candidate', company: 'Polar', actualAmount: 8.25,
      actualDate: '2026-04-08', name: 'at POLAR', description: 'at POLAR', reviewKey: 'a'.repeat(64),
      companyCandidates: [first],
    };
    const report = {
      kind: 'recurring-date-audit', language: 'ru', currency: 'CAD', category: 'Subscriptions',
      categoryId: 'f5d5e546-5cf8-4fad-a504-000000000123', month: '2026-04', startDate: '2026-04-01', endDate: '2026-04-30',
      rows: [charge, { ...charge, id: 'actual:another-test-entry', reviewKey: 'b'.repeat(64), companyCandidates: [first, second] }],
      counts: { company_candidate: 2 },
    };
    const { dialog, requests } = await openAssistant(page, (body) => body.mode ? null : {
      message: 'Проверьте два списания.', visuals: [report], actions: [],
    });
    await say(dialog, 'Сверь Subscriptions за апрель');
    const card = dialog.getByRole('region', { name: 'Сверка дат Recurring' });
    const rows = card.getByRole('list', { name: 'Операции и расписание' }).locator(':scope > li');
    const single = rows.first();
    await expect(single.getByRole('group', { name: 'Это списание Polar относится к подписке Studio Plus?' })).toBeVisible();
    await expect(single.getByText('at POLAR', { exact: true })).toBeVisible();
    await expect(single.getByText('8.25 CAD', { exact: true })).toBeVisible();
    await expect(single.getByText('Уже сопоставлено')).toBeVisible();
    await expect(single.getByText('POLAR STUDIO SUBSCRIPTION')).toBeVisible();
    await expect(single.getByText('23.50 CAD', { exact: true })).toBeVisible();
    await single.getByRole('button', { name: 'Да, относится' }).click();
    await expect(single.getByRole('status')).toHaveText('Вы связали это списание с Studio Plus.');
    await single.getByRole('button', { name: 'Изменить ответ' }).click();
    await single.getByRole('button', { name: 'Нет, отдельное списание' }).click();
    await expect(single.getByRole('status')).toHaveText('Вы отметили это списание как отдельное.');

    const multi = rows.nth(1);
    await expect(multi.getByRole('button', { name: 'Да, относится' })).toHaveCount(0);
    await multi.getByRole('button', { name: 'Связать с Studio Business' }).click();
    await expect(multi.getByRole('status')).toHaveText('Вы связали это списание с Studio Business.');
    expect(requests.filter((request) => request.mode)).toHaveLength(0);
    await say(dialog, 'Сверь ещё раз');
    const repeated = dialog.getByRole('region', { name: 'Сверка дат Recurring' }).last();
    await expect(repeated.getByText('Вы отметили это списание как отдельное.')).toBeVisible();
    await expect(repeated.getByText('Вы связали это списание с Studio Business.')).toBeVisible();
    await expect.poll(() => requests.filter((request) => !request.mode)).toHaveLength(2);
    const history = requests.at(-1).messages.at(-2);
    expect(history.role).toBe('assistant');
    expect(history.content).toContain('"subscription":"Studio Business"');
    expect(history.content).toContain('"subscription":null');
  });

  test('the import form requires CAD and category and lets a repeated file row be confirmed separately', async ({ page }) => {
    const row = { date: '2026-11-20', type: 'expense', description: 'TEST PURCHASE', account_id: 'a', category_id: 'c', amount: 5 };
    const { dialog, requests } = await openAssistant(page, (body) => {
      if (body.mode === 'commit_import') return { message: 'The test selection was confirmed.', actions: [] };
      if (body.mode !== 'prepare_import') return null;
      return { message: 'Review your statement.', actions: [], importDraft: {
        token: 'signed', accounts: [{ id: 'a', name: 'Checking' }], categories: [{ id: 'c', name: 'Food', type: 'expense' }],
        rows: [
          { ...row, rowId: '1', status: 'needs_review', amount: null, sourceAmount: 25, sourceCurrency: 'EUR', category_id: null },
          { ...row, rowId: '2', status: 'ready' },
          { ...row, rowId: '3', status: 'duplicate', fileRepeatOf: '2', duplicates: [] },
        ],
      } };
    });
    await dialog.locator('input[type=file]').setInputFiles({ name: 'amounts.csv', mimeType: 'text/csv', buffer: Buffer.from('synthetic') });
    await dialog.getByTitle('Analyze attachment').click();
    const card = dialog.getByRole('region', { name: 'Review transactions' });
    const first = card.getByRole('checkbox').first();
    await expect(first).toBeDisabled();
    await card.getByLabel('Posted amount in CAD for TEST PURCHASE').fill('39.43');
    await expect(first).toBeDisabled();
    await card.getByLabel('Category for TEST PURCHASE').first().selectOption('c');
    await first.check();
    await card.getByRole('button', { name: 'This is a separate transaction' }).click();
    await card.getByRole('button', { name: 'Import 3 transactions' }).click();
    await expect(dialog.getByText('The test selection was confirmed.')).toBeVisible();
    expect(requests.at(-1).selection).toEqual([
      { rowId: '1', cadAmount: 39.43, category_id: 'c' }, { rowId: '2' }, { rowId: '3', allowDuplicate: true },
    ]);
  });
});
