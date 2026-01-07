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
  Spinner,
  Badge,
  Dialog,
  Portal,
  CloseButton,
  SimpleGrid,
} from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PageContainer from '../components/PageContainer';
import {
  getNextPaymentDate,
  getUpcomingPayments,
  getMonthlyProjection,
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
  'NB Power': '#06B6D4',
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data state
  const [recurringPayments, setRecurringPayments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('expense');
  const [showInactive, setShowInactive] = useState(false);

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
  });

  // Load data on mount
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

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

  // Filter payments
  const filteredPayments = recurringPayments.filter(p => {
    if (p.type !== activeTab) return false;
    if (!showInactive && !p.is_active) return false;
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
            <Heading size={{ base: 'lg', md: 'xl' }}>Recurring Payments</Heading>
            <Text color="gray.500" mt={1} fontSize={{ base: 'sm', md: 'md' }}>Manage your recurring bills and income</Text>
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
          <Box p={3} bg="green.50" borderColor="green.500" borderWidth="1px" borderRadius="md">
            <Text color="green.700" fontWeight="medium">{success}</Text>
          </Box>
        )}
        {error && (
          <Box p={3} bg="red.50" borderColor="red.500" borderWidth="1px" borderRadius="md">
            <Text color="red.700" fontWeight="medium">{error}</Text>
          </Box>
        )}

        {/* Monthly Projection Summary */}
        <SimpleGrid columns={{ base: 3, md: 3 }} gap={{ base: 2, md: 4 }}>
          <Box
            p={{ base: 3, md: 5 }}
            borderRadius={{ base: '12px', md: '16px' }}
            bg="linear-gradient(135deg, #10B981 0%, #059669 100%)"
            color="white"
          >
            <Text fontSize={{ base: 'xs', md: 'sm' }} opacity={0.9}>Monthly Income</Text>
            <Text fontSize={{ base: 'md', md: '2xl' }} fontWeight="700">{formatCurrency(projection.income)}</Text>
            <Text fontSize={{ base: '10px', md: 'xs' }} opacity={0.8}>{projection.payments.filter(p => p.type === 'income').length} payments</Text>
          </Box>
          <Box
            p={{ base: 3, md: 5 }}
            borderRadius={{ base: '12px', md: '16px' }}
            bg="linear-gradient(135deg, #EF4444 0%, #DC2626 100%)"
            color="white"
          >
            <Text fontSize={{ base: 'xs', md: 'sm' }} opacity={0.9}>Monthly Expenses</Text>
            <Text fontSize={{ base: 'md', md: '2xl' }} fontWeight="700">{formatCurrency(projection.expenses)}</Text>
            <Text fontSize={{ base: '10px', md: 'xs' }} opacity={0.8}>{projection.payments.filter(p => p.type === 'expense').length} payments</Text>
          </Box>
          <Box
            p={{ base: 3, md: 5 }}
            borderRadius={{ base: '12px', md: '16px' }}
            bg={projection.net >= 0 ? 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' : 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)'}
            color="white"
          >
            <Text fontSize={{ base: 'xs', md: 'sm' }} opacity={0.9}>Net Cash Flow</Text>
            <Text fontSize={{ base: 'md', md: '2xl' }} fontWeight="700">{projection.net >= 0 ? '+' : ''}{formatCurrency(projection.net)}</Text>
            <Text fontSize={{ base: '10px', md: 'xs' }} opacity={0.8}>{projection.net >= 0 ? 'Surplus' : 'Deficit'}</Text>
          </Box>
        </SimpleGrid>

        {/* Tab Navigation */}
        <Flex gap={{ base: 2, md: 4 }} wrap="wrap" align="center">
          <Button
            size={{ base: 'md', md: 'lg' }}
            variant={activeTab === 'expense' ? 'solid' : 'outline'}
            colorPalette="red"
            onClick={() => setActiveTab('expense')}
            fontSize={{ base: 'sm', md: 'md' }}
            px={{ base: 3, md: 4 }}
          >
            Expenses ({recurringPayments.filter(p => p.type === 'expense' && (showInactive || p.is_active)).length})
          </Button>
          <Button
            size={{ base: 'md', md: 'lg' }}
            variant={activeTab === 'income' ? 'solid' : 'outline'}
            colorPalette="green"
            onClick={() => setActiveTab('income')}
            fontSize={{ base: 'sm', md: 'md' }}
            px={{ base: 3, md: 4 }}
          >
            Income ({recurringPayments.filter(p => p.type === 'income' && (showInactive || p.is_active)).length})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowInactive(!showInactive)}
            color={showInactive ? 'blue.600' : 'gray.500'}
            fontSize={{ base: 'xs', md: 'sm' }}
          >
            {showInactive ? 'Hide' : 'Show'} Inactive
          </Button>
        </Flex>

        {/* Recurring Payments List */}
        {filteredPayments.length === 0 ? (
          <Box
            p={8}
            borderRadius="16px"
            bg="white"
            boxShadow="0 1px 3px rgba(0,0,0,0.05)"
            border="1px solid #F3F4F6"
            textAlign="center"
          >
            <Text fontSize="lg" color="gray.500" mb={4}>
              No {activeTab} recurring payments yet
            </Text>
            <Button onClick={openCreateModal} colorPalette="blue">
              Add your first {activeTab}
            </Button>
          </Box>
        ) : (
          <VStack gap={{ base: 2, md: 3 }} align="stretch">
            {filteredPayments.map((payment) => {
              const nextDate = getNextPaymentDate(payment.start_date, payment.frequency, new Date(), payment.end_date);
              const daysUntil = nextDate ? Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24)) : null;

              return (
                <Box
                  key={payment.id}
                  p={{ base: 3, md: 4 }}
                  borderRadius={{ base: '12px', md: '16px' }}
                  bg="white"
                  boxShadow="0 1px 3px rgba(0,0,0,0.05)"
                  border="1px solid #F3F4F6"
                  opacity={payment.is_active ? 1 : 0.6}
                  _hover={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  transition="all 0.2s"
                >
                  {/* Mobile Layout */}
                  <Box display={{ base: 'block', md: 'none' }}>
                    <Flex justify="space-between" align="flex-start" mb={2}>
                      <HStack gap={2}>
                        <Box
                          w="36px"
                          h="36px"
                          borderRadius="10px"
                          bg={payment.type === 'expense' ? '#FEE2E2' : '#D1FAE5'}
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
                        <Box>
                          <HStack gap={1} mb={0.5}>
                            <Text fontWeight="600" fontSize="sm" color="#18181B">
                              {payment.name}
                            </Text>
                            {!payment.is_active && (
                              <Badge colorPalette="gray" size="sm" fontSize="10px">Paused</Badge>
                            )}
                          </HStack>
                          <HStack gap={1} flexWrap="wrap">
                            <Badge colorPalette={payment.type === 'expense' ? 'red' : 'green'} variant="subtle" fontSize="10px">
                              {payment.categories?.name || 'Uncategorized'}
                            </Badge>
                            <Text fontSize="10px" color="gray.500">
                              {formatFrequency(payment.frequency)}
                            </Text>
                            {payment.end_date && (
                              <Text fontSize="10px" color="gray.400">
                                until {formatDate(payment.end_date)}
                              </Text>
                            )}
                          </HStack>
                        </Box>
                      </HStack>
                      <Box textAlign="right">
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
                            {daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Due tomorrow' : `In ${daysUntil} days`}
                          </Text>
                        )}
                      </Box>
                    </Flex>
                    <Flex gap={1} justify="flex-end" pt={2} borderTop="1px solid #F4F4F5">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleToggleActive(payment)}
                        color={payment.is_active ? 'orange.500' : 'green.500'}
                        fontSize="xs"
                        px={2}
                      >
                        {payment.is_active ? 'Pause' : 'Resume'}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => openEditModal(payment)}
                        fontSize="xs"
                        px={2}
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        colorPalette="red"
                        onClick={() => handleDelete(payment.id)}
                        fontSize="xs"
                        px={2}
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
                        bg={payment.type === 'expense' ? '#FEE2E2' : '#D1FAE5'}
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
                          <Text fontWeight="600" fontSize="md" color="#18181B">
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
                          <Text fontSize="xs" color="gray.500">
                            {formatFrequency(payment.frequency)}
                          </Text>
                          {payment.end_date && (
                            <Text fontSize="xs" color="gray.400">
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
                          <Text fontSize="xs" color="gray.400">Ended</Text>
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
            bg="white"
            boxShadow="0 1px 3px rgba(0,0,0,0.05)"
            border="1px solid #F3F4F6"
          >
            <Heading size={{ base: 'sm', md: 'md' }} mb={{ base: 3, md: 4 }} color="#18181B">Next 30 Days</Heading>
            <VStack gap={{ base: 1, md: 2 }} align="stretch" maxH="300px" overflowY="auto">
              {upcomingPayments.slice(0, 10).map((payment, index) => (
                <Flex
                  key={`${payment.id}-${index}`}
                  align="center"
                  justify="space-between"
                  p={{ base: 2, md: 3 }}
                  borderRadius={{ base: '8px', md: '10px' }}
                  bg={payment.daysUntil === 0 ? '#FEF2F2' : payment.daysUntil <= 3 ? '#FFFBEB' : '#F9FAFB'}
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
                      <Text fontWeight="500" fontSize={{ base: 'xs', md: 'sm' }}>{payment.name}</Text>
                      <Text fontSize={{ base: '10px', md: 'xs' }} color="gray.500">
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
              bg="white"
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
                      <Text fontWeight="600" mb={2} fontSize="sm" color="gray.700">Type</Text>
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
                      <Text fontWeight="600" mb={2} fontSize="sm" color="gray.700">Name *</Text>
                      <Input
                        placeholder="e.g., Netflix, Mortgage, Salary"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </Box>

                    {/* Amount */}
                    <Box>
                      <Text fontWeight="600" mb={2} fontSize="sm" color="gray.700">Amount *</Text>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                      />
                    </Box>

                    {/* Category */}
                    <Box>
                      <Text fontWeight="600" mb={2} fontSize="sm" color="gray.700">Category</Text>
                      <select
                        value={formData.category_id}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                        style={{
                          padding: '10px 14px',
                          fontSize: '14px',
                          borderRadius: '8px',
                          border: '1px solid #E4E4E7',
                          backgroundColor: 'white',
                          width: '100%',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">Select category...</option>
                        {filteredCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </Box>

                    {/* Frequency */}
                    <Box>
                      <Text fontWeight="600" mb={2} fontSize="sm" color="gray.700">Frequency *</Text>
                      <select
                        value={formData.frequency}
                        onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                        style={{
                          padding: '10px 14px',
                          fontSize: '14px',
                          borderRadius: '8px',
                          border: '1px solid #E4E4E7',
                          backgroundColor: 'white',
                          width: '100%',
                          cursor: 'pointer',
                        }}
                        required
                      >
                        {Object.entries(FREQUENCY_CONFIG).map(([key, config]) => (
                          <option key={key} value={key}>
                            {config.label}
                          </option>
                        ))}
                      </select>
                    </Box>

                    {/* Dates */}
                    <SimpleGrid columns={2} gap={4}>
                      <Box>
                        <Text fontWeight="600" mb={2} fontSize="sm" color="gray.700">Start Date *</Text>
                        <Input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                          required
                        />
                      </Box>
                      <Box>
                        <Text fontWeight="600" mb={2} fontSize="sm" color="gray.700">End Date</Text>
                        <Input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                          placeholder="Optional"
                        />
                      </Box>
                    </SimpleGrid>

                    {/* Notes */}
                    <Box>
                      <Text fontWeight="600" mb={2} fontSize="sm" color="gray.700">Notes</Text>
                      <Input
                        placeholder="Optional notes..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
