-- Complete seed script for merchant mappings from user's transaction data
-- This creates a direct transaction description to category mapping

-- Step 1: Drop existing merchant_mappings table if exists
DROP TABLE IF EXISTS merchant_mappings;

-- Step 2: Create merchant_mappings table
CREATE TABLE merchant_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_description TEXT NOT NULL,
  category_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, transaction_description)
);

-- Step 3: Enable RLS
ALTER TABLE merchant_mappings ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS Policy
DROP POLICY IF EXISTS "own_data" ON merchant_mappings;
CREATE POLICY "own_data" ON merchant_mappings FOR ALL USING (auth.uid() = user_id);

-- Step 5: Create function to seed merchant mappings for any user
CREATE OR REPLACE FUNCTION seed_merchant_mappings(target_user_id UUID)
RETURNS void AS $$
DECLARE
  mapping_data RECORD;
BEGIN
  -- Afterschool
  FOR mapping_data IN (VALUES
    ('DANSE  CHAOS DANCE'),
    ('DANSE CHAOS'),
    ('DANSE CHAOS DANCE'),
    ('DAYCARE'),
    ('GARDERIE LA MARELLE DAYCARE'),
    ('LA MARELLE'),
    ('LE GARDE'),
    ('LE GARDE AMIS'),
    ('LE GARDE AMIS INC'),
    ('LE GARDE AMIS INC.')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Afterschool')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Autocredit
  FOR mapping_data IN (VALUES
    ('AUTOCREDIT'),
    ('LOAN PAYMENT')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Autocredit')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Clothes
  FOR mapping_data IN (VALUES
    ('#379  SPORT CHEK'),
    ('#379 SPORT CHEK DIEPP'),
    ('ADIDAS'),
    ('ADIDAS CA'),
    ('AERIE'),
    ('APOS EDDIE BAUER CAN DIEPPE'),
    ('APOS H M CA #049 - C     DIEPP'),
    ('APOS HS EMPIRE DIEPP'),
    ('APOS LAWTONS #147        MONCT'),
    ('APOS SQ *EMILY DOWE      MONCT'),
    ('ARDENE'),
    ('BANANA REPUBLIC'),
    ('BASS PRO SHOP'),
    ('BASS PRO SHOP #84 DIEPPE'),
    ('BASS PRO SHOP #84 DIEPPE, NB'),
    ('BENTLEY #055 DIEPPE'),
    ('COSTO CLOTHES'),
    ('DSW #535'),
    ('DSW #535 MONCTON'),
    ('DYNAMITE'),
    ('ENVY'),
    ('H&M'),
    ('H&M HENNES & MAURITZ I TORONTO, ON'),
    ('HM'),
    ('HM HENNES MAURITZ'),
    ('HM HENNES MAURITZ I TORONTO'),
    ('HM HENNES MAURITZ I TORONTO, ON'),
    ('HOPEWELL ROCKS HOPEWELL CAPE, NB'),
    ('HS EMPIRE DIEPPE, NB'),
    ('LULULEMONCOM*'),
    ('MARSHALLS 730 MONCTON, NB'),
    ('ROOTS'),
    ('RW & CO. #2205 DIEPPE, NB'),
    ('SHEENPLACE COM'),
    ('SKECHERS'),
    ('SPIRIT HALLOWEEN'),
    ('SQ *FRANCA RHYTHMIC GYMNA'),
    ('TOMMY HILFIGER #725 MONCTON'),
    ('TOMMY HILFIGER TORONTO, ON'),
    ('WWW COSTCO CA 888-426-7826, ON'),
    ('ZARA'),
    ('ZARA.COM FREDERICTON'),
    ('ZARA.COM FREDERICTON, NB')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Clothes')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Food
  FOR mapping_data IN (VALUES
    ('APOS ALDO #1121          DIEPP'),
    ('APOS ARDENE #083         DIEPP'),
    ('APOS COOP DE DIEPPE      DIEPP'),
    ('APOS COOP DE DIEPPE DIEPP'),
    ('APOS COOP DE DIEPPE DIEPPE NBCA'),
    ('APOS COSTCO WHOLESAL MONCT'),
    ('APOS DAVID''S TEA #01     DIEPP'),
    ('APOS NAYAX CANADA IN FREDE'),
    ('APOS SOBEYS #515 DIEPP'),
    ('APOS SQ *BMM CANTEEN DIEPP'),
    ('APOS TASTE OF HOMELA     MONCT'),
    ('APOS THE HOME DEPOT MONCT'),
    ('APOS WALMART STORE #     DIEPP'),
    ('APOS WALMART STORE #     MONCT'),
    ('APOS WALMART STORE # DIEPP'),
    ('APOS WALMART STORE # DIEPPE NBCA'),
    ('COOP'),
    ('COOP DE DIEPPE'),
    ('COOP DE DIEPPE DIEPP'),
    ('COOP DE DIEPPE DIEPPE, NB'),
    ('COOP DIEPPE'),
    ('DAVID''S TEA'),
    ('DOLMA FOOD MONCTON'),
    ('HARDY S PRODUCE MONCTON'),
    ('HARDY S PRODUCE MONCTON, NB'),
    ('MONCTON  SUPERSTORE 350'),
    ('MONCTON SUPERSTORE'),
    ('MONCTON SUPERSTORE 350 MONCTON'),
    ('MONCTON SUPERSTORE 350 MONCTON, NB'),
    ('MONCTON TRINITY SUPERS'),
    ('NBCC - BOOKSTORE MONCTON, NB'),
    ('RASS'),
    ('RASS  7526'),
    ('RASS 7526'),
    ('RASS 7526 DIEPPE'),
    ('RASS 7526 DIEPPE, NB'),
    ('SOBEYS'),
    ('SOBEYS #348 MONCTON, NB'),
    ('SOBEYS #515 DIEPPE'),
    ('SOBEYS #756 MONCTON'),
    ('SOBEYS #756 MONCTON, NB'),
    ('SQ *LA FACTRIE MONCTON NB'),
    ('SQ *LA MAISON DE JEUNE   DIEPP'),
    ('SUPERSTORE'),
    ('TASTE OF HOMELAND'),
    ('TASTE OF HOMELAND MONCTON'),
    ('TASTE OF HOMELAND MONCTON, NB'),
    ('WAL-MART #3056 DIEPPE'),
    ('WAL-MART #3056 DIEPPE, NB'),
    ('WAL-MART #3659 MONCTON'),
    ('WAL-MART ONLINE PHOTO MISSISSAUGA, ON'),
    ('WAL*MART CANADA INC'),
    ('WALMART'),
    ('WITHDRAWAL FREE INTERAC')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Food')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Food/Costco
  FOR mapping_data IN (VALUES
    ('APOS COSTCO WHOLESAL     MONCT'),
    ('COSTCO'),
    ('COSTCO  WHOLESALE W1345'),
    ('COSTCO WHOLESALE'),
    ('COSTCO WHOLESALE W1345'),
    ('COSTCO WHOLESALE W1345   MONCT'),
    ('COSTCO WHOLESALE W1345 MONCT'),
    ('COSTCO WHOLESALE W1345 MONCTO'),
    ('COSTCO WHOLESALE W1345 MONCTON'),
    ('COSTCO WHOLESALE W1345 MONCTON NBCA'),
    ('COSTCO WHOLESALE W1345 MONCTON, NB')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Food/Costco')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Fuel
  FOR mapping_data IN (VALUES
    ('CIRCLE K / IRVI SAINT'),
    ('CIRCLE K / IRVING #202 DIEPP'),
    ('CIRCLE K / IRVING #2084 TRURO NS'),
    ('CIRCLE K / IRVING QPS'),
    ('CIRCLE K / IRVING QPS #2PETITCODIAC NB'),
    ('COSTCO  GAS W1345'),
    ('COSTCO GAS'),
    ('COSTCO GAS W1345'),
    ('COSTCO GAS W1345         MONCT'),
    ('COSTCO GAS W1345 MONCT'),
    ('COSTCO GAS W1345 MONCTON'),
    ('COSTCO GAS W1345 MONCTON NBCA'),
    ('COSTCO GAS W1345 MONCTON, NB'),
    ('COUCHE TARD - QUEBEC QC'),
    ('IRVING'),
    ('PETRO CANADA'),
    ('ULTRAMAR'),
    ('ULTRAMAR #12651')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Fuel')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Government Loan
  FOR mapping_data IN (VALUES
    ('NSLC'),
    ('NSLSC')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Government Loan')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Haircut
  FOR mapping_data IN (VALUES
    ('AMIFADES BARBER SHEDI'),
    ('AMIFADÉS BARBER SHEDI'),
    ('APOS HALF TIME DIEPP'),
    ('APOS HALF TIME DIEPPE NBCA'),
    ('APOS LE BARBU            DIEPP'),
    ('CHARLES STEVENS HA'),
    ('HAIRCUT'),
    ('HALF TIME'),
    ('HALF TIME DIEPPE NBCA'),
    ('MAVERICK BARBER'),
    ('MAVERICK BARBER MUSQU'),
    ('SQ *506NICOLE SAINT-ANTOINE'),
    ('SQ *CHARLES STE MONCTON NBCA'),
    ('SQ *CHARLES STEVENS'),
    ('SQ CHARLES STEVENS')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Haircut')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Household items/Car
  FOR mapping_data IN (VALUES
    ('AMAZON'),
    ('AMZN  MKTP CA'),
    ('AMZN MKTP'),
    ('APOS CANADIAN TIRE'),
    ('APOS CANADIAN TIRE # MONCT'),
    ('APOS DOLLARAMA # 156     MONCT'),
    ('APOS DOLLARAMA #1020     DIEPP'),
    ('APOS DOLLARAMA #1020 DIEPP'),
    ('APOS DOLLARAMA #1020 DIEPPE'),
    ('APOS DOLLARAMA #1020 DIEPPE NBCA'),
    ('APOS DOLLARAMA #1365     DIEPP'),
    ('APOS DOLLARAMA #1365 DIEPP'),
    ('APOS DOLLARAMA #1428 MONCT'),
    ('APOS ECLIPSE #041        DIEPP'),
    ('APOS KENT HARRISVILL'),
    ('APOS KENT HARRISVILL     MONCT'),
    ('APOS KENT HARRISVILL MONCT'),
    ('APOS MICHAELS #3939 MONCT'),
    ('APOS RUBBER DUCK CAR     DEIPP'),
    ('APOS RUBBER DUCK CAR DEIPPE'),
    ('APOS RUBBER DUCK CAR DEIPPE NBCA'),
    ('APOS RUBBERDUCK CAR DIEPP'),
    ('APOS STAPLES #242        MONCT'),
    ('APOS STAPLES #242 MONCT'),
    ('APOS THE BONE AND BI     MONCT'),
    ('BEST BUY #81             MONCT'),
    ('BEST BUY #81 MONCTON, NB'),
    ('CANADIAN TIRE'),
    ('CANADIAN TIRE #063'),
    ('CANADIAN TIRE #63        MONCT'),
    ('CANADIAN TIRE #647'),
    ('CDN TIRE STORE #00063'),
    ('CDN TIRE STORE #00063 DIEPPE NB'),
    ('CDN TIRE STORE #00063 DIEPPE, NB'),
    ('CDN TIRE STORE #00249 MONCTON NB'),
    ('COSTCO - CHAIR'),
    ('COSTCO HOUSEHOLD'),
    ('DOLLARAMA'),
    ('DOLLARAMA # 208 MONCTON NB'),
    ('DOLLARAMA #1020'),
    ('DOLLARAMA #1020 DIEPPE'),
    ('DOLLARAMA #1020 DIEPPE, NB'),
    ('DOLLARAMA #1199 MONCTON'),
    ('DOLLARAMA #1199 MONCTON, NB'),
    ('DOLLARAMA #1365'),
    ('DOLLARAMA #1365 DIEPP'),
    ('DOLLARAMA #1365 DIEPPE'),
    ('DOLLARAMA #1428 MONCTON, NB'),
    ('GLOBAL PET'),
    ('GLOBAL PET FOOD DIEPP'),
    ('GLOBAL PET FOODS DIEPPE'),
    ('HARVEY STUDIOS 506-459-2322, NB'),
    ('HONDA'),
    ('IKEA.CA'),
    ('KENT'),
    ('KENT HARRISVILL MONCT'),
    ('KENT MONCTON MONCTON'),
    ('LINEN CHEST'),
    ('MACARTHUR''S NUR'),
    ('MACARTHUR''S NURSERIES INCMONCTON NB'),
    ('MACARTHUR''S NURSERIES MONCTON'),
    ('MARITIME SOURCE DARTM'),
    ('MICHAELS #3939 MONCTON'),
    ('MOBILE SNAP'),
    ('MOBILING'),
    ('MONCTON HONDA'),
    ('OPOS AMAZON.CA           AMAZO'),
    ('OPOS AMZN MKTP CA        WWW.A'),
    ('PROCARE PLUMBING MONCTON NB'),
    ('RALLYE MOTORS HYUNDAI'),
    ('REN''S PETS DIEPPE DIEPPE'),
    ('RUBBER  DUCK CAR WASH'),
    ('RUBBER DUCK CAR'),
    ('RUBBER DUCK CAR DIEPP'),
    ('RUBBER DUCK CAR WASH DEIPPE'),
    ('SERVICE NB - ONLINE FREDE'),
    ('SHOPPERS DRUG M DIEPPE NBCA'),
    ('TECHNOANT'),
    ('VILLE DIEPPE'),
    ('VILLECITYDIEPPE 5068777900 NB'),
    ('VILLEDIEPPE'),
    ('WWW COSTCO CA 888-426-7826, ON'),
    ('WWW.CANADIANTIRE.CA')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Household items/Car')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Insurance
  FOR mapping_data IN (VALUES
    ('CO-OPERATORS'),
    ('MANULIFE'),
    ('THE CO OPERATORS'),
    ('THE CO-OPERATORS'),
    ('THE CO-OPERATORS CSI'),
    ('THE CO-OPERATORS CSI GUELPH ON')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Insurance')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Internet
  FOR mapping_data IN (VALUES
    ('MB-ROGERS'),
    ('PC-ROGERS')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Internet')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Massage
  FOR mapping_data IN (VALUES
    ('APOS BACK TO WELLNES MONCT'),
    ('APOS HALF TIME           DIEPP'),
    ('APOS MARITIME MEDICA'),
    ('APOS MARITIME MEDICA     MONCT'),
    ('APOS MARITIME MEDICA MONCT'),
    ('APOS MYOKINESIS DIEP DIEPPE NBCA'),
    ('BACK TO WELLNESS'),
    ('MARITIME MEDICAL MASSA MONCT'),
    ('MARITIME MEDICAL MASSA MONCTON, NB'),
    ('MASSAGE'),
    ('MASSAGE EXPERTS DIEPPE'),
    ('MYOKINESIS')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Massage')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Mobile/Internet
  FOR mapping_data IN (VALUES
    ('ROGERS'),
    ('ROGERS ******8681'),
    ('ROGERS WIRELESS PRE-AUTH DR')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Mobile/Internet')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Mortgage
  FOR mapping_data IN (VALUES
    ('FN')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Mortgage')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Electricity
  FOR mapping_data IN (VALUES
    ('MB-ENERGIE NB POWER'),
    ('NB POWER'),
    ('PC-ENERGIE NB POWER'),
    ('TS-ENERGIE NB POWER')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Electricity')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Pharmacy
  FOR mapping_data IN (VALUES
    ('APOS DIEPPE GUARDIAN     DIEPP'),
    ('APOS DIEPPE GUARDIAN DIEPP'),
    ('APOS JEAN COUTU  129     DIEPP'),
    ('APOS JEAN COUTU  337     DIEPP'),
    ('APOS JEAN COUTU #337 DIEPP'),
    ('APOS JEAN COUTU 129 DIEPP'),
    ('APOS JEAN COUTU 337 DIEPP'),
    ('APOS JEAN COUTU 337 DIEPPE'),
    ('APOS REGIE REG. DE L MONCT'),
    ('APOS SHOPPERS DRUG M     DIEPP'),
    ('APOS SHOPPERS DRUG M     MONCT'),
    ('APOS SHOPPERS DRUG M DIEPP'),
    ('BATH & BODY WORKS DIEPPE, NB'),
    ('DIEPPE GUARDIAN'),
    ('GLOBAL PET FOODS'),
    ('IHERB'),
    ('IHERB IHERB.COM 9516163600, CA'),
    ('IHERB IHERB.COM IHERB.COM'),
    ('JEAN COUTU'),
    ('JEAN COUTU 129 DIEPPE, NB'),
    ('JEAN COUTU 337 DIEPPE'),
    ('JEAN COUTU 337 DIEPPE, NB'),
    ('REN''S PETS DIEPPE DIEPPE, NB'),
    ('SHOPPERS'),
    ('SHOPPERS DRUG'),
    ('SHOPPERS DRUG MART'),
    ('SHOPPERS DRUG MART #01 MONCTON'),
    ('SHOPPERS DRUG MART #18 MONCTON, NB'),
    ('SHOPPERS DRUG MART #20 DIEPPE'),
    ('SHOPPERS DRUG MART #58 MONCTON, NB'),
    ('SP ETERNAL MUSE HAVANT, LND')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Pharmacy')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Property tax
  FOR mapping_data IN (VALUES
    ('PNB FINANCE'),
    ('PNB-FINANCE(S)'),
    ('TAXES')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Property tax')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Subscriptions
  FOR mapping_data IN (VALUES
    ('ABACUS AI - CA'),
    ('ANNUAL FEE'),
    ('APPLE'),
    ('APPLE.COM/BILL'),
    ('APPLE.COM/BILL 866-712-7753 ON'),
    ('CHATGPT'),
    ('CHATGPT SUBSCRIPTION HTTPSOPENAI.CCA AMT 23.00'),
    ('CHATGPT SUBSCRIPTION OPENAI.COM CA AMT 23.00'),
    ('CLAUDE'),
    ('CLAUDE AI'),
    ('CLAUDE AI SUBSCRIPTION'),
    ('CLAUDE.AI SUBSCRIPTION'),
    ('FIT4LESS BY GOODLIFE'),
    ('FITNESS'),
    ('GOOGLE *SERVICES'),
    ('GOOGLE *TEMPORARY HOLD'),
    ('GOOGLE CLOUD'),
    ('MB-CREDIT CARD/LOC PAY.'),
    ('MIDJOURNEY INC.'),
    ('NETLIFY'),
    ('RENDER'),
    ('RENDER.COM HTTPSRENDER.CCA AMT 6.42'),
    ('RENDER.COM HTTPSRENDER.CCA AMT 7.00'),
    ('THE CO-OPERATORS CSI')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Subscriptions')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Unexpected
  FOR mapping_data IN (VALUES
    ('#351 MARK''S DIEPPE, NB'),
    ('A-PLUS REGISTRY SRVS 888-4607771 AB'),
    ('AMZN MKTP CA'),
    ('APOS ALDO 1121           DIEPPE     NBCA'),
    ('APOS BENTLEY #055        DIEPPE     NBCA'),
    ('APOS FURNACE ROOM MONCT'),
    ('APOS GREATER MONCTON DIEPP'),
    ('APOS VILLE DE DIEPPE DIEPP'),
    ('ARAMARK/MONCTON DIEPP'),
    ('ATLANTIC IMPLANTS'),
    ('AVATAR WORLD'),
    ('BACK TO WELLNESS'),
    ('BOUTIQUE WI'),
    ('CANADIAN MUSEUM'),
    ('CHAMPLAIN'),
    ('CHARLES STEVENS'),
    ('CIRCLE K'),
    ('CIRCLE K / IRVING #202   DIEPPE     NBCA'),
    ('CITY OF DIEPPE'),
    ('CLINIQUE DENTAIRE PRIS'),
    ('CLINIQUE DENTAIRE PRIS MONCTON'),
    ('CLINIQUE DENTAIRE PRISMA'),
    ('CO PAIN ARTISAN BREAD MONCTON, NB'),
    ('COSTCO WHOLESALE W1345 MONCTON1'),
    ('COUCHE-TARD'),
    ('DOLLARAMA # 156 MONCTON, NB'),
    ('DR. DAVID CAMPBELL MONCTON NB'),
    ('DR. NACH DANIEL PROFES'),
    ('E-TRANSFER'),
    ('EAST COAST PEDIATRIC D MONCTON'),
    ('EAST COAST PEDIATRIC DENT'),
    ('EB  GAMES 878'),
    ('ECOLE AMIRAULT'),
    ('ECOLE LE MARAIS'),
    ('EPICVIN'),
    ('FEVER* CANDLELIGHT VI CANADA, BC'),
    ('FIT4LESS'),
    ('FREE INTERAC E-TRANSFER'),
    ('FRESHA KRYSTEL MEDISPA'),
    ('GCDS616 MONCTON'),
    ('GIANT TIGER'),
    ('GIFTS TO PARENTS'),
    ('GLAMOUR SECRETS'),
    ('GLO SMILE DIEPPE INC DIEPPE NB'),
    ('GLOBAL PET FOOD'),
    ('GLOW GARDENS'),
    ('GODADDY'),
    ('GOOGLE *TOCA BOCA WORL'),
    ('GOOGLE TOCA BOCA'),
    ('HUSHED'),
    ('INTERAC E-TRANSFER'),
    ('IROLL'),
    ('KRYSTEL MEDISPA'),
    ('LE PAYS DE LA SAGOUINE'),
    ('LE SALON DIEPPE'),
    ('LES FLEURS'),
    ('LIBERAL PARTY OF CANADA'),
    ('LL BEAN MONCTON DIEEPE, NB'),
    ('MIKES BIKE SHOP DIEPPE'),
    ('MOUNTAIN VIEW DENTAL GROUMONCTON NB'),
    ('MOUNTAIN VIEW DENTAL PROFMONCTON NB'),
    ('NBCA'),
    ('OPENAI OPENAI.COM CA AMT 11.50'),
    ('OPOS AMAZON.CA SEATT'),
    ('OPOS PAYPAL *VHCLREPORT 40293'),
    ('PARTENAIRE DUMO MONCT'),
    ('PAYPAL *NB CARES 4029357733 NB'),
    ('PEGASUS SCHOOL'),
    ('PEGASUS SCHOOL IMAGES'),
    ('PUROLATOR'),
    ('RIVERVIEW ARTS CENTRE'),
    ('ROBLOX'),
    ('SACKVILLE SMILES SACKVILLE NB'),
    ('SALON BOHEME'),
    ('SEPHORA'),
    ('SEPHORA MONCTON DIEPPE, NB'),
    ('SEPHORA.CA SEPHORA.CA'),
    ('SERVICE CANADA MONCTON'),
    ('SERVICE NB'),
    ('SERVICE NB - ONLINE'),
    ('SERVICE NB - ONLINE / EN FREDERICTON NB'),
    ('SERVICE NEW BRUNSWICK'),
    ('SHOPPERS DRUG MART #53'),
    ('SNB-MONCTON'),
    ('SNB-MONCTON MONCTON NB'),
    ('SNB-MONCTON MONCTON, NB'),
    ('SQ *AIRCAB INC DIEPPE, NB'),
    ('SQ *AIRCAB INC MONCTON'),
    ('SQ *CHARLES STEVENS HA MONCTON'),
    ('SQ *CHARLES STEVENS HA MONCTON, NB'),
    ('SQ *ECOLE AMIRAULT'),
    ('SQ *MONCTON MUS'),
    ('ST. JAMES GATE DIEPPE'),
    ('STAPLES'),
    ('THE BONE & BISCUIT - G MONCTON'),
    ('THE CHILDREN''S PLACE'),
    ('TICKETMASTER CANADA'),
    ('TICKETMASTER CANADA HO TORONTO, ON'),
    ('TIDE & BOAR BREWING MONCTON'),
    ('TOCA BOCA'),
    ('TOCA BOCA WORL'),
    ('TOCA BOCA WORLD'),
    ('TOCA LIFE WORL'),
    ('TOYS "R" US #3556 DIEPPE'),
    ('TRELLO'),
    ('TRUEMAN BLUEBER'),
    ('ULTRAMAR #12651 DIEPPE NB'),
    ('ULTRAMAR BRIAN''S'),
    ('URBAN PLANET'),
    ('VILLE DE DIEPPE'),
    ('VILLEDEDIEPPE'),
    ('VISTAPRINT CANADA CORP'),
    ('WALMART.CA MISSISSAUGA'),
    ('WANDER PRINTS'),
    ('WITHDRAWAL'),
    ('WWW.HRBLOCK.CA CALGARY AB'),
    ('ZEFFY CARMA')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Unexpected')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Weekend
  FOR mapping_data IN (VALUES
    ('ABM WITHDRAWAL'),
    ('ACADIE POP'),
    ('AD FREE FOR PRIMEVIDPRIME'),
    ('AIPS SKIPTHE DISHES WINNI'),
    ('AIRCAB INC DIEPPE'),
    ('AKADI LUMINA'),
    ('AL SALAM CO RIVERVIEW'),
    ('AMAZON PRIME'),
    ('APOS ASA SUSHI MONCT'),
    ('APOS AVENIR CENTRE MONCT'),
    ('APOS CIRCLE K / IRVI     RIVER'),
    ('APOS COKE_51377041 HOPEWELL CANBCA'),
    ('APOS CONFEDERATION C CHARLOTTETOPECA'),
    ('APOS DOMINO''S PIZZA DIEPPE'),
    ('APOS FUNDY NATIONAL FUNDY'),
    ('APOS FUNDY`S CAPE EN     WATER'),
    ('APOS HOP SKIP JUMP MONCT'),
    ('APOS HOPEWELL ROCKS HOPEW'),
    ('APOS JM''S CONVENIENC MONCT'),
    ('APOS KINGS LANDING PRINC'),
    ('APOS LOLI CAFE LOU MONCT'),
    ('APOS MCDONALD''S #115 MONCT'),
    ('APOS MCDONALD''S #151     DIEPP'),
    ('APOS MCDONALD''S #151 DIEPP'),
    ('APOS MCDONALD''S #155     MONCT'),
    ('APOS MCDONALD''S #260     SAINT'),
    ('APOS MCDONALD''S #404     DIEPP'),
    ('APOS MCDONALD''S #404 DIEPP'),
    ('APOS MCDONALD''S #404 DIEPPE'),
    ('APOS MCDONALD''S #404 DIEPPE NBCA'),
    ('APOS MCDONALD''S #408     MONCT'),
    ('APOS MCDONALD''S #795 SAINT'),
    ('APOS PAPA JOHN''S PIZ DIEPP'),
    ('APOS PIZZA DELIGHT       DIEPP'),
    ('APOS PIZZA DELIGHT - SHEDIAC'),
    ('APOS PIZZA DELIGHT B     BOUCT'),
    ('APOS PIZZA DELIGHT B BOUCT'),
    ('APOS SQ *LE PAYS DE BOUCT'),
    ('APOS STARBUCKS COFFE DIEPP'),
    ('APOS TIM HORTONS #18 DIEPP'),
    ('APOS TIM HORTONS #28 DIEPP'),
    ('APOS ZOO MONCT'),
    ('AVENIR  CENTRE'),
    ('AVENIR CENTRE MONCTON'),
    ('AVENIR CENTRE MONCTON, NB'),
    ('BKG*BOOKING.COM HOTEL'),
    ('BOTROW'),
    ('BOUTIQUE STADACONE - QUEBEC'),
    ('BOWLARAMA'),
    ('BROTHERS 2 SUMMERSIDE'),
    ('BV HOTEL B MT'),
    ('CAFE COGNITO'),
    ('CANADA''S BEST VALUE INN &CHARLOTTETOWNPE'),
    ('CANVAS'),
    ('CAPITOL THEATRE MONCTON'),
    ('CARRABBA''S ITALIAN G MONCTON'),
    ('CARRABBA''S ITALIAN GRI'),
    ('CAVOK BREWING'),
    ('CIMP21 HALIFAX, NS'),
    ('CINEPLEX'),
    ('CINEPLEX #6110'),
    ('CINEPLEX #6110 DIEPPE'),
    ('CINEPLEX 8030 WEB Q'),
    ('CINEPLEX 8030 WEB QPS'),
    ('CKS ON THE WAY - FLORENCEVILLE'),
    ('CLAIRE''S'),
    ('COASTAL INN HALIFAX HALIFAX, NS'),
    ('COUCHE TARD - QUEBEC'),
    ('COWS QUEEN STREET CHARLOTTETOWN'),
    ('DOMINO''S PIZZA #10905'),
    ('DOMINO''S PIZZA #10905 DIEPPE, NB'),
    ('DOMINO''S PIZZA DIEPP'),
    ('DUCKY''S'),
    ('EASTSIDE MARIOS FREDER FREDERICTON, NB'),
    ('FUNDY NATIONAL PARK'),
    ('FUNDY TRAIL'),
    ('GRANNAN''S SEAFO SAINT'),
    ('GRANNAN''S SEAFOOD'),
    ('HALIFAX INTL AI'),
    ('HAPPY CRAFT BREWING'),
    ('HARVEST CLEAN'),
    ('HIE FREDERICTON'),
    ('HILLSIDE ENTERTAINMENT LUTES MOUNTAI'),
    ('HOPEWELL ROCKS'),
    ('HOPEWELL ROCKS MOTEL'),
    ('HOTEL LE VOYAGEUR - QUEBEC'),
    ('JIMS FAMILY RESTAURANT HALIFAX, NS'),
    ('KINGS LANDING'),
    ('KURO SUSHI SHEDIAC'),
    ('LE BARBU'),
    ('LE PAYS DE LA SAGO'),
    ('LITTLE SOL CHARLOTTETOWN'),
    ('LSP*BENNIC'),
    ('LSP*BENNIC MONCTON, NB'),
    ('MARINE HERITAGE STORE HALIFAX, NS'),
    ('MCDONALD''S'),
    ('MCDONALD''S - QUEBEC'),
    ('MCDONALD''S #11507 MONCTON'),
    ('MCDONALD''S #1516 DIEPPE'),
    ('MCDONALD''S #17234 QPS SHEDIAC'),
    ('MCDONALD''S #17234 QPS SHEDIAC, NB'),
    ('MCDONALD''S #40463'),
    ('MCDONALD''S #40463 DIEPPE'),
    ('MCDONALD''S #40828 MONCTON'),
    ('MCDONALDS'),
    ('MONCTON EVENTS CENTRE MONCT'),
    ('MUSEE CIVILISATION - QUEBEC'),
    ('NAYAX CANADA'),
    ('NIAGARA CITY CRUISES'),
    ('NIAGARA PARKS COMMISSION'),
    ('OTTAWA'),
    ('OUTDOOR ELEMENT FUNDY'),
    ('PAYS DE LA SAGO'),
    ('PIZZA DELIGHT'),
    ('PIZZA DELIGHT DIEPP'),
    ('PIZZA DELIGHT MOUNTAIN MONCTON, NB'),
    ('PLAYSTATION'),
    ('RED SATAY'),
    ('RED SATAY DIEPPE'),
    ('RED SATAY DIEPPE DIEPPE, NB'),
    ('RED SATAY DIEPPE, NB'),
    ('ROCCO''S CUCINA'),
    ('SAFIR MOROCCAN HAM'),
    ('SAPORI ITALIAN STREET HALIFAX, NS'),
    ('SECOND CUP'),
    ('SECOND CUP 9671 SAINT'),
    ('SKY ZONE MONCTON MONCTON, NB'),
    ('SMITTY''S CHARLO CHARLOTTETOPECA'),
    ('SP GLOBO CHAUSSURES'),
    ('STACKED PANCAKE'),
    ('STRAIGHT CROSSING BRIDGE'),
    ('STRAIT CROSSING BRIDGE BORDEN-CARLET'),
    ('SUBWAY'),
    ('SUBWAY DIEPPE NBCA'),
    ('TD STATION'),
    ('THE CAVES RESTAURANT L SAINT MARTINS'),
    ('TICKETMASTER'),
    ('TICKETMASTER CANADA HOST'),
    ('TICKETMASTER CANADA HOST TORONTO ON'),
    ('TIDE & BOAR BREWING MONCTON, NB'),
    ('TIM HORTONS'),
    ('TIM HORTONS #0445 CHARLOTTETOWN'),
    ('TIM HORTONS #0455 MONCTON, NB'),
    ('TRANSFER'),
    ('TRUEMAN BLUEBERRY'),
    ('VIA RAIL CANADA INC./K'),
    ('VICKERS RIVER'),
    ('VICTORIAS MANSION GUESTHOUSE - TORONTO, ON'),
    ('WEEKEND IN NOVA SCOTIA'),
    ('WEEKEND IN TORONTO'),
    ('ZOO MONCTON')
  ) LOOP
    INSERT INTO merchant_mappings (user_id, transaction_description, category_name)
    VALUES (target_user_id, mapping_data.column1, 'Weekend')
    ON CONFLICT DO NOTHING;
  END LOOP;

END;
$$ LANGUAGE plpgsql;

-- Step 6: Seed mappings for all existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    PERFORM seed_merchant_mappings(user_record.id);
  END LOOP;
END $$;

-- Done! The seed_merchant_mappings() function is now available for any new users
