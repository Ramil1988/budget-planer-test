# Playwright Tests for BudgetWise

This directory contains comprehensive end-to-end tests for the BudgetWise application using Playwright.

## Test Structure

### Core Test Files

| File | Description | Tests |
|------|-------------|-------|
| `auth.spec.js` | Authentication flows | Login, signup, logout, protected routes, session persistence |
| `dashboard.spec.js` | Main dashboard | Summary cards, charts, navigation actions, data loading |
| `transactions.spec.js` | Transaction management | List, add, filter, search, validation |
| `budget.spec.js` | Budget tracking | Budget setup, category budgets, progress tracking |
| `categories.spec.js` | Category management | Expense/income categories, merchant mappings |
| `recurring.spec.js` | Recurring payments | Payment list, add/edit/delete, next 30 days |
| `reports.spec.js` | Financial reports | Charts, monthly breakdown, year selection |
| `settings.spec.js` | User settings | Notifications, account info |
| `import.spec.js` | Data import | Google Sheets sync, CSV upload, auto-sync |
| `mobile.spec.js` | Mobile responsiveness | All pages on mobile/tablet viewports |

### Utility Files

| File | Description |
|------|-------------|
| `test-utils.js` | Shared helpers, test credentials, common selectors |

### Legacy Files

| File | Description |
|------|-------------|
| `navigation.spec.js` | Basic navigation tests |
| `home.spec.js` | Home page tests |
| `features.spec.js` | Features page tests |
| `example.spec.js` | Example tests |
| `visual-verification.spec.js` | Visual verification tests |

## Running Tests

### Prerequisites

Make sure you have Node.js 20+ installed and dependencies are up to date:

```bash
npm install
npx playwright install
```

### Run all tests (headless mode)
```bash
npm test
```

### Run tests with UI mode (recommended for development)
```bash
npm run test:ui
```

### Run tests in headed mode (see the browser)
```bash
npm run test:headed
```

### Debug tests
```bash
npm run test:debug
```

### View test report
```bash
npm run test:report
```

### Run specific test file
```bash
npx playwright test auth.spec.js
```

### Run tests matching a pattern
```bash
npx playwright test -g "login"
```

## Test Configuration

The test configuration is defined in `playwright.config.js` at the root of the frontend directory.

### Browsers Tested
- Chromium (Desktop Chrome)
- Firefox (Desktop Firefox)
- WebKit (Desktop Safari)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

### Base URL
Tests run against `http://localhost:5173` (Vite dev server)

### Test Credentials
Test credentials are stored in `test-utils.js`:
- Email: `complianceramsharapov@gmail.com`
- Password: `@Ramilka1988`

## Test Coverage

### Authentication (auth.spec.js)
- Login form display and validation
- Invalid credentials handling
- Successful login flow
- Signup page display
- Logout functionality
- Protected route redirects
- Session persistence

### Dashboard (dashboard.spec.js)
- Page layout and header
- Summary cards (income, expenses, balance)
- Upcoming payments section
- Spending breakdown chart
- Cash flow visualization
- Budget overview
- Top spending categories
- Daily spending chart
- Navigation actions
- Month navigation

### Transactions (transactions.spec.js)
- Transaction list display
- Search and filtering
- Add transaction form
- Transaction type toggle
- Category selection
- Form validation
- Transaction details expansion

### Budget (budget.spec.js)
- Budget tracking view
- Budget setup tab
- Summary with progress circle
- Category budget cards
- Status indicators (over/warning/on track)
- Month navigation
- Current vs projected toggle

### Categories (categories.spec.js)
- Expense/income category tabs
- Category chips display
- Add new category form
- Merchant mappings section
- Form interactions

### Recurring Payments (recurring.spec.js)
- Summary cards (income/expenses/cash flow)
- Payment list display
- Frequency indicators
- Action buttons (pause/edit/delete)
- Next 30 days preview
- Filter tabs

### Reports (reports.spec.js)
- Summary cards
- Income vs Expenses chart
- Top categories donut chart
- Balance trend line chart
- Monthly breakdown table
- Year selection

### Settings (settings.spec.js)
- Push notifications section
- Account information display
- Google Sheet sync info

### Import (import.spec.js)
- Google Sheet connection form
- Auto-sync settings
- Manual import options
- File upload

### Mobile (mobile.spec.js)
- All pages on mobile viewport
- Navigation menu
- Touch interactions
- Scrolling behavior
- Form usability
- Content visibility
- Tablet responsiveness

## Writing New Tests

### Import utilities
```javascript
import { test, expect } from '@playwright/test';
import { loginUser, TEST_USER, openMobileMenuIfNeeded } from './test-utils.js';
```

### Use test utilities
```javascript
test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page); // Login before each test
  });

  test('should do something', async ({ page }) => {
    await page.goto('/my-page');
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

### Best Practices
1. Use descriptive test names
2. Group related tests with `test.describe()`
3. Use `test.beforeEach()` for common setup
4. Wait for elements before interacting
5. Avoid hardcoded waits when possible
6. Use test utilities for common operations

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Locators](https://playwright.dev/docs/locators)
- [Assertions](https://playwright.dev/docs/test-assertions)
