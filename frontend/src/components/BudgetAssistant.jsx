import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  LuArrowDownLeft,
  LuArrowRight,
  LuArrowUp,
  LuCalendarClock,
  LuChartPie,
  LuCheck,
  LuFileText,
  LuGripHorizontal,
  LuImage,
  LuMaximize2,
  LuMinimize2,
  LuMoveVertical,
  LuPanelBottom,
  LuPaperclip,
  LuPlus,
  LuRotateCcw,
  LuSparkles,
  LuTrendingUp,
  LuX,
} from 'react-icons/lu';
import { useAuth } from '../contexts/AuthContext';
import { budgetSuggestionKey, collectAskedSuggestions, currentSuggestionMonth, mergeAskedSuggestions, readAskedSuggestions } from '../lib/assistantSuggestionHistory';
import AssistantCategoryDetails from './AssistantCategoryDetails';
import AssistantReplyFollowUps from './AssistantReplyFollowUps';
import AssistantReplyVisuals, { EMPTY_UPCOMING_PAYMENTS_MESSAGE, validAssistantReplyVisuals } from './AssistantReplyVisuals';
import '../styles/budget-assistant.css';

const MAX_HISTORY = 16;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CSV_BYTES = 128_000;
const MAX_IMAGE_BYTES = 2_500_000;
const MAX_PDF_BYTES = 2_500_000;
const INPUT_MIN_HEIGHT = 48;
const INPUT_RESIZE_STEP = 32;
const WINDOW_RESIZE_STEP = 48;
const windowHeightOverride = '--assistant-custom-window-height';
const compactWindowHeight = 'min(640px, 78dvh)';
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const typesByExtension = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' };
const attachmentTypes = '.csv,.pdf,.png,.jpg,.jpeg,.webp,text/csv,application/pdf,image/png,image/jpeg,image/webp';
const attachmentLimits = {
  csv: { bytes: MAX_CSV_BYTES, error: 'CSV files can be up to 128 KB.' },
  image: { bytes: MAX_IMAGE_BYTES, error: 'Screenshots can be up to 2.5 MB.' },
  pdf: { bytes: MAX_PDF_BYTES, error: 'PDF files can be up to 2.5 MB.' },
};
const formatAmount = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const assistantShortcuts = [
  { label: 'Compare this month and last month', Icon: LuTrendingUp, review: { mode: 'category_comparison' } },
  { label: 'See upcoming payments', Icon: LuCalendarClock, review: { mode: 'upcoming_payments' } },
  { label: 'Add a transaction', prompt: 'I want to add a transaction.', Icon: LuArrowDownLeft },
];
const monthPattern = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/;
const formatMonth = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function mentionsCategoryComparison(text) {
  return /\bcompar(?:e|ison|ing)|сравн/iu.test(text) && /categor|категор/iu.test(text);
}

function isPlainCategoryComparison(content, request) {
  return /\b(?:category comparison|comparison by category)\b|сравнен[^\n]{0,100}категор/iu.test(content)
    || (mentionsCategoryComparison(content) && (content.length >= 250 || mentionsCategoryComparison(request)));
}

function isPlainUpcomingSchedule(content) {
  return /(?:upcoming|recurring|предстоящ|периодическ|регулярн)/iu.test(content)
    && (content.match(/^\s*[-•]?\s*\d{4}-\d{2}-\d{2}\s+[—–-]/gm)?.length ?? 0) >= 3;
}

function requestedComparisonPeriods(message) {
  const dates = (message?.requestPrompt ?? message?.content)?.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  if (message?.role !== 'user' || dates?.length !== 4) return null;
  return [{ startDate: dates[0], endDate: dates[1] }, { startDate: dates[2], endDate: dates[3] }];
}

function budgetSuggestions(data) {
  const { overBudget, nearBudget, topSpending } = data;
  const validCategory = (entry) => typeof entry?.category === 'string' && entry.category.trim()
    && typeof entry.categoryId === 'string' && entry.categoryId
    && Number.isFinite(entry.spent) && entry.spent > 0;
  const over = (Array.isArray(overBudget) ? overBudget : [])
    .filter((entry) => validCategory(entry) && Number.isFinite(entry.limit) && Number.isFinite(entry.over) && entry.over > 0)
    .map(({ category, categoryId, spent, limit, over: excess }) => ({
      category,
      categoryId,
      label: `Why is ${category} over budget?`,
      detail: `Over budget by $${formatAmount.format(excess)} · $${formatAmount.format(spent)} of $${formatAmount.format(limit)}`,
      Icon: LuTrendingUp,
      tone: 'over',
    }));
  const near = (Array.isArray(nearBudget) ? nearBudget : [])
    .filter((entry) => validCategory(entry) && Number.isFinite(entry.limit) && Number.isFinite(entry.remaining) && entry.remaining >= 0)
    .map(({ category, categoryId, remaining, spent, limit }) => ({
      category,
      categoryId,
      label: `Review ${category} near its limit`,
      detail: `$${formatAmount.format(remaining)} left · $${formatAmount.format(spent)} of $${formatAmount.format(limit)}`,
      Icon: LuChartPie,
    }));
  const top = validCategory(topSpending) ? [{
    category: topSpending.category,
    categoryId: topSpending.categoryId,
    label: `Review spending in ${topSpending.category}`,
    detail: `$${formatAmount.format(topSpending.spent)} recorded spending`,
    Icon: LuChartPie,
  }] : [];

  const categories = new Set();
  return [...over, ...near, ...top].filter((entry) => {
    const key = entry.categoryId;
    if (categories.has(key)) return false;
    categories.add(key);
    return true;
  });
}

