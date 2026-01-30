// Netlify Function: Budget Recommendations
// Analyzes historical spending data and provides actionable budget suggestions

import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role key for bypassing RLS
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

// Recommendation types
const RECOMMENDATION_TYPES = {
  UNDERFUNDED: 'underfunded',
  OVERFUNDED: 'overfunded',
  HIGH_VARIANCE: 'high_variance',
  NO_BUDGET: 'no_budget',
  TRENDING_UP: 'trending_up',
  POTENTIAL_SAVINGS: 'potential_savings', // New: discretionary category without recurring
};

// Priority levels
const PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Authenticate user from JWT token
    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Missing authorization token' }),
      };
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const userId = user.id;

    // Parse optional month parameter (format: YYYY-MM)
    // If not provided, defaults to current month
    const queryParams = event.queryStringParameters || {};
    const requestedMonth = queryParams.month; // e.g., "2026-02"

    // Query 1: Get monthly spending averages per category (last 6 months)
    // We'll calculate this manually since there's no RPC function
    let categorySpending;
    {
      // Fallback: Get transactions and calculate manually
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('category_id, amount, date, categories(id, name)')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .gte('date', sixMonthsAgoStr)
        .is('deleted_at', null);

      if (txError) throw txError;

      // Group transactions by category and month
      const categoryMonthlyData = {};

      (transactions || []).forEach(tx => {
        if (!tx.category_id || !tx.categories) return;

        const categoryId = tx.category_id;
        const categoryName = tx.categories.name;
        const month = tx.date.substring(0, 7); // YYYY-MM
        const amount = Math.abs(Number(tx.amount));

        if (!categoryMonthlyData[categoryId]) {
          categoryMonthlyData[categoryId] = {
            categoryId,
            categoryName,
            months: {},
          };
        }

        if (!categoryMonthlyData[categoryId].months[month]) {
          categoryMonthlyData[categoryId].months[month] = 0;
        }
        categoryMonthlyData[categoryId].months[month] += amount;
      });

      // Calculate statistics for each category
      categorySpending = Object.values(categoryMonthlyData).map(cat => {
        const monthlyAmounts = Object.values(cat.months);
        const monthsWithData = monthlyAmounts.length;

        if (monthsWithData === 0) {
          return {
            category_id: cat.categoryId,
            category_name: cat.categoryName,
            avg_monthly: 0,
            std_dev: 0,
            min_monthly: 0,
            max_monthly: 0,
            months_with_data: 0,
          };
        }

        const sum = monthlyAmounts.reduce((a, b) => a + b, 0);
        const avg = sum / monthsWithData;
        const min = Math.min(...monthlyAmounts);
        const max = Math.max(...monthlyAmounts);

        // Calculate standard deviation
        const squaredDiffs = monthlyAmounts.map(val => Math.pow(val - avg, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / monthsWithData;
        const stdDev = Math.sqrt(avgSquaredDiff);

        return {
          category_id: cat.categoryId,
          category_name: cat.categoryName,
          avg_monthly: Math.round(avg * 100) / 100,
          std_dev: Math.round(stdDev * 100) / 100,
          min_monthly: Math.round(min * 100) / 100,
          max_monthly: Math.round(max * 100) / 100,
          months_with_data: monthsWithData,
        };
      });

      // Also get recent 3 months vs prior 3 months for trend detection
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

      categorySpending = categorySpending.map(cat => {
        const monthEntries = Object.entries(categoryMonthlyData[cat.category_id]?.months || {})
          .sort((a, b) => b[0].localeCompare(a[0])); // Sort descending by month

        const recent3Months = monthEntries.slice(0, 3);
        const prior3Months = monthEntries.slice(3, 6);

        const recent3Avg = recent3Months.length > 0
          ? recent3Months.reduce((sum, [, amt]) => sum + amt, 0) / recent3Months.length
          : 0;
        const prior3Avg = prior3Months.length > 0
          ? prior3Months.reduce((sum, [, amt]) => sum + amt, 0) / prior3Months.length
          : 0;

        return {
          ...cat,
          recent_3_avg: Math.round(recent3Avg * 100) / 100,
          prior_3_avg: Math.round(prior3Avg * 100) / 100,
        };
      });
    }

    // Query 2: Get budget limits for the requested month (or current month if not specified)
    const now = new Date();
    let targetYear, targetMonth;

    if (requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth)) {
      // Use the requested month
      [targetYear, targetMonth] = requestedMonth.split('-').map(Number);
    } else {
      // Default to current month
      targetYear = now.getFullYear();
      targetMonth = now.getMonth() + 1;
    }

    const targetMonthStart = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const nextMonthStart = targetMonth === 12
      ? `${targetYear + 1}-01-01`
      : `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`;

    const { data: budgetData, error: budgetError } = await supabase
      .from('budgets')
      .select(`
        id,
        budget_categories (
          category_id,
          limit_amount,
          spent,
          categories (
            id,
            name
          )
        )
      `)
      .eq('user_id', userId)
      .gte('month', targetMonthStart)
      .lt('month', nextMonthStart)
      .maybeSingle();

    if (budgetError) throw budgetError;

    // Query 2b: Get NEXT month's budget limits
    const nextMonthYear = targetMonth === 12 ? targetYear + 1 : targetYear;
    const nextMonthNum = targetMonth === 12 ? 1 : targetMonth + 1;
    const nextNextMonthStart = nextMonthNum === 12
      ? `${nextMonthYear + 1}-01-01`
      : `${nextMonthYear}-${String(nextMonthNum + 1).padStart(2, '0')}-01`;

    const { data: nextMonthBudgetData, error: nextBudgetError } = await supabase
      .from('budgets')
      .select(`
        id,
        budget_categories (
          category_id,
          limit_amount,
          categories (
            id,
            name
          )
        )
      `)
      .eq('user_id', userId)
      .gte('month', nextMonthStart)
      .lt('month', nextNextMonthStart)
      .maybeSingle();

    if (nextBudgetError) throw nextBudgetError;

    // Build next month budget limits map
    const nextMonthLimits = {};
    if (nextMonthBudgetData?.budget_categories) {
      nextMonthBudgetData.budget_categories.forEach(bc => {
        if (!bc.category_id) return;
        nextMonthLimits[bc.category_id] = {
          limit: Number(bc.limit_amount || 0),
          name: bc.categories?.name || 'Unknown',
        };
      });
    }

    // Build budget limits map (limit only - we'll calculate spent from transactions)
    const budgetLimits = {};
    if (budgetData?.budget_categories) {
      budgetData.budget_categories.forEach(bc => {
        if (!bc.category_id) return;
        budgetLimits[bc.category_id] = {
          limit: Number(bc.limit_amount || 0),
          spent: 0, // Will be calculated from transactions below
          name: bc.categories?.name || 'Unknown',
        };
      });
    }

    // Calculate actual spent amounts from the target month's transactions
    const endOfTargetMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${new Date(targetYear, targetMonth, 0).getDate()}`;
    const { data: targetMonthTx, error: targetTxError } = await supabase
      .from('transactions')
      .select('category_id, amount')
      .eq('user_id', userId)
      .eq('type', 'expense')
      .gte('date', targetMonthStart)
      .lte('date', endOfTargetMonth)
      .is('deleted_at', null);

    if (targetTxError) throw targetTxError;

    // Sum up spent by category
    (targetMonthTx || []).forEach(tx => {
      if (tx.category_id && budgetLimits[tx.category_id]) {
        budgetLimits[tx.category_id].spent += Math.abs(Number(tx.amount || 0));
      }
    });

    // Query 3: Get recurring payments to identify categories with fixed costs
    // This query is optional - if the table doesn't exist or there's an error, we continue without it
    let recurringPayments = [];
    const categoriesWithRecurring = new Set();
    const recurringAmountsByCategory = {};
    const upcomingRecurringByCategory = {}; // Recurring payments remaining this month

    try {
      const { data, error: recurringError } = await supabase
        .from('recurring_payments')
        .select('category_id, amount, frequency, start_date, end_date, business_days_only, last_business_day_of_month')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('type', 'expense');

      if (!recurringError && data) {
        recurringPayments = data;
      }
    } catch (e) {
      // If recurring_payments table doesn't exist, continue without it
      console.log('Could not fetch recurring payments:', e.message);
    }

    // Helper function to calculate payment dates in a range (simplified version)
    const getPaymentDatesInRange = (startDate, frequency, rangeStart, rangeEnd, endDate) => {
      const dates = [];
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : null;
      const rStart = new Date(rangeStart);
      const rEnd = new Date(rangeEnd);

      // Get frequency interval in days
      let intervalDays = 30; // default monthly
      switch (frequency) {
        case 'weekly': intervalDays = 7; break;
        case 'biweekly': intervalDays = 14; break;
        case 'monthly': intervalDays = 30; break;
        case 'quarterly': intervalDays = 91; break;
        case 'yearly':
        case 'annually': intervalDays = 365; break;
      }

      // For monthly, use month-based calculation
      if (frequency === 'monthly') {
        let current = new Date(start);
        while (current <= rEnd) {
          if (current >= rStart && (!end || current <= end)) {
            dates.push(new Date(current));
          }
          current.setMonth(current.getMonth() + 1);
        }
      } else {
        // For other frequencies, use day-based calculation
        let current = new Date(start);
        while (current <= rEnd) {
          if (current >= rStart && (!end || current <= end)) {
            dates.push(new Date(current));
          }
          current.setDate(current.getDate() + intervalDays);
        }
      }

      return dates;
    };

    // Calculate recurring payments for the target month
    // For current month: remaining payments from today until end of month
    // For future months: all payments for the entire month
    const isCurrentMonth = targetYear === now.getFullYear() && targetMonth === (now.getMonth() + 1);
    const recurringStartDate = isCurrentMonth
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) // Today
      : new Date(targetYear, targetMonth - 1, 1); // Start of target month
    const endOfMonth = new Date(targetYear, targetMonth, 0); // End of target month

    // Build map of categories with their recurring payment amounts
    (recurringPayments || []).forEach(rp => {
      if (rp.category_id) {
        // Any active recurring payment means this category is not discretionary
        categoriesWithRecurring.add(rp.category_id);

        // Calculate monthly equivalent of recurring amount
        let monthlyAmount = Number(rp.amount);
        switch (rp.frequency) {
          case 'weekly':
            monthlyAmount *= 4.33;
            break;
          case 'biweekly':
            monthlyAmount *= 2.17;
            break;
          case 'yearly':
          case 'annually':
            monthlyAmount /= 12;
            break;
          case 'quarterly':
            monthlyAmount /= 3;
            break;
          // monthly is default, no change needed
        }
        recurringAmountsByCategory[rp.category_id] = (recurringAmountsByCategory[rp.category_id] || 0) + monthlyAmount;

        // Calculate upcoming/scheduled payments for the target month
        const upcomingDates = getPaymentDatesInRange(
          rp.start_date,
          rp.frequency,
          recurringStartDate,
          endOfMonth,
          rp.end_date
        );
        const upcomingAmount = upcomingDates.length * Number(rp.amount);
        if (upcomingAmount > 0) {
          upcomingRecurringByCategory[rp.category_id] = (upcomingRecurringByCategory[rp.category_id] || 0) + upcomingAmount;
        }
      }
    });

    // Generate recommendations
    const recommendations = [];
    const savingsOpportunities = []; // New: categories without recurring where savings are possible
    let potentialSavings = 0;
    let totalOverspending = 0; // Track total overspending to calculate needed savings
    const analyzedCategories = new Set();

    // First pass: identify total overspending (underfunded categories)
    for (const spending of categorySpending) {
      if (!spending.category_id || spending.months_with_data === 0) continue;
      const budget = budgetLimits[spending.category_id];
      if (budget && budget.limit > 0 && spending.avg_monthly > budget.limit * 1.2) {
        totalOverspending += (spending.avg_monthly - budget.limit);
      }
    }

    for (const spending of categorySpending) {
      if (!spending.category_id || spending.months_with_data === 0) continue;

      analyzedCategories.add(spending.category_id);
      const budget = budgetLimits[spending.category_id];
      const avgSpending = spending.avg_monthly;
      const stdDev = spending.std_dev;

      // Rule 4: No Budget Set - Category has spending but no budget limit
      if (!budget || budget.limit === 0) {
        if (avgSpending > 0) {
          const suggestedBudget = Math.ceil(avgSpending * 1.1); // 10% buffer
          recommendations.push({
            categoryId: spending.category_id,
            categoryName: spending.category_name,
            type: RECOMMENDATION_TYPES.NO_BUDGET,
            priority: PRIORITY.MEDIUM,
            currentBudget: 0,
            avgSpending: avgSpending,
            suggestedBudget: suggestedBudget,
            message: `You spend an average of $${avgSpending.toFixed(2)}/month on ${spending.category_name}, but have no budget set. Consider setting a limit of $${suggestedBudget}.`,
            stats: {
              min: spending.min_monthly,
              max: spending.max_monthly,
              stdDev: stdDev,
              monthsAnalyzed: spending.months_with_data,
            },
          });
        }
        continue;
      }

      const budgetLimit = budget.limit;

      // Rule 1: Underfunded - avgSpending > budgetLimit * 1.2
      if (avgSpending > budgetLimit * 1.2) {
        const suggestedBudget = Math.ceil(avgSpending * 1.05); // 5% buffer above average
        recommendations.push({
          categoryId: spending.category_id,
          categoryName: spending.category_name,
          type: RECOMMENDATION_TYPES.UNDERFUNDED,
          priority: PRIORITY.HIGH,
          currentBudget: budgetLimit,
          avgSpending: avgSpending,
          suggestedBudget: suggestedBudget,
          message: `You typically spend $${avgSpending.toFixed(2)}/month on ${spending.category_name}, but your budget is only $${budgetLimit.toFixed(2)}. Consider increasing to $${suggestedBudget}.`,
          stats: {
            min: spending.min_monthly,
            max: spending.max_monthly,
            stdDev: stdDev,
            monthsAnalyzed: spending.months_with_data,
          },
        });
        continue; // Don't add other recommendations for this category
      }

      // Rule 2: Overfunded - avgSpending < budgetLimit * 0.5
      if (avgSpending < budgetLimit * 0.5 && avgSpending > 0) {
        const suggestedBudget = Math.ceil(avgSpending * 1.2); // 20% buffer above average
        const savings = budgetLimit - suggestedBudget;
        potentialSavings += savings;
        recommendations.push({
          categoryId: spending.category_id,
          categoryName: spending.category_name,
          type: RECOMMENDATION_TYPES.OVERFUNDED,
          priority: PRIORITY.LOW,
          currentBudget: budgetLimit,
          avgSpending: avgSpending,
          suggestedBudget: suggestedBudget,
          message: `Your ${spending.category_name} budget of $${budgetLimit.toFixed(2)} is more than double your average spending of $${avgSpending.toFixed(2)}/month. Consider reducing to $${suggestedBudget} to reallocate $${savings.toFixed(2)}.`,
          stats: {
            min: spending.min_monthly,
            max: spending.max_monthly,
            stdDev: stdDev,
            monthsAnalyzed: spending.months_with_data,
          },
        });
      }

      // Rule 3: High Variance - stdDev > avgSpending * 0.5
      if (stdDev > avgSpending * 0.5 && avgSpending > 0 && spending.months_with_data >= 3) {
        const suggestedBuffer = Math.ceil(stdDev);
        const suggestedBudget = Math.ceil(avgSpending + suggestedBuffer);
        if (suggestedBudget > budgetLimit) {
          recommendations.push({
            categoryId: spending.category_id,
            categoryName: spending.category_name,
            type: RECOMMENDATION_TYPES.HIGH_VARIANCE,
            priority: PRIORITY.MEDIUM,
            currentBudget: budgetLimit,
            avgSpending: avgSpending,
            suggestedBudget: suggestedBudget,
            message: `Your ${spending.category_name} spending varies significantly ($${spending.min_monthly.toFixed(2)} - $${spending.max_monthly.toFixed(2)}). Consider a budget of $${suggestedBudget} to account for fluctuations.`,
            stats: {
              min: spending.min_monthly,
              max: spending.max_monthly,
              stdDev: stdDev,
              monthsAnalyzed: spending.months_with_data,
            },
          });
        }
      }

      // Rule 5: Trending Up - Compare last 3 months avg to prior 3 months
      if (spending.recent_3_avg && spending.prior_3_avg && spending.prior_3_avg > 0) {
        const trendPercent = ((spending.recent_3_avg - spending.prior_3_avg) / spending.prior_3_avg) * 100;
        if (trendPercent > 15) {
          const suggestedBudget = Math.ceil(spending.recent_3_avg * 1.1);
          if (suggestedBudget > budgetLimit) {
            recommendations.push({
              categoryId: spending.category_id,
              categoryName: spending.category_name,
              type: RECOMMENDATION_TYPES.TRENDING_UP,
              priority: PRIORITY.MEDIUM,
              currentBudget: budgetLimit,
              avgSpending: avgSpending,
              suggestedBudget: suggestedBudget,
              trendPercent: Math.round(trendPercent),
              message: `Your ${spending.category_name} spending has increased ${Math.round(trendPercent)}% over the last 3 months (from $${spending.prior_3_avg.toFixed(2)} to $${spending.recent_3_avg.toFixed(2)}/month). Consider adjusting your budget to $${suggestedBudget}.`,
              stats: {
                min: spending.min_monthly,
                max: spending.max_monthly,
                stdDev: stdDev,
                monthsAnalyzed: spending.months_with_data,
                recent3Avg: spending.recent_3_avg,
                prior3Avg: spending.prior_3_avg,
              },
            });
          }
        }
      }

    }

    // Helper function for formatting currency in messages
    const formatCurrency = (amount) => '$' + Math.round(amount).toLocaleString();

    // Rule 6: Potential Savings - Show remaining budget for categories WITHOUT recurring payments
    // Only show discretionary categories where user can choose to save
    for (const [categoryId, budget] of Object.entries(budgetLimits)) {
      if (budget.limit <= 0) continue;

      // Skip categories that have recurring payments - those are committed expenses
      if (categoriesWithRecurring.has(categoryId)) continue;

      const remaining = budget.limit - budget.spent;
      const availableToSave = remaining; // No recurring to subtract since we filtered them out

      // Only show if there's savings potential (at least $1)
      if (availableToSave >= 1) {
        const spending = categorySpending.find(s => s.category_id === categoryId);

        savingsOpportunities.push({
          categoryId,
          categoryName: budget.name,
          type: RECOMMENDATION_TYPES.POTENTIAL_SAVINGS,
          priority: availableToSave > 100 ? PRIORITY.MEDIUM : PRIORITY.LOW,
          currentBudget: budget.limit,
          spent: budget.spent,
          remaining,
          upcomingRecurring: 0,
          availableToSave,
          hasRecurring: false,
          message: `You have ${formatCurrency(remaining)} left in ${budget.name} this month. If you don't spend it all, you could save up to ${formatCurrency(availableToSave)}.`,
          stats: spending ? {
            avgSpending: spending.avg_monthly,
            monthsAnalyzed: spending.months_with_data,
          } : null,
        });
      }
    }

    // Sort savings opportunities by available to save amount (highest first)
    savingsOpportunities.sort((a, b) => b.availableToSave - a.availableToSave);

    // Sort recommendations by priority
    const priorityOrder = { [PRIORITY.HIGH]: 0, [PRIORITY.MEDIUM]: 1, [PRIORITY.LOW]: 2 };
    recommendations.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      // Secondary sort by difference between spending and budget
      const aDiff = Math.abs(a.avgSpending - a.currentBudget);
      const bDiff = Math.abs(b.avgSpending - b.currentBudget);
      return bDiff - aDiff;
    });

    // Get total categories count
    const { count: totalCategories } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'expense');

    // Calculate total potential savings from opportunities
    const totalSavingsOpportunity = savingsOpportunities.reduce(
      (sum, opp) => sum + opp.availableToSave, 0
    );

    // Add next month budget info to each recommendation
    const recommendationsWithNextMonth = recommendations.map(rec => ({
      ...rec,
      nextMonthBudget: nextMonthLimits[rec.categoryId]?.limit ?? null,
    }));

    // Add next month budget info to savings opportunities
    const savingsWithNextMonth = savingsOpportunities.map(opp => ({
      ...opp,
      nextMonthBudget: nextMonthLimits[opp.categoryId]?.limit ?? null,
    }));

    // Build response with separate sections
    const response = {
      recommendations: recommendationsWithNextMonth,  // Budget adjustments (underfunded, overfunded, etc.)
      savingsOpportunities: savingsWithNextMonth,  // Categories without recurring where savings possible
      summary: {
        totalCategories: totalCategories || 0,
        categoriesAnalyzed: analyzedCategories.size,
        issuesFound: recommendations.length,
        potentialSavings: Math.round(potentialSavings * 100) / 100,  // From overfunded categories
        savingsOpportunities: savingsOpportunities.length,  // Count of discretionary categories
        totalSavingsOpportunity: Math.round(totalSavingsOpportunity * 100) / 100,  // Total possible savings
        totalOverspending: Math.round(totalOverspending * 100) / 100,  // Total amount over budget
        categoriesWithRecurring: categoriesWithRecurring.size,
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('Budget recommendations error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
