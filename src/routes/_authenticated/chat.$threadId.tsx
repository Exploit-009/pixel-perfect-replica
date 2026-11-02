import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { Square, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useXplo } from "@/components/xplo-session";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import emblem from "@/assets/xplo-emblem.jpg";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({ meta: [{ title: "Conversation — XPLO AI" }, { name: "description", content: "Private guided cybersecurity conversation with XPLO AI." }, { property: "og:title", content: "XPLO AI conversation" }, { property: "og:description", content: "Guided cybersecurity research conversation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ChatPage,
});

function textOf(m: UIMessage) { return m.parts.map((p) => (p.type === "text" ? p.text : "")).join(""); }

function ChatPage() {
  const { threadId } = Route.useParams();
  const { threads, updateMessages, removeThread, environment, level, selectedSpecialties } = useXplo();
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return <AppShell><div className="px-4 py-16 text-center"><p className="font-semibold">This conversation is no longer available.</p><p className="mt-2 text-sm text-muted-foreground">Conversations are not saved after the page is closed or reloaded.</p><Link to="/" className="mt-5 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Start again</Link></div></AppShell>;
  return <AppShell><Chat key={threadId} threadId={threadId} agent={thread.agent} initial={thread.messages} environment={environment} level={level} specialties={selectedSpecialties} update={updateMessages} remove={removeThread} /></AppShell>;
}

function Chat({ threadId, agent, initial, environment, level, specialties, update, remove }: { threadId: string; agent: string; initial: UIMessage[]; environment: string; level: string; specialties: string[]; update: (id: string, m: UIMessage[]) => void; remove: (id: string) => void }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<UIMessage[]>(initial);
  const [status, setStatus] = useState<"ready" | "submitted" | "streaming" | "error">("ready");
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);
  const started = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const commit = useCallback((next: UIMessage[]) => { messagesRef.current = next; setMessages(next); update(threadId, next); }, [threadId, update]);

  const send = useCallback(async (text: string) => {
    const value = text.trim();
    if (!value || status === "submitted" || status === "streaming") return;
    setError("");
    const user: UIMessage = { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: value }] };
    const assistant: UIMessage = { id: crypto.randomUUID(), role: "assistant", parts: [{ type: "text", text: "" }] };
    const history = [...messagesRef.current, user];
    commit([...history, assistant]);
    setStatus("submitted");
    const controller = new AbortController();
    abort.current = controller;
    let answer = "";
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session has ended. Sign in again to continue.");
      const res = await fetch("/api/chat", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ agent, environment, level, specialties, messages: history.map((m) => ({ role: m.role, content: textOf(m) })) }) });
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
  }, [agent, commit, environment, level, specialties, status]);

  useEffect(() => {
    if (started.current) return; started.current = true;
    const key = `xplo-start-${threadId}`; const prompt = sessionStorage.getItem(key);
    if (prompt) { sessionStorage.removeItem(key); void send(prompt); } else textarea.current?.focus();
  }, [send, threadId]);

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
          {error && <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="px-3 pb-3 pt-1">
        <PromptInput onSubmit={({ text }) => { void send(text); }}>
          <PromptInputTextarea ref={textarea} placeholder="Ask XPLO about a security procedure…" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={() => abort.current?.abort()} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">XPLO cannot run commands. Use only systems you own or are authorized to test.</p>
      </div>
    </div>
  );
}
