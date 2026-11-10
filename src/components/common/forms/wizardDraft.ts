const STORAGE_PREFIX = "wizard-draft:"

/**
 * How long a draft is trusted before loadDraft treats it as expired and
 * discards it. Onboarding drafts can hold personal data (phone, location,
 * emergency contact details) - letting them live in localStorage forever on
 * a shared or public machine is a real exposure for a volunteer who
 * abandons the form partway through. Recovering an in-progress draft is
 * still the point of this module; it just shouldn't outlive a day.
 */
const DEFAULT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000

interface StoredDraft<T> {
  savedAt: number
  values: T
}

function storageKey(formId: string): string {
  return `${STORAGE_PREFIX}${formId}`
}

function isStoredDraft(value: unknown): value is StoredDraft<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "savedAt" in value &&
    typeof (value as { savedAt: unknown }).savedAt === "number" &&
    "values" in value
  )
}

/**
 * Loads a previously saved draft for the given formId.
 *
 * Returns `undefined` when there is no draft, the stored value is not valid
 * JSON, the draft is older than `ttlMs` (default 24h - see
 * DEFAULT_DRAFT_TTL_MS), or localStorage is unavailable (server rendering,
 * private browsing with storage disabled, etc.) — callers should treat all
 * of these the same as "no draft" rather than special-casing them. An
 * expired draft is also actively cleared, so it doesn't linger even if this
 * formId is never loaded again.
 */
export function loadDraft<T>(formId: string, ttlMs: number = DEFAULT_DRAFT_TTL_MS): T | undefined {
  if (typeof window === "undefined") return undefined

  try {
    const raw = window.localStorage.getItem(storageKey(formId))
    if (raw === null) return undefined

    const parsed: unknown = JSON.parse(raw)
    if (!isStoredDraft(parsed)) return undefined

    if (Date.now() - parsed.savedAt > ttlMs) {
      clearDraft(formId)
      return undefined
    }

    return parsed.values as T
  } catch {
    return undefined
  }
}

/**
 * Persists a draft for the given formId, stamped with the current time so
 * loadDraft can expire it later. Silently no-ops during server rendering or
 * when storage is unavailable (quota exceeded, disabled, private browsing)
 * rather than throwing and breaking the form.
 */
export function saveDraft<T>(formId: string, values: T): void {
  if (typeof window === "undefined") return

  try {
    const record: StoredDraft<T> = { savedAt: Date.now(), values }
    window.localStorage.setItem(storageKey(formId), JSON.stringify(record))
  } catch {
    // Best-effort persistence; losing the draft is preferable to crashing the form.
  }
}

/** Removes a saved draft for the given formId, e.g. after a successful submit. */
export function clearDraft(formId: string): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(storageKey(formId))
  } catch {
    // Best-effort; nothing to recover from here.
  }
}
