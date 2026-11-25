#!/usr/bin/env bash
# Requires initdb, pg_ctl and psql on PATH. Always creates a separate database on a private Unix socket.
set -euo pipefail
database_dir=$(cd "$(dirname "$0")/.." && pwd)
scratch=$(mktemp -d)
trap 'pg_ctl -D "$scratch/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$scratch"' EXIT
export PGHOST="$scratch" PGPORT=55432 PGDATABASE=postgres PGUSER=budget_test
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS
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

actor=11111111-1111-4111-8111-111111111111
other=22222222-2222-4222-8222-222222222222
account=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
food=ffffffff-ffff-4fff-8fff-ffffffffffff
home=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee
original=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
part=cccccccc-cccc-4ccc-8ccc-cccccccccccc
other_part=dddddddd-dddd-4ddd-8ddd-dddddddddddd
auth="SET ROLE authenticated; SET request.jwt.claim.sub = '$actor';"
db <<SQL
INSERT INTO auth.users VALUES ('$actor'), ('$other');
INSERT INTO public.accounts(id, user_id, name) VALUES ('$account', '$actor', 'Main');
INSERT INTO public.categories(id, user_id, name, type) VALUES ('$food', '$actor','Food','expense'), ('$home', '$actor','Home','expense');
WITH b AS (INSERT INTO public.budgets(user_id,month,total) VALUES ('$actor','2026-11-01',300) RETURNING id)
INSERT INTO public.budget_categories(budget_id,category_id,limit_amount)
SELECT b.id,c.id,150 FROM b CROSS JOIN categories c;
$auth
INSERT INTO public.transactions(id,user_id,account_id,category_id,amount,type,date)
VALUES ('$original','$actor','$account','$food',100,'expense','2026-11-25');
SQL
# The two cards describe the same split but have different tokens and generated part ids.
split() {
  cat <<SQL
SELECT public.apply_assistant_transaction_changes(repeat('$1',64),'{
  "sources":[{"id":"$original","version":$3}],
  "updates":[{"id":"$original","amount":65,"category_id":"$4","description":"sample"}],
  "additions":[{"id":"$2","account_id":"$account","category_id":"$home","amount":35,"type":"expense","date":"2026-11-25"}],
  "removals":[]
}');
SQL
}
expect() {
  local actual
  actual=$(db -c "$1")
  if [[ "$actual" != "$2" ]]; then echo "Expected $2; got $actual" >&2; exit 1; fi
}
current_ledger="SELECT count(*) || ':' || sum(amount) || ':' || (SELECT balance FROM accounts) FROM transactions"
# A DATE-only edit also invalidates an open card.
db -c "$auth UPDATE transactions SET date = '2026-11-24' WHERE id = '$original'"
if db -c "$auth $(split a "$part" 1 "$food")" 2>"$scratch/stale"; then exit 1; fi
grep -q 'Stale transaction change card' "$scratch/stale"
db -c "$auth UPDATE transactions SET date = '2026-11-25' WHERE id = '$original'"
expect "SELECT count(*) FROM assistant_change_receipts" 0
# The first insert and its account/budget trigger effects must roll back on a later failure.
if db -c "$auth $(split a "$part" 3 "$other_part")" 2>"$scratch/rollback"; then exit 1; fi
grep -q 'Stale transaction change card' "$scratch/rollback"
expect "$current_ledger" "1:100.00:-100.00"
expect "SELECT spent FROM budget_categories WHERE category_id='$home'" "0.00"
expect "SELECT count(*) FROM assistant_change_receipts" 0
# Another user cannot apply a card to this ledger, even with the original ids and versions.
if db -c "SET ROLE authenticated; SET request.jwt.claim.sub='$other'; $(split a "$part" 3 "$food")" 2>"$scratch/ownership"; then exit 1; fi
grep -q 'Stale transaction change card' "$scratch/ownership"
expect "SELECT has_function_privilege('anon','public.apply_assistant_transaction_changes(text,jsonb)','EXECUTE')" f
mkfifo "$scratch/release"
db >"$scratch/winner.log" 2>&1 <<SQL &
$auth
BEGIN;
$(split a "$part" 3 "$food")
\! touch '$scratch/ready'
\! cat '$scratch/release' >/dev/null
COMMIT;
SQL
winner=$!
for ((i=0; i<200; i++)); do
  [[ -f "$scratch/ready" ]] && break
  kill -0 "$winner" 2>/dev/null || { cat "$scratch/winner.log" >&2; exit 1; }
  sleep 0.03
done
[[ -f "$scratch/ready" ]]
db -c "$auth SET application_name='split-retry'; $(split a "$part" 3 "$food")" >"$scratch/retry" 2>&1 &
retry=$!
db -c "$auth SET application_name='split-rival'; $(split b "$other_part" 3 "$food")" >"$scratch/rival" 2>&1 &
rival=$!
for ((i=0; i<200; i++)); do
  waiting=$(db -c "SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE 'split-%' AND wait_event_type='Lock'")
  [[ "$waiting" == 2 ]] && break
  sleep 0.03
done
echo release > "$scratch/release"
[[ "$waiting" == 2 ]]
wait "$winner"
wait "$retry"
if wait "$rival"; then echo "Two rival cards were accepted" >&2; exit 1; fi
grep -q 'Stale transaction change card' "$scratch/rival"
expect "$current_ledger" "2:100.00:-100.00"
expect "SELECT spent FROM budget_categories WHERE category_id='$home'" "35.00"
expect "SELECT spent FROM budget_categories WHERE category_id='$food'" "65.00"
expect "SELECT count(*) FROM assistant_change_receipts" 1

# On installations with UPDATE maintenance, the RPC must not charge the adjustment twice.
# With migration 010 present it also keeps the previous import identity through an edit.
db -f "$database_dir/migrations/010_import_signature.sql"
db <<SQL
CREATE FUNCTION test_update_aggregates() RETURNS trigger LANGUAGE plpgsql AS \$\$
BEGIN
  UPDATE accounts SET balance = balance + OLD.amount - NEW.amount WHERE id = OLD.account_id;
  UPDATE budget_categories SET spent = spent + NEW.amount - OLD.amount WHERE category_id = OLD.category_id;
  RETURN NEW;
END;
\$\$;
CREATE TRIGGER test_existing_update AFTER UPDATE OF amount ON transactions FOR EACH ROW EXECUTE FUNCTION test_update_aggregates();
$auth
SELECT public.apply_assistant_transaction_changes(repeat('c',64), jsonb_build_object(
  'sources',jsonb_build_array(jsonb_build_object('id','$original','version',(SELECT assistant_change_version FROM transactions WHERE id='$original'))),
  'updates',jsonb_build_array(jsonb_build_object('id','$original','amount',50,'category_id','$food','description','edited','import_signature','original bank row')),
  'removals','[]'::jsonb,'additions','[]'::jsonb));
SQL
expect "$current_ledger" "2:85.00:-85.00"
expect "SELECT spent FROM budget_categories WHERE category_id='$food'" "50.00"
expect "SELECT import_signature FROM transactions WHERE id='$original'" "original bank row"
echo "Passed atomic rollback, scoping, stale source, concurrent split, retry and aggregate checks."
