import { spaced } from '../../lib/assetsView';

// Props for an amount typed as text: digits and one decimal point, shown spaced by
// thousands ("320 000"), kept as typed while editing and turned into a number on leaving.
export const amountField = (form, set, key) => ({
  type: 'text',
  inputMode: 'decimal',
  placeholder: '0',
  value: spaced(form[key]),
  onChange: (event) => {
    const typed = event.target.value.replace(/\s/g, '');
    if (typed === '' || /^[0-9]*\.?[0-9]*$/.test(typed)) set({ [key]: typed === '' ? 0 : typed });
  },
  onBlur: (event) => set({ [key]: parseFloat(event.target.value.replace(/\s/g, '')) || 0 }),
});
