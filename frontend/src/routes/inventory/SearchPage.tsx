import BaseScreen from "@/layouts/BaseScreen"
import { useEffect, useState, type FormEvent } from "react"
import { LoaderCircle, Package, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { inventoryApi, type Article, type Inventory } from "@/utils/api/inventory"

export default function SearchPage() {
  const { t } = useTranslation()
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [inventoryId, setInventoryId] = useState("")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadInventories() {
      try {
        const nextInventories = await inventoryApi.listInventories()
        setInventories(nextInventories)
        setInventoryId(nextInventories[0]?.uuid ?? "")
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : t("search.errors.load"))
      } finally {
        setLoading(false)
      }
    }

    void loadInventories()
  }, [t])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuery = query.trim()
    if (!trimmedQuery || !inventoryId) return

    setSearching(true)
    setError("")
    try {
      setResults(await inventoryApi.searchInventory(trimmedQuery, inventoryId))
    } catch (reason) {
      setResults([])
      setError(reason instanceof Error ? reason.message : t("search.errors.search"))
    } finally {
      setSearching(false)
    }
  }

  return (
    <BaseScreen title={t("search.searchTitle")} description={t("search.searchDescription")}>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            className="h-10 pl-9"
            disabled={loading || inventories.length === 0}
          />
        </div>
        {inventories.length > 1 && (
          <select
            value={inventoryId}
            onChange={(event) => { setInventoryId(event.target.value); setResults([]) }}
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            aria-label={t("search.inventory")}
          >
            {inventories.map((inventory) => <option key={inventory.uuid} value={inventory.uuid}>{inventory.name}</option>)}
          </select>
        )}
        <Button type="submit" disabled={searching || !query.trim() || !inventoryId}>
          {searching ? <LoaderCircle className="animate-spin" /> : <Search />}
          {t("search.submit")}
        </Button>
      </form>

      {error && <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">{t("search.loading")}</p>
      ) : inventories.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">{t("search.noInventory")}</p>
      ) : results.length > 0 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((article) => (
            <Link key={article.uuid} to={`/app/articles/${article.uuid}`} className="rounded-2xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-4 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Package className="size-5" /></div>
              <h2 className="font-semibold">{article.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{article.identifier}</p>
              <p className="mt-3 text-sm">{t("search.quantity", { count: article.quantity })}</p>
            </Link>
          ))}
        </div>
      ) : query.trim() ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">{t("search.empty")}</p>
      ) : (
        <p className="mt-10 text-center text-sm text-muted-foreground">{t("search.prompt")}</p>
      )}
    </BaseScreen>
  )
}
