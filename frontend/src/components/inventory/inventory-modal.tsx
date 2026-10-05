/* Reusable modal component for inventory management, allowing users to input data and submit forms. It handles opening and closing of the modal, including keyboard accessibility for closing with the Escape key. The modal displays a title, content passed as children, and buttons for canceling or submitting the form. */

import { useEffect, type FormEvent, type ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = { title: string; open: boolean; submitting?: boolean; children: ReactNode; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }

export function InventoryModal({ title, open, submitting, children, onClose, onSubmit }: Props) {
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [open, onClose])
  if (!open) return null

  return (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-0 sm:grid sm:place-items-center sm:p-6 lg:p-10" onMouseDown={onClose}>
    <form
      className="mx-auto flex min-h-dvh w-full flex-col bg-background shadow-2xl ring-1 ring-black/10 sm:min-h-0 sm:max-h-[90dvh] sm:w-[min(92vw,48rem)] sm:rounded-2xl"
      onSubmit={onSubmit}
      onMouseDown={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-modal-title"
    >
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4">
        <h2 id="inventory-modal-title" className="text-lg font-semibold">{title}</h2>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close modal"><X /></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6">
        <div className="space-y-4">{children}</div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-4 py-3 sm:px-6 sm:py-4">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
      </div>
    </form>
  </div>
  )
}
