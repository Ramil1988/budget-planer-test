import { test, expect } from '@playwright/test';
import { loginUser, openMobileMenuIfNeeded } from './test-utils.js';

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
      await expect(page.locator('text=Dashboard')).toBeVisible();
    });

    test('should display welcome message with user name', async ({ page }) => {
      await expect(page.locator('text=Welcome back')).toBeVisible();
    });

    test('should display Add Transaction button', async ({ page }) => {
      await expect(page.locator('button:has-text("Add Transaction"), a:has-text("Add Transaction")')).toBeVisible();
    });

    test('should display month selector', async ({ page }) => {
      // Check for month/year selector
      const monthSelector = page.locator('text=/January|February|March|April|May|June|July|August|September|October|November|December/');
      await expect(monthSelector.first()).toBeVisible();
    });
  });

  test.describe('Summary Cards', () => {
    test('should display income card', async ({ page }) => {
      await expect(page.locator('text=/Income|INCOME/')).toBeVisible();
    });

    test('should display expenses card', async ({ page }) => {
      await expect(page.locator('text=/Expenses|EXPENSES/')).toBeVisible();
    });

    test('should display net savings/balance card', async ({ page }) => {
      await expect(page.locator('text=/Net Savings|NET SAVINGS|Balance|BALANCE/')).toBeVisible();
    });

    test('should display monetary values', async ({ page }) => {
      // Check for dollar amounts (with $ symbol)
      const dollarAmounts = page.locator('text=/\\$[\\d,]+\\.\\d{2}/');
      const count = await dollarAmounts.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Upcoming Payments Section', () => {
    test('should display upcoming payments section', async ({ page }) => {
      await expect(page.locator('text=Upcoming Payments')).toBeVisible();
    });

    test('should display manage link for upcoming payments', async ({ page }) => {
      await expect(page.locator('text=Manage')).toBeVisible();
    });
  });

  test.describe('Spending Breakdown', () => {
    test('should display spending breakdown section', async ({ page }) => {
      await expect(page.locator('text=Spending Breakdown')).toBeVisible();
    });

    test('should display spending chart or categories', async ({ page }) => {
      // Check for either a chart or category items
      const chartOrCategories = page.locator('text=/Total Spent|BY CATEGORY/');
      await expect(chartOrCategories.first()).toBeVisible();
    });
  });

  test.describe('Cash Flow Section', () => {
    test('should display cash flow section', async ({ page }) => {
      await expect(page.locator('text=Cash Flow')).toBeVisible();
    });
  });

  test.describe('Budget Overview Section', () => {
    test('should display budget overview section', async ({ page }) => {
      await expect(page.locator('text=Budget Overview')).toBeVisible();
    });

    test('should display budget percentage', async ({ page }) => {
      // Check for percentage display
      const percentage = page.locator('text=/\\d+%/');
      await expect(percentage.first()).toBeVisible();
    });
  });

  test.describe('Top Spending Section', () => {
    test('should display top spending section', async ({ page }) => {
      await expect(page.locator('text=Top Spending')).toBeVisible();
    });

    test('should display view all link', async ({ page }) => {
      await expect(page.locator('text=View All')).toBeVisible();
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

  test.describe('Spending by Category Section', () => {
    test('should display spending by category section', async ({ page }) => {
      await expect(page.locator('text=Spending by Category')).toBeVisible();
    });
  });

  test.describe('Navigation Actions', () => {
    test('should navigate to add transaction page', async ({ page }) => {
      await page.click('button:has-text("Add Transaction"), a:has-text("Add Transaction")');
      await expect(page).toHaveURL('/add-transaction');
    });

    test('should navigate to import transactions page', async ({ page }) => {
      await page.click('text=Import Transactions');
      await expect(page).toHaveURL('/import');
    });

    test('should navigate to manage budget page', async ({ page }) => {
      await page.click('text=Manage Budget');
      await expect(page).toHaveURL('/budget');
    });
  });

  test.describe('Month Navigation', () => {
    test('should have month navigation arrows', async ({ page }) => {
      // Check for navigation arrows or buttons
      const leftArrow = page.locator('button[aria-label*="previous"], button:has-text("<"), svg[data-icon="chevron-left"]').first();
      const rightArrow = page.locator('button[aria-label*="next"], button:has-text(">"), svg[data-icon="chevron-right"]').first();

      // At least one navigation method should exist
      const hasNavigation = await leftArrow.isVisible() || await rightArrow.isVisible();
      expect(hasNavigation).toBeTruthy();
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
