import { deleteData, downloadFile, fetchData, patchData, postData } from "./base"

export type Inventory = { uuid: string; name: string; identifier: string; updated_at: string }
export type ThirdPartyProviderType = string
export type ThirdPartyProviderConfiguration = { provider: string; type: ThirdPartyProviderType; display_name: string; type_label: string; requires_api_key: boolean; requires_model?: boolean; requires_api_url?: boolean; default_model?: string }
export type ThirdPartyProvider = { uuid: string; inventory: string; provider: string; type: ThirdPartyProviderType; name: string; model_name: string; api_url: string; has_api_key: boolean; created_at: string; updated_at: string }
export type BarcodeProduct = { barcode: string; name: string; brand: string; description: string; image: string | null; source: string }
export type Area = EntityBase
export type Shelf = EntityBase & { area: string }
export type Box = EntityBase & { area: string; shelf: string | null; parent_box: string | null }
export type Article = EntityBase & {
  description: string | null
  area: string | null
  shelf: string | null
  box: string | null
  quantity: number
  stock_tracking: boolean
  image: string | null
  icon: string | null
  category: string | null
  field_values: ArticleFieldValue[]
  category_fields: CategoryField[]
}
export type MagicArticleDraft = Pick<Article, "name" | "description" | "quantity" | "icon" | "area" | "shelf" | "box" | "category" | "stock_tracking">
export type SearchResult = (Article & { type: "article" }) | (Box & { type: "box" })
export type ArticleAttachment = { id: number; original_name: string; url: string; size: number; is_image: boolean; created_at: string }
export type ArticleFieldValue = { field: string; key: string; value: string | number | boolean | null; notify_on_date: boolean }
export type CategoryField = EntityBase & { key: string; label: string; field_type: string; options: string[]; category: string | null }
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

const SELECTED_INVENTORY_KEY = "selectedInventoryUuid"

export type InventoryUser = {
  uuid: string
  username: string
  email?: string
  name: string
  is_superuser: boolean
  require_reset: boolean
}

export type InventoryMembership = {
  inventory: Inventory
  members: InventoryUser[]
  available_users: InventoryUser[]
  can_invite: boolean
}

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

type EntityBase = {
  uuid: string
  identifier: string
  inventory: string
  name: string
  created_at: string
  updated_at: string
}

type EntityPath = "areas" | "shelves" | "boxes" | "articles" | "article-categories" | "category-fields"
type CreatePayload = Record<string, unknown> | FormData

export const inventoryApi = {
  getDashboard: () => fetchData<DashboardData>(scopedPath("/api/dashboard/")),
  listInventories: () => fetchData<Inventory[]>("/api/inventories/"),
  listThirdPartyProviders: (inventory: string) => fetchData<ThirdPartyProvider[]>(`/api/third-party-providers/?inventory=${encodeURIComponent(inventory)}`),
  listThirdPartyProviderConfigurations: () => fetchData<ThirdPartyProviderConfiguration[]>("/api/third-party-providers/configurations/"),
  createThirdPartyProvider: (payload: { inventory: string; provider: string; type: ThirdPartyProviderType; name: string; api_key?: string; model_name?: string; api_url?: string }) => postData<ThirdPartyProvider>("/api/third-party-providers/", payload),
  updateThirdPartyProvider: (uuid: string, payload: { name?: string; api_key?: string }) => patchData<ThirdPartyProvider>(`/api/third-party-providers/${uuid}/`, payload),
  deleteThirdPartyProvider: (uuid: string) => deleteData<void>(`/api/third-party-providers/${uuid}/`),
  listAreas: () => fetchData<Area[]>(scopedPath("/api/areas/")),
  listShelves: () => fetchData<Shelf[]>(scopedPath("/api/shelves/")),
  listBoxes: () => fetchData<Box[]>(scopedPath("/api/boxes/")),
  listArticles: () => fetchData<Article[]>(scopedPath("/api/articles/")),
  listArticleAttachments: (article: string) => fetchData<ArticleAttachment[]>(`/api/article-attachments/?article=${encodeURIComponent(article)}`),
  uploadArticleAttachment: (article: string, file: File) => {
    const payload = new FormData()
    payload.append("file", file)
    return postData<ArticleAttachment>(`/api/article-attachments/?article=${encodeURIComponent(article)}`, payload)
  },
  removeArticleAttachment: (id: number) => deleteData<void>(`/api/article-attachments/?id=${id}`),
  listCategories: () => fetchData<ArticleCategory[]>(scopedPath("/api/article-categories/")),
  listCategoryFields: () => fetchData<CategoryField[]>(scopedPath("/api/category-fields/")),
  create: <T>(kind: EntityPath, payload: CreatePayload) => postData<T>(`/api/${kind}/`, payload),
  magicImport: (inventory: string, image: File, provider: string | null) => {
    const payload = new FormData()
    payload.append("inventory", inventory)
    payload.append("image", image)
    if (provider) payload.append("provider", provider)
    return postData<{ articles: MagicArticleDraft[] }>("/api/articles/magic-import/", payload)
  },
  update: <T>(kind: EntityPath, uuid: string, payload: CreatePayload) =>
    patchData<T>(`/api/${kind}/${uuid}/`, payload),
  remove: (kind: EntityPath, uuid: string) => deleteData<void>(`/api/${kind}/${uuid}/`),
  searchInventory: (query: string, inventory: string) =>
    fetchData<SearchResult[]>(`/api/search/?q=${encodeURIComponent(query)}&inventory=${encodeURIComponent(inventory)}`),
  lookupCode: (identifier: string) =>
    postData<CodeLookupResult>("/api/codes/lookup/", { identifier }),
  lookupBarcodeProduct: (barcode: string, inventory: string, provider: string | null) =>
    postData<BarcodeProduct>("/api/barcodes/lookup/", { barcode, inventory, provider }),
  updateInventory: (inventory: string, name: string) =>
    patchData<Inventory>(`/api/inventories/${inventory}/`, { name }),
  exportInventoryCsv: (inventory: string) =>
    downloadFile(`/api/inventories/${inventory}/export/`, `inventory-${inventory}-csv-export.zip`),
  getMembership: (inventory: string) =>
    fetchData<InventoryMembership>(`/api/inventories/${inventory}/members/`),
  addMember: (inventory: string, userUuid: string) =>
    postData<InventoryUser>(`/api/inventories/${inventory}/members/`, { user_uuid: userUuid }),
  removeMember: (inventory: string, userUuid: string) =>
    deleteData<void>(`/api/inventories/${inventory}/members/${userUuid}/`),
  deleteInventory: (inventory: string) =>
    deleteData<void>(`/api/inventories/${inventory}/`),
  generateCodesPdf: (options: CodePdfOptions) =>
    postData<Blob>("/api/codes/pdf/", options),
}

export type { EntityPath }
