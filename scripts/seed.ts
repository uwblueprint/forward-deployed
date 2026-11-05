/**
 * Seeds the Supabase project in .env.local with generated demo data: `npm run db:seed`.
 * Server-only: SUPABASE_SECRET_KEY bypasses RLS, so never import this from app code.
 * Safe to re-run: rows have fixed IDs, so a re-run replaces only the seed's own data.
 * All logins share SEED_USER_PASSWORD, or a random password printed at the end.
 */
import { createHash, randomBytes } from "node:crypto"
import { fakerEN_CA as faker } from "@faker-js/faker"
import { createClient } from "@supabase/supabase-js"

const ORGANIZATION_COUNT = 10
const ACTIVE_ORGANIZATION_COUNT = 2 // volunteers, events, and custom fields go in the first two orgs
const VOLUNTEER_COUNT = 10
const EVENT_COUNT = 10
const REGISTRATION_COUNT = 10

const VOLUNTEER_STATUSES = ["approved", "approved", "approved", "pending", "rejected"] as const
const EVENT_STATUSES = ["published", "published", "draft", "completed", "cancelled"] as const
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
const SHIFTS = ["morning", "afternoon", "evening"]

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
const REJECTION_REASONS = ["Availability does not match current programs.", "Missing required references.", "Under the minimum age for this program."]
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
if (!url || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env.local and fill them in.")
  process.exit(1)
}
if (!secretKey.startsWith("sb_secret_")) {
  console.error("SUPABASE_SECRET_KEY must be the secret key (sb_secret_...), not the publishable key.")
  process.exit(1)
}

const password = process.env.SEED_USER_PASSWORD || randomBytes(12).toString("base64url")
const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
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

const today = new Date()
today.setHours(0, 0, 0, 0)
const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000) // upcoming events never start in the past

// --- Generate -----------------------------------------------------------------

const organizations = Array.from({ length: ORGANIZATION_COUNT }, (_, i) => ({
  id: seedId("organization", i),
  name: `${faker.location.city()} ${faker.helpers.arrayElement(ORGANIZATION_KINDS)}`,
  primary_color: faker.color.rgb({ format: "hex", casing: "lower" }),
  secondary_color: faker.color.rgb({ format: "hex", casing: "lower" }),
}))
const activeOrgs = organizations.slice(0, ACTIVE_ORGANIZATION_COUNT)
const isActive = (orgId: string) => activeOrgs.some((org) => org.id === orgId)

type Role = "admin" | "manager" | "volunteer"
const users = [
  ...organizations.map((org) => ({ org, role: "admin" as Role })),
  ...activeOrgs.map((org) => ({ org, role: "manager" as Role })),
  ...Array.from({ length: VOLUNTEER_COUNT }, (_, i) => ({ org: activeOrgs[i % ACTIVE_ORGANIZATION_COUNT], role: "volunteer" as Role })),
].map(({ org, role }, i) => {
  const first_name = faker.person.firstName()
  const last_name = faker.person.lastName()
  const slug = (s: string) => s.normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase()
  return { id: seedId("user", i), email: `${slug(first_name)}.${slug(last_name)}.${i}@example.com`, first_name, last_name, role, organization_id: org.id }
})
const adminOf = (orgId: string) => users.find((u) => u.role === "admin" && u.organization_id === orgId)!.id

const customFields = activeOrgs.flatMap((org, o) =>
  CUSTOM_FIELDS.map((field, f) => ({
    id: seedId("custom_field", o * CUSTOM_FIELDS.length + f),
    organization_id: org.id,
    entity_type: field.entity_type,
    field_name: field.field_name,
    field_type: field.field_type,
    required: field.required,
    options: field.options,
    position: f,
  })),
)
const answersFor = (orgId: string, entityType: string) =>
  Object.fromEntries(
    customFields
      .filter((field) => field.organization_id === orgId && field.entity_type === entityType)
      .map((field) => [field.id, CUSTOM_FIELDS[field.position].sample()]),
  )

