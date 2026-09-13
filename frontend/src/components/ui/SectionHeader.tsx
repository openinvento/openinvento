import type { ReactNode } from "react"


export function SectionHeader({ title, action }: { title: string; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {action}
    </div>
  )
}