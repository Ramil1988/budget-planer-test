import { test, expect } from '@playwright/test';
import { loginUser } from './test-utils.js';

/**
 * Budget page: the month's pace, categories grouped by status, and the setup tab.
 * The tests read the signed-in account's own data and never save anything.
 */

const monthValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (date) => date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const shifted = (step) => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + step, 1);
};

test.describe('Budget', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await page.goto('/budget');
    await expect(page.getByRole('heading', { name: 'Monthly Budget' })).toBeVisible();
    // The ledger appears once the month has loaded.
    await expect(page.locator('.bw-ledger')).toBeVisible();
  });

  test.describe('Layout', () => {
    test('names the month and how much of it is left', async ({ page }) => {
      await expect(page.locator('.bw-subtitle')).toContainText(monthLabel(new Date()));
      await expect(page.locator('.bw-subtitle')).toContainText(/\d+ days? left/);
    });

    test('has a tab for tracking and a tab for setup', async ({ page }) => {
      await expect(page.getByRole('tab', { name: 'Budget Tracking' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { name: 'Budget Setup' })).toHaveAttribute('aria-selected', 'false');
    });
  });

  test.describe('Month so far', () => {
    test('shows what is left, what is spent and the budget', async ({ page }) => {
      const ledger = page.getByRole('region', { name: 'Month so far' });
      // The figure labels; the same words also appear in the ruler's legend.
      const labels = ledger.locator('dt');
      await expect(labels.filter({ hasText: /^(Left to spend|Over budget)$/ })).toBeVisible();
      await expect(labels.filter({ hasText: /^Spent$/ })).toBeVisible();
      await expect(labels.filter({ hasText: /^Budget$/ })).toBeVisible();
      expect(await ledger.locator('dd').filter({ hasText: /^\$[\d,]+\.\d{2}$/ }).count()).toBeGreaterThanOrEqual(3);
    });

    test('says how spending compares with the calendar', async ({ page }) => {
      await expect(page.locator('.budget-pace__headline')).not.toBeEmpty();
      await expect(page.locator('.budget-pace__detail')).not.toBeEmpty();
    });

    test('marks today on the ruler when a budget is set', async ({ page }) => {
      const ruler = page.locator('.budget-ruler');
      // The ruler follows the figures by a render; only its absence after that means no limits.
      await ruler.waitFor({ timeout: 3000 }).catch(() => {});
      test.skip(await ruler.count() === 0, 'No limits are set for this month.');
      await expect(ruler.getByRole('img')).toHaveAttribute('aria-label', /spent of/);
      await expect(ruler.getByText('Today')).toBeVisible();
    });

    test('switches to the projection and back', async ({ page }) => {
      const projected = page.getByRole('button', { name: 'Projected', exact: true });
      // The projection is worked out after the month has loaded.
      await projected.waitFor({ timeout: 3000 }).catch(() => {});
      test.skip(await projected.count() === 0, 'Nothing to project for this month.');
      await projected.click();
      await expect(page.getByText('Projected by month end')).toBeVisible();
      await expect(projected).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Current', exact: true }).click();
      await expect(page.getByText(/^(Left to spend|Over budget)$/).first()).toBeVisible();
    });
  });

  test.describe('Categories', () => {
    test('lists categories in groups by status', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();
      await expect(page.getByRole('heading', { name: /^(Over budget|Close to the limit|On track|No limit set)$/ }).first()).toBeVisible();
      expect(await page.locator('.budget-row').count()).toBeGreaterThan(0);
    });

    test('shows the amount left or over for a category with a limit', async ({ page }) => {
      const withLimit = page.locator('.budget-row:not([data-status="none"])');
      test.skip(await withLimit.count() === 0, 'No category has a limit this month.');
      await expect(withLimit.first().locator('.budget-row__left')).toHaveText(/^\$[\d,]+\.\d{2} (left|over)$/);
      await expect(withLimit.first().getByRole('img')).toHaveAttribute('aria-label', /\d+% used/);
    });

    test('filters categories by name', async ({ page }) => {
      await page.getByRole('searchbox', { name: 'Search categories' }).fill('zzzz-no-such-category');
      await expect(page.getByText('No categories match')).toBeVisible();
      await expect(page.locator('.budget-row')).toHaveCount(0);
    });

    test('opens the transactions of a category', async ({ page }) => {
      const first = page.locator('.budget-row__open').first();
      const name = await first.textContent();
      await first.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  });

  test.describe('Setup', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Budget Setup' }).click();
    });

    test('shows the planned total and a limit for every category', async ({ page }) => {
      await expect(page.getByText(/^Planned for /)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Category limits' })).toBeVisible();
      expect(await page.locator('.budget-limit input[type="number"]').count()).toBeGreaterThan(0);
      await expect(page.getByRole('button', { name: 'Save budget' })).toBeVisible();
    });

    test('says when a limit has been changed and not saved', async ({ page }) => {
      const note = page.locator('.budget-save p');
      await expect(note).not.toContainText('not saved');
      const field = page.locator('.budget-limit input[type="number"]').first();
      const before = await field.inputValue();
      await field.fill(String(Number(before || 0) + 1));
      await expect(note).toContainText('not saved yet');
      // Put it back: this test must not leave the plan changed, and it never presses Save.
      await field.fill(before);
      await expect(note).not.toContainText('not saved');
    });

    test('sorts categories by name', async ({ page }) => {
      await page.getByRole('combobox', { name: 'Sort categories' }).selectOption('name');
      const names = await page.locator('.budget-limit__name').evaluateAll((labels) => labels.map((label) => label.firstChild.textContent.trim()));
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });
  });

  test.describe('Month navigation', () => {
    test('steps to the previous month', async ({ page }) => {
      await page.getByRole('button', { name: 'Go to previous month' }).click();
      await expect(page).toHaveURL(new RegExp(`month=${monthValue(shifted(-1))}`));
      await expect(page.locator('.bw-subtitle')).toContainText(`${monthLabel(shifted(-1))}, closed`);
    });

    test('two quick steps move two months', async ({ page }) => {
      const next = page.getByRole('button', { name: 'Go to next month' });
      await next.click();
      await next.click();
      await expect(page).toHaveURL(new RegExp(`month=${monthValue(shifted(2))}`));
      await expect(page.locator('.bw-subtitle')).toContainText(`${monthLabel(shifted(2))}, not started`);
    });
  });
});
