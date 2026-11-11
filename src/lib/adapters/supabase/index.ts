import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { EventCreate, EventRepository, EventUpdate, VolunteerCreate, VolunteerRepository, VolunteerUpdate } from "../types"

/** Returns a client for the current request, e.g. createServerSupabaseClient. */
export type ClientFactory = () => Promise<SupabaseClient<Database>>

/** Volunteers through Supabase. RLS decides which rows the signed-in user can read or change. */
export class SupabaseVolunteerRepository implements VolunteerRepository {
  constructor(private readonly client: ClientFactory) {}

  async getAll() {
    const { data, error } = await (await this.client()).from("volunteers").select().order("created_at")
    if (error) throw error
    return data
  }

  async getById(id: string) {
    const { data, error } = await (await this.client()).from("volunteers").select().eq("id", id).maybeSingle()
    if (error) throw error
    return data
  }

  async create(input: VolunteerCreate) {
    const { data, error } = await (await this.client()).from("volunteers").insert(input).select().single()
    if (error) throw error
    return data
  }

  async update(id: string, input: VolunteerUpdate) {
    const { data, error } = await (await this.client()).from("volunteers").update(input).eq("id", id).select().single()
    if (error) throw error
    return data
  }
}

// registration_count is a computed column, so it has to be asked for by name.
const EVENT_COLUMNS = "*, registration_count"

/** Events through Supabase. RLS decides which rows the signed-in user can read or change. */
export class SupabaseEventRepository implements EventRepository {
  constructor(private readonly client: ClientFactory) {}

  async getAll() {
    const { data, error } = await (await this.client()).from("events").select(EVENT_COLUMNS).order("starts_at")
    if (error) throw error
    return data
  }

  async getById(id: string) {
    const { data, error } = await (await this.client()).from("events").select(EVENT_COLUMNS).eq("id", id).maybeSingle()
    if (error) throw error
    return data
  }

  async create(input: EventCreate) {
    const { data, error } = await (await this.client()).from("events").insert(input).select(EVENT_COLUMNS).single()
    if (error) throw error
    // The count can't see the row being inserted, so it comes back null; a new event has none.
    return { ...data, registration_count: data.registration_count ?? 0 }
  }

  async update(id: string, input: EventUpdate) {
    const { data, error } = await (await this.client()).from("events").update(input).eq("id", id).select(EVENT_COLUMNS).single()
    if (error) throw error
    return data
  }
}
