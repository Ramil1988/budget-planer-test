/**
 * Notification Service for BudgetWise
 * Handles browser notifications for budget alerts and transactions
 */

// Check if notifications are supported
export const isNotificationSupported = () => {
  return 'Notification' in window;
};

// Check current permission status
export const getNotificationPermission = () => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported in this browser');
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  // Request permission
  const permission = await Notification.requestPermission();
  return permission;
};

// Show a notification
export const showNotification = async (title, options = {}) => {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported');
    alert(`${title}\n${options.body || ''}`); // Fallback to alert
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Cannot show notification - permission not granted');
    alert(`${title}\n${options.body || ''}`); // Fallback to alert
    return null;
  }

  const defaultOptions = {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    ...options
  };

  try {
    // Try using service worker first (better for PWA)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, defaultOptions);
      console.log('Notification sent via service worker');
      return true;
    }

    // Fallback to regular Notification API
    const notification = new Notification(title, defaultOptions);
    console.log('Notification sent via Notification API');

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);

    return notification;
  } catch (error) {
    console.error('Error showing notification:', error);
    // Fallback to alert if notification fails
    alert(`${title}\n${options.body || ''}`);
    return null;
  }
};

// Notification for new transaction
export const notifyNewTransaction = (transaction, categoryName) => {
  const { amount, type, description } = transaction;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);

  const title = type === 'expense' ? 'New Expense Added' : 'New Income Added';
  const icon = type === 'expense' ? '💸' : '💰';

  showNotification(title, {
    body: `${icon} ${formattedAmount} - ${categoryName}\n${description || 'No description'}`,
    tag: 'transaction-' + Date.now()
  });
};

// Notification for budget limit approaching
export const notifyBudgetLimit = (categoryName, spent, limit, percentUsed) => {
  const formattedSpent = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(spent);

  const formattedLimit = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(limit);

  let title, body, urgency;

  if (percentUsed >= 100) {
    title = '🚨 Budget Exceeded!';
    body = `${categoryName}: ${formattedSpent} / ${formattedLimit} (${Math.round(percentUsed)}%)`;
    urgency = 'critical';
  } else if (percentUsed >= 90) {
    title = '⚠️ Budget Almost Reached!';
    body = `${categoryName}: ${formattedSpent} / ${formattedLimit} (${Math.round(percentUsed)}%)`;
    urgency = 'high';
  } else if (percentUsed >= 80) {
    title = '📊 Budget Alert';
    body = `${categoryName} is at ${Math.round(percentUsed)}% of limit\n${formattedSpent} / ${formattedLimit}`;
    urgency = 'medium';
  } else {
    // Don't notify if under 80%
    return;
  }

  showNotification(title, {
    body,
    tag: 'budget-' + categoryName, // Prevents duplicate notifications for same category
    renotify: true
  });
};

// Check budget status and notify if needed
export const checkBudgetAndNotify = async (supabase, userId, categoryId, newTransactionAmount) => {
  try {
    // Get current month
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

    // Get category name
    const { data: category } = await supabase
      .from('categories')
      .select('name')
      .eq('id', categoryId)
      .single();

    if (!category) return;

    // Get budget limit for this category
    const { data: budgetData } = await supabase
      .from('budgets')
      .select(`
        id,
        budget_categories (
          category_id,
          limit_amount
        )
      `)
      .eq('user_id', userId)
      .gte('month', startDate)
      .lt('month', `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`)
      .maybeSingle();

    if (!budgetData?.budget_categories) return;

    const categoryBudget = budgetData.budget_categories.find(bc => bc.category_id === categoryId);
    if (!categoryBudget || !categoryBudget.limit_amount) return;

    const limit = categoryBudget.limit_amount;

    // Get total spent in this category this month
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .eq('type', 'expense')
      .gte('date', startDate)
      .lte('date', endDate);

    const totalSpent = (transactions || []).reduce((sum, t) => sum + Number(t.amount), 0);
    const percentUsed = (totalSpent / limit) * 100;

    // Notify if approaching or exceeding limit
    notifyBudgetLimit(category.name, totalSpent, limit, percentUsed);

  } catch (error) {
    console.error('Error checking budget:', error);
  }
};
