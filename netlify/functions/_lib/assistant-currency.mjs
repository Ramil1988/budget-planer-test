// Keep the currency printed on a statement or receipt separate from the CAD amount booked in the ledger.
export function sourceCurrency(label) {
  if (typeof label !== 'string') return null;
  const value = label.trim().toUpperCase();
  if (!value || value === '$') return null;
  if (/^(?:CA\$|C\$|CANADIAN DOLLARS?)$/.test(value)) return 'CAD';
  if (/^(?:US\$|U\.S\. DOLLARS?|US DOLLARS?)$/.test(value)) return 'USD';
  if (/^(?:€|EUROS?)$/.test(value)) return 'EUR';
  if (/^(?:£|POUNDS? STERLING)$/.test(value)) return 'GBP';
  return /^[A-Z]{3}$/.test(value) ? value : 'UNKNOWN';
}
