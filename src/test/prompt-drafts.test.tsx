import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PromptInput, PromptInputProvider, PromptInputSubmit, PromptInputTextarea } from '@/components/ai-elements/prompt-input';

afterEach(cleanup);
describe('chat draft handoff', () => {
 it('retains a draft when submission is refused, then clears after acceptance', async () => {
  const submit = vi.fn().mockImplementationOnce(() => { throw new Error('busy'); }).mockImplementation(() => {});
  render(<PromptInputProvider><PromptInput onSubmit={submit}><PromptInputTextarea aria-label="Draft" /><PromptInputSubmit /></PromptInput></PromptInputProvider>);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Please keep this draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('textbox')).toHaveValue('Please keep this draft');
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
  expect(submit.mock.calls[1]?.[0].text).toBe('Please keep this draft');
 });
 it('does not submit or erase a draft on Enter while Stop is displayed', () => {
  const submit = vi.fn();
  render(<PromptInputProvider><PromptInput onSubmit={submit}><PromptInputTextarea aria-label="Draft" /><PromptInputSubmit status="streaming" onStop={() => {}} /></PromptInput></PromptInputProvider>);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Next question' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox')).toHaveValue('Next question');
 });
});
