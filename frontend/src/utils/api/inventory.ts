import { deleteData, downloadFile, fetchData, patchData, postData } from "./base"

// type defintions

export type Inventory = {
  uuid: string
  name: string
  identifier: string
  updated_at: string
}

export type ThirdPartyProviderType = string

export type ThirdPartyProviderConfiguration = {
  provider: string
  type: ThirdPartyProviderType
  display_name: string
  type_label: string
  requires_api_key: boolean
  requires_model?: boolean
  default_model?: string
}

export type ThirdPartyProvider = {
  uuid: string
  inventory: string
  provider: string
  type: ThirdPartyProviderType
  name: string
  model_name: string
  has_api_key: boolean
  created_at: string
  updated_at: string
}

export type BarcodeProduct = {
  barcode: string
  name: string
  brand: string
  description: string
  image: string | null
  source: string
}

export type InventoryEntry = EntityBase & {
  type: "area" | "shelf" | "box" | "article"
  parent: string | null // parent entry uuid
  image: string | null
  description?: string | null
  quantity?: number
  stock_tracking?: boolean
  icon?: string | null
  category?: string | null
  field_values?: ArticleFieldValue[]
  category_fields?: CategoryField[]
}

export type Area = InventoryEntry & { type: "area" }
export type Shelf = InventoryEntry & { type: "shelf"; area: string }
export type Box = InventoryEntry & { type: "box"; area: string; shelf: string | null; parent_box: string | null }
export type Article = InventoryEntry & {
  type: "article"
  area: string | null
  shelf: string | null
  box: string | null
  description: string | null
  quantity: number
  stock_tracking: boolean
  icon: string | null
  category: string | null
  field_values: ArticleFieldValue[]
  category_fields: CategoryField[]
}

export type MagicArticleDraft = Pick<Article, "name" | "description" | "quantity" | "icon" | "area" | "shelf" | "box" | "category" | "stock_tracking">

export type SearchResult = (Article & { type: "article" }) | (Box & { type: "box" })

export type ArticleAttachment = {
  id: number
  original_name: string
  url: string
  size: number
  is_image: boolean
  created_at: string
}

export type ArticleFieldValue = {
  field: string
  key: string
  value: string | number | boolean | null
  notify_on_date: boolean
}

export type CategoryField = EntityBase & {
  key: string
  label: string
  field_type: string
  options: string[]
  category: string | null
}

export type ArticleCategory = EntityBase & { fields: CategoryField[]; category_fields?: CategoryField[] }

export type DashboardData = {
  counts: { areas: number; articles: number; categories: number }
  category_counts: Array<{ name: string; count: number }>
  last_added: Array<{ uuid: string; name: string; type: string; created_at: string }>
}

export type CodePdfOptions = {
  uuids: string[]
  code_type: "qr" | "barcode"
  size: "a4" | "a5" | "letter"
  layout: "horizontal" | "vertical"
}

export type CodeLookupResult = {
  uuid: string
  identifier: string
  name: string
  type: "article" | "area" | "shelf" | "box" | "category" | "field"
}

export type InventoryUser = {
  uuid: string
  username: string
  email?: string
  name: string
  is_superuser: boolean
  require_reset: boolean
}

export type InventoryMembership = {
  inventory: Inventory // inventory uuid
  members: InventoryUser[]
  available_users: InventoryUser[]
  can_invite: boolean
}

type EntityBase = {
  uuid: string
  identifier: string
  inventory: string
  name: string
  created_at: string
  updated_at: string
}

type EntityPath = "areas" | "shelves" | "boxes" | "articles" | "entries" | "article-categories" | "category-fields" // for API endpoints that don't have a specific type mapping
type CreatePayload = Record<string, unknown> | FormData
type EntryRecord = InventoryEntry
type EntryQuery = {
  type?: EntryRecord["type"]
  within?: string
  ids?: string[]
  includeAncestors?: boolean
}

const SELECTED_INVENTORY_KEY = "selectedInventoryUuid" // key for localStorage to store the selected inventory UUID
const entryPath = "/api/entries/"
const entryTypeForPath: Record<string, EntryRecord["type"]> = {
  areas: "area",
  shelves: "shelf",
  boxes: "box",
  articles: "article",
}


// functions

export function getSelectedInventory(inventories: Inventory[]) {
  const storedUuid = localStorage.getItem(SELECTED_INVENTORY_KEY)
  const selected = inventories.find((inventory) => inventory.uuid === storedUuid)
  const fallback = selected ?? inventories[0] ?? null
  if (fallback && fallback.uuid !== storedUuid) {
    localStorage.setItem(SELECTED_INVENTORY_KEY, fallback.uuid)
  }
  return fallback
}

export function setSelectedInventory(uuid: string) {
  localStorage.setItem(SELECTED_INVENTORY_KEY, uuid)
}

