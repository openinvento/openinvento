import { fetchData } from "./base"

const CACHE_KEY = "openinvento:enabled-modules:v1"
const CACHE_MAX_AGE_MS = 5 * 60 * 1000

type ModulesResponse = { modules: string[] }
type CachedModules = { modules: string[]; fetchedAt: number }

let memoryCache: CachedModules | null = null
let pendingRequest: Promise<string[]> | null = null

function readCache(): CachedModules | null {
  if (memoryCache) return memoryCache
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as CachedModules
    if (!Array.isArray(value.modules) || typeof value.fetchedAt !== "number") return null
    memoryCache = value
    return value
  } catch {
    return null
  }
}

export async function getEnabledModules(): Promise<string[]> {
  const cached = readCache()
  if (cached && Date.now() - cached.fetchedAt < CACHE_MAX_AGE_MS) return cached.modules
  if (pendingRequest) return pendingRequest

  pendingRequest = fetchData<ModulesResponse>("/api/modules/")
    .then(({ modules }) => {
      const value = { modules, fetchedAt: Date.now() }
      memoryCache = value
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)) } catch { /* Storage may be unavailable. */ }
      return modules
    })
    .catch((error) => {
      if (cached) return cached.modules
      throw error
    })
    .finally(() => { pendingRequest = null })

  return pendingRequest
}
