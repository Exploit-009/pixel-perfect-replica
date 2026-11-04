import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_COMMAND_LENGTH, PREVIEW_TTL_MS, SESSION_TTL_MS, isValidScopeTarget, scopeKinds, scopeNetworks,
  scopeUsable, toolRegistry, truncateOutput, validateCommand,
} from "./execution-policy";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function audit(db: Admin, userId: string, event: string, ids: { sessionId?: string | null; commandId?: string | null }, details: Record<string, unknown> = {}) {
  await db.from("execution_audit").insert({ user_id: userId, event, session_id: ids.sessionId ?? null, command_id: ids.commandId ?? null, details: details as never });
}

async function runnerReady() {
  const { runnerConfig } = await import("./execution-runner.server");
  return runnerConfig() !== null;
}

export const getTerminalState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [perm, scopes, sessions, commands, auditRows] = await Promise.all([
      supabase.from("execution_permissions").select("enabled, allow_assessment").eq("user_id", userId).maybeSingle(),
      supabase.from("execution_scopes").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("execution_sessions").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("execution_commands").select("id, session_id, command, state, exit_code, stdout, stderr, duration_ms, created_at, expires_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("execution_audit").select("id, event, details, created_at, command_id, session_id").order("created_at", { ascending: false }).limit(40),
    ]);
    const err = perm.error ?? scopes.error ?? sessions.error ?? commands.error ?? auditRows.error;
    if (err) throw new Error("Could not load terminal state.");
    return {
      runnerConnected: await runnerReady(),
      permissionGranted: perm.data?.enabled === true,
      scopes: scopes.data ?? [],
      sessions: sessions.data ?? [],
      commands: commands.data ?? [],
      audit: auditRows.data ?? [],
    };
  });

const scopeInput = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(scopeKinds),
  network: z.enum(scopeNetworks),
  targets: z.array(z.string().trim().toLowerCase().min(1).max(253)).min(1).max(20),
  authorization_document: z.string().trim().min(20).max(4000),
});

export const createScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => scopeInput.parse(input))
  .handler(async ({ data, context }) => {
    const bad = data.targets.filter((t) => !isValidScopeTarget(t));
    if (bad.length) throw new Error(`Invalid target(s): ${bad.join(", ")}. Use hostnames, *.wildcards, IPv4 addresses or CIDRs no broader than /16.`);
    const db = await admin();
    const { data: row, error } = await db.from("execution_scopes").insert({
      user_id: context.userId, name: data.name, kind: data.kind, network: data.network, targets: data.targets,
      authorization_document: data.authorization_document, status: "pending",
    }).select("id").single();
    if (error || !row) throw new Error("Could not save the scope.");
    await audit(db, context.userId, "scope_submitted", {}, { scope_id: row.id, targets: data.targets, network: data.network });
    return { id: row.id };
  });

const openInput = z.object({ scopeId: z.string().uuid(), tools: z.array(z.string()).min(1).max(toolRegistry.length) });

