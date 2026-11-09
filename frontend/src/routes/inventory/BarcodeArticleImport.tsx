import { useCallback, useEffect, useState } from "react"
import { Check, LoaderCircle, Plus, PlusIcon, Settings2, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router"
import Scanner from "@/components/qr-bar-code/Scanner"
import ThirdPartyProviderSelector from "@/components/inventory/ThirdPartyProviderSelector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import BaseScreen from "@/layouts/BaseScreen"
import { readBarcodeImportOptions, writeBarcodeImportOptions, type BarcodeImportOptions } from "@/utils/barcode-import-options"
import { inventoryApi, type ArticleCategory, type BarcodeProduct, type CodeLookupMatch, type ThirdPartyProvider } from "@/utils/api/inventory"
import { useSelectedInventory } from "@/hooks/use-selected-inventory"
import { getCategoryLabel } from "@/utils/i18n-labels"

type ScannedArticle = BarcodeProduct & {
  id: string
  added: boolean
  // Why the catalog returned nothing; the article can still be added with a name typed in.
  lookupError: string
  // Entries of this inventory that already carry the barcode. Adding stays possible: the same product can be in several places.
  existing: CodeLookupMatch[]
  // Used when the category isn't shared by the whole scan session.
  categoryId: string
}

const OPTION_KEYS: (keyof BarcodeImportOptions)[] = ["sharedCategory", "addWithoutCatalog", "checkExisting"]

export default function BarcodeArticleImportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { selectedInventory: inventory } = useSelectedInventory()
  const [providers, setProviders] = useState<ThirdPartyProvider[]>([])
  const [providerId, setProviderId] = useState("")
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  // One category for the whole scan session, e.g. "food" while scanning groceries.
  const [categoryId, setCategoryId] = useState("")
  const [options, setOptions] = useState(readBarcodeImportOptions)
  const [articles, setArticles] = useState<ScannedArticle[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState<string | null>(null)
  const area = new URLSearchParams(window.location.search).get("area")
  const box = new URLSearchParams(window.location.search).get("box")
  const handleScannerClose = useCallback(() => navigate(-1), [navigate])

  useEffect(() => {
    void (async () => {
      if (inventory) {
        const [availableProviders, availableCategories] = await Promise.all([
          inventoryApi.listThirdPartyProviders(inventory.uuid),
          inventoryApi.listCategories(),
        ])
        const barcodeProviders = availableProviders.filter((provider) => provider.type === "barcode_lookup")
        setProviders(barcodeProviders)
        if (barcodeProviders.length === 1) setProviderId(barcodeProviders[0].uuid)
        setCategories(availableCategories)
      }
    })().catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load inventory."))
  }, [inventory])

  const changeOption = (key: keyof BarcodeImportOptions, value: boolean) => {
    const next = { ...options, [key]: value }
    setOptions(next)
    writeBarcodeImportOptions(next)
  }

  const handleCodeDetected = useCallback(async (barcode: string) => {
    if (!inventory) throw new Error("Select an inventory before scanning.")
    setError("")
    const [lookup, existing] = await Promise.all([
      inventoryApi.lookupBarcodeProduct(barcode, inventory.uuid, providerId || null)
        .then((product) => {
          if (!product.name && !options.addWithoutCatalog) throw new Error(t("articleBarcodeImport.noName"))
          return { product, lookupError: product.name ? "" : t("articleBarcodeImport.noName") }
        })
        .catch((reason: unknown) => {
          if (!options.addWithoutCatalog) throw reason
          return {
            product: { barcode, name: "", brand: "", description: "", image: null, source: "" },
            lookupError: reason instanceof Error ? reason.message : t("articleBarcodeImport.notFound"),
          }
        }),
      options.checkExisting
        ? inventoryApi.lookupCode(barcode, inventory.uuid)
          .then(({ matches }) => matches.filter((match) => match.matched_by === "barcode" && match.inventory.uuid === inventory.uuid))
          .catch(() => [] as CodeLookupMatch[]) // 404: not in any inventory yet
        : Promise.resolve([] as CodeLookupMatch[]),
    ])
    setArticles((current) => current.some((item) => item.barcode === barcode)
      ? current
      : [...current, { ...lookup.product, lookupError: lookup.lookupError, existing, categoryId: "", id: crypto.randomUUID(), added: false }])
  }, [inventory, providerId, options.addWithoutCatalog, options.checkExisting, t])

  const updateArticle = (id: string, change: Partial<ScannedArticle>) =>
    setArticles((current) => current.map((item) => item.id === id ? { ...item, ...change } : item))

  const addArticle = async (article: ScannedArticle) => {
    if (!inventory || !article.name.trim()) return
    setSaving(article.id)
    setError("")
    try {
      await inventoryApi.create("articles", {
        inventory: inventory.uuid,
        name: article.name.trim(),
        description: [article.brand, article.description].filter(Boolean).join(" · "),
        quantity: 1,
        area,
        box,
        stock_tracking: false,
        category: (options.sharedCategory ? categoryId : article.categoryId) || null,
        // The type is detected from the number.
        barcodes_input: [{ kind: "", value: article.barcode }],
      })
      updateArticle(article.id, { added: true })
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add article.") }
    finally { setSaving(null) }
  }

  return (
    <BaseScreen title={t("quickActions.barcodeImport")}>
      <div className="flex gap-6 flex-wrap lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <section className="grid w-full gap-4 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="barcode-provider">{t("providerSelection.barcodeLabel")}</label>
            <div className="flex flex-wrap gap-2">
              <div className="min-w-64 flex-1"><ThirdPartyProviderSelector id="barcode-provider" label={t("providerSelection.barcodeLabel")} emptyLabel={t("providerSelection.noneConfigured")} providers={providers} providerId={providerId} onProviderChange={setProviderId} /></div>
              <Button variant="outline" onClick={() => navigate("/app/inventory-settings#third-party-providers")}>
                <PlusIcon />{t("providerSelection.addProvider")}
              </Button>
            </div>
            {providers.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{t("providerSelection.noneConfigured")}</p> : !providerId && <p className="mt-2 text-sm text-muted-foreground">{t("providerSelection.noneSelected")}</p>}
          </div>
          {options.sharedCategory && (
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="barcode-import-category">{t("articleBarcodeImport.category")}</label>
              <CategorySelect id="barcode-import-category" categories={categories} value={categoryId} onChange={setCategoryId} />
              <p className="mt-2 text-sm text-muted-foreground">{t("articleBarcodeImport.categoryHint")}</p>
            </div>
          )}
          <details className="rounded-lg border px-3 py-2">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><Settings2 className="size-4" />{t("articleBarcodeImport.options.title")}</summary>
            <div className="mt-3 grid gap-3 pb-1">
              {OPTION_KEYS.map((key) => (
                <label key={key} className="flex items-start gap-3 text-sm">
                  <Switch
                    aria-label={t(`articleBarcodeImport.options.${key}`)}
                    checked={options[key]}
                    onCheckedChange={(checked: boolean) => changeOption(key, checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium">{t(`articleBarcodeImport.options.${key}`)}</span>
                    <span className="block text-muted-foreground">{t(`articleBarcodeImport.options.${key}Hint`)}</span>
                  </span>
                </label>
              ))}
              <p className="text-xs text-muted-foreground">{t("articleBarcodeImport.options.storedInBrowser")}</p>
            </div>
          </details>
        </section>
        <Scanner onCodeDetected={handleCodeDetected} onClose={handleScannerClose} />
        <section className="min-h-40 flex-1 rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{t("articleBarcodeImport.scannedArticles")} ({articles.length})</h2>
          {error && <p role="alert" className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {articles.length === 0 ? <p className="text-sm text-muted-foreground">{t("articleBarcodeImport.description")}.</p> :
            <ul className="space-y-3">{articles.map((article) => <li key={article.id} className="flex gap-3 rounded-lg border p-3">
              {article.image && <img src={article.image} alt="" className="size-16 rounded object-contain" />}
              <div className="grid min-w-0 flex-1 gap-1">
                <Input
                  aria-label={t("articleBarcodeImport.name")}
                  placeholder={t("articleBarcodeImport.namePlaceholder")}
                  value={article.name}
                  disabled={article.added}
                  onChange={(event) => updateArticle(article.id, { name: event.target.value })}
                />
                {(article.brand || article.description) && <p className="text-sm text-muted-foreground">{[article.brand, article.description].filter(Boolean).join(" · ")}</p>}
                <p className="text-xs text-muted-foreground">{article.barcode}</p>
                {!options.sharedCategory && (
                  <CategorySelect
                    label={t("articleBarcodeImport.category")}
                    categories={categories}
                    value={article.categoryId}
                    disabled={article.added}
                    onChange={(value) => updateArticle(article.id, { categoryId: value })}
                  />
                )}
                {article.lookupError && <p className="text-xs text-muted-foreground">{article.lookupError} {t("articleBarcodeImport.enterName")}</p>}
                {article.existing.length > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {t("articleBarcodeImport.alreadyStored")}{" "}
                    {article.existing.map((match, index) => (
                      <span key={match.uuid}>
                        {index > 0 && ", "}
                        {match.type === "article" ? <Link className="underline" to={`/app/articles/${match.uuid}`}>{match.name}</Link> : match.name}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              {article.added ?
                <Check className="mt-1 size-5 text-green-600" aria-label="Added" />
                : <Button size="icon-sm" variant="outline" aria-label={`Add ${article.name || article.barcode}`} disabled={saving !== null || !article.name.trim()} onClick={() => void addArticle(article)}>
                    {saving === article.id ? <LoaderCircle className="animate-spin" /> : <Plus />}
                  </Button>}

              <Button size="icon-sm" variant="ghost" aria-label={`Remove ${article.name || article.barcode}`} disabled={saving === article.id} onClick={() => setArticles((current) => current.filter((item) => item.id !== article.id))}>
                <Trash2 />
              </Button>
            </li>)}</ul>}
        </section>
      </div>
    </BaseScreen>
  )
}

type CategorySelectProps = {
  id?: string
  label?: string
  categories: ArticleCategory[]
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}

function CategorySelect({ id, label, categories, value, disabled, onChange }: CategorySelectProps) {
  const { t } = useTranslation()
  return (
    <select
      id={id}
      aria-label={label}
      className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t("articleBarcodeImport.noCategory")}</option>
      {categories.map((category) => <option key={category.uuid} value={category.uuid}>{getCategoryLabel(category.name)}</option>)}
    </select>
  )
}
