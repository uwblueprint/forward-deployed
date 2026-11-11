/**
 * Seeds the Supabase project in .env.local with generated demo data: `npm run db:seed`.
 * Server-only: SUPABASE_SECRET_KEY bypasses RLS, so never import this from app code.
 * Safe to re-run: rows have fixed IDs, so a re-run replaces only the seed's own data.
 * All logins use SEED_USER_PASSWORD, so re-runs never change the team's logins.
 */
import { createHash, randomBytes } from "node:crypto"
import { fakerEN_CA as faker } from "@faker-js/faker"
import { createClient } from "@supabase/supabase-js"
import type { AppRole, Shift, Weekday } from "@/lib/adapters/types"
import type { Database } from "@/lib/supabase/database.types"

// Earlier seeds made 10 organizations and 22 users; re-runs remove those too.
const OLD_SEED_ORGANIZATIONS = 10
const OLD_SEED_USERS = 22
const VOLUNTEER_COUNT = 10
const EVENT_COUNT = 10
const REGISTRATION_COUNT = 10
const INVITATION_COUNT = 10

const VOLUNTEER_STATUSES = ["approved", "approved", "approved", "pending", "rejected"] as const
const EVENT_STATUSES = ["published", "published", "draft", "completed", "cancelled"] as const
const WEEKDAYS: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
const SHIFTS: Shift[] = ["morning", "afternoon", "evening"]

const ORGANIZATION_KINDS = ["Community Food Bank", "Youth Mentorship Network", "Environmental Collective", "Seniors Outreach", "Literacy Council", "Animal Rescue"]
const EVENT_KINDS = [
  { category: "Food security", activity: "Food bank sorting shift" },
  { category: "Tutoring", activity: "After-school homework club" },
  { category: "Environment", activity: "Park cleanup" },
  { category: "Community outreach", activity: "Community dinner" },
  { category: "Fundraising", activity: "Charity fun run" },
  { category: "Seniors", activity: "Seniors tech help session" },
]
const REQUIREMENTS = ["No experience needed.", "Must be 16 or older.", "Closed-toe shoes required.", "Training provided on site."]
const SKILLS = ["First aid", "Driving", "Cooking", "Tutoring", "Event setup", "Translation", "Photography", "Social media"]
const RELATIONSHIPS = ["Parent", "Sibling", "Partner", "Friend", "Roommate"]
const REJECTION_MESSAGES = ["Availability does not match current programs.", "Missing required references.", "Under the minimum age for this program."]
const DEFAULT_REJECTION_MESSAGE = "Thanks for applying. We can't offer you a volunteer spot right now, but you're welcome to apply again."
const INTERNAL_NOTES = ["Great phone interview.", "References checked.", "Prefers weekend shifts.", "Follow up about availability.", "Asked about youth programs."]
const CUSTOM_FIELDS = [
  { entity_type: "application", field_name: "Why do you want to volunteer with us?", field_type: "textarea", required: true, options: [],
    sample: () => faker.helpers.arrayElement(["I want to give back to my community.", "A friend recommended it.", "I want to build experience."]) },
  { entity_type: "application", field_name: "Do you have a valid driver's licence?", field_type: "checkbox", required: false, options: [],
    sample: () => faker.datatype.boolean() },
  { entity_type: "application", field_name: "T-shirt size", field_type: "select", required: false, options: ["XS", "S", "M", "L", "XL"],
    sample: () => faker.helpers.arrayElement(["XS", "S", "M", "L", "XL"]) },
  { entity_type: "registration", field_name: "Dietary restrictions", field_type: "text", required: false, options: [],
    sample: () => faker.helpers.arrayElement(["None", "Vegetarian", "Gluten-free", "Nut allergy"]) },
  { entity_type: "registration", field_name: "Will you need a ride?", field_type: "checkbox", required: false, options: [],
    sample: () => faker.datatype.boolean() },
] as const

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
const password = process.env.SEED_USER_PASSWORD
if (!url || !secretKey || !password) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, or SEED_USER_PASSWORD. Copy .env.example to .env.local and fill them in.")
  process.exit(1)
}
if (!secretKey.startsWith("sb_secret_")) {
  console.error("SUPABASE_SECRET_KEY must be the secret key (sb_secret_...), not the publishable key.")
  process.exit(1)
}

