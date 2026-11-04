/**
 * Seeds the Supabase project at NEXT_PUBLIC_SUPABASE_URL with generated demo
 * data. Run with `npm run db:seed` (reads `.env.local`).
 *
 * Server-only. SUPABASE_SECRET_KEY bypasses Row Level Security, so this file
 * must never be imported from app code.
 *
 * Safe to re-run. Every row it creates has a fixed ID derived from a hash, so a
 * re-run replaces the seed's own rows and never touches anything else.
 *
 * Logins: every seeded account uses one password. Set SEED_USER_PASSWORD in
 * `.env.local` to choose it; otherwise a random one is generated and printed.
 */
import { createHash, randomBytes } from "node:crypto"
import { fakerEN_CA as faker } from "@faker-js/faker"
import { createClient } from "@supabase/supabase-js"

// --- Shape of the generated data ---------------------------------------------

const FAKER_SEED = 20261105
const ORGANIZATION_COUNT = 10
// Volunteers and events are spread over the first two organizations, so each
// of those has enough data to click around in and to compare against the other.
const ACTIVE_ORGANIZATION_COUNT = 2
const VOLUNTEER_COUNT = 10
const EVENT_COUNT = 10
const REGISTRATION_COUNT = 10

const VOLUNTEER_STATUSES = ["approved", "approved", "approved", "pending", "rejected"] as const
const EVENT_STATUSES = ["published", "published", "published", "draft", "completed", "cancelled"] as const

// Must match WEEKDAYS and SHIFTS in the onboarding schema and the check
// constraints in the first migration.
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
const SHIFTS = ["morning", "afternoon", "evening"]

// Small vocabularies that Faker has no equivalent for. Faker picks from them.
const ORGANIZATION_KINDS = [
  "Community Food Bank",
  "Youth Mentorship Network",
  "Environmental Collective",
  "Seniors Outreach",
  "Literacy Council",
  "Animal Rescue",
]
const EVENT_KINDS = [
  { category: "Food security", activity: "Food bank sorting shift" },
  { category: "Tutoring", activity: "After-school homework club" },
  { category: "Environment", activity: "Park cleanup" },
  { category: "Community outreach", activity: "Community dinner" },
  { category: "Fundraising", activity: "Charity fun run" },
  { category: "Seniors", activity: "Seniors tech help session" },
]
const SKILLS = ["First aid", "Driving", "Cooking", "Tutoring", "Event setup", "Translation", "Photography", "Social media"]
const RELATIONSHIPS = ["Parent", "Sibling", "Partner", "Friend", "Roommate"]
const REJECTION_REASONS = [
  "Availability does not match current programs.",
  "Application is missing required references.",
  "Does not meet the minimum age for this program.",
]
const EVENT_NOTES = ["No experience needed.", "Training provided on site.", "Wear closed-toe shoes.", "Snacks provided."]

// --- Setup --------------------------------------------------------------------

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env.local and fill them in.")
  process.exit(1)
}
if (!secretKey.startsWith("sb_secret_")) {
  console.error("SUPABASE_SECRET_KEY must be the secret key (sb_secret_...), not the publishable key.")
  process.exit(1)
}

const password = process.env.SEED_USER_PASSWORD || randomBytes(12).toString("base64url")
const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
faker.seed(FAKER_SEED)

/** Stable UUID for the nth seeded row of a kind, so re-runs replace instead of duplicating. */
function seedId(kind: string, index: number): string {
  const hex = createHash("sha256").update(`forward-deployed-seed:${kind}:${index}`).digest("hex")
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function emailFor(firstName: string, lastName: string, index: number): string {
  const slug = (s: string) => s.normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase()
  return `${slug(firstName)}.${slug(lastName)}.${index}@example.com`
}

function check(error: { message: string } | null, step: string): void {
  if (error) {
    console.error(`Seed failed while ${step}: ${error.message}`)
    process.exit(1)
  }
}

// Midnight today, so dates are stable within a day and events stay upcoming.
const today = new Date()
today.setHours(0, 0, 0, 0)

// --- Generate -----------------------------------------------------------------

const organizations = Array.from({ length: ORGANIZATION_COUNT }, (_, i) => ({
  id: seedId("organization", i),
  name: `${faker.location.city()} ${faker.helpers.arrayElement(ORGANIZATION_KINDS)}`,
}))
const activeOrgIds = organizations.slice(0, ACTIVE_ORGANIZATION_COUNT).map((org) => org.id)

type SeedUser = {
  id: string
  email: string
  full_name: string
  role: "admin" | "volunteer"
  organization_id: string
}

// One admin per organization, then volunteers spread over the active orgs.
const users: SeedUser[] = [
  ...organizations.map((org) => ({ org, role: "admin" as const })),
  ...Array.from({ length: VOLUNTEER_COUNT }, (_, i) => ({
    org: organizations[i % ACTIVE_ORGANIZATION_COUNT],
    role: "volunteer" as const,
  })),
].map(({ org, role }, i) => {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  return {
    id: seedId("user", i),
    email: emailFor(firstName, lastName, i),
    full_name: `${firstName} ${lastName}`,
    role,
    organization_id: org.id,
  }
})
const volunteerUsers = users.filter((user) => user.role === "volunteer")

const volunteers = volunteerUsers.map((user, i) => {
  const status = VOLUNTEER_STATUSES[Math.floor(i / ACTIVE_ORGANIZATION_COUNT) % VOLUNTEER_STATUSES.length]
  const appliedAt = faker.date.recent({ days: 60, refDate: today })
  return {
    id: seedId("volunteer", i),
    user_id: user.id,
    status,
    rejection_reason: status === "rejected" ? faker.helpers.arrayElement(REJECTION_REASONS) : null,
    reviewed_at: status === "pending" ? null : faker.date.between({ from: appliedAt, to: today }).toISOString(),
    phone: faker.phone.number({ style: "national" }),
    location: `${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`,
    availability_days: faker.helpers
      .arrayElements(WEEKDAYS, { min: 1, max: 4 })
      .sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)),
    shift_preference: faker.helpers.arrayElement(SHIFTS),
    skills: faker.helpers.arrayElements(SKILLS, { min: 1, max: 3 }),
    emergency_contact_name: faker.person.fullName(),
    emergency_contact_phone: faker.phone.number({ style: "national" }),
    emergency_contact_relationship: faker.helpers.arrayElement(RELATIONSHIPS),
    consent_accepted_at: appliedAt.toISOString(),
  }
})

