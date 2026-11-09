/**
 * Creates an organization and makes an existing user its first admin:
 *   npm run db:bootstrap-admin -- --email person@example.com --org "Org name"
 * Server-only: uses SUPABASE_SECRET_KEY from .env.local. Safe to re-run.
 */
import { parseArgs } from "node:util"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const { values } = parseArgs({ options: { email: { type: "string" }, org: { type: "string" } } })
const email = values.email?.trim().toLowerCase()
const orgName = values.org?.trim()
if (!email || !orgName) fail('Usage: npm run db:bootstrap-admin -- --email person@example.com --org "Org name"')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
if (!url || !secretKey) fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env.local and fill them in.")
if (!secretKey.startsWith("sb_secret_")) fail("SUPABASE_SECRET_KEY must be the secret key (sb_secret_...), not the publishable key.")

const supabase = createClient<Database>(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: user, error: userError } = await supabase.from("users").select("id").eq("email", email).maybeSingle()
if (userError) fail(`Looking up ${email} failed: ${userError.message}`)
if (!user) fail(`No account for ${email}. Have them sign up first, then run this again.`)

// Someone could sign up with an address they don't own, so only promote a confirmed one.
const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.id)
if (authError) fail(`Looking up ${email}'s account failed: ${authError.message}`)
if (!authUser.user.email_confirmed_at) fail(`${email} hasn't confirmed their email yet. Ask them to, then run this again.`)

const { data: membership, error: membershipError } = await supabase
  .from("memberships")
  .select("role, organizations (name)")
  .eq("user_id", user.id)
  .maybeSingle()
if (membershipError) fail(`Looking up ${email}'s membership failed: ${membershipError.message}`)
if (membership?.role === "admin") {
  console.log(`${email} is already an admin of ${membership.organizations.name}.`)
  process.exit(0)
}
if (membership) fail(`${email} is already a ${membership.role} of ${membership.organizations.name}. An admin there can change their role.`)

const { data: org, error: orgError } = await supabase.from("organizations").insert({ name: orgName }).select("id").single()
if (orgError) fail(`Creating ${orgName} failed: ${orgError.message}`)

const { error: adminError } = await supabase.from("memberships").insert({ user_id: user.id, organization_id: org.id, role: "admin" })
if (adminError) {
  await supabase.from("organizations").delete().eq("id", org.id)
  fail(`Making ${email} an admin failed, so ${orgName} was removed again: ${adminError.message}`)
}

console.log(`${email} is now the admin of ${orgName} (${org.id}).`)
