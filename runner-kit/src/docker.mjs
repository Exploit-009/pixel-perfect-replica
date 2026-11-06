// Thin Docker CLI driver. Every call uses spawn() with an argument array: no shell is ever involved.
import { spawn } from "node:child_process";

export function createDocker({ bin = "docker" } = {}) {
  /** Run `docker <args>`; captures at most maxBytes per stream, kills after timeoutMs. */
  function run(args, { timeoutMs = 30_000, maxBytes = 256_000 } = {}) {
    return new Promise((resolve) => {
      const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "", truncated = false, timedOut = false;
      const take = (cur, chunk) => {
        if (cur.length >= maxBytes) { truncated = true; return cur; }
        const next = cur + chunk.toString("utf8");
        if (next.length > maxBytes) { truncated = true; return next.slice(0, maxBytes); }
        return next;
      };
      child.stdout.on("data", (c) => { stdout = take(stdout, c); });
      child.stderr.on("data", (c) => { stderr = take(stderr, c); });
      const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
      child.on("error", (e) => { clearTimeout(timer); resolve({ code: 127, stdout, stderr: stderr || String(e.message), truncated, timedOut }); });
      child.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? 1, stdout, stderr, truncated, timedOut }); });
    });
  }
  return { run };
}

export const UID = "10001";

/** Hardened container for one session: non-root, no capabilities, read-only root, tmpfs workspace, limits. */
export function sandboxArgs({ name, sessionId, image, network, labNetwork, memory, cpus, lifetimeSeconds }) {
  const net = network === "lab" ? labNetwork : "none";
  return [
    "run", "-d", "--name", name,
    "--label", "xplo.runner=1", "--label", `xplo.session=${sessionId}`,
    "--network", net,
    "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--pids-limit", "128", "--memory", memory, "--memory-swap", memory, "--cpus", String(cpus),
    "--ulimit", "nofile=256:256", "--ulimit", "core=0",
    "--user", `${UID}:${UID}`,
    "--tmpfs", `/work:rw,nosuid,nodev,size=64m,uid=${UID},gid=${UID}`,
    "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=32m",
    "--workdir", "/work", "--env", "HOME=/work",
    "--restart", "no",
    image, "sleep", String(lifetimeSeconds),
  ];
}

export function execArgs({ name, argv, timeoutSeconds }) {
  return ["exec", "--user", `${UID}:${UID}`, "--workdir", "/work", name, "timeout", "-k", "5", String(timeoutSeconds), ...argv];
}
