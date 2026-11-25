const pageSize = 500;
const maxRows = 10_000;
const maxSuggestions = 4;
const maxCategorySummaries = 20;
const maxTopExpenses = 8;

export class BudgetReviewError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function monthBounds(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month.startsWith('0000')) {
    throw new BudgetReviewError('Budget month must be YYYY-MM.');
  }
  const start = `${month}-01`;
  const firstDay = new Date(`${start}T00:00:00Z`);
  const lastDay = new Date(firstDay);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  const previous = new Date(firstDay);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  return {
    start,
    end: lastDay.toISOString().split('T')[0],
    previousMonth: previous.getUTCFullYear() === 0 ? null : previous.toISOString().slice(0, 7),
  };
}

function cents(value) {
  const result = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(result)) throw new BudgetReviewError('A budget amount cannot be calculated precisely.');
  return result;
}

function addCents(total, amount) {
  const result = total + amount;
  if (!Number.isSafeInteger(result)) throw new BudgetReviewError('This budget total is too large to calculate precisely.');
  return result;
}

async function read(query) {
  const { data, error } = await query;
  if (error) throw new Error('BudgetWise could not read the budget.');
  return data;
}

async function readAll(query) {
  const rows = [];
  for (let offset = 0; offset <= maxRows; offset += pageSize) {
    const page = await read(query().order('id').range(offset, offset + pageSize - 1));
    rows.push(...page);
    if (rows.length > maxRows) throw new BudgetReviewError('Too many records for one budget review.');
    if (page.length < pageSize) break;
  }
  return rows;
}

async function loadLimits(supabase, userId, month, bounds) {
  const budgetFor = ({ start, end }) => read(supabase.from('budgets')
    .select('id,budget_categories(category_id,limit_amount)')
    .eq('user_id', userId)
    .gte('month', start)
    .lte('month', end)
    .maybeSingle());

  let budget = await budgetFor(bounds);
  let limitMonth = month;
  if (!budget && bounds.previousMonth) {
    limitMonth = bounds.previousMonth;
    budget = await budgetFor(monthBounds(limitMonth));
  }

  return {
    limits: new Map((budget?.budget_categories ?? []).map((entry) => [entry.category_id, cents(entry.limit_amount)])),
    limitMonth: budget ? limitMonth : null,
  };
}

