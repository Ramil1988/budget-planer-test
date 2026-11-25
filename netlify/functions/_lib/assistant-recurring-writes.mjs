import { createHash } from 'node:crypto';
import { FREQUENCY_CONFIG, getPaymentDatesInRange, isValidFrequencyInterval } from '../../../frontend/src/lib/recurringUtils.js';
import { TransactionReviewError } from './assistant-transaction.mjs';

export const MAX_RECURRING_CHANGES = 24;

const ruleFields = 'id,type,category_id,is_active,name,amount,frequency,frequency_interval,start_date,end_date,business_days_only,last_business_day_of_month,auto_add,auto_add_from,match_description';
const entryFields = 'id,type,category_id,amount,date,description,recurring_payment_id,recurring_bank_posting,assistant_change_version';
const dayMs = 86_400_000;
const cents = (amount) => Math.round(Math.abs(Number(amount)) * 100);
const shiftDays = (date, days) => new Date(Date.parse(date) + days * dayMs).toISOString().slice(0, 10);
const stale = (language) => new TransactionReviewError(language === 'ru'
  ? 'Операции или расписания изменились. Повтори сверку перед сохранением.'
  : 'The transactions or recurring schedules changed. Refresh the review before applying it.', 409);

// The matching inputs for an entire expense category. A different schedule
// can acquire a matching merchant or date while the confirmation is open.
// The RPC recomputes the same digest after locking the category and its rules.
export function recurringScheduleSetHash(rules) {
  const hash = (text) => createHash('md5').update(text).digest('hex');
  const flag = (value) => value == null ? '' : value ? '1' : '0';
  const rows = rules.map((rule) => [
    rule.id, hash(rule.name ?? ''), hash(rule.match_description ?? ''), cents(rule.amount),
    rule.frequency, rule.frequency_interval ?? 1, rule.start_date, rule.end_date ?? '',
    flag(rule.is_active), flag(rule.business_days_only), flag(rule.last_business_day_of_month),
  ].join(':'));
  return hash(rows.sort().join(','));
}

function containsDate(rule, date) {
  return getPaymentDatesInRange(rule.start_date, rule.frequency, date, date, rule.end_date,
    rule.business_days_only, rule.last_business_day_of_month, rule.frequency_interval).length > 0;
}

// Keep the original cadence and its first billing month/week wherever that
// month/week can represent the new date. Replacing start_date with the latest
// bank date would erase earlier occurrences from a recurring calendar.
function correctedStart(rule, actualDate) {
  const step = FREQUENCY_CONFIG[rule.frequency];
  const interval = rule.frequency_interval ?? 1;
  const actual = new Date(actualDate + 'T00:00:00Z');
  const start = new Date(rule.start_date + 'T00:00:00Z');
  if (actual <= start) return actualDate;
  if (step.days) {
    const days = step.days * interval;
    return shiftDays(actualDate, -Math.floor((actual - start) / dayMs / days) * days);
  }
  const monthNumber = (date) => date.getUTCFullYear() * 12 + date.getUTCMonth();
  const months = step.months * interval;
  const periods = Math.floor((monthNumber(actual) - monthNumber(start)) / months);
  for (let back = periods; back >= 0; back--) {
    const month = monthNumber(actual) - back * months;
    const anchor = new Date(Date.UTC(Math.floor(month / 12), month % 12, actual.getUTCDate()));
    // E.g. an original February start cannot encode a new billing day of 31.
    if (anchor.getUTCDate() === actual.getUTCDate()) return anchor.toISOString().slice(0, 10);
  }
  return actualDate;
}

function correctedRule(rule, expectedDate, actualDate, today, language) {
  if (!rule.is_active || !containsDate(rule, expectedDate) || containsDate(rule, actualDate)) throw stale(language);
  const weekday = new Date(actualDate + 'T00:00:00Z').getUTCDay();
  const next = {
    start_date: correctedStart(rule, actualDate),
    business_days_only: Boolean(rule.business_days_only && weekday !== 0 && weekday !== 6),
    last_business_day_of_month: false,
    auto_add_from: rule.auto_add_from,
  };
  if (rule.auto_add) {
    const tomorrow = shiftDays(today, 1);
    if (!next.auto_add_from || next.auto_add_from < tomorrow) next.auto_add_from = tomorrow;
  }
  if (rule.last_business_day_of_month && containsDate({ ...rule, ...next, last_business_day_of_month: true }, actualDate)) {
    next.last_business_day_of_month = true;
  }
  if (!containsDate({ ...rule, ...next }, actualDate)) throw stale(language);
  return next;
}

function scheduleIdForEntry(userId, transactionId) {
  const hash = createHash('sha256').update(JSON.stringify(['recurring-from-bank-v1', userId, transactionId])).digest('hex');
  return [hash.slice(0, 8), hash.slice(8, 12), '8' + hash.slice(13, 16), 'a' + hash.slice(17, 20), hash.slice(20, 32)].join('-');
}

