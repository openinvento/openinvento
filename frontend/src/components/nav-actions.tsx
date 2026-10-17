import * as React from "react"
import { useLocation, useNavigate } from "react-router"
import { BellDotIcon, BellIcon, MoreHorizontalIcon, PencilIcon, QrCodeIcon, StarIcon, StarOffIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { InventoryModal } from "@/components/inventory/inventory-modal"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { inventoryApi, setSelectedInventory, type Area, type Chest } from "@/utils/api/inventory"
import { isFavorite, toggleFavorite, type Favorite } from "@/utils/favorites"
import { useTranslation } from "react-i18next"
import { dismissNotification, getNotificationsOnce, type Notification } from "@/utils/api/notifications"

type PageEntity = { uuid: string; name: string; identifier: string; kind: "areas" | "chests" }

export function NavActions() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [entity, setEntity] = React.useState<PageEntity | null>(null)
  const [favorite, setFavorite] = React.useState<Favorite | null>(null)
  const [favorited, setFavorited] = React.useState(false)
  const [renameOpen, setRenameOpen] = React.useState(false)
  const [identifierOpen, setIdentifierOpen] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")

  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)
  const [dismissingNotification, setDismissingNotification] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    void getNotificationsOnce().then((items) => {
      if (active) setNotifications(items)
    }).catch(() => {})
    return () => { active = false }
  }, [])

  async function dismissNotificationFromList(notification: Notification) {
    setDismissingNotification(notification.uuid)
    try {
      await dismissNotification(notification.uuid)
      setNotifications((items) => items.filter((item) => item.uuid !== notification.uuid))
    } catch {
      // Keep the notification visible if the dismiss request fails.
    } finally {
      setDismissingNotification(null)
    }
  }

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
        setEntity({ uuid: item.uuid, name: item.name, identifier: item.identifier, kind })
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

  async function updateIdentifier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!entity) return
    const identifier = new FormData(event.currentTarget).get("identifier")?.toString().trim()
    if (!identifier) return
    setSaving(true)
    setError("")
    try {
      await inventoryApi.update(entity.kind, entity.uuid, { identifier })
      setIdentifierOpen(false)
      window.location.reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("navActions.errors.identifier"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-0 text-sm">
      <div className="flex items-center gap-0">
        {entity?.kind === "areas" && (
          <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => favorite && setFavorited(toggleFavorite(favorite))}
            aria-pressed={favorited} aria-label={favorite ? (favorited ? `Remove ${favorite.name} from favorites` : `Add ${favorite.name} to favorites`) : "Favorite"}>
            {favorited ? <StarOffIcon /> : <StarIcon />}
          </Button>
        )}

        <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <PopoverTrigger render={<Button variant="ghost" size="icon" className="rounded-lg" aria-label={t("navActions.notifications")} />}>
            {notifications.length > 0 ? <BellDotIcon /> : <BellIcon />}
          </PopoverTrigger>
          <PopoverContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] p-3 sm:w-72" align="end">
            <p className="mb-2 text-sm font-medium">{t("navActions.notifications")}</p>
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("navActions.noNotifications")}</p>
            ) : (
              <ul className="grid gap-2">
                {notifications.map((notification) => (
                  <li key={notification.uuid} className="rounded-md p-2 text-sm hover:bg-muted">
                    {notification.link ? (
                      <button className="block w-full text-left" onClick={() => {
                        setNotificationsOpen(false)
                        const inventoryUuid = notification.metadata.inventory_uuid
                        if (typeof inventoryUuid === "string") setSelectedInventory(inventoryUuid)
                        navigate(notification.link)
                      }}>
                        <span className="block font-medium">{notification.kind === "low_stock" ? t("navActions.lowStock", { name: notification.metadata.article_name }) : notification.title}</span>
                        {notification.kind === "low_stock" ? (
                          <span className="text-muted-foreground">{notification.metadata.inventory_name} · {t("navActions.stockLevel", { quantity: notification.metadata.quantity, minimum: notification.metadata.minimum_quantity })}</span>
                        ) : notification.message ? (
                          <span className="text-muted-foreground">{notification.message}</span>
                        ) : null}
                      </button>
                    ) : (
                      <div>
                        <span className="block font-medium">{notification.title}</span>
                        {notification.message && <span className="text-muted-foreground">{notification.message}</span>}
                      </div>
                    )}
                    <Button variant="ghost" size="sm" className="mt-1 h-7 px-2" disabled={dismissingNotification === notification.uuid} onClick={() => void dismissNotificationFromList(notification)}>
                      {t("navActions.dismiss")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      </div>
      
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger render={<Button variant="ghost" size="icon" className="rounded-lg data-open:bg-accent" aria-label={t("navActions.moreActions")} />}>
          <MoreHorizontalIcon />
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="end">
          {entity ? <div className="grid gap-1">
            <Button variant="ghost" className="justify-start" onClick={() => { setError(""); setMenuOpen(false); setRenameOpen(true) }}>
              <PencilIcon /> {t("navActions.rename")}
            </Button>
            {entity.kind === "areas" && <Button variant="ghost" className="justify-start" onClick={() => { setError(""); setMenuOpen(false); setIdentifierOpen(true) }}>
              <QrCodeIcon /> {t("navActions.editIdentifier")}
            </Button>}
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
      <InventoryModal title={t("navActions.identifierTitle", { kind: entity?.kind === "areas" ? t("navActions.area") : t("navActions.chest") })}
        open={identifierOpen} submitting={saving} onClose={() => setIdentifierOpen(false)} onSubmit={updateIdentifier}>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <label className="grid gap-1.5 text-sm font-medium">
          {t("navActions.identifier")}
          <input autoFocus name="identifier" maxLength={30} defaultValue={entity?.identifier ?? ""} required className="h-10 rounded-lg border bg-background px-3 font-normal" />
        </label>
      </InventoryModal>
      {error && !renameOpen && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
