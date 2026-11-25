import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { prepareBankImport, confirmBankPostings } from '../../../frontend/src/lib/recurringBankImport.js';
import { matchesRecurringOccurrence } from '../../../frontend/src/lib/recurringAutoAdd.js';
import { getBudgetReview } from './assistant-budget.mjs';
import { recurringAuditReport } from './assistant-recurring-audit.mjs';
import { executeAssistantTool, getCategoryDrilldown, getRecurringDateAudit, getUpcomingPaymentsPlan, summarizeTransactions } from './assistant-data.mjs';

const userId = 'owner';
const today = '2026-11-25';
const category = { id: 'subscriptions', user_id: userId, name: 'Subscriptions', type: 'expense' };
const account = { id: 'main', user_id: userId, balance: 0 };
const plan = (id, date, amount, other = {}) => ({
  id, name: id, user_id: userId, category_id: category.id, is_active: true, type: 'expense',
  frequency: 'monthly', start_date: date, amount, ...other,
});
const posting = (id, date, amount, other = {}) => ({
  id, date, amount, type: 'expense', user_id: userId, account_id: account.id, category_id: category.id,
  description: id, category: { name: category.name }, recurring_payment_id: null, deleted_at: null, ...other,
});

// Use the real query builder, with read-only in-memory tables in place of the network.
function database(tables = {}, { bankImport = false, bankPostingColumn = true } = {}) {
  const sources = { categories: [category], accounts: [account], budgets: [], recurring_payments: [], transactions: [], ...tables };
  return createClient('https://ledger.test', 'publishable-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (url, init) => {
        assert.ok(init.method === 'GET' || (bankImport && init.method === 'PATCH'));

        const { pathname, searchParams } = new URL(url);
        const table = pathname.split('/').pop();
        assert.equal(searchParams.get('user_id'), 'eq.owner');
        if (!bankPostingColumn && searchParams.get('select')?.includes('recurring_bank_posting')) {
          return Response.json({code:'42703',message:'column transactions.recurring_bank_posting does not exist'}, { status:400 });
        }
        let rows = [...sources[table]];
        for (const [field, filter] of searchParams) {
          const dot = filter.indexOf('.');
          const op = filter.slice(0, dot);
          const value = filter.slice(dot + 1);
          if (field === 'or') {
            assert.match(filter, /date\.gte\.\d{4}-\d{2}-\d{2}/);
            const start = /date\.gte\.(\d{4}-\d{2}-\d{2})/.exec(filter)[1];
            rows = rows.filter(row => row.deleted_at || row.date >= start || (row.type === 'expense' && row.amount < 0));
          } else if (op === 'eq') rows = rows.filter(row => String(row[field]) === value);
          else if (op === 'is') rows = rows.filter(row => row[field] == null && value === 'null');
          else if (op === 'ilike') rows = rows.filter(row => row[field]?.toLowerCase() === value.toLowerCase());
          else if (op === 'gte') rows = rows.filter(row => row[field] >= value);
          else if (op === 'lte') rows = rows.filter(row => row[field] <= value);
        }
        if (searchParams.has('offset')) rows = rows.slice(Number(searchParams.get('offset')));
        if (searchParams.has('limit')) rows = rows.slice(0, Number(searchParams.get('limit')));
        if (init.method === 'PATCH') {
          const patch = JSON.parse(init.body);
          assert.deepEqual(Object.keys(patch), ['recurring_bank_posting']);
          for (const row of rows) Object.assign(row, patch);
        }
        return Response.json(rows);
      },
    },
  });
}

test('a recurring audit exposes the same dated expenses as the category filter, regardless of merchant wording', async () => {
  const rows = [
    posting('unfamiliar bank descriptor', '2026-11-01', -12.34),
    posting('generated', today, 7.55, { recurring_payment_id: 'schedule' }),
    posting('outside category', today, 50, { category_id: 'other' }),
    posting('income', today, 60, { type: 'income' }),
    posting('trashed', today, 20, { deleted_at: today }),
    posting('another user', today, 75, { user_id: 'other' }),
    posting('October', '2026-10-31', 1), posting('future', '2026-11-26', 1),
  ];
  const report = await getRecurringDateAudit(database({ transactions: rows }), userId, { month: '2026-11', category: category.name }, today);
  assert.equal(report.categoryId, category.id);
  assert.deepEqual([report.startDate, report.endDate, report.transactionCount, report.transactionTotal], ['2026-11-01', today, 2, 19.89]);
  assert.deepEqual(report.transactions.map(({ description, generated }) => [description, generated]), [
    ['generated', true], ['unfamiliar bank descriptor', false],
  ]);
});

