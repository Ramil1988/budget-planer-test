import { test, expect } from '@playwright/test';
import { loginUser } from './test-utils.js';

/**
 * Assets & Liabilities: the net worth figures, the balance sheet drawn to scale, the net
 * worth line, the health score, the emergency fund and the two lists. The tests only read
 * the signed-in account's own data: every dialog is opened and closed without saving.
 */

const amount = (text) => Number(text.replace(/[^0-9.-]/g, ''));

test.describe('Assets & Liabilities', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await page.goto('/assets-liabilities');
    await expect(page.getByRole('heading', { name: 'Assets & Liabilities' })).toBeVisible();
  });

  test.describe('Net worth', () => {
    test('is what is owned less what is owed', async ({ page }) => {
      const labels = await page.locator('.bw-ledger dt').allTextContents();
      expect(labels).toEqual(['Net worth', 'Assets', 'Liabilities', 'Debt to assets']);
      const figures = await page.locator('.bw-ledger dd').allTextContents();
      expect(Math.abs(amount(figures[0]) - (amount(figures[1]) - amount(figures[2])))).toBeLessThanOrEqual(1);
      expect(figures[3]).toMatch(/^[\d.]+%$/);
    });

    test('says in words how much is borrowed', async ({ page }) => {
      await expect(page.locator('.assets-headline')).toHaveText(
        /^(Of every dollar you own, \d+¢ is borrowed and \d+¢ is yours\.|Everything you own is yours|You owe \$[\d,]+ more than you own\.|Nothing recorded yet)/,
      );
    });

    test('draws what is owned and what is owed on one scale', async ({ page }) => {
      const bars = page.locator('.assets-sheet__bar');
      test.skip(await bars.count() === 0, 'nothing is recorded for this account');
      await expect(bars).toHaveCount(2);
      // Each bar's segments, measured on screen, fill the same width when net worth is positive.
      const widths = await bars.evaluateAll((lists) => lists.map((list) => ({
        bar: list.getBoundingClientRect().width,
        segments: [...list.children].reduce((total, item) => total + item.getBoundingClientRect().width, 0),
      })));
      expect(Math.abs(widths[0].bar - widths[1].bar)).toBeLessThan(1);
      const positive = await page.locator('.assets-sheet__segment[data-kind="yours"]').count();
      if (positive) {
        expect(Math.abs(widths[0].segments - widths[0].bar)).toBeLessThan(2);
        expect(Math.abs(widths[1].segments - widths[1].bar)).toBeLessThan(2);
      }
    });

    test('names every segment under its bar with its amount and share', async ({ page }) => {
      const keys = page.locator('.assets-sheet__key li');
      test.skip(await keys.count() === 0, 'nothing is recorded for this account');
      for (const text of await keys.allTextContents()) expect(text).toMatch(/\$[\d,]+.*(\d+|<1)%$/);
      // As many names as segments.
      await expect(keys).toHaveCount(await page.locator('.assets-sheet__segment').count());
    });

    test('compares with a saved date', async ({ page }) => {
      const compare = page.getByLabel('Compare with');
      const options = compare.locator('option');
      test.skip(await options.count() < 2, 'no snapshots are saved for this account');
      await compare.selectOption({ index: 1 });
      await expect(page.locator('.bw-figure--lead small')).toHaveText(/^[+−]\$[\d,]+ since \w{3} \d{1,2}, \d{4}$/);
      await compare.selectOption('');
      await expect(page.locator('.bw-figure--lead small')).toHaveCount(0);
    });

    test('shows a saved date and comes back to today', async ({ page }) => {
      const showing = page.getByLabel('Showing');
      const options = showing.locator('option');
      await expect(options.first()).toHaveText('Today');
      test.skip(await options.count() < 2, 'no snapshots are saved for this account');
      await showing.selectOption({ index: (await options.count()) - 1 });
      await expect(page.locator('.bw-subtitle')).toHaveText(/^As recorded on /);
      // A past date cannot be saved over.
      await expect(page.getByRole('button', { name: 'Save snapshot' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Back to today' }).click();
      await expect(page.locator('.bw-subtitle')).toHaveText(/as of today$/);
      await expect(page.getByRole('button', { name: 'Save snapshot' })).toBeVisible();
    });
  });

  test.describe('Net worth over time', () => {
    test('has one point for each snapshot and reads the picked one out', async ({ page }) => {
      const panel = page.getByRole('region', { name: 'Net worth over time' });
      const dots = panel.locator('.assets-trend__dot');
      test.skip(await dots.count() === 0, 'no snapshots are saved for this account');
      await expect(panel.locator('.assets-panel__head > span')).toContainText(`${await dots.count()} snapshot`);
      // The latest point is picked to begin with.
      await expect(dots.last()).toHaveAttribute('aria-pressed', 'true');
      await dots.first().click();
      await expect(dots.first()).toHaveAttribute('aria-pressed', 'true');
      await expect(panel.locator('.assets-trend__picked')).toHaveText(/^\w{3} \d{1,2}, \d{4}: owned \$[\d,]+, owed \$[\d,]+, net worth -?\$[\d,]+\.$/);
    });

    test('lists the snapshots', async ({ page }) => {
      const manage = page.getByRole('button', { name: 'Manage' });
      test.skip(await manage.count() === 0, 'no snapshots are saved for this account');
      await manage.click();
      const dialog = page.getByRole('dialog', { name: 'Snapshots' });
      await expect(dialog.getByRole('columnheader', { name: 'Net worth' })).toBeVisible();
      await expect(dialog.locator('tbody tr')).toHaveCount(await page.locator('.assets-trend__dot').count());
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toBeHidden();
    });
  });

  test.describe('Financial health', () => {
    test('adds its three parts up to the score', async ({ page }) => {
      const panel = page.getByRole('region', { name: 'Financial health' });
      const parts = await panel.locator('.assets-health__part b').allTextContents();
      expect(parts).toHaveLength(3);
      const total = parts.reduce((sum, text) => sum + Number(text.match(/^(\d+) of \d+$/)[1]), 0);
      await expect(panel.locator('.assets-health__score > b')).toHaveText(String(total));
      await expect(panel.locator('.assets-health__score strong')).toHaveText(/^(Excellent|Good|Fair|Needs work)$/);
    });

    test('opens a part to show the sum behind it', async ({ page }) => {
      const part = page.getByRole('button', { name: /^Emergency fund/ });
      await expect(part).toHaveAttribute('aria-expanded', 'false');
      await part.click();
      await expect(part).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.assets-health__why')).toContainText(/a month = [\d.]+ months/);
      await part.click();
      await expect(page.locator('.assets-health__why')).toHaveCount(0);
    });
  });

  test.describe('Emergency fund', () => {
    test('measures the savings in months against six', async ({ page }) => {
      const panel = page.getByRole('region', { name: 'Emergency fund' });
      await expect(panel.locator('.assets-cushion__months')).toHaveText(/^[\d.]+ months of spending covered$/);
      await expect(panel.locator('.assets-panel__head > span')).toHaveText(/^(Excellent|Good|Building|Critical)$/);
      await expect(panel.locator('.assets-ruler__marks')).toContainText('6 months');
      await expect(panel.locator('.assets-facts dt')).toHaveText(['Within reach', 'Investments', 'Home equity']);
    });
  });

  test.describe('The lists', () => {
    test('lists the assets, the most valuable first, with shares that add up', async ({ page }) => {
      const panel = page.getByRole('region', { name: 'Assets', exact: true });
      const rows = panel.locator('.assets-row');
      test.skip(await rows.count() === 0, 'no assets are recorded for this account');
      const amounts = (await rows.locator('.assets-row__amount b').allTextContents()).map(amount);
      expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
      const shares = (await rows.locator('.assets-row__amount small').allTextContents()).map(amount);
      expect(Math.abs(shares.reduce((sum, share) => sum + share, 0) - 100)).toBeLessThan(1);
    });

    test('opens the form for a new asset and closes it without saving', async ({ page }) => {
      const before = await page.locator('.assets-row').count();
      await page.getByRole('button', { name: 'Add asset' }).click();
      const dialog = page.getByRole('dialog', { name: 'Add asset' });
      await expect(dialog.getByLabel('Category')).toBeVisible();
      // An amount is spaced by thousands as it is typed.
      await dialog.getByLabel('Current value').fill('320000');
      await expect(dialog.getByLabel('Current value')).toHaveValue('320 000');
      // A name is required: nothing is sent without one.
      await dialog.getByRole('button', { name: 'Add asset' }).click();
      await expect(dialog.getByRole('alert')).toHaveText('Give the asset a name.');
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toBeHidden();
      await expect(page.locator('.assets-row')).toHaveCount(before);
    });

    test('opens an asset for editing with its own values', async ({ page }) => {
      const row = page.locator('.assets-row').first();
      test.skip(await row.count() === 0, 'no assets are recorded for this account');
      const name = await row.locator('.assets-row__name').textContent();
      await row.getByRole('button', { name: `Edit ${name}` }).click();
      const dialog = page.getByRole('dialog', { name: 'Edit asset' });
      await expect(dialog.getByLabel('Name')).toHaveValue(name);
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toBeHidden();
    });

    test('asks before deleting, and cancelling keeps the asset', async ({ page }) => {
      const rows = page.locator('.assets-row');
      test.skip(await rows.count() === 0, 'no assets are recorded for this account');
      const before = await rows.count();
      const name = await rows.first().locator('.assets-row__name').textContent();
      await rows.first().getByRole('button', { name: `Delete ${name}` }).click();
      const dialog = page.getByRole('dialog', { name: 'Delete this asset?' });
      await expect(dialog).toContainText(name);
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
      await expect(rows).toHaveCount(before);
    });

    test('shows each debt with what is owed and when it ends', async ({ page }) => {
      const panel = page.getByRole('region', { name: 'Liabilities', exact: true });
      const debts = panel.locator('.assets-debt');
      test.skip(await debts.count() === 0, 'no debts are recorded for this account');
      const first = debts.first();
      await expect(first.locator('.assets-debt__balance b')).toHaveText(/^\$[\d,]+$/);
      await expect(first.locator('.assets-debt__facts dt').first()).toHaveText('Payment');
      // Either a payoff date, or a line that says why there is none.
      const dated = await first.locator('.assets-debt__facts dt', { hasText: 'Paid off' }).count();
      const explained = await first.locator('.assets-debt__note').count();
      expect(dated + explained).toBeGreaterThan(0);
    });

    test('opens the form for a new liability and closes it without saving', async ({ page }) => {
      await page.getByRole('button', { name: 'Add liability' }).click();
      const dialog = page.getByRole('dialog', { name: 'Add liability' });
      await expect(dialog.getByLabel('Paid from spending category')).toHaveValue('');
      await dialog.getByRole('button', { name: 'Add liability' }).click();
      await expect(dialog.getByRole('alert')).toHaveText('Say who the debt is owed to.');
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toBeHidden();
    });
  });

  test('fits a phone without scrolling sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.bw-ledger')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
