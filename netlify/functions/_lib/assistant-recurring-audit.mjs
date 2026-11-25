import { createHash } from 'node:crypto';
import { MATCH_WINDOW_DAYS } from '../../../frontend/src/lib/recurringAutoAdd.js';

const dayMs = 86_400_000;
const maxMerchantAmountDriftCents = 500;
const maxMerchantAmountDriftRatio = 0.05;
const labelWords = new Set([
  'annual', 'annually', 'app', 'automatic', 'bill', 'billing', 'card', 'charge', 'company', 'corp',
  'credit', 'debit', 'fee', 'inc', 'ltd', 'membership', 'monthly', 'month', 'paid', 'payment', 'payments',
  'plan', 'plus', 'pos', 'premium', 'pro', 'recurring', 'services', 'sub', 'subscr', 'subscription', 'subscriptions', 'the', 'weekly',
  'apple', 'google', 'paypal', 'stripe',
]);
const sparseFrequencies = new Set(['monthly', 'quarterly', 'yearly']);
const genericMerchantWords = new Set(['cloud', 'family', 'music', 'storage', 'streaming']);
// These identifiers can appear on statements for several unrelated products.
const platformWords = new Set(['amazon', 'amzn', 'amznmktp', 'anthropic', 'microsoft', 'openai', 'marketplace',
  'digital', 'online', 'store', 'purchase', 'transaction', 'com', 'www']);
const planTiers = new Set(['basic', 'business', 'enterprise', 'family', 'individual', 'max', 'plus', 'premium', 'pro', 'starter', 'student', 'team', 'ultimate']);
const subscriptionWords = new Set(['membership', 'monthly', 'sub', 'subscr', 'subscription']);
const companyNames = new Map([['openai', 'OpenAI'], ['chatgpt', 'OpenAI'], ['anthropic', 'Anthropic'], ['claude', 'Anthropic']]);
const processorWords = new Set(['stripe', 'paypal', 'square', 'adyen', 'paddle', 'apple', 'google', 'amazon', 'amzn']);
const sourceStrength = { bank_statement: 0, saved_description: 1, merchant_name: 2 };
const statusKeys = ['on_schedule', 'early', 'late', 'missing', 'unmatched', 'ambiguous', 'possible', 'generated_only', 'activity_unknown', 'amount_mismatch', 'company_candidate'];

export function auditWords(text) {
  return typeof text === 'string'
    ? text.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
    : [];
}

export function phrasePositions(words, phrase) {
  if (!phrase.length) return [];
  const positions = [];
  for (let index = 0; index <= words.length - phrase.length; index++) {
    if (phrase.every((word, offset) => words[index + offset] === word)) positions.push(index);
  }
  return positions;
}

function containsPhrase(words, phrase) {
  return !!phrase.length && words.some((word, index) => word === phrase[0]
    && phrase.every((item, offset) => words[index + offset] === item));
}

function merchantWords(words) {
  return words.filter((word) => /\p{L}/u.test(word) && !labelWords.has(word));
}

function paymentIdentity(payment, category) {
  const nameWords = auditWords(payment.name);
  const saved = auditWords(payment.match_description);
  const merchant = nameWords.join(' ') === auditWords(category).join(' ') ? [] : merchantWords(nameWords);
  const company = [...nameWords, ...saved].map((word) => companyNames.get(word)).find(Boolean);
  const meaningfulSaved = merchantWords(saved).some((word) => word.length >= 3) && bareCompanyKey(saved) !== company?.toLowerCase();
  return {
    company, saved: meaningfulSaved ? saved : [],
    merchant: merchant.some((word) => word.length >= 4 && !genericMerchantWords.has(word)) ? merchant : [],
    appleBilling: nameWords.includes('apple') && merchant.length > 0,
    tiers: nameWords.filter((word) => planTiers.has(word)),
    api: nameWords.includes('api') || saved.includes('api'),
    product: new Set([...merchant, ...merchantWords(saved)].filter((word) => word.length >= 4
      && !genericMerchantWords.has(word) && !platformWords.has(word))),
  };
}

function conflictingService(identity, posting) {
  return (posting.words.includes('api') && !identity.api)
    || (identity.tiers.length && posting.tiers.length && !posting.tiers.some((word) => identity.tiers.includes(word)));
}

function namesAgree(identity, posting) {
  return containsPhrase(posting.merchant, identity.merchant) && !conflictingService(identity, posting);
}

