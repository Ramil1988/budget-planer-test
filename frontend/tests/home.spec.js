import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the hero section', async ({ page }) => {
    // Check for hero heading
    const heroHeading = page.locator('.hero h1');
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toContainText(/budget/i);
  });

  test('should display feature cards', async ({ page }) => {
    // Check that feature cards are present
    const featureCards = page.locator('.feature-card');
    const count = await featureCards.count();

    // Expect at least one feature card
    expect(count).toBeGreaterThan(0);
  });

  test('should have a call-to-action button', async ({ page }) => {
    // Look for CTA button in hero section
    const ctaButton = page.locator('.hero .btn, .hero-buttons .btn').first();
    await expect(ctaButton).toBeVisible();
  });

  test('should display footer', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('should have scroll-to-top button after scrolling', async ({ page }) => {
    // Scroll down the page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait a bit for the scroll-to-top button to appear
    await page.waitForTimeout(500);

    // Check if scroll-to-top button is visible
    const scrollButton = page.locator('.scroll-top-btn');
    await expect(scrollButton).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check that main content is visible
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();

    // Check that images or content don't overflow significantly (allow some tolerance for scrollbars)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(450);
  });
});
