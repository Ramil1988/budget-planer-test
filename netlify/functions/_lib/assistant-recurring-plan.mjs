import { auditMonthChoices, auditMonthFromText } from './assistant-recurring-intent.mjs';
import { auditWords } from './assistant-recurring-audit.mjs';

const createVerb = /(?:\b(?:create|add|set up)\b|созда(?:й|ть|вай|вать|дим)|завед(?:и|ём|ем)|завести|добав(?:ь|ить|им)|внеси)/iu;
const editVerb = /(?:\b(?:update|edit|fix|correct|adjust|reschedule|align)\b|исправ(?:ь|ить|им)|измен(?:и|ить)|поправ(?:ь|ить)|обнов(?:и|ить)|перенес(?:и|ти)|скорректир(?:уй|овать))/iu;
const scheduleWord = /\brecurr?ings?\b|расписан|регулярн\p{L}* платеж|подписк|\bschedules?\b/iu;
const auditReference = /\b(?:these|missing|unmatched|mismatches|discrepanc\w*|audit|matched)\b|\bwithout (?:a )?(?:recurring )?(?:schedule|record)\b|без пары|непарн|несопоставлен|отсутств|там[, ]+где|где (?:нет запис\p{L}*|запис\p{L}* нет)|недоста|несоответств|расхожд|из (этой )?сверки|существующ|имеющ|остальн/iu;
const cancel = /\b(?:cancel|never ?mind|stop|no changes)\b|отмен[аи]|передумал/iu;
const readOnly = /\bread[ -]only\b|\bjust (?:check|review|audit)\b|\bno (?:writes|edits|changes)\b|только (?:сверк|провер|покаж|найти)|без (?:изменени|записи)|ничего не (?:записы|сохраня|меня)/iu;
const negatedWrite = /\b(?:do not|don't|don’t|never) (?:add|update|fix|create|edit|change)|(?:не |нельзя |без )(?:создава|созда[йть]|добавля|добав[ьит]|исправля|исправ[ьи]|обновля|обнови|меня[йть])/iu;
const targetedDate = /(?:исправ|измени|поправ|обнови|перенеси)\p{L}*\s+(?:дат\p{L}*|день)|\b(?:change|edit|update|correct|fix) (?:the )?(?:billing |scheduled |recurring )?dates?\b/iu;
const standaloneTerms = /(?:[$€£]|\b(?:cad|usd)\b|\d[.,]\d{2}|\bstarting\b|\bstarts? on\b|начиная с|сумм\p{L}*\s+\d)/iu;
const refersToLast = /(?:по (?:этой |последней )?сверке|из (?:этой |последней )?сверки|(?:тогда|эти|упомянут|их|те же|указанн)|\b(?:these|those|them|the audit|this audit|from the audit)\b)/iu;
const exception = /(?:кроме|исключая|исключи(?:ть)?|за исключением|пропусти(?:ть)?|\b(?:except(?: for)?|excluding|exclude|skip)\b)\s+/iu;
// Only a new imperative can end an exception. Decimal separators, merchant
// lists, and qualifiers such as “and only if …” stay with their filter.
const commandObject = /(?:(?:the|all|any|missing|existing|monthly|billing|posted|new|все|отсутствующ\p{L}*|недостающ\p{L}*|существующ\p{L}*|ежемесячн\p{L}*)\s+)*(?:дат\p{L}*|расписан\p{L}*|подписк\p{L}*|recurr?ings?|dates?|schedules?)(?!\p{L})/iu;
const nextCommand = new RegExp(
  String.raw`(?:[.!?;,]\s*|\s+(?=(?:и|а|также|затем|and|also|then)\s))(?:(?:и|а|также|затем|and|also|then)\s+)*(?=(?:${createVerb.source}|${editVerb.source})\s+${commandObject.source})`, 'iu',
);
const referenceException = /^(?:(?:the |those |these |previously |specified |mentioned |above|listed|same)\b|(?:ранее |раньше |указанн|упомянут|перечисленн|названн|тех же|этих))/iu;
const yes = /^(?:да|ага|верно|подтверждаю|yes|yeah|correct|confirm(?:ed)?|ok(?:ay)?|ок(?:ей)?)[.!\s]*$/iu;
const copy = (ru, en) => ({ ru, en });
const selectRows = copy('Уточни только фильтр: какого продавца выбрать или исключить и, при необходимости, какие суммы. Месяц, даты и операции я возьму из сверки.',
  'Which merchant should I include or exclude, and at which amounts? I can read the dates and transactions from the audit.');
const missingReference = copy('Какие суммы этого продавца исключить? Вижу операции в базе, повторять их список не нужно.',
  'Which amounts from that merchant should I exclude? I can read the charges directly from the audit.');
const scopePrompt = copy('Укажи месяц и категорию расходов для сверки, например «Subscriptions за ноябрь 2026».',
  'Which expense category and month should I reconcile, for example “Subscriptions in November 2026”?');
const refreshPrompt = copy('Укажи категорию и месяц для новой сверки. Предыдущая карточка относится к другому периоду или категории.',
  'Which category and month should I check for the new audit? The previous card covers a different scope.');

const cadencePrompt = copy('Для новых расписаний доступны интервалы день, неделя, две недели, месяц, квартал и год. Какой выбрать?',
  'New schedules currently support daily, weekly, biweekly, monthly, quarterly, and yearly. Which one should I use?');

const planMonthPrompt = copy('За какой месяц подготовить изменения в Recurring?', 'Which month should I prepare Recurring changes for?');

export function recurringPlanCategoryPrompt(month, language) {
  const period = month.slice(5) + '.' + month.slice(0, 4);
  return language === 'ru' ? `Для какой категории подготовить изменения в Recurring за ${period}?`
    : `Which expense category should I prepare Recurring changes for in ${period}?`;
}

const namesCategory = /категори\p{L}*\s+[«"“]?[\p{L}\d]|\bcategory\s+[“"]?[\p{L}\d]|\bin (?:the )?[\p{L}\d& /-]+ category\b/iu;

function clarificationMonth(prompt) {
  const period = /(0[1-9]|1[0-2])\.(20\d{2})\?$/.exec(prompt);
  if (!period) return null;
  const month = `${period[2]}-${period[1]}`;
  return ['ru', 'en'].some(lang => recurringPlanCategoryPrompt(month, lang) === prompt) ? month : null;
}

const cadences = [
  ['monthly', /ежемесячн\p{L}*|раз в месяц|\bmonthly\b|every month/iu],
  ['weekly', /еженедельн\p{L}*|раз в неделю|\bweekly\b|every week/iu],
  ['biweekly', /раз в две недели|каждые две недели|\bbiweekly\b|every two weeks/iu],
  ['quarterly', /ежеквартальн\p{L}*|раз в квартал|\bquarterly\b|every quarter/iu],
  ['yearly', /ежегодн\p{L}*|раз в год|\byearly\b|\bannually\b|every year/iu],
  ['daily', /ежедневн\p{L}*|раз в день|\bdaily\b|every day/iu],
];

// Words that describe the operation rather than identify a particular charge.
// Any other words must name something visible in this user's refreshed audit.
const reviewWords = new Set((
  'a an the my for to by in from of at on with as and or please yes all any every these those them this that ' +
  'create add set up update edit fix correct adjust align reschedule find compare check reconcile audit review ' +
  'missing unmatched existing matched different mismatched discrepancies discrepancy differences changes according actual expected based posted ' +
  'monthly weekly biweekly annually yearly daily quarterly recurring recurrings recuring recurings schedule schedules ' +
  'date dates billing day days charge charges transaction transactions payment payments expense expenses period category categories ' +
  'subscriptions subscription calendar record records ledger their new no match same listed ' +
  'да мне мои моим по за для с со на к из их им и а или но у до от там где в во как чтобы сам сами пожалуйста ' +
  'все всё всех без весь тот вся эти этим это этой эту этого тех те тех же только которые которым которых должна нужно есть нет так ' +
  'раз раза каждый каждую каждые два две ежемесячно ранее отдельно еще ещё также теперь тогда сначала'
).split(/\s+/u));
const reviewStems = /^(?:най(?:ди|ти)|проверь|свер\p{L}*|сопостав\p{L}*|запис\p{L}*|созда\p{L}*|заве\p{L}*|добав\p{L}*|внеси|исправ\p{L}*|поправ\p{L}*|измени\p{L}*|обнов\p{L}*|перенеси\p{L}*|скорректир\p{L}*|расписан\p{L}*|дат(?:а|у|ы|ой|ами|ам|ах)?|транзакци\p{L}*|плат[её]ж\p{L}*|операци\p{L}*|списани\p{L}*|расход\p{L}*|подписк\p{L}*|несоответств\p{L}*|отсутств\p{L}*|недостающ\p{L}*|остальн\p{L}*|непарн\p{L}*|несопоставленн\p{L}*|совпад\p{L}*|существующ\p{L}*|имеющ\p{L}*|нов[ыо]\p{L}*|расхожд\p{L}*|ежемесячн\p{L}*|еженедельн\p{L}*|ежеквартальн\p{L}*|ежедневн\p{L}*|ежегодн\p{L}*|регулярн\p{L}*|периодическ\p{L}*|месяц\p{L}*|категори\p{L}*|пар[аеыу]|дн(?:я|и|ей)|день|недел[юия]|год[ау]?|запланированн\p{L}*|фактическ\p{L}*)$/u;
const monthWord = /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun[e]?|jul[y]?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|январ\p{L}*|феврал\p{L}*|март\p{L}*|апрел\p{L}*|ма[йея]|ию[нл]\p{L}*|август\p{L}*|сентябр\p{L}*|октябр\p{L}*|ноябр\p{L}*|декабр\p{L}*|20\d{2})$/iu;

