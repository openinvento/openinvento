import { useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"

type FullscreenImagePreviewProps = {
  imageSrc: string
  alt: string
  className?: string
  children?: ReactNode
}

export function FullscreenImagePreview({ imageSrc, alt, className, children }: FullscreenImagePreviewProps) {
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setFullscreen(true)}
        aria-label={`Open ${alt} fullscreen`}
      >
        {children ?? <img src={imageSrc} alt={alt} className="size-full object-cover" />}
      </button>
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent showCloseButton={false} className="grid max-w-none place-items-center border-0 bg-transparent p-4 shadow-none ring-0">
          <DialogTitle className="sr-only">{alt} fullscreen preview</DialogTitle>
          <DialogClose render={<Button type="button" className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 focus-visible:ring-3 focus-visible:ring-white/70" size="icon" aria-label="Close fullscreen preview" />}>
            <X className="size-5" />
          </DialogClose>
          <img
            src={imageSrc}
            alt={alt}
            className="max-h-[calc(100dvh-2rem)] max-w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
