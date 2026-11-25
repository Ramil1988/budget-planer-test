import { test, expect } from '@playwright/test';
import { loginUser } from './test-utils.js';

/**
 * Reports page: the year's totals, the year as twelve months, the ranking of categories
 * and the month-by-month table. The tests only read the signed-in account's own data.
 */

const money = /^[+-]?-?\$[\d,]+$/;
const amount = (text) => Number(text.replace(/[^0-9-]/g, ''));

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Financial Report' })).toBeVisible();
  });

  test.describe('The year', () => {
    test('names the year and how much of it is recorded', async ({ page }) => {
      const year = new Date().getFullYear();
      await expect(page.locator('.bw-subtitle')).toHaveText(new RegExp(`^${year}, (nothing recorded yet|\\d+ months? recorded)$`));
      await expect(page.getByLabel('Year', { exact: true })).toHaveValue(String(year));
    });

    test('shows the net, income, expenses and savings rate', async ({ page }) => {
      const labels = page.locator('.bw-ledger dt');
      await expect(labels.filter({ hasText: /^Net in \d{4}$/ })).toBeVisible();
      await expect(labels.filter({ hasText: /^Income$/ })).toBeVisible();
      await expect(labels.filter({ hasText: /^Expenses$/ })).toBeVisible();
      await expect(labels.filter({ hasText: /^Savings rate$/ })).toBeVisible();
      const figures = await page.locator('.bw-ledger dd').allTextContents();
      expect(figures.slice(0, 3).every((text) => money.test(text))).toBe(true);
      expect(figures[3]).toMatch(/^-?[\d.]+%$/);
      // The net is the income less the expenses, in whole dollars.
      expect(Math.abs(amount(figures[0]) - (amount(figures[1]) - amount(figures[2])))).toBeLessThanOrEqual(1);
    });

    test('sums the year up in words', async ({ page }) => {
      await expect(page.locator('.reports-summary__headline')).toHaveText(/^(Kept|Spent) \$[\d,]+ |^Nothing is recorded/);
    });

    test('steps to the previous year and back', async ({ page }) => {
      const year = new Date().getFullYear();
      const next = page.getByRole('button', { name: 'Go to next year' });
      await expect(next).toBeDisabled();
      await page.getByRole('button', { name: 'Go to previous year' }).click();
      await expect(page.getByLabel('Year', { exact: true })).toHaveValue(String(year - 1));
      await expect(page.locator('.bw-subtitle')).toContainText(String(year - 1));
      await next.click();
      await expect(page.getByLabel('Year', { exact: true })).toHaveValue(String(year));
    });
  });

  test.describe('The twelve months', () => {
    test('draws every month and marks the current one', async ({ page }) => {
      await expect(page.locator('.reports-month')).toHaveCount(12);
      const current = new Date().toLocaleDateString('en-US', { month: 'short' });
      await expect(page.locator('.reports-month[data-current="true"] .reports-month__name')).toHaveText(current);
    });

    test('shows what a month was made of when it is picked', async ({ page }) => {
      const recorded = page.locator('.reports-month__bars:not([disabled])');
      test.skip(await recorded.count() === 0, 'Nothing is recorded this year.');
      await recorded.first().click();
      // Move the pointer away: hovering only previews, the click is what keeps the month.
      await page.mouse.move(0, 0);
      await expect(recorded.first()).toHaveAttribute('aria-pressed', 'true');
      const label = await recorded.first().getAttribute('aria-label');
      const name = label.split(':')[0];
      const detail = page.locator('.reports-detail');
      await expect(detail.getByRole('heading', { name, exact: true })).toBeVisible();
      await expect(detail.getByText('Came to')).toBeVisible();
      await expect(detail.getByRole('heading', { name: /^Income/ })).toBeVisible();
      await expect(detail.getByRole('heading', { name: /^Expenses/ })).toBeVisible();
      // The table marks the same month.
      await expect(page.locator('.reports-table tbody tr[data-selected="true"] th')).toContainText(name);
    });
  });

  test.describe('Charts', () => {
    test('writes each month\'s net under its column', async ({ page }) => {
      const recorded = await page.locator('.reports-month__bars:not([disabled])').count();
      test.skip(recorded === 0, 'Nothing is recorded this year.');
      const nets = await page.locator('.reports-month__came').allTextContents();
      expect(nets.filter((text) => /^[+−]\$[\d.]+k?$/.test(text))).toHaveLength(recorded);
    });

    test('draws the balance of the year as it built up', async ({ page }) => {
      const panel = page.getByRole('region', { name: 'The year so far' });
      await expect(panel).toBeVisible();
      const recorded = await page.locator('.reports-month__bars:not([disabled])').count();
      test.skip(recorded === 0, 'Nothing is recorded this year.');
      await expect(panel.getByRole('img')).toHaveAttribute('aria-label', /^Balance of the year month by month, ending at -?\$[\d,]+ in \w+$/);
      await expect(panel.locator('.reports-running__dot')).toHaveCount(recorded);
      // The figure at the end of the line is the year's net.
      const net = await page.locator('.bw-ledger dd').first().textContent();
      await expect(panel.locator('.reports-running__label').first()).toHaveText(net.replace('+', ''));
    });

    test('describes an average month', async ({ page }) => {
      const panel = page.getByRole('region', { name: 'An average month' });
      test.skip(await panel.count() === 0, 'Nothing is recorded this year.');
      await expect(panel.locator('dt')).toHaveText(['Income', 'Expenses', 'Net', 'Most spent', 'Least spent']);
    });

    test('maps the spending as tiles sized by share', async ({ page }) => {
      const tiles = page.getByRole('region', { name: 'The shape of the spending' }).locator('.reports-map__tile');
      test.skip(await tiles.count() === 0, 'No expenses recorded this year.');
      await expect(tiles.first()).toHaveAttribute('title', /^.+: \$[\d,]+, \d+%$/);
      // Tiles fill the map without leaving it: the shares in their titles add up to the whole.
      const shares = (await tiles.evaluateAll((items) => items.map((item) => item.title))).map((title) => Number(title.match(/(\d+)%$/)[1]));
      const total = shares.reduce((sum, share) => sum + share, 0);
      expect(total).toBeGreaterThanOrEqual(95);
      expect(total).toBeLessThanOrEqual(105);
      const boxes = await tiles.evaluateAll((items) => items.map((item) => {
        const frame = item.parentElement.getBoundingClientRect();
        const box = item.getBoundingClientRect();
        return box.left >= frame.left - 1 && box.right <= frame.right + 1 && box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1;
      }));
      expect(boxes.every(Boolean)).toBe(true);
    });

    test('opens the tile that holds the smallest categories, and goes back', async ({ page }) => {
      const panel = page.getByRole('region', { name: 'The shape of the spending' });
      const more = panel.getByRole('button', { name: /^Show the \d+ smallest categories$/ });
      test.skip(await more.count() === 0, 'Eleven categories or fewer: nothing is lumped together.');
      const lumped = Number((await more.getAttribute('aria-label')).match(/\d+/)[0]);
      const before = await panel.locator('.reports-map__tile').count();
      const together = (await panel.locator('.reports-map__tile[data-more="true"] .reports-map__amount').textContent()).trim();

      await more.click();
      // What is inside adds up to what the tile said.
      await expect(panel.locator('.reports-map__note')).toHaveText(`The ${lumped} smallest categories, ${together} together.`);
      await expect(panel.locator('.reports-map__tile[data-more="true"]')).toHaveCount(0);
      // Every one of them is either a tile or, when too small to label, named under the map.
      const tiles = await panel.locator('.reports-map__tile').count();
      const undrawn = panel.locator('.reports-map__undrawn');
      const named = await undrawn.count() ? (await undrawn.textContent()).split(':')[1].split('),').length : 0;
      expect(tiles + named).toBe(lumped);

      await panel.getByRole('button', { name: 'Back to all categories' }).click();
      await expect(panel.locator('.reports-map__tile')).toHaveCount(before);
    });

    test('shows the largest categories month by month', async ({ page }) => {
      const panel = page.getByRole('region', { name: 'Categories through the year' });
      const rows = panel.getByRole('row').filter({ has: page.getByRole('rowheader') });
      test.skip(await rows.count() === 0, 'No expenses recorded this year.');
      expect(await rows.count()).toBeLessThanOrEqual(8);
      await expect(rows.first().locator('.reports-heat__cell')).toHaveCount(12);
      await expect(rows.first().locator('.reports-heat__cell').first()).toHaveAttribute('title', /, January: (\$[\d,]+|nothing)$/);
    });

    test('says what a cell of the heat map stands for when it is picked', async ({ page }) => {
      const panel = page.getByRole('region', { name: 'Categories through the year' });
      const cell = panel.locator('.reports-heat__cell:not([data-empty="true"])').first();
      test.skip(await cell.count() === 0, 'No expenses recorded this year.');
      const picked = panel.locator('.reports-heat__picked');
      await expect(picked).toHaveText('Pick a cell to see what it stands for.');
      // "Food/Costco, January: $1,718" on the cell becomes "Food/Costco in January: $1,718, …" under the map.
      const [, name, month, amount] = (await cell.getAttribute('title')).match(/^(.+), (\w+): (\$[\d,]+)$/);
      await cell.click();
      await expect(cell).toHaveAttribute('aria-pressed', 'true');
      await expect(picked).toContainText(`${name} in ${month}: ${amount}`);
      await expect(picked).toContainText(/\d+% of the \$[\d,]+ it took this year/);
      // Picking it again lets go of it.
      await cell.click();
      await expect(picked).toHaveText('Pick a cell to see what it stands for.');
    });

    test('draws every tile of the map to scale', async ({ page }) => {
      const panel = page.getByRole('region', { name: 'The shape of the spending' });
      test.skip(await panel.locator('.reports-map__tile').count() === 0, 'No expenses recorded this year.');
      // The share of the map a tile covers on screen, against the share of the money it stands for.
      const gaps = () => panel.locator('.reports-map__tile').evaluateAll((tiles) => {
        const boxes = tiles.map((tile) => {
          const box = tile.getBoundingClientRect();
          return { amount: Number(tile.dataset.amount), area: box.width * box.height };
        });
        const amounts = boxes.reduce((sum, box) => sum + box.amount, 0);
        const areas = boxes.reduce((sum, box) => sum + box.area, 0);
        return boxes.map((box) => Math.abs(box.area / areas - box.amount / amounts));
      });
      // A tenth of a percent of the map is the allowance for rounding to pixels.
      expect(Math.max(...await gaps())).toBeLessThan(0.001);
      const more = panel.getByRole('button', { name: /^Show the \d+ smallest categories$/ });
      if (await more.count()) {
        await more.click();
        expect(Math.max(...await gaps())).toBeLessThan(0.001);
      }
    });

    test('gives every tile of the map its name, amount and share, inside the tile', async ({ page }) => {
      const tiles = page.getByRole('region', { name: 'The shape of the spending' }).locator('.reports-map__tile');
      test.skip(await tiles.count() === 0, 'No expenses recorded this year.');
      const problems = await tiles.evaluateAll((items) => items.flatMap((tile) => {
        const box = tile.getBoundingClientRect();
        return ['name', 'amount', 'share'].flatMap((part) => {
          const element = tile.querySelector(`.reports-map__${part}`);
          const inner = element?.getBoundingClientRect();
          if (!element?.textContent.trim() || !inner?.width) return [`${tile.title}: ${part} missing`];
          const inside = inner.top >= box.top - 0.5 && inner.bottom <= box.bottom + 0.5 && inner.right <= box.right + 0.5;
          return inside ? [] : [`${tile.title}: ${part} outside the tile`];
        });
      }));
      expect(problems).toEqual([]);
    });

    // Safari once drew the map wider than its panel, with the tiles on the right cut off.
    for (const [name, width] of [['a wide screen', 1440], ['a phone', 390]]) {
      test(`keeps every tile of the map inside its panel on ${name}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const map = page.getByRole('region', { name: 'The shape of the spending' });
        const tiles = map.locator('.reports-map__tile');
        test.skip(await tiles.count() === 0, 'No expenses recorded this year.');
        // The map settles after it has measured itself and fitted its text.
        await page.waitForTimeout(500);
        const outside = await map.evaluate((panel) => {
          const box = panel.getBoundingClientRect();
          return [...panel.querySelectorAll('.reports-map__tile')].filter((tile) => {
            const rect = tile.getBoundingClientRect();
            return rect.left < box.left - 0.5 || rect.right > box.right + 0.5 || rect.top < box.top - 0.5 || rect.bottom > box.bottom + 0.5;
          }).map((tile) => tile.title);
        });
        expect(outside).toEqual([]);
        // On a phone the map takes fewer tiles, so that each has room for its text.
        if (width < 480) expect(await tiles.count()).toBeLessThanOrEqual(8);
      });
    }
  });

  test.describe('Categories', () => {
    test('ranks where the money goes, largest first', async ({ page }) => {
      const panel = page.getByRole('region', { name: 'Where the money goes' });
      await expect(panel).toBeVisible();
      const amounts = (await panel.locator('.reports-rank__amount').allTextContents()).map(amount);
      test.skip(amounts.length === 0, 'No expenses recorded this year.');
      expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
      await expect(panel.locator('.reports-rank__share').first()).toHaveText(/^(<1|\d+)%$/);
    });

    test('can show every category', async ({ page }) => {
      const panel = page.getByRole('region', { name: 'Where the money goes' });
      const more = panel.getByRole('button', { name: /^Show all \d+$/ });
      test.skip(await more.count() === 0, 'Eight categories or fewer.');
      const total = Number((await more.textContent()).match(/\d+/)[0]);
      await expect(panel.locator('.reports-rank__row')).toHaveCount(8);
      await more.click();
      await expect(panel.locator('.reports-rank__row')).toHaveCount(total);
    });

    test('ranks where the money comes from', async ({ page }) => {
      await expect(page.getByRole('region', { name: 'Where it comes from' })).toBeVisible();
    });
  });

  test.describe('Month by month', () => {
    test('lists twelve months and a total', async ({ page }) => {
      const table = page.getByRole('table', { name: 'Month by month' });
      await expect(table.locator('tbody tr')).toHaveCount(12);
      await expect(table.locator('thead th')).toHaveText(['Month', 'Income', 'Expenses', 'Net', /Year so far/]);
      await expect(table.locator('tfoot th')).toHaveText('Total');
    });

    test('keeps a running total that ends at the year\'s net', async ({ page }) => {
      const table = page.getByRole('table', { name: 'Month by month' });
      const rows = table.locator('tbody tr[data-recorded="true"]');
      test.skip(await rows.count() === 0, 'Nothing is recorded this year.');
      const last = await rows.last().locator('td').allTextContents();
      const total = await table.locator('tfoot td').allTextContents();
      // Whole-dollar rounding of each figure allows a dollar of drift.
      expect(Math.abs(amount(last[3]) - amount(total[2]))).toBeLessThanOrEqual(1);
    });
  });
});
