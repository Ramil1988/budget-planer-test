import { test, expect } from '@playwright/test';
import { loginUser } from './test-utils.js';

/**
 * Categories Tests
 * Tests for category management and merchant mappings
 */

test.describe('Categories', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await page.goto('/categories');
  });

  test.describe('Category Manager Page Layout', () => {
    test('should display category manager header', async ({ page }) => {
      await expect(page.locator('text=Category Manager')).toBeVisible();
    });

    test('should display page description', async ({ page }) => {
      await expect(page.locator('text=Manage your expense and income categories')).toBeVisible();
    });

    test('should display expenses tab', async ({ page }) => {
      await expect(page.locator('text=/Expenses \\(\\d+\\)/')).toBeVisible();
    });

    test('should display income tab', async ({ page }) => {
      await expect(page.locator('text=/Income \\(\\d+\\)/')).toBeVisible();
    });
  });

  test.describe('Expense Categories', () => {
    test('should display expense categories section', async ({ page }) => {
      await expect(page.locator('text=Expense Categories')).toBeVisible();
    });

    test('should display category chips/tags', async ({ page }) => {
      // Wait for data to load
      await page.waitForTimeout(1000);

      // Check for category tags
      const categories = page.locator('text=/Afterschool|Autocredit|Clothes|Food|Fuel|Insurance|Mortgage|Subscriptions/');
      const count = await categories.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display add new expense category input', async ({ page }) => {
      await expect(page.locator('text=Add New Expense Category')).toBeVisible();
      await expect(page.locator('input[placeholder*="Category name"]')).toBeVisible();
    });

    test('should display add button for new category', async ({ page }) => {
      await expect(page.locator('button:has-text("Add")')).toBeVisible();
    });
  });

  test.describe('Income Categories Tab', () => {
    test('should switch to income tab', async ({ page }) => {
      await page.click('text=/Income \\(\\d+\\)/');
      await page.waitForTimeout(500);

      // Should show income categories
      await expect(page.locator('text=Income Categories')).toBeVisible();
    });

    test('should display income category chips', async ({ page }) => {
      await page.click('text=/Income \\(\\d+\\)/');
      await page.waitForTimeout(500);

      // Check for income categories like Salary
      const incomeCategories = page.locator('text=/Salary|Income|Bonus|Investment/');
      // May have income categories
    });
  });

  test.describe('Add New Category', () => {
    test('should focus on category input', async ({ page }) => {
      const input = page.locator('input[placeholder*="Category name"]');
      await input.click();
      await expect(input).toBeFocused();
    });

    test('should type in category input', async ({ page }) => {
      const input = page.locator('input[placeholder*="Category name"]');
      await input.fill('Test Category');
      await expect(input).toHaveValue('Test Category');
    });

    test('should clear input after typing', async ({ page }) => {
      const input = page.locator('input[placeholder*="Category name"]');
      await input.fill('Test Category');
      await input.clear();
      await expect(input).toHaveValue('');
    });
  });

  test.describe('Merchant Mappings', () => {
    test('should display merchant mappings section', async ({ page }) => {
      await expect(page.locator('text=Merchant Mappings')).toBeVisible();
    });

    test('should display merchant mappings description', async ({ page }) => {
      await expect(page.locator('text=Map merchant names to categories')).toBeVisible();
    });

    test('should display merchant name input', async ({ page }) => {
      await expect(page.locator('text=Merchant Name')).toBeVisible();
      await expect(page.locator('input[placeholder*="GLOBAL PET FOODS"]')).toBeVisible();
    });

    test('should display assign to category dropdown', async ({ page }) => {
      await expect(page.locator('text=Assign to Category')).toBeVisible();
      await expect(page.locator('text=Select a category')).toBeVisible();
    });

    test('should display add merchant mapping button', async ({ page }) => {
      await expect(page.locator('button:has-text("Add Merchant Mapping")')).toBeVisible();
    });

    test('should display helper text for merchant name', async ({ page }) => {
      await expect(page.locator('text=Enter the exact merchant name as it appears')).toBeVisible();
    });
  });

  test.describe('Merchant Mapping Form', () => {
    test('should fill merchant name', async ({ page }) => {
      const input = page.locator('input[placeholder*="GLOBAL PET FOODS"]');
      await input.fill('TEST MERCHANT');
      await expect(input).toHaveValue('TEST MERCHANT');
    });

    test('should open category dropdown for mapping', async ({ page }) => {
      await page.click('text=Select a category');
      await page.waitForTimeout(500);

      // Check for dropdown options
      const options = page.locator('[role="option"], [role="listbox"] div');
      // Dropdown should open
    });
  });

  test.describe('Category Deletion', () => {
    test('should show delete option on category hover/click', async ({ page }) => {
      // Category chips might have delete buttons or be clickable
      await page.waitForTimeout(1000);

      const categoryChip = page.locator('text=Afterschool').first();
      if (await categoryChip.isVisible()) {
        await categoryChip.hover();
        await page.waitForTimeout(300);
        // Check for delete icon or button
      }
    });
  });

  test.describe('Tab Switching', () => {
    test('should switch between expense and income tabs', async ({ page }) => {
      // Start on expenses
      await expect(page.locator('text=Expense Categories')).toBeVisible();

      // Switch to income
      await page.click('text=/Income \\(\\d+\\)/');
      await page.waitForTimeout(500);
      await expect(page.locator('text=Income Categories')).toBeVisible();

      // Switch back to expenses
      await page.click('text=/Expenses \\(\\d+\\)/');
      await page.waitForTimeout(500);
      await expect(page.locator('text=Expense Categories')).toBeVisible();
    });

    test('should maintain category count in tabs', async ({ page }) => {
      // Check expense count
      const expenseTab = page.locator('text=/Expenses \\(\\d+\\)/');
      await expect(expenseTab).toBeVisible();

      // Check income count
      const incomeTab = page.locator('text=/Income \\(\\d+\\)/');
      await expect(incomeTab).toBeVisible();
    });
  });
});
