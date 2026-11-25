import { formatDate, formatFrequency, FREQUENCY_CONFIG, parseLocalDate } from '../../lib/recurringUtils';

const HEADINGS = { week: 'Due within a week', later: 'Later', paused: 'Paused', ended: 'Ended' };
const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

// "Subscriptions, monthly, on weekdays, added automatically, until Jul 7, 2029"
function describe(payment, catalog) {
  const frequency = formatFrequency(payment.frequency, payment.frequency_interval);
  const start = parseLocalDate(payment.start_date);
  const months = FREQUENCY_CONFIG[payment.frequency]?.months * (payment.frequency_interval ?? 1);
  let anchor;
  if (catalog && Number.isFinite(+start) && !payment.last_business_day_of_month) {
    if (months) anchor = months % 12 === 0
      ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `Day ${start.getDate()}`;
    else if (['weekly', 'biweekly'].includes(payment.frequency)) anchor = start.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return [
    !catalog && (payment.categories?.name || 'No category'),
    catalog ? frequency : lowerFirst(frequency),
    anchor,
    payment.last_business_day_of_month ? 'on the last business day' : payment.business_days_only && 'on weekdays',
    payment.auto_add && 'added automatically',
    payment.end_date && `until ${formatDate(payment.end_date)}`,
  ].filter(Boolean).join(catalog ? ' · ' : ', ');
}

function due(payment) {
  if (!payment.is_active) return 'Paused';
  if (payment.daysUntil == null) return 'Ended';
  if (payment.daysUntil === 0) return 'Due today';
  if (payment.daysUntil === 1) return 'Due tomorrow';
  return `In ${payment.daysUntil} days`;
}

export default function PaymentList({ groups, catalog = false, formatCurrency, onToggle, onEdit, onDelete }) {
  return (
    <div className="bw-panel">
      {groups.map((group) => {
        const unit = catalog ? 'schedule' : 'payment';
        return (
          <section className="bw-group" data-status={group.status === 'week' ? 'close' : group.status === 'later' ? 'ok' : 'none'} key={group.key ?? group.status}>
            <header className="bw-group__head">
              <h3>{group.label ?? HEADINGS[group.status]}</h3>
              <span>{group.items.length} {unit}{group.items.length === 1 ? '' : 's'}
                {!catalog && `, ${formatCurrency(group.items.reduce((sum, { amount }) => sum + Number(amount), 0))}`}</span>
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
                      <p className="recurring-row__meta">{describe(payment, catalog)}</p>
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
