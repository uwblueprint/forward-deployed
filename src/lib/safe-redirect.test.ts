import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "./safe-redirect";

describe("getSafeRedirectPath", () => {
  it("returns the fallback when next is missing", () => {
    expect(getSafeRedirectPath(null, "/dashboard")).toBe("/dashboard");
    expect(getSafeRedirectPath(undefined, "/dashboard")).toBe("/dashboard");
    expect(getSafeRedirectPath("", "/dashboard")).toBe("/dashboard");
  });

  it("accepts a same-site path", () => {
    expect(getSafeRedirectPath("/settings", "/dashboard")).toBe("/settings");
    expect(getSafeRedirectPath("/settings/profile", "/dashboard")).toBe(
      "/settings/profile",
    );
  });

  it("rejects an external URL", () => {
    expect(getSafeRedirectPath("https://evil.com", "/dashboard")).toBe(
      "/dashboard",
    );
    expect(getSafeRedirectPath("http://evil.com/path", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("rejects a protocol-relative URL", () => {
    expect(getSafeRedirectPath("//evil.com", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("rejects the backslash protocol-relative variant", () => {
    expect(getSafeRedirectPath("/\\evil.com", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("rejects a path containing whitespace or control characters", () => {
    expect(getSafeRedirectPath("/\t/evil.com", "/dashboard")).toBe(
      "/dashboard",
    );
    expect(getSafeRedirectPath("/foo\nbar", "/dashboard")).toBe("/dashboard");
  });

  it("rejects a path not starting with a slash", () => {
    expect(getSafeRedirectPath("dashboard", "/dashboard")).toBe("/dashboard");
  });
});
