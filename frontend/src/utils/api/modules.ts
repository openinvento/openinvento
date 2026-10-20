import { fetchData } from "./base"

const MODULES_CHANGED_EVENT = "openinvento:modules-changed"
let cachedModules: string[] | null = null
let pendingRequest: Promise<string[]> | null = null

export async function getEnabledModules(forceRefresh = false): Promise<string[]> {
  if (!forceRefresh && cachedModules) return cachedModules
  if (pendingRequest) return pendingRequest
  pendingRequest = fetchData<{ modules: string[] }>("/api/modules/")
    .then(({ modules }) => { cachedModules = modules; return modules })
    .finally(() => { pendingRequest = null })
  return pendingRequest
}

export function refreshEnabledModules() {
  cachedModules = null
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MODULES_CHANGED_EVENT))
}

export { MODULES_CHANGED_EVENT }
