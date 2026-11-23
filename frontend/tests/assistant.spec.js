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
  await dialog.getByRole('textbox').fill(text);
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
});
