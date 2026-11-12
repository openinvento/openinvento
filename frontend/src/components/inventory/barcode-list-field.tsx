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
    <div className="grid gap-2" role="group" aria-labelledby={headingId}>
      <div>
        <p id={headingId} className="flex items-center gap-2 text-sm font-medium"><BarcodeIcon className="size-4" />{t("articles.page.barcodes.title")}</p>
        <p className="text-xs text-muted-foreground">{t("articles.page.barcodes.description")}</p>
      </div>
      {value.map((draft, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <select
            aria-label={t("articles.page.barcodes.kind")}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-40 dark:bg-input/30"
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
            aria-label={t("articles.page.barcodes.remove")}
            onClick={() => onChange(value.filter((_, current) => current !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { kind: "", value: "" }])}>
          <Plus /> {t("articles.page.barcodes.add")}
        </Button>
      </div>
    </div>
  )
}
