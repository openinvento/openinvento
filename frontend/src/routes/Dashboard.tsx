import { useTranslation } from "react-i18next"
import BaseScreen from "@/layouts/BaseScreen"
import { Button } from "@/components/ui/button"
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

  return (
    <BaseScreen
      title={t("dashboard.title")}
      description={t("dashboard.greeting")}
    >
      <div className="mt-6 flex max-w-full items-center gap-2 rounded-xl border bg-background p-1.5 shadow-sm">
        <Search className="ml-2 size-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          placeholder={t("dashboard.searchPlaceholder")}
          className="min-w-0 flex-1 bg-transparent px-1.5 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button size="sm" className="hidden sm:inline-flex">
          {t("dashboard.search")}
        </Button>
      </div>

      <section className="mt-8" aria-labelledby="dashboard-overview">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="dashboard-overview" className="text-base font-semibold">
            {t("dashboard.overview")}
          </h2>
          <span className="text-xs text-muted-foreground">{t("dashboard.updatedNow")}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard icon={Boxes} value="3" label={t("dashboard.areas")} />
          <InfoCard icon={Package} value="24" label={t("dashboard.articles")} />
          <InfoCard icon={Tags} value="8" label={t("dashboard.categories")} />
          <InfoCard icon={Activity} value="12" label={t("dashboard.recentUpdates")} />
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
          />
          <ActionCard
            icon={Package}
            title={t("dashboard.addArticle")}
            description={t("dashboard.addArticleDescription")}
          />
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <DashboardPanel
          icon={Activity}
          title={t("dashboard.recentActivity")}
          action={t("dashboard.viewAll")}
        >
          <div className="flex min-h-36 flex-col items-center justify-center text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
              <Activity className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t("dashboard.noActivityTitle")}</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {t("dashboard.noActivityDescription")}
            </p>
          </div>
        </DashboardPanel>

        <DashboardPanel
          icon={Tags}
          title={t("dashboard.inventoryByCategory")}
          action={t("dashboard.viewCategories")}
        >
          <div className="flex min-h-36 flex-col items-center justify-center text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
              <Tags className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t("dashboard.noCategoryTitle")}</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {t("dashboard.noCategoryDescription")}
            </p>
          </div>
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
}: {
  icon: Icon
  title: string
  description: string
}) => {
  return (
    <Button
      variant="outline"
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
}: {
  icon: Icon
  title: string
  action: string
  children: React.ReactNode
}) => {
  return (
    <section className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </h2>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
          {action}
          <ChevronRight />
        </Button>
      </div>
      {children}
    </section>
  )
}