test('legacy signed expenses keep their economic direction in summaries, rankings, and budget drilldown', async () => {
  const supabase = database({
    transactions: [posting('old expense', today, -100), posting('normal expense', today, 10), posting('income', today, 70, {type:'income'})],
    budgets: [{ id: 'b', user_id: userId, month: '2026-11-01', budget_categories: [{category_id:category.id,limit_amount:80}] }],
  });
  const { result } = await summarizeTransactions(supabase, userId, { start_date: '2026-11-01', end_date: today });
  assert.deepEqual([result.income, result.expenses, result.net], [70, 110, -40]);
  assert.deepEqual(result.top_expense_categories, [{name:'Subscriptions', amount:110}]);
  const review = await getBudgetReview(supabase, userId, '2026-11', category.name);
  assert.deepEqual([review.spending, review.over, review.top_expenses[0].amount], [110, 30, 100]);
  const details = await getCategoryDrilldown(supabase, userId, { category: category.name, startDate: '2026-11-01', endDate: today });
  assert.equal(details.total, 110);
  assert.equal(details.budgets[0].spent, 110);
  assert.equal(details.transactions.find(row => row.id === 'old expense').amount, 100);
});

test('today’s paid bill disappears from the upcoming list, totals, weekly bars, projection and payday check', async () => {
  const supabase = database({
    recurring_payments: [plan('Invoice', today, 120), plan('Salary', '2026-11-27', 500, {type:'income'})],
    transactions: [posting('paid', today, 120, { recurring_payment_id: 'Invoice' })],
  });
  const report = await getUpcomingPaymentsPlan(supabase, userId, { endDate: '2026-11-27' }, today);
  assert.deepEqual(report.payments.map(row => row.label), ['Salary']);
  assert.deepEqual([report.expenses, report.weeks[0].expense, report.projection.days[0].expenses], [0, 0, 0]);
  assert.equal(report.nextByType.expense, null);
  const { result } = await executeAssistantTool({ name:'get_payments_until_salary', supabase, userId, today, args:{available_amount:100} });
  assert.deepEqual([result.total_scheduled_expenses, result.difference, result.covers_scheduled_expenses], [0, 100, true]);
  assert.equal(result.salary_date, '2026-11-27');
});

test('a bank posting can settle an upcoming bill early, and a future-dated entry still counts once on the date recorded', async () => {
  const supabase = database({
    recurring_payments: [
      plan('First bill', '2026-11-26', 90, {match_description:'early bill'}),
      plan('Later bill', '2026-11-27', 120, {match_description:'late bill'}),
      plan('Cancelled bill', '2026-11-28', 70),
    ],
    transactions: [
      posting('early bill payment', today, -90), posting('late bill payment', '2026-11-28', -120),
      posting('cancelled', '2026-11-28', 70, {deleted_at:today, recurring_payment_id:'Cancelled bill'}),
    ],
    // The insert trigger added 90 and 120 for legacy signed rows, and subtracted 70 for the cancelled row.
    accounts: [{...account, balance:140}],
  });
  const endDate = '2026-11-30';
  const report = await getUpcomingPaymentsPlan(supabase, userId, { endDate }, today);
  assert.deepEqual(report.payments.map(({ label,date,amount }) => [label,date,amount]), [['Later bill','2026-11-28',120]]);
  assert.equal(report.expenses, 120);
  assert.equal(report.projection.startingBalance, -90);
  assert.equal(report.projection.days.at(-1).balance, -210);
  assert.equal(report.projection.days[3].movements.length, 1);
  assert.equal(report.projection.days[3].movements[0].source, 'recorded');
  const { result } = await executeAssistantTool({ name:'get_payments_until_salary', supabase, userId, today, args:{available_amount:100, end_date:endDate} });
  assert.equal(result.total_scheduled_expenses, 120);
  assert.deepEqual(result.scheduled_occurrences, [{name:'Later bill',date:'2026-11-28',amount:120}]);
  const scoped = await getUpcomingPaymentsPlan(supabase, userId, { startDate:'2026-11-26',endDate, type:'expense' }, today);
  assert.deepEqual(scoped.payments, report.payments);
});

