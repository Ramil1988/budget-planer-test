/**
 * Auto-add for recurring payments: when a recurring payment marked `auto_add` comes due,
 * its transaction is created automatically instead of being typed in by hand.
 *
 * Generation runs on the client when the app opens. Two things keep it from double-counting:
 * - transactions.recurring_payment_id + a unique index on (recurring_payment_id, date), so the
 *   same occurrence can never be inserted twice;
 * - `match_description` on the recurring payment, which recognises the same payment arriving
 *   from the bank via the Google Sheets import (see matchesRecurringOccurrence).
 */

import { getPaymentDatesInRange, parseLocalDate } from './recurringUtils.js';

// How far apart the generated date and the bank's posting date may be and still be the
// same payment. Bills usually post within a couple of days of the scheduled date.
export const MATCH_WINDOW_DAYS = 4;

// Don't reach back further than this when catching up missed occurrences, so an old
// auto_add_from can't turn one app load into a year of inserts.
const MAX_CATCHUP_DAYS = 366;

const toDateKey = (date) => {
  const d = parseLocalDate(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const shiftDays = (date, days) => {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
};

/**
 * Is `tx` (a manual or imported transaction) the same payment as one occurrence of `recurring`?
 * Only recurring payments with a `match_description` can match — without it there is nothing
 * reliable to compare the bank's wording against, and a false match would hide a real transaction.
 *
 * @param {Object} tx - { type, amount, description, date }
 * @param {Object} recurring - { type, amount, match_description }
 * @param {Date|string} occurrenceDate - The scheduled date of the occurrence
 */
export function matchesRecurringOccurrence(tx, recurring, occurrenceDate) {
  const needle = (recurring?.match_description || '').trim();
  if (!needle) return false;
  if (tx.type !== recurring.type) return false;
  if (Math.abs(Number(tx.amount) - Number(recurring.amount)) > 0.005) return false;
  if (!(tx.description || '').toUpperCase().includes(needle.toUpperCase())) return false;

  const daysApart = Math.abs(parseLocalDate(tx.date) - parseLocalDate(occurrenceDate)) / 86400000;
  return daysApart <= MATCH_WINDOW_DAYS;
}

async function getOrCreateAccountId(supabase, userId) {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (error) throw error;
  if (accounts?.length) return accounts[0].id;

  const { data: newAccount, error: createError } = await supabase
    .from('accounts')
    .insert({ user_id: userId, name: 'Main Account', balance: 0 })
    .select()
    .single();

  if (createError) throw createError;
  return newAccount.id;
}

/**
 * Create transactions for every auto-add recurring payment whose date has arrived.
 * Safe to call repeatedly — already generated occurrences are skipped.
 *
 * @returns {Promise<number>} Number of transactions created
 */
export async function generateDueRecurringTransactions(supabase, userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);
  const catchupFloor = shiftDays(today, -MAX_CATCHUP_DAYS);

  const { data: payments, error } = await supabase
    .from('recurring_payments')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('auto_add', true);

  if (error) throw error;
  if (!payments?.length) return 0;

  // Collect every occurrence that is due: from the day auto-add was switched on up to today.
  const due = [];
  for (const payment of payments) {
    let from = payment.auto_add_from || payment.start_date;
    if (from < catchupFloor) from = catchupFloor;
    if (from > todayKey) continue;

    const dates = getPaymentDatesInRange(
      payment.start_date,
      payment.frequency,
      from,
      todayKey,
      payment.end_date,
      payment.business_days_only || false,
      payment.last_business_day_of_month || false
    );

    for (const date of dates) {
      due.push({ payment, date, dateKey: toDateKey(date) });
    }
  }

  if (!due.length) return 0;

  // Existing transactions around the due window, to know what is already recorded.
  const earliest = due.reduce((min, o) => (o.dateKey < min ? o.dateKey : min), due[0].dateKey);
  const { data: existing, error: existingError } = await supabase
    .from('transactions')
    .select('date, amount, type, description, deleted_at, recurring_payment_id')
    .eq('user_id', userId)
    .gte('date', shiftDays(earliest, -MATCH_WINDOW_DAYS))
    .lte('date', shiftDays(todayKey, MATCH_WINDOW_DAYS));

  if (existingError) throw existingError;

  // Soft-deleted generated rows still count as generated — deleting one means "not this one",
  // so it must not come back on the next app load.
  const alreadyGenerated = new Set(
    (existing || [])
      .filter(t => t.recurring_payment_id)
      .map(t => `${t.recurring_payment_id}|${t.date}`)
  );
  // Only live manual/imported rows can stand in for an occurrence.
  const bankRows = (existing || []).filter(t => !t.recurring_payment_id && !t.deleted_at);

  const pending = due.filter(o =>
    !alreadyGenerated.has(`${o.payment.id}|${o.dateKey}`) &&
    !bankRows.some(t => matchesRecurringOccurrence(t, o.payment, o.date))
  );

  if (!pending.length) return 0;

  const accountId = await getOrCreateAccountId(supabase, userId);

  const rows = pending.map(o => ({
    user_id: userId,
    account_id: accountId,
    category_id: o.payment.category_id,
    type: o.payment.type,
    amount: Number(o.payment.amount),
    description: o.payment.name,
    date: o.dateKey,
    recurring_payment_id: o.payment.id,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('transactions')
    .upsert(rows, { onConflict: 'recurring_payment_id,date', ignoreDuplicates: true })
    .select();

  if (insertError) throw insertError;

  return inserted?.length || 0;
}

/**
 * Drop imported rows that are the bank's version of an already generated recurring transaction.
 * Used by both import paths so a payment isn't counted once by auto-add and again by the sheet.
 *
 * @param {Array} transactions - Parsed rows: { date, description, amount, type }
 * @returns {Promise<Array>} The rows that are safe to import
 */
export async function filterOutRecurringDuplicates(supabase, userId, transactions) {
  if (!transactions?.length) return transactions;

  const dates = transactions.map(t => t.date).sort();

  const { data: generated, error } = await supabase
    .from('transactions')
    .select('date, amount, type, recurring_payments(match_description)')
    .eq('user_id', userId)
    .not('recurring_payment_id', 'is', null)
    .is('deleted_at', null)
    .gte('date', shiftDays(dates[0], -MATCH_WINDOW_DAYS))
    .lte('date', shiftDays(dates[dates.length - 1], MATCH_WINDOW_DAYS));

  if (error) throw error;
  if (!generated?.length) return transactions;

  return transactions.filter(t => !generated.some(g => matchesRecurringOccurrence(
    t,
    { type: g.type, amount: g.amount, match_description: g.recurring_payments?.match_description },
    g.date
  )));
}
