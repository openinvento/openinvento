import * as React from "react"
import { useLocation, useNavigate } from "react-router"
import { MoreHorizontalIcon, PencilIcon, StarIcon, StarOffIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { InventoryModal } from "@/components/inventory/inventory-modal"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { inventoryApi, type Area, type Chest } from "@/utils/api/inventory"
import { isFavorite, toggleFavorite, type Favorite } from "@/utils/favorites"
import { useTranslation } from "react-i18next"

type PageEntity = { uuid: string; name: string; kind: "areas" | "chests" }

export function NavActions() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [entity, setEntity] = React.useState<PageEntity | null>(null)
  const [favorite, setFavorite] = React.useState<Favorite | null>(null)
  const [favorited, setFavorited] = React.useState(false)
  const [renameOpen, setRenameOpen] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    const areaId = location.pathname.match(/^\/app\/areas\/([^/]+)$/)?.[1]
    const chestId = location.pathname.match(/^\/app\/chests\/([^/]+)$/)?.[1]
    let active = true
    setEntity(null)
    setFavorite(null)
    setFavorited(false)
    if (!areaId && !chestId) return () => { active = false }

    void (async () => {
      try {
        const item: Area | Chest | undefined = areaId
          ? (await inventoryApi.listAreas()).find((area) => area.uuid === areaId)
          : (await inventoryApi.listChests()).find((chest) => chest.uuid === chestId)
        if (!active || !item) return
        const kind = areaId ? "areas" : "chests"
        setEntity({ uuid: item.uuid, name: item.name, kind })
        if (areaId) {
          const nextFavorite: Favorite = { id: `area:${item.uuid}`, name: item.name, url: `/app/areas/${item.uuid}`, icon: "home" }
          setFavorite(nextFavorite)
          setFavorited(isFavorite(nextFavorite.id))
        }
      } catch {
        if (active) setEntity(null)
      }
    })()
    return () => { active = false }
  }, [location.pathname])

  React.useEffect(() => {
    const syncFavorite = () => setFavorited(favorite ? isFavorite(favorite.id) : false)
    window.addEventListener("openinvento:favorites-changed", syncFavorite)
    window.addEventListener("storage", syncFavorite)
    return () => {
      window.removeEventListener("openinvento:favorites-changed", syncFavorite)
      window.removeEventListener("storage", syncFavorite)
    }
  }, [favorite])

  async function rename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!entity) return
    const name = new FormData(event.currentTarget).get("name")?.toString().trim()
    if (!name) return
    setSaving(true)
    setError("")
    try {
      const updated = await inventoryApi.update<Area | Chest>(entity.kind, entity.uuid, { name })
      setEntity({ ...entity, name: updated.name })
      setRenameOpen(false)
      window.location.reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("navActions.errors.rename"))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!entity || !window.confirm(t("navActions.confirmDelete", { name: entity.name }))) return
    setError("")
    try {
      await inventoryApi.remove(entity.kind, entity.uuid)
      navigate("/app/areas", { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("navActions.errors.delete"))
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {entity?.kind === "areas" && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => favorite && setFavorited(toggleFavorite(favorite))}
          aria-pressed={favorited} aria-label={favorite ? (favorited ? `Remove ${favorite.name} from favorites` : `Add ${favorite.name} to favorites`) : "Favorite"}>
          {favorited ? <StarOffIcon /> : <StarIcon />}
        </Button>
      )}
      
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 data-open:bg-accent" aria-label={t("navActions.moreActions")} />}>
          <MoreHorizontalIcon />
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="end">
          {entity ? <div className="grid gap-1">
            <Button variant="ghost" className="justify-start" onClick={() => { setError(""); setMenuOpen(false); setRenameOpen(true) }}>
              <PencilIcon /> {t("navActions.rename")}
            </Button>
            <Button variant="ghost" className="justify-start text-destructive hover:text-destructive" onClick={() => { setMenuOpen(false); void remove() }}>
              <Trash2Icon /> {t("navActions.delete")}
            </Button>
          </div> : <p className="px-2 py-1 text-sm text-muted-foreground">{t("navActions.noActions")}</p>}
        </PopoverContent>
      </Popover>
      <InventoryModal title={t("navActions.renameTitle", { kind: entity?.kind === "areas" ? t("navActions.area") : t("navActions.chest") })}
        open={renameOpen} submitting={saving} onClose={() => setRenameOpen(false)} onSubmit={rename}>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <label className="grid gap-1.5 text-sm font-medium">
          {t("navActions.name")}
          <input autoFocus name="name" defaultValue={entity?.name} required className="h-10 rounded-lg border bg-background px-3 font-normal" />
        </label>
      </InventoryModal>
      {error && !renameOpen && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
