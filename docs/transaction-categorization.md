# Transaction Categorization Rules

**Last Updated:** 2026-01-10

This document contains the mapping rules for automatically categorizing bank transactions based on their description.

## Category List

Based on your budget, we have these categories:
- Weekend
- Unexpected
- Subscriptions
- Property tax
- Pharmacy
- Electricity
- Mortgage
- Mobile/Internet
- Massage
- Insurance
- Household items/Car
- Haircut
- Government Loan
- Fuel
- Food/Costco
- Food
- Clothes
- Autocredit
- Aftershool

---

## Categorization Rules

### Pattern Matching Strategy

The system will use **substring matching** (case-insensitive) to categorize transactions:
1. Check transaction description against all patterns below
2. First match wins (order matters)
3. If no match, mark as "Unexpected"

---

## Category Mappings

### Food/Costco
```
COSTCO WHOLESALE
APOS COSTCO WHOLESAL
```

### Fuel
```
COSTCO GAS
CIRCLE K / IRVING
PETRO CANADA
ULTRAMAR
```

### Food
```
TASTE OF HOMELAND
WALMART STORE
COOP DE DIEPPE
ALDO #
DAVID'S TEA
JEAN COUTU (food items)
SQ *LA MAISON DE JEUNE
THE HOME DEPOT (food)
SOBEYS
MONCTON SUPERSTORE
NBCC - BOOKSTORE
HARDY S PRODUCE
WAL*MART CANADA
WAL-MART
CO PAIN ARTISAN
RASS 7526
DOLMA FOOD
MONCTON TRINITY SUPERS
COOP
SUPERSTORE
```

