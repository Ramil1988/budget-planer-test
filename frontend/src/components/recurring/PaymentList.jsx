import { formatDate, formatFrequency } from '../../lib/recurringUtils';

const HEADINGS = { week: 'Due within a week', later: 'Later', paused: 'Paused', ended: 'Ended' };
const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

// "Subscriptions, monthly, on weekdays, added automatically, until Jul 7, 2029"
function describe(payment) {
  return [
    payment.categories?.name || 'No category',
    lowerFirst(formatFrequency(payment.frequency, payment.frequency_interval)),
    payment.last_business_day_of_month ? 'on the last business day' : payment.business_days_only && 'on weekdays',
    payment.auto_add && 'added automatically',
    payment.end_date && `until ${formatDate(payment.end_date)}`,
  ].filter(Boolean).join(', ');
}

function due(payment) {
  if (!payment.is_active) return 'Paused';
  if (payment.daysUntil == null) return 'Ended';
  if (payment.daysUntil === 0) return 'Due today';
  if (payment.daysUntil === 1) return 'Due tomorrow';
  return `In ${payment.daysUntil} days`;
}

// Payments in the order they come due, grouped by how soon. Takes the groups of groupByDue.
export default function PaymentList({ groups, formatCurrency, onToggle, onEdit, onDelete }) {
  return (
    <div className="bw-panel">
      {groups.map((group) => {
        const total = group.items.reduce((sum, { amount }) => sum + Number(amount), 0);
        return (
          <section className="bw-group" data-status={group.status === 'week' ? 'close' : group.status === 'later' ? 'ok' : 'none'} key={group.status}>
            <header className="bw-group__head">
              <h3>{HEADINGS[group.status]}</h3>
              <span>{group.items.length} {group.items.length === 1 ? 'payment' : 'payments'}, {formatCurrency(total)}</span>
            </header>
            <ul className="bw-rows">
              {group.items.map((payment) => {
                const dated = payment.is_active && payment.nextDate;
                return (
                  <li className="recurring-row" data-type={payment.type} data-paused={!payment.is_active} key={payment.id}>
                    {dated ? (
                      <time className="recurring-date" dateTime={payment.nextDate.toISOString().slice(0, 10)}>
                        <strong>{payment.nextDate.getDate()}</strong>
                        <span>{payment.nextDate.toLocaleDateString('en-US', { month: 'short' })}</span>
                      </time>
                    ) : (
                      <span className="recurring-date" aria-hidden="true"><span>—</span></span>
                    )}
                    <div className="recurring-row__body">
                      <p className="recurring-row__name">{payment.name}</p>
                      <p className="recurring-row__meta">{describe(payment)}</p>
                    </div>
                    <div className="recurring-row__amount">
                      <b>{formatCurrency(payment.type === 'income' ? payment.amount : -payment.amount)}</b>
                      <small data-soon={dated && payment.daysUntil <= 3}>{due(payment)}</small>
                    </div>
                    <div className="recurring-row__actions">
                      <button type="button" onClick={() => onToggle(payment)} aria-label={`${payment.is_active ? 'Pause' : 'Resume'} ${payment.name}`}>
                        {payment.is_active ? 'Pause' : 'Resume'}
                      </button>
                      <button type="button" onClick={() => onEdit(payment)} aria-label={`Edit ${payment.name}`}>Edit</button>
                      <button type="button" data-action="delete" onClick={() => onDelete(payment.id)} aria-label={`Delete ${payment.name}`}>Delete</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
