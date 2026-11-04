// Browser-safe execution policy: tool registry, command parsing and scope checks.
// The isolated runner enforces the same limits independently; this is the first gate.

export type ToolId = string;
export interface ToolDef {
  id: ToolId;
  label: string;
  network: boolean;
  blockedFlags: string[];
  summary: string;
}

export const toolRegistry: ToolDef[] = [
  { id: "nmap", label: "Nmap", network: true, blockedFlags: ["--script", "-iL", "--datadir", "--interactive", "-sC", "-A"], summary: "Port and service discovery" },
  { id: "nuclei", label: "Nuclei", network: true, blockedFlags: ["-t", "-templates", "-w", "-workflows", "-l", "-list", "-config"], summary: "Template-based vulnerability checks" },
  { id: "nikto", label: "Nikto", network: true, blockedFlags: ["-config", "-Plugins"], summary: "Web server configuration review" },
  { id: "zap-baseline.py", label: "OWASP ZAP baseline", network: true, blockedFlags: ["-c", "-u", "-r"], summary: "Passive web application scan" },
  { id: "dig", label: "dig", network: true, blockedFlags: ["-f"], summary: "DNS lookups" },
  { id: "curl", label: "curl", network: true, blockedFlags: ["-o", "-O", "-T", "-K", "-d", "--data", "--upload-file", "--config", "-X"], summary: "HTTP request inspection (read-only)" },
  { id: "tshark", label: "TShark", network: false, blockedFlags: ["-i", "-w", "-X", "-Z"], summary: "Analyse capture files already in the workspace" },
  { id: "yara", label: "YARA", network: false, blockedFlags: [], summary: "Match rules against workspace files" },
  { id: "analyzeHeadless", label: "Ghidra headless", network: false, blockedFlags: ["-postScript", "-preScript", "-scriptPath"], summary: "Static binary analysis" },
  { id: "file", label: "file", network: false, blockedFlags: [], summary: "Identify file types" },
  { id: "strings", label: "strings", network: false, blockedFlags: [], summary: "Extract printable strings" },
  { id: "sha256sum", label: "sha256sum", network: false, blockedFlags: [], summary: "Hash workspace files" },
  { id: "grep", label: "grep", network: false, blockedFlags: [], summary: "Search workspace files" },
  { id: "ls", label: "ls", network: false, blockedFlags: [], summary: "List workspace files" },
];

export const scopeKinds = ["lab", "own_asset", "authorized_client"] as const;
export const scopeNetworks = ["none", "lab"] as const;

export const MAX_COMMAND_LENGTH = 500;
export const MIN_CIDR_PREFIX = 16;
export const PREVIEW_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 60 * 1000;
export const OUTPUT_LIMIT = 64_000;

