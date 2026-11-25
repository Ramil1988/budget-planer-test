/**
 * Import deduplication: which bank row a transaction answers for.
 *
 * A bank row is identified by `date|DESCRIPTION|amount`. Imports used to recompute that from
 * the transaction's current values, so correcting an amount or a description made the next
 * Google Sheets sync import the original row again. The identity is now stored on the row
 * (`transactions.import_signature`, migration 010): written at import, and stamped from the
 * original values the first time an edit changes the amount or the description.
 *
 * One module for the browser and for the Netlify functions. The only other copy of this
 * normalisation is the SQL backfill in backend/database/migrations/010_import_signature.sql.
 */

const normalizeDescription = (description) => (description || '').toUpperCase().trim().replace(/\s+/g, ' ');

export function importSignature({ date, description, amount }) {
  return `${date}|${normalizeDescription(description)}|${Math.abs(Number(amount)).toFixed(2)}`;
}

/**
 * Everything an import must treat as already imported: the stored signature of each row and
 * the signature of its current values. The second half keeps rows without a stored signature
 * (manual entries, databases without migration 010) working exactly as before.
 */
export function knownImportSignatures(rows) {
  const known = new Set();
  for (const row of rows || []) {
    known.add(importSignature(row));
    if (row.import_signature) known.add(row.import_signature);
  }
  return known;
}

/**
 * True when PostgREST rejected a request because migration 010 has not been applied:
 * 42703 for a select or filter on the column, PGRST204 for a write that names it.
 */
export function isMissingImportSignatureColumn(error) {
  return Boolean(error) && ['42703', 'PGRST204'].includes(error.code) &&
    String(error.message || '').includes('import_signature');
}

/**
 * Load the user's known signatures, trashed rows included (a removed bank row must not come
 * back with the next sync). `hasColumn` is false when migration 010 is missing; callers then
 * leave `import_signature` out of their inserts.
 */
export async function loadKnownImportSignatures(supabase, userId) {
  const load = (columns) => supabase.from('transactions').select(columns).eq('user_id', userId);

  let hasColumn = true;
  let { data, error } = await load('date, description, amount, import_signature');
  if (isMissingImportSignatureColumn(error)) {
    hasColumn = false;
    ({ data, error } = await load('date, description, amount'));
  }
  if (error) throw error;

  return { known: knownImportSignatures(data), hasColumn };
}

/**
 * What an edit of amount or description has to write besides the new values: the signature of
 * the values the row had before, unless the row already carries one. An edit never changes
 * which bank rows a transaction answers for.
 */
export function signatureStamp(row) {
  return row.import_signature ? {} : { import_signature: importSignature(row) };
}
