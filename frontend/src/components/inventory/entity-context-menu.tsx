import { useEffect, useRef, useState, type ReactNode } from "react"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  children: ReactNode
  label: string
  onRename: () => void
  onDelete: () => void
}

/** Context actions work with a right click, the button, or a 550 ms touch hold. */
export function EntityContextMenu({ children, label, onRename, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const hold = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(hold.current), [])

  function clearHold() {
    window.clearTimeout(hold.current)
  }

  return (
    <div
      className="relative"
      onContextMenu={(event) => { event.preventDefault(); setOpen(true) }}
      onTouchStart={() => { hold.current = window.setTimeout(() => setOpen(true), 550) }}
      onTouchEnd={clearHold}
      onTouchCancel={clearHold}
    >
      {children}
      <Button
        aria-label={`Actions for ${label}`}
        className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        variant="ghost"
        size="icon-sm"
        onClick={(event) => { event.stopPropagation(); setOpen((value) => !value) }}
      >
        <MoreHorizontal />
      </Button>
      {open && (
        <>
          <button className="fixed inset-0 z-20 cursor-default" aria-label="Close actions" onClick={() => setOpen(false)} />
          <div className="absolute top-10 right-2 z-30 w-36 rounded-lg border bg-popover p-1 shadow-lg">
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => { setOpen(false); onRename() }}><Pencil className="size-3.5" /> Rename</button>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10" onClick={() => { setOpen(false); onDelete() }}><Trash2 className="size-3.5" /> Delete</button>
          </div>
        </>
      )}
    </div>
  )
}
