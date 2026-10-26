import { useCallback, useEffect, useState } from "react"
import { Check, LoaderCircle, Plus, PlusIcon, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import Scanner from "@/components/qr-bar-code/Scanner"
import ThirdPartyProviderSelector from "@/components/inventory/ThirdPartyProviderSelector"
import { Button } from "@/components/ui/button"
import BaseScreen from "@/layouts/BaseScreen"
import { getSelectedInventory, inventoryApi, type BarcodeProduct, type Inventory, type ThirdPartyProvider } from "@/utils/api/inventory"

type ScannedArticle = BarcodeProduct & { id: string; added: boolean }

export default function BarcodeArticleImportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [providers, setProviders] = useState<ThirdPartyProvider[]>([])
  const [providerId, setProviderId] = useState("")
  const [articles, setArticles] = useState<ScannedArticle[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState<string | null>(null)
  const area = new URLSearchParams(window.location.search).get("area")
  const box = new URLSearchParams(window.location.search).get("box")
  const handleScannerClose = useCallback(() => navigate(-1), [navigate])

  useEffect(() => {
    void inventoryApi.listInventories().then(async (items) => {
      const selected = getSelectedInventory(items)
      setInventory(selected)
      if (selected) {
        const availableProviders = (await inventoryApi.listThirdPartyProviders(selected.uuid)).filter((provider) => provider.type === "barcode_lookup")
        setProviders(availableProviders)
        if (availableProviders.length === 1) setProviderId(availableProviders[0].uuid)
      }
    })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load inventory."))
  }, [])

  const handleCodeDetected = useCallback(async (barcode: string) => {
    if (!inventory) throw new Error("Select an inventory before scanning.")
    setError("")
    const product = await inventoryApi.lookupBarcodeProduct(barcode, inventory.uuid, providerId || null)
    if (!product.name) throw new Error("The product has no name in Open Food Facts.")
    setArticles((current) => current.some((item) => item.barcode === barcode) ? current : [...current, { ...product, id: crypto.randomUUID(), added: false }])
  }, [inventory, providerId])

  const addArticle = async (article: ScannedArticle) => {
    if (!inventory) return
    setSaving(article.id)
    setError("")
    try {
      await inventoryApi.create("articles", { inventory: inventory.uuid, name: article.name, description: [article.brand, article.description, `Barcode: ${article.barcode}`].filter(Boolean).join(" · "), quantity: 1, area, box, stock_tracking: false })
      setArticles((current) => current.map((item) => item.id === article.id ? { ...item, added: true } : item))
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add article.") }
    finally { setSaving(null) }
  }

  return (
    <BaseScreen title={t("quickActions.barcodeImport")}>
      <div className="flex gap-6 flex-wrap lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <section className="w-full rounded-xl border bg-card p-4 shadow-sm">
          <label className="mb-2 block text-sm font-medium" htmlFor="barcode-provider">{t("providerSelection.barcodeLabel")}</label>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-64 flex-1"><ThirdPartyProviderSelector id="barcode-provider" label={t("providerSelection.barcodeLabel")} emptyLabel={t("providerSelection.noneConfigured")} providers={providers} providerId={providerId} onProviderChange={setProviderId} /></div>
            <Button variant="outline" onClick={() => navigate("/app/inventory-settings#third-party-providers")}>
              <PlusIcon />{t("providerSelection.addProvider")}
            </Button>
          </div>
          {providers.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{t("providerSelection.noneConfigured")}</p> : !providerId && <p className="mt-2 text-sm text-muted-foreground">{t("providerSelection.noneSelected")}</p>}
        </section>
        <Scanner onCodeDetected={handleCodeDetected} onClose={handleScannerClose} />
        <section className="min-h-40 flex-1 rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{t("articleBarcodeImport.scannedArticles")} ({articles.length})</h2>
          {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {articles.length === 0 ? <p className="text-sm text-muted-foreground">{t("articleBarcodeImport.description")}.</p> :
            <ul className="space-y-3">{articles.map((article) => <li key={article.id} className="flex gap-3 rounded-lg border p-3">
              {article.image && <img src={article.image} alt="" className="size-16 rounded object-contain" />}
              <div className="min-w-0 flex-1"><p className="font-medium">{article.name}</p><p className="text-sm text-muted-foreground">{[article.brand, article.description].filter(Boolean).join(" · ") || article.barcode}</p><p className="text-xs text-muted-foreground">{article.barcode}</p></div>
              {article.added ? 
                <Check className="mt-1 size-5 text-green-600" aria-label="Added" /> 
                : <Button size="icon-sm" variant="outline" aria-label={`Add ${article.name}`} disabled={saving !== null} onClick={() => void addArticle(article)}>
                    {saving === article.id ? <LoaderCircle className="animate-spin" /> : <Plus />}
                  </Button>}
                  
              <Button size="icon-sm" variant="ghost" aria-label={`Remove ${article.name}`} disabled={saving === article.id} onClick={() => setArticles((current) => current.filter((item) => item.id !== article.id))}>
                <Trash2 />
              </Button>
            </li>)}</ul>}
        </section>
      </div>
    </BaseScreen>
  )
}
