import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import { ArrowLeft, Save } from "lucide-react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { useTranslation } from "react-i18next"
import BaseScreen from "@/layouts/BaseScreen"
import { ArticleIconPicker } from "@/components/inventory/article-icon-picker"
import { ImageUploadField } from "@/components/inventory/image-upload-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { getSelectedInventory, inventoryApi, type ArticleCategory, type CategoryField, type Box, type Inventory, type Shelf } from "@/utils/api/inventory"
import { getCategoryLabel, getFieldLabel } from "@/utils/i18n-labels"
import { compressArticleImage } from "@/utils/article-image"

export default function ArticleCreateScreen() {
  const { areaId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [areaName, setAreaName] = useState("")
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [boxes, setBoxes] = useState<Box[]>([])
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [fields, setFields] = useState<CategoryField[]>([])
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedShelf, setSelectedShelf] = useState("")
  const [selectedBox, setSelectedBox] = useState(() => searchParams.get("box") ?? "")
  const [selectedIcon, setSelectedIcon] = useState("Package")
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [stockTracking, setStockTracking] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      if (!areaId) return
      try {
        const [inventories, areas, nextShelves, nextBoxes, nextCategories, nextFields] = await Promise.all([
          inventoryApi.listInventories(),
          inventoryApi.listAreas(),
          inventoryApi.listShelves(),
          inventoryApi.listBoxes(),
          inventoryApi.listCategories(),
          inventoryApi.listCategoryFields(),
        ])
        setInventory(getSelectedInventory(inventories))
        setAreaName(areas.find((area) => area.uuid === areaId)?.name ?? "")
        setShelves(nextShelves.filter((shelf) => shelf.area === areaId))
        setBoxes(nextBoxes.filter((box) => box.area === areaId))
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
      const fieldValues = articleFields.map((field) => {
        const rawValue = form.get(`custom_${field.key}`)?.toString()
        return {
          field: field.uuid,
          key: field.key,
          value: field.field_type === "boolean"
            ? rawValue === "true"
            : field.field_type === "number"
              ? rawValue ? Number(rawValue) : null
              : rawValue || "",
          notify_on_date: field.field_type === "date" && form.get(`notify_date_${field.key}`) === "true",
        }
      })
      const payload = new FormData()
      payload.append("name", name)
      /* payload.append("identifier", form.get("identifier")?.toString().trim() || "") */
      payload.append("inventory", inventory.uuid)
      payload.append("area", areaId)
      payload.append("shelf", selectedShelf)
      payload.append("box", selectedBox)
      payload.append("category", selectedCategory)
      payload.append("quantity", form.get("quantity")?.toString() || "1")
      payload.append("stock_tracking", String(stockTracking))
      payload.append("description", form.get("description")?.toString() || "")
      payload.append("icon", selectedIcon)
      payload.append("field_values", JSON.stringify(fieldValues))
      if (image) payload.append("image", image)

      const article = await inventoryApi.create<{ area: string }>("articles", payload)
      navigate(article.area ? `/app/areas/${article.area}` : "/app/areas")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("areas.detail.errors.save"))
    } finally {
      setSaving(false)
    }
  }

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressArticleImage(file)
      setImage(compressed)
      setImagePreview(URL.createObjectURL(compressed))
      setError("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not process the selected image.")
      event.target.value = ""
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
          <Field label={t("areas.detail.fields.icon")}>
            <ArticleIconPicker value={selectedIcon} onChange={setSelectedIcon} />
          </Field>
          <Field label={t("articles.page.fields.image")}>
            <ImageUploadField
              imageSrc={imagePreview}
              fileName={image?.name}
              alt={t("articles.page.fields.image")}
              chooseLabel={t("articles.page.fields.chooseImage")}
              replaceLabel={t("articles.page.fields.replaceImage")}
              removeLabel={t("articles.page.fields.removeImage")}
              onChange={(event) => void chooseImage(event)}
              onRemove={() => { setImage(null); setImagePreview(null) }}
            />
          </Field>
        </section>
        <section className="grid content-start gap-5 rounded-xl border bg-muted/15 p-5">
          <h2 className="text-sm font-semibold">{t("articles.page.headings.locationAndCategory")}</h2>
          {/* <Field label={t("articles.page.fields.identifier")}><Input name="identifier" maxLength={30} /></Field> */}
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
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("areas.detail.notOnShelf")}>
                  {selectedShelf ? shelves.find((shelf) => shelf.uuid === selectedShelf)?.name ?? selectedShelf : t("areas.detail.notOnShelf")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent><SelectItem value="">{t("areas.detail.notOnShelf")}</SelectItem>{shelves.map((shelf) => <SelectItem key={shelf.uuid} value={shelf.uuid}>{shelf.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={t("areas.detail.fields.box")}>
            <Select name="box" value={selectedBox} onValueChange={(value) => setSelectedBox(value ?? "")}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("areas.detail.noBox")} /></SelectTrigger>
              <SelectContent><SelectItem value="">{t("areas.detail.noBox")}</SelectItem>{boxes.map((box) => <SelectItem key={box.uuid} value={box.uuid}>{box.name}</SelectItem>)}</SelectContent>
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
  const { t } = useTranslation()
  return <Field label={label}>
    {field.field_type === "select" ? <Select name={`custom_${field.key}`} defaultValue=""><SelectTrigger className="w-full"><SelectValue placeholder={selectLabel} /></SelectTrigger><SelectContent><SelectItem value="">{selectLabel}</SelectItem>{field.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
      : field.field_type === "boolean" ? <Switch name={`custom_${field.key}`} value="true" />
        : field.field_type === "date" ? <div className="grid gap-2">
          <Input name={`custom_${field.key}`} type="date" />
          <span className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-normal">
            <span>{t("categoriesAndFields.dateNotifications")}</span>
            <Switch name={`notify_date_${field.key}`} value="true" aria-label={t("categoriesAndFields.dateNotifications")} />
          </span>
        </div>
          : <Input name={`custom_${field.key}`} type={field.field_type === "number" ? "number" : "text"} />}
  </Field>
}
