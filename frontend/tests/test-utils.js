/**
 * BudgetWise Test Utilities
 * Common helper functions and fixtures for Playwright tests
 */

// Test credentials
export const TEST_USER = {
  email: 'complianceramsharapov@gmail.com',
  password: '@Ramilka1988',
  name: 'Ramil Sharapov'
};

// Helper to detect mobile viewport
export function isMobileViewport(page) {
  const viewportSize = page.viewportSize();
  return viewportSize && viewportSize.width < 768;
}

// Helper to open mobile menu if needed
export async function openMobileMenuIfNeeded(page) {
  if (isMobileViewport(page)) {
    const menuToggle = page.locator('button[aria-label="Toggle navigation"]');
    if (await menuToggle.isVisible()) {
      await menuToggle.click();
      await page.waitForTimeout(300);
    }
  }
}

// Helper to login a user
export async function loginUser(page, email = TEST_USER.email, password = TEST_USER.password) {
  await page.goto('/login');

  // Fill in login form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Click sign in button
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

// Helper to logout user
export async function logoutUser(page) {
  await openMobileMenuIfNeeded(page);

  const signOutButton = page.locator('button:has-text("Sign Out")');
  if (await signOutButton.isVisible()) {
    await signOutButton.click();
    await page.waitForURL('/');
  }
}

// Helper to navigate to a protected page (will login first if needed)
export async function navigateToProtectedPage(page, path) {
  await page.goto(path);

  // Check if we were redirected to login
  if (page.url().includes('/login')) {
    await loginUser(page);
    await page.goto(path);
  }
}

// Helper to wait for page load
export async function waitForPageLoad(page) {
  await page.waitForLoadState('networkidle');
}

// Helper to take a screenshot with timestamp
export async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `playwright-report/screenshots/${name}-${timestamp}.png`,
    fullPage: true
  });
}

// Helper to check for accessibility issues (basic checks)
export async function checkBasicAccessibility(page) {
  // Check all images have alt text
  const images = page.locator('img');
  const count = await images.count();
  const issues = [];

  for (let i = 0; i < count; i++) {
    const img = images.nth(i);
    const alt = await img.getAttribute('alt');
    if (alt === null) {
      issues.push(`Image ${i} is missing alt attribute`);
    }
  }

  // Check all buttons have accessible names
  const buttons = page.locator('button');
  const buttonCount = await buttons.count();

  for (let i = 0; i < buttonCount; i++) {
    const button = buttons.nth(i);
    const text = await button.textContent();
    const ariaLabel = await button.getAttribute('aria-label');
    if (!text?.trim() && !ariaLabel) {
      issues.push(`Button ${i} is missing accessible name`);
    }
  }

  return issues;
}

// Common selectors
export const SELECTORS = {
  // Header
  header: 'header',
  logo: 'a[href="/"]',
  navToggle: 'button[aria-label="Toggle navigation"]',
  signOutButton: 'button:has-text("Sign Out")',

  // Forms
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  submitButton: 'button[type="submit"]',

  // Dashboard
  dashboardTitle: 'h1:has-text("Dashboard"), h2:has-text("Dashboard")',
  addTransactionButton: 'button:has-text("Add Transaction"), a:has-text("Add Transaction")',

  // Transactions
  transactionsList: '[data-testid="transactions-list"]',
  transactionItem: '[data-testid="transaction-item"]',

  // Budget
  budgetProgress: '[data-testid="budget-progress"]',
  budgetCategory: '[data-testid="budget-category"]',

  // Common
  loadingSpinner: '[data-testid="loading"]',
  errorMessage: '[data-testid="error"]',
  successMessage: '[data-testid="success"]',
};

// Wait for element to be visible with timeout
export async function waitForElement(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

// Fill form field with label
export async function fillFieldByLabel(page, label, value) {
  const field = page.locator(`text="${label}"`).locator('..').locator('input, select, textarea');
  await field.fill(value);
}

// Click button by text
export async function clickButtonByText(page, text) {
  await page.click(`button:has-text("${text}")`);
}

// Check if toast/notification appeared
export async function checkToast(page, message, timeout = 5000) {
  const toast = page.locator(`text="${message}"`);
  await toast.waitFor({ state: 'visible', timeout });
  return toast;
}
