import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { ArrowLeft, Save } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"
import { useTranslation } from "react-i18next"
import BaseScreen from "@/layouts/BaseScreen"
import { ArticleIconPicker } from "@/components/inventory/article-icon-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { inventoryApi, type ArticleCategory, type CategoryField, type Chest, type Inventory, type Shelf } from "@/utils/api/inventory"
import { getCategoryLabel, getFieldLabel } from "@/utils/i18n-labels"

export default function ArticleCreateScreen() {
  const { areaId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [areaName, setAreaName] = useState("")
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [chests, setChests] = useState<Chest[]>([])
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [fields, setFields] = useState<CategoryField[]>([])
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedShelf, setSelectedShelf] = useState("")
  const [selectedChest, setSelectedChest] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("Package")
  const [stockTracking, setStockTracking] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      if (!areaId) return
      try {
        const [inventories, areas, nextShelves, nextChests, nextCategories, nextFields] = await Promise.all([
          inventoryApi.listInventories(),
          inventoryApi.listAreas(),
          inventoryApi.listShelves(),
          inventoryApi.listChests(),
          inventoryApi.listCategories(),
          inventoryApi.listCategoryFields(),
        ])
        setInventory(inventories[0] ?? null)
        setAreaName(areas.find((area) => area.uuid === areaId)?.name ?? "")
        setShelves(nextShelves.filter((shelf) => shelf.area === areaId))
        setChests(nextChests.filter((chest) => chest.area === areaId))
        setCategories(nextCategories)
        setFields(nextFields)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : t("areas.detail.errors.load"))
      }
    })()
  }, [areaId, t])

  const articleFields = useMemo(() => {
    const globalFields = fields.filter((field) => field.category === null)
    const categoryFields = fields.filter((field) => field.category === selectedCategory)
    return [...globalFields, ...categoryFields.filter((field) => !globalFields.some((global) => global.key === field.key))]
  }, [fields, selectedCategory])
  const stockFields = articleFields.filter((field) => field.key === "minimum_quantity" || field.key === "stock_level")
  const otherFields = articleFields.filter((field) => field.key !== "minimum_quantity" && field.key !== "stock_level")

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!areaId || !inventory) return
    const form = new FormData(event.currentTarget)
    const name = form.get("name")?.toString().trim()
    if (!name) return

    setSaving(true)
    setError("")
    try {
      const customFields = Object.fromEntries(articleFields.map((field) => [
        field.key,
        field.field_type === "boolean"
          ? form.get(`custom_${field.key}`) === "true"
          : field.field_type === "number"
            ? (form.get(`custom_${field.key}`)?.toString() ? Number(form.get(`custom_${field.key}`)) : null)
            : form.get(`custom_${field.key}`)?.toString() || "",
      ]))
      const article = await inventoryApi.create<{ area: string }>("articles", {
        name,
        inventory: inventory.uuid,
        area: areaId,
        shelf: selectedShelf || null,
        chest: selectedChest || null,
        category: form.get("category")?.toString() || null,
        quantity: Number(form.get("quantity") || 1),
        stock_tracking: form.get("stock_tracking") === "true",
        description: form.get("description")?.toString() || "",
        icon: selectedIcon,
        custom_fields: customFields,
      })
      navigate(article.area ? `/app/areas/${article.area}` : "/app/areas")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("areas.detail.errors.save"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BaseScreen
      title={t("areas.detail.modal.new", { kind: t("areas.detail.actions.article") })}
      description={areaName}
      actions={<Button type="submit" form="article-create-form" disabled={saving}><Save /> {saving ? "Saving..." : "Save article"}</Button>}
    >
      <Link to={areaId ? `/app/areas/${areaId}` : "/app/areas"} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("areas.detail.allAreas")}
      </Link>
      {error && <p className="mb-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <form id="article-create-form" className="grid gap-6 lg:grid-cols-2" onSubmit={save}>
        <section className="grid content-start gap-5 rounded-xl border bg-muted/15 p-5">
          <h2 className="text-sm font-semibold">{t("articles.page.headings.general")}</h2>
          <Field label={t("areas.detail.fields.name")}><Input name="name" autoFocus required /></Field>
          <Field label={t("areas.detail.fields.quantity")}><Input name="quantity" type="number" min="0" defaultValue="1" /></Field>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch name="stock_tracking" value="true" checked={stockTracking} onCheckedChange={setStockTracking} />
            {t("areas.detail.fields.stockTracking")}
          </label>
          <Field label={t("areas.detail.fields.icon")}><ArticleIconPicker value={selectedIcon} onChange={setSelectedIcon} /></Field>
        </section>
        <section className="grid content-start gap-5 rounded-xl border bg-muted/15 p-5">
          <h2 className="text-sm font-semibold">{t("articles.page.headings.locationAndCategory")}</h2>
          <Field label={t("areas.detail.fields.category")}>
            <Select name="category" value={selectedCategory} onValueChange={(value) => setSelectedCategory(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("areas.detail.noCategory")}>
                    {selectedCategory ? getCategoryLabel(categories.find((category) => category.uuid === selectedCategory)?.name ?? selectedCategory) : t("areas.detail.noCategory")}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="">{t("areas.detail.noCategory")}</SelectItem>
                    {categories.map((category) => <SelectItem key={category.uuid} value={category.uuid}>{getCategoryLabel(category.name)}</SelectItem>)}
                </SelectContent>
            </Select>
          </Field>
          <Field label={t("areas.detail.fields.shelf")}>
            <Select name="shelf" value={selectedShelf} onValueChange={(value) => setSelectedShelf(value ?? "")}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("areas.detail.notOnShelf")} /></SelectTrigger>
              <SelectContent><SelectItem value="">{t("areas.detail.notOnShelf")}</SelectItem>{shelves.map((shelf) => <SelectItem key={shelf.uuid} value={shelf.uuid}>{shelf.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={t("areas.detail.fields.chest")}>
            <Select name="chest" value={selectedChest} onValueChange={(value) => setSelectedChest(value ?? "")}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("areas.detail.noChest")} /></SelectTrigger>
              <SelectContent><SelectItem value="">{t("areas.detail.noChest")}</SelectItem>{chests.map((chest) => <SelectItem key={chest.uuid} value={chest.uuid}>{chest.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </section>
        <section className="grid gap-5 rounded-xl border p-5 lg:col-span-2">
          <Field label={t("areas.detail.fields.description")}><textarea name="description" rows={5} className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" /></Field>
          {otherFields.length > 0 && <div className="grid gap-5 sm:grid-cols-2">{otherFields.map((field) => <CustomField key={field.uuid} field={field} label={getFieldLabel(field)} selectLabel={t("articles.page.fields.selectValue")} />)}</div>}
          {stockTracking && stockFields.length > 0 && <div className="grid gap-5 border-t pt-5 sm:grid-cols-2">{stockFields.map((field) => <CustomField key={field.uuid} field={field} label={getFieldLabel(field)} selectLabel={t("articles.page.fields.selectValue")} />)}</div>}
        </section>
      </form>
    </BaseScreen>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label>
}

function CustomField({ field, label, selectLabel }: { field: CategoryField; label: string; selectLabel: string }) {
  return <Field label={label}>
    {field.field_type === "select" ? <Select name={`custom_${field.key}`} defaultValue=""><SelectTrigger className="w-full"><SelectValue placeholder={selectLabel} /></SelectTrigger><SelectContent><SelectItem value="">{selectLabel}</SelectItem>{field.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
      : field.field_type === "boolean" ? <input name={`custom_${field.key}`} type="checkbox" value="true" />
        : <Input name={`custom_${field.key}`} type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"} />}
  </Field>
}
