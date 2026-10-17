import {
  DragDropProvider,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/react"
import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useLocation } from "react-router"
import { useTranslation } from "react-i18next"
import type { Chest, Shelf } from "@/utils/api/inventory"
import { inventoryApi, type Article } from "@/utils/api/inventory"
import type { InventoryDndItem, InventoryDndTarget } from "@/utils/inventory-move"
import { moveInventoryItem } from "@/utils/inventory-move"

type InventoryDragData = {
  inventoryItem: InventoryDndItem
}

type InventoryDropData = {
  inventoryTarget?: InventoryDndTarget
}

function isInteractiveElement(target: EventTarget | null) {
  return target instanceof Element && Boolean(
    target.closest("button, a, input, select, textarea, [contenteditable='true']"),
  )
}

export function InventoryDropTarget({
  target,
  children,
  className = "",
}: {
  target?: InventoryDndTarget
  children: ReactNode
  className?: string
}) {
  const { isDropTarget, ref } = useDroppable<InventoryDropData>({
    id: target ? `target:${target.kind}:${target.id}` : "target:disabled",
    data: target ? { inventoryTarget: target } : {},
    disabled: !target,
    collisionPriority: target?.kind === "chest" ? 3 : target?.kind === "shelf" ? 2 : 1,
  })

  return (
    <div
      ref={ref}
      className={`${className}${isDropTarget ? " ring-2 ring-primary bg-primary/10" : ""}`}
    >
      {children}
    </div>
  )
}

export function InventoryDraggable({
  item,
  children,
}: {
  item: InventoryDndItem
  children: ReactNode
}) {
  const { ref, isDragging } = useDraggable<InventoryDragData>({
    id: `item:${item.kind}:${item.id}`,
    data: { inventoryItem: item },
  })

  return (
    <div
      ref={ref}
      data-inventory-item={`${item.kind}:${item.id}`}
      className={`relative${isDragging ? " opacity-50" : ""}`}
    >
      {children}
    </div>
  )
}

function handleDragEnd(
  event: DragEndEvent,
  onMove: (item: InventoryDndItem, target: InventoryDndTarget) => void,
) {
  if (event.canceled) return

  const source = event.operation.source?.data as InventoryDragData | undefined
  const target = event.operation.target?.data as InventoryDropData | undefined
  if (source?.inventoryItem && target?.inventoryTarget) {
    onMove(source.inventoryItem, target.inventoryTarget)
  }
}

export function InventoryDndProvider({
  children,
  onMove,
}: {
  children: ReactNode
  onMove: (item: InventoryDndItem, target: InventoryDndTarget) => void
}) {
  const onDragEnd = useCallback(
    (event: DragEndEvent) => handleDragEnd(event, onMove),
    [onMove],
  )

  return (
    <DragDropProvider
      sensors={(defaults) => defaults.map((sensor) => (
        sensor === PointerSensor
          ? PointerSensor.configure({
              activationConstraints: [
                // Delay activation to avoid accidental drags when clicking on interactive elements
                new PointerActivationConstraints.Delay({ value: 250, tolerance: 8 }),
              ],
              preventActivation: (event, source) => {
                if (isInteractiveElement(event.target)) return true
                const nearestDraggable = event.target instanceof Element
                  ? event.target.closest<HTMLElement>("[data-inventory-item]")
                  : null
                return Boolean(
                  nearestDraggable &&
                  nearestDraggable.dataset.inventoryItem !== `${source.data.inventoryItem?.kind}:${source.data.inventoryItem?.id}`,
                )
              },
            })
          : sensor
      ))}
      onDragEnd={onDragEnd}
    >
      {children}
    </DragDropProvider>
  )
}

export function InventoryDndBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { t } = useTranslation()
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [chests, setChests] = useState<Chest[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const [nextShelves, nextChests, nextArticles] = await Promise.all([
      inventoryApi.listShelves(),
      inventoryApi.listChests(),
      inventoryApi.listArticles(),
    ])
    setShelves(nextShelves)
    setChests(nextChests)
    setArticles(nextArticles)
  }, [])

  useEffect(() => {
    void load().catch(() => undefined)
    window.addEventListener("openinvento:inventory-moved", load)
    return () => window.removeEventListener("openinvento:inventory-moved", load)
  }, [load, location.pathname])

  const handleMove = useCallback(async (
    item: InventoryDndItem,
    target: InventoryDndTarget,
  ) => {
    setError("")
    try {
      await moveInventoryItem(item, target, { articles, chests, shelves })
      window.dispatchEvent(new Event("openinvento:inventory-moved"))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("areas.detail.errors.move"))
    }
  }, [articles, chests, shelves, t])

  return (
    <InventoryDndProvider onMove={(item, target) => void handleMove(item, target)}>
      {error && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 rounded-lg bg-destructive px-4 py-3 text-sm text-destructive-foreground shadow-lg"
        >
          {error}
        </div>
      )}
      {children}
    </InventoryDndProvider>
  )
}
