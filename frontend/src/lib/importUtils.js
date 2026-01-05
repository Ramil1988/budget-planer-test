// Import utility functions for transactions

/**
 * Extract Sheet ID from a Google Sheets URL
 */
export function extractSheetId(input) {
  if (!input) return null;

  // If it's already a sheet ID (no slashes), return it
  if (!input.includes('/')) {
    return input.trim();
  }

  // Try to extract from URL
  // Format: https://docs.google.com/spreadsheets/d/{SHEET_ID}/...
  const match = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Fetch transactions from Google Sheets using the public CSV export
 */
export async function fetchTransactionsFromGoogleSheets(sheetId, sheetName = 'Expenses') {
  try {
    // Google Sheets public CSV URL
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    return parseCSVText(csvText);
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      throw new Error('Could not access Google Sheet. Make sure it is set to "Anyone with the link can view".');
    }
    throw error;
  }
}

/**
 * Parse CSV text into transaction objects
 */
function parseCSVText(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV file appears to be empty or has no data rows');
  }

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

  // Find column indices
  const dateIdx = headers.findIndex(h => h.includes('date'));
  // Find both sub-description and description columns
  const subDescIdx = headers.findIndex(h => h.includes('sub-description') || h.includes('sub_description'));
  const descIdx = headers.findIndex(h => h === 'description' || h.includes('merchant') || h.includes('name'));
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('debit') || h.includes('withdrawal'));
  // Find bank column (optional)
  const bankIdx = headers.findIndex(h => h === 'bank' || h.includes('bank') || h.includes('institution') || h.includes('source'));

  // Need at least one description column
  const hasDescColumn = subDescIdx !== -1 || descIdx !== -1;
  if (dateIdx === -1 || !hasDescColumn || amountIdx === -1) {
    throw new Error('CSV must have columns for date, description, and amount');
  }

  // Parse data rows
  const transactions = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const maxIdx = Math.max(dateIdx, subDescIdx, descIdx, amountIdx, bankIdx);
    if (values.length <= maxIdx) continue;

    const date = parseDate(values[dateIdx]);
    // Prefer sub-description, fall back to description if empty
    const subDesc = subDescIdx !== -1 ? values[subDescIdx]?.trim() : '';
    const desc = descIdx !== -1 ? values[descIdx]?.trim() : '';
    const description = subDesc || desc || '';
    const amount = parseAmount(values[amountIdx]);
    const bank = bankIdx !== -1 ? values[bankIdx]?.trim() : '';

    if (date && description && !isNaN(amount) && amount > 0) {
      transactions.push({ date, description, amount, bank });
    }
  }

  return transactions;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

/**
 * Parse date string into YYYY-MM-DD format
 * Supports: DD.MM.YYYY, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, and other standard formats
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Remove quotes
  dateStr = dateStr.replace(/"/g, '').trim();

  // Try DD.MM.YYYY format (European with dots) - MUST check first before JS Date parsing
  const dotParts = dateStr.split('.');
  if (dotParts.length === 3) {
    const [day, month, year] = dotParts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    // Validate the parts are numbers
    if (!isNaN(parseInt(day)) && !isNaN(parseInt(month)) && !isNaN(parseInt(fullYear))) {
      return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  // Try DD/MM/YYYY or MM/DD/YYYY format (with slashes)
  const slashParts = dateStr.split('/');
  if (slashParts.length === 3) {
    const [first, second, year] = slashParts;
    const fullYear = year.length === 2 ? `20${year}` : year;

    // Determine if it's DD/MM/YYYY or MM/DD/YYYY
    // If first number > 12, it must be day (European format)
    // Otherwise assume MM/DD/YYYY (American format)
    const firstNum = parseInt(first);
    const secondNum = parseInt(second);

    if (firstNum > 12) {
      // Must be DD/MM/YYYY (European)
      return `${fullYear}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`;
    } else if (secondNum > 12) {
      // Must be MM/DD/YYYY (American)
      return `${fullYear}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
    } else {
      // Ambiguous - assume MM/DD/YYYY (American) for compatibility
      return `${fullYear}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
    }
  }

  // Try YYYY-MM-DD format (ISO)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  // Fallback: try JS Date parsing for other formats
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Parse amount string into number
 */
function parseAmount(amountStr) {
  if (!amountStr) return NaN;

  // Remove quotes, currency symbols, commas
  const cleaned = amountStr
    .replace(/"/g, '')
    .replace(/[$,]/g, '')
    .replace(/[()]/g, '-')  // Treat (100) as -100
    .trim();

  const amount = parseFloat(cleaned);
  return Math.abs(amount); // Return absolute value since we track expenses as positive
}

/**
 * Parse a CSV file
 */
export function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const csvText = event.target.result;
        const transactions = parseCSVText(csvText);
        resolve(transactions);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Validate transactions and separate valid from invalid
 */
export function validateTransactions(transactions) {
  const valid = [];
  const invalid = [];

  transactions.forEach((tx, index) => {
    const errors = [];

    if (!tx.date) errors.push('Missing date');
    if (!tx.description) errors.push('Missing description');
    if (isNaN(tx.amount) || tx.amount <= 0) errors.push('Invalid amount');

    if (errors.length === 0) {
      valid.push(tx);
    } else {
      invalid.push({ ...tx, errors, index });
    }
  });

  return {
    valid,
    invalid,
    validCount: valid.length,
    invalidCount: invalid.length,
  };
}
