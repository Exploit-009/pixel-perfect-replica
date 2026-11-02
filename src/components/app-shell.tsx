import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, MessageSquarePlus, ShieldCheck, SlidersHorizontal, Wrench } from "lucide-react";
import emblem from "@/assets/xplo-emblem.jpg";
import { useXplo } from "@/components/xplo-session";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/assessment", label: "Assess", icon: ShieldCheck },
  { to: "/tools", label: "Tools", icon: Wrench },
  { to: "/setup", label: "Setup", icon: SlidersHorizontal },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { createThread } = useXplo();
  const navigate = useNavigate();
  const start = () => {
    const id = createThread("New conversation");
    navigate({ to: "/chat/$threadId", params: { threadId: id } });
  };
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur">
        <Link to="/" className="flex items-center gap-3">
          <img src={emblem} alt="XPLO fox emblem" width={36} height={36} className="size-9 rounded object-cover" />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-wide">XPLO AI</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Cybersecurity Edition</p>
          </div>
        </Link>
        <button onClick={start} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">
          <MessageSquarePlus className="size-4" /> New chat
        </button>
      </header>
      <div className="flex-1 pb-20">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
        <ul className="mx-auto grid max-w-5xl grid-cols-4">
          {nav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link to={to} activeOptions={{ exact: true }} className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground" activeProps={{ className: "flex flex-col items-center gap-1 py-2.5 text-[11px] text-primary" }}>
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
