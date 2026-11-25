import { useState } from 'react';
import { MONTH_NAMES, heatRows } from '../../lib/reportView';

// Which categories were heavy in which months: a row per category, a cell per month,
// darker for more. One scale for the whole map, so a dark cell is a large amount anywhere.
// A cell is a button: picking it writes its amount under the map.
export default function CategoryHeatmap({ months, selected, currentMonth, formatCurrency }) {
  const [picked, setPicked] = useState(null);
  const rows = heatRows(months);
  const largest = Math.max(1, ...rows.flatMap(({ cells }) => cells));
  // The cell picked last, as long as its category is still among the rows shown.
  const pickedRow = picked && rows.find(({ name }) => name === picked.name);
  const amount = pickedRow?.cells[picked.month] ?? 0;
  const said = (value) => (value > 0 ? formatCurrency(value) : 'nothing');

  return (
    <section className="bw-panel reports-heat" aria-labelledby="reports-heat-heading">
      <header className="reports-rank__head">
        <h2 id="reports-heat-heading">Categories through the year</h2>
        <span>darker means more spent that month</span>
      </header>
      {rows.length === 0 ? (
        <p className="bw-nothing">Nothing recorded.</p>
      ) : (
        <>
          <div className="reports-heat__grid" role="table" aria-label="Spending by category and month">
            <div className="reports-heat__row" role="row" aria-hidden="true">
              <span />
              {MONTH_NAMES.map((name, index) => (
                <span className="reports-heat__month" data-current={index === currentMonth} data-selected={index === selected} key={name}>{name.slice(0, 1)}</span>
              ))}
              <span />
            </div>
            {rows.map(({ name, total, cells }) => (
              <div className="reports-heat__row" role="row" key={name}>
                <span className="reports-heat__name" role="rowheader">{name}</span>
                {cells.map((value, index) => {
                  const isPicked = pickedRow?.name === name && picked.month === index;
                  return (
                    <span role="cell" key={MONTH_NAMES[index]}>
                      <button
                        type="button"
                        className="reports-heat__cell"
                        data-empty={value <= 0}
                        data-selected={index === selected}
                        aria-pressed={isPicked}
                        // Square root, so a month of groceries is not washed out by the mortgage.
                        style={{ '--strength': `${Math.round(Math.sqrt(value / largest) * 100)}%` }}
                        title={`${name}, ${MONTH_NAMES[index]}: ${said(value)}`}
                        aria-label={`${name}, ${MONTH_NAMES[index]}: ${said(value)}`}
                        onClick={() => setPicked(isPicked ? null : { name, month: index })}
                      />
                    </span>
                  );
                })}
                <span className="reports-heat__total" role="cell">{formatCurrency(total)}</span>
              </div>
            ))}
          </div>
          <p className="reports-heat__picked" aria-live="polite">
            {pickedRow ? (
              <>
                <b>{pickedRow.name}</b> in {MONTH_NAMES[picked.month]}: <b>{said(amount)}</b>
                {amount > 0 && `, ${Math.round((amount / pickedRow.total) * 100)}% of the ${formatCurrency(pickedRow.total)} it took this year`}
              </>
            ) : 'Pick a cell to see what it stands for.'}
          </p>
        </>
      )}
    </section>
  );
}
