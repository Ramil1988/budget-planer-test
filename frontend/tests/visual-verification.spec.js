import { test, expect } from '@playwright/test';

/**
 * Visual Verification Tests
 * These tests generate screenshots to verify the app visually
 */

test.describe('Visual Verification', () => {
  test('Homepage - Desktop View', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Take full page screenshot
    await page.screenshot({
      path: 'test-results/screenshots/01-homepage-desktop.png',
      fullPage: true
    });

    // Verify hero section is visible
    await expect(page.locator('.hero h1')).toBeVisible();
  });

  test('Homepage - Mobile View', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({
      path: 'test-results/screenshots/02-homepage-mobile.png',
      fullPage: true
    });

    // Verify mobile menu toggle is visible
    await expect(page.locator('.nav-toggle')).toBeVisible();
  });

  test('Features Page - Desktop View', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/features');

    await page.waitForLoadState('networkidle');

    // Take full page screenshot
    await page.screenshot({
      path: 'test-results/screenshots/03-features-desktop.png',
      fullPage: true
    });

    // Verify feature rows are visible
    await expect(page.locator('.feature-row').first()).toBeVisible();
  });

  test('Features Page - Mobile View', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/features');

    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({
      path: 'test-results/screenshots/04-features-mobile.png',
      fullPage: true
    });
  });

  test('Mobile Menu Interaction', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await page.waitForLoadState('networkidle');

    // Screenshot 1: Menu closed
    await page.screenshot({
      path: 'test-results/screenshots/05-mobile-menu-closed.png'
    });

    // Click menu toggle
    await page.click('.nav-toggle');
    await page.waitForTimeout(500);

    // Screenshot 2: Menu open
    await page.screenshot({
      path: 'test-results/screenshots/06-mobile-menu-open.png'
    });

    // Verify navigation is visible
    await expect(page.locator('nav a[href="/features"]')).toBeVisible();
  });

  test('Scroll Button Functionality', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await page.waitForLoadState('networkidle');

    // Screenshot 1: Top of page (no scroll button)
    await page.screenshot({
      path: 'test-results/screenshots/07-scroll-top.png'
    });

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(600);

    // Screenshot 2: Scrolled down (button visible)
    await page.screenshot({
      path: 'test-results/screenshots/08-scroll-button-visible.png'
    });

    // Click scroll button
    const scrollButton = page.locator('.scroll-top-btn');
    if (await scrollButton.isVisible()) {
      await scrollButton.click();
      await page.waitForFunction(() => window.scrollY < 100, { timeout: 2000 });

      // Screenshot 3: Back at top
      await page.screenshot({
        path: 'test-results/screenshots/09-scroll-back-to-top.png'
      });
    }
  });

  test('Navigation Flow', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Start at home
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'test-results/screenshots/10-nav-step1-home.png'
    });

    // Navigate to features
    await page.click('a[href="/features"]');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'test-results/screenshots/11-nav-step2-features.png',
      fullPage: true
    });

    // Navigate back to home
    await page.click('a[href="/"]');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'test-results/screenshots/12-nav-step3-back-home.png'
    });

    // Verify we're back at home
    await expect(page).toHaveURL('/');
  });

  test('Feature Cards - Visual Check', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await page.waitForLoadState('networkidle');

    // Scroll to feature cards section
    await page.locator('.features-preview').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Screenshot of feature cards
    await page.screenshot({
      path: 'test-results/screenshots/13-feature-cards.png'
    });

    // Verify all 3 feature cards are visible
    const cards = page.locator('.feature-card');
    const count = await cards.count();
    expect(count).toBe(3);
  });

  test('Hero Section - Visual Check', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await page.waitForLoadState('networkidle');

    // Focus on hero section
    const hero = page.locator('.hero');
    await hero.screenshot({
      path: 'test-results/screenshots/14-hero-section.png'
    });

    // Verify hero elements
    await expect(hero.locator('h1')).toBeVisible();
    await expect(hero.locator('.btn')).toBeVisible();
  });

  test('Responsive Breakpoints', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: '15-mobile-375' },
      { width: 768, height: 1024, name: '16-tablet-768' },
      { width: 1024, height: 768, name: '17-laptop-1024' },
      { width: 1920, height: 1080, name: '18-desktop-1920' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: `test-results/screenshots/${viewport.name}.png`,
        fullPage: true
      });

      // Verify main content is visible at all breakpoints
      await expect(page.locator('main')).toBeVisible();
    }
  });
});