### Weekend
```
PIZZA DELIGHT
MCDONALD'S
FUNDY`S CAPE EN
FUNDY NATIONAL
ZOO MONCTON
ZOO
SkipTheDishes
KINGS LANDING
DOMINO'S PIZZA
TICKETMASTER
MONCTON EVENTS CENTRE
PAPA JOHN'S PIZ
ASA SUSHI
RED SATAY
CAFE COGNITO
CAPITOL THEATRE
HOP SKIP JUMP
LSP*Bennic
CINEPLEX
TIM HORTONS
AVENIR CENTRE
HIE FREDERICTON
EASTSIDE MARIOS
FEVER* CANDLELIGHT
LOLI CAFE
ST. JAMES GATE
SKY ZONE
TIDE & BOAR BREWING
KURO SUSHI
SMITTY'S CHARLO
COWS QUEEN STREET
SUBWAY
CAVOK BREWING
ROCCO'S CUCINA
AL SALAM CO
CARRABBA'S ITALIAN GRI
AKADI LUMINA
HAPPY CRAFT BREWING
GRANNAN'S SEAFOOD
SECOND CUP
TD STATION
STACKED PANCAKE
HARVEST CLEAN
NAYAX CANADA
LE BARBU (when weekend context)
IROLL
THE CAVES RESTAURANT
NIAGARA CITY CRUISES
NIAGARA PARKS
PAYS DE LA SAGO
SAFIR MOROCCAN
ACADIE POP
CLAIRE'S
DUCKY'S
BOTROW
CANVAS
GLOW GARDENS
VIA RAIL CANADA
OTTAWA (trip)
BKG*BOOKING.COM
HOPEWELL ROCKS MOTEL
BROTHERS 2
LITTLE SOL
OUTDOOR ELEMENT
STRAIGHT CROSSING BRIDGE
HALIFAX INTL AI
WEEKEND IN (trips)
COASTAL INN
MARINE HERITAGE
SAPORI ITALIAN
CIMP21
JIMS FAMILY
CONFEDERATION C
CANADA'S BEST VALUE INN
CKS ON THE WAY
HOTEL LE VOYAGEUR
MUSEE CIVILISATION
BOUTIQUE STADACONE
VICTORIAS MANSION
BV HOTEL
HILLSIDE ENTERTAINMENT
STACKED PANCAKE
BOWLARAMA
SP GLOBO CHAUSSURES
RIVERVIEW ARTS CENTRE
AMAZON PRIME (Video)
PLAYSTATION
CINEPLEX #8030
TRANSFER (when used for entertainment)
ABM WITHDRAWAL (when weekend context)
```

### Household items/Car
```
KENT HARRISVILL
KENT
DOLLARAMA
CANADIAN TIRE
CDN TIRE STORE
ECLIPSE
THE BONE AND BI
BEST BUY
RUBBER DUCK CAR
AMZN Mktp
Amazon.ca
Amazon
STAPLES
REN'S PETS
VILLECITYDIEPPE
PROCARE PLUMBING
RALLYE MOTORS HYUNDAI
MONCTON HONDA
HARVEY STUDIOS
MIKES BIKE SHOP
MICHAELS
MACARTHUR'S NURSERIES
TECHNOANT
IKEA.CA
GLOBAL PET FOODS
GLOBAL PET FOOD
MOBILE SNAP
MOBILING
VILLE DIEPPE (car registration)
WWW.CANADIANTIRE.CA
EB GAMES
LINEN CHEST
```

### Pharmacy
```
SHOPPERS DRUG M
SHOPPERS DRUG MART
JEAN COUTU
IHERB
REGIE REG. DE L
DIEPPE GUARDIAN
SP ETERNAL MUSE
BATH & BODY WORKS
```

### Massage
```
MARITIME MEDICA
HALF TIME (massage)
MYOKINESIS
MASSAGE EXPERTS
BACK TO WELLNESS
KRYSTEL MEDISPA
```

### Haircut
```
LE BARBU (haircut context)
SQ *506NICOLE
HALF TIME (haircut context)
MAVERICK BARBER
SQ *CHARLES STEVENS (when haircut)
CHARLES STEVENS
AMIFADES BARBER
AMIFADÉS BARBER
SALON BOHEME
```

### Clothes
```
LAWTONS (clothes)
SQ *EMILY DOWE
H M CA
H&M
EDDIE BAUER
DSW
TOMMY HILFIGER
BASS PRO SHOP
MARSHALLS
HS EMPIRE
BENTLEY
HOPEWELL ROCKS (clothes from store)
ZARA.COM
ZARA
RW & CO
#351 MARK'S
SKECHERS
THE CHILDREN'S PLACE
ADIDAS
SPIRIT HALLOWEEN
AERIE
ROOTS
URBAN PLANET
BANANA REPUBLIC
ARDENE
ENVY
DYNAMITE
SHEENPLACE COM
LULULEMONCOM
SPORT CHEK
COSTO CLOTHES (when Costco clothes)
```

### Subscriptions
```
MB-CREDIT CARD/LOC PAY
APPLE.COM/BILL
RENDER.COM
CHATGPT
MIDJOURNEY
ROGERS WIRELESS
PC-ROGERS
MANULIFE (insurance subscription)
NETFLIX
TRELLO
AD FREE FOR PRIMEVIDPRIME
ABACUS AI
ANNUAL FEE
FIT4LESS BY GOODLIFE
NETLIFY
GOOGLE CLOUD
CLAUDE
CLAUDE.AI
FITNESS
GOOGLE *SERVICES
GOOGLE *TEMPORARY HOLD
THE CO-OPERATORS CSI (insurance)
```

### Insurance
```
MANULIFE
THE CO-OPERATORS
CO-OPERATORS
```

### Mortgage
```
FN (mortgage payment code)
```

### Electricity
```
TS-ENERGIE NB POWER
PC-ENERGIE NB POWER
MB-ENERGIE NB POWER
NB POWER
```

### Mobile/Internet
```
MB-ROGERS
ROGERS
```

### Aftershool
```
LE GARDE AMIS
SQ *FRANCA RHYTHMIC GYMNA
DANSE CHAOS DANCE
DANSE CHAOS
GARDERIE LA MARELLE
LA MARELLE
ECOLE LE MARAIS
DAYCARE
PEGASUS SCHOOL
```

### Autocredit
```
LOAN PAYMENT
AUTOCREDIT
```

### Property tax
```
PNB-FINANCE
PNB FINANCE
TAXES
```

### Government Loan
```
NSLSC
NSLC (student loan)
```

### Unexpected
```
FREE INTERAC E-TRANSFER
INTERAC E-TRANSFER
E-TRANSFER
GLO SMILE
MOUNTAIN VIEW DENTAL
SERVICE NB
VISTAPRINT
SQ *AIRCAB
AIRCAB
PAYPAL
SEPHORA
TOYS "R" US
A-PLUS REGISTRY
OPENAI (when not subscription)
LL BEAN
CIRCLE K / IRVING (when not fuel)
FEVER* CANDLELIGHT
SNB-MONCTON
VILLE DE DIEPPE (fees)
WALMART.CA
WITHDRAWAL
GIFTS TO PARENTS
LIBERAL PARTY
EPICVIN
GCDS616
HUSHED
BOUTIQUE WI
ROBLOX
FRESHA KRYSTEL
ULTRAMAR BRIAN'S
FIT4LESS (membership)
IROLL
ATLANTIC IMPLANTS
COUCHE-TARD
AVATAR WORLD
TOCA BOCA
TOCA LIFE WORL
ZEFFY CARMA
CANADIAN MUSEUM
LES FLEURS
LE PAYS DE LA SAGOUINE
GLAMOUR SECRETS
HAPPY CRAFT BREWING (sometimes)
CHARLES STEVENS (when unexpected)
CITY OF DIEPPE
PARTENAIRE DUMO
GODADDY
CHAMPLAIN
CLINIQUE DENTAIRE PRIS
EAST COAST PEDIATRIC D
KRYSTEL MEDISPA
GIANT TIGER
SERVICE CANADA
PUROLATOR
THE BONE & BISCUIT
WANDER PRINTS
FUNDY TRAIL
DR. NACH DANIEL
DR. DAVID CAMPBELL
SQ *MONCTON MUS
ECOLE AMIRAULT
TRUEMAN BLUEBER
TRUEMAN BLUEBERRY
COUCHE-TARD
LE SALON DIEPPE
VICKERS RIVER
CIRCLE K (when not fuel)
ARAMARK
BOUTIQUE WI
SALON BOHEME
GOOGLE *TOCA BOCA WORL
SHOPPERS DRUG MART #53 (sometimes unexpected)
BACK TO WELLNESS (when not massage)
```

---

## Implementation Algorithm

```javascript
// Pseudo-code for categorization
function categorizeTransaction(description) {
  const desc = description.toUpperCase();

  // Check in priority order
  if (matchesPattern(desc, FOOD_COSTCO_PATTERNS)) return 'Food/Costco';
  if (matchesPattern(desc, FUEL_PATTERNS)) return 'Fuel';
  if (matchesPattern(desc, MORTGAGE_PATTERNS)) return 'Mortgage';
  if (matchesPattern(desc, NB_POWER_PATTERNS)) return 'Electricity';
  if (matchesPattern(desc, AFTERSCHOOL_PATTERNS)) return 'Aftershool';
  if (matchesPattern(desc, AUTOCREDIT_PATTERNS)) return 'Autocredit';
  if (matchesPattern(desc, PROPERTY_TAX_PATTERNS)) return 'Property tax';
  if (matchesPattern(desc, GOVERNMENT_LOAN_PATTERNS)) return 'Government Loan';
  if (matchesPattern(desc, INSURANCE_PATTERNS)) return 'Insurance';
  if (matchesPattern(desc, SUBSCRIPTIONS_PATTERNS)) return 'Subscriptions';
  if (matchesPattern(desc, MOBILE_INTERNET_PATTERNS)) return 'Mobile/Internet';
  if (matchesPattern(desc, MASSAGE_PATTERNS)) return 'Massage';
  if (matchesPattern(desc, HAIRCUT_PATTERNS)) return 'Haircut';
  if (matchesPattern(desc, PHARMACY_PATTERNS)) return 'Pharmacy';
  if (matchesPattern(desc, CLOTHES_PATTERNS)) return 'Clothes';
  if (matchesPattern(desc, WEEKEND_PATTERNS)) return 'Weekend';
  if (matchesPattern(desc, FOOD_PATTERNS)) return 'Food';
  if (matchesPattern(desc, HOUSEHOLD_PATTERNS)) return 'Household items/Car';

  // Default
  return 'Unexpected';
}