function matchSource(expected, actual, sameAmount, distance) {
  if (actual.generatedOccurrence) return expected.id === actual.generatedOccurrence ? 'bank_statement' : null;
  // A company-only line cannot establish which of its products was billed,
  // even if a broad bank keyword or the exact scheduled amount also matches.
  if (expected.identity.company && (expected.identity.company.toLowerCase() === actual.companyKey
    || conflictingService(expected.identity, actual))) return null;
  const amountDifference = expected.cents != null && actual.cents != null
    ? Math.abs(expected.cents - actual.cents) : Infinity;
  const nearAmount = distance <= MATCH_WINDOW_DAYS && expected.cents > 0
    && amountDifference <= maxMerchantAmountDriftCents && amountDifference <= expected.cents * maxMerchantAmountDriftRatio;
  if (!sameAmount && !nearAmount) return null;
  if (containsPhrase(actual.words, expected.identity.saved)) return 'saved_description';
  if (namesAgree(expected.identity, actual)) return 'merchant_name';
  return null;
}

// A calendar occurrence can account for one bank payment. Preserve further
// independently recorded charges with the same statement wording as evidence,
// without assuming that they paid another instalment or that they are duplicates.
function reviewMerchantCharges(expected, actual, candidates, inMonth) {
  const { matches, used, expectedOptions, actualOptions } = candidates;
  const byOccurrence = new Map();
  const possible = new Map();
  const ambiguousCounts = new Map();
  const eligible = expected.filter((item) => inMonth(item.date) && item.identity.product.size && (!item.paused || item.generated));

  for (const posting of actual) {
    if (used.has(posting.id) || actualOptions.has(posting.id) || posting.generatedOccurrence || !inMonth(posting.date) || !(posting.cents > 0)) continue;
    const owners = eligible.filter((item) => item.date.slice(0, 7) === posting.date.slice(0, 7)
      && (item.sparse || Math.abs(item.day - posting.day) <= MATCH_WINDOW_DAYS * dayMs)
      && posting.merchant.some((word) => item.identity.product.has(word)));
    if (!owners.length) continue;
    if (owners.length > 1) {
      ambiguousCounts.set(posting.id, owners.length);
      for (const item of owners) ambiguousCounts.set(item.id, (ambiguousCounts.get(item.id) ?? 0) + 1);
      continue;
    }
    const [occurrence] = owners;
    if (occurrence.identity.company && conflictingService(occurrence.identity, posting)) continue;
    const known = matches.get(occurrence.id);
    if (known) {
      if (known.source === 'processor_amount' || !inMonth(known.posting.date) || !(known.posting.cents > 0)
        || !occurrence.sparse || known.posting.statementKey !== posting.statementKey) continue;
      if (!byOccurrence.has(occurrence.id)) byOccurrence.set(occurrence.id, []);
      byOccurrence.get(occurrence.id).push(posting);
      used.add(posting.id);
      continue;
    }
    if (expectedOptions.has(occurrence.id) || !(occurrence.cents > 0)
      || Math.abs(occurrence.day - posting.day) > MATCH_WINDOW_DAYS * dayMs) continue;
    const saved = containsPhrase(posting.words, occurrence.identity.saved);
    if (!saved && !namesAgree(occurrence.identity, posting)) continue;
    const describesSubscription = posting.words.some((word) => subscriptionWords.has(word));
    if (!saved && !describesSubscription && posting.statementKey !== occurrence.identity.merchant.join(' ')) continue;
    if (!possible.has(occurrence.id)) possible.set(occurrence.id, []);
    possible.get(occurrence.id).push({ posting, source: saved ? 'saved_description' : 'merchant_name' });
  }
  for (const [id, choices] of possible) {
    if (choices.length === 1) {
      matches.set(id, { ...choices[0], differenceDays: null, amountMismatch: true });
      used.add(choices[0].posting.id);
    } else {
      ambiguousCounts.set(id, choices.length);
      for (const { posting } of choices) ambiguousCounts.set(posting.id, 1);
    }
  }
  return { byOccurrence, ambiguousCounts };
}

function recordOption(options, key, score, edge) {
  const best = options.get(key);
  if (best && best.score < score) return;
  if (best?.score === score) {
    best.candidates.push(edge);
  } else {
    options.set(key, { score, candidates: [edge] });
  }
}

