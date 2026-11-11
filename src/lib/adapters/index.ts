/**
 * The repositories the app reads and writes through. NEXT_PUBLIC_DATA_SOURCE=mock
 * serves the in-memory mocks; anything else serves Supabase. Server-only,
 * because the Supabase repositories use the request's cookies; client
 * components go through a Server Action or route handler.
 */
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { MockEventRepository, MockVolunteerRepository } from "./mock"
import { SupabaseEventRepository, SupabaseVolunteerRepository } from "./supabase"
import type { EventRepository, VolunteerRepository } from "./types"

export type * from "./types"

export const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE === "mock" ? "mock" : "supabase"

export const volunteerRepo: VolunteerRepository =
  dataSource === "mock" ? new MockVolunteerRepository() : new SupabaseVolunteerRepository(createServerSupabaseClient)

export const eventRepo: EventRepository =
  dataSource === "mock" ? new MockEventRepository() : new SupabaseEventRepository(createServerSupabaseClient)
