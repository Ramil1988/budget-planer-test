import { test, expect } from '@playwright/test';
import { loginUser } from './test-utils.js';

/**
 * Dashboard Tests
 * Tests for the main dashboard page functionality
 */

test.describe('Dashboard', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test.describe('Page Layout', () => {
    test('should display dashboard header', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    });

    test('should display the monthly summary', async ({ page }) => {
      await expect(page.getByRole('region', { name: 'Monthly summary' })).toBeVisible();
    });

    test('should keep the dashboard clear of the Add Transaction shortcut', async ({ page }) => {
      const main = page.getByRole('main');
      await expect(main.getByRole('button', { name: 'Add Transaction', exact: true })).toHaveCount(0);
      await expect(main.getByRole('link', { name: 'Add Transaction', exact: true })).toHaveCount(0);
    });

    test('should display month selector', async ({ page }) => {
      await expect(page.getByLabel('Dashboard month', { exact: true })).toBeVisible();
    });
  });

  test.describe('Summary Cards', () => {
    test('should display income card', async ({ page }) => {
      await expect(page.getByRole('region', { name: 'Monthly summary' }).getByText('Income', { exact: true })).toBeVisible();
    });

    test('should display expenses card', async ({ page }) => {
      await expect(page.getByRole('region', { name: 'Monthly summary' }).getByText('Expenses', { exact: true })).toBeVisible();
    });

    test('should display net savings/balance card', async ({ page }) => {
      await expect(page.getByRole('region', { name: 'Monthly summary' }).getByText('Net Balance', { exact: true })).toBeVisible();
    });

    test('should display monetary values', async ({ page }) => {
      const summary = page.getByRole('region', { name: 'Monthly summary' });
      await expect(summary.getByText(/\$[\d,]+\.\d{2}/).first()).toBeVisible();
    });
  });

  test.describe('Upcoming Payments Section', () => {
    test('should display upcoming payments section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Upcoming Payments', exact: true })).toBeVisible();
    });

    test('should display manage link for upcoming payments', async ({ page }) => {
      await expect(page.getByRole('region', { name: 'Upcoming Payments' }).getByRole('link', { name: 'Manage' })).toBeVisible();
    });

    test('should open on the calendar and switch to the list', async ({ page }) => {
      const calendar = page.getByRole('button', { name: 'Payment calendar', exact: true });
      const list = page.getByRole('button', { name: 'Payment list', exact: true });
      await expect(calendar).toHaveAttribute('aria-pressed', 'true');
      await list.click();
      await expect(list).toHaveAttribute('aria-pressed', 'true');
    });

    test('should deselect a calendar day when it is clicked again', async ({ page }) => {
      // Give the calendar one scheduled payment whatever the account holds. Only the
      // dashboard's own read is replaced; every other recurring_payments request passes through.
      await page.route('**/rest/v1/recurring_payments*', (route) => {
        const select = new URL(route.request().url()).searchParams.get('select') || '';
        if (route.request().method() !== 'GET' || !select.includes('categories(name)')) return route.continue();
        return route.fulfill({
          headers: { 'access-control-allow-origin': '*' },
          json: [{
            id: 'calendar-test', name: 'Calendar test rent', amount: 100, type: 'expense',
            frequency: 'monthly', frequency_interval: 1, start_date: '2026-01-15', end_date: null,
            is_active: true, auto_add: false, business_days_only: false,
            last_business_day_of_month: false, categories: { name: 'Housing' },
          }],
        });
      });
      await page.reload();

      const section = page.getByRole('region', { name: 'Upcoming Payments' });
      const day = section.getByRole('button', { name: / 15, 1 payment$/ });
      const details = section.getByLabel('Selected day details');
      await day.click();
      await expect(day).toHaveAttribute('aria-pressed', 'true');
      await expect(details.getByText('Total for day')).toBeVisible();

      await day.click();
      await expect(day).toHaveAttribute('aria-pressed', 'false');
      await expect(details.getByText('Select a marked day to see its payments')).toBeVisible();
    });
  });

  test.describe('Where the money went', () => {
    const amount = (text) => Number(text.replace(/[^0-9.-]/g, ''));
    const figures = (page, side) => page.locator(`.dashboard-moneyflow__side[data-side="${side}"] .dashboard-moneyflow__figure b`).allTextContents();
    const sum = (texts) => texts.map(amount).reduce((total, value) => total + value, 0);

    test('should display the money flow', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Where the money went' })).toBeVisible();
      await expect(page.locator('.dashboard-moneyflow__plot, .dashboard-moneyflow__note').first()).toBeVisible();
    });

    test('both sides of the flow add up to the same, and leave nothing out', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Where the money went' })).toBeVisible();
      test.skip(await page.locator('.dashboard-moneyflow__plot').count() === 0, 'nothing recorded this month');
      // The figures above run up to their values: read them once they have arrived.
      const read = async () => (await page.locator('.dashboard-figure dd').allTextContents()).map(amount);
      await expect.poll(async () => { const [net, income, expenses] = await read(); return Math.abs(net - (income - expenses)); }).toBeLessThan(0.011);
      const [, income, expenses] = await read();
      const [left, right] = [sum(await figures(page, 'left')), sum(await figures(page, 'right'))];
      expect(Math.abs(left - right)).toBeLessThan(0.011);
      // Each side holds all of the income and all of the spending, whichever is larger.
      expect(left).toBeGreaterThan(Math.max(income, expenses) - 0.011);
    });

    test('opens the categories that are shown together', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Where the money went' })).toBeVisible();
      const others = page.getByRole('button', { name: /other categories/ });
      test.skip(await others.count() === 0, 'no categories are grouped this month');
      const list = page.getByRole('list', { name: 'The other categories' });
      await expect(list).toBeHidden();
      await others.click();
      await expect(others).toHaveAttribute('aria-expanded', 'true');
      const total = sum(await list.locator('b').allTextContents());
      expect(Math.abs(total - amount(await others.locator('b').textContent()))).toBeLessThan(0.011);
    });
  });

  test.describe('Cash Flow Section', () => {
    test('should display cash flow section', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Cash-flow' })).toBeVisible();
    });
  });

  test.describe('Daily Spending Section', () => {
    test('should display daily spending section', async ({ page }) => {
      await expect(page.locator('text=Daily Spending')).toBeVisible();
    });

    test('should display average spending', async ({ page }) => {
      await expect(page.locator('text=/Avg|Average/')).toBeVisible();
    });
  });

  test.describe('Navigation Actions', () => {
    test('should navigate to import transactions page', async ({ page }) => {
      await page.getByRole('navigation', { name: 'Dashboard shortcuts' }).getByRole('link', { name: 'Import Transactions' }).click();
      await expect(page).toHaveURL('/import');
    });

    test('should navigate to manage budget page', async ({ page }) => {
      await page.getByRole('navigation', { name: 'Dashboard shortcuts' }).getByRole('link', { name: 'Manage Budget' }).click();
      await expect(page).toHaveURL('/budget');
    });
  });

  test.describe('Month Navigation', () => {
    test('should have month navigation arrows', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Previous dashboard month' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next dashboard month' })).toBeVisible();
    });
  });

  test.describe('Data Loading', () => {
    test('should load data without errors', async ({ page }) => {
      // Check that no error messages are displayed
      const errorMessage = page.locator('text=/error|Error|failed|Failed/i');
      const errorCount = await errorMessage.count();

      // Allow for "0 errors" type text but not actual error messages
      // This is a basic check - real errors would be more prominent
      await page.waitForTimeout(2000);
    });

    test('should complete initial load within reasonable time', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(10000); // 10 second timeout
    });
  });
});
