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

  return <div className="fixed inset-0 z-50 grid place-items-end bg-black/35 p-0 sm:place-items-center sm:p-4" onMouseDown={onClose}>
    <form className="w-full rounded-t-2xl bg-background p-5 shadow-xl sm:max-w-lg sm:rounded-2xl" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
      <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><Button type="button" variant="ghost" size="icon-sm" onClick={onClose}><X /></Button></div>
      <div className="space-y-4">{children}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
        </div>
    </form>
  </div>
}
