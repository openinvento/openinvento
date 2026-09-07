type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

type RequestOptions = Omit<RequestInit, "body" | "method"> & {
  body?: unknown
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

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

async function ensureCsrfCookie() {
  await fetch(buildUrl("/api/csrf/"), {
    credentials: "include",
  })
}

async function request<T>(
  method: ApiMethod,
  path: string,
  options: RequestOptions = {}
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
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    method,
    credentials: "include",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const contentType = response.headers.get("content-type") ?? ""
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as Record<string, unknown>).error)
        : typeof payload === "string" && payload
          ? payload
          : `Request failed with status ${response.status}`

    throw new Error(message)
  }

  return payload as T
}

export async function fetchData<T>(path: string, options?: RequestOptions) {
  return request<T>("GET", path, options)
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

export async function deleteData<T>(path: string, body?: unknown, options?: RequestOptions) {
  return request<T>("DELETE", path, {
    ...options,
    body,
  })
}

export async function patchData<T>(path: string, body?: unknown, options?: RequestOptions) {
  return request<T>("PATCH", path, {
    ...options,
    body,
  })
}
