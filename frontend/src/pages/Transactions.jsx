import { useState, useEffect, useMemo } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, Heading, Spinner } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { isMissingImportSignatureColumn, signatureStamp } from '../lib/importSignature';
import { NO_FILTERS, applyFilters, groupByDay, periodLabel, periodRange, summary, timeline, transactionFiltersFromSearch } from '../lib/transactionView';
import { readActiveTransactions } from '../lib/transactionLedger';
import SpendChart from '../components/transactions/SpendChart';
import TransactionList from '../components/transactions/TransactionList';
import TrashList from '../components/transactions/TrashList';
import Filters from '../components/transactions/Filters';
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

export default function Transactions() {
  const { user } = useAuth();
  const location = useLocation();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Every filter of the list: see NO_FILTERS and applyFilters in lib/transactionView.
  const [filters, setFilters] = useState(() => transactionFiltersFromSearch(location.search));

  // The day (or month) picked on the chart: the list shows only it.
  const [pickedBucket, setPickedBucket] = useState(null);

  // Delete all dialog state
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Trash/Active view state
  const [viewMode, setViewMode] = useState('active'); // 'active' | 'trash'
  const [trashedTransactions, setTrashedTransactions] = useState([]);
  const [loadingTrash, setLoadingTrash] = useState(false);

  // A report can open while the ledger already has a search or a selected chart day.
  useEffect(() => {
    setFilters(transactionFiltersFromSearch(location.search));
    setPickedBucket(null);
    setViewMode('active');
  }, [location.search, location.key]);

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
      // Imports recognise a bank row by its stored signature. Stamp the row with the signature
      // of its current values before the amount changes, or the next sync would import the
      // original again. Skipped on a database without migration 010.
      const { data: current, error: readError } = await supabase
        .from('transactions')
        .select('date, description, amount, import_signature')
        .eq('id', transactionId)
        .eq('user_id', user.id)
        .single();
      if (readError && !isMissingImportSignatureColumn(readError)) throw readError;

      const { error } = await supabase
        .from('transactions')
        .update({ amount: parsed, ...(current ? signatureStamp(current) : {}) })
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
      const data = await readActiveTransactions(supabase, user.id);

      // Calculate cumulative spending (expenses only, not affected by income)
      let runningSpend = 0;
      const balanceMap = new Map();
      for (const t of data.slice().reverse()) {
        if (t.type === 'expense') {
          runningSpend += Math.abs(t.amount);
        }
        balanceMap.set(t.id, -runningSpend); // Show as negative for expenses
      }

      const transformedTransactions = data.map((t) => ({
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

    // Named after the dates in view: a whole month as 2026-11, another range by its ends.
    const [first, last] = periodRange(filters);
    const wholeMonth = first && last && first.slice(0, 7) === last.slice(0, 7) && first.endsWith('-01')
      && Number(last.slice(8)) === new Date(Number(last.slice(0, 4)), Number(last.slice(5, 7)), 0).getDate();
    const span = wholeMonth ? first.slice(0, 7) : first || last ? `${first || 'start'}-to-${last || 'today'}` : 'all-time';
    const filename = `transactions-${span}.csv`;

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

  const filteredTransactions = useMemo(() => applyFilters(transactions, filters), [transactions, filters]);

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
  const [rangeStart, rangeEnd] = periodRange(filters);
  const totals = summary(filteredTransactions);
  const line = timeline(filteredTransactions, { start: rangeStart, end: rangeEnd });
  const chosen = line?.buckets.find(({ key }) => key === pickedBucket) || null;
  const listed = chosen
    ? filteredTransactions.filter(({ date }) => date >= chosen.from && date <= chosen.to)
    : filteredTransactions;
  const groups = groupByDay(listed);
  const banks = [...new Set(transactions.filter((t) => t.bank).map((t) => t.bank))].sort();
  // Changing the type drops a category of the other type: nothing would match both.
  const changeFilters = (values) => setFilters((current) => {
    const next = { ...current, ...values };
    const category = categories.find(({ id }) => id === next.category);
    if (next.type && category && category.type !== next.type) next.category = '';
    return next;
  });
  const clearFilters = () => {
    setFilters(NO_FILTERS);
    setPickedBucket(null);
  };

  const period = periodLabel(rangeStart, rangeEnd);
  const count = (number, word) => `${number.toLocaleString('en-US')} ${word}${number === 1 ? '' : 's'}`;
  const scope = [
    `${count(totals.count, filters.type === 'income' ? 'income transaction' : filters.type === 'expense' ? 'expense' : 'transaction')}`,
    /^(all|since|until)/.test(period) ? `, ${period}` : ` in ${period}`,
    filters.query.trim() ? `, matching “${filters.query.trim()}”` : '',
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
        </div>

        {error && <p className="bw-note" data-tone="bad" role="alert">{error}</p>}

        {active && (
          <>
            <Filters
              filters={filters}
              onChange={changeFilters}
              onClear={clearFilters}
              categories={categories}
              banks={banks}
              hasNoCategory={transactions.some((t) => !t.category_id)}
              hasNoBank={transactions.some((t) => !t.bank)}
              picked={chosen}
              onUnpick={() => setPickedBucket(null)}
              formatMoney={formatMoney}
            />

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

            {groups.length === 0 ? (
              <div className="bw-panel">
                <p className="bw-nothing">
                  {transactions.length === 0 ? 'No transactions yet. Add one, or import a bank statement.' : 'Nothing matches these filters.'}
                  {transactions.length > 0 && (
                    <> <button type="button" className="bw-link tx-nothing__clear" onClick={clearFilters}>Clear all filters</button></>
                  )}
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
