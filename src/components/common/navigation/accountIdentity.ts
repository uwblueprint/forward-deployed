type AccountUser = {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

// Name + email for <AccountMenu />. Sign-up and the seed store first_name/last_name;
// OAuth providers set full_name. Falls back to the email's local part.
export function accountIdentity(user: AccountUser) {
  const email = user.email ?? ""
  const meta = user.user_metadata ?? {}
  const name =
    text(meta.full_name) ||
    [text(meta.first_name), text(meta.last_name)].filter(Boolean).join(" ") ||
    email.split("@")[0] ||
    "Account"
  return { name, email }
}
