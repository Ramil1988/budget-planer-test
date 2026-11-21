import { useId, useLayoutEffect, useRef, useState } from 'react';
import { LuArrowUpRight, LuChartNoAxesCombined } from 'react-icons/lu';
import { validAssistantReplyVisuals } from './AssistantReplyVisuals';
import '../styles/assistant-reply-follow-ups.css';

const amountFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' });
const knownLabel = (value) => typeof value === 'string' && value.trim().length > 0;
const normalize = (value) => knownLabel(value) ? value.trim().toLowerCase() : '';

function displayDate(date) {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}

function displayPeriod({ startDate, endDate }) {
  return startDate === endDate ? displayDate(startDate) : `${displayDate(startDate)} – ${displayDate(endDate)}`;
}

function monthEnd(month) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
}

function backOneMonth(value) {
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  const month = date.toISOString().slice(0, 7);
  const lastDay = Number(monthEnd(month).slice(-2));
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function scopeKey(scope) {
  return JSON.stringify([normalize(scope?.type), normalize(scope?.account), normalize(scope?.category), normalize(scope?.search)]);
}

function scopeDescription(scope) {
  return [
    knownLabel(scope?.account) && `account ${JSON.stringify(scope.account)}`,
    knownLabel(scope?.category) && `category ${JSON.stringify(scope.category)}`,
    knownLabel(scope?.search) && `search term ${JSON.stringify(scope.search)}`,
  ].filter(Boolean).join(', ');
}

function categoryAmounts(period) {
  const amounts = new Map();
  const categories = Array.isArray(period.categories) ? period.categories : [];
  for (const category of categories) {
    if (!knownLabel(category?.label) || !Number.isFinite(category.amount) || category.amount < 0) continue;
    const cents = Math.round(category.amount * 100);
    if (!Number.isSafeInteger(cents)) continue;
    const key = normalize(category.label);
    const existing = amounts.get(key);
    amounts.set(key, { label: existing?.label ?? category.label, cents: (existing?.cents ?? 0) + cents });
  }
  return {
    amounts,
    incomplete: Number.isSafeInteger(period.categoryCount) && period.categoryCount > amounts.size,
  };
}

function transactionGroups(summaries, records) {
  const periods = summaries.map((summary) => ({
    ...summary,
    categories: [...categoryAmounts(summary).amounts.values()].sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label)),
  }));
  for (const record of records) {
    if (record.kind === 'category-comparison') {
      for (const position of ['latest', 'earlier']) {
        const { startDate, endDate } = record[position];
        const categories = record.categories
          .filter((item) => knownLabel(item?.label) && Number.isFinite(item[position]) && item[position] > 0)
          .sort((a, b) => b[position] - a[position] || a.label.localeCompare(b.label));
        if (categories.length) periods.push({ startDate, endDate, scope: record.scope, categories });
      }
    }
    if (record.kind === 'budget-review' && knownLabel(record.category)) {
      const period = { startDate: `${record.month}-01`, endDate: monthEnd(record.month) };
      const alreadyListed = periods.some((group) => group.startDate === period.startDate && group.endDate === period.endDate
        && !scopeDescription(group.scope) && group.categories.some(({ label }) => normalize(label) === normalize(record.category)));
      if (!alreadyListed) periods.push({ ...period, categories: [{ label: record.category }] });
    }
  }
  return periods.map(({ startDate, endDate, scope, categories }, index) => ({
    key: index,
    label: [displayPeriod({ startDate, endDate }), scopeDescription(scope)].filter(Boolean).join(' · '),
    options: categories.filter(({ label }) => normalize(label) !== 'uncategorized').map(({ label }, categoryIndex) => ({
      value: `${index}:${categoryIndex}`,
      category: label,
      startDate,
      endDate,
      scope,
    })),
  })).filter(({ options }) => options.length > 0);
}

function transactionPrompt({ startDate, endDate, category, scope }) {
  const filters = scopeDescription({ account: scope?.account, search: scope?.search });
  return `List my recorded expense transactions in category ${JSON.stringify(category)} from ${startDate} through ${endDate}, inclusive.${filters ? ` Keep the chart filters for ${filters}.` : ''} Include the date, description, account, and amount in CAD. Use saved transactions only.`;
}

function reviewBudgetPrompt({ startDate, endDate, category, scope }) {
  const month = endDate.slice(0, 7);
  const wholeMonth = startDate === `${month}-01` && endDate === monthEnd(month);
  const filters = scopeDescription({ account: scope?.account, search: scope?.search });
  const period = wholeMonth && !filters ? '' : ` Separately show recorded expenses in the comparison period from ${startDate} through ${endDate}, inclusive.${filters ? ` Keep the chart filters for ${filters} for that comparison period.` : ''}`;
  return `Review my saved monthly budget for category ${JSON.stringify(category)} in ${month}. Compare the saved monthly limit with actual monthly spending in CAD and identify the recorded expenses that drove spending.${period}`;
}

function previousMonthPrompt(period) {
  const filters = scopeDescription(period.scope);
  return `Compare my recorded expenses by category for ${period.startDate} through ${period.endDate}, inclusive, and ${backOneMonth(period.startDate)} through ${backOneMonth(period.endDate)}, inclusive. Use the same filters${filters ? ` for ${filters}` : ''} in both periods. Query both date ranges separately and show both spending summary charts. Compare category amounts in CAD and show the percentage change from the earlier period.`;
}

