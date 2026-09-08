import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ChevronRightIcon, PlusIcon, MoreHorizontalIcon } from "lucide-react"

export function NavWorkspaces({
  areas: areas,
}: {
  areas: {
    name: string
    emoji: React.ReactNode
    pages: {
      name: string
      emoji: React.ReactNode
    }[]
  }[]
}) {
  return (
    <SidebarGroup>
    <SidebarGroupLabel>Areas - Quick Access</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {areas.map((area) => (
            <Collapsible key={area.name}>
              <SidebarMenuItem>
                <SidebarMenuButton render={<a href="#" />}>
                  <span>{area.emoji}</span>
                  <span>{area.name}</span>
                </SidebarMenuButton>
                <SidebarMenuAction
                  render={<CollapsibleTrigger />}
                  className="left-2 bg-sidebar-accent text-sidebar-accent-foreground data-open:rotate-90"
                  showOnHover
                >
                  <ChevronRightIcon
                  />
                </SidebarMenuAction>
                <SidebarMenuAction showOnHover>
                  <PlusIcon
                  />
                </SidebarMenuAction>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {area.pages.map((page) => (
                      <SidebarMenuSubItem key={page.name}>
                        <SidebarMenuSubButton render={<a href="#" />}>
                          <span>{page.emoji}</span>
                          <span>{page.name}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sidebar-foreground/70">
              <MoreHorizontalIcon
              />
              <span>More</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
