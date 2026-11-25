// What the Reports page shows, worked out from the year's months: a ranking of categories,
// a running total, a sentence on how the year went, and the geometry of its charts.

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const hasData = (month) => month.income > 0 || month.expenses > 0;

// Categories largest first, each with its share of the whole. The page's loader keeps the five
// largest and folds the rest into "Others"; this unfolds them again.
export function rankCategories(categories) {
  const flat = categories
    .flatMap((category) => (Array.isArray(category.otherCategories) ? category.otherCategories : [category]))
    .filter(({ amount }) => amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = flat.reduce((sum, { amount }) => sum + amount, 0);
  return flat.map(({ name, amount }) => ({ name, amount, share: amount / total }));
}

// One month's categories, largest first, from the maps the loader builds.
export function monthCategories(month) {
  const sorted = (map) => Object.entries(map ?? {}).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  return { income: sorted(month.incomeCategories), expenses: sorted(month.expenseCategories) };
}

// Each month with the balance of the year up to and including it. A month with nothing
// recorded has no running total: the line stops rather than staying flat.
export function withRunningTotal(months) {
  let running = 0;
  return months.map((month) => {
    if (!hasData(month)) return { ...month, recorded: false, running: null };
    running += month.balance;
    return { ...month, recorded: true, running };
  });
}

// What a typical recorded month looks like, and the months that spent the most and the least.
export function averageMonth(months) {
  const recorded = months.filter(hasData);
  if (recorded.length === 0) return null;
  const mean = (pick) => recorded.reduce((sum, month) => sum + pick(month), 0) / recorded.length;
  const most = recorded.reduce((a, b) => (b.expenses > a.expenses ? b : a));
  const least = recorded.reduce((a, b) => (b.expenses < a.expenses ? b : a));
  return {
    months: recorded.length,
    income: mean((month) => month.income),
    expenses: mean((month) => month.expenses),
    net: mean((month) => month.balance),
    most: { name: MONTH_NAMES[most.monthIndex], expenses: most.expenses },
    least: { name: MONTH_NAMES[least.monthIndex], expenses: least.expenses },
  };
}

// The largest expense categories of the year, each with what it took in every month:
// the rows of the heat map.
export function heatRows(months, limit = 8) {
  const totals = new Map();
  for (const month of months) {
    for (const [name, amount] of Object.entries(month.expenseCategories ?? {})) {
      totals.set(name, (totals.get(name) ?? 0) + amount);
    }
  }
  return [...totals]
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, total]) => ({ name, total, cells: months.map((month) => month.expenseCategories?.[name] ?? 0) }));
}

// A squarified treemap (Bruls, Huizing and van Wijk): one rectangle per value, with areas in
// proportion to the values and shapes kept as close to squares as the order allows.
// Give the values largest first. Returns { x, y, width, height } in the same order.
export function treemap(values, width, height) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return [];
  const areas = values.map((value) => (value * width * height) / total);
  const rects = new Array(areas.length);
  // How far the worst rectangle of a row is from a square, for a row laid along `side`.
  const worst = (row, side) => {
    const sum = row.reduce((a, b) => a + b, 0);
    return Math.max((side * side * Math.max(...row)) / (sum * sum), (sum * sum) / (side * side * Math.min(...row)));
  };

  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let start = 0;
  while (start < areas.length) {
    const side = Math.min(w, h);
    let end = start + 1;
    while (end < areas.length && worst(areas.slice(start, end + 1), side) <= worst(areas.slice(start, end), side)) end += 1;

    const sum = areas.slice(start, end).reduce((a, b) => a + b, 0);
    const thickness = sum / side;
    let offset = 0;
    for (let index = start; index < end; index += 1) {
      const length = areas[index] / thickness;
      rects[index] = w >= h
        ? { x, y: y + offset, width: thickness, height: length }
        : { x: x + offset, y, width: length, height: thickness };
      offset += length;
    }
    if (w >= h) {
      x += thickness;
      w -= thickness;
    } else {
      y += thickness;
      h -= thickness;
    }
    start = end;
  }
  return rects;
}

// How the year went, in a headline and a sentence.
export function yearSummary(months, totals, money) {
  const recorded = months.filter(hasData);
  if (recorded.length === 0) return { tone: 'neutral', headline: 'Nothing is recorded for this year', detail: '' };

  const inBlack = recorded.filter(({ balance }) => balance >= 0).length;
  const best = recorded.reduce((a, b) => (b.balance > a.balance ? b : a));
  const worst = recorded.reduce((a, b) => (b.balance < a.balance ? b : a));
  const signed = (amount) => `${amount < 0 ? '−' : '+'}${money(Math.abs(amount))}`;
  const name = (month) => MONTH_NAMES[month.monthIndex];
  const leftOver = `${inBlack} of ${recorded.length} ${recorded.length === 1 ? 'month' : 'months'} ended with money left over.`;
  const extremes = recorded.length > 1 ? ` Best: ${name(best)} (${signed(best.balance)}). Hardest: ${name(worst)} (${signed(worst.balance)}).` : '';
  const perDollar = totals.income > 0 ? ` For every $1.00 that came in, $${(totals.expenses / totals.income).toFixed(2)} went out.` : '';

  return totals.balance >= 0
    ? { tone: 'good', headline: `Kept ${money(totals.balance)} of what came in`, detail: `${leftOver}${extremes}${perDollar}` }
    : { tone: 'bad', headline: `Spent ${money(-totals.balance)} more than came in`, detail: `${leftOver}${extremes}${perDollar}` };
}
