import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import { MAX_SAVED_MESSAGES, fromStoredMessages, titleFor, toStoredMessages } from '@/lib/saved-chats';

const msg = (id: string, role: 'user' | 'assistant', text: string): UIMessage => ({ id, role, parts: [{ type: 'text', text }] });
describe('saved conversations', () => {
  it('stores only non-empty text turns and caps them at 40', () => {
    const many = Array.from({ length: 50 }, (_, i) => msg(String(i), i % 2 ? 'assistant' : 'user', `m${i}`));
    const stored = toStoredMessages([...many, msg('e', 'assistant', '  ')]);
    expect(stored).toHaveLength(MAX_SAVED_MESSAGES);
    expect(stored.at(-1)?.id).toBe('49');
  });
  it('restores well-formed turns and ignores malformed ones', () => {
    const out = fromStoredMessages([{ id: 'a', role: 'user', parts: [{ type: 'text', text: 'hi' }] }, { role: 'system', parts: [] }, null, { id: 'b', role: 'assistant', parts: [{ type: 'image' }] }]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
    expect(fromStoredMessages('nope')).toEqual([]);
  });
  it('titles an untitled conversation from the first question, capped at 52 characters', () => {
    expect(titleFor('New conversation', [msg('1', 'user', 'x'.repeat(80))])).toHaveLength(52);
    expect(titleFor('WebSec AI', [msg('1', 'user', 'hello')])).toBe('WebSec AI');
  });
});
