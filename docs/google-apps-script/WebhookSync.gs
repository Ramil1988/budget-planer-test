/**
 * BudgetWise Google Apps Script - Webhook Sync
 *
 * This script sends new transactions to BudgetWise automatically
 * when rows are added to your Google Sheet.
 *
 * SETUP INSTRUCTIONS:
 *
 * FOR NEW SHEETS (no existing Apps Script code):
 *   1. Open your Google Sheet
 *   2. Go to Extensions → Apps Script
 *   3. Paste this entire file
 *   4. Update the CONFIG section below with your values
 *   5. Click "Save" (Ctrl+S or Cmd+S)
 *   6. Run the "setupTriggers" function once
 *   7. Grant the necessary permissions when prompted
 *
 * FOR SHEETS WITH EXISTING SCRIPTS (e.g., CSV import, Gmail automation):
 *   1. Open your existing Apps Script
 *   2. Add this code BELOW your existing functions
 *   3. Update the CONFIG section with your values
 *   4. Click "Save"
 *   5. Run the "setupTriggers" function once
 *   NOTE: The webhook will automatically sync ANY new rows added to your
 *   sheet, whether from manual entry, CSV import, or email automation.
 *
 * Your sheet should have these columns (in any order):
 * - Date (required)
 * - Description or Sub-Description (required)
 * - Amount (required)
 * - Type (optional: "income" or "expense", defaults to "expense")
 * - Bank (optional: source bank name)
 */

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================
const CONFIG = {
  // Your BudgetWise webhook URL (from the Import Transactions page)
  WEBHOOK_URL: 'YOUR_WEBHOOK_URL_HERE',  // e.g., 'https://your-app.netlify.app/.netlify/functions/google-sheets-webhook'

  // Your User ID (from the Import Transactions page)
  USER_ID: 'YOUR_USER_ID_HERE',

  // Your Webhook Secret (from the Import Transactions page)
  WEBHOOK_SECRET: 'YOUR_WEBHOOK_SECRET_HERE',

  // Name of the sheet tab containing transactions (default: 'Expenses')
  SHEET_NAME: 'Expenses',

  // Number of header rows to skip (default: 1)
  HEADER_ROWS: 1,
};

// ============================================
// TRIGGER SETUP - Run this once
// ============================================

/**
 * Sets up the triggers for automatic syncing.
 * Run this function once after configuring the script.
 */
function setupTriggers() {
  // Remove existing triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  // Create onChange trigger for detecting new rows
  ScriptApp.newTrigger('onSheetChange')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onChange()
    .create();

  // Create onEdit trigger for immediate edits
  ScriptApp.newTrigger('onSheetEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  Logger.log('Triggers set up successfully!');
  Logger.log('The script will now automatically sync new transactions.');
}

/**
 * Removes all triggers (use if you want to disable syncing)
 */
function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  Logger.log('All triggers removed. Automatic syncing is disabled.');
}

// ============================================
// MAIN SYNC LOGIC
// ============================================

/**
 * Called when the spreadsheet changes (rows added, etc.)
 */
function onSheetChange(e) {
  if (e.changeType === 'INSERT_ROW' || e.changeType === 'EDIT') {
    syncRecentRows();
  }
}

/**
 * Called when cells are edited
 */
function onSheetEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME) return;

  const row = e.range.getRow();
  if (row > CONFIG.HEADER_ROWS) {
    syncRow(sheet, row);
  }
}

/**
 * Syncs the most recent rows (called after insert)
 */
function syncRecentRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    Logger.log('Sheet not found: ' + CONFIG.SHEET_NAME);
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastSyncedRow = getLastSyncedRow();

  if (lastRow <= lastSyncedRow) {
    Logger.log('No new rows to sync');
    return;
  }

  // Sync new rows
  const transactions = [];
  for (let row = lastSyncedRow + 1; row <= lastRow; row++) {
    const tx = getTransactionFromRow(sheet, row);
    if (tx) {
      transactions.push(tx);
    }
  }

  if (transactions.length > 0) {
    sendToWebhook(transactions);
    setLastSyncedRow(lastRow);
  }
}

/**
 * Syncs a single row
 */
function syncRow(sheet, row) {
  const tx = getTransactionFromRow(sheet, row);
  if (tx) {
    sendToWebhook([tx]);
  }
}

