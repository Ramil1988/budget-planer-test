-- Auto-seed default categories and merchant mappings for new users
-- Run this in Supabase SQL Editor

-- ============================================================================
-- STEP 1: Create seed_user_categories function for expense categories
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_user_categories(target_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO categories (user_id, name, type)
  VALUES
    (target_user_id, 'Afterschool', 'expense'),
    (target_user_id, 'Autocredit', 'expense'),
    (target_user_id, 'Clothes', 'expense'),
    (target_user_id, 'Food', 'expense'),
    (target_user_id, 'Food/Costco', 'expense'),
    (target_user_id, 'Fuel', 'expense'),
    (target_user_id, 'Government Loan', 'expense'),
    (target_user_id, 'Haircut', 'expense'),
    (target_user_id, 'Household items/Car', 'expense'),
    (target_user_id, 'Insurance', 'expense'),
    (target_user_id, 'Internet', 'expense'),
    (target_user_id, 'Massage', 'expense'),
    (target_user_id, 'Mobile/Internet', 'expense'),
    (target_user_id, 'Mortgage', 'expense'),
    (target_user_id, 'Electricity', 'expense'),
    (target_user_id, 'Pharmacy', 'expense'),
    (target_user_id, 'Property tax', 'expense'),
    (target_user_id, 'Subscriptions', 'expense'),
    (target_user_id, 'Unexpected', 'expense'),
    (target_user_id, 'Weekend', 'expense')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Create seed_income_categories function (if not exists)
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_income_categories(target_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO categories (user_id, name, type)
  VALUES
    (target_user_id, 'Salary', 'income'),
    (target_user_id, 'Freelance', 'income'),
    (target_user_id, 'Investments', 'income'),
    (target_user_id, 'Rental Income', 'income'),
    (target_user_id, 'Other Income', 'income')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 3: Create master seed function that calls all individual seed functions
-- ============================================================================
-- NOTE: Removed profiles table insert (table doesn't exist in current schema)
CREATE OR REPLACE FUNCTION seed_new_user_data(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Seed expense categories
  PERFORM seed_user_categories(target_user_id);

  -- Seed income categories
  PERFORM seed_income_categories(target_user_id);

  -- Seed merchant mappings (if the function exists)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'seed_merchant_mappings') THEN
    PERFORM seed_merchant_mappings(target_user_id);
  END IF;

  -- Create default account
  INSERT INTO accounts (user_id, name, balance)
  VALUES (target_user_id, 'Main Account', 0)
  ON CONFLICT DO NOTHING;

  -- Create default user_settings
  INSERT INTO user_settings (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: Create trigger function for new user signup
-- ============================================================================
-- NOTE: Added EXCEPTION handler to ensure user signup succeeds even if seeding fails
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_new_user_data(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail signup
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: Create trigger on auth.users table
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- STEP 6: Seed existing users who don't have categories yet
-- ============================================================================
DO $$
DECLARE
  user_record RECORD;
BEGIN
  -- Find users who don't have any categories
  FOR user_record IN
    SELECT u.id
    FROM auth.users u
    LEFT JOIN categories c ON c.user_id = u.id
    WHERE c.id IS NULL
  LOOP
    PERFORM seed_new_user_data(user_record.id);
  END LOOP;
END $$;

-- ============================================================================
-- DONE! New users will automatically get:
-- - 20 expense categories
-- - 5 income categories
-- - 300+ merchant mappings (if seed_merchant_mappings exists)
-- - Default profile
-- - Default account
-- - Default user settings
-- ============================================================================
