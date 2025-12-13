# Playwright Test Verification Guide

This guide explains what each test does and how to verify the results.

## Test Report

To view the full test report with screenshots and detailed execution logs:

```bash
pnpm test:report
```

This will open an HTML report in your browser showing all 120 tests that ran.

---

## Test Breakdown by File

### 1. **example.spec.js** - General Functionality Tests

#### Test: "basic page load test"
- **What it tests:** Navigates to the home page and verifies it loads correctly
- **Verification:**
  - Page title contains "BudgetWise"
  - Takes a screenshot for visual verification
- **How to verify manually:** Visit http://localhost:5173 and check the page loads

#### Test: "element visibility test"
- **What it tests:** Checks that header and navigation are visible
- **Verification:**
  - Header element is visible
  - On desktop: Navigation menu is visible
  - On mobile: Navigation toggle button is visible
- **How to verify manually:**
  - Desktop: Open app and see nav links in header
  - Mobile: Resize browser to 375px width and see hamburger menu

#### Test: "clicking and navigation test"
- **What it tests:** Tests navigation between pages
- **Verification:**
  - Can click Features link
  - URL changes to /features
- **How to verify manually:** Click the "Features" link in navigation

#### Test: "responsive design test"
- **What it tests:** Ensures app works on different screen sizes
- **Verification:**
  - Tests on mobile (375px), tablet (768px), and desktop (1920px)
  - Main content is visible on all sizes
- **How to verify manually:** Use browser DevTools to resize viewport

#### Test: "accessibility - check for alt text on images"
- **What it tests:** All images have alt text for screen readers
- **Verification:**
  - Every <img> tag has an alt attribute
- **How to verify manually:** Inspect images in browser DevTools

#### Test: "page performance - check load time"
- **What it tests:** Page loads within acceptable time
- **Verification:**
  - Page loads in less than 3 seconds
- **How to verify manually:** Use browser DevTools Performance tab

---

### 2. **features.spec.js** - Features Page Tests

#### Test: "should display the features page heading"
- **What it tests:** Features page has a main heading
- **Verification:**
  - h1 or h2 element is visible on /features
- **How to verify manually:** Navigate to /features and see the heading

#### Test: "should display feature details"
- **What it tests:** Feature sections are present
- **Verification:**
  - At least one .feature-row element exists
  - Contains feature descriptions
- **How to verify manually:** Scroll through /features page

#### Test: "should have images or icons for features"
- **What it tests:** Visual elements accompany features
- **Verification:**
  - Multiple images are present
- **How to verify manually:** Check for images on features page

#### Test: "should display feature descriptions"
- **What it tests:** Text descriptions exist
- **Verification:**
  - Multiple paragraph elements with content
- **How to verify manually:** Read feature descriptions

#### Test: "should have animation classes on feature items"
- **What it tests:** Features have animation styling
- **Verification:**
  - Elements with fade-in or animate classes
- **How to verify manually:** Reload page and watch for animations

#### Test: "should be responsive on mobile"
- **What it tests:** Features page works on mobile
- **Verification:**
  - Content visible on 375px width
  - No horizontal overflow (within tolerance)
- **How to verify manually:** View on mobile device or resize browser

#### Test: "should have scroll-to-top functionality"
- **What it tests:** Scroll button appears and works
- **Verification:**
  - Scroll down page
  - .scroll-top-btn appears
  - Clicking it scrolls to top
- **How to verify manually:** Scroll down and click the ↑ button

---

### 3. **home.spec.js** - Home Page Tests

#### Test: "should display the hero section"
- **What it tests:** Hero section is present
- **Verification:**
  - Hero heading is visible
  - Contains word "budget"
- **How to verify manually:** Look at top of homepage

#### Test: "should display feature cards"
- **What it tests:** Feature preview cards exist
- **Verification:**
  - At least one .feature-card element
- **How to verify manually:** See 3 feature cards with icons on homepage

#### Test: "should have a call-to-action button"
- **What it tests:** CTA button is present
- **Verification:**
  - Button in hero section is visible
  - Located in .hero-buttons area
- **How to verify manually:** Look for "Start Tracking" button

#### Test: "should display footer"
- **What it tests:** Footer element exists
- **Verification:**
  - <footer> tag is visible
- **How to verify manually:** Scroll to bottom of page

#### Test: "should have scroll-to-top button after scrolling"
- **What it tests:** Scroll button appears when scrolling
- **Verification:**
  - Scroll down 300px
  - .scroll-top-btn becomes visible
- **How to verify manually:** Scroll down the page

#### Test: "should be responsive on mobile"
- **What it tests:** Homepage works on mobile
- **Verification:**
  - Content visible on 375px width
  - No significant horizontal overflow
