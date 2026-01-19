-- Migration: Add soft delete support for transactions
-- Version: 004
-- Description: Adds deleted_at column to enable soft delete functionality
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Add deleted_at column to transactions table
-- ============================================================================
-- This column will store the timestamp when a transaction was soft-deleted
-- NULL = active transaction, NOT NULL = deleted transaction

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- ============================================================================
-- STEP 2: Create indexes for efficient filtering
-- ============================================================================

-- Partial index for active transactions (most common query)
CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at
ON transactions (user_id, deleted_at)
WHERE deleted_at IS NULL;

-- Partial index for trash view (deleted transactions by deletion date)
CREATE INDEX IF NOT EXISTS idx_transactions_trash
ON transactions (user_id, deleted_at DESC)
WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify the migration was successful:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'transactions' AND column_name = 'deleted_at';
