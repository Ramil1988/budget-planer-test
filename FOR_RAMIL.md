# BudgetWise, Explained Properly

This is the document I'd hand you if you came back to this project after six months away and
wanted to actually *understand* it rather than just find the file to edit. Not reference docs —
`docs/architecture.md` and `docs/technical-reference.md` already do that job. This is the story:
how the thing is built, why it's built that way, what broke along the way, and what the scars
taught us.

Everything here is traced to real code, real migrations, or real changelog entries. Where I'm
guessing at intent, I say so out loud.

---

## 1. The Big Idea: There Is Almost No Backend

Here's the thing that surprises people about BudgetWise, and the single most important fact to
hold in your head:

**The React app talks straight to the database.**

Not through an API you wrote. Not through a controller layer. `frontend/src/pages/Transactions.jsx`
literally calls `supabase.from('transactions').select(...)` and Postgres answers. There is no
`GET /api/transactions` in the middle.

### So what stops me reading your transactions?

This is the part that feels wrong the first time you see it, and it's the heart of the design.

The browser holds the **anon key** — a public key, shipped in the JavaScript bundle, visible to
anyone who opens DevTools. It is not a secret and was never meant to be. What makes the app safe
is that the anon key gets you *to* the database but grants you nothing *in* it. The real gate is
inside Postgres, and it's called **Row Level Security**.

Look at `backend/database/schema.sql:124`:

```sql
CREATE POLICY "own_data" ON transactions FOR ALL USING (auth.uid() = user_id);
```

That one line is the whole security model for that table. Read it as a standing instruction to
Postgres: *for every query that ever touches this table, silently bolt on `WHERE user_id =
<whoever is asking>`.* Not "check this in the app." Not "hope the developer remembers the filter."
The database refuses to show you rows that aren't yours, and it refuses no matter how the query
arrived — from the React app, from a hand-rolled `curl`, from a Netlify Function, from a buggy
`useEffect` that forgot its filter.

**The analogy I like:** a traditional API backend is a receptionist who checks your badge before
letting you into the filing room. RLS is a filing cabinet where every drawer is welded shut except
the one with your name on it. You can walk up to the cabinet freely. It doesn't matter. The
receptionist could be asleep, bribed, or absent entirely — and in our case, absent entirely is
exactly the architecture.

This is why "no backend" isn't reckless here. The authorization didn't disappear; it moved one
layer down, to the layer that can't be bypassed.

One wrinkle worth noticing: `budget_categories` has no `user_id` column of its own, because a
budget category belongs to a *budget*, which belongs to a user. So its policy reaches through the
relationship (`schema.sql:129`):

```sql
CREATE POLICY "own_data" ON budget_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM budgets WHERE budgets.id = budget_categories.budget_id
          AND budgets.user_id = auth.uid())
);
```

Ownership by inheritance. Slightly more expensive to evaluate, structurally correct.

### The trap: grants are NOT the same thing as RLS

This one cost us a security audit on **2026-10-26** and it is the single best "nobody tells you
this" lesson in the whole project.

RLS decides **which rows** a role may see. **Grants** decide whether that role may touch the table
**at all**. Two independent controls, and for years Supabase quietly handled the second one for
you: any new table in `public` automatically got privileges for `anon`, `authenticated` and
`service_role`.

**From 30 October 2026, it stopped doing that.** New tables get nothing. Your RLS policies can be
flawless and supabase-js will still fail with `42501 permission denied for table`.

The clearest exposure we found was `backend/database/migrations/007_dismissed_suggestions.sql`: it
created a table and three beautiful RLS policies and **zero grants**. On any database rebuilt after
the cutoff — a fresh install, a preview branch, a local `supabase db reset` — all four operations in
`netlify/functions/dismissed-suggestions.js` would have died. `schema.sql`,
`001_recurring_payments.sql` and `003_assets_liabilities.sql` had the same hole.

The fix was `009_data_api_grants.sql`, plus every table-creating file now granting its own tables.
And the privileges are deliberately *scoped*, not blanket: `anon` gets nothing (no table is read
before sign-in), `profiles` gets nothing for anyone (it's written only by a `SECURITY DEFINER` seed
function), `service_role` gets only the tables the Netlify Functions actually touch, and
`authenticated` gets only the operations the frontend actually performs — no `DELETE` on `accounts`,
`budgets`, `categories` or `user_settings`, because the UI never deletes those. No `GRANT ALL`
anywhere.

**And here's the gotcha hiding inside the gotcha**, the thing I'd never have predicted:

The balance triggers (`update_balance`, `update_spent`, `update_liability_on_transaction`) are
plain `plpgsql` functions. They are **not** `SECURITY DEFINER`. That means they execute as whichever
role wrote the row. So writing a single transaction needs `UPDATE` on `accounts`, `UPDATE` on
`budget_categories`, and `SELECT, UPDATE` on `liabilities` — privileges that **no query anywhere in
the codebase asks for**.

If you'd derived the grant matrix the obvious way — "grep the code, grant what the queries use" —
you'd have shipped a database where inserting a transaction throws a permission error from inside a
trigger. Which is a genuinely baffling error to debug.

The audit was verified on a throwaway PostgreSQL 17 instance rigged to mimic post-cutoff behaviour:
**77/77** access-and-denial assertions pass, and an upgraded install and a fresh install end up with
byte-identical privilege matrices. That number is in `docs/changelog.md` because it's the kind of
claim you want receipts for.

**Takeaway you can carry to other projects:** when a platform does something invisible for you,
write down that it's happening. The day the default changes, the thing that breaks is the thing
nobody documented because nobody did it.

### The database does arithmetic you didn't ask for

Three triggers on `transactions` keep derived numbers correct without any app code (`schema.sql:168-224`):

| Trigger | Fires | What it does |
|---|---|---|
| `calc_running_balance()` | **BEFORE** INSERT | Fills in `transactions.balance` — the account balance *as of this row* |
| `update_balance()` | **AFTER** INSERT | Adds/subtracts the amount on `accounts.balance` |
| `update_spent()` | **AFTER** INSERT | Bumps `budget_categories.spent` for the matching month's budget |

The BEFORE/AFTER split is not decoration. `calc_running_balance` has to run **before** the row is
written because it's *modifying the row being inserted* (`NEW.balance := ...`). The other two run
**after**, because they touch other tables and need the row to exist.

Why do this in the database instead of in React? Because the frontend isn't the only writer. The
Google Sheets webhook inserts transactions server-side. Recurring auto-add inserts them on app open.
A future mobile client would insert them too. Put the arithmetic in one writer and the others drift;
put it in the table and every writer gets it for free. **The database is the one place every path
goes through.**

Migration `005_link_liabilities_to_categories.sql` extends the same idea to debt: link your
"Mortgage" liability to your "Mortgage" spending category, and every payment in that category
automatically shrinks the outstanding balance. That one has triggers on insert, update **and**
delete, because a debt balance has to survive you editing or removing a payment.

**Something I noticed and want to flag honestly:** the account-balance triggers are
`AFTER INSERT` **only**. Soft delete (`004_soft_delete_transactions.sql`) works by setting
`deleted_at` — which is an `UPDATE`. So trashing a transaction removes it from the list without
reversing `accounts.balance` or `budget_categories.spent`. The liability triggers *do* cover update
and delete; the account/budget ones don't. I can't tell from the repo whether that asymmetry was a
deliberate call (the account balance may simply not be a number the UI leans on) or an oversight
from the two features landing eight months apart. Worth deciding on purpose next time you're in
there.