function candidateOptions(expected, actual) {
  const expectedOptions = new Map();
  const actualOptions = new Map();
  for (const occurrence of expected) {
    for (const posting of actual) {
      const differenceDays = (posting.day - occurrence.day) / dayMs;
      const distance = Math.abs(differenceDays);
      const sameMonth = occurrence.date.slice(0, 7) === posting.date.slice(0, 7);
      if (distance > MATCH_WINDOW_DAYS && !(occurrence.sparse && sameMonth)) continue;
      const sameAmount = occurrence.cents != null && occurrence.cents === posting.cents;
      const source = matchSource(occurrence, posting, sameAmount, distance);
      if (!source) continue;

      // Prefer an exact amount when inferring identity from a merchant name alone.
      const amountPenalty = sameAmount ? 0 : source === 'merchant_name' ? 100 : 1;
      const score = sourceStrength[source] * 1_000 + amountPenalty + distance * 2;
      const edge = { occurrence, posting, source, differenceDays };
      recordOption(expectedOptions, occurrence.id, score, edge);
      recordOption(actualOptions, posting.id, score, edge);
    }
  }
  return { expectedOptions, actualOptions };
}

function candidateMatches(expected, actual) {
  const options = candidateOptions(expected, actual);
  const { expectedOptions, actualOptions } = options;
  const matches = new Map();
  const used = new Set();
  for (const [id, { candidates }] of expectedOptions) {
    if (candidates.length !== 1) continue;
    const edge = candidates[0];
    const postingOptions = actualOptions.get(edge.posting.id).candidates;
    // An occurrence and a posting must be each other's only strongest match.
    if (postingOptions.length !== 1 || postingOptions[0] !== edge) continue;
    matches.set(id, edge);
    used.add(edge.posting.id);
  }
  const unresolved = matches.size === 0 ? options : candidateOptions(
    expected.filter(({ id }) => !matches.has(id)), actual.filter(({ id }) => !used.has(id)),
  );
  return { ...unresolved, matches, used };
}

function appleBillingCandidates(expected, actual, { matches, used, expectedOptions, actualOptions }) {
  const key = ({ date, cents }) => `${date.slice(0, 7)}:${cents}`;
  const byAmount = (items) => {
    const matchesByAmount = new Map();
    for (const item of items) {
      const amount = key(item);
      if (!matchesByAmount.has(amount)) matchesByAmount.set(amount, []);
      matchesByAmount.get(amount).push(item);
    }
    return matchesByAmount;
  };
  const scheduled = byAmount(expected.filter(({ sparse, identity, cents, id }) => sparse && identity.appleBilling
    && cents > 0 && !matches.has(id) && !expectedOptions.has(id)));
  const recorded = byAmount(actual.filter(({ words, cents, id }) => cents > 0 && containsPhrase(words, ['apple', 'com', 'bill']) && !used.has(id) && !actualOptions.has(id)));
  for (const [amount, occurrences] of scheduled) {
    const postings = recorded.get(amount);
    if (occurrences.length !== 1 || postings?.length !== 1) continue;
    const [occurrence] = occurrences;
    const [posting] = postings;
    matches.set(occurrence.id, { source: 'processor_amount', posting, differenceDays: null });
    used.add(posting.id);
  }
}

function expenseCents(value) {
  const amount = Math.round(Math.abs(Number(value)) * 100);
  return Number.isSafeInteger(amount) ? amount : null;
}

// Accept a bare company name with optional statement prefix and corporate
// suffix. A line identifying a specific product or usage needs its own evidence.
function bareCompanyKey(words) {
  const start = words[0] === 'at' ? 1 : 0;
  const end = /^(?:inc|corp|llc|ltd)$/.test(words.at(-1)) ? words.length - 1 : words.length;
  const word = words[start];
  return end - start === 1 && /^\p{L}{3,}$/u.test(word) && !processorWords.has(word)
    && !labelWords.has(word) && !genericMerchantWords.has(word) ? word : null;
}

function statementCompany(occurrence, primary) {
  if (occurrence.identity.company) return occurrence.identity.company;
  const description = primary?.description ?? '';
  const star = description.indexOf('*');
  if (star < 0 || !auditWords(description.slice(star + 1)).some((word) => occurrence.identity.product.has(word))) return null;
  const key = bareCompanyKey(auditWords(description.slice(0, star)));
  if (!key || platformWords.has(key) || occurrence.identity.product.has(key)) return null;
  return key.toUpperCase();
}

