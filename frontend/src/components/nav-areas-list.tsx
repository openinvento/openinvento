import { ChevronDown, DoorOpen } from "lucide-react"
import { Link } from "react-router"
import { useTranslation } from "react-i18next"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { Area } from "@/utils/api/inventory"

export function NavAreasList({ areas }: { areas: Area[] }) {
  const { t } = useTranslation()
  return (
    <Collapsible defaultOpen={false}>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel
          render={<CollapsibleTrigger />}
          className="group/collapsible cursor-pointer"
        >
          <span>{t("sidebar.areas")}</span>
          <ChevronDown className="ml-auto transition-transform group-data-[open]/collapsible:rotate-180" />
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarMenu>
            {areas.map((area) => (
              <SidebarMenuItem
                key={area.uuid}
                data-inventory-drop={`area:${area.uuid}`}
              >
                <SidebarMenuButton
                  render={<Link to={`/app/areas/${area.uuid}`} title={area.name} />}
                >
                  <DoorOpen />
                  <span>{area.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            {areas.length === 0 && (
              <p className="px-2 py-1 text-sm text-sidebar-foreground/70">
                {t("sidebar.noAreas")}
              </p>
            )}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