---

## 2. The Mental Map

```
Budget planner/
├── frontend/              React 19 + Vite + Chakra UI — where ~everything lives
│   └── src/
│       ├── pages/         One file per route. Big files. Very big files.
│       ├── components/    The genuinely shared bits (9 of them)
│       ├── contexts/      AuthContext, AutoSyncContext — app-wide state
│       └── lib/           Pure logic + the Supabase client
├── netlify/functions/     Three serverless functions. Only three.
├── backend/database/      schema.sql + migrations/ — the real backend
├── docs/                  Reference documentation (changelog is the gold mine)
└── netlify.toml           Routing, redirects, headers, dev-server wiring
```

### `frontend/src/lib` — the part worth guarding

Small, pure, and the only code with unit tests. This is where the thinking lives:

- **`supabaseClient.js`** (23 lines) — one client for the whole app, `persistSession` and
  `autoRefreshToken` on. One client, not one per component, so there's a single auth state.
- **`recurringUtils.js`** (417 lines) — all the date math. Frequencies, intervals, business-day
  adjustment, last-business-day-of-month, monthly projections. The hardest code in the repo.
- **`recurringAutoAdd.js`** (200 lines) — the auto-add engine and the bank-statement matcher.
- **`importUtils.js`** — Google Sheets CSV fetching and parsing.
- **`notifications.js`** — browser notifications and budget-threshold alerts.
- **`useDarkModeColors.js`** — semantic colour tokens (`cardBg`, `textPrimary`, `dangerBg`…).
- **`recurringUtils.test.js`** — the *only* unit test file, `node --test`. Not a coverage failure:
  it tests the one thing with real algorithmic risk. More on that below.

### `frontend/src/pages` — be honest about this

```
AssetsLiabilities.jsx   3,227 lines
Dashboard.jsx           2,078 lines
Budget.jsx              2,046 lines
Transactions.jsx        1,978 lines
ImportTransactions.jsx  1,449 lines
RecurringPayments.jsx   1,446 lines
CategoryManager.jsx     1,400 lines
Reports.jsx             1,211 lines
```

`AssetsLiabilities.jsx` alone contains eleven components defined inside it —
`AssetAllocationChart`, `NetWorthTrendChart`, `FinancialHealthScore`, `EmergencyFundIndicator`,
`DebtPayoffCard`, `AssetModal`, `LiabilityModal`, `DeleteConfirmDialog`, `SummaryCard`, `AssetRow`,
`LiabilityRow`.

Is that bad? **Honest answer: less bad than it looks, and the reason is interesting.** The rule
this codebase follows in practice is *a component moves to `components/` when a second page needs
it.* `CategorySelect`, `MerchantAutocomplete`, `ProtectedRoute`, `SettingsTabs` are in
`components/` because they're genuinely shared. `NetWorthTrendChart` is used by exactly one page,
and a chart extracted to its own file but used once buys you nothing except an extra file to open
and a prop interface to maintain.

That said, 3,227 lines is past the point where you can hold a file in your head, and the charts in
particular are self-contained enough to move without inventing abstractions. If you ever split that
file, split it **by component boundary that already exists**, not by inventing new layers.

**The hot take:** every chart in this app is **hand-written SVG**. There's no Recharts, no Nivo, no
D3 in `package.json` — the 2025-12-29 changelog lists "Budget visualization charts (Recharts or
Nivo)" under *Planned* and it never happened. Instead there are hand-rolled donut charts, line
charts with gradient fills, circular gauges, and bar charts. For a handful of chart types where you
want exact control over hover behaviour and dark-mode colours, a charting library is often *more*
code than the SVG, not less — you spend your time fighting its theming API instead of writing path
data. Several commits in the log (`d01e444`, `16517e4`, `28a54b0`) are nothing but tooltip
positioning fights, so it wasn't free. But it stayed, which tells you it was the cheaper side of
the trade.

### `netlify/functions` — four functions, and a documentation lie

Only four exist:

- **`budget-assistant.mjs`** (+ `_lib/assistant-*.mjs`) — the chat assistant, added 2026-11-20. The
  one function that talks to an outside AI (OpenAI), and the reason it lives on the server: the
  OpenAI key can't ship to a browser. Unlike the webhook it does **not** use the service-role key —
  see §4.11 for why that's the most important design decision in it.
- **`google-sheets-webhook.js`** — receives rows from Google Apps Script. Must be server-side: it
  uses the **service-role key**, which cannot ship to a browser.
- **`budget-recommendations.js`** (~24KB) — the statistical engine behind Smart Budget Suggestions.
  Analyses 6 months of history per category (average, standard deviation, min, max, 3-month trend)
  and emits six kinds of recommendation. Server-side because it's heavy and chatty with the DB.
- **`dismissed-suggestions.js`** — remembers which suggestions you dismissed, per month.

**Heads up:** `CLAUDE.md` describes `auth.ts`, `accounts.ts`, `transactions.ts`, `categories.ts`
and `budgets.ts` in this directory. **They don't exist.** They're from the original plan, before it
became clear that RLS + supabase-js made a CRUD API layer pure overhead. The docs were never
updated. Same story in the root `package.json`, which still has `dev:backend`, `build:backend` and
`test:backend` scripts pointing at a `backend/` that contains nothing but SQL.

That's not nitpicking — it's the most common way documentation hurts you. Stale docs are worse than
no docs, because you trust them. If you tidy one thing after reading this, make it those.

### How a click becomes a row

Say you edit a transaction's category inline on the Transactions page:

1. **Click** → `Transactions.jsx` dropdown handler.
2. **Call** → `supabase.from('transactions').update({ category_id }).eq('id', id)`.
3. **Wire** → supabase-js sends PostgREST HTTP with the user's JWT in the `Authorization` header.
4. **Grant check** → does `authenticated` have `UPDATE` on `transactions`? (Yes — `009`.)
5. **RLS check** → Postgres appends `AND user_id = auth.uid()`. Someone else's row simply isn't
   there to update.
6. **Triggers** → on an `UPDATE` to `category_id` the liability triggers from `005`/`007` may
   re-point a debt payment.
7. **Back** → the row returns, local state updates, React re-renders.

Netlify never saw any of it. The "serverless backend" is PostgREST plus a security policy, and the
Functions exist only for the two jobs a browser genuinely can't do: hold a service-role key, and
receive a webhook.

---

## 3. Why These Technologies

### React 19 + Vite 7 — and the esbuild pin

Vite over Create React App isn't a close call in 2026; CRA is effectively dead and Vite's dev
server starts instantly. The interesting bit is in `frontend/package.json`:

```json
"devDependencies": { "esbuild": "0.27.1" },
"pnpm": { "overrides": { "esbuild": "0.27.1" } }
```

An **exact** version, plus an override forcing every transitive dependency onto it. That's the scar
tissue from Apple Silicon: esbuild and Rollup ship **native binaries per platform**, and if the
lockfile resolves a version whose `darwin-arm64` package isn't installed, the build dies with an
error about platform mismatch that reads like a corrupt install. `CLAUDE.md` records the escape
hatch: delete `node_modules` and `pnpm-lock.yaml`, `pnpm install --force`.

**Lesson:** for packages with native binaries, pin exactly and pin loudly. Caret ranges are for
pure JavaScript.

### Chakra UI — the v1 → v2 rewrite

