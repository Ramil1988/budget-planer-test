import { useState, useEffect, useRef, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  VStack,
  HStack,
  Text,
  IconButton,
  Spinner,
  Badge,
  Dialog,
  Portal,
  CloseButton,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PageContainer from '../components/PageContainer';
import { useDarkModeColors } from '../lib/useDarkModeColors';
import MerchantAutocomplete from '../components/MerchantAutocomplete';
import CategoryAutocomplete from '../components/CategoryAutocomplete';
import CategorySelect from '../components/CategorySelect';

// Default categories to seed for new users
const DEFAULT_EXPENSE_CATEGORIES = [
  'Afterschool', 'Autocredit', 'Clothes', 'Food', 'Food/Costco', 'Fuel',
  'Government Loan', 'Haircut', 'Household items/Car', 'Insurance', 'Internet',
  'Massage', 'Mobile/Internet', 'Mortgage', 'Electricity', 'Pharmacy',
  'Property tax', 'Subscriptions', 'Unexpected', 'Weekend'
];

const DEFAULT_INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Investments', 'Rental Income', 'Other Income'
];

export default function CategoryManager() {
  const { user } = useAuth();
  const colors = useDarkModeColors();
  const [patterns, setPatterns] = useState({});
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedIncomeCategory, setSelectedIncomeCategory] = useState('');
  const [newPattern, setNewPattern] = useState('');
  const [newIncomePattern, setNewIncomePattern] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('expense');
  const [importLoading, setImportLoading] = useState(false);
  const [isDefaultModalOpen, setIsDefaultModalOpen] = useState(false);
  const [updateExistingTransactions, setUpdateExistingTransactions] = useState(true);
  const [updateExistingIncomeTransactions, setUpdateExistingIncomeTransactions] = useState(true);
  const [recategorizeLoading, setRecategorizeLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Custom dropdown state
  const [incomeCategoryDropdownOpen, setIncomeCategoryDropdownOpen] = useState(false);
  const incomeCategoryDropdownRef = useRef(null);

  // Load patterns from database on mount
  useEffect(() => {
    if (user) {
      loadPatternsFromDB();
    }
  }, [user]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (incomeCategoryDropdownRef.current && !incomeCategoryDropdownRef.current.contains(event.target)) {
        setIncomeCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPatternsFromDB = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch all categories for the user (both income and expense)
      const { data: cats, error: catError } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('user_id', user.id)
        .order('name');

      if (catError) throw catError;

      setCategories(cats || []);

      // Fetch all merchant mappings
      const { data: mappings, error: mappingsError } = await supabase
        .from('merchant_mappings')
        .select('transaction_description, category_name')
        .eq('user_id', user.id);

      if (mappingsError) throw mappingsError;

      // Build mapping map: { categoryName: [transaction_descriptions] }
      const mappingMap = {};
      cats.forEach(cat => {
        mappingMap[cat.name] = (mappings || [])
          .filter(m => m.category_name === cat.name)
          .map(m => m.transaction_description);
      });

      setPatterns(mappingMap);
    } catch (err) {
      setError(err.message);
      console.error('Error loading mappings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update existing transactions that match merchant name to new category
  const updateTransactionsByMerchant = async (merchantName, categoryName, transactionType = 'expense') => {
    try {
      // Get the category ID for the new category
      const targetCategory = categories.find(c => c.name === categoryName && c.type === transactionType);
      if (!targetCategory) {
        console.error('Category not found:', categoryName, 'Available:', categories.map(c => c.name));
        return { updated: 0, error: `Category "${categoryName}" not found` };
      }

      // Fetch transactions that match the merchant name (case-insensitive substring match)
      // Also filter out soft-deleted transactions
      const { data: transactions, error: fetchError } = await supabase
        .from('transactions')
        .select('id, description, category_id')
        .eq('user_id', user.id)
        .eq('type', transactionType)
        .is('deleted_at', null)
        .ilike('description', `%${merchantName}%`);

      if (fetchError) {
        console.error('Error fetching transactions:', fetchError);
        throw fetchError;
      }

      const foundCount = transactions?.length || 0;

      // Filter out transactions that already have the correct category
      const transactionsToUpdate = (transactions || []).filter(
        t => t.category_id !== targetCategory.id
      );
      const alreadyCorrect = foundCount - transactionsToUpdate.length;

      if (transactionsToUpdate.length === 0) {
        // Return more detailed info about why no updates
        return {
          updated: 0,
          found: foundCount,
          alreadyCorrect: alreadyCorrect,
          info: foundCount === 0
            ? `No transactions found matching "${merchantName}"`
            : `${foundCount} transaction(s) already in "${categoryName}" (ID: ${targetCategory.id})`
        };
      }

      // Update transactions in batches
      const batchSize = 100;
      let updatedCount = 0;
      for (let i = 0; i < transactionsToUpdate.length; i += batchSize) {
        const batchIds = transactionsToUpdate.slice(i, i + batchSize).map(t => t.id);

        const { data: updatedData, error: updateError } = await supabase
          .from('transactions')
          .update({ category_id: targetCategory.id })
          .in('id', batchIds)
          .select('id');

        if (updateError) throw updateError;

        updatedCount += updatedData?.length || 0;
      }

      return { updated: updatedCount };
    } catch (err) {
      console.error('Error updating transactions:', err);
      return { updated: 0, error: err.message };
    }
  };

  // Re-categorize all transactions based on current merchant mappings
  const handleRecategorizeAll = async () => {
    setRecategorizeLoading(true);
    setError('');
    try {
      // Fetch all merchant mappings
      const { data: mappings, error: mappingsError } = await supabase
        .from('merchant_mappings')
        .select('transaction_description, category_name')
        .eq('user_id', user.id);

      if (mappingsError) throw mappingsError;

      // Build category lookup maps
      const expenseCategoryMap = {};
      const incomeCategoryMap = {};
      categories.forEach(cat => {
        if (cat.type === 'income') {
          incomeCategoryMap[cat.name] = cat.id;
        } else {
          expenseCategoryMap[cat.name] = cat.id;
        }
      });

      // Fetch all transactions
      const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select('id, description, type, category_id')
        .eq('user_id', user.id);

      if (transError) throw transError;

      // Categorize each transaction
      let updateCount = 0;
      const updates = [];

      for (const transaction of transactions || []) {
        const normalizedDesc = transaction.description.toUpperCase().trim().replace(/\s+/g, ' ');
        const isIncome = transaction.type === 'income';
        const categoryMap = isIncome ? incomeCategoryMap : expenseCategoryMap;

        // Find matching mapping (first match wins)
        let newCategoryId = null;
        for (const mapping of mappings || []) {
          if (normalizedDesc.includes(mapping.transaction_description)) {
            const catId = categoryMap[mapping.category_name];
            if (catId) {
              newCategoryId = catId;
              break;
            }
          }
        }

        // If found a new category and it's different from current
        if (newCategoryId && newCategoryId !== transaction.category_id) {
          updates.push({ id: transaction.id, category_id: newCategoryId });
        }
      }

      // Update transactions in batches
      const batchSize = 100;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        for (const update of batch) {
          const { error: updateError } = await supabase
            .from('transactions')
            .update({ category_id: update.category_id })
            .eq('id', update.id);

          if (updateError) throw updateError;
        }
        updateCount += batch.length;
      }

      setSaveMessage(`Re-categorized ${updateCount} transaction${updateCount !== 1 ? 's' : ''} based on current mappings!`);
      setTimeout(() => setSaveMessage(''), 5000);
    } catch (err) {
      setError(err.message);
      console.error('Error re-categorizing transactions:', err);
    } finally {
      setRecategorizeLoading(false);
    }
  };

  // Add new merchant mapping to selected category (expense)
  const handleAddPattern = async () => {
    if (!selectedCategory || !newPattern.trim()) {
      return;
    }

    const merchantName = newPattern.trim().toUpperCase();

    // Check if mapping already exists in the SAME category
    if (patterns[selectedCategory]?.includes(merchantName)) {
      setSaveMessage('Merchant already mapped in this category');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    // Check if merchant exists in a DIFFERENT category (will be moved)
    let previousCategory = null;
    for (const [catName, merchants] of Object.entries(patterns)) {
      if (merchants.includes(merchantName) && catName !== selectedCategory) {
        previousCategory = catName;
        break;
      }
    }

    try {
      // Use upsert to handle both new mappings and moving between categories
      const { error } = await supabase
        .from('merchant_mappings')
        .upsert({
          user_id: user.id,
          transaction_description: merchantName,
          category_name: selectedCategory,
        }, {
          onConflict: 'user_id,transaction_description'
        });

      if (error) throw error;

      // Update existing transactions if checkbox is checked
      let updatedTransactions = 0;
      let updateError = null;
      let updateInfo = null;
      if (updateExistingTransactions) {
        const result = await updateTransactionsByMerchant(merchantName, selectedCategory, 'expense');
        updatedTransactions = result.updated;
        updateError = result.error;
        updateInfo = result.info;
      }

      // Reload mappings from database
      await loadPatternsFromDB();

      setNewPattern('');
      let message;
      if (previousCategory) {
        message = `Moved "${merchantName}" from ${previousCategory} to ${selectedCategory}.`;
        if (updatedTransactions > 0) {
          message += ` Updated ${updatedTransactions} transaction${updatedTransactions !== 1 ? 's' : ''}.`;
        } else if (updateError) {
          message += ` (Error: ${updateError})`;
        } else if (updateInfo) {
          message += ` (${updateInfo})`;
        }
      } else {
        message = updatedTransactions > 0
          ? `Merchant mapping added! Updated ${updatedTransactions} existing transaction${updatedTransactions !== 1 ? 's' : ''}.`
          : 'Merchant mapping added successfully!';
        if (updateError) {
          message += ` (Error: ${updateError})`;
        } else if (updateInfo) {
          message += ` (${updateInfo})`;
        }
      }
      setSaveMessage(message);
      setTimeout(() => setSaveMessage(''), 6000);
    } catch (err) {
      setError(err.message);
      console.error('Error adding mapping:', err);
    }
  };

  // Add new merchant mapping to selected income category
  const handleAddIncomePattern = async () => {
    if (!selectedIncomeCategory || !newIncomePattern.trim()) {
      return;
    }

    const merchantName = newIncomePattern.trim().toUpperCase();

    // Check if mapping already exists in the SAME category
    if (patterns[selectedIncomeCategory]?.includes(merchantName)) {
      setSaveMessage('Merchant already mapped in this category');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    // Check if merchant exists in a DIFFERENT category (will be moved)
    let previousCategory = null;
    for (const [catName, merchants] of Object.entries(patterns)) {
      if (merchants.includes(merchantName) && catName !== selectedIncomeCategory) {
        previousCategory = catName;
        break;
      }
    }

    try {
      // Use upsert to handle both new mappings and moving between categories
      const { error } = await supabase
        .from('merchant_mappings')
        .upsert({
          user_id: user.id,
          transaction_description: merchantName,
          category_name: selectedIncomeCategory,
        }, {
          onConflict: 'user_id,transaction_description'
        });

      if (error) throw error;

      // Update existing transactions if checkbox is checked
      let updatedTransactions = 0;
      if (updateExistingIncomeTransactions) {
        const result = await updateTransactionsByMerchant(merchantName, selectedIncomeCategory, 'income');
        updatedTransactions = result.updated;
      }

      // Reload mappings from database
      await loadPatternsFromDB();

      setNewIncomePattern('');
      let message;
      if (previousCategory) {
        message = `Moved "${merchantName}" from ${previousCategory} to ${selectedIncomeCategory}.`;
        if (updatedTransactions > 0) {
          message += ` Updated ${updatedTransactions} transaction${updatedTransactions !== 1 ? 's' : ''}.`;
        }
      } else {
        message = updatedTransactions > 0
          ? `Income mapping added! Updated ${updatedTransactions} existing transaction${updatedTransactions !== 1 ? 's' : ''}.`
          : 'Income merchant mapping added successfully!';
      }
      setSaveMessage(message);
      setTimeout(() => setSaveMessage(''), 5000);
    } catch (err) {
      setError(err.message);
      console.error('Error adding income mapping:', err);
    }
  };

  // Remove merchant mapping from category
  const handleRemovePattern = async (categoryName, merchantName) => {
    try {
      // Delete mapping from database
      const { error } = await supabase
        .from('merchant_mappings')
        .delete()
        .eq('user_id', user.id)
        .eq('transaction_description', merchantName)
        .eq('category_name', categoryName);

      if (error) throw error;

      // Reload mappings from database
      await loadPatternsFromDB();

      setSaveMessage('Merchant mapping removed');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setError(err.message);
      console.error('Error removing mapping:', err);
    }
  };

  // Add new category (for the current active tab type)
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      return;
    }

    const categoryName = newCategoryName.trim();

    if (categories.some(c => c.name === categoryName)) {
      setSaveMessage('Category already exists');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    try {
      // Insert category into database with the current active tab's type
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: user.id,
          name: categoryName,
          type: activeTab,
        })
        .select()
        .single();

      if (error) throw error;

      // Reload categories
      await loadPatternsFromDB();

      if (activeTab === 'expense') {
        setSelectedCategory(categoryName);
      }
      setNewCategoryName('');
      setSaveMessage('Category created!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setError(err.message);
      console.error('Error adding category:', err);
    }
  };

  // Load default categories (both expense and income)
  const loadDefaultCategories = async () => {
    setImportLoading(true);
    setError('');
    try {
      const expenseInserts = DEFAULT_EXPENSE_CATEGORIES.map(name => ({
        user_id: user.id,
        name,
        type: 'expense'
      }));

      const incomeInserts = DEFAULT_INCOME_CATEGORIES.map(name => ({
        user_id: user.id,
        name,
        type: 'income'
      }));

      const { error: insertError } = await supabase
        .from('categories')
        .upsert([...expenseInserts, ...incomeInserts], {
          onConflict: 'user_id,name',
          ignoreDuplicates: true
        });

      if (insertError) throw insertError;

      await loadPatternsFromDB();
      setIsDefaultModalOpen(false);
      setSaveMessage(`Loaded ${DEFAULT_EXPENSE_CATEGORIES.length} expense and ${DEFAULT_INCOME_CATEGORIES.length} income categories!`);
      setTimeout(() => setSaveMessage(''), 5000);
    } catch (err) {
      setError(err.message);
      console.error('Error loading default categories:', err);
    } finally {
      setImportLoading(false);
    }
  };

  // Handle file selection for CSV import
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      importMerchantMappingsFromCSV(file);
    }
  };

  // Import merchant mappings from CSV (Name -> Type/Category)
  const importMerchantMappingsFromCSV = async (file) => {
    setImportLoading(true);
    setError('');
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('CSV file must have a header row and at least one data row');
      }

      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
      const nameIndex = headers.indexOf('name');
      const typeIndex = headers.indexOf('type');

      if (nameIndex === -1 || typeIndex === -1) {
        throw new Error('CSV must have "Name" and "Type" columns');
      }

      // Parse CSV rows
      const mappings = lines.slice(1)
        .map(line => {
          // Handle CSV with quotes
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const merchantName = values[nameIndex]?.toUpperCase();
          const categoryName = values[typeIndex];
          return { merchantName, categoryName };
        })
        .filter(m => m.merchantName && m.categoryName);

      if (mappings.length === 0) {
        throw new Error('No valid mappings found in CSV');
      }

      // Get unique categories from the Type column
      const uniqueCategories = [...new Set(mappings.map(m => m.categoryName))];

      // First, create any missing categories (as expense type)
      const categoryInserts = uniqueCategories.map(name => ({
        user_id: user.id,
        name,
        type: 'expense'
      }));

      const { error: catError } = await supabase
        .from('categories')
        .upsert(categoryInserts, {
          onConflict: 'user_id,name',
          ignoreDuplicates: true
        });

      if (catError) throw catError;

      // Then, create merchant mappings
      const mappingInserts = mappings.map(m => ({
        user_id: user.id,
        transaction_description: m.merchantName,
        category_name: m.categoryName
      }));

      // Insert in batches to avoid issues
      const batchSize = 100;
      let insertedCount = 0;
      for (let i = 0; i < mappingInserts.length; i += batchSize) {
        const batch = mappingInserts.slice(i, i + batchSize);
        const { error: mapError } = await supabase
          .from('merchant_mappings')
          .upsert(batch, {
            onConflict: 'user_id,transaction_description',
            ignoreDuplicates: true
          });

        if (mapError) throw mapError;
        insertedCount += batch.length;
      }

      await loadPatternsFromDB();

      setSaveMessage(`Imported ${uniqueCategories.length} categories and ${insertedCount} merchant mappings from CSV!`);
      setTimeout(() => setSaveMessage(''), 5000);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err.message);
      console.error('Error importing merchant mappings from CSV:', err);
    } finally {
      setImportLoading(false);
    }
  };

  // Filter categories by type
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  // Category names for expense categories (for merchant mapping)
  const expenseCategoryNames = expenseCategories.map(c => c.name).sort();

  // Category names for income categories (for merchant mapping)
  const incomeCategoryNames = incomeCategories.map(c => c.name).sort();

  // Get all existing patterns across all categories for autocomplete
  const allExistingPatterns = useMemo(() => [
    ...new Set(
      Object.values(patterns)
        .flat()
        .sort()
    )
  ], [patterns]);

  // Create a map of merchant -> category for showing in autocomplete
  const merchantCategoryMap = useMemo(() => {
    const map = {};
    for (const [categoryName, merchants] of Object.entries(patterns)) {
      for (const merchant of merchants) {
        map[merchant] = categoryName;
      }
    }
    return map;
  }, [patterns]);

  if (loading) {
    return (
      <PageContainer>
        <Flex w="100%" minH="60vh" align="center" justify="center">
          <VStack gap={4}>
            <Spinner size="xl" />
            <Text>Loading categories...</Text>
          </VStack>
        </Flex>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <VStack gap={8} align="stretch" w="100%">
          <Box>
            <Heading size="2xl" color={colors.textPrimary}>Category Manager</Heading>
            <Text color={colors.textSecondary} mt={2}>
              Manage your expense and income categories
            </Text>
          </Box>

        {/* Success/Error Message */}
        {saveMessage && (
          <Box
            p={3}
            bg={colors.successBg}
            borderColor={colors.successBorder}
            borderWidth="1px"
            borderRadius="md"
          >
            <Text color={colors.success} fontWeight="medium">
              {saveMessage}
            </Text>
          </Box>
        )}

        {/* Error Message */}
        {error && (
          <Box
            p={3}
            bg={colors.dangerBg}
            borderColor={colors.dangerBorder}
            borderWidth="1px"
            borderRadius="md"
          >
            <Text color={colors.danger} fontWeight="medium">
              {error}
            </Text>
          </Box>
        )}

        {/* Tab Navigation */}
        <HStack gap={4}>
          <Button
            size="lg"
            variant={activeTab === 'expense' ? 'solid' : 'outline'}
            colorScheme="red"
            onClick={() => setActiveTab('expense')}
          >
            Expenses ({expenseCategories.length})
          </Button>
          <Button
            size="lg"
            variant={activeTab === 'income' ? 'solid' : 'outline'}
            colorScheme="green"
            onClick={() => setActiveTab('income')}
          >
            Income ({incomeCategories.length})
          </Button>
        </HStack>

        {/* Quick Actions: Load Default & Import CSV */}
        <Box
          p={4}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={colors.borderColor}
          bg={colors.cardBg}
        >
          <Text fontWeight="medium" mb={3} color={colors.textPrimary}>Quick Actions</Text>
          <HStack gap={3} wrap="wrap">
            <Button
              colorScheme="purple"
              onClick={() => setIsDefaultModalOpen(true)}
              loading={importLoading}
              loadingText="Loading..."
            >
              Load Default Categories
            </Button>
            <Button
              colorScheme="blue"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              loading={importLoading}
              loadingText="Importing..."
            >
              Import Mappings from CSV
            </Button>
            <Button
              colorScheme="orange"
              variant="solid"
              onClick={handleRecategorizeAll}
              loading={recategorizeLoading}
              loadingText="Re-categorizing..."
            >
              Re-categorize All Transactions
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </HStack>
          <Text fontSize="xs" color={colors.textMuted} mt={2}>
            CSV format: Name,Type (merchant name → category mapping). "Re-categorize All" applies all current mappings to existing transactions.
          </Text>
        </Box>

        {/* Confirmation Dialog for Loading Defaults */}
        <Dialog.Root open={isDefaultModalOpen} onOpenChange={(e) => setIsDefaultModalOpen(e.open)}>
          <Portal>
            <Dialog.Backdrop bg="blackAlpha.600" />
            <Dialog.Positioner>
              <Dialog.Content bg={colors.cardBg} maxW="500px" w="90%" borderRadius="lg" p={0}>
                <Dialog.Header p={4} borderBottomWidth="1px" borderColor={colors.borderColor}>
                  <Flex justify="space-between" align="center" w="100%">
                    <Dialog.Title color={colors.textPrimary} fontWeight="bold">Load Default Categories</Dialog.Title>
                    <Dialog.CloseTrigger asChild>
                      <CloseButton size="sm" />
                    </Dialog.CloseTrigger>
                  </Flex>
                </Dialog.Header>
                <Dialog.Body p={4}>
                  <Text color={colors.textSecondary} mb={4}>
                    This will add the following default categories to your account:
                  </Text>
                  <Box mb={4}>
                    <Text fontWeight="bold" color={colors.textPrimary} mb={1}>
                      Expense Categories ({DEFAULT_EXPENSE_CATEGORIES.length}):
                    </Text>
                    <Text fontSize="sm" color={colors.textMuted}>
                      {DEFAULT_EXPENSE_CATEGORIES.join(', ')}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold" color={colors.textPrimary} mb={1}>
                      Income Categories ({DEFAULT_INCOME_CATEGORIES.length}):
                    </Text>
                    <Text fontSize="sm" color={colors.textMuted}>
                      {DEFAULT_INCOME_CATEGORIES.join(', ')}
                    </Text>
                  </Box>
                  <Text fontSize="sm" color={colors.textSecondary} mt={4}>
                    Existing categories with the same name will not be duplicated.
                  </Text>
                </Dialog.Body>
                <Dialog.Footer p={4} borderTopWidth="1px" borderColor={colors.borderColor} gap={2}>
                  <Button variant="ghost" onClick={() => setIsDefaultModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    colorScheme="purple"
                    onClick={loadDefaultCategories}
                    loading={importLoading}
                  >
                    Load Categories
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>

        {/* EXPENSE TAB */}
        {activeTab === 'expense' && (
          <>
            {/* Expense Categories */}
            <Box
              p={6}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={colors.borderColor}
              bg={colors.cardBg}
            >
              <Heading size="md" mb={4} color={colors.textPrimary}>Expense Categories</Heading>

              {/* Category List */}
              <Box mb={6}>
                <HStack wrap="wrap" gap={2}>
                  {expenseCategories.map((cat) => (
                    <Badge
                      key={cat.id}
                      colorScheme="red"
                      px={3}
                      py={1}
                      borderRadius="full"
                      fontSize="sm"
                    >
                      {cat.name}
                    </Badge>
                  ))}
                  {expenseCategories.length === 0 && (
                    <Text color={colors.textMuted}>No expense categories yet</Text>
                  )}
                </HStack>
              </Box>

              {/* Add New Category */}
              <Box p={4} bg={colors.rowStripedBg} borderRadius="md">
                <Text fontWeight="medium" mb={2} color={colors.textPrimary}>Add New Expense Category</Text>
                <HStack gap={2}>
                  <CategoryAutocomplete
                    placeholder="Category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                    categories={categories}
                    bg={colors.cardBg}
                    borderColor={colors.borderColor}
                    color={colors.textPrimary}
                  />
                  <Button colorScheme="red" onClick={handleAddCategory}>
                    Add
                  </Button>
                </HStack>
              </Box>
            </Box>

            {/* Merchant Mappings Section */}
            <Box
              p={6}
              borderRadius="16px"
              borderWidth="2px"
              borderColor="blue.200"
              bg={colors.cardBg}
              boxShadow="0 2px 8px rgba(0,0,0,0.05)"
            >
              <Heading size="lg" mb={2} color={colors.textPrimary}>
                Merchant Mappings
              </Heading>
              <Text color={colors.textSecondary} mb={6} fontSize="md">
                Map merchant names to categories for automatic categorization when importing
              </Text>
              <VStack gap={5} align="stretch">
                {/* Merchant Name Input */}
                <Box>
                  <Text fontWeight="600" mb={2} color={colors.textSecondary} fontSize="sm">
                    Merchant Name
                  </Text>
                  <MerchantAutocomplete
                    placeholder="e.g., GLOBAL PET FOODS, PC-ENERGIE NB POWER, AMAZON.CA"
                    value={newPattern}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewPattern(value);

                      // Auto-populate category if merchant exists
                      const normalizedValue = value.toUpperCase().trim();
                      for (const [categoryName, merchants] of Object.entries(patterns)) {
                        if (merchants.includes(normalizedValue)) {
                          setSelectedCategory(categoryName);
                          break;
                        }
                      }
                    }}
                    onSelect={(merchant) => {
                      // Auto-populate category when selecting from dropdown
                      const category = merchantCategoryMap[merchant];
                      if (category) {
                        setSelectedCategory(category);
                      }
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPattern()}
                    merchants={allExistingPatterns}
                    merchantCategoryMap={merchantCategoryMap}
                    size="lg"
                    bg={colors.rowStripedBg}
                    borderColor={colors.borderColor}
                    color={colors.textPrimary}
                    _hover={{ borderColor: 'blue.400' }}
                    _focus={{ borderColor: 'blue.500', bg: colors.cardBg, boxShadow: '0 0 0 1px #3B82F6' }}
                    fontSize="md"
                    h="56px"
                    borderRadius="12px"
                  />
                  <Text fontSize="xs" color={colors.textMuted} mt={1}>
                    Enter the exact merchant name as it appears in your bank statements
                  </Text>
                </Box>

                {/* Category Select */}
                <Box>
                  <Text fontWeight="600" mb={2} color={colors.textSecondary} fontSize="sm">
                    Assign to Category
                  </Text>
                  <CategorySelect
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    categories={expenseCategoryNames}
                    placeholder="Select a category..."
                  />
                </Box>

                {/* Update existing transactions checkbox */}
                <HStack
                  as="label"
                  cursor="pointer"
                  p={3}
                  bg={colors.rowStripedBg}
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor={updateExistingTransactions ? 'blue.400' : colors.borderColor}
                  _hover={{ borderColor: 'blue.400' }}
                  transition="all 0.2s"
                >
                  <input
                    type="checkbox"
                    checked={updateExistingTransactions}
                    onChange={(e) => setUpdateExistingTransactions(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: '#3B82F6',
                      cursor: 'pointer',
                    }}
                  />
                  <Box>
                    <Text fontWeight="500" color={colors.textPrimary} fontSize="sm">
                      Update existing transactions
                    </Text>
                    <Text fontSize="xs" color={colors.textMuted}>
                      Automatically re-categorize transactions matching this merchant
                    </Text>
                  </Box>
                </HStack>

                {/* Add Button */}
                <Button
                  colorScheme="blue"
                  size="lg"
                  onClick={handleAddPattern}
                  disabled={!selectedCategory || !newPattern.trim()}
                  h="56px"
                  w="100%"
                  fontSize="md"
                  fontWeight="600"
                  borderRadius="12px"
                  _hover={{ transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
                  transition="all 0.2s"
                >
                  Add Merchant Mapping
                </Button>

                {/* Show existing mappings for selected category */}
                {selectedCategory && patterns[selectedCategory]?.length > 0 && (
                  <Box
                    p={4}
                    bg={colors.cardBg}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={colors.borderColor}
                  >
                    <HStack justify="space-between" mb={2}>
                      <Text fontWeight="bold" fontSize="sm" color={colors.textSecondary}>
                        Existing merchant mappings for "{selectedCategory}":
                      </Text>
                      <Badge colorScheme="blue">{patterns[selectedCategory].length}</Badge>
                    </HStack>
                    <Box maxH="200px" overflowY="auto">
                      <VStack gap={1} align="stretch">
                        {patterns[selectedCategory].map((merchantName) => (
                          <HStack
                            key={merchantName}
                            justify="space-between"
                            p={2}
                            bg={colors.rowStripedBg}
                            borderRadius="md"
                            fontSize="sm"
                          >
                            <Text color={colors.textPrimary}>{merchantName}</Text>
                            <IconButton
                              size="xs"
                              colorScheme="red"
                              variant="ghost"
                              onClick={() => handleRemovePattern(selectedCategory, merchantName)}
                              aria-label="Remove mapping"
                            >
                              ✕
                            </IconButton>
                          </HStack>
                        ))}
                      </VStack>
                    </Box>
                  </Box>
                )}
              </VStack>
            </Box>
          </>
        )}

        {/* INCOME TAB */}
        {activeTab === 'income' && (
          <>
            {/* Income Categories */}
            <Box
              p={6}
              borderRadius="lg"
              borderWidth="1px"
              borderColor="green.200"
              bg={colors.cardBg}
            >
              <Heading size="md" mb={4} color={colors.textPrimary}>Income Categories</Heading>

              {/* Category List */}
              <Box mb={6}>
                <HStack wrap="wrap" gap={2}>
                  {incomeCategories.map((cat) => (
                    <Badge
                      key={cat.id}
                      colorScheme="green"
                      px={3}
                      py={1}
                      borderRadius="full"
                      fontSize="sm"
                    >
                      {cat.name}
                    </Badge>
                  ))}
                  {incomeCategories.length === 0 && (
                    <Text color={colors.textMuted}>No income categories yet</Text>
                  )}
                </HStack>
              </Box>

              {/* Add New Category */}
              <Box p={4} bg={colors.rowStripedBg} borderRadius="md">
                <Text fontWeight="medium" mb={2} color={colors.textPrimary}>Add New Income Category</Text>
                <HStack gap={2}>
                  <CategoryAutocomplete
                    placeholder="e.g., Salary, Freelance, Dividends, Cashback"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                    categories={categories}
                    bg={colors.cardBg}
                    borderColor={colors.borderColor}
                    color={colors.textPrimary}
                  />
                  <Button colorScheme="green" onClick={handleAddCategory}>
                    Add
                  </Button>
                </HStack>
              </Box>
            </Box>

            {/* Income Merchant Mappings Section */}
            <Box
              p={6}
              borderRadius="16px"
              borderWidth="2px"
              borderColor="green.200"
              bg={colors.cardBg}
              boxShadow="0 2px 8px rgba(0,0,0,0.05)"
            >
              <Heading size="lg" mb={2} color={colors.textPrimary}>
                Income Merchant Mappings
              </Heading>
              <Text color={colors.textSecondary} mb={6} fontSize="md">
                Map income sources to categories for automatic categorization when importing
              </Text>
              <VStack gap={5} align="stretch">
                {/* Merchant Name Input */}
                <Box>
                  <Text fontWeight="600" mb={2} color={colors.textSecondary} fontSize="sm">
                    Income Source Name
                  </Text>
                  <MerchantAutocomplete
                    placeholder="e.g., CASHBACK / REMISES, SALARY DEPOSIT, INTEREST"
                    value={newIncomePattern}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewIncomePattern(value);

                      // Auto-populate category if merchant exists
                      const normalizedValue = value.toUpperCase().trim();
                      for (const [categoryName, merchants] of Object.entries(patterns)) {
                        if (merchants.includes(normalizedValue) && incomeCategoryNames.includes(categoryName)) {
                          setSelectedIncomeCategory(categoryName);
                          break;
                        }
                      }
                    }}
                    onSelect={(merchant) => {
                      // Auto-populate category when selecting from dropdown
                      const category = merchantCategoryMap[merchant];
                      if (category && incomeCategoryNames.includes(category)) {
                        setSelectedIncomeCategory(category);
                      }
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddIncomePattern()}
                    merchants={allExistingPatterns}
                    merchantCategoryMap={merchantCategoryMap}
                    size="lg"
                    bg={colors.rowStripedBg}
                    borderColor={colors.borderColor}
                    color={colors.textPrimary}
                    _hover={{ borderColor: 'green.400' }}
                    _focus={{ borderColor: 'green.500', bg: colors.cardBg, boxShadow: '0 0 0 1px #22C55E' }}
                    fontSize="md"
                    h="56px"
                    borderRadius="12px"
                  />
                  <Text fontSize="xs" color={colors.textMuted} mt={1}>
                    Enter the exact income source name as it appears in your bank statements
                  </Text>
                </Box>

                {/* Category Select */}
                <Box>
                  <Text fontWeight="600" mb={2} color={colors.textSecondary} fontSize="sm">
                    Assign to Income Category
                  </Text>
                  <Box ref={incomeCategoryDropdownRef} position="relative" w="100%">
                    {/* Dropdown Trigger */}
                    <Box
                      onClick={() => setIncomeCategoryDropdownOpen(!incomeCategoryDropdownOpen)}
                      cursor="pointer"
                      px={4}
                      h="56px"
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      borderRadius="12px"
                      borderWidth="1px"
                      borderColor={incomeCategoryDropdownOpen ? 'green.500' : colors.borderColor}
                      bg={colors.rowStripedBg}
                      _hover={{ borderColor: 'green.400' }}
                      transition="all 0.2s"
                    >
                      <Text
                        color={selectedIncomeCategory ? colors.textPrimary : colors.textMuted}
                        fontSize="md"
                        noOfLines={1}
                      >
                        {selectedIncomeCategory || 'Select an income category...'}
                      </Text>
                      <Box
                        as="span"
                        transform={incomeCategoryDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'}
                        transition="transform 0.2s"
                        color={colors.textSecondary}
                      >
                        ▼
                      </Box>
                    </Box>

                    {/* Dropdown List */}
                    {incomeCategoryDropdownOpen && (
                      <Box
                        position="absolute"
                        top="100%"
                        left={0}
                        right={0}
                        zIndex={1000}
                        mt={1}
                        bg={colors.cardBg}
                        borderWidth="1px"
                        borderColor={colors.borderColor}
                        borderRadius="12px"
                        boxShadow="lg"
                        maxH={{ base: '280px', md: '320px' }}
                        overflowY="auto"
                      >
                        <VStack gap={0} align="stretch" p={1}>
                          {incomeCategoryNames.map((cat) => {
                            const isSelected = cat === selectedIncomeCategory;
                            return (
                              <HStack
                                key={cat}
                                px={3}
                                py={2.5}
                                cursor="pointer"
                                bg={isSelected ? colors.rowStripedBg : 'transparent'}
                                _hover={{ bg: colors.rowStripedBg }}
                                borderRadius="8px"
                                onClick={() => {
                                  setSelectedIncomeCategory(cat);
                                  setIncomeCategoryDropdownOpen(false);
                                }}
                                justify="space-between"
                                transition="background 0.1s"
                              >
                                <Text
                                  color={colors.textPrimary}
                                  fontSize="sm"
                                  fontWeight={isSelected ? '600' : '400'}
                                >
                                  {cat}
                                </Text>
                                {isSelected && (
                                  <Text color="green.500" fontSize="sm">✓</Text>
                                )}
                              </HStack>
                            );
                          })}
                        </VStack>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Update existing income transactions checkbox */}
                <HStack
                  as="label"
                  cursor="pointer"
                  p={3}
                  bg={colors.rowStripedBg}
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor={updateExistingIncomeTransactions ? 'green.400' : colors.borderColor}
                  _hover={{ borderColor: 'green.400' }}
                  transition="all 0.2s"
                >
                  <input
                    type="checkbox"
                    checked={updateExistingIncomeTransactions}
                    onChange={(e) => setUpdateExistingIncomeTransactions(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: '#22C55E',
                      cursor: 'pointer',
                    }}
                  />
                  <Box>
                    <Text fontWeight="500" color={colors.textPrimary} fontSize="sm">
                      Update existing transactions
                    </Text>
                    <Text fontSize="xs" color={colors.textMuted}>
                      Automatically re-categorize income transactions matching this source
                    </Text>
                  </Box>
                </HStack>

                {/* Add Button */}
                <Button
                  colorScheme="green"
                  size="lg"
                  onClick={handleAddIncomePattern}
                  disabled={!selectedIncomeCategory || !newIncomePattern.trim()}
                  h="56px"
                  w="100%"
                  fontSize="md"
                  fontWeight="600"
                  borderRadius="12px"
                  _hover={{ transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}
                  transition="all 0.2s"
                >
                  Add Income Mapping
                </Button>

                {/* Show existing mappings for selected income category */}
                {selectedIncomeCategory && patterns[selectedIncomeCategory]?.length > 0 && (
                  <Box
                    p={4}
                    bg={colors.cardBg}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={colors.borderColor}
                  >
                    <HStack justify="space-between" mb={2}>
                      <Text fontWeight="bold" fontSize="sm" color={colors.textSecondary}>
                        Existing merchant mappings for "{selectedIncomeCategory}":
                      </Text>
                      <Badge colorScheme="green">{patterns[selectedIncomeCategory].length}</Badge>
                    </HStack>
                    <Box maxH="200px" overflowY="auto">
                      <VStack gap={1} align="stretch">
                        {patterns[selectedIncomeCategory].map((merchantName) => (
                          <HStack
                            key={merchantName}
                            justify="space-between"
                            p={2}
                            bg={colors.rowStripedBg}
                            borderRadius="md"
                            fontSize="sm"
                          >
                            <Text color={colors.textPrimary}>{merchantName}</Text>
                            <IconButton
                              size="xs"
                              colorScheme="red"
                              variant="ghost"
                              onClick={() => handleRemovePattern(selectedIncomeCategory, merchantName)}
                              aria-label="Remove mapping"
                            >
                              ✕
                            </IconButton>
                          </HStack>
                        ))}
                      </VStack>
                    </Box>
                  </Box>
                )}
              </VStack>
            </Box>

            {/* Quick Action to Add Income */}
            <Box p={4} bg={colors.cardBg} borderRadius="md" borderWidth="1px" borderColor="green.300">
              <HStack justify="space-between" align="center">
                <Box>
                  <Text fontWeight="bold" color={colors.textPrimary}>Ready to add income?</Text>
                  <Text fontSize="sm" color={colors.textSecondary}>
                    Record your salary, freelance earnings, or other income
                  </Text>
                </Box>
                <Button
                  as={RouterLink}
                  to="/add-transaction"
                  colorScheme="green"
                  size="lg"
                >
                  + Add Income
                </Button>
              </HStack>
            </Box>
          </>
        )}

      </VStack>
    </PageContainer>
  );
}