test('the posting date comes from a separate transaction, even when auto-add created an entry for the due date', async () => {
  const monthly = plan('Vendor Cloud', '2026-11-24', 120, {match_description:'VENDOR'});
  const generated = posting('generated', '2026-11-24', 120, {recurring_payment_id:monthly.id});
  const audit = async (rows) => getRecurringDateAudit(database({recurring_payments:[monthly],transactions:rows}), userId,
    {month:'2026-11',category:category.name}, today);
  const pending = await audit([generated]);
  assert.equal(pending.counts.on_schedule, 0);
  assert.deepEqual([pending.rows[0].status, pending.rows[0].actualDate], ['generated_only', null]);
  const actual = await audit([generated, posting('VENDOR BILL', today, -120)]);
  assert.equal(actual.rows.length, 1);
  assert.deepEqual([actual.rows[0].status, actual.rows[0].actualDate, actual.rows[0].actualAmount], ['late', today, 120]);
});

test('a paused schedule retains recorded historical occurrences and does not invent missing charges for unverified dates', async () => {
  const paused = plan('Music plan','2026-11-02',20,{is_active:false,frequency:'weekly',match_description:'MUSIC SUB'});
  const rows = [
    posting('generated','2026-11-02',20,{recurring_payment_id:paused.id}),
    posting('MUSIC SUB','2026-11-03',20),
    posting('older occurrence after a rule change','2026-11-05',20,{recurring_payment_id:paused.id}),
  ];
  const report = await getRecurringDateAudit(database({recurring_payments:[paused],transactions:rows}),userId,
    {month:'2026-11',category:category.name},today);
  assert.equal(report.rows.find(row => row.expectedDate === '2026-11-02').status, 'late');
  assert.equal(report.rows.find(row => row.expectedDate === '2026-11-05').status, 'generated_only');
  assert.deepEqual([report.counts.activity_unknown, report.counts.missing, report.counts.unmatched], [3, 0, 0]);
});

test('confirmed bank import links a statement once, keeps the original ledger entry and supplies the date to the audit', async () => {
  const charge = plan('Cloud vendor', '2026-11-24', 120, { match_description: 'CLOUD BILL' });
  const original = posting('gen', '2026-11-24', 120, {
    recurring_payment_id: charge.id, recurring_payments: { match_description: 'CLOUD BILL' },
  });
  const data = { recurring_payments: [charge], transactions: [original] };
  const supabase = database(data, { bankImport: true });
  const row = { date: today, description: 'CLOUD BILL #100', amount: 120, type: 'expense', bank: 'Bank' };
  const prepared = await prepareBankImport(supabase, userId, [row]);
  assert.equal(original.recurring_bank_posting, undefined);
  assert.deepEqual([prepared.links.length, prepared.remaining.length, prepared.review.length], [1, 0, 0]);
  await confirmBankPostings(supabase, userId, prepared.links);
  await confirmBankPostings(supabase, userId, prepared.links);
  assert.deepEqual([data.transactions.length, original.date, original.amount], [1, '2026-11-24', 120]);
  const imported = await getRecurringDateAudit(supabase, userId, {month:'2026-11',category:category.name},today);
  assert.deepEqual([imported.rows[0].status, imported.rows[0].actualDate, imported.rows[0].matchSource], ['late',today,'bank_statement']);
  const replay = await prepareBankImport(supabase, userId, [row]);
  assert.deepEqual([replay.links.length, replay.remaining.length], [0, 0]);
  // The first copy is attested by the calendar row; an actual second copy must reach the normal insert.
  const double = await prepareBankImport(supabase, userId, [row, { ...row }]);
  assert.deepEqual([double.links.length, double.remaining.length, double.review.length], [0, 1, 0]);
  data.transactions.push(posting('extra', today, 120, {description:row.description, provider:'Bank'}));
  const doubleReplay = await prepareBankImport(supabase, userId, [row, { ...row }]);
  assert.deepEqual([doubleReplay.links.length, doubleReplay.remaining.length], [0, 0]);
});