export const openSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => openInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = await admin();
    const fail = async (event: string, message: string): Promise<never> => {
      await audit(db, userId, event, {}, { scope_id: data.scopeId, reason: message });
      throw new Error(message);
    };
    const { data: perm } = await supabase.from("execution_permissions").select("enabled").eq("user_id", userId).maybeSingle();
    if (!perm?.enabled) return fail("session_blocked", "Execution has not been enabled for your account by the owner.");
    const { data: scope } = await supabase.from("execution_scopes").select("*").eq("id", data.scopeId).maybeSingle();
    if (!scope) return fail("session_blocked", "Scope not found.");
    const problem = scopeUsable(scope);
    if (problem) return fail("session_blocked", problem);
    const tools = [...new Set(data.tools)];
    const unknown = tools.filter((t) => !toolRegistry.some((r) => r.id === t));
    if (unknown.length) return fail("session_blocked", `Unknown tool: ${unknown.join(", ")}`);
    if (scope.network !== "lab" && tools.some((t) => toolRegistry.find((r) => r.id === t)?.network)) {
      return fail("session_blocked", "This scope has networking disabled, so network tools cannot be enabled.");
    }
    if (!(await runnerReady())) return fail("session_blocked", "The isolated runner is not connected, so no session can start. Nothing was executed.");
    const { data: active } = await supabase.from("execution_sessions").select("id").eq("state", "active").gt("expires_at", new Date().toISOString());
    if (active && active.length) return fail("session_blocked", "Close your active session before opening another.");

    const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const { data: session, error } = await db.from("execution_sessions").insert({ user_id: userId, scope_id: scope.id, tools, state: "starting", expires_at: expires }).select("id").single();
    if (error || !session) throw new Error("Could not create the session.");
    try {
      const { runnerCall } = await import("./execution-runner.server");
      const res = await runnerCall<{ id?: string }>("/v1/sessions", "POST", {
        sessionId: session.id, tools, expiresAt: expires,
        network: scope.network, allowedTargets: scope.network === "lab" ? scope.targets : [],
      }, 30_000);
      await db.from("execution_sessions").update({ state: "active", remote_id: res.id ?? session.id }).eq("id", session.id);
      await audit(db, userId, "session_opened", { sessionId: session.id }, { scope_id: scope.id, tools, network: scope.network });
      return { id: session.id };
    } catch (e) {
      await db.from("execution_sessions").update({ state: "failed" }).eq("id", session.id);
      await audit(db, userId, "session_failed", { sessionId: session.id }, { reason: e instanceof Error ? e.message : "unknown" });
      throw new Error(e instanceof Error ? e.message : "Session failed to start.");
    }
  });

export const closeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: s } = await context.supabase.from("execution_sessions").select("id, state").eq("id", data.sessionId).maybeSingle();
    if (!s) throw new Error("Session not found.");
    try {
      const { runnerCall } = await import("./execution-runner.server");
      await runnerCall(`/v1/sessions/${s.id}`, "DELETE", undefined, 20_000);
    } catch { /* record closure locally even if the runner is already gone */ }
    await db.from("execution_sessions").update({ state: "closed" }).eq("id", s.id).eq("user_id", context.userId);
    await db.from("execution_commands").update({ state: "cancelled" }).eq("session_id", s.id).eq("state", "previewed");
    await audit(db, context.userId, "session_closed", { sessionId: s.id });
    return { ok: true };
  });

async function loadActiveSession(supabase: Parameters<Parameters<ReturnType<typeof createServerFn>["handler"]>[0]>[0] extends never ? never : any, sessionId: string) {
  const { data: session } = await supabase.from("execution_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!session) throw new Error("Session not found.");
  if (session.state !== "active" || new Date(session.expires_at).getTime() <= Date.now()) throw new Error("This session is no longer active.");
  const { data: scope } = await supabase.from("execution_scopes").select("*").eq("id", session.scope_id).maybeSingle();
  if (!scope) throw new Error("The session scope is missing.");
  return { session, scope };
}

export const previewCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid(), command: z.string().max(MAX_COMMAND_LENGTH + 50) }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { session, scope } = await loadActiveSession(context.supabase, data.sessionId);
    const check = validateCommand(data.command, { sessionTools: session.tools, scope });
    if (!check.ok) {
      await audit(db, context.userId, "command_rejected", { sessionId: session.id }, { command: data.command.slice(0, MAX_COMMAND_LENGTH), reasons: check.reasons });
      return { ok: false as const, reasons: check.reasons };
    }
    const expires = new Date(Date.now() + PREVIEW_TTL_MS).toISOString();
    const { data: row, error } = await db.from("execution_commands").insert({
      user_id: context.userId, session_id: session.id, command: data.command.trim(), argv: check.argv, state: "previewed", expires_at: expires,
    }).select("id").single();
    if (error || !row) throw new Error("Could not prepare the command preview.");
    await audit(db, context.userId, "command_previewed", { sessionId: session.id, commandId: row.id }, { argv: check.argv, targets: check.targets, network: check.usesNetwork });
    return {
      ok: true as const, commandId: row.id, tool: check.tool.label, argv: check.argv, targets: check.targets,
      network: check.usesNetwork, scopeName: scope.name, expiresAt: expires,
    };
  });

