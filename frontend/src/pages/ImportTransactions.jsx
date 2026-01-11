import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  VStack,
  HStack,
  Text,
  Stack,
  Table,
  Badge,
  Switch,
  IconButton,
  Tabs,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useAutoSync } from '../contexts/AutoSyncContext';
import PageContainer from '../components/PageContainer';
import { fetchTransactionsFromGoogleSheets, parseCSVFile, validateTransactions, extractSheetId } from '../lib/importUtils';
import { supabase } from '../lib/supabaseClient';
import { showNotification, checkBudgetAndNotify, getNotificationPermission } from '../lib/notifications';
import { useDarkModeColors } from '../lib/useDarkModeColors';

export default function ImportTransactions() {
  const { user } = useAuth();
  const colors = useDarkModeColors();
  const {
    isEnabled: autoSyncEnabled,
    isSyncing,
    lastSyncTime,
    lastSyncResult,
    syncInterval,
    toggleAutoSync,
    updateSyncInterval,
    performSync,
    refreshSettings: refreshAutoSync,
    // Webhook/Realtime sync
    realtimeEnabled,
    webhookSecret,
    toggleRealtimeMode,
    generateWebhookSecret,
    getWebhookUrl,
    userId,
  } = useAutoSync();

  // Webhook setup state
  const [copiedField, setCopiedField] = useState(null);

  // Sheet configuration state
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('Expenses');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [hasConnectedSheet, setHasConnectedSheet] = useState(false);

  // Import state
  const [csvFile, setCsvFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [importStats, setImportStats] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    if (user) {
      loadSavedSettings();
    }
  }, [user]);

  const loadSavedSettings = async () => {
    setSettingsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('user_settings')
        .select('google_sheet_url, google_sheet_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data?.google_sheet_url) {
        setSheetUrl(data.google_sheet_url);
        setSheetName(data.google_sheet_name || 'Expenses');
        setHasConnectedSheet(true);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  // Save sheet configuration
  const saveSheetSettings = async () => {
    if (!sheetUrl.trim()) {
      setError('Please enter a Google Sheet URL');
      return;
    }

    setSavingSettings(true);
    setError('');
    setSuccess('');

    try {
      // Validate URL by extracting sheet ID
      const extractedId = extractSheetId(sheetUrl);
      if (!extractedId) {
        throw new Error('Invalid Google Sheet URL. Please paste the full URL from your browser.');
      }

      // Check if settings exist
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({
            google_sheet_url: sheetUrl,
            google_sheet_name: sheetName,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (updateError) throw updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            google_sheet_url: sheetUrl,
            google_sheet_name: sheetName,
          });

        if (insertError) throw insertError;
      }

      setHasConnectedSheet(true);
      setSuccess('Sheet connected successfully!');
      setTimeout(() => setSuccess(''), 3000);

      // Refresh auto-sync settings
      refreshAutoSync();
    } catch (err) {
      setError('Failed to save settings: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Fetch merchant mappings from Supabase and categorize transactions
  const categorizeTransactionsFromDB = async (transactions) => {
    // Fetch all merchant mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from('merchant_mappings')
      .select('transaction_description, category_name')
      .eq('user_id', user.id);

    if (mappingsError) {
      console.error('Error fetching merchant mappings:', mappingsError);
      throw mappingsError;
    }

    // Fetch all categories to know which are income vs expense
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('name, type')
      .eq('user_id', user.id);

    if (catError) {
      console.error('Error fetching categories:', catError);
      throw catError;
    }

    // Build separate maps for expense and income category names
    const incomeCategoryNames = new Set(
      categories.filter(c => c.type === 'income').map(c => c.name)
    );
    const expenseCategoryNames = new Set(
      categories.filter(c => c.type === 'expense').map(c => c.name)
    );

    // Build separate lookup maps for expense and income mappings
    const expenseMappingLookup = {};
    const incomeMappingLookup = {};

    (mappings || []).forEach(mapping => {
      const key = mapping.transaction_description.toUpperCase();
      const categoryName = mapping.category_name;

      if (incomeCategoryNames.has(categoryName)) {
        incomeMappingLookup[key] = categoryName;
      } else if (expenseCategoryNames.has(categoryName)) {
        expenseMappingLookup[key] = categoryName;
      }
    });

    // Categorize each transaction using substring matching
    return transactions.map(transaction => {
      const isIncome = transaction.type === 'income';
      const lookupMap = isIncome ? incomeMappingLookup : expenseMappingLookup;
      const defaultCategory = isIncome ? null : 'Unexpected'; // null for income = use default income category
      const category = categorizeTransaction(transaction.description, lookupMap, defaultCategory);
      return {
        ...transaction,
        category,
      };
    });
  };

  // Categorize a single transaction using substring matching
  const categorizeTransaction = (description, mappingLookup, defaultCategory = 'Unexpected') => {
    if (!description || typeof description !== 'string') {
      return defaultCategory;
    }

    const normalizedDesc = description.toUpperCase().trim().replace(/\s+/g, ' ');

    for (const [merchantName, categoryName] of Object.entries(mappingLookup)) {
      if (normalizedDesc.includes(merchantName)) {
        return categoryName;
      }
    }

    return defaultCategory;
  };

  // Calculate category statistics
  const getCategoryStats = (transactions) => {
    const stats = {};

    transactions.forEach(transaction => {
      const category = transaction.category || 'Unexpected';
      if (!stats[category]) {
        stats[category] = {
          count: 0,
          total: 0,
        };
      }
      stats[category].count++;
      stats[category].total += parseFloat(transaction.amount) || 0;
    });

    return stats;
  };

  // Handle manual sync from connected sheet
  const handleManualSync = async () => {
    if (!sheetUrl) {
      setError('No Google Sheet connected. Please add one above.');
      return;
    }

    setLoading(true);
    setError('');
    setTransactions([]);

    try {
      const extractedId = extractSheetId(sheetUrl);
      if (!extractedId) {
        throw new Error('Invalid Google Sheet URL');
      }

      const rawTransactions = await fetchTransactionsFromGoogleSheets(extractedId, sheetName);
      const validation = validateTransactions(rawTransactions);

      if (validation.invalidCount > 0) {
        setError(`Found ${validation.invalidCount} invalid transactions. Showing ${validation.validCount} valid ones.`);
      }

      const categorized = await categorizeTransactionsFromDB(validation.valid);
      setTransactions(categorized);

      const stats = getCategoryStats(categorized);
      setImportStats({
        total: categorized.length,
        totalAmount: categorized.reduce((sum, t) => sum + t.amount, 0),
        categories: stats,
      });
    } catch (err) {
      setError(err.message);
      console.error('Import error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle CSV file upload
  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setLoading(true);
    setError('');
    setTransactions([]);

    try {
      const rawTransactions = await parseCSVFile(file);
      const validation = validateTransactions(rawTransactions);

      if (validation.invalidCount > 0) {
        setError(`Found ${validation.invalidCount} invalid transactions. Showing ${validation.validCount} valid ones.`);
      }

      const categorized = await categorizeTransactionsFromDB(validation.valid);
      setTransactions(categorized);

      const stats = getCategoryStats(categorized);
      setImportStats({
        total: categorized.length,
        totalAmount: categorized.reduce((sum, t) => sum + t.amount, 0),
        categories: stats,
      });
    } catch (err) {
      setError(err.message);
      console.error('CSV parse error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle save to database
  const handleSaveTransactions = async () => {
    if (transactions.length === 0) {
      setError('No transactions to save');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get or create default account
      let { data: accounts, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (accountError) throw accountError;

      let accountId;
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
        accountId = newAccount.id;
      } else {
        accountId = accounts[0].id;
      }

      // Get category IDs - fetch both expense and income categories
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('user_id', user.id);

      if (catError) throw catError;

      // Separate expense and income category maps
      const expenseCategoryMap = {};
      const incomeCategoryMap = {};
      categories.forEach(cat => {
        if (cat.type === 'income') {
          incomeCategoryMap[cat.name] = cat.id;
        } else {
          expenseCategoryMap[cat.name] = cat.id;
        }
      });

      // Find or create default income category for income transactions
      let defaultIncomeCategoryId = null;
      const defaultIncomeCategory = categories.find(c => c.type === 'income');

      if (defaultIncomeCategory) {
        defaultIncomeCategoryId = defaultIncomeCategory.id;
      } else {
        // Check if we have any income transactions that need an income category
        const hasIncomeTransactions = uniqueTransactions.some(t => t.type === 'income');
        if (hasIncomeTransactions) {
          // Create a default "Other Income" category
          const { data: newCategory, error: createCatError } = await supabase
            .from('categories')
            .insert({
              user_id: user.id,
              name: 'Other Income',
              type: 'income',
            })
            .select()
            .single();

          if (createCatError) {
            console.error('Error creating income category:', createCatError);
          } else {
            defaultIncomeCategoryId = newCategory.id;
            incomeCategoryMap['Other Income'] = newCategory.id;
          }
        }
      }

      // Check for duplicates - get existing transactions
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
      const uniqueTransactions = transactions.filter(t => {
        const signature = `${t.date}|${normalizeDesc(t.description)}|${normalizeAmount(t.amount)}`;
        return !existingSet.has(signature);
      });

      const duplicateCount = transactions.length - uniqueTransactions.length;

      if (uniqueTransactions.length === 0) {
        setError(`All ${transactions.length} transactions already exist in the database.`);
        setLoading(false);
        return;
      }

      if (duplicateCount > 0) {
        setError(`Skipped ${duplicateCount} duplicate transaction(s). Importing ${uniqueTransactions.length} new ones.`);
      }

      // Prepare and insert transactions
      const transactionsToInsert = uniqueTransactions.map(t => {
        const isIncome = t.type === 'income';
        let categoryId;

        if (isIncome) {
          // For income transactions, use income category from merchant mapping if available
          // Otherwise fall back to default income category
          categoryId = t.category ? incomeCategoryMap[t.category] : null;
          if (!categoryId) {
            categoryId = defaultIncomeCategoryId;
          }
        } else {
          // For expense transactions, use expense category map with merchant matching
          categoryId = expenseCategoryMap[t.category] || expenseCategoryMap['Unexpected'];
        }

        return {
          user_id: user.id,
          account_id: accountId,
          category_id: categoryId,
          type: isIncome ? 'income' : 'expense',
          amount: t.amount,
          provider: t.bank || null, // Store bank name in provider field
          description: t.description,
          date: t.date,
        };
      });

      const { data: insertedTransactions, error: insertError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert)
        .select();

      if (insertError) throw insertError;

      // Send notification for imported transactions
      if (insertedTransactions.length > 0 && getNotificationPermission() === 'granted') {
        const totalAmount = insertedTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const formattedTotal = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(totalAmount);

        showNotification('Transactions Imported', {
          body: `${insertedTransactions.length} transaction${insertedTransactions.length !== 1 ? 's' : ''} saved (${formattedTotal} total)`,
          tag: 'import-' + Date.now()
        });

        // Check budget limits for each imported transaction
        for (const transaction of insertedTransactions) {
          if (transaction.category_id) {
            await checkBudgetAndNotify(supabase, user.id, transaction.category_id, transaction.amount);
          }
        }
      }

      setSuccess(`Successfully saved ${insertedTransactions.length} transactions!`);
      setTimeout(() => setSuccess(''), 3000);
      setTransactions([]);
      setImportStats(null);
    } catch (err) {
      setError(err.message);
      console.error('Save error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <VStack gap={8} align="stretch" w="100%">
          <Box>
            <Heading size="2xl" color={colors.textPrimary}>Import Transactions</Heading>
            <Text color={colors.textSecondary} mt={2}>
              Connect your Google Sheet for automatic syncing or import from CSV
            </Text>
          </Box>

        {/* Messages */}
        {error && (
          <Box p={4} bg={colors.dangerBg} borderRadius="md" borderColor={colors.dangerBorder} borderWidth="1px">
            <Text color={colors.danger}>{error}</Text>
          </Box>
        )}
        {success && (
          <Box p={4} bg={colors.successBg} borderRadius="md" borderColor={colors.successBorder} borderWidth="1px">
            <Text color={colors.success}>{success}</Text>
          </Box>
        )}

        {/* Google Sheet Configuration */}
        <Box p={6} borderWidth="1px" borderColor={colors.borderColor} borderRadius="lg" bg={colors.cardBg}>
          <Heading size="lg" mb={4} color={colors.textPrimary}>
            Google Sheet Connection
          </Heading>
          <Text color={colors.textSecondary} mb={6}>
            Connect your Google Sheet to sync transactions. The sheet must be publicly accessible (Share → Anyone with the link can view).
          </Text>

          <VStack gap={4} align="stretch">
            <Box>
              <Text fontWeight="medium" mb={2} color={colors.textPrimary}>Google Sheets URL</Text>
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => {
                  setSheetUrl(e.target.value);
                  if (hasConnectedSheet) setHasConnectedSheet(false);
                }}
                size="lg"
                bg={colors.cardBg}
                borderColor={colors.borderColor}
                color={colors.textPrimary}
              />
            </Box>

            <Box>
              <Text fontWeight="medium" mb={2} color={colors.textPrimary}>Sheet Name (Tab)</Text>
              <Input
                placeholder="Expenses"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                size="lg"
                bg={colors.cardBg}
                borderColor={colors.borderColor}
                color={colors.textPrimary}
              />
              <Text fontSize="sm" color={colors.textMuted} mt={1}>
                The name of the tab containing your transactions (default: Expenses)
              </Text>
            </Box>

            <HStack justify="flex-end" pt={2}>
              <Button
                colorScheme="blue"
                size="lg"
                onClick={saveSheetSettings}
                isLoading={savingSettings}
                loadingText="Saving..."
              >
                {hasConnectedSheet ? 'Update Connection' : 'Connect Sheet'}
              </Button>
            </HStack>
          </VStack>
        </Box>

        {/* Sync Settings - Only show when sheet is connected */}
        {hasConnectedSheet && (
          <Box p={6} borderWidth="1px" borderColor={colors.borderColor} borderRadius="lg" bg={colors.cardBg}>
            <Heading size="lg" mb={4} color={colors.textPrimary}>
              Sync Settings
            </Heading>

            {/* Sync Mode Tabs */}
            <Tabs.Root defaultValue={realtimeEnabled ? 'webhook' : 'polling'} mb={6}>
              <Tabs.List>
                <Tabs.Trigger
                  value="polling"
                  onClick={() => realtimeEnabled && toggleRealtimeMode(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px 0 0 8px',
                    border: `1px solid ${colors.borderColor}`,
                    backgroundColor: !realtimeEnabled ? colors.primaryBg : colors.cardBg,
                    color: colors.textPrimary,
                    cursor: 'pointer',
                  }}
                >
                  Polling Mode
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="webhook"
                  onClick={() => !realtimeEnabled && toggleRealtimeMode(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '0 8px 8px 0',
                    border: `1px solid ${colors.borderColor}`,
                    borderLeft: 'none',
                    backgroundColor: realtimeEnabled ? colors.primaryBg : colors.cardBg,
                    color: colors.textPrimary,
                    cursor: 'pointer',
                  }}
                >
                  Webhook Mode (Recommended)
                </Tabs.Trigger>
              </Tabs.List>

              {/* Polling Mode Content */}
              <Tabs.Content value="polling">
                <Box mt={4}>
                  <Text color={colors.textSecondary} mb={4}>
                    Periodically check for new transactions. Simple but less efficient.
                  </Text>

                  <VStack gap={4} align="stretch">
                    {/* Enable/Disable Toggle */}
                    <HStack justify="space-between">
                      <Box>
                        <Text fontWeight="medium" color={colors.textPrimary}>Enable Auto-Sync</Text>
                        <Text fontSize="sm" color={colors.textMuted}>
                          Automatically import new transactions
                        </Text>
                      </Box>
                      <Switch.Root
                        checked={autoSyncEnabled}
                        onCheckedChange={(e) => toggleAutoSync(e.checked)}
                      >
                        <Switch.HiddenInput />
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Root>
                    </HStack>

                    {/* Sync Interval */}
                    <Box>
                      <Text fontWeight="medium" mb={2} color={colors.textPrimary}>Sync Interval</Text>
                      <select
                        value={syncInterval}
                        onChange={(e) => updateSyncInterval(Number(e.target.value))}
                        disabled={!autoSyncEnabled}
                        style={{
                          padding: '12px',
                          fontSize: '16px',
                          borderRadius: '8px',
                          border: `1px solid ${colors.borderColor}`,
                          backgroundColor: autoSyncEnabled ? colors.cardBg : colors.rowStripedBg,
                          color: colors.textPrimary,
                          width: '200px',
                        }}
                      >
                        <option value={1}>Every 1 minute</option>
                        <option value={5}>Every 5 minutes</option>
                        <option value={15}>Every 15 minutes</option>
                        <option value={30}>Every 30 minutes</option>
                        <option value={60}>Every hour</option>
                      </select>
                    </Box>

                    {/* Sync Status */}
                    <Box p={4} bg={colors.rowStripedBg} borderRadius="md">
                      <HStack justify="space-between" align="center">
                        <VStack align="start" gap={1}>
                          <HStack>
                            <Text fontWeight="medium" color={colors.textPrimary}>Status:</Text>
                            {isSyncing ? (
                              <Badge colorScheme="blue">Syncing...</Badge>
                            ) : autoSyncEnabled ? (
                              <Badge colorScheme="green">Active</Badge>
                            ) : (
                              <Badge colorScheme="gray">Disabled</Badge>
                            )}
                          </HStack>
                          {lastSyncTime && (
                            <Text fontSize="sm" color={colors.textSecondary}>
                              Last sync: {lastSyncTime.toLocaleDateString()} {lastSyncTime.toLocaleTimeString()}
                            </Text>
                          )}
                          {lastSyncResult && (
                            <Text
                              fontSize="sm"
                              color={lastSyncResult.success ? 'green.600' : 'red.600'}
                            >
                              {lastSyncResult.message}
                            </Text>
                          )}
                        </VStack>
                        <Button
                          colorScheme="blue"
                          variant="outline"
                          onClick={performSync}
                          isLoading={isSyncing}
                          loadingText="Syncing..."
                        >
                          Sync Now
                        </Button>
                      </HStack>
                    </Box>
                  </VStack>
                </Box>
              </Tabs.Content>

              {/* Webhook Mode Content */}
              <Tabs.Content value="webhook">
                <Box mt={4}>
                  <Text color={colors.textSecondary} mb={4}>
                    Instant updates when new transactions are added to your sheet. More efficient and real-time.
                  </Text>

                  <VStack gap={4} align="stretch">
                    {/* Enable/Disable Toggle */}
                    <HStack justify="space-between" p={4} bg={colors.rowStripedBg} borderRadius="md">
                      <Box>
                        <Text fontWeight="medium" color={colors.textPrimary}>Enable Webhook Sync</Text>
                        <Text fontSize="sm" color={colors.textMuted}>
                          Receive transactions automatically via webhook
                        </Text>
                      </Box>
                      <Switch.Root
                        checked={realtimeEnabled}
                        onCheckedChange={(e) => toggleRealtimeMode(e.checked)}
                      >
                        <Switch.HiddenInput />
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Root>
                    </HStack>

                    {/* Status */}
                    <Box p={4} bg={realtimeEnabled ? colors.successBg : colors.rowStripedBg} borderRadius="md">
                      <HStack>
                        <Text fontWeight="medium" color={colors.textPrimary}>Status:</Text>
                        {realtimeEnabled ? (
                          <Badge colorScheme="green">Active - Listening for updates</Badge>
                        ) : (
                          <Badge colorScheme="gray">Disabled</Badge>
                        )}
                      </HStack>
                      {realtimeEnabled && lastSyncTime && (
                        <Text fontSize="sm" color={colors.textSecondary} mt={2}>
                          Last update: {lastSyncTime.toLocaleDateString()} {lastSyncTime.toLocaleTimeString()}
                        </Text>
                      )}
                    </Box>

                    {/* Webhook Configuration */}
                    <Box p={4} borderWidth="1px" borderColor={colors.borderColor} borderRadius="md">
                      <Heading size="md" mb={4} color={colors.textPrimary}>
                        Google Apps Script Setup
                      </Heading>
                      <Text fontSize="sm" color={colors.textSecondary} mb={4}>
                        Copy these values into your Google Apps Script to enable real-time sync.
                        Go to Extensions → Apps Script in your Google Sheet.
                      </Text>

                      {/* Webhook URL */}
                      <Box mb={4}>
                        <Text fontWeight="medium" mb={2} color={colors.textPrimary}>Webhook URL</Text>
                        <HStack>
                          <Input
                            value={getWebhookUrl()}
                            readOnly
                            size="sm"
                            bg={colors.rowStripedBg}
                            color={colors.textPrimary}
                          />
                          <Button
                            size="sm"
                            colorScheme={copiedField === 'url' ? 'green' : 'blue'}
                            onClick={() => {
                              navigator.clipboard.writeText(getWebhookUrl());
                              setCopiedField('url');
                              setTimeout(() => setCopiedField(null), 2000);
                            }}
                          >
                            {copiedField === 'url' ? 'Copied!' : 'Copy'}
                          </Button>
                        </HStack>
                      </Box>

                      {/* User ID */}
                      <Box mb={4}>
                        <Text fontWeight="medium" mb={2} color={colors.textPrimary}>User ID</Text>
                        <HStack>
                          <Input
                            value={userId || ''}
                            readOnly
                            size="sm"
                            bg={colors.rowStripedBg}
                            color={colors.textPrimary}
                          />
                          <Button
                            size="sm"
                            colorScheme={copiedField === 'userId' ? 'green' : 'blue'}
                            onClick={() => {
                              navigator.clipboard.writeText(userId);
                              setCopiedField('userId');
                              setTimeout(() => setCopiedField(null), 2000);
                            }}
                          >
                            {copiedField === 'userId' ? 'Copied!' : 'Copy'}
                          </Button>
                        </HStack>
                      </Box>

                      {/* Webhook Secret */}
                      <Box mb={4}>
                        <Text fontWeight="medium" mb={2} color={colors.textPrimary}>Webhook Secret</Text>
                        <HStack>
                          <Input
                            value={webhookSecret || 'Click "Generate" to create a secret'}
                            readOnly
                            size="sm"
                            bg={colors.rowStripedBg}
                            color={colors.textPrimary}
                            type={webhookSecret ? 'text' : 'text'}
                          />
                          {webhookSecret ? (
                            <Button
                              size="sm"
                              colorScheme={copiedField === 'secret' ? 'green' : 'blue'}
                              onClick={() => {
                                navigator.clipboard.writeText(webhookSecret);
                                setCopiedField('secret');
                                setTimeout(() => setCopiedField(null), 2000);
                              }}
                            >
                              {copiedField === 'secret' ? 'Copied!' : 'Copy'}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            colorScheme="purple"
                            onClick={generateWebhookSecret}
                          >
                            {webhookSecret ? 'Regenerate' : 'Generate'}
                          </Button>
                        </HStack>
                        <Text fontSize="xs" color={colors.textMuted} mt={1}>
                          Keep this secret safe. Regenerating will invalidate the old one.
                        </Text>
                      </Box>

                      {/* Copy Full Script Button */}
                      <Box mb={4}>
                        <Button
                          colorScheme={copiedField === 'fullScript' ? 'green' : 'purple'}
                          size="md"
                          width="100%"
                          onClick={() => {
                            const fullScript = `/**
 * BudgetWise Webhook Sync Script
 * Auto-generated with your credentials
 */

const CONFIG = {
  WEBHOOK_URL: '${getWebhookUrl()}',
  USER_ID: '${userId}',
  WEBHOOK_SECRET: '${webhookSecret || 'GENERATE_SECRET_FIRST'}',
  SHEET_NAME: 'Expenses',
  HEADER_ROWS: 1,
};

function setupTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(SpreadsheetApp.getActive()).onChange().create();
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  Logger.log('Triggers set up successfully!');
}

function onSheetChange(e) {
  if (e.changeType === 'INSERT_ROW' || e.changeType === 'EDIT') syncRecentRows();
}

function onSheetEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME) return;
  if (e.range.getRow() > CONFIG.HEADER_ROWS) syncRow(sheet, e.range.getRow());
}

function syncRecentRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  const lastSyncedRow = getLastSyncedRow();
  if (lastRow <= lastSyncedRow) return;
  const transactions = [];
  for (let row = lastSyncedRow + 1; row <= lastRow; row++) {
    const tx = getTransactionFromRow(sheet, row);
    if (tx) transactions.push(tx);
  }
  if (transactions.length > 0) {
    sendToWebhook(transactions);
    setLastSyncedRow(lastRow);
  }
}

function syncRow(sheet, row) {
  const tx = getTransactionFromRow(sheet, row);
  if (tx) sendToWebhook([tx]);
}

function getTransactionFromRow(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).toLowerCase().trim());
  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const subDescIdx = headers.findIndex(h => h.includes('sub-description') || h.includes('sub_description'));
  const descIdx = headers.findIndex(h => h === 'description' || h.includes('merchant') || h.includes('name'));
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('debit'));
  const typeIdx = headers.findIndex(h => h === 'type');
  const bankIdx = headers.findIndex(h => h === 'bank' || h.includes('source'));
  if (dateIdx === -1 || amountIdx === -1 || (subDescIdx === -1 && descIdx === -1)) return null;
  const date = values[dateIdx];
  const description = String(values[subDescIdx] || values[descIdx] || '').trim();
  const amount = values[amountIdx];
  if (!date || !description || !amount) return null;
  return {
    date: formatDate(date),
    description: description,
    amount: parseAmount(amount),
    type: typeIdx !== -1 && String(values[typeIdx]).toLowerCase() === 'income' ? 'income' : 'expense',
    bank: bankIdx !== -1 ? String(values[bankIdx]).trim() : '',
  };
}

function formatDate(date) {
  if (date instanceof Date) return \`\${date.getFullYear()}-\${String(date.getMonth() + 1).padStart(2, '0')}-\${String(date.getDate()).padStart(2, '0')}\`;
  return String(date);
}

function parseAmount(amount) {
  if (typeof amount === 'number') return Math.abs(amount);
  return Math.abs(parseFloat(String(amount).replace(/[$,]/g, '').replace(/[()]/g, '-').trim()));
}

function sendToWebhook(transactions) {
  const payload = { transactions, userId: CONFIG.USER_ID, webhookSecret: CONFIG.WEBHOOK_SECRET };
  const options = { method: 'POST', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  try {
    const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    Logger.log(response.getResponseCode() === 200 ? 'Sync successful!' : 'Sync failed: ' + response.getContentText());
  } catch (error) {
    Logger.log('Sync error: ' + error.message);
  }
}

function getLastSyncedRow() {
  const value = PropertiesService.getScriptProperties().getProperty('lastSyncedRow');
  return value ? parseInt(value) : CONFIG.HEADER_ROWS;
}

function setLastSyncedRow(row) {
  PropertiesService.getScriptProperties().setProperty('lastSyncedRow', String(row));
}

function manualSync() { syncRecentRows(); }
function resetSyncState() { PropertiesService.getScriptProperties().deleteProperty('lastSyncedRow'); }
function testConnection() {
  const options = { method: 'POST', contentType: 'application/json', payload: JSON.stringify({ transactions: [], userId: CONFIG.USER_ID, webhookSecret: CONFIG.WEBHOOK_SECRET }), muteHttpExceptions: true };
  try {
    const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    Logger.log(response.getResponseCode() === 200 ? '✅ Connection successful!' : '❌ Failed: ' + response.getResponseCode());
  } catch (error) { Logger.log('❌ Error: ' + error.message); }
}`;
                            navigator.clipboard.writeText(fullScript);
                            setCopiedField('fullScript');
                            setTimeout(() => setCopiedField(null), 3000);
                          }}
                        >
                          {copiedField === 'fullScript' ? '✓ Script Copied!' : '📋 Copy Complete Script (with your credentials)'}
                        </Button>
                      </Box>

                      {/* Step-by-Step Instructions */}
                      <Box p={4} bg={colors.infoBg} borderRadius="md">
                        <Text fontWeight="bold" mb={3} color={colors.textPrimary} fontSize="md">
                          📖 Step-by-Step Setup Guide
                        </Text>

                        <VStack align="start" gap={3} fontSize="sm">
                          <Box>
                            <Text fontWeight="semibold" color={colors.textPrimary}>Step 1: Prepare Your Google Sheet</Text>
                            <Text color={colors.textSecondary} ml={4}>
                              Your sheet needs columns: <strong>Date</strong>, <strong>Description</strong> (or Sub-Description), <strong>Amount</strong>
                            </Text>
                            <Text color={colors.textSecondary} ml={4}>
                              Optional columns: <strong>Type</strong> (income/expense), <strong>Bank</strong>
                            </Text>
                          </Box>

                          <Box>
                            <Text fontWeight="semibold" color={colors.textPrimary}>Step 2: Open Apps Script</Text>
                            <Text color={colors.textSecondary} ml={4}>
                              In your Google Sheet: <strong>Extensions → Apps Script</strong>
                            </Text>
                          </Box>

                          <Box>
                            <Text fontWeight="semibold" color={colors.textPrimary}>Step 3: Add the Script</Text>
                            <Text color={colors.textSecondary} ml={4}>
                              Click <strong>"Copy Complete Script"</strong> button above, then paste it in Apps Script
                            </Text>
                            <Text color={colors.warning} ml={4} fontWeight="medium">
                              ⚠️ If you have existing scripts, paste BELOW them (don't replace!)
                            </Text>
                          </Box>

                          <Box>
                            <Text fontWeight="semibold" color={colors.textPrimary}>Step 4: Save & Run Setup</Text>
                            <Text color={colors.textSecondary} ml={4}>
                              Press <strong>Ctrl+S</strong> to save, then select <strong>"setupTriggers"</strong> from the dropdown and click <strong>Run</strong>
                            </Text>
                          </Box>

                          <Box>
                            <Text fontWeight="semibold" color={colors.textPrimary}>Step 5: Grant Permissions</Text>
                            <Text color={colors.textSecondary} ml={4}>
                              Click "Review Permissions" → Choose your account → "Advanced" → "Go to BudgetWise (unsafe)" → "Allow"
                            </Text>
                          </Box>

                          <Box>
                            <Text fontWeight="semibold" color={colors.textPrimary}>Step 6: Test Connection</Text>
                            <Text color={colors.textSecondary} ml={4}>
                              Select <strong>"testConnection"</strong> and click Run. Check the logs for "✅ Connection successful!"
                            </Text>
                          </Box>

                          <Box p={2} bg={colors.successBg} borderRadius="md" width="100%">
                            <Text fontWeight="medium" color={colors.success}>
                              ✅ Done! New transactions will sync automatically when added to your sheet.
                            </Text>
                          </Box>
                        </VStack>
                      </Box>
                    </Box>
                  </VStack>
                </Box>
              </Tabs.Content>
            </Tabs.Root>
          </Box>
        )}

        {/* Manual Import Section */}
        <Box p={6} borderWidth="1px" borderColor={colors.borderColor} borderRadius="lg" bg={colors.cardBg}>
          <Heading size="lg" mb={4} color={colors.textPrimary}>
            Manual Import
          </Heading>
          <Text color={colors.textSecondary} mb={6}>
            Preview and import transactions manually from your connected sheet or upload a CSV file.
          </Text>

          <HStack gap={4} wrap="wrap">
            {hasConnectedSheet && (
              <Button
                colorScheme="green"
                size="lg"
                onClick={handleManualSync}
                isLoading={loading}
                loadingText="Fetching..."
              >
                Fetch from Sheet
              </Button>
            )}
            <Box>
              <Input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                size="lg"
              />
            </Box>
          </HStack>
        </Box>

        {/* Import Results */}
        {transactions.length > 0 && (
          <>
            {/* Statistics */}
            <Box p={6} bg={colors.infoBg} borderRadius="lg">
              <Heading size="md" mb={4} color={colors.textPrimary}>
                Import Summary
              </Heading>
              <VStack align="start" gap={2}>
                <Text>
                  <strong>Total Transactions:</strong> {importStats?.total || 0}
                </Text>
                <Text>
                  <strong>Total Amount:</strong> ${importStats?.totalAmount?.toFixed(2) || '0.00'}
                </Text>
                <Text fontWeight="medium" mt={2}>
                  By Category:
                </Text>
                {importStats?.categories && Object.entries(importStats.categories).map(([category, data]) => (
                  <Text key={category} fontSize="sm">
                    • {category}: {data.count} transactions (${data.total.toFixed(2)})
                  </Text>
                ))}
              </VStack>
            </Box>

            {/* Transactions Table */}
            <Box overflowX="auto">
              <Table.Root size="sm" variant="outline">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Date</Table.ColumnHeader>
                    <Table.ColumnHeader>Description</Table.ColumnHeader>
                    <Table.ColumnHeader>Category</Table.ColumnHeader>
                    <Table.ColumnHeader isNumeric>Amount</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {(showAll ? transactions : transactions.slice(0, 20)).map((transaction, index) => (
                    <Table.Row key={index}>
                      <Table.Cell>{transaction.date}</Table.Cell>
                      <Table.Cell>{transaction.description}</Table.Cell>
                      <Table.Cell>
                        <Box
                          as="span"
                          px={2}
                          py={1}
                          borderRadius="md"
                          bg={colors.primaryBg}
                          fontSize="sm"
                        >
                          {transaction.category}
                        </Box>
                      </Table.Cell>
                      <Table.Cell isNumeric>${transaction.amount.toFixed(2)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
              {transactions.length > 20 && (
                <HStack justify="center" mt={2} gap={4}>
                  <Text fontSize="sm" color={colors.textSecondary}>
                    {showAll
                      ? `Showing all ${transactions.length} transactions`
                      : `Showing first 20 of ${transactions.length} transactions`}
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    colorScheme="blue"
                    onClick={() => setShowAll(!showAll)}
                  >
                    {showAll ? 'Show Less' : 'Show All'}
                  </Button>
                </HStack>
              )}
            </Box>

            {/* Save Button */}
            <Button
              colorScheme="green"
              size="lg"
              onClick={handleSaveTransactions}
              isLoading={loading}
              loadingText="Saving..."
            >
              Save {transactions.length} Transactions to Database
            </Button>
          </>
        )}
        </VStack>
      </PageContainer>
  );
}
