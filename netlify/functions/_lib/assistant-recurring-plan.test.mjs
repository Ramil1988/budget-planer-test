import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecurringPlan, recurringPlanIntent } from './assistant-recurring-plan.mjs';

const today = '2026-11-25';
const scope = { category: 'Subscriptions', month: '2026-11', fromIndex: 2 };
const user = content => ({ role: 'user', content });
const assistant = content => ({ role: 'assistant', content });
const history = [user('Сверь Subscriptions за ноябрь 2026 с Recurring. Только сверка, без изменений в данных.'), assistant('Аудит')];
const initial = 'там где записей нет - создай их сам в Recurrings с датами как в транзакциях кроме Market 6.25 CAD, 14.80 CAD 22.90 CAD';
const confirmation = 'Да, создать ежемесячные Recurring для всех непарных списаний (исключая указанные Market).';
const rows = [
  ...[['Cloudlab Billing',17.35],['MARKET',8.45],['MARKET.CA',6.25],['MARKET.CA',14.80],['MARKET',22.90],['OTHER',6.25]]
    .map(([name,amount], i) => ({ status: 'unmatched', transactionId: 't'+i, actualDate: '2026-11-11', actualAmount: amount, name, description:name })),
  {status:'company_candidate', transactionId:'co', name:'at OPENAI',description:'at OPENAI',actualAmount:10.20},
  {status:'missing', name:'Google One'},
  {status:'on_schedule', name:'Claude Pro',relatedChargeCount:1},
  ...['late','possible','amount_mismatch'].map(status => ({
    status, scheduleId:status, transactionId:'p'+status, name:status, description:status, expectedDate:'2026-11-20', actualDate:'2026-11-21',
    actualAmount:33,expectedAmount:32,
  })),
];
const audit = { ...scope, rows, omittedRows:0 };
const planFor = (turns, ctx = scope) => recurringPlanIntent([...history,...turns],ctx,today);

test('a category and month reply resumes the pending creation request with its exclusions', () => {
  const initial = user('Создай недостающие расписания кроме Market 6.25 CAD');
  const request = recurringPlanIntent([initial], null, today);
  const answered = recurringPlanIntent([initial, assistant(request.clarify.ru), user('Subscriptions за ноябрь 2026')], null, today);
  assert.deepEqual(answered.scope, { month: '2026-11', question: 'Subscriptions за ноябрь 2026' });
  assert.equal(answered.create, true);
  assert.deepEqual(answered.exceptionTexts, ['Market 6.25 CAD']);
});

test('the follow-up request and old suggested reply read the same audit and keep just the three Market exceptions', () => {
  const pending = [user(initial), assistant('Могу создать Recurring. Пришлите список или подтвердите.')];
  const direct = planFor([user(initial)]);
  const accepted = planFor([...pending,user(confirmation)]);
  for (const intent of [direct,accepted,planFor([...pending,user('Да')])]) {
    assert.equal(intent.create,true);
    assert.equal(intent.update,false);
    assert.deepEqual(intent.scope,{month:'2026-11',category:'Subscriptions'});
    const plan = buildRecurringPlan(audit,intent);
    assert.deepEqual(plan.candidates.map(row => row.actualAmount),[17.35,8.45,6.25]);
    assert.deepEqual(plan.excluded.map(row => row.actualAmount),[6.25,14.80,22.90]);
    assert.ok(plan.candidates.every(row => row.frequency === 'monthly' && row.frequencyInterval === 1));
    assert.ok(!plan.candidates.some(({name}) => ['at OPENAI','Claude Pro','Google One'].includes(name)));
  }
});

