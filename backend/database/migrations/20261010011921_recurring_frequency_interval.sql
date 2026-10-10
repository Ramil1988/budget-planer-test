-- Repeat every N frequency periods; existing schedules keep their current cadence.
-- Apply before deploying the frontend that writes frequency_interval.
ALTER TABLE public.recurring_payments
  ADD COLUMN IF NOT EXISTS frequency_interval INTEGER NOT NULL DEFAULT 1
  CHECK (frequency_interval BETWEEN 1 AND 999);

COMMENT ON COLUMN public.recurring_payments.frequency_interval IS
  'Repeat every N frequency periods. For example, monthly with interval 2 means every two months.';

NOTIFY pgrst, 'reload schema';
