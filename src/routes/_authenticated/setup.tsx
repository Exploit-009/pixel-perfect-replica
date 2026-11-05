import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useXplo } from "@/components/xplo-session";
import { specialties } from "@/lib/xplo";
import { SaveHistoryToggle } from "@/components/saved-chats";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({ meta: [{ title: "Cybersecurity setup — XPLO AI" }, { name: "description", content: "Choose experience level, working environment and specialties for XPLO AI." }, { property: "og:title", content: "XPLO cybersecurity setup" }, { property: "og:description", content: "Personalize guidance for your environment and specialties." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Setup,
});
const levels = ["Beginner", "Intermediate", "Advanced security researcher", "Professional penetration tester"];
const environments = ["Android + Termux", "Kali Linux", "Ubuntu / Linux", "Windows", "Multiple environments"];

function Setup() {
  const { level, setLevel, environment, setEnvironment, selectedSpecialties, setSelectedSpecialties } = useXplo();
  const option = (active: boolean) => `rounded-md border px-3 py-2.5 text-left text-sm ${active ? "border-primary bg-accent text-accent-foreground" : "bg-card/70 text-muted-foreground"}`;
  return <AppShell><main className="space-y-8 px-4 pt-8 pb-6"><div><p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">Personal configuration</p><h1 className="mt-2 text-3xl font-bold">Tune XPLO</h1><p className="mt-2 text-sm text-muted-foreground">Level, environment and specialties apply to this open session only. Chat stays guided: XPLO gives commands and you run them. Real execution only happens in the Terminal.</p></div>
    <section><h2 className="text-sm font-semibold">Experience level</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{levels.map((l) => <button key={l} onClick={() => setLevel(l)} className={option(level === l)}>{l}</button>)}</div></section>
    <section><h2 className="text-sm font-semibold">Primary environment</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{environments.map((l) => <button key={l} onClick={() => setEnvironment(l)} className={option(environment === l)}>{l}</button>)}</div></section>
    <section><h2 className="text-sm font-semibold">Specialties</h2><div className="mt-3 flex flex-wrap gap-2">{specialties.map((s) => { const on = selectedSpecialties.includes(s); return <button key={s} onClick={() => setSelectedSpecialties(on ? selectedSpecialties.filter((x) => x !== s) : [...selectedSpecialties, s])} aria-pressed={on} className={`rounded border px-3 py-1.5 text-xs ${on ? "border-primary bg-accent text-accent-foreground" : "text-muted-foreground"}`}>{s}</button>; })}</div></section>
    <SaveHistoryToggle /><section className="rounded-md border bg-card/70 p-4 text-sm"><h2 className="font-semibold">Guidance mode</h2><p className="mt-1 text-muted-foreground">Chat gives step-by-step instructions for you to review and run. The Terminal can execute commands only through a separate isolated runner, inside an owner-approved scope, with your confirmation on every command. It stays locked until a runner is connected.</p></section></main></AppShell>;
}
