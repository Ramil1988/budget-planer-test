// The next thirty days as a list of days, across months and across income and expenses:
// the strip stops at the end of its month, this does not.
const heading = (day) => {
  if (day.daysUntil === 0) return 'Today';
  if (day.daysUntil === 1) return 'Tomorrow';
  return day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

export default function Agenda({ days, formatCurrency }) {
  const count = days.reduce((sum, day) => sum + day.items.length, 0);
  const net = days.reduce((sum, day) => sum + day.net, 0);

  return (
    <aside className="bw-panel recurring-agenda" aria-labelledby="recurring-agenda-heading">
      <header className="recurring-agenda__head">
        <h2 id="recurring-agenda-heading">Next 30 days</h2>
        <p>
          {count === 0
            ? 'Nothing is due.'
            : `${count} ${count === 1 ? 'payment' : 'payments'}, ${net >= 0 ? '+' : ''}${formatCurrency(net)} net`}
        </p>
      </header>
      {count > 0 && (
        <ol className="recurring-agenda__days">
          {days.map((day) => (
            <li className="recurring-agenda__day" data-soon={day.daysUntil <= 3} key={+day.date}>
              <h3>{heading(day)}</h3>
              <ul>
                {day.items.map((payment) => (
                  <li data-type={payment.type} key={payment.id}>
                    <span>{payment.name}</span>
                    <b>{formatCurrency(payment.type === 'income' ? payment.amount : -payment.amount)}</b>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
