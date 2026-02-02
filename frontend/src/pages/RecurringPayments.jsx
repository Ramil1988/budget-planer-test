import { useState, useEffect, useRef } from 'react';
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
  Spinner,
  Badge,
  Dialog,
  Portal,
  CloseButton,
  SimpleGrid,
  Menu,
  IconButton,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PageContainer from '../components/PageContainer';
import { useDarkModeColors } from '../lib/useDarkModeColors';
import {
  getNextPaymentDate,
  getUpcomingPayments,
  getMonthlyProjection,
  getPaymentDatesInRange,
  formatFrequency,
  formatDate,
  FREQUENCY_CONFIG,
} from '../lib/recurringUtils';

// Category colors
const categoryColors = {
  'Food': '#EF4444',
  'Food/Costco': '#F97316',
  'Fuel': '#F59E0B',
  'Clothes': '#EAB308',
  'Haircut': '#84CC16',
  'Massage': '#22C55E',
  'Mortgage': '#10B981',
  'Insurance': '#14B8A6',
  'Electricity': '#06B6D4',
  'Mobile/Internet': '#0EA5E9',
  'Household items/Car': '#3B82F6',
  'Pharmacy': '#6366F1',
  'Subscriptions': '#8B5CF6',
  'Government Loan': '#A855F7',
  'Autocredit': '#D946EF',
  'Property tax': '#EC4899',
  'Afterschool': '#F43F5E',
  'Weekend': '#FF6B6B',
  'Unexpected': '#94A3B8',
};

const getCategoryColor = (categoryName) => {
  return categoryColors[categoryName] || '#6B7280';
};

