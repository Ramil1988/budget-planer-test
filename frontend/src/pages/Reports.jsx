import { useState, useEffect } from 'react';
import { Box, Heading, IconButton, Spinner } from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { MONTH_NAMES as MONTHS, averageMonth, rankCategories, withRunningTotal, yearSummary } from '../lib/reportView';
import YearChart from '../components/reports/YearChart';
import RunningChart from '../components/reports/RunningChart';
import ExpenseTreemap from '../components/reports/ExpenseTreemap';
import CategoryHeatmap from '../components/reports/CategoryHeatmap';
import CategoryRanking from '../components/reports/CategoryRanking';
import MonthTable from '../components/reports/MonthTable';
import '../styles/ledger.css';
import '../styles/reports.css';

// The earliest year the app has records for.
const FIRST_YEAR = 2025;

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [totals, setTotals] = useState({ income: 0, expenses: 0, balance: 0 });
  const [pinnedBarMonth, setPinnedBarMonth] = useState(null);
  const [previewBarMonth, setPreviewBarMonth] = useState(null);
  const [incomeCategoryData, setIncomeCategoryData] = useState([]);

  // From the first year with records to this one, newest first.
  const thisYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, index) => thisYear - index);
  const changeYear = (year) => {
    if (!yearOptions.includes(year)) return;
    setSelectedYear(year);
    setPinnedBarMonth(null);
    setPreviewBarMonth(null);
  };

  useEffect(() => {
    if (user) {
      loadYearlyData();
    }
  }, [user, selectedYear]);

  const loadYearlyData = async () => {
    setLoading(true);
    try {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      // Load transactions with categories
      const { data, error } = await supabase
        .from('transactions')
        .select('date, amount, type, category_id, categories(name)')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

      // Initialize monthly data with category breakdowns
      const monthly = MONTHS.map((month, index) => ({
        month,
        monthIndex: index,
        income: 0,
        expenses: 0,
        balance: 0,
        incomeCategories: {}, // { categoryName: amount }
        expenseCategories: {}, // { categoryName: amount }
      }));

      // Category maps (for overall donut charts)
      const categoryMap = {};
      const incomeCategoryMap = {};

      // Aggregate transactions by month and category
      (data || []).forEach(tx => {
        const txDate = new Date(tx.date + 'T00:00:00');
        const monthIndex = txDate.getMonth();
        const catName = tx.categories?.name || 'Uncategorized';

        if (tx.type === 'income') {
          monthly[monthIndex].income += Number(tx.amount);
          monthly[monthIndex].incomeCategories[catName] =
            (monthly[monthIndex].incomeCategories[catName] || 0) + Number(tx.amount);
          incomeCategoryMap[catName] = (incomeCategoryMap[catName] || 0) + Number(tx.amount);
        } else {
          monthly[monthIndex].expenses += Number(tx.amount);
          monthly[monthIndex].expenseCategories[catName] =
            (monthly[monthIndex].expenseCategories[catName] || 0) + Number(tx.amount);
          categoryMap[catName] = (categoryMap[catName] || 0) + Number(tx.amount);
        }
      });

      // Calculate balance for each month
      monthly.forEach(m => {
        m.balance = m.income - m.expenses;
      });

      // Convert category map to sorted array and combine small categories into "Others"
      const sortedCategories = Object.entries(categoryMap)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);

      // Take top 5 and combine rest into "Others"
      let categoryArray;
      if (sortedCategories.length > 5) {
        const top5 = sortedCategories.slice(0, 5);
        const otherCategories = sortedCategories.slice(5);
        const othersAmount = otherCategories.reduce((sum, cat) => sum + cat.amount, 0);
        // Store the individual categories that make up "Others" for the breakdown
        categoryArray = [...top5, {
          name: 'Others',
          amount: othersAmount,
          otherCategories: otherCategories.filter(cat => cat.amount > 0)
        }];
      } else {
        categoryArray = sortedCategories;
      }

      // Calculate totals
      const totalIncome = monthly.reduce((sum, m) => sum + m.income, 0);
      const totalExpenses = monthly.reduce((sum, m) => sum + m.expenses, 0);

      // Convert income category map to sorted array
      const sortedIncomeCategories = Object.entries(incomeCategoryMap)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);

      let incomeCategoryArray;
      if (sortedIncomeCategories.length > 5) {
        const top5 = sortedIncomeCategories.slice(0, 5);
        const otherCategories = sortedIncomeCategories.slice(5);
        const othersAmount = otherCategories.reduce((sum, cat) => sum + cat.amount, 0);
        incomeCategoryArray = [...top5, {
          name: 'Others',
          amount: othersAmount,
          otherCategories: otherCategories.filter(cat => cat.amount > 0)
        }];
      } else {
        incomeCategoryArray = sortedIncomeCategories;
      }

      setMonthlyData(monthly);
      setCategoryData(categoryArray);
      setIncomeCategoryData(incomeCategoryArray);
      setTotals({
        income: totalIncome,
        expenses: totalExpenses,
        balance: totalIncome - totalExpenses,
      });
    } catch (err) {
      console.error('Error loading yearly data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyShort = (amount) => {
    if (Math.abs(amount) >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return formatCurrency(amount);
  };

  // Calculate additional metrics
  const monthsWithData = monthlyData.filter(m => m.income > 0 || m.expenses > 0).length;
  const avgMonthlyExpense = monthsWithData > 0 ? totals.expenses / monthsWithData : 0;
  const avgMonthlyIncome = monthsWithData > 0 ? totals.income / monthsWithData : 0;
  const savingsRate = totals.income > 0 ? ((totals.balance / totals.income) * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <Box className="bw-surface bw-page">
        <Box className="bw-layout">
          <div className="bw-status" role="status">
            <Spinner size="sm" color="currentColor" />
            Loading the report for {selectedYear}…
          </div>
        </Box>
      </Box>
    );
  }

  const months = withRunningTotal(monthlyData);
  const summary = yearSummary(monthlyData, totals, formatCurrency);
  const average = averageMonth(monthlyData);
  const expenseRanking = rankCategories(categoryData);
  const currentMonth = selectedYear === thisYear ? new Date().getMonth() : null;
  // The chart opens on the latest month with records; hovering previews, a click keeps.
  const latest = months.reduce((last, month, index) => (month.recorded ? index : last), null);
  const selectedMonth = previewBarMonth ?? pinnedBarMonth ?? latest;
  const stepButton = { variant: 'ghost', minW: '36px', h: '40px', color: 'var(--bw-muted)', _hover: { bg: 'var(--bw-hover)' } };

  return (
    <Box className="bw-surface bw-page">
      <Box className="bw-layout">
        <header className="bw-masthead">
          <div>
            <Heading as="h1" className="bw-title">Financial Report</Heading>
            <p className="bw-subtitle">
              {selectedYear}, {monthsWithData === 0 ? 'nothing recorded yet' : `${monthsWithData} ${monthsWithData === 1 ? 'month' : 'months'} recorded`}
            </p>
          </div>

          <div className="bw-month-control">
            <IconButton {...stepButton} aria-label="Go to previous year" disabled={selectedYear <= FIRST_YEAR} onClick={() => changeYear(selectedYear - 1)}>
              <FiChevronLeft />
            </IconButton>
            <select
              className="bw-select"
              style={{ border: 0, fontWeight: 600 }}
              aria-label="Year"
              value={selectedYear}
              onChange={(event) => changeYear(Number(event.target.value))}
            >
              {yearOptions.map((year) => <option value={year} key={year}>{year}</option>)}
            </select>
            <IconButton {...stepButton} aria-label="Go to next year" disabled={selectedYear >= thisYear} onClick={() => changeYear(selectedYear + 1)}>
              <FiChevronRight />
            </IconButton>
          </div>
        </header>

        <section className="bw-ledger" aria-label={`The year ${selectedYear}`}>
          <dl className="bw-figures">
            <div className="bw-figure bw-figure--lead">
              <dt>Net in {selectedYear}</dt>
              <dd data-tone={totals.balance < 0 ? 'bad' : 'good'}>{totals.balance > 0 ? '+' : ''}{formatCurrency(totals.balance)}</dd>
            </div>
            <div className="bw-figure">
              <dt>Income</dt>
              <dd>{formatCurrency(totals.income)}</dd>
              <small>about {formatCurrencyShort(avgMonthlyIncome)} a month</small>
            </div>
            <div className="bw-figure">
              <dt>Expenses</dt>
              <dd>{formatCurrency(totals.expenses)}</dd>
              <small>about {formatCurrencyShort(avgMonthlyExpense)} a month</small>
            </div>
            <div className="bw-figure">
              <dt>Savings rate</dt>
              <dd>{savingsRate}%</dd>
              <small>{totals.balance < 0 ? 'spent beyond income' : 'of income kept'}</small>
            </div>
          </dl>

          <div className="reports-summary">
            <p className="reports-summary__headline" data-tone={summary.tone}>{summary.headline}</p>
            {summary.detail && <p className="reports-summary__detail">{summary.detail}</p>}
          </div>

          <YearChart
            months={months}
            selected={selectedMonth}
            currentMonth={currentMonth}
            onSelect={setPinnedBarMonth}
            onPreview={setPreviewBarMonth}
            formatCurrency={formatCurrency}
          />
        </section>

        <div className="reports-pair">
          <RunningChart months={months} formatCurrency={formatCurrency} />
          {average && (
            <section className="bw-panel" aria-labelledby="reports-average-heading">
              <header className="reports-rank__head">
                <h2 id="reports-average-heading">An average month</h2>
                <span>over {average.months} {average.months === 1 ? 'month' : 'months'}</span>
              </header>
              <dl className="reports-average">
                <div><dt>Income</dt><dd>{formatCurrency(average.income)}</dd></div>
                <div><dt>Expenses</dt><dd>{formatCurrency(average.expenses)}</dd></div>
                <div>
                  <dt>Net</dt>
                  <dd data-tone={average.net < 0 ? 'bad' : 'good'}>{average.net > 0 ? '+' : ''}{formatCurrency(average.net)}</dd>
                </div>
                <div><dt>Most spent</dt><dd>{formatCurrency(average.most.expenses)}<small>{average.most.name}</small></dd></div>
                <div><dt>Least spent</dt><dd>{formatCurrency(average.least.expenses)}<small>{average.least.name}</small></dd></div>
              </dl>
            </section>
          )}
        </div>

        <div className="reports-pair">
          <ExpenseTreemap categories={expenseRanking} formatCurrency={formatCurrency} />
          <CategoryRanking
            kind="expenses"
            title="Where the money goes"
            categories={expenseRanking}
            total={totals.expenses}
            formatCurrency={formatCurrency}
          />
        </div>

        <div className="reports-pair">
          <CategoryHeatmap months={months} selected={selectedMonth} currentMonth={currentMonth} formatCurrency={formatCurrency} />
          <CategoryRanking
            kind="income"
            title="Where it comes from"
            categories={rankCategories(incomeCategoryData)}
            total={totals.income}
            formatCurrency={formatCurrency}
          />
        </div>

        <MonthTable months={months} totals={totals} selected={pinnedBarMonth} formatCurrency={formatCurrency} />
      </Box>
    </Box>
  );
}
