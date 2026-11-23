const maxChoices = 4;
const maxChoiceLength = 160;

// Chat replies come back as JSON so that the choices the model offers reach the
// app as data (rendered as buttons) rather than as a numbered list to retype.
export const replyFormat = {
  type: 'json_schema',
  name: 'assistant_reply',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['message', 'choices'],
    properties: {
      message: {
        type: 'string',
        description: 'Plain-text reply shown to the user. No JSON, tool arguments or tool results.',
      },
      choices: {
        type: 'array',
        description: 'Next steps the user can pick with one click, each a complete instruction in the user\'s own voice and language. Empty when there is nothing to choose.',
        items: { type: 'string' },
      },
    },
  },
};

function isJsonValue(text) {
  if (!/^[[{][\s\S]*[\]}]$/.test(text)) return false;
  try {
    const value = JSON.parse(text);
    return value !== null && typeof value === 'object';
  } catch {
    return false;
  }
}

// A model that runs out of tools sometimes writes the call it wanted to make, or an
// invented result, as text. Those lines are never meant for the user.
function withoutJsonLines(text) {
  return text
    .split('\n')
    .filter((line) => !isJsonValue(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseAssistantReply(text) {
  let message = typeof text === 'string' ? text : '';
  let choices = [];
  try {
    const reply = JSON.parse(message);
    if (reply && typeof reply.message === 'string') {
      message = reply.message;
      if (Array.isArray(reply.choices)) choices = reply.choices;
    }
  } catch {
    // Not the structured format: treat the whole text as the message.
  }

  const seen = new Set();
  return {
    message: withoutJsonLines(message),
    choices: choices
      .filter((choice) => typeof choice === 'string')
      .map((choice) => choice.trim().replace(/\s+/g, ' '))
      .filter((choice) => choice && choice.length <= maxChoiceLength && !seen.has(choice) && seen.add(choice))
      .slice(0, maxChoices),
  };
}
