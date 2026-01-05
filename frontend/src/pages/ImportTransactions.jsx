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
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { useAutoSync } from '../contexts/AutoSyncContext';
import PageContainer from '../components/PageContainer';
import { fetchTransactionsFromGoogleSheets, parseCSVFile, validateTransactions, extractSheetId } from '../lib/importUtils';
import { supabase } from '../lib/supabaseClient';

export default function ImportTransactions() {
  const { user } = useAuth();
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
  } = useAutoSync();

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
    const { data: mappings, error: mappingsError } = await supabase
      .from('merchant_mappings')
      .select('transaction_description, category_name')
      .eq('user_id', user.id);

    if (mappingsError) {
      console.error('Error fetching merchant mappings:', mappingsError);
      throw mappingsError;
    }

    // Build lookup map
    const mappingLookup = {};
    (mappings || []).forEach(mapping => {
      mappingLookup[mapping.transaction_description.toUpperCase()] = mapping.category_name;
    });

    // Categorize each transaction using substring matching
    return transactions.map(transaction => {
      const category = categorizeTransaction(transaction.description, mappingLookup);
      return {
        ...transaction,
        category,
      };
    });
  };

  // Categorize a single transaction using substring matching
  const categorizeTransaction = (description, mappingLookup) => {
    if (!description || typeof description !== 'string') {
      return 'Unexpected';
    }

    const normalizedDesc = description.toUpperCase().trim().replace(/\s+/g, ' ');

    for (const [merchantName, categoryName] of Object.entries(mappingLookup)) {
      if (normalizedDesc.includes(merchantName)) {
        return categoryName;
      }
    }

    return 'Unexpected';
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

      // Prepare and insert transactions
      const transactionsToInsert = transactions.map(t => ({
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
            <Heading size="2xl">Import Transactions</Heading>
            <Text color="gray.600" mt={2}>
              Connect your Google Sheet for automatic syncing or import from CSV
            </Text>
          </Box>

        {/* Messages */}
        {error && (
          <Box p={4} bg="red.50" borderRadius="md" borderColor="red.200" borderWidth="1px">
            <Text color="red.700">{error}</Text>
          </Box>
        )}
        {success && (
          <Box p={4} bg="green.50" borderRadius="md" borderColor="green.200" borderWidth="1px">
            <Text color="green.700">{success}</Text>
          </Box>
        )}

        {/* Google Sheet Configuration */}
        <Box p={6} borderWidth="1px" borderRadius="lg" bg="white">
          <Heading size="lg" mb={4}>
            Google Sheet Connection
          </Heading>
          <Text color="gray.600" mb={6}>
            Connect your Google Sheet to sync transactions. The sheet must be publicly accessible (Share → Anyone with the link can view).
          </Text>

          <VStack gap={4} align="stretch">
            <Box>
              <Text fontWeight="medium" mb={2}>Google Sheets URL</Text>
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => {
                  setSheetUrl(e.target.value);
                  if (hasConnectedSheet) setHasConnectedSheet(false);
                }}
                size="lg"
              />
            </Box>

            <Box>
              <Text fontWeight="medium" mb={2}>Sheet Name (Tab)</Text>
              <Input
                placeholder="Expenses"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                size="lg"
              />
              <Text fontSize="sm" color="gray.500" mt={1}>
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

        {/* Auto-Sync Settings - Only show when sheet is connected */}
        {hasConnectedSheet && (
          <Box p={6} borderWidth="1px" borderRadius="lg" bg="white">
            <Heading size="lg" mb={4}>
              Auto-Sync Settings
            </Heading>
            <Text color="gray.600" mb={6}>
              Automatically sync new transactions from your Google Sheet at regular intervals.
            </Text>

            <VStack gap={4} align="stretch">
              {/* Enable/Disable Toggle */}
              <HStack justify="space-between">
                <Box>
                  <Text fontWeight="medium">Enable Auto-Sync</Text>
                  <Text fontSize="sm" color="gray.500">
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
                <Text fontWeight="medium" mb={2}>Sync Interval</Text>
                <select
                  value={syncInterval}
                  onChange={(e) => updateSyncInterval(Number(e.target.value))}
                  disabled={!autoSyncEnabled}
                  style={{
                    padding: '12px',
                    fontSize: '16px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: autoSyncEnabled ? 'white' : '#f7f7f7',
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
              <Box p={4} bg="gray.50" borderRadius="md">
                <HStack justify="space-between" align="center">
                  <VStack align="start" gap={1}>
                    <HStack>
                      <Text fontWeight="medium">Status:</Text>
                      {isSyncing ? (
                        <Badge colorScheme="blue">Syncing...</Badge>
                      ) : autoSyncEnabled ? (
                        <Badge colorScheme="green">Active</Badge>
                      ) : (
                        <Badge colorScheme="gray">Disabled</Badge>
                      )}
                    </HStack>
                    {lastSyncTime && (
                      <Text fontSize="sm" color="gray.600">
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
        )}

        {/* Manual Import Section */}
        <Box p={6} borderWidth="1px" borderRadius="lg" bg="white">
          <Heading size="lg" mb={4}>
            Manual Import
          </Heading>
          <Text color="gray.600" mb={6}>
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
            <Box p={6} bg="blue.50" borderRadius="lg">
              <Heading size="md" mb={4}>
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
                          bg="blue.100"
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
                  <Text fontSize="sm" color="gray.600">
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
