const errors = {
  rate_limit: [429, 'OpenAI is receiving too many requests.', 'OpenAI временно ограничил частоту запросов.'],
  quota: [503, 'The assistant’s OpenAI project is out of credits. Check its API billing.', 'У проекта OpenAI закончилась квота. Проверьте баланс и лимиты API.'],
  output_limit: [422, 'The answer exceeded the response limit. Ask about a shorter period or one category at a time.', 'Ответ превысил лимит длины. Укажите более короткий период или одну категорию.'],
  filtered: [422, 'The model could not complete this reply. Try rephrasing the request.', 'Модель остановила ответ. Попробуйте переформулировать запрос.'],
  unavailable: [503, 'OpenAI is temporarily unavailable. Try again in a moment.', 'OpenAI временно недоступен. Повторите запрос чуть позже.'],
  configuration: [503, 'The OpenAI project could not authorize this model. Check the server API key and model settings.', 'Проект OpenAI не смог авторизовать модель. Проверьте ключ API и модель в настройках сервера.'],
};

export class AssistantProviderError extends Error {
  constructor(code, retryAfter) {
    super(code);
    this.code = code;
    this.retryAfter = retryAfter;
  }

  asResponse(language) {
    const ru = language === 'ru';
    const [status, english, russian] = errors[this.code];
    const headers = { 'Cache-Control': 'no-store' };
    let error = ru ? russian : english;
    if (this.code === 'rate_limit') {
      if (this.retryAfter != null) {
        headers['Retry-After'] = String(this.retryAfter);
        error += ru ? ` Повторите через ${this.retryAfter} с.` : ` Try again in ${this.retryAfter} seconds.`;
      } else {
        error += ru ? ' Повторите через минуту.' : ' Try again in a minute.';
      }
    }
    const retryable = ['rate_limit', 'unavailable'].includes(this.code);
    return Response.json({ error, code: this.code, retryable }, { status, headers });
  }
}

export async function providerHttpError(response) {
  if (response.status === 429) {
    const body = await response.json().catch(() => null);
    if (body?.error?.code === 'insufficient_quota') return new AssistantProviderError('quota');
    const header = response.headers.get('retry-after');
    const seconds = header == null ? NaN : /^\d+$/.test(header)
      ? Number(header) : Math.ceil((Date.parse(header) - Date.now()) / 1000);
    return new AssistantProviderError('rate_limit', Number.isSafeInteger(seconds) ? Math.max(1, seconds) : null);
  }
  if ([401, 403, 404].includes(response.status)) return new AssistantProviderError('configuration');
  if (response.status >= 500) return new AssistantProviderError('unavailable');
  return new Error('OpenAI rejected the request');
}
