import { Bug, Code2, FlaskConical, Fingerprint, Globe, Network, Radar, Shield } from "lucide-react";
const icons = { radar: Radar, globe: Globe, fingerprint: Fingerprint, shield: Shield, network: Network, flask: FlaskConical, bug: Bug, code: Code2 };
const tones = { mint: "text-chart-1 bg-chart-1/10 border-chart-1/30", violet: "text-chart-2 bg-chart-2/10 border-chart-2/30", amber: "text-chart-3 bg-chart-3/10 border-chart-3/30", blue: "text-chart-4 bg-chart-4/10 border-chart-4/30" };
export function AgentIcon({ icon, color }: { icon: string; color: string }) {
  const Icon = icons[icon as keyof typeof icons] ?? Shield;
  return <span className={`grid size-11 shrink-0 place-items-center rounded-md border ${tones[color as keyof typeof tones] ?? tones.mint}`}><Icon className="size-5" /></span>;
}