test('two plausible but distinct statement dates stay available for manual review; identical copies account for one occurrence only', async () => {
  const original = posting('g', '2026-11-24', 35, {
    recurring_payment_id: 'x', recurring_payments: {match_description:'Vendor'},
  });
  const row = {date:today, type:'expense', amount:35, description:'Vendor', bank:'Bank'};
  const db = database({transactions:[original]});
  const ambiguous = await prepareBankImport(db, userId, [row, {...row,date:'2026-11-26'}]);
  assert.deepEqual([ambiguous.links.length, ambiguous.review.length, ambiguous.remaining.length], [0, 2, 0]);
  assert.ok(ambiguous.reviewMessage);
  const double = await prepareBankImport(db, userId, [row, {...row}]);
  assert.deepEqual([double.links.length, double.review.length, double.remaining.length], [1, 0, 1]);
  const twoSchedules = database({transactions:[original, {...original,id:'another',recurring_payment_id:'other'}]});
  const unmatched = await prepareBankImport(twoSchedules, userId, [row]);
  assert.deepEqual([unmatched.links.length, unmatched.review.length], [0, 1]);
});

test('on the old schema a generated entry is readable and a bank row remains for review until its evidence can be saved', async () => {
  const charge = plan('Vendor', today, 20, {match_description:'Vendor'});
  const entry = posting('generated',today,20,{recurring_payment_id:charge.id,recurring_payments:{match_description:'Vendor'}});
  const db = database({recurring_payments:[charge],transactions:[entry]}, {bankPostingColumn:false});
  const result = await getRecurringDateAudit(db, userId, {month:'2026-11',category:category.name},today);
  assert.equal(result.rows[0].status, 'generated_only');
  const upcoming = await getUpcomingPaymentsPlan(db, userId, {endDate:today}, today);
  assert.equal(upcoming.expenses, 0);
  const imported = await prepareBankImport(db, userId, [posting('Vendor',today,20)]);
  assert.deepEqual([imported.review.length, imported.links.length], [1, 0]);
  assert.match(imported.reviewMessage, /migration/);
});

test('four statement calendar days across the November daylight-saving change match a configured recurring occurrence', () => {
  assert.equal(matchesRecurringOccurrence(
    { date:'2026-11-03', type:'expense', amount:-50, description:'Payment SHOP' },
    {type:'expense',amount:50,match_description:'SHOP'}, '2026-10-30',
  ), true);
});

test('a second statement charge with the same product description is shown beside the one scheduled payment', async () => {
  const subscription = plan('Oriole Pro', '2026-11-08', 24.50);
  const receipt = 'LATTICE* ORIOLE SUB';
  const supplemental = 'at ' + receipt;
  const report = await getRecurringDateAudit(database({
    recurring_payments: [subscription],
    transactions: [
      posting('November base', '2026-11-08', 24.19, {description:receipt}),
      posting('November additional', '2026-11-10', -77.65, {description:supplemental}),
      posting('different product', '2026-11-10', 43.02, {description:'LATTICE* ORIOLE API USAGE'}),
      posting('plain processor', '2026-11-12', 35, {description:'at LATTICE* MERCHANT STORE'}),
      posting('outside report', '2026-10-31', 77.65, {description:receipt}),
    ],
  }), userId, {month:'2026-11', category:category.name}, today);
  const row = report.rows[0];
  assert.deepEqual([row.name,row.status,row.expectedDate,row.actualDate,row.actualAmount,row.description],
    [subscription.name,'on_schedule','2026-11-08','2026-11-08',24.19,receipt]);
  assert.deepEqual(row.relatedCharges, [{description:supplemental,date:'2026-11-10',amount:77.65}]);
  assert.deepEqual([row.totalPostedAmount,row.differenceFromPlan,report.relatedChargeCount], [101.84,77.34,1]);
  assert.deepEqual([report.counts.on_schedule,report.counts.unmatched,report.rowCount], [1,2,3]);
  const page = recurringAuditReport({}, [...report.rows.slice(1),row], 1);
  assert.deepEqual([page.rows[0].name,page.relatedChargeCount,page.omittedRows], [subscription.name,1,2]);
});

test('a lone distinctive charge with a materially different amount is a candidate, not a verified date', async () => {
  const receipt = 'LATTICE* ORIOLE SUB';
  const charge = posting('statement', '2026-11-10', 77.65, {description:receipt});
  for (const match_description of [null,receipt]) {
    const report = await getRecurringDateAudit(database({
      recurring_payments:[plan('Oriole Pro','2026-11-08',24.50,{match_description})],
      transactions:[charge],
    }), userId, {month:'2026-11',category:category.name}, today);
    assert.deepEqual([report.rows.length,report.counts.amount_mismatch,report.counts.late], [1,1,0]);
    const [row] = report.rows;
    assert.deepEqual([row.actualDate,row.differenceDays,row.expectedAmount,row.actualAmount,row.description],
      ['2026-11-10',null,24.50,77.65,receipt]);
    assert.equal(row.relatedCharges,undefined);
  }
});

