import { useTranslation } from "react-i18next"
import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Link, useNavigate } from "react-router"
import BaseScreen from "@/layouts/BaseScreen"
import { Button } from "@/components/ui/button"
import { inventoryApi, type DashboardData } from "@/utils/api/inventory"
import { getCategoryLabel } from "@/utils/i18n-labels"
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

function greetingKey(hour: number) {
  if (hour >= 5 && hour < 12) return "dashboard.greetingMorning"
  if (hour >= 12 && hour < 18) return "dashboard.greetingAfternoon"
  return "dashboard.greetingEvening"
}

// Shelves have no page of their own, they are shown on the page of their area.
function entryPath(item: DashboardData["last_added"][number]) {
  switch (item.type) {
    case "area": return `/app/areas/${item.uuid}`
    case "shelf": return item.parent ? `/app/areas/${item.parent}` : null
    case "box": return `/app/boxes/${item.uuid}`
    case "article": return `/app/articles/${item.uuid}`
  }
}

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setData(await inventoryApi.getDashboard())
        setLoadedAt(new Date())
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
      description={t(greetingKey(new Date().getHours()))}
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
          {loadedAt && (
            <span className="text-xs text-muted-foreground">
              {t("dashboard.updatedAt", { time: loadedAt.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" }) })}
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard icon={Boxes} value={data ? String(data.counts.areas) : "-"} label={t("dashboard.areas")} />
          <InfoCard icon={Package} value={data ? String(data.counts.articles) : "-"} label={t("dashboard.articles")} />
          <InfoCard icon={Tags} value={data ? String(data.counts.categories) : "-"} label={t("dashboard.categories")} />
          <InfoCard icon={Activity} value={data ? String(data.counts.added_last_7_days) : "-"} label={t("dashboard.addedLast7Days")} />
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
            onClickAction={() => navigate("/app/articles/new")}
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
          <LastAdded items={data?.last_added ?? []} loading={loading} failed={!loading && !data} language={i18n.language} t={t} />
        </DashboardPanel>

        <DashboardPanel
          icon={Tags}
          title={t("dashboard.inventoryByCategory")}
          action={t("dashboard.viewCategories")}
          navigateAction={() => navigate("/app/manage-categories-and-fields")}
        >
          <CategoryList categories={data?.category_counts ?? []} loading={loading} failed={!loading && !data} t={t} />
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

function LastAdded({ items, loading, failed, language, t }: { items: DashboardData["last_added"]; loading: boolean; failed: boolean; language: string; t: (key: string) => string }) {
  if (loading) return <p className="py-12 text-center text-sm text-muted-foreground">{t("dashboard.loading")}</p>
  if (failed) return <p className="py-12 text-center text-sm text-muted-foreground">{t("dashboard.errors.load")}</p>
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
      {items.map((item) => {
        const path = entryPath(item)
        return (
        <div key={`${item.type}-${item.uuid}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {path ? <Link to={path} className="hover:underline">{item.name}</Link> : item.name}
            </p>
            <p className="text-xs text-muted-foreground">{t(`dashboard.types.${item.type}`)}</p>
          </div>
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.created_at}>
            {new Date(item.created_at).toLocaleDateString(language)}
          </time>
        </div>
        )
      })}
    </div>
  )
}

function CategoryList({ categories, loading, failed, t }: { categories: DashboardData["category_counts"]; loading: boolean; failed: boolean; t: (key: string) => string }) {
  if (loading) return <p className="py-12 text-center text-sm text-muted-foreground">{t("dashboard.loading")}</p>
  if (failed) return <p className="py-12 text-center text-sm text-muted-foreground">{t("dashboard.errors.load")}</p>
  if (categories.length === 0) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center text-center">
        <p className="text-sm font-medium">{t("dashboard.noArticlesTitle")}</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{t("dashboard.noArticlesDescription")}</p>
      </div>
    )
  }

  const maxCount = categories[0].count
  return (
    <div className="mt-5 space-y-4">
      {categories.slice(0, 5).map((category) => (
        <div key={category.name ?? ""}>
          <div className="mb-1.5 flex justify-between gap-3 text-xs">
            <span className="truncate">{category.name === null ? t("articles.page.noCategory") : getCategoryLabel(category.name)}</span>
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