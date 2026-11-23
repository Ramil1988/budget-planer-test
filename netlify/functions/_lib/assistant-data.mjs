import { createHash } from 'node:crypto';
import { BudgetReviewError, categoryBudgetTimeline, getBudgetReview, getCategoryBudgetLimits, monthBounds } from './assistant-budget.mjs';
import { prepareAssistantTransaction, proposeAssistantChanges, TransactionReviewError } from './assistant-transaction.mjs';
import { getPaymentDatesInRange, getPaymentsUntilSalary } from '../../../frontend/src/lib/recurringUtils.js';
import { MATCH_WINDOW_DAYS, matchesRecurringOccurrence } from '../../../frontend/src/lib/recurringAutoAdd.js';

const MONEY_TYPES = ['income', 'expense'];
const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];
const MAX_AMOUNT = 9_999_999_999.99;
const MAX_DAYS = 366;
const SUMMARY_PAGE_SIZE = 500;
const MAX_SUMMARY_ROWS = 5000;
const MAX_DRILLDOWN_ROWS = 100;
const MAX_UPCOMING_ROWS = 240;
const MAX_DAILY_PROJECTION_MOVEMENTS = 30;
const MAX_PROJECTION_MOVEMENTS = 3000;
const calendarDayMs = 86_400_000;

const RECORDS = {
  accounts: { select: 'name,balance', order: 'name' },
  categories: { select: 'name,type', order: 'name' },
  budgets: {
    select: 'month,total,budget_categories(limit_amount,spent,category:categories(name))',
    order: 'month',
    ascending: false,
  },
  recurring_payments: {
    select: 'name,type,amount,frequency,frequency_interval,start_date,end_date,is_active,category:categories(name)',
    order: 'start_date',
    ascending: false,
  },
  assets: { select: 'name,amount,category:asset_categories(name)', order: 'name' },
  liabilities: {
    select: 'creditor,outstanding_balance,monthly_payment,interest_rate,type:liability_types(name)',
    order: 'creditor',
  },
};

export const CHANGES_TOOL = 'propose_transaction_changes';
const field = (type, description) => ({ type, description });
const optionalText = (description) => field(['string', 'null'], description);
const typeField = { type: 'string', enum: MONEY_TYPES };
const optionalType = { type: ['string', 'null'], enum: [...MONEY_TYPES, null] };
const rangeFields = {
  start_date: field('string', 'Inclusive starting date as YYYY-MM-DD.'),
  end_date: field('string', 'Inclusive ending date as YYYY-MM-DD.'),
  type: optionalType,
  category: optionalText('Existing category name, or null for all categories.'),
  account: optionalText('Existing account name, or null for all accounts.'),
  search: optionalText('Literal text to find in transaction descriptions, or null.'),
};
const paginationFields = {
  limit: field(['integer', 'null'], 'Rows per page, 1 to 30, or null for 15.'),
  offset: field(['integer', 'null'], 'Zero-based number of rows to skip, or null to start at 0.'),
};

function tool(name, description, properties) {
  return {
    type: 'function',
    name,
    description,
    strict: true,
    parameters: {
      type: 'object',
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    },
  };
}

