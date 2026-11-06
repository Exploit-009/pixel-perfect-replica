// XPLO isolated runner: implements the XPLO runner protocol over HTTP (put TLS in front, see README).
// POST /v1/sessions, POST /v1/commands, DELETE /v1/sessions/:id, GET /v1/health
import http from "node:http";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { createDocker, sandboxArgs, execArgs } from "./docker.mjs";
import { TOOLS, TOOL_IDS, validScopeTarget, validateArgv, checkResolution } from "./policy.mjs";

const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;
const MAX_BODY = 64 * 1024;

export function loadConfig(env = process.env) {
  const token = env.RUNNER_TOKEN ?? "";
  if (token.length < 32) throw new Error("RUNNER_TOKEN must be set to a random value of at least 32 characters.");
  return {
    token,
    port: Number(env.PORT ?? 8787),
    bind: env.BIND ?? "127.0.0.1",
    image: env.TOOLS_IMAGE ?? "xplo-tools:latest",
    labNetwork: env.LAB_NETWORK || null,
    maxSessions: Number(env.MAX_SESSIONS ?? 4),
    maxSessionMinutes: Number(env.MAX_SESSION_MINUTES ?? 60),
    memory: env.SANDBOX_MEMORY ?? "512m",
    cpus: Number(env.SANDBOX_CPUS ?? 1),
    maxCommandSeconds: Number(env.MAX_COMMAND_SECONDS ?? 120),
    dockerBin: env.DOCKER_BIN ?? "docker",
  };
}

const sameToken = (a, b) => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

