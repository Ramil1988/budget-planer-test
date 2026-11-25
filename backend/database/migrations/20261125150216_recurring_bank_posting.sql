-- A generated transaction keeps its scheduled date. An independently imported
-- statement row can attest to a different posting date without another charge.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recurring_bank_posting jsonb;
COMMENT ON COLUMN public.transactions.recurring_bank_posting IS
  'Statement evidence linked to one generated occurrence: date, description, amount and provider. NULL until a bank row is reconciled.';

-- The webhook links evidence through the same compare-and-set as the signed-in
-- import. Its other transaction columns retain their existing privileges.
GRANT UPDATE (recurring_bank_posting) ON public.transactions TO service_role;
NOTIFY pgrst, 'reload schema';