export function getSelectedInventoryUuid() {
  return localStorage.getItem(SELECTED_INVENTORY_KEY)
}

export function clearSelectedInventory() {
  localStorage.removeItem(SELECTED_INVENTORY_KEY)
}

function scopedPath(path: string) {
  const uuid = localStorage.getItem(SELECTED_INVENTORY_KEY)
  return uuid ? `${path}?inventory=${encodeURIComponent(uuid)}` : path
}

function toEntryPayload(kind: string, payload: CreatePayload) {
  const type = entryTypeForPath[kind]
  if (!type) return payload

  if (payload instanceof FormData) {
    const data = new FormData()
    payload.forEach((value, key) => {
      const isLocationField = ["area", "shelf", "box", "parent_box", "field_values"].includes(key)
      const isEmptyCategory = key === "category" && value === ""
      if (!isLocationField && !isEmptyCategory) data.append(key, value)
    })

    const parent = getParentValue(type, payload)
    data.append("type", type)
    if (parent !== null && parent !== "") data.append("parent", String(parent))

    const fieldValues = payload.get("field_values")
    if (fieldValues !== null) data.append("field_values_input", fieldValues)
    return data
  }

  const data = { ...payload }
  const parent = getParentValue(type, data)
  for (const key of ["area", "shelf", "box", "parent_box"]) delete data[key]
  if ("field_values" in data) {
    data.field_values_input = data.field_values
    delete data.field_values
  }
  return { ...data, type, ...(parent !== undefined ? { parent } : {}) }
}

function getParentValue(type: EntryRecord["type"], payload: FormData | Record<string, unknown>) {
  // Helper function to get the parent value of a key from either FormData or a plain object
  const getValue = (key: string) => payload instanceof FormData ? payload.get(key) : payload[key]

  if (type === "shelf") return getValue("area")
  if (type === "box") return getValue("parent_box") || getValue("shelf") || getValue("area")
  if (type === "article") return getValue("box") || getValue("shelf") || getValue("area")
  return null
}

// API functions -> added params for backend requests
function entriesPath(query: EntryQuery = {}) {
  const params = new URLSearchParams()
  const inventory = localStorage.getItem(SELECTED_INVENTORY_KEY)
  if (inventory) params.set("inventory", inventory)
  if (query.type) params.set("type", query.type)
  if (query.within) params.set("within", query.within)
  if (query.ids?.length) params.set("ids", query.ids.join(","))
  if (query.includeAncestors) params.set("include_ancestors", "true")
  return `${entryPath}?${params.toString()}`
}

function mapEntryLocations(all: EntryRecord[]) {
  const byId = new Map(all.map((entry) => [entry.uuid, entry]))
  const legacy = (entry: EntryRecord) => {
    let node = entry.parent ? byId.get(entry.parent) : undefined
    const ancestry: EntryRecord[] = []
    const visited = new Set<string>()
    while (node && !visited.has(node.uuid)) {
      ancestry.push(node); visited.add(node.uuid)
      node = node.parent ? byId.get(node.parent) : undefined
    }
    const area = ancestry.find((item) => item.type === "area")?.uuid ?? (entry.type === "shelf" ? entry.parent : null)
    const shelf = ancestry.find((item) => item.type === "shelf")?.uuid ?? null
    const box = ancestry.find((item) => item.type === "box")?.uuid ?? null
    return { ...entry, area, shelf, box, parent_box: entry.type === "box" && ancestry[0]?.type === "box" ? ancestry[0].uuid : null }
  }
  return all.map(legacy)
}

async function listEntries(query: EntryQuery = {}) {
  const entries = await fetchData<EntryRecord[]>(entriesPath(query))
  return mapEntryLocations(entries)
}

async function listEntryType<T>(type: EntryRecord["type"], query: Omit<EntryQuery, "type"> = {}): Promise<T[]> {
  const needsAncestors = type === "box" || type === "article"
  const entries = await listEntries({ ...query, type, includeAncestors: needsAncestors })
  return entries.filter((entry) => entry.type === type) as T[]
}

async function getEntry<T>(uuid: string): Promise<T | null> {
  const entries = await listEntries({ ids: [uuid], includeAncestors: true })
  return (entries.find((entry) => entry.uuid === uuid) as T | undefined) ?? null
}

function entryEndpoint(kind: string) { return entryTypeForPath[kind] ? entryPath : `/api/${kind}/` }

