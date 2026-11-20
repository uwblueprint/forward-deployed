/**
 * True for a plain `{}`-style object - not an array, and not a Map, Set,
 * Date, or other class instance (those have a different prototype, so
 * `Object.getPrototypeOf` alone correctly excludes them along with arrays).
 * Used wherever a value is about to be stored as-is into a jsonb column:
 * `JSON.stringify(new Set([...]))` silently produces `"{}"`, so accepting
 * anything other than a true plain object there would lose data with no
 * validation error.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype
}
