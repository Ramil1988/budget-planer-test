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

export default function CategoryManager() {
  const { user } = useAuth();
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
      <Flex w="100%" minH="calc(100vh - 140px)" align="center" justify="center">
        <VStack gap={4}>
          <Spinner size="xl" />
          <Text>Loading categories...</Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Box w="100%" h="100%" bg="gray.50" p={6}>
      <Box w="100%">
        <VStack gap={8} align="stretch" w="100%">
          <Box>
            <Heading size="2xl">Category Manager</Heading>
            <Text color="gray.600" mt={2}>
              Manage your expense and income categories
            </Text>
          </Box>

        {/* Success/Error Message */}
        {saveMessage && (
          <Box
            p={3}
            bg="green.50"
            borderColor="green.500"
            borderWidth="1px"
            borderRadius="md"
          >
            <Text color="green.700" fontWeight="medium">
              {saveMessage}
            </Text>
          </Box>
        )}

        {/* Error Message */}
        {error && (
          <Box
            p={3}
            bg="red.50"
            borderColor="red.500"
            borderWidth="1px"
            borderRadius="md"
          >
            <Text color="red.700" fontWeight="medium">
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
              borderColor="gray.200"
              bg="white"
            >
              <Heading size="md" mb={4}>Expense Categories</Heading>

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
                    <Text color="gray.500">No expense categories yet</Text>
                  )}
                </HStack>
              </Box>

              {/* Add New Category */}
              <Box p={4} bg="gray.50" borderRadius="md">
                <Text fontWeight="medium" mb={2}>Add New Expense Category</Text>
                <HStack gap={2}>
                  <Input
                    placeholder="Category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                    bg="white"
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
              borderRadius="lg"
              borderWidth="1px"
              borderColor="teal.200"
              bg="teal.50"
            >
              <Heading size="md" mb={4}>
                Merchant Mappings
              </Heading>
              <Text color="gray.700" mb={4}>
                Map merchant names (transaction descriptions) to expense categories for auto-categorization when importing transactions
              </Text>
              <VStack gap={4} align="stretch">
                {/* Labels Row */}
                <HStack gap={4}>
                  <Box flex={1}>
                    <Text fontWeight="medium">Merchant Name</Text>
                  </Box>
                  <Box flex={1}>
                    <Text fontWeight="medium">Category</Text>
                  </Box>
                  <Box w="140px">
                    <Text visibility="hidden">Button</Text>
                  </Box>
                </HStack>

                {/* Inputs Row */}
                <HStack gap={4} align="start">
                  <Box flex={1}>
                    <Input
                      placeholder="e.g., GLOBAL PET FOODS or PC-ENERGIE NB POWER"
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
                      bg="white"
                      list="merchant-suggestions"
                    />
                    <datalist id="merchant-suggestions">
                      {allExistingPatterns.map((pattern) => (
                        <option key={pattern} value={pattern} />
                      ))}
                    </datalist>
                  </Box>

                  <Box flex={1}>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      style={{
                        padding: '12px',
                        fontSize: '16px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        backgroundColor: 'white',
                        height: '48px',
                        width: '100%',
                      }}
                    >
                      <option value="">Select category</option>
                      {expenseCategoryNames.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </Box>

                  <Box w="140px">
                    <Button
                      colorScheme="teal"
                      size="lg"
                      onClick={handleAddPattern}
                      disabled={!selectedCategory || !newPattern.trim()}
                      h="48px"
                      w="100%"
                    >
                      Add Mapping
                    </Button>
                  </Box>
                </HStack>

                {/* Helper Text Row */}
                <Text fontSize="sm" color="gray.600">
                  Enter exact merchant name as it appears in transactions (case-insensitive)
                </Text>

                {/* Show existing mappings for selected category */}
                {selectedCategory && patterns[selectedCategory]?.length > 0 && (
                  <Box
                    p={4}
                    bg="white"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="gray.200"
                  >
                    <HStack justify="space-between" mb={2}>
                      <Text fontWeight="bold" fontSize="sm" color="gray.700">
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
                            bg="gray.50"
                            borderRadius="md"
                            fontSize="sm"
                          >
                            <Text>{merchantName}</Text>
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
            bg="green.50"
          >
            <Heading size="md" mb={4}>Income Categories</Heading>
            <Text color="gray.700" mb={4}>
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
                  <Text color="gray.500">No income categories yet</Text>
                )}
              </HStack>
            </Box>

            {/* Add New Category */}
            <Box p={4} bg="white" borderRadius="md" mb={6}>
              <Text fontWeight="medium" mb={2}>Add New Income Category</Text>
              <HStack gap={2}>
                <Input
                  placeholder="e.g., Salary, Freelance, Dividends"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                  bg="white"
                  flex={1}
                />
                <Button colorScheme="green" onClick={handleAddCategory}>
                  Add
                </Button>
              </HStack>
            </Box>

            {/* Quick Action to Add Income */}
            <Box p={4} bg="white" borderRadius="md" borderWidth="1px" borderColor="green.300">
              <HStack justify="space-between" align="center">
                <Box>
                  <Text fontWeight="bold">Ready to add income?</Text>
                  <Text fontSize="sm" color="gray.600">
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
      </Box>
    </Box>
  );
}
