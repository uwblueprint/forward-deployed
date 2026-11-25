"use server"

import { getDashboardCounts } from "./dashboardCounts"
import type { DashboardCounts, DashboardCountsResult } from "./dashboardCounts"

/**
 * Server Action wrapper so a Client Component can call this directly. Not
 * wired into any component yet - see dashboardCounts.ts's doc comment.
 */
export async function getDashboardCountsAction(): Promise<DashboardCountsResult<DashboardCounts>> {
  return getDashboardCounts()
}
