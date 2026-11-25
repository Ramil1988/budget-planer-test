import { CloseButton, Dialog, Portal } from '@chakra-ui/react';
import { FREQUENCY_CONFIG, MAX_FREQUENCY_INTERVAL, formatDate, formatFrequency } from '../../lib/recurringUtils';

// Express legacy presets in the units offered by the custom editor.
export const customSchedule = (frequency, interval = 1) => ({
  custom_frequency: frequency === 'biweekly' ? 'weekly' : frequency === 'quarterly' ? 'monthly' : frequency,
  frequency_interval: interval * (frequency === 'biweekly' ? 2 : frequency === 'quarterly' ? 3 : 1),
});

const hasMonths = (frequency) => Boolean(FREQUENCY_CONFIG[frequency]?.months);

// Adding or editing one recurring payment.
export default function PaymentForm({ open, editing, form, onChange, categories, schedule, error, saving, onSubmit, onClose }) {
  const set = (values) => onChange({ ...form, ...values });
  const kind = form.type === 'expense' ? 'expense' : 'income';

  return (
    <Dialog.Root open={open} onOpenChange={(event) => !event.open && onClose()}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" />
        <Dialog.Positioner>
          <Dialog.Content
            className="bw-surface bw-dialog"
            bg="var(--bw-paper)"
            color="var(--bw-ink)"
            borderRadius="15px"
            maxW="520px"
            w="92vw"
            maxH="90vh"
            p={0}
          >
            <header className="bw-dialog__head">
              <Dialog.Title asChild>
                <h2 className="bw-dialog__title">{editing ? 'Edit' : 'Add'} recurring {kind}</h2>
              </Dialog.Title>
              <Dialog.CloseTrigger asChild position="static">
                <CloseButton size="sm" color="var(--bw-muted)" _hover={{ bg: 'var(--bw-hover)' }} aria-label="Close" />
              </Dialog.CloseTrigger>
            </header>

            <div className="bw-dialog__body">
              <form className="bw-form" onSubmit={onSubmit}>
                {error && <p className="bw-note" data-tone="bad" role="alert">{error}</p>}

                <div className="bw-segment bw-segment--wide" role="group" aria-label="Type">
                  {[['expense', 'Expense'], ['income', 'Income']].map(([value, label]) => (
                    <button type="button" aria-pressed={form.type === value} onClick={() => set({ type: value, category_id: '' })} key={value}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="bw-field">
                  <label htmlFor="recurring-name">Name</label>
                  <input
                    id="recurring-name"
                    className="bw-input"
                    placeholder="Netflix, Mortgage, Salary"
                    value={form.name}
                    onChange={(event) => set({ name: event.target.value })}
                    required
                  />
                </div>

                <div className="bw-fields">
                  <div className="bw-field">
                    <label htmlFor="recurring-amount">Amount</label>
                    <input
                      id="recurring-amount"
                      className="bw-input"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(event) => set({ amount: event.target.value })}
                      required
                    />
                  </div>
                  <div className="bw-field">
                    <label htmlFor="recurring-category">Category</label>
                    <select
                      id="recurring-category"
                      className="bw-select"
                      value={form.category_id}
                      onChange={(event) => set({ category_id: event.target.value })}
                    >
                      <option value="">No category</option>
                      {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="bw-field">
                  <label htmlFor="recurring-frequency">Frequency</label>
                  <select
                    id="recurring-frequency"
                    className="bw-select"
                    value={form.frequency}
                    onChange={(event) => {
                      const value = event.target.value;
                      set({
                        frequency: value,
                        ...(value === 'custom' ? customSchedule(form.frequency) : {}),
                        last_business_day_of_month: hasMonths(value === 'custom' ? form.frequency : value) && form.last_business_day_of_month,
                      });
                    }}
                  >
                    {Object.entries(FREQUENCY_CONFIG).map(([key, config]) => <option value={key} key={key}>{config.label}</option>)}
                    <option value="custom">Custom...</option>
                  </select>
                  {form.frequency === 'custom' && (
                    <div className="recurring-custom">
                      <label className="bw-field__label" htmlFor="recurring-interval">Repeat every</label>
                      <div className="recurring-custom__row">
                        <input
                          id="recurring-interval"
                          className="bw-input"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={MAX_FREQUENCY_INTERVAL}
                          step={1}
                          required
                          value={form.frequency_interval}
                          onChange={(event) => set({ frequency_interval: event.target.value })}
                        />
                        <select
                          className="bw-select"
                          aria-label="Repeat period"
                          value={form.custom_frequency}
                          onChange={(event) => set({
                            custom_frequency: event.target.value,
                            last_business_day_of_month: hasMonths(event.target.value) && form.last_business_day_of_month,
                          })}
                        >
                          <option value="daily">day(s)</option>
                          <option value="weekly">week(s)</option>
                          <option value="monthly">month(s)</option>
                          <option value="yearly">year(s)</option>
                        </select>
                      </div>
                      <p className="bw-field__hint">Repeats from the start date. Choose a known payment date to keep the right schedule.</p>
                      {schedule.nextDate && (
                        <p aria-live="polite">{formatFrequency(schedule.frequency, schedule.interval)}, next on {formatDate(schedule.nextDate)}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="bw-fields">
                  <div className="bw-field">
                    <label htmlFor="recurring-start">Start date</label>
                    <input
                      id="recurring-start"
                      className="bw-input"
                      type="date"
                      aria-label="Start Date"
                      value={form.start_date}
                      onChange={(event) => set({ start_date: event.target.value })}
                      required
                    />
                  </div>
                  <div className="bw-field">
                    <label htmlFor="recurring-end">End date, if any</label>
                    <input
                      id="recurring-end"
                      className="bw-input"
                      type="date"
                      value={form.end_date}
                      onChange={(event) => set({ end_date: event.target.value })}
                    />
                  </div>
                </div>

                <label className="bw-check">
                  <input type="checkbox" checked={form.business_days_only} onChange={(event) => set({ business_days_only: event.target.checked })} />
                  <b>Business days only</b>
                  <small>A date on a weekend moves to the nearest weekday: Saturday to Friday, Sunday to Monday.</small>
                </label>

                {hasMonths(schedule.frequency) && (
                  <label className="bw-check">
                    <input
                      type="checkbox"
                      checked={form.last_business_day_of_month}
                      onChange={(event) => set({ last_business_day_of_month: event.target.checked })}
                    />
                    <b>Last business day of month</b>
                    <small>Due on the last weekday of each month it is paid in.</small>
                  </label>
                )}

                <label className="bw-check">
                  <input type="checkbox" checked={form.auto_add} onChange={(event) => set({ auto_add: event.target.checked })} />
                  <b>Add to transactions automatically</b>
                  <small>
                    {editing?.auto_add && editing.auto_add_from
                      ? `Recording automatically since ${formatDate(editing.auto_add_from)}.`
                      : 'Records itself when the date arrives. It starts today and leaves past dates alone.'}
                  </small>
                </label>

                {form.auto_add && (
                  <div className="bw-field">
                    <label htmlFor="recurring-match">Bank description</label>
                    <input
                      id="recurring-match"
                      className="bw-input"
                      placeholder="PAYROLL DEP, HYDRO BILL PMT"
                      value={form.match_description}
                      onChange={(event) => set({ match_description: event.target.value })}
                    />
                    <p className="bw-field__hint">
                      Optional. How this payment reads on your statement. If the same amount arrives from the Google Sheets
                      import within a few days, it is not added twice.
                    </p>
                  </div>
                )}

                <div className="bw-field">
                  <label htmlFor="recurring-notes">Notes</label>
                  <input
                    id="recurring-notes"
                    className="bw-input"
                    value={form.notes}
                    onChange={(event) => set({ notes: event.target.value })}
                  />
                </div>

                <button type="submit" className="bw-button bw-button--wide" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : `Add recurring ${kind}`}
                </button>
              </form>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
