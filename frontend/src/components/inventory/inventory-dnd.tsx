import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
  type PointerEvent,
  type ReactNode,
  type MouseEvent,
  type TouchEvent,
} from "react"
import type { Chest, Shelf } from "@/utils/api/inventory"
import { inventoryApi, type Article } from "@/utils/api/inventory"
import type { InventoryDndItem, InventoryDndTarget } from "@/utils/inventory-move"
import { moveInventoryItem } from "@/utils/inventory-move"
import { useLocation } from "react-router"
import { useTranslation } from "react-i18next"

type DndContextValue = {
  move: (item: InventoryDndItem, target: InventoryDndTarget) => void
}

const InventoryDndContext = createContext<DndContextValue | null>(null)

export function InventoryDndProvider({
  children,
  onMove,
}: {
  children: ReactNode
  onMove: (item: InventoryDndItem, target: InventoryDndTarget) => void
}) {
  return (
    <InventoryDndContext.Provider value={{ move: onMove }}>
      {children}
    </InventoryDndContext.Provider>
  )
}

export function InventoryDropTarget({
  target,
  children,
  className = "",
}: {
  target: InventoryDndTarget
  children: ReactNode
  className?: string
}) {
  return (
    <div data-inventory-drop={`${target.kind}:${target.id}`} className={className}>
      {children}
    </div>
  )
}

type PointerState = {
  id: number
  x: number
  y: number
  dragging: boolean
  moved: boolean
  element: HTMLDivElement
  timer?: number
}

type TouchState = {
  x: number
  y: number
  dragging: boolean
  moved: boolean
  timer?: number
  preventScroll?: (event: globalThis.TouchEvent) => void
}

function clearDropHighlights() {
  document.querySelectorAll("[data-inventory-drop]").forEach((element) => {
    element.classList.remove("ring-2", "ring-primary", "bg-primary/10")
  })
}

function findDropTarget(x: number, y: number) {
  return document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-inventory-drop]")
}

