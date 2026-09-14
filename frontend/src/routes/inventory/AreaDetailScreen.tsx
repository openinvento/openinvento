import { useEffect, useMemo, useState, type FormEvent } from "react"
import { ArrowLeft, ChevronDown, Plus } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"
import { ArticleCard, ChestCard, ShelfCard } from "@/components/inventory/entity-cards"
import { InventoryModal } from "@/components/inventory/inventory-modal"
import { Button } from "@/components/ui/button"
import { inventoryApi, type Area, type Article, type ArticleCategory, type CategoryField, type Chest, type Inventory, type Shelf } from "@/utils/api/inventory"
import { getCategoryLabel, getFieldLabel } from "@/utils/i18n-labels"

type CreateKind = "article" | "chest" | "shelf"

export default function AreaDetailScreen() {
  const { areaId } = useParams()
  const navigate = useNavigate()

  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [area, setArea] = useState<Area | null>(null)
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [chests, setChests] = useState<Chest[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [allFields, setAllFields] = useState<CategoryField[]>([]) // Save all fields
  const [selectedCategory, setSelectedCategory] = useState("")
  const [modal, setModal] = useState<{ kind: CreateKind; item?: Shelf | Chest } | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [openShelves, setOpenShelves] = useState<Record<string, boolean>>({})

  async function load() {
    if (!areaId) return
    setError("")
    try {
      const [inventories, allAreas, allShelves, allChests, allArticles, allCategories, loadedFields] = await Promise.all([
        inventoryApi.listInventories(),
        inventoryApi.listAreas(),
        inventoryApi.listShelves(),
        inventoryApi.listChests(),
        inventoryApi.listArticles(),
        inventoryApi.listCategories(),
        inventoryApi.listCategoryFields()
      ])
      setInventory(inventories[0] ?? null)
      setArea(allAreas.find((item) => item.uuid === areaId) ?? null)
      setShelves(allShelves.filter((item) => item.area === areaId))
      setChests(allChests.filter((item) => item.area === areaId))
      setArticles(allArticles.filter((item) => item.area === areaId))
      setCategories(allCategories)
      setAllFields(loadedFields) 
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load this area.") }
  }
  useEffect(() => { void load() }, [areaId])

  const shelfSections = useMemo(() => [{ uuid: "unassigned", name: "Not on a shelf" }, ...shelves], [shelves])

  // dynamic custom fields for articles based on selected category
  const articleFields = useMemo(() => {
    const globalFields = allFields.filter((field) => field.category === null)
    if (!selectedCategory) return globalFields

    const categorySpecificFields = allFields.filter((field) => field.category === selectedCategory)

    return [
      ...globalFields,
      ...categorySpecificFields.filter((field) => !globalFields.some((gf) => gf.key === field.key))
    ]
  }, [allFields, selectedCategory])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!modal || !inventory || !areaId) return
    const form = new FormData(event.currentTarget)
    const name = form.get("name")?.toString().trim()
    if (!name) return
    const optional = (key: string) => form.get(key)?.toString() || null
    const customFields = modal.kind === "article"
      ? Object.fromEntries(articleFields.map((field) => [field.key, form.get(`custom_${field.key}`)?.toString() || ""]))
      : {}
    const basePayload = { 
      name, 
      inventory: inventory.uuid, 
      area: areaId 
    };

    let payload;

    if (modal.kind === "shelf") {
      payload = {
        ...basePayload
      };
    } else if (modal.kind === "chest") {
      payload = {
        ...basePayload,
        shelf: optional("shelf")
      };
    } else {
      payload = {
        ...basePayload,
        shelf: optional("shelf"),
        chest: optional("chest"),
        category: optional("category"),
        quantity: Number(form.get("quantity") || 1),
        description: form.get("description")?.toString() || "",
        custom_fields: customFields
      };
    }

    try { 
      if (modal.item) {
        await inventoryApi.update(modal.kind === "shelf" ? "shelves" : "chests", modal.item.uuid, payload)
      }
      else {
        await inventoryApi.create(modal.kind === "shelf" ? "shelves" : modal.kind === "chest" ? "chests" : "articles", payload); setModal(null); await load() 
      }
    }
    catch (reason) { 
      setError(reason instanceof Error ? reason.message : "Could not create item.") 
    }
    finally { setSaving(false) }
  }
  async function remove(kind: "articles" | "chests" | "shelves", uuid: string, name: string) {
    if (!window.confirm(`Delete “${name}”?`)) return
    try { await inventoryApi.remove(kind, uuid); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete item.") }
  }

  if (!area && !error) return <p className="text-muted-foreground">Loading area...</p>
  return (
  <section className="mx-auto w-full max-w-6xl">
    <Link to="/app/areas" className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      All areas
    </Link>
    {error && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {area && 
    <><div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-muted-foreground">{inventory?.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{area.name}</h1>
        <p className="mt-2 text-muted-foreground">{articles.length} articles · {chests.length} chests · {shelves.length} shelves</p>
      </div>
    
      <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setModal({ kind: "shelf" })}><Plus /> Shelf</Button>
      <Button variant="outline" onClick={() => setModal({ kind: "chest" })}><Plus /> Chest</Button>
      <Button onClick={() => { setSelectedCategory(""); setModal({ kind: "article" }) }}><Plus /> Article</Button>
      </div>
    </div>
    
    <div className="space-y-4">{shelfSections.map((shelf) => { const isOpen = openShelves[shelf.uuid] !== false; const sectionChests = chests.filter((chest) => (chest.shelf ?? "unassigned") === shelf.uuid); const sectionArticles = articles.filter((article) => (article.shelf ?? "unassigned") === shelf.uuid); return <div key={shelf.uuid} className="rounded-2xl border bg-muted/15">
    <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpenShelves((state) => ({ ...state, [shelf.uuid]: !isOpen }))}>
      <ChevronDown className={`size-4 transition ${isOpen ? "" : "-rotate-90"}`} /><span className="font-semibold">{shelf.name}</span>
      <span className="text-sm text-muted-foreground">{sectionChests.length + sectionArticles.length} items</span>
    </button>
      
    {isOpen && <div className="border-t p-4">
      
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shelf.uuid !== "unassigned" && 
      <ShelfCard name={shelf.name} subtitle="Shelf" onRename={() => setModal({ kind: "shelf", item: shelf as Shelf })} onDelete={() => void remove("shelves", shelf.uuid, shelf.name)} />}
      
      {sectionChests.map((chest) => <ChestCard key={chest.uuid} name={chest.name} subtitle={`${articles.filter((article) => article.chest === chest.uuid).length} articles`} onRename={() => setModal({ kind: "chest", item: chest })} onDelete={() => void remove("chests", chest.uuid, chest.name)} />)}
        
      {sectionArticles.map((article) => <ArticleCard key={article.uuid} name={article.name} subtitle={`${article.quantity} in stock`} badge={article.minimum_quantity !== null && article.quantity <= article.minimum_quantity ? "Low stock" : undefined} onOpen={() => navigate(`/app/articles/${article.uuid}`)} onRename={() => navigate(`/app/articles/${article.uuid}`)} onDelete={() => void remove("articles", article.uuid, article.name)} />)}
    </div>
      
    {sectionChests.length + sectionArticles.length === 0 && <p className="py-3 text-sm text-muted-foreground">Nothing stored here yet.</p>}</div>}</div> })}</div></>}

    <InventoryModal
      title={modal ? `${modal.item ? "Edit" : "New"} ${modal.kind}` : ""}
      open={modal !== null}
      submitting={saving}
      onClose={() => setModal(null)}
      onSubmit={save}
    >
      <label className="grid gap-1.5 text-sm font-medium">
        Name
        <input
          autoFocus
          name="name"
          defaultValue={modal?.item?.name}
          required
          className="h-10 rounded-lg border bg-background px-3 font-normal"
        />
      </label>

      {modal?.kind === "article" && (
        <label className="grid gap-1.5 text-sm font-medium">
          Category
          <select
            name="category"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="h-10 rounded-lg border bg-background px-3 font-normal"
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.uuid} value={category.uuid}>
                {getCategoryLabel(category.name)}
              </option>
            ))}
          </select>
        </label>
      )}

      {modal?.kind !== "shelf" && (
        <label className="grid gap-1.5 text-sm font-medium">
          Shelf
          <select
            name="shelf"
            defaultValue={modal?.item && "shelf" in modal.item ? modal.item.shelf ?? "" : ""}
            className="h-10 rounded-lg border bg-background px-3 font-normal"
          >
            <option value="">Not on a shelf</option>
            {shelves.map((shelf) => (
              <option key={shelf.uuid} value={shelf.uuid}>
                {shelf.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {modal?.kind === "article" && (
        <>
          <label className="grid gap-1.5 text-sm font-medium">
            Chest
            <select name="chest" className="h-10 rounded-lg border bg-background px-3 font-normal">
              <option value="">No chest</option>
              {chests.map((chest) => (
                <option key={chest.uuid} value={chest.uuid}>
                  {chest.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Quantity
            <input
              name="quantity"
              type="number"
              min="0"
              defaultValue="1"
              className="h-10 rounded-lg border bg-background px-3 font-normal"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Description
            <textarea
              name="description"
              rows={3}
              className="rounded-lg border bg-background p-3 font-normal"
            />
          </label>
        </>
      )}

      {/* Dynamic custom fields (Only for articles) */}
      {modal?.kind === "article" && articleFields.length > 0 && (
        <div>
          <h1 className="mb-2 mt-5 text-lg font-semibold">Other Fields</h1>
          {articleFields.map((field) => (
            <label key={field.uuid} className="grid gap-1.5 text-sm font-medium">
              {getFieldLabel(field)}
              <input
              name={`custom_${field.key}`}
              type={
                field.field_type === "number"
                  ? "number"
                  : field.field_type === "date"
                  ? "date"
                  : "text"
              }
              className="h-10 rounded-lg border bg-background px-3 font-normal"
            />
          </label>
        ))}
        </div>
      )}
    </InventoryModal>

  </section>)
}