import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Lock, Play, ShieldAlert, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  cancelCommand, closeSession, confirmCommand, createScope, getTerminalState, openSession, previewCommand,
} from "@/lib/execution.functions";
import { scopeKinds, scopeNetworks, toolRegistry } from "@/lib/execution-policy";

export const Route = createFileRoute("/_authenticated/terminal")({
  head: () => ({ meta: [{ title: "Execution terminal — XPLO AI" }, { name: "description", content: "Approval-gated cybersecurity terminal with scopes, command previews, per-command confirmation and an audit trail." }, { property: "og:title", content: "XPLO execution terminal" }, { property: "og:description", content: "Scoped, confirmed and audited command execution in an isolated runner." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Terminal,
});

type Preview = { commandId: string; tool: string; argv: string[]; targets: string[]; network: boolean; scopeName: string; expiresAt: string };

const box = "rounded-md border bg-card/70 p-4";
const input = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const btn = "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold disabled:opacity-50";

function Terminal() {
  const qc = useQueryClient();
  const stateFn = useServerFn(getTerminalState);
  const createScopeFn = useServerFn(createScope);
  const openFn = useServerFn(openSession);
  const closeFn = useServerFn(closeSession);
  const previewFn = useServerFn(previewCommand);
  const confirmFn = useServerFn(confirmCommand);
  const cancelFn = useServerFn(cancelCommand);
  const { data, error, isLoading } = useQuery({ queryKey: ["terminal"], queryFn: () => stateFn(), refetchInterval: 15000 });
  const refresh = () => qc.invalidateQueries({ queryKey: ["terminal"] });
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong.");

  const [scopeId, setScopeId] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", kind: "lab" as (typeof scopeKinds)[number], network: "none" as (typeof scopeNetworks)[number], targets: "", doc: "" });
  const [showForm, setShowForm] = useState(false);

  const scopeM = useMutation({
    mutationFn: () => createScopeFn({ data: { name: form.name, kind: form.kind, network: form.network, targets: form.targets.split(/[\s,]+/).filter(Boolean), authorization_document: form.doc } }),
    onSuccess: () => { toast.success("Scope submitted. It stays locked until the owner approves it."); setShowForm(false); setForm({ ...form, name: "", targets: "", doc: "" }); refresh(); },
    onError,
  });
  const openM = useMutation({ mutationFn: () => openFn({ data: { scopeId, tools } }), onSuccess: () => { toast.success("Session opened."); refresh(); }, onError: (e) => { onError(e); refresh(); } });
  const closeM = useMutation({ mutationFn: (sessionId: string) => closeFn({ data: { sessionId } }), onSuccess: () => { setPreview(null); refresh(); }, onError });

  const now = Date.now();
  const active = data?.sessions.find((s) => s.state === "active" && new Date(s.expires_at).getTime() > now);
  const approved = (data?.scopes ?? []).filter((s) => s.status === "approved" && (!s.expires_at || new Date(s.expires_at).getTime() > now));
  const chosenScope = approved.find((s) => s.id === scopeId);
  const toolOptions = toolRegistry.filter((t) => !t.network || chosenScope?.network === "lab");

  const previewM = useMutation({
    mutationFn: () => previewFn({ data: { sessionId: active!.id, command } }),
    onSuccess: (r) => { refresh(); if (r.ok) { setReasons([]); setPreview(r); } else { setPreview(null); setReasons(r.reasons); } },
    onError,
  });
  const runM = useMutation({
    mutationFn: () => confirmFn({ data: { commandId: preview!.commandId } }),
    onSuccess: (r) => { toast[r.state === "completed" ? "success" : "warning"](`Command ${r.state}${r.exitCode !== null ? ` (exit ${r.exitCode})` : ""}.`); setPreview(null); setCommand(""); refresh(); },
    onError: (e) => { onError(e); setPreview(null); refresh(); },
  });
  const cancelM = useMutation({ mutationFn: () => cancelFn({ data: { commandId: preview!.commandId } }), onSuccess: () => { setPreview(null); refresh(); } });

  const sessionCommands = (data?.commands ?? []).filter((c) => c.session_id === active?.id && c.state !== "previewed" && c.state !== "cancelled");

  return (
    <AppShell>
      <main className="space-y-6 px-4 pt-8 pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">Isolated execution</p>
          <h1 className="mt-2 text-3xl font-bold">Terminal</h1>
          <p className="mt-2 text-sm text-muted-foreground">Commands run only in a separate disposable runner, inside an owner-approved scope, after you confirm each one. Nothing runs on this app's server.</p>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Loading terminal status…</p> : null}
        {error ? <div role="alert" className={`${box} border-destructive text-sm`}>Could not load terminal status. Try again shortly.</div> : null}

        {data ? (
          <>
            <section className={box} aria-label="Terminal status">
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">{data.runnerConnected ? <CheckCircle2 className="mt-0.5 size-4 text-primary" /> : <Lock className="mt-0.5 size-4 text-muted-foreground" />}
                  <span><strong>Isolated runner:</strong> {data.runnerConnected ? "connected" : "not connected. The terminal is locked and nothing can be executed until a runner is provisioned."}</span></li>
                <li className="flex items-start gap-2">{data.permissionGranted ? <CheckCircle2 className="mt-0.5 size-4 text-primary" /> : <Lock className="mt-0.5 size-4 text-muted-foreground" />}
                  <span><strong>Execution permission:</strong> {data.permissionGranted ? "granted to your account" : "not granted. The owner enables this per user in the backend."}</span></li>
                <li className="flex items-start gap-2">{approved.length ? <CheckCircle2 className="mt-0.5 size-4 text-primary" /> : <Lock className="mt-0.5 size-4 text-muted-foreground" />}
                  <span><strong>Approved scopes:</strong> {approved.length || "none yet"}</span></li>
              </ul>
            </section>

            <section className={box} aria-label="Scopes">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Authorization scopes</h2>
                <button className={`${btn} border`} onClick={() => setShowForm(!showForm)}>{showForm ? "Close" : "New scope"}</button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Public or unknown targets are never allowed. A scope lists only the lab machines or assets you are authorized to test, and the owner approves it before use.</p>
              {showForm ? (
                <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); scopeM.mutate(); }}>
                  <input className={input} placeholder="Scope name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select className={input} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })} aria-label="Scope kind">
                      <option value="lab">My own lab</option><option value="own_asset">An asset I own</option><option value="authorized_client">Authorized client (written permission)</option>
                    </select>
                    <select className={input} value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value as typeof form.network })} aria-label="Networking">
                      <option value="none">Networking off (offline analysis only)</option><option value="lab">Lab networking to listed targets</option>
                    </select>
                  </div>
                  <textarea className={input} rows={3} placeholder={"Targets, one per line: 10.0.0.0/24, *.lab.example.com, 192.168.56.10"} value={form.targets} onChange={(e) => setForm({ ...form, targets: e.target.value })} required />
                  <textarea className={input} rows={4} placeholder="Authorization: who authorized this testing, for which assets, and the dates (min 20 characters)" value={form.doc} onChange={(e) => setForm({ ...form, doc: e.target.value })} minLength={20} required />
                  <button className={`${btn} bg-primary text-primary-foreground`} disabled={scopeM.isPending}>Submit for approval</button>
                </form>
              ) : null}
              <ul className="mt-4 space-y-2">
                {data.scopes.length === 0 ? <li className="text-xs text-muted-foreground">No scopes yet.</li> : null}
                {data.scopes.map((s) => (
                  <li key={s.id} className="rounded border px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2"><span className="font-semibold">{s.name}</span><span className="font-mono uppercase text-primary">{s.status}</span></div>
                    <p className="mt-1 break-words text-muted-foreground">{s.kind.replace("_", " ")} · network {s.network} · {s.targets.join(", ")}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className={box} aria-label="Session">
              <h2 className="text-sm font-semibold">Session</h2>
              {active ? (
                <div className="mt-3 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Active until {new Date(active.expires_at).toLocaleTimeString()} · tools: {active.tools.join(", ")}</span>
                    <button className={`${btn} border`} onClick={() => closeM.mutate(active.id)} disabled={closeM.isPending}>End session</button>
                  </div>
                  <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPreview(null); previewM.mutate(); }}>
                    <input className={`${input} font-mono`} value={command} onChange={(e) => { setCommand(e.target.value); setReasons([]); }} placeholder="nmap -sV 10.0.0.5" aria-label="Command" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={500} />
                    <button className={`${btn} bg-primary text-primary-foreground`} disabled={!command.trim() || previewM.isPending}>Preview</button>
                  </form>
                  {reasons.length ? (
                    <div role="alert" className="rounded border border-destructive p-3 text-xs"><p className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4" /> Blocked before execution</p><ul className="mt-2 list-disc space-y-1 pl-5">{reasons.map((r) => <li key={r}>{r}</li>)}</ul></div>
                  ) : null}
                  {preview ? (
                    <div className="rounded border border-primary p-3 text-xs" aria-label="Command preview">
                      <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-primary" /> Confirm this exact command</p>
                      <pre className="mt-2 overflow-x-auto rounded bg-background p-2 font-mono">{preview.argv.join(" ")}</pre>
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
                        <dt>Tool</dt><dd>{preview.tool}</dd><dt>Scope</dt><dd>{preview.scopeName}</dd>
                        <dt>Targets</dt><dd>{preview.targets.length ? preview.targets.join(", ") : "none (offline)"}</dd>
                        <dt>Network</dt><dd>{preview.network ? "lab network to listed targets" : "disabled"}</dd>
                        <dt>Valid until</dt><dd>{new Date(preview.expiresAt).toLocaleTimeString()}</dd>
                      </dl>
                      <div className="mt-3 flex gap-2">
                        <button className={`${btn} bg-primary text-primary-foreground`} onClick={() => runM.mutate()} disabled={runM.isPending}><Play className="size-4" /> {runM.isPending ? "Running…" : "Run command"}</button>
                        <button className={`${btn} border`} onClick={() => cancelM.mutate()} disabled={runM.isPending}><X className="size-4" /> Cancel</button>
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-3" aria-label="Output">
                    {sessionCommands.length === 0 ? <p className="text-xs text-muted-foreground">No commands run in this session yet.</p> : null}
                    {sessionCommands.map((c) => (
                      <div key={c.id} className="rounded border text-xs">
                        <div className="flex justify-between gap-2 border-b px-3 py-1.5 font-mono"><span className="truncate">$ {c.command}</span><span className="shrink-0 uppercase text-primary">{c.state}{c.exit_code !== null ? ` · ${c.exit_code}` : ""}</span></div>
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words p-3 font-mono">{c.stdout}{c.stderr ? `\n${c.stderr}` : ""}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <select className={input} value={scopeId} onChange={(e) => { setScopeId(e.target.value); setTools([]); }} aria-label="Approved scope">
                    <option value="">{approved.length ? "Choose an approved scope" : "No approved scope available"}</option>
                    {approved.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    {chosenScope ? toolOptions.map((t) => { const on = tools.includes(t.id); return <button key={t.id} type="button" aria-pressed={on} title={t.summary} onClick={() => setTools(on ? tools.filter((x) => x !== t.id) : [...tools, t.id])} className={`rounded border px-3 py-1.5 text-xs ${on ? "border-primary bg-accent text-accent-foreground" : "text-muted-foreground"}`}>{t.label}</button>; }) : <p className="text-xs text-muted-foreground">Choose a scope to pick tools.</p>}
                  </div>
                  <button className={`${btn} bg-primary text-primary-foreground`} disabled={!scopeId || tools.length === 0 || openM.isPending} onClick={() => openM.mutate()}>Open session (30 min)</button>
                  {!data.runnerConnected ? <p className="text-xs text-muted-foreground">Opening a session will be refused until the isolated runner is connected.</p> : null}
                </div>
              )}
            </section>

            <section className={box} aria-label="Audit history">
              <h2 className="text-sm font-semibold">Audit history</h2>
              <ul className="mt-3 space-y-1.5">
                {data.audit.length === 0 ? <li className="text-xs text-muted-foreground">No activity recorded yet.</li> : null}
                {data.audit.map((a) => {
                  const d = a.details as Record<string, unknown>;
                  const note = typeof d?.reason === "string" ? d.reason : Array.isArray(d?.reasons) ? (d.reasons as string[]).join(" ") : Array.isArray(d?.argv) ? (d.argv as string[]).join(" ") : "";
                  return <li key={a.id} className="border-b pb-1.5 text-xs"><span className="font-mono text-primary">{a.event}</span> <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>{note ? <p className="break-words text-muted-foreground">{note}</p> : null}</li>;
                })}
              </ul>
            </section>
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
