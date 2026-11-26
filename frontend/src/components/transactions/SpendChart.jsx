import { useState } from 'react';

// Income so far and spending so far by the end of each day of the period (or each month of
// a long one), as two lines of steps that stop at today. The band between them is the
// balance: green while income is ahead, red while spending is. The figures above the plot
// are those of the last day, of the day pointed at, or of the day picked. A day can be picked
// to see only its transactions. Takes the result of timeline.
//
// The steps are an SVG stretched to the plot, one unit wide per day. The columns that are
// pressed, the marks and the figures are ordinary elements laid over it.
export default function SpendChart({ line, picked, onPick, formatMoney }) {
  const { buckets, unit, total, received } = line;
  const [pointed, setPointed] = useState(null);
  const count = buckets.length;
  const reached = buckets.filter(({ future }) => !future);
  const top = Math.max(total, received);
  const y = (value) => 100 - (top > 0 ? (value / top) * 100 : 0);
  const steps = (key) => `M0 100 ${reached.map((bucket, index) => `L${index} ${y(bucket[key]).toFixed(2)} L${index + 1} ${y(bucket[key]).toFixed(2)}`).join(' ')}`;
  // With one line there is nothing to compare it with: the area under it is tinted instead.
  const both = total > 0 && received > 0;
  const only = total > 0 ? 'spentSoFar' : 'incomeSoFar';
  const band = (sign) => reached
    .map((bucket, index) => ({ index, income: y(bucket.incomeSoFar), spent: y(bucket.spentSoFar), sign: Math.sign(bucket.incomeSoFar - bucket.spentSoFar) }))
    .filter((step) => step.sign === sign)
    .map(({ index, income, spent }) => `M${index} ${income.toFixed(2)} H${index + 1} V${spent.toFixed(2)} H${index} Z`)
    .join(' ');
  const todayIndex = buckets.findIndex((bucket) => bucket.today);
  const chosen = buckets.find(({ key }) => key === picked);
  const last = reached.at(-1);
  // The figures and the marks follow the pointer, then the day picked, then the end of the line.
  const moved = reached[pointed] ?? (chosen && !chosen.future ? chosen : null);
  const shown = moved ?? last;
  const markAt = moved ? (buckets.indexOf(moved) + 0.5) / count : reached.length / count;
  const balance = shown ? shown.incomeSoFar - shown.spentSoFar : 0;
  // Days are numbered every fifth one where there is no room for all of them.
  const major = (bucket, index) => unit === 'month' || index === 0 || Number(bucket.short) % 5 === 0;
  const describe = (bucket) => [
    `${bucket.count} ${bucket.count === 1 ? 'transaction' : 'transactions'}`,
    bucket.expenses > 0 && `${formatMoney(bucket.expenses)} spent`,
    bucket.income > 0 && `${formatMoney(bucket.income)} received`,
  ].filter(Boolean).join(', ');
  const point = (event) => {
    if (event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.floor(((event.clientX - box.left) / box.width) * count);
    setPointed(index >= 0 && index < reached.length ? index : null);
  };

  return (
    <div className="tx-chart">
      <header className="tx-chart__head">
        <h2>{both ? 'Income and spending so far' : total > 0 || received === 0 ? 'Spent so far' : 'Income so far'}</h2>
        <span>{unit === 'day' ? 'day by day' : 'month by month'}, pick one to see only its transactions</span>
      </header>
      {shown && top > 0 && (
        <p className="tx-chart__sofar">
          <span className="tx-chart__when">Through {shown.label}</span>
          {received > 0 && <span data-series="income"><i aria-hidden="true" /> Income <b>{formatMoney(shown.incomeSoFar)}</b></span>}
          {total > 0 && <span data-series="spent"><i aria-hidden="true" /> Spent <b>{formatMoney(shown.spentSoFar)}</b></span>}
          {both && <span data-series="balance" data-negative={balance < 0}><i aria-hidden="true" /> Balance <b>{formatMoney(balance)}</b></span>}
        </p>
      )}
      <div className="tx-chart__plot" style={{ '--count': count, '--end': `${100 - (reached.length / count) * 100}%` }}>
        {reached.length > 0 && (
          <svg viewBox={`0 0 ${count} 100`} preserveAspectRatio="none" aria-hidden="true">
            {both ? (
              <>
                <path d={band(1)} className="tx-chart__band" data-sign="ahead" />
                <path d={band(-1)} className="tx-chart__band" data-sign="behind" />
              </>
            ) : (
              <path d={`${steps(only)} L${reached.length} 100 Z`} className="tx-chart__band" data-sign={total > 0 ? 'behind' : 'ahead'} />
            )}
            {received > 0 && <path d={steps('incomeSoFar')} className="tx-chart__line" data-series="income" />}
            {total > 0 && <path d={steps('spentSoFar')} className="tx-chart__line" data-series="spent" />}
          </svg>
        )}
        {todayIndex >= 0 && unit === 'day' && (
          <span className="tx-chart__today" style={{ left: `${((todayIndex + 1) / count) * 100}%` }}><i>today</i></span>
        )}
        {shown && received > 0 && <i className="tx-chart__dot" data-series="income" style={{ left: `${markAt * 100}%`, top: `${y(shown.incomeSoFar)}%` }} />}
        {shown && total > 0 && <i className="tx-chart__dot" data-series="spent" style={{ left: `${markAt * 100}%`, top: `${y(shown.spentSoFar)}%` }} />}
        <div className="tx-chart__columns" onPointerMove={point} onPointerLeave={() => setPointed(null)}>
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
          <li data-major={major(bucket, index)} data-today={bucket.today} key={bucket.key}>
            <span>{bucket.short}</span>
          </li>
        ))}
      </ol>
      {(chosen || unit === 'day') && (
        <p className="tx-chart__picked" aria-live="polite">
          {chosen ? (
            <>
              <b>{chosen.label}</b>: {describe(chosen)}.{' '}
              <button type="button" className="bw-link" onClick={() => onPick(null)}>
                Show {unit === 'day' ? 'all days' : 'all months'}
              </button>
            </>
          ) : (
            <><i className="tx-chart__key" aria-hidden="true" /> shaded days are weekends.</>
          )}
        </p>
      )}
    </div>
  );
}
