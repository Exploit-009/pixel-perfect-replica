import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useXplo } from "@/components/xplo-session";
import { tools } from "@/lib/xplo";

export const Route = createFileRoute("/_authenticated/tools")({
  head: () => ({ meta: [{ title: "Security tool guides — XPLO AI" }, { name: "description", content: "Learn Nmap, Wireshark, Burp Suite, ZAP, Ghidra, YARA and Kali workflows with guided commands." }, { property: "og:title", content: "Security tool guides" }, { property: "og:description", content: "Guided workflows for common security tools. XPLO does not execute them." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Tools,
});

function Tools() {
  const { createThread } = useXplo(); const navigate = useNavigate();
  return <AppShell><main className="px-4 pt-8"><p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">Guided tools</p><h1 className="mt-2 text-3xl font-bold">Tool playbooks</h1><p className="mt-2 text-sm text-muted-foreground">XPLO teaches installation, commands and interpretation. You run tools yourself in an environment you control.</p>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">{tools.map(([name, use, agent]) => <button key={name} onClick={() => { const id = createThread(`${name} guide`, agent as string); sessionStorage.setItem(`xplo-start-${id}`, `Teach me ${name} for ${use}. Start with safe lab setup, installation on my selected environment, essential commands, expected output, interpretation, and safe-use boundaries.`); navigate({ to: "/chat/$threadId", params: { threadId: id } }); }} className="rounded-md border bg-card/80 p-4 text-left hover:border-primary/60"><span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{agent}</span><span className="block text-lg font-semibold">{name}</span><span className="text-sm text-muted-foreground">{use}</span></button>)}</div></main></AppShell>;
}
