import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { loadAssistantImportOptions } from './assistant-import-data.mjs';

const reviewPurpose = 'budgetwise-assistant-transaction-v1:';
const changesPurpose = 'budgetwise-assistant-changes-v1:';
const reviewLifetime = 30 * 60 * 1000;
const maxChanges = 12;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

function signature(payload, signingKey, purpose = reviewPurpose) {
  if (typeof signingKey !== 'string' || !signingKey) {
    throw new TransactionReviewError('Transaction review is unavailable on this server.', 503);
  }
  return createHmac('sha256', signingKey).update(purpose).update(payload).digest();
}

function sign(payload, signingKey, purpose = reviewPurpose) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded, signingKey, purpose).toString('base64url')}`;
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

// --- Changes to existing transactions ---------------------------------------
// The model can only propose these. The proposal is signed and nothing is written
// until the user applies it in the app, so data the model read cannot edit the ledger.

function changeText(value, label, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\p{Cc}]/u.test(text)) {
    throw new TransactionReviewError(`${label} must be between 1 and ${maxLength} characters.`);
  }
  return text;
}

function changeAmount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 9_999_999_999.99 ||
      Number(value.toFixed(2)) !== value) {
    throw new TransactionReviewError('Amount must be positive and have at most two decimal places.');
  }
  return value;
}

// Some imported rows store expenses as negative numbers. Keep each row's convention.
const withSign = (amount, like) => (Number(like) < 0 ? -amount : amount);
const signedNet = (type, amount) => (type === 'income' ? 1 : -1) * Math.abs(Number(amount));
const rowState = (id, amount, categoryId, description) =>
  createHash('sha256').update(JSON.stringify([id, Number(amount), categoryId ?? null, description ?? ''])).digest('base64url');

function verifyChanges(token, userId, signingKey) {
  const invalid = () => new TransactionReviewError('These changes are invalid. Ask the assistant to prepare them again.');
  const [payload, hash, extra] = typeof token === 'string' && token.length <= 32_000 ? token.split('.') : [];
  if (!payload || !hash || extra !== undefined || !/^[A-Za-z0-9_-]{43}$/.test(hash)) throw invalid();

  const expected = signature(payload, signingKey, changesPurpose);
  const actual = Buffer.from(hash, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) throw invalid();

  let proposed;
  try {
    proposed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  const { plan } = proposed ?? {};
  if (proposed?.userId !== userId || !Number.isFinite(proposed.expires) ||
      ![plan?.updates, plan?.additions, plan?.removals].every(Array.isArray)) {
    throw invalid();
  }
  if (proposed.expires <= Date.now()) {
    throw new TransactionReviewError('These changes expired. Ask the assistant to prepare them again.', 410);
  }
  return plan;
}

export async function proposeAssistantChanges({ supabase, userId, signingKey, args, newId }) {
  const list = (value) => (Array.isArray(value) ? value : []);
  const updates = [...list(args.updates)];
  const additions = [...list(args.additions)];
  const removals = [...list(args.removals)];
  const splits = list(args.splits);
  if (!updates.length && !additions.length && !removals.length && !splits.length) {
    throw new TransactionReviewError('Describe at least one change.');
  }

  const edited = [...updates.map(({ id }) => id), ...removals, ...splits.flatMap(({ ids: sources }) => list(sources))];
  const ids = [...new Set([...edited, ...additions.map(({ copy_from: source }) => source)])];
  if (ids.some((id) => typeof id !== 'string' || !idPattern.test(id))) {
    throw new TransactionReviewError('Use the transaction ids returned by list_transactions.');
  }
  if (new Set(edited).size !== edited.length) {
    throw new TransactionReviewError('Each transaction can be edited or removed only once.');
  }

  const [rows, options, liabilities] = await Promise.all([
    read(supabase.from('transactions').select(`${entryColumns},provider,recurring_payment_id`)
      .eq('user_id', userId).in('id', ids).is('deleted_at', null)),
    loadAssistantImportOptions({ supabase, userId }),
    read(supabase.from('liabilities').select('linked_category_id').eq('user_id', userId).not('linked_category_id', 'is', null)),
  ]);
  const liabilityCategories = new Set(liabilities.map(({ linked_category_id: category }) => category));
  const found = new Map(rows.map((row) => [row.id, row]));
  if (found.size !== ids.length) {
    throw new TransactionReviewError('A transaction was not found. List the transactions again and use their ids.');
  }
  const names = (items) => new Map(items.map(({ id, name }) => [id, name]));
  const accountNames = names(options.accounts);
  const categoryNames = names(options.categories);
  const categoryFor = (name, type) => {
    const label = changeText(name, 'Category', 100);
    const id = uniqueNamed(options.categories.filter((category) => category.type === type), label);
    if (!id) throw new TransactionReviewError(`Category "${label}" was not found among the ${type} categories.`);
    return id;
  };

  // A split is arithmetic, so the server does it: the model names the parts, and the parts
  // must add up to the transactions they replace. The total of a purchase cannot drift.
  const cents = (value) => Math.round(Math.abs(Number(value)) * 100);
  for (const split of splits) {
    const sources = list(split.ids).map((id) => found.get(id));
    const parts = list(split.parts);
    if (!sources.length || !parts.length) {
      throw new TransactionReviewError('A split needs at least one transaction and one part.');
    }
    if (new Set(sources.map(({ type }) => type)).size > 1) {
      throw new TransactionReviewError('Split income and expenses separately.');
    }
    const sourceTotal = sources.reduce((sum, row) => sum + cents(row.amount), 0);
    const partTotal = parts.reduce((sum, part) => sum + cents(changeAmount(part.amount)), 0);
    if (sourceTotal !== partTotal) {
      throw new TransactionReviewError(`The parts add up to ${(partTotal / 100).toFixed(2)} but the selected transactions total ${(sourceTotal / 100).toFixed(2)}. Adjust the parts so the total stays the same, or ask the user.`);
    }
    parts.forEach(({ amount, category, description }, index) => {
      const source = sources[index];
      if (source) updates.push({ id: source.id, amount, category, description, fromSplit: true });
      else additions.push({ copy_from: sources.at(-1).id, amount, category, description });
    });
    removals.push(...sources.slice(parts.length).map(({ id }) => id));
  }
  const count = updates.length + additions.length + removals.length;
  if (count > maxChanges) throw new TransactionReviewError(`Propose at most ${maxChanges} changes at a time.`);

  const plan = { updates: [], additions: [], removals: [] };
  const items = [];
  let before = 0;
  let after = 0;
  let added = 0;
  const copyOf = (row, values) => ({
    id: newId(added++),
    type: row.type,
    date: row.date,
    account_id: row.account_id,
    provider: row.provider ?? null,
    ...values,
  });
  const removalOf = (row, replaced) => ({
    id: row.id,
    state: rowState(row.id, row.amount, row.category_id, row.description),
    description: (row.description ?? '').slice(0, 80),
    ...(replaced ? { replaced: true } : {}),
  });

  for (const update of updates) {
    const row = found.get(update.id);
    const amount = update.amount == null ? Number(row.amount) : withSign(changeAmount(update.amount), row.amount);
    const categoryId = update.category == null ? row.category_id : categoryFor(update.category, row.type);
    const description = update.description == null ? row.description : changeText(update.description, 'Description', 250);
    if (amount === Number(row.amount) && categoryId === row.category_id && description === row.description) {
      // A part of a split may leave its transaction exactly as it was.
      if (update.fromSplit) continue;
      throw new TransactionReviewError('An update does not change anything. Leave that transaction out.');
    }
    // Bank imports recognise a row they already brought in by its date, description and
    // amount, trashed rows included. Editing those fields in place would make the next sync
    // import the original again, so an imported row is replaced: the original goes to the
    // trash and a corrected copy takes its place. Everything else is edited in place:
    //  - a row no import produced (no provider) has no such signature to keep;
    //  - a row generated by a recurring payment is found again through recurring_payment_id;
    //  - the liability triggers follow an UPDATE, but would deduct a copy a second time.
    const editInPlace = (amount === Number(row.amount) && description === row.description)
      || row.provider == null
      || row.recurring_payment_id != null
      || liabilityCategories.has(row.category_id) || liabilityCategories.has(categoryId);
    if (editInPlace) {
      plan.updates.push({
        id: row.id,
        state: rowState(row.id, row.amount, row.category_id, row.description),
        amount,
        category_id: categoryId,
        description,
      });
    } else {
      plan.removals.push(removalOf(row, true));
      plan.additions.push(copyOf(row, { amount, category_id: categoryId, description }));
    }
    items.push({
      kind: 'update',
      type: row.type,
      date: row.date,
      description: row.description,
      newDescription: description === row.description ? null : description,
      amount: Math.abs(Number(row.amount)),
      newAmount: Math.abs(amount),
      category: categoryNames.get(row.category_id) ?? null,
      newCategory: categoryNames.get(categoryId) ?? null,
    });
    before += signedNet(row.type, row.amount);
    after += signedNet(row.type, amount);
  }

  additions.forEach((addition) => {
    const source = found.get(addition.copy_from);
    const amount = changeAmount(addition.amount);
    const categoryId = categoryFor(addition.category, source.type);
    const description = addition.description == null
      ? source.description
      : changeText(addition.description, 'Description', 250);
    plan.additions.push(copyOf(source, { amount: withSign(amount, source.amount), category_id: categoryId, description }));
    items.push({
      kind: 'add',
      type: source.type,
      date: source.date,
      description,
      amount,
      category: categoryNames.get(categoryId) ?? null,
      account: accountNames.get(source.account_id) ?? null,
    });
    after += signedNet(source.type, amount);
  });

  for (const id of removals) {
    const row = found.get(id);
    plan.removals.push(removalOf(row, false));
    items.push({
      kind: 'remove',
      type: row.type,
      date: row.date,
      description: row.description,
      amount: Math.abs(Number(row.amount)),
      category: categoryNames.get(row.category_id) ?? null,
    });
    before += signedNet(row.type, row.amount);
  }

  if (!items.length) throw new TransactionReviewError('These transactions already match the request. Nothing to change.');
  const totals = { before: Number(before.toFixed(2)), after: Number(after.toFixed(2)) };
  return {
    result: {
      ok: false,
      review_required: true,
      error: 'Nothing has been changed yet. The app now shows these changes in a card. Tell the user to apply or skip them there, and describe the changes with the values below.',
      changes: items,
      total_before: totals.before,
      total_after: totals.after,
    },
    changeReview: {
      token: sign({ userId, plan, expires: Date.now() + reviewLifetime }, signingKey, changesPurpose),
      items,
      totals,
    },
  };
}

export async function confirmAssistantChanges({ token, userId, supabase, signingKey, language }) {
  const plan = verifyChanges(token, userId, signingKey);
  const changed = () => new TransactionReviewError(
    'These transactions were edited after the changes were prepared. Ask the assistant to prepare them again.', 409);
  const ids = [...plan.updates, ...plan.removals].map(({ id }) => id);
  const rows = ids.length
    ? await read(supabase.from('transactions').select(entryColumns).eq('user_id', userId).in('id', ids))
    : [];
  const current = new Map(rows.map((row) => [row.id, row]));
  const stateOf = (row) => rowState(row.id, row.amount, row.category_id, row.description);

  // A retry may find part of the plan already applied. Anything else means the ledger moved on.
  let progressed = false;
  for (const update of plan.updates) {
    const row = current.get(update.id);
    if (!row || row.deleted_at) throw changed();
    const applied = stateOf(row) === rowState(update.id, update.amount, update.category_id, update.description);
    if (!applied && stateOf(row) !== update.state) throw changed();
    progressed ||= applied;
  }
  for (const removal of plan.removals) {
    const row = current.get(removal.id);
    if (!row || (!row.deleted_at && stateOf(row) !== removal.state)) throw changed();
    progressed ||= Boolean(row.deleted_at);
  }
  // This plan writes its own new rows first, in one statement. Rows that already look
  // changed while those new rows are missing were changed by something else, typically a
  // second card for the same request, and applying this one would add its parts twice.
  // A new row of this plan that is already in the trash was removed by the user after a
  // failed attempt; finishing the plan now would leave neither version in the ledger.
  if (plan.additions.length) {
    const saved = await read(supabase.from('transactions').select('id,deleted_at').eq('user_id', userId)
      .in('id', plan.additions.map(({ id }) => id)));
    if (saved.some((row) => row.deleted_at) || (progressed && saved.length !== plan.additions.length)) throw changed();
  }

  if (plan.additions.length) {
    await read(supabase.from('transactions').upsert(
      plan.additions.map((addition) => ({ ...addition, user_id: userId })),
      { onConflict: 'id', ignoreDuplicates: true },
    ).select('id'));
  }
  // Not one database transaction. The new rows and the trashing of the rows they replace are
  // adjacent so a failure between them is as unlikely as it can be; until a retry finishes the
  // plan, both versions are in the ledger. Category edits, which cannot change a total, go last.
  if (plan.removals.length) {
    await read(supabase.from('transactions').update({ deleted_at: new Date().toISOString() })
      .in('id', plan.removals.map(({ id }) => id)).eq('user_id', userId).is('deleted_at', null).select('id'));
  }
  for (const { id, amount, category_id, description } of plan.updates) {
    await read(supabase.from('transactions').update({ amount, category_id, description })
      .eq('id', id).eq('user_id', userId).is('deleted_at', null).select('id'));
  }

  const russian = language === 'ru';
  return {
    message: russian ? 'Готово, изменения применены.' : 'Done, the changes were applied.',
    actions: [
      ...plan.updates.map(({ id, description }) => ({ type: 'transaction', id, title: description })),
      ...plan.additions.map(({ id, description }) => ({ type: 'transaction', id, title: description })),
      // A replaced original is already represented by its corrected copy above.
      ...plan.removals.filter(({ replaced }) => !replaced).map(({ id, description }) => ({
        type: 'transaction', id, title: `${russian ? 'Удалено' : 'Removed'}: ${description}`,
      })),
    ],
  };
}
