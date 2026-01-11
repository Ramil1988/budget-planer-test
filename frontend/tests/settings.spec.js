import { test, expect } from '@playwright/test';
import { loginUser, TEST_USER } from './test-utils.js';

/**
 * Settings Tests
 * Tests for user settings and account management
 */

test.describe('Settings', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await page.goto('/settings');
  });

  test.describe('Page Layout', () => {
    test('should display settings header', async ({ page }) => {
      await expect(page.locator('text=Settings')).toBeVisible();
    });

    test('should display page description', async ({ page }) => {
      await expect(page.locator('text=Manage your account settings')).toBeVisible();
    });
  });

  test.describe('Push Notifications Section', () => {
    test('should display push notifications section', async ({ page }) => {
      await expect(page.locator('text=Push Notifications')).toBeVisible();
    });

    test('should display notification status', async ({ page }) => {
      await expect(page.locator('text=Status:')).toBeVisible();
    });

    test('should display status badge', async ({ page }) => {
      // Should show either "Enabled" or "Not Enabled"
      await expect(page.locator('text=/Enabled|Not Enabled/')).toBeVisible();
    });

    test('should display enable notifications button', async ({ page }) => {
      await expect(page.locator('button:has-text("Enable Notifications")')).toBeVisible();
    });
  });

  test.describe('Account Information Section', () => {
    test('should display account information section', async ({ page }) => {
      await expect(page.locator('text=Account Information')).toBeVisible();
    });

    test('should display email label', async ({ page }) => {
      await expect(page.locator('text=Email:')).toBeVisible();
    });

    test('should display user email', async ({ page }) => {
      await expect(page.locator(`text=${TEST_USER.email}`)).toBeVisible();
    });

    test('should display user ID label', async ({ page }) => {
      await expect(page.locator('text=User ID:')).toBeVisible();
    });

    test('should display user ID value', async ({ page }) => {
      // User ID is a UUID-like string
      await expect(page.locator('text=/[a-f0-9-]{36}/')).toBeVisible();
    });
  });

  test.describe('Google Sheet Sync Info', () => {
    test('should display google sheet sync info card', async ({ page }) => {
      await expect(page.locator('text=Looking for Google Sheet sync?')).toBeVisible();
    });

    test('should display link to import page', async ({ page }) => {
      await expect(page.locator('text=Import')).toBeVisible();
    });

    test('should navigate to import page from info card', async ({ page }) => {
      await page.click('a:has-text("Import")');
      await expect(page).toHaveURL('/import');
    });
  });

  test.describe('Notification Enable Flow', () => {
    test('should click enable notifications button', async ({ page }) => {
      const enableButton = page.locator('button:has-text("Enable Notifications")');

      if (await enableButton.isVisible()) {
        // Just verify button is clickable - don't actually enable
        // as it requires browser permissions
        await expect(enableButton).toBeEnabled();
      }
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to settings from dashboard', async ({ page }) => {
      await page.goto('/dashboard');

      // Open mobile menu if needed
      const menuToggle = page.locator('button[aria-label="Toggle navigation"]');
      if (await menuToggle.isVisible()) {
        await menuToggle.click();
        await page.waitForTimeout(300);
      }

      await page.click('a[href="/settings"]');
      await expect(page).toHaveURL('/settings');
    });
  });
});
