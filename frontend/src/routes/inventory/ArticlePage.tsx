import { useEffect, useState, type FormEvent } from "react"
import { ArrowLeft, Package, Save } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { removeFavorite } from "@/utils/favorites"
import { inventoryApi, type Area, type Article, type ArticleCategory, type CategoryField, type Chest, type Shelf } from "@/utils/api/inventory"
import { getCategoryLabel, getFieldLabel } from "@/utils/i18n-labels"

export default function ArticlePage() {
  const { articleId } = useParams()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [chests, setChests] = useState<Chest[]>([])
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [categoryFields, setCategoryFields] = useState<CategoryField[]>([])
  const [globalFields, setGlobalFields] = useState<CategoryField[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null)
  const [selectedChest, setSelectedChest] = useState<string | null>(null)

  useEffect(() => { void (async () => { 
    try {
      const [allArticles, nextAreas, nextShelves, nextChests, nextCategories, nextFields] = await Promise.all([inventoryApi.listArticles(), inventoryApi.listAreas(), inventoryApi.listShelves(), inventoryApi.listChests(), inventoryApi.listCategories(), inventoryApi.listCategoryFields()]); 
      const nextArticle = allArticles.find((item) => item.uuid === articleId) ?? null
      setArticle(nextArticle)
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
      setError(reason instanceof Error ? reason.message : "Could not load article.") } })()
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
          form.get(`custom_${field.key}`)?.toString() || ""
        ])
      );

      const next = await inventoryApi.update<Article>("articles", article.uuid, {
        name: form.get("name")?.toString().trim(),
        description: form.get("description")?.toString() || "",
        quantity: Number(form.get("quantity") || 0),
        minimum_quantity: value("minimum_quantity") ? Number(value("minimum_quantity")) : null,
        area: value("area"),
        shelf: value("shelf"),
        chest: value("chest"),
        category: value("category"),
        custom_fields: customFields
      });

      setArticle(next);

    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save article.") 
    }
    finally { setSaving(false) }
  }

  async function remove() {
    if (!article || !window.confirm(`Delete “${article.name}”?`)) return;
    try {
      await inventoryApi.remove("articles", article.uuid); 
      removeFavorite(`article:${article.uuid}`); 
      navigate(article.area ? `/app/areas/${article.area}` : "/app/areas") 
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete article.") 
    } 
  }


  if (!article) return <section><Link to="/app/areas" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Areas</Link><p className="mt-6 text-muted-foreground">{error || "Loading article..."}</p></section>
  
  const relevantShelves = shelves.filter((shelf) => !selectedArea || shelf.area === selectedArea)
  const relevantChests = chests.filter((chest) => !selectedArea || chest.area === selectedArea)
  const articleFields = [...categoryFields.filter((field) => field.category === selectedCategory), ...globalFields]

  return (
    <section className="mx-auto w-full max-w-3xl">
      <Link 
        to={article.area ? `/app/areas/${article.area}` : "/app/areas"} 
        className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to area
      </Link>

      <div className="rounded-2xl border bg-card p-5 sm:p-7">
        
        <div className="mb-7 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Package />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Article details</p>
              <h1 className="text-2xl font-semibold">{article.name}</h1>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={() => void remove()}>
              Delete
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <form className="grid gap-5" onSubmit={save}>
          
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name">
              <input name="name" defaultValue={article.name} required />
            </Field>

            <Field label="Quantity">
              <input name="quantity" type="number" min="0" defaultValue={article.quantity} />
            </Field>

            <Field label="Minimum quantity">
              <input name="minimum_quantity" type="number" min="0" defaultValue={article.minimum_quantity ?? ""} />
            </Field>

            <Field label="Area">
              <select
                name="area"
                value={selectedArea ?? ""}
                onChange={(event) => {
                  setSelectedArea(event.target.value || null)
                  setSelectedShelf(null)
                  setSelectedChest(null)
                }}
              >
                <option value="">No area</option>
                {areas.map((area) => (
                  <option key={area.uuid} value={area.uuid}>
                    {area.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Category">
              <select
                name="category"
                value={selectedCategory ?? ""}
                onChange={(event) => setSelectedCategory(event.target.value || null)}
              >
                <option value="">No category</option>
                {categories.map((category) => <option key={category.uuid} value={category.uuid}>{getCategoryLabel(category.name)}</option>)}
              </select>
            </Field>

            <Field label="Shelf">
              <select
                name="shelf"
                value={selectedShelf ?? ""}
                onChange={(event) => setSelectedShelf(event.target.value || null)}
              >
                <option value="">No shelf</option>
                {relevantShelves.map((shelf) => (
                  <option key={shelf.uuid} value={shelf.uuid}>
                    {shelf.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Chest">
              <select
                name="chest"
                value={selectedChest ?? ""}
                onChange={(event) => setSelectedChest(event.target.value || null)}
              >
                <option value="">No chest</option>
                {relevantChests.map((chest) => (
                  <option key={chest.uuid} value={chest.uuid}>
                    {chest.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Description">
            <textarea name="description" rows={5} defaultValue={article.description ?? ""} />
          </Field>

          {articleFields.map((field) => 
            <Field key={field.uuid} label={getFieldLabel(field)}>
              <input 
                name={`custom_${field.key}`}
                type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"} 
                defaultValue={article.custom_fields[field.key]?.toString() ?? ""} 
              />
            </Field>)
          }

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              <Save /> {saving ? "Saving..." : "Save changes"}
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
      <span className="[&_input]:h-10 [&_input]:rounded-lg [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_select]:h-10 [&_select]:rounded-lg [&_select]:border [&_select]:bg-background [&_select]:px-3 [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:bg-background [&_textarea]:p-3">
        {children}
      </span>
    </label>
  );
}
