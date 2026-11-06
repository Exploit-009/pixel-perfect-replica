import { test } from "node:test";
import assert from "node:assert/strict";
import { validateArgv, checkResolution, validScopeTarget } from "../src/policy.mjs";
import { createApp } from "../src/server.mjs";
import { sandboxArgs, execArgs } from "../src/docker.mjs";

const lab = { tools: ["nmap", "curl", "dig", "nikto", "grep", "ls"], network: "lab", allowedTargets: ["10.10.0.0/24", "dvwa.lab.local"] };
const off = { ...lab, network: "none", allowedTargets: [] };

test("in-scope nmap connect scan is accepted", () => {
  const r = validateArgv(["nmap", "-sT", "-p", "22,80", "10.10.0.5"], lab);
  assert.equal(r.ok, true);
});
test("out-of-scope targets are refused", () => {
  assert.equal(validateArgv(["nmap", "-sT", "8.8.8.8"], lab).ok, false);
  assert.equal(validateArgv(["curl", "-I", "http://example.com"], lab).ok, false);
});
test("single-label names are treated as targets, not ignored", () => {
  assert.equal(validateArgv(["nmap", "-sT", "internalhost"], lab).ok, false);
});
test("unlisted or clustered flags are refused", () => {
  for (const argv of [["nmap", "-sCV", "10.10.0.5"], ["nmap", "--script=vuln", "10.10.0.5"], ["nmap", "-iR", "5"], ["curl", "-L", "http://dvwa.lab.local"], ["curl", "-sSo", "x", "http://dvwa.lab.local"]]) {
    assert.equal(validateArgv(argv, lab).ok, false, argv.join(" "));
  }
});
test("shell metacharacters are refused", () => {
  assert.equal(validateArgv(["ls", "a;rm"], lab).ok, false);
  assert.equal(validateArgv(["grep", "x", "$(id)"], lab).ok, false);
});
test("network tools are refused when the session has no network", () => {
  assert.equal(validateArgv(["nmap", "-sT", "10.10.0.5"], off).ok, false);
});
test("local tools cannot leave the workspace", () => {
  assert.equal(validateArgv(["ls", "/etc"], off).ok, false);
  assert.equal(validateArgv(["grep", "root", "../x"], off).ok, false);
  assert.equal(validateArgv(["grep", "-n", "root", "notes.txt"], off).ok, true);
});
test("tools not enabled for the session are refused", () => {
  assert.equal(validateArgv(["strings", "a.bin"], off).ok, false);
});
test("dig must use an in-scope server", () => {
  assert.equal(validateArgv(["dig", "@10.10.0.53", "dvwa.lab.local", "A"], lab).ok, true);
  assert.equal(validateArgv(["dig", "@1.1.1.1", "dvwa.lab.local"], lab).ok, false);
});
test("metadata and loopback answers are refused", async () => {
  const lookup = async () => [{ address: "169.254.169.254", family: 4 }];
  assert.equal((await checkResolution(["dvwa.lab.local"], lab.allowedTargets, lookup)).length, 1);
});
test("scope targets broader than /16 are rejected", () => {
  assert.equal(validScopeTarget("10.0.0.0/8"), false);
  assert.equal(validScopeTarget("10.10.0.0/24"), true);
});
test("sandbox is non-root, capability-free, read-only and offline by default", () => {
  const a = sandboxArgs({ name: "x", sessionId: "s", image: "i", network: "none", labNetwork: "lab", memory: "512m", cpus: 1, lifetimeSeconds: 60 });
  const at = (f) => a[a.indexOf(f) + 1];
  assert.equal(at("--network"), "none");
  assert.equal(at("--cap-drop"), "ALL");
  assert.equal(at("--user"), "10001:10001");
  assert.ok(a.includes("--read-only"));
  assert.deepEqual(execArgs({ name: "x", argv: ["ls", "-la"], timeoutSeconds: 5 }).slice(-4), ["5", "ls", "-la"].length === 3 ? ["timeout", "-k", "5", "5"].slice(0, 0).concat(["5", "5", "ls", "-la"]) : []);
});

// ---- HTTP protocol with a fake Docker (no real containers) ----
function fakeDocker() {
  const calls = [];
  return { calls, run: async (args) => {
    calls.push(args);
    if (args[0] === "run" && args.includes("sh")) return { code: 0, stdout: "nmap\nls\ngrep\ncurl\n", stderr: "" };
    if (args[0] === "exec") return { code: 0, stdout: "ok\n", stderr: "" };
    return { code: 0, stdout: "", stderr: "" };
  } };
}
async function start(extra = {}) {
  const docker = fakeDocker();
  const config = { token: "t".repeat(40), image: "img", labNetwork: null, maxSessions: 2, maxSessionMinutes: 60, memory: "512m", cpus: 1, maxCommandSeconds: 120, ...extra };
  const app = createApp({ config, docker, log: () => {} });
  await app.detectTools();
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = (method, path, body, token = config.token) => fetch(base + path, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, json: await r.json() }));
  return { app, docker, call };
}
const future = () => new Date(Date.now() + 600_000).toISOString();

test("requests without the token are rejected", async () => {
  const { app, call } = await start();
  assert.equal((await call("GET", "/v1/health", null, "wrong")).status, 401);
  app.server.close();
});
test("offline session runs an allowed command through docker exec without a shell", async () => {
  const { app, docker, call } = await start();
  const s = await call("POST", "/v1/sessions", { sessionId: "sess-0001", tools: ["ls"], expiresAt: future(), network: "none", allowedTargets: [] });
  assert.equal(s.status, 200);
  assert.equal(docker.calls.find((c) => c[0] === "run" && c.includes("sleep"))[docker.calls.find((c) => c.includes("sleep")).indexOf("--network") + 1], "none");
  const c = await call("POST", "/v1/commands", { sessionId: "sess-0001", commandId: "c1", argv: ["ls", "-la"], timeoutSeconds: 10 });
  assert.equal(c.json.exitCode, 0);
  const ex = docker.calls.find((x) => x[0] === "exec");
  assert.deepEqual(ex.slice(-2), ["ls", "-la"]);
  assert.ok(!ex.includes("sh"));
  assert.equal((await call("DELETE", "/v1/sessions/sess-0001")).status, 200);
  app.server.close();
});
test("refused commands never reach docker", async () => {
  const { app, docker, call } = await start();
  await call("POST", "/v1/sessions", { sessionId: "sess-0002", tools: ["ls"], expiresAt: future(), network: "none", allowedTargets: [] });
  const c = await call("POST", "/v1/commands", { sessionId: "sess-0002", commandId: "c1", argv: ["ls", "/etc"] });
  assert.equal(c.json.exitCode, 126);
  assert.equal(docker.calls.filter((x) => x[0] === "exec").length, 0);
  app.server.close();
});
test("lab sessions are refused when no lab network is configured", async () => {
  const { app, call } = await start();
  const s = await call("POST", "/v1/sessions", { sessionId: "sess-0003", tools: ["nmap"], expiresAt: future(), network: "lab", allowedTargets: ["10.10.0.0/24"] });
  assert.equal(s.status, 422);
  app.server.close();
});
test("tools missing from the image are refused", async () => {
  const { app, call } = await start();
  const s = await call("POST", "/v1/sessions", { sessionId: "sess-0004", tools: ["yara"], expiresAt: future(), network: "none", allowedTargets: [] });
  assert.equal(s.status, 422);
  app.server.close();
});