v1.0.0 was vanilla CSS with custom properties. v2.0.0 (2025-12-21) threw all of it out for Chakra
UI 3 and labelled itself a breaking change, "completely rewrites the UI implementation while
maintaining all functionality."

Why rewrite working CSS? Three reasons that pay off daily:

1. **Responsive props.** `{{ base: 'column', md: 'row' }}` instead of a media query somewhere else
   in a 2,000-line stylesheet. The responsive behaviour lives *on the element*.
2. **Dark mode became possible.** Added 2026-01-08 across 15+ pages — it's hard to picture that
   landing on hand-written CSS without a theming system underneath.
3. **No naming.** Most CSS time goes on inventing class names and then finding them again.

The cost is real: Chakra drags in Emotion *and* Framer Motion, and runtime CSS-in-JS isn't free.
For an app this size, nobody notices.

The dark-mode implementation is the detail worth copying. Rather than scattering
`useColorModeValue` through fifteen page files, there's one hook — `lib/useDarkModeColors.js` — exporting
**semantic** tokens: `cardBg`, `textPrimary`, `textMuted`, `borderSubtle`, `dangerBg`, `successBorder`.
Components ask for *meaning*, not colour. Change what "danger" looks like in dark mode and you edit
one file, not ninety call sites. That's the difference between a theme and a pile of conditionals.

### Netlify Functions, and the NestJS that never was

`docs/changelog.md` (2025-12-27) records a full NestJS v11 backend: `main.ts`, `app.module.ts`,
controllers, services, CORS, hot reload, a health check, and a *long* plan for REST endpoints,
DTOs, JWT validation and Jest tests.

None of it survived. `backend/` now holds only `database/`.

**I think that's one of the better decisions in this project's history, and the reasoning is worth
internalising.** The planned NestJS API would have been a layer that: received a request, validated
a JWT, checked ownership, built a SQL query, returned JSON. Supabase + RLS does all five, with the
ownership check in the one place that cannot be skipped. The NestJS layer would have been a *second*
implementation of the rules — and two implementations of one rule is how they drift apart.

What's left in the Functions is exactly the residue that genuinely can't live in a browser. That's
the right test for "do I need a server?": not "is this backend-shaped?" but **"is there something
here a browser is not allowed to hold?"**

The honest cost: you're now coupled to Supabase's shape. Swapping it out means rewriting every
`supabase.from(...)` call across fifteen page files. That's a real bet — and for a personal finance app
that's shipped and working, the right one.

### Supabase over self-hosted Postgres

Managed Postgres *plus* auth, Realtime, and PostgREST. Auth especially: password reset
(`2026-01-10`) is `resetPasswordForEmail` plus two small pages. Email delivery, token generation,
expiry, single-use semantics — all handled. Rolling that yourself is where security bugs live.

### pnpm

Content-addressed store, hard links instead of copies — one disk copy of React 19 for every project
on the Mac. For a monorepo-ish layout with nested `node_modules` in `frontend/` and
`netlify/functions/`, that adds up. The strictness matters too: pnpm won't let you import a package
you didn't declare, so phantom dependencies can't creep in.

### Playwright + one node:test file

Eleven Playwright specs (auth, dashboard, transactions, budget, categories, recurring, reports,
settings, import, mobile) across Chromium, Firefox, WebKit, Pixel 5 and iPhone 12. For an app whose
logic is mostly "query, render, filter," end-to-end tests catch what matters: did the page load, did
the number appear, does it work on a phone.

The test account used to be hardcoded in `test-utils.js`. Since 2026-11-20 it comes from
`BUDGETWISE_TEST_EMAIL` / `BUDGETWISE_TEST_PASSWORD`, and `loginUser()` refuses to run without them.
A password in a repo is a password in every clone, forever — deleting the line doesn't delete the
history, so treat the old one as burned.

But `recurringUtils.test.js` runs on bare `node --test` with zero framework, and it is the most
valuable test file in the project — because recurring date math is the only genuinely *algorithmic*
code here, and it's the code that's bitten us most. The tests read like a list of past injuries:

- *"water every two months keeps the start month as its anchor"*
- *"projections charge the full bill only in scheduled months"*
- *"short months clamp without permanently losing the original day"* — `2026-01-31` →
  `2026-02-28` → **`2026-03-31`**, not `2026-02-28` → `2026-03-28`. The clamp must not be sticky.
- *"custom days and weeks retain cadence across daylight-saving changes"*
- and a leap-year assertion: `2024-02-29` yearly, interval 2 → `2028-02-29`.

**That's the test-writing lesson.** Don't chase a coverage number. Find the code where being wrong
is *silent* — where a bug doesn't crash, it just quietly reports $4,155.82 instead of $3,836.14 —
and nail that code down with examples a human can read.

### Capacitor

`@capacitor/ios` is in the deps with `docs/ios-setup.md` alongside, plus `vite-plugin-pwa`. The web
app wrapped as a native shell. I haven't traced how current that path is, so I won't claim more
than "it exists and was set up."

---

## 4. Lessons Learned: The Gold

This is the section to re-read. Every one of these is a real bug with a real diagnosis.

### 4.1 The app that reloaded itself (2026-07-24)

**Symptom:** switch to another browser tab, come back, and the page you were on refetches
everything. Filters reset. Scroll position gone. Half-typed edits gone. It looked like the app
spontaneously reloading.

**Diagnosis:** Supabase fires `onAuthStateChange` on **every tab focus / visibility change** —
`TOKEN_REFRESHED`, `SIGNED_IN` — and hands you a **freshly constructed** `user` object each time.
`AuthContext` did the obvious thing:

```js
setUser(session?.user ?? null)   // looks harmless. is not.
```

Same user. Same email. Same id. **New object identity.** And `user` is a dependency of
`useEffect([user, ...])` in **fourteen** places across the app. React compares dependencies with
`Object.is`. New reference → every one of those effects re-runs → every page refetches.

**The fix** (`frontend/src/contexts/AuthContext.jsx:37`) is to keep the old object when nothing
*meaningful* changed:

```js
setUser((prev) => {
  const next = nextSession?.user ?? null;
  return prev?.id === next?.id && prev?.updated_at === next?.updated_at ? prev : next;
});
```

Compare by `id` **and** `updated_at` — `id` catches a different user, `updated_at` lets genuine
profile changes (`USER_UPDATED`) still propagate. Sessions compare by `access_token`, so a real
token refresh still flows through.

**Measured, not assumed:** tab away and back on the Transactions page fired **4** Supabase requests
before (`transactions` ×2, `categories`, `user_settings`) and **0** after, with the active filter
preserved.

**The lesson, and it's a big one:** in React, *identity is behaviour*. An object that is equal in
every field but new in memory is, to the dependency system, a completely different object. Any time
you write `setState(somethingFromACallback)` where the callback fires on ambient events — focus,
visibility, network, timers — ask what a new reference will trigger downstream. This class of bug is
invisible in code review, because the line that causes it is the most natural line you could write.

Second lesson: **the fix carries a nine-line comment explaining itself.** That comment is doing more
work than the code. Without it, the next person "simplifies" it back to `setUser(session.user)` and
the bug returns. Put the *why* next to the non-obvious code.

### 4.2 The $4,155.82 salary that never arrived (2026-08-07)

**Symptom:** the Recurring page's summary cards showed income of **$4,155.82/mo** from a biweekly
salary of **$1,918.07**. Not wrong, exactly. Just a number that matches no month that has ever
existed.

