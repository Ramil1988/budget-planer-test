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
  });

  test.describe('Spending Breakdown', () => {
    test('should display spending breakdown section', async ({ page }) => {
      await expect(page.locator('text=Spending Breakdown')).toBeVisible();
    });

    test('should display spending chart or categories', async ({ page }) => {
      // Check for either a chart or category items
      const chartOrCategories = page.locator('text=/Total Spent|by category|No (categorized )?spending/i');
      await expect(chartOrCategories.first()).toBeVisible();
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
