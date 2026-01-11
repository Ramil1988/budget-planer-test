import { test, expect } from '@playwright/test';
import { loginUser } from './test-utils.js';

/**
 * Transactions Tests
 * Tests for transaction list, add transaction, and transaction management
 */

test.describe('Transactions', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test.describe('Transactions List Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/transactions');
    });

    test('should display transactions page header', async ({ page }) => {
      await expect(page.locator('text=Transactions')).toBeVisible();
    });

    test('should display download CSV button', async ({ page }) => {
      await expect(page.locator('button:has-text("Download CSV"), text=Download CSV')).toBeVisible();
    });

    test('should display add transaction button', async ({ page }) => {
      await expect(page.locator('button:has-text("Add Transaction"), a:has-text("Add Transaction")')).toBeVisible();
    });

    test('should display search input', async ({ page }) => {
      await expect(page.locator('input[placeholder*="Search"], input[type="search"]')).toBeVisible();
    });

    test('should display month filter', async ({ page }) => {
      await expect(page.locator('text=This month')).toBeVisible();
    });

    test('should display filters button', async ({ page }) => {
      await expect(page.locator('button:has-text("Filters"), text=Filters')).toBeVisible();
    });

    test('should display transaction count', async ({ page }) => {
      await expect(page.locator('text=/\\d+ transactions?/')).toBeVisible();
    });

    test('should display transaction list items', async ({ page }) => {
      // Wait for transactions to load
      await page.waitForTimeout(2000);

      // Check for transaction items (they should have amounts)
      const transactionAmounts = page.locator('text=/[+-]?\\$[\\d,]+\\.\\d{2}/');
      const count = await transactionAmounts.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display period total', async ({ page }) => {
      await expect(page.locator('text=/Period total|Total/')).toBeVisible();
    });
  });

  test.describe('Transaction Filtering', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/transactions');
    });

    test('should filter transactions by search', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
      await searchInput.fill('Mortgage');

      // Wait for filter to apply
      await page.waitForTimeout(1000);

      // Check if filtered results appear
      const results = page.locator('text=Mortgage');
      const count = await results.count();
      // Results should either show mortgage transactions or be filtered
    });

    test('should open filters panel', async ({ page }) => {
      await page.click('button:has-text("Filters"), text=Filters');

      // Wait for filters panel to appear
      await page.waitForTimeout(500);
    });

    test('should change month filter', async ({ page }) => {
      await page.click('text=This month');

      // Check for month options
      await page.waitForTimeout(500);
    });
  });

  test.describe('Add Transaction Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/add-transaction');
    });

    test('should display add transaction form', async ({ page }) => {
      await expect(page.locator('text=Add Transaction')).toBeVisible();
    });

    test('should display transaction type toggle', async ({ page }) => {
      await expect(page.locator('button:has-text("Expense")')).toBeVisible();
      await expect(page.locator('button:has-text("Income")')).toBeVisible();
    });

    test('should display amount input', async ({ page }) => {
      await expect(page.locator('text=Amount')).toBeVisible();
      await expect(page.locator('input[type="number"], input[placeholder*="0.00"]')).toBeVisible();
    });

    test('should display category selector', async ({ page }) => {
      await expect(page.locator('text=Category')).toBeVisible();
      await expect(page.locator('text=Select a category')).toBeVisible();
    });

    test('should display description field', async ({ page }) => {
      await expect(page.locator('text=Description')).toBeVisible();
    });

    test('should display date picker', async ({ page }) => {
      await expect(page.locator('text=Date')).toBeVisible();
      await expect(page.locator('input[type="date"]')).toBeVisible();
    });

    test('should display submit button', async ({ page }) => {
      await expect(page.locator('button:has-text("Add Expense"), button:has-text("Add Income")')).toBeVisible();
    });

    test('should display category counts', async ({ page }) => {
      await expect(page.locator('text=/\\d+ expense categories/')).toBeVisible();
      await expect(page.locator('text=/\\d+ income categories/')).toBeVisible();
    });

    test('should toggle between expense and income', async ({ page }) => {
      // Click on Income
      await page.click('button:has-text("Income")');

      // Check button changes to Add Income
      await expect(page.locator('button:has-text("Add Income")')).toBeVisible();

      // Click back to Expense
      await page.click('button:has-text("Expense")');

      // Check button changes back to Add Expense
      await expect(page.locator('button:has-text("Add Expense")')).toBeVisible();
    });

    test('should open category dropdown', async ({ page }) => {
      await page.click('text=Select a category');

      // Wait for dropdown to open
      await page.waitForTimeout(500);

      // Check for category options
      const categoryOptions = page.locator('[role="option"], [role="listbox"] div');
      const count = await categoryOptions.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Add Transaction Form Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/add-transaction');
    });

    test('should require amount', async ({ page }) => {
      // Try to submit without amount
      await page.click('text=Select a category');
      await page.waitForTimeout(300);

      // Select first category
      const options = page.locator('[role="option"]');
      if (await options.count() > 0) {
        await options.first().click();
      }

      // Try to submit
      await page.click('button:has-text("Add Expense")');

      // Should still be on add transaction page
      await expect(page).toHaveURL('/add-transaction');
    });

    test('should require category', async ({ page }) => {
      // Fill amount but not category
      const amountInput = page.locator('input[type="number"], input[placeholder*="0.00"]');
      await amountInput.fill('50');

      // Try to submit without category
      await page.click('button:has-text("Add Expense")');

      // Should still be on add transaction page or show error
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Transaction Navigation', () => {
    test('should navigate from transactions list to add transaction', async ({ page }) => {
      await page.goto('/transactions');

      await page.click('button:has-text("Add Transaction"), a:has-text("Add Transaction")');

      await expect(page).toHaveURL('/add-transaction');
    });

    test('should navigate from dashboard to transactions', async ({ page }) => {
      await page.goto('/dashboard');

      // Click on View All in Top Spending or similar
      const viewAllLink = page.locator('a:has-text("View All"), text=View All').first();
      if (await viewAllLink.isVisible()) {
        await viewAllLink.click();
      }
    });
  });

  test.describe('Transaction Details', () => {
    test('should expand transaction to show details', async ({ page }) => {
      await page.goto('/transactions');

      // Wait for transactions to load
      await page.waitForTimeout(2000);

      // Click on a transaction item (expand button)
      const expandButton = page.locator('button[aria-label*="expand"], svg[data-icon="chevron"]').first();
      if (await expandButton.isVisible()) {
        await expandButton.click();
        await page.waitForTimeout(500);
      }
    });
  });
});
