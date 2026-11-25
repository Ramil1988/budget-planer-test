import { useState } from 'react';
import { LuSlidersHorizontal, LuX } from 'react-icons/lu';
import { NO_FILTERS, PERIODS, periodLabel, periodRange } from '../../lib/transactionView';

// Every filter of the list in one place. Each takes effect as it is changed; nothing waits
// for a button. Under the controls, every filter in use is written out and can be removed
// on its own, so it is always clear why the list shows what it shows.
//
// `filters` is the object of lib/transactionView (see NO_FILTERS); `onChange` takes the
// fields to change. `picked` is the day or month chosen on the chart, if any.
export default function Filters({ filters, onChange, onClear, categories, banks, hasNoCategory, hasNoBank, picked, onUnpick, formatMoney }) {
  const [more, setMore] = useState(false);
  const offered = filters.type ? categories.filter(({ type }) => type === filters.type) : categories;
  const group = (type) => offered.filter((category) => category.type === type);
  const [from, to] = periodRange(filters);
  const moreInUse = [filters.bank, filters.min !== '' || filters.max !== ''].filter(Boolean).length;

  const amount = filters.min !== '' && filters.max !== ''
    ? `${formatMoney(Number(filters.min))} to ${formatMoney(Number(filters.max))}`
    : filters.min !== '' ? `${formatMoney(Number(filters.min))} or more` : filters.max !== '' ? `up to ${formatMoney(Number(filters.max))}` : '';
  // What is narrowing the list, in the order of the controls. Each can be taken off alone.
  const chips = [
    filters.query.trim() && { text: `“${filters.query.trim()}”`, remove: () => onChange({ query: '' }) },
    filters.period !== NO_FILTERS.period && {
      text: filters.period === 'custom' && !from && !to ? 'Any date' : periodLabel(from, to).replace(/^all time$/, 'All time'),
      remove: () => onChange({ period: NO_FILTERS.period, from: '', to: '' }),
    },
    filters.type && { text: filters.type === 'income' ? 'Income only' : 'Expenses only', remove: () => onChange({ type: '' }) },
    filters.category && {
      text: filters.category === 'none' ? 'No category' : categories.find(({ id }) => id === filters.category)?.name || 'Category',
      remove: () => onChange({ category: '' }),
    },
    filters.bank && { text: filters.bank === 'none' ? 'Entered by hand' : filters.bank, remove: () => onChange({ bank: '' }) },
    amount && { text: amount, remove: () => onChange({ min: '', max: '' }) },
    picked && { text: `Only ${picked.label}`, remove: onUnpick },
  ].filter(Boolean);

  return (
    <section className="tx-filters" aria-label="Filters">
      <div className="tx-toolbar">
        <input
          className="bw-input tx-toolbar__search"
          type="search"
          aria-label="Search transactions"
          placeholder="Search description, category, bank or amount"
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
        />

        <select className="bw-select" aria-label="Period" value={filters.period} onChange={(event) => onChange({ period: event.target.value })}>
          {PERIODS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>

        {filters.period === 'custom' && (
          <div className="tx-toolbar__range">
            <input className="bw-input" type="date" aria-label="From" value={filters.from} onChange={(event) => onChange({ from: event.target.value })} />
            <span aria-hidden="true">to</span>
            <input className="bw-input" type="date" aria-label="To" value={filters.to} onChange={(event) => onChange({ to: event.target.value })} />
          </div>
        )}

        <div className="bw-segment tx-toolbar__type" role="group" aria-label="Type">
          {[['', 'All'], ['income', 'Income'], ['expense', 'Expenses']].map(([value, label]) => (
            <button type="button" aria-pressed={filters.type === value} onClick={() => onChange({ type: value })} key={label}>{label}</button>
          ))}
        </div>

        <select className="bw-select tx-toolbar__category" aria-label="Category" value={filters.category} onChange={(event) => onChange({ category: event.target.value })}>
          <option value="">All categories</option>
          {filters.type
            ? offered.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)
            : [['expense', 'Expenses'], ['income', 'Income']].map(([type, label]) => group(type).length > 0 && (
              <optgroup label={label} key={type}>
                {group(type).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
              </optgroup>
            ))}
          {hasNoCategory && <option value="none">No category</option>}
        </select>

        <button
          type="button"
          className="bw-button bw-button--quiet tx-toolbar__more"
          aria-expanded={more}
          aria-controls="tx-more-filters"
          onClick={() => setMore(!more)}
        >
          <LuSlidersHorizontal size={15} aria-hidden="true" />
          Bank and amount{moreInUse > 0 && <b>{moreInUse}</b>}
        </button>
      </div>

      {more && (
        <div className="bw-panel tx-more" id="tx-more-filters">
          <div className="bw-field">
            <label htmlFor="tx-filter-bank">Bank</label>
            <select id="tx-filter-bank" className="bw-select" value={filters.bank} onChange={(event) => onChange({ bank: event.target.value })}>
              <option value="">All banks</option>
              {banks.map((bank) => <option value={bank} key={bank}>{bank}</option>)}
              {hasNoBank && <option value="none">Entered by hand</option>}
            </select>
          </div>
          <div className="bw-field">
            <label htmlFor="tx-filter-min">Amount from</label>
            <input
              id="tx-filter-min"
              className="bw-input"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={filters.min}
              onChange={(event) => onChange({ min: event.target.value })}
            />
          </div>
          <div className="bw-field">
            <label htmlFor="tx-filter-max">Amount to</label>
            <input
              id="tx-filter-max"
              className="bw-input"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="No limit"
              value={filters.max}
              onChange={(event) => onChange({ max: event.target.value })}
            />
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <ul className="tx-chips" aria-label="Filters in use">
          {chips.map((chip) => (
            <li key={chip.text}>
              <span>{chip.text}</span>
              <button type="button" onClick={chip.remove} aria-label={`Remove the filter ${chip.text}`}>
                <LuX size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
          <li className="tx-chips__clear">
            <button type="button" className="bw-link" onClick={onClear}>Clear all</button>
          </li>
        </ul>
      )}
    </section>
  );
}
