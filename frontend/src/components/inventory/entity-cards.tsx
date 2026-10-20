import { Archive, Box, DoorOpen, type LucideIcon } from "lucide-react"
import { EntityContextMenu } from "./entity-context-menu"
import { getArticleIcon } from "./article-icon-picker"
import { getMediaUrl } from "@/utils/api/base"
import type { InventoryViewMode } from "./view-mode"

type CardProps = { name: string; subtitle?: string | null; icon: LucideIcon; onOpen?: () => void; onRename?: () => void; onDelete?: () => void; badge?: string; viewMode?: InventoryViewMode }


function EntityCard({ name, subtitle=null, icon: Icon, onOpen, onRename, onDelete, badge, image, viewMode = "grid" }: CardProps & { image?: string | null }) {
  const imageUrl = getMediaUrl(image)
  return (
    <EntityContextMenu label={name} onRename={onRename} onDelete={onDelete}><article onClick={onOpen} className={`group relative cursor-pointer rounded-2xl border bg-card transition hover:border-foreground/20 ${viewMode === "list" ? "flex min-h-16 items-center gap-3 p-3" : "min-h-32 p-4"}`}>
      <div className={viewMode === "list" ? "flex shrink-0 items-center" : "mb-5 flex items-start justify-between"}>
        <span className="grid size-10 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary">
          {imageUrl ? <img src={imageUrl} alt="" className="size-full object-cover" /> : <Icon className="size-5" />}
        </span>
        {badge && viewMode === "grid" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{badge}</span>}
      </div>

      <div className={viewMode === "list" ? "min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-4" : ""}>
        <h3 className="truncate font-semibold">{name}</h3>
        {subtitle && <p className={`${viewMode === "list" ? "" : "mt-1"} text-sm text-muted-foreground`}>{subtitle}</p>}
      </div>
      {badge && viewMode === "list" && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{badge}</span>}
    </article>
    </EntityContextMenu>
  )
}
export const AreaCard = (props: Omit<CardProps, "icon">) => <EntityCard {...props} icon={DoorOpen} />
export const ArticleCard = ({ articleIcon, articleImage, ...props }: Omit<CardProps, "icon"> &
  { articleIcon?: string | null; articleImage?: string | null }) => <EntityCard {...props} image={articleImage} icon={getArticleIcon(articleIcon)} />
export const ChestCard = (props: Omit<CardProps, "icon">) => <EntityCard {...props} icon={Box} />
export const ShelfCard = (props: Omit<CardProps, "icon">) => <EntityCard {...props} icon={Archive} />
