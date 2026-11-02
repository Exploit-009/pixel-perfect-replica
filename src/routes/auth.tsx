import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import emblem from "@/assets/xplo-emblem.jpg";
import { supabase } from "@/integrations/supabase/client";
import { safeRedirect } from "@/lib/access";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({ redirect: safeRedirect(search["redirect"]) }),
  head: () => ({
    meta: [
      { title: "Sign in — XPLO AI" },
      { name: "description", content: "XPLO AI is invite-only. Sign in with the account you were invited with." },
      { property: "og:title", content: "Sign in to XPLO AI" },
      { property: "og:description", content: "Invite-only access to the XPLO cybersecurity assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = "mt-1.5 w-full rounded-md border bg-input/30 px-3 py-2.5 text-sm outline-none focus:border-primary";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) {
      setError("That email and password were not accepted. XPLO is invite-only.");
      return;
    }
    navigate({ to: redirect, replace: true });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5">
      <img src={emblem} alt="XPLO fox emblem" width={56} height={56} className="size-14 rounded object-cover" />
      <p className="mt-5 font-mono text-xs uppercase tracking-[0.25em] text-primary">Invite-only access</p>
      <h1 className="mt-2 text-3xl font-bold">Sign in to XPLO AI</h1>
      <p className="mt-2 text-sm text-muted-foreground">Use the account the owner created for you. There is no public sign-up.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">Email<input className={field} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="block text-sm font-medium">Password<input className={field} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"><Lock className="size-4" />{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
