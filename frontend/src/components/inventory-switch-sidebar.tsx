"use client"

import * as React from "react"

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
import { getSelectedInventory, setSelectedInventory, type Inventory } from "@/utils/api/inventory"

export function AccountSidebarManager({
  userName,
  inventories,
}: {
  userName: string
  inventories: Inventory[]
}) {
  const [activeInventory, setActiveInventory] = React.useState<Inventory | null>(null)
  const {t} = useTranslation()
  const navigate = useNavigate()

  React.useEffect(() => {
    setActiveInventory(getSelectedInventory(inventories))
  }, [inventories])

  if (!activeInventory) {
    return null
  }

  async function logoutUser() {
    try {
      await logout()
      console.log("Redirecting to login page...")
      navigate("/auth/login", { replace: true })
    } catch (error) {
      console.error("Error during logout:", error)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton className="w-fit px-1.5" />}
          >
            <div className="flex aspect-square size-7.5 items-center justify-center rounded-md bg-none text-sidebar-primary-foreground">
              <img src="/compact_icon.png" alt="" className="rounded-xl" />
            </div>
            <span className="truncate font-medium">{`${userName} (${activeInventory.name})`}</span>
            <ChevronDownIcon className="opacity-50" />
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
                    setActiveInventory(inventory)
                    navigate(0)
                  }}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-xs border">
                    <img src="/compact_icon.png" alt="" className="rounded-xl" />
                  </div>
                  {inventory.name}
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
