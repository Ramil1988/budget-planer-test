import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAssistantReply } from './assistant-reply.mjs';

test('structured replies yield the message and its choices', () => {
  const reply = parseAssistantReply(JSON.stringify({
    message: 'How should I split it?',
    choices: ['Split it evenly', '  Keep it   as is ', 'Split it evenly', '', 42],
  }));
  assert.deepEqual(reply, { message: 'How should I split it?', choices: ['Split it evenly', 'Keep it as is'] });
});

test('at most four choices are kept and overlong ones are dropped', () => {
  const { choices } = parseAssistantReply(JSON.stringify({
    message: 'Pick one',
    choices: ['a', 'b', 'x'.repeat(161), 'c', 'd', 'e'],
  }));
  assert.deepEqual(choices, ['a', 'b', 'c', 'd']);
});

test('plain text that is not the structured format is kept as the message', () => {
  assert.deepEqual(parseAssistantReply('Just text.'), { message: 'Just text.', choices: [] });
});

test('tool calls and tool results written as text never reach the user', () => {
  const leaked = [
    '{"type":"expense","amount":187.68,"date":"2026-11-21","category":null}',
    '{"ok":true,"already_created":false,"record":{"type":"expense","amount":187.68}}',
    'Saved the food portion.',
    '[{"type":"expense","amount":50}]',
  ].join('\n');
  assert.equal(parseAssistantReply(JSON.stringify({ message: leaked, choices: [] })).message, 'Saved the food portion.');
  assert.equal(parseAssistantReply(leaked).message, 'Saved the food portion.');
});

test('a reply made only of leaked JSON becomes empty', () => {
  assert.deepEqual(parseAssistantReply('{"type":"expense","amount":50}'), { message: '', choices: [] });
});

test('braces inside ordinary sentences are left alone', () => {
  const text = 'Use the {month} placeholder.\n[optional] step';
  assert.equal(parseAssistantReply(text).message, text);
});
