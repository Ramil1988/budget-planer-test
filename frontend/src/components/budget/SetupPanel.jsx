import { allocation } from '../../lib/budgetMath';
import RecurringBadge from './RecurringBadge';

const whole = (amount) => `$${Math.abs(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

// Planning the month: the total against last month, how it is divided, and a limit per category.
export default function SetupPanel({
  categories, limits, committedLimits, previousLimits, recurringByCategory,
  search, onSearch, sortBy, onSortBy, onChange, onBlur, onSave, saving, dirty, monthName, formatCurrency,
}) {
  const total = Object.values(limits).reduce((sum, value) => sum + Number(value || 0), 0);
  const previousTotal = Object.values(previousLimits).reduce((sum, value) => sum + Number(value || 0), 0);
  const hasPrevious = Object.keys(previousLimits).length > 0;
  const change = total - previousTotal;
  const parts = allocation(categories, committedLimits);

  const shown = categories
    .filter((category) => category.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (sortBy === 'amount'
      // Sorted by the committed value, so a row does not jump while its limit is being typed.
      ? Number(committedLimits[b.id] || 0) - Number(committedLimits[a.id] || 0)
      : a.name.localeCompare(b.name)));

  return (
    <>
      <section className="bw-ledger" aria-label="Planned budget">
        <dl className="bw-figures" data-count={hasPrevious ? 3 : 1}>
          <div className="bw-figure bw-figure--lead">
            <dt>Planned for {monthName}</dt>
            <dd>{formatCurrency(total)}</dd>
          </div>
          {hasPrevious && (
            <>
              <div className="bw-figure">
                <dt>Last month</dt>
                <dd>{formatCurrency(previousTotal)}</dd>
              </div>
              <div className="bw-figure">
                <dt>Change</dt>
                <dd>{change === 0 ? 'None' : `${change > 0 ? '+' : '−'}${formatCurrency(Math.abs(change))}`}</dd>
              </div>
            </>
          )}
        </dl>

        {parts.length > 0 && (
          <div className="budget-split">
            <h2>Where the plan goes</h2>
            <div className="budget-split__bar" role="img" aria-label={parts.map(({ name, share }) => `${name} ${Math.round(share * 100)}%`).join(', ')}>
              {parts.map(({ id, share }, rank) => <span data-rank={rank} style={{ width: `${share * 100}%` }} key={id} />)}
            </div>
            <ul className="budget-split__key">
              {parts.map(({ id, name, share }, rank) => (
                <li key={id}>
                  <i data-rank={rank} />
                  <b>{name}</b>
                  <span>{share < 0.01 ? '<1' : Math.round(share * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="bw-section-head">
        <div>
          <h2>Category limits</h2>
          <p>What each category may spend in {monthName}.</p>
        </div>
        <div className="bw-tools">
          <input
            type="search"
            className="bw-input"
            placeholder="Search categories"
            aria-label="Search categories"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
          <select className="bw-select" aria-label="Sort categories" value={sortBy} onChange={(event) => onSortBy(event.target.value)}>
            <option value="amount">Largest first</option>
            <option value="name">Name, A to Z</option>
          </select>
        </div>
      </div>

      <div className="bw-panel">
        {shown.length === 0 ? (
          <p className="bw-nothing">No categories match “{search}”.</p>
        ) : (
          <ul className="budget-limits">
            {shown.map((category) => {
              const previous = Number(previousLimits[category.id] || 0);
              const difference = Number(limits[category.id] || 0) - previous;
              const known = previous > 0 || category.id in previousLimits;
              return (
                <li className="budget-limit" key={category.id}>
                  <label className="budget-limit__name" htmlFor={`limit-${category.id}`}>
                    {category.name}
                    <RecurringBadge info={recurringByCategory[category.id]} />
                  </label>
                  <span className="budget-limit__was">
                    {known ? (
                      <>
                        Last month {whole(previous)}
                        {difference !== 0 && (
                          <> <b data-change={difference > 0 ? 'up' : 'down'}>{difference > 0 ? '+' : '−'}{whole(difference)}</b></>
                        )}
                      </>
                    ) : 'New this month'}
                  </span>
                  <span className="budget-limit__field">
                    <span aria-hidden="true">$</span>
                    <input
                      id={`limit-${category.id}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={limits[category.id] ?? ''}
                      onChange={(event) => onChange(category.id, event.target.value)}
                      onBlur={() => onBlur(category.id)}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="budget-save">
        <p>
          <b>{formatCurrency(total)}</b> planned for {monthName}
          {dirty && ', with changes that are not saved yet'}
        </p>
        <button type="button" className="bw-button" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save budget'}
        </button>
      </div>
    </>
  );
}
