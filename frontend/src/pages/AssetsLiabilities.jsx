import { useState, useEffect } from 'react';
import { Box, Heading, Spinner } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { assetGroups, balanceSheet, emergencyFund, formatDay, healthScore, measures, snapshotRows } from '../lib/assetsView';
import { today as localToday } from '../lib/transactionView';
import BalanceSheet from '../components/assets/BalanceSheet';
import NetWorthChart from '../components/assets/NetWorthChart';
import HealthPanel from '../components/assets/HealthPanel';
import CushionPanel from '../components/assets/CushionPanel';
import AssetList from '../components/assets/AssetList';
import LiabilityList from '../components/assets/LiabilityList';
import AssetForm from '../components/assets/AssetForm';
import LiabilityForm from '../components/assets/LiabilityForm';
import ConfirmDelete from '../components/assets/ConfirmDelete';
import SnapshotsDialog from '../components/assets/SnapshotsDialog';
import '../styles/ledger.css';
import '../styles/assets.css';

// What a new account starts with. The names matter: the emergency fund, the investments
// and the home equity are found by category name (see measures in lib/assetsView).
const defaultAssetCategories = [
  { name: 'Real Estate', icon: '🏠' },
  { name: 'Cash', icon: '💵' },
  { name: 'Savings Account', icon: '🏦' },
  { name: 'RRSP', icon: '📊' },
  { name: 'TFSA', icon: '💼' },
  { name: 'Vehicle', icon: '🚗' },
  { name: 'Investment', icon: '📈' },
  { name: 'Other Assets', icon: '💎' },
];

const defaultLiabilityTypes = [
  { name: 'Mortgage', icon: '🏡' },
  { name: 'Car Loan', icon: '🚙' },
  { name: 'Student Loan', icon: '🎓' },
  { name: 'Credit Card', icon: '💳' },
  { name: 'Personal Loan', icon: '💰' },
  { name: 'Line of Credit', icon: '📝' },
  { name: 'Other Liability', icon: '💸' },
];

const formatCurrency = (amount) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(amount || 0);

const signed = (amount) => `${amount >= 0 ? '+' : '−'}${formatCurrency(Math.abs(amount))}`;