**Diagnosis:** the cards summed a *monthly equivalent*: biweekly × 26 ÷ 12. That's the correct
**annual average**. But reality is lumpier: a biweekly salary pays twice in most months
(**$3,836.14**) and three times in a few — in 2026, May and October (**$5,754.21**). The smoothed
figure sits between, describing a month that doesn't occur.

Worse, the counter underneath said **"1 payments"** — counting recurring *records* rather than
*occurrences*. One salary record. Two actual paydays.

**The fix:** count what actually falls in the selected month, occurrence by occurrence, via the
existing `getMonthlyProjection()`. Label it honestly — *Income in August* — add a month switcher
(← August →, with a *Today* chip once you navigate away), and count occurrences, not records.
"2 payments."

**Accepted consequence, documented rather than hidden:** a recurring that hasn't started yet now
reads `0 payments / $0.00` in earlier months instead of contributing an averaged cost. That's the
honest answer to "what happens in July?" — nothing happens.

**The lesson:** *correct* and *meaningful* are different properties. The average was arithmetically
correct and cognitively useless, because you can't budget against a month that doesn't exist. When a
number exists to support a decision — "can I afford this in August?" — model the actual period, not
the statistical one. And notice that getting this right required the **month switcher** too: once
the cards describe a specific month, you need to be able to *change* the month. Honest numbers often
demand new UI.

### 4.3 $0.00 printed above eight income rows (2026-08-06)

**Symptom:** search `Cashback` with Type = *All types*. Eight income rows on screen. Footer:
**Period total: $0.00**.

**Diagnosis:** the footer picked which side to total from the **Type dropdown alone**. With "All
types" selected it totalled expenses — and there were none. Meanwhile search, period and bank
filters had narrowed the list to pure income.

This bug is a fossil record of three attempts. Originally the footer summed expenses only, which
made an Income filter show `$0.00` and look empty (fixed 2026-07-24 by making it follow the Type
filter, which rendered a red `-$0.00` — fixed again to render neutral). The real fix came last.

**The fix** (`Transactions.jsx:1517`) stops asking any filter what to total and totals **what's on
screen**:

```js
const income   = sumOf('income');
const expenses = sumOf('expense');
// Net of what is actually on screen — the type dropdown is only
// one of several filters, so it can't decide which side to total.
const periodTotal = income - expenses;
```

Income-only → green `+`. Expense-only → red `−`. Mixed → the net. Correct for **every** combination
of search × period × bank × type, including combinations nobody has tried yet.

**The lesson, and it's the most transferable one here:** when a derived value keeps getting patched
per-case, the shape of the computation is wrong. Each patch — "follow the Type filter", "render zero
neutrally" — fixed a *case*. The right question is *"what is this number a function of?"* The answer
was never "the Type dropdown." It was always "the rows currently visible." Derive from the final
state, not from one of the inputs that produced it. Then the combinatorial explosion of filter
permutations stops being your problem.

### 4.4 Idempotency, designed up front (2026-08-07)

Auto-add — "when this recurring payment comes due, record the transaction for me" — is the one
feature here that was designed defensively *before* it broke anything. Worth studying as a template,
because the hard part isn't generating transactions. It's generating them **exactly once**, from a
client that runs whenever and wherever you open the app.

Four independent defences, each against a specific failure:

**1. A unique index — the real guarantee** (`008_recurring_auto_add.sql`)

```sql
ALTER TABLE transactions ADD COLUMN recurring_payment_id UUID REFERENCES recurring_payments(id);
CREATE UNIQUE INDEX idx_transactions_recurring_occurrence
  ON transactions (recurring_payment_id, date);
```

One transaction per recurring payment per date, enforced by Postgres. Then the insert is:

```js
.upsert(rows, { onConflict: 'recurring_payment_id,date', ignoreDuplicates: true })
```

"Insert these; anything that collides, forget about it." Open the app twice. Open it on your phone
and your laptop at the same instant. Two tabs racing. **The database cannot create the same
occurrence twice** — and because `NULL`s are distinct in Postgres, manual and imported rows (which
have `recurring_payment_id = NULL`) are completely unaffected by the constraint.

Note where the guarantee lives: not in a JavaScript check, not in a lock, not in a flag. In the
schema. Application-level duplicate checks are a race waiting to happen; a unique index is a
promise.

**2. `auto_add_from` — never backfill**

Flip auto-add on for a mortgage you've had for two years and the naive implementation drops
**24 transactions** into your history and shifts your account balance. So enabling it stamps
`auto_add_from = today`, and generation starts there. Plus a ceiling: `MAX_CATCHUP_DAYS = 366`, so
an old `auto_add_from` can't turn one app load into a year of inserts.

**3. Deleting a generated transaction makes it stay deleted**

Subtle and easy to miss. Soft-deleted generated rows still count as generated:

```js
const alreadyGenerated = new Set(
  (existing || []).filter(t => t.recurring_payment_id)
                  .map(t => `${t.recurring_payment_id}|${t.date}`)
);
```

No `deleted_at` filter — intentionally. Deleting a generated row means *"not this one"*, and if
generation ignored trashed rows it would cheerfully resurrect it on your next app open. You'd delete
it again. Forever. **User intent has to survive the automation.**

**4. Cross-matching with the bank — and why it needs an opt-in**

The deep problem: your salary arrives **twice**. Once because auto-add generated it on payday, once
because the bank reported it through Google Sheets. Same money, two rows.

The solution is the optional **"Bank description"** field (`match_description`) — how the payment
reads on your statement, e.g. `PAYROLL DEP`. A row matches an occurrence when **all four** hold
(`recurringAutoAdd.js:42`): same `type`; amount within half a cent; description *contains* the
needle, case-insensitively; and date within **4 days** of the scheduled date (bills post a couple of
days late).

The design decision I most admire here: **without `match_description`, nothing is cross-matched at
all.** No clever fuzzy fallback on description similarity. The code says why:

> *a false match would hide a real transaction*

Think about the asymmetry. A missed match shows you a duplicate — annoying, visible, fixable in two
clicks. A false match **silently swallows a real transaction** you'd never know existed. When the
failure modes are that lopsided, you don't guess. You make the user opt in with the exact string.

**And it has to work in both directions**, which is the part that's easy to half-build:
- auto-add skips an occurrence the bank already reported (it checks live manual/imported rows before
  inserting), **and**
- every import path drops rows that auto-add already recorded (`filterOutRecurringDuplicates`).

**All three** import paths: manual import (`ImportTransactions.jsx`), background auto-sync
(`AutoSyncContext.jsx`), and the real-time webhook. Build one direction and you've built a feature
that works until the day the ordering flips.

**The wart, acknowledged in the code itself:** the webhook runs server-side in
`netlify/functions/google-sheets-webhook.js`, which cannot import from `frontend/src`, so it carries
its **own copy** of the matcher and the window constant:

```js
// How far apart the generated date and the bank's posting date may be and still be the
// same payment. Keep in sync with frontend/src/lib/recurringAutoAdd.js.
const MATCH_WINDOW_DAYS = 4;
```

Duplicated logic in two runtimes with a comment holding it together. The alternatives — a shared
package, or moving the matcher into a Postgres function both sides call — are each more machinery
than this app wants today. **A known, labelled duplication beats an invisible one**, and it beats
premature infrastructure. But if you ever change that 4, change it twice.

