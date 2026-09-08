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
}

type EntityBase = {
  uuid: string
  identifier: string
  inventory: string
  name: string
  created_at: string
  updated_at: string
}

type EntityPath = "areas" | "shelves" | "chests" | "articles"
type CreatePayload = Record<string, unknown>

export const inventoryApi = {
  listInventories: () => fetchData<Inventory[]>("/api/inventories/"),
  listAreas: () => fetchData<Area[]>("/api/areas/"),
  listShelves: () => fetchData<Shelf[]>("/api/shelves/"),
  listChests: () => fetchData<Chest[]>("/api/chests/"),
  listArticles: () => fetchData<Article[]>("/api/articles/"),
  create: <T>(kind: EntityPath, payload: CreatePayload) => postData<T>(`/api/${kind}/`, payload),
  update: <T>(kind: EntityPath, uuid: string, payload: CreatePayload) =>
    patchData<T>(`/api/${kind}/${uuid}/`, payload),
  remove: (kind: EntityPath, uuid: string) => deleteData<void>(`/api/${kind}/${uuid}/`),
}

export type { EntityPath }
