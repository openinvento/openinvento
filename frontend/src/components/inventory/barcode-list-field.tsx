import { useId } from "react"
import { Barcode as BarcodeIcon, Plus, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { BarcodeKind } from "@/utils/api/inventory"
import { BARCODE_KINDS, type BarcodeDraft } from "@/utils/barcodes"

type BarcodeListFieldProps = {
  value: BarcodeDraft[]
  onChange: (value: BarcodeDraft[]) => void
}

/** Edits the barcodes printed on a product, such as EAN, ISBN or PZN. The inputs have no name, so they stay out of the form data. */
export function BarcodeListField({ value, onChange }: BarcodeListFieldProps) {
  const { t } = useTranslation()
  const headingId = useId()

  function update(index: number, change: Partial<BarcodeDraft>) {
    onChange(value.map((draft, current) => (current === index ? { ...draft, ...change } : draft)))
  }

  return (
    <div className="grid gap-3" role="group" aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p id={headingId} className="flex items-center gap-2 text-sm font-medium">
            <BarcodeIcon className="size-5 text-muted-foreground" />
            {t("articles.page.barcodes.title")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("articles.page.barcodes.description")}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { kind: "", value: "" }])}>
          <Plus /> {t("articles.page.barcodes.add")}
        </Button>
      </div>

      {value.length > 0 && (
        <div className="grid gap-2">
          {value.map((draft, index) => (
            <div key={index} className="grid grid-cols-[minmax(8rem,10rem)_minmax(0,1fr)_auto] items-center gap-2">
          <select
            aria-label={t("articles.page.barcodes.kind")}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            value={draft.kind}
            onChange={(event) => update(index, { kind: event.target.value as BarcodeKind | "" })}
          >
            {BARCODE_KINDS.map((kind) => <option key={kind || "auto"} value={kind}>{t(`articles.page.barcodes.kinds.${kind || "auto"}`)}</option>)}
          </select>
          <Input
            aria-label={t("articles.page.barcodes.value")}
            className="min-w-0 flex-1"
            inputMode={draft.kind === "ean" || draft.kind === "pzn" ? "numeric" : "text"}
            maxLength={80}
            value={draft.value}
            onChange={(event) => update(index, { value: event.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={t("articles.page.barcodes.remove")}
            onClick={() => onChange(value.filter((_, current) => current !== index))}
          >
            <X />
          </Button>
            </div>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <Button type="button" variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={() => onChange([...value, { kind: "", value: "" }])}>
          <Plus /> {t("articles.page.barcodes.add")}
        </Button>
      )}
    </div>
  )
}
