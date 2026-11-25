#!/usr/bin/env bash
# Integration test. Starts its own Postgres on a private Unix socket.
set -euo pipefail
database_dir=$(cd "$(dirname "$0")/.." && pwd)
scratch=$(mktemp -d)
export PGHOST="$scratch" PGPORT=55433 PGDATABASE=postgres PGUSER=budget_test
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS
trap 'pg_ctl -D "$scratch/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$scratch"' EXIT
initdb -D "$scratch/data" -A trust -U "$PGUSER" --no-locale -E UTF8 >/dev/null
pg_ctl -D "$scratch/data" -l "$scratch/server.log" -o "-k '$PGHOST' -h '' -p $PGPORT" -w start >/dev/null
db() { psql -X -qAt -v ON_ERROR_STOP=1 "$@"; }
db <<'SQL'
CREATE ROLE authenticated;
CREATE ROLE anon;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.sub', true)::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
SQL
db -f "$database_dir/schema.sql"
db -f "$database_dir/migrations/004_soft_delete_transactions.sql"
db -f "$database_dir/migrations/20261125145446_assistant_transaction_changes.sql"
db -f "$database_dir/migrations/20261125150216_recurring_bank_posting.sql"
db -f "$database_dir/migrations/20261125203756_assistant_recurring_changes.sql"
db <<'SQL'
DO $$ BEGIN
  ASSERT NOT has_function_privilege('anon','public.apply_assistant_recurring_changes(text,jsonb,date)','EXECUTE');
END $$;
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
INSERT INTO accounts(id,user_id,name) VALUES ('00000000-0000-4000-8000-000000000003',auth.uid(),'Test');
INSERT INTO categories(id,user_id,name,type) VALUES ('00000000-0000-4000-8000-000000000004',auth.uid(),'Subscriptions','expense');
INSERT INTO recurring_payments(id,user_id,name,type,category_id,start_date,business_days_only,amount,frequency,auto_add,auto_add_from)
VALUES ('00000000-0000-4000-8000-000000000010',auth.uid(),'Lattice Kite Studio','expense','00000000-0000-4000-8000-000000000004','2026-05-13',true,24.70,'monthly',true,'2026-05-13');
INSERT INTO transactions(id,user_id,account_id,category_id,type,date,description,amount)
VALUES ('00000000-0000-4000-8000-000000000005',auth.uid(),'00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','expense','2027-02-03','PAPER FERN BOX',6.42),
       ('00000000-0000-4000-8000-000000000006',auth.uid(),'00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','expense','2027-02-13','LATTICE KITE *STUDIO',24.35);
-- Only the reviewed snapshot and bank identity are submitted. The invoker builds
-- the insert from the owned bank row; edit keeps amount and source transactions.
DO $$
DECLARE
  addition jsonb;
  edit jsonb;
  plan jsonb;
  rule public.recurring_payments%ROWTYPE;
  balance_before numeric := (SELECT balance FROM accounts);
  ledger_before jsonb := (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM transactions t);
