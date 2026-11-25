import { useState } from 'react';
import { formatDay, trend } from '../../lib/assetsView';

const percent = (value) => `${value.toFixed(2)}%`;

// Net worth over time, one point per saved snapshot, placed by its date. A point can be
// picked to read what was owned and owed that day.
//
// The line and the fill are an SVG stretched to the plot; the points and the figures are
// ordinary elements placed over it, so they keep their size on any screen.
export default function NetWorthChart({ snapshots, formatCurrency, onManage }) {
  const [pickedId, setPickedId] = useState(null);
  const result = trend(snapshots);

  const head = (
    <header className="assets-panel__head">
      <div>
        <h2 id="assets-trend-heading">Net worth over time</h2>
        {result && result.points.length > 1 && (
          <p data-tone={result.change < 0 ? 'bad' : 'good'}>
            {result.change >= 0 ? 'Up' : 'Down'} {formatCurrency(Math.abs(result.change))} since {formatDay(result.points[0].date)}
          </p>
        )}
      </div>
      <span>
        {snapshots.length} {snapshots.length === 1 ? 'snapshot' : 'snapshots'}
        {snapshots.length > 0 && (
          <button type="button" className="bw-link assets-trend__manage" onClick={onManage}>Manage</button>
        )}
      </span>
    </header>
  );

  if (!result) {
    return (
      <section className="bw-panel assets-trend" aria-labelledby="assets-trend-heading">
        {head}
        <p className="bw-nothing">No snapshots yet. Save one to start the line; every change to an asset or a debt saves one too.</p>
      </section>
    );
  }

  const { points, zero } = result;
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const area = `${line} L${points.at(-1).x.toFixed(2)} ${zero.toFixed(2)} L${points[0].x.toFixed(2)} ${zero.toFixed(2)} Z`;
  const first = points[0];
  const last = points.at(-1);
  const picked = points.find(({ id }) => id === pickedId) || last;

  return (
    <section className="bw-panel assets-trend" aria-labelledby="assets-trend-heading">
      {head}
      <div className="assets-trend__body">
        <div className="assets-trend__plot">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <clipPath id="assets-trend-above"><rect x="0" y="0" width="100" height={zero} /></clipPath>
              <clipPath id="assets-trend-below"><rect x="0" y={zero} width="100" height={100 - zero} /></clipPath>
            </defs>
            <path d={area} className="assets-trend__area" data-side="above" clipPath="url(#assets-trend-above)" />
            <path d={area} className="assets-trend__area" data-side="below" clipPath="url(#assets-trend-below)" />
            <line x1="0" x2="100" y1={zero} y2={zero} className="assets-trend__zero" />
            {points.length > 1 && <path d={line} className="assets-trend__line" />}
          </svg>
          <span className="assets-trend__zero-label" style={{ top: percent(zero) }}>$0</span>
          {points.map((point) => (
            <button
              type="button"
              className="assets-trend__dot"
              data-tone={point.equity < 0 ? 'bad' : 'good'}
              aria-pressed={point === picked}
              aria-label={`${formatDay(point.date)}: net worth ${formatCurrency(point.equity)}`}
              style={{ left: percent(point.x), top: percent(point.y) }}
              onClick={() => setPickedId(point.id)}
              key={point.id}
            />
          ))}
          <span
            className="assets-trend__label"
            data-side={picked.equity < 0 ? 'below' : 'above'}
            data-edge={picked.x > 85 ? 'end' : picked.x < 15 ? 'start' : undefined}
            style={{ left: percent(picked.x), top: percent(picked.y) }}
          >
            {formatCurrency(picked.equity)}
          </span>
        </div>
        <div className="assets-trend__axis" aria-hidden="true">
          <span>{formatDay(first.date)}</span>
          {points.length > 1 && <span>{formatDay(last.date)}</span>}
        </div>
        <p className="assets-trend__picked" aria-live="polite">
          <b>{formatDay(picked.date)}</b>: owned {formatCurrency(picked.assets)}, owed {formatCurrency(picked.liabilities)},
          {' '}net worth <b>{formatCurrency(picked.equity)}</b>.
        </p>
      </div>
    </section>
  );
}
