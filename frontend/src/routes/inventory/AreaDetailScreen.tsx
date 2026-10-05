import { useEffect, useMemo, useState, type FormEvent } from "react"
import { ArrowLeft, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router"
import { ArticleCard, ChestCard } from "@/components/inventory/entity-cards"
import { ArticleIconPicker } from "@/components/inventory/article-icon-picker"
import { InventoryModal } from "@/components/inventory/inventory-modal"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { inventoryApi, type Area, type Article, type ArticleCategory, type CategoryField, type Chest, type Inventory, type Shelf } from "@/utils/api/inventory"
import { getCategoryLabel, getFieldLabel } from "@/utils/i18n-labels"

type CreateKind = "article" | "chest" | "shelf"

function getLowStockBadge(article: Article, label: string) {
  const minimumQuantity = article.custom_fields.minimum_quantity
  return article.stock_tracking && typeof minimumQuantity === "number" && article.quantity <= minimumQuantity
    ? label
    : undefined
}

export default function AreaDetailScreen() {
  const { areaId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [area, setArea] = useState<Area | null>(null)
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [chests, setChests] = useState<Chest[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [allFields, setAllFields] = useState<CategoryField[]>([]) // Save all fields
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("Package")
  const [modal, setModal] = useState<{ kind: CreateKind; item?: Shelf | Chest } | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [openShelves, setOpenShelves] = useState<Record<string, boolean>>({})
  const [stockTracking, setStockTracking] = useState(false)
  const [stockFieldsOpen, setStockFieldsOpen] = useState(false)

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
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("areas.detail.errors.load")) }
  }
  useEffect(() => { void load() }, [areaId])

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
  const stockFields = articleFields.filter((field) => field.key === "minimum_quantity" || field.key === "stock_level")
  const otherFields = articleFields.filter((field) => field.key !== "minimum_quantity" && field.key !== "stock_level")

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!modal || !inventory || !areaId) return
    const form = new FormData(event.currentTarget)
    const name = form.get("name")?.toString().trim()
    if (!name) return
    const optional = (key: string) => form.get(key)?.toString() || null
    const customFields = modal.kind === "article"
      ? Object.fromEntries(articleFields.map((field) => [
        field.key,
        field.field_type === "boolean"
          ? form.get(`custom_${field.key}`) === "true"
          : field.field_type === "number"
            ? (form.get(`custom_${field.key}`)?.toString() ? Number(form.get(`custom_${field.key}`)) : null)
            : form.get(`custom_${field.key}`)?.toString() || "",
      ]))
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
        stock_tracking: form.get("stock_tracking") === "true",
        description: form.get("description")?.toString() || "",
        icon: selectedIcon,
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
      setError(reason instanceof Error ? reason.message : t("areas.detail.errors.save")) 
    }
    finally { setSaving(false) }
  }
  async function remove(kind: "articles" | "chests" | "shelves", uuid: string, name: string) {
    if (!window.confirm(t("areas.detail.confirmDelete", { name }))) return
    try { await inventoryApi.remove(kind, uuid); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : t("areas.detail.errors.delete")) }
  }

  if (!area && !error) return <p className="text-muted-foreground">{t("areas.detail.loading")}</p>
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
        <p className="mt-2 text-muted-foreground">{t("areas.detail.summary", { articles: articles.length, chests: chests.length, shelves: shelves.length })}</p>
      </div>
    
      <div className="flex flex-wrap gap-2">
      <Button className="p-4" variant="outline" onClick={() => setModal({ kind: "shelf" })}><Plus /> {t("areas.detail.actions.shelf")}</Button>
      <Button className="p-4" variant="outline" onClick={() => setModal({ kind: "chest" })}><Plus /> {t("areas.detail.actions.chest")}</Button>
      <Button className="p-4" onClick={() => { setSelectedCategory(""); setSelectedIcon("Package"); setStockTracking(false); setStockFieldsOpen(false); setModal({ kind: "article" }) }}><Plus /> {t("areas.detail.actions.article")}</Button>
      </div>
    </div>
    
    {/* Inventory contents */}
    <div className="space-y-6">
      {/* Articles can live directly in an area without a shelf. */}
      {articles.filter((article) => article.shelf === null).length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t("areas.detail.articles")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
            {articles.filter((article) => article.shelf === null).map((article) => (
              <ArticleCard
                key={article.uuid}
                name={article.name}
                articleIcon={article.icon}
                subtitle={t("areas.detail.inStock", { count: article.quantity })}
                badge={getLowStockBadge(article, t("areas.detail.lowStock"))}
                onOpen={() => navigate(`/app/articles/${article.uuid}`)}
                onRename={() => navigate(`/app/articles/${article.uuid}`)}
                onDelete={() => void remove("articles", article.uuid, article.name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Shelves are optional containers for grouped inventory. */}
      {shelves.map((shelf) => {
        const isOpen = openShelves[shelf.uuid] !== false
        const sectionChests = chests.filter((chest) => chest.shelf === shelf.uuid)
        const sectionArticles = articles.filter((article) => article.shelf === shelf.uuid)
        return (
          <div key={shelf.uuid} className="rounded-2xl border bg-muted/15">
            <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpenShelves((state) => ({ ...state, [shelf.uuid]: !isOpen }))}>
              <ChevronDown className={`size-4 transition ${isOpen ? "" : "-rotate-90"}`} />
              <span className="font-semibold">{shelf.name}</span>
              <span className="text-sm text-muted-foreground">{t("areas.detail.itemCount", { count: sectionChests.length + sectionArticles.length })}</span>
              <span className="ml-auto flex items-center gap-1">
                <Button
                  title={t("areas.detail.renameShelf")} aria-label={t("areas.detail.renameShelf")}
                  variant="ghost" size="icon-xs" 
                  onClick={(event) => { event.stopPropagation(); setModal({ kind: "shelf", item: shelf }) }}
                >
                  <Pencil />
                </Button>
                <Button
                  title={t("areas.detail.deleteShelf")} aria-label={t("areas.detail.deleteShelf")}
                  variant="ghost" size="icon-xs" 
                  onClick={(event) => { event.stopPropagation(); void remove("shelves", shelf.uuid, shelf.name) }}
                >
                  <Trash2 />
                </Button>
              </span>
            </button>

            {isOpen && <div className="border-t p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
                {sectionChests.map((chest) => <ChestCard key={chest.uuid} name={chest.name} subtitle={t("areas.detail.articleCount", { count: articles.filter((article) => article.chest === chest.uuid).length })} onRename={() => setModal({ kind: "chest", item: chest })} onDelete={() => void remove("chests", chest.uuid, chest.name)} />)}
                {sectionArticles.map((article) => <ArticleCard key={article.uuid} name={article.name} articleIcon={article.icon} subtitle={t("areas.detail.inStock", { count: article.quantity })} badge={getLowStockBadge(article, t("areas.detail.lowStock"))} onOpen={() => navigate(`/app/articles/${article.uuid}`)} onRename={() => navigate(`/app/articles/${article.uuid}`)} onDelete={() => void remove("articles", article.uuid, article.name)} />)}
              </div>
              {sectionChests.length + sectionArticles.length === 0 && <p className="py-3 text-sm text-muted-foreground">{t("areas.detail.nothingStored")}</p>}
            </div>}
          </div>
        )
      })}

      {chests.filter((chest) => chest.shelf === null).length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t("areas.detail.otherItems")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
            {chests.filter((chest) => chest.shelf === null).map((chest) => <ChestCard key={chest.uuid} name={chest.name} subtitle={t("areas.detail.articleCount", { count: articles.filter((article) => article.chest === chest.uuid).length })} onRename={() => setModal({ kind: "chest", item: chest })} onDelete={() => void remove("chests", chest.uuid, chest.name)} />)}
          </div>
        </div>
      )}
    </div></>}

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

      {modal?.kind === "article" && (
        <label className="grid gap-1.5 text-sm font-medium">
          {t("areas.detail.fields.category")}
          <select
            name="category"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="h-10 rounded-lg border bg-background px-3 font-normal"
          >
            <option value="">{t("areas.detail.noCategory")}</option>
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
          {t("areas.detail.fields.shelf")}
          <select
            name="shelf"
            defaultValue={modal?.item && "shelf" in modal.item ? modal.item.shelf ?? "" : ""}
            className="h-10 rounded-lg border bg-background px-3 font-normal"
          >
            <option value="">{t("areas.detail.notOnShelf")}</option>
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
            {t("areas.detail.fields.icon")}
            <ArticleIconPicker value={selectedIcon} onChange={setSelectedIcon} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("areas.detail.fields.chest")}
            <select name="chest" className="h-10 rounded-lg border bg-background px-3 font-normal">
              <option value="">{t("areas.detail.noChest")}</option>
              {chests.map((chest) => (
                <option key={chest.uuid} value={chest.uuid}>
                  {chest.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            {t("areas.detail.fields.quantity")}
            <input
              name="quantity"
              type="number"
              min="0"
              defaultValue="1"
              className="h-10 rounded-lg border bg-background px-3 font-normal"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch
              name="stock_tracking"
              value="true"
              checked={stockTracking}
              onCheckedChange={(checked) => {
                setStockTracking(checked)
                if (!checked) setStockFieldsOpen(false)
              }}
            />
            {t("areas.detail.fields.stockTracking")}
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            {t("areas.detail.fields.description")}
            <textarea
              name="description"
              rows={3}
              className="rounded-lg border bg-background p-3 font-normal"
            />
          </label>
        </>
      )}

      {/* Dynamic custom fields (Only for articles) */}
      {modal?.kind === "article" && otherFields.length > 0 && (
        <div>
          <h1 className="mb-2 mt-5 text-lg font-semibold">{t("areas.detail.otherFields")}</h1>
          {otherFields.map((field) => (
            <label key={field.uuid} className="grid gap-1.5 text-sm font-medium">
              {getFieldLabel(field)}
              {field.field_type === "select" ? (
                <select name={`custom_${field.key}`} className="h-10 rounded-lg border bg-background px-3 font-normal">
                  <option value="">{t("articles.page.fields.selectValue")}</option>
                  {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : field.field_type === "boolean" ? (
                <input name={`custom_${field.key}`} type="checkbox" value="true" />
              ) : (
                <input
                  name={`custom_${field.key}`}
                  type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                  className="h-10 rounded-lg border bg-background px-3 font-normal"
                />
              )}
          </label>
        ))}
        </div>
      )}

      {modal?.kind === "article" && stockTracking && stockFields.length > 0 && (
        <div>
          <button
            type="button"
            className="mt-5 flex w-full items-center justify-between border-t pt-5 text-left text-sm font-semibold"
            aria-expanded={stockFieldsOpen}
            onClick={() => setStockFieldsOpen((open) => !open)}
          >
            {t("articles.page.stockFields")}
            <ChevronDown className={`size-4 transition-transform ${stockFieldsOpen ? "rotate-180" : ""}`} />
          </button>
          {stockFieldsOpen && (
            <div className="mt-3 grid gap-3">
              {stockFields.map((field) => (
                <label key={field.uuid} className="grid gap-1.5 text-sm font-medium">
                  {getFieldLabel(field)}
                  {field.field_type === "select" ? (
                    <select name={`custom_${field.key}`} className="h-10 rounded-lg border bg-background px-3 font-normal">
                      <option value="">{t("articles.page.fields.selectValue")}</option>
                      {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : field.field_type === "boolean" ? (
                    <input name={`custom_${field.key}`} type="checkbox" value="true" />
                  ) : (
                    <input
                      name={`custom_${field.key}`}
                      type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                      className="h-10 rounded-lg border bg-background px-3 font-normal"
                    />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </InventoryModal>

  </section>)
}