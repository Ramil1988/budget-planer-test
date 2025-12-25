import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to home page', async ({ page }) => {
    await page.goto('/');

    // Check if we're on the home page
    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle(/BudgetWise/i);
  });

  test('should navigate to features page', async ({ page }) => {
    await page.goto('/');

    // Check if we're on mobile (viewport width < 768px)
    const viewportSize = page.viewportSize();
    const isMobile = viewportSize && viewportSize.width < 768;

    // If mobile, open the menu first
    if (isMobile) {
      const menuToggle = page.locator('.nav-toggle');
      await menuToggle.click();
      await page.waitForTimeout(300);
    }

    // Click on Features link in navigation
    await page.click('a[href="/features"]');

    // Verify we're on the features page
    await expect(page).toHaveURL('/features');
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');

    // Check if we're on mobile (viewport width < 768px)
    const viewportSize = page.viewportSize();
    const isMobile = viewportSize && viewportSize.width < 768;

    // If mobile, open the menu first
    if (isMobile) {
      const menuToggle = page.locator('.nav-toggle');
      await menuToggle.click();
      await page.waitForTimeout(300);
    }

    // Check that Home and Features links are visible
    const homeLink = page.locator('nav a[href="/"]');
    const featuresLink = page.locator('nav a[href="/features"]');

    await expect(homeLink).toBeVisible();
    await expect(featuresLink).toBeVisible();
  });

  test('should navigate back to home from features', async ({ page }) => {
    await page.goto('/features');

    // Check if we're on mobile (viewport width < 768px)
    const viewportSize = page.viewportSize();
    const isMobile = viewportSize && viewportSize.width < 768;

    // If mobile, open the menu first
    if (isMobile) {
      const menuToggle = page.locator('.nav-toggle');
      await menuToggle.click();
      await page.waitForTimeout(300);
    }

    // Click on Home link
    await page.click('a[href="/"]');

    // Verify we're back on the home page
    await expect(page).toHaveURL('/');
  });

  test('should have mobile menu toggle on small screens', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check if hamburger menu button is visible
    const menuToggle = page.locator('.nav-toggle');
    await expect(menuToggle).toBeVisible();
  });
});
