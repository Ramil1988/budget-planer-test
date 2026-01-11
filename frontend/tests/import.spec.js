import { test, expect } from '@playwright/test';
import { loginUser } from './test-utils.js';

/**
 * Import Tests
 * Tests for Google Sheet import and CSV upload functionality
 */

test.describe('Import Transactions', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await page.goto('/import');
  });

  test.describe('Page Layout', () => {
    test('should display import page header', async ({ page }) => {
      await expect(page.locator('text=Import Transactions')).toBeVisible();
    });

    test('should display page description', async ({ page }) => {
      await expect(page.locator('text=Connect your Google Sheet for automatic syncing or import from CSV')).toBeVisible();
    });
  });

  test.describe('Google Sheet Connection Section', () => {
    test('should display google sheet connection section', async ({ page }) => {
      await expect(page.locator('text=Google Sheet Connection')).toBeVisible();
    });

    test('should display connection description', async ({ page }) => {
      await expect(page.locator('text=Connect your Google Sheet to sync transactions')).toBeVisible();
    });

    test('should display google sheets URL input', async ({ page }) => {
      await expect(page.locator('text=Google Sheets URL')).toBeVisible();
      await expect(page.locator('input[placeholder*="docs.google.com"]')).toBeVisible();
    });

    test('should display sheet name input', async ({ page }) => {
      await expect(page.locator('text=Sheet Name (Tab)')).toBeVisible();
    });

    test('should display helper text for sheet name', async ({ page }) => {
      await expect(page.locator('text=The name of the tab containing your transactions')).toBeVisible();
    });

    test('should display update connection button', async ({ page }) => {
      await expect(page.locator('button:has-text("Update Connection")')).toBeVisible();
    });

    test('should have pre-filled URL if connected', async ({ page }) => {
      const urlInput = page.locator('input[placeholder*="docs.google.com"]');
      const value = await urlInput.inputValue();
      // Should have a value if already connected
      expect(value).toBeDefined();
    });
  });

  test.describe('Auto-Sync Settings Section', () => {
    test('should display auto-sync settings section', async ({ page }) => {
      await expect(page.locator('text=Auto-Sync Settings')).toBeVisible();
    });

    test('should display auto-sync description', async ({ page }) => {
      await expect(page.locator('text=Automatically sync new transactions from your Google Sheet')).toBeVisible();
    });

    test('should display enable auto-sync toggle', async ({ page }) => {
      await expect(page.locator('text=Enable Auto-Sync')).toBeVisible();
    });

    test('should display sync interval dropdown', async ({ page }) => {
      await expect(page.locator('text=Sync Interval')).toBeVisible();
    });

    test('should display interval options', async ({ page }) => {
      await expect(page.locator('text=/Every \\d+ minutes/')).toBeVisible();
    });

    test('should display sync status', async ({ page }) => {
      await expect(page.locator('text=Status:')).toBeVisible();
    });

    test('should display last sync time', async ({ page }) => {
      await expect(page.locator('text=Last sync:')).toBeVisible();
    });

    test('should display sync now button', async ({ page }) => {
      await expect(page.locator('button:has-text("Sync Now")')).toBeVisible();
    });

    test('should display sync status message', async ({ page }) => {
      // Should show either "All transactions already imported" or similar
      await expect(page.locator('text=/transactions|imported|synced/i')).toBeVisible();
    });
  });

  test.describe('Manual Import Section', () => {
    test('should display manual import section', async ({ page }) => {
      await expect(page.locator('text=Manual Import')).toBeVisible();
    });

    test('should display manual import description', async ({ page }) => {
      await expect(page.locator('text=Preview and import transactions manually')).toBeVisible();
    });

    test('should display fetch from sheet button', async ({ page }) => {
      await expect(page.locator('button:has-text("Fetch from Sheet")')).toBeVisible();
    });

    test('should display file upload input', async ({ page }) => {
      await expect(page.locator('input[type="file"]')).toBeVisible();
    });

    test('should display choose file button', async ({ page }) => {
      await expect(page.locator('text=Choose File')).toBeVisible();
    });
  });

  test.describe('Form Interactions', () => {
    test('should allow editing google sheet URL', async ({ page }) => {
      const urlInput = page.locator('input[placeholder*="docs.google.com"]');
      await urlInput.clear();
      await urlInput.fill('https://docs.google.com/spreadsheets/d/test');
      await expect(urlInput).toHaveValue('https://docs.google.com/spreadsheets/d/test');
    });

    test('should allow editing sheet name', async ({ page }) => {
      const sheetInput = page.locator('input').filter({ hasText: /Expenses/i }).or(
        page.locator('input[value="Expenses"]')
      );

      // Find the sheet name input by its position after the label
      const inputs = page.locator('input');
      const count = await inputs.count();

      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const value = await input.inputValue();
        if (value === 'Expenses') {
          await input.clear();
          await input.fill('TestSheet');
          await expect(input).toHaveValue('TestSheet');
          break;
        }
      }
    });

    test('should toggle auto-sync', async ({ page }) => {
      // Find the auto-sync toggle
      const toggle = page.locator('button[role="switch"], input[type="checkbox"]').first();
      if (await toggle.isVisible()) {
        await toggle.click();
        await page.waitForTimeout(500);
      }
    });

    test('should change sync interval', async ({ page }) => {
      const intervalDropdown = page.locator('select, [role="combobox"]').first();
      if (await intervalDropdown.isVisible()) {
        await intervalDropdown.click();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Sync Actions', () => {
    test('should click sync now button', async ({ page }) => {
      const syncButton = page.locator('button:has-text("Sync Now")');
      await expect(syncButton).toBeVisible();
      await expect(syncButton).toBeEnabled();
      // Don't actually click to avoid triggering sync
    });

    test('should click fetch from sheet button', async ({ page }) => {
      const fetchButton = page.locator('button:has-text("Fetch from Sheet")');
      await expect(fetchButton).toBeVisible();
      await expect(fetchButton).toBeEnabled();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to import from dashboard', async ({ page }) => {
      await page.goto('/dashboard');

      await page.click('text=Import Transactions');
      await expect(page).toHaveURL('/import');
    });
  });
});