export const cancelCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ commandId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: rows } = await db.from("execution_commands").update({ state: "cancelled" }).eq("id", data.commandId).eq("user_id", context.userId).eq("state", "previewed").select("id, session_id");
    if (rows?.[0]) await audit(db, context.userId, "command_cancelled", { sessionId: rows[0].session_id, commandId: rows[0].id });
    return { ok: true };
  });

export const confirmCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ commandId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = await admin();
    const { data: cmd } = await supabase.from("execution_commands").select("*").eq("id", data.commandId).maybeSingle();
    if (!cmd) throw new Error("Command not found.");
    const refuse = async (state: string, event: string, message: string): Promise<never> => {
      await db.from("execution_commands").update({ state }).eq("id", cmd.id).eq("state", "previewed");
      await audit(db, userId, event, { sessionId: cmd.session_id, commandId: cmd.id }, { reason: message });
      throw new Error(message);
    };
    if (cmd.state !== "previewed") throw new Error("This command was already handled.");
    if (new Date(cmd.expires_at).getTime() <= Date.now()) return refuse("expired", "command_expired", "The preview expired. Preview the command again.");
    const { data: perm } = await supabase.from("execution_permissions").select("enabled").eq("user_id", userId).maybeSingle();
    if (!perm?.enabled) return refuse("blocked", "command_blocked", "Execution has been disabled for your account.");
    let loaded;
    try { loaded = await loadActiveSession(supabase, cmd.session_id); } catch (e) { return refuse("blocked", "command_blocked", e instanceof Error ? e.message : "Session unavailable."); }
    // Re-validate against the live scope: it may have been revoked or expired since the preview.
    const check = validateCommand(cmd.command, { sessionTools: loaded.session.tools, scope: loaded.scope });
    if (!check.ok) return refuse("blocked", "command_blocked", check.reasons.join(" "));
    if (!(await runnerReady())) return refuse("blocked", "command_blocked", "The isolated runner is not connected. Nothing was executed.");

    // Claim the command atomically so one confirmation runs exactly once.
    const { data: claimed } = await db.from("execution_commands").update({ state: "running", confirmed_at: new Date().toISOString() }).eq("id", cmd.id).eq("state", "previewed").select("id");
    if (!claimed?.length) throw new Error("This command was already handled.");
    await audit(db, userId, "command_confirmed", { sessionId: cmd.session_id, commandId: cmd.id }, { argv: check.argv });
    const started = Date.now();
    try {
      const { runnerCall } = await import("./execution-runner.server");
      const res = await runnerCall<{ exitCode?: number; stdout?: string; stderr?: string; remoteJobId?: string }>("/v1/commands", "POST", {
        sessionId: loaded.session.id, commandId: cmd.id, argv: check.argv, timeoutSeconds: 120,
      });
      const exit = typeof res.exitCode === "number" ? res.exitCode : null;
      const state = exit === 0 ? "completed" : "failed";
      await db.from("execution_commands").update({
        state, exit_code: exit, stdout: truncateOutput(String(res.stdout ?? "")), stderr: truncateOutput(String(res.stderr ?? "")),
        duration_ms: Date.now() - started, remote_job_id: res.remoteJobId ?? null,
      }).eq("id", cmd.id);
      await audit(db, userId, "command_finished", { sessionId: cmd.session_id, commandId: cmd.id }, { state, exit_code: exit, duration_ms: Date.now() - started });
      return { state, exitCode: exit };
    } catch (e) {
      const message = e instanceof Error ? e.message : "The runner failed.";
      await db.from("execution_commands").update({ state: "failed", stderr: message, duration_ms: Date.now() - started }).eq("id", cmd.id);
      await audit(db, userId, "command_finished", { sessionId: cmd.session_id, commandId: cmd.id }, { state: "failed", reason: message });
      throw new Error(message);
    }
  });
