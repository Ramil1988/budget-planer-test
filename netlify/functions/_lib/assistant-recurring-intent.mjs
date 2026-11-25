const monthWords = [
  'january|jan|январ\\p{L}*', 'february|feb|феврал\\p{L}*', 'march|mar|март\\p{L}*',
  'april|apr|апрел\\p{L}*', 'may|ма[йея]', 'june|jun|июн\\p{L}*',
  'july|jul|июл\\p{L}*', 'august|aug|август\\p{L}*', 'september|sept?|сентябр\\p{L}*',
  'october|oct|октябр\\p{L}*', 'november|nov|ноябр\\p{L}*', 'december|dec|декабр\\p{L}*',
];
const monthNames = monthWords.map((names) => new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${names})(?=$|[^\\p{L}\\p{N}])`, 'iu'));

export const auditMonthPrompt = {
  ru: 'Укажи один месяц для сверки дат с Recurring.',
  en: 'Choose one month to check against Recurring.',
};
export const auditYearPrompt = { ru: 'За какой год сверить выбранный месяц?', en: 'Which year should I check for that month?' };

const namedMonthReply = new RegExp(`^(?:${monthWords.join('|')})(?:\\s+20\\d{2}(?:\\s+года?)?)?$`, 'iu');

export function auditCategoryPrompt(month, language) {
  const period = month.split('-').reverse().join('.');
  return language === 'ru' ? `Какую категорию расходов сверить с Recurring за ${period}?`
    : `Which expense category should I check against Recurring for ${period}?`;
}

function requestedMonths(question, today) {
  const years = [...new Set(question.match(/\b20\d{2}\b/g) ?? [])];
  const options = new Set(question.match(/\b20\d{2}-(?:0[1-9]|1[0-2])\b/g) ?? []);
  const named = monthNames.flatMap((pattern, index) => pattern.test(question) ? [index] : []);
  for (const index of named) {
    const number = String(index + 1).padStart(2, '0');
    const pairs = new RegExp(`(?<!\\p{L})(?:${monthWords[index]})(?!\\p{L})[,\\s]+(20\\d{2})\\b`, 'giu');
    const pairedYears = [...question.matchAll(pairs)].map((match) => match[1]);
    const implicit = Number(today.slice(0, 4)) - Number(index + 1 > Number(today.slice(5, 7)));
    const candidates = years.length <= 1 ? [years[0] ?? implicit] : named.length === 1 ? years : pairedYears;
    for (const year of candidates) options.add(`${year}-${number}`);
  }
  return [...options].sort();
}

export function auditMonthChoices(question, today, language) {
  const options = requestedMonths(question, today);
  const formatter = new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' });
  return options.slice(0, 4).map((month) =>
    `${formatter.format(new Date(`${month}-01T00:00:00Z`))} ${month.slice(0, 4)}`);
}

export function recurringAuditTurn(messages, today, context) {
  const last = messages.at(-1)?.content;
  if (isRecurringDateAudit(last)) return { question: last, month: auditMonthFromText(last, today) };
  // Only resume a short selection from our own prompt or the immediately preceding audit.
  const reply = messages.at(-2);
  if (!last || reply?.role !== 'assistant') return null;
  const firstLine = reply.content.split('\n')[0];
  const period = firstLine.match(/(0[1-9]|1[0-2])\.(20\d{2})\?$/u);
  const monthPrompt = Object.values(auditMonthPrompt).includes(firstLine);
  const yearLanguage = ['en', 'ru'].find(lang => auditYearPrompt[lang] === firstLine);
  const categoryMonth = period && `${period[2]}-${period[1]}`;
  const categoryLanguage = categoryMonth && ['en', 'ru'].find(lang => auditCategoryPrompt(categoryMonth, lang) === firstLine);
  if ((monthPrompt || yearLanguage || categoryLanguage) && /^(?:отмена|отмени|не надо|нет|cancel|never mind|no)[.!\s]*$/iu.test(last.trim())) {
    return { cancelled: true };
  }
  if (yearLanguage) {
    const year = last.trim().match(/^(?:за\s+|в\s+|for\s+|in\s+)?(20\d{2})(?:\s+год[ау]?)?[.\s]*$/iu)?.[1];
    if (year) {
      const pending = recurringAuditTurn(messages.slice(0, -2), today);
      if (pending?.yearChoices) return { question: pending.question, month: `${year}-${pending.monthNumber}`, language: yearLanguage };
    }
  }
  if (categoryLanguage && last.trim().length <= 100 && !/[?？\n]/u.test(last)
    && !/^(?:отмен|спасибо|да$|покажи|сверь|сколько|почему|расскажи|объясни|создай|удали|добавь|исправь|как\s|\b(?:thanks|yes|show|how|what|why|add|create|fix|delete|explain)\b)/iu.test(last.trim())) {
    return { question: last.trim(), month: categoryMonth, language: categoryLanguage };
  }
  const answer = last.trim().replace(/^(?:(?:а|и|давай|пожалуйста|проверь|тогда|за|в|только|and|what about|for|in|just|please)\s+)+/iu, '')
    .replace(/[.!?\s]+$/u, '');
  const namedOrIso = namedMonthReply.test(answer) || /^20\d{2}-(?:0[1-9]|1[0-2])$/.test(answer);
  const relative = /^(?:this month|last month|previous month|эт(?:от|ом) месяц[е]?|прошл(?:ый|ом) месяц[е]?)$/iu.test(answer);
  if (!(namedOrIso || relative)) return null;
  if (!monthPrompt && !yearLanguage) {
    if (!context || context.historyTruncated || context.fromIndex !== messages.length - 1
      || !/^Recurring audit filter: /m.test(reply.content)) return null;
    // A named comparison month inherits the year of the visible report.
    const year = context.month.slice(0, 4);
    const month = auditMonthFromText(namedMonthReply.test(answer) && !/\d/u.test(answer) ? `${answer} ${year}` : answer, today);
    return { category: context.category, month };
  }
  const question = messages.slice(0, -2).findLast((message) => message.role === 'user' && isRecurringDateAudit(message.content))?.content;
  if (!question) return null;
  let month = auditMonthFromText(answer, today);
  if (namedMonthReply.test(answer) && !/\d/.test(answer)) {
    const options = requestedMonths(question, today).filter((option) => option.slice(5) === month.slice(5));
    if (options.length > 1) return { question, month: null, monthNumber: month.slice(5), yearChoices: options.map(option => option.slice(0, 4)) };
    if (options.length) month = options[0];
    else if (new Set(question.match(/\b20\d{2}\b/g) ?? []).size > 1) month = null;
  }
  return { question, month };
}

export function isRecurringDateAudit(text) {
  return typeof text === 'string'
    && /\b(?:recurr?ings?|recurrence)\b|регулярн|периодическ|повторяющ/iu.test(text)
    && /\b(?:transactions?|posted|actual|charges?|expenses?)\b|транзакц|операци|списан|фактич|расход/iu.test(text)
    && (/\b(?:dates?|when|timing)\b|дат[ауыеий]|день списания|когда/iu.test(text)
      || /(?:с|со|с календар[её]м|с расписанием|\bagainst|\bwith)\s+recurr?ings?\b/iu.test(text))
    && /\b(?:compar\p{L}*|check|verify|audit|reconcil\p{L}*|match\p{L}*)\b|свер|сопостав|проверь|проверк|совпад/iu.test(text)
    && !/\b(?:update|edit|fix|delete|replace|change|add)\b|\band\s+correct\b|^\s*correct\b|исправь|измени|обнови|удали|добавь/iu.test(text);
}

export function auditMonthFromText(text, today) {
  const month = today.slice(0, 7);
  const options = requestedMonths(text, today);
  if (options.length) return options.length === 1 ? options[0] : null;
  if (/\b(?:last|previous) month\b|(?:прошл|предыдущ)\p{L}*\s+месяц/iu.test(text)) {
    const previous = new Date(`${month}-01T00:00:00Z`);
    previous.setUTCDate(0);
    return previous.toISOString().slice(0, 7);
  }

  return month;
}
