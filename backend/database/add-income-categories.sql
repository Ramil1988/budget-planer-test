-- Add Income Categories for existing users
-- Run this in Supabase SQL Editor

-- Create a function to seed income categories for any user
CREATE OR REPLACE FUNCTION seed_income_categories(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Standard income categories
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

-- Seed income categories for all existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    PERFORM seed_income_categories(user_record.id);
  END LOOP;
END $$;

-- The seed_income_categories() function is now available for new users
-- You can call it in a trigger or manually when a user signs up
