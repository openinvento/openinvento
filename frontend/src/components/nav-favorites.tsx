"use client"

import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Link } from "react-router"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { MoreHorizontalIcon, StarOffIcon } from "lucide-react"
import type { Favorite } from "@/utils/favorites"

export function NavFavorites({
  favorites,
  onRemove,
}: {
  favorites: Favorite[]
  onRemove: (id: string) => void
}) {
  const { isMobile } = useSidebar()
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Favorites</SidebarGroupLabel>
      <SidebarMenu>
        {favorites.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton render={<Link to={favoriteUrl(item)} title={item.name} />}>
              <span>{item.emoji}</span>
              <span>{item.name}</span>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuAction
                    showOnHover
                    className="aria-expanded:bg-muted"
                  />
                }
              >
                <MoreHorizontalIcon
                />
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
                    <span>Remove from Favorites</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        {favorites.length === 0 && <p className="px-2 py-1 text-sm text-sidebar-foreground/70">No favorites yet.</p>}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function favoriteUrl(item: Favorite) {
  const [kind, uuid] = item.id.split(":")
  if (uuid && kind === "area") return `/app/areas/${uuid}`
  if (uuid && kind === "article") return `/app/articles/${uuid}`
  return item.url
}
