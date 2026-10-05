import { useEffect, useState, type FormEvent } from "react"
import { ArrowLeft, ChevronDown, Save } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { removeFavorite } from "@/utils/favorites"
import { getArticleIcon } from "@/components/inventory/article-icon-picker"
import { inventoryApi, type Area, type Article, type ArticleCategory, type CategoryField, type Chest, type Shelf } from "@/utils/api/inventory"
import { getCategoryLabel, getFieldLabel } from "@/utils/i18n-labels"
import { useTranslation } from "react-i18next"

export default function ArticlePage() {
  const { articleId } = useParams()
  const navigate = useNavigate()
  const {t} = useTranslation()

  const [article, setArticle] = useState<Article | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [chests, setChests] = useState<Chest[]>([])
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [categoryFields, setCategoryFields] = useState<CategoryField[]>([])
  const [globalFields, setGlobalFields] = useState<CategoryField[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [stockTracking, setStockTracking] = useState(false)
  const [stockFieldsOpen, setStockFieldsOpen] = useState(false)

  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null)
  const [selectedChest, setSelectedChest] = useState<string | null>(null)

  useEffect(() => { void (async () => { 
    try {
      const [allArticles, nextAreas, nextShelves, nextChests, nextCategories, nextFields] = await Promise.all([inventoryApi.listArticles(), inventoryApi.listAreas(), inventoryApi.listShelves(), inventoryApi.listChests(), inventoryApi.listCategories(), inventoryApi.listCategoryFields()]); 
      const nextArticle = allArticles.find((item) => item.uuid === articleId) ?? null
      setArticle(nextArticle)
      setStockTracking(nextArticle?.stock_tracking ?? false)
      setSelectedArea(nextArticle?.area ?? null)
      setSelectedCategory(nextArticle?.category ?? null)
      setSelectedShelf(nextArticle?.shelf ?? null)
      setSelectedChest(nextArticle?.chest ?? null)
      setAreas(nextAreas); 
      setShelves(nextShelves); 
      setChests(nextChests) 
      setCategories(nextCategories)
      setCategoryFields(nextFields.filter((field) => field.category !== null))
      setGlobalFields(nextFields.filter((field) => field.category === null))
    } 
    catch (reason) {
      setError(reason instanceof Error ? reason.message : t("articles.page.errors.load")) } })()
    }, [articleId])
  
  
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!article) return
    const form = new FormData(event.currentTarget)
    const value = (key: string) => form.get(key)?.toString() || null
    setSaving(true); setError("")
    try {
      const customFields = Object.fromEntries(
        articleFields.map((field) => [
          field.key, 
          field.field_type === "boolean"
            ? form.get(`custom_${field.key}`) === "true"
            : field.field_type === "number"
              ? (form.get(`custom_${field.key}`)?.toString() ? Number(form.get(`custom_${field.key}`)) : null)
              : form.get(`custom_${field.key}`)?.toString() || ""
        ])
      );

      const next = await inventoryApi.update<Article>("articles", article.uuid, {
        name: form.get("name")?.toString().trim(),
        description: form.get("description")?.toString() || "",
        quantity: Number(form.get("quantity") || 0),
        stock_tracking: form.get("stock_tracking") === "true",
        area: value("area"),
        shelf: value("shelf"),
        chest: value("chest"),
        category: value("category"),
        custom_fields: customFields
      });

      setArticle(next);

    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("articles.page.errors.save")) 
    }
    finally { setSaving(false) }
  }

  async function remove() {
    if (!article || !window.confirm(t("articles.page.confirmDelete", { name: article.name }))) return;
    try {
      await inventoryApi.remove("articles", article.uuid); 
      removeFavorite(`article:${article.uuid}`); 
      navigate(article.area ? `/app/areas/${article.area}` : "/app/areas") 
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("articles.page.errors.delete")) 
    } 
  }


  if (!article) return <section><Link to="/app/areas" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> {t("articles.page.areas")}</Link><p className="mt-6 text-muted-foreground">{error || t("articles.page.loading")}</p></section>
  
  const relevantShelves = shelves.filter((shelf) => !selectedArea || shelf.area === selectedArea)
  const relevantChests = chests.filter((chest) => !selectedArea || chest.area === selectedArea)
  const articleFields = [...categoryFields.filter((field) => field.category === selectedCategory), ...globalFields]
  const stockFields = articleFields.filter((field) => field.key === "minimum_quantity" || field.key === "stock_level")
  const otherFields = articleFields.filter((field) => field.key !== "minimum_quantity" && field.key !== "stock_level")

  return (
    <section className="w-full">
      <Link 
        to={article.area ? `/app/areas/${article.area}` : "/app/areas"} 
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t("articles.page.backToArea")}
      </Link>

      <div className="rounded-2xl sm:p-6 lg:p-8">
        {/* Article Header */}
        <div className="mb-8 flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:size-12">
              {(() => { const Icon = getArticleIcon(article.icon); return <Icon /> })()}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t("articles.page.headings.articleDetails")}</p>
              <h1 className="truncate text-2xl font-semibold tracking-tight">{article.name}</h1>
            </div>
          </div>
          
          <div className="flex sm:shrink-0">
            <Button className="w-full sm:w-auto" variant="destructive" size="sm" onClick={() => void remove()}>
              {t("articles.page.delete")}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <form className="flex flex-col gap-6" onSubmit={save}>
          {/* Core Details and Location */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="grid content-start gap-4 rounded-xl border bg-muted/15 p-4 sm:p-5">
              <h2 className="text-sm font-semibold">{t("articles.page.headings.general")}</h2>
              <Field label={t("articles.page.fields.name")}>
                <input name="name" defaultValue={article.name} required />
              </Field>

              <Field label={t("articles.page.fields.quantity")}>
                <input name="quantity" type="number" min="0" defaultValue={article.quantity} />
              </Field>

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
                {t("articles.page.fields.stockTracking")}
              </label>
            </div>

            <div className="grid content-start gap-4 rounded-xl border bg-muted/15 p-4 sm:p-5">
              <h2 className="text-sm font-semibold">{t("articles.page.headings.locationAndCategory")}</h2>
              <Field label={t("articles.page.fields.area")}>
                <select
                  name="area"
                  value={selectedArea ?? ""}
                  onChange={(event) => {
                    setSelectedArea(event.target.value || null)
                    setSelectedShelf(null)
                    setSelectedChest(null)
                  }}
                >
                  <option value="">{t("articles.page.noArea")}</option>
                  {areas.map((area) => (
                    <option key={area.uuid} value={area.uuid}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("articles.page.fields.category")}>
                <select
                  name="category"
                  value={selectedCategory ?? ""}
                  onChange={(event) => setSelectedCategory(event.target.value || null)}
                >
                  <option value="">{t("articles.page.noCategory")}</option>
                  {categories.map((category) => <option key={category.uuid} value={category.uuid}>{getCategoryLabel(category.name)}</option>)}
                </select>
              </Field>

              <Field label={t("articles.page.fields.shelf")}>
                <select
                  name="shelf"
                  value={selectedShelf ?? ""}
                  onChange={(event) => setSelectedShelf(event.target.value || null)}
                >
                  <option value="">{t("articles.page.noShelf")}</option>
                  {relevantShelves.map((shelf) => (
                    <option key={shelf.uuid} value={shelf.uuid}>
                      {shelf.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("articles.page.fields.chest")}>
                <select
                  name="chest"
                  value={selectedChest ?? ""}
                  onChange={(event) => setSelectedChest(event.target.value || null)}
                >
                  <option value="">{t("articles.page.noChest")}</option>
                  {relevantChests.map((chest) => (
                    <option key={chest.uuid} value={chest.uuid}>
                      {chest.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

          </div>

          {/* Additional Details */}
          <div className="grid gap-5 rounded-xl border p-4 sm:p-5">
            <Field label={t("articles.page.fields.description")}>
              <textarea name="description" rows={5} defaultValue={article.description ?? ""} />
            </Field>

            {otherFields.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2">
                {otherFields.map((field) => 
                  <Field key={field.uuid} label={getFieldLabel(field)}>
                    {field.field_type === "select" ? (
                      <select name={`custom_${field.key}`} defaultValue={article.custom_fields[field.key]?.toString() ?? ""}>
                        <option value="">{t("articles.page.fields.selectValue")}</option>
                        {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : field.field_type === "boolean" ? (
                      <input
                        name={`custom_${field.key}`}
                        type="checkbox"
                        value="true"
                        defaultChecked={article.custom_fields[field.key] === true}
                      />
                    ) : (
                      <input
                        name={`custom_${field.key}`}
                        type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                        defaultValue={article.custom_fields[field.key]?.toString() ?? ""}
                      />
                    )}
                  </Field>)
                }
              </div>
            )}

            {stockTracking && stockFields.length > 0 && (
              <div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border-t pt-5 text-left text-sm font-semibold"
                  aria-expanded={stockFieldsOpen}
                  onClick={() => setStockFieldsOpen((open) => !open)}
                >
                  {t("articles.page.stockFields")}
                  <ChevronDown className={`size-4 transition-transform ${stockFieldsOpen ? "rotate-180" : ""}`} />
                </button>
                {stockFieldsOpen && (
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    {stockFields.map((field) => 
                      <Field key={field.uuid} label={getFieldLabel(field)}>
                        {field.field_type === "select" ? (
                          <select name={`custom_${field.key}`} defaultValue={article.custom_fields[field.key]?.toString() ?? ""}>
                            <option value="">{t("articles.page.fields.selectValue")}</option>
                            {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        ) : field.field_type === "boolean" ? (
                          <input
                            name={`custom_${field.key}`}
                            type="checkbox"
                            value="true"
                            defaultChecked={article.custom_fields[field.key] === true}
                          />
                        ) : (
                          <input
                            name={`custom_${field.key}`}
                            type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
                            defaultValue={article.custom_fields[field.key]?.toString() ?? ""}
                          />
                        )}
                      </Field>)
                    }
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end border-t pt-6">
            <Button className="w-full p-5 sm:w-auto" type="submit" disabled={saving}>
              <Save /> {saving ? t("articles.page.saving") : t("articles.page.saveChanges")}
            </Button>
          </div>

        </form>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { 
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <span className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_select]:h-10 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:bg-background [&_select]:px-3 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:bg-background [&_textarea]:p-3">
        {children}
      </span>
    </label>
  );
}
