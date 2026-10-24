import { Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"

export default function MagicArticleImportPage() {
  const { t } = useTranslation()
  return (
    <section className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="size-7" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">{t("quickActions.magicImport")}</h1>
      <p className="mt-3 text-muted-foreground">{t("quickActions.magicComingSoonMessage")}</p>
    </section>
  )
}
