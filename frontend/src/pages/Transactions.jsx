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
  Table,
  Icon,
  Collapsible,
  Dialog,
  Portal,
  CloseButton,
} from '@chakra-ui/react';
import { LuFilter, LuX } from 'react-icons/lu';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import PageContainer from '../components/PageContainer';
import { useDarkModeColors } from '../lib/useDarkModeColors';

export default function Transactions() {
  const { user } = useAuth();
  const colors = useDarkModeColors();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  // Custom filter states
  const [showCustomFilters, setShowCustomFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [customFiltersApplied, setCustomFiltersApplied] = useState(false);

  // Delete all dialog state
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Trash/Active view state
  const [viewMode, setViewMode] = useState('active'); // 'active' | 'trash'
  const [trashedTransactions, setTrashedTransactions] = useState([]);
  const [loadingTrash, setLoadingTrash] = useState(false);

  // Restore/Permanent delete states
  const [restoringId, setRestoringId] = useState(null);

  // Empty trash dialog
  const [showEmptyTrashDialog, setShowEmptyTrashDialog] = useState(false);
  const [emptyingTrash, setEmptyingTrash] = useState(false);

  // Restore all dialog
  const [showRestoreAllDialog, setShowRestoreAllDialog] = useState(false);
  const [restoringAll, setRestoringAll] = useState(false);

  // Category editing state
  const [categories, setCategories] = useState([]);
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [updatingCategory, setUpdatingCategory] = useState(false);

  useEffect(() => {
    if (user) {
      loadTransactions();
      loadTrashTransactions(); // Load trash count on mount
      loadCategories();
    }
  }, [user]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('user_id', user.id)
        .order('name');
      if (!error) setCategories(data || []);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const updateTransactionCategory = async (transactionId, newCategoryId, transactionType) => {
    setUpdatingCategory(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: newCategoryId })
        .eq('id', transactionId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      const newCategory = categories.find(c => c.id === newCategoryId);
      setTransactions(prev => prev.map(t =>
        t.id === transactionId ? { ...t, category: newCategory?.name || 'Unknown', category_id: newCategoryId } : t
      ));
      setEditingTransactionId(null);
    } catch (err) {
      console.error('Error updating category:', err);
      setError('Failed to update category');
    } finally {
      setUpdatingCategory(false);
    }
  };

  useEffect(() => {
    filterTransactions();
  }, [transactions, searchQuery, selectedPeriod, customFiltersApplied, startDate, endDate, minAmount, maxAmount]);

  // Refresh trash when switching to trash view (in case items were restored/deleted elsewhere)
  useEffect(() => {
    if (viewMode === 'trash' && user) {
      loadTrashTransactions();
    }
  }, [viewMode, user]);

  const loadTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: txError } = await supabase
        .from('transactions')
        .select(`
          id,
          description,
          date,
          amount,
          type,
          provider,
          category_id,
          created_at,
          categories (name)
        `)
        .eq('user_id', user.id)
        .is('deleted_at', null)  // Only load active (non-deleted) transactions
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (txError) throw txError;

      // Sort chronologically (oldest first) for balance calculation
      const sortedData = [...(data || [])].sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        // Secondary sort by created_at for same-day transactions
        return new Date(a.created_at) - new Date(b.created_at);
      });

      // Calculate cumulative spending (expenses only, not affected by income)
      let runningSpend = 0;
      const balanceMap = new Map();
      sortedData.forEach((t) => {
        if (t.type === 'expense') {
          runningSpend += t.amount;
        }
        balanceMap.set(t.id, -runningSpend); // Show as negative for expenses
      });

      const transformedTransactions = (data || []).map((t) => ({
        id: t.id,
        description: t.description,
        date: t.date,
        amount: t.amount,
        type: t.type,
        category: t.categories?.name || 'Unknown',
        category_id: t.category_id,
        bank: t.provider || null,
        balance: balanceMap.get(t.id),
      }));

      setTransactions(transformedTransactions);
    } catch (err) {
      setError(err.message);
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTrashTransactions = async () => {
    setLoadingTrash(true);
    setError('');
    try {
      const { data, error: txError } = await supabase
        .from('transactions')
        .select(`
          id,
          description,
          date,
          amount,
          type,
          provider,
          category_id,
          created_at,
          deleted_at,
          categories (name)
        `)
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)  // Only deleted items
        .order('deleted_at', { ascending: false }); // Most recently deleted first

      if (txError) throw txError;

      const transformedTransactions = (data || []).map((t) => ({
        id: t.id,
        description: t.description,
        date: t.date,
        amount: t.amount,
        type: t.type,
        category: t.categories?.name || 'Unknown',
        bank: t.provider || null,
        deletedAt: t.deleted_at,
      }));

      setTrashedTransactions(transformedTransactions);
    } catch (err) {
      setError(err.message);
      console.error('Error loading trash:', err);
    } finally {
      setLoadingTrash(false);
    }
  };

  const filterTransactions = () => {
    let filtered = [...transactions];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
      );
    }

    // Apply custom filters if enabled
    if (customFiltersApplied) {
      // Date range filter
      if (startDate) {
        filtered = filtered.filter(t => t.date >= startDate);
      }
      if (endDate) {
        filtered = filtered.filter(t => t.date <= endDate);
      }
      // Amount range filter
      if (minAmount !== '') {
        const min = parseFloat(minAmount);
        if (!isNaN(min)) {
          filtered = filtered.filter(t => t.amount >= min);
        }
      }
      if (maxAmount !== '') {
        const max = parseFloat(maxAmount);
        if (!isNaN(max)) {
          filtered = filtered.filter(t => t.amount <= max);
        }
      }
    } else if (selectedPeriod === 'current') {
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // 1-indexed
      const currentYear = now.getFullYear();
      filtered = filtered.filter(t => {
        // Parse YYYY-MM-DD directly to avoid timezone issues
        const [year, month] = t.date.split('-').map(Number);
        return month === currentMonth && year === currentYear;
      });
    } else if (selectedPeriod === 'last-month') {
      const now = new Date();
      let lastMonth = now.getMonth(); // Current month is 0-indexed, so this gives us last month 1-indexed
      let lastYear = now.getFullYear();
      if (lastMonth === 0) {
        lastMonth = 12;
        lastYear -= 1;
      }
      filtered = filtered.filter(t => {
        // Parse YYYY-MM-DD directly to avoid timezone issues
        const [year, month] = t.date.split('-').map(Number);
        return month === lastMonth && year === lastYear;
      });
    }

    // Calculate cumulative spending (expenses only, not affected by income)
    const oldestFirst = [...filtered].reverse();
    let runningSpend = 0;
    const balanceMap = new Map();
    oldestFirst.forEach((t) => {
      if (t.type === 'expense') {
        runningSpend += t.amount;
      }
      balanceMap.set(t.id, -runningSpend); // Show as negative for expenses
    });

    const filteredWithBalance = filtered.map(t => ({
      ...t,
      balance: balanceMap.get(t.id),
    }));

    setFilteredTransactions(filteredWithBalance);
  };

  const formatDate = (dateString) => {
    // Parse YYYY-MM-DD without timezone conversion issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatAmount = (amount, type) => {
    const formatted = Math.abs(amount).toFixed(2);
    return type === 'expense' ? `-$${formatted}` : `+$${formatted}`;
  };

  const formatBalance = (balance) => {
    const formatted = Math.abs(balance).toFixed(2);
    return balance < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  // Soft delete - moves to trash instead of permanent deletion
  const handleDeleteTransaction = async (transactionId) => {
    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', transactionId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Find the deleted transaction before removing it from active list
      const deletedTransaction = transactions.find(t => t.id === transactionId);
      setTransactions(prev => prev.filter(t => t.id !== transactionId));

      // Add the full transaction object to trash (not just the id)
      if (deletedTransaction) {
        setTrashedTransactions(prev => [...prev, {
          ...deletedTransaction,
          deletedAt: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      setError('Failed to delete transaction: ' + err.message);
      console.error('Delete error:', err);
    }
  };

  // Soft delete all - moves all to trash
  const handleDeleteAllTransactions = async () => {
    setDeletingAll(true);
    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('deleted_at', null);  // Only soft delete active transactions

      if (deleteError) throw deleteError;
      const movedCount = transactions.length;
      setTransactions([]);
      setShowDeleteAllDialog(false);
      // Update trash count
      loadTrashTransactions();
    } catch (err) {
      setError('Failed to delete all transactions: ' + err.message);
      console.error('Delete all error:', err);
    } finally {
      setDeletingAll(false);
    }
  };

  // Restore transaction from trash
  const handleRestoreTransaction = async (transactionId) => {
    setRestoringId(transactionId);
    try {
      const { error: restoreError } = await supabase
        .from('transactions')
        .update({ deleted_at: null })
        .eq('id', transactionId)
        .eq('user_id', user.id);

      if (restoreError) throw restoreError;

      // Remove from trash list
      setTrashedTransactions(prev => prev.filter(t => t.id !== transactionId));
      // Refresh active transactions
      loadTransactions();
    } catch (err) {
      setError('Failed to restore transaction: ' + err.message);
      console.error('Restore error:', err);
    } finally {
      setRestoringId(null);
    }
  };

  // Permanently delete a single transaction from trash
  const handlePermanentDelete = async (transactionId) => {
    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;
      setTrashedTransactions(prev => prev.filter(t => t.id !== transactionId));
    } catch (err) {
      setError('Failed to permanently delete transaction: ' + err.message);
      console.error('Permanent delete error:', err);
    }
  };

  // Empty all trash - permanently delete all trashed items
  const handleEmptyTrash = async () => {
    setEmptyingTrash(true);
    try {
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null);  // Only delete trashed items

      if (deleteError) throw deleteError;
      setTrashedTransactions([]);
      setShowEmptyTrashDialog(false);
    } catch (err) {
      setError('Failed to empty trash: ' + err.message);
      console.error('Empty trash error:', err);
    } finally {
      setEmptyingTrash(false);
    }
  };

  // Restore all trashed items
  const handleRestoreAll = async () => {
    setRestoringAll(true);
    try {
      const { error: restoreError } = await supabase
        .from('transactions')
        .update({ deleted_at: null })
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null);  // Only restore trashed items

      if (restoreError) throw restoreError;
      setTrashedTransactions([]);
      setShowRestoreAllDialog(false);
      // Refresh active transactions
      loadTransactions();
    } catch (err) {
      setError('Failed to restore all transactions: ' + err.message);
      console.error('Restore all error:', err);
    } finally {
      setRestoringAll(false);
    }
  };

  const applyCustomFilters = () => {
    setCustomFiltersApplied(true);
    setSelectedPeriod('custom');
    setShowCustomFilters(false);
  };

  const clearCustomFilters = () => {
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setCustomFiltersApplied(false);
    setSelectedPeriod('current');
    setShowCustomFilters(false);
  };

  const toggleCustomFilters = () => {
    setShowCustomFilters(!showCustomFilters);
  };

  const downloadCSV = () => {
    if (filteredTransactions.length === 0) return;

    // CSV header
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Type', 'Bank'];

    // CSV rows
    const rows = filteredTransactions.map(t => [
      t.date,
      t.category,
      `"${(t.description || '').replace(/"/g, '""')}"`, // Escape quotes in description
      t.amount.toFixed(2),
      t.type,
      t.bank || '',
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Generate filename with period info
    let periodLabel = 'all-time';
    if (selectedPeriod === 'current') {
      const now = new Date();
      periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    } else if (selectedPeriod === 'last-month') {
      const now = new Date();
      let month = now.getMonth();
      let year = now.getFullYear();
      if (month === 0) {
        month = 12;
        year -= 1;
      }
      periodLabel = `${year}-${String(month).padStart(2, '0')}`;
    }

    const filename = `transactions-${periodLabel}.csv`;

    // Create blob with BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });

    // Use modern download approach
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Cleanup after a short delay
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }, 100);
  };

  if (loading) {
    return (
      <PageContainer>
        <Flex w="100%" minH="60vh" align="center" justify="center">
          <VStack gap={4}>
            <Spinner size="xl" />
            <Text>Loading transactions...</Text>
          </VStack>
        </Flex>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <VStack gap={4} align="stretch" w="100%">
          {/* Header */}
          <Flex justify="space-between" align="center" w="100%" flexWrap="wrap" gap={2}>
            <HStack gap={4} flexWrap="wrap">
              <Heading size={{ base: 'lg', md: 'xl' }} color={colors.textPrimary}>Transactions</Heading>

              {/* Active/Trash Toggle */}
              <HStack gap={1}>
                <Button
                  size={{ base: 'xs', md: 'sm' }}
                  variant={viewMode === 'active' ? 'solid' : 'outline'}
                  colorScheme="blue"
                  onClick={() => setViewMode('active')}
                >
                  Active ({transactions.length})
                </Button>
                <Button
                  size={{ base: 'xs', md: 'sm' }}
                  variant={viewMode === 'trash' ? 'solid' : 'outline'}
                  colorScheme={viewMode === 'trash' ? 'red' : 'gray'}
                  onClick={() => setViewMode('trash')}
                >
                  Trash ({trashedTransactions.length})
                </Button>
              </HStack>
            </HStack>

            {/* Action buttons - change based on view mode */}
            <Flex gap={2} flexWrap="wrap" justify={{ base: 'flex-start', md: 'flex-end' }}>
              {viewMode === 'active' ? (
                <>
                  <Button
                    onClick={() => setShowDeleteAllDialog(true)}
                    variant="outline"
                    colorScheme="red"
                    size={{ base: 'xs', md: 'md' }}
                    disabled={transactions.length === 0}
                  >
                    Remove All
                  </Button>
                  <Button
                    onClick={downloadCSV}
                    variant="outline"
                    size={{ base: 'xs', md: 'md' }}
                    disabled={filteredTransactions.length === 0}
                    _hover={{ bg: colors.rowStripedBg }}
                  >
                    Download CSV
                  </Button>
                  <Button
                    as={RouterLink}
                    to="/add-transaction"
                    colorScheme="green"
                    size={{ base: 'xs', md: 'md' }}
                  >
                    + Add Transaction
                  </Button>
                </>
              ) : (
                <HStack gap={2}>
                  <Button
                    onClick={() => setShowRestoreAllDialog(true)}
                    colorScheme="green"
                    variant="outline"
                    size={{ base: 'xs', md: 'md' }}
                    disabled={trashedTransactions.length === 0}
                  >
                    Restore All
                  </Button>
                  <Button
                    onClick={() => setShowEmptyTrashDialog(true)}
                    colorScheme="red"
                    size={{ base: 'xs', md: 'md' }}
                    disabled={trashedTransactions.length === 0}
                  >
                    Empty Trash
                  </Button>
                </HStack>
              )}
            </Flex>
          </Flex>

          {/* Error Message */}
          {error && (
            <Box p={3} bg={colors.dangerBg} borderRadius="md" borderColor={colors.dangerBorder} borderWidth="1px" w="100%">
              <Text color={colors.danger} fontSize="sm">{error}</Text>
            </Box>
          )}

          {/* Active View - Filters and Transaction List */}
          {viewMode === 'active' && (
            <>
              {/* Filters Row */}
              <Flex gap={{ base: 2, md: 4 }} align="center" flexWrap="wrap" w="100%">
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size={{ base: 'sm', md: 'md' }}
                  bg={colors.cardBg}
                  borderColor={colors.borderColor}
                  color={colors.textPrimary}
                  maxW={{ base: '100%', md: '400px' }}
                  flex="1"
                  minW={{ base: '100%', sm: '200px' }}
                />
                {!customFiltersApplied && (
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      borderRadius: '6px',
                      border: `1px solid ${colors.borderColor}`,
                      backgroundColor: colors.cardBg,
                      color: colors.textPrimary,
                      minWidth: '130px',
                    }}
                  >
                    <option value="current">This month</option>
                    <option value="last-month">Last month</option>
                    <option value="all">All time</option>
                  </select>
                )}
                <Button
                  variant={showCustomFilters || customFiltersApplied ? 'solid' : 'outline'}
                  colorScheme={customFiltersApplied ? 'blue' : 'gray'}
                  size={{ base: 'sm', md: 'md' }}
                  onClick={toggleCustomFilters}
                >
                  <Icon as={LuFilter} mr={2} />
                  {customFiltersApplied ? 'Custom filters' : 'Filters'}
                </Button>
                {customFiltersApplied && (
                  <Button
                    variant="ghost"
                    size={{ base: 'sm', md: 'md' }}
                    onClick={clearCustomFilters}
                    color="red.500"
                  >
                    <Icon as={LuX} mr={1} />
                    Reset
                  </Button>
                )}
                <Text fontSize="sm" color={colors.textMuted}>
                  {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
                </Text>
              </Flex>

          {/* Custom Filters Panel */}
          <Collapsible.Root open={showCustomFilters}>
            <Collapsible.Content>
              <Box
                bg={colors.cardBg}
                borderRadius="xl"
                borderWidth="1px"
                borderColor={colors.borderColor}
                p={{ base: 4, md: 6 }}
                w="100%"
              >
                <VStack gap={5} align="stretch">
                  {/* Date Range */}
                  <Box>
                    <Text fontWeight="600" color={colors.textPrimary} mb={3}>Date range</Text>
                    <Flex gap={4} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
                      <Box flex="1" minW={{ base: '100%', md: '200px' }}>
                        <Text fontSize="sm" color={colors.textSecondary} mb={1}>Start date</Text>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          bg={colors.cardBg}
                          borderColor={colors.borderColor}
                          color={colors.textPrimary}
                          size="md"
                        />
                      </Box>
                      <Box flex="1" minW={{ base: '100%', md: '200px' }}>
                        <Text fontSize="sm" color={colors.textSecondary} mb={1}>End date</Text>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          bg={colors.cardBg}
                          borderColor={colors.borderColor}
                          color={colors.textPrimary}
                          size="md"
                        />
                      </Box>
                    </Flex>
                  </Box>

                  {/* Amount Range */}
                  <Box>
                    <Text fontWeight="600" color={colors.textPrimary} mb={3}>Amount range</Text>
                    <Flex gap={4} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
                      <Box flex="1" minW={{ base: '100%', md: '200px' }}>
                        <Text fontSize="sm" color={colors.textSecondary} mb={1}>Minimum amount</Text>
                        <Input
                          type="number"
                          placeholder="$0.00"
                          value={minAmount}
                          onChange={(e) => setMinAmount(e.target.value)}
                          bg={colors.cardBg}
                          borderColor={colors.borderColor}
                          color={colors.textPrimary}
                          size="md"
                          min="0"
                          step="0.01"
                        />
                      </Box>
                      <Box flex="1" minW={{ base: '100%', md: '200px' }}>
                        <Text fontSize="sm" color={colors.textSecondary} mb={1}>Maximum amount</Text>
                        <Input
                          type="number"
                          placeholder="$999,999.00"
                          value={maxAmount}
                          onChange={(e) => setMaxAmount(e.target.value)}
                          bg={colors.cardBg}
                          borderColor={colors.borderColor}
                          color={colors.textPrimary}
                          size="md"
                          min="0"
                          step="0.01"
                        />
                      </Box>
                    </Flex>
                  </Box>

                  {/* Action Buttons */}
                  <Flex gap={3} justify="flex-end" pt={2}>
                    <Button
                      variant="outline"
                      onClick={clearCustomFilters}
                    >
                      Clear filters
                    </Button>
                    <Button
                      colorScheme="red"
                      onClick={applyCustomFilters}
                    >
                      Apply filters
                    </Button>
                  </Flex>
                </VStack>
              </Box>
            </Collapsible.Content>
          </Collapsible.Root>

          {/* Mobile Card View */}
          <VStack display={{ base: 'flex', md: 'none' }} gap={3} align="stretch" w="100%">
            {filteredTransactions.length === 0 ? (
              <Box p={6} bg={colors.cardBg} borderRadius="lg" borderWidth="1px" borderColor={colors.borderColor} textAlign="center">
                <Text color={colors.textMuted}>No transactions found</Text>
              </Box>
            ) : (
              filteredTransactions.map((transaction) => (
                <Box
                  key={transaction.id}
                  p={4}
                  bg={colors.cardBg}
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor={colors.borderColor}
                >
                  <Flex justify="space-between" align="flex-start" mb={2}>
                    <Box flex="1">
                      {editingTransactionId === transaction.id ? (
                        <HStack gap={2} mb={1}>
                          <select
                            value={transaction.category_id || ''}
                            onChange={(e) => updateTransactionCategory(transaction.id, e.target.value, transaction.type)}
                            disabled={updatingCategory}
                            style={{
                              padding: '4px 8px',
                              fontSize: '13px',
                              borderRadius: '6px',
                              border: `1px solid ${colors.borderColor}`,
                              backgroundColor: colors.inputBg,
                              color: colors.textPrimary,
                              cursor: updatingCategory ? 'wait' : 'pointer',
                              flex: 1,
                              maxWidth: '160px',
                            }}
                            autoFocus
                          >
                            {categories.filter(c => c.type === transaction.type).map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                          <Button size="xs" variant="ghost" onClick={() => setEditingTransactionId(null)}>✕</Button>
                        </HStack>
                      ) : (
                        <Text
                          fontWeight="semibold"
                          fontSize="sm"
                          color="blue.500"
                          cursor="pointer"
                          onClick={() => setEditingTransactionId(transaction.id)}
                        >
                          {transaction.category}
                        </Text>
                      )}
                      <Text fontSize="xs" color={colors.textSecondary} noOfLines={2}>
                        {transaction.description}
                      </Text>
                    </Box>
                    <Text
                      fontWeight="bold"
                      fontSize="md"
                      color={transaction.type === 'income' ? 'green.600' : 'red.600'}
                      ml={2}
                    >
                      {formatAmount(transaction.amount, transaction.type)}
                    </Text>
                  </Flex>
                  <Flex justify="space-between" align="center">
                    <Text fontSize="xs" color={colors.textMuted}>{formatDate(transaction.date)}</Text>
                    <HStack gap={2}>
                      <Text fontSize="xs" color={transaction.balance < 0 ? 'red.500' : colors.textMuted}>
                        Bal: {formatBalance(transaction.balance)}
                      </Text>
                      <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => handleDeleteTransaction(transaction.id)}
                        opacity={0.6}
                        _hover={{ opacity: 1 }}
                      >
                        ×
                      </Button>
                    </HStack>
                  </Flex>
                </Box>
              ))
            )}
          </VStack>

          {/* Desktop Table View */}
          <Box
            display={{ base: 'none', md: 'block' }}
            borderWidth="1px"
            borderColor={colors.borderColor}
            borderRadius="lg"
            overflow="hidden"
            bg={colors.cardBg}
            w="100%"
          >
            <Table.Root size="md" w="100%" style={{ tableLayout: 'fixed' }}>
              <Table.Header>
                <Table.Row bg={colors.rowStripedBg}>
                  <Table.ColumnHeader py={4} px={6} w="12%" color={colors.textSecondary}>Date</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={6} w="auto" color={colors.textSecondary}>Description</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={6} textAlign="right" w="12%" color={colors.textSecondary}>Amount</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={6} textAlign="right" w="12%" color={colors.textSecondary}>Balance</Table.ColumnHeader>
                  <Table.ColumnHeader py={4} px={3} w="5%"></Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredTransactions.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={5} textAlign="center" py={12}>
                      <Text color={colors.textMuted}>No transactions found</Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <Table.Row key={transaction.id} bg={colors.cardBg} _hover={{ bg: colors.rowHoverBg }}>
                      <Table.Cell py={4} px={6}>
                        <Text color={colors.textSecondary}>{formatDate(transaction.date)}</Text>
                      </Table.Cell>
                      <Table.Cell py={4} px={6}>
                        {editingTransactionId === transaction.id ? (
                          <HStack gap={2}>
                            <select
                              value={transaction.category_id || ''}
                              onChange={(e) => updateTransactionCategory(transaction.id, e.target.value, transaction.type)}
                              disabled={updatingCategory}
                              style={{
                                padding: '4px 8px',
                                fontSize: '14px',
                                borderRadius: '6px',
                                border: `1px solid ${colors.borderColor}`,
                                backgroundColor: colors.inputBg,
                                color: colors.textPrimary,
                                cursor: updatingCategory ? 'wait' : 'pointer',
                                minWidth: '140px',
                              }}
                              autoFocus
                            >
                              {categories.filter(c => c.type === transaction.type).map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                            <Button size="xs" variant="ghost" onClick={() => setEditingTransactionId(null)}>✕</Button>
                          </HStack>
                        ) : (
                          <Text
                            fontWeight="medium"
                            color="blue.500"
                            cursor="pointer"
                            _hover={{ textDecoration: 'underline' }}
                            onClick={() => setEditingTransactionId(transaction.id)}
                            title="Click to change category"
                          >
                            {transaction.category}
                          </Text>
                        )}
                        <Text fontSize="sm" color={colors.textSecondary} noOfLines={1}>
                          {transaction.description}
                          {transaction.bank && transaction.bank !== transaction.description && (
                            <Text as="span" color="blue.500" ml={2}>• {transaction.bank}</Text>
                          )}
                        </Text>
                      </Table.Cell>
                      <Table.Cell textAlign="right" py={4} px={6}>
                        <Text
                          fontWeight="bold"
                          color={transaction.type === 'income' ? 'green.600' : 'red.600'}
                        >
                          {formatAmount(transaction.amount, transaction.type)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell textAlign="right" py={4} px={6}>
                        <Text color={transaction.balance < 0 ? 'red.600' : colors.textSecondary}>
                          {formatBalance(transaction.balance)}
                        </Text>
                      </Table.Cell>
                      <Table.Cell py={4} px={3}>
                        <Button
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          opacity={0.4}
                          _hover={{ opacity: 1 }}
                        >
                          ×
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>
          </Box>

              {/* Summary Footer - shows total expenses only */}
              {filteredTransactions.length > 0 && (
                <Flex justify="flex-end" px={4} w="100%">
                  <HStack gap={2}>
                    <Text color={colors.textSecondary}>Period total:</Text>
                    <Text
                      fontWeight="bold"
                      fontSize="lg"
                      color="red.600"
                    >
                      -${filteredTransactions
                        .filter(t => t.type === 'expense')
                        .reduce((sum, t) => sum + t.amount, 0)
                        .toFixed(2)}
                    </Text>
                  </HStack>
                </Flex>
              )}
            </>
          )}

          {/* Trash View */}
          {viewMode === 'trash' && (
            <>
              {loadingTrash ? (
                <Flex w="100%" minH="200px" align="center" justify="center">
                  <VStack gap={4}>
                    <Spinner size="xl" />
                    <Text color={colors.textSecondary}>Loading trash...</Text>
                  </VStack>
                </Flex>
              ) : (
                <>
                  {/* Trash info banner */}
                  <Box p={4} bg={colors.warningBg} borderRadius="md" borderWidth="1px" borderColor={colors.warningBorder}>
                    <Text color={colors.warning} fontSize="sm">
                      Items in trash can be restored or permanently deleted. Restore items you want to keep.
                    </Text>
                  </Box>

                  {/* Mobile Trash Cards */}
                  <VStack display={{ base: 'flex', md: 'none' }} gap={3} align="stretch" w="100%">
                    {trashedTransactions.length === 0 ? (
                      <Box p={6} bg={colors.cardBg} borderRadius="lg" borderWidth="1px" borderColor={colors.borderColor} textAlign="center">
                        <Text color={colors.textMuted}>Trash is empty</Text>
                      </Box>
                    ) : (
                      trashedTransactions.map((transaction) => (
                        <Box
                          key={transaction.id}
                          p={4}
                          bg={colors.cardBg}
                          borderRadius="lg"
                          borderWidth="1px"
                          borderColor={colors.borderColor}
                          opacity={0.85}
                        >
                          <Flex justify="space-between" align="flex-start" mb={2}>
                            <Box flex="1">
                              <Text fontWeight="semibold" fontSize="sm" color={colors.textPrimary}>{transaction.category}</Text>
                              <Text fontSize="xs" color={colors.textSecondary} noOfLines={2}>
                                {transaction.description}
                              </Text>
                            </Box>
                            <Text
                              fontWeight="bold"
                              fontSize="md"
                              color={transaction.type === 'income' ? 'green.600' : 'red.600'}
                              ml={2}
                            >
                              {formatAmount(transaction.amount, transaction.type)}
                            </Text>
                          </Flex>
                          <Flex justify="space-between" align="center">
                            <Text fontSize="xs" color={colors.textMuted}>{formatDate(transaction.date)}</Text>
                            <HStack gap={1}>
                              <Button
                                size="xs"
                                variant="ghost"
                                colorScheme="green"
                                onClick={() => handleRestoreTransaction(transaction.id)}
                                loading={restoringId === transaction.id}
                              >
                                Restore
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                colorScheme="red"
                                onClick={() => handlePermanentDelete(transaction.id)}
                              >
                                Delete
                              </Button>
                            </HStack>
                          </Flex>
                        </Box>
                      ))
                    )}
                  </VStack>

                  {/* Desktop Trash Table */}
                  <Box
                    display={{ base: 'none', md: 'block' }}
                    borderWidth="1px"
                    borderColor={colors.borderColor}
                    borderRadius="lg"
                    overflow="hidden"
                    bg={colors.cardBg}
                    w="100%"
                  >
                    <Table.Root size="md" w="100%" style={{ tableLayout: 'fixed' }}>
                      <Table.Header>
                        <Table.Row bg={colors.rowStripedBg}>
                          <Table.ColumnHeader py={4} px={6} w="12%" color={colors.textSecondary}>Date</Table.ColumnHeader>
                          <Table.ColumnHeader py={4} px={6} w="auto" color={colors.textSecondary}>Description</Table.ColumnHeader>
                          <Table.ColumnHeader py={4} px={6} textAlign="right" w="12%" color={colors.textSecondary}>Amount</Table.ColumnHeader>
                          <Table.ColumnHeader py={4} px={6} w="18%" textAlign="center" color={colors.textSecondary}>Actions</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {trashedTransactions.length === 0 ? (
                          <Table.Row>
                            <Table.Cell colSpan={4} textAlign="center" py={12}>
                              <Text color={colors.textMuted}>Trash is empty</Text>
                            </Table.Cell>
                          </Table.Row>
                        ) : (
                          trashedTransactions.map((transaction) => (
                            <Table.Row key={transaction.id} bg={colors.cardBg} _hover={{ bg: colors.rowHoverBg }} opacity={0.85}>
                              <Table.Cell py={4} px={6}>
                                <Text color={colors.textSecondary}>{formatDate(transaction.date)}</Text>
                              </Table.Cell>
                              <Table.Cell py={4} px={6}>
                                <Text fontWeight="medium" color={colors.textPrimary}>{transaction.category}</Text>
                                <Text fontSize="sm" color={colors.textSecondary} noOfLines={1}>
                                  {transaction.description}
                                  {transaction.bank && transaction.bank !== transaction.description && (
                                    <Text as="span" color="blue.500" ml={2}>• {transaction.bank}</Text>
                                  )}
                                </Text>
                              </Table.Cell>
                              <Table.Cell textAlign="right" py={4} px={6}>
                                <Text
                                  fontWeight="bold"
                                  color={transaction.type === 'income' ? 'green.600' : 'red.600'}
                                >
                                  {formatAmount(transaction.amount, transaction.type)}
                                </Text>
                              </Table.Cell>
                              <Table.Cell py={4} px={6}>
                                <HStack gap={2} justify="center">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    colorScheme="green"
                                    onClick={() => handleRestoreTransaction(transaction.id)}
                                    loading={restoringId === transaction.id}
                                  >
                                    Restore
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    colorScheme="red"
                                    onClick={() => handlePermanentDelete(transaction.id)}
                                  >
                                    Delete
                                  </Button>
                                </HStack>
                              </Table.Cell>
                            </Table.Row>
                          ))
                        )}
                      </Table.Body>
                    </Table.Root>
                  </Box>
                </>
              )}
            </>
          )}
      </VStack>

      {/* Delete All Confirmation Dialog */}
      <Dialog.Root open={showDeleteAllDialog} onOpenChange={(e) => !e.open && setShowDeleteAllDialog(false)}>
        <Portal>
          <Dialog.Backdrop bg="blackAlpha.600" />
          <Dialog.Positioner>
            <Dialog.Content
              maxW="400px"
              w="90%"
              borderRadius="16px"
              overflow="hidden"
              bg={colors.cardBg}
            >
              <Dialog.Header
                bg="linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)"
                color="white"
                p={5}
              >
                <Flex justify="space-between" align="center">
                  <Dialog.Title fontSize="lg" fontWeight="700" color="white">
                    Remove All Transactions
                  </Dialog.Title>
                  <Dialog.CloseTrigger asChild>
                    <CloseButton
                      color="white"
                      _hover={{ bg: 'whiteAlpha.200' }}
                      borderRadius="full"
                    />
                  </Dialog.CloseTrigger>
                </Flex>
              </Dialog.Header>

              <Dialog.Body p={6}>
                <VStack gap={4} align="stretch">
                  <Text color={colors.textPrimary} fontSize="md">
                    Are you sure you want to move <strong>all {transactions.length} transactions</strong> to trash?
                  </Text>
                  <Text color={colors.textSecondary} fontSize="sm">
                    Transactions will be moved to trash where you can restore them or delete them permanently.
                  </Text>
                </VStack>
              </Dialog.Body>

              <Dialog.Footer p={4} borderTopWidth="1px" borderColor={colors.borderColor}>
                <HStack gap={3} justify="flex-end" w="100%">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteAllDialog(false)}
                    disabled={deletingAll}
                  >
                    Cancel
                  </Button>
                  <Button
                    colorScheme="red"
                    onClick={handleDeleteAllTransactions}
                    loading={deletingAll}
                    loadingText="Moving..."
                  >
                    Move to Trash
                  </Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Empty Trash Confirmation Dialog */}
      <Dialog.Root open={showEmptyTrashDialog} onOpenChange={(e) => !e.open && setShowEmptyTrashDialog(false)}>
        <Portal>
          <Dialog.Backdrop bg="blackAlpha.600" />
          <Dialog.Positioner>
            <Dialog.Content
              maxW="400px"
              w="90%"
              borderRadius="16px"
              overflow="hidden"
              bg={colors.cardBg}
            >
              <Dialog.Header
                bg="linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)"
                color="white"
                p={5}
              >
                <Flex justify="space-between" align="center">
                  <Dialog.Title fontSize="lg" fontWeight="700" color="white">
                    Empty Trash
                  </Dialog.Title>
                  <Dialog.CloseTrigger asChild>
                    <CloseButton
                      color="white"
                      _hover={{ bg: 'whiteAlpha.200' }}
                      borderRadius="full"
                    />
                  </Dialog.CloseTrigger>
                </Flex>
              </Dialog.Header>

              <Dialog.Body p={6}>
                <VStack gap={4} align="stretch">
                  <Text color={colors.textPrimary} fontSize="md">
                    Are you sure you want to permanently delete <strong>all {trashedTransactions.length} items</strong> in trash?
                  </Text>
                  <Text color={colors.textSecondary} fontSize="sm">
                    This action cannot be undone. All items will be permanently removed.
                  </Text>
                </VStack>
              </Dialog.Body>

              <Dialog.Footer p={4} borderTopWidth="1px" borderColor={colors.borderColor}>
                <HStack gap={3} justify="flex-end" w="100%">
                  <Button
                    variant="outline"
                    onClick={() => setShowEmptyTrashDialog(false)}
                    disabled={emptyingTrash}
                  >
                    Cancel
                  </Button>
                  <Button
                    colorScheme="red"
                    onClick={handleEmptyTrash}
                    loading={emptyingTrash}
                    loadingText="Deleting..."
                  >
                    Empty Trash
                  </Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Restore All Confirmation Dialog */}
      <Dialog.Root open={showRestoreAllDialog} onOpenChange={(e) => !e.open && setShowRestoreAllDialog(false)}>
        <Portal>
          <Dialog.Backdrop bg="blackAlpha.600" />
          <Dialog.Positioner>
            <Dialog.Content
              maxW="400px"
              w="90%"
              borderRadius="16px"
              overflow="hidden"
              bg={colors.cardBg}
            >
              <Dialog.Header
                bg="linear-gradient(135deg, #16A34A 0%, #15803D 100%)"
                color="white"
                p={5}
              >
                <Flex justify="space-between" align="center">
                  <Dialog.Title fontSize="lg" fontWeight="700" color="white">
                    Restore All Transactions
                  </Dialog.Title>
                  <Dialog.CloseTrigger asChild>
                    <CloseButton
                      color="white"
                      _hover={{ bg: 'whiteAlpha.200' }}
                      borderRadius="full"
                    />
                  </Dialog.CloseTrigger>
                </Flex>
              </Dialog.Header>

              <Dialog.Body p={6}>
                <VStack gap={4} align="stretch">
                  <Text color={colors.textPrimary} fontSize="md">
                    Are you sure you want to restore <strong>all {trashedTransactions.length} transactions</strong> from trash?
                  </Text>
                  <Text color={colors.textSecondary} fontSize="sm">
                    All transactions will be moved back to your active transactions list.
                  </Text>
                </VStack>
              </Dialog.Body>

              <Dialog.Footer p={4} borderTopWidth="1px" borderColor={colors.borderColor}>
                <HStack gap={3} justify="flex-end" w="100%">
                  <Button
                    variant="outline"
                    onClick={() => setShowRestoreAllDialog(false)}
                    disabled={restoringAll}
                  >
                    Cancel
                  </Button>
                  <Button
                    colorScheme="green"
                    onClick={handleRestoreAll}
                    loading={restoringAll}
                    loadingText="Restoring..."
                  >
                    Restore All
                  </Button>
                </HStack>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </PageContainer>
  );
}
