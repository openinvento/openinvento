import { useEffect, useState, type FormEvent } from "react"
import { Plus, Warehouse } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { AreaCard } from "@/components/inventory/entity-cards"
import { InventoryModal } from "@/components/inventory/inventory-modal"
import { Button } from "@/components/ui/button"
import BaseScreen from "@/layouts/BaseScreen"
import { inventoryApi, type Area, type Inventory } from "@/utils/api/inventory"

export default function AreasPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const [modal, setModal] = useState<{ area?: Area } | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    setError("")
    try {
      const [inventories, nextAreas] = await Promise.all([inventoryApi.listInventories(), inventoryApi.listAreas()])
      setInventory(inventories[0] ?? null)
      setAreas(nextAreas)
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("areas.errors.load")) }
  }
  useEffect(() => { void load() }, [])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = new FormData(event.currentTarget).get("name")?.toString().trim()
    if (!name || !inventory) return
    setSaving(true)
    try {
      if (modal?.area) await inventoryApi.update("areas", modal.area.uuid, { name })
      else await inventoryApi.create("areas", { name, inventory: inventory.uuid })
      setModal(null); 
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("areas.errors.save")) }
    finally { setSaving(false) }
  }
  async function remove(area: Area) {
    if (!window.confirm(t("areas.confirmDelete", { name: area.name }))) return
    try { await inventoryApi.remove("areas", area.uuid); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("areas.errors.delete")) }
  }

  return (
    <BaseScreen
      eyebrow={inventory?.name ?? t("areas.inventoryFallback")}
      title={t("areas.title")}
      description={t("areas.description")}
      actions={
        <Button onClick={() => setModal({})} disabled={!inventory}>
          <Plus /> {t("areas.newArea")}
        </Button>
      }
    >
      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!inventory && !error ? (
        <Empty
          title={t("areas.empty.noInventory.title")}
          text={t("areas.empty.noInventory.text")}
        />
      ) : areas.length === 0 ? (
        <Empty
          title={t("areas.empty.noAreas.title")}
          text={t("areas.empty.noAreas.text")}
          action={() => setModal({})}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => (
            <AreaCard 
              key={area.uuid} 
              name={area.name} 
              subtitle={t("areas.openArea")}
              onOpen={() => navigate(`/app/areas/${area.uuid}`)} 
              onRename={() => setModal({ area })} 
              onDelete={() => void remove(area)} 
            />
          ))}
        </div>
      )}

      <InventoryModal 
        title={modal?.area ? t("areas.renameArea") : t("areas.newArea")}
        open={modal !== null} 
        submitting={saving} 
        onClose={() => setModal(null)} 
        onSubmit={save}
      >
        <label className="grid gap-1.5 text-sm font-medium">
          {t("areas.areaName")}
          <input 
            autoFocus 
            name="name" 
            defaultValue={modal?.area?.name} 
            className="h-10 rounded-lg border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring" 
            placeholder={t("areas.namePlaceholder")}
            required
          />
        </label>
      </InventoryModal>
    </BaseScreen>
  );
}

function Empty({ title, text, action }: { title: string; text: string; action?: () => void }) {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
      <div>
        <Warehouse className="mx-auto mb-3 size-8 text-muted-foreground" />
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
        
        {action && (
          <Button className="mt-4" onClick={action}>
            <Plus /> {t("areas.createArea")}
          </Button>
        )}
      </div>
    </div>
  );
}