const supabase = createClient<Database>(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
faker.seed(20261105)

function seedId(kind: string, index: number): string {
  const hex = createHash("sha256").update(`forward-deployed-seed:${kind}:${index}`).digest("hex")
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function check(error: { message: string } | null, step: string): void {
  if (error) {
    console.error(`Seed failed while ${step}: ${error.message}`)
    process.exit(1)
  }
}

const DAY_MS = 24 * 60 * 60 * 1000
const now = new Date()
const today = new Date()
today.setHours(0, 0, 0, 0)
const tomorrow = new Date(today.getTime() + DAY_MS) // upcoming events never start in the past

// --- Generate -----------------------------------------------------------------

// Single-organization mode (FOR-90): one organization per project.
const organization = {
  id: seedId("organization", 0),
  name: `${faker.location.city()} ${faker.helpers.arrayElement(ORGANIZATION_KINDS)}`,
  primary_color: faker.color.rgb({ format: "hex", casing: "lower" }),
  secondary_color: faker.color.rgb({ format: "hex", casing: "lower" }),
  default_rejection_message: DEFAULT_REJECTION_MESSAGE,
}

const users = [
  { role: "admin" as AppRole },
  { role: "manager" as AppRole },
  ...Array.from({ length: VOLUNTEER_COUNT }, () => ({ role: "volunteer" as AppRole })),
].map(({ role }, i) => {
  const first_name = faker.person.firstName()
  const last_name = faker.person.lastName()
  const slug = (s: string) => s.normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase()
  return { id: seedId("user", i), email: `${slug(first_name)}.${slug(last_name)}.${i}@example.com`, first_name, last_name, role }
})
const adminId = users.find((u) => u.role === "admin")!.id

const customFields = CUSTOM_FIELDS.map((field, f) => ({
  id: seedId("custom_field", f),
  organization_id: organization.id,
  entity_type: field.entity_type,
  field_name: field.field_name,
  field_type: field.field_type,
  required: field.required,
  options: [...field.options],
  position: f,
}))
const answersFor = (entityType: string) =>
  Object.fromEntries(
    customFields.filter((field) => field.entity_type === entityType).map((field) => [field.id, CUSTOM_FIELDS[field.position].sample()]),
  )

const volunteerUsers = users.filter((u) => u.role === "volunteer")
const volunteers = volunteerUsers.map((user, i) => ({
  id: seedId("volunteer", i),
  user_id: user.id,
  organization_id: organization.id,
  phone: faker.phone.number({ style: "national" }),
  location: `${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`,
  availability_days: faker.helpers.arrayElements(WEEKDAYS, { min: 1, max: 4 }).sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)),
  shift_preference: faker.helpers.arrayElement(SHIFTS),
  skills: faker.helpers.arrayElements(SKILLS, { min: 1, max: 3 }),
  emergency_contact_name: faker.person.fullName(),
  emergency_contact_phone: faker.phone.number({ style: "national" }),
  emergency_contact_relationship: faker.helpers.arrayElement(RELATIONSHIPS),
  consent_accepted_at: faker.date.recent({ days: 60, refDate: today }).toISOString(),
}))

const applications = volunteers.map((volunteer, i) => {
  const status = VOLUNTEER_STATUSES[i % VOLUNTEER_STATUSES.length]
  const submittedAt = new Date(volunteer.consent_accepted_at)
  return {
    id: seedId("application", i),
    volunteer_id: volunteer.id,
    status,
    responses: answersFor("application"),
    applicant_message: status === "rejected" ? faker.helpers.arrayElement(REJECTION_MESSAGES) : null,
    submitted_at: submittedAt.toISOString(),
    reviewed_by: status === "pending" ? null : adminId,
    reviewed_at: status === "pending" ? null : faker.date.between({ from: submittedAt, to: today }).toISOString(),
  }
})

const events = Array.from({ length: EVENT_COUNT }, (_, i) => {
  const status = EVENT_STATUSES[i % EVENT_STATUSES.length]
  const kind = faker.helpers.arrayElement(EVENT_KINDS)
  const startsAt = status === "completed" ? faker.date.recent({ days: 30, refDate: today }) : faker.date.soon({ days: 45, refDate: tomorrow })
  startsAt.setMinutes(0, 0, 0)
  const dayBefore = new Date(startsAt.getTime() - DAY_MS)
  return {
    id: seedId("event", i),
    organization_id: organization.id,
    status,
    title: `${kind.activity} on ${faker.location.street()}`,
    description: `${kind.activity} with ${organization.name}.`,
    category: kind.category,
    location: faker.location.streetAddress(),
    requirements: faker.helpers.arrayElement(REQUIREMENTS),
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + faker.number.int({ min: 2, max: 4 }) * 3_600_000).toISOString(),
    capacity: faker.helpers.arrayElement<number>([10, 15, 20, 25, 30]),
    // Registration closes a day before the start, unless that has already passed for an upcoming event.
    registration_deadline: status !== "completed" && dayBefore <= now ? null : dayBefore.toISOString(),
  }
})

// Approved volunteers, published or completed events, same org. Completed ones get attendance.
const pairs = applications
  .filter((a) => a.status === "approved")
  .flatMap((a) => {
    return events.filter((e) => e.status === "published" || e.status === "completed").map((event) => ({ volunteer_id: a.volunteer_id, event }))
  })
const registrations = faker.helpers.arrayElements(pairs, REGISTRATION_COUNT).map(({ volunteer_id, event }, i) => ({
  id: seedId("registration", i),
  event_id: event.id,
  volunteer_id,
  status: event.status === "published" && i % 5 === 4 ? ("cancelled" as const) : ("registered" as const),
  attendance_status: event.status === "completed" ? faker.helpers.arrayElement(["attended", "attended", "no_show"]) : null,
  custom_responses: answersFor("registration"),
}))

