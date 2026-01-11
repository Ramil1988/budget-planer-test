// Netlify Function: Google Sheets Webhook
// Receives transaction data from Google Apps Script when new rows are added

import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role key for bypassing RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper: Normalize description for duplicate detection
const normalizeDesc = (desc) => (desc || '').toUpperCase().trim().replace(/\s+/g, ' ');

// Helper: Normalize amount for duplicate detection
const normalizeAmount = (amt) => Math.abs(Number(amt)).toFixed(2);

// Helper: Create transaction signature for duplicate detection
const createSignature = (tx) => `${tx.date}|${normalizeDesc(tx.description)}|${normalizeAmount(tx.amount)}`;

// Helper: Parse date string into YYYY-MM-DD format
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Remove quotes
  dateStr = String(dateStr).replace(/"/g, '').trim();

  // Try DD.MM.YYYY format (European with dots)
  const dotParts = dateStr.split('.');
  if (dotParts.length === 3) {
    const [day, month, year] = dotParts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    if (!isNaN(parseInt(day)) && !isNaN(parseInt(month)) && !isNaN(parseInt(fullYear))) {
      return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  // Try DD/MM/YYYY or MM/DD/YYYY format
  const slashParts = dateStr.split('/');
  if (slashParts.length === 3) {
    const [first, second, year] = slashParts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const firstNum = parseInt(first);
    const secondNum = parseInt(second);

    if (firstNum > 12) {
      return `${fullYear}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`;
    } else if (secondNum > 12) {
      return `${fullYear}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
    } else {
      return `${fullYear}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`;
    }
  }

  // Try YYYY-MM-DD format (ISO)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  // Fallback: try JS Date parsing
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
}

// Helper: Parse amount string into number
function parseAmount(amountStr) {
  if (!amountStr) return NaN;

  const cleaned = String(amountStr)
    .replace(/"/g, '')
    .replace(/[$,]/g, '')
    .replace(/[()]/g, '-')
    .trim();

  const amount = parseFloat(cleaned);
  return Math.abs(amount);
}

// Helper: Categorize transactions using merchant mappings
async function categorizeTransactions(transactions, userId) {
  // Fetch merchant mappings
  const { data: mappings, error: mappingsError } = await supabase
    .from('merchant_mappings')
    .select('transaction_description, category_name')
    .eq('user_id', userId);

  if (mappingsError) {
    console.error('Error fetching mappings:', mappingsError);
    return transactions.map(t => ({ ...t, category: t.type === 'income' ? null : 'Unexpected' }));
  }

  // Fetch categories
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('name, type')
    .eq('user_id', userId);

  if (catError) {
    console.error('Error fetching categories:', catError);
    return transactions.map(t => ({ ...t, category: t.type === 'income' ? null : 'Unexpected' }));
  }

  // Build category sets
  const incomeCategoryNames = new Set(categories.filter(c => c.type === 'income').map(c => c.name));
  const expenseCategoryNames = new Set(categories.filter(c => c.type === 'expense').map(c => c.name));

  // Build mapping arrays
  const expenseMappings = [];
  const incomeMappings = [];

  (mappings || []).forEach(m => {
    const mapping = { pattern: m.transaction_description.toUpperCase(), category: m.category_name };
    if (incomeCategoryNames.has(m.category_name)) {
      incomeMappings.push(mapping);
    } else if (expenseCategoryNames.has(m.category_name)) {
      expenseMappings.push(mapping);
    }
  });

  // Sort by pattern length (longest first)
  expenseMappings.sort((a, b) => b.pattern.length - a.pattern.length);
  incomeMappings.sort((a, b) => b.pattern.length - a.pattern.length);

  // Categorize each transaction
  return transactions.map(t => {
    const normalizedDesc = t.description.toUpperCase().trim().replace(/\s+/g, ' ');
    const isIncome = t.type === 'income';
    const mappingsToUse = isIncome ? incomeMappings : expenseMappings;
    let category = isIncome ? null : 'Unexpected';

    for (const mapping of mappingsToUse) {
      if (normalizedDesc.includes(mapping.pattern)) {
        category = mapping.category;
        break;
      }
    }

    return { ...t, category };
  });
}

// Helper: Get or create default account
async function getOrCreateAccount(userId) {
  const { data: accounts, error: accountError } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (accountError) throw accountError;

  if (!accounts || accounts.length === 0) {
    const { data: newAccount, error: createError } = await supabase
      .from('accounts')
      .insert({ user_id: userId, name: 'Main Account', balance: 0 })
      .select()
      .single();

    if (createError) throw createError;
    return newAccount.id;
  }

  return accounts[0].id;
}

export async function handler(event) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = JSON.parse(event.body);
    const { transactions, userId, webhookSecret } = body;

    // Validate required fields
    if (!userId || !webhookSecret) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId or webhookSecret' }),
      };
    }

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No transactions provided' }),
      };
    }

    // Verify webhook secret
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('webhook_secret')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'User settings not found' }),
      };
    }

    if (settings.webhook_secret !== webhookSecret) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid webhook secret' }),
      };
    }

    // Parse and validate transactions
    const validTransactions = transactions
      .map(tx => ({
        date: parseDate(tx.date),
        description: String(tx.description || '').trim(),
        amount: parseAmount(tx.amount),
        bank: String(tx.bank || '').trim(),
        type: String(tx.type || 'expense').toLowerCase() === 'income' ? 'income' : 'expense',
      }))
      .filter(tx => tx.date && tx.description && !isNaN(tx.amount) && tx.amount > 0);

    if (validTransactions.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, imported: 0, message: 'No valid transactions' }),
      };
    }

    // Get existing transactions to avoid duplicates
    const { data: existingTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('date, description, amount')
      .eq('user_id', userId);

    if (fetchError) throw fetchError;

    // Create set of existing signatures
    const existingSet = new Set(
      (existingTransactions || []).map(t => createSignature(t))
    );

    // Filter out duplicates
    const uniqueTransactions = validTransactions.filter(t => !existingSet.has(createSignature(t)));

    if (uniqueTransactions.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, imported: 0, message: 'All transactions already exist' }),
      };
    }

    // Categorize transactions
    const categorizedTransactions = await categorizeTransactions(uniqueTransactions, userId);

    // Get or create account
    const accountId = await getOrCreateAccount(userId);

    // Fetch categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', userId);

    if (catError) throw catError;

    const expenseCategoryMap = {};
    const incomeCategoryMap = {};
    categories.forEach(cat => {
      if (cat.type === 'income') {
        incomeCategoryMap[cat.name] = cat.id;
      } else {
        expenseCategoryMap[cat.name] = cat.id;
      }
    });

    // Find or create default income category
    let defaultIncomeCategoryId = null;
    const defaultIncomeCategory = categories.find(c => c.type === 'income');

    if (defaultIncomeCategory) {
      defaultIncomeCategoryId = defaultIncomeCategory.id;
    } else {
      const hasIncome = categorizedTransactions.some(t => t.type === 'income');
      if (hasIncome) {
        const { data: newCategory, error: createCatError } = await supabase
          .from('categories')
          .insert({ user_id: userId, name: 'Other Income', type: 'income' })
          .select()
          .single();

        if (!createCatError) {
          defaultIncomeCategoryId = newCategory.id;
        }
      }
    }

    // Prepare transactions for insert
    const transactionsToInsert = categorizedTransactions.map(t => {
      const isIncome = t.type === 'income';
      let categoryId;

      if (isIncome) {
        categoryId = t.category ? incomeCategoryMap[t.category] : null;
        if (!categoryId) categoryId = defaultIncomeCategoryId;
      } else {
        categoryId = expenseCategoryMap[t.category] || expenseCategoryMap['Unexpected'];
      }

      return {
        user_id: userId,
        account_id: accountId,
        category_id: categoryId,
        type: isIncome ? 'income' : 'expense',
        amount: t.amount,
        provider: t.bank || null,
        description: t.description,
        date: t.date,
      };
    });

    // Insert transactions
    const { data: insertedTransactions, error: insertError } = await supabase
      .from('transactions')
      .insert(transactionsToInsert)
      .select();

    if (insertError) throw insertError;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        imported: insertedTransactions.length,
        message: `Imported ${insertedTransactions.length} transaction(s)`,
      }),
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
