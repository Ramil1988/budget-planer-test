import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  VStack,
  HStack,
  Text,
  Spinner,
  Badge,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { notifyNewTransaction, checkBudgetAndNotify } from '../lib/notifications';
import { useDarkModeColors } from '../lib/useDarkModeColors';

export default function AddTransaction() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const colors = useDarkModeColors();

  // Form state
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Data state
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Custom dropdown state
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef(null);

  useEffect(() => {
    if (user) {
      loadCategories();
    }
  }, [user]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('user_id', user.id)
        .order('name');

      if (fetchError) throw fetchError;
      setCategories(data || []);
    } catch (err) {
      setError('Failed to load categories: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter categories by current type
  const filteredCategories = categories.filter(c => c.type === type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    if (!date) {
      setError('Please select a date');
      return;
    }

    setSubmitting(true);

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

      // Insert transaction
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          account_id: accountId,
          category_id: categoryId,
          type: type,
          amount: parseFloat(amount),
          description: description || (type === 'income' ? 'Income' : 'Expense'),
          date: date,
        });

      if (insertError) throw insertError;

      // Get category name for notification
      const selectedCategory = categories.find(c => c.id === categoryId);
      const categoryName = selectedCategory?.name || 'Unknown';

      // Send notification for new transaction
      notifyNewTransaction(
        { amount: parseFloat(amount), type, description },
        categoryName
      );

      // Check budget and notify if approaching limit (only for expenses)
      if (type === 'expense') {
        await checkBudgetAndNotify(supabase, user.id, categoryId, parseFloat(amount));
      }

      setSuccess('Transaction added successfully!');

      // Reset form
      setAmount('');
      setDescription('');
      setCategoryId('');

      // Navigate to transactions after short delay
      setTimeout(() => {
        navigate('/transactions');
      }, 1500);
    } catch (err) {
      setError('Failed to add transaction: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Flex w="100%" minH="calc(100vh - 140px)" align="center" justify="center">
        <VStack gap={4}>
          <Spinner size="xl" />
          <Text>Loading...</Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Box w="100%" h="100%" bg={colors.pageBg} p={6}>
      <Box w="100%" maxW="800px" mx="auto">
        <VStack gap={6} align="stretch" w="100%">
          <Flex justify="space-between" align="flex-start">
            <Box>
              <Heading size="xl" color={colors.textPrimary}>Add Transaction</Heading>
              <Text color={colors.textSecondary} mt={1}>
                Record a new income or expense
              </Text>
            </Box>
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              color={colors.textSecondary}
              _hover={{ bg: colors.rowStripedBg, color: colors.textPrimary }}
              fontSize="2xl"
              fontWeight="300"
              p={2}
              minW="auto"
              h="auto"
              borderRadius="full"
            >
              ×
            </Button>
          </Flex>

        {/* Success Message */}
        {success && (
          <Box p={4} bg={colors.successBg} borderRadius="md" borderColor={colors.successBorder} borderWidth="1px">
            <Text color={colors.success}>{success}</Text>
          </Box>
        )}

        {/* Error Message */}
        {error && (
          <Box p={4} bg={colors.dangerBg} borderRadius="md" borderColor={colors.dangerBorder} borderWidth="1px">
            <Text color={colors.danger}>{error}</Text>
          </Box>
        )}

        {/* Transaction Form */}
        <Box
          as="form"
          onSubmit={handleSubmit}
          p={6}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={colors.borderColor}
          bg={colors.cardBg}
        >
          <VStack gap={5} align="stretch">
            {/* Type Toggle */}
            <Box>
              <Text fontWeight="medium" mb={2} color={colors.textPrimary}>Transaction Type</Text>
              <HStack gap={2}>
                <Button
                  flex={1}
                  size="lg"
                  variant={type === 'expense' ? 'solid' : 'outline'}
                  colorScheme="red"
                  onClick={() => {
                    setType('expense');
                    setCategoryId('');
                  }}
                >
                  Expense
                </Button>
                <Button
                  flex={1}
                  size="lg"
                  variant={type === 'income' ? 'solid' : 'outline'}
                  colorScheme="green"
                  onClick={() => {
                    setType('income');
                    setCategoryId('');
                  }}
                >
                  Income
                </Button>
              </HStack>
            </Box>

            {/* Amount */}
            <Box>
              <Text fontWeight="medium" mb={2} color={colors.textPrimary}>Amount</Text>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                size="lg"
                fontSize="xl"
                bg={colors.cardBg}
                borderColor={colors.borderColor}
                color={colors.textPrimary}
              />
            </Box>

            {/* Category */}
            <Box>
              <Text fontWeight="medium" mb={2} color={colors.textPrimary}>Category</Text>
              {filteredCategories.length > 0 ? (
                <Box ref={categoryDropdownRef} position="relative" w="100%">
                  {/* Dropdown Trigger */}
                  <Box
                    onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                    cursor="pointer"
                    p={3}
                    h="48px"
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    borderRadius="8px"
                    borderWidth="1px"
                    borderColor={categoryDropdownOpen ? 'blue.500' : colors.borderColor}
                    bg={colors.cardBg}
                    _hover={{ borderColor: 'blue.400' }}
                    transition="all 0.2s"
                  >
                    <Text
                      color={categoryId ? colors.textPrimary : colors.textMuted}
                      fontSize="md"
                      noOfLines={1}
                    >
                      {categoryId ? filteredCategories.find(c => c.id === categoryId)?.name : 'Select a category'}
                    </Text>
                    <Box
                      as="span"
                      transform={categoryDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'}
                      transition="transform 0.2s"
                      color={colors.textSecondary}
                    >
                      ▼
                    </Box>
                  </Box>

                  {/* Dropdown List */}
                  {categoryDropdownOpen && (
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
                        {filteredCategories.map((cat) => {
                          const isSelected = cat.id === categoryId;
                          return (
                            <HStack
                              key={cat.id}
                              px={3}
                              py={2.5}
                              cursor="pointer"
                              bg={isSelected ? colors.rowStripedBg : 'transparent'}
                              _hover={{ bg: colors.rowStripedBg }}
                              borderRadius="8px"
                              onClick={() => {
                                setCategoryId(cat.id);
                                setCategoryDropdownOpen(false);
                              }}
                              justify="space-between"
                              transition="background 0.1s"
                            >
                              <Text
                                color={colors.textPrimary}
                                fontSize="sm"
                                fontWeight={isSelected ? '600' : '400'}
                              >
                                {cat.name}
                              </Text>
                              {isSelected && (
                                <Text color="blue.500" fontSize="sm">✓</Text>
                              )}
                            </HStack>
                          );
                        })}
                      </VStack>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box p={4} bg={colors.warningBg} borderRadius="md" borderColor={colors.warningBorder} borderWidth="1px">
                  <Text color={colors.warning}>
                    No {type} categories found. Please add {type} categories in the Categories page first.
                  </Text>
                </Box>
              )}
            </Box>

            {/* Description */}
            <Box>
              <Text fontWeight="medium" mb={2} color={colors.textPrimary}>Description (optional)</Text>
              <Input
                placeholder={type === 'income' ? 'e.g., Monthly salary' : 'e.g., Grocery shopping'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                size="lg"
                bg={colors.cardBg}
                borderColor={colors.borderColor}
                color={colors.textPrimary}
              />
            </Box>

            {/* Date */}
            <Box>
              <Text fontWeight="medium" mb={2} color={colors.textPrimary}>Date</Text>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                size="lg"
                bg={colors.cardBg}
                borderColor={colors.borderColor}
                color={colors.textPrimary}
              />
            </Box>

            {/* Submit Button */}
            <Button
              type="submit"
              colorScheme={type === 'income' ? 'green' : 'red'}
              size="lg"
              isLoading={submitting}
              loadingText="Adding..."
              disabled={!amount || !categoryId || submitting}
            >
              Add {type === 'income' ? 'Income' : 'Expense'}
            </Button>
          </VStack>
        </Box>

        {/* Quick Stats */}
        <HStack justify="center" gap={4}>
          <Badge colorScheme="red" px={3} py={1} fontSize="sm">
            {categories.filter(c => c.type === 'expense').length} expense categories
          </Badge>
          <Badge colorScheme="green" px={3} py={1} fontSize="sm">
            {categories.filter(c => c.type === 'income').length} income categories
          </Badge>
        </HStack>
        </VStack>
      </Box>
    </Box>
  );
}
