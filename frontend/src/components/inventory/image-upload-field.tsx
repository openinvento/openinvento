import { useId, type ChangeEvent } from "react"
import { FileImage, ImagePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FullscreenImagePreview } from "@/components/inventory/fullscreen-image-preview"

type ImageUploadFieldProps = {
  imageSrc: string | null
  fileName?: string
  alt: string
  chooseLabel: string
  replaceLabel: string
  removeLabel: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
}

export function ImageUploadField({
  imageSrc,
  fileName,
  alt,
  chooseLabel,
  replaceLabel,
  removeLabel,
  onChange,
  onRemove,
}: ImageUploadFieldProps) {
  const inputId = useId()

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-dashed bg-muted/10">
        <div className="flex items-center gap-3 p-2.5">
            {imageSrc ? (
            <FullscreenImagePreview
                imageSrc={imageSrc}
                alt={alt}
                className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-background focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            ) : (
            <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-background">
                <FileImage className="size-7 text-muted-foreground" />
            </div>
            )}
            <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2 justify-between pr-2">
                <p className="min-w-0 truncate text-sm font-medium">{fileName || (imageSrc ? alt : chooseLabel)}</p>
                <div className="flex items-center gap-2">
                <label
                htmlFor={inputId}
                className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-secondary px-2.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-within:ring-3 focus-within:ring-ring/50"
                >
                <ImagePlus className="size-3.5" />
                {imageSrc ? replaceLabel : chooseLabel}
                </label>
                {imageSrc && (
                <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={onRemove}>
                    <X />
                    {removeLabel}
                </Button>
                )}
                </div>
            </div>
            </div>
        </div>
        <input id={inputId} type="file" accept="image/jpeg,image/png" onChange={onChange} className="sr-only!" />
      </div>
    </>
  )
}
