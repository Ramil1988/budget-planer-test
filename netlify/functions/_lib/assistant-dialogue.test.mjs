import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../budget-assistant.mjs';
import { recurringAuditTurn, auditMonthPrompt } from './assistant-recurring-intent.mjs';

const user = '33333333-3333-4333-8333-333333333333';
const category = '11111111-1111-4111-8111-111111111111';
const userMessage = (content) => ({ role: 'user', content });

function setup(t, model, records = {}) {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const address = new URL(url.url ?? url);
    if (address.hostname === 'api.openai.com') return model(JSON.parse(options.body));
    assert.equal(address.hostname, 'db.invalid');
    if (address.pathname === '/auth/v1/user') return Response.json({ id: user, aud: 'authenticated' });
    assert.equal(options.method, 'GET');
    assert.equal(address.searchParams.get('user_id'), 'eq.' + user);
    return Response.json(records[address.pathname.split('/').at(-1)] ?? []);
  });
  process.env.SUPABASE_URL = 'https://db.invalid';
  process.env.SUPABASE_ANON_KEY = 'sb_publishable_fixture';
  process.env.OPENAI_API_KEY = 'test-only';
}

function chat(messages) {
  return handler(new Request('http://local.test/', {
    method: 'POST', headers: { Authorization: 'Bearer fixture' },
    body: JSON.stringify({ messages, visuals: true, timeZone: 'UTC', requestId: crypto.randomUUID() }),
  }));
}

const textReply = (message) => Response.json({
  status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ message, choices: [] }) }] }],
});

test('a month selection finishes the category audit without OpenAI, keeping the year; unrelated requests still use chat', async (t) => {
  let calls = 0;
  setup(t, () => { calls++; return textReply('New topic.'); }, { categories: [{ id: category, name: 'Subscriptions' }] });
  const request = userMessage('Сверь даты транзакций Subscriptions с Recurring за октябрь и ноябрь 2024');
  const clarification = await (await chat([request])).json();
  assert.match(clarification.message, /Укажи один месяц/);
  assert.deepEqual(clarification.choices, ['октябрь 2024', 'ноябрь 2024']);
  const history = [request, { role: 'assistant', content: clarification.message + '\n\nOptions offered:\n1) октябрь 2024\n2) ноябрь 2024' }];
  const answer = await (await chat([...history, userMessage('За ноябрь')])).json();
  assert.equal(answer.visuals[0].kind, 'recurring-date-audit');
  assert.equal(answer.visuals[0].category, 'Subscriptions');
  assert.equal(answer.visuals[0].month, '2024-11');
  assert.equal(calls, 0);
  assert.equal((await (await chat([...history, userMessage('Как создать новый счёт в ноябре?')])).json()).message, 'New topic.');
  assert.equal(calls, 1);
});

test('the November audit explains an additional merchant charge in the chat reply without a model call', async (t) => {
  setup(t, () => assert.fail('Category audit should be calculated locally'), {
    categories: [{ id: category, name: 'Subscriptions' }],
    recurring_payments: [{ id: 'monthly', name: 'Fictional Studio Pro', type: 'expense', amount: 21, frequency: 'monthly',
      frequency_interval: 1, start_date: '2024-11-07', is_active: true }],
    transactions: [
      { id: 'one', date: '2024-11-07', amount: 20.50, description: 'FICTIONAL STUDIO SUB' },
      { id: 'two', date: '2024-11-08', amount: 64, description: 'at FICTIONAL STUDIO SUB' },
    ],
  });
  const result = await (await chat([userMessage('Сверь даты транзакций Subscriptions с Recurring за ноябрь 2024')])).json();
  assert.equal(result.visuals[0].transactionCount, 2);
  assert.match(result.message, /Fictional Studio Pro/);
  for (const value of ['20,50', '64,00', '84,50', '21,00', '07.11.2024', '08.11.2024']) assert.ok(result.message.includes(value), value);
});

test('the direct audit explains what the bare company description and product charge have in common', async (t) => {
  setup(t, () => assert.fail('Recurring review does not require a model call'), {
    categories: [{ id: category, name: 'Subscriptions' }],
    recurring_payments: [{ id: 'plan', name: 'ChatGPT Plus', type: 'expense', amount: 24, frequency: 'monthly',
      frequency_interval: 1, start_date: '2024-09-08', is_active: true }],
    transactions: [
      { id: 'product', date: '2024-09-09', amount: 23.75, description: 'OPENAI *CHATGPT SUBSCR' },
      { id: 'company', date: '2024-09-08', amount: 11.24, description: 'at OPENAI' },
    ],
  });
  const result = await (await chat([userMessage('Сверь даты транзакций Subscriptions с Recurring за сентябрь 2024')])).json();
  assert.match(result.message, /at OPENAI/);
  assert.match(result.message, /ChatGPT Plus/);
  const report = result.visuals[0];
  assert.equal(report.counts.company_candidate, 1);
  assert.equal(report.transactionTotal, 34.99);
  assert.equal(report.rows.find((row) => row.status === 'company_candidate').companyCandidates[0].actualAmount, 23.75);
});

