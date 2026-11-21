import { createHash } from 'node:crypto';
import { MATCH_WINDOW_DAYS, matchesRecurringOccurrence } from '../../../frontend/src/lib/recurringAutoAdd.js';

const MAX_ROWS = 100;
const MAX_AMOUNT = 9_999_999_999.99;
const PAGE_SIZE = 500;
const MAX_QUERY_ROWS = 5000;
const DATE_CHUNK_SIZE = 60;
const MAX_DISCLOSED_MATCHES = 20;

const normalize = (value) => (value || '').toUpperCase().trim().replace(/\s+/g, ' ');

function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000')) {
    return false;
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function shiftDate(date, offset) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().split('T')[0];
}

function text(value, maxLength) {
  return typeof value === 'string' ? value.replace(/\p{Cc}/gu, ' ').trim().slice(0, maxLength) : '';
}

function signature({ date, type, description, amount }) {
  // Keep the import normalization and distinguish refunds from charges.
  return JSON.stringify([date, type, normalize(description), Math.abs(Number(amount)).toFixed(2)]);
}

function transactionId(userId, rowSignature, proposalId = null) {
  // Independent previews and concurrent confirmations share the same identity for the same row.
  const hash = createHash('sha256')
    .update(JSON.stringify(proposalId
      ? ['budgetwise-assistant-import-approved', userId, proposalId, rowSignature]
      : ['budgetwise-assistant-import', userId, rowSignature]))
    .digest('hex');
  const variant = ((parseInt(hash[16], 16) & 3) | 8).toString(16);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function read(query) {
  const { data, error } = await query;
  if (error || !Array.isArray(data)) throw new Error('BudgetWise could not complete the import database request.');
  return data;
}

async function readAll(makeQuery) {
  const rows = [];
  for (let start = 0; start <= MAX_QUERY_ROWS; start += PAGE_SIZE) {
    const page = await read(makeQuery().order('id').range(start, start + PAGE_SIZE - 1));
    rows.push(...page);
    if (rows.length > MAX_QUERY_ROWS) {
      throw new Error('This import matches too much existing data. Split it into smaller batches.');
    }
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function loadAssistantImportOptions({ supabase, userId }) {
  const [accounts, categories] = await Promise.all([
    readAll(() => supabase.from('accounts').select('id,name').eq('user_id', userId).order('name')),
    readAll(() => supabase.from('categories').select('id,name,type').eq('user_id', userId).order('name')),
  ]);
  return { accounts, categories };
}

function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > MAX_ROWS) {
    throw new TypeError(`An import must contain 1 to ${MAX_ROWS} rows.`);
  }
  const rowIds = rows.map((row) => row?.rowId);
  if (rowIds.some((id) => (typeof id !== 'string' || id.length === 0 || id.length > 100) && !Number.isSafeInteger(id)) ||
      new Set(rowIds.map(String)).size !== rows.length) {
    throw new TypeError('Every import row must have a unique identifier.');
  }
}

function findByName(records, name) {
  const normalized = normalize(name);
  const matches = normalized ? records.filter((record) => normalize(record.name) === normalized) : [];
  return matches.length === 1 ? matches[0] : undefined;
}

function suggestedCategory(row, categories, mappings) {
  const known = findByName(categories, text(row.category, 100));
  if (known) return known;

  const description = normalize(row.description);
  const matchingMappings = mappings
    .filter((mapping) => description.includes(mapping.merchant))
    .map((mapping) => findByName(categories, mapping.category))
    .filter(Boolean);
  if (matchingMappings.length) return matchingMappings[0];

  const fallbackName = row.type === 'income' ? 'Other Income' : 'Unexpected';
  return findByName(categories, fallbackName) ?? (categories.length === 1 ? categories[0] : undefined);
}

function prepareRows(rows, options, mappings, defaultAccountId, commit) {
  const { accounts, categories } = options;
  return rows.map((row) => {
    const issues = [];
    const date = validDate(row.date) ? row.date : null;
    const type = ['income', 'expense'].includes(row.type) ? row.type : null;
    const amount = typeof row.amount === 'number' && Number.isFinite(row.amount) &&
      row.amount > 0 && row.amount <= MAX_AMOUNT && Number(row.amount.toFixed(2)) === row.amount ? row.amount : null;
    const description = text(row.description, 250);
    const provider = text(row.provider, 100) || null;

    if (!date) issues.push('Supply a valid posting date.');
    if (!type) issues.push('Choose income or expense.');
    if (amount === null) issues.push('Supply a positive amount with at most two decimal places.');
    if (!description) issues.push('Supply a transaction description.');

    const typeCategories = categories.filter((category) => category.type === type);
    const explicitAccountId = row.account_id ?? defaultAccountId;
    let account = accounts.find(({ id }) => id === explicitAccountId);
    if (explicitAccountId == null && !commit) {
      const accountName = text(row.account, 100);
      account = accountName
        ? findByName(accounts, accountName)
        : accounts.length === 1
          ? accounts[0]
          : findByName(accounts, provider) ?? findByName(accounts, 'Main Account');
    }

    let category = typeCategories.find(({ id }) => id === row.category_id);
    if (row.category_id == null && !commit) {
      category = suggestedCategory({ category: row.category, type, description }, typeCategories, mappings);
    }

    if (!account) issues.push('Choose one of your BudgetWise accounts.');
    if (!category) issues.push('Choose one of your categories that matches the transaction type.');

    return {
      rowId: row.rowId,
      date,
      type,
      amount,
      description,
      provider,
      account_id: account?.id ?? null,
      category_id: category?.id ?? null,
      status: issues.length ? 'needs_review' : 'ready',
      issues,
    };
  });
}

async function loadMappings(supabase, userId) {
  const mappings = await readAll(() => supabase.from('merchant_mappings')
    .select('transaction_description,category_name')
    .eq('user_id', userId));
  return mappings
    .map((row) => ({ merchant: normalize(row.transaction_description), category: row.category_name }))
    .filter(({ merchant }) => merchant)
    .sort((a, b) => b.merchant.length - a.merchant.length);
}

function chunk(values) {
  const result = [];
  for (let start = 0; start < values.length; start += DATE_CHUNK_SIZE) {
    result.push(values.slice(start, start + DATE_CHUNK_SIZE));
  }
  return result;
}

function possibleMatchKey(row) {
  return JSON.stringify([row.date, row.type, Math.abs(Number(row.amount)).toFixed(2)]);
}

function addIndex(index, key, row) {
  const values = index.get(key);
  if (values) values.push(row);
  else index.set(key, [row]);
}

async function findDuplicates(supabase, userId, dates) {
  const neighbors = new Set();
  for (const date of dates) {
    for (let offset = -MATCH_WINDOW_DAYS; offset <= MATCH_WINDOW_DAYS; offset++) {
      const nearby = shiftDate(date, offset);
      if (validDate(nearby)) neighbors.add(nearby);
    }
  }

  const columns = 'id,date,description,amount,type,account_id,category_id,deleted_at';
  const [existing, generated] = await Promise.all([
    Promise.all(chunk(dates).map((group) => readAll(() => supabase.from('transactions')
      .select(columns)
      .eq('user_id', userId)
      .in('date', group)))),
    Promise.all(chunk([...neighbors]).map((group) => readAll(() => supabase.from('transactions')
      .select(`${columns},recurring_payments(match_description)`)
      .eq('user_id', userId)
      .not('recurring_payment_id', 'is', null)
      .is('deleted_at', null)
      .in('date', group)))),
  ]);

  const exact = new Map();
  const possible = new Map();
  for (const row of existing.flat()) {
    // Preserve the existing exact-signature check, including entries removed from the ledger.
    addIndex(exact, signature(row), row);
    if (!row.deleted_at) addIndex(possible, possibleMatchKey(row), row);
  }
  return { exact, possible, generated: generated.flat() };
}

function detail(row, accounts, categories) {
  return {
    id: row.id,
    date: row.date,
    description: text(row.description, 250),
    amount: Number(row.amount),
    account: accounts.get(row.account_id) ?? null,
    category: categories.get(row.category_id) ?? null,
  };
}

function disclosureFingerprint(matches) {
  return createHash('sha256').update(JSON.stringify(matches)).digest('base64url');
}

function inFileRepeat(row) {
  return { ...row, status: 'duplicate', issues: [...row.issues, 'This transaction is repeated in the import.'] };
}

async function markDuplicates(supabase, userId, rows, options) {
  const dates = [...new Set(rows.map(({ date }) => date).filter(Boolean))];
  if (!dates.length) return rows.map((row) => ({ row, fingerprint: null }));
  const { exact, possible, generated } = await findDuplicates(supabase, userId, dates);
  const accounts = new Map(options.accounts.map(({ id, name }) => [id, name]));
  const categories = new Map(options.categories.map(({ id, name }) => [id, name]));
  const seen = new Set();

  return rows.map((row) => {
    const complete = row.date && row.type && row.amount !== null && row.description;
    if (!complete) return { row, fingerprint: null };

    const key = signature(row);
    if (row.status === 'ready') {
      if (seen.has(key)) return { row: inFileRepeat(row), fingerprint: null };
      seen.add(key);
    }

    const rowExact = exact.get(key) ?? [];
    const rowPossible = possible.get(possibleMatchKey(row)) ?? [];
    const rowGenerated = generated.filter((occurrence) => matchesRecurringOccurrence(row, {
      type: occurrence.type,
      amount: occurrence.amount,
      match_description: occurrence.recurring_payments?.match_description,
    }, occurrence.date));
    const combined = new Map([...rowExact, ...rowPossible, ...rowGenerated].map((match) => [match.id, match]));
    if (!combined.size) return { row, fingerprint: null };

    const ordered = [...combined.values()].sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
    const details = ordered.map((match) => detail(match, accounts, categories));
    const limitReached = details.length > MAX_DISCLOSED_MATCHES;
    const issue = limitReached
      ? 'Too many ledger matches to approve this row in the import. Check Transactions.'
      : rowExact.length
        ? 'An equivalent transaction was already recorded.'
        : rowGenerated.length
          ? 'A matching recurring transaction was already recorded.'
          : 'A transaction with this date, amount and direction was already recorded. The description or account may differ.';
    return {
      row: {
        ...row,
        status: 'duplicate',
        issues: [...row.issues, issue],
        duplicates: details.slice(0, MAX_DISCLOSED_MATCHES),
        ...(limitReached && { duplicateLimitReached: true }),
      },
      // Include changes beyond the display cutoff and changes to the original saved row.
      fingerprint: disclosureFingerprint(ordered.map((match, index) => ({
        ...details[index],
        originalDescription: match.description,
        accountId: match.account_id,
        categoryId: match.category_id,
        type: match.type,
        deletedAt: match.deleted_at,
      }))),
    };
  });
}

function disclosedRows(entries) {
  return entries.flatMap(({ row, fingerprint }) => fingerprint ? [{ rowId: row.rowId, fingerprint }] : []);
}

export async function previewAssistantImport({ supabase, userId, rows, accountId = null, options }) {
  validateRows(rows);
  const [catalog, mappings] = await Promise.all([
    options ?? loadAssistantImportOptions({ supabase, userId }),
    loadMappings(supabase, userId),
  ]);
  const preview = await markDuplicates(supabase, userId, prepareRows(rows, catalog, mappings, accountId, false), catalog);

  return {
    ...catalog,
    rows: preview.map(({ row }) => row),
    disclosures: disclosedRows(preview),
  };
}

function priorImport(row, id) {
  return { ...row, status: 'duplicate', issues: ['This transaction was already imported.'], id };
}

export async function commitAssistantImport({ supabase, userId, rows, proposalId = null, disclosures = [] }) {
  validateRows(rows);
  const options = await loadAssistantImportOptions({ supabase, userId });
  const prepared = await markDuplicates(supabase, userId, prepareRows(rows, options, [], null, true), options);
  const shown = new Map(disclosures.map(({ rowId, fingerprint }) => [rowId, fingerprint]));
  const overrideRequests = new Set(rows.filter(({ allowDuplicate }) => allowDuplicate === true).map(({ rowId }) => rowId));

  const requestedApprovedIds = prepared.flatMap(({ row }) =>
    proposalId && shown.has(row.rowId) && overrideRequests.has(row.rowId)
      ? [transactionId(userId, String(row.rowId), proposalId)]
      : []);
  const alreadyApproved = requestedApprovedIds.length
    ? new Set((await read(supabase.from('transactions').select('id')
      .eq('user_id', userId).in('id', requestedApprovedIds))).map(({ id }) => id))
    : new Set();

  let needsRefresh = false;
  const decisions = prepared.map(({ row, fingerprint }) => {
    const approvedId = proposalId && shown.has(row.rowId) && overrideRequests.has(row.rowId)
      ? transactionId(userId, String(row.rowId), proposalId)
      : null;
    if (approvedId && alreadyApproved.has(approvedId)) return { row: priorImport(row, approvedId), id: null };
    if (fingerprint && fingerprint !== shown.get(row.rowId)) needsRefresh = true;

    const canAdd = row.account_id && row.category_id && approvedId &&
      fingerprint && fingerprint === shown.get(row.rowId) && !row.duplicateLimitReached;
    const id = row.status === 'ready'
      ? approvedId ?? transactionId(userId, signature(row))
      : canAdd
        ? approvedId
        : null;
    return { row, id };
  });
  const candidates = decisions.flatMap(({ row, id }) => id ? [{
    id,
    user_id: userId,
    account_id: row.account_id,
    category_id: row.category_id,
    date: row.date,
    type: row.type,
    amount: row.amount,
    description: row.description,
    provider: row.provider,
  }] : []);

  const inserted = candidates.length
    ? new Set((await read(supabase.from('transactions')
        .upsert(candidates, { onConflict: 'id', ignoreDuplicates: true })
        .select('id'))).map(({ id }) => id))
    : new Set();

  const counts = { inserted: 0, duplicate: 0, needs_review: 0 };
  const results = decisions.map(({ row, id }) => {
    const result = !id ? row : inserted.has(id) ? { ...row, status: 'inserted', id } : priorImport(row, id);
    counts[result.status]++;
    return result;
  });

  return { rows: results, counts, options, needsRefresh, disclosures: disclosedRows(prepared) };
}
