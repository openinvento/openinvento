import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Camera, ImagePlus, LoaderCircle, Package, Save, Sparkles, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import BaseScreen from "@/layouts/BaseScreen"
import { ArticleIconPicker, getArticleIcon } from "@/components/inventory/article-icon-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getSelectedInventory, inventoryApi, type Inventory, type MagicArticleDraft } from "@/utils/api/inventory"
import { useNavigate } from "react-router"

type Draft = MagicArticleDraft & { id: string }

export default function MagicArticleImportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const cameraInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState("")
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const areaId = new URLSearchParams(window.location.search).get("area") || undefined
  const boxId = new URLSearchParams(window.location.search).get("box") || undefined

  useEffect(() => {
    void inventoryApi.listInventories().then((items) => setInventory(getSelectedInventory(items))).catch((reason) => setError(reason instanceof Error ? reason.message : t("quickActions.magicImportPage.errors.loadInventories")))
  }, [])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!(["image/jpeg", "image/png"].includes(file.type))) {
      setError(t("quickActions.magicImportPage.errors.invalidImage"))
      event.target.value = ""
      return
    }
    setImage(file)
    setPreview(URL.createObjectURL(file))
    setDrafts([])
    setError("")
    setNotice("")
  }

  async function analyze() {
    if (!image || !inventory) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const result = await inventoryApi.magicImport(inventory.uuid, image)
      setDrafts(result.articles.map((article, index) => ({ ...article, id: `${Date.now()}-${index}` })))
      if (result.articles.length === 0) setNotice(t("quickActions.magicImportPage.noObjects"))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("quickActions.magicImportPage.errors.analyze"))
    } finally {
      setBusy(false)
    }
  }

  function updateDraft(id: string, changes: Partial<MagicArticleDraft>) {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...changes } : draft))
  }

  async function saveAll() {
    if (!inventory || drafts.length === 0) return
    setSaving(true)
    setError("")
    setNotice("")
    const results = await Promise.allSettled(drafts.map(({ id: _id, ...article }) => 
      inventoryApi.create("articles", { ...article, inventory: inventory.uuid, area: areaId, box: boxId })))
    const failed = results.filter((result) => result.status === "rejected")
    const saved = results.length - failed.length
    setDrafts((current) => failed.length ? current.filter((_, index) => results[index]?.status === "rejected") : [])
    setNotice(failed.length
      ? t(saved === 1 ? "quickActions.magicImportPage.createdOneWithFailures" : "quickActions.magicImportPage.createdManyWithFailures", { saved, failed: failed.length })
      : t(saved === 1 ? "quickActions.magicImportPage.createdOne" : "quickActions.magicImportPage.createdMany", { saved }))
    if (failed.length) setError(failed[0].status === "rejected" && failed[0].reason instanceof Error ? failed[0].reason.message : t("quickActions.magicImportPage.errors.saveSome"))
    setSaving(false)
    navigate(-1)
  }

  return (
    <BaseScreen title={t("quickActions.magicImport")} description={t("quickActions.magicImportPage.description")} actions={drafts.length > 0 ? <Button onClick={() => void saveAll()} disabled={saving}><Save />{saving ? t("quickActions.magicImportPage.saving") : t("quickActions.magicImportPage.createArticles", { count: drafts.length })}</Button> : undefined}>
      <div className="mx-auto grid max-w-5xl gap-6">
        <section className="grid gap-5 rounded-xl border bg-muted/15 p-5 md:grid-cols-[minmax(0,1fr)_minmax(250px,0.8fr)] md:items-center">
          <div>
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></div>
            <h2 className="text-lg font-semibold">{t("quickActions.magicImportPage.importFromPhoto")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("quickActions.magicImportPage.instructions")}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => cameraInput.current?.click()} disabled={!inventory || busy}><Camera />{t("quickActions.magicImportPage.takePhoto")}</Button>
              <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={!inventory || busy}><ImagePlus />{t("quickActions.magicImportPage.chooseImage")}</Button>
              <input ref={cameraInput} type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" onChange={chooseImage} />
              <input ref={fileInput} type="file" accept="image/jpeg,image/png" className="sr-only" onChange={chooseImage} />
            </div>
            {!inventory && <p className="mt-3 text-sm text-muted-foreground">{t("quickActions.magicImportPage.noInventory")}</p>}
          </div>
          <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-background">
            {preview ? <img src={preview} alt={t("quickActions.magicImportPage.selectedPhoto")} className="max-h-72 w-full object-contain" /> : <div className="text-center text-muted-foreground"><Package className="mx-auto mb-2 size-8" /><span className="text-sm">{t("quickActions.magicImportPage.previewPlaceholder")}</span></div>}
          </div>
          {image && <div className="flex items-center justify-between gap-3 md:col-span-2"><span className="truncate text-sm text-muted-foreground">{image.name}</span><Button onClick={() => void analyze()} disabled={busy || !inventory}>{busy ? <><LoaderCircle className="animate-spin" />{t("quickActions.magicImportPage.analyzing")}</> : <><Sparkles />{t("quickActions.magicImportPage.identifyItems")}</>}</Button></div>}
        </section>

        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm">{notice}</p>}

        {drafts.length > 0 && <section className="grid gap-4">
          <div><h2 className="text-xl font-semibold">{t("quickActions.magicImportPage.reviewArticles")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("quickActions.magicImportPage.reviewDescription")}</p></div>
          {drafts.map((draft, index) => <article key={draft.id} className="grid gap-4 rounded-xl border p-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(120px,0.3fr)_auto] sm:items-start">
            <div className="grid gap-2">
              {(() => { const Icon = getArticleIcon(draft.icon); return <span className="grid size-9 place-items-center rounded-lg bg-muted" aria-hidden="true"><Icon className="size-5" /></span> })()}
              <ArticleIconPicker value={draft.icon} onChange={(icon) => updateDraft(draft.id, { icon })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">{t("quickActions.magicImportPage.name")}<Input value={draft.name} maxLength={100} onChange={(event) => updateDraft(draft.id, { name: event.target.value })} /></label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">{t("quickActions.magicImportPage.descriptionLabel")}<Textarea value={draft.description ?? ""} maxLength={750} rows={2} onChange={(event) => updateDraft(draft.id, { description: event.target.value })} /></label>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">{t("quickActions.magicImportPage.quantity")}<Input type="number" min="1" value={draft.quantity} onChange={(event) => updateDraft(draft.id, { quantity: Math.max(1, Number(event.target.value)) })} /></label>
            <Button type="button" variant="ghost" size="icon" aria-label={t("quickActions.magicImportPage.removeItem", { count: index + 1 })} onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}><Trash2 className="text-destructive" /></Button>
          </article>)}
          <div className="flex justify-end"><Button onClick={() => void saveAll()} disabled={saving || drafts.some((draft) => !draft.name.trim())}><Save />{saving ? t("quickActions.magicImportPage.saving") : t("quickActions.magicImportPage.createArticles", { count: drafts.length })}</Button></div>
        </section>}
      </div>
    </BaseScreen>
  )
}