function comparisonRows(earlier, latest) {
  const previous = categoryAmounts(earlier);
  const current = categoryAmounts(latest);
  const labels = new Set([...previous.amounts.keys(), ...current.amounts.keys()]);
  const rows = [...labels].map((key) => {
    const oldValue = previous.amounts.get(key);
    const newValue = current.amounts.get(key);
    return {
      key,
      label: newValue?.label ?? oldValue.label,
      earlier: oldValue?.cents ?? (previous.incomplete ? null : 0),
      latest: newValue?.cents ?? (current.incomplete ? null : 0),
    };
  }).sort((a, b) => (b.latest ?? -1) - (a.latest ?? -1) || a.label.localeCompare(b.label));
  return { rows, incomplete: previous.incomplete || current.incomplete };
}

function CategoryComparison({ earlier, latest }) {
  const { rows, incomplete } = comparisonRows(earlier, latest);
  const filters = scopeDescription(latest.scope);

  return (
    <div className="assistant-follow-ups__comparison">
      {filters && <p>Filtered by {filters}.</p>}
      {incomplete && <p>Some categories are missing from the chart data. Missing amounts are shown as unavailable.</p>}
      {rows.length > 0 ? (
        <div className="assistant-follow-ups__table-wrap" role="region" aria-label="Category comparison table" tabIndex={0}>
          <table>
            <caption>Category spending in CAD</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Earlier<small>{displayPeriod(earlier)}</small></th>
                <th scope="col">Latest<small>{displayPeriod(latest)}</small></th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const unavailable = row.earlier == null || row.latest == null;
                const difference = unavailable ? 0 : row.latest - row.earlier;
                const change = row.earlier ? percentFormat.format(difference / row.earlier) : difference > 0 ? 'New' : '0%';
                return (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td>{row.earlier == null ? 'Unavailable' : amountFormat.format(row.earlier / 100)}</td>
                    <td>{row.latest == null ? 'Unavailable' : amountFormat.format(row.latest / 100)}</td>
                    <td data-direction={difference > 0 ? 'up' : difference < 0 ? 'down' : undefined}>
                      {unavailable ? 'Unavailable' : change}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p>No category spending in these periods.</p>}
    </div>
  );
}

export default function AssistantReplyFollowUps({ visuals, pending, onSend, onCategoryComparison }) {
  const records = validAssistantReplyVisuals(visuals).filter(({ currency }) => currency == null || currency === 'CAD');
  const hasComparison = records.some(({ kind }) => kind === 'category-comparison');
  const summaries = records.filter(({ kind, scope }) => kind === 'spending-summary' && scope?.type !== 'income')
    .sort((a, b) => b.endDate.localeCompare(a.endDate) || b.startDate.localeCompare(a.startDate));
  const pair = summaries.map((latest, index) => ({
    latest,
    earlier: summaries.slice(index + 1).find((item) => scopeKey(item.scope) === scopeKey(latest.scope)
      && (item.startDate !== latest.startDate || item.endDate !== latest.endDate)),
  })).find(({ earlier }) => earlier);
  const { latest, earlier } = pair ?? { latest: summaries[0] };
  const groups = transactionGroups(summaries, records);
  const options = groups.flatMap(({ options: groupOptions }) => groupOptions);
  const [chosen, setChosen] = useState('');
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const comparisonId = useId();
  const comparisonRef = useRef(null);
  useLayoutEffect(() => {
    if (comparisonOpen) comparisonRef.current?.scrollIntoView({ block: 'nearest' });
  }, [comparisonOpen]);
  const selected = options.find(({ value }) => value === chosen) ?? options[0];
  const localComparison = !onCategoryComparison && earlier;
  if (!latest && !selected) return null;

  const compareCategories = () => {
    if (onCategoryComparison) {
      const { startDate, endDate, scope } = latest;
      onCategoryComparison({
        earlier: earlier
          ? { startDate: earlier.startDate, endDate: earlier.endDate }
          : { startDate: backOneMonth(startDate), endDate: backOneMonth(endDate) },
        latest: { startDate, endDate },
        scope,
      });
    } else if (earlier) {
      setComparisonOpen((value) => !value);
    } else {
      onSend(previousMonthPrompt(latest), 'Compare categories');
    }
  };

  return (
    <div className="assistant-follow-ups" role="group" aria-label="Follow-up actions">
      {selected && (
        <div className={`assistant-follow-ups__transactions${hasComparison ? ' assistant-follow-ups__transactions--with-budget' : ''}`}>
          <label>
            <span>Transaction category</span>
            <select value={selected.value} onChange={(event) => setChosen(event.target.value)} disabled={Boolean(pending)}>
              {groups.map((group) => (
                <optgroup key={group.key} label={group.label}>
                  {group.options.map(({ value, category }) => <option key={value} value={value}>{category}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="assistant-follow-ups__transaction-actions">
            <button type="button" disabled={Boolean(pending)} onClick={() => onSend(transactionPrompt(selected), `Show ${selected.category} transactions`)}>
              Show transactions <LuArrowUpRight aria-hidden="true" />
            </button>
            {hasComparison && (
              <button type="button" disabled={Boolean(pending)} onClick={() => onSend(reviewBudgetPrompt(selected), `Review ${selected.category} budget`)}>
                Review budget
              </button>
            )}
          </div>
          <p className="assistant-follow-ups__period">{displayPeriod(selected)}</p>
        </div>
      )}
      {latest && (
        <button
          type="button"
          disabled={!localComparison && Boolean(pending)}
          aria-expanded={localComparison ? comparisonOpen : undefined}
          aria-controls={localComparison ? comparisonId : undefined}
          onClick={compareCategories}
        >
          <LuChartNoAxesCombined aria-hidden="true" /> Compare categories
        </button>
      )}
      {localComparison && (
        <div id={comparisonId} ref={comparisonRef} hidden={!comparisonOpen}>
          {comparisonOpen && <CategoryComparison earlier={earlier} latest={latest} />}
        </div>
      )}
    </div>
  );
}
