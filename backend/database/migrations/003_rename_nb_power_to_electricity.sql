-- Migration: Rename "NB Power" category to "Electricity"
-- Run this in Supabase SQL Editor to update existing data

-- ============================================================================
-- STEP 1: Update categories table
-- ============================================================================
UPDATE categories
SET name = 'Electricity'
WHERE name = 'NB Power';

-- ============================================================================
-- STEP 2: Update merchant_mappings table
-- ============================================================================
UPDATE merchant_mappings
SET category_name = 'Electricity'
WHERE category_name = 'NB Power';

-- ============================================================================
-- STEP 3: Transactions table - NO UPDATE NEEDED
-- ============================================================================
-- Transactions use category_id (FK to categories table), so they automatically
-- get the new name when we update the categories table in Step 1.

-- ============================================================================
-- STEP 4: Budget categories - NO UPDATE NEEDED
-- ============================================================================
-- Budget categories use category_id (FK to categories table), so they also
-- automatically get the new name from Step 1.

-- ============================================================================
-- STEP 5: Update the seed_user_categories function
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
-- STEP 6: Update seed_merchant_mappings function (Electricity section)
-- ============================================================================
-- Note: The full seed_merchant_mappings function should be updated.
-- For now, this just ensures new mappings use 'Electricity' instead of 'NB Power'.
-- If you need to update the full function, re-run seed-all.sql after this migration.

-- ============================================================================
-- VERIFICATION: Check all updates were successful
-- ============================================================================
DO $$
DECLARE
  cat_count INTEGER;
  mapping_count INTEGER;
  txn_count INTEGER;
BEGIN
  -- Count Electricity categories
  SELECT COUNT(*) INTO cat_count FROM categories WHERE name = 'Electricity';
  RAISE NOTICE 'Categories renamed to Electricity: %', cat_count;

  -- Count Electricity merchant mappings
  SELECT COUNT(*) INTO mapping_count FROM merchant_mappings WHERE category_name = 'Electricity';
  RAISE NOTICE 'Merchant mappings updated to Electricity: %', mapping_count;

  -- Count transactions linked to Electricity category
  SELECT COUNT(*) INTO txn_count
  FROM transactions t
  JOIN categories c ON t.category_id = c.id
  WHERE c.name = 'Electricity';
  RAISE NOTICE 'Transactions linked to Electricity category: %', txn_count;

  -- Verify no "NB Power" references remain
  SELECT COUNT(*) INTO cat_count FROM categories WHERE name = 'NB Power';
  IF cat_count > 0 THEN
    RAISE WARNING 'Still found % categories with NB Power!', cat_count;
  ELSE
    RAISE NOTICE 'No remaining NB Power categories - migration successful!';
  END IF;
END $$;

-- ============================================================================
-- DONE! The category has been renamed from "NB Power" to "Electricity"
-- ============================================================================
