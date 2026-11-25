// What had been spent by the end of each day of the period (or each month of a long one),
// as steps that stop at today. A day can be picked to see only its transactions.
// Takes the result of timeline.
//
// The steps are an SVG stretched to the plot, one unit wide per day. The columns that are
// pressed, the mark for today and the figures are ordinary elements laid over it.
export default function SpendChart({ line, picked, onPick, formatMoney }) {
  const { buckets, unit, total } = line;
  const count = buckets.length;
  const reached = buckets.filter(({ future }) => !future);
  const y = (value) => 100 - (total > 0 ? (value / total) * 100 : 0);
  const steps = reached.map((bucket, index) => `L${index} ${y(bucket.spentSoFar).toFixed(2)} L${index + 1} ${y(bucket.spentSoFar).toFixed(2)}`).join(' ');
  const outline = `M0 100 ${steps}`;
  const area = `${outline} L${reached.length} 100 Z`;
  const todayIndex = buckets.findIndex((bucket) => bucket.today);
  const chosen = buckets.find(({ key }) => key === picked);
  const last = reached.at(-1);
  // Days are numbered every fifth one where there is no room for all of them.
  const major = (bucket, index) => unit === 'month' || index === 0 || Number(bucket.short) % 5 === 0;
  const describe = (bucket) => [
    `${bucket.count} ${bucket.count === 1 ? 'transaction' : 'transactions'}`,
    bucket.expenses > 0 && `${formatMoney(bucket.expenses)} spent`,
    bucket.income > 0 && `${formatMoney(bucket.income)} received`,
  ].filter(Boolean).join(', ');

  return (
    <div className="tx-chart">
      <header className="tx-chart__head">
        <h2>Spent so far</h2>
        <span>{unit === 'day' ? 'day by day' : 'month by month'}, pick one to see only its transactions</span>
      </header>
      <div className="tx-chart__plot" style={{ '--count': count }}>
        <svg viewBox={`0 0 ${count} 100`} preserveAspectRatio="none" aria-hidden="true">
          {reached.length > 0 && <path d={area} className="tx-chart__area" />}
          {reached.length > 0 && <path d={outline} className="tx-chart__line" />}
        </svg>
        {todayIndex >= 0 && unit === 'day' && (
          <span className="tx-chart__today" style={{ left: `${((todayIndex + 1) / count) * 100}%` }}><i>today</i></span>
        )}
        {last && total > 0 && (
          <span
            className="tx-chart__total"
            data-edge={reached.length / count > 0.8 ? 'end' : undefined}
            style={{ left: `${(reached.length / count) * 100}%` }}
          >
            {formatMoney(total)}
          </span>
        )}
        <div className="tx-chart__columns">
          {buckets.map((bucket) => (
            <button
              type="button"
              className="tx-chart__column"
              data-weekend={bucket.weekend}
              data-empty={bucket.count === 0}
              aria-pressed={bucket.key === picked}
              aria-label={`${bucket.label}: ${describe(bucket)}`}
              title={`${bucket.label}: ${describe(bucket)}`}
              disabled={bucket.count === 0}
              onClick={() => onPick(bucket.key === picked ? null : bucket.key)}
              key={bucket.key}
            />
          ))}
        </div>
      </div>
      <ol className="tx-chart__axis" style={{ '--count': count }} aria-hidden="true">
        {buckets.map((bucket, index) => (
          <li data-major={major(bucket, index)} data-today={bucket.today} data-income={bucket.income > 0} key={bucket.key}>
            <span>{bucket.short}</span>
          </li>
        ))}
      </ol>
      <p className="tx-chart__picked" aria-live="polite">
        {chosen ? (
          <>
            <b>{chosen.label}</b>: {describe(chosen)}; {formatMoney(chosen.spentSoFar)} spent by its end.{' '}
            <button type="button" className="bw-link" onClick={() => onPick(null)}>
              Show {unit === 'day' ? 'all days' : 'all months'}
            </button>
          </>
        ) : (
          <>
            <i className="tx-chart__key" data-kind="income" aria-hidden="true" /> a green mark is a {unit} with income.
            {unit === 'day' && <> <i className="tx-chart__key" data-kind="weekend" aria-hidden="true" /> shaded days are weekends.</>}
          </>
        )}
      </p>
    </div>
  );
}
