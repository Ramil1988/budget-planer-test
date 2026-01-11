-- Migration: Add webhook_secret column to user_settings
-- This enables secure webhook authentication from Google Apps Script

-- Add webhook_secret column if it doesn't exist
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- Add auto_sync_enabled column if it doesn't exist
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT false;

-- Add sync_interval_minutes column if it doesn't exist
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS sync_interval_minutes INTEGER DEFAULT 5;

-- Add realtime_enabled column for toggling between polling and realtime
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS realtime_enabled BOOLEAN DEFAULT false;

-- Create a helper function to generate webhook secrets
CREATE OR REPLACE FUNCTION generate_webhook_secret()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Comment explaining the webhook flow
COMMENT ON COLUMN user_settings.webhook_secret IS 'Secret key for authenticating webhook calls from Google Apps Script';
COMMENT ON COLUMN user_settings.realtime_enabled IS 'When true, uses webhook/realtime sync instead of polling';
