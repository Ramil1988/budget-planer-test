import { test, expect } from '@playwright/test';

/**
 * Example test file demonstrating various Playwright capabilities
 * This can be used as a reference for writing new tests
 */

test.describe('Example Tests', () => {
  test('basic page load test', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');

    // Check the page title
    await expect(page).toHaveTitle(/BudgetWise/i);

    // Take a screenshot (useful for debugging)
    await page.screenshot({ path: 'playwright-report/screenshots/home-page.png' });
  });

  test('element visibility test', async ({ page }) => {
    await page.goto('/');

    // Check if header is visible
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check if we're on mobile (viewport width < 768px)
    const viewportSize = page.viewportSize();
    const isMobile = viewportSize && viewportSize.width < 768;

    if (isMobile) {
      // On mobile, check if nav toggle is visible
      const navToggle = page.locator('.nav-toggle');
      await expect(navToggle).toBeVisible();
    } else {
      // On desktop, check if navigation is visible
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();
    }
  });

  test('clicking and navigation test', async ({ page }) => {
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

    // Click a link and wait for navigation
    const featuresLink = page.locator('a[href="/features"]').first();
    await featuresLink.click();

    // Wait for URL to change
    await expect(page).toHaveURL('/features');
  });

  test('responsive design test', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Verify content is accessible
    await expect(page.locator('main')).toBeVisible();

    // Change to tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // Verify content still accessible
    await expect(page.locator('main')).toBeVisible();

    // Change to desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Verify content still accessible
    await expect(page.locator('main')).toBeVisible();
  });

  test('accessibility - check for alt text on images', async ({ page }) => {
    await page.goto('/');

    // Get all images
    const images = page.locator('img');
    const count = await images.count();

    // Check that each image has alt text
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const altText = await img.getAttribute('alt');

      // Alt text should exist (even if empty for decorative images)
      expect(altText).not.toBeNull();
    }
  });

  test('page performance - check load time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');

    const loadTime = Date.now() - startTime;

    // Page should load in less than 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
});