- **How to verify manually:** View on mobile or resize browser

---

### 4. **navigation.spec.js** - Navigation Tests

#### Test: "should navigate to home page"
- **What it tests:** Can access homepage
- **Verification:**
  - URL is /
  - Title contains "BudgetWise"
- **How to verify manually:** Go to http://localhost:5173

#### Test: "should navigate to features page"
- **What it tests:** Can navigate to features
- **Verification:**
  - Click features link (opens mobile menu if needed)
  - URL changes to /features
- **How to verify manually:** Click "Features" in navigation

#### Test: "should have working navigation links"
- **What it tests:** Both nav links are present
- **Verification:**
  - Home link (/) is visible
  - Features link (/features) is visible
  - On mobile: opens menu first
- **How to verify manually:** Check navigation menu

#### Test: "should navigate back to home from features"
- **What it tests:** Can return to homepage
- **Verification:**
  - Start on /features
  - Click home link
  - Returns to /
- **How to verify manually:** Navigate between pages

#### Test: "should have mobile menu toggle on small screens"
- **What it tests:** Mobile menu button exists
- **Verification:**
  - On 375px viewport
  - .nav-toggle button is visible
- **How to verify manually:** Resize browser to mobile size

---

## How to Verify Test Results

### Method 1: View the HTML Report (Recommended)
```bash
pnpm test:report
```
- Shows all 120 tests with pass/fail status
- Click on any test to see detailed execution
- View screenshots taken during tests
- See timing information

### Method 2: Run Tests in UI Mode (Interactive)
```bash
pnpm test:ui
```
- Watch tests run in real-time
- Step through each action
- See the browser state at each step
- Use timeline slider to scrub through execution

### Method 3: Run Tests in Headed Mode (Watch Browser)
```bash
pnpm test:headed
```
- See actual browser windows open
- Watch tests execute live
- Good for debugging

### Method 4: Manual Verification
```bash
# Start the dev server
pnpm run dev

# Then open http://localhost:5173 in your browser
```
- Test each feature manually using the verification steps above
- Compare against what the automated tests check

---

## Test Coverage Summary

### ✅ What We're Testing

1. **Page Loading**
   - All pages load successfully
   - Correct titles and content

2. **Navigation**
   - Links work correctly
   - URL routing works
   - Mobile menu functions properly

3. **Responsive Design**
   - Works on mobile (375px)
   - Works on tablet (768px)
   - Works on desktop (1920px+)

4. **User Interface**
   - All major elements are visible
   - Buttons are clickable
   - Images have alt text

5. **Interactions**
   - Scroll-to-top button works
   - Navigation between pages works
   - Mobile menu toggle works

6. **Performance**
   - Page loads in < 3 seconds
   - No console errors

7. **Cross-Browser Compatibility**
   - Chromium (Chrome/Edge)
   - Firefox
   - WebKit (Safari)
   - Mobile browsers

---

## Understanding Test Results

### In Playwright UI Mode:
- **Green checkmark** ✓ = Test passed
- **Red X** = Test failed
- Click on any test to see:
  - Step-by-step execution
  - Screenshots at each step
  - Network requests
  - Console logs
  - Errors (if any)

### In HTML Report:
- **120 passed** = All tests successful
- Click individual tests to see:
  - Execution timeline
  - Screenshots
  - Test code
  - Timing information

---

## Common Verification Scenarios

### Verify Homepage Works:
1. Run `pnpm test:ui`
2. Click "home.spec.js" → "Home Page" tests
3. Watch each test execute
4. Verify visually that elements appear correctly

### Verify Mobile Responsiveness:
1. Run `pnpm test:headed`
2. Watch tests resize browser windows
3. See mobile menu toggle in action
4. Verify no horizontal scroll

### Verify Navigation:
1. Run `pnpm test:ui`
2. Click "navigation.spec.js"
3. Watch URL changes
4. See mobile menu open/close
5. Verify routing works

---

## Tips for Using Test Reports

1. **Timeline Slider**: Use the timeline at top of UI mode to scrub through test execution frame by frame

2. **Screenshots**: Tests automatically capture screenshots on failure - check these first when debugging

3. **Trace Viewer**: Failed tests generate traces - open with `npx playwright show-trace <path-to-trace>`

4. **Filter Tests**: Use the filter box in UI mode to run specific tests

5. **Watch Mode**: UI mode automatically reruns tests when you change code

---

## Next Steps

- Run `pnpm test` before every deploy
- Add more tests as you add features
- Check the HTML report after each test run
- Use `pnpm test:debug` when writing new tests
