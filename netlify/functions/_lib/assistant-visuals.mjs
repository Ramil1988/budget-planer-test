const maxVisuals = 3;
export const ledgerCurrency = 'CAD';

const otherCurrencyCodes = Intl.supportedValuesOf('currency').filter((code) => code !== ledgerCurrency).join('|');
const foreignCurrencyWords = String.raw`EUR|USD|GBP|JPY|CNY|RUB|euros?|евро|pounds? sterling|фунт\p{L}* стерлингов|yen|(?:иен|йен)\p{L}*|(?:US|American) dollars?|доллар\p{L}* США`;
const currencyGap = String.raw`[\p{Zs}\t*_+−-]*`;

function numericCurrencyLabel(unit, flags = 'u') {
  return new RegExp(String.raw`(?:\p{Nd}${currencyGap}(?:${unit})(?!\p{L})|(?<!\p{L})(?:${unit})${currencyGap}\p{Nd})`, flags);
}

const foreignAmountCode = numericCurrencyLabel(otherCurrencyCodes);
const foreignAmountName = numericCurrencyLabel(foreignCurrencyWords, 'iu');
const foreignAmountSymbol = numericCurrencyLabel(String.raw`(?:US|AU|NZ|SG|HK|MX|NT|A|R)\$|(?!\$)\p{Sc}`);
const foreignCurrencyQualifier = new RegExp(
  String.raw`(?<!\p{L})(?:in|в)\p{Zs}+(?:${foreignCurrencyWords})(?!\p{L})`, 'iu',
);

export function hasForeignCurrencyLabel(message) {
  return foreignAmountCode.test(message) || foreignAmountName.test(message) || foreignAmountSymbol.test(message) ||
    foreignCurrencyQualifier.test(message);
}

export function spendingSummaryVisual(summary, { type, account, category, search, expenseCategories }) {
  const scope = {
    ...(type && { type }),
    ...(account && { account: account.name.slice(0, 250) }),
    ...(category && { category: category.name.slice(0, 250) }),
    ...(search && { search }),
  };
  return {
    kind: 'spending-summary',
    currency: ledgerCurrency,
    startDate: summary.start_date,
    endDate: summary.end_date,
    transactionCount: summary.count,
    income: summary.income,
    expenses: summary.expenses,
    net: summary.net,
    categories: expenseCategories.map(({ name, amount }) => ({ label: name, amount })),
    categoryCount: summary.expense_category_count,
    ...(Object.keys(scope).length && { scope }),
  };
}

function amountsByCategory({ categories }) {
  const amounts = new Map();
  for (const { label, amount } of categories) {
    amounts.set(label, (amounts.get(label) ?? 0) + Math.round(amount * 100));
  }
  return amounts;
}

export function categoryComparisonVisual(first, second) {
  const [earlier, latest] = [first, second].sort((a, b) =>
    a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
  const previous = amountsByCategory(earlier);
  const current = amountsByCategory(latest);
  const categories = Array.from(new Set([...previous.keys(), ...current.keys()]), (label) => {
    const earlierCents = previous.get(label) ?? 0;
    const latestCents = current.get(label) ?? 0;
    const change = latestCents - earlierCents;
    const percentChange = earlierCents === 0 ? null : Number((change / earlierCents * 100).toFixed(2));
    return { label, earlier: earlierCents / 100, latest: latestCents / 100, change: change / 100, percentChange };
  });
  categories.sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || b.latest - a.latest || a.label.localeCompare(b.label));
  const period = ({ startDate, endDate, expenses }) => ({ startDate, endDate, total: expenses });
  const { account, category, search } = latest.scope ?? {};
  return {
    kind: 'category-comparison',
    currency: ledgerCurrency,
    earlier: period(earlier),
    latest: period(latest),
    categories,
    ...((account || category || search) && { scope: { account, category, search } }),
  };
}

export function compareMatchingSummaryVisuals(visuals) {
  if (visuals.size !== 2) return null;
  const [[firstKey, first], [secondKey, second]] = [...visuals];
  const expenseSummary = (visual) => visual.kind === 'spending-summary' && visual.expenses != null;
  if (!expenseSummary(first) || !expenseSummary(second)) return null;
  if (first.endDate >= second.startDate && second.endDate >= first.startDate) return null;
  const scopeKey = (key) => JSON.stringify(JSON.parse(key).slice(3));
  if (scopeKey(firstKey) !== scopeKey(secondKey)) return null;
  return categoryComparisonVisual(first, second);
}

export function budgetReviewVisual(review) {
  const difference = review.limit == null
    ? null
    : review.difference ?? (Math.round(review.spending * 100) - Math.round(review.limit * 100)) / 100;

  return {
    kind: 'budget-review',
    currency: ledgerCurrency,
    month: review.month,
    category: review.category,
    ...(review.category != null && { categoryId: review.category_totals[0]?.categoryId }),
    spent: review.spending,
    limit: review.limit,
    limitMonth: review.limit_month,
    difference,
    transactionCount: review.expense_count,
    expenses: review.top_expenses.map(({ description, date, amount, category }) => ({ description, date, amount, category })),
    ...(review.category == null && {
      categoryTotals: review.category_totals.map(({ category, spent, limit }) => ({ label: category, spent, limit })),
    }),
  };
}

export function captureAssistantVisual(visuals, toolName, result, filters) {
  if (result?.ok !== true) return false;

  let key;
  let visual;
  if (toolName === 'summarize_transactions') {
    const { type, account, category, search } = filters;
    key = JSON.stringify(['spending-summary', result.start_date, result.end_date, type, account?.id, category?.id, search?.toLowerCase()]);
    if (!visuals.has(key) && visuals.size < maxVisuals) visual = spendingSummaryVisual(result, filters);
  } else if (toolName === 'get_budget_review') {
    key = JSON.stringify(['budget-review', result.month, result.category]);
    if (!visuals.has(key) && visuals.size < maxVisuals) visual = budgetReviewVisual(result);
  }
  if (visual) visuals.set(key, visual);
  return visuals.has(key);
}