const volunteerUsers = users.filter((u) => u.role === "volunteer")
const volunteers = volunteerUsers.map((user, i) => ({
  id: seedId("volunteer", i),
  user_id: user.id,
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
  const user = volunteerUsers[i]
  const status = VOLUNTEER_STATUSES[Math.floor(i / ACTIVE_ORGANIZATION_COUNT) % VOLUNTEER_STATUSES.length]
  const submittedAt = new Date(volunteer.consent_accepted_at)
  return {
    id: seedId("application", i),
    volunteer_id: volunteer.id,
    status,
    responses: answersFor(user.organization_id, "application"),
    rejection_reason: status === "rejected" ? faker.helpers.arrayElement(REJECTION_REASONS) : null,
    submitted_at: submittedAt.toISOString(),
    reviewed_by: status === "pending" ? null : adminOf(user.organization_id),
    reviewed_at: status === "pending" ? null : faker.date.between({ from: submittedAt, to: today }).toISOString(),
  }
})

const events = Array.from({ length: EVENT_COUNT }, (_, i) => {
  const organizationId = activeOrgs[i % ACTIVE_ORGANIZATION_COUNT].id
  const status = EVENT_STATUSES[Math.floor(i / ACTIVE_ORGANIZATION_COUNT) % EVENT_STATUSES.length]
  const kind = faker.helpers.arrayElement(EVENT_KINDS)
  const startsAt = status === "completed" ? faker.date.recent({ days: 30, refDate: today }) : faker.date.soon({ days: 45, refDate: tomorrow })
  startsAt.setMinutes(0, 0, 0)
  return {
    id: seedId("event", i),
    organization_id: organizationId,
    status,
    title: `${kind.activity} on ${faker.location.street()}`,
    description: `${kind.activity} with ${organizations.find((org) => org.id === organizationId)!.name}.`,
    category: kind.category,
    location: faker.location.streetAddress(),
    requirements: faker.helpers.arrayElement(REQUIREMENTS),
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + faker.number.int({ min: 2, max: 4 }) * 3_600_000).toISOString(),
    capacity: faker.helpers.arrayElement([10, 15, 20, 25, 30]),
  }
})

// Approved volunteers, published or completed events, same org. Completed ones get attendance.
const pairs = applications
  .filter((a) => a.status === "approved")
  .flatMap((a) => {
    const orgId = volunteerUsers[volunteers.findIndex((v) => v.id === a.volunteer_id)].organization_id
    return events.filter((e) => e.organization_id === orgId && (e.status === "published" || e.status === "completed")).map((event) => ({ volunteer_id: a.volunteer_id, event, orgId }))
  })
const registrations = faker.helpers.arrayElements(pairs, REGISTRATION_COUNT).map(({ volunteer_id, event, orgId }, i) => ({
  id: seedId("registration", i),
  event_id: event.id,
  volunteer_id,
  status: event.status === "published" && i % 5 === 4 ? "cancelled" : "registered",
  attendance_status: event.status === "completed" ? faker.helpers.arrayElement(["attended", "attended", "no_show"]) : null,
  custom_responses: answersFor(orgId, "registration"),
}))

// --- Write --------------------------------------------------------------------

console.log(`Seeding ${new URL(url).host} ...`)

// Deleting the previous run's accounts cascades to their profiles, applications, and registrations.
for (const user of users) {
  const { error } = await supabase.auth.admin.deleteUser(user.id)
  if (error && error.status !== 404) check(error, `deleting seed user ${user.email}`)
}

check((await supabase.from("organizations").upsert(organizations)).error, "upserting organizations")

for (const user of users) {
  const { error } = await supabase.auth.admin.createUser({
    id: user.id,
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { first_name: user.first_name, last_name: user.last_name },
  })
  check(error, `creating auth user ${user.email}`)
}

// Role and organization are set here, server-side, never from signup data.
for (const org of organizations) {
  for (const role of ["admin", "manager", "volunteer"] as const) {
    const ids = users.filter((u) => u.organization_id === org.id && u.role === role).map((u) => u.id)
    if (ids.length) check((await supabase.from("users").update({ role, organization_id: org.id }).in("id", ids)).error, "assigning roles")
  }
}

check((await supabase.from("custom_fields").upsert(customFields)).error, "upserting custom fields")
check((await supabase.from("events").upsert(events)).error, "upserting events")
check((await supabase.from("volunteers").insert(volunteers)).error, "inserting volunteers")
check((await supabase.from("applications").insert(applications)).error, "inserting applications")
check((await supabase.from("registrations").insert(registrations)).error, "inserting registrations")

// --- Report -------------------------------------------------------------------

console.log("Inserted:", {
  organizations: organizations.length,
  users: users.length,
  volunteers: volunteers.length,
  applications: applications.length,
  events: events.length,
  registrations: registrations.length,
  custom_fields: customFields.length,
})
const statusOf = (userId: string) => applications[volunteers.findIndex((v) => v.user_id === userId)]?.status ?? ""
console.log("\nSeed logins (dev only):")
console.table(
  users.filter((u) => isActive(u.organization_id)).map((u) => ({
    email: u.email,
    role: u.role,
    status: u.role === "volunteer" ? statusOf(u.id) : "",
    organization: organizations.find((org) => org.id === u.organization_id)!.name,
  })),
)
console.log(`Plus ${ORGANIZATION_COUNT - ACTIVE_ORGANIZATION_COUNT} admin logins for the other organizations.`)
console.log(process.env.SEED_USER_PASSWORD ? "Password: SEED_USER_PASSWORD from your env file." : `Password for every seed login: ${password}`)
