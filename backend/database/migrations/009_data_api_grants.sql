-- Migration: Explicit Data API grants
-- Version: 009
-- Created: 2026-10-26
-- Run this in Supabase SQL Editor AFTER every table-creating migration (001-008).
--
-- Why: from 30 October 2026 Supabase no longer gives the Data API roles
-- (anon, authenticated, service_role) automatic privileges on new tables in the
-- public schema. Tables that already exist keep the privileges they have, so
-- this migration is a no-op for them, but it makes the privileges explicit so a
-- rebuilt database, a preview branch or a local `supabase db reset` behaves the
-- same as production.
--
-- Grants and RLS are separate controls: a grant decides whether a role may
-- touch the table at all, RLS decides which rows it sees. Every policy and
-- every RLS setting in this schema is left untouched.
--
-- Privileges below are the ones the application actually uses:
--   * authenticated - what frontend/src reaches through supabase-js
--   * service_role  - what netlify/functions/*.js reaches with the service key
--   * anon          - nothing; no table is read before sign-in
-- Some privileges are needed not by a query but by a trigger: the triggers in
-- schema.sql and migration 007 are plain (not SECURITY DEFINER) functions, so
-- they run as the role that wrote the transaction and need that role's
-- privileges on the tables they touch. Those are marked "via trigger".
--
-- Re-running this file is safe: GRANT on an already-granted privilege is a no-op.

-- ============================================================================
-- authenticated - the signed-in user, via the frontend
-- ============================================================================

-- Accounts: read and create; the balance column is maintained by the
-- update_balance() trigger on transactions, not by the frontend.
GRANT SELECT, INSERT, UPDATE ON public.accounts TO authenticated;  -- UPDATE via trigger

GRANT SELECT, INSERT, UPDATE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.budgets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_payments TO authenticated;

-- Assets & liabilities
GRANT SELECT, INSERT ON public.asset_categories TO authenticated;
GRANT SELECT, INSERT ON public.liability_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liabilities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.net_worth_snapshots TO authenticated;

-- ============================================================================
-- service_role - the Netlify Functions
-- ============================================================================

-- netlify/functions/dismissed-suggestions.js: SELECT, upsert (INSERT + UPDATE), DELETE
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dismissed_suggestions TO service_role;

-- netlify/functions/google-sheets-webhook.js
GRANT SELECT, INSERT, UPDATE ON public.accounts TO service_role;  -- UPDATE via trigger
GRANT SELECT, INSERT ON public.categories TO service_role;
GRANT SELECT, INSERT ON public.transactions TO service_role;
GRANT SELECT ON public.user_settings TO service_role;
GRANT SELECT ON public.merchant_mappings TO service_role;

-- netlify/functions/budget-recommendations.js (read-only)
GRANT SELECT ON public.budgets TO service_role;
GRANT SELECT ON public.recurring_payments TO service_role;

-- Triggers that fire when the webhook inserts a transaction
GRANT SELECT, UPDATE ON public.budget_categories TO service_role;  -- update_spent()
GRANT SELECT, UPDATE ON public.liabilities TO service_role;        -- update_liability_on_transaction()

-- ============================================================================
-- Deliberately not granted
-- ============================================================================
-- anon: no table is read before sign-in, so it gets no privileges at all.
-- public.profiles: no code path reaches it through the Data API; it is written
--   only by seed_new_user_data(), a SECURITY DEFINER function.
-- Sequences: every table uses a UUID primary key, so there is nothing to grant.

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- What each API role may do, table by table:
--   SELECT grantee, table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type)
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'service_role')
--   GROUP BY grantee, table_name
--   ORDER BY grantee, table_name;
--
-- Tables in public that no API role can reach (expected: profiles):
--   SELECT c.relname
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind = 'r'
--     AND NOT EXISTS (
--       SELECT 1 FROM information_schema.role_table_grants g
--       WHERE g.table_schema = 'public' AND g.table_name = c.relname
--         AND g.grantee IN ('anon', 'authenticated', 'service_role'))
--   ORDER BY 1;
