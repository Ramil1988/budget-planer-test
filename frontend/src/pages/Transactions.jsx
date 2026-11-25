import { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Heading, Spinner } from '@chakra-ui/react';
import { LuFilter } from 'react-icons/lu';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { groupByDay, periodLabel, summary, timeline } from '../lib/transactionView';
import SpendChart from '../components/transactions/SpendChart';
import TransactionList from '../components/transactions/TransactionList';
import TrashList from '../components/transactions/TrashList';
import FilterPanel from '../components/transactions/FilterPanel';
import ConfirmDialog from '../components/transactions/ConfirmDialog';
import '../styles/ledger.css';
import '../styles/transactions.css';

function csvTextCell(value) {
  const text = String(value ?? '');
  const formulaLike = /^(?:[\t\r\n]|\s*[=+\-@＝＋－＠])/u.test(text);
  const safeText = formulaLike ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatMoney = (amount) => money.format(amount);
// An expense reads "−$18.07", income "+$1,918.07".
const formatAmount = (amount, type) => `${type === 'expense' ? '−' : '+'}${money.format(Math.abs(amount))}`;

const formatDate = (dateString) => {
  // Parse YYYY-MM-DD without timezone conversion issues
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// The first and the last day of a month, `offset` months from this one.
const monthRange = (offset) => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return [iso(first), iso(last)];
};

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  // Custom filter states
  const [showCustomFilters, setShowCustomFilters] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [filterBank, setFilterBank] = useState('');
  const [filterType, setFilterType] = useState(''); // '' | 'income' | 'expense'
  const [customFiltersApplied, setCustomFiltersApplied] = useState(false);

  // The day (or month) picked on the chart: the list shows only it.
  const [pickedBucket, setPickedBucket] = useState(null);

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

  // Category change confirmation dialog state
  const [pendingCategoryChange, setPendingCategoryChange] = useState(null);

  // Amount editing state
  const [editingAmountId, setEditingAmountId] = useState(null);
  const [editingAmountValue, setEditingAmountValue] = useState('');

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

  const handleCategorySelect = (transaction, newCategoryId) => {
    if (newCategoryId === transaction.category_id) return;
    const newCategory = categories.find(c => c.id === newCategoryId);
    setPendingCategoryChange({
      transactionId: transaction.id,
      transactionDescription: transaction.description,
      transactionType: transaction.type,
      newCategoryId,
      newCategoryName: newCategory?.name || 'Unknown',
    });
  };

  const updateTransactionCategory = async (alsoUpdateMapping) => {
    if (!pendingCategoryChange) return;
    const { transactionId, transactionDescription, newCategoryId, newCategoryName } = pendingCategoryChange;
    setUpdatingCategory(true);
    setPendingCategoryChange(null);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: newCategoryId })
        .eq('id', transactionId)
        .eq('user_id', user.id);

      if (error) throw error;

      if (alsoUpdateMapping && transactionDescription) {
        // Normalize: take the main part of the description (before details like card numbers)
        const descNormalized = transactionDescription.trim();
        // Upsert merchant mapping
        await supabase
          .from('merchant_mappings')
          .upsert({
            user_id: user.id,
            transaction_description: descNormalized,
            category_name: newCategoryName,
          }, { onConflict: 'user_id,transaction_description' });
      }

      // Update local state
      setTransactions(prev => prev.map(t =>
        t.id === transactionId ? { ...t, category: newCategoryName, category_id: newCategoryId } : t
      ));
      setEditingTransactionId(null);
    } catch (err) {
      console.error('Error updating category:', err);
      setError('Failed to update category');
    } finally {
      setUpdatingCategory(false);
    }
  };

  const updateTransactionAmount = async (transactionId, newAmount) => {
    const parsed = parseFloat(newAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setEditingAmountId(null);
      return;
    }
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ amount: parsed })
        .eq('id', transactionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setTransactions(prev => prev.map(t =>
        t.id === transactionId ? { ...t, amount: parsed } : t
      ));
      setEditingAmountId(null);
    } catch (err) {
      console.error('Error updating amount:', err);
      setError('Failed to update amount');
      setEditingAmountId(null);
    }
  };

  useEffect(() => {
    filterTransactions();
  }, [transactions, searchQuery, selectedPeriod, customFiltersApplied, startDate, endDate, minAmount, maxAmount, filterDescription, filterBank, filterType]);

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

    // Check if any custom filter field has a value
    // Income/expense lives on the main toolbar, not in the custom-filter panel,
    // so it applies on top of whatever period is selected instead of switching
    // the view into custom-filter mode.
    if (filterType) {
      filtered = filtered.filter(t => t.type === filterType);
    }

    const hasCustomFilterValues = filterDescription.trim() || startDate || endDate || minAmount !== '' || maxAmount !== '' || filterBank !== '';

    // Apply custom filters if explicitly applied OR if any filter field has a value
    if (customFiltersApplied || hasCustomFilterValues) {
      // Description filter (searches description and category)
      if (filterDescription.trim()) {
        const descQuery = filterDescription.toLowerCase();
        filtered = filtered.filter(t =>
          t.description.toLowerCase().includes(descQuery) ||
          t.category.toLowerCase().includes(descQuery)
        );
      }
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
      // Bank filter
      if (filterBank) {
        filtered = filtered.filter(t => t.bank === filterBank);
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
    setFilterDescription('');
    setFilterBank('');
    setCustomFiltersApplied(false);
    setSelectedPeriod('current');
    setShowCustomFilters(false);
  };

  const toggleCustomFilters = () => {
    setShowCustomFilters(!showCustomFilters);
  };

  // Auto-fill date range based on selected period
  const updateDateRangeForPeriod = (period) => {
    if (period === 'current') {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-indexed
      const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(firstDay);
      setEndDate(endDay);
    } else if (period === 'last-month') {
      const now = new Date();
      let month = now.getMonth() - 1; // 0-indexed
      let year = now.getFullYear();
      if (month < 0) { month = 11; year -= 1; }
      const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(firstDay);
      setEndDate(endDay);
    } else {
      // All time - clear dates
      setStartDate('');
      setEndDate('');
    }
  };

  const downloadCSV = () => {
    if (filteredTransactions.length === 0) return;

    // CSV header
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Type', 'Bank'];

    // Quote every text field and keep amounts as numbers in spreadsheets.
    const rows = filteredTransactions.map(t => [
      csvTextCell(t.date),
      csvTextCell(t.category),
      csvTextCell(t.description),
      t.amount.toFixed(2),
      csvTextCell(t.type),
      csvTextCell(t.bank),
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\r\n');

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
      <Box className="bw-surface bw-page">
        <Box className="bw-layout">
          <div className="bw-status" role="status">
            <Spinner size="sm" color="currentColor" />
            Loading transactions…
          </div>
        </Box>
      </Box>
    );
  }

  const active = viewMode === 'active';
  // The dates the list is cut to: the range typed in, or the month the period names.
  const [rangeStart, rangeEnd] = startDate || endDate
    ? [startDate, endDate]
    : selectedPeriod === 'current' ? monthRange(0) : selectedPeriod === 'last-month' ? monthRange(-1) : ['', ''];
  const totals = summary(filteredTransactions);
  const line = timeline(filteredTransactions, { start: rangeStart, end: rangeEnd });
  const chosen = line?.buckets.find(({ key }) => key === pickedBucket) || null;
  const listed = chosen
    ? filteredTransactions.filter(({ date }) => date >= chosen.from && date <= chosen.to)
    : filteredTransactions;
  const groups = groupByDay(listed);
  const banks = [...new Set(transactions.filter((t) => t.bank).map((t) => t.bank))].sort();

  const period = periodLabel(rangeStart, rangeEnd);
  const count = (number, word) => `${number.toLocaleString('en-US')} ${word}${number === 1 ? '' : 's'}`;
  const scope = [
    `${count(totals.count, filterType === 'income' ? 'income transaction' : filterType === 'expense' ? 'expense' : 'transaction')}`,
    /^(all|since|until)/.test(period) ? `, ${period}` : ` in ${period}`,
    searchQuery.trim() ? `, matching “${searchQuery.trim()}”` : '',
  ].join('');

  const tab = (mode, label, number) => (
    <button type="button" role="tab" className="bw-tab" aria-selected={viewMode === mode} onClick={() => setViewMode(mode)}>
      {label} ({number.toLocaleString('en-US')})
    </button>
  );

  return (
    <Box className="bw-surface bw-page">
      <Box className="bw-layout">
        <header className="bw-masthead">
          <div>
            <Heading as="h1" className="bw-title">Transactions</Heading>
            <p className="bw-subtitle">
              {active ? scope : `${count(trashedTransactions.length, 'transaction')} in the trash`}
            </p>
          </div>

          <div className="tx-actions">
            {active ? (
              <>
                <button type="button" className="bw-button bw-button--quiet" onClick={downloadCSV} disabled={filteredTransactions.length === 0}>
                  Download CSV
                </button>
                <RouterLink className="bw-button tx-actions__add" to="/add-transaction">Add transaction</RouterLink>
              </>
            ) : (
              <>
                <button type="button" className="bw-button bw-button--quiet" onClick={() => setShowRestoreAllDialog(true)} disabled={trashedTransactions.length === 0}>
                  Restore all
                </button>
                <button
                  type="button"
                  className="bw-button bw-button--quiet"
                  data-tone="bad"
                  onClick={() => setShowEmptyTrashDialog(true)}
                  disabled={trashedTransactions.length === 0}
                >
                  Empty trash
                </button>
              </>
            )}
          </div>
        </header>

        <div className="bw-switches">
          <div className="bw-tabs" role="tablist" aria-label="Active or trashed">
            {tab('active', 'Active', transactions.length)}
            {tab('trash', 'Trash', trashedTransactions.length)}
          </div>
          {active && (
            <div className="bw-segment" role="group" aria-label="Type">
              {[['', 'All'], ['income', 'Income'], ['expense', 'Expenses']].map(([value, label]) => (
                <button type="button" aria-pressed={filterType === value} onClick={() => setFilterType(value)} key={label}>{label}</button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="bw-note" data-tone="bad" role="alert">{error}</p>}

        {active && (
          <>
            <div className="tx-toolbar">
              <input
                className="bw-input tx-toolbar__search"
                type="search"
                aria-label="Search transactions"
                placeholder="Search transactions"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <select
                className="bw-select"
                aria-label="Period"
                value={selectedPeriod}
                onChange={(event) => {
                  setSelectedPeriod(event.target.value);
                  updateDateRangeForPeriod(event.target.value);
                }}
              >
                <option value="current">This month</option>
                <option value="last-month">Last month</option>
                <option value="all">All time</option>
                {selectedPeriod === 'custom' && <option value="custom">Custom range</option>}
              </select>
              <button
                type="button"
                className="bw-button bw-button--quiet tx-toolbar__filters"
                aria-expanded={showCustomFilters}
                aria-controls="tx-filter-panel"
                aria-pressed={customFiltersApplied}
                onClick={toggleCustomFilters}
              >
                <LuFilter size={15} aria-hidden="true" />
                {customFiltersApplied ? 'Custom filters' : 'Filters'}
              </button>
              {customFiltersApplied && (
                <button type="button" className="bw-link tx-toolbar__reset" onClick={clearCustomFilters}>Reset</button>
              )}
            </div>

            {showCustomFilters && (
              <FilterPanel
                values={{ startDate, endDate, description: filterDescription, bank: filterBank, minAmount, maxAmount }}
                set={{
                  startDate: setStartDate,
                  endDate: setEndDate,
                  description: setFilterDescription,
                  bank: setFilterBank,
                  minAmount: setMinAmount,
                  maxAmount: setMaxAmount,
                }}
                banks={banks}
                onApply={applyCustomFilters}
                onClear={clearCustomFilters}
              />
            )}

            <section className="bw-ledger tx-ledger" aria-label="What is in view">
              <dl className="bw-figures">
                <div className="bw-figure bw-figure--lead">
                  <dt>Net</dt>
                  <dd data-tone={totals.net < 0 ? 'bad' : 'good'}>
                    {totals.net > 0 ? '+' : totals.net < 0 ? '−' : ''}{formatMoney(Math.abs(totals.net))}
                  </dd>
                </div>
                <div className="bw-figure">
                  <dt>Income</dt>
                  <dd>{formatMoney(totals.income)}</dd>
                </div>
                <div className="bw-figure">
                  <dt>Expenses</dt>
                  <dd>{formatMoney(totals.expenses)}</dd>
                </div>
                <div className="bw-figure">
                  <dt>Largest expense</dt>
                  <dd>{totals.largest ? formatMoney(totals.largest.amount) : '—'}</dd>
                  {totals.largest && <small>{totals.largest.description || totals.largest.category}, {formatDate(totals.largest.date)}</small>}
                </div>
              </dl>
              {line && <SpendChart line={line} picked={chosen?.key ?? null} onPick={setPickedBucket} formatMoney={formatMoney} />}
            </section>

            {chosen && (
              <p className="bw-note tx-picked">
                Only {chosen.label}: {count(listed.length, 'transaction')}.{' '}
                <button type="button" className="bw-link" onClick={() => setPickedBucket(null)}>Show everything in view</button>
              </p>
            )}

            {groups.length === 0 ? (
              <div className="bw-panel">
                <p className="bw-nothing">
                  {transactions.length === 0 ? 'No transactions yet. Add one, or import a bank statement.' : 'Nothing matches. Try another period or fewer filters.'}
                </p>
              </div>
            ) : (
              <TransactionList
                groups={groups}
                category={{
                  editingId: editingTransactionId,
                  busy: updatingCategory,
                  options: categories,
                  onStart: setEditingTransactionId,
                  onCancel: () => setEditingTransactionId(null),
                  onSelect: handleCategorySelect,
                }}
                amount={{
                  editingId: editingAmountId,
                  value: editingAmountValue,
                  onStart: (transaction) => { setEditingAmountId(transaction.id); setEditingAmountValue(transaction.amount.toString()); },
                  onChange: setEditingAmountValue,
                  // Leaving the field without changing the amount saves nothing.
                  onCommit: (id, value) => {
                    const current = transactions.find((t) => t.id === id);
                    if (current && parseFloat(value) === current.amount) setEditingAmountId(null);
                    else updateTransactionAmount(id, value);
                  },
                  onCancel: () => setEditingAmountId(null),
                }}
                onTrash={handleDeleteTransaction}
                formatAmount={formatAmount}
                formatMoney={formatMoney}
              />
            )}

            {transactions.length > 0 && (
              <p className="tx-foot">
                <button type="button" onClick={() => setShowDeleteAllDialog(true)}>
                  Move all {count(transactions.length, 'transaction')} to the trash
                </button>
              </p>
            )}
          </>
        )}

        {!active && (
          loadingTrash ? (
            <div className="bw-status" role="status">
              <Spinner size="sm" color="currentColor" />
              Loading the trash…
            </div>
          ) : trashedTransactions.length === 0 ? (
            <div className="bw-panel"><p className="bw-nothing">The trash is empty.</p></div>
          ) : (
            <>
              <p className="bw-note">A trashed transaction counts nowhere. Restore it to bring it back, or delete it for good.</p>
              <TrashList
                transactions={trashedTransactions}
                restoringId={restoringId}
                onRestore={handleRestoreTransaction}
                onDelete={handlePermanentDelete}
                formatAmount={formatAmount}
                formatDate={formatDate}
              />
            </>
          )
        )}
      </Box>

      <ConfirmDialog
        open={showDeleteAllDialog}
        onClose={() => setShowDeleteAllDialog(false)}
        title="Move everything to the trash?"
        busy={deletingAll}
        actions={[{ label: 'Move to trash', busyLabel: 'Moving…', tone: 'bad', onClick: handleDeleteAllTransactions }]}
      >
        <p>
          All <b>{count(transactions.length, 'transaction')}</b> go to the trash, not only the ones in view. They can be restored from
          there, or deleted for good.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={showEmptyTrashDialog}
        onClose={() => setShowEmptyTrashDialog(false)}
        title="Empty the trash?"
        busy={emptyingTrash}
        actions={[{ label: 'Delete for good', busyLabel: 'Deleting…', tone: 'bad', onClick: handleEmptyTrash }]}
      >
        <p><b>{count(trashedTransactions.length, 'transaction')}</b> will be deleted for good. This cannot be undone.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={showRestoreAllDialog}
        onClose={() => setShowRestoreAllDialog(false)}
        title="Restore everything?"
        busy={restoringAll}
        actions={[{ label: 'Restore all', busyLabel: 'Restoring…', onClick: handleRestoreAll }]}
      >
        <p><b>{count(trashedTransactions.length, 'transaction')}</b> go back to the active list and count again.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(pendingCategoryChange)}
        onClose={() => setPendingCategoryChange(null)}
        title={`Change the category to ${pendingCategoryChange?.newCategoryName || ''}?`}
        busy={updatingCategory}
        actions={[
          { label: 'Only this one', quiet: true, onClick: () => updateTransactionCategory(false) },
          { label: 'Always for this description', onClick: () => updateTransactionCategory(true) },
        ]}
      >
        <p>
          Change only this transaction, or also remember it, so that later imports of
          {' '}<b>{pendingCategoryChange?.transactionDescription || 'this description'}</b> get this category too.
        </p>
      </ConfirmDialog>
    </Box>
  );
}