function actionIn(text, hasContext) {
  // An explicit request to add a transaction/report belongs to its own tool.
  if (/(?:добавь|создай|исправь|измени)\s+(?:новую\s+|эту\s+)?(?:транзакци|операци|отч[её]т)|\b(?:add|update|edit|create) (?:a |the )?(?:transaction|report)\b/iu.test(text)) return null;
  if (readOnly.test(text) || negatedWrite.test(text) || /(?:как|зачем|как бы|what if|how (?:do|can|would|to))\s+(?:мне )?(?:созда|добав|исправ|измен|update|add|create|fix)/iu.test(text)) return null;
  const create = createVerb.test(text);
  const update = editVerb.test(text);
  const bulk = auditReference.test(text);
  if (!(create || update) || (!scheduleWord.test(text) && !hasContext && !bulk)) return null;
  // “Add rent, $120 monthly starting ...” is a new standalone instruction.
  // A bare merchant reference can narrow date corrections after an audit.
  if (!bulk && (!hasContext || !targetedDate.test(text) || standaloneTerms.test(text))) return null;
  return { create, update, bulk };
}

function explicitScope(text, today) {
  const months = auditMonthChoices(text, today);
  const relativeMonth = /(?:\b(?:last|this|previous) month\b|(?:прошл|предыдущ|этот|этом)\p{L}*\s+месяц)/iu.test(text);
  return { specified: months.length > 0 || relativeMonth, month: auditMonthFromText(text, today) };
}

