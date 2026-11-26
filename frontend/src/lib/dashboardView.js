const cents = (value) => Math.round(value * 100) / 100;
const sum = (nodes) => nodes.reduce((total, { amount }) => total + amount, 0);

// Where the month's money came from and where it went, as the two sides of one diagram.
//   left:  every source of income, largest first, and — when more was spent than came in —
//          a `shortfall` for the part income did not cover;
//   right: the largest `limit` categories, the rest together as `others` (listed in `others`),
//          spending without a category, and — when less was spent than came in — a `leftover`.
// Both sides add up to `total`, the larger of income and what income had to pay for, so they
// are drawn to one scale.
//
// A category marked `outside` is paid from money that is not recorded as income (a mortgage
// paid by someone else). It is kept apart: `outside` lists such categories and `other` is
// their sum, which is neither on the sides nor in the shortfall.
//
// `spending` is the month's spending by category: [{ id, name, spent, color, outside }].
export function moneyFlow(transactions, spending, { limit = 5 } = {}) {
  const sources = new Map();
  let income = 0;
  let spent = 0;
  transactions.forEach(({ type, amount, categories }) => {
    if (type !== 'income') {
      spent += Number(amount);
      return;
    }
    const name = categories?.name || 'Other income';
    sources.set(name, (sources.get(name) || 0) + Number(amount));
    income += Number(amount);
  });
  income = cents(income);
  spent = cents(spent);
  const share = (node) => { node.share = spent > 0 ? (node.amount / spent) * 100 : 0; };

  const categories = spending
    .filter((category) => category.spent > 0)
    .map(({ id, name, spent: amount, color, outside }) => ({ key: `category:${id}`, name, amount: cents(amount), color, kind: 'category', outside: Boolean(outside) }))
    .sort((a, b) => b.amount - a.amount);
  const outside = categories.filter((category) => category.outside);
  const own = categories.filter((category) => !category.outside);
  const other = cents(sum(outside));
  // What the recorded income had to pay for.
  const paid = cents(spent - other);

  const left = [...sources]
    .map(([name, amount]) => ({ key: `income:${name}`, name, amount: cents(amount), kind: 'income' }))
    .filter(({ amount }) => amount > 0)
    .sort((a, b) => b.amount - a.amount);
  if (paid > income) left.push({ key: 'shortfall', name: 'Shortfall', amount: cents(paid - income), kind: 'shortfall' });

  const loose = cents(paid - sum(own));
  // "Others" always stands for at least two categories: one alone is simply shown.
  const grouped = own.length > limit + 1 ? own.slice(limit) : [];
  const right = own.slice(0, own.length - grouped.length);
  if (grouped.length) right.push({ key: 'others', name: `${grouped.length} other categories`, amount: cents(sum(grouped)), kind: 'others' });
  if (loose > 0) right.push({ key: 'loose', name: 'No category', amount: loose, kind: 'loose' });
  right.forEach(share);
  outside.forEach(share);
  if (income > paid) right.push({ key: 'leftover', name: 'Left over', amount: cents(income - paid), kind: 'leftover' });

  return { income, spent, other, total: Math.max(income, paid), left, right, others: grouped, outside };
}

// Places the diagram, in pixels. Every amount is as high as its share of `base`, on both
// sides and in the middle, where the two sides meet without gaps. A side's parts are spread
// out so that each has `slot` of height for its label: a thin part gets room around it and is
// never drawn thicker. Each part gets `top` and `height` (its bar), `slotTop` and `slotHeight`
// (its label) and `joinTop` (where its band meets the middle).
//
// Money from outside the income is placed under all that: `apart.source` on the left and
// `apart.parts` on the right, each part with `fromTop`, where its band leaves the source.
export function flowLayout({ total, other = 0, left, right, outside = [] }, { base = 240, slot = 38, gap = 8 } = {}) {
  const scale = total + other > 0 ? base / (total + other) : 0;
  const column = (nodes) => {
    let cursor = 0;
    let join = 0;
    const placed = nodes.map((node) => {
      const height = node.amount * scale;
      const slotHeight = Math.max(height, slot);
      const entry = { ...node, height, slotHeight, slotTop: cursor, top: cursor + (slotHeight - height) / 2, joinTop: join };
      cursor += slotHeight + gap;
      join += height;
      return entry;
    });
    return { placed, height: Math.max(0, cursor - gap) };
  };
  // Centres each side in a block that begins at `start` and is as high as the taller side.
  const block = (sides, start, least = 0) => {
    const height = Math.max(least, ...sides.map((side) => side.height));
    const placed = sides.map((side) => {
      const shift = start + (height - side.height) / 2;
      return side.placed.map((node) => ({ ...node, top: node.top + shift, slotTop: node.slotTop + shift }));
    });
    return { height, placed };
  };

  const through = total * scale;
  const main = block([column(left), column(right)], 0, through);
  const middle = { top: (main.height - through) / 2, height: through };
  const [leftPlaced, rightPlaced] = main.placed.map((nodes) => nodes.map((node) => ({ ...node, joinTop: node.joinTop + middle.top })));
  if (!(other > 0)) return { height: main.height, middle, left: leftPlaced, right: rightPlaced, apart: null };

  const start = main.height > 0 ? main.height + gap * 3 : 0;
  const lower = block([column([{ key: 'other-money', name: 'Other money', amount: other, kind: 'outside' }]), column(outside)], start);
  const [[source], parts] = lower.placed;
  return {
    height: start + lower.height,
    middle,
    left: leftPlaced,
    right: rightPlaced,
    apart: { source, parts: parts.map((node) => ({ ...node, fromTop: source.top + node.joinTop })) },
  };
}
