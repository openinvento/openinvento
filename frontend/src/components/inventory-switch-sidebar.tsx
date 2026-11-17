"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ChevronDownIcon, LogOutIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { logout } from "@/utils/api/auth"
import { useNavigate } from "react-router"
import { setSelectedInventory, type Inventory } from "@/utils/api/inventory"
import { useSelectedInventory } from "@/hooks/use-selected-inventory"

export function AccountSidebarManager({
  userName,
  inventories,
}: {
  userName: string
  inventories: Inventory[]
}) {
  const { selectedInventory: activeInventory, selectedInventoryUuid } =
    useSelectedInventory()
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (!activeInventory) {
    return null
  }

  async function logoutUser() {
    try {
      await logout()
      console.log("Redirecting to login page...")
      navigate("/auth/login?logged_out=1", { replace: true })
    } catch (error) {
      console.error("Error during logout:", error)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton className="w-full max-w-full min-w-0 overflow-hidden px-1.5" />}
          >
            <div className="flex aspect-square size-7.5 shrink-0 items-center justify-center rounded-md bg-none text-sidebar-primary-foreground">
              <img src="/compact_icon.png" alt="" className="rounded-xl" />
            </div>
            <span className="@container min-w-0 flex-1 overflow-hidden">
              <span
                className="block truncate font-medium"
                style={{
                  fontSize: `clamp(0.8125rem, calc(100cqw / ${Math.max(`${userName} (${activeInventory.name})`.length, 1)} * 2), 0.9375rem)`,
                }}
              >
                {`${userName} (${activeInventory.name})`}
              </span>
            </span>
            <ChevronDownIcon className="shrink-0 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {userName}
              </DropdownMenuLabel>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Current Inventory
              </DropdownMenuLabel>
              {inventories.map((inventory) => (
                <DropdownMenuItem
                  key={inventory.uuid}
                  onClick={() => {
                    setSelectedInventory(inventory.uuid)
                    navigate(0)
                  }}
                  aria-current={
                    inventory.uuid === selectedInventoryUuid ? "true" : undefined
                  }
                  className={`gap-2 p-2 ${
                    inventory.uuid === selectedInventoryUuid
                      ? "bg-accent text-accent-foreground"
                      : ""
                  }`}
                >
                  <div className="flex size-6 items-center justify-center rounded-xs border">
                    <img src="/compact_icon.png" alt="" className="rounded-xl" />
                  </div>
                  <span className="@container min-w-0 flex-1 overflow-hidden">
                    <span
                      className="block truncate"
                      style={{
                        fontSize: `clamp(0.812rem, calc(100cqw / ${Math.max(inventory.name.length, 1)} * 2), 0.937rem)`,
                      }}
                    >
                      {inventory.name}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>

              {/* Multi acc support coming later eventually */}
{/*               <DropdownMenuItem className="gap-2 p-2">
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <PlusIcon className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  Add team
                </div>
              </DropdownMenuItem> */}


              <DropdownMenuItem className="gap-2 p-2" onClick={logoutUser}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <LogOutIcon className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground" >
                  {t("accounts.logoutBtn")}
                </div>
              </DropdownMenuItem>

            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
