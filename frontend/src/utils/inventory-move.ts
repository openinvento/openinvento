// Helpers for drag and drop

import { inventoryApi, type Article, type Chest, type Shelf } from "@/utils/api/inventory"

export type InventoryDndItem = {
  kind: "article" | "chest" | "shelf"
  id: string
}

export type InventoryDndTarget = {
  kind: "area" | "shelf" | "chest"
  id: string
}

type InventoryLocations = {
  articles: Article[]
  chests: Chest[]
  shelves: Shelf[]
}

async function moveChestWithContents(
  chestId: string,
  area: string,
  shelf: string | null,
  parent: string | null,
  locations: InventoryLocations,
) {
  await inventoryApi.update("chests", chestId, {
    area,
    shelf,
    parent_chest: parent,
  })

  const containedArticles = locations.articles.filter((article) => article.chest === chestId)
  await Promise.all(
    containedArticles.map((article) =>
      inventoryApi.update("articles", article.uuid, { area, shelf }),
    ),
  )

  const childChests = locations.chests.filter((chest) => chest.parent_chest === chestId)
  await Promise.all(
    childChests.map((child) =>
      moveChestWithContents(child.uuid, area, shelf, chestId, locations),
    ),
  )
}

export async function moveInventoryItem(
  item: InventoryDndItem,
  target: InventoryDndTarget,
  locations: InventoryLocations,
) {
  if (item.kind === "article") {
    await moveArticle(item.id, target, locations)
    return
  }

  if (item.kind === "chest") {
    await moveChest(item.id, target, locations)
    return
  }

  await moveShelf(item.id, target, locations)
}

async function moveArticle(
  articleId: string,
  target: InventoryDndTarget,
  { chests, shelves }: InventoryLocations,
) {
  if (target.kind === "area") {
    await inventoryApi.update("articles", articleId, {
      area: target.id,
      shelf: null,
      chest: null,
    })
    return
  }

  if (target.kind === "shelf") {
    const shelf = shelves.find((entry) => entry.uuid === target.id)
    if (!shelf) throw new Error("The destination shelf could not be found.")

    await inventoryApi.update("articles", articleId, {
      area: shelf.area,
      shelf: shelf.uuid,
      chest: null,
    })
    return
  }

  const chest = chests.find((entry) => entry.uuid === target.id)
  if (!chest) throw new Error("The destination chest could not be found.")

  await inventoryApi.update("articles", articleId, {
    area: chest.area,
    shelf: chest.shelf,
    chest: chest.uuid,
  })
}

async function moveChest(
  chestId: string,
  target: InventoryDndTarget,
  locations: InventoryLocations,
) {
  const chest = locations.chests.find((entry) => entry.uuid === chestId)
  if (!chest) throw new Error("The chest could not be found.")

  if (target.kind === "area") {
    await moveChestWithContents(chestId, target.id, null, null, locations)
    return
  }

  if (target.kind === "shelf") {
    const shelf = locations.shelves.find((entry) => entry.uuid === target.id)
    if (!shelf) throw new Error("The destination shelf could not be found.")

    await moveChestWithContents(chestId, shelf.area, shelf.uuid, null, locations)
    return
  }

  const parent = locations.chests.find((entry) => entry.uuid === target.id)
  if (!parent) throw new Error("The destination chest could not be found.")
  if (parent.uuid === chest.uuid) return

  await moveChestWithContents(chestId, parent.area, parent.shelf, parent.uuid, locations)
}

async function moveShelf(
  shelfId: string,
  target: InventoryDndTarget,
  locations: InventoryLocations,
) {
  if (target.kind !== "area") return

  await inventoryApi.update("shelves", shelfId, { area: target.id })

  const articlesOnShelf = locations.articles.filter(
    (article) => article.shelf === shelfId && article.chest === null,
  )
  await Promise.all(
    articlesOnShelf.map((article) =>
      inventoryApi.update("articles", article.uuid, {
        area: target.id,
        shelf: shelfId,
      }),
    ),
  )

  const chestsOnShelf = locations.chests.filter(
    (chest) => chest.shelf === shelfId && chest.parent_chest === null,
  )
  await Promise.all(
    chestsOnShelf.map((chest) =>
      moveChestWithContents(chest.uuid, target.id, shelfId, null, locations),
    ),
  )
}
