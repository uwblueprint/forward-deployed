import { describe, expect, it } from "vitest";
import { resolveErrorMessage } from "./messages";

describe("resolveErrorMessage", () => {
  it.each([
    ["expired", "This link has expired or has already been used. Sign up again, or request a new link."],
    ["different-browser", "This link only works in the browser you signed up in. Open it there instead."],
    ["invalid", "This link is invalid."],
    ["invite-expired", "This invite has expired. Ask your admin for a new one."],
    ["invite-revoked", "This invite has been revoked. Ask your admin for a new one."],
    ["invite-used", "This invite has already been used."],
    ["invite-wrong-email", "This invite was sent to a different email address. Sign in with that email instead."],
    ["invite-unconfirmed-email", "Confirm your email address first, then open the invite link again."],
    ["invite-already-member", "You already belong to an organization and can't accept another invite."],
  ])("resolves %s to its message", (reason, message) => {
    expect(resolveErrorMessage(reason)).toBe(message);
  });

  it("falls back to the generic message for an unrecognized reason", () => {
    expect(resolveErrorMessage("something-unexpected")).toBe("This link is invalid.");
  });

  it("falls back to the generic message when reason is undefined", () => {
    expect(resolveErrorMessage(undefined)).toBe("This link is invalid.");
  });
});