test('a bare issuer asks about ChatGPT while keeping both bank charges and the matched date intact', async () => {
  const schedule = plan('ChatGPT Plus', '2026-11-04', 45);
  const branded = posting('plan-charge', '2026-11-05', 44.70, { description: 'OPENAI *CHATGPT SUBSCR' });
  const bare = posting('issuer-only', '2026-11-04', 11.25, { description: 'at OPENAI' });
  const audit = (payments, transactions) => getRecurringDateAudit(database({ recurring_payments: payments, transactions }),
    userId, { month: '2026-11', category: category.name }, today);
  const report = await audit([schedule], [branded, bare]);
  assert.deepEqual([report.counts.late, report.counts.company_candidate, report.counts.unmatched, report.relatedChargeCount], [1,1,0,0]);
  assert.deepEqual([report.transactionCount, report.transactionTotal], [2,55.95]);
  const question = report.rows.find((row) => row.status === 'company_candidate');
  assert.deepEqual([question.company, question.transactionId, question.actualAmount], ['OpenAI','issuer-only',11.25]);
  assert.deepEqual(question.companyCandidates, [{ scheduleId: schedule.id, name: 'ChatGPT Plus', expectedDate: '2026-11-04',
    expectedAmount: 45, actualDate:'2026-11-05', actualAmount:44.70, description:branded.description }]);
  assert.match(question.reviewKey, /^[a-f0-9]{64}$/);
  assert.equal(report.rows.find((row) => row.status === 'late').relatedCharges, undefined);
  assert.equal(recurringAuditReport({}, report.rows, 1).rows[0].id, question.id);
  const keyFor = async (payments, transactions) => (await audit(payments, transactions)).rows.find((row) => row.companyCandidates)?.reviewKey;
  assert.equal(await keyFor([schedule], [bare, branded]), question.reviewKey);
  assert.notEqual(await keyFor([schedule], [branded, { ...bare, amount: 15 }]), question.reviewKey);
  assert.notEqual(await keyFor([schedule], [{ ...branded, amount: 44.80 },bare]), question.reviewKey);
});

test('a company-only charge offers the eligible product schedules even without a prior bank match', async () => {
  const eligible = [plan('ChatGPT Plus','2026-11-03',15,{match_description:'OpenAI'}),
    plan('ChatGPT Team','2026-11-10',120), plan('OpenAI API','2026-11-12',40)];
  const report = await getRecurringDateAudit(database({
    recurring_payments: [...eligible, plan('ChatGPT Pro','2026-11-04',15,{is_active:false}),
      plan('Claude Pro','2026-11-03',15),plan('ChatGPT Business','2026-10-03',15,{end_date:'2026-10-04'})],
    transactions: [posting('issuer-only','2026-11-03',15,{description:'OPENAI, INC.'}),
      posting('other-category','2026-11-03',11,{description:'OPENAI',category_id:'something-else'})],
  }),userId,{month:'2026-11',category:category.name},today);
  const question = report.rows.find((row) => row.status === 'company_candidate');
  assert.deepEqual(question.companyCandidates.map((item) => [item.scheduleId,item.actualDate,item.actualAmount]),
    eligible.map((schedule) => [schedule.id,null,null]));
  assert.deepEqual([report.counts.on_schedule, report.counts.company_candidate, report.transactionCount], [0,1,1]);
});

test('distinctive matched vendor prefixes can suggest a company, but processors and explicit service descriptions cannot', async () => {
  const report = await getRecurringDateAudit(database({
    recurring_payments: [plan('Oriole Pro','2026-11-09',10), plan('ChatGPT Plus','2026-11-07',70),
      plan('Fictional Studio','2026-11-10',20)],
    transactions: [
      posting('brand evidence','2026-11-09',10,{description:'LATTICE* ORIOLE SUB'}),
      posting('vendor only','2026-11-12',22,{description:'at LATTICE'}),
      posting('processor evidence','2026-11-10',20,{description:'STRIPE* FICTIONAL STUDIO'}),
      ...['STRIPE','NOTOPENAI','OPENAI API','OPENAI* MIDI STUDIO','LATTICE* OTHER APP'].map((description) =>
        posting(description, '2026-11-08',22,{ description })),
    ],
  }),userId,{month:'2026-11',category:category.name},today);
  assert.deepEqual(report.rows.filter((row) => row.companyCandidates).map((row) => [row.transactionId,row.companyCandidates[0].name]),
    [['vendor only','Oriole Pro']]);
  assert.deepEqual([report.counts.on_schedule,report.counts.company_candidate,report.counts.unmatched], [2,1,5]);
});

