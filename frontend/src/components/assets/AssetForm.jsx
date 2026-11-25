import { useEffect, useState } from 'react';
import DialogFrame from '../DialogFrame';
import { amountField } from './amountField';

const blank = (asset, categories) => ({
  category_id: asset?.category_id || categories[0]?.id || '',
  name: asset?.name || '',
  amount: asset?.amount || 0,
  note: asset?.note || '',
});

// Adding or editing one asset.
export default function AssetForm({ open, onClose, asset, categories, onSave }) {
  const [form, setForm] = useState(() => blank(asset, categories));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (values) => setForm((current) => ({ ...current, ...values }));

  useEffect(() => {
    if (open) {
      setForm(blank(asset, categories));
      setError('');
    }
  }, [open, asset, categories]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Give the asset a name.');
      return;
    }
    setSaving(true);
    await onSave({ ...form, amount: parseFloat(form.amount) || 0 });
    setSaving(false);
    onClose();
  };

  return (
    <DialogFrame open={open} onClose={onClose} title={asset ? 'Edit asset' : 'Add asset'}>
      <form className="bw-form" onSubmit={submit} noValidate>
        {error && <p className="bw-note" data-tone="bad" role="alert">{error}</p>}

        <div className="bw-field">
          <label htmlFor="asset-category">Category</label>
          <select id="asset-category" className="bw-select" value={form.category_id} onChange={(event) => set({ category_id: event.target.value })}>
            {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
          </select>
        </div>

        <div className="bw-field">
          <label htmlFor="asset-name">Name</label>
          <input
            id="asset-name"
            className="bw-input"
            placeholder="Main residence, TD savings"
            value={form.name}
            onChange={(event) => set({ name: event.target.value })}
          />
        </div>

        <div className="bw-field">
          <label htmlFor="asset-amount">Current value</label>
          <input id="asset-amount" className="bw-input" {...amountField(form, set, 'amount')} />
        </div>

        <div className="bw-field">
          <label htmlFor="asset-note">Note, if any</label>
          <input id="asset-note" className="bw-input" value={form.note} onChange={(event) => set({ note: event.target.value })} />
        </div>

        <button type="submit" className="bw-button bw-button--wide" disabled={saving}>
          {saving ? 'Saving…' : asset ? 'Save changes' : 'Add asset'}
        </button>
      </form>
    </DialogFrame>
  );
}
