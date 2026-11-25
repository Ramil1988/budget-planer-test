// The month day by day: what comes in rises above the line, what goes out hangs below it.
// It shows at a glance where the bills crowd together and how they sit around the paydays.
const label = (date) => date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// Square root, so a small subscription stays visible next to the mortgage.
const height = (amount, largest) => (amount > 0 ? `${Math.max(Math.sqrt(amount / largest), 0.12) * 100}%` : 0);

export default function MonthStrip({ days, selectedDay, onSelect, formatCurrency }) {
  const largest = Math.max(1, ...days.map(({ income, expenses }) => Math.max(income, expenses)));
  const selected = days.find(({ day }) => day === selectedDay);
  const last = days.length;
  const today = days.find(({ isToday }) => isToday)?.day;

  return (
    <div className="recurring-strip">
      <div className="recurring-strip__head">
        <h2>When the money moves</h2>
        <p>Income rises above the line, expenses hang below it. Shaded days are weekends.</p>
      </div>

      <ol className="recurring-strip__days" style={{ '--days': last }}>
        {days.map((day) => {
          // Every fifth day is numbered, unless today's number sits right beside it.
          const major = (day.day === 1 || day.day === last || day.day % 5 === 0) && !(today && Math.abs(day.day - today) === 1);
          const parts = [day.income > 0 && `${formatCurrency(day.income)} in`, day.expenses > 0 && `${formatCurrency(day.expenses)} out`].filter(Boolean);
          const about = `${label(day.date)}${day.isToday ? ', today' : ''}: ${parts.join(', ') || 'nothing due'}`;
          return (
            <li
              className="recurring-day"
              title={about}
              data-weekend={day.weekend}
              data-today={day.isToday}
              data-selected={day.day === selectedDay}
              key={day.day}
            >
              <button
                type="button"
                className="recurring-day__bars"
                disabled={day.payments.length === 0}
                aria-pressed={day.day === selectedDay}
                aria-label={about}
                onClick={() => onSelect(day.day)}
              >
                <span className="recurring-day__in" style={{ height: height(day.income, largest) }} />
                <span className="recurring-day__out" style={{ height: height(day.expenses, largest) }} />
              </button>
              {(major || day.isToday) && (
                <span className="recurring-day__number" data-minor={!day.isToday && day.day % 10 !== 0 && day.day !== 1} aria-hidden="true">
                  {day.day}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <ul className="recurring-strip__detail" aria-live="polite">
        {selected ? (
          <>
            <li><strong>{label(selected.date)}{selected.isToday ? ', today' : ''}</strong></li>
            {selected.payments.map((payment) => (
              <li data-type={payment.type} key={`${payment.id}-${+payment.date}`}>
                {payment.name} <b>{formatCurrency(payment.type === 'income' ? payment.amount : -payment.amount)}</b>
              </li>
            ))}
          </>
        ) : (
          <li>{days.some(({ payments }) => payments.length) ? 'Select a day with a bar to see what is due.' : 'Nothing is scheduled in this month.'}</li>
        )}
      </ul>
    </div>
  );
}
