type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

type RequestOptions = Omit<RequestInit, "body" | "method"> & {
  body?: unknown
}

export class ApiError extends Error {
  readonly payload: unknown;
  readonly status: number;

  constructor(
    message: string,
    payload: unknown,
    status: number,
  ) {
    super(message);
    this.name = "ApiError";
    
    this.payload = payload;
    this.status = status;
  }
}


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""
const CSRF_ERROR_MESSAGE = "Your session expired. Please refresh the page and try again."
const CSRF_ORIGIN_ERROR_PREFIX = "CSRF configuration error: this origin is not trusted by the backend."

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "")
}

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const baseUrl = normalizeBaseUrl(API_BASE_URL)

  if (!baseUrl) {
    return normalizedPath
  }

  return `${baseUrl}${normalizedPath}`
}

export function getApiUrl(path: string) {
  return buildUrl(path)
}

export function getMediaUrl(path: string | null | undefined) {
  if (!path) return null
  return buildUrl(path)
}

function getCookie(name: string) {
  if (typeof document === "undefined") {
    return null
  }

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))

  if (!cookie) {
    return null
  }

  return decodeURIComponent(cookie.slice(name.length + 1))
}

function isCsrfRejection(status: number, payload: unknown) {
  if (status !== 403 || typeof payload !== "string") {
    return false
  }

  return /csrf verification failed|csrf cookie not set|csrf token/i.test(payload)
}

function getPayloadMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const record = payload as Record<string, unknown>
  return typeof record.error === "string"
    ? record.error
    : typeof record.detail === "string"
      ? record.detail
      : null
}

function getCsrfOriginErrorMessage(payload: unknown) {
  const detail = getPayloadMessage(payload)

  if (!detail || !/^csrf failed:\s*origin checking failed/i.test(detail)) {
    return null
  }

  return `${CSRF_ORIGIN_ERROR_PREFIX}\n\n${detail}\n\nAdd the frontend URL to the APP_URLS`
}

async function ensureCsrfCookie() {
  await fetch(buildUrl("/api/csrf/"), {
    credentials: "include",
  })
}

async function request<T>(
  method: ApiMethod,
  path: string,
  options: RequestOptions = {},
  csrfRetried = false,
): Promise<T> {
  const headers = new Headers(options.headers)

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = getCookie("csrftoken")

    if (!csrfToken) {
      await ensureCsrfCookie()
    }

    const refreshedToken = getCookie("csrftoken")
    if (!refreshedToken) {
      throw new Error("Unable to read the Django CSRF cookie.")
    }

    headers.set("X-CSRFToken", refreshedToken)
    if (!(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json")
    }
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    method,
    credentials: "include",
    headers,
    body: options.body === undefined || options.body instanceof FormData
      ? options.body as BodyInit | undefined
      : JSON.stringify(options.body),
  })

  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json")
    ? await response.json()
    : contentType.includes("application/pdf")
      ? await response.blob()
    : await response.text()

  if (isCsrfRejection(response.status, payload) && !csrfRetried) {
    await ensureCsrfCookie()
    return request<T>(method, path, options, true)
  }

  if (!response.ok) {
    const csrfOriginErrorMessage = getCsrfOriginErrorMessage(payload)
    const message = csrfOriginErrorMessage
      ?? (isCsrfRejection(response.status, payload)
        ? CSRF_ERROR_MESSAGE
        : getPayloadMessage(payload)
          ?? (typeof payload === "string" && payload
            ? payload
            : `Request failed with status ${response.status}`))

    if (csrfOriginErrorMessage && typeof window !== "undefined") {
      window.alert(csrfOriginErrorMessage)
    }

    throw new ApiError(message, payload, response.status)
  }

  return payload as T
}

export async function fetchData<T>(path: string, options?: RequestOptions) {
  return request<T>("GET", path, options)
}

// Filename from a Content-Disposition header, e.g. one with the date of a backup.
function getContentDispositionFilename(header: string | null) {
  const match = header?.match(/filename="([^"]+)"/)
  return match?.[1] ?? null
}

// The server's filename wins over the fallback filename.
export async function downloadFile(path: string, filename: string) {
  const response = await fetch(buildUrl(path), { credentials: "include" })
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? ""
    const payload = contentType.includes("application/json") ? await response.json() : await response.text()
    const message = getPayloadMessage(payload) ?? (typeof payload === "string" && payload ? payload : `Request failed with status ${response.status}`)
    throw new ApiError(message, payload, response.status)
  }

  const objectUrl = URL.createObjectURL(await response.blob())
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = getContentDispositionFilename(response.headers.get("content-disposition")) ?? filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

export async function postData<T>(path: string, body?: unknown, options?: RequestOptions) {
  return request<T>("POST", path, {
    ...options,
    body,
  })
}

export async function putData<T>(path: string, body?: unknown, options?: RequestOptions) {
  return request<T>("PUT", path, {
    ...options,
    body,
  })
}

export async function deleteData<T>(path: string, queryParams?: Record<string, unknown>, options?: RequestOptions) {
  const query = queryParams
    ? new URLSearchParams(
        Object.entries(queryParams).map(([key, value]) => [key, String(value)]),
      ).toString()
    : ""

  return request<T>("DELETE", path + (query ? `?${query}` : ""), options)
}

export async function patchData<T>(path: string, body?: unknown, options?: RequestOptions) {
  return request<T>("PATCH", path, {
    ...options,
    body,
  })
}
