import { useEffect, useState, type FormEvent } from "react"
import { ArrowLeft, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router"
import { ArticleCard, BoxCard } from "@/components/inventory/entity-cards"
import { ShelfSection } from "@/components/inventory/ShelfSection"
import { InventoryModal } from "@/components/inventory/inventory-modal"
import { Button } from "@/components/ui/button"
import { InventoryViewToggle, useInventoryViewMode } from "@/components/inventory/view-mode"
import { InventoryDraggable, InventoryDropTarget } from "@/components/inventory/inventory-dnd"
import { FloatingCreateButton } from "@/components/inventory/FloatingCreateButton"
import {
  getSelectedInventory,
  inventoryApi,
  type Area,
  type Article,
  type Box,
  type Inventory,
  type Shelf,
} from "@/utils/api/inventory"

type CreateKind = "box" | "shelf"

function getLowStockBadge(article: Article, label: string) {
  const minimumQuantity = article.field_values.find((field) => field.key === "minimum_quantity")?.value
  return article.stock_tracking &&
    typeof minimumQuantity === "number" &&
    article.quantity <= minimumQuantity
    ? label
    : undefined
}

export default function AreaDetailScreen() {
  const { areaId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { viewMode, setViewMode } = useInventoryViewMode()

  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [area, setArea] = useState<Area | null>(null)
  const [allAreas, setAllAreas] = useState<Area[]>([])
  const [editAreaId, setEditAreaId] = useState("")
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [allShelves, setAllShelves] = useState<Shelf[]>([])
  const [boxes, setBoxes] = useState<Box[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [modal, setModal] = useState<{ kind: CreateKind; item?: Shelf | Box } | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [openShelves, setOpenShelves] = useState<Record<string, boolean>>({})

  async function load() {
    if (!areaId) return
    setError("")
    try {
      const [inventories, allAreas, scopedEntries] = await Promise.all([
        inventoryApi.listInventories(),
        inventoryApi.listAreas(),
        inventoryApi.listEntries({ within: areaId }),
      ])
      setInventory(getSelectedInventory(inventories))
      setArea(allAreas.find((item) => item.uuid === areaId) ?? null)
      setAllAreas(allAreas)
      const scopedShelves = scopedEntries.filter((item) => item.type === "shelf") as Shelf[]
      setShelves(scopedShelves)
      setAllShelves(scopedShelves)
      setBoxes(scopedEntries.filter((item) => item.type === "box") as Box[])
      setArticles(scopedEntries.filter((item) => item.type === "article") as Article[])
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("areas.detail.errors.load"),
      )
    }
  }
  useEffect(() => {
    void load()
    window.addEventListener("openinvento:inventory-moved", load)
    return () => window.removeEventListener("openinvento:inventory-moved", load)
  }, [areaId])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!modal || !inventory || !areaId) return
    const form = new FormData(event.currentTarget)
    const name = form.get("name")?.toString().trim()
    if (!name) return
    const optional = (key: string) => form.get(key)?.toString() || null
    const selectedArea = modal.item ? editAreaId : areaId
    if (!selectedArea) return
    const basePayload = {
      name,
      inventory: inventory.uuid,
      area: selectedArea,
    }

    let payload: Record<string, unknown> = basePayload

    if (modal.kind === "shelf") {
      payload = { ...basePayload }
    } else if (modal.kind === "box") {
      payload = {
        ...basePayload,
        shelf: optional("shelf"),
      }
      if (
        modal.item?.type === "box" &&
        selectedArea === modal.item.area &&
        payload.shelf === modal.item.shelf
      ) {
        payload.parent_box = modal.item.parent_box
      }
    }

    setSaving(true)
    try {
      if (modal.item) {
        await inventoryApi.update(
          modal.kind === "shelf" ? "shelves" : "boxes",
          modal.item.uuid,
          payload,
        )
      } else {
        await inventoryApi.create(
          modal.kind === "shelf"
            ? "shelves"
            : modal.kind === "box"
              ? "boxes"
              : "articles",
          payload,
        )
      }
      setModal(null)
      await load()
      window.dispatchEvent(new Event("openinvento:inventory-moved"))
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("areas.detail.errors.save"),
      )
    } finally {
      setSaving(false)
    }
  }
  async function remove(kind: "articles" | "boxes" | "shelves", uuid: string, name: string) {
    if (!window.confirm(t("areas.detail.confirmDelete", { name }))) return
    try {
      await inventoryApi.remove(kind, uuid)
      await load()
      window.dispatchEvent(new Event("openinvento:inventory-moved"))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("areas.detail.errors.delete"))
    }
  }

  if (!area && !error) {
    return <p className="text-muted-foreground">{t("areas.detail.loading")}</p>
  }
  return (
  <section className="w-full">
    {/* Area navigation */}
    <Link to="/app/areas" className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      {t("areas.detail.allAreas")}
    </Link>
    {error && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {area && 
    
    <><div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      {/* Area header and creation actions */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{area.name}</h1>
        <p className="mt-2 text-muted-foreground">{t("areas.detail.summary", { articles: articles.length, boxes: boxes.length, shelves: shelves.length })}</p>
      </div>
    
      <div className="flex flex-wrap items-center gap-2">
      <InventoryViewToggle viewMode={viewMode} setViewMode={setViewMode} />
      
      <Button className="p-4" variant="outline" onClick={() => setModal({ kind: "shelf" })}><Plus /> {t("areas.detail.actions.shelf")}</Button>
      <Button className="p-4" variant="outline" onClick={() => setModal({ kind: "box" })}><Plus /> {t("areas.detail.actions.box")}</Button>
      </div>
    </div>

    <InventoryDropTarget target={{ kind: "area", id: areaId ?? "" }}>

    <div className="space-y-6">
      {/* Articles can live directly in an area without a shelf. */}
      {articles.filter((article) => article.shelf === null && article.box === null).length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t("areas.detail.articles")}</h2>
          <div className={viewMode === "list" ? "flex flex-col gap-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6"}>
            {articles.filter((article) => article.shelf === null && article.box === null).map((article) => (
              <InventoryDraggable key={article.uuid} item={{ kind: "article", id: article.uuid }}>
                <ArticleCard
                  viewMode={viewMode}
                  name={article.name}
                  articleIcon={article.icon}
                  articleImage={article.image}
                  subtitle={t("areas.detail.inStock", { count: article.quantity })}
                  badge={getLowStockBadge(article, t("areas.detail.lowStock"))}
                  onOpen={() => navigate(`/app/articles/${article.uuid}`)}
                  onRename={() => navigate(`/app/articles/${article.uuid}`)}
                  onDelete={() => void remove("articles", article.uuid, article.name)}
                />
              </InventoryDraggable>
            ))}
          </div>
        </div>
      )}

      {/* Shelves are optional containers for grouped inventory. */}
      {shelves.map((shelf) => (
        <ShelfSection
          key={shelf.uuid}
          shelf={shelf}
          viewMode={viewMode}
          boxes={boxes}
          articles={articles}
          isOpen={openShelves[shelf.uuid] !== false}
          onToggle={() =>
            setOpenShelves((state) => ({
              ...state,
              [shelf.uuid]: openShelves[shelf.uuid] === false,
            }))
          }
          onEditShelf={() => {
            setEditAreaId(shelf.area)
            setModal({ kind: "shelf", item: shelf })
          }}
          onDeleteShelf={() =>
            void remove("shelves", shelf.uuid, shelf.name)
          }
          onOpenBox={(box) => navigate(`/app/boxes/${box.uuid}`)}
          onEditBox={(box) => {
            setEditAreaId(box.area)
            setModal({ kind: "box", item: box })
          }}
          onDeleteBox={(box) =>
            void remove("boxes", box.uuid, box.name)
          }
          onOpenArticle={(article) =>
            navigate(`/app/articles/${article.uuid}`)
          }
          onDeleteArticle={(article) =>
            void remove("articles", article.uuid, article.name)
          }
        />
      ))}

      {boxes.filter((box) => box.shelf === null).length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t("areas.detail.otherItems")}</h2>
          <div className={viewMode === "list" ? "flex flex-col gap-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6"}>
            {boxes
              .filter((box) => box.shelf === null)
              .map((box) => (
                <InventoryDraggable
                  key={box.uuid}
                  item={{ kind: "box", id: box.uuid }}
                >
                  <InventoryDropTarget
                    target={{ kind: "box", id: box.uuid }}
                  >
                    <BoxCard
                      viewMode={viewMode}
                      name={box.name}
                      subtitle={t("areas.detail.articleCount", {
                        count: articles.filter(
                          (article) => article.box === box.uuid,
                        ).length,
                      })}
                      onOpen={() => navigate(`/app/boxes/${box.uuid}`)}
                      onRename={() => {
                        setEditAreaId(box.area)
                        setModal({ kind: "box", item: box })
                      }}
                      onDelete={() =>
                        void remove("boxes", box.uuid, box.name)
                      }
                    />
                  </InventoryDropTarget>
                </InventoryDraggable>
              ))}
          </div>
        </div>
      )}
    </div></InventoryDropTarget></>}

    {/* Create and edit inventory modal */}
    <InventoryModal
      title={modal ? t(`areas.detail.modal.${modal.item ? "edit" : "new"}`, { kind: t(`areas.detail.actions.${modal.kind}`) }) : ""}
      open={modal !== null}
      submitting={saving}
      onClose={() => setModal(null)}
      onSubmit={save}
    >
      <label className="grid gap-1.5 text-sm font-medium">
        {t("areas.detail.fields.name")}
        <input
          autoFocus
          name="name"
          defaultValue={modal?.item?.name}
          required
          className="h-10 rounded-lg border bg-background px-3 font-normal"
        />
      </label>

      {modal?.item && <label className="grid gap-1.5 text-sm font-medium">
        {t("areas.detail.fields.area")}
        <select name="area" value={editAreaId} 
          onChange={(event) => {
            const newArea = event.target.value
            setEditAreaId(newArea);
            void inventoryApi.listShelves({ within: newArea }).then(setAllShelves).catch(() => setAllShelves([]))
          }} 
          className="h-10 rounded-lg border bg-background px-3 font-normal">
          
          {allAreas.map((option) => <option key={option.uuid} value={option.uuid}>{option.name}</option>)}
        </select>
      </label>}

      {modal?.kind !== "shelf" && (
        <label className="grid gap-1.5 text-sm font-medium">
          {t("areas.detail.fields.shelf")}
          <select
            name="shelf"
            defaultValue={modal?.item && "shelf" in modal.item ? modal.item.shelf ?? "" : ""}
            className="h-10 rounded-lg border bg-background px-3 font-normal"
          >
            <option value="">{t("areas.detail.notOnShelf")}</option>
            {allShelves.filter((shelf) => shelf.area === (modal?.item ? editAreaId : areaId)).map((shelf) => (
              <option key={shelf.uuid} value={shelf.uuid}>
                {shelf.name}
              </option>
            ))}
          </select>
        </label>
      )}

    </InventoryModal>

    {area && !modal && <FloatingCreateButton areaId={areaId} articleTo={`/app/areas/${areaId}/articles/new`} />}

  </section>)
}