function companySchedules(expected, matches, inMonth) {
  const groups = new Map();
  for (const occurrence of expected) {
    if (!inMonth(occurrence.date) || (occurrence.paused && !occurrence.generated)) continue;
    const match = matches.get(occurrence.id);
    const primary = Number.isFinite(match?.differenceDays) ? match.posting : null;
    const company = statementCompany(occurrence, primary);
    if (!company) continue;
    const key = company.toLowerCase();
    if (!groups.has(key)) groups.set(key, { company, options: [] });
    groups.get(key).options.push({ occurrence, primary });
  }
  return groups;
}

function companyQuestion(posting, groups, category) {
  const group = groups.get(posting.companyKey);
  if (!group || posting.generatedOccurrence || !(posting.cents > 0)) return null;
  const nearest = new Map();
  for (const { occurrence, primary } of group.options) {
    if (occurrence.date.slice(0, 7) !== posting.date.slice(0, 7)) continue;
    const distance = Math.abs(occurrence.day - posting.day) / dayMs;
    if (!occurrence.sparse && distance > MATCH_WINDOW_DAYS) continue;
    const previous = nearest.get(occurrence.scheduleId);
    if (previous && (previous.distance < distance || (previous.distance === distance && previous.occurrence.date <= occurrence.date))) continue;
    nearest.set(occurrence.scheduleId, { occurrence, primary, distance });
  }
  const companyCandidates = [...nearest.values()]
    .sort((a, b) => a.occurrence.scheduleId.localeCompare(b.occurrence.scheduleId))
    .map(({ occurrence, primary }) => ({
      scheduleId: occurrence.scheduleId, name: occurrence.name, expectedDate: occurrence.date,
      expectedAmount: occurrence.cents == null ? null : occurrence.cents / 100,
      actualDate: primary?.date ?? null, actualAmount: primary?.cents == null ? null : primary.cents / 100,
      description: primary?.description ?? null,
    }));
  if (!companyCandidates.length) return null;
  const reviewKey = createHash('sha256').update(JSON.stringify([
    category, posting.id, posting.date, posting.cents, posting.description, companyCandidates,
  ])).digest('hex');
  return { company: group.company, companyCandidates, reviewKey, transactionId: posting.id };
}

