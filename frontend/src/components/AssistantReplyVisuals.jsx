import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { LuChevronDown, LuDownload } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import '../styles/assistant-reply-visuals.css';
import { projectionAtOpening } from '../lib/projectedBalance';
import { transactionCategoryUrl } from '../lib/transactionView';

const MAX_RANKED_ROWS = 8;
const DAY_MS = 86_400_000;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/;
const amountFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero' });
const budgetUsageFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });
const coverageFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 });
const monthFormat = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const validText = (value) => typeof value === 'string' && value.trim().length > 0;
const validAmount = (value) => Number.isFinite(value) && value >= 0;
export const EMPTY_UPCOMING_PAYMENTS_MESSAGE = 'No remaining scheduled payments in this period.';

function money(amount) {
  return `${amount < 0 ? '−' : ''}${amountFormat.format(Math.abs(amount))}\u00a0CAD`;
}

function displayDate(date) {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}

function displayMonth(month) {
  return monthFormat.format(new Date(`${month}-01T00:00:00Z`));
}

function categoryHue(label) {
  let hash = 0;
  for (const character of label.trim().toLocaleLowerCase()) {
    hash = (Math.imul(hash, 31) + character.codePointAt(0)) >>> 0;
  }
  return (hash * 137.508) % 360;
}

function spendingTotals({ scope, income, expenses, net }) {
  if (scope?.type === 'expense') return [{ label: 'Total expenses', amount: expenses, tone: 'expense' }];
  if (scope?.type === 'income') return [{ label: 'Total income', amount: income, tone: 'actual' }];
  return [
    { label: 'Income', amount: income, tone: 'actual' },
    { label: 'Expenses', amount: expenses, tone: 'expense' },
    { label: 'Net', amount: net },
  ];
}

function expenseCategories({ scope, categories }) {
  if (scope?.type === 'income' || !Array.isArray(categories)) return [];
  return categories.filter((item) => validText(item?.label) && validAmount(item.amount));
}

function validComparisonPeriod(period) {
  return period && datePattern.test(period.startDate) && datePattern.test(period.endDate) && validAmount(period.total);
}

export function validAssistantReplyVisuals(visuals) {
  if (!Array.isArray(visuals)) return [];
  return visuals.filter((visual) => {
    if (visual?.kind === 'spending-summary') {
      return datePattern.test(visual.startDate) && datePattern.test(visual.endDate)
        && spendingTotals(visual).every(({ amount, tone }) => tone ? validAmount(amount) : Number.isFinite(amount));
    }
    if (visual?.kind === 'category-comparison') {
      return visual.currency === 'CAD' && validComparisonPeriod(visual.earlier)
        && validComparisonPeriod(visual.latest) && Array.isArray(visual.categories);
    }
    if (visual?.kind === 'upcoming-payments') {
      const start = Date.parse(visual.startDate);
      const end = Date.parse(visual.endDate);
      return visual.currency === 'CAD' && datePattern.test(visual.startDate) && datePattern.test(visual.endDate)
        && end >= start && end - start <= 366 * DAY_MS && Array.isArray(visual.payments)
        && validAmount(visual.income) && validAmount(visual.expenses);
    }
    if (visual?.kind === 'recurring-date-audit') {
      return visual.currency === 'CAD' && validText(visual.category) && monthPattern.test(visual.month)
        && datePattern.test(visual.startDate) && datePattern.test(visual.endDate) && Array.isArray(visual.rows);
    }
    return visual?.kind === 'budget-review' && monthPattern.test(visual.month) && validAmount(visual.spent);
  });
}

function displayPeriod({ startDate, endDate }) {
  return startDate === endDate ? displayDate(startDate) : `${displayDate(startDate)} – ${displayDate(endDate)}`;
}

function earlierMonthLimit(earlier, latest) {
  const month = latest.startDate.slice(0, 7);
  if (!monthPattern.test(month) || latest.endDate.slice(0, 7) !== month
    || earlier.startDate.slice(0, 7) !== earlier.endDate.slice(0, 7)) return null;
  const previous = new Date(`${month}-01T00:00:00Z`);
  previous.setUTCDate(0);
  const lastMonth = previous.toISOString().slice(0, 7);
  return monthPattern.test(lastMonth) && earlier.endDate.slice(0, 7) <= lastMonth ? lastMonth : null;
}

function comparablePeriod({ startDate, endDate }, month) {
  const endOfMonth = new Date(`${month}-01T00:00:00Z`);
  endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1, 0);
  const matchingDate = (date) => `${month}-${String(Math.min(Number(date.slice(-2)), endOfMonth.getUTCDate())).padStart(2, '0')}`;
  return { startDate: matchingDate(startDate), endDate: matchingDate(endDate) };
}

function signedMoney(amount) {
  return `${amount > 0 ? '+' : ''}${money(amount)}`;
}

function percentPoints({ earlier, change, percentChange }) {
  return percentChange ?? (earlier > 0 ? change / earlier * 100 : 0);
}

function changePercent(row) {
  return row.earlier === 0 && row.latest > 0 ? 'New' : percentFormat.format(percentPoints(row) / 100);
}

