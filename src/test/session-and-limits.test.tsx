import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { XploSession, useXplo } from '@/components/xplo-session';
import { checkConversationLimits } from '@/lib/xplo';
import { chatSchema } from '@/lib/xplo-chat';

const config = { agent: 'XPLO Security Core', environment: 'Android + Termux', level: 'Intermediate', specialties: [] };
describe('memory-only starter prompts', () => {
 it('hands off an assessment prompt exactly once without browser storage', () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const { result } = renderHook(useXplo, { wrapper: XploSession });
  let id = '';
  act(() => { id = result.current.createThread('Lab', 'XPLO Security Core', 'Scope: my isolated lab'); });
  expect(result.current.takeFirstPrompt(id)).toBe('Scope: my isolated lab');
  expect(result.current.takeFirstPrompt(id)).toBeNull();
  expect(storage).not.toHaveBeenCalled();
  storage.mockRestore();
 });
 it('forgets pending prompts and conversations on reset', () => {
  const { result } = renderHook(useXplo, { wrapper: XploSession });
  let id = '';
  act(() => { id = result.current.createThread('Lab', undefined, 'private scope'); });
  act(() => result.current.reset());
  expect(result.current.threads).toHaveLength(0);
  expect(result.current.takeFirstPrompt(id)).toBeNull();
 });
 it('forgets a deleted conversation prompt', () => {
  const { result } = renderHook(useXplo, { wrapper: XploSession });
  let id = '';
  act(() => { id = result.current.createThread('Lab', undefined, 'private scope'); });
  act(() => result.current.removeThread(id));
  expect(result.current.takeFirstPrompt(id)).toBeNull();
 });
});
describe('existing conversation limits', () => {
 it('allows 40 messages but rejects 41 without trimming', () => {
  const history = Array.from({ length: 40 }, () => ({ role: 'user' as const, content: 'hello' }));
  expect(checkConversationLimits(history)).toBeNull();
  expect(chatSchema.safeParse({ ...config, messages: history }).success).toBe(true);
  history.push({ role: 'user', content: 'next' });
  expect(checkConversationLimits(history)).not.toBeNull();
  expect(chatSchema.safeParse({ ...config, messages: history }).success).toBe(false);
  expect(history).toHaveLength(41);
 });
 it('allows 12000 characters but rejects 12001', () => {
  const history = [{ role: 'user', content: 'a'.repeat(12000) }];
  expect(checkConversationLimits(history)).toBeNull();
  expect(chatSchema.safeParse({ ...config, messages: history }).success).toBe(true);
  history.push({ role: 'user', content: 'a'.repeat(12001) });
  expect(checkConversationLimits(history)).not.toBeNull();
  expect(chatSchema.safeParse({ ...config, messages: history }).success).toBe(false);
 });
});
