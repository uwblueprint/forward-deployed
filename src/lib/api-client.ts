const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api"

export class ApiError extends Error {
  readonly status: number
  readonly data: unknown

  constructor(status: number, message: string, data: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

export type RequestOptions = Omit<RequestInit, "body" | "method"> & {
  /** Serialized as JSON unless a FormData or string body is supplied. */
  body?: unknown
  /** Appended to the URL, skipping null and undefined values. */
  searchParams?: Record<string, string | number | boolean | null | undefined>
}

function buildUrl(path: string, searchParams: RequestOptions["searchParams"]) {
  const url = `${BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
  if (!searchParams) return url

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== null && value !== undefined) query.set(key, String(value))
  }

  const serialized = query.toString()
  return serialized ? `${url}?${serialized}` : url
}

async function request<T>(
  method: string,
  path: string,
  { body, searchParams, headers, ...init }: RequestOptions = {}
): Promise<T> {
  const isPlainBody = body instanceof FormData || typeof body === "string"

  const response = await fetch(buildUrl(path, searchParams), {
    ...init,
    method,
    headers: {
      ...(body !== undefined && !isPlainBody
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : isPlainBody
          ? (body as BodyInit)
          : JSON.stringify(body),
  })

  const text = await response.text()
  const payload = text ? safeParse(text) : null

  if (!response.ok) {
    throw new ApiError(
      response.status,
      resolveErrorMessage(payload) ?? response.statusText,
      payload
    )
  }

  return payload as T
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function resolveErrorMessage(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "message" in payload) {
    const { message } = payload as { message?: unknown }
    if (typeof message === "string") return message
  }
  return null
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, options),
  post: <T>(path: string, options?: RequestOptions) =>
    request<T>("POST", path, options),
  put: <T>(path: string, options?: RequestOptions) =>
    request<T>("PUT", path, options),
  patch: <T>(path: string, options?: RequestOptions) =>
    request<T>("PATCH", path, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, options),
}
