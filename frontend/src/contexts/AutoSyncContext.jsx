import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabaseClient';
import { fetchTransactionsFromGoogleSheets, validateTransactions, extractSheetId } from '../lib/importUtils';
import { showNotification, checkBudgetAndNotify, getNotificationPermission } from '../lib/notifications';

const AutoSyncContext = createContext();

export function useAutoSync() {
  return useContext(AutoSyncContext);
}

export function AutoSyncProvider({ children }) {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncInterval, setSyncInterval] = useState(5); // minutes
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [sheetSettings, setSheetSettings] = useState(null);
  const intervalRef = useRef(null);
  const isSyncingRef = useRef(false); // Synchronous guard to prevent race conditions

  // Load settings on mount
  useEffect(() => {
    if (user) {
      loadSettings();
    } else {
      setSheetSettings(null);
      setIsEnabled(false);
    }
  }, [user]);

  // Set up polling interval
  useEffect(() => {
    if (isEnabled && sheetSettings?.google_sheet_url) {
      // Clear existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Run initial sync
      performSync();

      // Set up interval
      intervalRef.current = setInterval(() => {
        performSync();
      }, syncInterval * 60 * 1000); // Convert minutes to ms

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isEnabled, syncInterval, sheetSettings]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('google_sheet_url, google_sheet_name, auto_sync_enabled, sync_interval_minutes')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSheetSettings(data);
        setIsEnabled(data.auto_sync_enabled || false);
        setSyncInterval(data.sync_interval_minutes || 5);
      }
    } catch (err) {
      console.error('Error loading auto-sync settings:', err);
    }
  };

  const performSync = useCallback(async () => {
    // Use synchronous ref check to prevent race conditions
    // (React state updates are async, so two calls can pass state check simultaneously)
    if (!user || !sheetSettings?.google_sheet_url || isSyncingRef.current) return;

    // Set ref immediately (synchronous) to block concurrent calls
    isSyncingRef.current = true;
    setIsSyncing(true);
    setLastSyncResult(null);

    try {
      // Extract sheet ID
      const sheetId = extractSheetId(sheetSettings.google_sheet_url);
      if (!sheetId) {
        throw new Error('Invalid Google Sheet URL');
      }

      // Fetch transactions from Google Sheets
      const rawTransactions = await fetchTransactionsFromGoogleSheets(
        sheetId,
        sheetSettings.google_sheet_name || 'Expenses'
      );

      // Validate transactions
      const validation = validateTransactions(rawTransactions);
      const newTransactions = validation.valid;

      if (newTransactions.length === 0) {
        setLastSyncResult({ success: true, message: 'No transactions found in sheet', imported: 0 });
        setLastSyncTime(new Date());
        return;
      }

      // Get existing transactions to avoid duplicates
      const { data: existingTransactions, error: fetchError } = await supabase
        .from('transactions')
        .select('date, description, amount')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      // Create a set of existing transaction signatures for fast lookup
      // Normalize: uppercase, trim, collapse whitespace, use absolute amounts
      const normalizeDesc = (desc) => (desc || '').toUpperCase().trim().replace(/\s+/g, ' ');
      const normalizeAmount = (amt) => Math.abs(Number(amt)).toFixed(2);

      const existingSet = new Set(
        (existingTransactions || []).map(t =>
          `${t.date}|${normalizeDesc(t.description)}|${normalizeAmount(t.amount)}`
        )
      );

      // Filter out duplicates
      const uniqueTransactions = newTransactions.filter(t => {
        const signature = `${t.date}|${normalizeDesc(t.description)}|${normalizeAmount(t.amount)}`;
        return !existingSet.has(signature);
      });

      if (uniqueTransactions.length === 0) {
        setLastSyncResult({ success: true, message: 'All transactions already imported', imported: 0 });
        setLastSyncTime(new Date());
        return;
      }

      // Categorize transactions
      const categorizedTransactions = await categorizeTransactions(uniqueTransactions);

      // Get or create default account
      let accountId = await getOrCreateAccount();

      // Get category IDs
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id);

      if (catError) throw catError;

      const categoryMap = {};
      categories.forEach(cat => {
        categoryMap[cat.name] = cat.id;
      });

      // Insert transactions
      const transactionsToInsert = categorizedTransactions.map(t => ({
        user_id: user.id,
        account_id: accountId,
        category_id: categoryMap[t.category] || categoryMap['Unexpected'],
        type: 'expense',
        amount: t.amount,
        provider: t.bank || null, // Store bank name in provider field
        description: t.description,
        date: t.date,
      }));

      const { data: insertedTransactions, error: insertError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert)
        .select();

      if (insertError) throw insertError;

      // Send notification for new transactions
      if (insertedTransactions.length > 0 && getNotificationPermission() === 'granted') {
        const totalAmount = insertedTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const formattedTotal = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(totalAmount);

        showNotification('New Transactions Imported', {
          body: `${insertedTransactions.length} transaction${insertedTransactions.length !== 1 ? 's' : ''} imported (${formattedTotal} total)`,
          tag: 'sync-' + Date.now()
        });

        // Check budget limits for each imported transaction
        for (const transaction of insertedTransactions) {
          if (transaction.category_id) {
            await checkBudgetAndNotify(supabase, user.id, transaction.category_id, transaction.amount);
          }
        }
      }

      setLastSyncResult({
        success: true,
        message: `Imported ${insertedTransactions.length} new transaction${insertedTransactions.length !== 1 ? 's' : ''}`,
        imported: insertedTransactions.length,
      });

    } catch (err) {
      console.error('Auto-sync error:', err);
      setLastSyncResult({
        success: false,
        message: err.message,
        imported: 0,
      });
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      setLastSyncTime(new Date());
    }
  }, [user, sheetSettings]);

  const categorizeTransactions = async (transactions) => {
    // Fetch merchant mappings
    const { data: mappings, error } = await supabase
      .from('merchant_mappings')
      .select('transaction_description, category_name')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching mappings:', error);
      return transactions.map(t => ({ ...t, category: 'Unexpected' }));
    }

    // Build lookup array sorted by length (longest first for more specific matches)
    const sortedMappings = (mappings || [])
      .map(m => ({
        pattern: m.transaction_description.toUpperCase(),
        category: m.category_name
      }))
      .sort((a, b) => b.pattern.length - a.pattern.length);

    // Categorize each transaction
    return transactions.map(t => {
      const normalizedDesc = t.description.toUpperCase().trim().replace(/\s+/g, ' ');
      let category = 'Unexpected';

      // Check mappings in order (longest/most specific first)
      for (const mapping of sortedMappings) {
        if (normalizedDesc.includes(mapping.pattern)) {
          category = mapping.category;
          break;
        }
      }

      return { ...t, category };
    });
  };

  const getOrCreateAccount = async () => {
    let { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (accountError) throw accountError;

    if (!accounts || accounts.length === 0) {
      const { data: newAccount, error: createError } = await supabase
        .from('accounts')
        .insert({
          user_id: user.id,
          name: 'Main Account',
          balance: 0,
        })
        .select()
        .single();

      if (createError) throw createError;
      return newAccount.id;
    }

    return accounts[0].id;
  };

  const toggleAutoSync = async (enabled) => {
    setIsEnabled(enabled);

    // Save to database
    try {
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('user_settings')
          .update({ auto_sync_enabled: enabled, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            auto_sync_enabled: enabled,
          });
      }
    } catch (err) {
      console.error('Error saving auto-sync setting:', err);
    }
  };

  const updateSyncInterval = async (minutes) => {
    setSyncInterval(minutes);

    // Save to database
    try {
      await supabase
        .from('user_settings')
        .update({ sync_interval_minutes: minutes, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } catch (err) {
      console.error('Error saving sync interval:', err);
    }
  };

  const value = {
    isEnabled,
    isSyncing,
    lastSyncTime,
    lastSyncResult,
    syncInterval,
    hasConnectedSheet: !!sheetSettings?.google_sheet_url,
    toggleAutoSync,
    updateSyncInterval,
    performSync,
    refreshSettings: loadSettings,
  };

  return (
    <AutoSyncContext.Provider value={value}>
      {children}
    </AutoSyncContext.Provider>
  );
}
