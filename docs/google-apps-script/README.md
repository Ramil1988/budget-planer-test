# Google Sheets Webhook Integration

This guide explains how to set up real-time sync between your Google Sheet and BudgetWise using webhooks.

## Overview

Instead of polling your Google Sheet every few minutes, the webhook integration sends new transactions to BudgetWise instantly when they're added to your sheet.

**Benefits:**
- Instant updates (1-2 seconds)
- No unnecessary API calls
- More efficient and scalable
- Real-time notifications

## Architecture

```
Google Sheet → Apps Script (onChange) → Netlify Function → Supabase → Frontend (Realtime)
```

## Setup Instructions

### 1. Run Database Migration

First, add the required columns to your database. Run the SQL in `backend/database/migrations/001_add_webhook_secret.sql` in your Supabase SQL editor.

### 2. Set Environment Variables in Netlify

Add these environment variables in your Netlify dashboard (Site settings → Environment variables):

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (found in Project Settings → API)

**Important:** The service role key bypasses Row Level Security, so keep it secret!

### 3. Configure Webhook in BudgetWise

1. Go to **Import Transactions** page
2. Connect your Google Sheet (if not already connected)
3. Switch to **Webhook Mode** tab
4. Click **Generate** to create a webhook secret
5. Copy the **Webhook URL**, **User ID**, and **Webhook Secret**

### 4. Set Up Google Apps Script

**For NEW sheets (no existing script):**
1. Open your Google Sheet
2. Go to **Extensions → Apps Script**
3. Paste the contents of `WebhookSync.gs`
4. Update the `CONFIG` section with your values (see below)
5. Save the script (Ctrl+S / Cmd+S)
6. Run `setupTriggers` once and grant permissions

**For sheets WITH existing scripts (CSV import, Gmail automation, etc.):**
1. Open your existing Apps Script
2. **DO NOT delete your existing code!**
3. Add the webhook code **below** your existing functions
4. Update the `CONFIG` section with your values
5. Save and run `setupTriggers`

The webhook will automatically sync ANY new rows, regardless of how they were added (manual, CSV import, Gmail automation).

**CONFIG values:**
```javascript
const CONFIG = {
  WEBHOOK_URL: 'https://your-app.netlify.app/.netlify/functions/google-sheets-webhook',
  USER_ID: 'your-user-id-here',
  WEBHOOK_SECRET: 'your-webhook-secret-here',
  SHEET_NAME: 'Expenses',
  HEADER_ROWS: 1,
};
```

### 5. Test the Connection

1. In Apps Script, run the `testConnection` function
2. Check the execution log for success/error messages
3. Add a test row to your Google Sheet
4. Verify the transaction appears in BudgetWise

## Google Sheet Format

Your sheet should have these columns (in any order):

| Column | Required | Description |
|--------|----------|-------------|
| Date | Yes | Transaction date (any format) |
| Description or Sub-Description | Yes | Transaction description |
| Amount | Yes | Transaction amount |
| Type | No | "income" or "expense" (defaults to expense) |
| Bank | No | Source bank/institution name |

## Troubleshooting

### "Authentication failed" error
- Verify your User ID and Webhook Secret are correct
- Try regenerating the webhook secret in BudgetWise

### Transactions not syncing
1. Check Apps Script execution logs (View → Execution log)
2. Ensure triggers are set up (`setupTriggers` was run)
3. Verify the sheet name matches `CONFIG.SHEET_NAME`

### Duplicate transactions
- The system automatically detects duplicates based on date, description, and amount
- If you need to re-import, the duplicates will be skipped

### Reset sync state
- Run `resetSyncState` in Apps Script to clear the last synced row
- This allows re-syncing all rows

## Security Notes

- The webhook secret authenticates requests from Google Apps Script
- Keep your webhook secret private
- Regenerating the secret invalidates the old one
- The Netlify function uses Supabase service role key (server-side only)

## Files

- `WebhookSync.gs` - Google Apps Script code to paste into your sheet
- `netlify/functions/google-sheets-webhook.js` - Netlify serverless function
- `backend/database/migrations/001_add_webhook_secret.sql` - Database migration