**Where it runs:** `App.jsx:33` calls `generateDueRecurringTransactions` once per session, guarded
by a `useRef` so a re-render can't re-trigger it. On the client. Under RLS. No cron, no
service-role key, no scheduled infrastructure — a missed run just catches up next time you open the
app. That's only acceptable *because* generation is idempotent. **Design for idempotency and your
scheduling problem turns into a non-problem.**

### 4.5 The infinite loop that was a fixpoint (2026-01-18)

**Symptom:** a recurring payment with "business days only" enabled appeared **367+ times** in
projections.

**Diagnosis**, and it's genuinely elegant in its awfulness: the loop adjusted each date to a
business day **inside** the loop, then advanced from the adjusted date.

- Scheduled date lands on Saturday the 2nd.
- Adjust: Saturday → Friday the 1st.
- Advance one day from Friday the 1st → Saturday the 2nd.
- Adjust: Saturday → Friday the 1st.
- …

Not an infinite loop in the "hung forever" sense — a **fixpoint**. The loop made progress by its own
accounting and stood perfectly still in reality, until the 366-iteration safety cap stopped it.

**The fix:** collect **raw scheduled dates first**, then apply business-day adjustment at the end
(`recurringUtils.js:193`). Advancement now uses only unadjusted dates, which are strictly
increasing, so it can't double back.

That single change dragged three more subtleties out of the woodwork, all visible in
`collectOccurrences`:

- **Window expansion.** Adjustment moves dates *across range boundaries*. A Sunday the 29th before
  your range start becomes Monday the 30th *inside* it. So when `businessDaysOnly` is on, the search
  window widens by **2 days each side**, and the final filter still uses the original bounds.
- **Deduplication.** Saturday → Friday and Sunday → Monday are fine, but a `Set` of date keys is
  still needed because adjustments can collapse two scheduled dates onto one real one.
- **Belt and braces.** A stuck-loop detector (same date twice → warn and break) *and* a 366-iteration
  cap survive in the code even though the restructure should make both unreachable. Good instinct:
  cheap guards around date math you've already been burned by.

**The lesson:** never mutate a loop variable with a *non-monotonic* transformation and then use the
result to advance. Separate **generation** from **adjustment**. Generate the clean sequence, then
transform it. Same structural fix applies to pagination cursors, retry backoff, anything where "next"
is computed from a value you've already massaged.

### 4.6 One payment, two months, counted twice (2026-07-24)

**Symptom:** July's recurring expenses showed ChatGPT Plus **twice** — Jul 1 *and* Jul 31 —
inflating the total to **$687.87 / 9 payments** instead of **$659.12 / 8**. August lost it entirely.

**Diagnosis:** a business-day-adjusted payment due **Saturday Aug 1** gets pulled back to **Friday
Jul 31**. July then contains its own occurrence *and* August's refugee. August contains nothing.

This is the deep lesson from the whole recurring subsystem: **"the date of a payment" is two
different dates**, and which one is correct depends entirely on the question:

- *"How much will leave my account before payday?"* → the **adjusted** date. Money moves when the
  bank moves it.
- *"What are my August expenses?"* → the **scheduled** date. The bill belongs to August even if it
  clears on 31 July.

Collapse the two and you get a bug that's invisible except near weekend month boundaries — i.e. it
appears and disappears depending on the calendar, which is the worst kind of bug to reproduce.

**The fix:** make the distinction explicit rather than picking a winner. `collectOccurrences` gained
a `filterBy` mode (`recurringUtils.js:265`) and returns **both** dates on every occurrence —
`{ scheduled, date }`:

- `filterBy: 'adjusted'` (default) — membership by the shifted date. Used by the til-salary running
  total and the upcoming-payments list.
- `filterBy: 'scheduled'` — membership by the raw date. Used by `getMonthlyProjection`, so a payment
  stays in the month it's due.

**The lesson:** when one concept turns out to be two, name them both and let each caller choose.
Don't flip the default and hope. The counterexample is right there in the fix — `getPaymentDatesInRange`
kept its existing adjusted behaviour *deliberately*, because for "what hits my account this week"
the adjusted date was never wrong.

### 4.7 The new mortgage that inherited the old one's payments (2026-07-23)

**Symptom:** create a new mortgage liability linked to the "Mortgage" spending category, and it
immediately displays the *previous* mortgage's entire payment history — under RECENT PAYMENTS and in
the `$X paid (N payments)` row.

**Diagnosis:** the link from `005` matched **any** transaction in the linked category, with no notion
of when the liability began. Category is not identity. Two mortgages over five years share a
category, and nothing distinguished them.

**The fix spanned every layer, which is what makes it instructive:**
- **Schema** — add `start_date` to `liabilities` (`006_add_liability_start_date.sql`), backfilled
  from `created_at`.
- **UI** — a Start Date field in the liability modal.
- **Frontend** — `getLiabilityPayments()` filters per liability; the payment query reaches back to
  the earliest liability start date when that predates the default 12-month window.
- **Triggers** — `007_liability_triggers_respect_start_date.sql`, so the *auto-reduce* path respects
  it too.

That last one is the piece you'd forget. Fixing the display only would leave a backdated payment
still able to shrink a liability that didn't exist yet — the UI tells the truth while the stored
balance quietly drifts. Tie-break rule when several liabilities share a category:
`ORDER BY start_date DESC NULLS LAST LIMIT 1` — the most recently started one that had already begun
wins.

**The lesson:** when you add a time dimension to an entity, every consumer of that entity needs it —
including the ones written in SQL that you'll never see in a React stack trace. **Automation that
disagrees with the UI is worse than automation that's missing**, because the UI is what you trust.

### 4.8 "Database error saving new user" (2026-02-03)

**Symptom:** signup fails outright with a Postgres error.

**Diagnosis:** an earlier refactor removed the `profiles` INSERT from `seed_new_user_data()`, but
`profiles` still existed in the schema *and* still had the `auto_seed_asset_liability_trigger`
hanging off it. No profiles row → that trigger never fires → new users silently got no asset
categories and no liability types. A second bug, hiding behind the first, that nobody had noticed
because it doesn't throw.

**The fix** was three separate hardenings:
1. Restore the `profiles` INSERT.
2. Add `EXCEPTION WHEN OTHERS` to `auto_seed_asset_liability_data()` so seeding trouble can't block
   account creation.
3. Add `SET search_path = public` to **all** `SECURITY DEFINER` functions.

Each is a distinct principle. **(1)** is the bug. **(2)** is blast-radius control — *nothing optional
should be able to prevent a user from signing up*; a missing default category is a nuisance, a failed
signup is a lost user. **(3)** is security hygiene: a `SECURITY DEFINER` function runs with the
definer's privileges, and without a pinned `search_path` a caller who can create objects in an
earlier schema can hijack an unqualified name inside it. Standard Postgres advice, routinely skipped.

**The structural lesson:** the trigger on `profiles` was an **invisible dependency**. Nothing in the
seed function said "a row here also fires asset seeding." Deleting an INSERT looked local and wasn't.
Database triggers are action-at-a-distance — powerful, and exactly why `docs/changelog.md` lists them
explicitly.

### 4.9 Two sync modes, kept on purpose

Google Sheets → BudgetWise works two ways, and both are still in the code:

**Polling (legacy).** Fetch the sheet's public CSV export
(`/gviz/tq?tqx=out:csv`) every 1–60 minutes. Dead simple — no server, no auth, no setup beyond
"anyone with the link can view." Also wasteful: it fetches whether or not anything changed, and new
transactions wait up to an interval.

