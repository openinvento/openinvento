import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router"
import { ArticleCard } from "@/components/inventory/entity-cards"
import { inventoryApi, type Article, type Chest } from "@/utils/api/inventory"

function getLowStockBadge(article: Article, label: string) {
  const minimumQuantity = article.custom_fields.minimum_quantity
  return article.stock_tracking && typeof minimumQuantity === "number" && article.quantity <= minimumQuantity
    ? label
    : undefined
}

export default function ChestPage() {
  const { chestId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [chest, setChest] = useState<Chest | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [error, setError] = useState("")

  async function load() {
    if (!chestId) return
    setError("")
    try {
      const [allChests, allArticles] = await Promise.all([inventoryApi.listChests(), inventoryApi.listArticles()])
      const nextChest = allChests.find((item) => item.uuid === chestId) ?? null
      setChest(nextChest)
      setArticles(allArticles.filter((article) => article.chest === chestId))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("chests.errors.load"))
    }
  }

  useEffect(() => { void load() }, [chestId])

  async function remove(article: Article) {
    if (!window.confirm(t("chests.confirmDelete", { name: article.name }))) return
    try {
      await inventoryApi.remove("articles", article.uuid)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("chests.errors.delete"))
    }
  }

  if (!chest && !error) return <p className="text-muted-foreground">{t("chests.loading")}</p>

  return (
    <section className="w-full">
      <Link to={chest?.area ? `/app/areas/${chest.area}` : "/app/areas"} className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("chests.backToArea")}
      </Link>
      {error && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {chest && <>
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">{chest.name}</h1>
          <p className="mt-2 text-muted-foreground">{t("chests.articleCount", { count: articles.length })}</p>
        </div>
        {articles.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">{t("chests.empty")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
            {articles.map((article) => 
            <ArticleCard key={article.uuid} name={article.name} articleIcon={article.icon} articleImage={article.image} 
                subtitle={t("areas.detail.inStock", { count: article.quantity })} 
                badge={getLowStockBadge(article, t("areas.detail.lowStock"))} 
                onOpen={() => navigate(`/app/articles/${article.uuid}`)} 
                onRename={() => navigate(`/app/articles/${article.uuid}`)} 
                onDelete={() => void remove(article)} 
            />)}
          </div>
        )}
      </>}
    </section>
  )
}