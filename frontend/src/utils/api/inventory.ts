import { deleteData, fetchData, patchData, postData } from "./base"

export type Inventory = { uuid: string; name: string; identifier: string; updated_at: string }
export type Area = EntityBase
export type Shelf = EntityBase & { area: string }
export type Chest = EntityBase & { area: string; shelf: string | null; parent_chest: string | null }
export type Article = EntityBase & {
  description: string | null
  area: string | null
  shelf: string | null
  chest: string | null
  quantity: number
  stock_tracking: boolean
  image: string | null
  icon: string | null
  category: string | null
  custom_fields: Record<string, string | number | boolean | null>
  category_fields: CategoryField[]
}
export type CategoryField = EntityBase & { key: string; label: string; field_type: string; options: string[]; category: string | null }
export type ArticleCategory = EntityBase & { fields: CategoryField[]; category_fields?: CategoryField[] }
export type DashboardData = {
  counts: { areas: number; articles: number; categories: number }
  category_counts: Array<{ name: string; count: number }>
  last_added: Array<{ uuid: string; name: string; type: string; created_at: string }>
}

const SELECTED_INVENTORY_KEY = "selectedInventoryUuid"

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

type EntityPath = "areas" | "shelves" | "chests" | "articles" | "article-categories" | "category-fields"
type CreatePayload = Record<string, unknown>

export const inventoryApi = {
  getDashboard: () => fetchData<DashboardData>(scopedPath("/api/dashboard/")),
  listInventories: () => fetchData<Inventory[]>("/api/inventories/"),
  listAreas: () => fetchData<Area[]>(scopedPath("/api/areas/")),
  listShelves: () => fetchData<Shelf[]>(scopedPath("/api/shelves/")),
  listChests: () => fetchData<Chest[]>(scopedPath("/api/chests/")),
  listArticles: () => fetchData<Article[]>(scopedPath("/api/articles/")),
  listCategories: () => fetchData<ArticleCategory[]>(scopedPath("/api/article-categories/")),
  listCategoryFields: () => fetchData<CategoryField[]>(scopedPath("/api/category-fields/")),
  create: <T>(kind: EntityPath, payload: CreatePayload) => postData<T>(`/api/${kind}/`, payload),
  update: <T>(kind: EntityPath, uuid: string, payload: CreatePayload) =>
    patchData<T>(`/api/${kind}/${uuid}/`, payload),
  remove: (kind: EntityPath, uuid: string) => deleteData<void>(`/api/${kind}/${uuid}/`),
  searchInventory: (query: string, inventory: string) =>
    fetchData<Article[]>(`/api/search/?q=${encodeURIComponent(query)}&inventory=${encodeURIComponent(inventory)}`),
}

export type { EntityPath }
