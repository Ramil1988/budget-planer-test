import { useState, useEffect } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Box, Heading, IconButton, Input, Spinner } from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { getPaymentDatesInRange, getMonthlyEquivalent, formatFrequency } from '../lib/recurringUtils';
import { monthProgress, paceSummary } from '../lib/budgetMath';
import BudgetRecommendations from '../components/BudgetRecommendations';
import PaceLedger from '../components/budget/PaceLedger';
import CategoryList from '../components/budget/CategoryList';
import SetupPanel from '../components/budget/SetupPanel';
import CategoryTransactionsDialog from '../components/budget/CategoryTransactionsDialog';
import '../styles/ledger.css';
import '../styles/budget.css';

export default function Budget() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [categories, setCategories] = useState([]);
  const [budgetLimits, setBudgetLimits] = useState({});
  const [budgetData, setBudgetData] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get('month');
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const selectedMonth = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(monthParam ?? '') ? monthParam : defaultMonth;
  const [activeTab, setActiveTab] = useState('tracking');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryTransactions, setCategoryTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [recurringPayments, setRecurringPayments] = useState([]);
  const [forecastData, setForecastData] = useState([]);
  const [viewMode, setViewMode] = useState('current'); // 'current' or 'projected'
  const [previousMonthLimits, setPreviousMonthLimits] = useState({}); // Previous month's budget limits for comparison
  const [setupSortBy, setSetupSortBy] = useState('amount'); // 'amount' or 'name'
  const [committedLimits, setCommittedLimits] = useState({}); // Used for sorting - only updates on blur
  const [savedLimits, setSavedLimits] = useState({}); // What the setup tab was loaded with, to tell when it has changes
  const [categorySearch, setCategorySearch] = useState(''); // Search filter for categories
  const [recommendationsKey, setRecommendationsKey] = useState(0); // Key to force refresh recommendations

  const setMonth = (month) => {
    if (!month) return;
    const next = new URLSearchParams(searchParams);
    next.set('month', month);
    setSearchParams(next, { replace: true });
  };

  const stepMonth = (step) => {
    // The address changes at once, but the render that follows can still be pending when the
    // next click arrives, so a quick second click reads the month from the address.
    const inAddress = new URLSearchParams(window.location.search).get('month');
    const from = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(inAddress ?? '') ? inAddress : selectedMonth;
    const [year, month] = from.split('-').map(Number);
    const date = new Date(year, month - 1 + step, 1);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  useEffect(() => {
    if (user) {
      loadCategories();
      loadRecurringPayments();
    }
  }, [user]);

  useEffect(() => {
    if (user && categories.length > 0) {
      loadBudget();
    }
  }, [user, selectedMonth, categories]);

  // Calculate forecast when budget data or recurring payments change
  useEffect(() => {
    if (budgetData.length > 0 && recurringPayments.length >= 0) {
      calculateForecast();
    }
  }, [budgetData, recurringPayments, selectedMonth]);

  const calculateForecast = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const today = new Date();
    const endOfMonth = new Date(year, month, 0); // Last day of selected month

    // Check if we're in the selected month
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

    // Start date for forecast: TODAY if current month (matches Dashboard's Upcoming Payments),
    // or start of month if future month
    let forecastStart;
    if (isCurrentMonth) {
      // Start from today to match Dashboard's upcoming payments calculation
      forecastStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    } else if (today < new Date(year, month - 1, 1)) {
      // Future month - forecast entire month
      forecastStart = new Date(year, month - 1, 1);
    } else {
      // Past month - no forecast needed
      setForecastData([]);
      return;
    }

    // Calculate upcoming recurring payments by category
    const upcomingByCategory = {};

    for (const payment of recurringPayments) {
      if (!payment.category_id) continue;

      const dates = getPaymentDatesInRange(
        payment.start_date,
        payment.frequency,
        forecastStart,
        endOfMonth,
        payment.end_date,
        payment.business_days_only || false,
        payment.last_business_day_of_month || false,
        payment.frequency_interval
      );

      const totalAmount = dates.length * Number(payment.amount);
      if (totalAmount > 0) {
        if (!upcomingByCategory[payment.category_id]) {
          upcomingByCategory[payment.category_id] = {
            amount: 0,
            payments: [],
          };
        }
        upcomingByCategory[payment.category_id].amount += totalAmount;
        upcomingByCategory[payment.category_id].payments.push({
          name: payment.name,
          amount: Number(payment.amount),
          occurrences: dates.length,
          total: totalAmount,
        });
      }
    }

    // Build forecast data by merging with budget data
    // Projected = spent + upcoming recurring + remaining budget for non-recurring categories
    const forecast = budgetData.map(item => {
      const upcoming = upcomingByCategory[item.id] || { amount: 0, payments: [] };
      const hasRecurring = upcoming.amount > 0;

      // For categories WITH recurring: projected = spent + upcoming recurring
      // For categories WITHOUT recurring: projected = full budget limit (assume it'll be used)
      let projectedSpent;
      let nonRecurringRemaining = 0;

      if (hasRecurring) {
        projectedSpent = item.spent + upcoming.amount;
      } else {
        projectedSpent = item.limit > 0 ? Math.max(item.spent, item.limit) : item.spent;
        nonRecurringRemaining = item.limit > 0 && item.spent < item.limit
          ? item.limit - item.spent
          : 0;
      }

      const projectedRemaining = item.limit - projectedSpent;
      const projectedPercent = item.limit > 0 ? (projectedSpent / item.limit) * 100 : 0;
      const willExceed = item.limit > 0 && projectedSpent > item.limit;
      const overAmount = willExceed ? projectedSpent - item.limit : 0;

      return {
        ...item,
        upcomingAmount: upcoming.amount,
        upcomingPayments: upcoming.payments,
        projectedSpent,
        projectedRemaining,
        projectedPercent,
        willExceed,
        overAmount,
        nonRecurringRemaining,
        hasRecurring,
      };
    });

    // Sort: categories that will exceed budget first, then by projected percent
    forecast.sort((a, b) => {
      if (a.willExceed && !b.willExceed) return -1;
      if (!a.willExceed && b.willExceed) return 1;
      return b.projectedPercent - a.projectedPercent;
    });

    setForecastData(forecast);
  };

  const loadCategories = async () => {
    try {
      const { data, error: catError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .order('name');

      if (catError) throw catError;
      const categoryData = data || [];
      setCategories(categoryData);

      // If no categories exist, stop loading immediately
      if (categoryData.length === 0) {
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to load categories: ' + err.message);
      setLoading(false);
    }
  };

  const loadRecurringPayments = async () => {
    try {
      const { data, error: recError } = await supabase
        .from('recurring_payments')
        .select('*, categories(name)')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('is_active', true);

      if (recError) throw recError;
      setRecurringPayments(data || []);
    } catch (err) {
      console.error('Failed to load recurring payments:', err);
    }
  };

  const loadBudget = async () => {
    setLoading(true);
    setError('');
    try {
      // Parse year and month from 'YYYY-MM' format to avoid timezone issues
      const [year, month] = selectedMonth.split('-').map(Number);

      // Create date strings for queries (YYYY-MM-DD format)
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
      const nextMonthStart = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;

      // Load existing budget for this month
      const { data: budgetRow, error: budgetError } = await supabase
        .from('budgets')
        .select(`
          id,
          total,
          budget_categories (
            category_id,
            limit_amount
          )
        `)
        .eq('user_id', user.id)
        .gte('month', startDate)
        .lt('month', nextMonthStart)
        .maybeSingle();

      if (budgetError) throw budgetError;

      // Create limits map from existing budget
      let limitsMap = {};
      if (budgetRow?.budget_categories) {
        budgetRow.budget_categories.forEach(bc => {
          limitsMap[bc.category_id] = bc.limit_amount;
        });
      } else {
        // No budget for this month - try to load from previous month
        const prevYear = month === 1 ? year - 1 : year;
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
        const prevNextMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;

        const { data: prevBudgetRow } = await supabase
          .from('budgets')
          .select(`
            id,
            budget_categories (
              category_id,
              limit_amount
            )
          `)
          .eq('user_id', user.id)
          .gte('month', prevStartDate)
          .lt('month', prevNextMonthStart)
          .maybeSingle();

        if (prevBudgetRow?.budget_categories) {
          prevBudgetRow.budget_categories.forEach(bc => {
            limitsMap[bc.category_id] = bc.limit_amount;
          });
        }
      }
      setBudgetLimits(limitsMap);
      setCommittedLimits(limitsMap); // Sync committed limits for sorting
      setSavedLimits(limitsMap);

      // Load transactions for this month to calculate spent
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('category_id, amount')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .is('deleted_at', null)
        .gte('date', startDate)
        .lte('date', endDate);

      if (txError) throw txError;

      // Calculate spent per category
      const spentMap = {};
      (transactions || []).forEach(tx => {
        if (tx.category_id) {
          spentMap[tx.category_id] = (spentMap[tx.category_id] || 0) + Number(tx.amount);
        }
      });

      // Build budget data for display
      const totalBudget = Object.values(limitsMap).reduce((sum, val) => sum + Number(val || 0), 0);

      const data = categories.map(cat => {
        const limit = Number(limitsMap[cat.id] || 0);
        const spent = Number(spentMap[cat.id] || 0);
        const remaining = limit - spent;
        const percentOfLimit = limit > 0 ? (spent / limit) * 100 : 0;
        const percentOfBudget = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;

        return {
          id: cat.id,
          name: cat.name,
          limit,
          spent,
          remaining,
          percentOfLimit,
          percentOfBudget,
        };
      });

      // Sort: Over budget first, then by percent used (descending)
      data.sort((a, b) => {
        const aOverBudget = a.limit > 0 && a.spent > a.limit;
        const bOverBudget = b.limit > 0 && b.spent > b.limit;

        // Over budget items come first
        if (aOverBudget && !bOverBudget) return -1;
        if (!aOverBudget && bOverBudget) return 1;

        // Then sort by percent of limit used (descending)
        return b.percentOfLimit - a.percentOfLimit;
      });
      setBudgetData(data);
    } catch (err) {
      setError('Failed to load budget: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load previous month's budget limits for comparison in Budget Setup
  const loadPreviousMonthBudget = async () => {
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
      const prevNextMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;

      const { data: prevBudgetRow } = await supabase
        .from('budgets')
        .select(`
          id,
          budget_categories (
            category_id,
            limit_amount
          )
        `)
        .eq('user_id', user.id)
        .gte('month', prevStartDate)
        .lt('month', prevNextMonthStart)
        .maybeSingle();

      const prevLimitsMap = {};
      if (prevBudgetRow?.budget_categories) {
        prevBudgetRow.budget_categories.forEach(bc => {
          prevLimitsMap[bc.category_id] = bc.limit_amount;
        });
      }
      setPreviousMonthLimits(prevLimitsMap);
    } catch (err) {
      console.error('Failed to load previous month budget:', err);
    }
  };

  // Load previous month data when switching to setup tab or changing month
  useEffect(() => {
    if (user && activeTab === 'setup') {
      loadPreviousMonthBudget();
    }
  }, [user, selectedMonth, activeTab]);

  const handleLimitChange = (categoryId, value) => {
    setBudgetLimits(prev => ({
      ...prev,
      [categoryId]: value === '' ? '' : Number(value),
    }));
  };

  // Commit limit on blur - this triggers re-sorting only when user finishes editing
  const handleLimitBlur = (categoryId) => {
    setCommittedLimits(prev => ({
      ...prev,
      [categoryId]: budgetLimits[categoryId] ?? '',
    }));
  };

  const saveBudget = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // Parse year and month from 'YYYY-MM' format to avoid timezone issues
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonthStart = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;

      const total = Object.values(budgetLimits).reduce((sum, val) => sum + Number(val || 0), 0);

      // Check if budget exists for this month
      const { data: existingBudget } = await supabase
        .from('budgets')
        .select('id')
        .eq('user_id', user.id)
        .gte('month', startDate)
        .lt('month', nextMonthStart)
        .maybeSingle();

      let budgetId;

      if (existingBudget) {
        // Update existing budget
        const { error: updateError } = await supabase
          .from('budgets')
          .update({ total })
          .eq('id', existingBudget.id);
        if (updateError) throw updateError;
        budgetId = existingBudget.id;

        // Delete existing budget categories
        await supabase
          .from('budget_categories')
          .delete()
          .eq('budget_id', budgetId);
      } else {
        // Create new budget
        const { data: newBudget, error: insertError } = await supabase
          .from('budgets')
          .insert({
            user_id: user.id,
            month: startDate,
            total,
          })
          .select('id')
          .single();
        if (insertError) throw insertError;
        budgetId = newBudget.id;
      }

      // Insert budget categories
      const budgetCategories = Object.entries(budgetLimits)
        .filter(([_, limit]) => Number(limit) > 0)
        .map(([categoryId, limit]) => ({
          budget_id: budgetId,
          category_id: categoryId,
          limit_amount: Number(limit),
        }));

      if (budgetCategories.length > 0) {
        const { error: catError } = await supabase
          .from('budget_categories')
          .insert(budgetCategories);
        if (catError) throw catError;
      }

      setSuccess('Budget saved successfully!');
      loadBudget(); // Reload to refresh data
    } catch (err) {
      setError('Failed to save budget: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadCategoryTransactions = async (categoryId, categoryName) => {
    setLoadingTransactions(true);
    setSelectedCategory({ id: categoryId, name: categoryName });

    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

      const { data, error } = await supabase
        .from('transactions')
        .select('id, description, amount, date')
        .eq('user_id', user.id)
        .eq('category_id', categoryId)
        .eq('type', 'expense')
        .is('deleted_at', null)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;
      setCategoryTransactions(data || []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setCategoryTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const closeTransactionsModal = () => {
    setSelectedCategory(null);
    setCategoryTransactions([]);
  };

  // Apply a budget suggestion from recommendations
  const applyBudgetSuggestion = async (categoryId, newLimit) => {
    try {
      // Apply to NEXT month (suggestions are based on historical data)
      const today = new Date();
      const nextMonth = today.getMonth() + 2; // getMonth() is 0-indexed, +2 for next month
      const nextYear = nextMonth > 12 ? today.getFullYear() + 1 : today.getFullYear();
      const adjustedMonth = nextMonth > 12 ? nextMonth - 12 : nextMonth;

      const startDate = `${nextYear}-${String(adjustedMonth).padStart(2, '0')}-01`;
      const followingMonthStart = adjustedMonth === 12
        ? `${nextYear + 1}-01-01`
        : `${nextYear}-${String(adjustedMonth + 1).padStart(2, '0')}-01`;

      // Check if budget exists for next month
      const { data: existingBudget } = await supabase
        .from('budgets')
        .select('id')
        .eq('user_id', user.id)
        .gte('month', startDate)
        .lt('month', followingMonthStart)
        .maybeSingle();

      let budgetId;

      if (existingBudget) {
        budgetId = existingBudget.id;
      } else {
        // Create new budget for this month
        const { data: newBudget, error: insertError } = await supabase
          .from('budgets')
          .insert({
            user_id: user.id,
            month: startDate,
            total: newLimit,
          })
          .select('id')
          .single();
        if (insertError) throw insertError;
        budgetId = newBudget.id;
      }

      // Check if budget_category exists for this category
      const { data: existingBudgetCat } = await supabase
        .from('budget_categories')
        .select('id')
        .eq('budget_id', budgetId)
        .eq('category_id', categoryId)
        .maybeSingle();

      if (existingBudgetCat) {
        // Update existing
        const { error: updateError } = await supabase
          .from('budget_categories')
          .update({ limit_amount: newLimit })
          .eq('id', existingBudgetCat.id);
        if (updateError) throw updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('budget_categories')
          .insert({
            budget_id: budgetId,
            category_id: categoryId,
            limit_amount: newLimit,
          });
        if (insertError) throw insertError;
      }

      // Update total in budgets table
      const { data: allBudgetCats } = await supabase
        .from('budget_categories')
        .select('limit_amount')
        .eq('budget_id', budgetId);

      const newTotal = (allBudgetCats || []).reduce((sum, bc) => sum + Number(bc.limit_amount || 0), 0);

      await supabase
        .from('budgets')
        .update({ total: newTotal })
        .eq('id', budgetId);

      // Update local state
      setBudgetLimits(prev => ({
        ...prev,
        [categoryId]: newLimit,
      }));
      setCommittedLimits(prev => ({
        ...prev,
        [categoryId]: newLimit,
      }));

      // Reload budget data
      await loadBudget();

      setSuccess('Budget updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to apply budget suggestion:', err);
      setError('Failed to apply suggestion: ' + err.message);
    }
  };

  // Refresh recommendations after budget changes
  const refreshRecommendations = () => {
    setRecommendationsKey(prev => prev + 1);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getMonthName = (monthStr) => {
    // Parse year and month from 'YYYY-MM' format to avoid timezone issues
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1); // month is 0-indexed
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Calculate totals
  const totalLimit = budgetData.reduce((sum, item) => sum + item.limit, 0);
  const totalSpent = budgetData.reduce((sum, item) => sum + item.spent, 0);

  // Which categories are driven by recurring payments, and what they cost per
  // month. Used to flag those categories in both Budget Tracking and Setup.
  // recurringPayments is already limited to active expense recurrings; skip the
  // ones that have already finished.
  const recurringByCategory = (() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const map = {};

    for (const p of recurringPayments) {
      if (!p.category_id) continue;
      if (p.end_date && p.end_date < todayStr) continue;

      const monthly = getMonthlyEquivalent(p.amount, p.frequency, p.frequency_interval);

      if (!map[p.category_id]) map[p.category_id] = { count: 0, monthly: 0, items: [] };
      map[p.category_id].count += 1;
      map[p.category_id].monthly += monthly;
      map[p.category_id].items.push({
        name: p.name,
        amount: Number(p.amount),
        frequency: formatFrequency(p.frequency, p.frequency_interval),
        monthly,
      });
    }

    // Biggest commitment first
    for (const entry of Object.values(map)) {
      entry.items.sort((a, b) => b.monthly - a.monthly);
    }

    return map;
  })();

  if (loading && categories.length === 0) {
    return (
      <Box className="bw-surface bw-page">
        <Box className="bw-layout">
          <div className="bw-status" role="status">
            <Spinner size="sm" color="currentColor" />
            Loading budget…
          </div>
        </Box>
      </Box>
    );
  }

  if (!loading && categories.length === 0) {
    return (
      <Box className="bw-surface bw-page">
        <Box className="bw-layout">
          <div className="bw-empty">
            <h1>No expense categories yet</h1>
            <p>A budget is a limit per category, so it needs categories first.</p>
            <RouterLink className="bw-link" to="/categories">Add expense categories</RouterLink>
          </div>
        </Box>
      </Box>
    );
  }

  const progress = monthProgress(selectedMonth);
  const monthName = getMonthName(selectedMonth);
  const [monthWord] = monthName.split(' ');
  const [selectedYear, selectedMonthNumber] = selectedMonth.split('-').map(Number);
  const shortMonth = new Date(selectedYear, selectedMonthNumber - 1, 1).toLocaleDateString('en-US', { month: 'short' });
  const monthState = progress.state === 'current'
    ? `${progress.daysLeft} ${progress.daysLeft === 1 ? 'day' : 'days'} left`
    : progress.state === 'past' ? 'closed' : 'not started';

  // What recurring payments will still take, and what the open categories are expected to use.
  const scheduled = forecastData.reduce((sum, item) => sum + item.upcomingAmount, 0);
  const expected = forecastData.reduce((sum, item) => sum + item.nonRecurringRemaining, 0);
  const canProject = forecastData.length > 0 && totalLimit > 0;
  const mode = canProject ? viewMode : 'current';

  const projectedOver = Math.max(0, totalSpent + scheduled + expected - totalLimit);
  const exceeding = forecastData.filter((item) => item.willExceed).length;
  const summary = mode === 'projected'
    ? {
      tone: projectedOver > 0 ? 'bad' : 'good',
      headline: projectedOver > 0 ? `Heading for ${formatCurrency(projectedOver)} over budget` : 'On course to finish within budget',
      detail: `${formatCurrency(totalSpent)} spent, ${formatCurrency(scheduled)} scheduled and ${formatCurrency(expected)} expected in the categories that are still open.${
        exceeding > 0 ? ` ${exceeding} ${exceeding === 1 ? 'category' : 'categories'} will go over.` : ''}`,
    }
    : paceSummary({ limit: totalLimit, spent: totalSpent, scheduled, progress, monthName: monthWord, money: formatCurrency });

  const matches = (item) => item.name.toLowerCase().includes(categorySearch.toLowerCase());
  const listed = mode === 'projected'
    ? forecastData.filter((item) => item.limit > 0 && matches(item))
    : budgetData.filter(matches);
  const dirty = categories.some(({ id }) => Number(budgetLimits[id] || 0) !== Number(savedLimits[id] || 0));
  const stepButton = { variant: 'ghost', minW: '36px', h: '40px', color: 'var(--bw-muted)', _hover: { bg: 'var(--bw-hover)' } };

  return (
    <Box className="bw-surface bw-page">
      <Box className="bw-layout">
        <header className="bw-masthead">
          <div>
            <Heading as="h1" className="bw-title">Monthly Budget</Heading>
            <p className="bw-subtitle">{monthName}, {monthState}</p>
          </div>

          <div className="bw-month-control">
            <IconButton {...stepButton} aria-label="Go to previous month" onClick={() => stepMonth(-1)}>
              <FiChevronLeft />
            </IconButton>
            <Input
              type="month"
              aria-label="Budget month"
              value={selectedMonth}
              onChange={(event) => setMonth(event.target.value)}
              variant="flushed"
              w="166px"
              minW="0"
              px={2}
              h="40px"
              color="var(--bw-ink)"
              border="0"
              fontSize="sm"
              fontWeight="600"
              css={{ colorScheme: 'light', '.dark &': { colorScheme: 'dark' } }}
              _focusVisible={{ outline: '2px solid', outlineColor: 'var(--bw-accent)', outlineOffset: '-2px', boxShadow: 'none' }}
            />
            <IconButton {...stepButton} aria-label="Go to next month" onClick={() => stepMonth(1)}>
              <FiChevronRight />
            </IconButton>
          </div>
        </header>

        <div className="bw-switches">
          <div className="bw-tabs" role="tablist" aria-label="Budget views">
            {[['tracking', 'Budget Tracking'], ['setup', 'Budget Setup']].map(([value, label]) => (
              <button
                type="button"
                role="tab"
                id={`budget-tab-${value}`}
                aria-selected={activeTab === value}
                aria-controls={`budget-panel-${value}`}
                className="bw-tab"
                onClick={() => setActiveTab(value)}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'tracking' && canProject && (
            <div className="bw-segment" role="group" aria-label="Month so far or projected to its end">
              {[['current', 'Current'], ['projected', 'Projected']].map(([value, label]) => (
                <button type="button" aria-pressed={mode === value} onClick={() => setViewMode(value)} key={value}>{label}</button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="bw-note" data-tone="bad" role="alert">{error}</p>}
        {success && <p className="bw-note" role="status">{success}</p>}

        {activeTab === 'tracking' && (
          <Box display="grid" gap="inherit" role="tabpanel" id="budget-panel-tracking" aria-labelledby="budget-tab-tracking">
            {loading ? (
              <div className="bw-status" role="status">
                <Spinner size="sm" color="currentColor" />
                Loading {monthName}…
              </div>
            ) : (
              <>
                <PaceLedger
                  mode={mode}
                  limit={totalLimit}
                  spent={totalSpent}
                  scheduled={scheduled}
                  expected={expected}
                  progress={progress}
                  summary={summary}
                  firstDay={`${shortMonth} 1`}
                  lastDay={`${shortMonth} ${progress.daysInMonth}`}
                  formatCurrency={formatCurrency}
                />

                <BudgetRecommendations
                  key={recommendationsKey}
                  budgetId={null}
                  selectedMonth={selectedMonth}
                  onApplySuggestion={applyBudgetSuggestion}
                  onRefresh={refreshRecommendations}
                />

                <div className="bw-section-head">
                  <div>
                    <h2>Categories</h2>
                    {mode === 'projected' ? (
                      <p>Each bar runs to the end of the month: what is spent, then scheduled payments, then what the category is expected to use. A striped tail shows how far past its limit a category will go.</p>
                    ) : (
                      <p>
                        {progress.state === 'current' && 'The dashed line is today. A bar that reaches past it is spending faster than the month is passing. '}
                        {budgetData.some((item) => item.limit > 0 && item.spent > item.limit) && 'A striped tail shows how far a category went past its limit.'}
                      </p>
                    )}
                  </div>
                  <div className="bw-tools">
                    <input
                      type="search"
                      className="bw-input"
                      placeholder="Search categories"
                      aria-label="Search categories"
                      value={categorySearch}
                      onChange={(event) => setCategorySearch(event.target.value)}
                    />
                  </div>
                </div>

                <CategoryList
                  mode={mode}
                  items={listed}
                  progress={progress}
                  recurringByCategory={recurringByCategory}
                  formatCurrency={formatCurrency}
                  onOpen={(item) => loadCategoryTransactions(item.id, item.name)}
                  search={categorySearch}
                />
              </>
            )}
          </Box>
        )}

        {activeTab === 'setup' && (
          <Box display="grid" gap="inherit" role="tabpanel" id="budget-panel-setup" aria-labelledby="budget-tab-setup">
            <SetupPanel
              categories={categories}
              limits={budgetLimits}
              committedLimits={committedLimits}
              previousLimits={previousMonthLimits}
              recurringByCategory={recurringByCategory}
              search={categorySearch}
              onSearch={setCategorySearch}
              sortBy={setupSortBy}
              onSortBy={setSetupSortBy}
              onChange={handleLimitChange}
              onBlur={handleLimitBlur}
              onSave={saveBudget}
              saving={saving}
              dirty={dirty}
              monthName={monthWord}
              formatCurrency={formatCurrency}
            />
          </Box>
        )}
      </Box>

      <CategoryTransactionsDialog
        category={selectedCategory}
        item={budgetData.find(({ id }) => id === selectedCategory?.id)}
        transactions={categoryTransactions}
        loading={loadingTransactions}
        monthName={monthName}
        onClose={closeTransactionsModal}
        formatCurrency={formatCurrency}
      />
    </Box>
  );
}
