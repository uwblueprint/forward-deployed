/**
 * A stand-in for a Supabase client's query builder in unit tests. Every
 * `from(table)` call is recorded with its chain (`select`, `eq`, `update`,
 * ...), and awaiting it (or `single`/`maybeSingle`) returns the next result
 * queued for `table.operation`, where the operation is insert, update, or
 * delete if one was called, else select.
 *
 * ```ts
 * const db = createQueryMock()
 * db.respond("custom_fields.update", { data: { id: "q1" }, error: null })
 * vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({ from: db.from, auth }) }))
 * ```
 */
export type QueryResult = { data: unknown; error: { code: string; message: string } | null }

export type RecordedQuery = { table: string; operation: string; chain: Array<[method: string, args: unknown[]]> }

const MUTATIONS = new Set(["insert", "update", "upsert", "delete"])

export function createQueryMock() {
  const queries: RecordedQuery[] = []
  const queued = new Map<string, QueryResult[]>()

  function next(query: RecordedQuery): Promise<QueryResult> {
    const key = `${query.table}.${query.operation}`
    const result = queued.get(key)?.shift()
    if (!result) return Promise.reject(new Error(`No result queued for ${key}`))
    return Promise.resolve(result)
  }

  function from(table: string): unknown {
    const query: RecordedQuery = { table, operation: "select", chain: [] }
    queries.push(query)

    const builder: unknown = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === "then") {
            return (onFulfilled?: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
              next(query).then(onFulfilled, onRejected)
          }
          if (property === "single" || property === "maybeSingle") {
            return () => next(query)
          }
          return (...args: unknown[]) => {
            const method = String(property)
            if (MUTATIONS.has(method)) query.operation = method
            query.chain.push([method, args])
            return builder
          }
        },
      }
    )
    return builder
  }

  return {
    from,
    queries,
    respond(key: string, ...results: QueryResult[]) {
      queued.set(key, [...(queued.get(key) ?? []), ...results])
    },
    reset() {
      queries.length = 0
      queued.clear()
    },
    /** The recorded queries for one table and operation, e.g. "custom_fields.update". */
    find(key: string) {
      return queries.filter((query) => `${query.table}.${query.operation}` === key)
    },
  }
}

/** The arguments of the first call to `method` in a recorded chain. */
export function argsOf(query: RecordedQuery | undefined, method: string): unknown[] | undefined {
  return query?.chain.find(([name]) => name === method)?.[1]
}
