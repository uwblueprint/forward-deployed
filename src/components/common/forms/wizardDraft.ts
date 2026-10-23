const STORAGE_PREFIX = "wizard-draft:"

function storageKey(formId: string): string {
  return `${STORAGE_PREFIX}${formId}`
}

/**
 * Loads a previously saved draft for the given formId.
 *
 * Returns `undefined` when there is no draft, the stored value is not valid
 * JSON, or localStorage is unavailable (server rendering, private browsing
 * with storage disabled, etc.) — callers should treat that the same as "no
 * draft" rather than special-casing errors.
 */
export function loadDraft<T>(formId: string): T | undefined {
  if (typeof window === "undefined") return undefined

  try {
    const raw = window.localStorage.getItem(storageKey(formId))
    if (raw === null) return undefined
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

/**
 * Persists a draft for the given formId. Silently no-ops during server
 * rendering or when storage is unavailable (quota exceeded, disabled,
 * private browsing) rather than throwing and breaking the form.
 */
export function saveDraft<T>(formId: string, values: T): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(storageKey(formId), JSON.stringify(values))
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