export const assistantTools = [
  tool('list_transactions', 'Find your recorded income and expenses with optional filters. Use only for the requested dates and details.', {
    ...rangeFields,
    ...paginationFields,
  }),
  tool('summarize_transactions', 'Calculate exact transaction totals for the given period (at most 366 days). For an overall financial review or comparison always use type:null and set other filters to null unless explicitly requested. An expense-only or income-only filter (including a category of that type) returns null for excluded metrics and net. Null means outside the scope of the query, never zero.', rangeFields),
  tool('compare_spending_categories', 'Compare recorded expense amounts by category across two date ranges in CAD. Use for comparisons across all categories, including percentage changes. Use null periods only for the current month-to-date compared with the corresponding days of the preceding month; pass both inclusive ranges when the user specifies periods. Only apply a scope when the user requests the same filter for both periods.', {
    periods: {
      type: ['array', 'null'],
      items: {
        type: 'object',
        properties: {
          startDate: field('string', 'Inclusive first day of the range, YYYY-MM-DD.'),
          endDate: field('string', 'Inclusive last day of the range, YYYY-MM-DD.'),
        },
        required: ['startDate', 'endDate'],
        additionalProperties: false,
      },
    },
    scope: {
      type: ['object', 'null'],
      properties: {
        account: rangeFields.account,
        category: rangeFields.category,
        search: rangeFields.search,
      },
      required: ['account', 'category', 'search'],
      additionalProperties: false,
    },
  }),
  tool('list_finance_records', 'Read your accounts, categories, monthly budgets and category limits, recurring payment schedules, assets or liabilities. Choose one record kind per call.', {
    kind: { type: 'string', enum: Object.keys(RECORDS) },
    month: optionalText('YYYY-MM to select one month of budgets. Null for other kinds or recent budgets.'),
    type: optionalType,
    ...paginationFields,
  }),
  tool('get_budget_review', 'Read actual recorded expenses, effective monthly budget limits, and the largest expense records to explain what drove spending. Use it to review a month or an expense category, including questions about budget suggestions. This is actual recorded spending, not a projection.', {
    month: optionalText('Month in YYYY-MM format, or null to use the current month.'),
    category: optionalText('Exact existing expense category name, or null to review all expenses.'),
  }),
  tool('get_upcoming_payments', 'Read upcoming scheduled payment and income occurrences from the calendar, with exact totals. Use when asked what is coming up, for a dated schedule, or a chart of upcoming payments.', {
    start_date: optionalText('Inclusive first day in YYYY-MM-DD, or null for today.'),
    end_date: optionalText('Inclusive last day in YYYY-MM-DD, or null for 30 days including the first day.'),
    type: optionalType,
  }),
  tool('get_payments_until_salary', 'Find the next scheduled salary from Upcoming Payments and calculate exact scheduled bills from today through payday, inclusive. Call for questions about having enough money until salary, even if the user did not provide a date, account or currency.', {
    available_amount: field(['number', 'null'], 'Amount the user says is available, without currency conversion. Null if no amount was supplied.'),
    end_date: optionalText('Explicit YYYY-MM-DD cutoff supplied by the user. Null to look up payday from the calendar.'),
  }),
  tool('create_transaction', 'Record an explicitly requested income or expense. Does not move money. Supply the existing account and matching category only when named unambiguously. Pass null if either is missing to open the transaction review. Never invent them.', {
    type: typeField,
    amount: field('number', 'Positive amount with at most two decimal places. Do not convert currencies.'),
    date: field('string', 'Transaction date in calendar format YYYY-MM-DD.'),
    category: optionalText('Exact existing category name matching the transaction type, or null to choose during review.'),
    account: optionalText('Exact existing account name, or null to choose during review.'),
    description: optionalText('Brief user-provided description, or null for the standard label.'),
  }),
  tool(CHANGES_TOOL, 'Prepare changes to transactions that already exist: move one to another category, correct an amount or description, split a purchase across categories (use splits), or remove an entry. This does not change anything. The app shows the changes in a card and applies them only when the user approves. Look the transactions up with list_transactions first and use their ids. Put every change for the request in one call.', {
    updates: {
      type: 'array',
      description: 'Existing transactions to edit. Empty if none.',
      items: {
        type: 'object',
        properties: {
          id: field('string', 'Transaction id from list_transactions.'),
          amount: field(['number', 'null'], 'New positive amount with at most two decimal places, or null to keep the amount.'),
          category: optionalText('Exact existing category name matching the transaction type, or null to keep the category.'),
          description: optionalText('New description, or null to keep the description.'),
        },
        required: ['id', 'amount', 'category', 'description'],
        additionalProperties: false,
      },
    },
    additions: {
      type: 'array',
      description: 'New transactions that take their type, date and account from an existing one. Use for the extra parts of a split. Empty if none.',
      items: {
        type: 'object',
        properties: {
          copy_from: field('string', 'Id of the existing transaction whose type, date and account the new one copies.'),
          amount: field('number', 'Positive amount with at most two decimal places.'),
          category: field('string', 'Exact existing category name matching the transaction type.'),
          description: optionalText('Description, or null to reuse the description of the copied transaction.'),
        },
        required: ['copy_from', 'amount', 'category', 'description'],
        additionalProperties: false,
      },
    },
    removals: {
      type: 'array',
      description: 'Ids of existing transactions to move to the trash. Empty if none.',
      items: { type: 'string' },
    },
    splits: {
      type: 'array',
      description: 'Purchases to divide across categories without changing their total. The app turns the parts into edits of the selected transactions and rejects parts that do not add up. Empty if none.',
      items: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            description: 'Ids of the existing transactions that together make up the purchase.',
            items: { type: 'string' },
          },
          parts: {
            type: 'array',
            description: 'The parts that replace those transactions. Their amounts must add up to the total of the selected transactions.',
            items: {
              type: 'object',
              properties: {
                amount: field('number', 'Positive amount with at most two decimal places.'),
                category: field('string', 'Exact existing category name matching the transaction type.'),
                description: optionalText('Description, or null to keep the description of the original transaction.'),
              },
              required: ['amount', 'category', 'description'],
              additionalProperties: false,
            },
          },
        },
        required: ['ids', 'parts'],
        additionalProperties: false,
      },
    },
  }),
  tool('create_account', 'Create an explicitly requested account in the budget ledger.', {
    name: field('string', 'User-provided account name.'),
    balance: field(['number', 'null'], 'Explicit opening balance with at most two decimals, or null for zero.'),
  }),
  tool('create_category', 'Create an explicitly requested budget category.', {
    name: field('string', 'User-provided category name.'),
    type: typeField,
  }),
  tool('create_recurring_payment', 'Create an explicitly requested recurring income or expense schedule. It does not create a transaction or turn on automatic posting.', {
    name: field('string', 'User-provided schedule name.'),
    type: typeField,
    amount: field('number', 'Positive amount with at most two decimal places.'),
    category: optionalText('Exact existing category name matching the type, or null.'),
    frequency: { type: 'string', enum: FREQUENCIES },
    frequency_interval: field('integer', 'Number of frequency units per interval, 1 to 999. Use 1 for the ordinary frequency.'),
    start_date: field('string', 'First occurrence date as YYYY-MM-DD.'),
    end_date: optionalText('Last allowed calendar date as YYYY-MM-DD, or null for ongoing.'),
  }),
];

const WRITE_TYPES = {
  create_transaction: 'transaction',
  create_account: 'account',
  create_category: 'category',
  create_recurring_payment: 'recurring',
};

export const isWriteTool = (name) => Object.hasOwn(WRITE_TYPES, name);

export class ToolInputError extends Error {}

function asText(value, label, maxLength = 100) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\p{Cc}]/u.test(text)) {
    throw new ToolInputError(`${label} must be between 1 and ${maxLength} characters.`);
  }
  return text;
}

function optionalName(value, label) {
  return value == null || (typeof value === 'string' && !value.trim()) ? null : asText(value, label);
}

function asDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    throw new ToolInputError(`${label} must be a valid date in YYYY-MM-DD format.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ToolInputError(`${label} must be a valid date in YYYY-MM-DD format.`);
  }
  return value;
}

function asType(value) {
  if (!MONEY_TYPES.includes(value)) throw new ToolInputError('Type must be income or expense.');
  return value;
}

function asAmount(value, allowZeroOrNegative = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > MAX_AMOUNT ||
      Number(value.toFixed(2)) !== value || (!allowZeroOrNegative && value <= 0)) {
    throw new ToolInputError(allowZeroOrNegative
      ? 'Opening balance must be a valid amount with at most two decimal places.'
      : 'Amount must be positive and have at most two decimal places.');
  }
  return value;
}

function paginate({ limit, offset }) {
  const size = limit ?? 15;
  const start = offset ?? 0;
  if (!Number.isInteger(size) || size < 1 || size > 30 || !Number.isInteger(start) || start < 0 || start > 5000) {
    throw new ToolInputError('Use a page size of 1 to 30 and an offset of 0 to 5000.');
  }
  return { size, start };
}

async function fetchData(query) {
  const { data, error } = await query;
  if (error) throw new Error('BudgetWise data request failed.');
  return data;
}

function literalLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

async function matchingNames(supabase, userId, table, name, type = null) {
  const columns = table === 'categories' ? 'id,name,type' : 'id,name';
  const byName = supabase.from(table).select(columns).eq('user_id', userId);
  const query = type === null ? byName : byName.eq('type', type);

  // PostgREST treats * as a LIKE wildcard. Match that spelling exactly if present.
  const filtered = name.includes('*') ? query.eq('name', name) : query.ilike('name', literalLike(name));
  const matches = await fetchData(filtered.limit(3));
  return matches.filter((row) => row.name.toLowerCase() === name.toLowerCase());
}

async function resolveName(supabase, userId, table, rawName, type = null) {
  const label = table === 'categories' ? 'Category' : 'Account';
  const name = asText(rawName, label);
  const matches = await matchingNames(supabase, userId, table, name, type);
  if (matches.length === 0) throw new ToolInputError(`${label} not found in your BudgetWise data${type ? ` for ${type}` : ''}.`);
  if (matches.length > 1) throw new ToolInputError(`${label} name is ambiguous. Choose a uniquely named ${label.toLowerCase()}.`);
  return matches[0];
}

function transactionDateRange(startValue, endValue) {
  const start = asDate(startValue, 'Starting date');
  const end = asDate(endValue, 'Ending date');
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1;
  if (days < 1 || days > MAX_DAYS) {
    throw new ToolInputError('Choose a date range of up to 366 days with the start before the end.');
  }
  return { start, end };
}

async function getTransactionFilters(supabase, userId, args) {
  const { start, end } = transactionDateRange(args.start_date, args.end_date);
  const type = args.type == null ? null : asType(args.type);
  const search = args.search == null ? null : asText(args.search, 'Search text');
  // Keep search literal in the PostgREST LIKE filter.
  if (search?.includes('*')) throw new ToolInputError('Search text cannot contain *.');
  const [category, account] = await Promise.all([
    args.category == null ? null : resolveName(supabase, userId, 'categories', args.category, type),
    args.account == null ? null : resolveName(supabase, userId, 'accounts', args.account),
  ]);

  return { start, end, type, search, category, account };
}

function transactions(supabase, userId, filters, columns) {
  let query = supabase
    .from('transactions')
    .select(columns)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('date', filters.start)
    .lte('date', filters.end);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.category) query = query.eq('category_id', filters.category.id);
  if (filters.account) query = query.eq('account_id', filters.account.id);
  if (filters.search) query = query.ilike('description', `%${literalLike(filters.search)}%`);
  return query;
}

function trimStrings(value) {
  if (typeof value === 'string') return value.slice(0, 250);
  if (Array.isArray(value)) return value.map(trimStrings);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, trimStrings(item)]));
  }
  return value;
}

function listPage(rows, { size, start }) {
  return {
    ok: true,
    records: trimStrings(rows.slice(0, size)),
    next_offset: rows.length > size ? start + size : null,
  };
}

async function listTransactions(supabase, userId, args) {
  const page = paginate(args);
  const filters = await getTransactionFilters(supabase, userId, args);
  const rows = await fetchData(transactions(supabase, userId, filters,
    'id,date,type,amount,description,provider,account:accounts(name),category:categories(name)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id')
    .range(page.start, page.start + page.size));
  return listPage(rows, page);
}

export async function summarizeTransactions(supabase, userId, args) {
  const selected = await getTransactionFilters(supabase, userId, args);
  const filters = { ...selected, type: selected.type ?? selected.category?.type ?? null };
  let income = 0;
  let expenses = 0;
  let count = 0;
  const byCategory = new Map();

  for (let start = 0; start <= MAX_SUMMARY_ROWS; start += SUMMARY_PAGE_SIZE) {
    const rows = await fetchData(transactions(supabase, userId, filters, 'type,amount,category:categories(name)')
      .order('id')
      .range(start, start + SUMMARY_PAGE_SIZE - 1));
    count += rows.length;
    if (count > MAX_SUMMARY_ROWS) throw new ToolInputError('This period contains too many transactions. Choose a shorter date range.');
    for (const row of rows) {
      const cents = Math.round(Number(row.amount) * 100);
      if (row.type === 'income') income += cents;
      else {
        expenses += cents;
        const name = row.category?.name ?? 'Uncategorized';
        byCategory.set(name, (byCategory.get(name) ?? 0) + cents);
      }
    }
    if (rows.length < SUMMARY_PAGE_SIZE) break;
  }

  const expenseCategories = [...byCategory]
    .sort((a, b) => b[1] - a[1])
    .map(([name, cents]) => ({ name: name.slice(0, 250), amount: cents / 100 }));
  const result = {
    ok: true,
    start_date: filters.start,
    end_date: filters.end,
    count,
    scope_type: filters.type,
    income: filters.type === 'expense' ? null : income / 100,
    expenses: filters.type === 'income' ? null : expenses / 100,
    net: filters.type == null ? (income - expenses) / 100 : null,
    top_expense_categories: expenseCategories.slice(0, 20),
    expense_category_count: expenseCategories.length,
  };
  return { result, visualFilters: { ...filters, expenseCategories } };
}

function comparisonDateRanges(periods, today) {
  if (periods == null) {
    const currentStart = `${today.slice(0, 7)}-01`;
    const previousEnd = new Date(`${currentStart}T00:00:00Z`);
    previousEnd.setUTCDate(0);
    const day = Math.min(previousEnd.getUTCDate(), Number(today.slice(8)));
    const previousMonth = previousEnd.toISOString().slice(0, 7);
    return [
      { start: `${previousMonth}-01`, end: `${previousMonth}-${String(day).padStart(2, '0')}` },
      { start: currentStart, end: today },
    ];
  }
  if (!Array.isArray(periods) || periods.length !== 2) throw new ToolInputError('Choose two periods to compare.');
  const ranges = periods.map((period) => transactionDateRange(period?.startDate, period?.endDate));
  if (ranges[0].start === ranges[1].start && ranges[0].end === ranges[1].end) {
    throw new ToolInputError('Choose two different periods to compare.');
  }
  return ranges.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

export async function compareExpenseCategories(supabase, userId, periods, today, scope) {
  if (scope != null && (typeof scope !== 'object' || Array.isArray(scope))) {
    throw new ToolInputError('Choose valid comparison filters.');
  }
  const ranges = comparisonDateRanges(periods, today);
  return Promise.all(ranges.map(({ start, end }) => summarizeTransactions(supabase, userId, {
    start_date: start,
    end_date: end,
    type: 'expense',
    account: scope?.account,
    category: scope?.category,
    search: scope?.search,
  })));
}

async function drilldownRows(supabase, userId, filters, categoryIds, includeUncategorized) {
  const columns = 'id,date,amount,description';
  const records = [];
  for (let offset = 0; offset <= MAX_SUMMARY_ROWS; offset += SUMMARY_PAGE_SIZE) {
    let query = transactions(supabase, userId, filters, columns);
    if (includeUncategorized) {
      query = categoryIds.length > 0
        ? query.or(`category_id.is.null,category_id.in.(${categoryIds.join(',')})`)
        : query.is('category_id', null);
    } else {
      query = categoryIds.length === 1 ? query.eq('category_id', categoryIds[0]) : query.in('category_id', categoryIds);
    }
    const page = await fetchData(query.order('date').order('created_at').order('id')
      .range(offset, offset + SUMMARY_PAGE_SIZE - 1));
    records.push(...page);
    if (records.length > MAX_SUMMARY_ROWS) throw new ToolInputError('Too many transactions to review. Choose a shorter date range.');
    if (page.length < SUMMARY_PAGE_SIZE) break;
  }
  return records.map(({ id, date, amount, description }) => ({
    id,
    date,
    amount: Number(amount),
    description: typeof description === 'string' ? description.slice(0, 250) : null,
  }));
}

export async function getCategoryDrilldown(supabase, userId, { category, startDate, endDate, scope }) {
  asText(category, 'Expense category', 250);
  if (scope != null && (typeof scope !== 'object' || Array.isArray(scope))) {
    throw new ToolInputError('Choose valid comparison filters.');
  }
  const selected = await getTransactionFilters(supabase, userId, {
    start_date: startDate, end_date: endDate, type: 'expense',
    category: scope?.category, account: scope?.account, search: scope?.search,
  });
  if (selected.category && selected.category.name !== category) {
    throw new ToolInputError('Choose a category from the comparison.');
  }
  const categoryMatches = selected.category ? [selected.category] : await fetchData(supabase.from('categories')
    .select('id').eq('user_id', userId).eq('type', 'expense').eq('name', category));
  const categoryIds = categoryMatches.map(({ id }) => id);
  const includeUncategorized = !selected.category && category === 'Uncategorized';
  if (!categoryIds.length && !includeUncategorized) {
    throw new ToolInputError('This expense category is unavailable. Refresh the comparison and try again.');
  }

  const firstMonth = selected.start.slice(0, 7);
  const lastMonth = selected.end.slice(0, 7);
  const categoryHasBudget = categoryIds.length === 1 && !includeUncategorized;
  const withoutCategory = { ...selected, category: null };
  const range = categoryHasBudget ? {
    start: monthBounds(firstMonth).start, end: monthBounds(lastMonth).end, type: 'expense',
  } : withoutCategory;
  const separateSelection = categoryHasBudget && (selected.account || selected.search);
  const [records, scopedRecords, monthLimits] = await Promise.all([
    drilldownRows(supabase, userId, range, categoryIds, includeUncategorized),
    separateSelection ? drilldownRows(supabase, userId, withoutCategory, categoryIds, includeUncategorized) : null,
    categoryHasBudget ? getCategoryBudgetLimits(supabase, userId, categoryIds[0], firstMonth, lastMonth) : new Map(),
  ]);
  const matching = scopedRecords ?? records.filter(({ date }) => date >= selected.start && date <= selected.end);
  const selectedIds = new Set(matching.map(({ id }) => id));
  const { budgets, impacts } = categoryBudgetTimeline(categoryHasBudget ? records : [], monthLimits, selected.end, selectedIds);
  const total = matching.reduce((sum, { amount }) => sum + Math.round(amount * 100), 0);
  if (!Number.isSafeInteger(total)) throw new ToolInputError('This expense total is too large to calculate precisely.');

  const impactRows = matching.filter(({ id }) => impacts.has(id));
  const ordinaryRows = matching.filter(({ id }) => !impacts.has(id));
  const visibleIds = new Set([...impactRows, ...ordinaryRows].slice(0, MAX_DRILLDOWN_ROWS).map(({ id }) => id));
  const transactionsForPeriod = matching.filter(({ id }) => visibleIds.has(id)).map((row) => ({
    ...row, ...(impacts.get(row.id) ?? { budgetImpact: null, overAmount: null }),
  }));
  const appliedScope = {
    ...(selected.account && { account: selected.account.name }),
    ...(selected.search && { search: selected.search }),
    ...(selected.category && { category: selected.category.name }),
  };
  return {
    category, startDate: selected.start, endDate: selected.end,
    ...(Object.keys(appliedScope).length > 0 && { scope: appliedScope }),
    total: total / 100,
    transactionCount: matching.length,
    omittedTransactions: matching.length - transactionsForPeriod.length,
    transactions: transactionsForPeriod,
    budgets,
  };
}

async function listFinanceRecords(supabase, userId, args) {
  if (!Object.hasOwn(RECORDS, args.kind)) throw new ToolInputError('Unsupported record kind.');
  const kind = args.kind;
  const { select, order, ascending = true } = RECORDS[kind];
  const page = paginate(args);
  let query = supabase.from(kind).select(select).eq('user_id', userId).order(order, { ascending }).order('id');

  if (args.month != null) {
    if (kind !== 'budgets' || typeof args.month !== 'string' || !/^\d{4}-\d{2}$/.test(args.month)) {
      throw new ToolInputError('Month must be YYYY-MM and applies only to budgets.');
    }
    const firstDay = asDate(`${args.month}-01`, 'Budget month');
    const monthEnd = new Date(firstDay + 'T00:00:00Z');
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    monthEnd.setUTCDate(0);
    query = query.gte('month', firstDay).lte('month', monthEnd.toISOString().slice(0, 10));
  }

  if (args.type != null) {
    if (kind !== 'categories' && kind !== 'recurring_payments') {
      throw new ToolInputError('An income or expense type applies only to categories and recurring payments.');
    }
    query = query.eq('type', asType(args.type));
  }

  // A budget may carry many category limits. Bound that embedded read as well.
  if (kind === 'budgets') query = query.limit(50, { referencedTable: 'budget_categories' });

  const rows = await fetchData(query.range(page.start, page.start + page.size));
  return {
    ...listPage(rows, page),
    ...(kind === 'budgets' && { category_limit_page_size: 50 }),
  };
}

async function loadActiveRecurringSchedules(supabase, userId, type = null) {
  const schedules = [];
  for (let offset = 0; offset <= MAX_SUMMARY_ROWS; offset += SUMMARY_PAGE_SIZE) {
    const query = supabase.from('recurring_payments')
      .select('id,name,amount,type,is_active,frequency,frequency_interval,start_date,end_date,business_days_only,last_business_day_of_month,match_description,categories(name)')
      .eq('user_id', userId)
      .eq('is_active', true);
    const rows = await fetchData((type ? query.eq('type', type) : query)
      .order('id')
      .range(offset, offset + SUMMARY_PAGE_SIZE - 1));
    schedules.push(...rows);
    if (schedules.length > MAX_SUMMARY_ROWS) {
      throw new ToolInputError('There are too many recurring schedules to calculate this total.');
    }
    if (rows.length < SUMMARY_PAGE_SIZE) break;
  }
  return schedules;
}

function addCalendarDays(date, days) {
  return new Date(Date.parse(date) + days * calendarDayMs).toISOString().split('T')[0];
}

function localCalendarDate(date) {
  const parts = [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  return parts.map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0')).join('-');
}

async function readProjectionRows(query) {
  const records = [];
  for (let offset = 0; offset <= MAX_SUMMARY_ROWS; offset += SUMMARY_PAGE_SIZE) {
    const page = await fetchData(query().order('id').range(offset, offset + SUMMARY_PAGE_SIZE - 1));
    records.push(...page);
    if (records.length > MAX_SUMMARY_ROWS) throw new ToolInputError('There are too many records to project your account balance.');
    if (page.length < SUMMARY_PAGE_SIZE) break;
  }
  return records;
}

function addProjectedFlow(cash, date, { id, label, type, cents, source }) {
  if (!cash.daily.has(date)) cash.daily.set(date, { income: 0, expense: 0, movements: [], movementCount: 0 });
  const day = cash.daily.get(date);
  day[type] += cents;
  day.movementCount++;
  if (day.movements.length < cash.movementLimit) {
    day.movements.push({ id, label, type, amount: cents / 100, source });
  }
}

function manualPostingKey(date, type, cents) {
  return `${date}:${type}:${cents}`;
}

async function loadProjectionInputs(supabase, userId, start, end, days) {
  const accounts = await readProjectionRows(() => supabase.from('accounts').select('id,balance').eq('user_id', userId));
  if (!accounts.length) return null;

  const accountIds = new Set(accounts.map(({ id }) => id));
  const firstMatch = addCalendarDays(start, -MATCH_WINDOW_DAYS);
  const lastMatch = addCalendarDays(end, MATCH_WINDOW_DAYS);
  const recorded = await readProjectionRows(() => supabase.from('transactions')
    .select('id,account_id,type,amount,date,description,deleted_at,recurring_payment_id')
    .eq('user_id', userId)
    .or(`deleted_at.not.is.null,date.gte.${firstMatch}`));
  const cash = {
    daily: new Map(),
    movementLimit: Math.min(MAX_DAILY_PROJECTION_MOVEMENTS, Math.floor(MAX_PROJECTION_MOVEMENTS / days)),
  };
  const linked = new Set();
  const manual = new Map();
  let opening = 0;
  for (const account of accounts) opening += Math.round(Number(account.balance) * 100);

  for (const row of recorded) {
    if (!accountIds.has(row.account_id) || !MONEY_TYPES.includes(row.type)) continue;
    const cents = Math.round(Number(row.amount) * 100);
    if (!Number.isSafeInteger(cents)) throw new ToolInputError('A recorded amount exceeds the precision of this projection.');
    const signed = row.type === 'income' ? cents : -cents;

    // The ledger balance trigger includes each insert, even a future-dated or subsequently trashed row.
    if (row.deleted_at || row.date > start) opening -= signed;
    if (!row.deleted_at && row.date > start && row.date <= end) {
      addProjectedFlow(cash, row.date, {
        id: `recorded:${row.id}`, label: row.description?.trim().slice(0, 250) || 'Recorded transaction',
        type: row.type, cents, source: 'recorded',
      });
    }

    if (row.date < firstMatch || row.date > lastMatch) continue;
    if (row.recurring_payment_id) {
      // A discarded generated occurrence is a cancellation, as in the auto-add flow.
      linked.add(`${row.recurring_payment_id}:${row.date}`);
    } else if (!row.deleted_at) {
      const key = manualPostingKey(row.date, row.type, cents);
      if (!manual.has(key)) manual.set(key, []);
      manual.get(key).push(row);
    }
  }
  if (!Number.isSafeInteger(opening)) throw new ToolInputError('The account balance exceeds the precision of this projection.');
  return { ...cash, opening, accountCount: accounts.length, linked, manual, matched: new Set() };
}

function scheduleDates(schedule, start, end) {
  return getPaymentDatesInRange(
    schedule.start_date, schedule.frequency, start, end, schedule.end_date,
    schedule.business_days_only, schedule.last_business_day_of_month, schedule.frequency_interval,
  ).map(localCalendarDate);
}

function projectSchedule(cash, schedule, dates, label, cents, start, end) {
  if (!dates.length) return;
  const pending = new Set(dates.filter((date) => !cash.linked.has(`${schedule.id}:${date}`)));
  if (pending.size && schedule.match_description?.trim() && cash.manual.size) {
    // Let an exact posting around either boundary satisfy its own scheduled date first.
    const extended = [
      ...scheduleDates(schedule, addCalendarDays(start, -MATCH_WINDOW_DAYS), addCalendarDays(start, -1)),
      ...pending,
      ...scheduleDates(schedule, addCalendarDays(end, 1), addCalendarDays(end, MATCH_WINDOW_DAYS)),
    ].filter((date) => !cash.linked.has(`${schedule.id}:${date}`));
    const unmatched = new Set(extended);

    for (let distance = 0; distance <= MATCH_WINDOW_DAYS; distance++) {
      for (const date of unmatched) {
        const offsets = distance === 0 ? [0] : [-distance, distance];
        const posting = offsets.flatMap((offset) => cash.manual.get(manualPostingKey(addCalendarDays(date, offset), schedule.type, cents)) ?? [])
          .find((row) => !cash.matched.has(row.id) && matchesRecurringOccurrence(row, schedule, date));
        if (!posting) continue;
        cash.matched.add(posting.id);
        unmatched.delete(date);
        pending.delete(date);
      }
    }
  }
  for (const date of pending) {
    addProjectedFlow(cash, date, {
      id: `scheduled:${schedule.id}:${date}`, label, type: schedule.type, cents, source: 'scheduled',
    });
  }
}

function projectedBalance(cash, start, dayCount) {
  let balance = cash.opening;
  let firstNegative = null;
  let lowestBalance = null;
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = addCalendarDays(start, index);
    const { income = 0, expense = 0, movements = [], movementCount = 0 } = cash.daily.get(date) ?? {};
    balance += income - expense;
    if (![balance, income, expense].every(Number.isSafeInteger)) throw new ToolInputError('The projected amount exceeds the precision of this projection.');
    const point = {
      date, balance: balance / 100, income: income / 100, expenses: expense / 100,
      movements, movementCount, omittedMovements: movementCount - movements.length,
    };
    if (balance < 0 && !firstNegative) firstNegative = { date, balance: point.balance, amount: -point.balance };
    if (!lowestBalance || point.balance < lowestBalance.balance) lowestBalance = { date, balance: point.balance };
    return point;
  });
  return { startingBalance: cash.opening / 100, accountCount: cash.accountCount, days, firstNegative, lowestBalance };
}

export async function getUpcomingPaymentsPlan(supabase, userId, { startDate, endDate, type }, today) {
  const firstDate = asDate(startDate ?? today, 'Starting date');
  const { start, end } = transactionDateRange(firstDate, endDate ?? addCalendarDays(firstDate, 29));
  const scope = type == null ? null : asType(type);
  const startMs = Date.parse(start);
  const days = (Date.parse(end) - startMs) / calendarDayMs + 1;
  const [schedules, cash] = await Promise.all([
    loadActiveRecurringSchedules(supabase, userId, scope),
    !scope && start === today ? loadProjectionInputs(supabase, userId, start, end, days).catch(() => null) : null,
  ]);
  const windows = [];
  // The shared recurrence engine caps each schedule at 366 dates, including adjusted dates outside the window.
  for (let windowStart = start; windowStart <= end; ) {
    const possibleEnd = addCalendarDays(windowStart, 179);
    const windowEnd = possibleEnd < end ? possibleEnd : end;
    windows.push([windowStart, windowEnd]);
    if (windowEnd === end) break;
    windowStart = addCalendarDays(windowEnd, 1);
  }

  const weeks = Array.from({ length: Math.ceil(days / 7) }, (_, index) => ({
    startDate: addCalendarDays(start, index * 7),
    endDate: addCalendarDays(start, Math.min(days - 1, index * 7 + 6)),
    income: 0,
    expense: 0,
  }));
  const totals = { income: 0, expense: 0 };
  const nextByType = { income: null, expense: null };
  const byDate = new Map();
  let paymentCount = 0;
  for (const schedule of schedules) {
    const cents = Math.round(Number(schedule.amount) * 100);
    if (!Object.hasOwn(totals, schedule.type) || !Number.isSafeInteger(cents) || cents <= 0) continue;
    const label = schedule.name?.trim().slice(0, 250) || 'Scheduled payment';
    const dates = windows.flatMap(([first, last]) => scheduleDates(schedule, first, last));
    if (cash) projectSchedule(cash, schedule, dates, label, cents, start, end);
    for (const date of dates) {
      const week = weeks[Math.floor((Date.parse(date) - startMs) / (calendarDayMs * 7))];
      week[schedule.type] += cents;
      totals[schedule.type] += cents;
      paymentCount++;
      const next = nextByType[schedule.type];
      if (!next || date < next.date) {
        nextByType[schedule.type] = { date, label, amount: cents / 100, count: 1 };
      } else if (date === next.date) {
        next.count++;
      }
      if (!byDate.has(date)) byDate.set(date, []);
      const payments = byDate.get(date);
      if (payments.length < MAX_UPCOMING_ROWS) {
        payments.push({ id: `${schedule.id}:${date}`, label, date, amount: cents / 100, type: schedule.type });
      }
    }
  }
  if (!Object.values(totals).every(Number.isSafeInteger)) {
    throw new ToolInputError('The scheduled payments are too large to calculate precisely.');
  }

  const payments = [...byDate].sort(([first], [second]) => first.localeCompare(second))
    .flatMap(([, entries]) => entries).slice(0, MAX_UPCOMING_ROWS);
  return {
    startDate: start, endDate: end, ...(scope && { type: scope }),
    payments, income: totals.income / 100, expenses: totals.expense / 100, nextByType,
    weeks: weeks.map((week) => ({ ...week, income: week.income / 100, expense: week.expense / 100 })),
    paymentCount, omittedPayments: paymentCount - payments.length,
    ...(cash && { projection: projectedBalance(cash, start, days) }),
  };
}

async function paymentsUntilSalary(supabase, userId, args, today) {
  const asOf = asDate(today, 'Current date');
  const endDate = args.end_date == null ? null : asDate(args.end_date, 'Cutoff date');
  if (endDate && (endDate < asOf || Date.parse(endDate) - Date.parse(asOf) >= MAX_DAYS * 86_400_000)) {
    throw new ToolInputError('Choose a cutoff date within the next 366 days, starting today.');
  }

  let availableAmount = null;
  if (args.available_amount != null) {
    try {
      availableAmount = asAmount(args.available_amount, true);
    } catch {
      throw new ToolInputError('Available amount must be a valid amount with at most two decimal places.');
    }
  }

  const schedules = await loadActiveRecurringSchedules(supabase, userId);
  const plan = getPaymentsUntilSalary(schedules, asOf, endDate);
  const availableCents = availableAmount == null ? null : Math.round(availableAmount * 100);
  const difference = plan.totalCents == null || availableCents == null ? null : availableCents - plan.totalCents;
  if ((plan.totalCents != null && !Number.isSafeInteger(plan.totalCents)) ||
      (difference != null && !Number.isSafeInteger(difference))) {
    throw new ToolInputError('The scheduled expenses are too large to compare precisely.');
  }
  const maxOccurrences = 40;

  return trimStrings({
    ok: true,
    as_of: asOf,
    salary_identified: plan.salary != null,
    salary_date: plan.salary?.date ?? null,
    salary_name: plan.salary?.name ?? null,
    through_date: plan.throughDate,
    source: endDate ? 'explicit_end_date' : plan.salary ? 'salary_schedule' : null,
    includes_end_date: true,
    total_scheduled_expenses: plan.totalCents == null ? null : plan.totalCents / 100,
    available_amount: availableAmount,
    difference: difference == null ? null : difference / 100,
    covers_scheduled_expenses: difference == null ? null : difference >= 0,
    scheduled_occurrences: plan.expenses.slice(0, maxOccurrences),
    scheduled_occurrence_count: plan.expenses.length,
    occurrences_omitted: Math.max(0, plan.expenses.length - maxOccurrences),
  });
}

function requestRecordId(userId, requestId, writeIndex, toolName) {
  if (typeof requestId !== 'string' || !requestId || !Number.isInteger(writeIndex) || writeIndex < 0) {
    throw new ToolInputError('Missing assistant request identifier.');
  }
  const uuid = createHash('sha256')
    .update(JSON.stringify([userId, requestId, writeIndex, toolName]))
    .digest('hex');
  const variant = ((parseInt(uuid[16], 16) & 3) | 8).toString(16);
  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-8${uuid.slice(13, 16)}-${variant}${uuid.slice(17, 20)}-${uuid.slice(20, 32)}`;
}