const SHELL_CHARS = /[;&|<>`$(){}\\\n\r*!#]/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const FILE_EXT = /\.(txt|xml|json|ya?ml|pcap|pcapng|log|html?|conf|yar|bin|exe|elf|dll|csv|md)$/i;

export function tokenize(input: string): string[] | null {
  const tokens: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  let has = false;
  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null; else cur += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch; has = true;
    } else if (/\s/.test(ch)) {
      if (has || cur) { tokens.push(cur); cur = ""; has = false; }
    } else cur += ch;
  }
  if (quote) return null;
  if (has || cur) tokens.push(cur);
  return tokens;
}

function ipToInt(ip: string): number | null {
  const m = IPV4.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function parseCidr(value: string): { base: number; prefix: number } | null {
  const [ip, p] = value.split("/");
  const base = ipToInt(ip ?? "");
  if (base === null) return null;
  const prefix = p === undefined ? 32 : /^\d{1,2}$/.test(p) ? Number(p) : NaN;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return { base: (base & mask) >>> 0, prefix };
}

function cidrContains(outer: { base: number; prefix: number }, inner: { base: number; prefix: number }) {
  if (inner.prefix < outer.prefix) return false;
  const mask = outer.prefix === 0 ? 0 : (~0 << (32 - outer.prefix)) >>> 0;
  return ((inner.base & mask) >>> 0) === outer.base;
}

/** A scope target is a hostname, a *.wildcard hostname, an IPv4 address, or an IPv4 CIDR no broader than /16. */
export function isValidScopeTarget(target: string): boolean {
  const t = target.trim().toLowerCase();
  if (t.startsWith("*.")) return HOST.test(t.slice(2));
  if (t.includes("/")) {
    const c = parseCidr(t);
    return !!c && c.prefix >= MIN_CIDR_PREFIX;
  }
  return ipToInt(t) !== null || HOST.test(t) || t === "localhost";
}

export function targetInScope(candidate: string, targets: string[]): boolean {
  const c = candidate.trim().toLowerCase();
  const asCidr = parseCidr(c);
  for (const raw of targets) {
    const t = raw.trim().toLowerCase();
    if (asCidr) {
      const scopeCidr = parseCidr(t);
      if (scopeCidr && cidrContains(scopeCidr, asCidr)) return true;
    } else if (t.startsWith("*.")) {
      if (c.endsWith(t.slice(1)) && c.length > t.length - 1) return true;
    } else if (c === t) return true;
  }
  return false;
}

export interface ScopeLike {
  status: string;
  expires_at: string | null;
  network: string;
  targets: string[];
}

export function scopeUsable(scope: ScopeLike, now = Date.now()): string | null {
  if (scope.status !== "approved") return "The scope has not been approved by the owner.";
  if (scope.expires_at && new Date(scope.expires_at).getTime() <= now) return "The scope has expired.";
  return null;
}

function extractHosts(token: string): { hosts: string[]; error?: string } {
  const value = token.startsWith("-") && token.includes("=") ? token.slice(token.indexOf("=") + 1) : token;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    try { return { hosts: [new URL(value).hostname] }; } catch { return { hosts: [], error: `Unreadable URL: ${value}` }; }
  }
  if (/^\d{1,3}(\.\d{1,3}){3}-\d+$/.test(value)) return { hosts: [], error: `Address ranges are not allowed (${value}); list each target or use a CIDR in scope.` };
  const slashStripped = value.replace(/:\d{1,5}$/, "");
  if (parseCidr(slashStripped)) return { hosts: [slashStripped] };
  if (token.startsWith("-")) return { hosts: [] };
  if (HOST.test(slashStripped) && !FILE_EXT.test(slashStripped)) return { hosts: [slashStripped] };
  if (slashStripped.toLowerCase() === "localhost") return { hosts: ["localhost"] };
  return { hosts: [] };
}

export type CommandCheck =
  | { ok: true; tool: ToolDef; argv: string[]; targets: string[]; usesNetwork: boolean }
  | { ok: false; reasons: string[] };

export function validateCommand(raw: string, opts: { sessionTools: string[]; scope: ScopeLike }): CommandCheck {
  const reasons: string[] = [];
  const command = raw.trim();
  if (!command) return { ok: false, reasons: ["Enter a command."] };
  if (command.length > MAX_COMMAND_LENGTH) return { ok: false, reasons: [`Commands are limited to ${MAX_COMMAND_LENGTH} characters.`] };
  if (SHELL_CHARS.test(command)) return { ok: false, reasons: ["Shell operators, pipes, redirects, substitutions and wildcards are not allowed. Run one tool with plain arguments."] };
  const argv = tokenize(command);
  if (!argv || argv.length === 0) return { ok: false, reasons: ["Unclosed quote."] };
  const tool = toolRegistry.find((t) => t.id === argv[0]);
  if (!tool) return { ok: false, reasons: [`"${argv[0]}" is not in the approved tool registry.`] };
  if (!opts.sessionTools.includes(tool.id)) reasons.push(`${tool.label} was not enabled for this session.`);
  const scopeProblem = scopeUsable(opts.scope);
  if (scopeProblem) reasons.push(scopeProblem);
  for (const arg of argv.slice(1)) {
    const flag = arg.includes("=") && arg.startsWith("-") ? arg.slice(0, arg.indexOf("=")) : arg;
    if (tool.blockedFlags.includes(flag)) reasons.push(`${flag} is blocked for ${tool.label}.`);
    if (!arg.startsWith("-") && !/^[a-z][a-z0-9+.-]*:\/\//i.test(arg) && (arg.startsWith("/") || arg.startsWith("~") || arg.split("/").includes(".."))) {
      if (!parseCidr(arg)) reasons.push(`Path "${arg}" is outside the session workspace; use relative paths.`);
    }
  }
  const targets: string[] = [];
  if (tool.network) {
    if (opts.scope.network !== "lab") reasons.push("This scope has networking disabled. Network tools stay locked until the owner approves lab networking.");
    for (const arg of argv.slice(1)) {
      const { hosts, error } = extractHosts(arg);
      if (error) reasons.push(error);
      for (const h of hosts) {
        targets.push(h);
        if (!targetInScope(h, opts.scope.targets)) reasons.push(`${h} is outside the approved scope.`);
      }
    }
    if (targets.length === 0) reasons.push("A network command must name at least one in-scope target.");
  }
  if (reasons.length) return { ok: false, reasons: [...new Set(reasons)] };
  return { ok: true, tool, argv, targets, usesNetwork: tool.network };
}

export function truncateOutput(text: string): string {
  return text.length > OUTPUT_LIMIT ? `${text.slice(0, OUTPUT_LIMIT)}\n[output truncated]` : text;
}
