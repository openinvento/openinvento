import { useEffect, useState } from "react"
import { Link } from "react-router"
import { useTranslation } from "react-i18next"
import { Barcode, FilePlus2, Plus, Sparkles, X } from "lucide-react"

type InventoryQuickActionsProps = {
  articleTo: string
  areaId?: string | undefined,
  boxId?: string | undefined,
}

export function FloatingCreateButton({ articleTo, areaId, boxId }: InventoryQuickActionsProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [open])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 sm:bottom-8 sm:right-8">
      <div className={`flex flex-col items-end gap-3 transition-all duration-200 motion-reduce:transition-none ${open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`} aria-hidden={!open}>
        <Link
          to={`/app/magic-article-import?area=${areaId}&box=${boxId}`}
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Sparkles className="size-4" />
          <span>{t("quickActions.magicImport")}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t("quickActions.comingSoon")}</span>
        </Link>
        <Link
          to={`/app/barcode-article-import?area=${areaId}&box=${boxId}`}
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Barcode className="size-4" />
          {t("quickActions.createArticleFromBarcode")}
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t("quickActions.comingSoon")}</span>
        </Link>
        <Link
          to={articleTo}
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FilePlus2 className="size-4" />
          {t("quickActions.createArticle")}
        </Link>
      </div>
      <button
        type="button"
        aria-label={open ? t("quickActions.close") : t("quickActions.open")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        {open ? <X className="size-6" /> : <Plus className="size-6" />}
      </button>
    </div>
  )
}
