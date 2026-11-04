import { describe, expect, it } from "vitest";
import { isValidScopeTarget, targetInScope, validateCommand, type ScopeLike } from "@/lib/execution-policy";

const lab: ScopeLike = { status: "approved", expires_at: null, network: "lab", targets: ["10.0.0.0/24", "*.lab.example.com", "192.168.56.10"] };
const tools = ["nmap", "yara", "curl", "file"];

describe("scope targets", () => {
  it("rejects CIDRs broader than /16 and junk", () => {
    expect(isValidScopeTarget("10.0.0.0/8")).toBe(false);
    expect(isValidScopeTarget("0.0.0.0/0")).toBe(false);
    expect(isValidScopeTarget("10.0.0.0/24")).toBe(true);
    expect(isValidScopeTarget("not a host")).toBe(false);
  });
  it("matches wildcard hosts but not the bare parent or lookalikes", () => {
    expect(targetInScope("app.lab.example.com", lab.targets)).toBe(true);
    expect(targetInScope("lab.example.com", lab.targets)).toBe(false);
    expect(targetInScope("evil-lab.example.com", lab.targets)).toBe(false);
  });
  it("only accepts CIDRs fully inside a scoped range", () => {
    expect(targetInScope("10.0.0.5", lab.targets)).toBe(true);
    expect(targetInScope("10.0.0.0/25", lab.targets)).toBe(true);
    expect(targetInScope("10.0.0.0/16", lab.targets)).toBe(false);
    expect(targetInScope("10.0.1.5", lab.targets)).toBe(false);
  });
});

describe("command validation", () => {
  it("allows an in-scope scan", () => {
    const r = validateCommand("nmap -sV 10.0.0.5", { sessionTools: tools, scope: lab });
    expect(r.ok).toBe(true);
  });
  it("blocks out-of-scope and public targets", () => {
    const r = validateCommand("nmap 8.8.8.8", { sessionTools: tools, scope: lab });
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.reasons.join(" ")).toContain("outside the approved scope");
  });
  it("blocks URLs to hosts outside scope", () => {
    expect(validateCommand("curl https://example.org/", { sessionTools: tools, scope: lab }).ok).toBe(false);
    expect(validateCommand("curl https://app.lab.example.com/", { sessionTools: tools, scope: lab }).ok).toBe(true);
  });
  it("blocks network tools when the scope has networking disabled", () => {
    expect(validateCommand("nmap 10.0.0.5", { sessionTools: tools, scope: { ...lab, network: "none" } }).ok).toBe(false);
    expect(validateCommand("file sample.bin", { sessionTools: tools, scope: { ...lab, network: "none" } }).ok).toBe(true);
  });
  it("rejects shell operators, unknown tools and tools not enabled for the session", () => {
    expect(validateCommand("file a; rm -rf x", { sessionTools: tools, scope: lab }).ok).toBe(false);
    expect(validateCommand("file a | sh", { sessionTools: tools, scope: lab }).ok).toBe(false);
    expect(validateCommand("bash -c id", { sessionTools: tools, scope: lab }).ok).toBe(false);
    expect(validateCommand("nuclei -u http://10.0.0.5", { sessionTools: tools, scope: lab }).ok).toBe(false);
  });
  it("blocks script flags, address ranges and paths outside the workspace", () => {
    expect(validateCommand("nmap --script vuln 10.0.0.5", { sessionTools: tools, scope: lab }).ok).toBe(false);
    expect(validateCommand("nmap 10.0.0.1-20", { sessionTools: tools, scope: lab }).ok).toBe(false);
    expect(validateCommand("file /etc/passwd", { sessionTools: tools, scope: lab }).ok).toBe(false);
    expect(validateCommand("file ../secret", { sessionTools: tools, scope: lab }).ok).toBe(false);
  });
  it("refuses unapproved or expired scopes", () => {
    expect(validateCommand("file a", { sessionTools: tools, scope: { ...lab, status: "pending" } }).ok).toBe(false);
    expect(validateCommand("file a", { sessionTools: tools, scope: { ...lab, expires_at: "2020-01-01T00:00:00Z" } }).ok).toBe(false);
  });
});
