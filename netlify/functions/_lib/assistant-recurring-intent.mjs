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

const namedMonthReply = new RegExp(`^(?:${monthWords.join('|')})(?:\\s+20\\d{2}(?:\\s+года?)?)?$`, 'iu');

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

export function recurringAuditTurn(messages, today) {
  const last = messages.at(-1)?.content;
  if (isRecurringDateAudit(last)) return { question: last, month: auditMonthFromText(last, today) };
  // Resume only our own clarification, and only for a month selection. A new task stays a new task.
  const reply = messages.at(-2);
  if (!last || reply?.role !== 'assistant' || !Object.values(auditMonthPrompt).includes(reply.content.split('\n')[0])) return null;
  const question = messages.slice(0, -2).findLast((message) => message.role === 'user' && isRecurringDateAudit(message.content))?.content;
  if (!question) return null;
  const answer = last.trim().replace(/^(?:(?:давай|пожалуйста|проверь|тогда|за|в|только|for|in|just|please)\s+)+/iu, '')
    .replace(/[.!\s]+$/u, '');
  if (!namedMonthReply.test(answer) && !/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(answer)
    && !/^(?:this month|last month|previous month|эт(?:от|ом) месяц[е]?|прошл(?:ый|ом) месяц[е]?)$/iu.test(answer)) return null;
  let month = auditMonthFromText(answer, today);
  if (namedMonthReply.test(answer) && !/\d/.test(answer)) {
    const options = requestedMonths(question, today).filter((option) => option.slice(5) === month.slice(5));
    if (options.length) month = options.length === 1 ? options[0] : null;
    else if (new Set(question.match(/\b20\d{2}\b/g) ?? []).size > 1) month = null;
  }
  return { question, month };
}

export function isRecurringDateAudit(text) {
  return typeof text === 'string'
    && /\brecurr(?:ing|ence)\b|регулярн|периодическ|повторяющ/iu.test(text)
    && /\b(?:transactions?|posted|actual|charges?)\b|транзакц|операци|списан|фактич/iu.test(text)
    && /\b(?:dates?|when|timing)\b|дат[ауыеий]|день списания|когда/iu.test(text)
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
