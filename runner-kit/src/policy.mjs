// Runner-side command policy. It re-validates everything XPLO already checked and is deliberately
// STRICTER: every tool has an explicit allow-list of flags (nothing is allowed by default) and every
// positional argument must be an in-scope target, a recognised value, or a safe relative file.
import dns from "node:dns/promises";

export const MAX_ARGV = 40;
export const MAX_ARG_LENGTH = 300;
const SHELL_CHARS = /[;&|<>`$(){}\\\n\r\0*!#~]/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HOST = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const NUM = /^\d{1,6}$/;
const PORTS = /^[0-9][0-9,\-]{0,60}$/;
const DURATION = /^\d{1,5}[smh]?$/;
const FILE = /^(?!.*\.\.)[A-Za-z0-9._][A-Za-z0-9._\-/]{0,200}$/;
const HEADER = /^[A-Za-z][A-Za-z0-9-]{0,40}: ?[A-Za-z0-9 .,;=\/_()+-]{0,200}$/;

const bool = { kind: "bool" };
const host = { kind: "host" };
const file = { kind: "file" };
const re = (r) => ({ kind: "re", re: r });
const num = re(NUM), ports = re(PORTS), dur = re(DURATION);

export const TOOLS = {
  nmap: { network: true, flags: {
    "-sT": bool, "-sV": bool, "-sn": bool, "-Pn": bool, "-n": bool, "-v": bool, "-vv": bool, "-F": bool,
    "--open": bool, "--reason": bool, "--version-light": bool, "-T2": bool, "-T3": bool, "-T4": bool,
    "-p": ports, "--top-ports": num, "--max-retries": num, "--host-timeout": dur } },
  nuclei: { network: true, noPositional: true, flags: {
    "-u": host, "-target": host, "-severity": re(/^[a-z,]{3,60}$/), "-tags": re(/^[a-z0-9,_-]{1,80}$/),
    "-silent": bool, "-nc": bool, "-rl": num, "-timeout": num, "-retries": num } },
  nikto: { network: true, noPositional: true, flags: {
    "-h": host, "-host": host, "-p": ports, "-port": ports, "-ssl": bool, "-nossl": bool,
    "-nointeractive": bool, "-maxtime": dur, "-Tuning": re(/^[0-9a-cx]{1,12}$/) } },
  "zap-baseline.py": { network: true, noPositional: true, flags: { "-t": host, "-m": num, "-T": num, "-I": bool } },
  dig: { network: true, dig: true, flags: { "+short": bool, "+noall": bool, "+answer": bool, "+nocmd": bool, "+tcp": bool, "-4": bool } },
  // curl: no -L (redirects could leave scope), no proxy/output/upload/data/config flags.
  curl: { network: true, flags: {
    "-s": bool, "--silent": bool, "-S": bool, "--show-error": bool, "-I": bool, "--head": bool, "-i": bool, "--include": bool,
    "-v": bool, "--verbose": bool, "-m": num, "--max-time": num, "--connect-timeout": num, "-H": re(HEADER), "--header": re(HEADER) } },
  tshark: { network: false, noPositional: true, flags: { "-r": file, "-n": bool, "-q": bool, "-c": num, "-Y": re(/^[A-Za-z0-9_.:=<> \-"']{1,200}$/) } },
  yara: { network: false, files: true, flags: { "-s": bool, "-m": bool, "-w": bool, "-r": bool, "-c": bool } },
  analyzeHeadless: { network: false, files: true, flags: { "-import": file, "-deleteProject": bool, "-noanalysis": bool, "-readOnly": bool, "-max-cpu": num } },
  file: { network: false, files: true, flags: { "-b": bool, "-i": bool } },
  strings: { network: false, files: true, flags: { "-a": bool, "-n": num } },
  sha256sum: { network: false, files: true, flags: {} },
  grep: { network: false, files: true, pattern: true, flags: { "-i": bool, "-n": bool, "-c": bool, "-E": bool, "-F": bool, "-v": bool, "-l": bool, "-a": bool, "-r": bool } },
  ls: { network: false, files: true, flags: { "-l": bool, "-a": bool, "-h": bool, "-R": bool, "-la": bool, "-lh": bool } },
};
export const TOOL_IDS = Object.keys(TOOLS);

// ---------- IPv4 / scope helpers ----------
export function ipToInt(ip) {
  const m = IPV4.exec(ip);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) return null;
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}
export function parseCidr(value) {
  const [ip, p] = String(value).split("/");
  const base = ipToInt(ip ?? "");
  if (base === null) return null;
  const prefix = p === undefined ? 32 : /^\d{1,2}$/.test(p) ? Number(p) : NaN;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return { base: (base & mask) >>> 0, prefix };
}
function cidrContains(outer, inner) {
  if (inner.prefix < outer.prefix) return false;
  const mask = outer.prefix === 0 ? 0 : (~0 << (32 - outer.prefix)) >>> 0;
  return ((inner.base & mask) >>> 0) === outer.base;
}
export function targetInScope(candidate, targets) {
  const c = candidate.trim().toLowerCase();
  const asCidr = parseCidr(c);
  for (const raw of targets) {
    const t = raw.trim().toLowerCase();
    if (asCidr) {
      const sc = parseCidr(t);
      if (sc && cidrContains(sc, asCidr)) return true;
    } else if (t.startsWith("*.")) {
      if (c.endsWith(t.slice(1)) && c.length > t.length - 1) return true;
    } else if (c === t) return true;
  }
  return false;
}
/** Accepted scope targets: hostnames, *.wildcards, IPv4, IPv4 CIDR no broader than /16. */
export function validScopeTarget(target) {
  const t = String(target).trim().toLowerCase();
  if (t.startsWith("*.")) return HOST.test(t.slice(2)) && t.slice(2).includes(".");
  if (t.includes("/")) { const c = parseCidr(t); return !!c && c.prefix >= 16; }
  return ipToInt(t) !== null || HOST.test(t);
}

const RESERVED = ["0.0.0.0/8", "127.0.0.0/8", "169.254.0.0/16", "224.0.0.0/3"].map(parseCidr);
/** Reserved/metadata/loopback addresses are refused unless the scope names that exact address or range. */
export function forbiddenAddress(ip, allowedTargets) {
  const n = parseCidr(ip);
  if (!n || !RESERVED.some((r) => cidrContains(r, n))) return false;
  return !allowedTargets.some((t) => { const sc = parseCidr(t); return sc && cidrContains(sc, n); });
}

function hostFromToken(value) {
  const v = value.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      if (u.username || u.password) return { error: "Credentials in URLs are not allowed." };
      return { host: u.hostname.toLowerCase() };
    } catch { return { error: `Unreadable URL: ${v}` }; }
  }
  const noPort = v.replace(/:\d{1,5}$/, "");
  if (parseCidr(noPort) || HOST.test(noPort)) return { host: noPort.toLowerCase() };
  return { error: `"${v}" is not a valid target.` };
}

/** Validate argv for a session = { tools, network: "none"|"lab", allowedTargets }. */
export function validateArgv(argv, session) {
  const reasons = [];
  if (!Array.isArray(argv) || argv.length === 0 || argv.length > MAX_ARGV) return { ok: false, reasons: ["argv must contain 1-40 strings."] };
  if (argv.some((a) => typeof a !== "string" || a.length === 0 || a.length > MAX_ARG_LENGTH)) return { ok: false, reasons: ["Every argument must be a non-empty string under 300 characters."] };
  if (argv.some((a) => SHELL_CHARS.test(a))) return { ok: false, reasons: ["Shell metacharacters are not allowed."] };
  const [toolId, ...args] = argv;
  const tool = Object.hasOwn(TOOLS, toolId) ? TOOLS[toolId] : null;
  if (!tool) return { ok: false, reasons: [`"${toolId}" is not an approved tool.`] };
  if (!session.tools.includes(toolId)) return { ok: false, reasons: [`${toolId} was not enabled for this session.`] };
  if (tool.network && session.network !== "lab") return { ok: false, reasons: ["This session has no network access."] };

  const targets = [];
  const addHost = (raw) => {
    const { host: h, error } = hostFromToken(raw);
    if (error) { reasons.push(error); return; }
    targets.push(h);
    if (!targetInScope(h, session.allowedTargets)) reasons.push(`${h} is outside the approved scope.`);
  };
  const checkFile = (v) => { if (!FILE.test(v)) reasons.push(`"${v}" must be a plain relative path inside the workspace.`); };

  let digServer = false, patternTaken = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (tool.dig && arg.startsWith("@")) {
      if (digServer) reasons.push("Only one @server is allowed.");
      digServer = true; addHost(arg.slice(1)); continue;
    }
    if (arg.startsWith("-") || (tool.dig && arg.startsWith("+"))) {
      let name = arg, inline = null;
      const eq = arg.indexOf("=");
      if (eq > 0 && arg.startsWith("--")) { name = arg.slice(0, eq); inline = arg.slice(eq + 1); }
      if (!Object.hasOwn(tool.flags, name)) { reasons.push(`${name} is not allowed for ${toolId}.`); continue; }
      const spec = tool.flags[name];
      if (spec.kind === "bool") { if (inline !== null) reasons.push(`${name} takes no value.`); continue; }
      const value = inline ?? args[++i];
      if (value === undefined) { reasons.push(`${name} needs a value.`); continue; }
      if (spec.kind === "host") addHost(value);
      else if (spec.kind === "file") checkFile(value);
      else if (!spec.re.test(value)) reasons.push(`Invalid value for ${name}.`);
      continue;
    }
    if (tool.noPositional) { reasons.push(`Unexpected argument "${arg}".`); continue; }
    if (tool.network) {
      if (tool.dig && /^(A|AAAA|MX|TXT|NS|SOA|CNAME|PTR|SRV|ANY)$/i.test(arg)) continue;
      addHost(arg);
    } else if (tool.pattern && !patternTaken) {
      patternTaken = true;
      if (arg.startsWith("/") || arg.split("/").includes("..")) reasons.push("The search pattern may not look like an absolute or parent path.");
    } else checkFile(arg);
  }
  if (tool.network && targets.length === 0) reasons.push("A network command must name at least one in-scope target.");
  if (tool.dig && !digServer) reasons.push("dig must name an in-scope @server.");
  if (reasons.length) return { ok: false, reasons: [...new Set(reasons)] };
  return { ok: true, argv, targets: [...new Set(targets)], network: tool.network };
}

/** Resolve names and refuse reserved/metadata answers. Names only resolvable inside the lab network are left to that network. */
export async function checkResolution(targets, allowedTargets, lookup = dns.lookup) {
  const reasons = [];
  for (const t of targets) {
    if (ipToInt(t.split("/")[0]) !== null) {
      if (forbiddenAddress(t.split("/")[0], allowedTargets)) reasons.push(`${t} is a reserved address.`);
      continue;
    }
    try {
      for (const r of await lookup(t, { all: true })) {
        if (r.family === 4 && forbiddenAddress(r.address, allowedTargets)) reasons.push(`${t} resolves to reserved address ${r.address}.`);
      }
    } catch { /* unresolved here; the lab network is the enforcer */ }
  }
  return reasons;
}
