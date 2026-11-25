import { createHash } from 'node:crypto';
import { getRecurringDateAudit } from './assistant-data.mjs';
import { buildRecurringPlan } from './assistant-recurring-plan.mjs';
import { commitRecurringScheduleChanges, prepareRecurringScheduleChanges } from './assistant-recurring-writes.mjs';
import { readRecurringReview, signRecurringReview, TransactionReviewError } from './assistant-transaction.mjs';

function validFilter(filter) {
  return typeof filter?.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(filter.month)
    && typeof filter.category === 'string' && filter.category.trim() && filter.category.length <= 100;
}

export function recurringContext(messages, supplied) {
  // Older browser builds already included the category and period as a note after the audit reply.
  let legacy;
  for (let index = messages.length - 2; index >= 0; index--) {
    if (messages[index].role !== 'assistant') continue;
    const match = messages[index].content.match(/^Recurring audit filter: (\{[^\n]+\})$/m);
    if (!match) continue;
    try {
      const { start_date, category, type } = JSON.parse(match[1]);
      const filter = { category, month: start_date?.slice(0, 7), fromIndex: index + 1 };
      if (type === 'expense' && validFilter(filter)) { legacy = filter; break; }
    } catch { /* Plain chat text is not a report reference. */ }
  }
  if (!validFilter(supplied)) return legacy;
  const sameCard = legacy?.category === supplied.category && legacy?.month === supplied.month;
  const hasIndex = Number.isInteger(supplied.fromIndex) && supplied.fromIndex >= 0 && supplied.fromIndex < messages.length;
  return {
    month: supplied.month, category: supplied.category,
    fromIndex: hasIndex ? supplied.fromIndex : sameCard ? legacy.fromIndex : 0,
    historyTruncated: supplied.historyTruncated === true,
  };
}

export async function recurringReviewReply({ supabase, userId, intent, today, language, signingKey }) {
  const ru = language === 'ru';
  const messageOnly = (message) => ({ message, actions: [], choices: [] });
  if (intent.cancelled) return messageOnly(ru ? 'Подготовка изменений Recurring отменена.' : 'Recurring review cancelled.');
  let manualSelection = intent.manualSelection === true && !!intent.scope && (intent.create || intent.update);
  if (intent.clarify && !manualSelection) return messageOnly(intent.clarify[language]);
  const audit = await getRecurringDateAudit(supabase, userId, intent.scope, today);
  let plan = buildRecurringPlan(audit, intent);
  if (manualSelection || plan.manualSelection) {
    // A charge filter in free text was ambiguous. Display eligible source rows
    // with no selection so that the next decision refers to concrete charges.
    manualSelection = true;
    plan = buildRecurringPlan(audit, { ...intent, instruction: '', only: undefined, exceptionTexts: [] });
  }
  if (plan.clarify) return messageOnly(plan.clarify[language]);
  const { candidates, excluded, skipped } = plan;
  const notes = [];
  if (excluded.length) {
    const labels = excluded.slice(0, 12).map((row) =>
      `${row.description || row.name} · ${Number(row.actualAmount).toFixed(2)} CAD`);
    if (excluded.length > labels.length) labels.push(`+${excluded.length - labels.length}`);
    notes.push((ru ? 'Исключены по твоей просьбе — ' : 'Excluded at your request — ') + labels.join(', '));
  }
  if (skipped.length) {
    const labels = [...new Set(skipped.map((row) => row.name))];
    const display = labels.slice(0, 5).join(', ') + (labels.length > 5 ? ` (+${labels.length - 5})` : '');
    notes.push(ru ? `Другие строки сверки остались без изменений — ${display}.` : `Other audit rows left as they are — ${display}.`);
  }
  const prepared = candidates.length
    ? await prepareRecurringScheduleChanges({ supabase, userId, candidates, today, language })
    : { changes: [], items: [] };
  notes.push(...(prepared.notes ?? []));
  if (!prepared.changes.length) return messageOnly([
    ru ? 'По этой сверке нет подходящих изменений в Recurring.' : 'There are no applicable schedule changes for this audit.', ...notes,
  ].join('\n'));
  const scope = { category: audit.category, month: audit.month };
  return {
    message: manualSelection
      ? (ru ? 'Отметь в карточке нужные строки из сверки.' : 'Select the charges you meant in the review.')
      : (ru ? 'Проверь предложенные изменения в Recurring.' : 'Review the proposed Recurring changes.'),
    actions: [], choices: [],
    recurringReview: { ...scope, manualSelection, token: signRecurringReview(prepared.changes, userId, signingKey, manualSelection), items: prepared.items, notes },
  };
}

export async function applyRecurringReview({ supabase, userId, token, selectedIndices, today, language, signingKey }) {
  const { changes: reviewed, manualSelection } = readRecurringReview(token, userId, signingKey, language);
  const indices = selectedIndices === undefined && !manualSelection ? reviewed.map((_, index) => index) : selectedIndices;
  if (!Array.isArray(indices) || !indices.length || indices.length > reviewed.length ||
      indices.some((index) => !Number.isInteger(index) || index < 0 || index >= reviewed.length) ||
      new Set(indices).size !== indices.length) {
    throw new TransactionReviewError(language === 'ru' ? 'Выбери строки из этой карточки.' : 'Select rows from this review.');
  }
  const selected = [...indices].sort((a, b) => a - b);
  const changes = selected.map((i) => reviewed[i]);
  const cardKey = createHash('sha256').update(JSON.stringify([token, selected])).digest('hex');
  const { actions, alreadyApplied } = await commitRecurringScheduleChanges({ supabase, userId, changes, cardKey, today, language });
  const message = alreadyApplied
    ? (language === 'ru' ? 'Эти изменения уже сохранены в Recurring.' : 'These changes are already saved in Recurring.')
    : (language === 'ru' ? 'Изменения сохранены в Recurring.' : 'Changes saved in Recurring.');
  return { message, actions, choices: [] };
}
