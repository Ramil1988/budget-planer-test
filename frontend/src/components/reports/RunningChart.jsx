import { MONTH_NAMES } from '../../lib/reportView';

const percent = (value) => `${value.toFixed(2)}%`;

// The balance of the year as it built up, month after month: above the line the year is
// ahead, below it the year is behind. Takes the months of withRunningTotal.
//
// The line and the fill are an SVG stretched to the plot, in percentages of it. The dots and
// the figures are ordinary elements placed over it, so they keep their size on any screen.
export default function RunningChart({ months, formatCurrency }) {
  const recorded = months.filter((month) => month.recorded);
  const values = recorded.map((month) => month.running);
  const high = Math.max(0, ...values);
  const low = Math.min(0, ...values);
  const span = high - low || 1;
  const x = (monthIndex) => ((monthIndex + 0.5) / 12) * 100;
  const y = (value) => ((high - value) / span) * 100;
  const zero = y(0);
  const points = recorded.map((month) => ({ x: x(month.monthIndex), y: y(month.running), month }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  // The area between the line and zero, closed along the zero line.
  const area = points.length ? `${line} L${points.at(-1).x.toFixed(2)} ${zero.toFixed(2)} L${points[0].x.toFixed(2)} ${zero.toFixed(2)} Z` : '';
  const last = points.at(-1);
  const lowest = points.reduce((a, b) => (b.month.running < a.month.running ? b : a), points[0]);
  // A figure sits on the side of its point that is away from the zero line.
  const label = (point, quiet) => (
    <span
      className="reports-running__label"
      data-side={point.month.running < 0 ? 'below' : 'above'}
      data-edge={point.x > 88 ? 'end' : point.x < 12 ? 'start' : undefined}
      data-quiet={quiet}
      style={{ left: percent(point.x), top: percent(point.y) }}
    >
      {formatCurrency(point.month.running)}
    </span>
  );

  return (
    <section className="bw-panel reports-running" aria-labelledby="reports-running-heading">
      <header className="reports-rank__head">
        <h2 id="reports-running-heading">The year so far</h2>
        <span>the balance as it built up</span>
      </header>
      {points.length === 0 ? (
        <p className="bw-nothing">Nothing recorded.</p>
      ) : (
        <div
          className="reports-running__body"
          role="img"
          aria-label={`Balance of the year month by month, ending at ${formatCurrency(last.month.running)} in ${MONTH_NAMES[last.month.monthIndex]}`}
        >
          <div className="reports-running__plot">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <clipPath id="reports-running-above"><rect x="0" y="0" width="100" height={zero} /></clipPath>
                <clipPath id="reports-running-below"><rect x="0" y={zero} width="100" height={100 - zero} /></clipPath>
              </defs>
              <path d={area} className="reports-running__area" data-side="above" clipPath="url(#reports-running-above)" />
              <path d={area} className="reports-running__area" data-side="below" clipPath="url(#reports-running-below)" />
              <line x1="0" x2="100" y1={zero} y2={zero} className="reports-running__zero" />
              <path d={line} className="reports-running__line" />
            </svg>
            <span className="reports-running__zero-label" style={{ top: percent(zero) }}>$0</span>
            {points.map((point) => (
              <span
                className="reports-running__dot"
                data-tone={point.month.running < 0 ? 'bad' : 'good'}
                style={{ left: percent(point.x), top: percent(point.y) }}
                title={`${MONTH_NAMES[point.month.monthIndex]}: ${formatCurrency(point.month.running)}`}
                key={point.month.monthIndex}
              />
            ))}
            {label(last, false)}
            {lowest !== last && lowest.month.running < 0 && label(lowest, true)}
          </div>
          <ol className="reports-running__months" aria-hidden="true">
            {MONTH_NAMES.map((name) => <li key={name}>{name.slice(0, 1)}</li>)}
          </ol>
        </div>
      )}
    </section>
  );
}
