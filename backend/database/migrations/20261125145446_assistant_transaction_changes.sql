-- Apply a reviewed card and its retry receipt in a single Postgres transaction.
-- Run before deploying the assistant handler. Also works without import_signature (010).
BEGIN;

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS assistant_change_version bigint NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.advance_transaction_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.assistant_change_version := OLD.assistant_change_version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS advance_assistant_change_version ON public.transactions;
CREATE TRIGGER advance_assistant_change_version BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.advance_transaction_version();
REVOKE ALL ON FUNCTION public.advance_transaction_version() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.assistant_change_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_key text NOT NULL CHECK (length(card_key) = 64),
  PRIMARY KEY (user_id, card_key)
);
ALTER TABLE public.assistant_change_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_receipts ON public.assistant_change_receipts;
CREATE POLICY own_receipts ON public.assistant_change_receipts TO authenticated
USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.assistant_change_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.assistant_change_receipts TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_assistant_transaction_changes(card_key text, plan jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER
-- Existing account and budget triggers resolve application tables by their unqualified names.
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  source record;
  source_version bigint;
  locked_ids uuid[] := '{}';
  item jsonb;
  target uuid;
  original public.transactions%ROWTYPE;
  new_amount numeric;
  new_category uuid;
  balance_before numeric;
  spent_before jsonb;
BEGIN
  IF actor IS NULL OR card_key IS NULL OR card_key !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(plan->'sources') IS DISTINCT FROM 'array'
     OR jsonb_typeof(plan->'updates') IS DISTINCT FROM 'array'
     OR jsonb_typeof(plan->'additions') IS DISTINCT FROM 'array'
     OR jsonb_typeof(plan->'removals') IS DISTINCT FROM 'array'
     OR jsonb_array_length(plan->'sources') NOT BETWEEN 1 AND 24
     OR (jsonb_array_length(plan->'updates') + jsonb_array_length(plan->'additions')
         + jsonb_array_length(plan->'removals')) NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Invalid transaction change card' USING ERRCODE = '22023';
  END IF;

  -- Concurrent retries of the same card wait here until the winner commits or rolls back.
  INSERT INTO public.assistant_change_receipts VALUES (actor, card_key) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;

  -- Different cards touching the same source serialize in a consistent order. Even a
  -- source used only as the template for a new entry consumes its reviewed version.
  FOR source IN SELECT * FROM jsonb_to_recordset(plan->'sources') AS x(id uuid, version bigint) ORDER BY id LOOP
    SELECT t.assistant_change_version INTO source_version FROM public.transactions t
      WHERE t.user_id = actor AND t.id = source.id AND t.deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND OR source.version IS DISTINCT FROM source_version OR source.id = ANY(locked_ids) THEN
      RAISE EXCEPTION 'Stale transaction change card' USING ERRCODE = 'PT409';
    END IF;
    locked_ids := array_append(locked_ids, source.id);
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(plan->'additions') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = actor AND id = (item->>'account_id')::uuid)
       OR (item->>'category_id' IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.categories WHERE user_id = actor AND id = (item->>'category_id')::uuid AND type = item->>'type'
       )) THEN
      RAISE EXCEPTION 'Account or category changed' USING ERRCODE = 'PT409';
    END IF;
    INSERT INTO public.transactions (id, user_id, type, amount, date, description, account_id, category_id, provider)
      VALUES ((item->>'id')::uuid, actor, item->>'type', (item->>'amount')::numeric, (item->>'date')::date,
              item->>'description', (item->>'account_id')::uuid, (item->>'category_id')::uuid, item->>'provider');
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(plan->'removals') LOOP
    target := (item->>'id')::uuid;
    UPDATE public.transactions SET deleted_at = now()
      WHERE user_id = actor AND id = target AND id = ANY(locked_ids);
    IF NOT FOUND THEN RAISE EXCEPTION 'Stale transaction change card' USING ERRCODE = 'PT409'; END IF;
    locked_ids := array_remove(locked_ids, target);
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(plan->'updates') LOOP
    target := (item->>'id')::uuid;
    new_amount := (item->>'amount')::numeric;
    new_category := (item->>'category_id')::uuid;
    SELECT * INTO original FROM public.transactions WHERE user_id = actor AND id = target AND id = ANY(locked_ids);
    IF NOT FOUND OR (new_category IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.categories WHERE user_id = actor AND id = new_category AND type = original.type
    )) THEN RAISE EXCEPTION 'Stale transaction change card' USING ERRCODE = 'PT409'; END IF;

    -- schema.sql accrues accounts.balance and budget_categories.spent on INSERT only.
    -- New split parts have already fired those triggers. Keep the original's edit in
    -- both aggregates, while respecting installations whose UPDATE trigger handled it.
    balance_before := NULL;
    spent_before := NULL;
    IF original.amount <> new_amount THEN
      SELECT balance INTO balance_before FROM public.accounts
        WHERE user_id = actor AND id = original.account_id FOR UPDATE;
    END IF;
    IF original.type = 'expense' AND (original.amount <> new_amount OR original.category_id IS DISTINCT FROM new_category) THEN
      SELECT jsonb_object_agg(id::text, spent) INTO spent_before FROM (
        SELECT bc.id, bc.spent FROM public.budget_categories bc JOIN public.budgets b ON b.id = bc.budget_id
          WHERE b.user_id = actor AND b.month = date_trunc('month', original.date)::date
            AND bc.category_id IN (original.category_id, new_category)
          ORDER BY bc.id FOR UPDATE OF bc
      ) budgets_to_adjust;
    END IF;

    UPDATE public.transactions SET amount = new_amount, category_id = new_category, description = item->>'description'
      WHERE user_id = actor AND id = target;

    IF balance_before IS NOT NULL THEN
      UPDATE public.accounts SET balance = balance_before
        + CASE WHEN original.type = 'income' THEN new_amount - original.amount ELSE original.amount - new_amount END
        WHERE user_id = actor AND id = original.account_id AND balance = balance_before;
    END IF;
    IF spent_before IS NOT NULL THEN
      UPDATE public.budget_categories bc SET spent = bc.spent
          + CASE WHEN bc.category_id = new_category THEN new_amount ELSE 0 END
          - CASE WHEN bc.category_id = original.category_id THEN original.amount ELSE 0 END
        WHERE spent_before ? bc.id::text AND bc.spent = (spent_before->>bc.id::text)::numeric;
    END IF;
    IF item ? 'import_signature' THEN
      UPDATE public.transactions SET import_signature = item->>'import_signature'
        WHERE user_id = actor AND id = target AND import_signature IS NULL;
    END IF;
    locked_ids := array_remove(locked_ids, target);
  END LOOP;

  UPDATE public.transactions SET assistant_change_version = assistant_change_version + 1
    WHERE user_id = actor AND id = ANY(locked_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_assistant_transaction_changes(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_assistant_transaction_changes(text,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