BEGIN
  SELECT * INTO STRICT rule FROM recurring_payments;
  addition := jsonb_build_object('kind','create','id','00000000-0000-4000-8000-000000000020',
    'transactionId','00000000-0000-4000-8000-000000000005','sourceVersion','1','categoryId',rule.category_id,
    'frequency','monthly','frequencyInterval',1,'name','PAPER FERN BOX','patch',jsonb_build_object('start_date','2027-02-03'));
  edit := jsonb_build_object('kind','update','id',rule.id,'transactionId','00000000-0000-4000-8000-000000000006',
    'sourceVersion','1','categoryId',rule.category_id,'before',to_jsonb(rule),
    'patch',jsonb_build_object('start_date','2026-05-13','business_days_only',false,
      'last_business_day_of_month',false,'auto_add_from','2027-02-19'));
  -- Fingerprint from recurringScheduleSetHash() with the fixture above. This
  -- catches changes to other schedules matching the same category and vendor.
  addition := addition || '{"scheduleSetHash":"326135d3b32a92d2fe5429efc3443a89"}';
  edit := edit || '{"scheduleSetHash":"326135d3b32a92d2fe5429efc3443a89"}';
  plan := jsonb_build_array(addition,edit);
  BEGIN
    PERFORM apply_assistant_recurring_changes(repeat('c',64),
      jsonb_build_array(addition, edit || '{"sourceVersion":"9"}'), '2027-02-18');
    RAISE EXCEPTION 'stale bank row accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  ASSERT (SELECT count(*) FROM recurring_payments)=1;
  ASSERT (SELECT count(*) FROM assistant_change_receipts)=0;
  UPDATE recurring_payments SET match_description='PAPER FERN BOX' WHERE id=rule.id;
  BEGIN
    PERFORM apply_assistant_recurring_changes(repeat('d',64),jsonb_build_array(addition),'2027-02-18');
    RAISE EXCEPTION 'edited merchant mapping in same category did not invalidate create card';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  UPDATE recurring_payments SET match_description=NULL, amount=100 WHERE id=rule.id;
  BEGIN
    PERFORM apply_assistant_recurring_changes(repeat('a',64),plan,'2027-02-18');
    RAISE EXCEPTION 'stale recurring rule accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  ASSERT (SELECT count(*) FROM recurring_payments)=1;
  UPDATE recurring_payments SET amount=24.70 WHERE id=rule.id;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
  BEGIN
    PERFORM apply_assistant_recurring_changes(repeat('a',64),plan,'2027-02-18');
    RAISE EXCEPTION 'another user applied the review';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  ASSERT apply_assistant_recurring_changes(repeat('a',64),plan,'2027-02-18')=false;
  ASSERT apply_assistant_recurring_changes(repeat('a',64),plan,'2027-02-19')=true;
  BEGIN
    PERFORM apply_assistant_recurring_changes(repeat('b',64),jsonb_build_array(addition), '2027-02-18');
    RAISE EXCEPTION 'overlapping proposal inserted a second recurring schedule';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  ASSERT (SELECT count(*) FROM assistant_change_receipts)=1;
  ASSERT (SELECT count(*) FROM recurring_payments)=2;
  ASSERT (SELECT count(*) FROM recurring_payments WHERE name='PAPER FERN BOX' AND amount=6.42 AND type='expense'
      AND start_date='2027-02-03' AND NOT auto_add AND frequency='monthly' AND match_description='PAPER FERN BOX')=1;
  ASSERT (SELECT count(*) FROM recurring_payments WHERE name='Lattice Kite Studio' AND amount=24.70 AND NOT business_days_only
      AND auto_add AND auto_add_from='2027-02-19')=1;
  ASSERT (SELECT balance FROM accounts)=balance_before;
  ASSERT (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM transactions t)=ledger_before;
END $$;
SQL
# Send the real JavaScript review payload to PostgreSQL too, including nullable
# matching flags, an alias with punctuation and Unicode, and a numeric amount.
db <<'SQL'
UPDATE recurring_payments SET business_days_only=true WHERE name='Lattice Kite Studio';
UPDATE recurring_payments SET business_days_only=NULL,match_description='A, «счёт»; "B"',end_date='2027-04-01' WHERE name='PAPER FERN BOX';
SQL
db -c "SELECT jsonb_build_object('rules',(SELECT jsonb_agg(to_jsonb(r)) FROM recurring_payments r),
  'entry',(SELECT to_jsonb(t) FROM transactions t WHERE t.description='LATTICE KITE *STUDIO'))" > "$scratch/fixture.json"
(
cd "$database_dir/../.."
node --input-type=module - "$scratch/fixture.json" > "$scratch/plan.json" <<'JS'
import { readFileSync } from 'node:fs';
import { prepareRecurringScheduleChanges, recurringScheduleSetHash } from './netlify/functions/_lib/assistant-recurring-writes.mjs';
const { rules, entry } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const rule = rules.find((row) => row.name === 'Lattice Kite Studio');
const candidates = [{ kind: 'update', categoryId: rule.category_id, category: 'Subscriptions', scheduleId: rule.id,
  scheduleSetHash: recurringScheduleSetHash(rules), name: rule.name, description: entry.description,
  transactionId: entry.id, expectedDate: '2027-02-12', actualDate: entry.date, expectedAmount: rule.amount, actualAmount: entry.amount }];
const supabase = { from(table) {
  const row = table === 'transactions' ? entry : rule;
  const query = {
    select(columns) { this.data = [Object.fromEntries(columns.split(',').map((key) => [key, row[key]]))]; return this; },
    eq() { return this; }, in() { return this; }, is() { return this; },
  };
  return query;
} };
const result = await prepareRecurringScheduleChanges({ supabase, userId: entry.user_id, candidates, today: '2027-02-18' });
console.log(JSON.stringify(result.changes));
JS
)
confirm_wire_card() {
  db -v plan="$(cat "$scratch/plan.json")" <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
SELECT apply_assistant_recurring_changes(repeat('e',64),:'plan'::jsonb,'2027-02-18');
SELECT pg_sleep(0.25);
COMMIT;
SQL
}
confirm_wire_card >"$scratch/first" &
first=$!
confirm_wire_card >"$scratch/second" &
second=$!
wait "$first"
wait "$second"
# Exactly one commit; the other connection sees the saved, user-scoped receipt.
[[ $(cat "$scratch/first" "$scratch/second" | grep -E '^[ft]$' | sort | tr -d '\n') == ft ]]
echo 'Recurring review: atomic create/edit, retries, ownership and unmodified ledger verified.'