const events = Array.from({ length: EVENT_COUNT }, (_, i) => {
  const organizationId = activeOrgIds[i % ACTIVE_ORGANIZATION_COUNT]
  const status = EVENT_STATUSES[Math.floor(i / ACTIVE_ORGANIZATION_COUNT) % EVENT_STATUSES.length]
  const kind = faker.helpers.arrayElement(EVENT_KINDS)
  const startsAt =
    status === "completed"
      ? faker.date.recent({ days: 30, refDate: today })
      : faker.date.soon({ days: 45, refDate: today })
  startsAt.setMinutes(0, 0, 0)
  const endsAt = new Date(startsAt.getTime() + faker.number.int({ min: 2, max: 4 }) * 60 * 60 * 1000)
  return {
    id: seedId("event", i),
    organization_id: organizationId,
    status,
    title: `${kind.activity} on ${faker.location.street()}`,
    description: `${kind.activity} with ${organizations.find((org) => org.id === organizationId)?.name}. ${faker.helpers.arrayElement(EVENT_NOTES)}`,
    category: kind.category,
    location: faker.location.streetAddress(),
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    capacity: faker.helpers.arrayElement([10, 15, 20, 25, 30]),
  }
})

// Registrations follow the same rules the app enforces: approved volunteers,
// published events, same organization.
const eligiblePairs = volunteers.flatMap((volunteer) => {
  const orgId = users.find((user) => user.id === volunteer.user_id)?.organization_id
  if (volunteer.status !== "approved") return []
  return events
    .filter((event) => event.status === "published" && event.organization_id === orgId)
    .map((event) => ({ volunteer, event }))
})
if (eligiblePairs.length < REGISTRATION_COUNT) {
  console.error(`Only ${eligiblePairs.length} valid volunteer/event pairs; need ${REGISTRATION_COUNT}.`)
  process.exit(1)
}
const registrations = faker.helpers
  .arrayElements(eligiblePairs, REGISTRATION_COUNT)
  .map(({ volunteer, event }, i) => ({
    id: seedId("registration", i),
    event_id: event.id,
    volunteer_id: volunteer.id,
    status: i % 5 === 4 ? "cancelled" : "registered",
  }))

// --- Write --------------------------------------------------------------------

console.log(`Seeding ${new URL(url).host} ...`)

// 1. Remove the previous run's accounts. Cascades remove their users,
//    volunteers, and registrations rows. Other accounts are untouched.
for (const user of users) {
  const { error } = await supabase.auth.admin.deleteUser(user.id)
  if (error && error.status !== 404) check(error, `deleting seed user ${user.email}`)
}

// 2. Organizations and events are upserted, so anything else pointing at them survives.
check((await supabase.from("organizations").upsert(organizations)).error, "upserting organizations")

// 3. Real auth accounts, so the team can sign in as each role. The signup
//    trigger creates each public.users row as a volunteer with no organization.
for (const user of users) {
  const { error } = await supabase.auth.admin.createUser({
    id: user.id,
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: user.full_name },
  })
  check(error, `creating auth user ${user.email}`)
}

// 4. Role and organization are assigned here, server-side, never from signup data.
for (const org of organizations) {
  for (const role of ["admin", "volunteer"] as const) {
    const ids = users.filter((u) => u.organization_id === org.id && u.role === role).map((u) => u.id)
    if (ids.length === 0) continue
    const { error } = await supabase.from("users").update({ role, organization_id: org.id }).in("id", ids)
    check(error, "assigning roles and organizations")
  }
}
check((await supabase.from("events").upsert(events)).error, "upserting events")
check((await supabase.from("volunteers").insert(volunteers)).error, "inserting volunteers")
check((await supabase.from("registrations").insert(registrations)).error, "inserting registrations")

// --- Report -------------------------------------------------------------------

const counts = {
  organizations: organizations.length,
  users: users.length,
  volunteers: volunteers.length,
  events: events.length,
  registrations: registrations.length,
}
console.log("Inserted:", counts)

const orgName = (id: string) => organizations.find((org) => org.id === id)?.name ?? ""
const statusOf = (userId: string) => volunteers.find((v) => v.user_id === userId)?.status ?? ""
console.log("\nSeed logins (dev only):")
console.table(
  users
    .filter((user) => activeOrgIds.includes(user.organization_id))
    .map((user) => ({
      email: user.email,
      role: user.role,
      status: user.role === "volunteer" ? statusOf(user.id) : "",
      organization: orgName(user.organization_id),
    })),
)
console.log(`${users.length - users.filter((u) => activeOrgIds.includes(u.organization_id)).length} more admin logins exist for the other organizations.`)
console.log(
  process.env.SEED_USER_PASSWORD
    ? "Password: the SEED_USER_PASSWORD value from your env file."
    : `Password for every seed login (generated this run): ${password}`,
)
