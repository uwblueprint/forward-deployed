import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./allowed-origin";

describe("isAllowedOrigin", () => {
  it("accepts localhost and 127.0.0.1 over http on any port", () => {
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(isAllowedOrigin("http://localhost:54321")).toBe(true);
  });

  it("accepts the production origin", () => {
    expect(isAllowedOrigin("https://forward-deployed.vercel.app")).toBe(true);
  });

  it("accepts a real Vercel preview deployment origin", () => {
    expect(
      isAllowedOrigin(
        "https://forward-deployed-kh3z2epya-forward-deployed.vercel.app",
      ),
    ).toBe(true);
  });

  it("rejects an unrelated origin", () => {
    expect(isAllowedOrigin("https://evil.com")).toBe(false);
  });

  it("rejects a suffix-attack lookalike of the production domain", () => {
    expect(
      isAllowedOrigin("https://forward-deployed.vercel.app.evil.com"),
    ).toBe(false);
  });

  it("rejects a suffix-attack lookalike of a preview domain", () => {
    expect(
      isAllowedOrigin(
        "https://forward-deployed-abc123-forward-deployed.vercel.app.evil.com",
      ),
    ).toBe(false);
  });

  it("rejects a preview-looking hostname that doesn't match the pattern", () => {
    expect(
      isAllowedOrigin("https://not-forward-deployed-forward-deployed.vercel.app"),
    ).toBe(false);
  });

  it("rejects localhost over https", () => {
    expect(isAllowedOrigin("https://localhost:3000")).toBe(false);
  });

  it("rejects an origin with an embedded path or userinfo", () => {
    expect(
      isAllowedOrigin("https://forward-deployed.vercel.app/evil"),
    ).toBe(false);
    expect(
      isAllowedOrigin("https://forward-deployed.vercel.app@evil.com"),
    ).toBe(false);
    expect(
      isAllowedOrigin("https://evil@forward-deployed.vercel.app"),
    ).toBe(false);
    expect(isAllowedOrigin("http://localhost:3000/")).toBe(false);
  });

  it("rejects production over http", () => {
    expect(isAllowedOrigin("http://forward-deployed.vercel.app")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isAllowedOrigin("not-a-url")).toBe(false);
    expect(isAllowedOrigin("")).toBe(false);
  });
});
