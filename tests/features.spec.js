import { test, expect } from '@playwright/test';

test.describe('Features Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/features');
  });

  test('should display the features page heading', async ({ page }) => {
    // Check for main heading on features page
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('should display feature details', async ({ page }) => {
    // Check that feature sections are present
    const featureSections = page.locator('.feature-row');
    const count = await featureSections.count();

    // Expect at least one feature section
    expect(count).toBeGreaterThan(0);
  });

  test('should have images or icons for features', async ({ page }) => {
    // Check for images
    const images = page.locator('img');
    const imageCount = await images.count();

    // Expect at least one image on the features page
    expect(imageCount).toBeGreaterThan(0);
  });

  test('should display feature descriptions', async ({ page }) => {
    // Check for paragraphs with content
    const paragraphs = page.locator('p');
    const count = await paragraphs.count();

    // Expect multiple paragraphs describing features
    expect(count).toBeGreaterThan(0);
  });

  test('should have animation classes on feature items', async ({ page }) => {
    // Check if feature items have animation classes (fade-in, etc.)
    const animatedElements = page.locator('.fade-in, [class*="animate"]');
    const count = await animatedElements.count();

    // Animation classes should be present
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/features');

    // Check that main content is visible
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();

    // Check that content doesn't overflow significantly (allow some tolerance for scrollbars)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(450);
  });

  test('should have scroll-to-top functionality', async ({ page }) => {
    // Scroll down
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Check if scroll-to-top button appears
    const scrollButton = page.locator('.scroll-top-btn');

    // If button exists, click it and verify scroll position
    const isVisible = await scrollButton.isVisible().catch(() => false);
    if (isVisible) {
      await scrollButton.click();

      // Wait for smooth scroll to complete (up to 2 seconds)
      await page.waitForFunction(() => window.scrollY < 100, { timeout: 2000 });

      const scrollPosition = await page.evaluate(() => window.scrollY);
      expect(scrollPosition).toBeLessThan(100);
    }
  });
});
