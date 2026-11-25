// The month at a glance: what is left, and a ruler that is both the budget and the calendar.
// Money fills it from the left; the mark shows where an even pace would be today.
const percent = (value) => `${Math.max(0, Math.min(value, 1)) * 100}%`;

export default function PaceLedger({ mode, limit, spent, scheduled, expected, progress, summary, firstDay, lastDay, formatCurrency }) {
  const projected = mode === 'projected';
  const planned = spent + scheduled + (projected ? expected : 0);
  const scale = Math.max(limit, planned) || 1;
  const within = (amount, used) => Math.max(0, Math.min(amount, limit - used));
  const spentIn = within(spent, 0);
  const scheduledIn = within(scheduled, spent);
  const expectedIn = projected ? within(expected, spent + scheduled) : 0;
  const over = limit > 0 ? Math.max(planned - limit, 0) : 0;
  const remaining = limit - spent;

  const figures = projected
    ? [
      { label: 'Projected by month end', value: formatCurrency(planned), tone: over > 0 ? 'bad' : 'good', lead: true },
      { label: 'Spent so far', value: formatCurrency(spent) },
      { label: 'Scheduled', value: formatCurrency(scheduled), hint: 'recurring payments still due' },
      { label: 'Budget', value: formatCurrency(limit) },
    ]
    : [
      remaining < 0
        ? { label: 'Over budget', value: formatCurrency(-remaining), tone: 'bad', lead: true }
        : { label: 'Left to spend', value: formatCurrency(remaining), tone: 'good', lead: true },
      { label: 'Spent', value: formatCurrency(spent) },
      ...(scheduled > 0 ? [{ label: 'Scheduled', value: formatCurrency(scheduled), hint: 'recurring payments still due' }] : []),
      { label: 'Budget', value: formatCurrency(limit) },
    ];

  const parts = [
    { part: 'spent', amount: spentIn, label: 'Spent' },
    { part: 'scheduled', amount: scheduledIn, label: 'Scheduled' },
    { part: 'expected', amount: expectedIn, label: 'Expected in open categories' },
    { part: 'over', amount: over, label: 'Over budget' },
  ].filter(({ amount }) => amount > 0);
  const todayAt = (progress.elapsed * limit) / scale;

  return (
    <section className="bw-ledger" aria-label={projected ? 'Projected month' : 'Month so far'}>
      <dl className="bw-figures" data-count={figures.length}>
        {figures.map(({ label, value, tone, lead, hint }) => (
          <div className={`bw-figure${lead ? ' bw-figure--lead' : ''}`} key={label}>
            <dt>{label}</dt>
            <dd data-tone={tone}>{value}</dd>
            {hint && <small>{hint}</small>}
          </div>
        ))}
      </dl>

      <div className="budget-pace">
        <p className="budget-pace__headline" data-tone={summary.tone}>{summary.headline}</p>
        <p className="budget-pace__detail">{summary.detail}</p>

        {limit > 0 && (
          <div className="budget-ruler">
            <div
              className="budget-ruler__track"
              role="img"
              aria-label={`${formatCurrency(spent)} spent of ${formatCurrency(limit)}${scheduled > 0 ? `, ${formatCurrency(scheduled)} scheduled` : ''}`}
            >
              <div className="budget-ruler__bar">
                {parts.map(({ part, amount }) => (
                  <span className="budget-part" data-part={part} style={{ width: percent(amount / scale) }} key={part} />
                ))}
              </div>
              {over > 0 && (
                <span className="budget-ruler__mark" data-kind="limit" data-edge={limit / scale > 0.9 ? 'end' : undefined} style={{ left: percent(limit / scale) }}>
                  <span>Budget</span>
                </span>
              )}
              {progress.state === 'current' && (
                <span className="budget-ruler__mark" data-edge={todayAt < 0.06 ? 'start' : todayAt > 0.94 ? 'end' : undefined} style={{ left: percent(todayAt) }}>
                  <span>Today</span>
                </span>
              )}
            </div>
            <div className="budget-ruler__scale" aria-hidden="true">
              <span>{firstDay}</span>
              <span>{lastDay}</span>
            </div>
            <ul className="budget-legend">
              {parts.map(({ part, label }) => (
                <li key={part}><i className="budget-part" data-part={part} />{label}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
