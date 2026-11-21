const budgetQuestion = /(?:^| )(?:why|what|how|show|review|check|explain|analy[sz]e|почему|сколько|отчего|покаж\p{L}*|проверь|объясн\p{L}*|разбер\p{L}*)(?: |$)/u;
const budgetTopic = /(?:^| )(?:budget|overspend\p{L}*|spend\p{L}*|spent|expense\p{L}*|limit\p{L}*|бюджет\p{L}*|перерасход\p{L}*|расход\p{L}*|трат\p{L}*|потрат\p{L}*|превыс\p{L}*|превыш\p{L}*|лимит\p{L}*)(?: |$)/u;
const updateRequest = /(?:^| )(?:add|save|import|create|delete|добав\p{L}*|сохран\p{L}*|импорт\p{L}*|удал\p{L}*)(?: |$)/u;
const specifiedPeriod = /(?:^| )(?:\d{4}|(?:last|previous) month|january|february|march|april|may|june|july|august|september|october|november|december|прошл\p{L}* месяц\p{L}*|предыдущ\p{L}* месяц\p{L}*|январ\p{L}*|феврал\p{L}*|март\p{L}*|апрел\p{L}*|ма[йея]|ию[нл]\p{L}*|август\p{L}*|сентябр\p{L}*|октябр\p{L}*|ноябр\p{L}*|декабр\p{L}*)(?: |$)/u;

const normalize = (text) => text.normalize('NFKC').toLowerCase().replaceAll('ё', 'е')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const includesPhrase = (text, phrase) => phrase && ` ${text} `.includes(` ${phrase} `);

export function currentSuggestionMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function budgetSuggestionKey(month, categoryId) {
  return `${month}:${categoryId}`;
}

export function readAskedSuggestions(storageKey) {
  if (!storageKey) return [];
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(stored) ? stored.filter((key) => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

export function mergeAskedSuggestions(previous, added) {
  return [...new Set([...previous, ...added])];
}

export function collectAskedSuggestions(messages, month, candidates) {
  const keys = new Set();
  const categories = candidates.map(({ category, categoryId }) => ({ name: normalize(category), categoryId }));
  for (const message of messages) {
    if (message.role === 'assistant') {
      for (const visual of message.visuals ?? []) {
        if (visual.kind !== 'budget-review' || !visual.category) continue;
        if (visual.categoryId) {
          keys.add(budgetSuggestionKey(visual.month, visual.categoryId));
        } else if (visual.month === month) {
          const matches = categories.filter(({ name }) => name === normalize(visual.category));
          if (matches.length === 1) keys.add(budgetSuggestionKey(month, matches[0].categoryId));
        }
      }
      continue;
    }
    if (message.role !== 'user' || message.attachmentName) continue;
    if (message.suggestionKey) {
      keys.add(message.suggestionKey);
      continue;
    }
    if (!month || (message.askedMonth ?? currentSuggestionMonth()) !== month) continue;
    const text = normalize(message.requestPrompt ?? message.content);
    if (!budgetQuestion.test(text) || !budgetTopic.test(text) || updateRequest.test(text) || specifiedPeriod.test(text)) continue;
    const matches = categories.filter(({ name }) => includesPhrase(text, name));
    for (const { name, categoryId } of matches) {
      if (!matches.some((other) => other.name !== name && includesPhrase(other.name, name))) {
        keys.add(budgetSuggestionKey(month, categoryId));
      }
    }
  }
  return [...keys];
}
