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
  minimum_quantity: number | null
  image: string | null
  icon: string | null
  category: string | null
  custom_fields: Record<string, string | number | boolean | null>
  category_fields: CategoryField[]
}
export type CategoryField = EntityBase & { key: string; label: string; field_type: string; category: string | null }
export type ArticleCategory = EntityBase & { fields: CategoryField[]; category_fields?: CategoryField[] }

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
  listInventories: () => fetchData<Inventory[]>("/api/inventories/"),
  listAreas: () => fetchData<Area[]>("/api/areas/"),
  listShelves: () => fetchData<Shelf[]>("/api/shelves/"),
  listChests: () => fetchData<Chest[]>("/api/chests/"),
  listArticles: () => fetchData<Article[]>("/api/articles/"),
  listCategories: () => fetchData<ArticleCategory[]>("/api/article-categories/"),
  listCategoryFields: () => fetchData<CategoryField[]>("/api/category-fields/"),
  create: <T>(kind: EntityPath, payload: CreatePayload) => postData<T>(`/api/${kind}/`, payload),
  update: <T>(kind: EntityPath, uuid: string, payload: CreatePayload) =>
    patchData<T>(`/api/${kind}/${uuid}/`, payload),
  remove: (kind: EntityPath, uuid: string) => deleteData<void>(`/api/${kind}/${uuid}/`),
  searchInventory: (query: string, inventory: string) =>
    fetchData<Article[]>(`/api/search/?q=${encodeURIComponent(query)}&inventory=${encodeURIComponent(inventory)}`),
}

export type { EntityPath }
