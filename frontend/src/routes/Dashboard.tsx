import { useTranslation } from "react-i18next"
import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { useNavigate } from "react-router"
import BaseScreen from "@/layouts/BaseScreen"
import { Button } from "@/components/ui/button"
import { inventoryApi, type DashboardData } from "@/utils/api/inventory"
import {
  Activity,
  ArrowRight,
  Boxes,
  ChevronRight,
  Package,
  Plus,
  Search,
  Tags,
} from "lucide-react"

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        setData(await inventoryApi.getDashboard())
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : t("dashboard.errors.load"))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [t])

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuery = query.trim()
    if (trimmedQuery) navigate(`/app/search?q=${encodeURIComponent(trimmedQuery)}`)
    else navigate("/app/search")
  }

  return (
    <BaseScreen
      title={t("dashboard.title")}
      description={t("dashboard.greeting")}
    >
      <form onSubmit={search} className="mt-6 flex max-w-full items-center gap-2 rounded-xl border bg-background p-1.5 shadow-sm">
        <Search className="ml-2 size-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("dashboard.searchPlaceholder")}
          className="min-w-0 flex-1 bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="sm">
          {t("dashboard.search")}
        </Button>
      </form>

      {error && <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <section className="mt-8" aria-labelledby="dashboard-overview">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="dashboard-overview" className="text-base font-semibold">
            {t("dashboard.overview")}
          </h2>
          <span className="text-xs text-muted-foreground">{t("dashboard.updatedNow")}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard icon={Boxes} value={loading ? "-" : String(data?.counts.areas ?? 0)} label={t("dashboard.areas")} />
          <InfoCard icon={Package} value={loading ? "-" : String(data?.counts.articles ?? 0)} label={t("dashboard.articles")} />
          <InfoCard icon={Tags} value={loading ? "-" : String(data?.counts.categories ?? 0)} label={t("dashboard.categories")} />
          <InfoCard icon={Activity} value={loading ? "-" : String(data?.last_added.length ?? 0)} label={t("dashboard.recentUpdates")} />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="dashboard-actions">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="dashboard-actions" className="text-base font-semibold">
            {t("dashboard.quickActions")}
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionCard
            icon={Plus}
            title={t("dashboard.createArea")}
            description={t("dashboard.createAreaDescription")}
            onClickAction={() => navigate("/app/areas")}
          />
          <ActionCard
            icon={Package}
            title={t("dashboard.addArticle")}
            description={t("dashboard.addArticleDescription")}
            onClickAction={() => navigate("/app/areas")}
          />
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <DashboardPanel
          icon={Package}
          title={t("dashboard.lastAdded")}
          action={t("dashboard.viewAll")}
          navigateAction={() => navigate("/app/areas")}
        >
          <LastAdded items={data?.last_added ?? []} loading={loading} t={t} />
        </DashboardPanel>

        <DashboardPanel
          icon={Tags}
          title={t("dashboard.inventoryByCategory")}
          action={t("dashboard.viewCategories")}
          navigateAction={() => navigate("/app/manage-categories-and-fields")}
        >
          <CategoryList categories={data?.category_counts ?? []} loading={loading} t={t} />
        </DashboardPanel>
      </div>
    </BaseScreen>
  )
}

type Icon = typeof Boxes

const InfoCard = ({ icon: Icon, value, label }: { icon: Icon; value: string; label: string }) => {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

const ActionCard = ({
  icon: Icon,
  title,
  description,
  onClickAction,
}: { icon: Icon, title: string, description: string, onClickAction: () => void }) => {
  return (
    <Button
      variant="outline"
      onClick={onClickAction}
      className="h-auto justify-between rounded-xl p-4 text-left whitespace-normal"
    >
      <span className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4" />
        </span>
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">{description}</span>
        </span>
      </span>
      <ArrowRight className="ml-3 size-4 shrink-0 text-muted-foreground" />
    </Button>
  )
}

const DashboardPanel = ({
  icon: Icon,
  title,
  action,
  children,
  navigateAction = () => {},
}: {
  icon: Icon
  title: string
  action: string
  children: ReactNode
  navigateAction?: () => void
}) => {
  return (
    <section className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </h2>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => {navigateAction()}}>
          {action}
          <ChevronRight />
        </Button>
      </div>
      {children}
    </section>
  )
}

function LastAdded({ items, loading, t }: { items: DashboardData["last_added"]; loading: boolean; t: (key: string) => string }) {
  if (loading) return <p className="py-12 text-center text-sm text-muted-foreground">{t("dashboard.loading")}</p>
  if (items.length === 0) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center text-center">
        <p className="text-sm font-medium">{t("dashboard.noLastAddedTitle")}</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{t("dashboard.noLastAddedDescription")}</p>
      </div>
    )
  }

  return (
    <div className="mt-4 divide-y">
      {items.map((item) => (
        <div key={`${item.type}-${item.uuid}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">{t(`dashboard.types.${item.type}`)}</p>
          </div>
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.created_at}>
            {new Date(item.created_at).toLocaleDateString()}
          </time>
        </div>
      ))}
    </div>
  )
}

function CategoryList({ categories, loading, t }: { categories: DashboardData["category_counts"]; loading: boolean; t: (key: string) => string }) {
  if (loading) return <p className="py-12 text-center text-sm text-muted-foreground">{t("dashboard.loading")}</p>
  if (categories.length === 0) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center text-center">
        <p className="text-sm font-medium">{t("dashboard.noCategoryTitle")}</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{t("dashboard.noCategoryDescription")}</p>
      </div>
    )
  }

  const maxCount = categories[0].count
  return (
    <div className="mt-5 space-y-4">
      {categories.slice(0, 5).map((category) => (
        <div key={category.name}>
          <div className="mb-1.5 flex justify-between gap-3 text-xs">
            <span className="truncate">{category.name}</span>
            <span className="shrink-0 text-muted-foreground">{category.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.max((category.count / maxCount) * 100, 6)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}