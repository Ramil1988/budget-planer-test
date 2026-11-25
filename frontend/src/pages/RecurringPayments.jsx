import { useState, useEffect } from 'react';
import { Box, Heading, IconButton, Input, Spinner } from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  getNextPaymentDate,
  getUpcomingPayments,
  getMonthlyProjection,
  FREQUENCY_CONFIG,
  MAX_FREQUENCY_INTERVAL,
  isValidFrequencyInterval,
} from '../lib/recurringUtils';
import { agendaDays, groupByDue, monthDays, withNextDue } from '../lib/recurringView';
import MonthStrip from '../components/recurring/MonthStrip';
import PaymentList from '../components/recurring/PaymentList';
import Agenda from '../components/recurring/Agenda';
import PaymentForm, { customSchedule } from '../components/recurring/PaymentForm';
import '../styles/ledger.css';
import '../styles/recurring.css';

// Current month as 'YYYY-MM' — the month the summary opens on.
const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

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
  const [selectedCategory, setSelectedCategory] = useState(null); // Category filter
  const [summaryMonth, setSummaryMonth] = useState(currentMonthKey); // Month the summary cards cover

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
    frequency_interval: 1,
    custom_frequency: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: '',
    business_days_only: false,
    last_business_day_of_month: false,
    auto_add: false,
    match_description: '',
  });

  // The day picked on the month strip, remembered with its month so another month starts fresh.
  const [pickedDay, setPickedDay] = useState(null);

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
    const frequency = formData.frequency === 'custom' ? formData.custom_frequency : formData.frequency;
    const interval = formData.frequency === 'custom' ? Number(formData.frequency_interval) : 1;
    if (!isValidFrequencyInterval(interval)) {
      setError(`Repeat interval must be a whole number from 1 to ${MAX_FREQUENCY_INTERVAL}.`);
      return;
    }
    setSaving(true);
    setError('');

    try {
      // Auto-add only ever generates from the day it was switched on, so enabling it on an
      // old recurring doesn't backfill months of history. Editing an already-auto payment
      // keeps the original date.
      const todayDate = new Date();
      const autoAddFrom = editingPayment?.auto_add && editingPayment.auto_add_from
        ? editingPayment.auto_add_from
        : `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

      const payload = {
        user_id: user.id,
        name: formData.name.trim(),
        amount: parseFloat(formData.amount),
        type: formData.type,
        category_id: formData.category_id || null,
        frequency,
        frequency_interval: interval,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        notes: formData.notes.trim() || null,
        is_active: true,
        business_days_only: formData.business_days_only,
        last_business_day_of_month: !!FREQUENCY_CONFIG[frequency]?.months && formData.last_business_day_of_month,
        auto_add: formData.auto_add,
        auto_add_from: formData.auto_add ? autoAddFrom : null,
        match_description: formData.match_description.trim() || null,
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
      frequency_interval: 1,
      custom_frequency: 'monthly',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      notes: '',
      business_days_only: false,
      last_business_day_of_month: false,
      auto_add: false,
      match_description: '',
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
      frequency: (payment.frequency_interval ?? 1) > 1 ? 'custom' : payment.frequency,
      ...customSchedule(payment.frequency, payment.frequency_interval ?? 1),
      start_date: payment.start_date,
      end_date: payment.end_date || '',
      notes: payment.notes || '',
      business_days_only: payment.business_days_only || false,
      last_business_day_of_month: payment.last_business_day_of_month || false,
      auto_add: payment.auto_add || false,
      match_description: payment.match_description || '',
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

  const formFrequency = formData.frequency === 'custom' ? formData.custom_frequency : formData.frequency;
  const formInterval = formData.frequency === 'custom' ? formData.frequency_interval : 1;
  const formNextDate = formData.start_date && isValidFrequencyInterval(formInterval)
    ? getNextPaymentDate(formData.start_date, formFrequency, new Date(), formData.end_date || null,
        formData.business_days_only, formData.last_business_day_of_month, formInterval)
    : null;

  // Filter categories by type
  const filteredCategories = categories.filter(c => c.type === formData.type);

  // Summary for the selected month: what actually falls in it, occurrence by
  // occurrence. A biweekly salary counts twice in most months and three times in
  // the months that hold a third payday, instead of showing a smoothed average
  // that matches no real month.
  const projection = getMonthlyProjection(recurringPayments, summaryMonth);
  const summary = {
    income: projection.income,
    expenses: projection.expenses,
    net: projection.net,
    incomeCount: projection.payments.filter(p => p.type === 'income').length,
    expenseCount: projection.payments.filter(p => p.type === 'expense').length,
  };

  const [summaryYear, summaryMonthNum] = summaryMonth.split('-').map(Number);
  const summaryMonthLabel = new Date(summaryYear, summaryMonthNum - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: summaryYear !== new Date().getFullYear() ? 'numeric' : undefined });

  const shiftSummaryMonth = (delta) => {
    const d = new Date(summaryYear, summaryMonthNum - 1 + delta, 1);
    setSummaryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

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
      <Box className="bw-surface bw-page">
        <Box className="bw-layout">
          <div className="bw-status" role="status">
            <Spinner size="sm" color="currentColor" />
            Loading recurring payments…
          </div>
        </Box>
      </Box>
    );
  }

  const active = recurringPayments.filter((payment) => payment.is_active);
  const bills = active.filter((payment) => payment.type === 'expense').length;
  const incomes = active.length - bills;
  const paused = recurringPayments.length - active.length;
  const onSchedule = active.length === 0
    ? 'Nothing is on a schedule yet'
    : [bills > 0 && plural(bills, 'bill', 'bills'), incomes > 0 && plural(incomes, 'income', 'incomes')].filter(Boolean).join(' and ');

  // The strip opens on today, or on the next day something moves.
  const days = monthDays(projection.payments, summaryMonth);
  const busy = days.filter((day) => day.payments.length > 0);
  const todayIndex = days.findIndex((day) => day.isToday);
  const opensOn = (busy.find((day) => day.day - 1 >= todayIndex) ?? busy[0])?.day ?? null;
  const shownDay = pickedDay?.month === summaryMonth ? pickedDay.day : opensOn;

  const groups = groupByDue(withNextDue(filteredPayments));
  const kind = activeTab === 'expense' ? 'expenses' : 'income';
  const stepButton = { variant: 'ghost', minW: '36px', h: '40px', color: 'var(--bw-muted)', _hover: { bg: 'var(--bw-hover)' } };

  return (
    <Box className="bw-surface bw-page">
      <Box className="bw-layout">
        <header className="bw-masthead">
          <div>
            <Heading as="h1" className="bw-title">Recurring Payments</Heading>
            <p className="bw-subtitle">
              {onSchedule}{active.length > 0 && ' on a schedule'}{paused > 0 && `, ${paused} paused`}
            </p>
          </div>

          <div className="recurring-actions">
            <div className="bw-month-control">
              <IconButton {...stepButton} aria-label="Go to previous month" onClick={() => shiftSummaryMonth(-1)}>
                <FiChevronLeft />
              </IconButton>
              <Input
                type="month"
                aria-label="Month shown"
                value={summaryMonth}
                onChange={(event) => event.target.value && setSummaryMonth(event.target.value)}
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
              <IconButton {...stepButton} aria-label="Go to next month" onClick={() => shiftSummaryMonth(1)}>
                <FiChevronRight />
              </IconButton>
            </div>
            <button type="button" className="bw-button" onClick={openCreateModal}>
              <FiPlus aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
              Add recurring
            </button>
          </div>
        </header>

        {success && <p className="bw-note" role="status">{success}</p>}
        {error && !isModalOpen && <p className="bw-note" data-tone="bad" role="alert">{error}</p>}

        <section className="bw-ledger" aria-label={`Recurring payments in ${summaryMonthLabel}`}>
          <dl className="bw-figures" data-count="3">
            <div className="bw-figure bw-figure--lead">
              <dt>Net in {summaryMonthLabel}</dt>
              <dd data-tone={summary.net < 0 ? 'bad' : 'good'}>{summary.net > 0 ? '+' : ''}{formatCurrency(summary.net)}</dd>
            </div>
            <div className="bw-figure">
              <dt>Income</dt>
              <dd>{formatCurrency(summary.income)}</dd>
              <small>{plural(summary.incomeCount, 'payment', 'payments')}</small>
            </div>
            <div className="bw-figure">
              <dt>Expenses</dt>
              <dd>{formatCurrency(summary.expenses)}</dd>
              <small>{plural(summary.expenseCount, 'payment', 'payments')}</small>
            </div>
          </dl>

          <MonthStrip
            days={days}
            selectedDay={shownDay}
            onSelect={(day) => setPickedDay({ month: summaryMonth, day })}
            formatCurrency={formatCurrency}
          />
        </section>

        <div className="bw-switches">
          <div className="bw-tabs" role="tablist" aria-label="Expenses or income">
            {[['expense', 'Expenses'], ['income', 'Income']].map(([value, label]) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === value}
                className="bw-tab"
                onClick={() => { setActiveTab(value); setSelectedCategory(null); }}
                key={value}
              >
                {label} ({recurringPayments.filter((payment) => payment.type === value && (showInactive || payment.is_active)).length})
              </button>
            ))}
          </div>

          <div className="bw-tools" style={{ marginBottom: 8 }}>
            {availableCategories.length > 0 && (
              <select
                className="bw-select"
                aria-label="Category"
                value={selectedCategory ?? ''}
                onChange={(event) => setSelectedCategory(event.target.value || null)}
              >
                <option value="">All categories</option>
                {availableCategories.map((name) => <option value={name} key={name}>{name}</option>)}
              </select>
            )}
            <button type="button" className="bw-button bw-button--quiet" aria-pressed={showInactive} onClick={() => setShowInactive(!showInactive)}>
              {showInactive ? 'Hide paused' : 'Show paused'}
            </button>
          </div>
        </div>

        {selectedCategory && filteredPayments.length > 0 && (
          // The total of the payments listed, not a slice of the month: a payment that is not
          // due in the month shown still belongs to its category.
          <p className="bw-note">
            {selectedCategory}: {plural(filteredPayments.length, 'payment', 'payments')},{' '}
            {formatCurrency(filteredPayments.reduce((sum, payment) => sum + Number(payment.amount), 0))} in total
          </p>
        )}

        <div className="recurring-columns">
          {groups.length > 0 ? (
            <PaymentList
              groups={groups}
              formatCurrency={formatCurrency}
              onToggle={handleToggleActive}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          ) : (
            <div className="bw-panel">
              <p className="bw-nothing">
                {selectedCategory ? `No recurring ${kind} in “${selectedCategory}”.` : `No recurring ${kind} yet.`}
              </p>
              <p className="bw-nothing" style={{ paddingTop: 0 }}>
                {selectedCategory ? (
                  <button type="button" className="bw-button bw-button--quiet" onClick={() => setSelectedCategory(null)}>Show all categories</button>
                ) : (
                  <button type="button" className="bw-button" onClick={openCreateModal}>Add the first one</button>
                )}
              </p>
            </div>
          )}

          <Agenda days={agendaDays(upcomingPayments)} formatCurrency={formatCurrency} />
        </div>
      </Box>

      <PaymentForm
        open={isModalOpen}
        editing={editingPayment}
        form={formData}
        onChange={setFormData}
        categories={filteredCategories}
        schedule={{ frequency: formFrequency, interval: formInterval, nextDate: formNextDate }}
        error={error}
        saving={saving}
        onSubmit={handleSubmit}
        onClose={closeModal}
      />
    </Box>
  );
}