function requestParts(text) {
  const match = exception.exec(text);
  if (!match) return { instruction: text, excluded: null };
  const prefix = text.slice(0, match.index);
  const tail = text.slice(match.index + match[0].length);
  const boundary = nextCommand.exec(tail);
  const next = boundary && tail.slice(0, boundary.index).trim() ? boundary : null;
  return {
    instruction: next ? prefix + ' ' + tail.slice(next.index + next[0].length) : prefix,
    excluded: (next ? tail.slice(0, next.index) : tail).trim().replace(/[).!?\s]+$/u, ''),
  };
}

function refinement(text) {
  const clean = text.trim().replace(/^(?:(?:а |но |ещё |еще |теперь |тогда |также |и |and |also |now )+)/iu, '');
  const include = /^(?:оставь только|выбери только|только|keep only|only include|select only|only) (.+)$/iu.exec(clean);
  if (include) return { only: include[1] };
  const omit = /^(?:без|кроме|пропусти|исключи|except(?: for)?|excluding|skip|exclude|without) (.+)$/iu.exec(clean);
  if (!omit) return null;
  const replacement = /^(?:только|only) (.+)$/iu.exec(omit[1]);
  return { except: replacement?.[1] ?? omit[1], replace: Boolean(replacement) };
}

// The context identifies a report to re-read for the signed-in actor. It never
// supplies a row to write. Exceptions come from the user's own turns after it.
export function recurringPlanIntent(messages, auditContext, today, resolvedScope = null) {
  const last = messages.at(-1);
  if (last?.role !== 'user') return null;
  const text = last.content.trim();
  const reply = messages.at(-2);
  const original = messages.at(-3);
  const prompt = reply?.role === 'assistant' ? reply.content.split('\n')[0].trim() : '';
  if (original?.role === 'user' && Object.values(cadencePrompt).includes(prompt)) {
    const answer = text.replace(/^(?:тогда |давай |please )/iu, '').replace(/[.!]+$/u, '').trim();
    const chosen = cadences.find(([, pattern]) => new RegExp(`^(?:${pattern.source})$`, 'iu').test(answer));
    const namedInterval = new Map([['день','daily'], ['неделя','weekly'], ['две недели','biweekly'],
      ['месяц','monthly'], ['квартал','quarterly'], ['год','yearly']]).get(answer.toLowerCase());
    const frequency = chosen?.[0] ?? namedInterval;
    if (frequency || yes.test(text)) {
      const previous = recurringPlanIntent(messages.slice(0, -2), auditContext, today, resolvedScope);
      if (previous?.clarify === cadencePrompt) return frequency ? { ...previous, frequency, clarify: undefined } : previous;
    }
  }
  const categoryPromptMonth = clarificationMonth(prompt);
  const clarifyingScope = categoryPromptMonth || [...Object.values(scopePrompt), ...Object.values(refreshPrompt), ...Object.values(planMonthPrompt)].includes(prompt);
  if (clarifyingScope && original?.role === 'user' && text.length <= 160 &&
      !/[?？]/u.test(text) && !createVerb.test(text) && !editVerb.test(text) && !cancel.test(text) && !yes.test(text)) {
    const answer = explicitScope(text, today);
    const month = resolvedScope?.month ?? (answer.specified ? answer.month : categoryPromptMonth);
    if (!month) return { clarify: planMonthPrompt };
    // A month-only answer leaves the category from the request in effect; a
    // category choice may carry a month already resolved several turns ago.
    const words = text.toLowerCase().replace(/20\d{2}-(?:0[1-9]|1[0-2])/gu, ' ').match(/[\p{L}\p{N}]+/gu) ?? [];
    const monthOnly = answer.specified && words.every(word => monthWord.test(word) ||
      /^(?:за|в|тогда|только|месяц|месяце|этот|этом|прошлый|прошлом|предыдущий|год|года|г|in|for|just|last|previous|this|month)$/u.test(word));
    const originalInstruction = requestParts(original.content).instruction;
    const scope = resolvedScope ?? (monthOnly && auditContext?.category && !namesCategory.test(originalInstruction)
      ? { month, category: auditContext.category }
      : { month, question: monthOnly ? originalInstruction : text });
    const resumed = recurringPlanIntent(messages.slice(0, -2), auditContext, today, scope);
    // A category name or numeric month is a selection in the current conversation.
    if (resumed) return { ...resumed, language: /\p{Script=Cyrillic}/u.test(prompt) ? 'ru' : 'en' };
    return null;
  }
  const history = auditContext ? messages.slice(auditContext.fromIndex ?? 0, -1) : [];
  const base = auditContext ? { category: auditContext.category, month: auditContext.month } : null;
  const previousMentionsSchedule = scheduleWord.test(reply?.content ?? '');
  const cancelled = cancel.test(text) && (!history.length || scheduleWord.test(text) || previousMentionsSchedule)
    || /^(?:нет|no)[.!\s]*$/iu.test(text) && previousMentionsSchedule;
  const declinesWrite = /^(?:ничего не |не )(?:создавай|создавать|добавляй|добавлять|меняй|исправляй|изменяй)|^do(?: not|n['’]t) (?:create|add|change|fix|edit|update)/iu.test(text)
    && !/[,;]\s*\S/iu.test(text);
  if (cancelled || declinesWrite) return base ? { scope: base, cancelled: true } : null;
  const parts = requestParts(text);
  const currentRefinement = refinement(text);
  const refersBack = Boolean(parts.excluded && referenceException.test(parts.excluded));
  const carryingRows = /(?:остальн\p{L}*|упомянут\p{L}*|(?:создай|добавь|исправь)\s+их(?:\s|$)|\b(?:the remaining|the rest|add them|fix them)\b)/iu.test(parts.instruction);
  const shortReply = yes.test(text) || Boolean(currentRefinement);
  // Resolve the preceding user turn with its own history. This follows old
  // confirmation buttons and successive refinements back to the original
  // restrictions, stopping at a new topic or the source audit.
  const recentReply = history.at(-1);
  const resumesReview = shortReply && recentReply?.role === 'assistant' && scheduleWord.test(recentReply.content);
  const prior = (resumesReview || refersBack || carryingRows) && original?.role === 'user' && history.length >= 2
    ? recurringPlanIntent(messages.slice(0, -2), auditContext, today)
    : null;
  const pending = prior && !prior.cancelled && (prior.create || prior.update);
  if (resumesReview && pending) {
    if (prior.clarify || !currentRefinement) return prior;
    const exclusions = currentRefinement.replace ? [] : prior.exceptionTexts ?? [];
    return {
      ...prior,
      exceptionTexts: currentRefinement.except ? [...new Set([...exclusions, currentRefinement.except])] : exclusions,
      only: currentRefinement.only ?? prior.only,
    };
  }
  const action = actionIn(parts.instruction, Boolean(base));
  if (!action) {
    if (base && auditContext.historyTruncated && shortReply && !original) {
      return { scope: base, create: true, update: true, manualSelection: true, clarify: selectRows };
    }
    return null;
  }

  const scope = explicitScope(parts.instruction, today);
  const categoryExplicit = namesCategory.test(parts.instruction);
  if (!resolvedScope && (!scope.month || !base && !scope.specified)) {
    return { ...action, clarify: base || categoryExplicit ? planMonthPrompt : scopePrompt };
  }
  const requestedScope = resolvedScope ?? (!base || categoryExplicit
    ? { month: scope.specified ? scope.month : base?.month, question: parts.instruction }
    : { ...base, ...(scope.specified ? { month: scope.month } : {}) });
  const carry = pending && (refersBack || carryingRows);
  if ((refersBack && !prior?.exceptionTexts?.length) || (carry && prior.clarify) || (!action.bulk && auditContext?.historyTruncated)) {
    return { ...action, scope: requestedScope, manualSelection: true, clarify: missingReference };
  }
  const exceptionTexts = carry ? [...(prior.exceptionTexts ?? [])] : [];
  if (!refersBack && parts.excluded) exceptionTexts.push(parts.excluded);
  const cadenceText = parts.instruction;
  const frequency = cadences.filter(([, pattern]) => pattern.test(cadenceText)).map(([kind]) => kind);
  // Unsupported changes of frequency/amount or arbitrary row predicates need
  // explicit row selection. Never interpret an unknown restriction as “all”.
  const cadenceRemainder = cadenceText.replace(/раз в две недели|каждые две недели|every two weeks/giu, '');
  const chooseCadence = frequency.length > 1 || /\b(?:every|each)\s+(?:\d+|two|three|four)|кажды[ей]\s+\d+|раз в \d+/iu.test(cadenceRemainder);
  if (!refersBack && /\b(?:under|above|over|less than|more than|cheapest|largest|smallest|first|last)\s+(?:the\s+)?(?:\d|charge|row|payment)|(?:сумм\p{L}* (?:меньше|больше)|дешевле|дороже|первые \d|последние \d)|(?:только|\bonly)\s+(?!в Recurr?ing|для (?:непарных|списаний без пары)|(?:the )?(?:unmatched|missing|matched)|(?:отсутствующ|недостающ))/iu.test(parts.instruction)) {
    return { ...action, scope: requestedScope, manualSelection: true, clarify: selectRows };
  }
  // On a cadence clarification keep merchant/amount filters and the resolved
  // month. Only a syntactically recognized interval can be removed from them.
  const instruction = chooseCadence ? parts.instruction.replace(
    /(?:кажды[ей]|раз в|every|each)\s+(?:\d+|two|three|four)\s+(?:месяц\p{L}*|недел\p{L}*|дн(?:я|ей)|год[а]?|лет|months?|weeks?|days?|years?)(?!\p{L})/giu, ' ',
  ) : parts.instruction;
  return {
    ...action, scope: requestedScope, instruction,
    exceptionTexts: [...new Set(exceptionTexts)], only: carry ? prior.only : undefined,
    frequency: frequency[0] ?? (carry ? prior.frequency : null) ?? 'monthly',
    ...(chooseCadence && { clarify: cadencePrompt }),
  };
}

const amountPattern = /(?<![\p{L}\d])\d+(?:[.,]\d{1,2})?(?![\p{L}\d])/gu;
function exclusionsFor(rows, expressions) {
  const filters = [];
  for (const expression of expressions) {
    // Commas inside a decimal amount and commas between amounts have different meanings.
    const groups = expression.split(/(?:;\s*|,\s+|\s+(?:и|and)\s+)(?=\p{L})/iu);
    for (const group of groups) {
      const cents = [...group.matchAll(amountPattern)].map(([amount]) => Math.round(Number(amount.replace(',', '.')) * 100));
      const name = auditWords(group.replace(amountPattern, ' ').replace(/[$€£]/gu, ' '))
        .filter((word) => !['cad','долларов','доллара','долл','и','and'].includes(word));
      if (!name.length || !rows.some((row) => merchantMatches(row, name))) return null;
      filters.push({ name, cents });
    }
  }
  return filters;
}

function merchantMatches(row, query) {
  return [row.name, row.description].some((value) => {
    const words = auditWords(value);
    if (words[0] === 'at') words.shift();
    const normalized = auditWords(query.join(' '));
    return normalized.length > 0 && normalized.length <= words.length && normalized.every((word, i) => word === words[i]);
  });
}

export function buildRecurringPlan(audit, intent) {
  const candidates = [], excluded = [], skipped = [];
  const empty = { candidates, excluded, skipped };
  if (audit.omittedRows > 0) return { ...empty, clarify: copy(
    'В сверке больше строк, чем помещается в карточку. Сузь период, чтобы проверить полный список перед изменением расписаний.',
    'The audit is larger than a review card. Narrow the period so every candidate can be reviewed.') };
  const instruction = (intent.instruction ?? '').toLowerCase()
    .replace(/по (?:банковской )?выписке|\b(?:from|according to|based on) (?:the )?(?:bank )?statement\b|\bwithout (?:a )?(?:recurring )?(?:schedule|record)\b/gu, ' ');
  const filterWords = instruction.match(/[\p{L}\p{N}]+/gu)?.filter(word =>
    !reviewWords.has(word) && !reviewStems.test(word) && !monthWord.test(word) && !auditWords(audit.category).includes(auditWords(word)[0])) ?? [];
  // References like “fix the date for ChatGPT Plus” narrow the row set. An
  // unknown or more complex condition must never turn into a bulk operation.
  if (intent.only) filterWords.splice(0, filterWords.length, ...auditWords(intent.only));
  if (filterWords.length && !audit.rows.some(row => merchantMatches(row, filterWords))) {
    return { ...empty, manualSelection: true, clarify: selectRows };
  }
  const filters = exclusionsFor(audit.rows, intent.exceptionTexts ?? []);
  if (!filters) return { ...empty, manualSelection: true, clarify: selectRows };
  const conflicts = new Set();
  for (const row of audit.rows) {
    const eligible = row.status === 'unmatched' && intent.create || ['early','late'].includes(row.status) && intent.update;
    if (!eligible) { if (row.status !== 'on_schedule' || row.relatedChargeCount) skipped.push(row); continue; }
    if (filterWords.length && !merchantMatches(row, filterWords)) continue;
    if (filters.some(({ name, cents }) => merchantMatches(row, name)
      && (!cents.length || cents.includes(Math.round(row.actualAmount * 100))))) { excluded.push(row); continue; }
    if (!row.transactionId || !row.actualDate || !row.description || !(row.actualAmount > 0) || row.paused) { skipped.push(row); continue; }
    const isUpdate = row.status !== 'unmatched';
    const candidate = {
      kind: isUpdate ? 'update' : 'create', name: isUpdate ? row.name : row.description,
      transactionId: row.transactionId, actualDate: row.actualDate, actualAmount: row.actualAmount,
      description: row.description, category: audit.category, categoryId: audit.categoryId, scheduleSetHash: audit.scheduleSetHash,
      ...(isUpdate ? { scheduleId: row.scheduleId, expectedDate: row.expectedDate, expectedAmount: row.expectedAmount }
        : { frequency: intent.frequency ?? 'monthly', frequencyInterval: 1 }),
    };
    if (isUpdate && !candidate.scheduleId) { skipped.push(row); continue; }
    const prior = isUpdate && candidates.find((item) => item.scheduleId === candidate.scheduleId);
    if (prior || conflicts.has(candidate.scheduleId) && isUpdate) {
      if (prior) { candidates.splice(candidates.indexOf(prior), 1); conflicts.add(candidate.scheduleId); skipped.push(prior); }
      skipped.push(row);
    } else candidates.push(candidate);
  }
  if (candidates.length > 24) return { ...empty, candidates: [], clarify: copy(
    'Получилось больше 24 изменений. Сузь сверку или выбери меньшую группу расписаний.',
    'This would change more than 24 schedules. Narrow the audit or select a smaller group.') };
  return empty;
}
