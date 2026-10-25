import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Camera, ImagePlus, LoaderCircle, Package, PlusIcon, Save, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import BaseScreen from "@/layouts/BaseScreen"
import ThirdPartyProviderSelector from "@/components/inventory/ThirdPartyProviderSelector"
import { Button } from "@/components/ui/button"
import { getSelectedInventory, inventoryApi, type Inventory, type ThirdPartyProvider } from "@/utils/api/inventory"
import { useNavigate } from "react-router"
import { type Draft, ArticleDraftCard } from "@/components/inventory/ArticleDraftIcon"


export default function MagicArticleImportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const cameraInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [providers, setProviders] = useState<ThirdPartyProvider[]>([])
  const [providerId, setProviderId] = useState("")
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
    void inventoryApi.listInventories().then(async (items) => {
      const selected = getSelectedInventory(items)
      setInventory(selected)
      if (selected) {
        const availableProviders = (await inventoryApi.listThirdPartyProviders(selected.uuid)).filter((provider) => provider.type === "object_detection_llm")
        setProviders(availableProviders)
        if (availableProviders.length === 1) setProviderId(availableProviders[0].uuid)
      }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : t("quickActions.magicImportPage.errors.loadInventories")))
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
      const result = await inventoryApi.magicImport(inventory.uuid, image, providerId || null)
      setDrafts(result.articles.map((article, index) => ({ ...article, id: `${Date.now()}-${index}` })))
      if (result.articles.length === 0) setNotice(t("quickActions.magicImportPage.noObjects"))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("quickActions.magicImportPage.errors.analyze"))
    } finally {
      setBusy(false)
    }
  }

  function updateDraft(id: string, changes: Partial<Draft>) {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...changes } : draft))
  }

  function chooseDraftImage(event: ChangeEvent<HTMLInputElement>, id: string) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!(file.type === "image/jpeg" || file.type === "image/png")) {
      setError(t("quickActions.magicImportPage.errors.invalidImage"))
      return
    }
    const reader = new FileReader()
    reader.onload = () => updateDraft(id, { image: file, imagePreview: String(reader.result) })
    reader.readAsDataURL(file)
    setError("")
  }

  async function saveAll() {
    if (!inventory || drafts.length === 0) return
    setSaving(true)
    setError("")
    setNotice("")
    const results = await Promise.allSettled(drafts.map(({ id: _id, image, imagePreview: _imagePreview, ...article }) => {
      const payload = new FormData()
      Object.entries({ ...article, inventory: inventory.uuid, area: areaId, box: boxId }).forEach(([key, value]) => {
        if (value !== undefined && value !== null) payload.append(key, String(value))
      })
      if (image) payload.append("image", image)
      return inventoryApi.create("articles", payload)
    }))
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
    <BaseScreen title={t("quickActions.magicImport")} description={t("quickActions.magicImportPage.description")}>
      <div className="mx-auto grid gap-6">
        <section className="grid gap-5 rounded-xl  bg-muted/15 p-5 md:grid-cols-[minmax(0,1fr)_minmax(250px,0.8fr)] md:items-center">
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="magic-provider">{t("providerSelection.magicLabel")}</label>
            <div className="mb-4 flex flex-wrap gap-2">
              <div className="min-w-64 flex-1"><ThirdPartyProviderSelector id="magic-provider" label={t("providerSelection.magicLabel")} emptyLabel={t("providerSelection.noneConfigured")} providers={providers} providerId={providerId} onProviderChange={setProviderId} /></div>
              <Button variant="outline" onClick={() => navigate("/app/inventory-settings#third-party-providers")}>
                <PlusIcon />{t("providerSelection.addProvider")}
              </Button>
            </div>
            {providers.length === 0 ? <p className="mb-3 text-sm text-muted-foreground">{t("providerSelection.noneConfigured")}</p> 
            : !providerId && <p className="mb-3 text-sm text-muted-foreground">{t("providerSelection.noneSelected")}</p>}
            
            <div className="flex items-center gap-3 mb-3 mt-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></div>
              <h2 className="text-lg font-semibold">{t("quickActions.magicImportPage.importFromPhoto")}</h2>
            </div>

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
          {image && 
          <div className="flex items-center justify-between gap-3 md:col-span-2">
            <span className="truncate text-sm text-muted-foreground">{image.name}</span>

            <Button className="px-8 py-5" onClick={() => void analyze()} disabled={busy || !inventory || !providerId}>{busy 
            ? <><LoaderCircle className="animate-spin" />{t("quickActions.magicImportPage.analyzing")}</> 
            : <><Sparkles />{t("quickActions.magicImportPage.identifyItems")}</>}</Button></div>}
        </section>

        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm">{notice}</p>}

        {drafts.length > 0 && <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold">{t("quickActions.magicImportPage.reviewArticles")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("quickActions.magicImportPage.reviewDescription")}</p>
          </div>
          {drafts.map((draft, index) => 
          <ArticleDraftCard
            key={draft.id}
            draft={draft}
            index={index}
            onChange={updateDraft}
            onImageChange={chooseDraftImage}
            onRemove={(id) => setDrafts((current) => current.filter((item) => item.id !== id))}
          />)}
          <div className="flex justify-end">
            <Button className="px-8 py-5" onClick={() => void saveAll()} disabled={saving || drafts.some((draft) => !draft.name.trim())}>
              <Save />{saving ? t("quickActions.magicImportPage.saving") : t("quickActions.magicImportPage.createArticles", { count: drafts.length })}
            </Button>
          </div>
        </section>}
      </div>
    </BaseScreen>
  )
}
