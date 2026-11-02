import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useXplo } from "@/components/xplo-session";
import { specialties, validateAssessment } from "@/lib/xplo";

export const Route = createFileRoute("/_authenticated/assessment")({
  head: () => ({ meta: [{ title: "Authorized assessment planner — XPLO AI" }, { name: "description", content: "Define scope and confirm authorization before XPLO prepares a security assessment plan." }, { property: "og:title", content: "Authorized assessment planner" }, { property: "og:description", content: "Scope-first security assessment planning with authorization confirmation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Assessment,
});

const contexts = ["Isolated lab", "Authorized assessment", "Unknown third party"] as const;
function Assessment() {
  const { createThread, environment } = useXplo(); const navigate = useNavigate();
  const [form, setForm] = useState({ objective: "", scope: "", context: "Isolated lab" as (typeof contexts)[number], authorized: false, specialty: "Web security" });
  const [error, setError] = useState("");
  const field = "mt-1.5 w-full rounded-md border bg-input/30 px-3 py-2.5 text-sm outline-none focus:border-primary";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const v = validateAssessment({ ...form, environment });
      const id = createThread(`${v.specialty} assessment plan`, "XPLO Security Core", `Create a ${v.specialty} assessment plan for ${v.context === "Isolated lab" ? "an isolated lab" : "an authorized assessment"}.
Objective: ${v.objective}
Scope and exclusions: ${v.scope}
I confirm I own this target or have written authorization.`);
      navigate({ to: "/chat/$threadId", params: { threadId: id } });
    } catch (err) {
      const message = form.context === "Unknown third party" ? "XPLO will not prepare target-specific testing for an unknown third party. Choose an isolated lab, or confirm authorization." : !form.authorized ? "Confirm ownership or written authorization first." : "Add an objective of at least 10 characters and a defined scope.";
      setError(message); toast.error(message); void err;
    }
  };
  return <AppShell><main className="px-4 pt-8"><p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">Scope gate</p><h1 className="mt-2 text-3xl font-bold">Authorized assessment</h1><p className="mt-2 text-sm text-muted-foreground">XPLO prepares a reviewable plan. It never scans, exploits, or changes a target.</p>
    <form onSubmit={submit} className="mt-6 space-y-4 pb-6">
      <label className="block text-sm font-medium">Environment type<select className={field} value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value as (typeof contexts)[number] })}>{contexts.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="block text-sm font-medium">Specialty<select className={field} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>{specialties.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="block text-sm font-medium">Objective<textarea className={field} rows={3} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Example: review login and API authorization in my staging app" /></label>
      <label className="block text-sm font-medium">Scope and exclusions<textarea className={field} rows={3} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="Hosts, apps, accounts, dates, and what must not be tested" /></label>
      <label className="flex gap-3 rounded-md border bg-card/70 p-3 text-sm"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={form.authorized} onChange={(e) => setForm({ ...form, authorized: e.target.checked })} /><span>I own this target, or I have explicit written authorization and a defined scope. I understand this is my confirmation, not proof XPLO can verify.</span></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground">Create plan with XPLO</button>
    </form></main></AppShell>;
}
