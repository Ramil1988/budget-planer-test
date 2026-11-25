// The filters that are not on the toolbar: a date range, words in the description, the
// bank, and a range of amounts. `values` holds them; `set` holds a setter for each.
export default function FilterPanel({ values, set, banks, onApply, onClear }) {
  const submit = (event) => {
    event.preventDefault();
    onApply();
  };

  return (
    <form className="bw-panel tx-filter-panel" id="tx-filter-panel" aria-label="More filters" onSubmit={submit}>
      <div className="bw-fields">
        <div className="bw-field">
          <label htmlFor="tx-filter-start">From</label>
          <input id="tx-filter-start" className="bw-input" type="date" value={values.startDate} onChange={(event) => set.startDate(event.target.value)} />
        </div>
        <div className="bw-field">
          <label htmlFor="tx-filter-end">To</label>
          <input id="tx-filter-end" className="bw-input" type="date" value={values.endDate} onChange={(event) => set.endDate(event.target.value)} />
        </div>
      </div>

      <div className="bw-fields">
        <div className="bw-field">
          <label htmlFor="tx-filter-description">Description or category has</label>
          <input
            id="tx-filter-description"
            className="bw-input"
            placeholder="costco, fuel"
            value={values.description}
            onChange={(event) => set.description(event.target.value)}
          />
        </div>
        {banks.length > 0 && (
          <div className="bw-field">
            <label htmlFor="tx-filter-bank">Bank</label>
            <select id="tx-filter-bank" className="bw-select" value={values.bank} onChange={(event) => set.bank(event.target.value)}>
              <option value="">All banks</option>
              {banks.map((bank) => <option value={bank} key={bank}>{bank}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="bw-fields">
        <div className="bw-field">
          <label htmlFor="tx-filter-min">Amount from</label>
          <input
            id="tx-filter-min"
            className="bw-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={values.minAmount}
            onChange={(event) => set.minAmount(event.target.value)}
          />
        </div>
        <div className="bw-field">
          <label htmlFor="tx-filter-max">Amount to</label>
          <input
            id="tx-filter-max"
            className="bw-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="No limit"
            value={values.maxAmount}
            onChange={(event) => set.maxAmount(event.target.value)}
          />
        </div>
      </div>

      <div className="tx-filter-panel__actions">
        <button type="button" className="bw-button bw-button--quiet" onClick={onClear}>Clear filters</button>
        <button type="submit" className="bw-button">Apply filters</button>
      </div>
    </form>
  );
}