function escapeCsvLabel(label) {
  // Keep category names as text in spreadsheets, including names starting with formula characters.
  const value = /^\s*[=+@-]|^[\t\r\n]/u.test(label) ? `'${label}` : label;
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadComparison({ earlier, latest }, rows, container) {
  const header = 'Category,Earlier start,Earlier end,Earlier CAD,Latest start,Latest end,Latest CAD,Change CAD,Change percent';
  const csv = [header, ...rows.map((row) => [
    escapeCsvLabel(row.label),
    earlier.startDate, earlier.endDate, row.earlier.toFixed(2),
    latest.startDate, latest.endDate, row.latest.toFixed(2),
    row.change.toFixed(2),
    row.earlier === 0 && row.latest > 0 ? 'New' : `${percentPoints(row)}%`,
  ].join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `budgetwise-category-comparison-${earlier.startDate}-to-${latest.endDate}.csv`;
  link.hidden = true;
  container.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CategoryComparison({ data, renderCategoryDetails, onComparePeriods }) {
  const { earlier, latest } = data;
  const totalDifference = (Math.round(latest.total * 100) - Math.round(earlier.total * 100)) / 100;
  const [allOpen, setAllOpen] = useState(false);
  const [fullChart, setFullChart] = useState(true);
  const [selected, setSelected] = useState(null);
  const [chosenMonth, setChosenMonth] = useState(null);
  const [monthStatus, setMonthStatus] = useState(null);
  const tableId = useId();
  const chartId = useId();
  const tableRef = useRef(null);
  const detailsRef = useRef(null);
  const compareRequest = useRef(null);
  const monthLimit = onComparePeriods ? earlierMonthLimit(earlier, latest) : null;
  const earlierMonth = earlier.startDate.slice(0, 7);
  const rows = data.categories.filter((item) => validText(item?.label)
    && validAmount(item.earlier) && validAmount(item.latest) && Number.isFinite(item.change)
    && (item.percentChange == null || Number.isFinite(item.percentChange)));
  const changes = rows.filter(({ change }) => change !== 0).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const increases = changes.filter(({ change }) => change > 0);
  const decreases = changes.filter(({ change }) => change < 0);
  const biggest = increases.length && decreases.length
    ? [...increases.slice(0, 3), ...decreases.slice(0, 3)]
    : changes.slice(0, 6);
  const budgetMonth = latest.endDate.slice(0, 7);
  const overBudgetRows = rows.filter(({ overBudget }) => overBudget?.month === budgetMonth
    && validAmount(overBudget.amount) && overBudget.amount > 0)
    .sort((a, b) => b.overBudget.amount - a.overBudget.amount || a.label.localeCompare(b.label));
  const overBudgetLabels = new Set(overBudgetRows.map(({ label }) => label));
  const highlights = [...overBudgetRows, ...biggest.filter(({ label }) => !overBudgetLabels.has(label))];
  const plotted = fullChart ? [...overBudgetRows, ...rows.filter(({ label }) => !overBudgetLabels.has(label))] : highlights;
  const scale = Math.max(0, ...plotted.map(({ change }) => Math.abs(change)));
  const ChartRow = renderCategoryDetails ? 'button' : 'span';

  useEffect(() => () => {
    const request = compareRequest.current;
    compareRequest.current = null;
    request?.abort();
  }, []);

  const changeMonth = async (month) => {
    const previousRequest = compareRequest.current;
    compareRequest.current = null;
    previousRequest?.abort();
    setChosenMonth(month);
    setMonthStatus(null);
    if (!monthPattern.test(month) || month > monthLimit || month === earlierMonth) return;

    const request = new AbortController();
    compareRequest.current = request;
    setMonthStatus('loading');
    const timeout = window.setTimeout(() => request.abort(), 18_000);
    try {
      const anchor = { startDate: latest.startDate, endDate: latest.endDate };
      await onComparePeriods(data, [comparablePeriod(anchor, month), anchor], request.signal);
      if (compareRequest.current === request) {
        setSelected(null);
        setMonthStatus(null);
      }
    } catch (error) {
      if (compareRequest.current === request) {
        setMonthStatus(request.signal.aborted ? 'The comparison took too long to load.' : error.message);
      }
    } finally {
      window.clearTimeout(timeout);
      if (compareRequest.current === request) compareRequest.current = null;
    }
  };

  useLayoutEffect(() => {
    if (allOpen) tableRef.current?.scrollIntoView({ block: 'nearest' });
  }, [allOpen]);

  useLayoutEffect(() => {
    if (selected) detailsRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const toggleCategory = (row, source) => {
    setSelected((current) => current?.label === row.label && current.source === source
      ? null
      : { label: row.label, source });
  };

  const categoryDetails = (row, id) => (
    <div className="assistant-visuals__change-details" id={id} ref={detailsRef}>
      {renderCategoryDetails({ label: row.label, earlier, latest, scope: data.scope })}
    </div>
  );

  return (
    <section className="assistant-visuals__panel assistant-visuals__change-panel" aria-label="Category comparison">
      <header>
        <h3>Category comparison</h3>
      </header>
      <div className="assistant-visuals__change-actions">
        <button type="button" aria-expanded={allOpen} aria-controls={tableId} onClick={() => {
          setAllOpen((value) => !value);
          if (selected?.source === 'table') setSelected(null);
        }}>
          {allOpen ? 'Hide categories' : 'All categories'}
        </button>
        <button type="button" disabled={!rows.length || monthStatus === 'loading'} onClick={(event) => downloadComparison(data, rows, event.currentTarget.parentElement)}>
          <LuDownload aria-hidden="true" /> Download CSV
        </button>
      </div>
      {monthLimit && (
        <div className="assistant-visuals__comparison-month">
          <label>
            <span>Comparison month</span>
            <input type="month" min="0001-01" max={monthLimit} value={chosenMonth ?? earlierMonth}
              onChange={(event) => changeMonth(event.target.value)}
              onBlur={(event) => {
                const month = event.currentTarget.value;
                if (!monthPattern.test(month) || month > monthLimit) setChosenMonth(null);
              }}
              placeholder="YYYY-MM" pattern="[0-9]{4}-(0[1-9]|1[0-2])" />
          </label>
          {monthStatus === 'loading' && <p role="status">Updating comparison…</p>}
          {monthStatus && monthStatus !== 'loading' && (
            <div className="assistant-visuals__change-actions">
              <p role="alert">{monthStatus}</p>
              <button type="button" onClick={() => changeMonth(chosenMonth)}>Retry</button>
            </div>
          )}
        </div>
      )}
      <dl className="assistant-visuals__change-periods">
        {[[earlier, 'Earlier period'], [latest, 'Latest period']].map(([period, label]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd><strong>{money(period.total)}</strong><small>{displayPeriod(period)}</small></dd>
          </div>
        ))}
        <div className="assistant-visuals__change-total">
          <dt>Total difference</dt>
          <dd><strong>{signedMoney(totalDifference)}</strong></dd>
        </div>
      </dl>

      <div className="assistant-visuals__change-chart">
        <div className="assistant-visuals__change-chart-header">
          <h4>{fullChart ? 'All category changes' : overBudgetRows.length ? 'Over budget and biggest changes' : 'Biggest changes'}</h4>
          {highlights.length < rows.length && (
            <button type="button" aria-expanded={fullChart} aria-controls={chartId} onClick={() => {
              if (fullChart && selected?.source === 'chart' && !highlights.some(({ label }) => selected.label === label)) {
                setSelected(null);
              }
              setFullChart(!fullChart);
            }}>
              {fullChart ? 'Show highlights' : 'Show all on chart'}
            </button>
          )}
        </div>
        <div className="assistant-visuals__change-plot" id={chartId}>
          {plotted.length > 0 ? (
            <>
              <div className="assistant-visuals__change-axis" aria-hidden="true">
                <span>Decrease</span><span>0</span><span>Increase</span>
              </div>
              <ul role="list">
                {plotted.map((row, index) => {
                  const expanded = selected?.label === row.label && selected.source === 'chart';
                  const detailsId = `${chartId}-category-${index}`;
                  return (
                    <li key={row.label} data-direction={row.change === 0 ? undefined : row.change > 0 ? 'increase' : 'decrease'}>
                      <ChartRow className="assistant-visuals__change-row" {...(renderCategoryDetails && {
                        type: 'button',
                        'aria-expanded': expanded,
                        'aria-controls': expanded ? detailsId : undefined,
                        onClick: () => toggleCategory(row, 'chart'),
                      })}>
                        <span className="assistant-visuals__change-caption">
                          <span className="assistant-visuals__change-label">
                            <span>{row.label}</span>
                            {renderCategoryDetails && <LuChevronDown aria-hidden="true" />}
                          </span>
                          <strong>{signedMoney(row.change)} <small>{changePercent(row)}</small></strong>
                        </span>
                        <span className="assistant-visuals__change-track" aria-hidden="true">
                          <span className="assistant-visuals__change-fill" style={{ width: `${scale ? Math.abs(row.change) / scale * 50 : 0}%` }} />
                        </span>
                        {overBudgetLabels.has(row.label) && (
                          <span className="assistant-visuals__change-budget-meta">
                            {validAmount(row.overBudget.spent) && validAmount(row.overBudget.limit) && (
                              <>
                                <span>{amountFormat.format(row.overBudget.spent)} of {money(row.overBudget.limit)}</span>
                                {row.overBudget.limit > 0 && (
                                  <span>{budgetUsageFormat.format(row.overBudget.spent / row.overBudget.limit)} of limit</span>
                                )}
                              </>
                            )}
                            <span className="assistant-visuals__change-over-budget">{money(row.overBudget.amount)} over budget</span>
                          </span>
                        )}
                      </ChartRow>
                      {renderCategoryDetails && expanded && categoryDetails(row, detailsId)}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : <p>No category spending changes.</p>}
        </div>
      </div>

      <div id={tableId} ref={tableRef} hidden={!allOpen}>
        {allOpen && (
          <div className="assistant-visuals__change-table" role="region" aria-label="All category amounts and changes" tabIndex={0}>
            <table>
              <caption>All category spending in CAD</caption>
              <thead>
                <tr><th scope="col">Category</th><th scope="col">Earlier</th><th scope="col">Latest</th><th scope="col">Change</th></tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const expanded = selected?.label === row.label && selected.source === 'table';
                  const detailsId = `${tableId}-category-${index}`;
                  return (
                    <Fragment key={row.label}>
                      <tr>
                        <th scope="row">
                          {renderCategoryDetails ? (
                            <button type="button" className="assistant-visuals__change-category"
                              aria-label={`Show ${row.label} transactions`} aria-expanded={expanded}
                              aria-controls={expanded ? detailsId : undefined} onClick={() => toggleCategory(row, 'table')}>
                              <span>{row.label}</span><LuChevronDown aria-hidden="true" />
                            </button>
                          ) : row.label}
                        </th>
                        <td>{amountFormat.format(row.earlier)}</td>
                        <td>{amountFormat.format(row.latest)}</td>
                        <td>{signedMoney(row.change)} <small>{changePercent(row)}</small></td>
                      </tr>
                      {renderCategoryDetails && expanded && (
                        <tr><td className="assistant-visuals__change-details-cell" colSpan={4}>
                          {categoryDetails(row, detailsId)}
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function ReviewBar({ amount, scale, tone, hue }) {
  const width = scale > 0 ? (amount / scale) * 100 : 0;
  return (
    <span className="assistant-visuals__bar" aria-hidden="true">
      <span
        className="assistant-visuals__bar-fill"
        data-tone={tone}
        style={{ width: `${width}%`, '--assistant-visual-hue': hue }}
      />
    </span>
  );
}

function Comparison({ stats, sharedScale = 0 }) {
  const scale = Math.max(sharedScale, ...stats.filter(({ tone }) => tone).map(({ amount }) => amount));
  return (
    <dl className="assistant-visuals__comparison">
      {stats.map(({ label, amount, tone, detail }) => (
        <div key={label} className="assistant-visuals__stat" data-tone={tone}>
          <dt>{label}{detail && <small>{detail}</small>}</dt>
          <dd>
            <strong>{Number.isFinite(amount) ? money(amount) : 'No saved limit'}</strong>
            {tone && <ReviewBar amount={amount} scale={scale} tone={tone} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RankedBars({ title, rows, totalCount, rowLabel, colored, sharedScale = 0 }) {
  if (!rows.length) return null;
  const displayRows = [...rows].sort((a, b) => b.amount - a.amount).slice(0, MAX_RANKED_ROWS);
  const scale = Math.max(sharedScale, displayRows[0].amount);
  return (
    <div className="assistant-visuals__ranking">
      <h4>{title}</h4>
      <ul role="list">
        {displayRows.map(({ label, amount, detail }, index) => (
          <li key={`${label}:${index}`}>
            <div className="assistant-visuals__rank-heading">
              <div>
                <span>{label}</span>
                {detail && <small>{detail}</small>}
              </div>
              <strong>{money(amount)}</strong>
            </div>
            <ReviewBar
              amount={amount}
              scale={scale}
              tone={colored ? 'category' : 'expense'}
              hue={colored ? categoryHue(label) : undefined}
            />
          </li>
        ))}
      </ul>
      {totalCount > displayRows.length && (
        <p className="assistant-visuals__caption">Showing {displayRows.length} of {totalCount} {rowLabel}.</p>
      )}
    </div>
  );
}

function SpendingSummary({ data, totalScale, categoryScale }) {
  const { scope, startDate, endDate, transactionCount } = data;
  const categories = expenseCategories(data);
  const categoryCount = Math.max(categories.length, Number.isSafeInteger(data.categoryCount) ? data.categoryCount : 0);
  const title = scope?.type === 'expense' ? 'Expense summary' : scope?.type === 'income' ? 'Income summary' : 'Spending summary';
  const filters = [
    scope?.type === 'expense' ? 'Expenses only' : scope?.type === 'income' ? 'Income only' : null,
    scope?.account,
    scope?.category,
    validText(scope?.search) ? `Search “${scope.search}”` : null,
  ].filter(validText);

  return (
    <section className="assistant-visuals__panel" aria-label={title}>
      <header>
        <h3>{title}</h3>
        <p>
          <time dateTime={startDate}>{displayDate(startDate)}</time>
          {startDate !== endDate && <> – <time dateTime={endDate}>{displayDate(endDate)}</time></>}
          {Number.isSafeInteger(transactionCount) && <> · {transactionCount} {transactionCount === 1 ? 'transaction' : 'transactions'}</>}
        </p>
        {filters.length > 0 && <p>{filters.join(' · ')}</p>}
      </header>
      <Comparison sharedScale={totalScale} stats={spendingTotals(data)} />
      <RankedBars title="Spending by category" rows={categories} totalCount={categoryCount} rowLabel="categories" colored sharedScale={categoryScale} />
    </section>
  );
}

function BudgetReview({ data }) {
  const { month, category, spent, difference, limitMonth, transactionCount } = data;
  const title = validText(category) ? `${category} budget` : 'Budget review';
  const limit = validAmount(data.limit) ? data.limit : null;
  const showDifference = limit != null && Number.isFinite(difference);
  const limitDetail = limit != null && limitMonth !== month && monthPattern.test(limitMonth)
    ? `From ${displayMonth(limitMonth)}`
    : null;
  const categoryTotals = (Array.isArray(data.categoryTotals) ? data.categoryTotals : [])
    .filter((item) => validText(item?.label) && validAmount(item.spent))
    .map(({ label, spent: amount, limit: categoryLimit }) => ({
      label,
      amount,
      detail: validAmount(categoryLimit) ? `Limit ${money(categoryLimit)}` : null,
    }));
  const expenses = (Array.isArray(data.expenses) ? data.expenses : [])
    .filter((item) => validAmount(item?.amount) && datePattern.test(item.date))
    .map(({ description, date, amount, category: expenseCategory }) => {
      const label = validText(description) ? description : validText(expenseCategory) ? expenseCategory : 'Expense';
      const detail = [displayDate(date), expenseCategory !== category && expenseCategory !== label ? expenseCategory : null]
        .filter(validText).join(' · ');
      return { label, amount, detail };
    });
  const expenseCount = Math.max(expenses.length, Number.isSafeInteger(transactionCount) ? transactionCount : 0);

  return (
    <section className="assistant-visuals__panel" aria-label={validText(category) ? `Budget review ${category}` : 'Budget review'}>
      <header>
        <h3>{title}</h3>
        <p>
          {displayMonth(month)}
          {Number.isSafeInteger(transactionCount) && <> · {transactionCount} {transactionCount === 1 ? 'transaction' : 'transactions'}</>}
        </p>
      </header>
      <Comparison stats={[
        { label: 'Actual spending', amount: spent, tone: difference > 0 ? 'over' : 'actual' },
        { label: 'Budget limit', amount: limit, tone: limit == null ? undefined : 'limit', detail: limitDetail },
        ...(showDifference ? [{
          label: difference > 0 ? 'Over budget' : 'Budget remaining',
          amount: Math.abs(difference),
        }] : []),
      ]} />
      <RankedBars title="Spending by category" rows={categoryTotals} totalCount={categoryTotals.length} rowLabel="categories" colored />
      <RankedBars title="Largest expenses" rows={expenses} totalCount={expenseCount} rowLabel="expenses" />
    </section>
  );
}

function paymentAgenda(payments, { startDate, endDate }) {
  const byDate = new Map();
  const validPayments = payments.filter((payment) => validText(payment?.label) && validAmount(payment.amount)
    && ['income', 'expense'].includes(payment.type) && datePattern.test(payment.date)
    && payment.date >= startDate && payment.date <= endDate);
  for (const payment of validPayments) {
    const entries = byDate.get(payment.date) ?? [];
    entries.push(payment);
    byDate.set(payment.date, entries);
  }
  return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right));
}

const paymentSeries = [
  { kind: 'expense', label: 'To pay' },
  { kind: 'income', label: 'Expected income' },
];

function PaymentCoverage({ income, expenses }) {
  const incomeCents = Math.round(income * 100);
  const expenseCents = Math.round(expenses * 100);
  const balanceCents = incomeCents - expenseCents;
  const short = balanceCents < 0;
  const covered = expenseCents ? Math.min(1, incomeCents / expenseCents) : null;
  const balance = money(Math.abs(balanceCents) / 100);
  const result = short ? `${balance} short` : balanceCents > 0 ? `${balance} left over` : 'Fully covered';

  return (
    <div className="assistant-visuals__payment-coverage" data-short={short}>
      <div className="assistant-visuals__payment-coverage-heading">
        <h4>Expense coverage</h4>
        <strong>{result}</strong>
      </div>
      {covered == null ? <p>No scheduled expenses.</p> : (
        <>
          <div className="assistant-visuals__payment-coverage-track" aria-hidden="true">
            <span style={{ width: `${covered * 100}%` }} />
          </div>
          <p>{coverageFormat.format(covered)} covered by expected income</p>
        </>
      )}
    </div>
  );
}

function ProjectionPlot({ days, firstNegative, selectedDate, detailId, onSelect }) {
  const buttons = useRef(new Map());
  const [focusedDate, setFocusedDate] = useState(null);
  const instructionsId = useId();
  const balances = days.map(({ balance }) => balance);
  const min = Math.min(0, ...balances);
  const max = Math.max(0, ...balances);
  const range = max - min || 1;
  const zero = (0 - min) / range * 100;
  const firstDay = days[0].date;
  const tabDate = days.some(({ date }) => date === focusedDate)
    ? focusedDate : selectedDate ?? firstNegative?.date ?? firstDay;

  const moveFocus = (event, index) => {
    const targetIndex = {
      ArrowLeft: Math.max(0, index - 1), ArrowRight: Math.min(days.length - 1, index + 1),
      Home: 0, End: days.length - 1,
    }[event.key];
    if (!Number.isInteger(targetIndex)) return;
    event.preventDefault();
    buttons.current.get(days[targetIndex].date)?.focus();
  };

  return (
    <div className="assistant-visuals__projection-chart" style={{ '--projection-zero': `${zero}%`, '--projection-day-count': days.length }}>
      <div className="assistant-visuals__projection-axis" aria-hidden="true">
        {max > 0 && zero < 80 && <span>{amountFormat.format(max)}</span>}
        <span className="assistant-visuals__projection-axis-zero">0</span>
        {min < 0 && zero > 20 && <span>{amountFormat.format(min)}</span>}
      </div>
      <span className="assistant-visuals__payment-sr-label" id={instructionsId}>
        Use Left or Right to move between dates and Enter to inspect a day.
      </span>
      <div className="assistant-visuals__projection-scroll">
        <div className="assistant-visuals__projection-plot" role="group" aria-label="Projected closing balances by date" aria-describedby={instructionsId}>
          {days.map(({ date, balance }, index) => {
            const label = `${displayDate(date)} · ${money(balance)}`;
            return (
              <button key={date} type="button" title={label} aria-label={label} tabIndex={date === tabDate ? 0 : -1}
                ref={(button) => { if (button) buttons.current.set(date, button); else buttons.current.delete(date); }}
                aria-expanded={selectedDate === date} aria-controls={selectedDate === date ? detailId : undefined}
                data-negative={balance < 0} data-first={date === firstNegative?.date}
                onFocus={() => setFocusedDate(date)} onKeyDown={(event) => moveFocus(event, index)} onClick={() => onSelect(date)}>
                <span aria-hidden="true" style={{ bottom: `${(Math.min(0, balance) - min) / range * 100}%`, height: `${Math.abs(balance) / range * 100}%` }} />
              </button>
            );
          })}
        </div>
        <div className="assistant-visuals__projection-dates" aria-hidden="true">
          {days.map(({ date }) => {
            const label = displayDate(date);
            return (
              <div key={date} className="assistant-visuals__projection-tick">
                <time dateTime={date} title={label}>{label.slice(0, 5)}</time>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProjectionShortfall({ day, opening }) {
  const { balance, income, expenses, movements } = day;
  if (balance >= 0 || !Number.isFinite(income) || !Number.isFinite(expenses) || !movements?.length) return null;
  const availableCents = Math.round(opening * 100) + Math.round(income * 100);
  if (availableCents - Math.round(expenses * 100) !== Math.round(balance * 100)) return null;
  const available = availableCents / 100;
  const short = <strong>{money(-balance)} short</strong>;
  const largest = movements.reduce((highest, item) =>
    item.type === 'expense' && item.amount > (highest?.amount ?? 0) ? item : highest, null);
  const singleExpense = available >= 0 && expenses > 0 && largest?.amount > available ? largest : null;

  return (
    <div className="assistant-visuals__projection-explanation">
      <strong>Why the balance is negative</strong>
      {singleExpense ? (
        <p><strong>{singleExpense.label}</strong> ({money(singleExpense.amount)}) alone exceeds the day’s available {money(available)}.
          {' '}With {money(expenses)} in expenses, the day ends {short}.</p>
      ) : available >= 0 && expenses > 0 ? (
        <p>Expenses of <strong>{money(expenses)}</strong> exceeded the day’s available {money(available)}. The day ends {short}.</p>
      ) : (
        <p>Opening balance plus income was {money(-available)} below zero.
          {' '}{expenses > 0 && <>Expenses added {money(expenses)} to the shortfall. </>}The day ends {short}.</p>
      )}
    </div>
  );
}

function ProjectionDayDetails({ day, opening, id, panelRef, loading, failure, onRetry }) {
  const { date, balance, omittedMovements } = day;
  const movements = Array.isArray(day.movements) ? day.movements : null;
  const heading = `Movements on ${displayDate(date)}`;

  return (
    <section className="assistant-visuals__projection-day" id={id} aria-label={heading} ref={panelRef}>
      <h4>Movements on <time dateTime={date}>{displayDate(date)}</time></h4>
      <dl className="assistant-visuals__projection-totals">
        <div data-negative={opening < 0}><dt>Opening balance</dt><dd>{money(opening)}</dd></div>
        <div data-negative={balance < 0}><dt>Closing balance</dt><dd>{money(balance)}</dd></div>
        {Number.isFinite(day.income) && <div><dt>Income</dt><dd>{money(day.income)}</dd></div>}
        {Number.isFinite(day.expenses) && <div><dt>Expenses</dt><dd>{money(day.expenses)}</dd></div>}
      </dl>
      <ProjectionShortfall day={day} opening={opening} />
      {movements == null ? (
        <div className="assistant-visuals__projection-refresh">
          {loading ? <p className="assistant-visuals__caption" role="status">Loading day movements…</p>
            : failure ? (
              <>
                <p className="assistant-visuals__caption" role="alert">{failure}</p>
                <div className="assistant-visuals__change-actions"><button type="button" onClick={onRetry}>Retry movements</button></div>
              </>
            ) : <p className="assistant-visuals__caption">Run a new forecast to get the movement breakdown for this day.</p>}
        </div>
      )
        : movements.length > 0 ? (
          <ul role="list" className="assistant-visuals__projection-movements">
            {movements.map(({ id: movementId, label, type, source, amount }) => {
              const delta = type === 'expense' ? -amount : amount;
              return (
                <li key={movementId}>
                  <div>
                    <span>{label}</span>
                    <small>{source === 'scheduled' ? 'Scheduled' : 'Recorded'} {type}</small>
                  </div>
                  <strong data-negative={delta < 0}>{signedMoney(delta)}</strong>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="assistant-visuals__caption">
            No movements on this day. {opening < 0 && 'The shortfall carries over from the opening balance.'}
          </p>
        )}
      {omittedMovements > 0 && movements != null && (
        <p className="assistant-visuals__caption">Showing {movements.length} of {movements.length + omittedMovements} movements.</p>
      )}
    </section>
  );
}

function PaymentProjection({ data, onRefreshUpcomingPayments }) {
  const { projection } = data;
  const [enteredBalance, setEnteredBalance] = useState(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [retry, setRetry] = useState(0);
  const [refreshError, setRefreshError] = useState(null);
  const dayDetailsId = useId();
  const dayDetailsRef = useRef(null);
  const refresh = useRef(onRefreshUpcomingPayments);
  const canRefresh = Boolean(onRefreshUpcomingPayments);
  const originalDay = Array.isArray(projection?.days) ? projection.days.find((day) => day?.date === selectedDate) : null;
  const needsMovements = originalDay != null && !Array.isArray(originalDay.movements);

  useLayoutEffect(() => { if (selectedDate) dayDetailsRef.current?.scrollIntoView({ block: 'nearest' }); }, [selectedDate]);
  useEffect(() => { refresh.current = onRefreshUpcomingPayments; }, [onRefreshUpcomingPayments]);
  useEffect(() => {
    if (!needsMovements || !canRefresh) return;
    setRefreshError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 18_000);
    let obsolete = false;
    const load = async () => {
      try {
        await refresh.current(data, controller.signal);
      } catch (error) {
        if (!obsolete) setRefreshError(controller.signal.aborted ? 'Loading day movements took too long.'
          : error instanceof Error && error.message ? error.message : 'Couldn’t load day movements.');
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void load();
    return () => {
      obsolete = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [data, canRefresh, needsMovements, retry]);

  const startingCents = enteredBalance ?? 0;
  const view = projectionAtOpening(projection, startingCents);
  if (!view) return null;
  const { days, firstNegative, lowest, topUpCents, topUpDate } = view;
  const forecastEnd = days.at(-1).date;
  const selectedIndex = days.findIndex(({ date }) => date === selectedDate);
  const selectDay = (date) => setSelectedDate((previous) => previous === date ? null : date);

  const changeBalance = (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem('balance');
    const cents = Math.round(input.valueAsNumber * 100);
    if (!Number.isSafeInteger(cents)) return;
    setEnteredBalance(cents === 0 ? null : cents);
    setEditingBalance(false);
  };

  return (
    <section className="assistant-visuals__payment-projection" aria-label="Projected balance">
      <div className="assistant-visuals__payment-coverage-heading">
        <h4>Projected balance</h4>
        <small>{enteredBalance != null && 'Entered balance · '}Closing balances</small>
      </div>
      <div className="assistant-visuals__projection-top-up" data-needed={topUpCents > 0} aria-live="polite">
        <div className="assistant-visuals__payment-coverage-heading">
          <h4>One-time top-up</h4>
          <strong>{topUpDate ? (
            <>{money(topUpCents / 100)} by <time dateTime={topUpDate}>{displayDate(topUpDate)}</time></>
          ) : 'No top-up needed'}</strong>
        </div>
        {topUpDate && <p>To keep the starting and daily closing balances at or above zero through <time dateTime={forecastEnd}>{displayDate(forecastEnd)}</time>.</p>}
      </div>
      <dl className="assistant-visuals__projection-totals">
        <div>
          <dt>Starting balance</dt>
          <dd>{money(startingCents / 100)}</dd>
        </div>
        <div data-negative={Boolean(firstNegative)}>
          <dt>{firstNegative ? 'First projected shortfall' : 'Daily outlook'}</dt>
          <dd>{firstNegative ? (
            <button type="button" className="assistant-visuals__projection-date-button" onClick={() => selectDay(firstNegative.date)}
              aria-expanded={firstNegative.date === selectedDate} aria-controls={firstNegative.date === selectedDate ? dayDetailsId : undefined}>
              {money(-firstNegative.balance)} short on <time dateTime={firstNegative.date}>{displayDate(firstNegative.date)}</time>
            </button>
          ) : 'Stays at or above zero'}</dd>
        </div>
      </dl>
      {editingBalance ? (
        <form className="assistant-visuals__projection-balance-form" onSubmit={changeBalance}>
          <label>
            <span>Balance in CAD</span>
            <input type="number" name="balance" step="0.01" required inputMode="decimal"
              defaultValue={(startingCents / 100).toFixed(2)} />
          </label>
          <div className="assistant-visuals__change-actions">
            <button type="submit">Use balance</button>
            <button type="button" onClick={() => setEditingBalance(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="assistant-visuals__change-actions">
          <button type="button" onClick={() => setEditingBalance(true)}>Edit balance</button>
          {enteredBalance != null && <button type="button" onClick={() => setEnteredBalance(null)}>Reset to zero</button>}
        </div>
      )}
      {firstNegative && lowest.balance < firstNegative.balance && (
        <p className="assistant-visuals__projection-lowest">
          Lowest balance <strong>{money(lowest.balance)}</strong> on <time dateTime={lowest.date}>{displayDate(lowest.date)}</time>
        </p>
      )}
      <ProjectionPlot days={days} firstNegative={firstNegative} selectedDate={selectedIndex >= 0 ? selectedDate : null}
        detailId={dayDetailsId} onSelect={selectDay} />
      <label className="assistant-visuals__projection-day-select">
        <span>Inspect a day</span>
        <select value={selectedIndex >= 0 ? selectedDate : ''} onChange={(event) => setSelectedDate(event.target.value || null)}>
          <option value="">Pick a date</option>
          {days.map(({ date, balance }) => <option key={date} value={date}>{displayDate(date)} · {money(balance)}</option>)}
        </select>
      </label>
      {selectedIndex >= 0 && <ProjectionDayDetails id={dayDetailsId} panelRef={dayDetailsRef} day={days[selectedIndex]}
        opening={days[selectedIndex - 1]?.balance ?? startingCents / 100}
        loading={needsMovements && canRefresh && !refreshError} failure={needsMovements && canRefresh ? refreshError : null}
        onRetry={() => setRetry((previous) => previous + 1)} />}
      <details>
        <summary>Daily balances</summary>
        <div className="assistant-visuals__projection-table" tabIndex={0} role="region" aria-label="Daily closing balances">
          <table>
            <caption>Projected closing balances in CAD</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Income</th><th scope="col">Expenses</th><th scope="col">Balance</th></tr></thead>
            <tbody>
              {days.map(({ date, balance, income, expenses }) => (
                <tr key={date} data-negative={balance < 0}>
                  <th scope="row">
                    <button type="button" className="assistant-visuals__projection-date-button" onClick={() => selectDay(date)}
                      aria-expanded={date === selectedDate} aria-controls={date === selectedDate ? dayDetailsId : undefined}>
                      <time dateTime={date}>{displayDate(date)}</time>
                    </button>
                  </th>
                  <td>{validAmount(income) ? amountFormat.format(income) : '—'}</td>
                  <td>{validAmount(expenses) ? amountFormat.format(expenses) : '—'}</td>
                  <td>{amountFormat.format(balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function PaymentChart({ weeks, series }) {
  const scale = Math.max(0, ...weeks.flatMap((week) => series.map(({ kind }) => week[kind])));
  return (
    <div className="assistant-visuals__payment-chart">
      <div className="assistant-visuals__payment-chart-heading">
        <h4>By week</h4>
        <div className="assistant-visuals__payment-key" aria-hidden="true">
          {series.map(({ kind, label }) => <span key={kind} data-kind={kind}>{label}</span>)}
        </div>
      </div>
      <ul role="list" aria-label="Scheduled amounts by week in CAD">
        {weeks.map((week) => {
          const [first, last] = [week.startDate, week.endDate].map((date) => displayDate(date).slice(0, 5));
          return (
            <li key={week.startDate} className="assistant-visuals__payment-week">
              <span>{first}{first === last ? '' : `–${last}`}</span>
              <div>
                {series.map(({ kind, label }) => (
                  <div key={kind} className="assistant-visuals__payment-lane">
                    <ReviewBar amount={week[kind]} scale={scale} tone={kind === 'expense' ? 'expense' : 'actual'} />
                    <span><span className="assistant-visuals__payment-sr-label">{label} </span>{amountFormat.format(week[kind])}</span>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PaymentSchedule({ agenda }) {
  return (
    <ul className="assistant-visuals__payment-schedule" role="list">
      {agenda.map(([date, payments]) => (
        <li key={date}>
          <time dateTime={date}>{displayDate(date)}</time>
          <ul role="list">
            {payments.map(({ id, label, amount, type }, index) => (
              <li key={`${id ?? label}:${index}`}>
                <span>{label}</span>
                <strong data-kind={type}>{type === 'income' ? '+' : '−'}{money(amount)}</strong>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function UpcomingPayments({ data, onRefreshUpcomingPayments }) {
  const { payments, income, expenses, omittedPayments, type } = data;
  const title = type === 'income' ? 'Upcoming income' : type === 'expense' ? 'Upcoming expenses' : 'Upcoming payments';
  const series = paymentSeries.filter(({ kind }) => type == null || type === kind);
  const weeks = (Array.isArray(data.weeks) ? data.weeks : []).filter((week) => datePattern.test(week?.startDate)
    && datePattern.test(week.endDate) && validAmount(week.expense) && validAmount(week.income));
  const agenda = paymentAgenda(payments, data);
  const paymentCount = agenda.reduce((count, [, entries]) => count + entries.length, 0);

  return (
    <section className="assistant-visuals__panel" aria-label={title}>
      <header>
        <h3>{title}</h3>
        <p>{displayPeriod(data)}</p>
      </header>
      {type == null && <PaymentProjection data={data} onRefreshUpcomingPayments={onRefreshUpcomingPayments} />}
      {paymentCount > 0 ? (
        <>
          <dl className="assistant-visuals__payment-totals">
            {series.map(({ kind, label }) => (
              <div key={kind} data-kind={kind}><dt>{label}</dt><dd>{money(kind === 'expense' ? expenses : income)}</dd></div>
            ))}
          </dl>
          {type == null && <PaymentCoverage income={income} expenses={expenses} />}
          {weeks.length > 0 && <PaymentChart weeks={weeks} series={series} />}
          <div className="assistant-visuals__payment-agenda">
            <h4>Payment schedule</h4>
            <PaymentSchedule agenda={agenda.slice(0, 4)} />
            {agenda.length > 4 && (
              <details>
                <summary>Show full schedule</summary>
                <PaymentSchedule agenda={agenda.slice(4)} />
              </details>
            )}
            {omittedPayments > 0 && <p className="assistant-visuals__caption">Schedule shows the first {paymentCount} of {paymentCount + omittedPayments} payments.</p>}
          </div>
        </>
      ) : <p className="assistant-visuals__caption">{EMPTY_UPCOMING_PAYMENTS_MESSAGE}</p>}
    </section>
  );
}

function RelatedRecurringCharges({ row, russian }) {
  const charges = row.relatedCharges.filter((charge) => validText(charge?.description) && datePattern.test(charge.date) && validAmount(charge.amount));
  if (!charges.length) return null;
  return (
    <div className="assistant-visuals__related-charges">
      <h4>{russian ? 'Другие списания у этого продавца' : 'Other charges from this merchant'}</h4>
      <ul role="list">
        {charges.map((charge, index) => {
          const days = (Date.parse(charge.date) - Date.parse(row.expectedDate)) / DAY_MS;
          return (
            <li key={index}>
              <span>{charge.description}</span>
              <div>
                <time dateTime={charge.date}>{displayDate(charge.date)}</time>
                {Number.isInteger(days) && days !== 0 && (
                  <small>{russian
                    ? `${Math.abs(days)} дн. ${days > 0 ? 'после' : 'до'} плановой даты`
                    : `${Math.abs(days)}d ${days > 0 ? 'after' : 'before'} the scheduled date`}</small>
                )}
              </div>
              <strong>{money(charge.amount)}</strong>
            </li>
          );
        })}
      </ul>
      {Number.isSafeInteger(row.relatedChargeCount) && row.relatedChargeCount > charges.length && (
        <small>{russian ? `Показано ${charges.length} из ${row.relatedChargeCount} дополнительных списаний.` : `Showing ${charges.length} of ${row.relatedChargeCount} additional charges.`}</small>
      )}
      {validAmount(row.totalPostedAmount) && Number.isFinite(row.differenceFromPlan) && (
        <dl>
          <div><dt>{russian ? 'Всего по списаниям' : 'Total charged'}</dt><dd>{money(row.totalPostedAmount)}</dd></div>
          <div><dt>{russian ? 'Разница с планом' : 'Difference from plan'}</dt><dd>{signedMoney(row.differenceFromPlan)}</dd></div>
        </dl>
      )}
      <small>{russian ? 'Назначение дополнительного списания стоит проверить по счёту продавца.' : 'Check the merchant invoice for the reason for the extra charge.'}</small>
    </div>
  );
}

function RecurringCategoryTransactions({ data, russian, onOpenTransactions }) {
  const items = data.transactions.filter((item) => datePattern.test(item?.date) && validAmount(item.amount));
  const count = Number.isSafeInteger(data.transactionCount) ? data.transactionCount : items.length;
  const link = validText(data.categoryId) && data.endDate >= data.startDate
    ? transactionCategoryUrl(data.categoryId, data.startDate, data.endDate) : null;
  return (
    <details className="assistant-visuals__audit-ledger">
      <summary>{russian ? 'Все операции категории' : 'All category transactions'} ({count})</summary>
      <div>
        {validAmount(data.transactionTotal) && (
          <p>{russian ? 'Расходы за период' : 'Recorded expenses'} <strong>{money(data.transactionTotal)}</strong></p>
        )}
        {items.length > 0 && (
          <ul role="list">
            {items.map((item, index) => (
              <li key={item.id ?? index}>
                <span>{item.description || (russian ? 'Без описания' : 'No description')}</span>
                <strong>{money(item.amount)}</strong>
                <small><time dateTime={item.date}>{displayDate(item.date)}</time>{item.generated && (russian ? ' · Автозапись Recurring' : ' · Recurring calendar entry')}</small>
              </li>
            ))}
          </ul>
        )}
        {count > items.length && <small>{russian ? `Показано ${items.length} из ${count} операций.` : `Showing ${items.length} of ${count} transactions.`}</small>}
        {link && <Link to={link} onClick={onOpenTransactions}>{russian ? 'Открыть в Transactions' : 'Open in Transactions'}</Link>}
      </div>
    </details>
  );
}

function CompanyChargeReview({ row, russian, onReview }) {
  const candidates = (row.companyCandidates ?? []).filter((item) => validText(item?.scheduleId) && validText(item.name));
  const confirmed = candidates.find((item) => item.scheduleId === row.reviewDecision);
  const separate = row.reviewDecision === null;
  const answered = Boolean(confirmed) || separate;
  const single = candidates.length === 1;
  const question = single
    ? (russian ? `Это списание ${row.company} относится к подписке ${candidates[0].name}?` : `Is this ${row.company} charge for ${candidates[0].name}?`)
    : (russian ? `К какой подписке относится это списание ${row.company}?` : `Which subscription is this ${row.company} charge for?`);
  return (
    <div className="assistant-visuals__company-review">
      <div className="assistant-visuals__recurring-row-heading">
        <strong>{row.description || row.name}</strong>
        {validAmount(row.actualAmount) && <b>{money(row.actualAmount)}</b>}
      </div>
      {datePattern.test(row.actualDate) && <time dateTime={row.actualDate}>{displayDate(row.actualDate)}</time>}
      {answered ? (
        <>
          <p role="status">{confirmed
            ? (russian ? `Вы связали это списание с ${confirmed.name}.` : `You linked this charge to ${confirmed.name}.`)
            : (russian ? 'Вы отметили это списание как отдельное.' : 'You marked this as a separate charge.')}</p>
          <div className="assistant-visuals__change-actions">
            <button type="button" disabled={!onReview} onClick={() => onReview(row, undefined)}>{russian ? 'Изменить ответ' : 'Change answer'}</button>
          </div>
        </>
      ) : candidates.length > 0 && (
        <fieldset>
          <legend>{question}</legend>
          {candidates.map((candidate) => (
            <div key={candidate.scheduleId} className="assistant-visuals__company-option">
              {!single && <strong>{candidate.name}</strong>}
              <dl className="assistant-visuals__recurring-dates">
                <div>
                  <dt>{russian ? 'По расписанию' : 'Scheduled payment'}</dt>
                  <dd>
                    {datePattern.test(candidate.expectedDate) && <time dateTime={candidate.expectedDate}>{displayDate(candidate.expectedDate)}</time>}
                    {validAmount(candidate.expectedAmount) && <small>{money(candidate.expectedAmount)}</small>}
                  </dd>
                </div>
                {datePattern.test(candidate.actualDate) && (
                  <div>
                    <dt>{russian ? 'Уже сопоставлено' : 'Already matched'}</dt>
                    <dd>
                      <time dateTime={candidate.actualDate}>{displayDate(candidate.actualDate)}</time>
                      {validAmount(candidate.actualAmount) && <small>{money(candidate.actualAmount)}</small>}
                      {validText(candidate.description) && <small>{candidate.description}</small>}
                    </dd>
                  </div>
                )}
              </dl>
              {!single && (
                <div className="assistant-visuals__change-actions">
                  <button type="button" disabled={!onReview} onClick={() => onReview(row, candidate.scheduleId)}>
                    {russian ? `Связать с ${candidate.name}` : `Link to ${candidate.name}`}
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="assistant-visuals__change-actions">
            {single && <button type="button" disabled={!onReview} onClick={() => onReview(row, candidates[0].scheduleId)}>
              {russian ? 'Да, относится' : 'Yes, link charge'}
            </button>}
            <button type="button" disabled={!onReview} onClick={() => onReview(row, null)}>
              {russian ? 'Нет, отдельное списание' : 'Separate charge'}
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}

function RecurringDateAudit({ data, onOpenTransactions, onReviewCompanyCharge, onPrepareRecurring, busy }) {
  const russian = data.language === 'ru';
  const title = russian ? 'Сверка дат Recurring' : 'Recurring date check';
  const statuses = russian ? {
    generated_only: 'Только автозапись', activity_unknown: 'Период активности неизвестен',
    on_schedule: 'Дата совпала', early: 'Раньше', late: 'Позже', missing: 'Списание не найдено',
    unmatched: 'Запись в Recurring не найдена', ambiguous: 'Нужна ручная проверка', possible: 'Возможное совпадение',
    amount_mismatch: 'Возможная пара · сумма отличается', company_candidate: 'Та же компания',
  } : {
    generated_only: 'Calendar entry only', activity_unknown: 'Active dates unknown',
    on_schedule: 'Date matches', early: 'Early', late: 'Late', missing: 'No posting found',
    unmatched: 'No matching Recurring entry', ambiguous: 'Needs review', possible: 'Possible match',
    amount_mismatch: 'Possible match · amount differs', company_candidate: 'Same company',
  };
  const rows = data.rows.filter((row) => validText(row?.name) && Object.hasOwn(statuses, row.status));
  const count = (status) => Number.isSafeInteger(data.counts?.[status]) ? data.counts[status] : rows.filter((row) => row.status === status).length;
  const totals = [
    [russian ? 'Совпали' : 'Dates match', count('on_schedule')],
    [russian ? 'Разные даты' : 'Different dates', count('early') + count('late')],
    [russian ? 'Без точной пары' : 'Unresolved', count('missing') + count('unmatched') + count('ambiguous') + count('possible') + count('generated_only') + count('activity_unknown') + count('amount_mismatch')],
  ];
  const reviewed = rows.filter((row) => row.status === 'company_candidate' && row.reviewDecision !== undefined).length;
  if (count('company_candidate')) totals.push([russian ? 'Уточнить подписку' : 'To identify', Math.max(0, count('company_candidate') - reviewed)]);
  if (data.relatedChargeCount > 0) totals.push([russian ? 'Доп. списания' : 'Extra charges', data.relatedChargeCount]);
  const priority = (row) => {
    if (row.status === 'company_candidate') return -1;
    if (row.relatedCharges?.length || row.status === 'amount_mismatch') return 0;
    return row.status === 'on_schedule' ? 2 : 1;
  };
  const ordered = [...rows].sort((a, b) => priority(a) - priority(b));

  return (
    <section className="assistant-visuals__panel" aria-label={title}>
      <header>
        <h3>{title}</h3>
        <p>{data.category} · {data.endDate >= data.startDate ? displayPeriod(data) : data.month}</p>
      </header>
      <dl className="assistant-visuals__recurring-counts" data-has-extra={totals.length > 3 || undefined}>
        {totals.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {onPrepareRecurring && (count('unmatched') > 0 || count('early') + count('late') > 0) && (
        <div className="assistant-visuals__change-actions">
          {count('unmatched') > 0 && <button type="button" disabled={busy} onClick={() => onPrepareRecurring(russian
            ? 'Создай ежемесячные расписания в Recurring для списаний без пары из этой сверки.'
            : 'Create monthly Recurring schedules for the unmatched charges in this audit.')}>
            {russian ? 'Добавить расписания' : 'Add missing schedules'}
          </button>}
          {count('early') + count('late') > 0 && <button type="button" disabled={busy} onClick={() => onPrepareRecurring(russian
            ? 'Исправь даты в Recurring по сопоставленным списаниям с расхождением дат.'
            : 'Update the Recurring dates to match the posted dates for the matched charges in this audit.')}>
            {russian ? 'Исправить даты' : 'Correct schedule dates'}
          </button>}
        </div>
      )}
      {Array.isArray(data.transactions) && <RecurringCategoryTransactions data={data} russian={russian} onOpenTransactions={onOpenTransactions} />}
      {ordered.length > 0 ? (
        <ol className="assistant-visuals__recurring-rows" tabIndex={0} aria-label={russian ? 'Операции и расписание' : 'Transactions and schedule'}>
          {ordered.map((row, index) => row.status === 'company_candidate' ? (
            <li key={row.id ?? index}><CompanyChargeReview row={row} russian={russian} onReview={onReviewCompanyCharge} /></li>
          ) : (
            <li key={row.id ?? index}>
              <div className="assistant-visuals__recurring-row-heading">
                <strong>{row.name}</strong>
                <small data-status={row.status}>
                  {statuses[row.status]}
                  {Number.isInteger(row.differenceDays) && row.differenceDays !== 0 && (
                    <> · {Math.abs(row.differenceDays)} {russian ? 'дн.' : 'd'}</>
                  )}
                </small>
              </div>
              <dl className="assistant-visuals__recurring-dates">
                {[[russian ? 'По календарю Recurring' : 'On the Recurring calendar', row.expectedDate, row.expectedAmount, null],
                  [russian ? 'В транзакциях' : 'In transactions', row.actualDate, row.actualAmount, row.expectedDate && row.description]].map(([label, date, amount, description]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>
                        {datePattern.test(date) ? <time dateTime={date}>{displayDate(date)}</time> : '—'}
                        {validAmount(amount) && <small>{money(amount)}</small>}
                        {validText(description) && <small>{description}</small>}
                      </dd>
                    </div>
                ))}
              </dl>
              {row.lastBusinessDayOfMonth ? <small>{russian ? 'Последний рабочий день месяца' : 'Last business day of the month'}</small>
                : row.businessDaysOnly && <small>{russian ? 'Перенос на рабочий день включён' : 'Business-day adjustment enabled'}</small>}
              {Array.isArray(row.relatedCharges) && <RelatedRecurringCharges row={row} russian={russian} />}
              {row.status === 'amount_mismatch' && (
                <small>{russian ? 'Описание похоже, но сумма отличается от плановой. Проверьте по счёту продавца, относится ли списание к этой подписке.' : 'The description matches, but the amount differs from the plan. Check the merchant invoice to confirm this subscription.'}</small>
              )}
              {row.status !== 'amount_mismatch' && row.matchSource === 'merchant_name' && row.expectedAmount !== row.actualAmount && (
                <small>{russian ? 'Сопоставлено по названию подписки и близкой сумме' : 'Matched by subscription name and a similar amount'}</small>
              )}
              {row.matchSource === 'bank_statement' && <small>{russian ? 'Дата списания подтверждена импортированной выпиской.' : 'Posting date confirmed by the imported statement.'}</small>}
              {row.status === 'generated_only' && <small>{russian ? 'Автозапись из календаря. Дата списания по выписке не подтверждена.' : 'Created from the calendar. The statement posting date is unconfirmed.'}</small>}
              {row.status === 'activity_unknown' && <small>{russian ? 'Расписание сейчас на паузе. Дата начала паузы неизвестна.' : 'This schedule is paused. Its pause start date is unknown.'}</small>}
              {row.status === 'possible' && (
                <small>{russian ? 'Совпадают поставщик и сумма. Проверь подписку в выписке.' : 'Merchant and amount align. Confirm the subscription on your statement.'}</small>
              )}
            </li>
          ))}
        </ol>
      ) : <p className="assistant-visuals__caption">{russian ? 'За этот период нет операций для сверки.' : 'No records to check for this period.'}</p>}
      {Number.isSafeInteger(data.omittedRows) && data.omittedRows > 0 && (
        <p className="assistant-visuals__caption">{russian ? `Показано ${rows.length} из ${data.rowCount} строк.` : `Showing ${rows.length} of ${data.rowCount} rows.`}</p>
      )}
    </section>
  );
}

export default function AssistantReplyVisuals({ visuals, renderCategoryDetails, onComparePeriods, onRefreshUpcomingPayments, onOpenTransactions, onReviewCompanyCharge, onPrepareRecurring, busy }) {
  const records = validAssistantReplyVisuals(visuals);
  if (!records.length) return null;
  const summaries = records.filter(({ kind }) => kind === 'spending-summary');
  const totalScale = Math.max(0, ...summaries.flatMap((summary) =>
    spendingTotals(summary).filter(({ tone }) => tone).map(({ amount }) => amount)));
  const categoryScale = Math.max(0, ...summaries.flatMap((summary) =>
    expenseCategories(summary).map(({ amount }) => amount)));

  return (
    <div className="assistant-visuals">
      {records.map((data, index) => data.kind === 'spending-summary'
        ? <SpendingSummary key={index} data={data} totalScale={totalScale} categoryScale={categoryScale} />
        : data.kind === 'budget-review'
          ? <BudgetReview key={index} data={data} />
          : data.kind === 'upcoming-payments'
            ? <UpcomingPayments key={index} data={data} onRefreshUpcomingPayments={onRefreshUpcomingPayments} />
            : data.kind === 'recurring-date-audit'
              ? <RecurringDateAudit key={index} data={data} onOpenTransactions={onOpenTransactions} onReviewCompanyCharge={onReviewCompanyCharge}
                onPrepareRecurring={onPrepareRecurring} busy={busy} />
              : <CategoryComparison key={index} data={data} renderCategoryDetails={renderCategoryDetails} onComparePeriods={onComparePeriods} />
      )}
    </div>
  );
}
