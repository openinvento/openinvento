import * as LucideIcons from "lucide-react"
import { useState } from "react"
import type { LucideIcon } from "lucide-react"

const iconMap = LucideIcons as unknown as Record<string, LucideIcon>
const nonIconExports = new Set(["Icon", "DynamicIcon"])

export const articleIconOptions = Object.entries(iconMap)
  .filter(([name, icon]) => /^[A-Z]/.test(name) && !nonIconExports.has(name) && typeof icon !== "string")
  .sort(([left], [right]) => left.localeCompare(right))

export function getArticleIcon(name: string | null | undefined): LucideIcon {
  return (name && !nonIconExports.has(name) && iconMap[name]) || LucideIcons.Package
}

type Props = { value: string; onChange: (value: string) => void }

export function ArticleIconPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState(false)
  const selectedIcon = getArticleIcon(value)
  const filteredIcons = articleIconOptions.filter(([name]) => name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2 text-left transition hover:border-foreground/20"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {(() => { const Icon = selectedIcon; return <Icon className="size-5" /> })()}
        </span>
        <span className="min-w-0 flex-1 text-sm">{value || "Package"}</span>
        <span className="text-xs text-muted-foreground">{expanded ? "Hide icons" : "Choose icon"}</span>
      </button>
      {expanded && <>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons"
          aria-label="Search icons"
          className="h-9 min-w-0 rounded-lg border bg-background px-3 text-sm outline-none"
        />
        <div className="grid max-h-52 grid-cols-6 gap-1 overflow-y-auto rounded-lg border bg-background p-2 sm:grid-cols-8">
          {filteredIcons.map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              title={name}
              aria-label={name}
              aria-pressed={name === value}
              onClick={() => onChange(name)}
              className={`grid aspect-square place-items-center rounded-lg transition hover:bg-primary/10 hover:text-primary ${name === value ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : ""}`}
            >
              <Icon className="size-5" />
            </button>
          ))}
        </div>
      </>}
    </div>
  )
}