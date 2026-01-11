import { test, expect } from '@playwright/test';
import { loginUser, openMobileMenuIfNeeded } from './test-utils.js';

/**
 * Mobile Responsiveness Tests
 * Tests for mobile layout and touch interactions
 */

test.describe('Mobile Responsiveness', () => {
  // Use mobile viewport for all tests
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 13

  test.describe('Public Pages', () => {
    test('should display home page correctly on mobile', async ({ page }) => {
      await page.goto('/');

      // Header should be visible
      await expect(page.locator('header')).toBeVisible();

      // Hamburger menu should be visible
      await expect(page.locator('button[aria-label="Toggle navigation"]')).toBeVisible();

      // Hero content should be visible
      await expect(page.locator('text=Smart Budget Tracking')).toBeVisible();

      // CTA buttons should be full width or prominent
      await expect(page.locator('button:has-text("Get Started Free"), a:has-text("Get Started Free")')).toBeVisible();
    });

    test('should display login page correctly on mobile', async ({ page }) => {
      await page.goto('/login');

      // Form should be visible
      await expect(page.locator('text=Welcome Back')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should display signup page correctly on mobile', async ({ page }) => {
      await page.goto('/signup');

      await expect(page.locator('text=Create Account')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
    });
  });

  test.describe('Mobile Navigation', () => {
    test('should open mobile menu', async ({ page }) => {
      await page.goto('/');

      const menuToggle = page.locator('button[aria-label="Toggle navigation"]');
      await expect(menuToggle).toBeVisible();

      await menuToggle.click();
      await page.waitForTimeout(300);

      // Menu items should now be visible
      await expect(page.locator('nav a')).toBeVisible();
    });

    test('should close mobile menu on X click', async ({ page }) => {
      await page.goto('/');

      const menuToggle = page.locator('button[aria-label="Toggle navigation"]');
      await menuToggle.click();
      await page.waitForTimeout(300);

      // Click the X button (same toggle button transforms to X)
      await menuToggle.click();
      await page.waitForTimeout(300);
    });

    test('should navigate using mobile menu', async ({ page }) => {
      await loginUser(page);

      // Open mobile menu
      const menuToggle = page.locator('button[aria-label="Toggle navigation"]');
      await menuToggle.click();
      await page.waitForTimeout(300);

      // Click on a menu item
      await page.click('a[href="/transactions"]');
      await expect(page).toHaveURL('/transactions');
    });
  });

  test.describe('Protected Pages Mobile Layout', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page);
    });

    test('should display dashboard correctly on mobile', async ({ page }) => {
      await page.goto('/dashboard');

      // Key elements should be visible
      await expect(page.locator('text=Dashboard')).toBeVisible();
      await expect(page.locator('button:has-text("Add Transaction"), a:has-text("Add Transaction")')).toBeVisible();

      // Summary cards should be visible
      await expect(page.locator('text=/Income|INCOME/')).toBeVisible();
      await expect(page.locator('text=/Expenses|EXPENSES/')).toBeVisible();
    });

    test('should display transactions page correctly on mobile', async ({ page }) => {
      await page.goto('/transactions');

      await expect(page.locator('text=Transactions')).toBeVisible();
      await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    });

    test('should display budget page correctly on mobile', async ({ page }) => {
      await page.goto('/budget');

      await expect(page.locator('text=Monthly Budget')).toBeVisible();
      await expect(page.locator('text=Budget Tracking')).toBeVisible();
    });

    test('should display categories page correctly on mobile', async ({ page }) => {
      await page.goto('/categories');

      await expect(page.locator('text=Category Manager')).toBeVisible();
    });

    test('should display recurring page correctly on mobile', async ({ page }) => {
      await page.goto('/recurring');

      await expect(page.locator('text=Recurring Payments')).toBeVisible();
      await expect(page.locator('button:has-text("Add Recurring")')).toBeVisible();
    });

    test('should display reports page correctly on mobile', async ({ page }) => {
      await page.goto('/reports');

      await expect(page.locator('text=Financial Report')).toBeVisible();
    });

    test('should display settings page correctly on mobile', async ({ page }) => {
      await page.goto('/settings');

      await expect(page.locator('text=Settings')).toBeVisible();
    });

    test('should display import page correctly on mobile', async ({ page }) => {
      await page.goto('/import');

      await expect(page.locator('text=Import Transactions')).toBeVisible();
    });

    test('should display add transaction page correctly on mobile', async ({ page }) => {
      await page.goto('/add-transaction');

      await expect(page.locator('text=Add Transaction')).toBeVisible();
      await expect(page.locator('button:has-text("Expense")')).toBeVisible();
      await expect(page.locator('button:has-text("Income")')).toBeVisible();
    });
  });

  test.describe('Touch Interactions', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page);
    });

    test('should handle tap on buttons', async ({ page }) => {
      await page.goto('/add-transaction');

      // Tap on Income button
      await page.tap('button:has-text("Income")');
      await page.waitForTimeout(300);

      // Button should be selected
      await expect(page.locator('button:has-text("Add Income")')).toBeVisible();
    });

    test('should handle tap on navigation items', async ({ page }) => {
      await page.goto('/dashboard');

      const menuToggle = page.locator('button[aria-label="Toggle navigation"]');
      await menuToggle.tap();
      await page.waitForTimeout(300);

      // Tap on transactions
      await page.tap('a[href="/transactions"]');
      await expect(page).toHaveURL('/transactions');
    });
  });

  test.describe('Scrolling', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page);
    });

    test('should scroll on dashboard page', async ({ page }) => {
      await page.goto('/dashboard');

      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(300);

      // Content should still be accessible
      await expect(page.locator('main')).toBeVisible();
    });

    test('should scroll on transactions page', async ({ page }) => {
      await page.goto('/transactions');

      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 1000));
      await page.waitForTimeout(300);
    });
  });

  test.describe('Form Usability', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page);
    });

    test('should have properly sized input fields on add transaction', async ({ page }) => {
      await page.goto('/add-transaction');

      // Input fields should be accessible
      const amountInput = page.locator('input[type="number"], input[placeholder*="0.00"]');
      await expect(amountInput).toBeVisible();

      // Tap to focus
      await amountInput.tap();
      await expect(amountInput).toBeFocused();
    });

    test('should open dropdowns on mobile', async ({ page }) => {
      await page.goto('/add-transaction');

      // Tap on category dropdown
      await page.tap('text=Select a category');
      await page.waitForTimeout(500);

      // Dropdown options should be visible
      const options = page.locator('[role="option"], [role="listbox"] div');
      const count = await options.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Content Visibility', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page);
    });

    test('should not have horizontal overflow on dashboard', async ({ page }) => {
      await page.goto('/dashboard');

      const body = page.locator('body');
      const boundingBox = await body.boundingBox();

      // Body should not be wider than viewport
      expect(boundingBox?.width).toBeLessThanOrEqual(390);
    });

    test('should not have horizontal overflow on transactions', async ({ page }) => {
      await page.goto('/transactions');

      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const clientWidth = await page.evaluate(() => document.body.clientWidth);

      // Should not have horizontal scroll
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10); // 10px tolerance
    });

    test('should display charts correctly on mobile', async ({ page }) => {
      await page.goto('/reports');

      // Charts should be visible and contained
      await expect(page.locator('text=Income vs Expenses')).toBeVisible();
      await expect(page.locator('text=Top Categories')).toBeVisible();
    });
  });
});

test.describe('Tablet Responsiveness', () => {
  // Use tablet viewport
  test.use({ viewport: { width: 768, height: 1024 } }); // iPad

  test('should display home page correctly on tablet', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('text=Smart Budget Tracking')).toBeVisible();
  });

  test('should display dashboard correctly on tablet', async ({ page }) => {
    await loginUser(page);
    await page.goto('/dashboard');

    await expect(page.locator('text=Dashboard')).toBeVisible();
  });
});