export function InventoryDraggable({
  item,
  children,
}: {
  item: InventoryDndItem
  children: ReactNode
}) {
  const move = useContext(InventoryDndContext)?.move
  const pointer = useRef<PointerState | null>(null)
  const touch = useRef<TouchState | null>(null)
  const suppressClick = useRef(false)
  const suppressClickTimer = useRef<number | undefined>(undefined)

  if (!move) {
    throw new Error("InventoryDraggable must be used inside InventoryDndProvider")
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return
    if (event.button !== 0) return
    const targetElement = event.target as HTMLElement
    if (targetElement.closest("button[aria-label], a, input, select, textarea")) return
    if (item.kind !== "shelf" && targetElement.closest("button")) return
    if (event.target !== event.currentTarget &&
      (event.target as HTMLElement).closest("[data-inventory-item]") !== event.currentTarget) return

    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
      moved: false,
      timer: window.setTimeout(() => {
        const current = pointer.current
        if (!current || current.id !== event.pointerId) return
        current.dragging = true
        current.element.setPointerCapture(event.pointerId)
      }, 600),
      element: event.currentTarget,
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = pointer.current
    if (!current || current.id !== event.pointerId) return

    const distance = Math.hypot(event.clientX - current.x, event.clientY - current.y)
    if (!current.dragging && distance > 8) {
      window.clearTimeout(current.timer)
      pointer.current = null
      return
    }
    if (!current.dragging) return
    if (distance > 8) current.moved = true

    const target = findDropTarget(event.clientX, event.clientY)
    clearDropHighlights()
    target?.classList.add("ring-2", "ring-primary", "bg-primary/10")
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = pointer.current
    pointer.current = null
    window.clearTimeout(current?.timer)
    clearDropHighlights()
    if (!current?.dragging || !current.moved) return

    suppressClick.current = true
    window.clearTimeout(suppressClickTimer.current)
    suppressClickTimer.current = window.setTimeout(() => {
      suppressClick.current = false
    }, 800)
    const value = findDropTarget(event.clientX, event.clientY)?.dataset.inventoryDrop
    if (!value) return

    const separator = value.indexOf(":")
    const kind = value.slice(0, separator) as InventoryDndTarget["kind"]
    const id = value.slice(separator + 1)
    move?.(item, { kind, id })
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const targetElement = event.target as HTMLElement
    if (targetElement.closest("button[aria-label], a, input, select, textarea")) return
    if (item.kind !== "shelf" && targetElement.closest("button")) return

    const nestedSource = (event.target as HTMLElement).closest("[data-inventory-item]")
    if (nestedSource && nestedSource !== event.currentTarget) return
    event.stopPropagation()
    const start = event.touches[0]
    if (!start) return

    const current: TouchState = {
      x: start.clientX,
      y: start.clientY,
      dragging: false,
      moved: false,
    }
    touch.current = current
    current.timer = window.setTimeout(() => {
      if (touch.current !== current) return
      current.dragging = true
      current.preventScroll = (touchEvent) => touchEvent.preventDefault()
      window.addEventListener("touchmove", current.preventScroll, { passive: false })
    }, 600)
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    const current = touch.current
    const point = event.touches[0]
    if (!current || !point) return

    if (!current.dragging && Math.hypot(point.clientX - current.x, point.clientY - current.y) > 8) {
      window.clearTimeout(current.timer)
      touch.current = null
      return
    }
    if (!current.dragging) return

    if (Math.hypot(point.clientX - current.x, point.clientY - current.y) > 8) current.moved = true
    const target = findDropTarget(point.clientX, point.clientY)
    clearDropHighlights()
    target?.classList.add("ring-2", "ring-primary", "bg-primary/10")
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const current = touch.current
    touch.current = null
    window.clearTimeout(current?.timer)
    if (current?.preventScroll) {
      window.removeEventListener("touchmove", current.preventScroll)
    }
    clearDropHighlights()
    if (!current?.dragging || !current.moved) return

    suppressClick.current = true
    window.clearTimeout(suppressClickTimer.current)
    suppressClickTimer.current = window.setTimeout(() => {
      suppressClick.current = false
    }, 800)
    const point = event.changedTouches[0]
    const value = point && findDropTarget(point.clientX, point.clientY)?.dataset.inventoryDrop
    if (!value) return

    const separator = value.indexOf(":")
    const kind = value.slice(0, separator) as InventoryDndTarget["kind"]
    move?.(item, { kind, id: value.slice(separator + 1) })
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClick.current = false
    window.clearTimeout(suppressClickTimer.current)
  }

  useEffect(() => () => {
      if (touch.current?.preventScroll) {
        window.removeEventListener("touchmove", touch.current.preventScroll)
      }
      window.clearTimeout(pointer.current?.timer)
      window.clearTimeout(touch.current?.timer)
      window.clearTimeout(suppressClickTimer.current)
  }, [])

  return (
    <div
      data-inventory-item={`${item.kind}:${item.id}`}
      className="relative"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        window.clearTimeout(pointer.current?.timer)
        pointer.current = null
        clearDropHighlights()
      }}
      onTouchStartCapture={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClickCapture={handleClickCapture}
    >
      {children}
    </div>
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

  const handleMove = useCallback(async (item: InventoryDndItem, target: InventoryDndTarget) => {
    setError("")
    try {
      await moveInventoryItem(item, target, { articles, chests, shelves })
      window.dispatchEvent(new Event("openinvento:inventory-moved"))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("areas.detail.errors.move"))
    }
  }, [articles, chests, shelves, t])

  return (
    <InventoryDndProvider onMove={handleMove}>
      {error && (
        <div role="alert" className="fixed bottom-4 right-4 z-50 rounded-lg bg-destructive px-4 py-3 text-sm text-destructive-foreground shadow-lg">
          {error}
        </div>
      )}
      {children}
    </InventoryDndProvider>
  )
}
