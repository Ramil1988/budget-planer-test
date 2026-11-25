import { MONTH_NAMES, monthCategories } from '../../lib/reportView';

const SHORT = MONTH_NAMES.map((name) => name.slice(0, 3));
const HEIGHT = 150;
// "+$0.8k", "−$3.7k": short enough to sit under a month's column.
const short = (amount) => {
  const size = Math.abs(amount);
  return `${amount < 0 ? '−' : '+'}$${size >= 1000 ? `${(size / 1000).toFixed(1)}k` : Math.round(size)}`;
};

// The year as twelve months on one scale: income rises above the line, expenses hang below
// it, and a mark shows what the month came to. Picking a month lists its categories beside it.
export default function YearChart({ months, selected, currentMonth, onSelect, onPreview, formatCurrency }) {
  const largestIn = Math.max(...months.map(({ income }) => income));
  const largestOut = Math.max(...months.map(({ expenses }) => expenses));
  const largest = Math.max(largestIn, largestOut, 1);
  const scale = HEIGHT / largest;
  // Both halves share the scale, so each is only as tall as its own largest bar needs.
  const up = Math.max(Math.round(largestIn * scale), 28);
  const down = Math.max(Math.round(largestOut * scale), 28);
  const month = months[selected];
  const detail = month ? monthCategories(month) : null;
  const top = (list) => list.slice(0, 6);

  return (
    <div className="reports-year">
      <div className="reports-year__chart">
        <ol className="reports-year__months" style={{ '--up': `${up}px`, '--down': `${down}px` }} onMouseLeave={() => onPreview(null)}>
          {months.map((item, index) => {
            const about = item.recorded
              ? `${MONTH_NAMES[index]}: ${formatCurrency(item.income)} in, ${formatCurrency(item.expenses)} out, ${formatCurrency(item.balance)} net`
              : `${MONTH_NAMES[index]}: nothing recorded`;
            return (
              <li className="reports-month" data-selected={index === selected} data-current={index === currentMonth} title={about} key={item.month}>
                <button
                  type="button"
                  className="reports-month__bars"
                  disabled={!item.recorded}
                  aria-pressed={index === selected}
                  aria-label={about}
                  onClick={() => onSelect(index)}
                  onMouseEnter={() => item.recorded && onPreview(index)}
                  onFocus={() => item.recorded && onPreview(index)}
                  onBlur={() => onPreview(null)}
                >
                  <span className="reports-month__in" style={{ height: Math.round(item.income * scale) }} />
                  <span className="reports-month__out" style={{ height: Math.round(item.expenses * scale) }} />
                  {item.recorded && <span className="reports-month__net" style={{ top: up - item.balance * scale }} />}
                </button>
                <span className="reports-month__name" aria-hidden="true">{SHORT[index]}</span>
                <span className="reports-month__came" data-tone={item.balance < 0 ? 'bad' : 'good'} aria-hidden="true">
                  {item.recorded ? short(item.balance) : ''}
                </span>
              </li>
            );
          })}
        </ol>
        <ul className="reports-year__legend">
          <li><i data-key="in" />Income</li>
          <li><i data-key="out" />Expenses</li>
          <li><i data-key="net" />Net for the month, also written under it</li>
        </ul>
      </div>

      <div className="reports-detail" aria-live="polite">
        {month?.recorded ? (
          <>
            <h3>{MONTH_NAMES[selected]}</h3>
            <p className="reports-detail__net">
              Came to <b data-tone={month.balance < 0 ? 'bad' : 'good'}>{month.balance > 0 ? '+' : ''}{formatCurrency(month.balance)}</b>
            </p>
            {[['Income', month.income, detail.income], ['Expenses', month.expenses, detail.expenses]].map(([label, total, list]) => (
              <div key={label}>
                <h4><span>{label}</span><span>{formatCurrency(total)}</span></h4>
                <ul>
                  {top(list).map(({ name, amount }) => (
                    <li key={name}><span>{name}</span><span>{formatCurrency(amount)}</span></li>
                  ))}
                  {list.length > 6 && (
                    <li>
                      <span>{list.length - 6} more</span>
                      <span>{formatCurrency(list.slice(6).reduce((sum, { amount }) => sum + amount, 0))}</span>
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </>
        ) : (
          <p className="reports-detail__net">Pick a month to see what it was made of.</p>
        )}
      </div>
    </div>
  );
}