test('an issuer keyword does not turn another product or a different explicit plan into a scheduled subscription', async () => {
  for (const [match_description, description] of [
    ['OPENAI', 'OPENAI API'], ['OPENAI', 'OPENAI *OTHER SERVICE'],
    ['OPENAI CHATGPT', 'OPENAI *CHATGPT TEAM SUB'], ['OPENAI CHATGPT', 'OPENAI *CHATGPT API'],
  ]) {
    const report = await getRecurringDateAudit(database({
      recurring_payments: [plan('ChatGPT Plus', '2026-11-06', 15, { match_description })],
      transactions: [posting('other-plan','2026-11-06',15,{ description })],
    }),userId,{month:'2026-11',category:category.name},today);
    assert.deepEqual([report.counts.on_schedule,report.counts.company_candidate,report.counts.unmatched], [0,0,1], description);
  }
});

test('generic merchant wording and conflicting plans never acquire another posted charge', async () => {
  const recurring_payments = [plan('Amazon','2026-11-03',10),plan('Oriole Pro','2026-11-08',25),plan('Oriole Plus','2026-11-09',90)];
  const report = await getRecurringDateAudit(database({
    recurring_payments, transactions: [
      posting('amazon primary','2026-11-03',10,{description:'AMAZON.CA'}),
      posting('amazon secondary','2026-11-04',68,{description:'at AMAZON.CA'}),
      posting('small','2026-11-08',25,{description:'LATTICE* ORIOLE SUB'}),
      posting('larger','2026-11-09',90,{description:'LATTICE* ORIOLE SUB'}),
      posting('third','2026-11-12',43,{description:'at LATTICE* ORIOLE SUB'}),
    ],
  }), userId, {month:'2026-11',category:category.name}, today);
  assert.equal(report.relatedChargeCount,0);
  assert.equal(report.rows.find(row => row.id === 'actual:amazon secondary').status,'unmatched');
  assert.equal(report.rows.find(row => row.id === 'actual:third').status,'ambiguous');
  assert.equal(report.counts.on_schedule,3);
});

test('an explicitly different plan or API service cannot pay a subscription solely by matching the name and amount', async () => {
  for (const description of ['LATTICE* ORIOLE TEAM SUB', 'LATTICE* ORIOLE API SUB']) {
    const report = await getRecurringDateAudit(database({
      recurring_payments:[plan('Oriole Pro','2026-11-08',25)],
      transactions:[posting('same price','2026-11-08',25,{description})],
    }),userId,{month:'2026-11',category:category.name},today);
    assert.deepEqual([report.counts.missing,report.counts.unmatched,report.counts.on_schedule,report.relatedChargeCount], [1,1,0,0]);
  }
});

test('several outliers without a primary match remain ambiguous and charges from adjacent months stay separate', async () => {
  const subscription = plan('Oriole Pro', '2026-11-02',24.50);
  const receipt = 'LATTICE* ORIOLE SUB';
  const report = await getRecurringDateAudit(database({
    recurring_payments:[subscription],transactions:[
      posting('prior purchase','2026-10-31',24.50,{description:receipt}),
      posting('november excess','2026-11-04',80,{description:receipt}),
    ],
  }),userId,{month:'2026-11',category:category.name},today);
  assert.equal(report.relatedChargeCount,0);
  assert.equal(report.rows.find(row => row.id === 'actual:november excess').status,'unmatched');
  const ambiguous = await getRecurringDateAudit(database({
    recurring_payments:[subscription],transactions:[
      posting('new one','2026-11-03',40,{description:receipt}),
      posting('new two','2026-11-04',80,{description:receipt}),
    ],
  }),userId,{month:'2026-11',category:category.name},today);
  assert.deepEqual([ambiguous.relatedChargeCount,ambiguous.counts.ambiguous,ambiguous.counts.amount_mismatch],[0,3,0]);
});