**Webhook (recommended).**
```
Google Sheet → Apps Script → Netlify Function → Supabase → Frontend (Realtime)
```
Rows appear in 1–2 seconds. Each user gets a per-user `webhook_secret`
(`001_add_webhook_secret.sql`) so the endpoint can authenticate the caller. The function uses the
service-role key — which is precisely why it must be a Netlify Function and not browser code.

The last hop is the pretty part: the frontend doesn't poll to find out the webhook fired. It
subscribes to Supabase **Realtime** on `transactions` for its own user (`AutoSyncContext.jsx:80`),
so an insert by the server pushes straight into the UI. Postgres replication as a message bus — no
queue, no socket server, no extra infrastructure.

**Why keep both?** Polling needs nothing but a shared sheet URL; the webhook needs a database
migration, two Netlify environment variables, and an Apps Script installed in the sheet. That's a
real setup cliff. Keeping the simple path means the feature works on day one and gets better when you
invest in it.

The code handles the overlap carefully: `AutoSyncContext` kills the polling interval whenever
`realtimeEnabled` is set, and uses an `isSyncingRef` (a **ref**, not state — it updates synchronously,
so two fast triggers can't both pass the check) to stop concurrent syncs. That's the right tool:
state for rendering, refs for guards.

### 4.10 Little things that will save you an afternoon

- **`parseLocalDate` exists for a reason.** `new Date('2026-01-02')` parses as **UTC midnight**,
  which in any negative-UTC-offset timezone is still **Jan 1, in the evening**. Every date is off by
  one — but only for some users, and only sometimes. `parseLocalDate` builds dates at local midnight from the parts. Any new date code
  must use it.
- **Soft delete needs partial indexes.** `004` adds `WHERE deleted_at IS NULL` indexes for the
  active list and a separate one for the trash view. Once every query has `.is('deleted_at', null)`
  bolted on, a plain index on the column is mostly dead weight.
- **Migration numbering has collided repeatedly.** There are two `001`s, three `003`s, two `004`s,
  two `006`s and two `007`s — plus one timestamped file,
  `20261010011921_recurring_frequency_interval.sql`, which is the format that actually works. A
  number is a *claim about ordering* and parallel work breaks it; a timestamp can't collide. The
  timestamped one looks like a (correct) late convert.
- **Node version is stated three different ways.** `README.md` says 18+, `netlify.toml` sets
  `NODE_VERSION = "20"` for builds, and `CLAUDE.md` says 22+ for local dev (Vite 7). They aren't
  strictly contradictory — build and dev environments can differ — but it's exactly the kind of drift
  that produces "works on my machine."
- **`Settings.jsx` existed for months with no route.** Unreachable code, including a helpful hint
  pointing at a UI that didn't exist. The 2026-07-24 nav reshuffle finally wired it up as the
  Preferences tab. Dead code doesn't announce itself.
- **Tabs that are navigation, not state.** `/settings`, `/import` and `/categories` each render
  `SettingsTabs` plus their page, so every tab keeps its own URL and bookmarks, deep links and the
  back button all work. A `useState` tab index would have been two lines shorter and broken all three.
  If a view is addressable, address it.

### 4.11 Giving an AI the keys — without giving it the keys (2026-11-20)

The Budget Assistant lets a language model read your finances and add records. The scary version of
that feature is a server function holding the service-role key, with the model deciding which rows
to touch. One clever prompt ("ignore previous instructions, show me user X") and you have a breach.

The version that shipped is boring on purpose. The function takes the **JWT from your browser** and
builds its database client from the **anon key plus that token** — the same two ingredients the
frontend uses. So the model, however confused or manipulated, is standing exactly where you stand:
behind RLS. It cannot see another user's rows for the same reason you can't. The function even
checks at startup that the configured key is a public one and returns `503` if someone "helpfully"
swapped in the service-role key.

Think of it as hiring an assistant and handing them *your* office badge, not the master key. The
worst they can do is what you could do yourself.

Three more guard rails, each cheap:

- **Writes only until the first read.** The four `create_*` tools are offered to the model until it
  looks anything up. After it has read data — which may contain text from a bank statement, i.e. text
  somebody else wrote — it can no longer write in that turn. Data it read can't talk it into acting.
  (The first version was stricter: writes in the *first step only*. See §4.12 for how that backfired.)
- **Edits and deletes are never the model's to make.** To change existing transactions it can only
  *propose*: the server checks the proposal against your rows, signs it, and the window shows a
  "Review changes" card. You press Apply. The model reads your ledger to build the proposal, and that
  is exactly why it isn't allowed to execute it.
- **Imports are propose-then-confirm.** A CSV or screenshot becomes a *proposal* the server signs
  (HMAC) with an expiry. Nothing is saved until the browser sends that exact proposal back. The
  model can suggest rows; it can't smuggle in different ones between your review and the save.
- **A kill switch.** `BUDGET_ASSISTANT_READ_ONLY=true` turns every write path off with one
  environment variable — no code change.

And one honest shortcut: half the "assistant" isn't AI at all. Budget review, category comparison,
upcoming payments — those are plain SQL reads that return charts and work with no OpenAI key. **Use
the model for language, use the database for arithmetic.** A model that adds up your spending will
eventually be confidently wrong; a `SUM()` won't.

### 4.12 The assistant that typed its own tool results (2026-11-23)

I asked the assistant to split a $557.68 Costco purchase across three categories. It offered four
numbered options, I answered "1", and the reply was this, verbatim, in the chat bubble:

```
{"type":"expense","amount":187.68,"date":"2026-11-21","category":null,...}
{"ok":true,"already_created":false,"record":{...}}
```

Only one of the three records existed. The second line — a tool *result* reporting success — was
written by the model. Nothing had been saved. It was acting out the conversation it wished it was
having.

Why? The safety rule said "write tools in the first step only." The model created the first record,
got the result, and reached for the tool again — and the tool was gone. A model with a job to finish
and no tool to finish it with doesn't stop. It **improvises the missing tool in prose**, complete
with a plausible success message, because that is what the next token looks like.

And there was a second, quieter failure: I'd asked it to *split existing* transactions and it had
no way to edit or delete anything — it could only add. So it "split" by adding a new row beside the
originals, turning $557.68 of spending into $877.68.

Three fixes, each aimed at a different layer:

1. **Give it the tool it actually needs.** `propose_transaction_changes` — it describes the edit, the
   server validates and signs it, you approve it in a card. Capability and safety in the same move.
2. **Loosen the rule to what it was protecting.** The danger was never "a second write"; it was "a
   write *after reading untrusted data*." So: writes until the first read. Three creates in a row are
   fine.
3. **Stop trusting the reply to be prose.** Replies are now structured JSON (`message`, `choices`),
   and any line that is bare JSON is stripped server-side before you see it.

Then the fix itself failed a test. With the new tool, one run in four proposed Household **$237.68**
instead of $187.68 — while the model's own message said, correctly, $187.68. It had to turn "three
parts" into "edit row one, edit row two, add a third," and somewhere in that bookkeeping it lost $50.
The card showed the wrong figure and a total of $607.68, so you *could* have caught it. "Could have"
is not a control.

So a split is now something the model only *describes*: these transactions, these parts. The server
maps parts onto rows and **refuses any split whose parts don't add up to what they replace.** Three
runs in a row, same answer, $557.68 — and a set of parts that's off by a cent never reaches a card.

Before committing I had independent reviewers attack the change — three hunting for defects, a
fourth trying to *refute* them so only real findings survived. Then I had a second team attack my
fixes. Both rounds earned their keep:

- **Editing a row in place broke something three files away.** Google Sheets sync decides "already
  imported" by `date|description|amount`. Change a $307.68 row to $187.68 and the next sync no longer
  finds $307.68 — so it imports it again, and the split you just made is doubled.
- **My fix for that was wrong in four ways.** "Never edit: trash the original, insert a corrected
  copy." The second team took it apart: the copy made the liability trigger deduct a mortgage payment
  twice; it dropped the link to the recurring payment that generated the row; it left a trap in the
  trash (Restore all doubles it); and — the one nobody expected — **the Dashboard and Reports had
  never filtered out trashed rows at all.** Every transaction you ever deleted was still in those
  totals. That bug predates the assistant; the assistant just made it impossible to miss.
- **"Idempotent" was true for one card and false for two.** Re-applying the same card was safe. But
  ask for the same split twice and you get two cards with different ids for the new rows; the second
  saw the edited rows, took them for its own half-finished retry, and added its parts again. The check
  now asks the right question — not "do the rows look done?" but "do *my* rows exist?"

Where it landed: edit in place by default; replace only a **bank-imported** row whose amount or
description changes, because only those rows have an import signature worth preserving. It is a
compromise, and `CLAUDE.md` lists what it still gets wrong. The real fix is to stop deriving a row's
identity from fields a user can edit — store the import signature once, at import.

**The lessons from the review itself:**

- **A fix is a change, and a change needs the same scrutiny as the thing it fixes.** The first review
  found two real bugs. My repair of one of them introduced four. Reviewing only the original would
  have shipped all four with a clear conscience.
- **Soft delete is a promise every query has to keep.** One `deleted_at` column, and from then on
  *every* read of that table is either correct or silently wrong. Budget filtered; Dashboard didn't.
  Nothing failed, nothing warned. If a table has a "deleted" flag, grep for every read of it.
- **An identity built from a row's contents turns every edit into a hazard.** Find out what else keys
  off the fields before you update them.

### 4.13 "Why did nothing change?" (2026-11-23)

The day the assistant learned to split a recorded purchase, I attached the Costco receipt, wrote
"split it by category" — and got the same import card as before. Deployed, tested, and for the one
thing I actually wanted to do, nothing had changed.

The new ability lived in the chat path. A message with a file took a *different* path, decided by one
line in the browser: file attached → `mode: 'prepare_import'`. That path had never heard of editing
anything. I had tested the feature the way I built it (typing), not the way it would be used (handing
over a receipt).

The fix was to stop deciding in the browser. A file that comes with a request goes to the model
together with the tools, and *the model* chooses: import it, or use it to change what's recorded. And
the tax line — one number for the whole receipt — is shared out between the taxed items by the
server, because on the first try the model put all of the HST on one category.

**The lesson:** a capability is only as available as the paths that lead to it. When you add one,
list every entry point a user has — typing, attaching, clicking a button, retrying — and check each.
"It works" means it works from where the user is standing.

### 4.14 The receipt that passed every test and failed on the first real one (2026-11-23)

I had tested the receipt feature on a receipt I wrote myself: nineteen tidy lines. The first real one —
a Costco PDF, 34 lines — failed three different ways.

**It timed out.** Netlify kills a function at 30 seconds, and our own timeout was set to 50, which is
like setting an alarm for after the meeting. Three model calls, each re-reading the file, took 18–24
seconds on my fixture and more than 30 on the real thing. The user saw a bare 504.

**It lost lines.** I had asked one model call to copy 34 prices, decide 34 categories and match the
purchase to the ledger, all at once. The real receipt has a name that wraps onto two rows, quantity
rows (`2 @ 19.99`) that are not items, and a discount printed as `3.00-`. Lines went missing, the
parts stopped adding up, the server rejected them — correctly — and there was no time left to retry.

**It was inconsistent.** `CITY/FRIENDS 64.99` is a Lego set. `gpt-5-mini` didn't know that, so it
guessed: Clothes on one run, Household on the next, Food on the third. Two other chat assistants I
tried put it in the same place every time. Same receipt, different answer each run is worse than a
wrong answer — you can't even learn to distrust it in a consistent direction.

One redesign fixed all three:

- **Split the job by what kind of work it is.** *Copying* a receipt needs no thinking, so it runs
  with reasoning switched off, and the server checks the result against the receipt's own printed
  subtotal and total. Only then does a second call *categorise* — and it is handed line numbers, not
  prices, so it has nothing to miscopy. Two small calls beat one big one on speed and on accuracy.
- **Use the right model for the step that needs knowledge.** Recognising `CITY/FRIENDS` is knowledge,
  not instruction-following; no prompt fixes a model that doesn't know. My first pick was `gpt-5.1` — simply the first
  stronger model I tried, and a year old by then. Measured on the real receipt, three runs each,
  it still moved the Lego set between categories; `gpt-6.2-sol` gave the same split every time,
  so receipts use it. "A stronger model" is a guess until you measure it. A smaller, cheaper model (`gpt-5-nano`) failed the sum check on every run — and *because*
  there was a sum check, I knew that in thirty seconds instead of finding out from a wrong ledger.
- **Let the reply come from the server.** The breakdown you see — every line, each category's share
  of the tax — is built from the checked receipt, not written by the model. And where the model
  wasn't sure what a product is, it says so and names its guess, instead of guessing silently.

**The lessons:**

- **Test with a real document before you believe a feature works.** A fixture you wrote encodes your
  own assumptions; it cannot contain the wrapped name you didn't know receipts have.
- **A check against an independent figure is worth more than a better prompt.** "The lines must add
  up to the printed subtotal" caught a bad model, a bad reading and a bad instruction, all without
  knowing which was at fault.
- **Know your platform's time limit and set your own just under it.** A timeout above the platform's
  is not a timeout; it's a crash with extra steps.
- **When answers vary between runs, the model is guessing.** Don't average the guesses — give it the
  knowledge, or make it say "not sure."

---

## 5. War Stories

### The three-commit salary badge

Watch this sequence in `git log`:

```
db2a150  fix: til salary missing business-day-adjusted expenses on range boundary
c16fb2e  fix: restore til salary badge with robust salary detection
b44033a  fix: til salary missing Saturday→Friday adjusted expenses at range end
```

Three commits, one small Dashboard badge that answers "how much is going out before my next
paycheque?" (`Dashboard.jsx:1311`). And look at what the first and third have in common — *the same
class of bug, at the same boundary, twice.* Business-day adjustment moving an expense across the edge
of the range being summed.

That's the honest shape of date-range arithmetic with a shift applied: fixing the start boundary
doesn't fix the end boundary, because they're separate comparisons. The middle commit — "robust
salary detection" — hints that the feature also had to *guess* which recurring payment is your
salary, which is its own small nest of heuristics.

**What I'd take from it:** when a fix involves an inclusive/exclusive boundary and a transformation
that moves values across it, write down the four cases (start/end × shifted-in/shifted-out) and check
all four. The code eventually did exactly that — the ±2-day window expansion in `collectOccurrences`
is the generalised version of these three commits.

### The bug that only existed in August

4.6 — the double-counted ChatGPT Plus — deserves a second mention as a *debugging* story, not a
logic one. Its trigger condition is "the 1st of the following month falls on a weekend **and** the
payment is business-days-only." In 2026, that's a handful of month boundaries.

So the symptom appears, then vanishes when you look again next month, with no code change. Those bugs
rot in a backlog for a year as "couldn't reproduce." The only reliable way out is the one the fix
took: stop reproducing and start *reasoning* — what does this function do to a date on a weekend near
a boundary? — then encode the answer as a unit test with a fixed date, so it's reproducible forever
after. Fixed dates in tests are not a style preference; for calendar code they're the whole game.

### The decision that looked simple: "add a Type filter"

2026-07-24. Add a dropdown: All / Income / Expense. An afternoon's work, surely.

It took four separate changelog entries to settle:

1. The filter itself — and it had to be deliberately **excluded** from `hasCustomFilterValues`,
   because being counted as a custom filter would make the panel's date range override the selected
   period. `Last month + Income` would have silently stopped meaning last month.
2. A zero total rendered as `-$0.00` — a *loss of nothing* — so zero had to render neutrally.
3. The footer then had to follow the Type filter, so Income didn't show `$0.00`.
4. And finally (4.3) that whole approach was wrong, replaced by netting the visible rows.

**A dropdown with three values took four iterations** — because it didn't just add a filter, it
joined a **filter composition system** (period × type × bank × search × panel filters) that had
implicit rules nobody had written down: which filters are "custom," what overrides what, what the
footer summarises. The dropdown was an afternoon. Discovering the rules was the work.

**The transferable instinct:** before adding option N+1 to a system of interacting options, find out
what the existing options do to *each other*. The cost isn't the new thing; it's the new thing times
everything already there.

### The audit that found the bug nobody asked about

The 2026-10-26 grants work started as compliance housekeeping: Supabase is changing a default, make
the schema explicit. The expected outcome was a boring migration.

What it actually turned up was the trigger-privilege trap (§1) — that writing a transaction needs
`UPDATE` on `accounts` and `budget_categories` and `SELECT, UPDATE` on `liabilities`, privileges no
query in the codebase requests, because plain `plpgsql` triggers run as the *calling* role.

The methodical approach is what found it. Not "grant what the code queries" — that reading would
have shipped a broken database. Instead: enumerate every table, every role, every operation the
application actually performs *including through triggers*, then **verify on a throwaway PostgreSQL 17
instance configured to behave like post-cutoff Supabase**: 77 assertions covering both what must work
and what must be denied, run against an upgraded install and a fresh one, confirming byte-identical
privilege matrices.

**The lesson:** "verify the security change" means *try to break it*, on a database you're willing to
destroy. Testing only the happy path on your real database tells you almost nothing about the matrix
you just changed — and a permission bug that only appears on a *rebuilt* database is one you'll meet
for the first time in the worst possible circumstances.

### The build that hung, and the 68 failures that weren't (2026-11-20)

Final checks before committing the assistant. `vite build` — normally three seconds — sat there for
eleven minutes at 0% CPU. Not slow. *Waiting.*

A process that's stuck but idle is waiting on something outside itself, so the question was "on
what?" `df` answered it: the disk was **100% full, 3.4 GB free**. And this project lives in
`~/Desktop`, which iCloud syncs. When a Mac runs low on space, iCloud quietly *evicts* local files —
keeps the name, drops the contents, re-downloads on first read. `ls -lO` showed the flag: `dataless`
on source files, on test files, on chunks of `node_modules`, even on CSS written that same day. The
build was asking for thousands of files that had to come back from the cloud one at a time, while
the full disk evicted others to make room. A treadmill.

The fix wasn't in the code. Exporting the staged tree to `/tmp` (`git checkout-index`) and building
there took **2.7 seconds**.

Then Playwright: **68 of 192 failed.** Looks like a disaster. It was two unrelated things wearing
one number:

- **40 were the same line** — `waitForURL('/dashboard')` in `loginUser()`. The failure snapshot
  showed the login form saying *"Request rate limit reached"*. Every test signs in through the UI;
  four browsers in parallel made ~190 logins in under four minutes, and Supabase Auth cut us off.
  Reusing one session made all 40 pass.
- **28 were old tests** with locators like `text=Settings`, which matches the heading, the nav link
  *and* a sentence containing the word. Running the same spec against the previous commit settled
  whose fault that was: **52 failures before the change, 34 after.** The change fixed 18 and broke
  none.

**The lessons:**

1. **Read the error before the count.** "68 failed" says nothing. "40 identical timeouts on the
   login line" says rate limit before you've opened a single file.
2. **A red test proves nothing until you know it was green before.** Always get a baseline from the
   previous commit. Without it you'd either block a good change or wave through a bad one.
3. **Don't keep a build tree in a synced folder.** iCloud, Dropbox, OneDrive — they all treat
   `node_modules` as 600 MB of documents to manage. Keep code somewhere like `~/Code`, and keep the
   disk from filling up. The symptom never says "disk full"; it says "everything is mysteriously
   slow."

---

## 6. If You're Picking This Up Again

**Read in this order:** `docs/changelog.md` (unusually detailed — most entries explain *why*, with
real numbers) → `backend/database/schema.sql` (the whole data model, triggers and policies, ~225
lines) → `frontend/src/lib/recurringUtils.js` (the hard logic) → whichever page you're changing.

**Rules this codebase actually lives by:**

1. **Ownership is enforced in the database, not the app.** New table → RLS policy **and** explicit
   grants, in the same migration. Both. They're different controls.
2. **Derived numbers belong in triggers,** because there are three writers (frontend, webhook,
   auto-add) and only one table.
3. **Date logic goes in `lib/recurringUtils.js`, uses `parseLocalDate`, and gets a unit test** with
   fixed dates. No exceptions — this is where every expensive bug has come from.
4. **Idempotency through database constraints, not application checks.** A unique index is a promise;
   an `if` is a race.
5. **Comment the non-obvious *why* next to the code.** The nine lines above the `setUser` comparison
   in `AuthContext` are load-bearing. So is `MATCH_WINDOW_DAYS`' "keep in sync" note.
6. **Prefer a known, labelled duplication over premature shared infrastructure** — then actually keep
   it in sync.
7. **When a number keeps needing per-case patches, change what it's a function of.**

**Loose ends worth a deliberate decision, not a drive-by fix:**
- `CLAUDE.md` documents five Netlify Functions that don't exist; the root `package.json` has three
  scripts pointing at a `backend/` with no Node project.
- Ten `mobile.spec.js` tests have failed since before the assistant landed: loose `text=` locators
  that match several elements, and `tap()` calls that can't run in the desktop browser projects.
- Account-balance and budget-spent triggers are insert-only, so soft delete doesn't reverse them
  (§1). Decide whether that's correct.
- Migration numbering collides; the timestamped file shows the better pattern.
- `AssetsLiabilities.jsx` is 3,227 lines. Split along the component boundaries that already exist, or
  don't split it — but don't invent layers to feel organised.

The project's real strength isn't the stack. It's that the hard-won knowledge got written down while
it was still fresh — the changelog entries carrying actual figures ($1,918.07 biweekly, 4 requests →
0, $687.87/9 vs $659.12/8), the comments explaining why the obvious code is wrong, the unit tests
reading like a list of past injuries. That's what makes a six-month-old codebase approachable instead
of archaeological. Keep doing that.