export function reconcileRecurringDates({ schedules, ledger, category, startDate, endDate, maxComparisons }) {
  // A linked transaction is produced by the calendar itself. It establishes the
  // historical occurrence, even after a rule is edited or paused, but cannot
  // independently confirm the date on which the bank posted the payment.
  const generatedBySchedule = new Map();
  for (const row of ledger) {
    if (!row.recurring_payment_id) continue;
    if (!generatedBySchedule.has(row.recurring_payment_id)) generatedBySchedule.set(row.recurring_payment_id, new Map());
    generatedBySchedule.get(row.recurring_payment_id).set(row.date, row);
  }
  const expected = schedules.flatMap(({ schedule, dates }) => {
    const identity = paymentIdentity(schedule, category);
    const name = schedule.name?.trim().slice(0, 250) || 'Scheduled payment';
    const generated = generatedBySchedule.get(schedule.id);
    const historicalDates = new Set([...dates, ...(generated?.keys() ?? [])]);
    return Array.from(historicalDates, (date) => {
      const entry = generated?.get(date);
      return {
        id: `${schedule.id}:${date}`, scheduleId: schedule.id, date, day: Date.parse(date), name,
        cents: expenseCents(entry?.amount ?? schedule.amount), identity, generated: entry, paused: schedule.is_active === false,
        sparse: sparseFrequencies.has(schedule.frequency),
        businessDaysOnly: schedule.business_days_only === true, lastBusinessDayOfMonth: schedule.last_business_day_of_month === true,
      };
    }).filter(({ generated: row }) => !row?.deleted_at);
  });
  const actual = ledger.flatMap((entry) => {
    if (entry.deleted_at || (entry.recurring_payment_id && !entry.recurring_bank_posting)) return [];
    const row = entry.recurring_payment_id ? entry.recurring_bank_posting : entry;
    const description = row.description?.trim().slice(0, 250) || null;
    const words = auditWords(description);
    // Some bank exports prefix the same merchant line with "at".
    const statementKey = (words[0] === 'at' ? words.slice(1) : words).join(' ');
    return [{
      id: entry.id, date: row.date, day: Date.parse(row.date), description, words, statementKey, merchant: merchantWords(words),
      companyKey: bareCompanyKey(words),
      tiers: words.filter((word) => planTiers.has(word)),
      generatedOccurrence: entry.recurring_payment_id ? `${entry.recurring_payment_id}:${entry.date}` : null,
      cents: expenseCents(row.amount),
    }];
  });
  if (expected.length * actual.length > maxComparisons) return null;
  const candidates = candidateMatches(expected, actual);
  appleBillingCandidates(expected, actual, candidates);
  const { expectedOptions, actualOptions, matches, used } = candidates;
  const inMonth = (date) => date >= startDate && date <= endDate;
  const { byOccurrence, ambiguousCounts } = reviewMerchantCharges(expected, actual, candidates, inMonth);
  const companyGroups = companySchedules(expected, matches, inMonth);
  const rows = [];
  for (const occurrence of expected) {
    const match = matches.get(occurrence.id);
    if (!inMonth(occurrence.date) && !inMonth(match?.posting.date)) continue;
    const { posting, source, differenceDays } = match ?? {};
    const candidateCount = match ? 1 : expectedOptions.get(occurrence.id)?.candidates.length ?? ambiguousCounts.get(occurrence.id) ?? 0;
    let status;
    if (candidateCount > 0 && !match) status = 'ambiguous';
    else if (occurrence.paused && !occurrence.generated) status = 'activity_unknown';
    else if (source === 'processor_amount') status = 'possible';
    else if (match?.amountMismatch) status = 'amount_mismatch';
    else if (match) status = differenceDays === 0 ? 'on_schedule' : differenceDays < 0 ? 'early' : 'late';
    else status = occurrence.generated ? 'generated_only' : 'missing';
    const extras = byOccurrence.get(occurrence.id);
    const totalPosted = extras?.reduce((total, extra) => total + extra.cents, posting?.cents);
    rows.push({
      id: `expected:${occurrence.id}`, name: occurrence.name,
      expectedDate: occurrence.date, actualDate: posting?.date ?? null,
      expectedAmount: occurrence.cents == null ? null : occurrence.cents / 100,
      actualAmount: posting?.cents == null ? null : posting.cents / 100,
      differenceDays: differenceDays ?? null, description: posting?.description ?? null,
      businessDaysOnly: occurrence.businessDaysOnly, lastBusinessDayOfMonth: occurrence.lastBusinessDayOfMonth,
      status, generated: Boolean(occurrence.generated), paused: occurrence.paused,
      matchSource: source ?? null, candidateCount,
      ...(extras && {
        relatedCharges: extras.sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))
          .map(({ description, date, cents }) => ({ description, date, amount: cents / 100 })),
        relatedChargeCount: extras.length, totalPostedAmount: totalPosted / 100,
        differenceFromPlan: (totalPosted - occurrence.cents) / 100,
      }),
    });
  }
  for (const posting of actual) {
    if (!inMonth(posting.date) || used.has(posting.id)) continue;
    const candidateCount = actualOptions.get(posting.id)?.candidates.length ?? ambiguousCounts.get(posting.id) ?? 0;
    const question = !candidateCount && companyQuestion(posting, companyGroups, category);
    rows.push({
      id: `actual:${posting.id}`, name: posting.description ?? 'Recorded transaction',
      expectedDate: null, actualDate: posting.date, expectedAmount: null,
      actualAmount: posting.cents == null ? null : posting.cents / 100,
      differenceDays: null, description: posting.description,
      status: question ? 'company_candidate' : candidateCount ? 'ambiguous' : 'unmatched',
      matchSource: null, candidateCount: question ? question.companyCandidates.length : candidateCount,
      ...question,
    });
  }
  return rows.sort((a, b) => (a.expectedDate ?? a.actualDate).localeCompare(b.expectedDate ?? b.actualDate)
    || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function recurringAuditReport(report, rows, limit) {
  const counts = Object.fromEntries(statusKeys.map((key) => [key, 0]));
  for (const { status } of rows) counts[status]++;
  const relatedChargeCount = rows.reduce((n, row) => n + (row.relatedChargeCount ?? 0), 0);
  const priority = (row) => row.status === 'company_candidate' ? 0 : row.relatedChargeCount || row.status === 'amount_mismatch' ? 1 : 2;
  const visible = [...rows].sort((a, b) => priority(a) - priority(b)).slice(0, limit)
    .map((row) => row.relatedChargeCount > limit ? { ...row, relatedCharges: row.relatedCharges.slice(0, limit) } : row);
  return { ...report, counts, relatedChargeCount, rows: visible, rowCount: rows.length, omittedRows: Math.max(0, rows.length - limit) };
}
