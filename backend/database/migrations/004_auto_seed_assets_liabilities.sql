-- Migration: Auto-seed Assets & Liabilities Categories
-- Created: 2026-01-21
-- Description: Automatically creates default asset categories and liability types for new users

-- Function to auto-seed asset categories and liability types for new users
CREATE OR REPLACE FUNCTION auto_seed_asset_liability_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default asset categories
  INSERT INTO asset_categories (user_id, name, icon) VALUES
    (NEW.id, 'Real Estate', '🏠'),
    (NEW.id, 'Cash', '💵'),
    (NEW.id, 'Savings Account', '🏦'),
    (NEW.id, 'RRSP', '📊'),
    (NEW.id, 'TFSA', '💼'),
    (NEW.id, 'Vehicle', '🚗'),
    (NEW.id, 'Investment', '📈'),
    (NEW.id, 'Other Assets', '💎');

  -- Insert default liability types
  INSERT INTO liability_types (user_id, name, icon) VALUES
    (NEW.id, 'Mortgage', '🏡'),
    (NEW.id, 'Car Loan', '🚙'),
    (NEW.id, 'Student Loan', '🎓'),
    (NEW.id, 'Credit Card', '💳'),
    (NEW.id, 'Personal Loan', '💰'),
    (NEW.id, 'Line of Credit', '📝'),
    (NEW.id, 'Other Debt', '💸');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the profiles insert / user signup
  RAISE WARNING 'auto_seed_asset_liability_data failed for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-seed data when a new user signs up
-- Uses auth.users instead of profiles to avoid dependency on profiles table existing
DROP TRIGGER IF EXISTS auto_seed_asset_liability_trigger ON auth.users;
CREATE TRIGGER auto_seed_asset_liability_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_seed_asset_liability_data();

-- Backfill existing users (if they don't have categories/types)
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    -- Check if user has asset categories
    IF NOT EXISTS (SELECT 1 FROM asset_categories WHERE user_id = user_record.id) THEN
      INSERT INTO asset_categories (user_id, name, icon) VALUES
        (user_record.id, 'Real Estate', '🏠'),
        (user_record.id, 'Cash', '💵'),
        (user_record.id, 'Savings Account', '🏦'),
        (user_record.id, 'RRSP', '📊'),
        (user_record.id, 'TFSA', '💼'),
        (user_record.id, 'Vehicle', '🚗'),
        (user_record.id, 'Investment', '📈'),
        (user_record.id, 'Other Assets', '💎');
    END IF;

    -- Check if user has liability types
    IF NOT EXISTS (SELECT 1 FROM liability_types WHERE user_id = user_record.id) THEN
      INSERT INTO liability_types (user_id, name, icon) VALUES
        (user_record.id, 'Mortgage', '🏡'),
        (user_record.id, 'Car Loan', '🚙'),
        (user_record.id, 'Student Loan', '🎓'),
        (user_record.id, 'Credit Card', '💳'),
        (user_record.id, 'Personal Loan', '💰'),
        (user_record.id, 'Line of Credit', '📝'),
        (user_record.id, 'Other Debt', '💸');
    END IF;
  END LOOP;
END $$;

-- Done! Default asset categories and liability types will be created automatically for all new users