test('creates and date corrections are separately scoped, and uncertain pairs never produce writes', () => {
  const direct = planFor([user('Создай отсутствующие подписки и исправь даты расписаний по этой сверке')]);
  assert.equal(direct.create,true);
  assert.equal(direct.update,true);
  const plan = buildRecurringPlan(audit,direct);
  assert.deepEqual(plan.candidates.filter(({kind}) => kind === 'update').map(({scheduleId}) => scheduleId),['late']);
  assert.equal(plan.candidates.find(row => row.kind === 'update').expectedAmount,32);
  assert.equal(plan.candidates.find(row => row.kind === 'update').transactionId,'plate');
  assert.equal(planFor([user('Update the Recurring dates to match the posted dates for the matched charges in this audit')]).create,false);
  assert.equal(planFor([user('Create monthly Recurring schedules for the unmatched charges in this audit')]).update,false);
});

test('read-only questions, cancellation, and a bare yes do not start changes', () => {
  for (const text of ['Только проверь связи с Recurring без изменений.', 'добавь транзакцию Subscriptions', 'Which subscription is late?', 'Да']) {
    assert.equal(planFor([user(text)]),null);
  }
  assert.equal(planFor([user('Отмена')]).cancelled,true);
  assert.equal(planFor([user('Создай отсутствующие Recurring только для проверки, без изменений в данных.')]),null);
});

test('missing exception detail asks only for the exception and never broadens an old choice silently', () => {
  const result = recurringPlanIntent([user(confirmation)],{...scope,fromIndex:0,historyTruncated:true},today);
  assert.ok(result.clarify && !result.exceptionTexts);
  const stale = planFor([user(initial),assistant('Recurring'),user('Отмена'),assistant('Recurring отменено'),user(confirmation)]);
  assert.ok(stale.clarify);
  const unrecognized = buildRecurringPlan(audit,planFor([user('Создай недостающие Recurring кроме Market больше 20 CAD')]));
  assert.ok(unrecognized.clarify);
  assert.deepEqual(unrecognized.candidates,[]);
});

test('explicitly scoped standalone requests can obtain a fresh audit; implicit/ambiguous periods ask for scope', () => {
  const result = recurringPlanIntent([user('Сверь транзакции Subscriptions за ноябрь 2026 с Recurring и добавь недостающие расписания')],null,today);
  assert.equal(result.scope.month,'2026-11');
  assert.match(result.scope.question,/Subscriptions/);
  assert.ok(recurringPlanIntent([user('Добавь недостающие расписания в Recurring')],null,today).clarify);
  assert.ok(recurringPlanIntent([user('Сверь Subscriptions за октябрь и ноябрь и добавь недостающие Recurring')],null,today).clarify);
});

test('multiple postings disagreeing about the same rule and truncated audits cannot create partial bulk writes', () => {
  const intent = planFor([user('Исправь расхождения дат в расписаниях')]);
  const earlier = {...rows.find(row => row.status === 'late'),transactionId:'previous',expectedDate:'2026-11-15'};
  assert.equal(buildRecurringPlan({...audit, rows:[earlier,...rows]},intent).candidates.length,0);
  assert.ok(buildRecurringPlan({...audit,omittedRows:1},intent).clarify);
});

test('targeting a particular schedule never proposes bulk updates', () => {
  const audited = {...audit,rows:[...rows, {...rows.find(row => row.status==='late'),scheduleId:'chat',transactionId:'chatTx',name:'ChatGPT Plus'}]};
  const plan = buildRecurringPlan(audited,planFor([user('Исправь дату ChatGPT Plus')]));
  assert.deepEqual(plan.candidates.map(row => row.scheduleId), ['chat']);
  for (const message of ['добавь Spotify','create recurring rent $120 monthly starting November 30','add a subscription']) {
    assert.equal(planFor([user(message)]),null);
    assert.equal(recurringPlanIntent([user(message)],null,today),null);
  }
  const narrower = buildRecurringPlan(audit,planFor([user('Создай недостающие Recurring для Spotify из этой сверки')]));
  assert.ok(narrower.manualSelection);
  assert.deepEqual(narrower.candidates,[]);
  assert.equal(planFor([user('Не создавай Recurring')]).cancelled,true);
});

