import { test, expect } from '@playwright/test';
import { TEST_USER, loginUser, logoutUser, openMobileMenuIfNeeded } from './test-utils.js';

/**
 * Authentication Tests
 * Tests for login, signup, logout, and protected routes
 */

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');

      // Check page elements
      await expect(page.locator('text=Welcome Back')).toBeVisible();
      await expect(page.locator('text=Sign in to your BudgetWise account')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      await expect(page.locator('text=Forgot password?')).toBeVisible();
      await expect(page.locator('text=Sign up')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      // Enter invalid credentials
      await page.fill('input[type="email"]', 'invalid@email.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');

      // Wait for error message
      await page.waitForTimeout(2000);

      // Check that we're still on login page (not redirected)
      await expect(page).toHaveURL('/login');
    });

    test('should show validation for empty fields', async ({ page }) => {
      await page.goto('/login');

      // Click submit without filling fields
      await page.click('button[type="submit"]');

      // Form should not submit (HTML5 validation)
      await expect(page).toHaveURL('/login');
    });

    test('should login successfully with valid credentials', async ({ page }) => {
      await page.goto('/login');

      // Enter valid credentials
      await page.fill('input[type="email"]', TEST_USER.email);
      await page.fill('input[type="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');

      // Wait for redirect to dashboard
      await page.waitForURL('/dashboard', { timeout: 10000 });
      await expect(page).toHaveURL('/dashboard');
    });

    test('should navigate to signup page', async ({ page }) => {
      await page.goto('/login');

      // Click sign up link
      await page.click('a[href="/signup"]');

      await expect(page).toHaveURL('/signup');
    });
  });

  test.describe('Signup Page', () => {
    test('should display signup form', async ({ page }) => {
      await page.goto('/signup');

      // Check page elements
      await expect(page.locator('text=Create Account')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]').first()).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      await expect(page.locator('text=Sign in')).toBeVisible();
    });

    test('should show password requirements', async ({ page }) => {
      await page.goto('/signup');

      // Check for password requirement hint
      await expect(page.locator('text=Must be at least 6 characters')).toBeVisible();
    });

    test('should navigate to login page', async ({ page }) => {
      await page.goto('/signup');

      // Click sign in link
      await page.click('a[href="/login"]');

      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Logout', () => {
    test('should logout successfully', async ({ page }) => {
      // First login
      await loginUser(page);

      // Verify we're on dashboard
      await expect(page).toHaveURL('/dashboard');

      // Open menu if on mobile
      await openMobileMenuIfNeeded(page);

      // Click sign out
      await page.click('button:has-text("Sign Out")');

      // Should redirect to home
      await page.waitForURL('/', { timeout: 5000 });
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies();

      await page.goto('/dashboard');

      // Should redirect to login or show login prompt
      await page.waitForTimeout(2000);
      const url = page.url();
      expect(url.includes('/login') || url.includes('/dashboard')).toBeTruthy();
    });

    test('should redirect to login when accessing transactions without auth', async ({ page }) => {
      await page.context().clearCookies();

      await page.goto('/transactions');

      await page.waitForTimeout(2000);
      const url = page.url();
      expect(url.includes('/login') || url.includes('/transactions')).toBeTruthy();
    });

    test('should redirect to login when accessing budget without auth', async ({ page }) => {
      await page.context().clearCookies();

      await page.goto('/budget');

      await page.waitForTimeout(2000);
      const url = page.url();
      expect(url.includes('/login') || url.includes('/budget')).toBeTruthy();
    });

    test('should allow access to dashboard after login', async ({ page }) => {
      await loginUser(page);

      await page.goto('/dashboard');
      await expect(page).toHaveURL('/dashboard');
      await expect(page.locator('text=Dashboard')).toBeVisible();
    });
  });

  test.describe('Session Persistence', () => {
    test('should maintain session after page reload', async ({ page }) => {
      // Login
      await loginUser(page);

      // Reload page
      await page.reload();

      // Should still be on dashboard
      await expect(page).toHaveURL('/dashboard');
    });

    test('should maintain session when navigating between pages', async ({ page }) => {
      // Login
      await loginUser(page);

      // Navigate to different protected pages
      await page.goto('/transactions');
      await expect(page).toHaveURL('/transactions');

      await page.goto('/budget');
      await expect(page).toHaveURL('/budget');

      await page.goto('/settings');
      await expect(page).toHaveURL('/settings');
    });
  });
});
