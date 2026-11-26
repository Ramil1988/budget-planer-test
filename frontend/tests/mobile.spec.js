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
      await expect(page.getByRole('link', { name: 'Get Started Free' }).first()).toBeVisible();
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
      await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Upcoming Payments' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Payment calendar', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('heading', { name: 'Where the money went' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      // Summary cards should be visible
      const summary = page.getByRole('region', { name: 'Monthly summary' });
      await expect(summary.getByText('Income', { exact: true })).toBeVisible();
      await expect(summary.getByText('Expenses', { exact: true })).toBeVisible();
    });

    test('should use the budget assistant on a narrow screen', async ({ page }) => {
      await page.goto('/dashboard');
      await page.getByRole('button', { name: 'Budget assistant', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Budget assistant' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('textbox')).toBeVisible();
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await dialog.getByRole('button', { name: 'Close budget assistant' }).click();
      await expect(dialog).toBeHidden();
    });

    test('should display transactions page correctly on mobile', async ({ page }) => {
      await page.goto('/transactions');

      await expect(page.getByRole('heading', { name: 'Transactions', level: 1 })).toBeVisible();
      await expect(page.getByLabel('Search transactions')).toBeVisible();
      await expect(page.locator('.tx-ledger')).toBeVisible();
    });

    test('should display budget page correctly on mobile', async ({ page }) => {
      await page.goto('/budget');

      await expect(page.getByRole('heading', { name: 'Monthly Budget' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Budget Tracking' })).toBeVisible();
      // Nothing on the page may be wider than the screen.
      await expect(page.locator('.bw-ledger')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('should display categories page correctly on mobile', async ({ page }) => {
      await page.goto('/categories');

      await expect(page.locator('text=Category Manager')).toBeVisible();
    });

    test('should display recurring page correctly on mobile', async ({ page }) => {
      await page.goto('/recurring');

      await expect(page.getByRole('heading', { name: 'Recurring Payments' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add recurring' })).toBeVisible();
      // Nothing on the page may be wider than the screen.
      await expect(page.locator('.recurring-strip')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('should display reports page correctly on mobile', async ({ page }) => {
      await page.goto('/reports');

      await expect(page.getByRole('heading', { name: 'Financial Report' })).toBeVisible();
      // Nothing on the page may be wider than the screen.
      await expect(page.locator('.reports-year')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('should display settings page correctly on mobile', async ({ page }) => {
      await page.goto('/settings');

      await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    });

    test('should display import page correctly on mobile', async ({ page }) => {
      await page.goto('/import');

      await expect(page.locator('text=Import Transactions')).toBeVisible();
    });

    test('should display add transaction page correctly on mobile', async ({ page }) => {
      await page.goto('/add-transaction');

      await expect(page.getByRole('heading', { name: 'Add transaction', level: 1 })).toBeVisible();
      const type = page.getByRole('group', { name: 'Type' });
      await expect(type.getByRole('button', { name: 'Expense' })).toBeVisible();
      await expect(type.getByRole('button', { name: 'Income' })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
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

      // The category is a native select: the phone shows its own picker for it.
      const category = page.getByLabel('Category');
      await expect(category).toBeVisible();
      expect(await category.locator('option').count()).toBeGreaterThan(1);
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

      // The year chart keeps all twelve months on a narrow screen, and the rankings follow it.
      await expect(page.locator('.reports-month')).toHaveCount(12);
      await expect(page.getByRole('region', { name: 'Where the money goes' })).toBeVisible();
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

    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  });
});
