import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from "react"
import { ArrowLeft, ChevronDown, Download, FileText, Info, Paperclip, Save, Trash2, Upload } from "lucide-react"
import { Link, useBlocker, useNavigate, useParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverDescription, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { removeFavorite } from "@/utils/favorites"
import { getArticleIcon } from "@/components/inventory/article-icon-picker"
import { ImageUploadField } from "@/components/inventory/image-upload-field"
import { FullscreenImagePreview } from "@/components/inventory/fullscreen-image-preview"
import { inventoryApi, type Area, type Article, type ArticleAttachment, type ArticleCategory, type CategoryField, type Box, type Shelf } from "@/utils/api/inventory"
import { getCategoryLabel, getFieldLabel } from "@/utils/i18n-labels"
import { useTranslation } from "react-i18next"
import { compressArticleImage } from "@/utils/article-image"
import { getMediaUrl } from "@/utils/api/base"

export default function ArticlePage() {
  const { articleId } = useParams()
  const navigate = useNavigate()
  const {t} = useTranslation()

  const [article, setArticle] = useState<Article | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [boxes, setBoxes] = useState<Box[]>([])
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
  const [selectedBox, setSelectedBox] = useState<string | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [imageChanged, setImageChanged] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<ArticleAttachment[]>([])
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const attachmentInputId = useId()
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const blocker = useBlocker(unsavedChanges)

  useEffect(() => {
    if (blocker.state !== "blocked") return
    setError(t("articles.page.errors.unsavedChanges"))
    blocker.reset()
  }, [blocker, t])

  useEffect(() => {
    if (!unsavedChanges) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warnBeforeUnload)
    return () => window.removeEventListener("beforeunload", warnBeforeUnload)
  }, [unsavedChanges])

  useEffect(() => {
    if (!pendingNavigation || unsavedChanges) return
    navigate(pendingNavigation)
    setPendingNavigation(null)
  }, [navigate, pendingNavigation, unsavedChanges])

  useEffect(() => { void (async () => { 
    try {
      const [allArticles, nextAreas, nextShelves, nextBoxes, nextCategories, nextFields] = await Promise.all([inventoryApi.listArticles(), inventoryApi.listAreas(), inventoryApi.listShelves(), inventoryApi.listBoxes(), inventoryApi.listCategories(), inventoryApi.listCategoryFields()]);
      const nextArticle = allArticles.find((item) => item.uuid === articleId) ?? null
      setArticle(nextArticle)
      if (nextArticle) setAttachments(await inventoryApi.listArticleAttachments(nextArticle.uuid))
      setStockTracking(nextArticle?.stock_tracking ?? false)
      setSelectedArea(nextArticle?.area ?? null)
      setSelectedCategory(nextArticle?.category ?? null)
      setSelectedShelf(nextArticle?.shelf ?? null)
      setSelectedBox(nextArticle?.box ?? null)
      setAreas(nextAreas); 
      setShelves(nextShelves); 
      setBoxes(nextBoxes)
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
      const payload = new FormData()
      payload.append("name", form.get("name")?.toString().trim() || "")
      payload.append("identifier", form.get("identifier")?.toString().trim() || "")
      payload.append("description", form.get("description")?.toString() || "")
      payload.append("quantity", form.get("quantity")?.toString() || "0")
      payload.append("stock_tracking", String(stockTracking))
      payload.append("area", value("area") || "")
      payload.append("shelf", value("shelf") || "")
      payload.append("box", value("box") || "")
      payload.append("category", value("category") || "")
      payload.append("custom_fields", JSON.stringify(customFields))
      if (image) payload.append("image", image)
      else if (imageChanged) payload.append("image", "")

      const next = await inventoryApi.update<Article>("articles", article.uuid, payload)

      setUnsavedChanges(false)
      setArticle(next);
      window.dispatchEvent(new Event("openinvento:inventory-moved"))

      // Redirect to the area page if the article was saved successfully
      setPendingNavigation(next.area ? `/app/areas/${next.area}` : "/app/areas")

    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("articles.page.errors.save")) 
    }
    finally { setSaving(false) }
  }

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressArticleImage(file)
      setImage(compressed)
      setImagePreview(URL.createObjectURL(compressed))
      setImageChanged(true)
      setError("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not process the selected image.")
      event.target.value = ""
    }
  }

  function removeImage() {
    setImage(null)
    setImagePreview(null)
    setImageChanged(true)
  }

  async function uploadAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !article) return
    setAttachmentBusy(true)
    setError("")
    try {
      const uploaded = await inventoryApi.uploadArticleAttachment(article.uuid, file)
      setAttachments((current) => [...current, uploaded])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("articles.page.attachments.uploadError"))
    } finally {
      setAttachmentBusy(false)
    }
  }

  async function deleteAttachment(attachment: ArticleAttachment) {
    try {
      await inventoryApi.removeArticleAttachment(attachment.id)
      setAttachments((current) => current.filter((item) => item.id !== attachment.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("articles.page.attachments.deleteError"))
    }
  }

  async function remove() {
    if (!article || !window.confirm(t("articles.page.confirmDelete", { name: article.name }))) return;
    try {
      await inventoryApi.remove("articles", article.uuid); 
      window.dispatchEvent(new Event("openinvento:inventory-moved"))
      removeFavorite(`article:${article.uuid}`); 
      setUnsavedChanges(false)
      setPendingNavigation(article.area ? `/app/areas/${article.area}` : "/app/areas") 
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("articles.page.errors.delete")) 
    } 
  }


  if (!article) return <section><Link to="/app/areas" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> {t("articles.page.areas")}</Link><p className="mt-6 text-muted-foreground">{error || t("articles.page.loading")}</p></section>
  
  const relevantShelves = shelves.filter((shelf) => !selectedArea || shelf.area === selectedArea)
  const relevantBoxes = boxes.filter((box) => !selectedArea || box.area === selectedArea)
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
            {imagePreview || getMediaUrl(article.image) ? (
              <FullscreenImagePreview
                imageSrc={imagePreview || getMediaUrl(article.image) || ""}
                alt={article.name}
                className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary focus-visible:ring-3 focus-visible:ring-ring/50 sm:size-12"
              />
            ) : (
              <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary sm:size-12">
                {(() => { const Icon = getArticleIcon(article.icon); return <Icon /> })()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t("articles.page.headings.articleDetails")}</p>
              <h1 className="truncate text-2xl font-semibold tracking-tight">{article.name}</h1>
            </div>
          </div>
          
          <div className="flex gap-2 sm:shrink-0">
            <Button className="flex-1 sm:flex-none px-4 py-4" variant="destructive" onClick={() => void remove()}>
              {t("articles.page.delete")}
            </Button>
            <Button className="flex-1 sm:flex-none px-8 py-4" type="submit" form="article-details-form" disabled={saving}>
              <Save /> {saving ? t("articles.page.saving") : t("articles.page.saveChanges")}
            </Button>

          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <form id="article-details-form" className="flex flex-col gap-6" onChange={() => setUnsavedChanges(true)} onSubmit={save}>
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
              <Field label={t("articles.page.fields.image")}>
                <ImageUploadField
                  imageSrc={imagePreview || getMediaUrl(article.image) || null}
                  fileName={image?.name}
                  alt={t("articles.page.fields.image")}
                  chooseLabel={t("articles.page.fields.chooseImage")}
                  replaceLabel={t("articles.page.fields.replaceImage")}
                  removeLabel={t("articles.page.fields.removeImage")}
                  onChange={(event) => void chooseImage(event)}
                  onRemove={removeImage}
                />
              </Field>
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
                    setSelectedBox(null)
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

              <Field label={t("articles.page.fields.box")}>
                <select
                  name="box"
                  value={selectedBox ?? ""}
                  onChange={(event) => setSelectedBox(event.target.value || null)}
                >
                  <option value="">{t("articles.page.noBox")}</option>
                  {relevantBoxes.map((box) => (
                    <option key={box.uuid} value={box.uuid}>
                      {box.name}
                    </option>
                  ))}
                </select>
              </Field>
              
              <Field label={
                <span className="inline-flex items-center gap-1">
                  {t("articles.page.fields.identifier")}
                  <Popover>
                    <PopoverTrigger render={<Button variant="ghost" size="icon-xs" aria-label={t("articles.page.fields.identifierHelpLabel")} />}>
                      <Info />
                    </PopoverTrigger>
                    <PopoverContent align="start">
                      <PopoverDescription>{t("articles.page.fields.identifierHelp")}</PopoverDescription>
                    </PopoverContent>
                  </Popover>
                </span>
              }>
                <input name="identifier" maxLength={30} defaultValue={article.identifier} />
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
                      <Switch
                        name={`custom_${field.key}`}
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
                          <Switch
                            name={`custom_${field.key}`}
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

        </form>

        <section className="mt-8 grid gap-4 rounded-xl border bg-muted/15 p-4 sm:p-5" aria-labelledby="article-attachments-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="article-attachments-heading" className="flex items-center gap-2 text-sm font-semibold"><Paperclip className="size-4" />{t("articles.page.attachments.title")}</h2>
            <label htmlFor={attachmentInputId} className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80">
              <Upload className="size-4" />{attachmentBusy ? t("articles.page.attachments.uploading") : t("articles.page.attachments.add")}
            </label>
            <input id={attachmentInputId} type="file" accept=".pdf,.doc,.docx,.odt,.txt,.rtf,.xls,.xlsx,.csv,.ppt,.pptx,.zip" onChange={(event) => void uploadAttachment(event)} className="sr-only" disabled={attachmentBusy} />
          </div>
          {attachments.length === 0 ? <p className="text-sm text-muted-foreground">{t("articles.page.attachments.empty")}</p> : (
            <ul className="grid gap-2">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-lg border bg-background p-3">
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{attachment.original_name}<span className="ml-2 text-xs text-muted-foreground">{(attachment.size / 1024).toFixed(0)} KB</span></span>
                  <a className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" href={getMediaUrl(attachment.url) ?? undefined} download aria-label={t("articles.page.attachments.download", { name: attachment.original_name })}><Download className="size-4" /></a>
                  <button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => void deleteAttachment(attachment)} aria-label={t("articles.page.attachments.remove", { name: attachment.original_name })}><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) { 
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <span className="[&_input]:h-10 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_select]:h-10 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:bg-background [&_select]:px-3 [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:bg-background [&_textarea]:p-3">
        {children}
      </span>
    </label>
  );
}
