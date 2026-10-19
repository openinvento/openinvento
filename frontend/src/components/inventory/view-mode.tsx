import { useState } from "react"
import { LayoutGrid, List } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

export type InventoryViewMode = "grid" | "list"

const STORAGE_KEY = "openinvento:inventory-view-mode"

export function useInventoryViewMode() {
  const [viewMode, setViewMode] = useState<InventoryViewMode>(() =>
    window.localStorage.getItem(STORAGE_KEY) === "list" ? "list" : "grid",
  )

  function changeViewMode(mode: InventoryViewMode) {
    window.localStorage.setItem(STORAGE_KEY, mode)
    setViewMode(mode)
  }

  return { viewMode, setViewMode: changeViewMode }
}

export function InventoryViewToggle({
  viewMode,
  setViewMode,
}: {
  viewMode: InventoryViewMode
  setViewMode: (mode: InventoryViewMode) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t("inventory.view.label")}>
      <Button type="button" variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" title={t("inventory.view.grid")} aria-label={t("inventory.view.grid")} aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")}>
        <LayoutGrid />
      </Button>
      <Button type="button" variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" title={t("inventory.view.list")} aria-label={t("inventory.view.list")} aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}>
        <List />
      </Button>
    </div>
  )
}
