/**
 * Sets up a project in single-organization mode (FOR-90). Server-only: uses
 * SUPABASE_SECRET_KEY from .env.local. Safe to re-run.
 *   npm run db:bootstrap-admin -- --org "Org name"            create the organization
 *   npm run db:bootstrap-admin -- --email person@example.com  make someone its admin
 * Both flags can go together. Create the organization before people sign up;
 * anyone who signed up earlier joins it as a volunteer when it's created.
 */
import { parseArgs } from "node:util"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const usage = 'Usage: npm run db:bootstrap-admin -- [--org "Org name"] [--email person@example.com]'
const { values } = parseArgs({ options: { email: { type: "string" }, org: { type: "string" } } })
const email = values.email?.trim().toLowerCase()
const orgName = values.org?.trim()
if (!email && !orgName) fail(usage)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
if (!url || !secretKey) fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env.local and fill them in.")
if (!secretKey.startsWith("sb_secret_")) fail("SUPABASE_SECRET_KEY must be the secret key (sb_secret_...), not the publishable key.")

const supabase = createClient<Database>(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: organizations, error: orgsError } = await supabase.from("organizations").select("id, name")
if (orgsError) fail(`Looking up the organization failed: ${orgsError.message}`)
if (organizations.length > 1) fail(`This project has ${organizations.length} organizations. Single-organization mode needs exactly one.`)

let organization = organizations[0]
if (!organization) {
  if (!orgName) fail(`No organization yet. Create it first: npm run db:bootstrap-admin -- --org "Org name"`)
  const { data: created, error: createError } = await supabase.from("organizations").insert({ name: orgName }).select("id, name").single()
  if (createError) fail(`Creating ${orgName} failed: ${createError.message}`)
  organization = created

  const [{ data: users, error: usersError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from("users").select("id"),
    supabase.from("memberships").select("user_id"),
  ])
  if (usersError || membersError) fail(`Looking up existing users failed: ${(usersError ?? membersError)!.message}`)
  const memberIds = new Set(members.map((m) => m.user_id))
  const early = users.filter((u) => !memberIds.has(u.id)).map((u) => ({ user_id: u.id, organization_id: organization.id }))
  if (early.length) {
    const { error: attachError } = await supabase.from("memberships").insert(early)
    if (attachError) fail(`Adding earlier signups to ${orgName} failed: ${attachError.message}`)
  }
  console.log(`Created ${organization.name} (${organization.id}). Earlier signups who joined it as volunteers: ${early.length}.`)
} else if (orgName && orgName !== organization.name) {
  console.log(`Using the existing organization, ${organization.name}; --org is only for creating it.`)
}

if (!email) process.exit(0)

const { data: user, error: userError } = await supabase.from("users").select("id").eq("email", email).maybeSingle()
if (userError) fail(`Looking up ${email} failed: ${userError.message}`)
if (!user) fail(`No account for ${email}. Have them sign up first, then run this again.`)

// Someone could sign up with an address they don't own, so only promote a confirmed one.
const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.id)
if (authError) fail(`Looking up ${email}'s account failed: ${authError.message}`)
if (!authUser.user.email_confirmed_at) fail(`${email} hasn't confirmed their email yet. Ask them to, then run this again.`)

const { error: adminError } = await supabase
  .from("memberships")
  .upsert({ user_id: user.id, organization_id: organization.id, role: "admin" }, { onConflict: "user_id" })
if (adminError) fail(`Making ${email} an admin failed: ${adminError.message}`)
console.log(`${email} is an admin of ${organization.name}.`)
