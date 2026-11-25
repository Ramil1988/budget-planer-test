import { useState } from 'react';

const SHOWN = 8;

// Categories of the year, largest first, each with a bar for its share.
export default function CategoryRanking({ kind, title, categories, total, formatCurrency }) {
  const [all, setAll] = useState(false);
  const rows = all ? categories : categories.slice(0, SHOWN);
  const largest = categories[0]?.amount ?? 1;

  return (
    <section className="bw-panel reports-rank" data-kind={kind} aria-labelledby={`reports-rank-${kind}`}>
      <header className="reports-rank__head">
        <h2 id={`reports-rank-${kind}`}>{title}</h2>
        <span>{categories.length} {categories.length === 1 ? 'category' : 'categories'}, {formatCurrency(total)}</span>
      </header>
      {categories.length === 0 ? (
        <p className="bw-nothing">Nothing recorded.</p>
      ) : (
        <>
          <ol className="reports-rank__rows">
            {rows.map(({ name, amount, share }) => (
              <li className="reports-rank__row" key={name}>
                <span className="reports-rank__name">{name}</span>
                <span className="reports-rank__amount">{formatCurrency(amount)}</span>
                <span className="reports-rank__share">{share < 0.01 ? '<1' : Math.round(share * 100)}%</span>
                {/* Measured against the largest category, so the first bar is full. */}
                <span className="reports-rank__bar" aria-hidden="true"><span style={{ width: `${(amount / largest) * 100}%` }} /></span>
              </li>
            ))}
          </ol>
          {categories.length > SHOWN && (
            <button type="button" className="bw-button bw-button--quiet reports-rank__more" aria-expanded={all} onClick={() => setAll(!all)}>
              {all ? 'Show the largest only' : `Show all ${categories.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
