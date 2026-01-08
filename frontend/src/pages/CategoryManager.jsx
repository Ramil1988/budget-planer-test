import { useState, useEffect } from 'react';
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
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PageContainer from '../components/PageContainer';
import { useDarkModeColors } from '../lib/useDarkModeColors';

export default function CategoryManager() {
  const { user } = useAuth();
  const colors = useDarkModeColors();
  const [patterns, setPatterns] = useState({});
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newPattern, setNewPattern] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('expense');

  // Load patterns from database on mount
  useEffect(() => {
    if (user) {
      loadPatternsFromDB();
    }
  }, [user]);

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

  // Add new merchant mapping to selected category
  const handleAddPattern = async () => {
    if (!selectedCategory || !newPattern.trim()) {
      return;
    }

    const merchantName = newPattern.trim().toUpperCase();

    // Check if mapping already exists
    if (patterns[selectedCategory]?.includes(merchantName)) {
      setSaveMessage('Merchant already mapped in this category');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    try {
      // Insert mapping into database
      const { error } = await supabase
        .from('merchant_mappings')
        .insert({
          user_id: user.id,
          transaction_description: merchantName,
          category_name: selectedCategory,
        });

      if (error) throw error;

      // Reload mappings from database
      await loadPatternsFromDB();

      setNewPattern('');
      setSaveMessage('Merchant mapping added successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setError(err.message);
      console.error('Error adding mapping:', err);
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

  // Filter categories by type
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  // Category names for expense categories (for merchant mapping)
  const expenseCategoryNames = expenseCategories.map(c => c.name).sort();

  // Get all existing patterns across all categories for autocomplete
  const allExistingPatterns = [
    ...new Set(
      Object.values(patterns)
        .flat()
        .sort()
    )
  ];

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
                  <Input
                    placeholder="Category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                    bg={colors.cardBg}
                    borderColor={colors.borderColor}
                    color={colors.textPrimary}
                    flex={1}
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
                  <Input
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
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPattern()}
                    size="lg"
                    bg={colors.rowStripedBg}
                    borderColor={colors.borderColor}
                    color={colors.textPrimary}
                    _hover={{ borderColor: 'blue.400' }}
                    _focus={{ borderColor: 'blue.500', bg: colors.cardBg, boxShadow: '0 0 0 1px #3B82F6' }}
                    fontSize="md"
                    h="56px"
                    borderRadius="12px"
                    list="merchant-suggestions"
                  />
                  <datalist id="merchant-suggestions">
                    {allExistingPatterns.map((pattern) => (
                      <option key={pattern} value={pattern} />
                    ))}
                  </datalist>
                  <Text fontSize="xs" color={colors.textMuted} mt={1}>
                    Enter the exact merchant name as it appears in your bank statements
                  </Text>
                </Box>

                {/* Category Select */}
                <Box>
                  <Text fontWeight="600" mb={2} color={colors.textSecondary} fontSize="sm">
                    Assign to Category
                  </Text>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{
                      padding: '16px 14px',
                      fontSize: '16px',
                      borderRadius: '12px',
                      border: `1px solid ${colors.borderColor}`,
                      backgroundColor: colors.rowStripedBg,
                      color: colors.textPrimary,
                      height: '56px',
                      width: '100%',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="">Select a category...</option>
                    {expenseCategoryNames.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </Box>

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
          <Box
            p={6}
            borderRadius="lg"
            borderWidth="1px"
            borderColor="green.200"
            bg={colors.cardBg}
          >
            <Heading size="md" mb={4} color={colors.textPrimary}>Income Categories</Heading>
            <Text color={colors.textSecondary} mb={4}>
              Manage your income categories and add income transactions
            </Text>

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
            <Box p={4} bg={colors.rowStripedBg} borderRadius="md" mb={6}>
              <Text fontWeight="medium" mb={2} color={colors.textPrimary}>Add New Income Category</Text>
              <HStack gap={2}>
                <Input
                  placeholder="e.g., Salary, Freelance, Dividends"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                  bg={colors.cardBg}
                  borderColor={colors.borderColor}
                  color={colors.textPrimary}
                  flex={1}
                />
                <Button colorScheme="green" onClick={handleAddCategory}>
                  Add
                </Button>
              </HStack>
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
          </Box>
        )}

      </VStack>
    </PageContainer>
  );
}
