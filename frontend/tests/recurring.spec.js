import { test, expect } from '@playwright/test';
import { loginUser } from './test-utils.js';

/**
 * Recurring page: the month's totals and strip, payments in the order they come due,
 * the agenda for the next thirty days and the form.
 * The tests read the signed-in account's own data. They never pause, delete or save a payment.
 */

const monthValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const shifted = (step) => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + step, 1);
};

test.describe('Recurring payments', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await page.goto('/recurring');
    await expect(page.getByRole('heading', { name: 'Recurring Payments' })).toBeVisible();
  });

  test.describe('The month', () => {
    test('shows the net, the income and the expenses of the month', async ({ page }) => {
      const labels = page.locator('.bw-ledger dt');
      await expect(labels.filter({ hasText: /^Net in / })).toBeVisible();
      await expect(labels.filter({ hasText: /^Income$/ })).toBeVisible();
      await expect(labels.filter({ hasText: /^Expenses$/ })).toBeVisible();
      await expect(page.locator('.bw-ledger dd').filter({ hasText: /^[+-]?\$[\d,]+\.\d{2}$/ })).toHaveCount(3);
      await expect(page.locator('.bw-ledger').getByText(/^\d+ payments?$/)).toHaveCount(2);
    });

    test('lays the month out day by day and marks today', async ({ page }) => {
      const today = new Date();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      await expect(page.locator('.recurring-day')).toHaveCount(daysInMonth);
      await expect(page.locator('.recurring-day[data-today="true"] .recurring-day__number')).toHaveText(String(today.getDate()));
    });

    test('shows what is due on a day that is picked', async ({ page }) => {
      const busy = page.locator('.recurring-day__bars:not([disabled])');
      test.skip(await busy.count() === 0, 'Nothing is scheduled this month.');
      await busy.first().click();
      await expect(busy.first()).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.recurring-strip__detail li')).not.toHaveCount(1);
      await expect(page.locator('.recurring-strip__detail')).toContainText(/\$[\d,]+\.\d{2}/);
    });

    test('steps to another month and resets the strip', async ({ page }) => {
      await page.getByRole('button', { name: 'Go to next month' }).click();
      await expect(page.getByLabel('Month shown')).toHaveValue(monthValue(shifted(1)));
      const next = shifted(1);
      await expect(page.locator('.recurring-day')).toHaveCount(new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate());
      await expect(page.locator('.recurring-day[data-today="true"]')).toHaveCount(0);
    });
  });

  test.describe('The list', () => {
    test('has a tab for expenses and a tab for income, with counts', async ({ page }) => {
      await expect(page.getByRole('tab', { name: /^Expenses \(\d+\)$/ })).toHaveAttribute('aria-selected', 'true');
      const income = page.getByRole('tab', { name: /^Income \(\d+\)$/ });
      await income.click();
      await expect(income).toHaveAttribute('aria-selected', 'true');
    });

    test('lists payments by how soon they are due', async ({ page }) => {
      const rows = page.locator('.recurring-row');
      test.skip(await rows.count() === 0, 'No recurring expenses.');
      await expect(page.getByRole('heading', { name: /^(Due within a week|Later|Paused|Ended)$/ }).first()).toBeVisible();
      await expect(rows.first().locator('.recurring-row__amount b')).toHaveText(/^-\$[\d,]+\.\d{2}$/);
      await expect(rows.first().locator('.recurring-row__amount small')).toHaveText(/^(Due today|Due tomorrow|In \d+ days|Paused|Ended)$/);
      // Within the dated groups the days until the payment never go down.
      const dues = await page.locator('.recurring-row[data-paused="false"] .recurring-row__amount small').allTextContents();
      const days = dues.filter((text) => text !== 'Ended').map((text) => (text === 'Due today' ? 0 : text === 'Due tomorrow' ? 1 : Number(text.match(/\d+/)[0])));
      expect(days).toEqual([...days].sort((a, b) => a - b));
    });

    test('each payment can be paused, edited or deleted', async ({ page }) => {
      const row = page.locator('.recurring-row').first();
      test.skip(await row.count() === 0, 'No recurring expenses.');
      const name = await row.locator('.recurring-row__name').textContent();
      await expect(row.getByRole('button', { name: `Pause ${name}` })).toBeVisible();
      await expect(row.getByRole('button', { name: `Edit ${name}` })).toBeVisible();
      await expect(row.getByRole('button', { name: `Delete ${name}` })).toBeVisible();
    });

    test('filters by category', async ({ page }) => {
      const filter = page.getByRole('combobox', { name: 'Category' });
      test.skip(await filter.count() === 0, 'No categories to filter by.');
      const category = await filter.locator('option').nth(1).textContent();
      await filter.selectOption({ label: category });
      await expect(page.locator('.bw-note')).toContainText(`${category}: `);
      const metas = await page.locator('.recurring-row__meta').allTextContents();
      expect(metas.length).toBeGreaterThan(0);
      expect(metas.every((meta) => meta.startsWith(`${category},`))).toBe(true);
    });

    test('can show paused payments', async ({ page }) => {
      const toggle = page.getByRole('button', { name: 'Show paused' });
      await toggle.click();
      await expect(page.getByRole('button', { name: 'Hide paused' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  test.describe('Next 30 days', () => {
    test('lists what is coming, day by day', async ({ page }) => {
      const agenda = page.getByRole('complementary', { name: 'Next 30 days' });
      await expect(agenda.getByRole('heading', { name: 'Next 30 days' })).toBeVisible();
      await expect(agenda.locator('.recurring-agenda__head p')).toHaveText(/^(Nothing is due\.|\d+ payments?, [+-]?\$[\d,]+\.\d{2} net)$/);
    });
  });

  test.describe('The form', () => {
    test('opens for a new payment and closes without saving', async ({ page }) => {
      await page.getByRole('button', { name: 'Add recurring' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Add recurring expense' })).toBeVisible();
      await expect(dialog.getByLabel('Name')).toBeVisible();
      await expect(dialog.getByLabel('Amount')).toBeVisible();
      await dialog.getByRole('button', { name: 'Income', exact: true }).click();
      await expect(dialog.getByRole('heading', { name: 'Add recurring income' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });

    test('offers a custom schedule and says when it falls next', async ({ page }) => {
      await page.getByRole('button', { name: 'Add recurring' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Frequency').selectOption('custom');
      await dialog.getByLabel('Repeat every').fill('2');
      await dialog.getByLabel('Repeat period').selectOption('monthly');
      await expect(dialog.getByText(/^Every 2 months, next on /)).toBeVisible();
      // The option for the last business day only makes sense for schedules counted in months.
      await expect(dialog.getByText('Last business day of month')).toBeVisible();
      await dialog.getByLabel('Repeat period').selectOption('weekly');
      await expect(dialog.getByText('Last business day of month')).toBeHidden();
    });

    test('opens with the values of the payment being edited', async ({ page }) => {
      const row = page.locator('.recurring-row').first();
      test.skip(await row.count() === 0, 'No recurring expenses.');
      const name = await row.locator('.recurring-row__name').textContent();
      await row.getByRole('button', { name: `Edit ${name}` }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Edit recurring expense' })).toBeVisible();
      await expect(dialog.getByLabel('Name')).toHaveValue(name);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  });
});