export default function RecurringPayments() {
  const { user } = useAuth();
  const colors = useDarkModeColors();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data state
  const [recurringPayments, setRecurringPayments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('expense');
  const [showInactive, setShowInactive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null); // Category filter

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    type: 'expense',
    category_id: '',
    frequency: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: '',
    business_days_only: false,
    last_business_day_of_month: false,
  });

  // Custom dropdown state
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [frequencyDropdownOpen, setFrequencyDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef(null);
  const frequencyDropdownRef = useRef(null);

  // Load data on mount
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setCategoryDropdownOpen(false);
      }
      if (frequencyDropdownRef.current && !frequencyDropdownRef.current.contains(event.target)) {
        setFrequencyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [paymentsResult, categoriesResult] = await Promise.all([
        supabase
          .from('recurring_payments')
          .select('*, categories(name)')
          .eq('user_id', user.id)
          .order('name'),
        supabase
          .from('categories')
          .select('id, name, type')
          .eq('user_id', user.id)
          .order('name'),
      ]);

      if (paymentsResult.error) throw paymentsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      setRecurringPayments(paymentsResult.data || []);
      setCategories(categoriesResult.data || []);
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // CRUD Operations
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        user_id: user.id,
        name: formData.name.trim(),
        amount: parseFloat(formData.amount),
        type: formData.type,
        category_id: formData.category_id || null,
        frequency: formData.frequency,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        notes: formData.notes.trim() || null,
        is_active: true,
        business_days_only: formData.business_days_only,
        last_business_day_of_month: formData.last_business_day_of_month,
      };

      if (editingPayment) {
        const { error } = await supabase
          .from('recurring_payments')
          .update(payload)
          .eq('id', editingPayment.id);
        if (error) throw error;
        setSuccess('Recurring payment updated!');
      } else {
        const { error } = await supabase
          .from('recurring_payments')
          .insert(payload);
        if (error) throw error;
        setSuccess('Recurring payment created!');
      }

      await loadData();
      closeModal();
    } catch (err) {
      setError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this recurring payment?')) return;

    try {
      const { error } = await supabase
        .from('recurring_payments')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setSuccess('Recurring payment deleted!');
      await loadData();
    } catch (err) {
      setError('Failed to delete: ' + err.message);
    }
  };

  const handleToggleActive = async (payment) => {
    try {
      const { error } = await supabase
        .from('recurring_payments')
        .update({ is_active: !payment.is_active })
        .eq('id', payment.id);
      if (error) throw error;
      await loadData();
    } catch (err) {
      setError('Failed to update: ' + err.message);
    }
  };

  // Modal handlers
  const openCreateModal = () => {
    setEditingPayment(null);
    setFormData({
      name: '',
      amount: '',
      type: activeTab,
      category_id: '',
      frequency: 'monthly',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      notes: '',
      business_days_only: false,
      last_business_day_of_month: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (payment) => {
    setEditingPayment(payment);
    setFormData({
      name: payment.name,
      amount: payment.amount.toString(),
      type: payment.type,
      category_id: payment.category_id || '',
      frequency: payment.frequency,
      start_date: payment.start_date,
      end_date: payment.end_date || '',
      notes: payment.notes || '',
      business_days_only: payment.business_days_only || false,
      last_business_day_of_month: payment.last_business_day_of_month || false,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPayment(null);
    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 3000);
  };

  // Get unique categories for the current tab (for filter chips)
  const availableCategories = [...new Set(
    recurringPayments
      .filter(p => p.type === activeTab && (showInactive || p.is_active) && p.categories?.name)
      .map(p => p.categories.name)
  )].sort();

  // Filter payments
  const filteredPayments = recurringPayments.filter(p => {
    if (p.type !== activeTab) return false;
    if (!showInactive && !p.is_active) return false;
    // Category filter
    if (selectedCategory && p.categories?.name !== selectedCategory) return false;
    return true;
  });

  // Filter categories by type
  const filteredCategories = categories.filter(c => c.type === formData.type);

  // Calculate projections
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const projection = getMonthlyProjection(recurringPayments.filter(p => p.is_active), currentMonth);
  const upcomingPayments = getUpcomingPayments(recurringPayments.filter(p => p.is_active), 30);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <PageContainer>
        <Flex w="100%" minH="60vh" align="center" justify="center">
          <VStack gap={4}>
            <Spinner size="xl" />
            <Text>Loading recurring payments...</Text>
          </VStack>
        </Flex>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <VStack gap={{ base: 4, md: 6 }} align="stretch" w="100%">
        {/* Header */}
        <Flex
          justify="space-between"
          align={{ base: 'stretch', sm: 'center' }}
          direction={{ base: 'column', sm: 'row' }}
          gap={3}
        >
          <Box>
            <Heading size={{ base: 'lg', md: 'xl' }} color={colors.textPrimary}>Recurring Payments</Heading>
            <Text color={colors.textSecondary} mt={1} fontSize={{ base: 'sm', md: 'md' }}>Manage your recurring bills and income</Text>
          </Box>
          <Button
            onClick={openCreateModal}
            bg="linear-gradient(135deg, #18181B 0%, #2563EB 100%)"
            color="white"
            px={{ base: 4, md: 6 }}
            fontWeight="600"
            borderRadius="12px"
            size={{ base: 'md', md: 'lg' }}
            w={{ base: '100%', sm: 'auto' }}
            _hover={{ transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}
          >
            + Add Recurring
          </Button>
        </Flex>

        {/* Success/Error Messages */}
        {success && (
          <Box p={3} bg={colors.successBg} borderColor={colors.successBorder} borderWidth="1px" borderRadius="md">
            <Text color={colors.success} fontWeight="medium">{success}</Text>
          </Box>
        )}
        {error && (
          <Box p={3} bg={colors.dangerBg} borderColor={colors.dangerBorder} borderWidth="1px" borderRadius="md">
            <Text color={colors.danger} fontWeight="medium">{error}</Text>
          </Box>
        )}

        {/* Monthly Projection Summary */}
        <SimpleGrid columns={{ base: 1, sm: 3 }} gap={{ base: 3, md: 4 }}>
          <Box
            p={{ base: 4, md: 5 }}
            borderRadius={{ base: '12px', md: '16px' }}
            bg="linear-gradient(135deg, #10B981 0%, #059669 100%)"
            color="white"
          >
            <Flex justify="space-between" align="center" display={{ base: 'flex', sm: 'none' }}>
              <Text fontSize="sm" opacity={0.9}>Monthly Income</Text>
              <Text fontSize="lg" fontWeight="700">{formatCurrency(projection.income)}</Text>
            </Flex>
            <Box display={{ base: 'none', sm: 'block' }}>
              <Text fontSize={{ sm: 'xs', md: 'sm' }} opacity={0.9}>Monthly Income</Text>
              <Text fontSize={{ sm: 'lg', md: '2xl' }} fontWeight="700">{formatCurrency(projection.income)}</Text>
              <Text fontSize={{ sm: '10px', md: 'xs' }} opacity={0.8}>{projection.payments.filter(p => p.type === 'income').length} payments</Text>
            </Box>
          </Box>
          <Box
            p={{ base: 4, md: 5 }}
            borderRadius={{ base: '12px', md: '16px' }}
            bg="linear-gradient(135deg, #EF4444 0%, #DC2626 100%)"
            color="white"
          >
            <Flex justify="space-between" align="center" display={{ base: 'flex', sm: 'none' }}>
              <Text fontSize="sm" opacity={0.9}>Monthly Expenses</Text>
              <Text fontSize="lg" fontWeight="700">{formatCurrency(projection.expenses)}</Text>
            </Flex>
            <Box display={{ base: 'none', sm: 'block' }}>
              <Text fontSize={{ sm: 'xs', md: 'sm' }} opacity={0.9}>Monthly Expenses</Text>
              <Text fontSize={{ sm: 'lg', md: '2xl' }} fontWeight="700">{formatCurrency(projection.expenses)}</Text>
              <Text fontSize={{ sm: '10px', md: 'xs' }} opacity={0.8}>{projection.payments.filter(p => p.type === 'expense').length} payments</Text>
            </Box>
          </Box>
          <Box
            p={{ base: 4, md: 5 }}
            borderRadius={{ base: '12px', md: '16px' }}
            bg={projection.net >= 0 ? 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' : 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)'}
            color="white"
          >
            <Flex justify="space-between" align="center" display={{ base: 'flex', sm: 'none' }}>
              <Text fontSize="sm" opacity={0.9}>Net Cash Flow</Text>
              <Text fontSize="lg" fontWeight="700">{projection.net >= 0 ? '+' : ''}{formatCurrency(projection.net)}</Text>
            </Flex>
            <Box display={{ base: 'none', sm: 'block' }}>
              <Text fontSize={{ sm: 'xs', md: 'sm' }} opacity={0.9}>Net Cash Flow</Text>
              <Text fontSize={{ sm: 'lg', md: '2xl' }} fontWeight="700">{projection.net >= 0 ? '+' : ''}{formatCurrency(projection.net)}</Text>
              <Text fontSize={{ sm: '10px', md: 'xs' }} opacity={0.8}>{projection.net >= 0 ? 'Surplus' : 'Deficit'}</Text>
            </Box>
          </Box>
        </SimpleGrid>

        {/* Tab Navigation */}
        <Flex gap={{ base: 2, md: 4 }} wrap="wrap" align="center">
          <Button
            size={{ base: 'sm', md: 'lg' }}
            variant={activeTab === 'expense' ? 'solid' : 'outline'}
            colorPalette="red"
            onClick={() => { setActiveTab('expense'); setSelectedCategory(null); }}
            fontSize={{ base: 'xs', md: 'md' }}
            px={{ base: 3, md: 4 }}
            flexShrink={0}
          >
            Expenses ({recurringPayments.filter(p => p.type === 'expense' && (showInactive || p.is_active)).length})
          </Button>
          <Button
            size={{ base: 'sm', md: 'lg' }}
            variant={activeTab === 'income' ? 'solid' : 'outline'}
            colorPalette="green"
            onClick={() => { setActiveTab('income'); setSelectedCategory(null); }}
            fontSize={{ base: 'xs', md: 'md' }}
            px={{ base: 3, md: 4 }}
            flexShrink={0}
          >
            Income ({recurringPayments.filter(p => p.type === 'income' && (showInactive || p.is_active)).length})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowInactive(!showInactive)}
            color={showInactive ? 'blue.600' : colors.textMuted}
            fontSize={{ base: 'xs', md: 'sm' }}
            flexShrink={0}
          >
            {showInactive ? 'Hide' : 'Show'} Inactive
          </Button>
        </Flex>

        {/* Category Filter Chips */}
        {availableCategories.length > 0 && (
          <Box
            overflowX="auto"
            css={{
              '&::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
            }}
          >
            <Flex gap={2} align="center" pb={1} flexWrap={{ base: 'nowrap', md: 'wrap' }}>
              <Text fontSize="sm" color={colors.textMuted} fontWeight="500" flexShrink={0}>
                Filter:
              </Text>
              {selectedCategory && (
                <Badge
                  px={3}
                  py={1}
                  borderRadius="full"
                  cursor="pointer"
                  bg={colors.textMuted}
                  color="white"
                  fontSize="xs"
                  fontWeight="600"
                  onClick={() => setSelectedCategory(null)}
                  _hover={{ opacity: 0.8 }}
                  flexShrink={0}
                >
                  Clear ✕
                </Badge>
              )}
              {availableCategories.map((catName) => (
                <Badge
                  key={catName}
                  px={3}
                  py={1}
                  borderRadius="full"
                  cursor="pointer"
                  bg={selectedCategory === catName ? getCategoryColor(catName) : colors.rowStripedBg}
                  color={selectedCategory === catName ? 'white' : colors.textSecondary}
                  border="1px solid"
                  borderColor={selectedCategory === catName ? getCategoryColor(catName) : colors.borderColor}
                  fontSize="xs"
                  fontWeight="500"
                  onClick={() => setSelectedCategory(selectedCategory === catName ? null : catName)}
                  _hover={{
                    bg: selectedCategory === catName ? getCategoryColor(catName) : colors.primaryBg,
                    borderColor: getCategoryColor(catName),
                  }}
                  transition="all 0.15s"
                  flexShrink={0}
                  whiteSpace="nowrap"
                >
                  {catName}
                </Badge>
              ))}
            </Flex>
          </Box>
        )}

        {/* Category Total when filtered */}
        {selectedCategory && filteredPayments.length > 0 && (() => {
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          const monthlyTotal = filteredPayments
            .filter(p => p.is_active)
            .reduce((sum, p) => {
              const occurrences = getPaymentDatesInRange(
                p.start_date, p.frequency, monthStart, monthEnd,
                p.end_date, p.business_days_only || false, p.last_business_day_of_month || false
              ).length;
              return sum + Number(p.amount) * occurrences;
            }, 0);
          return (
            <Flex
              align="center"
              justify="space-between"
              px={4}
              py={2.5}
              borderRadius="12px"
              bg={colors.cardBg}
              border="1px solid"
              borderColor={colors.borderSubtle}
            >
              <HStack gap={2}>
                <Box
                  w="10px"
                  h="10px"
                  borderRadius="full"
                  bg={getCategoryColor(selectedCategory)}
                />
                <Text fontSize="sm" fontWeight="600" color={colors.textPrimary}>
                  {selectedCategory}
                </Text>
                <Text fontSize="sm" color={colors.textMuted}>
                  ({filteredPayments.length} {filteredPayments.length === 1 ? 'payment' : 'payments'})
                </Text>
              </HStack>
              <Text
                fontSize="md"
                fontWeight="700"
                color={activeTab === 'expense' ? '#E11D48' : '#059669'}
              >
                {activeTab === 'expense' ? '-' : '+'}{formatCurrency(monthlyTotal)}
                <Text as="span" fontSize="xs" fontWeight="500" color={colors.textMuted}>/mo</Text>
              </Text>
            </Flex>
          );
        })()}

        {/* Recurring Payments List */}
        {filteredPayments.length === 0 ? (
          <Box
            p={8}
            borderRadius="16px"
            bg={colors.cardBg}
            boxShadow="0 1px 3px rgba(0,0,0,0.05)"
            border="1px solid" borderColor={colors.borderSubtle}
            textAlign="center"
          >
            {selectedCategory ? (
              <VStack gap={3}>
                <Text fontSize="lg" color={colors.textMuted}>
                  No {activeTab} payments in "{selectedCategory}"
                </Text>
                <Button size="sm" variant="outline" onClick={() => setSelectedCategory(null)}>
                  Clear filter
                </Button>
              </VStack>
            ) : (
              <>
                <Text fontSize="lg" color={colors.textMuted} mb={4}>
                  No {activeTab} recurring payments yet
                </Text>
                <Button onClick={openCreateModal} colorPalette="blue">
                  Add your first {activeTab}
                </Button>
              </>
            )}
          </Box>
        ) : (
          <VStack gap={{ base: 2, md: 3 }} align="stretch">
            {filteredPayments.map((payment) => {
              const nextDate = getNextPaymentDate(payment.start_date, payment.frequency, new Date(), payment.end_date, payment.business_days_only || false, payment.last_business_day_of_month || false);
              const daysUntil = nextDate ? Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24)) : null;

              return (
                <Box
                  key={payment.id}
                  p={{ base: 3, md: 4 }}
                  borderRadius={{ base: '12px', md: '16px' }}
                  bg={colors.cardBg}
                  boxShadow="0 1px 3px rgba(0,0,0,0.05)"
                  border="1px solid" borderColor={colors.borderSubtle}
                  opacity={payment.is_active ? 1 : 0.6}
                  _hover={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  transition="all 0.2s"
                >
                  {/* Mobile Layout */}
                  <Box display={{ base: 'block', md: 'none' }}>
                    <Flex justify="space-between" align="flex-start" gap={2}>
                      <HStack gap={2} flex={1} minW={0}>
                        <Box
                          w="36px"
                          h="36px"
                          borderRadius="10px"
                          bg={payment.type === 'expense' ? colors.expenseIconBg : colors.incomeIconBg}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          flexShrink={0}
                        >
                          <Box
                            w="10px"
                            h="10px"
                            borderRadius="full"
                            bg={getCategoryColor(payment.categories?.name)}
                          />
                        </Box>
                        <Box flex={1} minW={0}>
                          <HStack gap={1} mb={0.5}>
                            <Text
                              fontWeight="600"
                              fontSize="sm"
                              color={colors.textPrimary}
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                              maxW={{ base: '120px', xs: '160px' }}
                            >
                              {payment.name}
                            </Text>
                            {!payment.is_active && (
                              <Badge colorPalette="gray" size="sm" fontSize="10px" flexShrink={0}>Paused</Badge>
                            )}
                          </HStack>
                          <Flex gap={1} flexWrap="wrap" align="center">
                            <Badge colorPalette={payment.type === 'expense' ? 'red' : 'green'} variant="subtle" fontSize="10px">
                              {payment.categories?.name || 'Uncategorized'}
                            </Badge>
                            <Text fontSize="10px" color={colors.textMuted}>
                              {formatFrequency(payment.frequency)}
                            </Text>
                            {payment.business_days_only && (
                              <Badge colorPalette="blue" variant="subtle" fontSize="10px">
                                Weekdays
                              </Badge>
                            )}
                          </Flex>
                        </Box>
                      </HStack>
                      <VStack gap={0} align="flex-end" flexShrink={0}>
                        <Text
                          fontWeight="700"
                          fontSize="sm"
                          color={payment.type === 'expense' ? '#E11D48' : '#059669'}
                        >
                          {payment.type === 'expense' ? '-' : '+'}{formatCurrency(payment.amount)}
                        </Text>
                        {nextDate && payment.is_active && (
                          <Text
                            fontSize="10px"
                            color={daysUntil <= 3 ? '#DC2626' : '#71717A'}
                            fontWeight={daysUntil <= 3 ? '600' : '400'}
                          >
                            {daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                          </Text>
                        )}
                      </VStack>
                    </Flex>
                    <Flex gap={2} justify="flex-end" pt={2} mt={2} borderTop="1px solid" borderColor={colors.borderSubtle}>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleToggleActive(payment)}
                        colorPalette={payment.is_active ? 'orange' : 'green'}
                        fontSize="xs"
                        px={3}
                        borderRadius="full"
                      >
                        {payment.is_active ? 'Pause' : 'Resume'}
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => openEditModal(payment)}
                        fontSize="xs"
                        px={3}
                        borderRadius="full"
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        colorPalette="red"
                        onClick={() => handleDelete(payment.id)}
                        fontSize="xs"
                        px={3}
                        borderRadius="full"
                      >
                        Delete
                      </Button>
                    </Flex>
                  </Box>

                  {/* Desktop Layout */}
                  <Flex display={{ base: 'none', md: 'flex' }} justify="space-between" align="center" gap={3}>
                    <HStack gap={4}>
                      <Box
                        w="48px"
                        h="48px"
                        borderRadius="12px"
                        bg={payment.type === 'expense' ? colors.expenseIconBg : colors.incomeIconBg}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Box
                          w="12px"
                          h="12px"
                          borderRadius="full"
                          bg={getCategoryColor(payment.categories?.name)}
                        />
                      </Box>
                      <Box>
                        <HStack gap={2} mb={1}>
                          <Text fontWeight="600" fontSize="md" color={colors.textPrimary}>
                            {payment.name}
                          </Text>
                          {!payment.is_active && (
                            <Badge colorPalette="gray" size="sm">Paused</Badge>
                          )}
                        </HStack>
                        <HStack gap={2} flexWrap="wrap">
                          <Badge colorPalette={payment.type === 'expense' ? 'red' : 'green'} variant="subtle">
                            {payment.categories?.name || 'Uncategorized'}
                          </Badge>
                          <Text fontSize="xs" color={colors.textMuted}>
                            {formatFrequency(payment.frequency)}
                          </Text>
                          {payment.business_days_only && (
                            <Badge colorPalette="blue" variant="subtle" size="sm">
                              Weekdays
                            </Badge>
                          )}
                          {payment.last_business_day_of_month && (
                            <Badge colorPalette="purple" variant="subtle" size="sm">
                              Last biz day
                            </Badge>
                          )}
                          {payment.end_date && (
                            <Text fontSize="xs" color={colors.textMuted}>
                              until {formatDate(payment.end_date)}
                            </Text>
                          )}
                        </HStack>
                      </Box>
                    </HStack>

                    <HStack gap={4}>
                      <Box textAlign="right">
                        <Text
                          fontWeight="700"
                          fontSize="lg"
                          color={payment.type === 'expense' ? '#E11D48' : '#059669'}
                        >
                          {payment.type === 'expense' ? '-' : '+'}{formatCurrency(payment.amount)}
                        </Text>
                        {nextDate && payment.is_active && (
                          <Text
                            fontSize="xs"
                            color={daysUntil <= 3 ? '#DC2626' : '#71717A'}
                            fontWeight={daysUntil <= 3 ? '600' : '400'}
                          >
                            {daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Due tomorrow' : `In ${daysUntil} days`}
                          </Text>
                        )}
                        {!nextDate && payment.is_active && (
                          <Text fontSize="xs" color={colors.textMuted}>Ended</Text>
                        )}
                      </Box>

                      <HStack gap={1}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleActive(payment)}
                          color={payment.is_active ? 'orange.500' : 'green.500'}
                        >
                          {payment.is_active ? 'Pause' : 'Resume'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditModal(payment)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => handleDelete(payment.id)}
                        >
                          Delete
                        </Button>
                      </HStack>
                    </HStack>
                  </Flex>
                </Box>
              );
            })}
          </VStack>
        )}

        {/* Upcoming Payments Preview */}
        {upcomingPayments.length > 0 && (
          <Box
            p={{ base: 3, md: 5 }}
            borderRadius={{ base: '12px', md: '16px' }}
            bg={colors.cardBg}
            boxShadow="0 1px 3px rgba(0,0,0,0.05)"
            border="1px solid" borderColor={colors.borderSubtle}
          >
            <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 3, md: 4 }} color={colors.textPrimary}>Next 30 Days</Heading>
            <VStack gap={{ base: 1, md: 2 }} align="stretch" maxH="300px" overflowY="auto">
              {upcomingPayments.slice(0, 10).map((payment, index) => (
                <Flex
                  key={`${payment.id}-${index}`}
                  align="center"
                  justify="space-between"
                  p={{ base: 2, md: 3 }}
                  borderRadius={{ base: '8px', md: '10px' }}
                  bg={payment.daysUntil === 0 ? colors.itemDueTodayBg : payment.daysUntil <= 3 ? colors.itemDueSoonBg : colors.rowStripedBg}
                >
                  <HStack gap={{ base: 2, md: 3 }}>
                    <Box
                      w={{ base: '6px', md: '8px' }}
                      h={{ base: '6px', md: '8px' }}
                      borderRadius="full"
                      bg={getCategoryColor(payment.categories?.name)}
                      flexShrink={0}
                    />
                    <Box>
                      <Text fontWeight="500" fontSize={{ base: 'xs', md: 'sm' }} color={colors.textPrimary}>{payment.name}</Text>
                      <Text fontSize={{ base: '10px', md: 'xs' }} color={colors.textMuted}>
                        {formatDate(payment.nextDate)}
                      </Text>
                    </Box>
                  </HStack>
                  <Text
                    fontWeight="600"
                    fontSize={{ base: 'xs', md: 'sm' }}
                    color={payment.type === 'expense' ? '#E11D48' : '#059669'}
                    flexShrink={0}
                  >
                    {payment.type === 'expense' ? '-' : '+'}{formatCurrency(payment.amount)}
                  </Text>
                </Flex>
              ))}
            </VStack>
          </Box>
        )}
      </VStack>

      {/* Add/Edit Modal */}
      <Dialog.Root open={isModalOpen} onOpenChange={(e) => !e.open && closeModal()}>
        <Portal>
          <Dialog.Backdrop bg="blackAlpha.600" />
          <Dialog.Positioner>
            <Dialog.Content
              bg={colors.cardBg}
              borderRadius="20px"
              p={0}
              maxW="500px"
              w="90vw"
              overflow="hidden"
            >
              <Box
                bg={formData.type === 'expense' ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)'}
                p={5}
              >
                <Flex justify="space-between" align="center">
                  <Dialog.Title fontSize="lg" fontWeight="700" color="white">
                    {editingPayment ? 'Edit' : 'Add'} Recurring {formData.type === 'expense' ? 'Expense' : 'Income'}
                  </Dialog.Title>
                  <Dialog.CloseTrigger asChild>
                    <CloseButton color="white" />
                  </Dialog.CloseTrigger>
                </Flex>
              </Box>

              <Box p={6}>
                <form onSubmit={handleSubmit}>
                  <VStack gap={4} align="stretch">
                    {/* Type Toggle */}
                    <Box>
                      <Text fontWeight="600" mb={2} fontSize="sm" color={colors.textSecondary}>Type</Text>
                      <HStack gap={2}>
                        <Button
                          flex={1}
                          variant={formData.type === 'expense' ? 'solid' : 'outline'}
                          colorPalette="red"
                          onClick={() => setFormData({ ...formData, type: 'expense', category_id: '' })}
                          type="button"
                        >
                          Expense
                        </Button>
                        <Button
                          flex={1}
                          variant={formData.type === 'income' ? 'solid' : 'outline'}
                          colorPalette="green"
                          onClick={() => setFormData({ ...formData, type: 'income', category_id: '' })}
                          type="button"
                        >
                          Income
                        </Button>
                      </HStack>
                    </Box>

                    {/* Name */}
                    <Box>
                      <Text fontWeight="600" mb={2} fontSize="sm" color={colors.textSecondary}>Name *</Text>
                      <Input
                        placeholder="e.g., Netflix, Mortgage, Salary"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        bg={colors.cardBg}
                        borderColor={colors.borderColor}
                        color={colors.textPrimary}
                      />
                    </Box>

                    {/* Amount */}
                    <Box>
                      <Text fontWeight="600" mb={2} fontSize="sm" color={colors.textSecondary}>Amount *</Text>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                        bg={colors.cardBg}
                        borderColor={colors.borderColor}
                        color={colors.textPrimary}
                      />
                    </Box>

                    {/* Category */}
                    <Box>
                      <Text fontWeight="600" mb={2} fontSize="sm" color={colors.textSecondary}>Category</Text>
                      <Box ref={categoryDropdownRef} position="relative" w="100%">
                        {/* Dropdown Trigger */}
                        <Box
                          onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                          cursor="pointer"
                          px={3}
                          py={2.5}
                          h="42px"
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
                            color={formData.category_id ? colors.textPrimary : colors.textMuted}
                            fontSize="sm"
                            noOfLines={1}
                          >
                            {formData.category_id ? filteredCategories.find(c => c.id === formData.category_id)?.name : 'Select category...'}
                          </Text>
                          <Box
                            as="span"
                            transform={categoryDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'}
                            transition="transform 0.2s"
                            color={colors.textSecondary}
                            fontSize="xs"
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
                                const isSelected = cat.id === formData.category_id;
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
                                      setFormData({ ...formData, category_id: cat.id });
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
                    </Box>

                    {/* Frequency */}
                    <Box>
                      <Text fontWeight="600" mb={2} fontSize="sm" color={colors.textSecondary}>Frequency *</Text>
                      <Box ref={frequencyDropdownRef} position="relative" w="100%">
                        {/* Dropdown Trigger */}
                        <Box
                          onClick={() => setFrequencyDropdownOpen(!frequencyDropdownOpen)}
                          cursor="pointer"
                          px={3}
                          py={2.5}
                          h="42px"
                          display="flex"
                          alignItems="center"
                          justifyContent="space-between"
                          borderRadius="8px"
                          borderWidth="1px"
                          borderColor={frequencyDropdownOpen ? 'blue.500' : colors.borderColor}
                          bg={colors.cardBg}
                          _hover={{ borderColor: 'blue.400' }}
                          transition="all 0.2s"
                        >
                          <Text
                            color={colors.textPrimary}
                            fontSize="sm"
                            noOfLines={1}
                          >
                            {FREQUENCY_CONFIG[formData.frequency]?.label || formData.frequency}
                          </Text>
                          <Box
                            as="span"
                            transform={frequencyDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'}
                            transition="transform 0.2s"
                            color={colors.textSecondary}
                            fontSize="xs"
                          >
                            ▼
                          </Box>
                        </Box>

                        {/* Dropdown List */}
                        {frequencyDropdownOpen && (
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
                              {Object.entries(FREQUENCY_CONFIG).map(([key, config]) => {
                                const isSelected = key === formData.frequency;
                                return (
                                  <HStack
                                    key={key}
                                    px={3}
                                    py={2.5}
                                    cursor="pointer"
                                    bg={isSelected ? colors.rowStripedBg : 'transparent'}
                                    _hover={{ bg: colors.rowStripedBg }}
                                    borderRadius="8px"
                                    onClick={() => {
                                      setFormData({ ...formData, frequency: key });
                                      setFrequencyDropdownOpen(false);
                                    }}
                                    justify="space-between"
                                    transition="background 0.1s"
                                  >
                                    <Text
                                      color={colors.textPrimary}
                                      fontSize="sm"
                                      fontWeight={isSelected ? '600' : '400'}
                                    >
                                      {config.label}
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
                    </Box>

                    {/* Dates */}
                    <SimpleGrid columns={2} gap={4}>
                      <Box>
                        <Text fontWeight="600" mb={2} fontSize="sm" color={colors.textSecondary}>Start Date *</Text>
                        <Input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                          required
                          bg={colors.cardBg}
                          borderColor={colors.borderColor}
                          color={colors.textPrimary}
                        />
                      </Box>
                      <Box>
                        <Text fontWeight="600" mb={2} fontSize="sm" color={colors.textSecondary}>End Date</Text>
                        <Input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                          placeholder="Optional"
                          bg={colors.cardBg}
                          borderColor={colors.borderColor}
                          color={colors.textPrimary}
                        />
                      </Box>
                    </SimpleGrid>

                    {/* Business Days Only */}
                    <Box>
                      <Flex
                        align="center"
                        gap={3}
                        p={3}
                        borderRadius="10px"
                        bg={formData.business_days_only ? colors.primaryBg : colors.rowStripedBg}
                        border="1px solid"
                        borderColor={formData.business_days_only ? 'blue.300' : colors.borderColor}
                        cursor="pointer"
                        onClick={() => setFormData({ ...formData, business_days_only: !formData.business_days_only })}
                        transition="all 0.2s"
                        _hover={{ borderColor: 'blue.300' }}
                      >
                        <Box
                          w="20px"
                          h="20px"
                          borderRadius="4px"
                          border="2px solid"
                          borderColor={formData.business_days_only ? 'blue.500' : colors.borderColor}
                          bg={formData.business_days_only ? 'blue.500' : 'transparent'}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          flexShrink={0}
                        >
                          {formData.business_days_only && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </Box>
                        <Box flex="1">
                          <Text fontWeight="600" fontSize="sm" color={colors.textPrimary}>
                            Business days only
                          </Text>
                          <Text fontSize="xs" color={colors.textMuted}>
                            Adjust weekend dates to nearest weekday (Sat→Fri, Sun→Mon)
                          </Text>
                        </Box>
                      </Flex>
                    </Box>

                    {/* Last Business Day of Month - only show for monthly/quarterly/yearly */}
                    {['monthly', 'quarterly', 'yearly'].includes(formData.frequency) && (
                      <Box>
                        <Flex
                          align="center"
                          gap={3}
                          p={3}
                          borderRadius="10px"
                          bg={formData.last_business_day_of_month ? 'purple.50' : colors.rowStripedBg}
                          border="1px solid"
                          borderColor={formData.last_business_day_of_month ? 'purple.300' : colors.borderColor}
                          cursor="pointer"
                          onClick={() => setFormData({ ...formData, last_business_day_of_month: !formData.last_business_day_of_month })}
                          transition="all 0.2s"
                          _hover={{ borderColor: 'purple.300' }}
                        >
                          <Box
                            w="20px"
                            h="20px"
                            borderRadius="4px"
                            border="2px solid"
                            borderColor={formData.last_business_day_of_month ? 'purple.500' : colors.borderColor}
                            bg={formData.last_business_day_of_month ? 'purple.500' : 'transparent'}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            flexShrink={0}
                          >
                            {formData.last_business_day_of_month && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </Box>
                          <Box flex="1">
                            <Text fontWeight="600" fontSize="sm" color={formData.last_business_day_of_month ? 'purple.800' : colors.textPrimary}>
                              Last business day of month
                            </Text>
                            <Text fontSize="xs" color={formData.last_business_day_of_month ? 'purple.600' : colors.textMuted}>
                              Always schedule on the last weekday (Mon-Fri) of each month
                            </Text>
                          </Box>
                        </Flex>
                      </Box>
                    )}

                    {/* Notes */}
                    <Box>
                      <Text fontWeight="600" mb={2} fontSize="sm" color={colors.textSecondary}>Notes</Text>
                      <Input
                        placeholder="Optional notes..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        bg={colors.cardBg}
                        borderColor={colors.borderColor}
                        color={colors.textPrimary}
                      />
                    </Box>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      loading={saving}
                      loadingText={editingPayment ? 'Updating...' : 'Creating...'}
                      bg={formData.type === 'expense' ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)'}
                      color="white"
                      w="100%"
                      size="lg"
                      fontWeight="600"
                      borderRadius="12px"
                      _hover={{ transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
                    >
                      {editingPayment ? 'Update' : 'Add'} Recurring Payment
                    </Button>
                  </VStack>
                </form>
              </Box>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </PageContainer>
  );
}
