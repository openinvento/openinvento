/* Reusable modal component for inventory management, allowing users to input data and submit forms. It handles opening and closing of the modal, including keyboard accessibility for closing with the Escape key. The modal displays a title, content passed as children, and buttons for canceling or submitting the form. */

import { type FormEvent, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import i18n from "@/i18n";

type Props = { title: string; open: boolean; submitting?: boolean; submitLabel?: string; submittingLabel?: string; children: ReactNode; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }

export function InventoryModal({ title, open, submitting, submitLabel = i18n.t("save"), submittingLabel = i18n.t("saving"), children, onClose, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] w-[min(92vw,48rem)] max-w-none overflow-hidden p-0">
        <form className="flex min-h-0 max-h-[90dvh] flex-col" onSubmit={onSubmit}>
          <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogDescription className="sr-only">{title}</DialogDescription>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6 [&_input]:text-base [&_select]:text-base [&_textarea]:text-base">
            <div className="space-y-4">{children}</div>
          </div>
          <DialogFooter className="shrink-0 rounded-none border-t bg-background px-4 py-3 sm:px-6 sm:py-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? submittingLabel : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
