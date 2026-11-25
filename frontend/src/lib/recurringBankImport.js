import { importSignature, isMissingImportSignatureColumn } from './importSignature.js';
import { matchesRecurringOccurrence } from './recurringAutoAdd.js';

export const missingBankPostingColumn = (error) => ['42703', 'PGRST204'].includes(error?.code)
  && String(error.message).includes('recurring_bank_posting');

function bankKey(type, signature) {
  return type + '|' + signature;
}

function statementKey(row) {
  return bankKey(row.type, importSignature(row)) + '|' + (row.bank || row.provider || '').trim().toUpperCase();
}

// Match the file as a multiset. A stored row, or a single generated occurrence,
// can account for only one copy of a repeated charge in this file.
export function reconcileBankRows(incoming, recorded, canLink) {
  const known = new Map();
  const generated = new Map();
  const index = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };
  const bucket = row => bankKey(row.type, Math.abs(Number(row.amount)).toFixed(2));
  for (const row of recorded) {
    if (row.recurring_payment_id && !row.deleted_at) {
      if (!row.recurring_bank_posting) index(generated, bucket(row), row);
    } else {
      for (const signature of new Set([importSignature(row), row.import_signature].filter(Boolean))) {
        index(known, bankKey(row.type, signature), row.id);
      }
    }
    if (row.recurring_bank_posting) {
      index(known, statementKey({ ...row.recurring_bank_posting, type: row.type }), row.id);
    }
  }

  const used = new Set();
  const matchedGroups = new Map();
  const candidates = new Map();
  const remaining = [];
  for (const row of incoming) {
    const key = statementKey(row);
    const existing = [...(known.get(key) ?? []), ...(known.get(bankKey(row.type, importSignature(row))) ?? [])]
      .find(id => !used.has(id));
    if (existing) {
      used.add(existing);
      continue;
    }
    const matches = (generated.get(bucket(row)) ?? []).filter(entry => importSignature(entry) === importSignature(row) || matchesRecurringOccurrence(row, {
      type: entry.type, amount: entry.amount, match_description: entry.recurring_payments?.match_description,
    }, entry.date));
    if (!matches.length) {
      remaining.push(row);
      continue;
    }
    if (!candidates.has(key)) candidates.set(key, { rows: [], matches });
    candidates.get(key).rows.push(row);
    for (const match of matches) {
      if (!matchedGroups.has(match.id)) matchedGroups.set(match.id, new Set());
      matchedGroups.get(match.id).add(key);
    }
  }

  const links = [];
  const review = [];
  for (const { rows, matches } of candidates.values()) {
    if (!canLink || matches.length !== 1 || matchedGroups.get(matches[0].id).size !== 1) {
      review.push(...rows);
      continue;
    }
    const [row, ...extraCharges] = rows;
    links.push({ generated: matches[0], posting: {
      date: row.date, description: row.description, amount: Math.abs(Number(row.amount)), provider: row.bank || row.provider || null,
    } });
    remaining.push(...extraCharges);
  }
  return { remaining, links, review };
}

export async function prepareBankImport(supabase, userId, incoming) {
  let hasColumn = true;
  let canLink = true;
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; ) {
    const fields = ['id', 'type', 'date', 'description', 'amount', 'deleted_at', 'recurring_payment_id', 'recurring_payments(match_description)'];
    if (hasColumn) fields.push('import_signature');
    if (canLink) fields.push('recurring_bank_posting');
    const { data, error } = await supabase.from('transactions').select(fields.join(','))
      .eq('user_id', userId).order('id').range(offset, offset + pageSize - 1);
    if (hasColumn && isMissingImportSignatureColumn(error)) { hasColumn = false; continue; }
    if (canLink && missingBankPostingColumn(error)) { canLink = false; continue; }
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) break;
    offset += data.length;
  }
  const result = reconcileBankRows(incoming, rows, canLink);
  let reviewMessage = '';
  if (result.review.length) {
    const examples = result.review.slice(0, 3).map(row => `${row.date} ${row.description}`).join(', ');
    reviewMessage = canLink
      ? `${result.review.length} bank row(s) need a decision about a recurring payment, including ${examples}. Review them in the assistant before importing.`
      : 'Apply the recurring bank posting database migration to link these recurring charges.';
  }
  return { ...result, hasColumn, reviewMessage };
}

export async function confirmBankPostings(supabase, userId, links) {
  for (const { generated, posting } of links) {
    const base = () => supabase.from('transactions');
    const { data, error } = await base().update({ recurring_bank_posting: posting })
      .eq('user_id', userId).eq('id', generated.id).eq('recurring_payment_id', generated.recurring_payment_id)
      .eq('date', generated.date).eq('amount', generated.amount).eq('type', generated.type)
      .is('deleted_at', null).is('recurring_bank_posting', null).select('id');
    if (error) throw error;
    if (data.length) continue;
    const { data: current, error: readError } = await base().select('type,recurring_bank_posting')
      .eq('user_id', userId).eq('id', generated.id).is('deleted_at', null).maybeSingle();
    if (readError) throw readError;
    if (!current?.recurring_bank_posting
      || statementKey({ ...current.recurring_bank_posting, type: current.type }) !== statementKey({ ...posting, type: generated.type })) {
      throw new Error('The recurring entry changed during import. Retry to match the remaining statement rows.');
    }
  }
}
