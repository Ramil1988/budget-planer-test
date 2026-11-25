-- Confirm an audit review without changing the bank entries that support it.
-- Requires assistant_change_receipts and transactions.assistant_change_version.
BEGIN;
CREATE OR REPLACE FUNCTION public.apply_assistant_recurring_changes(card_key text, plan jsonb, apply_date date)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  actor uuid := auth.uid();
  item jsonb;
  patch jsonb;
  bank public.transactions%ROWTYPE;
  rule public.recurring_payments%ROWTYPE;
  target uuid;
  category_review record;
  rule_set text;
BEGIN
  IF actor IS NULL OR card_key IS NULL OR card_key !~ '^[0-9a-f]{64}$' OR apply_date IS NULL
      OR jsonb_typeof(plan) IS DISTINCT FROM 'array' OR jsonb_array_length(plan) NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'Invalid recurring change card' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.assistant_change_receipts VALUES (actor, card_key) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN true; END IF;

  -- Different reviews for the same user may propose the same new schedule.
  PERFORM pg_advisory_xact_lock(hashtextextended('assistant_recurring:' || actor::text, 0));
  -- A category lock also orders manual inserts (their foreign key takes a
  -- key-share lock). Lock its existing schedules before checking their matching
  -- fields, so edits and deletes cannot change what this review reconciled.
  FOR category_review IN SELECT DISTINCT (value->>'categoryId')::uuid AS id, value->>'scheduleSetHash' AS fingerprint
    FROM jsonb_array_elements(plan) ORDER BY id LOOP
    PERFORM 1 FROM public.categories c WHERE c.id=category_review.id AND c.user_id=actor AND c.type='expense' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stale recurring change card' USING ERRCODE = 'PT409'; END IF;
    PERFORM 1 FROM public.recurring_payments r WHERE r.user_id=actor AND r.category_id=category_review.id
      AND r.type='expense' ORDER BY r.id FOR SHARE;
    SELECT md5(coalesce(string_agg(concat_ws(':',r.id::text,md5(coalesce(r.name,'')),md5(coalesce(r.match_description,'')),
      round(abs(r.amount)*100)::bigint::text,r.frequency,coalesce(r.frequency_interval,1)::text,
      to_char(r.start_date,'YYYY-MM-DD'),coalesce(to_char(r.end_date,'YYYY-MM-DD'),''),
      coalesce(r.is_active::integer::text,''),coalesce(r.business_days_only::integer::text,''),
      coalesce(r.last_business_day_of_month::integer::text,'')),',' ORDER BY r.id),'')) INTO rule_set
      FROM public.recurring_payments r WHERE r.user_id=actor AND r.category_id=category_review.id AND r.type='expense';
    IF rule_set IS DISTINCT FROM category_review.fingerprint THEN
      RAISE EXCEPTION 'Stale recurring change card' USING ERRCODE = 'PT409';
    END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(plan) ORDER BY value->>'transactionId' LOOP
    target := (item->>'id')::uuid;
    patch := item->'patch';
    SELECT * INTO bank FROM public.transactions t
      WHERE t.id = (item->>'transactionId')::uuid AND t.user_id = actor
      AND t.assistant_change_version = (item->>'sourceVersion')::bigint
      AND t.deleted_at IS NULL AND t.type = 'expense' AND t.category_id = (item->>'categoryId')::uuid FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stale recurring change card' USING ERRCODE = 'PT409'; END IF;

    IF item->>'kind' = 'create' THEN
      IF bank.recurring_payment_id IS NOT NULL OR abs(bank.amount) <= 0 OR nullif(btrim(item->>'name'),'') IS NULL
          OR (patch->>'start_date')::date IS DISTINCT FROM bank.date
          OR EXISTS (SELECT 1 FROM public.recurring_payments r WHERE r.user_id = actor AND r.is_active AND r.type='expense'
            AND r.category_id=bank.category_id AND r.amount=abs(bank.amount)
            AND r.start_date=bank.date
            AND lower(btrim(item->>'name')) IN (lower(btrim(r.name)), lower(btrim(r.match_description)))
            AND r.frequency=item->>'frequency' AND r.frequency_interval=(item->>'frequencyInterval')::integer) THEN
        RAISE EXCEPTION 'Stale recurring change card' USING ERRCODE = 'PT409';
      END IF;
      INSERT INTO public.recurring_payments
        (id,user_id,name,amount,type,category_id,frequency,frequency_interval,start_date,
         business_days_only,last_business_day_of_month,is_active,auto_add,match_description)
        VALUES (target,actor,item->>'name',abs(bank.amount),'expense',bank.category_id,item->>'frequency',
          (item->>'frequencyInterval')::integer,bank.date,false,false,true,false,item->>'name')
        ON CONFLICT (id) DO NOTHING;
      IF NOT FOUND THEN RAISE EXCEPTION 'Stale recurring change card' USING ERRCODE = 'PT409'; END IF;

    ELSIF item->>'kind' = 'update' THEN
      SELECT * INTO rule FROM public.recurring_payments r WHERE r.user_id=actor AND r.id=target
        AND r.category_id=bank.category_id AND r.type='expense' AND r.is_active FOR UPDATE;
      IF NOT FOUND OR jsonb_typeof(item->'before') IS DISTINCT FROM 'object'
          OR (item->'before'->>'id')::uuid IS DISTINCT FROM target OR NOT to_jsonb(rule) @> (item->'before')
          OR (bank.recurring_payment_id IS NOT NULL AND (bank.recurring_payment_id <> target OR bank.recurring_bank_posting IS NULL))
          OR (rule.auto_add AND coalesce((patch->>'auto_add_from')::date <= apply_date,true))
          OR (patch->>'start_date') IS NULL OR (patch->>'start_date')::date > rule.end_date THEN
        RAISE EXCEPTION 'Stale recurring change card' USING ERRCODE = 'PT409';
      END IF;
      UPDATE public.recurring_payments SET start_date=(patch->>'start_date')::date,
        business_days_only=(patch->>'business_days_only')::boolean,
        last_business_day_of_month=(patch->>'last_business_day_of_month')::boolean,
        auto_add_from=(patch->>'auto_add_from')::date
      WHERE id=target AND user_id=actor;
    ELSE
      RAISE EXCEPTION 'Invalid recurring change card' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_assistant_recurring_changes(text,jsonb,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_assistant_recurring_changes(text,jsonb,date) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
