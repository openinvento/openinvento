import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { ArticleAttachment } from "@/utils/api/inventory"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"

type ArticleImageGalleryProps = {
  images: ArticleAttachment[]
  onRemove: (image: ArticleAttachment) => void
}

export function ArticleImageGallery({ images, onRemove }: ArticleImageGalleryProps) {
  const { t } = useTranslation()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  if (images.length === 0) return null

  const selectedImage = selectedIndex === null ? null : images[selectedIndex]
  const showPrevious = () => setSelectedIndex((current) => current === null ? null : (current - 1 + images.length) % images.length)
  const showNext = () => setSelectedIndex((current) => current === null ? null : (current + 1) % images.length)

  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {images.map((image, index) => (
          <div key={image.id} className="relative aspect-square overflow-hidden rounded-lg border bg-background">
            <button type="button" className="size-full" onClick={() => setSelectedIndex(index)} aria-label={t("articles.page.attachments.openImage", { name: image.original_name })}>
              <img src={image.url} alt={image.original_name} className="size-full object-cover" />
            </button>
            <button type="button" className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white hover:bg-destructive" onClick={() => onRemove(image)} aria-label={t("articles.page.attachments.remove", { name: image.original_name })}>
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <Dialog open={selectedImage !== null && selectedIndex !== null} onOpenChange={(open) => { if (!open) setSelectedIndex(null) }}>
        <DialogContent showCloseButton={false} className="grid max-w-none place-items-center border-0 bg-transparent p-4 shadow-none ring-0">
          <DialogTitle className="sr-only">{t("articles.page.attachments.gallery")}</DialogTitle>
          <DialogClose render={<Button type="button" className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70" size="icon" aria-label={t("articles.page.attachments.closeImage")} />}>
            <X className="size-5" />
          </DialogClose>
          {selectedImage && images.length > 1 && <Button type="button" className="absolute left-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70" size="icon" onClick={showPrevious} aria-label={t("articles.page.attachments.previousImage")}><ChevronLeft className="size-6" /></Button>}
          {selectedImage && <img src={selectedImage.url} alt={selectedImage.original_name} className="max-h-[calc(100dvh-2rem)] max-w-full object-contain" />}
          {selectedImage && images.length > 1 && <Button type="button" className="absolute right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70" size="icon" onClick={showNext} aria-label={t("articles.page.attachments.nextImage")}><ChevronRight className="size-6" /></Button>}
        </DialogContent>
      </Dialog>
    </>
  )
}