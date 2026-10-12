import { useEffect, useState, type ReactNode } from "react"
import { X } from "lucide-react"

type FullscreenImagePreviewProps = {
  imageSrc: string
  alt: string
  className?: string
  children?: ReactNode
}

export function FullscreenImagePreview({ imageSrc, alt, className, children }: FullscreenImagePreviewProps) {
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!fullscreen) return
    const close = (event: KeyboardEvent) => event.key === "Escape" && setFullscreen(false)
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [fullscreen])

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
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"
          onClick={() => setFullscreen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} fullscreen preview`}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 focus-visible:ring-3 focus-visible:ring-white/70"
            onClick={() => setFullscreen(false)}
            aria-label="Close fullscreen preview"
          >
            <X className="size-5" />
          </button>
          <img
            src={imageSrc}
            alt={alt}
            className="max-h-[calc(100dvh-2rem)] max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