function matchesPattern(description, patterns) {
  return patterns.some(pattern => description.includes(pattern));
}
```

---

## Special Cases & Ambiguities

### Context-Dependent Categorization

Some merchants appear in multiple categories based on context:

1. **JEAN COUTU**: Pharmacy (default), but sometimes Food
2. **HALF TIME**: Massage or Haircut (needs manual override or user preference)
3. **LE BARBU**: Haircut or Weekend
4. **CIRCLE K / IRVING**: Fuel (default) or Unexpected
5. **SHOPPERS DRUG MART**: Pharmacy (default), but sometimes Unexpected or Household items/Car
6. **CHARLES STEVENS**: Haircut (default) or Unexpected
7. **COSTCO**: Food/Costco (groceries) or Household items/Car or Clothes (needs sub-categorization)

### Recommendation
For ambiguous merchants, we should:
1. Use the most common category as default
2. Allow users to manually re-categorize specific transactions
3. Learn from user corrections over time (future enhancement)

---

## Testing the Categorization

### Sample Test Cases

```javascript
// Test cases
categorizeTransaction("COSTCO WHOLESALE W1345 MONCT")
// Expected: "Food/Costco"

categorizeTransaction("COSTCO GAS W1345 MONCT")
// Expected: "Fuel"

categorizeTransaction("MCDONALD'S #151 DIEPP")
// Expected: "Weekend"

