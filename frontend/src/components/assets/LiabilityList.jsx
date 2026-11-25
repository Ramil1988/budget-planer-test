import { formatFrequency } from '../../lib/recurringUtils';
import { liabilityPayments, paidOff, payoff } from '../../lib/assetsView';

const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);
const monthYear = (date) => date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
const shortDay = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const timeLeft = (projection) => [
  projection.years > 0 && `${projection.years} ${projection.years === 1 ? 'year' : 'years'}`,
  (projection.remainingMonths > 0 || projection.years === 0) && `${projection.remainingMonths} ${projection.remainingMonths === 1 ? 'month' : 'months'}`,
].filter(Boolean).join(' ');

function Liability({ liability, type, linkedCategory, linkedRecurring, payments, formatCurrency, onEdit, onDelete }) {
  const projection = payoff(liability, linkedRecurring);
  const progress = paidOff(liability);
  const paid = payments?.reduce((total, payment) => total + (parseFloat(payment.amount) || 0), 0) || 0;
  const rate = parseFloat(liability.interest_rate) || 0;
  const toPay = projection.known && !projection.never ? projection.principal + projection.interest : 0;

  return (
    <li className="assets-debt">
      <header className="assets-debt__head">
        <div>
          <h3>{liability.creditor}</h3>
          <p>
            {[type?.name, linkedCategory && `paid from ${linkedCategory.name}`, liability.note].filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="assets-debt__balance">
          <b>{formatCurrency(liability.outstanding_balance)}</b>
          <small>still owed</small>
        </div>
        <div className="assets-row__actions">
          <button type="button" onClick={() => onEdit(liability)} aria-label={`Edit ${liability.creditor}`}>Edit</button>
          <button type="button" data-action="delete" onClick={() => onDelete(liability)} aria-label={`Delete ${liability.creditor}`}>Delete</button>
        </div>
      </header>

      {progress && (
        <div className="assets-debt__progress">
          <div className="assets-ruler" data-tone="good" role="img" aria-label={`${(progress.share * 100).toFixed(1)}% paid off`}>
            <i style={{ width: `${progress.share * 100}%` }} />
          </div>
          <p>
            <b>{(progress.share * 100).toFixed(1)}% paid off</b>: {formatCurrency(progress.paid)} of {formatCurrency(progress.original)}
          </p>
        </div>
      )}

      <dl className="assets-debt__facts">
        <div>
          <dt>Payment</dt>
          <dd>
            {projection.known && projection.scheduled
              ? `${formatCurrency(projection.payment)} ${lowerFirst(formatFrequency(projection.frequency, projection.interval))}`
              : `${formatCurrency(liability.monthly_payment)} a month`}
          </dd>
        </div>
        <div>
          <dt>Interest</dt>
          <dd>{rate > 0 ? `${rate}% a year` : 'None'}</dd>
        </div>
        {projection.known && !projection.never && (
          <>
            <div>
              <dt>Paid off</dt>
              <dd>{monthYear(projection.date)}<small>in {timeLeft(projection)}</small></dd>
            </div>
            <div>
              <dt>Interest still to pay</dt>
              <dd data-tone="bad">{formatCurrency(projection.interest)}</dd>
            </div>
          </>
        )}
      </dl>

      {!projection.known && <p className="assets-debt__note">Add a monthly payment to see when this is paid off.</p>}
      {projection.known && projection.never && (
        <p className="assets-debt__note" data-tone="bad">The payment does not cover the interest, so the balance never goes down.</p>
      )}

      {toPay > 0 && projection.interest > 0 && (
        <div className="assets-debt__cost">
          <div className="assets-debt__split" role="img" aria-label={`Of ${formatCurrency(toPay)} still to pay, ${formatCurrency(projection.interest)} is interest`}>
            <i data-part="principal" style={{ width: `${(projection.principal / toPay) * 100}%` }} />
            <i data-part="interest" style={{ width: `${(projection.interest / toPay) * 100}%` }} />
          </div>
          <p>
            Of the {formatCurrency(toPay)} still to pay, <span data-part="principal">{formatCurrency(projection.principal)} is the debt</span> and
            {' '}<span data-part="interest">{formatCurrency(projection.interest)} is interest</span>.
          </p>
        </div>
      )}

      {linkedCategory && paid > 0 && (
        <div className="assets-debt__payments">
          <p>
            <b>{formatCurrency(paid)}</b> paid in {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
            {liability.start_date ? ` since ${shortDay(liability.start_date)}` : ''}
            {progress && paid > progress.paid + 1 ? `, about ${formatCurrency(paid - progress.paid)} of it interest` : ''}
          </p>
          <ul>
            {payments.slice(0, 3).map((payment) => (
              <li key={payment.id}><span>{shortDay(payment.date)}</span><b>{formatCurrency(payment.amount)}</b></li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

// Every debt with what is owed, how far it is paid off, and when it ends at the current
// payment. The largest balance comes first.
export default function LiabilityList({
  liabilities, types, spendingCategories, recurringPayments, paymentsByCategory, totalLiabilities, formatCurrency, onAdd, onEdit, onDelete,
}) {
  const ordered = [...liabilities].sort((a, b) => (parseFloat(b.outstanding_balance) || 0) - (parseFloat(a.outstanding_balance) || 0));

  return (
    <section className="bw-panel assets-list" aria-labelledby="assets-owed-heading">
      <header className="assets-panel__head">
        <div>
          <h2 id="assets-owed-heading">Liabilities</h2>
          <p>
            {ordered.length === 0
              ? 'No debts recorded'
              : `${ordered.length} ${ordered.length === 1 ? 'debt' : 'debts'}, ${formatCurrency(totalLiabilities)}`}
          </p>
        </div>
        <button type="button" className="bw-button bw-button--quiet" onClick={onAdd}>Add liability</button>
      </header>
      {ordered.length === 0 ? (
        <p className="bw-nothing">Nothing owed. Add a mortgage, a loan or a card balance to track it here.</p>
      ) : (
        <ul className="assets-debts">
          {ordered.map((liability) => {
            const linkedCategory = liability.linked_category_id
              ? spendingCategories.find(({ id }) => id === liability.linked_category_id)
              : null;
            return (
              <Liability
                liability={liability}
                type={types.find(({ id }) => id === liability.type_id)}
                linkedCategory={linkedCategory}
                linkedRecurring={liability.linked_category_id
                  ? recurringPayments.find((payment) => payment.category_id === liability.linked_category_id && payment.is_active && payment.type === 'expense')
                  : null}
                payments={liabilityPayments(liability, paymentsByCategory)}
                formatCurrency={formatCurrency}
                onEdit={onEdit}
                onDelete={onDelete}
                key={liability.id}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
