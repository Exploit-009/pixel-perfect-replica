import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileCheck2, Lock, Terminal } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AgentIcon } from "@/components/agent-icon";
import { agents, specialties } from "@/lib/xplo";
import { useXplo } from "@/components/xplo-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "XPLO AI Cybersecurity Edition — guided security research" },
      { name: "description", content: "Learn ethical hacking, penetration testing, forensics and defense with guided commands, authorization checks and specialist AI agents." },
      { property: "og:title", content: "XPLO AI Cybersecurity Edition" },
      { property: "og:description", content: "Guided security procedures, authorized assessment planning and specialist cybersecurity agents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const { createThread } = useXplo();
  const navigate = useNavigate();
  const open = (title: string, agent: string, prompt: string) => {
    const id = createThread(title, agent);
    sessionStorage.setItem(`xplo-start-${id}`, prompt);
    navigate({ to: "/chat/$threadId", params: { threadId: id } });
  };
  return (
    <AppShell>
      <main className="px-4 pt-8">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">Security intelligence division</p>
        <h1 className="mt-3 max-w-xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">Learn it. Test it ethically. Defend it.</h1>
        <p className="mt-4 max-w-xl text-muted-foreground">Procedures with commands, expected output, verification, remediation and reporting — for labs and systems you are authorized to assess.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => open("Penetration test of my web app", "WebSec AI", "Teach me how to perform a penetration test on my own web application.")} className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground">Teach a pentest <ArrowRight className="size-4" /></button>
          <button onClick={() => open("Security question", "XPLO Security Core", "")} className="inline-flex h-11 items-center rounded-md border px-5 text-sm font-medium">Ask XPLO</button>
        </div>
        <ul className="mt-8 grid gap-2 sm:grid-cols-3">
          {[[Lock, "Authorization first"], [Terminal, "Commands for you to review"], [FileCheck2, "Reports and remediation"]].map(([Icon, label]) => {
            const I = Icon as typeof Lock;
            return <li key={label as string} className="flex items-center gap-3 rounded-md border bg-card/70 px-4 py-3 text-sm"><I className="size-4 text-primary" />{label as string}</li>;
          })}
        </ul>
        <h2 className="mt-10 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Specialist agents</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {agents.map((a) => (
            <button key={a.name} onClick={() => open(a.name, a.name, a.prompt)} className="flex items-start gap-4 rounded-md border bg-card/80 p-4 text-left transition-colors hover:border-primary/60">
              <AgentIcon icon={a.icon} color={a.color} />
              <span><span className="font-mono text-[10px] tracking-widest text-muted-foreground">{a.tag}</span><span className="block font-semibold">{a.name}</span><span className="mt-0.5 block text-sm text-muted-foreground">{a.description}</span></span>
            </button>
          ))}
        </div>
        <section className="mt-10 rounded-md border bg-card/70 p-4">
          <h2 className="font-semibold">Security modules</h2>
          <div className="mt-3 flex flex-wrap gap-2">{specialties.map((s) => <span key={s} className="rounded border px-2.5 py-1 text-xs text-muted-foreground">{s}</span>)}</div>
        </section>
        <p className="mt-6 text-xs text-muted-foreground">Conversations are kept only while this page stays open. XPLO explains and plans; it does not run tools or touch your systems.</p>
      </main>
    </AppShell>
  );
}
