import { useEffect, useState } from 'react';
import '../styles/assistant-category-details.css';

const moneyFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthFormat = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const money = (amount) => `${moneyFormat.format(amount)}\u00a0CAD`;

function displayDate(date) {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}

function displayPeriod({ startDate, endDate }) {
  return startDate === endDate ? displayDate(startDate) : `${displayDate(startDate)} – ${displayDate(endDate)}`;
}

function displayMonth(month) {
  return monthFormat.format(new Date(`${month}-01T00:00:00Z`));
}

function BudgetPosition({ budget }) {
  const month = displayMonth(budget.month);
  const { limit, spentThroughPeriodEnd, overThroughPeriodEnd: over, crossing } = budget;
  if (limit == null) return <p className="assistant-category__no-budget">No budget limit for {month}.</p>;

  return (
    <div className="assistant-category__budget" data-over={over > 0}>
      <div className="assistant-category__budget-heading">
        <strong>{month} budget</strong>
        {over > 0 && <span className="assistant-category__flag">{money(over)} over budget</span>}
      </div>
      <p>{money(spentThroughPeriodEnd)} spent of {money(limit)}</p>
      {budget.limitMonth && budget.limitMonth !== budget.month && (
        <p>Limit carried forward from {displayMonth(budget.limitMonth)}.</p>
      )}
      {crossing && !crossing.inSelection && (
        <p>
          Crossed the limit outside these results on {displayDate(crossing.date)} with {crossing.description || 'an expense'}
          {' '}({money(crossing.amount)}).
        </p>
      )}
    </div>
  );
}

function TransactionRow({ transaction }) {
  const { date, amount, description, budgetImpact, overAmount } = transaction;
  return (
    <li className="assistant-category__transaction" data-impact={budgetImpact ?? undefined}>
      <div className="assistant-category__transaction-heading">
        <span>{description || 'Expense'}</span>
        <strong>{money(amount)}</strong>
      </div>
      <div className="assistant-category__transaction-meta">
        <time dateTime={date}>{displayDate(date)}</time>
        {budgetImpact === 'crossing' && <span className="assistant-category__flag">Crossed limit</span>}
        {budgetImpact === 'after_limit' && <span className="assistant-category__flag">After limit</span>}
      </div>
      {budgetImpact === 'crossing' && overAmount != null && (
        <small>{money(overAmount)} of this expense exceeded the limit.</small>
      )}
    </li>
  );
}

function PeriodDetails({ label, period, scope, accessToken, dataVersion }) {
  const { startDate, endDate } = period;
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!accessToken) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 18_000);
    const request = { accessToken, dataVersion, retry };
    let obsolete = false;

    (async () => {
      try {
        const response = await fetch('/.netlify/functions/budget-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            mode: 'category_drilldown',
            category: label,
            startDate,
            endDate,
            scope,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.currency !== 'CAD' || data.startDate !== startDate || data.endDate !== endDate
          || !Array.isArray(data.transactions) || !Array.isArray(data.budgets)) {
          throw new Error(data?.error || 'Couldn’t load category transactions.');
        }
        if (!obsolete) setResult({ ...request, data });
      } catch (error) {
        if (!obsolete) setResult({ ...request, error: controller.signal.aborted ? 'The transactions took too long to load.' : error.message });
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      obsolete = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [accessToken, dataVersion, retry, label, startDate, endDate, scope]);

  if (!accessToken) return <p className="assistant-category__status">Sign in to see transactions.</p>;
  const current = result?.accessToken === accessToken && result.dataVersion === dataVersion && result.retry === retry ? result : null;
  if (!current) return <p className="assistant-category__status" role="status">Loading transactions…</p>;
  if (current.error) return (
    <div className="assistant-category__failure">
      <p className="assistant-category__status" role="alert">{current.error}</p>
      <button type="button" onClick={() => setRetry(retry + 1)}>Retry</button>
    </div>
  );

  const { total, transactionCount, transactions, budgets, omittedTransactions } = current.data;
  return (
    <>
      <div className="assistant-category__total">
        <span>{transactionCount} {transactionCount === 1 ? 'transaction' : 'transactions'}</span>
        <strong>{money(total)}</strong>
      </div>
      {budgets.map((budget) => <BudgetPosition key={budget.month} budget={budget} />)}
      {Boolean(budgets.some(({ limit }) => limit != null) && (scope?.account || scope?.search)) && (
        <p className="assistant-category__status">Budget totals include all expenses for this category.</p>
      )}
      {transactions.length > 0 ? (
        <ul className="assistant-category__transactions" aria-label="Recorded expenses">
          {transactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)}
        </ul>
      ) : <p className="assistant-category__status">No recorded expenses in this period.</p>}
      {omittedTransactions > 0 && (
        <p className="assistant-category__status">Showing {transactions.length} of {transactionCount} transactions.</p>
      )}
    </>
  );
}

export default function AssistantCategoryDetails({ label, earlier, latest, scope, accessToken, dataVersion }) {
  const [showEarlier, setShowEarlier] = useState(false);
  const period = showEarlier ? earlier : latest;

  return (
    <section className="assistant-category" aria-label={`${label} transactions`}>
      <h4>{label} transactions</h4>
      <div className="assistant-category__periods" role="group" aria-label="Transaction period">
        <button type="button" aria-pressed={showEarlier} onClick={() => setShowEarlier(true)}>{displayPeriod(earlier)}</button>
        <button type="button" aria-pressed={!showEarlier} onClick={() => setShowEarlier(false)}>{displayPeriod(latest)}</button>
      </div>
      <PeriodDetails key={`${period.startDate}:${period.endDate}`} label={label} period={period} scope={scope}
        accessToken={accessToken} dataVersion={dataVersion} />
    </section>
  );
}