export const inventoryApi = {
  addMember: (inventory: string, userUuid: string) =>
    postData<InventoryUser>(`/api/inventories/${inventory}/members/`, { user_uuid: userUuid }),
  create: async <T>(kind: EntityPath, payload: CreatePayload) => {
    const result = await postData<EntryRecord>(entryEndpoint(kind), toEntryPayload(kind, payload))
    return entryTypeForPath[kind] ? (await getEntry<T>(result.uuid) ?? result as T) : result as T
  },
  createThirdPartyProvider: (payload: {
    inventory: string
    provider: string
    type: ThirdPartyProviderType
    name: string
    api_key?: string
    model_name?: string
  }) => postData<ThirdPartyProvider>("/api/third-party-providers/", payload),
  deleteInventory: (inventory: string) =>
    deleteData<void>(`/api/inventories/${inventory}/`),
  deleteThirdPartyProvider: (uuid: string) =>
    deleteData<void>(`/api/third-party-providers/${uuid}/`),
  exportInventoryCsv: (inventory: string) =>
    downloadFile(`/api/inventories/${inventory}/export/`, `inventory-${inventory}-csv-export.zip`),
  generateCodesPdf: (options: CodePdfOptions) =>
    postData<Blob>("/api/codes/pdf/", options),
  getDashboard: () => fetchData<DashboardData>(scopedPath("/api/dashboard/")),
  getEntry: <T>(uuid: string) => getEntry<T>(uuid),
  getMembership: (inventory: string) =>
    fetchData<InventoryMembership>(`/api/inventories/${inventory}/members/`),
  listArticleAttachments: (entry: string) =>
    fetchData<ArticleAttachment[]>(`/api/article-attachments/?entry=${encodeURIComponent(entry)}`),
  listArticles: (query?: Omit<EntryQuery, "type">) =>
    listEntryType<Article>("article", query),
  listAreas: (query?: Omit<EntryQuery, "type">) =>
    listEntryType<Area>("area", query),
  listBoxes: (query?: Omit<EntryQuery, "type">) =>
    listEntryType<Box>("box", query),
  listCategories: () =>
    fetchData<ArticleCategory[]>(scopedPath("/api/article-categories/")),
  listCategoryFields: () =>
    fetchData<CategoryField[]>(scopedPath("/api/category-fields/")),
  listEntries,
  listInventories: () => fetchData<Inventory[]>("/api/inventories/"),
  listShelves: (query?: Omit<EntryQuery, "type">) =>
    listEntryType<Shelf>("shelf", query),
  listThirdPartyProviderConfigurations: () =>
    fetchData<ThirdPartyProviderConfiguration[]>("/api/third-party-providers/configurations/"),
  listThirdPartyProviders: (inventory: string) =>
    fetchData<ThirdPartyProvider[]>(`/api/third-party-providers/?inventory=${encodeURIComponent(inventory)}`),
  lookupBarcodeProduct: (barcode: string, inventory: string, provider: string | null) =>
    postData<BarcodeProduct>("/api/barcodes/lookup/", { barcode, inventory, provider }),
  lookupCode: (identifier: string) =>
    postData<CodeLookupResult>("/api/codes/lookup/", { identifier }),
  magicImport: (inventory: string, image: File, provider: string | null) => {
    const payload = new FormData()
    payload.append("inventory", inventory)
    payload.append("image", image)
    if (provider) payload.append("provider", provider)
    return postData<{ articles: MagicArticleDraft[] }>("/api/entries/magic-import/", payload)
  },
  remove: (kind: EntityPath, uuid: string, payload?: Record<string, unknown>) =>
    deleteData<void>(`${entryEndpoint(kind)}${uuid}/`, payload),
  removeArticleAttachment: (id: number) =>
    deleteData<void>(`/api/article-attachments/?id=${id}`),
  removeMember: (inventory: string, userUuid: string) =>
    deleteData<void>(`/api/inventories/${inventory}/members/${userUuid}/`),
  searchInventory: (query: string, inventory: string) =>
    fetchData<SearchResult[]>(`/api/search/?q=${encodeURIComponent(query)}&inventory=${encodeURIComponent(inventory)}`),
  update: async <T>(kind: EntityPath, uuid: string, payload: CreatePayload) => {
    const result = await patchData<EntryRecord>(`${entryEndpoint(kind)}${uuid}/`, toEntryPayload(kind, payload))
    return entryTypeForPath[kind] ? (await getEntry<T>(result.uuid) ?? result as T) : result as T
  },
  updateInventory: (inventory: string, name: string) =>
    patchData<Inventory>(`/api/inventories/${inventory}/`, { name }),
  updateThirdPartyProvider: (uuid: string, payload: { name?: string; api_key?: string }) =>
    patchData<ThirdPartyProvider>(`/api/third-party-providers/${uuid}/`, payload),
  uploadArticleAttachment: (entry: string, file: File) => {
    const payload = new FormData()
    payload.append("file", file)
    return postData<ArticleAttachment>(`/api/article-attachments/?entry=${encodeURIComponent(entry)}`, payload)
  },
}

export type { EntityPath }
