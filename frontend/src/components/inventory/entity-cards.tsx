import { Archive, Box, DoorOpen, Package, type LucideIcon } from "lucide-react"
import { EntityContextMenu } from "./entity-context-menu"

type CardProps = { name: string; subtitle: string; icon: LucideIcon; onOpen?: () => void; onRename: () => void; onDelete: () => void; badge?: string }


function EntityCard({ name, subtitle, icon: Icon, onOpen, onRename, onDelete, badge }: CardProps) {
  return (
    <EntityContextMenu label={name} onRename={onRename} onDelete={onDelete}><article onClick={onOpen} className="group relative min-h-32 cursor-pointer rounded-2xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-5 flex items-start justify-between">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>{badge && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{badge}</span>}</div>
      <h3 className="pr-8 font-semibold">{name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </article>
    </EntityContextMenu>
  )
}
export const AreaCard = (props: Omit<CardProps, "icon">) => <EntityCard {...props} icon={DoorOpen} />
export const ArticleCard = (props: Omit<CardProps, "icon">) => <EntityCard {...props} icon={Package} />
export const ChestCard = (props: Omit<CardProps, "icon">) => <EntityCard {...props} icon={Box} />
export const ShelfCard = (props: Omit<CardProps, "icon">) => <EntityCard {...props} icon={Archive} />
