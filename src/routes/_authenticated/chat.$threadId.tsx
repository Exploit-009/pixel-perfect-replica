import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { RotateCcw, Square, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useXplo } from "@/components/xplo-session";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputProvider, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import emblem from "@/assets/xplo-emblem.jpg";
import { supabase } from "@/integrations/supabase/client";
import { checkConversationLimits } from "@/lib/xplo";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({ meta: [{ title: "Conversation — XPLO AI" }, { name: "description", content: "Private guided cybersecurity conversation with XPLO AI." }, { property: "og:title", content: "XPLO AI conversation" }, { property: "og:description", content: "Guided cybersecurity research conversation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ChatPage,
});

function textOf(m: UIMessage) { return m.parts.map((p) => (p.type === "text" ? p.text : "")).join(""); }
const asRequest = (messages: UIMessage[]) => messages.map((m) => ({ role: m.role, content: textOf(m) }));

function ChatPage() {
  const { threadId } = Route.useParams();
  const { threads, updateMessages, removeThread, takeFirstPrompt, createThread, environment, level, selectedSpecialties } = useXplo();
  const navigate = useNavigate();
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return <AppShell><div className="px-4 py-16 text-center"><p className="font-semibold">This conversation is no longer available.</p><p className="mt-2 text-sm text-muted-foreground">Conversations are not saved after the page is closed or reloaded.</p><Link to="/" className="mt-5 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Start again</Link></div></AppShell>;
  const startNew = () => navigate({ to: "/chat/$threadId", params: { threadId: createThread("New conversation", thread.agent) } });
  return <AppShell><Chat key={threadId} threadId={threadId} agent={thread.agent} initial={thread.messages} environment={environment} level={level} specialties={selectedSpecialties} update={updateMessages} remove={removeThread} takeFirstPrompt={takeFirstPrompt} startNew={startNew} /></AppShell>;
}

type ChatProps = { threadId: string; agent: string; initial: UIMessage[]; environment: string; level: string; specialties: string[]; update: (id: string, m: UIMessage[]) => void; remove: (id: string) => void; takeFirstPrompt: (id: string) => string | null; startNew: () => void };

function Chat({ threadId, agent, initial, environment, level, specialties, update, remove, takeFirstPrompt, startNew }: ChatProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<UIMessage[]>(initial);
  const [status, setStatus] = useState<"ready" | "submitted" | "streaming" | "error">("ready");
  const [error, setError] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);
  const started = useRef(false);
  const mounted = useRef(true);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  const commit = useCallback((next: UIMessage[]) => { messagesRef.current = next; setMessages(next); update(threadId, next); }, [threadId, update]);

  // Stop a reply that is still streaming when the user leaves this conversation. The deferred check
  // keeps development double-mounting from cancelling a reply that has only just started.
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; setTimeout(() => { if (!mounted.current) abort.current?.abort(); }, 0); };
  }, []);

  /** Sends the conversation ending in a user message. Returns without sending when a reply is running. */
  const run = useCallback(async (history: UIMessage[]) => {
    const assistant: UIMessage = { id: crypto.randomUUID(), role: "assistant", parts: [{ type: "text", text: "" }] };
    commit([...history, assistant]);
    setStatus("submitted");
    const controller = new AbortController();
    abort.current = controller;
    let answer = "";
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session has ended. Sign in again to continue.");
      const res = await fetch("/api/chat", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ agent, environment, level, specialties, messages: asRequest(history) }) });
      if (!res.ok || !res.body) { const data = await res.json().catch(() => ({})); throw new Error(data.error ?? "XPLO could not answer right now."); }
      setStatus("streaming");
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      for (;;) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { text?: string; error?: string };
          if (event.error) throw new Error(event.error);
          if (event.text) { answer += event.text; commit([...history, { ...assistant, parts: [{ type: "text", text: answer }] }]); }
        }
      }
      if (!answer) throw new Error("XPLO returned no answer. Please try again.");
      setStatus("ready");
    } catch (e) {
      if (controller.signal.aborted) { setStatus("ready"); if (!answer) commit(history); return; }
      commit(answer ? [...history, { ...assistant, parts: [{ type: "text", text: answer }] }] : history);
      setError(e instanceof Error ? e.message : "XPLO could not answer right now.");
      setStatus("error");
    } finally { abort.current = null; requestAnimationFrame(() => textarea.current?.focus()); }
  }, [agent, commit, environment, level, specialties]);

  /** Validates a typed message before it is sent. Throwing keeps the draft in the composer. */
  const submit = useCallback((text: string) => {
    const value = text.trim();
    if (!value) throw new Error("empty");
    if (busy) { setError("XPLO is still answering. Your message is kept in the box; send it when the reply finishes."); setLimitReached(false); throw new Error("busy"); }
    const history = [...messagesRef.current, { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: value }] } satisfies UIMessage];
    const limit = checkConversationLimits(asRequest(history));
    if (limit) { setError(limit); setLimitReached(true); throw new Error("limit"); }
    setError(""); setLimitReached(false);
    void run(history);
  }, [busy, run]);

  /** Sends the last user message again after a failed reply, without adding a duplicate turn. */
  const retry = useCallback(() => {
    const history = messagesRef.current;
    if (busy || history.at(-1)?.role !== "user") return;
    const limit = checkConversationLimits(asRequest(history));
    if (limit) { setError(limit); setLimitReached(true); return; }
    setError(""); setLimitReached(false);
    void run(history);
  }, [busy, run]);

  useEffect(() => {
    if (started.current) return; started.current = true;
    const prompt = takeFirstPrompt(threadId);
    if (prompt) void run([...messagesRef.current, { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: prompt.trim() }] }]); else textarea.current?.focus();
  }, [run, takeFirstPrompt, threadId]);

  const canRetry = status === "error" && !limitReached && messages.at(-1)?.role === "user";

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2 text-xs">
        <span className="font-mono uppercase tracking-widest text-primary">{agent}</span>
        <button onClick={() => { abort.current?.abort(); remove(threadId); navigate({ to: "/" }); }} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /> Clear</button>
      </div>
      <Conversation className="min-h-0">
        <ConversationContent>
          {messages.length === 0 ? <ConversationEmptyState icon={<img src={emblem} alt="" width={64} height={64} className="size-16 rounded" />} title={agent} description="Ask for a procedure, explain output, review a finding, or draft a report. Confirm authorization before targeting a system." /> : messages.map((m) => (
            <Message key={m.id} from={m.role}><MessageContent>{m.role === "assistant" ? (textOf(m) ? <MessageResponse>{textOf(m)}</MessageResponse> : <Shimmer>Thinking through the procedure…</Shimmer>) : textOf(m)}</MessageContent></Message>
          ))}
          {error && (
            <div role="alert" className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <p>{error}</p>
              {canRetry && <button onClick={retry} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive/50 px-3 text-xs font-medium"><RotateCcw className="size-3.5" /> Try again</button>}
              {limitReached && <button onClick={startNew} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive/50 px-3 text-xs font-medium">Start a new conversation</button>}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="px-3 pb-3 pt-1">
        <PromptInputProvider>
          <PromptInput onSubmit={({ text }) => submit(text)}>
            <PromptInputTextarea ref={textarea} placeholder="Ask XPLO about a security procedure…" />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} onStop={() => abort.current?.abort()} />
            </PromptInputFooter>
          </PromptInput>
        </PromptInputProvider>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">XPLO cannot run commands. Use only systems you own or are authorized to test.</p>
      </div>
    </div>
  );
}