async function loadOwned(supabase, userId, table, columns, ids) {
  if (!ids.length) return new Map();
  let query = supabase.from(table).select(columns).eq('user_id', userId).in('id', ids);
  if (table === 'transactions') query = query.is('deleted_at', null);
  const { data, error } = await query;
  if (error) throw new Error('Could not read the recurring review sources.', { cause: error });
  return new Map(data.map((row) => [row.id, row]));
}

export async function prepareRecurringScheduleChanges({ supabase, userId, candidates, today, language }) {
  if (!Array.isArray(candidates) || candidates.length > MAX_RECURRING_CHANGES) {
    throw new TransactionReviewError('Select up to 24 recurring changes at a time.');
  }
  const transactionIds = candidates.map((change) => change.transactionId);
  const updateIds = candidates.filter((change) => change.kind === 'update').map((change) => change.scheduleId);
  if (new Set(transactionIds).size !== transactionIds.length || new Set(updateIds).size !== updateIds.length) throw stale(language);
  const [entries, rules] = await Promise.all([
    loadOwned(supabase, userId, 'transactions', entryFields, transactionIds),
    loadOwned(supabase, userId, 'recurring_payments', ruleFields, updateIds),
  ]);
  const changes = [], items = [];
  for (const candidate of candidates) {
    const { kind, transactionId, actualDate, expectedDate, categoryId } = candidate;
    const source = entries.get(transactionId);
    const posting = source?.recurring_payment_id ? source.recurring_bank_posting : source;
    if (!posting || source.type !== 'expense' || source.category_id !== categoryId ||
        !Number.isSafeInteger(Number(source.assistant_change_version)) || Number(source.assistant_change_version) < 1 ||
        posting.date !== actualDate || !(cents(posting.amount) > 0) || cents(posting.amount) !== cents(candidate.actualAmount) ||
        (posting.description?.trim().slice(0, 250) ?? '') !== candidate.description) throw stale(language);

    const before = rules.get(candidate.scheduleId);
    let id, patch, name, amount, frequency, frequencyInterval;
    if (kind === 'create') {
      if (source.recurring_payment_id || !candidate.description || !candidate.description.trim()) throw stale(language);
      id = scheduleIdForEntry(userId, transactionId);
      frequency = candidate.frequency ?? 'monthly';
      frequencyInterval = candidate.frequencyInterval ?? 1;
      if (!Object.hasOwn(FREQUENCY_CONFIG, frequency) || !isValidFrequencyInterval(frequencyInterval)) throw stale(language);
      name = candidate.description;
      amount = Math.abs(Number(posting.amount));
      patch = { start_date: actualDate, business_days_only: false, last_business_day_of_month: false, auto_add_from: null };
    } else if (kind === 'update') {
      if (!before || before.type !== 'expense' || before.category_id !== categoryId ||
          (source.recurring_payment_id && source.recurring_payment_id !== before.id) ||
          before.name.trim().slice(0, 250) !== candidate.name || cents(before.amount) !== cents(candidate.expectedAmount) ||
          !Object.hasOwn(FREQUENCY_CONFIG, before.frequency)) throw stale(language);
      id = before.id;
      name = before.name;
      amount = Number(before.amount);
      frequency = before.frequency;
      frequencyInterval = before.frequency_interval;
      patch = correctedRule(before, expectedDate, actualDate, today, language);
    } else {
      throw stale(language);
    }
    if (!/^[a-f0-9]{32}$/.test(candidate.scheduleSetHash)) throw stale(language);
    changes.push({ kind, id, name, transactionId, sourceVersion: String(source.assistant_change_version), categoryId,
      scheduleSetHash: candidate.scheduleSetHash,
      frequency, frequencyInterval, patch, ...(before && { before }) });
    items.push({ kind, action: kind, name, amount, actualDate, expectedDate: expectedDate ?? null,
      category: candidate.category, frequency, frequencyInterval, startDate: patch.start_date,
      businessDaysOnly: patch.business_days_only, lastBusinessDayOfMonth: patch.last_business_day_of_month,
      previousBusinessDaysOnly: !!before?.business_days_only, previousLastBusinessDayOfMonth: !!before?.last_business_day_of_month,
      autoAddFrom: before?.auto_add ? patch.auto_add_from : null });
  }
  return { changes, items, notes: [] };
}

export async function commitRecurringScheduleChanges({ supabase, userId, changes, cardKey, today, language }) {
  if (!userId || !Array.isArray(changes) || !changes.length || changes.length > MAX_RECURRING_CHANGES) {
    throw new TransactionReviewError('Invalid recurring review.');
  }
  const { data, error } = await supabase.rpc('apply_assistant_recurring_changes', {
    card_key: cardKey, plan: changes, apply_date: today,
  });
  if (error?.code === 'PT409' || error?.code === '23505') throw stale(language);
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    throw new TransactionReviewError(language === 'ru' ? 'Для сохранения расписаний требуется обновление базы BudgetWise.'
      : 'The database update for applying recurring schedules is required.', 503);
  }
  if (error) throw new Error('Could not apply the recurring review.', { cause: error });
  return { actions: changes.map(({ id, name }) => ({ type: 'recurring', id, title: name })), alreadyApplied: data === true };
}
