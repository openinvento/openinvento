import { Camera, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ArticleIconPicker, getArticleIcon } from "@/components/inventory/article-icon-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { MagicArticleDraft } from "@/utils/api/inventory"
import type { ChangeEvent } from "react"

export type Draft = MagicArticleDraft & { id: string; image?: File; imagePreview?: string }


export type ArticleDraftCardProps = {
  draft: Draft
  index: number
  onChange: (id: string, changes: Partial<Draft>) => void
  onImageChange: (event: ChangeEvent<HTMLInputElement>, id: string) => void
  onRemove: (id: string) => void
}


export function ArticleDraftCard({ draft, index, onChange, onImageChange, onRemove }: ArticleDraftCardProps) {
  const { t } = useTranslation()

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-start">
      <div className="flex shrink-0 items-center justify-center gap-3 sm:w-32 sm:flex-col sm:items-center">
        
        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted sm:size-24">
          {draft.imagePreview
            ? <img src={draft.imagePreview} alt="" className="size-full object-cover" />
            : (() => {
              const Icon = getArticleIcon(draft.icon)
              return <Icon className="size-5" aria-hidden="true" />
            })()
          }
        </div>

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 sm:flex-none">
            <ArticleIconPicker value={draft.icon} hideIconPreview onChange={(icon) => onChange(draft.id, { icon })} />
          </div>
          <label htmlFor={`draft-image-${draft.id}`} className="mt-1 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-within:ring-3 focus-within:ring-ring/50" title={t("quickActions.magicImportPage.chooseArticleImage")}>
            <Camera className="size-4" />
            <span className="sr-only">{t("quickActions.magicImportPage.chooseArticleImage")}</span>
          </label>
          <input id={`draft-image-${draft.id}`} type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(event) => onImageChange(event, draft.id)} />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">{t("quickActions.magicImportPage.name")}<Input value={draft.name} maxLength={100} onChange={(event) => onChange(draft.id, { name: event.target.value })} /></label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">{t("quickActions.magicImportPage.descriptionLabel")}<Textarea value={draft.description ?? ""} maxLength={750} rows={2} onChange={(event) => onChange(draft.id, { description: event.target.value })} /></label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:w-24">{t("quickActions.magicImportPage.quantity")}<Input type="number" min="1" value={draft.quantity} onChange={(event) => onChange(draft.id, { quantity: Math.max(1, Number(event.target.value)) })} /></label>
      <Button className="self-end sm:self-start" type="button" variant="ghost" size="icon" aria-label={t("quickActions.magicImportPage.removeItem", { count: index + 1 })} onClick={() => onRemove(draft.id)}><Trash2 className="text-destructive" /></Button>
    </article>
  )
}