async function insertOnce(supabase, userId, table, id, values, mutable = []) {
  const columns = ['id', ...Object.keys(values)].join(',');
  const [created] = await fetchData(supabase.from(table)
    .upsert({ id, user_id: userId, ...values }, { onConflict: 'id', ignoreDuplicates: true })
    .select(columns));
  if (created) return { record: created, already_created: false };

  const existing = await fetchData(supabase.from(table).select(columns).eq('user_id', userId).eq('id', id).maybeSingle());
  const matches = existing && Object.entries(values).every(([key, value]) => {
    if (mutable.includes(key)) return true;
    return typeof value === 'number' ? existing[key] != null && Number(existing[key]) === value : existing[key] === value;
  });
  if (!matches) throw new ToolInputError('The saved record differs from this retry. Check the ledger before trying again.');
  return { record: existing, already_created: true };
}

async function runCreateTool({ name, args, supabase, userId, requestId, writeIndex, signingKey }) {
  const id = requestRecordId(userId, requestId, writeIndex, name);
  const recordType = WRITE_TYPES[name];
  let saved;
  let title;

  if (name === 'create_transaction') {
    const type = asType(args.type);
    const amount = asAmount(args.amount);
    const date = asDate(args.date, 'Transaction date');
    const description = args.description == null
      ? (type === 'income' ? 'Income' : 'Expense')
      : asText(args.description, 'Description', 250);
    return prepareAssistantTransaction({
      supabase,
      userId,
      id,
      signingKey,
      draft: { type, amount, date, description },
      accountName: optionalName(args.account, 'Account'),
      categoryName: optionalName(args.category, 'Category'),
    });
  } else if (name === 'create_recurring_payment') {
    const titleValue = asText(args.name, 'Schedule name');
    const type = asType(args.type);
    const amount = asAmount(args.amount);
    const start_date = asDate(args.start_date, 'First occurrence date');
    const end_date = args.end_date == null ? null : asDate(args.end_date, 'End date');
    if (end_date != null && end_date < start_date) throw new ToolInputError('End date must be on or after the first occurrence.');
    if (!FREQUENCIES.includes(args.frequency) || !Number.isInteger(args.frequency_interval) ||
        args.frequency_interval < 1 || args.frequency_interval > 999) {
      throw new ToolInputError('Choose a valid recurring frequency and interval from 1 to 999.');
    }
    const category = args.category == null ? null : await resolveName(supabase, userId, 'categories', args.category, type);
    const result = await insertOnce(supabase, userId, 'recurring_payments', id, {
      name: titleValue,
      type,
      amount,
      category_id: category?.id ?? null,
      frequency: args.frequency,
      frequency_interval: args.frequency_interval,
      start_date,
      end_date,
      auto_add: false,
    });
    const { category_id, id: recordId, ...record } = result.record;
    title = titleValue;
    saved = { ...result, record: { ...record, category: category?.name ?? null } };
  } else {
    const isCategory = name === 'create_category';
    const table = isCategory ? 'categories' : 'accounts';
    title = asText(args.name, isCategory ? 'Category name' : 'Account name');
    const type = isCategory ? asType(args.type) : null;
    const values = isCategory ? { name: title, type } : { name: title, balance: asAmount(args.balance ?? 0, true) };
    const matches = await matchingNames(supabase, userId, table, title, type);
    if (matches.some((row) => row.id !== id)) {
      throw new ToolInputError(isCategory ? 'A category with that name and type already exists.' : 'An account with that name already exists.');
    }
    saved = await insertOnce(supabase, userId, table, id, values, isCategory ? [] : ['balance']);
    delete saved.record.id;
  }

  return { result: { ok: true, ...trimStrings(saved) }, action: { type: recordType, id, title } };
}

