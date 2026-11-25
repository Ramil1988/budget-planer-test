import { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Heading, Spinner } from '@chakra-ui/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { notifyNewTransaction, checkBudgetAndNotify } from '../lib/notifications';
import { today } from '../lib/transactionView';
import '../styles/ledger.css';
import '../styles/transactions.css';

/**
 * AddTransaction - Page for manually adding income or expense transactions
 */
export default function AddTransaction() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  // The day here, not in UTC: in the evening those are different dates.
  const [date, setDate] = useState(() => today());

  // Data state
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      loadCategories();
    }
  }, [user]);

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
      <Box className="bw-surface bw-page">
        <Box className="bw-layout tx-add">
          <div className="bw-status" role="status">
            <Spinner size="sm" color="currentColor" />
            Loading…
          </div>
        </Box>
      </Box>
    );
  }

  const kind = type === 'income' ? 'income' : 'expense';
  const counts = {
    expense: categories.filter((c) => c.type === 'expense').length,
    income: categories.filter((c) => c.type === 'income').length,
  };

  return (
    <Box className="bw-surface bw-page">
      <Box className="bw-layout tx-add">
        <header className="bw-masthead">
          <div>
            <Heading as="h1" className="bw-title">Add transaction</Heading>
            <p className="bw-subtitle">Record income or an expense by hand</p>
          </div>
          <RouterLink className="bw-link" to="/transactions">Back to transactions</RouterLink>
        </header>

        {success && <p className="bw-note" role="status">{success}</p>}
        {error && <p className="bw-note" data-tone="bad" role="alert">{error}</p>}

        <form className="bw-panel bw-form" onSubmit={handleSubmit} noValidate>
          <div className="bw-segment bw-segment--wide" role="group" aria-label="Type">
            {[['expense', 'Expense'], ['income', 'Income']].map(([value, label]) => (
              <button
                type="button"
                aria-pressed={type === value}
                onClick={() => {
                  setType(value);
                  setCategoryId(''); // The categories of the other type do not apply.
                }}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bw-field">
            <label htmlFor="add-amount">Amount</label>
            <input
              id="add-amount"
              className="bw-input tx-add__amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="bw-field">
            <label htmlFor="add-category">Category</label>
            {filteredCategories.length > 0 ? (
              <select id="add-category" className="bw-select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Choose a category</option>
                {filteredCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
              </select>
            ) : (
              <p className="bw-note" data-tone="bad">
                There are no {kind} categories yet. <RouterLink className="bw-link" to="/categories">Add one in Categories</RouterLink> first.
              </p>
            )}
          </div>

          <div className="bw-field">
            <label htmlFor="add-description">Description, if any</label>
            <input
              id="add-description"
              className="bw-input"
              placeholder={type === 'income' ? 'Monthly salary' : 'Grocery shopping'}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="bw-field">
            <label htmlFor="add-date">Date</label>
            <input id="add-date" className="bw-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>

          <button type="submit" className="bw-button bw-button--wide" disabled={submitting}>
            {submitting ? 'Adding…' : `Add ${kind}`}
          </button>
        </form>

        <p className="tx-add__counts">
          {counts.expense} expense {counts.expense === 1 ? 'category' : 'categories'}, {counts.income} income {counts.income === 1 ? 'category' : 'categories'}.{' '}
          <RouterLink className="bw-link" to="/categories">Manage categories</RouterLink>
        </p>
      </Box>
    </Box>
  );
}
