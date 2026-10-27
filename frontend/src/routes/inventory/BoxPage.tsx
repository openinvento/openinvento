import { useEffect, useState, type FormEvent } from "react"
import { ArrowLeft, Pencil } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router"
import { ArticleCard } from "@/components/inventory/entity-cards"
import { InventoryModal } from "@/components/inventory/inventory-modal"
import { Button } from "@/components/ui/button"
import { InventoryViewToggle, useInventoryViewMode } from "@/components/inventory/view-mode"
import { InventoryDraggable } from "@/components/inventory/inventory-dnd"
import { FloatingCreateButton } from "@/components/inventory/FloatingCreateButton"
import { inventoryApi, type Area, type Article, type Box, type Shelf } from "@/utils/api/inventory"

function getLowStockBadge(article: Article, label: string) {
  const minimumQuantity = article.field_values.find((field) => field.key === "minimum_quantity")?.value
  return article.stock_tracking && typeof minimumQuantity === "number" && article.quantity <= minimumQuantity
    ? label
    : undefined
}

export default function BoxPage() {
  const { boxId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const { viewMode, setViewMode } = useInventoryViewMode()
  const [area, setArea] = useState<Area | null>(null)
  const [box, setBox] = useState<Box | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [error, setError] = useState("")
  const [identifierOpen, setIdentifierOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editAreaId, setEditAreaId] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!boxId) return
    setError("")
    try {
      const nextBox = await inventoryApi.getEntry<Box>(boxId)
      const [allArticles, allAreas, allShelves] = await Promise.all([
        inventoryApi.listArticles({ within: boxId }),
        inventoryApi.listAreas(),
        nextBox?.area ? inventoryApi.listShelves({ within: nextBox.area }) : Promise.resolve([]),
      ])
      setArea(allAreas.find((item) => item.uuid === nextBox?.area) || null)
      setBox(nextBox)
      setArticles(allArticles)
      setAreas(allAreas)
      setShelves(allShelves)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("boxes.errors.load"))
    }
  }

  async function updateBox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!box) return
    const form = new FormData(event.currentTarget)
    const name = form.get("name")?.toString().trim()
    const area = form.get("area")?.toString()
    const shelf = form.get("shelf")?.toString() || null
    if (!name || !area) return
    const parent_box = area === box.area && shelf === box.shelf ? box.parent_box : null
    setSaving(true)
    setError("")
    try {
      const updated = await inventoryApi.update<Box>("boxes", box.uuid, { name, area, shelf, parent_box })
      setBox(updated)
      setEditOpen(false)
      await load()
      window.dispatchEvent(new Event("openinvento:inventory-moved"))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("boxes.errors.edit"))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    void load()
    window.addEventListener("openinvento:inventory-moved", load)
    return () => window.removeEventListener("openinvento:inventory-moved", load)
  }, [boxId])

  async function remove(article: Article) {
    if (!window.confirm(t("boxes.confirmDelete", { name: article.name }))) return
    try {
      await inventoryApi.remove("articles", article.uuid)
      await load()
      window.dispatchEvent(new Event("openinvento:inventory-moved"))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("boxes.errors.delete"))
    }
  }

  async function updateIdentifier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!box) return
    const identifier = new FormData(event.currentTarget).get("identifier")?.toString().trim()
    if (!identifier) return
    setSaving(true)
    setError("")
    try {
      const updated = await inventoryApi.update<Box>("boxes", box.uuid, { identifier })
      setBox(updated)
      setIdentifierOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("boxes.errors.identifier"))
    } finally {
      setSaving(false)
    }
  }

  if (!box && !error) return <p className="text-muted-foreground">{t("boxes.loading")}</p>

  return (
    <section className="w-full">
      <Link to={box?.area ? `/app/areas/${box.area}` : "/app/areas"} className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("boxes.backToArea")}
      </Link>
      {error && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {box && <>
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{box.name}</h1>
            <p className="mt-2 text-muted-foreground">{t("boxes.articleCount", { count: articles.length })}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <InventoryViewToggle viewMode={viewMode} setViewMode={setViewMode} />

            <Button variant="outline" onClick={() => setIdentifierOpen(true)}>
              <Pencil /> 
              {t("boxes.editIdentifier")}
            </Button>
            <Button variant="outline" onClick={() => { setEditAreaId(box.area); setEditOpen(true) }}>
              <Pencil /> 
              {t("boxes.editBox")}
            </Button>
          </div>
        </div>
        {articles.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">{t("boxes.empty")}</p>
        ) : (
          <div className={viewMode === "list" ? "flex flex-col gap-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6"}>
            {articles.map((article) => 
            <InventoryDraggable key={article.uuid} item={{ kind: "article", id: article.uuid }}>
                <ArticleCard viewMode={viewMode} name={article.name} articleIcon={article.icon} articleImage={article.image}
                  subtitle={t("areas.detail.inStock", { count: article.quantity })} 
                  badge={getLowStockBadge(article, t("areas.detail.lowStock"))} 
                  onOpen={() => navigate(`/app/articles/${article.uuid}`)} 
                  onRename={() => navigate(`/app/articles/${article.uuid}`)} 
                  onDelete={() => void remove(article)} 
                />
            </InventoryDraggable>)}
          </div>
        )}
      </>}
      {area && box && !identifierOpen && !editOpen && <FloatingCreateButton areaId={area.uuid} boxId={box.uuid} articleTo={`/app/areas/${box.area}/articles/new?box=${box.uuid}`} />}
      {box && 
      <InventoryModal title={t("boxes.identifierTitle")} open={identifierOpen} submitting={saving}
        onClose={() => setIdentifierOpen(false)} onSubmit={updateIdentifier}>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <label className="grid gap-1.5 text-sm font-medium">
          {t("navActions.identifier")}
          <input autoFocus name="identifier" maxLength={30} defaultValue={box.identifier} required className="h-10 rounded-lg border bg-background px-3 font-normal" />
        </label>
      </InventoryModal>}
      {box && 
      <InventoryModal title={t("boxes.editTitle")} open={editOpen} submitting={saving} onClose={() => setEditOpen(false)} onSubmit={updateBox}>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <label className="grid gap-1.5 text-sm font-medium">
          {t("navActions.name")}
          <input autoFocus name="name" maxLength={120} defaultValue={box.name} required className="h-10 rounded-lg border bg-background px-3 font-normal" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("areas.detail.fields.area")}
          <select name="area" value={editAreaId} onChange={(event) => {
            const area = event.target.value
            setEditAreaId(area)
            void inventoryApi.listShelves({ within: area }).then(setShelves)
          }} className="h-10 rounded-lg border bg-background px-3 font-normal">
            {areas.map((area) => <option key={area.uuid} value={area.uuid}>{area.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("areas.detail.fields.shelf")}
          <select name="shelf" defaultValue={box.shelf ?? ""} className="h-10 rounded-lg border bg-background px-3 font-normal">
            <option value="">{t("areas.detail.notOnShelf")}</option>
            {shelves.filter((shelf) => shelf.area === editAreaId).map((shelf) => <option key={shelf.uuid} value={shelf.uuid}>{shelf.name}</option>)}
          </select>
        </label>
      </InventoryModal>}

    </section>
  )
}
