import { test, expect } from '@playwright/test';
import { loginUser } from './test-utils.js';

/**
 * Transactions: the list page (figures, the chart of what was spent, the list by day, the
 * filters, editing in place, the trash) and the Add Transaction page.
 */

// "−$2,720.26" and "+$1,918.07" as numbers.
const amount = (text) => Number(text.replace('−', '-').replace(/[^0-9.-]/g, ''));

test.describe('Transactions', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test.describe('Transactions list', () => {
    // Nothing here may change the account: the trash buttons are never pressed, every
    // dialog is cancelled, and a test fails if the page writes to the database anyway.
    let writes;

    test.beforeEach(async ({ page }) => {
      writes = [];
      page.on('request', (request) => {
        if (request.url().includes('/rest/v1/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
          writes.push(`${request.method()} ${request.url().split('/rest/v1/')[1]}`);
        }
      });
      await page.goto('/transactions');
      await expect(page.getByRole('heading', { name: 'Transactions', level: 1 })).toBeVisible();
      // The filters are applied a moment after the page appears: wait for the list, or for the
      // line that says there is nothing, before reading anything.
      await expect(page.locator('.tx-row, .bw-nothing').first()).toBeVisible();
    });

    test.afterEach(() => {
      expect(writes).toEqual([]);
    });

    test('says how many transactions are in view, and of which month', async ({ page }) => {
      const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      await expect(page.locator('.bw-subtitle')).toHaveText(new RegExp(`^[\\d,]+ transactions? in ${month}$`));
      await expect(page.getByLabel('Period')).toHaveValue('this-month');
      // Nothing narrows the list to begin with, so no filter is written out.
      await expect(page.getByRole('list', { name: 'Filters in use' })).toHaveCount(0);
    });

    test('adds the view up: net is income less expenses', async ({ page }) => {
      await expect(page.locator('.tx-ledger dt')).toHaveText(['Net', 'Income', 'Expenses', 'Largest expense']);
      const [net, income, expenses] = (await page.locator('.tx-ledger dd').allTextContents()).map(amount);
      expect(Math.abs(net - (income - expenses))).toBeLessThan(0.011);
    });

    test('the amounts of the rows add up to the net', async ({ page }) => {
      const rows = page.locator('.tx-row .tx-row__figure');
      test.skip(await rows.count() === 0, 'nothing recorded this month');
      const total = (await rows.allTextContents()).map(amount).reduce((sum, value) => sum + value, 0);
      const net = amount(await page.locator('.tx-ledger dd').first().textContent());
      expect(Math.abs(total - net)).toBeLessThan(0.011);
    });

    test('draws what was spent day by day, up to today', async ({ page }) => {
      const now = new Date();
      const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      await expect(page.locator('.tx-chart__column')).toHaveCount(days);
      await expect(page.locator('.tx-chart__axis li[data-today="true"]')).toHaveText(String(now.getDate()));
      // The line ends at what was spent: the same figure as Expenses.
      const total = page.locator('.tx-chart__total');
      if (await total.count()) {
        const expenses = amount(await page.locator('.tx-ledger dd').nth(2).textContent());
        expect(Math.abs(amount(await total.textContent()) - expenses)).toBeLessThan(0.011);
      }
    });

    test('a day picked on the chart shows only that day, and is written out as a filter', async ({ page }) => {
      const columns = page.locator('.tx-chart__column:not(:disabled)');
      test.skip(await columns.count() === 0, 'nothing recorded this month');
      const all = await page.locator('.tx-row').count();
      await columns.first().click();
      await expect(columns.first()).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.tx-day')).toHaveCount(1);
      const chip = page.getByRole('list', { name: 'Filters in use' }).locator('li', { hasText: /^Only / });
      await expect(chip).toHaveCount(1);
      await chip.getByRole('button').click();
      await expect(page.locator('.tx-row')).toHaveCount(all);
      await expect(page.getByRole('list', { name: 'Filters in use' })).toHaveCount(0);
    });

    test('lists the transactions under a heading for each day', async ({ page }) => {
      const day = page.locator('.tx-day').first();
      test.skip(await day.count() === 0, 'nothing recorded this month');
      const head = await day.locator('.tx-day__head').textContent();
      expect(head).toMatch(/^(Today|Yesterday|\w{3}, \w{3} \d{1,2})/);
      // The heading counts its rows and adds them up.
      expect(Number(head.match(/([\d,]+) transactions?,/)[1])).toBe(await day.locator('.tx-row').count());
      const sum = (await day.locator('.tx-row__figure').allTextContents()).map(amount).reduce((total, value) => total + value, 0);
      expect(Math.abs(amount(await day.locator('.tx-day__head b').textContent()) - sum)).toBeLessThan(0.011);
      await expect(day.locator('.tx-day__sofar')).toHaveText(/^\$[\d,]+\.\d{2} spent so far$/);
    });

    test('shows only income or only expenses', async ({ page }) => {
      const type = page.getByRole('group', { name: 'Type' });
      await type.getByRole('button', { name: 'Expenses' }).click();
      await expect(page.locator('.bw-subtitle')).toHaveText(/^[\d,]+ expenses? in /);
      await expect(page.locator('.tx-row[data-type="income"]')).toHaveCount(0);
      await type.getByRole('button', { name: 'Income' }).click();
      await expect(page.locator('.bw-subtitle')).toHaveText(/^[\d,]+ income transactions? in /);
      await expect(page.locator('.tx-row[data-type="expense"]')).toHaveCount(0);
      await type.getByRole('button', { name: 'All' }).click();
      await expect(page.locator('.bw-subtitle')).toHaveText(/^[\d,]+ transactions? in /);
    });

    test('searches the descriptions, categories, banks and amounts', async ({ page }) => {
      const first = page.locator('.tx-row').first();
      test.skip(await first.count() === 0, 'nothing recorded this month');
      const word = (await first.locator('.tx-row__category').textContent()).split(/[\s/]/)[0];
      await page.getByLabel('Search transactions').fill(word);
      await expect(page.locator('.bw-subtitle')).toContainText(`matching “${word}”`);
      for (const text of await page.locator('.tx-row__body').allTextContents()) expect(text.toLowerCase()).toContain(word.toLowerCase());

      // An amount can be typed too: every row found has it in its figure.
      const figure = (await first.locator('.tx-row__figure').textContent()).replace(/[^0-9.]/g, '');
      await page.getByLabel('Search transactions').fill(figure);
      await expect(page.locator('.tx-row').first()).toBeVisible();
      const found = (await page.locator('.tx-row').evaluateAll((rows) => rows.map((row) => row.innerText.replace(/,/g, ''))));
      expect(found.every((row) => row.includes(figure))).toBe(true);
    });

    test('changes the period: last month, then all time by month', async ({ page }) => {
      const active = Number((await page.getByRole('tab', { name: /^Active/ }).textContent()).replace(/\D/g, ''));
      const now = new Date();
      const last = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      await page.getByLabel('Period').selectOption('last-month');
      await expect(page.locator('.bw-subtitle')).toHaveText(new RegExp(`^[\\d,]+ transactions? in ${last}$`));

      await page.getByLabel('Period').selectOption('all');
      await expect(page.locator('.bw-subtitle')).toHaveText(`${active.toLocaleString('en-US')} transaction${active === 1 ? '' : 's'}, all time`);
      test.skip(active === 0, 'nothing recorded');
      await expect(page.locator('.tx-row')).toHaveCount(active);
    });

    test('filters by amount, and takes the filter off by its chip', async ({ page }) => {
      const more = page.getByRole('button', { name: /^Bank and amount/ });
      await expect(more).toHaveAttribute('aria-expanded', 'false');
      const before = await page.locator('.bw-subtitle').textContent();
      await more.click();
      await page.getByLabel('Amount from').fill('100');
      // The filter takes effect as it is typed: there is no button to apply it.
      await expect(page.getByRole('list', { name: 'Filters in use' })).toContainText('$100.00 or more');
      await expect(more).toContainText('1');
      for (const text of await page.locator('.tx-row__figure').allTextContents()) expect(Math.abs(amount(text))).toBeGreaterThanOrEqual(100);

      await page.getByLabel('Amount to').fill('500');
      await expect(page.getByRole('list', { name: 'Filters in use' })).toContainText('$100.00 to $500.00');
      for (const text of await page.locator('.tx-row__figure').allTextContents()) expect(Math.abs(amount(text))).toBeLessThanOrEqual(500);

      await page.getByRole('button', { name: 'Remove the filter $100.00 to $500.00' }).click();
      await expect(page.locator('.bw-subtitle')).toHaveText(before);
      await expect(page.getByLabel('Amount from')).toHaveValue('');
    });

    test('shows one category, and drops it when the type no longer fits', async ({ page }) => {
      const first = page.locator('.tx-row[data-type="expense"]').first();
      test.skip(await first.count() === 0, 'no expenses this month');
      const name = await first.locator('.tx-row__category').textContent();
      const category = page.getByLabel('Category', { exact: true });
      await category.selectOption({ label: name });
      await expect(page.getByRole('list', { name: 'Filters in use' })).toContainText(name);
      for (const text of await page.locator('.tx-row__category').allTextContents()) expect(text).toBe(name);

      // An expense category cannot be shown together with "income only".
      await page.getByRole('group', { name: 'Type' }).getByRole('button', { name: 'Income' }).click();
      await expect(category).toHaveValue('');
      await expect(page.getByRole('list', { name: 'Filters in use' })).not.toContainText(name);
      await expect(page.getByRole('list', { name: 'Filters in use' })).toContainText('Income only');
    });

    test('takes a custom range of dates', async ({ page }) => {
      await expect(page.getByLabel('From', { exact: true })).toHaveCount(0);
      await page.getByLabel('Period').selectOption('custom');
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await page.getByLabel('From', { exact: true }).fill(`${month}-03`);
      await page.getByLabel('To', { exact: true }).fill(`${month}-09`);
      await expect(page.locator('.bw-subtitle')).toHaveText(/ in \w{3} 3 – \w{3} 9, \d{4}$/);
      await expect(page.locator('.tx-chart__column')).toHaveCount(7);
      for (const head of await page.locator('.tx-day__head h3').allTextContents()) expect(head).toMatch(/ [3-9]$|^Today$|^Yesterday$/);
    });

    test('writes every filter in use out, and clears them all at once', async ({ page }) => {
      const before = await page.locator('.bw-subtitle').textContent();
      await page.getByLabel('Period').selectOption('all');
      await page.getByRole('group', { name: 'Type' }).getByRole('button', { name: 'Expenses' }).click();
      await page.getByLabel('Search transactions').fill('a');
      const chips = page.getByRole('list', { name: 'Filters in use' });
      await expect(chips.locator('li span')).toHaveText(['“a”', 'All time', 'Expenses only']);
      await chips.getByRole('button', { name: 'Clear all' }).click();
      await expect(chips).toHaveCount(0);
      await expect(page.locator('.bw-subtitle')).toHaveText(before);
      await expect(page.getByLabel('Period')).toHaveValue('this-month');
      await expect(page.getByLabel('Search transactions')).toHaveValue('');
    });

    test('offers to clear the filters when nothing matches', async ({ page }) => {
      const before = await page.locator('.bw-subtitle').textContent();
      await page.getByLabel('Search transactions').fill('no transaction reads like this');
      await expect(page.locator('.bw-nothing')).toContainText('Nothing matches these filters.');
      await page.getByRole('button', { name: 'Clear all filters' }).click();
      await expect(page.locator('.bw-subtitle')).toHaveText(before);
    });

    test('offers the categories of the same type, and asks before changing one', async ({ page }) => {
      const row = page.locator('.tx-row[data-type="expense"]').first();
      test.skip(await row.count() === 0, 'no expenses this month');
      const category = await row.locator('.tx-row__category').textContent();
      await row.locator('.tx-row__category').click();
      const select = row.getByRole('combobox');
      const options = await select.locator('option').evaluateAll((list) => list.map(({ value, textContent }) => ({ value, name: textContent })));
      const other = options.find(({ value, name }) => value && name !== category);
      test.skip(!other, 'only one expense category');
      await select.selectOption(other.value);
      const dialog = page.getByRole('dialog', { name: `Change the category to ${other.name}?` });
      await expect(dialog.getByRole('button', { name: 'Only this one' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Always for this description' })).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
      await row.getByRole('button', { name: 'Cancel' }).click();
      await expect(row.locator('.tx-row__category')).toHaveText(category);
    });

    test('opens an amount for editing and leaves it unchanged', async ({ page }) => {
      const row = page.locator('.tx-row').first();
      test.skip(await row.count() === 0, 'nothing recorded this month');
      const shown = await row.locator('.tx-row__figure').textContent();
      await row.locator('button.tx-row__figure').click();
      const input = row.getByRole('spinbutton');
      await expect(input).toHaveValue(String(Math.abs(amount(shown))));
      // Leaving the field without a change saves nothing; the check after each test proves it.
      await page.getByLabel('Search transactions').click();
      await expect(row.locator('.tx-row__figure')).toHaveText(shown);

      await row.locator('button.tx-row__figure').click();
      await page.keyboard.press('Escape');
      await expect(row.locator('.tx-row__figure')).toHaveText(shown);
    });

    test('asks before moving everything to the trash', async ({ page }) => {
      const all = page.locator('.tx-foot button');
      test.skip(await all.count() === 0, 'nothing recorded');
      await all.click();
      const dialog = page.getByRole('dialog', { name: 'Move everything to the trash?' });
      await expect(dialog).toContainText('not only the ones in view');
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
    });

    test('shows the trash, and what can be done there', async ({ page }) => {
      const tab = page.getByRole('tab', { name: /^Trash \([\d,]+\)$/ });
      const trashed = Number((await tab.textContent()).replace(/\D/g, ''));
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('.bw-subtitle')).toHaveText(`${trashed.toLocaleString('en-US')} transaction${trashed === 1 ? '' : 's'} in the trash`);
      if (trashed === 0) {
        await expect(page.locator('.bw-nothing')).toHaveText('The trash is empty.');
        await expect(page.getByRole('button', { name: 'Empty trash' })).toBeDisabled();
      } else {
        await expect(page.locator('.tx-row--trashed')).toHaveCount(trashed);
        await expect(page.locator('.tx-row--trashed').first().getByRole('button', { name: /^Restore / })).toBeVisible();
      }
      await page.getByRole('tab', { name: /^Active/ }).click();
      await expect(page.locator('.tx-ledger')).toBeVisible();
    });

    test('downloads what is in view as a CSV named after the month', async ({ page }) => {
      const button = page.getByRole('button', { name: 'Download CSV' });
      test.skip(await button.isDisabled(), 'nothing recorded this month');
      const now = new Date();
      const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
      expect(download.suggestedFilename()).toBe(`transactions-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.csv`);
    });

    test('fits a phone without scrolling sideways', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('.tx-ledger')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });

  test.describe('Add transaction', () => {
    // The form is filled in but never sent with everything it needs, so nothing is added.
    let writes;

    test.beforeEach(async ({ page }) => {
      writes = [];
      page.on('request', (request) => {
        if (request.url().includes('/rest/v1/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
          writes.push(`${request.method()} ${request.url().split('/rest/v1/')[1]}`);
        }
      });
      await page.goto('/add-transaction');
      await expect(page.getByRole('heading', { name: 'Add transaction', level: 1 })).toBeVisible();
    });

    test.afterEach(() => {
      expect(writes).toEqual([]);
    });

    test('starts as an expense dated today', async ({ page }) => {
      const type = page.getByRole('group', { name: 'Type' });
      await expect(type.getByRole('button', { name: 'Expense' })).toHaveAttribute('aria-pressed', 'true');
      await expect(type.getByRole('button', { name: 'Income' })).toHaveAttribute('aria-pressed', 'false');
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      await expect(page.getByLabel('Date')).toHaveValue(today);
      await expect(page.getByLabel('Amount')).toHaveValue('');
      await expect(page.getByLabel('Description, if any')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add expense' })).toBeVisible();
    });

    test('offers the categories of the chosen type', async ({ page }) => {
      const counts = await page.locator('.tx-add__counts').textContent();
      const [, expenses, incomes] = counts.match(/^(\d+) expense categor(?:y|ies), (\d+) income categor(?:y|ies)\./);
      const category = page.getByLabel('Category');
      // One option for each category, and the one that asks to choose.
      await expect(category.locator('option')).toHaveCount(Number(expenses) + 1);
      await expect(category).toHaveValue('');

      await page.getByRole('group', { name: 'Type' }).getByRole('button', { name: 'Income' }).click();
      await expect(category.locator('option')).toHaveCount(Number(incomes) + 1);
      await expect(page.getByRole('button', { name: 'Add income' })).toBeVisible();
    });

    test('forgets the category when the type changes', async ({ page }) => {
      const category = page.getByLabel('Category');
      const first = await category.locator('option').nth(1).getAttribute('value');
      test.skip(!first, 'no expense categories');
      await category.selectOption(first);
      await page.getByRole('group', { name: 'Type' }).getByRole('button', { name: 'Income' }).click();
      await expect(category).toHaveValue('');
    });

    test('asks for an amount', async ({ page }) => {
      await page.getByRole('button', { name: 'Add expense' }).click();
      await expect(page.getByRole('alert')).toHaveText('Please enter a valid amount');
      await expect(page).toHaveURL('/add-transaction');
    });

    test('asks for a category', async ({ page }) => {
      await page.getByLabel('Amount').fill('50');
      await page.getByRole('button', { name: 'Add expense' }).click();
      await expect(page.getByRole('alert')).toHaveText('Please select a category');
      await expect(page).toHaveURL('/add-transaction');
    });

    test('goes back to the list', async ({ page }) => {
      await page.getByRole('link', { name: 'Back to transactions' }).click();
      await expect(page).toHaveURL('/transactions');
    });
  });

  test.describe('Transaction Navigation', () => {
    test('should navigate from transactions list to add transaction', async ({ page }) => {
      await page.goto('/transactions');

      await page.getByRole('link', { name: 'Add transaction' }).click();

      await expect(page).toHaveURL('/add-transaction');
    });

    test('should navigate from dashboard to transactions', async ({ page }) => {
      await page.goto('/dashboard');

      await page.locator('a[href="/transactions"]').first().click();
      await expect(page).toHaveURL('/transactions');
    });
  });
});
