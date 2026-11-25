import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { readRecurringCatalog } from './recurringCatalog.js';

test('loads every user schedule and editable category even when the server caps each response', async () => {
  const tables = {
    recurring_payments: [
      { id: '1', name: 'Yearly cover', start_date: '2035-12-01', is_active: true },
      { id: '2', name: 'Archive', end_date: '2001-12-31', is_active: true },
      { id: '3', name: 'Music', is_active: false },
      { id: '4', name: 'Music', is_active: true },
    ],
    categories: [
      { id: '1', name: 'Subscriptions' },
      { id: '2', name: 'Bills' },
      { id: '3', name: 'Salary' },
    ],
  };
  const pages = { recurring_payments: [], categories: [] };
  const supabase = createClient('https://catalog.test', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, options) => {
      const { pathname, searchParams: params } = new URL(url);
      const table = pathname.split('/').at(-1);
      assert.equal(options.method, 'GET');
      assert.equal(params.get('user_id'), 'eq.owner');
      assert.equal(params.get('is_active'), null);
      assert.equal(params.get('end_date'), null);
      assert.equal(params.get('start_date'), null);
      assert.equal(params.get('order'), 'id.asc');
      const cursor = params.get('id');
      pages[table].push(cursor);
      const remaining = tables[table].filter((row) => !cursor || row.id > cursor.slice(3));
      const page = remaining.slice(0, 2);
      return Response.json(page, { headers: { 'Content-Range': `0-${page.length - 1}/${remaining.length}` } });
    } },
  });
  const [payments, categories] = await readRecurringCatalog(supabase, 'owner');
  assert.deepEqual(payments.map((row) => row.id), ['2', '3', '4', '1']);
  assert.deepEqual(categories.map((row) => row.name), ['Bills', 'Salary', 'Subscriptions']);
  assert.deepEqual(pages, { recurring_payments: [null, 'gt.2'], categories: [null, 'gt.2'] });
});
