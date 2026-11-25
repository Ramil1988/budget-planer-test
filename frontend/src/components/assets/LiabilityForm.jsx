import { useEffect, useState } from 'react';
import { getMonthlyEquivalent } from '../../lib/recurringUtils';
import { formatDay } from '../../lib/assetsView';
import { today } from '../../lib/transactionView';
import DialogFrame from '../DialogFrame';
import { amountField } from './amountField';


const blank = (liability, types) => ({
  type_id: liability?.type_id || types[0]?.id || '',
  creditor: liability?.creditor || '',
  outstanding_balance: liability?.outstanding_balance || 0,
  monthly_payment: liability?.monthly_payment || 0,
  interest_rate: liability?.interest_rate || 0,
  original_balance: liability?.original_balance || liability?.outstanding_balance || 0,
  linked_category_id: liability?.linked_category_id || '',
  start_date: liability?.start_date || today(),
  note: liability?.note || '',
});

// Adding or editing one debt. Linking it to a spending category makes payments recorded
// in that category bring the balance down, after the interest they cover. A balance typed
// here is taken as true from that moment (see 011_liability_interest.sql).
export default function LiabilityForm({ open, onClose, liability, types, spendingCategories, recurringPayments, formatCurrency, onSave }) {
  const [form, setForm] = useState(() => blank(liability, types));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Whether the monthly payment was taken from a recurring payment and not typed.
  const [filled, setFilled] = useState(false);
  const set = (values) => setForm((current) => ({ ...current, ...values }));

  useEffect(() => {
    if (open) {
      setForm(blank(liability, types));
      setError('');
      setFilled(false);
    }
  }, [open, liability, types]);

  const recurringFor = (categoryId) => recurringPayments.find(
    (payment) => payment.category_id === categoryId && payment.is_active && payment.type === 'expense',
  );
  const monthlyOf = (payment) => getMonthlyEquivalent(payment.amount, payment.frequency, payment.frequency_interval);
  const linked = form.linked_category_id ? recurringFor(form.linked_category_id) : null;

  // Linking a category brings in the amount of its recurring payment, unless one was typed.
  const link = (categoryId) => {
    const values = { linked_category_id: categoryId };
    const recurring = categoryId ? recurringFor(categoryId) : null;
    if (recurring && recurring.amount > 0 && (form.monthly_payment === 0 || filled)) {
      values.monthly_payment = Math.round(monthlyOf(recurring) * 100) / 100;
      setFilled(true);
    }
    set(values);
  };

  const submit = async (event) => {
    event.preventDefault();
    const rate = parseFloat(form.interest_rate) || 0;
    if (!form.creditor.trim()) {
      setError('Say who the debt is owed to.');
      return;
    }
    if (rate > 100) {
      setError('The interest rate is between 0 and 100%.');
      return;
    }
    setSaving(true);
    await onSave({
      ...form,
      outstanding_balance: parseFloat(form.outstanding_balance) || 0,
      original_balance: parseFloat(form.original_balance) || 0,
      monthly_payment: parseFloat(form.monthly_payment) || 0,
      interest_rate: rate,
      linked_category_id: form.linked_category_id || null,
      start_date: form.start_date || null,
    });
    setSaving(false);
    onClose();
  };

  const payment = amountField(form, set, 'monthly_payment');

  return (
    <DialogFrame open={open} onClose={onClose} title={liability ? 'Edit liability' : 'Add liability'}>
      <form className="bw-form" onSubmit={submit} noValidate>
        {error && <p className="bw-note" data-tone="bad" role="alert">{error}</p>}

        <div className="bw-fields">
          <div className="bw-field">
            <label htmlFor="liability-type">Type</label>
            <select id="liability-type" className="bw-select" value={form.type_id} onChange={(event) => set({ type_id: event.target.value })}>
              {types.map((type) => <option value={type.id} key={type.id}>{type.name}</option>)}
            </select>
          </div>
          <div className="bw-field">
            <label htmlFor="liability-creditor">Owed to</label>
            <input
              id="liability-creditor"
              className="bw-input"
              placeholder="TD Bank, Honda Finance"
              value={form.creditor}
              onChange={(event) => set({ creditor: event.target.value })}
            />
          </div>
        </div>

        <div className="bw-fields">
          <div className="bw-field">
            <label htmlFor="liability-balance">Still owed</label>
            <input id="liability-balance" className="bw-input" {...amountField(form, set, 'outstanding_balance')} />
            {liability?.linked_category_id && (
              <p className="bw-field__hint">Type your lender's figure to bring it in line. Later payments are applied on top of it.</p>
            )}
          </div>
          <div className="bw-field">
            <label htmlFor="liability-original">Borrowed at the start</label>
            <input id="liability-original" className="bw-input" {...amountField(form, set, 'original_balance')} />
          </div>
        </div>

        <div className="bw-field">
          <label htmlFor="liability-link">Paid from spending category</label>
          <select id="liability-link" className="bw-select" value={form.linked_category_id} onChange={(event) => link(event.target.value)}>
            <option value="">Not linked: I update the balance myself</option>
            {spendingCategories.map((category) => {
              const recurring = recurringFor(category.id);
              return (
                <option value={category.id} key={category.id}>
                  {category.name}{recurring ? ` (${formatCurrency(monthlyOf(recurring))} a month)` : ''}
                </option>
              );
            })}
          </select>
          {form.linked_category_id && (
            <p className="bw-field__hint">
              A payment recorded in this category first covers the interest since the last one; the rest brings the balance down.
              {linked?.end_date && ` Its recurring payment ends on ${formatDay(linked.end_date)}.`}
              {linked && !linked.end_date && ' Its recurring payment has no end date.'}
            </p>
          )}
        </div>

        <div className="bw-fields">
          <div className="bw-field">
            <label htmlFor="liability-payment">Monthly payment</label>
            <input
              id="liability-payment"
              className="bw-input"
              {...payment}
              onChange={(event) => { payment.onChange(event); setFilled(false); }}
            />
            {filled && <p className="bw-field__hint">Taken from the recurring payment.</p>}
          </div>
          <div className="bw-field">
            <label htmlFor="liability-rate">Interest, % a year</label>
            <input
              id="liability-rate"
              className="bw-input"
              type="text"
              inputMode="decimal"
              placeholder="8.9"
              value={form.interest_rate === 0 ? '' : form.interest_rate}
              onChange={(event) => {
                const typed = event.target.value;
                if (typed === '' || /^[0-9]*\.?[0-9]*$/.test(typed)) set({ interest_rate: typed === '' ? 0 : typed });
              }}
              onBlur={(event) => set({ interest_rate: parseFloat(event.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="bw-field">
          <label htmlFor="liability-start">Start date</label>
          <input id="liability-start" className="bw-input" type="date" value={form.start_date} onChange={(event) => set({ start_date: event.target.value })} />
          <p className="bw-field__hint">Only payments from this date on count towards this debt.</p>
        </div>

        <div className="bw-field">
          <label htmlFor="liability-note">Note, if any</label>
          <input id="liability-note" className="bw-input" value={form.note} onChange={(event) => set({ note: event.target.value })} />
        </div>

        <button type="submit" className="bw-button bw-button--wide" disabled={saving}>
          {saving ? 'Saving…' : liability ? 'Save changes' : 'Add liability'}
        </button>
      </form>
    </DialogFrame>
  );
}