export async function getCategoryBudgetLimits(supabase, userId, categoryId, firstMonth, lastMonth) {
  const first = monthBounds(firstMonth);
  const budgets = await read(supabase.from('budgets')
    .select('id,month,budget_categories(category_id,limit_amount)')
    .eq('user_id', userId)
    .gte('month', first.previousMonth ? `${first.previousMonth}-01` : first.start)
    .lte('month', monthBounds(lastMonth).end));
  const byMonth = new Map(budgets.map((budget) => [budget.month.slice(0, 7), budget]));
  const limits = new Map();
  for (let month = firstMonth; ; ) {
    const bounds = monthBounds(month);
    const limitMonth = byMonth.has(month) ? month : bounds.previousMonth;
    const entry = byMonth.get(limitMonth)?.budget_categories?.find(({ category_id }) => category_id === categoryId);
    const limit = entry ? cents(entry.limit_amount) : null;
    limits.set(month, { limit: limit > 0 ? limit : null, limitMonth: limit > 0 ? limitMonth : null });
    if (month === lastMonth) break;
    const next = new Date(`${bounds.start}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    month = next.toISOString().slice(0, 7);
  }
  return limits;
}

export function categoryBudgetTimeline(records, monthLimits, endDate, selectedIds) {
  const months = new Map(Array.from(monthLimits, ([month, { limit, limitMonth }]) => [month, {
    month, limitMonth, limit, spent: 0, spentThroughPeriodEnd: 0, crossing: null,
  }]));
  const impacts = new Map();
  for (const { id, date, description, amount } of records) {
    const month = months.get(date.slice(0, 7));
    const rowCents = Math.abs(cents(amount));
    month.spent = addCents(month.spent, rowCents);
    if (date > endDate) continue;

    const before = month.spentThroughPeriodEnd;
    const after = addCents(before, rowCents);
    month.spentThroughPeriodEnd = after;
    if (month.limit == null || after <= month.limit || rowCents <= 0) continue;

    const overAmount = Math.min(after - month.limit, rowCents) / 100;
    const budgetImpact = !month.crossing && before <= month.limit ? 'crossing' : 'after_limit';
    impacts.set(id, { budgetImpact, overAmount });
    if (budgetImpact === 'crossing') {
      month.crossing = { id, date, description, amount: rowCents / 100, overAmount, inSelection: selectedIds.has(id) };
    }
  }
  const budgets = Array.from(months.values(), ({ month, limitMonth, limit, spent, spentThroughPeriodEnd, crossing }) => ({
    month,
    limitMonth,
    limit: limit == null ? null : limit / 100,
    spent: spent / 100,
    spentThroughPeriodEnd: spentThroughPeriodEnd / 100,
    over: limit == null ? null : Math.max(0, spent - limit) / 100,
    overThroughPeriodEnd: limit == null ? null : Math.max(0, spentThroughPeriodEnd - limit) / 100,
    crossing,
  }));
  return { budgets, impacts };
}

function findCategory(categories, name) {
  if (name == null) return null;
  const normalized = (value) => value.trim().toUpperCase();
  const matches = categories.filter((category) => normalized(category.name) === normalized(name));
  if (!matches.length) throw new BudgetReviewError('No matching expense category was found.');
  if (matches.length > 1) throw new BudgetReviewError('Multiple expense categories have that name. Use the full monthly review.');
  return matches[0];
}

async function budgetSnapshot(supabase, userId, month, { categoryName = null, withDetails = false, categoryId, through } = {}) {
  const bounds = monthBounds(month);
  const expenseCategories = () => supabase.from('categories').select('id,name').eq('user_id', userId).eq('type', 'expense');
  const loadCategories = async () => {
    if (categoryId == null) return readAll(expenseCategories);
    const category = await read(expenseCategories().eq('id', categoryId).maybeSingle());
    if (!category) throw new BudgetReviewError('This expense category is unavailable. Refresh the suggestions and try again.', 404);
    return [category];
  };
  const [categories, { limits, limitMonth }] = await Promise.all([loadCategories(), loadLimits(supabase, userId, month, bounds)]);
  const category = categoryId == null ? findCategory(categories, categoryName) : categories[0];

  const expenseRows = await readAll(() => {
    const query = supabase.from('transactions')
      .select(withDetails ? 'category_id,amount,date,description,id' : 'category_id,amount')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .is('deleted_at', null)
      .gte('date', bounds.start)
      .lte('date', through ?? bounds.end);
    return category ? query.eq('category_id', category.id) : query;
  });
  const transactions = expenseRows.map((row) => ({ ...row, amount: Math.abs(Number(row.amount)) }));
  const byCategory = new Map();
  let total = 0;
  for (const transaction of transactions) {
    const amount = cents(transaction.amount);
    byCategory.set(transaction.category_id, addCents(byCategory.get(transaction.category_id) ?? 0, amount));
    total = addCents(total, amount);
  }

  const summaries = (category ? [category] : categories).map(({ id, name }) => ({
    category: name,
    categoryId: id,
    spent: byCategory.get(id) ?? 0,
    limit: limits.get(id) > 0 ? limits.get(id) : null,
  }));

  return { category, summaries, transactions, total, limitMonth };
}

const byName = (a, b) => a.category.localeCompare(b.category) ||
  String(a.categoryId).localeCompare(String(b.categoryId));
const bySpending = (a, b) => b.spent - a.spent || byName(a, b);
const isOverBudget = ({ spent, limit }) => limit > 0 && spent > limit;
const isNearBudget = ({ spent, limit }) => limit > 0 && spent <= limit && spent * 5 > limit * 4;

function publicCategory({ category, categoryId, spent, limit }) {
  return { category, categoryId, spent: spent / 100, limit: limit == null ? null : limit / 100 };
}

export async function getComparisonBudgetFlags(supabase, userId, through) {
  const month = through.slice(0, 7);
  const { summaries } = await budgetSnapshot(supabase, userId, month, { through });
  const flags = new Map();
  for (const summary of summaries) {
    const label = summary.category.slice(0, 250);
    // The comparison groups by label, so a limit cannot be attributed to an ambiguous row.
    if (flags.has(label) || label === 'Uncategorized' || !isOverBudget(summary)) {
      flags.set(label, null);
      continue;
    }
    const { spent, limit } = summary;
    flags.set(label, { month, spent: spent / 100, limit: limit / 100, amount: (spent - limit) / 100 });
  }
  return flags;
}

export async function getBudgetSuggestions(supabase, userId, month) {
  const { summaries } = await budgetSnapshot(supabase, userId, month);
  const overBudget = summaries
    .filter(isOverBudget)
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit ||
      (b.spent - b.limit) - (a.spent - a.limit) || byName(a, b))
    .slice(0, maxSuggestions)
    .map((item) => ({ ...publicCategory(item), over: (item.spent - item.limit) / 100 }));
  const nearBudget = summaries
    .filter(isNearBudget)
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit || bySpending(a, b))
    .slice(0, maxSuggestions)
    .map((item) => ({ ...publicCategory(item), remaining: (item.limit - item.spent) / 100 }));
  const top = summaries.filter((item) => item.spent > 0 && !isOverBudget(item)).sort(bySpending)[0];
  const topSpending = top ? { category: top.category, categoryId: top.categoryId, spent: top.spent / 100 } : null;

  return { month, overBudget, nearBudget, topSpending };
}

export async function getBudgetReview(supabase, userId, month, categoryName = null, { categoryId } = {}) {
  const { category, summaries, transactions, total, limitMonth } =
    await budgetSnapshot(supabase, userId, month, { categoryName, withDetails: true, categoryId });
  const names = new Map(summaries.map(({ category, categoryId }) => [categoryId, category]));
  const totalLimit = category
    ? summaries[0].limit
    : summaries.reduce((sum, item) => addCents(sum, item.limit ?? 0), 0);
  const limit = totalLimit > 0 ? totalLimit : null;
  const difference = limit == null ? null : addCents(total, -limit);
  const categorized = summaries.reduce((sum, item) => addCents(sum, item.spent), 0);
  const topExpenses = transactions
    .sort((a, b) => cents(b.amount) - cents(a.amount) || b.date.localeCompare(a.date) ||
      String(a.id).localeCompare(String(b.id)))
    .slice(0, maxTopExpenses)
    .map(({ date, description, amount, category_id }) => ({
      date,
      description: typeof description === 'string' ? description.slice(0, 250) : null,
      amount: cents(amount) / 100,
      category: names.get(category_id) ?? null,
    }));

  return {
    month,
    limit_month: limitMonth,
    category: category?.name ?? null,
    spending: total / 100,
    limit: limit == null ? null : limit / 100,
    ...(category && {
      difference: difference == null ? null : difference / 100,
      over: difference == null ? null : Math.max(0, difference) / 100,
    }),
    uncategorized_spending: addCents(total, -categorized) / 100,
    expense_count: transactions.length,
    top_expenses: topExpenses,
    omitted_expenses: Math.max(0, transactions.length - topExpenses.length),
    category_totals: summaries.sort(bySpending).slice(0, maxCategorySummaries).map(publicCategory),
    omitted_categories: Math.max(0, summaries.length - maxCategorySummaries),
  };
}
