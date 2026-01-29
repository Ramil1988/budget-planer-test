-- Migration: Add dismissed_suggestions table
-- Version: 007
-- Description: Stores user-dismissed budget suggestions to persist across sessions
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Create dismissed_suggestions table
-- ============================================================================
-- Tracks which suggestions a user has dismissed
-- Suggestions are unique per: user + category + suggestion_type + month

CREATE TABLE IF NOT EXISTS dismissed_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    suggestion_type TEXT NOT NULL,  -- 'recommendation' or 'savings'
    recommendation_type TEXT,       -- e.g., 'underfunded', 'overfunded', etc. (for recommendations)
    month TEXT NOT NULL,           -- Format: 'YYYY-MM' - the month this suggestion was for
    dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique dismissal per user/category/type/month
    CONSTRAINT unique_dismissal UNIQUE (user_id, category_id, suggestion_type, month)
);

-- ============================================================================
-- STEP 2: Create indexes for efficient querying
-- ============================================================================

-- Index for fetching dismissed suggestions by user and month
CREATE INDEX IF NOT EXISTS idx_dismissed_suggestions_user_month
ON dismissed_suggestions (user_id, month);

-- Index for querying by user_id
CREATE INDEX IF NOT EXISTS idx_dismissed_suggestions_user
ON dismissed_suggestions (user_id);

-- ============================================================================
-- STEP 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE dismissed_suggestions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own dismissed suggestions
CREATE POLICY "Users can view own dismissed suggestions"
ON dismissed_suggestions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own dismissed suggestions
CREATE POLICY "Users can insert own dismissed suggestions"
ON dismissed_suggestions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own dismissed suggestions
CREATE POLICY "Users can delete own dismissed suggestions"
ON dismissed_suggestions
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 4: Optional cleanup function (auto-delete old dismissals)
-- ============================================================================
-- This can be called periodically to clean up dismissals older than 6 months

CREATE OR REPLACE FUNCTION cleanup_old_dismissed_suggestions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Calculate cutoff month (6 months ago)
    WITH deleted AS (
        DELETE FROM dismissed_suggestions
        WHERE month < TO_CHAR(NOW() - INTERVAL '6 months', 'YYYY-MM')
        RETURNING *
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    RETURN deleted_count;
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify the migration was successful:
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'dismissed_suggestions'
-- ORDER BY ordinal_position;