export async function executeAssistantTool(context) {
  const { name, args, supabase, userId } = context;
  try {
    const definition = assistantTools.find((entry) => entry.name === name);
    if (!definition) throw new ToolInputError('Unsupported BudgetWise operation.');
    if (!args || typeof args !== 'object' || Array.isArray(args) ||
        Object.keys(args).some((key) => !Object.hasOwn(definition.parameters.properties, key))) {
      throw new ToolInputError('The supplied arguments are invalid.');
    }
    if (isWriteTool(name)) return await runCreateTool(context);
    if (name === CHANGES_TOOL) {
      return await proposeAssistantChanges({
        supabase,
        userId,
        signingKey: context.signingKey,
        args,
        newId: (index) => requestRecordId(userId, context.requestId, index, `${CHANGES_TOOL}:${context.proposalIndex}`),
      });
    }
    if (name === 'list_transactions') return { result: await listTransactions(supabase, userId, args) };
    if (name === 'summarize_transactions') return await summarizeTransactions(supabase, userId, args);
    if (name === 'compare_spending_categories') {
      const summaries = await compareExpenseCategories(supabase, userId, args.periods, context.today, args.scope);
      return { result: { ok: true, periods: summaries.map(({ result }) => result) }, comparisonSummaries: summaries };
    }
    if (name === 'get_upcoming_payments') {
      const upcomingPayments = await getUpcomingPaymentsPlan(supabase, userId, {
        startDate: args.start_date, endDate: args.end_date, type: args.type,
      }, context.today);
      const { payments, projection, ...summary } = upcomingPayments;
      return { result: { ok: true, ...summary, payments: payments.slice(0, 40), omittedPayments: summary.paymentCount - Math.min(40, payments.length) }, upcomingPayments };
    }
    if (name === 'get_payments_until_salary') return { result: await paymentsUntilSalary(supabase, userId, args, context.today) };
    if (name === 'get_budget_review') {
      const month = args.month ?? asDate(context.today, 'Current date').slice(0, 7);
      const category = args.category == null ? null : asText(args.category, 'Expense category');
      return { result: { ok: true, ...trimStrings(await getBudgetReview(supabase, userId, month, category)) } };
    }
    return { result: await listFinanceRecords(supabase, userId, args) };
  } catch (error) {
    return { result: { ok: false, error: (error instanceof ToolInputError || error instanceof TransactionReviewError || error instanceof BudgetReviewError) ? error.message : 'BudgetWise could not complete this operation.' } };
  }
}
