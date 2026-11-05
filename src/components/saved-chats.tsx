import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAllSavedChats, deleteSavedChat, listSavedChats, savedListKey, useSavePreference } from "@/lib/saved-chats";
import { useXplo } from "@/components/xplo-session";

/** Opt-in switch for keeping conversations in the signed-in user's private history. */
export function SaveHistoryToggle() {
  const { enabled, loading, set } = useSavePreference();
  const queryClient = useQueryClient();
  const { reset } = useXplo();
  const [busy, setBusy] = useState(false);
  const { data: saved = [] } = useQuery({ queryKey: savedListKey, queryFn: listSavedChats });
  const toggle = async () => {
    setBusy(true);
    try { await set(!enabled); toast.success(!enabled ? "Saving is on. New replies are stored privately in your account." : "Saving is off. Nothing new is stored."); }
    catch { toast.error("Could not change this setting. Try again."); }
    finally { setBusy(false); }
  };
  const wipe = async () => {
    if (!window.confirm("Delete all of your saved conversations? This cannot be undone.")) return;
    setBusy(true);
    try { await deleteAllSavedChats(); reset(); await queryClient.invalidateQueries({ queryKey: savedListKey }); toast.success("Saved conversations deleted."); }
    catch { toast.error("Could not delete saved conversations. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <section className="rounded-md border bg-card/70 p-4 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="font-semibold">Save my conversations</h2>
          <p className="mt-1 text-muted-foreground">Off by default. When on, each finished reply is stored in the database, visible only to your account. Anything you type in a conversation, including assessment scope details, is saved with it.</p></div>
        <button role="switch" aria-checked={enabled} aria-label="Save my conversations" disabled={loading || busy} onClick={toggle} className={`relative mt-1 h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${enabled ? "border-primary bg-primary" : "bg-muted"}`}><span className={`absolute top-0.5 size-4.5 rounded-full bg-foreground transition-all ${enabled ? "left-5" : "left-0.5"}`} /></button>
      </div>
      {saved.length > 0 && <button onClick={wipe} disabled={busy} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive/50 px-3 text-xs font-medium text-destructive disabled:opacity-50"><Trash2 className="size-3.5" /> Delete all {saved.length} saved</button>}
    </section>
  );
}

/** The user's own saved conversations, newest first. Renders nothing when there are none. */
export function SavedChatsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: saved = [] } = useQuery({ queryKey: savedListKey, queryFn: listSavedChats });
  const { removeThread } = useXplo();
  if (saved.length === 0) return null;
  const remove = async (id: string) => {
    try { await deleteSavedChat(id); removeThread(id); await queryClient.invalidateQueries({ queryKey: savedListKey }); }
    catch { toast.error("Could not delete that conversation. Try again."); }
  };
  return (
    <section className="mt-10">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Saved conversations</h2>
      <ul className="mt-3 space-y-2">
        {saved.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-md border bg-card/80 pr-2">
            <button onClick={() => navigate({ to: "/chat/$threadId", params: { threadId: c.id } })} className="min-w-0 flex-1 px-4 py-3 text-left">
              <span className="block truncate text-sm font-semibold">{c.title}</span>
              <span className="block text-xs text-muted-foreground">{c.agent} · {new Date(c.updated_at).toLocaleDateString()}</span>
            </button>
            <button onClick={() => remove(c.id)} aria-label={`Delete ${c.title}`} className="grid size-9 place-items-center rounded-md text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
