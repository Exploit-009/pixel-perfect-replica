import type { UIMessage } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Opt-in saved conversations. Stored in the user's own rows only (row-level security); nothing is written unless the user turned saving on. */
export const MAX_SAVED_MESSAGES = 40;
export type SavedSummary = { id: string; title: string; agent: string; updated_at: string };
export type SavedChat = SavedSummary & { messages: UIMessage[] };

/** Keeps only plain text turns, drops empty ones and caps the length so a stored row always satisfies the database limits. */
export function toStoredMessages(messages: UIMessage[]): { id: string; role: "user" | "assistant"; parts: { type: "text"; text: string }[] }[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", text: m.parts.map((p) => (p.type === "text" ? p.text : "")).join("") }))
    .filter((m) => m.text.trim().length > 0)
    .slice(-MAX_SAVED_MESSAGES)
    .map((m) => ({ id: m.id, role: m.role, parts: [{ type: "text" as const, text: m.text }] }));
}

/** Rebuilds messages from a stored row, ignoring anything that is not a well-formed text turn. */
export function fromStoredMessages(value: unknown): UIMessage[] {
  if (!Array.isArray(value)) return [];
  const out: UIMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const m = item as { id?: unknown; role?: unknown; parts?: unknown };
    if ((m.role !== "user" && m.role !== "assistant") || !Array.isArray(m.parts)) continue;
    const text = m.parts.map((p) => (p && typeof p === "object" && (p as { type?: unknown }).type === "text" && typeof (p as { text?: unknown }).text === "string" ? (p as { text: string }).text : "")).join("");
    if (!text) continue;
    out.push({ id: typeof m.id === "string" ? m.id : crypto.randomUUID(), role: m.role, parts: [{ type: "text", text }] });
  }
  return out;
}

/** Title for a saved conversation: the first thing the user asked, unless the conversation already has a real title. */
export function titleFor(current: string, messages: UIMessage[]): string {
  if (current && current !== "New conversation") return current.slice(0, 52);
  const first = messages.find((m) => m.role === "user")?.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim().replace(/\s+/g, " ");
  return (first || "Conversation").slice(0, 52);
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchSavePreference(): Promise<boolean> {
  const id = await currentUserId();
  if (!id) return false;
  const { data, error } = await supabase.from("profiles").select("save_conversations").eq("id", id).maybeSingle();
  if (error) throw error;
  return data?.save_conversations === true;
}

export async function storeSavePreference(on: boolean) {
  const id = await currentUserId();
  if (!id) throw new Error("Sign in again to change this setting.");
  const { error } = await supabase.from("profiles").update({ save_conversations: on }).eq("id", id);
  if (error) throw error;
}

export async function listSavedChats(): Promise<SavedSummary[]> {
  const { data, error } = await supabase.from("saved_conversations").select("id, title, agent, updated_at").order("updated_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function loadSavedChat(id: string): Promise<SavedChat | null> {
  const { data, error } = await supabase.from("saved_conversations").select("id, title, agent, updated_at, messages").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, title: data.title, agent: data.agent, updated_at: data.updated_at, messages: fromStoredMessages(data.messages) } : null;
}

export async function saveChat(chat: { id: string; title: string; agent: string; messages: UIMessage[] }) {
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in again to save conversations.");
  const messages = toStoredMessages(chat.messages);
  if (messages.length === 0) return;
  const { error } = await supabase.from("saved_conversations").upsert({ id: chat.id, user_id: userId, title: titleFor(chat.title, chat.messages), agent: chat.agent.slice(0, 80), messages, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw error;
}

export async function deleteSavedChat(id: string) {
  const { error } = await supabase.from("saved_conversations").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAllSavedChats() {
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in again to delete saved conversations.");
  const { error } = await supabase.from("saved_conversations").delete().eq("user_id", userId);
  if (error) throw error;
}

export const savePreferenceKey = ["save-conversations"] as const;
export const savedListKey = ["saved-conversations"] as const;

export function useSavePreference() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: savePreferenceKey, queryFn: fetchSavePreference, staleTime: 60_000 });
  const set = async (on: boolean) => {
    await storeSavePreference(on);
    queryClient.setQueryData(savePreferenceKey, on);
    void queryClient.invalidateQueries({ queryKey: savedListKey });
  };
  return { enabled: query.data === true, loading: query.isLoading, set };
}