export default function AssetsLiabilities() {
  const { user } = useAuth();

  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [assetCategories, setAssetCategories] = useState([]);
  const [liabilityTypes, setLiabilityTypes] = useState([]);
  const [spendingCategories, setSpendingCategories] = useState([]); // Expense categories for linking
  const [recurringPayments, setRecurringPayments] = useState([]); // For auto-filling monthly payments
  const [linkedCategoryPayments, setLinkedCategoryPayments] = useState({}); // Payments by category_id
  const [snapshots, setSnapshots] = useState([]);
  // Dates are the day here, not in UTC: in the evening those differ, and a snapshot
  // would be saved under tomorrow's date.
  const [recordDate, setRecordDate] = useState(() => localToday());
  const [compareDate, setCompareDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Monthly expenses (calculated from transactions)
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  // Where that figure comes from: this month's 'budget', or the 'average' of what was spent.
  const [monthlyBasis, setMonthlyBasis] = useState(null);

  // Dialogs
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [liabilityModalOpen, setLiabilityModalOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [snapshotsModalOpen, setSnapshotsModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
      loadMonthlyExpenses();
    }
  }, [user]);

  const loadMonthlyExpenses = async () => {
    try {
      // First, try to get the user's current monthly budget plan
      const currentDate = new Date();
      const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthStr = localToday(firstOfMonth); // e.g., "2026-01-01"

      const { data: budgetData } = await supabase
        .from('budgets')
        .select('id, total')
        .eq('user_id', user.id)
        .eq('month', monthStr)
        .single();

      if (budgetData?.total > 0) {
        // Use the budget plan amount as monthly expenses
        setMonthlyExpenses(parseFloat(budgetData.total));
        setMonthlyBasis('budget');
        return;
      }

      // Fallback: Calculate from actual transactions (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount, type, date')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .is('deleted_at', null)
        .gte('date', twelveMonthsAgo.toISOString().split('T')[0]);

      if (error) throw error;

      if (transactions && transactions.length > 0) {
        // Count actual months with data
        const monthsWithData = new Set(
          transactions.map((t) => {
            const d = new Date(t.date);
            return `${d.getFullYear()}-${d.getMonth()}`;
          })
        );
        const actualMonths = Math.max(1, monthsWithData.size);

        const totalExpenses = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const avgMonthly = totalExpenses / actualMonths;
        setMonthlyExpenses(avgMonthly);
        setMonthlyBasis('average');
      }
    } catch (error) {
      console.error('Error loading monthly expenses:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Load asset categories
      let { data: assetCats, error: assetCatsError } = await supabase
        .from('asset_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (assetCatsError) throw assetCatsError;

      if (!assetCats || assetCats.length === 0) {
        const { data: newCats } = await supabase
          .from('asset_categories')
          .insert(defaultAssetCategories.map((cat) => ({ user_id: user.id, name: cat.name, icon: cat.icon })))
          .select();
        assetCats = newCats || [];
      }
      setAssetCategories(assetCats);

      // Load liability types
      let { data: liabTypes, error: liabTypesError } = await supabase
        .from('liability_types')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (liabTypesError) throw liabTypesError;

      if (!liabTypes || liabTypes.length === 0) {
        const { data: newTypes } = await supabase
          .from('liability_types')
          .insert(defaultLiabilityTypes.map((type) => ({ user_id: user.id, name: type.name, icon: type.icon })))
          .select();
        liabTypes = newTypes || [];
      }
      setLiabilityTypes(liabTypes);

      // Load assets
      const { data: assetsData, error: assetsError } = await supabase
        .from('assets')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order');

      if (assetsError) throw assetsError;
      setAssets(assetsData || []);

      // Load liabilities
      const { data: liabsData, error: liabsError } = await supabase
        .from('liabilities')
        .select('*')
        .eq('user_id', user.id);

      if (liabsError) throw liabsError;
      setLiabilities(liabsData || []);

      // Load spending categories (expense type) for linking to liabilities
      const { data: spendingCats, error: spendingCatsError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .order('name');

      if (spendingCatsError) throw spendingCatsError;
      setSpendingCategories(spendingCats || []);

      // Load recurring payments (for auto-filling monthly payment amounts)
      const { data: recurringData, error: recurringError } = await supabase
        .from('recurring_payments')
        .select('id, name, amount, category_id, type, is_active, start_date, end_date, frequency, frequency_interval')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (recurringError) throw recurringError;
      setRecurringPayments(recurringData || []);

      // Load payments for linked categories (last 12 months, or further back if a
      // liability started earlier — payments are filtered per liability on render).
      // Trashed payments are left out: they do not count towards the balance either
      // (see 011_liability_interest.sql)
      const linkedLiabilities = (liabsData || []).filter(l => l.linked_category_id);
      const linkedCategoryIds = linkedLiabilities.map(l => l.linked_category_id);

      if (linkedCategoryIds.length > 0) {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const fetchFrom = linkedLiabilities
          .map(l => l.start_date)
          .filter(Boolean)
          .reduce((earliest, d) => (d < earliest ? d : earliest), oneYearAgo.toISOString().split('T')[0]);

        const { data: paymentsData, error: paymentsError } = await supabase
          .from('transactions')
          .select('id, amount, date, category_id, description, provider')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .is('deleted_at', null)
          .in('category_id', linkedCategoryIds)
          .gte('date', fetchFrom)
          .order('date', { ascending: false });

        if (paymentsError) throw paymentsError;

        // Group payments by category_id
        const paymentsByCategory = {};
        (paymentsData || []).forEach(payment => {
          if (!paymentsByCategory[payment.category_id]) {
            paymentsByCategory[payment.category_id] = [];
          }
          paymentsByCategory[payment.category_id].push(payment);
        });
        setLinkedCategoryPayments(paymentsByCategory);
      }

      // Load snapshots
      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from('net_worth_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('record_date', { ascending: false })
        .limit(20);

      if (snapshotsError) throw snapshotsError;
      setSnapshots(snapshotsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Asset CRUD
  const handleSaveAsset = async (formData) => {
    let updatedAssets;

    if (editingAsset) {
      const { error } = await supabase.from('assets').update(formData).eq('id', editingAsset.id);
      if (error) { console.error('Error updating asset:', error); return; }
      updatedAssets = assets.map((a) => (a.id === editingAsset.id ? { ...a, ...formData } : a));
      setAssets(updatedAssets);
    } else {
      const { data, error } = await supabase
        .from('assets')
        .insert([{ ...formData, user_id: user.id, display_order: assets.length }])
        .select();
      if (error) { console.error('Error adding asset:', error); return; }
      if (data && data[0]) {
        updatedAssets = [...assets, data[0]];
        setAssets(updatedAssets);
      }
    }

    // Auto-save snapshot with updated data
    if (updatedAssets) {
      await autoSaveSnapshot(updatedAssets, liabilities);
    }
  };

  const handleDeleteAsset = async () => {
    if (!itemToDelete) return;
    const { error } = await supabase.from('assets').delete().eq('id', itemToDelete.id);
    if (error) { console.error('Error deleting asset:', error); return; }
    const updatedAssets = assets.filter((a) => a.id !== itemToDelete.id);
    setAssets(updatedAssets);
    setItemToDelete(null);

    // Auto-save snapshot with updated data
    await autoSaveSnapshot(updatedAssets, liabilities);
  };

  // Liability CRUD
  const handleSaveLiability = async (formData) => {
    let updatedLiabilities;

    if (editingLiability) {
      const { error } = await supabase.from('liabilities').update(formData).eq('id', editingLiability.id);
      if (error) { console.error('Error updating liability:', error); return; }
      updatedLiabilities = liabilities.map((l) => (l.id === editingLiability.id ? { ...l, ...formData } : l));
      setLiabilities(updatedLiabilities);
    } else {
      const { data, error } = await supabase
        .from('liabilities')
        .insert([{ ...formData, user_id: user.id }])
        .select();
      if (error) { console.error('Error adding liability:', error); return; }
      if (data && data[0]) {
        updatedLiabilities = [...liabilities, data[0]];
        setLiabilities(updatedLiabilities);
      }
    }

    // Auto-save snapshot with updated data
    if (updatedLiabilities) {
      await autoSaveSnapshot(assets, updatedLiabilities);
    }

    // Reload linked category payments if a new category was linked
    if (formData.linked_category_id && !linkedCategoryPayments[formData.linked_category_id]) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const defaultFrom = oneYearAgo.toISOString().split('T')[0];
      const fetchFrom = formData.start_date && formData.start_date < defaultFrom ? formData.start_date : defaultFrom;

      const { data: paymentsData } = await supabase
        .from('transactions')
        .select('id, amount, date, category_id, description, provider')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .is('deleted_at', null)
        .eq('category_id', formData.linked_category_id)
        .gte('date', fetchFrom)
        .order('date', { ascending: false });

      if (paymentsData) {
        setLinkedCategoryPayments((prev) => ({
          ...prev,
          [formData.linked_category_id]: paymentsData,
        }));
      }
    }
  };

  const handleDeleteLiability = async () => {
    if (!itemToDelete) return;
    const { error } = await supabase.from('liabilities').delete().eq('id', itemToDelete.id);
    if (error) { console.error('Error deleting liability:', error); return; }
    const updatedLiabilities = liabilities.filter((l) => l.id !== itemToDelete.id);
    setLiabilities(updatedLiabilities);
    setItemToDelete(null);

    // Auto-save snapshot with updated data
    await autoSaveSnapshot(assets, updatedLiabilities);
  };

  // Auto-save snapshot helper (called after asset/liability changes)
  const autoSaveSnapshot = async (currentAssets, currentLiabilities) => {
    const totalAssetsValue = currentAssets.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
    const totalLiabilitiesValue = currentLiabilities.reduce((sum, l) => sum + (parseFloat(l.outstanding_balance) || 0), 0);
    const equityValue = totalAssetsValue - totalLiabilitiesValue;

    const today = localToday();

    const snapshot = {
      user_id: user.id,
      record_date: today,
      total_assets: totalAssetsValue,
      total_liabilities: totalLiabilitiesValue,
      equity: equityValue,
      assets_breakdown: JSON.stringify(currentAssets),
      liabilities_breakdown: JSON.stringify(currentLiabilities),
    };

    const { error } = await supabase
      .from('net_worth_snapshots')
      .upsert([snapshot], { onConflict: 'user_id,record_date' });

    if (error) {
      console.error('Error auto-saving snapshot:', error);
    } else {
      // Refresh snapshots to update the chart
      const { data: snapshotsData } = await supabase
        .from('net_worth_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('record_date', { ascending: false })
        .limit(20);
      if (snapshotsData) setSnapshots(snapshotsData);
    }
  };

  // Manual save snapshot (for backdating or specific dates)
  const saveSnapshot = async () => {
    setSaving(true);
    try {
      const snapshot = {
        user_id: user.id,
        record_date: recordDate,
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        equity: equity,
        assets_breakdown: JSON.stringify(assets),
        liabilities_breakdown: JSON.stringify(liabilities),
      };

      const { error } = await supabase
        .from('net_worth_snapshots')
        .upsert([snapshot], { onConflict: 'user_id,record_date' });

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error saving snapshot:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete snapshot
  const deleteSnapshot = async (snapshotId) => {
    try {
      const { error } = await supabase
        .from('net_worth_snapshots')
        .delete()
        .eq('id', snapshotId);

      if (error) throw error;

      // Update local state
      const deletedSnapshot = snapshots.find((s) => s.id === snapshotId);
      setSnapshots(snapshots.filter((s) => s.id !== snapshotId));

      // Clear compare date if the deleted snapshot was selected
      if (deletedSnapshot && compareDate === deletedSnapshot.record_date) {
        setCompareDate('');
      }
    } catch (error) {
      console.error('Error deleting snapshot:', error);
    }
  };

  // Calculate live metrics
  const liveTotalAssets = assets.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const liveTotalLiabilities = liabilities.reduce((sum, l) => sum + (parseFloat(l.outstanding_balance) || 0), 0);

  // Use snapshot data when a past date is selected, live data otherwise
  const today = localToday();
  const selectedSnapshot = recordDate !== today
    ? snapshots.find((s) => s.record_date === recordDate)
    : null;

  const totalAssets = selectedSnapshot ? (selectedSnapshot.total_assets || 0) : liveTotalAssets;
  const totalLiabilities = selectedSnapshot ? (selectedSnapshot.total_liabilities || 0) : liveTotalLiabilities;
  const equity = totalAssets - totalLiabilities;
  const debtToAssetsRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  // Comparison changes
  let equityChange = null;
  let assetsChange = null;
  let liabilitiesChange = null;
  let debtToAssetsChange = null;
  if (compareDate && snapshots.length > 0) {
    const compareSnapshot = snapshots.find((s) => s.record_date === compareDate);
    if (compareSnapshot) {
      equityChange = equity - compareSnapshot.equity;
      assetsChange = totalAssets - (compareSnapshot.total_assets || 0);
      liabilitiesChange = totalLiabilities - (compareSnapshot.total_liabilities || 0);
      const prevDebtToAssets = compareSnapshot.total_assets > 0
        ? (compareSnapshot.total_liabilities / compareSnapshot.total_assets) * 100
        : 0;
      debtToAssetsChange = debtToAssetsRatio - prevDebtToAssets;
    }
  }

  if (loading) {
    return (
      <Box className="bw-surface bw-page">
        <Box className="bw-layout">
          <div className="bw-status" role="status">
            <Spinner size="sm" color="currentColor" />
            Loading what you own and owe…
          </div>
        </Box>
      </Box>
    );
  }

  const groups = assetGroups(assets, assetCategories);
  // A past date is drawn and measured from the lists saved with it, when it has them.
  const savedAssets = selectedSnapshot ? snapshotRows(selectedSnapshot.assets_breakdown) : [];
  const viewAssets = savedAssets.length ? savedAssets : assets;
  const viewLiabilities = savedAssets.length ? snapshotRows(selectedSnapshot.liabilities_breakdown) : liabilities;
  const { liquid, investments, homeEquity } = measures(viewAssets, viewLiabilities, assetCategories, liabilityTypes);
  const sheet = balanceSheet(assetGroups(viewAssets, assetCategories), viewLiabilities, totalAssets, totalLiabilities);
  const health = healthScore({ totalAssets, totalLiabilities, liquid, investments, monthlyExpenses });
  const fund = emergencyFund(liquid, monthlyExpenses);

  const borrowed = Math.round(debtToAssetsRatio);
  const headline = totalAssets <= 0 && totalLiabilities <= 0
    ? 'Nothing recorded yet. Add what you own and what you owe.'
    : totalLiabilities <= 0
      ? 'Everything you own is yours: no debts are recorded.'
      : equity < 0
        ? `You owe ${formatCurrency(-equity)} more than you own.`
        : `Of every dollar you own, ${borrowed}¢ is borrowed and ${100 - borrowed}¢ is yours.`;
  const since = compareDate ? `since ${formatDay(compareDate)}` : null;
  const dates = snapshots.some((s) => s.record_date === today) ? snapshots : [{ id: 'today', record_date: today }, ...snapshots];

  return (
    <Box className="bw-surface bw-page">
      <Box className="bw-layout">
        <header className="bw-masthead">
          <div>
            <Heading as="h1" className="bw-title">Assets &amp; Liabilities</Heading>
            <p className="bw-subtitle">
              {selectedSnapshot ? `As recorded on ${formatDay(recordDate)}` : 'What you own and what you owe, as of today'}
            </p>
          </div>

          <div className="assets-controls">
            <label>
              <span>Showing</span>
              <select className="bw-select" value={recordDate} onChange={(event) => setRecordDate(event.target.value)}>
                {dates.map((s) => (
                  <option value={s.record_date} key={s.id}>{s.record_date === today ? 'Today' : formatDay(s.record_date)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Compare with</span>
              <select className="bw-select" value={compareDate} onChange={(event) => setCompareDate(event.target.value)}>
                <option value="">Nothing</option>
                {snapshots.map((s) => <option value={s.record_date} key={s.id}>{formatDay(s.record_date)}</option>)}
              </select>
            </label>
            {selectedSnapshot ? (
              <button type="button" className="bw-button bw-button--quiet" onClick={() => setRecordDate(today)}>Back to today</button>
            ) : (
              <button type="button" className="bw-button" onClick={saveSnapshot} disabled={saving}>
                {saving ? 'Saving…' : 'Save snapshot'}
              </button>
            )}
          </div>
        </header>

        {selectedSnapshot && (
          <p className="bw-note">
            Everything on this page is as saved on {formatDay(recordDate)}, except the two lists of assets and liabilities, which show today.
          </p>
        )}

        <section className="bw-ledger" aria-label="Net worth">
          <dl className="bw-figures">
            <div className="bw-figure bw-figure--lead">
              <dt>Net worth</dt>
              <dd data-tone={equity < 0 ? 'bad' : 'good'}>{formatCurrency(equity)}</dd>
              {equityChange !== null && <small data-tone={equityChange < 0 ? 'bad' : 'good'}>{signed(equityChange)} {since}</small>}
            </div>
            <div className="bw-figure">
              <dt>Assets</dt>
              <dd>{formatCurrency(totalAssets)}</dd>
              <small>{assetsChange !== null ? `${signed(assetsChange)} ${since}` : 'everything you own'}</small>
            </div>
            <div className="bw-figure">
              <dt>Liabilities</dt>
              <dd>{formatCurrency(totalLiabilities)}</dd>
              <small>{liabilitiesChange !== null ? `${signed(liabilitiesChange)} ${since}` : 'everything you owe'}</small>
            </div>
            <div className="bw-figure">
              <dt>Debt to assets</dt>
              <dd>{debtToAssetsRatio.toFixed(1)}%</dd>
              <small>
                {debtToAssetsChange !== null
                  ? `${debtToAssetsChange >= 0 ? '+' : '−'}${Math.abs(debtToAssetsChange).toFixed(1)} points ${since}`
                  : 'of what you own is borrowed'}
              </small>
            </div>
          </dl>

          <p className="assets-headline" data-tone={equity < 0 ? 'bad' : 'good'}>{headline}</p>

          {sheet && (
            <BalanceSheet sheet={sheet} totalAssets={totalAssets} totalLiabilities={totalLiabilities} formatCurrency={formatCurrency} />
          )}
        </section>

        <div className="assets-columns">
          <div className="assets-stack">
            <NetWorthChart snapshots={snapshots} formatCurrency={formatCurrency} onManage={() => setSnapshotsModalOpen(true)} />
            <AssetList
              groups={groups}
              totalAssets={liveTotalAssets}
              formatCurrency={formatCurrency}
              onAdd={() => { setEditingAsset(null); setAssetModalOpen(true); }}
              onEdit={(asset) => { setEditingAsset(asset); setAssetModalOpen(true); }}
              onDelete={(asset) => setItemToDelete({ id: asset.id, kind: 'asset', name: asset.name })}
            />
          </div>
          <div className="assets-stack">
            <HealthPanel health={health} />
            <CushionPanel
              fund={fund}
              liquid={liquid}
              investments={investments}
              homeEquity={homeEquity}
              monthlyExpenses={monthlyExpenses}
              basis={monthlyBasis}
              totalAssets={totalAssets}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>

        <LiabilityList
          liabilities={liabilities}
          types={liabilityTypes}
          spendingCategories={spendingCategories}
          recurringPayments={recurringPayments}
          paymentsByCategory={linkedCategoryPayments}
          totalLiabilities={liveTotalLiabilities}
          formatCurrency={formatCurrency}
          onAdd={() => { setEditingLiability(null); setLiabilityModalOpen(true); }}
          onEdit={(liability) => { setEditingLiability(liability); setLiabilityModalOpen(true); }}
          onDelete={(liability) => setItemToDelete({ id: liability.id, kind: 'liability', name: liability.creditor })}
        />
      </Box>

      <AssetForm
        open={assetModalOpen}
        onClose={() => { setAssetModalOpen(false); setEditingAsset(null); }}
        asset={editingAsset}
        categories={assetCategories}
        onSave={handleSaveAsset}
      />
      <LiabilityForm
        open={liabilityModalOpen}
        onClose={() => { setLiabilityModalOpen(false); setEditingLiability(null); }}
        liability={editingLiability}
        types={liabilityTypes}
        spendingCategories={spendingCategories}
        recurringPayments={recurringPayments}
        formatCurrency={formatCurrency}
        onSave={handleSaveLiability}
      />
      <ConfirmDelete
        item={itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={itemToDelete?.kind === 'asset' ? handleDeleteAsset : handleDeleteLiability}
      />
      <SnapshotsDialog
        open={snapshotsModalOpen}
        onClose={() => setSnapshotsModalOpen(false)}
        snapshots={snapshots}
        formatCurrency={formatCurrency}
        onDelete={deleteSnapshot}
      />
    </Box>
  );
}
