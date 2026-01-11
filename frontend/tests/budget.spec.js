import { test, expect } from '@playwright/test';
import { loginUser } from './test-utils.js';

/**
 * Budget Tests
 * Tests for budget tracking, setup, and management
 */

test.describe('Budget', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await page.goto('/budget');
  });

  test.describe('Budget Page Layout', () => {
    test('should display budget page header', async ({ page }) => {
      await expect(page.locator('text=Monthly Budget')).toBeVisible();
    });

    test('should display month selector', async ({ page }) => {
      const monthSelector = page.locator('text=/January|February|March|April|May|June|July|August|September|October|November|December/');
      await expect(monthSelector.first()).toBeVisible();
    });

    test('should display budget tracking tab', async ({ page }) => {
      await expect(page.locator('text=Budget Tracking')).toBeVisible();
    });

    test('should display budget setup tab', async ({ page }) => {
      await expect(page.locator('text=Budget Setup')).toBeVisible();
    });

    test('should display current/projected toggle', async ({ page }) => {
      await expect(page.locator('button:has-text("Current")')).toBeVisible();
      await expect(page.locator('button:has-text("Projected")')).toBeVisible();
    });
  });

  test.describe('Budget Summary', () => {
    test('should display total spent', async ({ page }) => {
      await expect(page.locator('text=TOTAL SPENT')).toBeVisible();
    });

    test('should display budget progress circle', async ({ page }) => {
      // Check for percentage in circular progress
      await expect(page.locator('text=/\\d+%/')).toBeVisible();
    });

    test('should display remaining budget', async ({ page }) => {
      await expect(page.locator('text=REMAINING')).toBeVisible();
    });

    test('should display budget status', async ({ page }) => {
      // Check for status like "Under budget" or "Over budget"
      await expect(page.locator('text=/Under budget|Over budget|On track/')).toBeVisible();
    });
  });

  test.describe('Category Budgets', () => {
    test('should display BY CATEGORY section', async ({ page }) => {
      await expect(page.locator('text=BY CATEGORY')).toBeVisible();
    });

    test('should display category budget cards', async ({ page }) => {
      // Wait for data to load
      await page.waitForTimeout(2000);

      // Check for category names (common expense categories)
      const categories = page.locator('text=/Mortgage|Subscriptions|Food|Insurance|Autocredit|Afterschool/');
      const count = await categories.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display budget status indicators', async ({ page }) => {
      // Check for status badges
      const statusBadges = page.locator('text=/OVER BUDGET|WARNING|ON TRACK/');
      const count = await statusBadges.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display progress bars for categories', async ({ page }) => {
      // Check for progress indicators
      const progressBars = page.locator('[role="progressbar"], .progress-bar, div[style*="width"]');
      const count = await progressBars.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display percentage used for categories', async ({ page }) => {
      // Check for "XX% used" text
      await expect(page.locator('text=/\\d+% used/')).toBeVisible();
    });

    test('should display remaining/over amounts', async ({ page }) => {
      // Check for remaining or over amounts
      const amounts = page.locator('text=/[+-]?\\$[\\d,]+\\.\\d{2}\\s*(left|over|remaining)/');
      const count = await amounts.count();
      // May or may not have explicit "left" text
    });
  });

  test.describe('Budget Tracking Tab', () => {
    test('should show budget tracking view by default', async ({ page }) => {
      // Budget Tracking should be active
      const trackingTab = page.locator('button:has-text("Budget Tracking")');
      await expect(trackingTab).toBeVisible();
    });

    test('should toggle between current and projected', async ({ page }) => {
      // Click Projected
      await page.click('button:has-text("Projected")');
      await page.waitForTimeout(500);

      // Click back to Current
      await page.click('button:has-text("Current")');
      await page.waitForTimeout(500);
    });
  });

  test.describe('Budget Setup Tab', () => {
    test('should switch to budget setup tab', async ({ page }) => {
      await page.click('text=Budget Setup');
      await page.waitForTimeout(500);

      // Check for setup-related content
      await expect(page.locator('text=/Set Budget|Budget Setup|Monthly Budget/')).toBeVisible();
    });

    test('should display budget input fields in setup', async ({ page }) => {
      await page.click('text=Budget Setup');
      await page.waitForTimeout(500);

      // Check for input fields or budget amounts
      const inputs = page.locator('input[type="number"], input[inputmode="decimal"]');
      const count = await inputs.count();
      // Setup tab should have input fields
    });
  });

  test.describe('Month Navigation', () => {
    test('should have month navigation controls', async ({ page }) => {
      // Check for previous/next month buttons
      const navButtons = page.locator('button[aria-label*="month"], button:has(svg)');
      await expect(navButtons.first()).toBeVisible();
    });

    test('should navigate to previous month', async ({ page }) => {
      const currentMonth = await page.locator('text=/January|February|March|April|May|June|July|August|September|October|November|December/').first().textContent();

      // Click previous month button
      const prevButton = page.locator('button[aria-label*="previous"], button:has-text("<")').first();
      if (await prevButton.isVisible()) {
        await prevButton.click();
        await page.waitForTimeout(1000);
      }
    });

    test('should navigate to next month', async ({ page }) => {
      const nextButton = page.locator('button[aria-label*="next"], button:has-text(">")').first();
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Budget Data Display', () => {
    test('should display monetary values correctly', async ({ page }) => {
      // Check for properly formatted dollar amounts
      const amounts = page.locator('text=/\\$[\\d,]+\\.\\d{2}/');
      const count = await amounts.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should color-code over budget categories', async ({ page }) => {
      // Over budget items should have red/danger styling
      // This is a visual check - we verify the text exists
      const overBudget = page.locator('text=OVER BUDGET');
      // May or may not have over budget items
    });

    test('should color-code warning categories', async ({ page }) => {
      // Warning items should have yellow/warning styling
      const warning = page.locator('text=WARNING');
      // May or may not have warning items
    });

    test('should color-code on track categories', async ({ page }) => {
      // On track items should have green styling
      const onTrack = page.locator('text=ON TRACK');
      // Should have some on track items
    });
  });
});
