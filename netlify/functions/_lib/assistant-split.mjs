export class SplitInputError extends Error {}

function cents(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || Number(value.toFixed(2)) !== value) {
    throw new SplitInputError(`${label} must be zero or more, with at most two decimal places.`);
  }
  return Math.round(value * 100);
}

// The lines of a receipt, added up per category. The model only says which category each line
// belongs to and what it costs as printed; a discount line is a negative price. Adding up is
// arithmetic, and a model that adds thirty prices in its head gets some of them wrong.
function partsFromItems(items) {
  const totals = new Map();
  for (const item of items) {
    const category = typeof item?.category === 'string' ? item.category.trim() : '';
    if (!category) throw new SplitInputError('Every item needs a category.');
    const { amount } = item;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || Number(amount.toFixed(2)) !== amount) {
      throw new SplitInputError('An item price must have at most two decimal places.');
    }
    const price = Math.round(amount * 100);
    const key = category.toLowerCase();
    const total = totals.get(key) ?? { category, amount: 0, taxed: 0 };
    total.amount += price;
    if (item.taxable === true) total.taxed += price;
    totals.set(key, total);
  }
  return [...totals.values()].map(({ category, amount, taxed }) => {
    if (amount <= 0) throw new SplitInputError(`The items in "${category}" do not add up to a positive amount. Check their prices.`);
    return { amount: amount / 100, category, description: null, taxable_amount: Math.min(Math.max(taxed, 0), amount) / 100 };
  });
}

// A receipt lists tax and fees once for the whole purchase. The model reports the pre-tax
// amount of each part and that one figure; sharing it out is arithmetic, so it happens here.
// Each part gets a share in proportion to its taxed amount, to the cent, and the shares
// always add up to the extra charge exactly.
export function spreadExtra(args) {
  if (!Array.isArray(args?.splits)) return args;
  return {
    ...args,
    splits: args.splits.map((split) => {
      const items = Array.isArray(split?.items) ? split.items : [];
      const parts = items.length ? partsFromItems(items) : Array.isArray(split?.parts) ? split.parts : [];
      const plain = parts.map(({ taxable_amount: _taxable, ...part }) => part);
      const extra = split?.extra == null ? 0 : cents(split.extra, 'The extra charge');
      if (!extra || !parts.length) return { ids: split?.ids, parts: plain };

      const amounts = parts.map((part) => cents(part.amount, 'A part amount'));
      const taxed = parts.map((part, index) =>
        (part.taxable_amount == null ? 0 : Math.min(cents(part.taxable_amount, 'A taxable amount'), amounts[index])));
      // Without any taxed amounts there is nothing to go by but the size of each part.
      const weights = taxed.some(Boolean) ? taxed : amounts;
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      if (!total) throw new SplitInputError('The parts need amounts before an extra charge can be shared between them.');

      const exact = weights.map((weight) => (extra * weight) / total);
      const shares = exact.map(Math.floor);
      let remaining = extra - shares.reduce((sum, share) => sum + share, 0);
      // Hand the leftover cents to the parts that were rounded down the most.
      const byRemainder = exact.map((value, index) => [value - shares[index], index]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
      for (const [, index] of byRemainder) {
        if (!remaining) break;
        shares[index] += 1;
        remaining -= 1;
      }
      return { ids: split.ids, parts: plain.map((part, index) => ({ ...part, amount: (amounts[index] + shares[index]) / 100 })) };
    }),
  };
}
