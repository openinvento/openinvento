// Helpers for drag and drop

import { inventoryApi, type Article, type Box, type Shelf } from "@/utils/api/inventory"

export type InventoryDndItem = {
  kind: "article" | "box" | "shelf"
  id: string
}

export type InventoryDndTarget = {
  kind: "area" | "shelf" | "box"
  id: string
}

type InventoryLocations = {
  articles: Article[]
  boxes: Box[]
  shelves: Shelf[]
}

async function moveBoxWithContents(
  boxId: string,
  area: string,
  shelf: string | null,
  parent: string | null,
  locations: InventoryLocations,
) {
  await inventoryApi.update("boxes", boxId, {
    area,
    shelf,
    parent_box: parent,
  })

  const containedArticles = locations.articles.filter((article) => article.box === boxId)
  await Promise.all(
    containedArticles.map((article) =>
      inventoryApi.update("articles", article.uuid, { area, shelf }),
    ),
  )

  const childBoxes = locations.boxes.filter((box) => box.parent_box === boxId)
  await Promise.all(
    childBoxes.map((child) =>
      moveBoxWithContents(child.uuid, area, shelf, boxId, locations),
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

  if (item.kind === "box") {
    await moveBox(item.id, target, locations)
    return
  }

  await moveShelf(item.id, target, locations)
}

async function moveArticle(
  articleId: string,
  target: InventoryDndTarget,
  { boxes, shelves }: InventoryLocations,
) {
  if (target.kind === "area") {
    await inventoryApi.update("articles", articleId, {
      area: target.id,
      shelf: null,
      box: null,
    })
    return
  }

  if (target.kind === "shelf") {
    const shelf = shelves.find((entry) => entry.uuid === target.id)
    if (!shelf) throw new Error("The destination shelf could not be found.")

    await inventoryApi.update("articles", articleId, {
      area: shelf.area,
      shelf: shelf.uuid,
      box: null,
    })
    return
  }

  const box = boxes.find((entry) => entry.uuid === target.id)
  if (!box) throw new Error("The destination box could not be found.")

  await inventoryApi.update("articles", articleId, {
    area: box.area,
    shelf: box.shelf,
    box: box.uuid,
  })
}

async function moveBox(
  boxId: string,
  target: InventoryDndTarget,
  locations: InventoryLocations,
) {
  const box = locations.boxes.find((entry) => entry.uuid === boxId)
  if (!box) throw new Error("The box could not be found.")

  if (target.kind === "area") {
    await moveBoxWithContents(boxId, target.id, null, null, locations)
    return
  }

  if (target.kind === "shelf") {
    const shelf = locations.shelves.find((entry) => entry.uuid === target.id)
    if (!shelf) throw new Error("The destination shelf could not be found.")

    await moveBoxWithContents(boxId, shelf.area, shelf.uuid, null, locations)
    return
  }

  const parent = locations.boxes.find((entry) => entry.uuid === target.id)
  if (!parent) throw new Error("The destination box could not be found.")
  if (parent.uuid === box.uuid) return

  await moveBoxWithContents(boxId, parent.area, parent.shelf, parent.uuid, locations)
}

async function moveShelf(
  shelfId: string,
  target: InventoryDndTarget,
  locations: InventoryLocations,
) {
  if (target.kind !== "area") return

  await inventoryApi.update("shelves", shelfId, { area: target.id })

  const articlesOnShelf = locations.articles.filter(
    (article) => article.shelf === shelfId && article.box === null,
  )
  await Promise.all(
    articlesOnShelf.map((article) =>
      inventoryApi.update("articles", article.uuid, {
        area: target.id,
        shelf: shelfId,
      }),
    ),
  )

  const boxesOnShelf = locations.boxes.filter(
    (box) => box.shelf === shelfId && box.parent_box === null,
  )
  await Promise.all(
    boxesOnShelf.map((box) =>
      moveBoxWithContents(box.uuid, target.id, shelfId, null, locations),
    ),
  )
}
