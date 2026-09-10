import * as React from "react"
import { useLocation } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Settings2Icon, FileTextIcon, LinkIcon, CopyIcon, CornerUpRightIcon, Trash2Icon, CornerUpLeftIcon, ChartLineIcon, GalleryVerticalEndIcon, TrashIcon, BellIcon, ArrowUpIcon, ArrowDownIcon, MoreHorizontalIcon, StarIcon, StarOffIcon } from "lucide-react"
import { inventoryApi } from "@/utils/api/inventory"
import { isFavorite, toggleFavorite, type Favorite } from "@/utils/favorites"

const data = [
  [
    {
      label: "Customize Page",
      icon: (
        <Settings2Icon
        />
      ),
    },
    {
      label: "Turn into wiki",
      icon: (
        <FileTextIcon
        />
      ),
    },
  ],
  [
    {
      label: "Copy Link",
      icon: (
        <LinkIcon
        />
      ),
    },
    {
      label: "Duplicate",
      icon: (
        <CopyIcon
        />
      ),
    },
    {
      label: "Move to",
      icon: (
        <CornerUpRightIcon
        />
      ),
    },
    {
      label: "Move to Trash",
      icon: (
        <Trash2Icon
        />
      ),
    },
  ],
  [
    {
      label: "Undo",
      icon: (
        <CornerUpLeftIcon
        />
      ),
    },
    {
      label: "View analytics",
      icon: (
        <ChartLineIcon
        />
      ),
    },
    {
      label: "Version History",
      icon: (
        <GalleryVerticalEndIcon
        />
      ),
    },
    {
      label: "Show delete pages",
      icon: (
        <TrashIcon
        />
      ),
    },
    {
      label: "Notifications",
      icon: (
        <BellIcon
        />
      ),
    },
  ],
  [
    {
      label: "Import",
      icon: (
        <ArrowUpIcon
        />
      ),
    },
    {
      label: "Export",
      icon: (
        <ArrowDownIcon
        />
      ),
    },
  ],
]
export function NavActions() {
  const [isOpen, setIsOpen] = React.useState(false)
  const location = useLocation()
  const [favorite, setFavorite] = React.useState<Favorite | null>(null)
  const [favorited, setFavorited] = React.useState(false)

  React.useEffect(() => {
    const areaId = location.pathname.match(/^\/app\/areas\/([^/]+)$/)?.[1]
    const articleId = location.pathname.match(/^\/app\/articles\/([^/]+)$/)?.[1]
    if (!areaId && !articleId) {
      setFavorite(null)
      setFavorited(false)
      return
    }

    let active = true
    void (async () => {
      const item = areaId
        ? (await inventoryApi.listAreas()).find((area) => area.uuid === areaId)
        : (await inventoryApi.listArticles()).find((article) => article.uuid === articleId)
      if (!active || !item) return
      const nextFavorite: Favorite = areaId
        ? { id: `area:${item.uuid}`, name: item.name, url: `/app/areas/${item.uuid}`, emoji: "🚪" }
        : { id: `article:${item.uuid}`, name: item.name, url: `/app/articles/${item.uuid}`, emoji: "📦" }
      setFavorite(nextFavorite)
      setFavorited(isFavorite(nextFavorite.id))
    })()
    return () => { active = false }
  }, [location.pathname])

  React.useEffect(() => {
    const syncFavorite = () => setFavorited(favorite ? isFavorite(favorite.id) : false)
    window.addEventListener("openinvento:favorites-changed", syncFavorite)
    window.addEventListener("storage", syncFavorite)
    return () => {
      window.removeEventListener("openinvento:favorites-changed", syncFavorite)
      window.removeEventListener("storage", syncFavorite)
    }
  }, [favorite])

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="hidden font-medium text-muted-foreground md:inline-block">
        Edit Oct 08
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={!favorite}
        onClick={() => favorite && setFavorited(toggleFavorite(favorite))}
        aria-pressed={favorited}
        aria-label={favorite ? (favorited ? `Remove ${favorite.name} from favorites` : `Add ${favorite.name} to favorites`) : "Favorite"}
      >
        {favorited ? <StarOffIcon /> : <StarIcon />}
      </Button>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 data-open:bg-accent"
            />
          }
        >
          <MoreHorizontalIcon
          />
        </PopoverTrigger>
        <PopoverContent
          className="w-56 overflow-hidden rounded-lg p-0"
          align="end"
        >
          <Sidebar collapsible="none" className="bg-transparent">
            <SidebarContent>
              {data.map((group, index) => (
                <SidebarGroup key={index} className="border-b last:border-none">
                  <SidebarGroupContent className="gap-0">
                    <SidebarMenu>
                      {group.map((item, index) => (
                        <SidebarMenuItem key={index}>
                          <SidebarMenuButton>
                            {item.icon} <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </SidebarContent>
          </Sidebar>
        </PopoverContent>
      </Popover>
    </div>
  )
}
