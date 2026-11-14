import { describe, expect, it } from "vitest";
import { hasTrustedCookieOrigin } from "./auth-context.js";

describe("hasTrustedCookieOrigin", () => {
  it("accepts the configured origin and equivalent URLs with the same origin", () => {
    expect(hasTrustedCookieOrigin("https://app.afrifinos.example", "https://app.afrifinos.example")).toBe(true);
    expect(hasTrustedCookieOrigin("https://app.afrifinos.example/", "https://app.afrifinos.example/path")).toBe(true);
  });

  it("rejects missing, blank, or malformed origins", () => {
    expect(hasTrustedCookieOrigin(undefined, "https://app.afrifinos.example")).toBe(false);
    expect(hasTrustedCookieOrigin("https://app.afrifinos.example", undefined)).toBe(false);
    expect(hasTrustedCookieOrigin("  ", "https://app.afrifinos.example")).toBe(false);
    expect(hasTrustedCookieOrigin("not a URL", "https://app.afrifinos.example")).toBe(false);
    expect(hasTrustedCookieOrigin("https://app.afrifinos.example", "null")).toBe(false);
  });

  it("rejects a different origin even when its hostname resembles the trusted host", () => {
    expect(hasTrustedCookieOrigin("https://app.afrifinos.example", "https://app.afrifinos.example.attacker.test")).toBe(false);
    expect(hasTrustedCookieOrigin("https://app.afrifinos.example", "http://app.afrifinos.example")).toBe(false);
    expect(hasTrustedCookieOrigin("https://app.afrifinos.example", "https://evil.test")).toBe(false);
  });
});