test('the explicit audit buttons, a combined request with the single-r spelling and a different month produce scoped review', () => {
  for (const text of [
    'Создай ежемесячные расписания в Recurring для списаний без пары из этой сверки',
    'Исправь даты в Recurring по сопоставленным списаниям с расхождением дат',
    'найти отсутствующие recurings или несоответствия и завести их в recurings или исправить имеющиеся',
    'Create monthly Recurring schedules for the unmatched charges in this audit',
    'Update the Recurring dates to match the posted dates for the matched charges in this audit',
  ]) {
    const plan = buildRecurringPlan(audit,planFor([user(text)]));
    assert.ok(!plan.clarify,text);
    assert.ok(plan.candidates.length,text);
  }
  const october=planFor([user('Исправь даты в Recurring по этой сверке за октябрь 2026')]);
  assert.equal(october.scope.month,'2026-10');
});

test('refine a proposed selection without losing the original exclusions, or request unchecked manual selection', () => {
  const first = [user(initial),assistant('Проверь предложенные изменения в Recurring.')];
  const extra = [...first,user('А ещё без OTHER'),assistant('Проверь предложенные изменения в Recurring.')];
  const refined = buildRecurringPlan(audit,planFor(extra.concat(user('Да'))));
  assert.deepEqual(refined.candidates.map(row => row.actualAmount),[17.35,8.45]);
  const only = buildRecurringPlan(audit,planFor(first.concat(user('оставь только Cloudlab'))));
  assert.deepEqual(only.candidates.map(row => row.actualAmount),[17.35]);
  assert.ok(buildRecurringPlan(audit,planFor(first.concat(user('оставь только Spotify')))).manualSelection);
  assert.ok(planFor([user(confirmation)],{...scope,historyTruncated:true}).manualSelection);
  const different = planFor([user('Создай отсутствующие подписки в категории Groceries')]);
  assert.ok(different.clarify && !different.manualSelection);
  assert.equal(planFor(first.concat(user('What is a mortgage?'),assistant('A loan...'),user('yes'))),null);
});

test('an audit supplies its schedule fingerprint to every write candidate without sending it to the browser', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const { getRecurringDateAudit } = await import('./assistant-data.mjs');
  const { recurringScheduleSetHash } = await import('./assistant-recurring-writes.mjs');
  const rule = {id:'schedule',name:'Example Plan',frequency:'monthly',frequency_interval:1,amount:5,start_date:'2026-11-02',is_active:true};
  const supabase = createClient('https://test.invalid','publishable-test-key',{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch: async url => {
      const {pathname,searchParams} = new URL(url);
      assert.equal(searchParams.get('user_id'),'eq.owner');
      const table = pathname.split('/').at(-1);
      const rows = {categories:[{id:'subscriptions',name:'Subscriptions',type:'expense'}],recurring_payments:[rule],
        transactions:[{id:'bank',date:'2026-11-05',description:'Different merchant',amount:12,deleted_at:null}]}[table];
      return Response.json(rows);
    }},
  });
  const report = await getRecurringDateAudit(supabase,'owner',{month:today.slice(0,7),category:'Subscriptions'},today);
  const plan = buildRecurringPlan(report,{create:true});
  assert.equal(plan.candidates.length,1);
  assert.equal(plan.candidates[0].scheduleSetHash,recurringScheduleSetHash([rule]));
  assert.ok(!Object.keys(report).includes('scheduleSetHash'));
});

test('unsupported repeat intervals never produce a default monthly proposal', () => {
  const result = planFor([user('Create the missing Recurring schedules every 2 months')]);
  assert.ok(result.clarify);
  assert.equal(result.manualSelection,undefined);
  assert.deepEqual(buildRecurringPlan(audit, planFor([user('Создай остальные Recurring')])).excluded, []);
  const pending = [user(initial),assistant('Проверь изменения в Recurring.')];
  assert.equal(buildRecurringPlan(audit,planFor(pending.concat(user('Создай остальные Recurring')))).excluded.length,3);
});
