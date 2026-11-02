import { describe, expect, it } from "vitest";
import { bearerToken, isAllowedUser, safeRedirect } from "@/lib/access";

describe("invite-only access", () => {
  it("rejects missing or malformed bearer headers", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer not-a-jwt")).toBeNull();
  });
  it("accepts a three-part bearer token", () => {
    expect(bearerToken("Bearer aaa.bbb.ccc")).toBe("aaa.bbb.ccc");
  });
  it("rejects anonymous, unconfirmed and missing users", () => {
    expect(isAllowedUser(null)).toBe(false);
    expect(isAllowedUser({ id: "1", email_confirmed_at: null })).toBe(false);
    expect(isAllowedUser({ id: "1", email_confirmed_at: "2026-01-01", is_anonymous: true })).toBe(false);
  });
  it("allows a confirmed invited user", () => {
    expect(isAllowedUser({ id: "1", email_confirmed_at: "2026-01-01", is_anonymous: false })).toBe(true);
  });
  it("only redirects to internal pages after sign-in", () => {
    expect(safeRedirect("https://evil.example")).toBe("/");
    expect(safeRedirect("//evil.example")).toBe("/");
    expect(safeRedirect("/auth")).toBe("/");
    expect(safeRedirect("/tools")).toBe("/tools");
  });
});
