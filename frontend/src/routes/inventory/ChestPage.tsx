import { useEffect, useState, type FormEvent } from "react"
import { ArrowLeft, Pencil } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router"
import { ArticleCard } from "@/components/inventory/entity-cards"
import { InventoryModal } from "@/components/inventory/inventory-modal"
import { Button } from "@/components/ui/button"
import { InventoryDraggable } from "@/components/inventory/inventory-dnd"
import { inventoryApi, type Area, type Article, type Chest, type Shelf } from "@/utils/api/inventory"

function getLowStockBadge(article: Article, label: string) {
  const minimumQuantity = article.custom_fields.minimum_quantity
  return article.stock_tracking && typeof minimumQuantity === "number" && article.quantity <= minimumQuantity
    ? label
    : undefined
}

export default function ChestPage() {
  const { chestId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [chest, setChest] = useState<Chest | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [error, setError] = useState("")
  const [identifierOpen, setIdentifierOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editAreaId, setEditAreaId] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!chestId) return
    setError("")
    try {
      const [allChests, allArticles, allAreas, allShelves] = await Promise.all([inventoryApi.listChests(), inventoryApi.listArticles(), inventoryApi.listAreas(), inventoryApi.listShelves()])
      const nextChest = allChests.find((item) => item.uuid === chestId) ?? null
      setChest(nextChest)
      setArticles(allArticles.filter((article) => article.chest === chestId))
      setAreas(allAreas)
      setShelves(allShelves)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("chests.errors.load"))
    }
  }

  async function updateChest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!chest) return
    const form = new FormData(event.currentTarget)
    const name = form.get("name")?.toString().trim()
    const area = form.get("area")?.toString()
    const shelf = form.get("shelf")?.toString() || null
    if (!name || !area) return
    setSaving(true)
    setError("")
    try {
      const updated = await inventoryApi.update<Chest>("chests", chest.uuid, { name, area, shelf })
      setChest(updated)
      setEditOpen(false)
      await load()
      window.dispatchEvent(new Event("openinvento:inventory-moved"))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("chests.errors.edit"))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    void load()
    window.addEventListener("openinvento:inventory-moved", load)
    return () => window.removeEventListener("openinvento:inventory-moved", load)
  }, [chestId])

  async function remove(article: Article) {
    if (!window.confirm(t("chests.confirmDelete", { name: article.name }))) return
    try {
      await inventoryApi.remove("articles", article.uuid)
      await load()
      window.dispatchEvent(new Event("openinvento:inventory-moved"))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("chests.errors.delete"))
    }
  }

  async function updateIdentifier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!chest) return
    const identifier = new FormData(event.currentTarget).get("identifier")?.toString().trim()
    if (!identifier) return
    setSaving(true)
    setError("")
    try {
      const updated = await inventoryApi.update<Chest>("chests", chest.uuid, { identifier })
      setChest(updated)
      setIdentifierOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("chests.errors.identifier"))
    } finally {
      setSaving(false)
    }
  }

  if (!chest && !error) return <p className="text-muted-foreground">{t("chests.loading")}</p>

  return (
    <section className="w-full">
      <Link to={chest?.area ? `/app/areas/${chest.area}` : "/app/areas"} className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("chests.backToArea")}
      </Link>
      {error && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {chest && <>
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{chest.name}</h1>
            <p className="mt-2 text-muted-foreground">{t("chests.articleCount", { count: articles.length })}</p>
          </div>
          <div className="flex gap-2"><Button variant="outline" onClick={() => setIdentifierOpen(true)}><Pencil /> {t("chests.editIdentifier")}</Button><Button variant="outline" onClick={() => { setEditAreaId(chest.area); setEditOpen(true) }}><Pencil /> {t("chests.editChest")}</Button></div>
        </div>
        {articles.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">{t("chests.empty")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
            {articles.map((article) => 
            <InventoryDraggable key={article.uuid} item={{ kind: "article", id: article.uuid }}>
                <ArticleCard name={article.name} articleIcon={article.icon} articleImage={article.image}
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
      {chest && 
      <InventoryModal title={t("chests.identifierTitle")} open={identifierOpen} submitting={saving}
        onClose={() => setIdentifierOpen(false)} onSubmit={updateIdentifier}>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <label className="grid gap-1.5 text-sm font-medium">
          {t("navActions.identifier")}
          <input autoFocus name="identifier" maxLength={30} defaultValue={chest.identifier} required className="h-10 rounded-lg border bg-background px-3 font-normal" />
        </label>
      </InventoryModal>}
      {chest && 
      <InventoryModal title={t("chests.editTitle")} open={editOpen} submitting={saving} onClose={() => setEditOpen(false)} onSubmit={updateChest}>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <label className="grid gap-1.5 text-sm font-medium">
          {t("navActions.name")}
          <input autoFocus name="name" maxLength={120} defaultValue={chest.name} required className="h-10 rounded-lg border bg-background px-3 font-normal" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("areas.detail.fields.area")}
          <select name="area" value={editAreaId} onChange={(event) => setEditAreaId(event.target.value)} className="h-10 rounded-lg border bg-background px-3 font-normal">
            {areas.map((area) => <option key={area.uuid} value={area.uuid}>{area.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("areas.detail.fields.shelf")}
          <select name="shelf" defaultValue={chest.shelf ?? ""} className="h-10 rounded-lg border bg-background px-3 font-normal">
            <option value="">{t("areas.detail.notOnShelf")}</option>
            {shelves.filter((shelf) => shelf.area === editAreaId).map((shelf) => <option key={shelf.uuid} value={shelf.uuid}>{shelf.name}</option>)}
          </select>
        </label>
      </InventoryModal>}

    </section>
  )
}
