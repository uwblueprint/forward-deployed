import type { Json } from "@/lib/supabase/database.types"

// Fixed locale and zone so server and client render the same text. Same zone as the volunteer profile.
const dateFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Toronto" })

export function formatDate(iso: string | null): string {
  return iso ? dateFormat.format(new Date(iso)) : "—"
}

export function fullName(person: { first_name: string | null; last_name: string | null } | null): string {
  return [person?.first_name, person?.last_name].filter(Boolean).join(" ")
}

export function formatAnswer(answer: Json | null): string {
  if (answer === null || answer === "" || (Array.isArray(answer) && answer.length === 0)) return "No answer"
  if (typeof answer === "boolean") return answer ? "Yes" : "No"
  if (Array.isArray(answer)) return answer.map(String).join(", ")
  return String(answer)
}