export function createApp({ config, docker = createDocker({ bin: config.dockerBin }), lookup, log = (m) => console.log(JSON.stringify({ t: new Date().toISOString(), ...m })) }) {
  const sessions = new Map();
  let availableTools = new Set();

  async function detectTools() {
    const script = `for t in ${TOOL_IDS.join(" ")}; do command -v "$t" >/dev/null 2>&1 && echo "$t"; done`;
    const r = await docker.run(["run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL", "--user", "10001:10001", config.image, "sh", "-c", script], { timeoutMs: 60_000 });
    if (r.code !== 0) throw new Error(`Could not start the tools image "${config.image}": ${r.stderr.trim() || "docker failed"}`);
    availableTools = new Set(r.stdout.split("\n").map((s) => s.trim()).filter((t) => TOOL_IDS.includes(t)));
    return [...availableTools];
  }

  async function destroy(id, reason) {
    const s = sessions.get(id);
    if (!s) return false;
    sessions.delete(id);
    await docker.run(["rm", "-f", s.container], { timeoutMs: 20_000 });
    log({ event: "session_destroyed", sessionId: id, reason });
    return true;
  }

  async function reapAll() {
    const r = await docker.run(["ps", "-aq", "--filter", "label=xplo.runner=1"]);
    const ids = r.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
    if (ids.length) await docker.run(["rm", "-f", ...ids], { timeoutMs: 60_000 });
    return ids.length;
  }

  async function reapExpired() {
    for (const [id, s] of sessions) if (s.expiresAt <= Date.now()) await destroy(id, "expired");
  }

  async function createSession(body) {
    const { sessionId, tools, expiresAt, network, allowedTargets } = body ?? {};
    if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) return [400, { error: "invalid sessionId" }];
    if (sessions.has(sessionId)) return [409, { error: "session exists" }];
    if (!Array.isArray(tools) || tools.length === 0 || tools.length > TOOL_IDS.length || tools.some((t) => typeof t !== "string" || !Object.hasOwn(TOOLS, t))) return [400, { error: "invalid tools" }];
    if (network !== "none" && network !== "lab") return [400, { error: "invalid network" }];
    const targets = Array.isArray(allowedTargets) ? allowedTargets : [];
    if (targets.length > 64 || targets.some((t) => typeof t !== "string" || !validScopeTarget(t))) return [400, { error: "invalid allowedTargets" }];
    if (network === "lab" && targets.length === 0) return [400, { error: "lab sessions need allowedTargets" }];
    if (network === "lab" && !config.labNetwork) return [422, { error: "lab networking is not configured on this runner (set LAB_NETWORK)" }];
    const missing = tools.filter((t) => !availableTools.has(t));
    if (missing.length) return [422, { error: `tools not installed in the image: ${missing.join(", ")}` }];
    if (sessions.size >= config.maxSessions) return [429, { error: "too many active sessions" }];
    const exp = Date.parse(expiresAt);
    const cap = Date.now() + config.maxSessionMinutes * 60_000;
    const expires = Number.isFinite(exp) ? Math.min(exp, cap) : cap;
    if (expires <= Date.now()) return [400, { error: "session already expired" }];

    const container = `xplo-${sessionId}`;
    const r = await docker.run(sandboxArgs({
      name: container, sessionId, image: config.image, network, labNetwork: config.labNetwork,
      memory: config.memory, cpus: config.cpus, lifetimeSeconds: Math.ceil((expires - Date.now()) / 1000) + 30,
    }));
    if (r.code !== 0) { log({ event: "session_failed", sessionId, error: r.stderr.trim().slice(0, 300) }); return [502, { error: "could not start sandbox" }]; }
    sessions.set(sessionId, { container, tools, network, allowedTargets: network === "lab" ? targets : [], expiresAt: expires, busy: false, count: 0 });
    log({ event: "session_created", sessionId, network, tools, targets: network === "lab" ? targets : [] });
    return [200, { id: sessionId }];
  }

  async function runCommand(body) {
    const { sessionId, commandId, argv, timeoutSeconds } = body ?? {};
    const s = typeof sessionId === "string" ? sessions.get(sessionId) : null;
    if (!s) return [404, { error: "unknown session" }];
    if (s.expiresAt <= Date.now()) { await destroy(sessionId, "expired"); return [410, { error: "session expired" }]; }
    if (s.busy) return [409, { error: "a command is already running in this session" }];
    const refuse = (reasons) => {
      log({ event: "command_refused", sessionId, commandId, argv, reasons });
      return [200, { exitCode: 126, stdout: "", stderr: `Refused by runner policy: ${reasons.join(" ")}` }];
    };
    const check = validateArgv(argv, s);
    if (!check.ok) return refuse(check.reasons);
    if (check.network) {
      const bad = await checkResolution(check.targets, s.allowedTargets, lookup);
      if (bad.length) return refuse(bad);
    }
    const secs = Math.min(Math.max(Number.isInteger(timeoutSeconds) ? timeoutSeconds : 60, 1), config.maxCommandSeconds);
    s.busy = true;
    s.count += 1;
    const started = Date.now();
    try {
      const r = await docker.run(execArgs({ name: s.container, argv: check.argv, timeoutSeconds: secs }), { timeoutMs: (secs + 15) * 1000 });
      if (r.timedOut) {
        await destroy(sessionId, "hard-timeout");
        return [200, { exitCode: 124, stdout: r.stdout, stderr: `${r.stderr}\n[command exceeded its time limit; the sandbox was destroyed]` }];
      }
      const note = r.truncated ? "\n[output truncated]" : "";
      const stderr = r.code === 124 ? `${r.stderr}\n[command timed out after ${secs}s]` : r.stderr + note;
      log({ event: "command_finished", sessionId, commandId, tool: check.argv[0], exitCode: r.code, ms: Date.now() - started });
      return [200, { exitCode: r.code, stdout: r.stdout, stderr, remoteJobId: `${s.container}#${s.count}` }];
    } finally { s.busy = false; }
  }

  async function handle(req, res) {
    const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
    try {
      const auth = req.headers.authorization ?? "";
      if (!auth.startsWith("Bearer ") || !sameToken(auth.slice(7), config.token)) return send(401, { error: "unauthorized" });
      const url = new URL(req.url ?? "/", "http://runner");
      if (req.method === "GET" && url.pathname === "/v1/health") return send(200, { ok: true, tools: [...availableTools], sessions: sessions.size, labNetwork: !!config.labNetwork });
      let body = null;
      if (req.method === "POST") {
        const chunks = []; let size = 0;
        for await (const c of req) { size += c.length; if (size > MAX_BODY) return send(413, { error: "body too large" }); chunks.push(c); }
        try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return send(400, { error: "invalid json" }); }
      }
      if (req.method === "POST" && url.pathname === "/v1/sessions") { const [c, o] = await createSession(body); return send(c, o); }
      if (req.method === "POST" && url.pathname === "/v1/commands") { const [c, o] = await runCommand(body); return send(c, o); }
      const m = /^\/v1\/sessions\/([A-Za-z0-9-]{8,64})$/.exec(url.pathname);
      if (req.method === "DELETE" && m) { await destroy(m[1], "closed"); return send(200, { ok: true }); }
      return send(404, { error: "not found" });
    } catch (e) {
      log({ event: "internal_error", error: String(e?.message ?? e) });
      return send(500, { error: "internal error" });
    }
  }

  const server = http.createServer(handle);
  server.requestTimeout = 150_000;
  return { server, sessions, detectTools, reapAll, reapExpired, destroy };
}

async function main() {
  const config = loadConfig();
  const app = createApp({ config });
  const removed = await app.reapAll();
  const tools = await app.detectTools();
  console.log(`Removed ${removed} stale sandbox(es). Tools available: ${tools.join(", ") || "none"}.`);
  if (config.bind !== "127.0.0.1" && config.bind !== "::1") console.warn("WARNING: listening on a non-loopback address. Put TLS in front and firewall this port.");
  const timer = setInterval(() => app.reapExpired().catch(() => {}), 15_000);
  app.server.listen(config.port, config.bind, () => console.log(`XPLO runner listening on ${config.bind}:${config.port}`));
  const stop = async () => { clearInterval(timer); app.server.close(); await app.reapAll(); process.exit(0); };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(1); });