/**
 * Extracts transaction data from a row
 */
function getTransactionFromRow(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h).toLowerCase().trim());
  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Find column indices
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const subDescIdx = headers.findIndex(h => h.includes('sub-description') || h.includes('sub_description'));
  const descIdx = headers.findIndex(h => h === 'description' || h.includes('merchant') || h.includes('name'));
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('debit') || h.includes('withdrawal'));
  const typeIdx = headers.findIndex(h => h === 'type');
  const bankIdx = headers.findIndex(h => h === 'bank' || h.includes('institution') || h.includes('source'));

  // Validate required columns
  if (dateIdx === -1 || amountIdx === -1 || (subDescIdx === -1 && descIdx === -1)) {
    return null;
  }

  const date = values[dateIdx];
  const subDesc = subDescIdx !== -1 ? values[subDescIdx] : '';
  const desc = descIdx !== -1 ? values[descIdx] : '';
  const description = String(subDesc || desc || '').trim();
  const amount = values[amountIdx];
  const type = typeIdx !== -1 ? String(values[typeIdx]).toLowerCase() : 'expense';
  const bank = bankIdx !== -1 ? values[bankIdx] : '';

  // Skip empty rows
  if (!date || !description || !amount) {
    return null;
  }

  return {
    date: formatDate(date),
    description: description,
    amount: parseAmount(amount),
    type: type === 'income' ? 'income' : 'expense',
    bank: String(bank).trim(),
  };
}

/**
 * Formats date to string
 */
function formatDate(date) {
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(date);
}

/**
 * Parses amount to number
 */
function parseAmount(amount) {
  if (typeof amount === 'number') {
    return Math.abs(amount);
  }
  const cleaned = String(amount)
    .replace(/[$,]/g, '')
    .replace(/[()]/g, '-')
    .trim();
  return Math.abs(parseFloat(cleaned));
}

// ============================================
// WEBHOOK COMMUNICATION
// ============================================

/**
 * Sends transactions to the BudgetWise webhook
 */
function sendToWebhook(transactions) {
  const payload = {
    transactions: transactions,
    userId: CONFIG.USER_ID,
    webhookSecret: CONFIG.WEBHOOK_SECRET,
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      const result = JSON.parse(responseBody);
      Logger.log('Sync successful: ' + result.message);
    } else {
      Logger.log('Sync failed: ' + responseCode + ' - ' + responseBody);
    }
  } catch (error) {
    Logger.log('Sync error: ' + error.message);
  }
}

// ============================================
// STATE MANAGEMENT
// ============================================

/**
 * Gets the last synced row number from script properties
 */
function getLastSyncedRow() {
  const props = PropertiesService.getScriptProperties();
  const value = props.getProperty('lastSyncedRow');
  return value ? parseInt(value) : CONFIG.HEADER_ROWS;
}

/**
 * Saves the last synced row number
 */
function setLastSyncedRow(row) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('lastSyncedRow', String(row));
}

/**
 * Resets the sync state (use if you want to re-sync all rows)
 */
function resetSyncState() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('lastSyncedRow');
  Logger.log('Sync state reset. Next sync will process all rows.');
}

// ============================================
// MANUAL SYNC
// ============================================

/**
 * Manually sync all new rows (run this to force a sync)
 */
function manualSync() {
  syncRecentRows();
}

/**
 * Sync all rows from the beginning (re-imports everything)
 * WARNING: This may create duplicates if transactions already exist
 */
function syncAllRows() {
  resetSyncState();
  syncRecentRows();
}

/**
 * Test the webhook connection
 */
function testConnection() {
  const testPayload = {
    transactions: [],
    userId: CONFIG.USER_ID,
    webhookSecret: CONFIG.WEBHOOK_SECRET,
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(testPayload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      Logger.log('✅ Connection successful! Webhook is working.');
    } else if (responseCode === 401) {
      Logger.log('❌ Authentication failed. Check your USER_ID and WEBHOOK_SECRET.');
    } else {
      Logger.log('❌ Connection failed with status: ' + responseCode);
    }
  } catch (error) {
    Logger.log('❌ Connection error: ' + error.message);
    Logger.log('Check your WEBHOOK_URL is correct.');
  }
}
