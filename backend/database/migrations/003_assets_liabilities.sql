-- Migration: Assets & Liabilities Tracker
-- Created: 2026-01-21
-- Description: Adds tables for tracking assets, liabilities, and net worth snapshots

-- Create asset_categories table
CREATE TABLE IF NOT EXISTS asset_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '💎',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create liability_types table
CREATE TABLE IF NOT EXISTS liability_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '💳',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES asset_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  note TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create liabilities table
CREATE TABLE IF NOT EXISTS liabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type_id UUID NOT NULL REFERENCES liability_types(id) ON DELETE CASCADE,
  creditor TEXT NOT NULL,
  outstanding_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  monthly_payment DECIMAL(12, 2) DEFAULT 0,
  interest_rate DECIMAL(5, 2) DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create net_worth_snapshots table
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  total_assets DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_liabilities DECIMAL(12, 2) NOT NULL DEFAULT 0,
  equity DECIMAL(12, 2) NOT NULL DEFAULT 0,
  assets_breakdown JSONB,
  liabilities_breakdown JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, record_date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_category_id ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_user_id ON liabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_type_id ON liabilities(type_id);
CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_user_id ON net_worth_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_record_date ON net_worth_snapshots(record_date);

-- Enable Row Level Security
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE liability_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "own_data" ON asset_categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON liability_types FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON assets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON liabilities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON net_worth_snapshots FOR ALL USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_liabilities_updated_at
  BEFORE UPDATE ON liabilities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Done! Tables created with RLS policies
-- Next step: Run auto-seed migration to populate default categories and types
