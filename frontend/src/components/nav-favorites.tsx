"use client"

import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Link } from "react-router"
import { useTranslation } from "react-i18next"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronDownIcon, HomeIcon, MoreHorizontalIcon, PackageIcon, StarOffIcon } from "lucide-react"
import type { Favorite } from "@/utils/favorites"

export function NavFavorites({
  favorites,
  onRemove,
}: {
  favorites: Favorite[]
  onRemove: (id: string) => void
}) {
  const { isMobile } = useSidebar()
  const { t } = useTranslation()
  return (
    <Collapsible defaultOpen={false}>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel render={<CollapsibleTrigger />} className="group/collapsible cursor-pointer">
          <span>{t("sidebar.favorites")}</span>
          <ChevronDownIcon className="ml-auto transition-transform group-data-[open]/collapsible:rotate-180" />
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarMenu>
            {favorites.map((item) => {
              const areaId = favoriteAreaId(item)
              return (
                <SidebarMenuItem
                  key={item.id}
                  data-inventory-drop={areaId ? `area:${areaId}` : undefined}
                >
                  <SidebarMenuButton render={<Link to={favoriteUrl(item)} title={item.name} />}>
                    {item.icon === "home" && <HomeIcon />}
                    {item.icon === "package" && <PackageIcon />}
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <SidebarMenuAction showOnHover className="aria-expanded:bg-muted" />
                      }
                    >
                      <MoreHorizontalIcon />
                      <span className="sr-only">More</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-56 rounded-lg"
                      side={isMobile ? "bottom" : "right"}
                      align={isMobile ? "end" : "start"}
                    >
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => onRemove(item.id)}>
                          <StarOffIcon className="text-muted-foreground" />
                          <span>{t("sidebar.removeFavorite")}</span>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              )
            })}
            {favorites.length === 0 && (
              <p className="px-2 py-1 text-sm text-sidebar-foreground/70">
                {t("sidebar.noFavorites")}
              </p>
            )}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

function favoriteAreaId(item: Favorite) {
  const [kind, id] = item.id.split(":")
  return kind === "area" ? id : undefined
}

function favoriteUrl(item: Favorite) {
  const [kind, uuid] = item.id.split(":")
  if (uuid && kind === "area") return `/app/areas/${uuid}`
  if (uuid && kind === "article") return `/app/articles/${uuid}`
  return item.url
}