test('coverage questions return the verified income, obligations and difference, alongside the chart', async (t) => {
  let round = 0;
  const periods = { start_date: '2026-12-01', end_date: '2026-12-08', type: null };
  const schedule = (id, type, amount, date) => ({
    id, type, name: type, amount, start_date: date, frequency: 'monthly', frequency_interval: 1, is_active: true,
  });
  setup(t, () => ++round === 1 ? Response.json({
    status: 'completed', output: [{ type: 'function_call', call_id: 'coverage', name: 'get_upcoming_payments', arguments: JSON.stringify(periods) }],
  }) : textReply('The next payment is on December 1.'), { recurring_payments: [
    schedule('expense', 'expense', 100, '2026-12-01'), schedule('income', 'income', 500, '2026-12-04'),
  ] });
  const result = await (await chat([userMessage('Will income cover expenses for December 1–8, 2026?')])).json();
  assert.equal(result.visuals[0].kind, 'upcoming-payments');
  assert.match(result.message, /500\.00/);
  assert.match(result.message, /100\.00/);
  assert.match(result.message, /Surplus.*400\.00/);
});

for (const [name, mock, status, code, retryable] of [
  ['rate limit', () => Response.json({ error: { code: 'rate_limit_exceeded' } }, { status: 429, headers: { 'Retry-After': '7' } }), 429, 'rate_limit', true],
  ['exhausted credit', () => Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 }), 503, 'quota', false],
  ['answer too long', () => Response.json({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }), 422, 'output_limit', false],
]) {
  test(`chat classifies ${name} and returns an actionable localized response`, async (t) => {
    setup(t, mock);
    const response = await chat([userMessage('Расскажи о приложении')]);
    const result = await response.json();
    assert.equal(response.status, status);
    assert.equal(result.code, code);
    assert.equal(result.retryable, retryable);
    assert.match(result.error, /[А-Яа-я]/u);
    if (code === 'rate_limit') {
      assert.equal(response.headers.get('retry-after'), '7');
      assert.match(result.error, /7 с/);
    }
  });
}

test('month clarification keeps dates spanning years and asks for a year for repeated month names', () => {
  const prompt = { role: 'assistant', content: auditMonthPrompt.ru };
  const question = userMessage('Сверь даты транзакций Subscriptions с Recurring за декабрь 2024 и январь 2025');
  assert.equal(recurringAuditTurn([question, prompt, userMessage('декабрь')], '2026-11-25').month, '2024-12');
  assert.equal(recurringAuditTurn([question, prompt, userMessage('январь')], '2026-11-25').month, '2025-01');
  const ambiguous = userMessage('Сверь даты транзакций Subscriptions с Recurring за ноябрь 2024 и ноябрь 2025');
  const history = [ambiguous, prompt, userMessage('ноябрь')];
  assert.equal(recurringAuditTurn(history, '2026-11-25').month, null);
  assert.equal(recurringAuditTurn([...history, prompt, userMessage('ноябрь 2024')], '2026-11-25').month, '2024-11');
});

test('income coverage includes an earlier cash shortfall when the user asks about going negative', async (t) => {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.parse(today) + 86_400_000).toISOString().slice(0, 10);
  let round = 0;
  setup(t, (request) => {
    if (++round === 1) return Response.json({ status: 'completed', output: [{
      type: 'function_call', call_id: 'cash', name: 'get_upcoming_payments',
      arguments: JSON.stringify({ start_date: today, end_date: tomorrow, type: null }),
    }] });
    const data = JSON.parse(request.input.at(-1).output);
    assert.deepEqual([data.cash_flow.required_top_up, data.cash_flow.top_up_by], [100, today]);
    return textReply('Доход покрывает расходы за период.');
  }, {
    recurring_payments: [
      { id: 'bill', name: 'Bill', type: 'expense', amount: 100, start_date: today, frequency: 'monthly', is_active: true },
      { id: 'pay', name: 'Pay', type: 'income', amount: 500, start_date: tomorrow, frequency: 'monthly', is_active: true },
    ],
    accounts: [{ id: 'current', balance: 1000 }],
  });
  const result = await (await chat([userMessage('Хватит ли дохода, чтобы ни один день не уйти в минус? Сколько добавить сегодня?')])).json();
  assert.match(result.message, /400,00/);
  assert.match(result.message, /добавить\s+100,00/);
  assert.ok(result.message.includes(today.split('-').reverse().join('.')));
  assert.equal(round, 2);
});
