/**
 * Test file for "Last Business Day of Month" feature
 * Run with: node --experimental-vm-modules recurringUtils.test.js
 */

import {
  getNextPaymentDate,
  getPaymentDatesInRange,
  getUpcomingPayments,
  getMonthlyProjection,
} from './recurringUtils.js';

// Helper to format date as YYYY-MM-DD
const fmt = (d) => d ? d.toISOString().split('T')[0] : 'null';
const dayName = (d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];

console.log('='.repeat(60));
console.log('TESTING: Last Business Day of Month Feature');
console.log('='.repeat(60));

// Test 1: Verify last business days for 2026
console.log('\n📅 TEST 1: Last Business Day for Each Month of 2026');
console.log('-'.repeat(50));

const expectedLastBizDays2026 = {
  0: 30,  // Jan 2026: 31st is Sat -> Fri 30th
  1: 27,  // Feb 2026: 28th is Sat -> Fri 27th
  2: 31,  // Mar 2026: 31st is Tue -> Tue 31st
  3: 30,  // Apr 2026: 30th is Thu -> Thu 30th
  4: 29,  // May 2026: 31st is Sun -> Fri 29th
  5: 30,  // Jun 2026: 30th is Tue -> Tue 30th
  6: 31,  // Jul 2026: 31st is Fri -> Fri 31st
  7: 31,  // Aug 2026: 31st is Mon -> Mon 31st
  8: 30,  // Sep 2026: 30th is Wed -> Wed 30th
  9: 30,  // Oct 2026: 31st is Sat -> Fri 30th
  10: 30, // Nov 2026: 30th is Mon -> Mon 30th
  11: 31, // Dec 2026: 31st is Thu -> Thu 31st
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let test1Pass = true;
for (let month = 0; month < 12; month++) {
  // Use getNextPaymentDate with lastBusinessDayOfMonth=true to get the last biz day
  const result = getNextPaymentDate(
    '2026-01-01', // start date (day doesn't matter)
    'monthly',
    new Date(2026, month, 1), // from first of each month
    null,
    false,
    true // lastBusinessDayOfMonth
  );

  const expectedDay = expectedLastBizDays2026[month];
  const actualDay = result.getDate();
  const pass = actualDay === expectedDay;

  if (!pass) test1Pass = false;

  console.log(
    `${pass ? '✅' : '❌'} ${monthNames[month]} 2026: ` +
    `Expected day ${expectedDay}, Got day ${actualDay} (${dayName(result)}, ${fmt(result)})`
  );
}
console.log(test1Pass ? '\n✅ TEST 1 PASSED' : '\n❌ TEST 1 FAILED');

// Test 2: getPaymentDatesInRange with lastBusinessDayOfMonth
console.log('\n📅 TEST 2: Payment Dates In Range (Jan-Mar 2026)');
console.log('-'.repeat(50));

const dates = getPaymentDatesInRange(
  '2026-01-01',
  'monthly',
  new Date(2026, 0, 1),  // Jan 1
  new Date(2026, 2, 31), // Mar 31
  null,
  false,
  true // lastBusinessDayOfMonth
);

console.log('Dates found:', dates.length);
const expectedDates = ['2026-01-30', '2026-02-27', '2026-03-31'];
let test2Pass = dates.length === 3;

dates.forEach((d, i) => {
  const actual = fmt(d);
  const expected = expectedDates[i];
  const pass = actual === expected;
  if (!pass) test2Pass = false;
  console.log(`${pass ? '✅' : '❌'} Date ${i + 1}: Expected ${expected}, Got ${actual} (${dayName(d)})`);
});
console.log(test2Pass ? '\n✅ TEST 2 PASSED' : '\n❌ TEST 2 FAILED');

// Test 3: Quarterly frequency
console.log('\n📅 TEST 3: Quarterly Last Business Day');
console.log('-'.repeat(50));

const quarterlyDates = getPaymentDatesInRange(
  '2026-01-01',
  'quarterly',
  new Date(2026, 0, 1),  // Jan 1
  new Date(2026, 11, 31), // Dec 31
  null,
  false,
  true // lastBusinessDayOfMonth
);

console.log('Quarterly dates found:', quarterlyDates.length);
const expectedQuarterly = ['2026-01-30', '2026-04-30', '2026-07-31', '2026-10-30'];
let test3Pass = quarterlyDates.length === 4;

quarterlyDates.forEach((d, i) => {
  const actual = fmt(d);
  const expected = expectedQuarterly[i];
  const pass = actual === expected;
  if (!pass) test3Pass = false;
  console.log(`${pass ? '✅' : '❌'} Q${i + 1}: Expected ${expected}, Got ${actual} (${dayName(d)})`);
});
console.log(test3Pass ? '\n✅ TEST 3 PASSED' : '\n❌ TEST 3 FAILED');

// Test 4: Yearly frequency
console.log('\n📅 TEST 4: Yearly Last Business Day');
console.log('-'.repeat(50));

const yearlyDates = getPaymentDatesInRange(
  '2026-01-01',
  'yearly',
  new Date(2026, 0, 1),
  new Date(2028, 11, 31),
  null,
  false,
  true
);

console.log('Yearly dates found:', yearlyDates.length);
// Jan 2026: 30th (Fri), Jan 2027: 29th (Fri), Jan 2028: 31st (Mon)
const expectedYearly = ['2026-01-30', '2027-01-29', '2028-01-31'];
let test4Pass = yearlyDates.length === 3;

yearlyDates.forEach((d, i) => {
  const actual = fmt(d);
  const expected = expectedYearly[i];
  const pass = actual === expected;
  if (!pass) test4Pass = false;
  console.log(`${pass ? '✅' : '❌'} Year ${2026 + i}: Expected ${expected}, Got ${actual} (${dayName(d)})`);
});
console.log(test4Pass ? '\n✅ TEST 4 PASSED' : '\n❌ TEST 4 FAILED');

// Test 5: getUpcomingPayments with mock data
console.log('\n📅 TEST 5: getUpcomingPayments Integration');
console.log('-'.repeat(50));

const mockPayments = [
  {
    id: '1',
    name: 'Government Loan',
    amount: 200,
    type: 'expense',
    frequency: 'monthly',
    start_date: '2026-01-01',
    end_date: null,
    is_active: true,
    business_days_only: false,
    last_business_day_of_month: true,
  },
  {
    id: '2',
    name: 'Regular Payment',
    amount: 100,
    type: 'expense',
    frequency: 'monthly',
    start_date: '2026-01-15',
    end_date: null,
    is_active: true,
    business_days_only: false,
    last_business_day_of_month: false,
  },
];

// Simulate being on Jan 28, 2026
const upcoming = getUpcomingPayments(mockPayments, 35); // 35 days ahead

console.log('Upcoming payments found:', upcoming.length);
let foundGovLoanJan = false;
let foundGovLoanFeb = false;

upcoming.forEach(p => {
  const dateStr = fmt(p.nextDate);
  console.log(`  - ${p.name}: ${dateStr} (${dayName(p.nextDate)})`);
  if (p.name === 'Government Loan' && dateStr === '2026-01-30') foundGovLoanJan = true;
  if (p.name === 'Government Loan' && dateStr === '2026-02-27') foundGovLoanFeb = true;
});

const test5Pass = foundGovLoanJan && foundGovLoanFeb;
console.log(test5Pass ? '\n✅ TEST 5 PASSED' : '\n❌ TEST 5 FAILED');
if (!foundGovLoanJan) console.log('  ❌ Missing: Government Loan on 2026-01-30');
if (!foundGovLoanFeb) console.log('  ❌ Missing: Government Loan on 2026-02-27');

// Test 6: Edge case - February leap year
console.log('\n📅 TEST 6: Leap Year February (2028)');
console.log('-'.repeat(50));

// 2028 is a leap year, Feb has 29 days
// Feb 29, 2028 is a Tuesday - so last biz day is Feb 29
const leapYearResult = getNextPaymentDate(
  '2028-01-01',
  'monthly',
  new Date(2028, 1, 1), // Feb 1, 2028
  null,
  false,
  true
);

const test6Pass = leapYearResult.getDate() === 29 && leapYearResult.getMonth() === 1;
console.log(
  `${test6Pass ? '✅' : '❌'} Feb 2028 (leap year): ` +
  `Expected 29, Got ${leapYearResult.getDate()} (${dayName(leapYearResult)}, ${fmt(leapYearResult)})`
);
console.log(test6Pass ? '\n✅ TEST 6 PASSED' : '\n❌ TEST 6 FAILED');

// Test 7: getMonthlyProjection
console.log('\n📅 TEST 7: Monthly Projection');
console.log('-'.repeat(50));

const projection = getMonthlyProjection(mockPayments, '2026-02');
console.log('February 2026 projection:');
console.log(`  Income: $${projection.income}`);
console.log(`  Expenses: $${projection.expenses}`);
console.log(`  Payments found: ${projection.payments.length}`);

projection.payments.forEach(p => {
  console.log(`    - ${p.name}: $${p.amount} on ${fmt(p.date)} (${dayName(p.date)})`);
});

// Should have Government Loan on Feb 27 and Regular Payment on Feb 15
const hasGovLoan = projection.payments.some(p => p.name === 'Government Loan' && p.date.getDate() === 27);
const hasRegular = projection.payments.some(p => p.name === 'Regular Payment' && p.date.getDate() === 15);
const test7Pass = hasGovLoan && hasRegular && projection.expenses === 300;

console.log(test7Pass ? '\n✅ TEST 7 PASSED' : '\n❌ TEST 7 FAILED');

// Summary
console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));
const allPassed = test1Pass && test2Pass && test3Pass && test4Pass && test5Pass && test6Pass && test7Pass;
console.log(`Test 1 (Monthly 2026):     ${test1Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 2 (Date Range):       ${test2Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 3 (Quarterly):        ${test3Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 4 (Yearly):           ${test4Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 5 (Upcoming):         ${test5Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 6 (Leap Year):        ${test6Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 7 (Projection):       ${test7Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log('='.repeat(60));
console.log(allPassed ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED');
console.log('='.repeat(60));