function AssistantSuggestions({ open, messages, userId, accessToken, dataVersion, pending, onSend }) {
  const { pathname, search } = useLocation();
  const onBudgetPage = pathname.replace(/\/$/, '').toLowerCase() === '/budget';
  const monthParam = onBudgetPage ? new URLSearchParams(search).get('month') : null;
  const requestedMonth = monthPattern.test(monthParam ?? '') ? monthParam : null;
  const storageKey = userId ? `budgetwise:asked-budget-suggestions:${userId}` : null;
  const [result, setResult] = useState(null);
  const [storedAsked, setStoredAsked] = useState(() => readAskedSuggestions(storageKey));

  useEffect(() => {
    if (!open || !accessToken) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    let obsolete = false;
    const query = { requestedMonth, dataVersion, accessToken };

    fetch('/.netlify/functions/budget-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        mode: 'suggestions',
        month: requestedMonth,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Budget suggestions are unavailable.');
        const data = await response.json();
        if (!monthPattern.test(data?.month ?? '') || (requestedMonth && data.month !== requestedMonth)) {
          throw new Error('Invalid budget suggestion month.');
        }
        if (!obsolete) setResult({ ...query, month: data.month, suggestions: budgetSuggestions(data) });
      })
      .catch(() => {
        if (!obsolete) setResult({ ...query, failed: true });
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      obsolete = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, accessToken, requestedMonth, dataVersion]);

  const current = result?.requestedMonth === requestedMonth
    && result?.dataVersion === dataVersion
    && result?.accessToken === accessToken ? result : null;
  const contextMonth = current?.month ?? requestedMonth;
  const askedNow = useMemo(() => collectAskedSuggestions(messages, contextMonth, current?.suggestions ?? []),
    [messages, contextMonth, current]);

  useEffect(() => {
    if (!askedNow.length) return;
    setStoredAsked((previous) => askedNow.every((key) => previous.includes(key)) ? previous : mergeAskedSuggestions(previous, askedNow));
  }, [askedNow]);

  useEffect(() => {
    if (!storageKey || !storedAsked.length) return;
    try {
      const currentStored = readAskedSuggestions(storageKey);
      if (!storedAsked.every((key) => currentStored.includes(key))) {
        localStorage.setItem(storageKey, JSON.stringify(mergeAskedSuggestions(currentStored, storedAsked)));
      }
    } catch {
      // Remain deduplicated for this session if storage is unavailable.
    }
  }, [storageKey, storedAsked]);

  useEffect(() => {
    if (!storageKey) return;
    const sync = (event) => {
      if (event.key === storageKey) setStoredAsked(readAskedSuggestions(storageKey));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storageKey]);

  const asked = new Set([...storedAsked, ...askedNow]);
  const personalized = (current?.suggestions ?? [])
    .filter(({ categoryId }) => !asked.has(budgetSuggestionKey(contextMonth, categoryId))).slice(0, 3);
  const label = contextMonth ? formatMonth.format(new Date(`${contextMonth}-01T00:00:00Z`)) : '';
  const shortcuts = [{
    label: requestedMonth ? `Review finances in ${label}` : 'Review this month’s finances',
    Icon: LuChartPie,
    review: { mode: 'financial_summary', month: requestedMonth },
  }, ...assistantShortcuts];
  const chooseSuggestion = (event, prompt, options) => {
    if (!onSend(prompt, null, options)) return;
    const disclosure = event.currentTarget.closest('details');
    if (disclosure) disclosure.open = false;
  };
  const body = (
    <>
      {open && accessToken && !current && (
        <p className="budget-assistant__suggestion-status" role="status">Checking budget activity…</p>
      )}
      {current?.failed && (
        <p className="budget-assistant__suggestion-status" role="status">Budget suggestions are unavailable right now.</p>
      )}
      {personalized.length > 0 && (
        <div className="budget-assistant__budget-suggestions" role="group" aria-label={`Suggestions for ${label}`}>
          <h4>{label}</h4>
          <div className="budget-assistant__suggestions">
            {personalized.map(({ categoryId, label, detail, Icon, tone }) => (
              <button
                type="button"
                key={categoryId}
                data-tone={tone}
                disabled={Boolean(pending) || !accessToken}
                onClick={(event) => chooseSuggestion(event, label, {
                  review: { mode: 'budget_review', month: contextMonth, categoryId },
                  suggestionKey: budgetSuggestionKey(contextMonth, categoryId),
                })}
              >
                <Icon aria-hidden="true" />
                <span>{label}<small>{detail}</small></span>
                <LuArrowRight aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="budget-assistant__suggestions" role="group" aria-label="Suggested questions">
        {shortcuts.map(({ label, prompt, Icon, analysisOnly, review }) => (
          <button
            type="button"
            key={label}
            onClick={(event) => chooseSuggestion(event, prompt ?? label, { analysisOnly, review })}
            disabled={Boolean(pending) || !accessToken}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <LuArrowRight aria-hidden="true" />
          </button>
        ))}
      </div>
    </>
  );

  return messages.length === 0 ? (
    <div className="budget-assistant__welcome-suggestions">{body}</div>
  ) : (
    <details className="budget-assistant__suggestion-disclosure">
      <summary>Budget suggestions</summary>
      {body}
    </details>
  );
}

const actionRoutes = new Map([
  ['transaction', '/transactions'],
  ['category', '/categories'],
  ['recurring', '/recurring'],
]);

function attachmentKind(file) {
  if (IMAGE_TYPES.has(file.type)) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return 'csv';
  return null;
}

function normalizeAttachmentType(file) {
  if (file.type && file.type !== 'application/octet-stream') return file;
  const extension = file.name.match(/\.(png|jpe?g|webp|pdf)$/i)?.[1].toLowerCase();
  const type = extension && typesByExtension[extension];
  return type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
}

function transferredFiles(transfer) {
  if (!transfer) return [];
  if (transfer.files.length) return Array.from(transfer.files);
  return Array.from(transfer.items ?? [])
    .filter(({ kind }) => kind === 'file')
    .map((item) => item.getAsFile())
    .filter(Boolean);
}

function isFileDrag(transfer) {
  return Array.from(transfer.types).includes('Files') || Array.from(transfer.items ?? []).some(({ kind }) => kind === 'file');
}

function pointerInsideDialog({ currentTarget, clientX, clientY }) {
  const { left, right, top, bottom } = currentTarget.getBoundingClientRect();
  return clientX >= left && clientX <= right && clientY >= top && clientY <= bottom;
}

function formatReviewDate(date) {
  return typeof date === 'string' ? date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1') : '';
}

async function encodeAttachment({ file, kind }) {
  const content = kind === 'csv'
    ? await file.text()
    : await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('The file could not be read.'));
        reader.readAsDataURL(file);
      });
  return { kind, name: file.name || 'Screenshot', content };
}

function ImportReview({ preview, ...props }) {
  const [selected, setSelected] = useState(() => new Set(
    preview.rows.filter(({ status }) => status === 'ready').map(({ rowId }) => rowId),
  ));

  return (
    <ImportReviewRows
      key={preview.id}
      preview={preview}
      selected={selected}
      setSelected={setSelected}
      {...props}
    />
  );
}

function ImportReviewRows({ preview, selected, setSelected, results, pending, onImport, onModify }) {
  const [approvedDuplicates, setApprovedDuplicates] = useState(() => new Set());
  const [edits, setEdits] = useState({});
  const rows = preview.rows.map((row) => {
    const result = results[row.rowId];
    const status = result?.status ?? row.status;
    const choices = { ...row, ...edits[row.rowId] };
    const isDuplicate = status === 'duplicate';
    const duplicates = result?.duplicates ?? row.duplicates ?? [];
    const duplicateLimitReached = result?.duplicateLimitReached ?? row.duplicateLimitReached;
    const canOverride = duplicates.length > 0 && !duplicateLimitReached;
    const valid = ['income', 'expense'].includes(row.type)
      && typeof row.amount === 'number' && row.amount > 0
      && Boolean(row.date && row.description);
    const editable = valid && status !== 'inserted' && (!isDuplicate || canOverride) && !preview.readOnly;
    const selectable = editable && choices.account_id != null && choices.category_id != null;
    const chosen = selectable && (isDuplicate ? approvedDuplicates.has(row.rowId) : selected.has(row.rowId));
    return {
      ...choices,
      status,
      isDuplicate,
      issues: result?.issues ?? row.issues,
      duplicates,
      editable,
      selectable,
      chosen,
    };
  });
  const selection = rows.filter(({ chosen }) => chosen).map(({ rowId, isDuplicate }) => ({
    rowId,
    ...edits[rowId],
    ...(isDuplicate ? { allowDuplicate: true } : {}),
  }));

  const updateSelection = (rowId, checked, duplicate = false) => {
    onModify();
    const update = duplicate ? setApprovedDuplicates : setSelected;
    update((previous) => {
      if (previous.has(rowId) === checked) return previous;
      const next = new Set(previous);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  };

  const updateField = (rowId, name, value) => {
    setEdits((previous) => ({ ...previous, [rowId]: { ...previous[rowId], [name]: value ?? null } }));
    updateSelection(rowId, false, true);
  };

  return (
    <section className="budget-assistant__import" aria-label="Review transactions">
      <div className="budget-assistant__import-header">
        <strong>Review transactions</strong>
        <span>{preview.rows.length} found</span>
      </div>
      {preview.warnings?.length > 0 && (
        <ul className="budget-assistant__import-warnings">
          {preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
        </ul>
      )}
      <ul className="budget-assistant__import-rows">
        {rows.map((row) => {
          const account = preview.accounts.find(({ id }) => String(id) === String(row.account_id));
          const accountLabel = account?.name || row.provider;
          const category = preview.categories.find(({ id }) => String(id) === String(row.category_id));
          const statusLabel = { ready: 'Ready', duplicate: 'Possible duplicate', needs_review: 'Review', inserted: 'Imported' }[row.status];

          return (
            <li className="budget-assistant__import-row" key={row.rowId}>
              <label className="budget-assistant__import-select">
                <input
                  type="checkbox"
                  checked={row.chosen}
                  disabled={!row.selectable || (row.isDuplicate && !row.chosen) || Boolean(pending)}
                  onChange={(event) => {
                    if (!row.isDuplicate || !event.target.checked) {
                      updateSelection(row.rowId, event.target.checked, row.isDuplicate);
                    }
                  }}
                />
                <span className="budget-assistant__import-description">{row.description || 'Unidentified transaction'}</span>
                {typeof row.amount === 'number' && (
                  <span className="budget-assistant__import-amount" data-type={row.type}>
                    {row.type === 'income' ? '+' : row.type === 'expense' ? '−' : ''}${formatAmount.format(row.amount)}
                  </span>
                )}
              </label>
              <div className="budget-assistant__import-meta">
                {[formatReviewDate(row.date) || 'Missing date', accountLabel === 'Main Account' ? null : accountLabel, category?.name].filter(Boolean).join(' · ')}
                <span data-status={row.status}>{statusLabel}</span>
              </div>
              {row.isDuplicate && row.duplicates.length > 0 && (
                <DuplicateMatches duplicates={row.duplicates} compact />
              )}
              {row.issues?.length > 0 && (
                <ul className="budget-assistant__import-issues">
                  {row.issues.map((issue, index) => <li key={index}>{issue}</li>)}
                </ul>
              )}
              {row.editable && (preview.accounts.length > 0 || preview.categories.length > 0) && (
                <details
                  className="budget-assistant__import-edits"
                  open={row.status === 'needs_review' || (row.isDuplicate && !row.selectable) || undefined}
                >
                  <summary>Edit account or category</summary>
                  <div>
                    <label>
                      Account
                      <select
                        value={row.account_id ?? ''}
                        disabled={Boolean(pending)}
                        aria-label={`Account for ${row.description}`}
                        onChange={(event) => updateField(
                          row.rowId,
                          'account_id',
                          preview.accounts.find(({ id }) => String(id) === event.target.value)?.id,
                        )}
                      >
                        <option value="">No account selected</option>
                        {preview.accounts.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                      </select>
                    </label>
                    <label>
                      Category
                      <select
                        value={row.category_id ?? ''}
                        disabled={Boolean(pending)}
                        aria-label={`Category for ${row.description}`}
                        onChange={(event) => updateField(
                          row.rowId,
                          'category_id',
                          preview.categories.find(({ id }) => String(id) === event.target.value)?.id,
                        )}
                      >
                        <option value="">No category selected</option>
                        {preview.categories
                          .filter(({ type }) => type === row.type)
                          .map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                      </select>
                    </label>
                  </div>
                </details>
              )}
              {row.isDuplicate && (
                <div className="budget-assistant__import-duplicate-choice">
                  <span role="status">{row.chosen ? 'Selected for import' : 'Skipped'}</span>
                  {row.editable && (
                    <button
                      type="button"
                      disabled={!row.selectable || Boolean(pending)}
                      onClick={() => updateSelection(row.rowId, !row.chosen, true)}
                    >
                      {row.chosen ? 'Skip' : 'Add anyway'}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > 0 && <div className="budget-assistant__import-footer">
        {preview.readOnly ? (
          <p>Saving is disabled in this read-only preview.</p>
        ) : (
          <button
            type="button"
            disabled={!selection.length || Boolean(pending)}
            onClick={() => onImport(selection)}
          >
            {pending === 'commit_import'
              ? 'Importing…'
              : `Import ${selection.length} ${selection.length === 1 ? 'transaction' : 'transactions'}`}
          </button>
        )}
      </div>}
    </section>
  );
}

function DuplicateMatches({ duplicates, compact = false }) {
  return (
    <div className={`budget-assistant__transaction-duplicates${compact ? ' budget-assistant__import-duplicates' : ''}`}>
      {!compact && <h4>{duplicates.length === 1 ? 'Possible duplicate' : 'Possible duplicates'}</h4>}
      <ul aria-label={compact ? 'Matching saved transactions' : undefined}>
        {duplicates.map((match, index) => {
          const account = compact && match.account === 'Main Account' ? null : match.account;

          return (
            <li key={match.id ?? index}>
              <div>
                <strong>{match.description}</strong>
                <span>{[formatReviewDate(match.date), account, match.category].filter(Boolean).join(' · ')}</span>
              </div>
              <strong className="budget-assistant__transaction-amount">
                ${formatAmount.format(match.amount)}
              </strong>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TransactionReview({ review, busy, onConfirm, onSkip, onEdit }) {
  const { draft, options, duplicates } = review;
  const categories = options.categories.filter(({ type }) => type === draft.type);
  const [accountId, setAccountId] = useState(() =>
    options.accounts.find(({ id }) => id === draft.accountId)?.id ?? null,
  );
  const [categoryId, setCategoryId] = useState(() =>
    categories.find(({ id }) => id === draft.categoryId)?.id ?? null,
  );
  const headingId = useId();
  const descriptionId = useId();
  const hasMatches = duplicates.length > 0;
  const ready = accountId != null && categoryId != null;
  const fields = [
    { label: 'Account', value: accountId, items: options.accounts, update: setAccountId },
    { label: 'Category', value: categoryId, items: categories, update: setCategoryId },
  ];

  return (
    <section className="budget-assistant__transaction" aria-labelledby={`${headingId} ${descriptionId}`}>
      <div className="budget-assistant__transaction-heading">
        <div>
          <h3 id={headingId}>Review transaction</h3>
          <p id={descriptionId}>{draft.description}</p>
          <span className="budget-assistant__transaction-meta">
            {draft.type === 'income' ? 'Income' : 'Expense'} · <time dateTime={draft.date}>{formatReviewDate(draft.date)}</time>
          </span>
        </div>
        <strong className="budget-assistant__transaction-amount" data-type={draft.type}>
          {draft.type === 'income' ? '+' : '−'}${formatAmount.format(draft.amount)}
        </strong>
      </div>

      <div className="budget-assistant__transaction-fields">
        {fields.map(({ label, value, items, update }) => (
          <label key={label}>
            {label}
            <select
              value={value ?? ''}
              disabled={busy || items.length === 0}
              onChange={(event) => {
                update(items.find(({ id }) => String(id) === event.target.value)?.id ?? null);
                onEdit();
              }}
            >
              <option value="" disabled>{items.length ? 'Choose an option' : `No ${label.toLowerCase()} available`}</option>
              {items.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        ))}
      </div>

      {hasMatches && <DuplicateMatches duplicates={duplicates} />}

      <div className="budget-assistant__transaction-controls">
        <button type="button" className="budget-assistant__transaction-skip" disabled={busy} onClick={onSkip}>
          Skip
        </button>
        <button
          type="button"
          className="budget-assistant__transaction-save"
          disabled={busy || !ready}
          onClick={() => onConfirm({ accountId, categoryId, allowDuplicate: hasMatches })}
        >
          {hasMatches ? 'Add anyway' : 'Add transaction'}
        </button>
      </div>
    </section>
  );
}

function ChangeReview({ review, busy, onApply, onSkip }) {
  const headingId = useId();
  const noteId = useId();
  const { items, totals } = review;
  const money = (type, amount) => `${type === 'income' ? '+' : '−'}$${formatAmount.format(amount)}`;
  const net = (value) => `${value < 0 ? '−' : ''}$${formatAmount.format(Math.abs(value))}`;
  const labels = { update: 'Change', add: 'Add', remove: 'Remove' };

  return (
    <section className="budget-assistant__transaction" aria-labelledby={`${headingId} ${noteId}`}>
      <div className="budget-assistant__transaction-heading">
        <div>
          <h3 id={headingId}>Review changes</h3>
          <p id={noteId}>Nothing changes until you apply.</p>
        </div>
      </div>

      <div className="budget-assistant__transaction-duplicates budget-assistant__changes">
        <ul aria-label="Proposed changes">
          {items.map((item, index) => {
            const category = item.kind === 'update' && item.newCategory !== item.category
              ? `${item.category ?? 'No category'} → ${item.newCategory ?? 'No category'}`
              : item.newCategory ?? item.category;

            return (
              <li key={index} data-kind={item.kind}>
                <div>
                  <strong>{labels[item.kind]}: {item.newDescription ?? item.description}</strong>
                  <span>{[formatReviewDate(item.date), category, item.account].filter(Boolean).join(' · ')}</span>
                </div>
                <strong className="budget-assistant__transaction-amount" data-type={item.type}>
                  {item.kind === 'update' && item.newAmount !== item.amount
                    ? `${money(item.type, item.amount)} → ${money(item.type, item.newAmount)}`
                    : money(item.type, item.amount)}
                </strong>
              </li>
            );
          })}
        </ul>
        <p className="budget-assistant__changes-total">
          Total of these transactions: {net(totals.before)} → {net(totals.after)}
          {totals.before === totals.after ? ' (unchanged)' : ''}
        </p>
      </div>

      <div className="budget-assistant__transaction-controls">
        <button type="button" className="budget-assistant__transaction-skip" disabled={busy} onClick={onSkip}>
          Skip
        </button>
        <button type="button" className="budget-assistant__transaction-save" disabled={busy} onClick={onApply}>
          Apply changes
        </button>
      </div>
    </section>
  );
}

function fitComposer(composer) {
  if (!composer?.offsetWidth) return;
  // Measure the text independently of the user's chosen minimum height.
  composer.style.minHeight = '0px';
  composer.style.height = '0px';
  const textHeight = composer.scrollHeight;
  composer.style.removeProperty('min-height');
  composer.style.height = `${textHeight}px`;
}

function AssistantWindowResize({ dialogRef, dialogId }) {
  const drag = useRef(null);
  const shorterHeight = useRef('');

  const getBounds = () => {
    const dialog = dialogRef.current;
    const { height } = dialog.getBoundingClientRect();
    const { minHeight, maxHeight } = getComputedStyle(dialog);
    return { height, minimum: parseFloat(minHeight) || 0, maximum: parseFloat(maxHeight) || height };
  };

  const setWindowHeight = (value, { minimum, maximum }) => {
    const height = Math.min(maximum, Math.max(minimum, Math.round(value)));
    dialogRef.current.style.setProperty(windowHeightOverride, `${height}px`);
  };

  const start = (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { ...getBounds(), startY: event.clientY, pointerId: event.pointerId, moved: false };
  };

  const move = (event) => {
    const resize = drag.current;
    if (resize?.pointerId !== event.pointerId) return;
    const distance = event.clientY - resize.startY;
    if (!resize.moved && Math.abs(distance) < 3) return;
    resize.moved = true;
    setWindowHeight(resize.height + distance, resize);
  };

  const stop = (event) => {
    if (drag.current?.pointerId === event.pointerId) drag.current.pointerId = null;
  };

  const resizeWithKeys = (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const bounds = getBounds();
    const distance = event.key === 'ArrowDown' ? WINDOW_RESIZE_STEP : -WINDOW_RESIZE_STEP;
    setWindowHeight(bounds.height + distance, bounds);
  };

  const toggleWindowHeight = (event) => {
    if (event.detail > 0 && drag.current?.moved) return;
    const style = dialogRef.current.style;
    const { height, maximum } = getBounds();
    if (height >= maximum - 1) {
      // The window opens at full height, so the toggle goes to the last shorter size, or a compact one.
      const previous = parseFloat(shorterHeight.current);
      style.setProperty(windowHeightOverride, previous < maximum - 1 ? shorterHeight.current : compactWindowHeight);
    } else {
      shorterHeight.current = style.getPropertyValue(windowHeightOverride);
      style.removeProperty(windowHeightOverride);
    }
  };

  return (
    <button
      className="budget-assistant__resize budget-assistant__window-resize"
      type="button"
      aria-label="Resize chat window height"
      aria-controls={dialogId}
      aria-description="Drag or use the arrow keys to resize. Click or press Enter to switch between full height and a shorter window."
      title="Drag up for a shorter chat window or down for a taller one. Click to switch between full height and a shorter window."
      onPointerDown={start}
      onPointerMove={move}
      onLostPointerCapture={stop}
      onKeyDown={resizeWithKeys}
      onClick={toggleWindowHeight}
    >
      <LuPanelBottom aria-hidden="true" />
    </button>
  );
}

export default function BudgetAssistant({ onDataChanged, dataVersion }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [heightExpanded, setHeightExpanded] = useState(false);
  const [heightFraction, setHeightFraction] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(null);
  const [failure, setFailure] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importResults, setImportResults] = useState({});
  const [transactionReviews, setTransactionReviews] = useState([]);
  const [changeReviews, setChangeReviews] = useState([]);
  const dialogId = useId();
  const titleId = useId();
  const launcherRef = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const composerRef = useRef(null);
  const uploadRef = useRef(null);
  const scrollRef = useRef(null);
  const requestRef = useRef(null);
  const settledReviews = useRef(new Set());
  const resizeRef = useRef(null);
  const latestMessage = messages.at(-1);
  const latestMessageId = latestMessage?.id;
  const showLatestFromStart = latestMessage?.replyMode === 'budget_review' || latestMessage?.visuals?.length > 0;

  useEffect(() => {
    // A development refresh can preserve UI state after aborting the old request.
    if (!requestRef.current) setPending(null);
    return () => {
      const request = requestRef.current;
      requestRef.current = null;
      request?.abort();
    };
  }, []);

  useEffect(() => {
    const panel = scrollRef.current;
    if (!open || !panel) return;

    // An import card sits with the reply that produced it, which may be far above the newest
    // message. While it is being committed, keep it in view instead of jumping to the bottom.
    const committing = pending === 'commit_import' || failure?.turn.body.mode === 'commit_import'
      || latestMessage?.replyMode === 'commit_import';
    const importCard = committing && panel.querySelector('.budget-assistant__messages .budget-assistant__import');
    if (importCard) {
      importCard.scrollIntoView({ block: 'nearest' });
      return;
    }

    const latestReview = !pending && !failure && showLatestFromStart
      ? panel.querySelector('.budget-assistant__messages')?.lastElementChild
      : null;
    if (latestReview) {
      panel.scrollTop += latestReview.getBoundingClientRect().top - panel.getBoundingClientRect().top - 12;
    } else {
      panel.scrollTop = panel.scrollHeight;
    }
  }, [open, latestMessageId, showLatestFromStart, pending, failure, importPreview, transactionReviews, changeReviews]);

  useLayoutEffect(() => {
    if (open) fitComposer(composerRef.current);
  }, [draft, open, expanded]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!open || !composer) return;

    // Wrapping can change even if the draft stays the same.
    let width = composer.clientWidth;
    const observer = new ResizeObserver(() => {
      const currentWidth = composer.clientWidth;
      if (width === currentWidth) return;
      width = currentWidth;
      fitComposer(composer);
    });
    observer.observe(composer);
    return () => observer.disconnect();
  }, [open]);

  const showDialog = () => {
    dialogRef.current.showModal();
    closeRef.current.focus();
    setOpen(true);
  };

  const closeDialog = () => {
    dialogRef.current.close();
  };

  const handleClosed = () => {
    dialogRef.current?.removeAttribute('data-attachment-drag');
    setOpen(false);
    setConfirmReset(false);
    launcherRef.current?.focus({ preventScroll: true });
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget && !pointerInsideDialog(event)) closeDialog();
  };

  const readInputHeight = () => {
    const composer = composerRef.current;
    const { height } = composer.getBoundingClientRect();
    const limit = Math.max(INPUT_MIN_HEIGHT, parseFloat(getComputedStyle(composer).maxHeight) || height);
    return { height, limit };
  };

  const resizeInput = (height, limit) => {
    const nextHeight = Math.min(limit, Math.max(INPUT_MIN_HEIGHT, Math.round(height)));
    setHeightExpanded(false);
    setHeightFraction(nextHeight > INPUT_MIN_HEIGHT
      ? (nextHeight - INPUT_MIN_HEIGHT) / (limit - INPUT_MIN_HEIGHT)
      : null);
  };

  const startResizing = (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { ...readInputHeight(), startY: event.clientY, pointerId: event.pointerId };
  };

  const handleResizeMove = (event) => {
    const resize = resizeRef.current;
    if (resize?.pointerId !== event.pointerId) return;
    resizeInput(resize.height + resize.startY - event.clientY, resize.limit);
  };

  const stopResizing = (event) => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
  };

  const handleResizeKeyDown = (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const { height, limit } = readInputHeight();
    resizeInput(height + (event.key === 'ArrowUp' ? INPUT_RESIZE_STEP : -INPUT_RESIZE_STEP), limit);
  };

  const inputResized = heightExpanded || heightFraction != null;
  let inputFloor;
  if (heightExpanded) {
    inputFloor = 'var(--assistant-input-max-height)';
  } else if (heightFraction != null) {
    inputFloor = `calc(${INPUT_MIN_HEIGHT}px + ${heightFraction} * (var(--assistant-input-max-height) - ${INPUT_MIN_HEIGHT}px))`;
  }

  const toggleInputHeight = () => {
    setHeightExpanded(!inputResized);
    setHeightFraction(null);
  };

  const requestReply = async (turn) => {
    const staleImport = turn.body.mode === 'commit_import' && turn.body.importToken !== importPreview?.token;
    if (staleImport || requestRef.current || !session?.access_token || settledReviews.current.has(turn.reviewId)) return;

    const controller = new AbortController();
    requestRef.current = controller;
    setPending(turn.body.mode ?? 'chat');
    setFailure(null);
    const directReview = ['budget_review', 'financial_summary', 'category_comparison', 'upcoming_payments'].includes(turn.body.mode);
    const timeout = window.setTimeout(() => controller.abort(), directReview ? 18_000 : 55_000);
    let dataChanged = false;

    try {
      const body = turn.attachment
        ? { ...turn.body, attachment: await encodeAttachment(turn.attachment) }
        : turn.body;
      const response = await fetch('/.netlify/functions/budget-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);

      if (response.status === 401) {
        throw new Error('Your session expired. Sign in again to continue.');
      }
      if (!response.ok || typeof payload?.message !== 'string' || !payload.message.trim()) {
        throw new Error(typeof payload?.error === 'string' && payload.error
          ? payload.error
          : 'The assistant couldn’t reply. Try again.');
      }
      if (requestRef.current !== controller) return;

      const actions = Array.isArray(payload.actions)
        ? payload.actions.filter((action) =>
            typeof action?.type === 'string' && typeof action?.id === 'string' && typeof action?.title === 'string',
          )
        : [];
      const message = {
        id: `reply:${turn.id}`,
        role: 'assistant',
        content: payload.message,
        replyMode: turn.body.mode,
        timeZone: turn.body.timeZone,
        actions,
        choices: Array.isArray(payload.choices)
          ? payload.choices.filter((choice) => typeof choice === 'string' && choice.trim()).slice(0, 4)
          : [],
        // A reply about a receipt carries the receipt back, signed, so the next message can be about it without a new upload.
        receiptToken: typeof payload.receiptToken === 'string' ? payload.receiptToken : undefined,
        visuals: validAssistantReplyVisuals(payload.visuals),
      };
      if (payload.importDraft) {
        setImportPreview((previous) => ({
          ...payload.importDraft,
          id: turn.id,
          sourceId: turn.body.mode === 'commit_import' ? previous?.sourceId ?? previous?.id ?? turn.id : turn.id,
        }));
        setImportResults({});
      }
      if (Array.isArray(payload.importResult?.rows)) {
        if (!payload.importDraft) {
          const results = Object.fromEntries(payload.importResult.rows.map((row) => [row.rowId, row]));
          setImportResults((previous) => ({ ...previous, ...results }));
        }
        dataChanged = (payload.importResult.counts?.inserted ?? 0) > 0;
      }
      const reviews = Array.isArray(payload.transactionReviews)
        ? payload.transactionReviews
            .filter((review) =>
              typeof review?.token === 'string' && review.draft && Array.isArray(review.options?.accounts)
                && Array.isArray(review.options?.categories) && Array.isArray(review.duplicates),
            )
            .map((review, index) => ({ ...review, id: `review:${turn.id}:${index}` }))
        : [];
      const changes = Array.isArray(payload.changeReviews)
        ? payload.changeReviews
            .filter((review) => typeof review?.token === 'string' && Array.isArray(review.items) && review.items.length
              && Number.isFinite(review.totals?.before) && Number.isFinite(review.totals?.after))
            .map((review, index) => ({ ...review, id: `changes:${turn.id}:${index}`, fromReceipt: typeof payload.receiptToken === 'string' }))
        : [];
      if (turn.reviewId) {
        settledReviews.current.add(turn.reviewId);
        setTransactionReviews((previous) => previous.flatMap((review) =>
          review.id === turn.reviewId ? reviews : [review],
        ));
        setChangeReviews((previous) => previous.filter(({ id }) => id !== turn.reviewId));
      } else if (reviews.length) {
        setTransactionReviews((previous) => [...previous, ...reviews]);
      }
      // A corrected proposal for a receipt replaces the earlier receipt card instead of sitting beside it.
      // Only a follow-up does that: a card for a newly attached receipt, or from anything else, is added.
      if (changes.length) {
        const corrected = typeof turn.body.receiptToken === 'string' && changes.some(({ fromReceipt }) => fromReceipt);
        setChangeReviews((previous) => [...(corrected ? previous.filter(({ fromReceipt }) => !fromReceipt) : previous), ...changes]);
      }
      setMessages((current) => [...current, message]);
      dataChanged ||= actions.length > 0;
    } catch (error) {
      if (requestRef.current !== controller) return;
      setFailure({
        turn,
        message: controller.signal.aborted
          ? 'This reply is taking longer than expected. Try again.'
          : error instanceof TypeError
            ? 'Couldn’t connect to the assistant. Try again.'
            : error.message,
      });
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPending(null);
      }
    }

    if (dataChanged) onDataChanged?.();
  };

  const setFile = (pickedFile) => {
    if (!pickedFile || requestRef.current || !session?.access_token) return;
    const file = normalizeAttachmentType(pickedFile);
    const kind = attachmentKind(file);
    if (!kind) {
      setAttachmentError('Choose a CSV file, a PDF, or a PNG, JPEG, or WebP screenshot.');
      return;
    }
    if (!file.size) {
      setAttachmentError('This file is empty.');
      return;
    }
    if (file.size > attachmentLimits[kind].bytes) {
      setAttachmentError(attachmentLimits[kind].error);
      return;
    }
    setAttachment({ file, kind });
    setAttachmentError('');
    return true;
  };

  const attachTransferredFiles = (files) => {
    if (requestRef.current || !session?.access_token) return;
    if (files.length > 1) {
      setAttachmentError('Attach one screenshot, PDF or CSV per message.');
      return;
    }
    if (setFile(files[0])) composerRef.current?.focus({ preventScroll: true });
  };

  const handleAttachmentDrag = (event) => {
    if (!isFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    const inside = event.target !== event.currentTarget || pointerInsideDialog(event);
    const acceptsFile = inside && !requestRef.current && Boolean(session?.access_token);
    event.dataTransfer.dropEffect = acceptsFile ? 'copy' : 'none';
    event.currentTarget.toggleAttribute('data-attachment-drag', acceptsFile);
  };

  const handleAttachmentDragLeave = (event) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    if (!event.relatedTarget && event.target !== event.currentTarget && pointerInsideDialog(event)) return;
    event.currentTarget.removeAttribute('data-attachment-drag');
  };

  const handleAttachmentDrop = (event) => {
    const files = transferredFiles(event.dataTransfer);
    event.currentTarget.removeAttribute('data-attachment-drag');
    if (!files.length && !isFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    if (event.target !== event.currentTarget || pointerInsideDialog(event)) attachTransferredFiles(files);
  };

  const handleAttachmentPaste = (event) => {
    const files = transferredFiles(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    attachTransferredFiles(files);
  };

  const send = (text, fileAttachment = null, { analysisOnly, review, requestPrompt, suggestionKey } = {}) => {
    const content = text.trim() || (fileAttachment ? 'Find the transactions in this attachment.' : '');
    if (!content || requestRef.current || !session?.access_token) return false;

    const requestId = crypto.randomUUID();
    const updatedMessages = [...messages, {
      id: requestId,
      role: 'user',
      content,
      requestPrompt,
      suggestionKey,
      askedMonth: review?.month ?? currentSuggestionMonth(),
      attachmentName: fileAttachment ? fileAttachment.file.name || 'Screenshot' : undefined,
    }];
    setMessages(updatedMessages);
    if (!review && !requestPrompt) setDraft('');
    setConfirmReset(false);
    if (fileAttachment) {
      setAttachment(null);
      setAttachmentError('');
    }
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const usesRussian = review && (/^ru\b/i.test(navigator.language) || messages.some(({ role, content: previousText }) =>
      role === 'user' && /[А-Яа-яЁё]/.test(previousText)));
    const body = review
      ? { ...review, timeZone, language: usesRussian ? 'ru' : 'en', visuals: true }
      : {
        // A file with a request lets the assistant decide what to do with it; a file on its own is an import.
        ...(fileAttachment ? { mode: 'prepare_import', attachmentNote: Boolean(text.trim()) } : { visuals: true }),
        // The latest reply, even if a failed request left a user message after it.
        ...(!fileAttachment && messages.findLast(({ role }) => role === 'assistant')?.receiptToken
          ? { receiptToken: messages.findLast(({ role }) => role === 'assistant').receiptToken }
          : {}),
        ...(analysisOnly ? { analysisOnly: true } : {}),
        requestId,
        messages: updatedMessages.slice(-MAX_HISTORY).map(({ role, content, requestPrompt: prompt, choices }) => {
          // The server rejects any message over 6000 characters, and with it the whole request.
          if (prompt || !choices?.length) return { role, content: (prompt ?? content).slice(0, 6000) };
          // The server rejects a message over 6000 characters, so the options never push one past it.
          const offered = `\n\nOptions offered:\n${choices.map((choice, index) => `${index + 1}) ${choice}`).join('\n')}`;
          return { role, content: `${content.slice(0, 6000 - offered.length)}${offered}` };
        }),
        timeZone,
      };
    requestReply({ id: requestId, attachment: fileAttachment, body });
    composerRef.current?.focus();
    return true;
  };

  const sendCategoryComparison = (periods, scope) => send('Compare categories', null, {
    review: { mode: 'category_comparison', periods, scope },
  });

  const replaceCategoryComparison = async (id, previous, periods, signal, language) => {
    const response = await fetch('/.netlify/functions/budget-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        mode: 'category_comparison',
        periods,
        scope: previous.scope,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language,
        visuals: true,
      }),
      signal,
    });
    const payload = await response.json().catch(() => null);
    const comparison = validAssistantReplyVisuals(payload?.visuals).find(({ kind }) => kind === 'category-comparison');
    const datesMatch = comparison && [comparison.earlier, comparison.latest].every(({ startDate, endDate }, index) =>
      periods[index].startDate === startDate && periods[index].endDate === endDate);
    if (!response.ok || !datesMatch || typeof payload?.message !== 'string') {
      throw new Error(typeof payload?.error === 'string' ? payload.error : 'Couldn’t update the comparison.');
    }
    if (signal.aborted) return;

    setMessages((current) => current.map((message) => {
      if (message.id !== id) return message;
      return {
        ...message,
        visuals: message.visuals.map((visual) => visual.kind === 'category-comparison' ? comparison : visual),
        content: payload.message,
        originalContent: message.replyMode === 'category_comparison' ? undefined : message.originalContent ?? message.content,
      };
    }));
  };

  const refreshUpcomingPayments = async (id, previous, signal, language, originalTimeZone) => {
    if (!session?.access_token) throw new Error('Sign in to refresh the forecast.');
    const { startDate, endDate, type } = previous;
    const response = await fetch('/.netlify/functions/budget-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        mode: 'upcoming_payments', startDate, endDate, type,
        timeZone: originalTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        language, visuals: true,
      }),
      signal,
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 401) throw new Error('Your session expired. Sign in again to refresh the forecast.');
    if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Couldn’t refresh the forecast.');

    const schedule = validAssistantReplyVisuals(payload?.visuals).find((visual) => visual.kind === 'upcoming-payments'
      && visual.startDate === startDate && visual.endDate === endDate && (visual.type ?? null) === (type ?? null));
    const projection = schedule?.projection;
    const firstDay = Date.parse(startDate);
    const expectedDays = (Date.parse(endDate) - firstDay) / 86_400_000 + 1;
    if (!Number.isFinite(projection?.startingBalance) || !Array.isArray(projection.days) || projection.days.length !== expectedDays
      || !projection.days.every((day, index) => Date.parse(day?.date) === firstDay + index * 86_400_000 && Array.isArray(day.movements))) {
      throw new Error('Movement details are unavailable for this date range. Open a new forecast to see current movements.');
    }
    signal?.throwIfAborted();

    setMessages((current) => current.map((message) => {
      if (message.id !== id || !message.visuals?.includes(previous)) return message;
      return {
        ...message,
        visuals: message.visuals.map((visual) => visual === previous ? schedule : visual),
        ...(message.replyMode === 'upcoming_payments' && typeof payload.message === 'string' && payload.message.trim()
          ? { content: payload.message } : {}),
      };
    }));
    return schedule;
  };

  const commitImport = (selection) => {
    if (!importPreview?.token || importPreview.readOnly || !selection.length) return;
    requestReply({
      id: crypto.randomUUID(),
      body: { mode: 'commit_import', importToken: importPreview.token, selection },
    });
  };

  const clearImportFailure = () => {
    setFailure((current) => current?.turn.body.mode === 'commit_import' ? null : current);
  };

  const clearReviewFailure = (reviewId) => {
    setFailure((current) => current?.turn.reviewId === reviewId ? null : current);
  };

  const confirmTransaction = (review, { accountId, categoryId, allowDuplicate }) => {
    if (accountId == null || categoryId == null) return;
    requestReply({
      id: crypto.randomUUID(),
      reviewId: review.id,
      body: {
        mode: 'confirm_transaction',
        transactionToken: review.token,
        accountId,
        categoryId,
        allowDuplicate,
      },
    });
  };

  const skipTransaction = (reviewId) => {
    if (requestRef.current) return;
    settledReviews.current.add(reviewId);
    setTransactionReviews((previous) => previous.filter(({ id }) => id !== reviewId));
    clearReviewFailure(reviewId);
    composerRef.current?.focus();
  };

  const applyChanges = (review) => {
    const russian = /^ru\b/i.test(navigator.language)
      || messages.some(({ role, content }) => role === 'user' && /[А-Яа-яЁё]/.test(content));
    requestReply({
      id: crypto.randomUUID(),
      reviewId: review.id,
      body: { mode: 'confirm_changes', changesToken: review.token, language: russian ? 'ru' : 'en' },
    });
  };

  const skipChanges = (reviewId) => {
    if (requestRef.current) return;
    settledReviews.current.add(reviewId);
    setChangeReviews((previous) => previous.filter(({ id }) => id !== reviewId));
    clearReviewFailure(reviewId);
    composerRef.current?.focus();
  };

  const reset = () => {
    if (requestRef.current) return;
    setMessages([]);
    setDraft('');
    setFailure(null);
    setConfirmReset(false);
    setAttachment(null);
    setAttachmentError('');
    setImportPreview(null);
    setImportResults({});
    setTransactionReviews([]);
    setChangeReviews([]);
    settledReviews.current.clear();
    closeRef.current?.focus();
  };

  // The import card belongs to the reply that produced it. Pinned under the newest
  // message, it looked as if every later reply proposed the same import again.
  const importReview = importPreview && (importPreview.rows.length > 0 || importPreview.warnings?.length > 0) && (
    <ImportReview
      key={importPreview.sourceId ?? importPreview.id}
      preview={importPreview}
      results={importResults}
      pending={pending}
      onImport={commitImport}
      onModify={clearImportFailure}
    />
  );
  // sourceId stays the same when an import refreshes its draft, so the card keeps its place and its selection.
  const importAnchor = importReview
    && messages.find(({ id }) => id === `reply:${importPreview.sourceId ?? importPreview.id}`)?.id;

  return createPortal(
    <div className="budget-assistant">
      <button
        ref={launcherRef}
        className="budget-assistant__launcher"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={showDialog}
      >
        <LuSparkles aria-hidden="true" />
        <span>Budget assistant</span>
      </button>

      <dialog
        ref={dialogRef}
        className="budget-assistant__dialog"
        data-expanded={expanded}
        id={dialogId}
        aria-labelledby={titleId}
        onClose={handleClosed}
        onClick={handleBackdropClick}
        onDragEnter={handleAttachmentDrag}
        onDragOver={handleAttachmentDrag}
        onDragLeave={handleAttachmentDragLeave}
        onDrop={handleAttachmentDrop}
        onPaste={handleAttachmentPaste}
      >
        <div className="budget-assistant__drop-overlay" aria-hidden="true">
          <div>
            <LuPaperclip />
            <span>Drop a screenshot, PDF or CSV</span>
          </div>
        </div>
        <header className="budget-assistant__header">
          <span className="budget-assistant__mark" aria-hidden="true"><LuSparkles /></span>
          <h2 id={titleId}>Budget assistant</h2>
          {messages.length > 0 && (
            <button
              className="budget-assistant__icon"
              type="button"
              aria-label="New chat"
              title="New chat"
              aria-expanded={confirmReset}
              disabled={Boolean(pending)}
              onClick={() => setConfirmReset((value) => !value)}
            >
              <LuPlus aria-hidden="true" />
            </button>
          )}
          <button
            className="budget-assistant__size"
            type="button"
            aria-label={expanded ? 'Restore chat size' : 'Open chat full screen'}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <LuMinimize2 aria-hidden="true" /> : <LuMaximize2 aria-hidden="true" />}
            {expanded ? 'Restore' : 'Full screen'}
          </button>
          <button
            ref={closeRef}
            className="budget-assistant__icon"
            type="button"
            aria-label="Close budget assistant"
            title="Close"
            onClick={closeDialog}
          >
            <LuX aria-hidden="true" />
          </button>
        </header>

        <div className="budget-assistant__body" ref={scrollRef}>
          {confirmReset && (
            <div className="budget-assistant__reset">
              <p>Start a fresh conversation?</p>
              <button type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" disabled={Boolean(pending)} onClick={reset}>Start</button>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="budget-assistant__welcome">
              <h3>How can I help?</h3>
              <p>Ask about your finances or tell me what you’d like to record.</p>
            </div>
          ) : (
            <div className="budget-assistant__messages" role="log" aria-label="Conversation">
              {messages.map(({ id, role, content, originalContent, actions, choices, attachmentName, visuals, timeZone }, index) => {
                const previous = messages[index - 1];
                const request = previous?.role === 'user' ? previous.requestPrompt ?? previous.content : '';
                const plainComparison = role === 'assistant' && !visuals?.length && isPlainCategoryComparison(content, request);
                const plainSchedule = role === 'assistant' && !visuals?.length && isPlainUpcomingSchedule(content);
                const emptyScheduleCaption = content.trim() === EMPTY_UPCOMING_PAYMENTS_MESSAGE
                  && visuals?.some(({ kind, payments }) => kind === 'upcoming-payments' && payments.length === 0);
                const language = /\p{Script=Cyrillic}/u.test(content) ? 'ru' : 'en';
                return (
                  <Fragment key={id}>
                  <div
                    className={`budget-assistant__message budget-assistant__message--${role}`}
                    data-has-visuals={visuals?.length ? true : undefined}
                  >
                    <span className="budget-assistant__message-author">
                      {role === 'user' ? 'You' : 'Budget assistant'}
                    </span>
                    {visuals?.length > 0 && (
                      <AssistantReplyFollowUps
                        visuals={visuals}
                        pending={pending || !session?.access_token}
                        onSend={(prompt, label) => send(label ?? prompt, null, { analysisOnly: true, requestPrompt: prompt })}
                        onCategoryComparison={({ earlier, latest, scope }) => sendCategoryComparison([earlier, latest], scope)}
                      />
                    )}
                    {visuals?.length > 0 && (
                      <AssistantReplyVisuals
                        visuals={visuals}
                        onComparePeriods={session?.access_token ? (chart, periods, signal) =>
                          replaceCategoryComparison(id, chart, periods, signal, language) : undefined}
                        onRefreshUpcomingPayments={session?.access_token ? (chart, signal) =>
                          refreshUpcomingPayments(id, chart, signal, language, timeZone) : undefined}
                        renderCategoryDetails={(selection) => open && (
                          <AssistantCategoryDetails
                            key={selection.label}
                            {...selection}
                            accessToken={session?.access_token}
                            dataVersion={dataVersion}
                          />
                        )}
                      />
                    )}
                    {(plainComparison || plainSchedule) && index === messages.length - 1 && (
                      <div className="assistant-follow-ups">
                        <button type="button" disabled={Boolean(pending) || !session?.access_token}
                          onClick={() => plainSchedule
                            ? send('See upcoming payments', null, { review: { mode: 'upcoming_payments' } })
                            : sendCategoryComparison(requestedComparisonPeriods(previous))}>
                          {plainSchedule ? <LuCalendarClock aria-hidden="true" /> : <LuTrendingUp aria-hidden="true" />}
                          {plainSchedule ? 'Show upcoming payments chart' : 'Visualize comparison'}
                        </button>
                      </div>
                    )}
                    {!plainComparison && !plainSchedule && !emptyScheduleCaption && <p>{content}</p>}
                    {(plainComparison || plainSchedule || originalContent) && (
                      <details className="budget-assistant__original-answer">
                        <summary>Original answer</summary>
                        <p>{originalContent ?? content}</p>
                      </details>
                    )}
                    {choices?.length > 0 && (
                      <div className="assistant-follow-ups budget-assistant__choices" role="group" aria-label="Choose a reply">
                        {choices.map((choice) => (
                          <button
                            key={choice}
                            type="button"
                            disabled={index !== messages.length - 1 || Boolean(pending) || !session?.access_token}
                            onClick={() => send(choice, null, { requestPrompt: choice })}
                          >
                            {choice}
                          </button>
                        ))}
                      </div>
                    )}
                    {attachmentName && (
                      <span className="budget-assistant__message-attachment">
                        <LuPaperclip aria-hidden="true" /> {attachmentName}
                      </span>
                    )}
                    {actions?.length > 0 && (
                      <ul className="budget-assistant__actions" aria-label="Changes made">
                        {actions.map((action, index) => {
                          const path = actionRoutes.get(action.type);

                          return (
                            <li key={`${action.type}:${action.id}:${index}`}>
                              <LuCheck aria-hidden="true" />
                              {path ? (
                                <RouterLink to={path} onClick={closeDialog}>{action.title}</RouterLink>
                              ) : (
                                <span>{action.title}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {id === importAnchor && importReview}
                  </Fragment>
                );
              })}
            </div>
          )}
          {!importAnchor && importReview}
          {changeReviews.map((review) => (
            <ChangeReview
              key={review.id}
              review={review}
              busy={Boolean(pending) || !session?.access_token}
              onApply={() => applyChanges(review)}
              onSkip={() => skipChanges(review.id)}
            />
          ))}
          {transactionReviews.map((review) => (
            <TransactionReview
              key={review.id}
              review={review}
              busy={Boolean(pending) || !session?.access_token}
              onConfirm={(selections) => confirmTransaction(review, selections)}
              onSkip={() => skipTransaction(review.id)}
              onEdit={() => clearReviewFailure(review.id)}
            />
          ))}
          <AssistantSuggestions
            open={open}
            messages={messages}
            userId={session?.user?.id}
            accessToken={session?.access_token}
            dataVersion={dataVersion}
            pending={pending}
            onSend={send}
          />
          {pending && (
            <div className="budget-assistant__pending" role="status">
              <span aria-hidden="true" />
              {{
                prepare_import: 'Reading your attachment…',
                commit_import: 'Importing transactions…',
                confirm_transaction: 'Saving transaction…',
                confirm_changes: 'Applying changes…',
                budget_review: 'Checking this category’s transactions…',
                financial_summary: 'Reviewing recorded income and expenses…',
                category_comparison: 'Comparing recorded spending…',
                upcoming_payments: 'Checking your payment schedule…',
              }[pending] ?? 'Preparing a reply…'}
            </div>
          )}
          {failure && (
            <div className="budget-assistant__error">
              <p role="alert">{failure.message}</p>
              {failure.turn.body.mode !== 'commit_import' && (
                <button
                  type="button"
                  disabled={!session?.access_token}
                  onClick={() => {
                    composerRef.current?.focus();
                    requestReply(failure.turn);
                  }}
                >
                  <LuRotateCcw aria-hidden="true" /> Retry
                </button>
              )}
            </div>
          )}
        </div>

        <form
          className="budget-assistant__composer"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft, attachment);
          }}
        >
          <input
            ref={uploadRef}
            type="file"
            accept={attachmentTypes}
            hidden
            onChange={(event) => {
              setFile(event.target.files[0]);
              event.target.value = '';
            }}
          />
          {attachment && (
            <div className="budget-assistant__attachment">
              {attachment.kind === 'image' ? <LuImage aria-hidden="true" /> : <LuFileText aria-hidden="true" />}
              <span title={attachment.file.name}>{attachment.file.name || 'Screenshot'}</span>
              <button
                type="button"
                aria-label="Remove attachment"
                title="Remove attachment"
                onClick={() => {
                  setAttachment(null);
                  setAttachmentError('');
                  composerRef.current?.focus();
                }}
              >
                <LuX aria-hidden="true" />
              </button>
            </div>
          )}
          {attachmentError && <p className="budget-assistant__attachment-error" role="alert">{attachmentError}</p>}
          <div className="budget-assistant__input-controls">
            <button
              className="budget-assistant__height-toggle"
              type="button"
              aria-label={inputResized ? 'Restore input' : 'Expand input'}
              aria-controls={`${dialogId}-message`}
              title={inputResized ? 'Restore input' : 'Expand input'}
              onClick={toggleInputHeight}
            >
              <LuMoveVertical aria-hidden="true" />
            </button>
            <button
              className="budget-assistant__resize"
              type="button"
              aria-label="Drag to resize input"
              aria-controls={`${dialogId}-message`}
              aria-description="Use the Up and Down arrow keys to adjust the input height."
              title="Drag up to make the input taller, or down to make it shorter"
              onPointerDown={startResizing}
              onPointerMove={handleResizeMove}
              onLostPointerCapture={stopResizing}
              onKeyDown={handleResizeKeyDown}
              onClick={(event) => {
                if (event.detail === 0) toggleInputHeight();
              }}
            >
              <LuGripHorizontal aria-hidden="true" />
            </button>
          </div>
          <button
            className="budget-assistant__attach"
            type="button"
            aria-label="Attach CSV, PDF or screenshot"
            title="Attach CSV, PDF or screenshot. You can also drop a file here or paste a screenshot."
            disabled={Boolean(pending) || !session?.access_token}
            onClick={() => uploadRef.current?.click()}
          >
            <LuPaperclip aria-hidden="true" />
          </button>
          <textarea
            id={`${dialogId}-message`}
            ref={composerRef}
            style={inputFloor ? { '--assistant-input-floor': inputFloor } : undefined}
            aria-label="Message"
            placeholder="Ask about your budget…"
            enterKeyHint="send"
            rows="1"
            value={draft}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                send(draft, attachment);
              }
            }}
          />
          <button
            className="budget-assistant__send"
            type="submit"
            aria-label="Send message"
            title={attachment ? 'Analyze attachment' : 'Send message'}
            disabled={Boolean(pending) || (!draft.trim() && !attachment) || !session?.access_token}
          >
            <LuArrowUp aria-hidden="true" />
          </button>
        </form>
        <AssistantWindowResize dialogRef={dialogRef} dialogId={dialogId} />
      </dialog>
    </div>,
    document.body,
  );
}
