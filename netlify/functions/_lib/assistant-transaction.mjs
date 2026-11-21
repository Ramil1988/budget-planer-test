import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { loadAssistantImportOptions } from './assistant-import-data.mjs';

const reviewPurpose = 'budgetwise-assistant-transaction-v1:';
const reviewLifetime = 30 * 60 * 1000;
const pageSize = 200;
const maxCandidates = 2000;
const maxMatches = 25;
const entryColumns = 'id,type,amount,date,description,account_id,category_id,deleted_at';

export class TransactionReviewError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function signature(payload, signingKey) {
  if (typeof signingKey !== 'string' || !signingKey) {
    throw new TransactionReviewError('Transaction review is unavailable on this server.', 503);
  }
  return createHmac('sha256', signingKey).update(reviewPurpose).update(payload).digest();
}

function sign(payload, signingKey) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded, signingKey).toString('base64url')}`;
}

function verify(token, userId, signingKey) {
  const invalid = () => new TransactionReviewError('This transaction review is invalid. Send the request again.');
  const [payload, hash, extra] = typeof token === 'string' && token.length <= 16_000 ? token.split('.') : [];
  if (!payload || !hash || extra !== undefined || !/^[A-Za-z0-9_-]{43}$/.test(hash)) throw invalid();

  const expected = signature(payload, signingKey);
  const actual = Buffer.from(hash, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) throw invalid();

  let proposed;
  try {
    proposed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  if (proposed?.userId !== userId || typeof proposed.id !== 'string' || !proposed.draft ||
      !Array.isArray(proposed.duplicateFingerprints) || !Number.isFinite(proposed.expires)) {
    throw invalid();
  }
  if (proposed.expires <= Date.now()) {
    throw new TransactionReviewError('This transaction review expired. Send the request again.', 410);
  }
  return proposed;
}

async function read(query) {
  const { data, error } = await query;
  if (error) throw new Error('BudgetWise could not complete the transaction request.');
  return data;
}

const normalized = (value) => (value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

function uniqueNamed(options, name) {
  if (!name) return null;
  const label = normalized(name);
  const matches = options.filter((item) => normalized(item.name) === label);
  return matches.length === 1 ? matches[0].id : null;
}

async function ownedChoices(supabase, userId, type) {
  const options = await loadAssistantImportOptions({ supabase, userId });
  return {
    accounts: options.accounts,
    categories: options.categories.filter((category) => category.type === type),
  };
}

function fingerprint(row) {
  // Editing any disclosed detail invalidates approval for that match.
  return createHash('sha256').update(JSON.stringify([
    row.id, row.date, row.description, row.amount, row.account, row.category,
  ])).digest('base64url');
}

async function findDuplicates(supabase, userId, draft, options, id) {
  const matches = [];
  const descriptionsMatch = normalized(draft.description);
  const accounts = new Map(options.accounts.map((account) => [account.id, account.name]));
  const categories = new Map(options.categories.map((category) => [category.id, category.name]));
  for (let offset = 0; offset <= maxCandidates; offset += pageSize) {
    const rows = await read(supabase.from('transactions').select(entryColumns)
      .eq('user_id', userId)
      .eq('date', draft.date)
      .eq('type', draft.type)
      .in('amount', [draft.amount, -draft.amount])
      .is('deleted_at', null)
      .order('id')
      .range(offset, offset + pageSize - 1));
    if (offset + rows.length > maxCandidates) {
      throw new TransactionReviewError('Too many possible matches. Check this entry in Transactions before adding it.', 409);
    }
    for (const row of rows) {
      const sameDescription = normalized(row.description) === descriptionsMatch;
      const sameAccount = draft.accountId != null && row.account_id === draft.accountId;
      if (row.id === id || (!sameDescription && !sameAccount)) continue;
      matches.push({
        id: row.id,
        date: row.date,
        description: row.description,
        amount: Number(row.amount),
        account: accounts.get(row.account_id) ?? null,
        category: categories.get(row.category_id) ?? null,
      });
      if (matches.length > maxMatches) {
        throw new TransactionReviewError('Too many possible matches. Check this entry in Transactions before adding it.', 409);
      }
    }
    if (rows.length < pageSize) break;
  }
  return matches;
}

function review({ userId, signingKey, id, draft, options, duplicates }) {
  return {
    token: sign({
      userId,
      id,
      draft,
      duplicateFingerprints: duplicates.map(fingerprint),
      expires: Date.now() + reviewLifetime,
    }, signingKey),
    draft,
    options,
    duplicates,
  };
}

function savedRow(supabase, userId, id) {
  return read(supabase.from('transactions').select(entryColumns)
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle());
}

function requireMatchingRetry(row, draft) {
  if (row.deleted_at || row.type !== draft.type || Number(row.amount) !== draft.amount ||
      row.date !== draft.date || row.description !== draft.description ||
      (draft.accountId != null && draft.accountId !== row.account_id) ||
      (draft.categoryId != null && draft.categoryId !== row.category_id)) {
    throw new TransactionReviewError('The saved transaction differs from this retry. Check Transactions before trying again.', 409);
  }
}

async function save(supabase, userId, id, draft) {
  const [saved] = await read(supabase.from('transactions').upsert({
    id,
    user_id: userId,
    account_id: draft.accountId,
    category_id: draft.categoryId,
    type: draft.type,
    amount: draft.amount,
    date: draft.date,
    description: draft.description,
  }, { onConflict: 'id', ignoreDuplicates: true }).select(entryColumns));
  if (saved) return { row: saved, alreadyCreated: false };

  const existing = await savedRow(supabase, userId, id);
  if (!existing) throw new Error('BudgetWise could not verify this transaction.');
  requireMatchingRetry(existing, draft);
  return { row: existing, alreadyCreated: true };
}

function action(row) {
  return { type: 'transaction', id: row.id, title: row.description };
}

function toolSaved(row, options, alreadyCreated) {
  return {
    result: {
      ok: true,
      already_created: alreadyCreated,
      record: {
        type: row.type,
        amount: Number(row.amount),
        date: row.date,
        description: row.description,
        account: options.accounts.find(({ id }) => id === row.account_id)?.name ?? null,
        category: options.categories.find(({ id }) => id === row.category_id)?.name ?? null,
      },
    },
    action: action(row),
  };
}

export async function prepareAssistantTransaction({
  supabase, userId, signingKey, id, draft, accountName, categoryName,
}) {
  const options = await ownedChoices(supabase, userId, draft.type);
  const accountId = uniqueNamed(options.accounts, accountName);
  const categoryId = uniqueNamed(options.categories, categoryName);
  const resolvedDraft = { ...draft, accountId, categoryId };
  const existing = await savedRow(supabase, userId, id);
  if (existing) {
    requireMatchingRetry(existing, resolvedDraft);
    return toolSaved(existing, options, true);
  }

  const suggestedAccount = accountName ? null : options.accounts.length === 1
    ? options.accounts[0].id
    : uniqueNamed(options.accounts, 'Main Account');
  const reviewDraft = { ...resolvedDraft, accountId: accountId ?? suggestedAccount };
  const duplicates = await findDuplicates(supabase, userId, reviewDraft, options, id);
  if (!accountId || !categoryId || duplicates.length) {
    return {
      result: {
        ok: false,
        review_required: true,
        error: duplicates.length
          ? 'A matching transaction exists. Ask the user to review the saved entry before adding another.'
          : 'An account or category needs review. Ask the user to choose it in the transaction review.',
        duplicate_count: duplicates.length,
      },
      transactionReview: review({
        userId,
        signingKey,
        id,
        draft: reviewDraft,
        options,
        duplicates,
      }),
    };
  }

  const { row, alreadyCreated } = await save(supabase, userId, id, resolvedDraft);
  return toolSaved(row, options, alreadyCreated);
}

export async function confirmAssistantTransaction({
  token, accountId, categoryId, allowDuplicate, userId, supabase, signingKey,
}) {
  const proposed = verify(token, userId, signingKey);
  const id = proposed.id;
  const proposedAccount = accountId ?? proposed.draft.accountId;
  const proposedCategory = categoryId ?? proposed.draft.categoryId;
  const draft = { ...proposed.draft, accountId: proposedAccount, categoryId: proposedCategory };

  const existing = await savedRow(supabase, userId, id);
  if (existing) {
    requireMatchingRetry(existing, draft);
    return { message: 'This transaction was already saved.', actions: [action(existing)] };
  }

  const options = await ownedChoices(supabase, userId, draft.type);
  const matchingAccount = options.accounts.find(({ id: candidate }) => candidate === proposedAccount);
  const matchingCategory = options.categories.find(({ id: candidate }) => candidate === proposedCategory);
  draft.accountId = matchingAccount?.id ?? null;
  draft.categoryId = matchingCategory?.id ?? null;
  const duplicates = await findDuplicates(supabase, userId, draft, options, id);
  const disclosed = new Set(proposed.duplicateFingerprints);
  const allDisclosed = duplicates.every((row) => disclosed.has(fingerprint(row)));
  const duplicateConsentRequired = duplicates.length && (allowDuplicate !== true || !allDisclosed);

  if (!draft.accountId || !draft.categoryId || duplicateConsentRequired) {
    const message = !draft.accountId || !draft.categoryId
      ? 'Choose an existing account and a category that matches the transaction type.'
      : !allDisclosed
        ? 'The matching transactions changed. Review them before adding another entry.'
        : 'Review the matching transactions and choose whether to add another entry.';
    return {
      message,
      actions: [],
      transactionReviews: [review({ userId, signingKey, id, draft, options, duplicates })],
    };
  }

  const { row, alreadyCreated } = await save(supabase, userId, id, draft);
  return {
    message: alreadyCreated ? 'This transaction was already saved.' : 'Transaction saved.',
    actions: [action(row)],
  };
}