categorizeTransaction("FN")
// Expected: "Mortgage"

categorizeTransaction("LE GARDE AMIS INC")
// Expected: "Aftershool"

categorizeTransaction("RANDOM MERCHANT NAME")
// Expected: "Unexpected"
```

---

## Future Enhancements

1. **Machine Learning**: Train a model based on user corrections
2. **Amount-Based Rules**: Large amounts might indicate different categories
3. **Date-Based Rules**: Certain merchants on weekends might be different
4. **User Preferences**: Allow users to create custom rules
5. **Merchant Database**: Build a database of known merchants with categories

---

## Integration with Database

This categorization logic will be used in:
1. **CSV Import**: Auto-categorize transactions during import
2. **Google Sheets Sync**: Categorize transactions synced from Sheets
3. **Manual Entry**: Suggest category when user enters transaction description
4. **Bulk Re-categorization**: Allow users to re-categorize multiple transactions at once

---

## Importing Merchant Mappings from CSV

### Quick Actions in Category Manager

The Category Manager page (`/categories`) now includes two quick action buttons:

#### 1. Load Default Categories
Loads 25 predefined categories:
- **20 Expense Categories**: Afterschool, Autocredit, Clothes, Food, Food/Costco, Fuel, Government Loan, Haircut, Household items/Car, Insurance, Internet, Massage, Mobile/Internet, Mortgage, Electricity, Pharmacy, Property tax, Subscriptions, Unexpected, Weekend
- **5 Income Categories**: Salary, Freelance, Investments, Rental Income, Other Income

#### 2. Import Mappings from CSV
Bulk import merchant-to-category mappings from a CSV file.

**CSV Format:**
```csv
Name,Type
COSTCO GAS W1345,Fuel
TASTE OF HOMELAND,Food
COSTCO WHOLESALE W1345,Food/Costco
SHOPPERS DRUG MART,Pharmacy
MCDONALD'S #151,Weekend
```

**How it works:**
1. Reads the CSV file with `Name` and `Type` columns
2. Creates any missing categories from the `Type` column (as expense type)
3. Creates merchant mappings linking each `Name` to its `Type`
4. Uses upsert to avoid duplicates

**Notes:**
- Merchant names are stored in UPPERCASE for case-insensitive matching
- Categories are created as expense type by default
- Existing mappings with the same merchant name are updated
- The import processes in batches of 100 for large files
