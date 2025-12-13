# Playwright Tests for BudgetWise

This directory contains end-to-end tests for the BudgetWise application using Playwright.

## Test Structure

- `navigation.spec.js` - Tests for navigation between pages and mobile menu
- `home.spec.js` - Tests for the home page functionality
- `features.spec.js` - Tests for the features page
- `example.spec.js` - Example tests demonstrating Playwright capabilities

## Running Tests

### Run all tests (headless mode)
```bash
pnpm test
```

### Run tests with UI mode (recommended for development)
```bash
pnpm test:ui
```

### Run tests in headed mode (see the browser)
```bash
pnpm test:headed
```

### Debug tests
```bash
pnpm test:debug
```

### View test report
```bash
pnpm test:report
```

## Test Configuration

The test configuration is defined in `playwright.config.js` at the root of the project.

### Browsers Tested
- Chromium (Desktop Chrome)
- Firefox (Desktop Firefox)
- WebKit (Desktop Safari)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

### Base URL
Tests run against `http://localhost:5173` (Vite dev server)

## Writing New Tests

1. Create a new `.spec.js` file in the `tests/` directory
2. Import the test framework:
   ```javascript
   import { test, expect } from '@playwright/test';
   ```
3. Write your tests using `test.describe()` and `test()` blocks
4. Use Playwright's assertions with `expect()`

### Example Test
```javascript
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Best Practices](https://playwright.dev/docs/best-practices)
