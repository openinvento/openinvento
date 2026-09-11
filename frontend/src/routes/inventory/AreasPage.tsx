import { useEffect, useState, type FormEvent } from "react"
import { Plus, Warehouse } from "lucide-react"
import { useNavigate } from "react-router"
import { AreaCard } from "@/components/inventory/entity-cards"
import { InventoryModal } from "@/components/inventory/inventory-modal"
import { Button } from "@/components/ui/button"
import BaseScreen from "@/layouts/BaseScreen"
import { inventoryApi, type Area, type Inventory } from "@/utils/api/inventory"

export default function AreasPage() {
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
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load areas.") }
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
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save area.") }
    finally { setSaving(false) }
  }
  async function remove(area: Area) {
    if (!window.confirm(`Delete “${area.name}”? Its inventory contents may be deleted too.`)) return
    try { await inventoryApi.remove("areas", area.uuid); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete area.") }
  }

  return (
    <BaseScreen
      eyebrow={inventory?.name ?? "Your inventory"}
      title="Areas"
      description="Organize your things by room, garage, office, or any other place."
      actions={
        <Button onClick={() => setModal({})} disabled={!inventory}>
          <Plus /> New area
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
          title="No inventory available" 
          text="Ask an administrator to add you to an inventory before creating areas." 
        />
      ) : areas.length === 0 ? (
        <Empty 
          title="Your inventory has no areas" 
          text="Start with the place where you keep your things." 
          action={() => setModal({})} 
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => (
            <AreaCard 
              key={area.uuid} 
              name={area.name} 
              subtitle="Open area" 
              onOpen={() => navigate(`/app/areas/${area.uuid}`)} 
              onRename={() => setModal({ area })} 
              onDelete={() => void remove(area)} 
            />
          ))}
        </div>
      )}

      <InventoryModal 
        title={modal?.area ? "Rename area" : "New area"} 
        open={modal !== null} 
        submitting={saving} 
        onClose={() => setModal(null)} 
        onSubmit={save}
      >
        <label className="grid gap-1.5 text-sm font-medium">
          Area name
          <input 
            autoFocus 
            name="name" 
            defaultValue={modal?.area?.name} 
            className="h-10 rounded-lg border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring" 
            placeholder="e.g. Kitchen" 
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
            <Plus /> Create area
          </Button>
        )}
      </div>
    </div>
  );
}
