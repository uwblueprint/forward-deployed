type Reason =
  | "expired"
  | "different-browser"
  | "invalid"
  | "invite-expired"
  | "invite-revoked"
  | "invite-used"
  | "invite-wrong-email"
  | "invite-unconfirmed-email"
  | "invite-already-member";

const MESSAGES: Record<Reason, string> = {
  expired:
    "This link has expired or has already been used. Sign up again, or request a new link.",
  "different-browser":
    "This link only works in the browser you signed up in. Open it there instead.",
  invalid: "This link is invalid.",
  "invite-expired": "This invite has expired. Ask your admin for a new one.",
  "invite-revoked":
    "This invite has been revoked. Ask your admin for a new one.",
  "invite-used": "This invite has already been used.",
  "invite-wrong-email":
    "This invite was sent to a different email address. Sign in with that email instead.",
  "invite-unconfirmed-email":
    "Confirm your email address first, then open the invite link again.",
  "invite-already-member":
    "You already belong to an organization and can't accept another invite.",
};

function isReason(value: string | undefined): value is Reason {
  return Object.hasOwn(MESSAGES, value ?? "");
}

/** Falls back to the generic message for an unrecognized reason. */
export function resolveErrorMessage(reason: string | undefined): string {
  return isReason(reason) ? MESSAGES[reason] : MESSAGES.invalid;
}
