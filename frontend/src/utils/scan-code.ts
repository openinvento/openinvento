import {
  getSelectedInventoryUuid,
  inventoryApi,
  setSelectedInventory,
  type CodeLookupResult,
  type Shelf,
} from "@/utils/api/inventory"

// A label can contain a bare identifier or a scan URL: {APP_URL}/i/{inventory identifier}/{identifier}.

/**
 * Reads the inventory and entry from a scan URL, or returns null for anything else, which is then
 * treated as a bare identifier. The host is ignored on purpose: labels stay readable after the
 * instance moves, and the result is only ever looked up here. Scanning never navigates to that host.
 */
export function parseScanUrl(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null

  // /I/ as well: all-uppercase URLs make for smaller QR codes. Identifiers stay case-sensitive.
  const match = url.pathname.match(/^\/[iI]\/([^/]+)\/([^/]+)$/)
  if (!match) return null
  try {
    return { inventoryIdentifier: decodeURIComponent(match[1]), identifier: decodeURIComponent(match[2]) }
  } catch {
    return null // malformed percent-encoding
  }
}

export function lookupScannedCode(code: string, selectedInventory: string | null) {
  const target = parseScanUrl(code)
  return target
    ? inventoryApi.lookupCodeInInventory(target.identifier, target.inventoryIdentifier)
    : inventoryApi.lookupCode(code, selectedInventory ?? "")
}

/**
 * Selects the inventory of a found entry and returns the page that shows the entry, or null if
 * there is none. A code can belong to another inventory than the selected one, and entry pages only
 * load entries of the selected inventory, so it has to be selected first.
 * inventoryChanged tells the caller that an already mounted layout still shows the old inventory.
 */
export async function openInventoryOfEntry(result: CodeLookupResult) {
  const inventoryChanged = getSelectedInventoryUuid() !== result.inventory.uuid
  if (inventoryChanged) setSelectedInventory(result.inventory.uuid)

  const path = await getEntryPath(result)
  return path ? { path, inventoryChanged } : null
}

async function getEntryPath(result: CodeLookupResult) {
  switch (result.type) {
    case "article":
      return `/app/articles/${result.uuid}`
    case "area":
      return `/app/areas/${result.uuid}`
    case "shelf": {
      // Shelves have no page of their own, they are shown on the page of their area.
      const shelf = await inventoryApi.getEntry<Shelf>(result.uuid)
      return shelf ? `/app/areas/${shelf.area}` : null
    }
    case "box":
      return `/app/boxes/${result.uuid}`
    default:
      return null
  }
}