// One full event and one with registration closed, so the UI has both states to show.
const registeredCount = (eventId: string) => registrations.filter((r) => r.event_id === eventId && r.status === "registered").length
const fullEvent = events.find((e) => e.status === "published" && registeredCount(e.id) > 0)
if (fullEvent) fullEvent.capacity = registeredCount(fullEvent.id)
const closedEvent = events.find((e) => e.status === "published" && e !== fullEvent)
if (closedEvent) closedEvent.registration_deadline = new Date(today.getTime() - DAY_MS).toISOString()

// Keep new faker calls last so the seeded names and logins above stay stable.
const applicationNotes = applications.map((application) => ({
  application_id: application.id,
  internal_note: faker.helpers.arrayElement(INTERNAL_NOTES),
}))

// Open, expired, and revoked invitations for the admin screens. Their tokens
// are random and thrown away, so none can be redeemed.
const invitations = Array.from({ length: INVITATION_COUNT }, (_, i) => {
  const sentAt = faker.date.recent({ days: 5, refDate: today })
  const state = ["open", "open", "open", "expired", "revoked"][i % 5]
  return {
    id: seedId("invitation", i),
    organization_id: organization.id,
    email: `invitee.${i}@example.com`,
    role: (i === 0 ? "manager" : "volunteer") as AppRole,
    token_hash: createHash("sha256").update(randomBytes(32)).digest("hex"),
    issued_by: adminId,
    created_at: sentAt.toISOString(),
    expires_at: new Date(state === "expired" ? today.getTime() - DAY_MS : sentAt.getTime() + 7 * DAY_MS).toISOString(),
    revoked_at: state === "revoked" ? sentAt.toISOString() : null,
  }
})

// --- Write --------------------------------------------------------------------

console.log(`Seeding ${new URL(url).host} ...`)

// Deleting the previous runs' accounts cascades to their memberships, profiles, applications, and registrations.
const oldUserIds = Array.from({ length: Math.max(users.length, OLD_SEED_USERS) }, (_, i) => seedId("user", i))
for (const { error } of await Promise.all(oldUserIds.map((id) => supabase.auth.admin.deleteUser(id)))) {
  if (error && error.status !== 404) check(error, "deleting old seed users")
}
const oldOrganizationIds = Array.from({ length: OLD_SEED_ORGANIZATIONS - 1 }, (_, i) => seedId("organization", i + 1))
check((await supabase.from("organizations").delete().in("id", oldOrganizationIds)).error, "deleting old seed organizations")

check((await supabase.from("organizations").upsert(organization)).error, "upserting the organization")
const { count: organizationCount, error: countError } = await supabase.from("organizations").select("id", { count: "exact", head: true })
check(countError, "counting organizations")
if (organizationCount !== 1) {
  console.error(`This project has ${organizationCount} organizations. Single-organization mode needs exactly one, or signups fail. Remove the others first.`)
  process.exit(1)
}

const created = await Promise.all(
  users.map((user) =>
    supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { first_name: user.first_name, last_name: user.last_name },
    }),
  ),
)
for (const { error } of created) check(error, "creating seed users")

// Signing up made everyone a volunteer in the organization; roles are set here, server-side.
check(
  (await supabase.from("memberships").upsert(users.map(({ id, role }) => ({ user_id: id, organization_id: organization.id, role })), { onConflict: "user_id" })).error,
  "assigning roles",
)

check((await supabase.from("custom_fields").upsert(customFields)).error, "upserting custom fields")
check((await supabase.from("events").upsert(events)).error, "upserting events")
check((await supabase.from("volunteers").insert(volunteers)).error, "inserting volunteers")
check((await supabase.from("applications").insert(applications)).error, "inserting applications")
check((await supabase.from("application_notes").insert(applicationNotes)).error, "inserting application notes")
check((await supabase.from("registrations").insert(registrations)).error, "inserting registrations")
check((await supabase.from("invitations").upsert(invitations)).error, "upserting invitations")

// --- Report -------------------------------------------------------------------

console.log("Inserted:", {
  organizations: 1,
  users: users.length,
  memberships: users.length,
  volunteers: volunteers.length,
  applications: applications.length,
  application_notes: applicationNotes.length,
  events: events.length,
  registrations: registrations.length,
  invitations: invitations.length,
  custom_fields: customFields.length,
})
const statusOf = (userId: string) => applications[volunteers.findIndex((v) => v.user_id === userId)]?.status ?? ""
console.log("\nSeed logins (dev only):")
console.table(
  users.map((u) => ({ email: u.email, role: u.role, status: u.role === "volunteer" ? statusOf(u.id) : "" })),
)
console.log(`Organization: ${organization.name}`)
console.log("Password: SEED_USER_PASSWORD from your env file.")
