"use client"

import * as React from "react"
import { useLocation } from "react-router"

import { NavFavorites } from "@/components/nav-favorites"
import { NavAreasList } from "@/components/nav-areas-list"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { AccountSidebarManager } from "@/components/inventory-switch-sidebar"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { SearchIcon, HomeIcon, DoorClosedIcon, Settings2Icon, MessageCircleQuestionIcon, QrCodeIcon, TextSearchIcon, WarehouseIcon, HandCoinsIcon } from "lucide-react"
import { FAVORITES_CHANGED_EVENT, getFavorites, removeFavorite, type Favorite } from "@/utils/favorites"
import i18n from "@/i18n"
import { getSidebarData, type SidebarData } from "@/utils/api/general"
import { inventoryApi, type Area } from "@/utils/api/inventory"
import { getEnabledModules } from "@/utils/api/modules"

// This is sample data.
const data = {
  navMain: [
    {
      title: i18n.t("sidebar.search"),
      url: "/app/search",
      icon: (
        <SearchIcon
        />
      ),
    },
/*     {
      title: "Ask AI",
      url: "#",
      icon: (
        <SparklesIcon
        />
      ),
    }, */
    {
      title: i18n.t("sidebar.home"),
      url: "/app",
      icon: (
        <HomeIcon
        />
      ),
      isActive: true,
    },
    {
      title: i18n.t("sidebar.areas"),
      url: "/app/areas",
      icon: (
        <DoorClosedIcon
        />
      ),
      isActive: false,
      badge: "10",
    },
    {
      title: i18n.t("sidebar.loans"),
      url: "/app/loans",
      icon: <HandCoinsIcon />,
      isActive: false,
    },
    {
      title: i18n.t("sidebar.codeManagement"),
      url: "/app/codemanagement",
      icon: (
        <QrCodeIcon
        />
      ),
      isActive: false,
      badge: "10",
    },
    {
      title: i18n.t("sidebar.categoriesAndFields"),
      url: "/app/manage-categories-and-fields",
      icon: (
        <TextSearchIcon
        />
      ),
      isActive: false,
      badge: "10",
    },
/*     {
      title: "Settings",
      url: "/app/settings",
      icon: (
        <SettingsIcon
        />
      ),
      isActive: false,
      badge: "10",
    }, */
  ],
  navSecondary: [
    {
      title: i18n.t("sidebar.settings"),
      url: "/app/settings",
      icon: (
        <Settings2Icon
        />
      ),
    },
    {
      title: i18n.t("sidebar.inventorySettings"),
      url: "/app/inventory-settings",
      icon: <WarehouseIcon />,
    },
    {
      title: "Help",
      url: "https://openinvento.github.io/docs/",
      icon: (
        <MessageCircleQuestionIcon
        />
      ),
    },
  ],
  favorites: [
    {
      name: "Example article",
      url: "#",
      emoji: "📊",
    },
    {
      name: "Example room",
      url: "#",
      emoji: "📊",
    }
  ],
  areas: [
    /* Coming later */
   /*  {
      name: "Test room",
      emoji: "🏠",
      pages: [
        {
          name: "Daily Journal & Reflection",
          url: "#",
          emoji: "📔",
        },
        {
          name: "Health & Wellness Tracker",
          url: "#",
          emoji: "🍏",
        },
        {
          name: "Personal Growth & Learning Goals",
          url: "#",
          emoji: "🌟",
        },
      ],
    },
    {
      name: "Test room 2",
      emoji: "💼",
      pages: [
        {
          name: "Career Objectives & Milestones",
          url: "#",
          emoji: "🎯",
        },
        {
          name: "Skill Acquisition & Training Log",
          url: "#",
          emoji: "🧠",
        },
        {
          name: "Networking Contacts & Events",
          url: "#",
          emoji: "🤝",
        },
      ],
    } */
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const [favorites, setFavorites] = React.useState<Favorite[]>([])
  const [sidebar, setSidebar] = React.useState<SidebarData | null>(null)
  const [areas, setAreas] = React.useState<Area[]>([])
  const [enabledModules, setEnabledModules] = React.useState<string[]>([])

  React.useEffect(() => {
    void getEnabledModules().then(setEnabledModules).catch(() => setEnabledModules([]))
  }, [])

  React.useEffect(() => {
    void getSidebarData().then(setSidebar).catch(() => setSidebar(null))
  }, [])

  React.useEffect(() => {
    const loadAreas = () => void inventoryApi.listAreas().then(setAreas).catch(() => setAreas([]))
    loadAreas()
    window.addEventListener("openinvento:inventory-moved", loadAreas)
    return () => window.removeEventListener("openinvento:inventory-moved", loadAreas)
  }, [])

  React.useEffect(() => {
    const syncFavorites = () => setFavorites(getFavorites())
    syncFavorites()
    window.addEventListener(FAVORITES_CHANGED_EVENT, syncFavorites)
    window.addEventListener("storage", syncFavorites)
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, syncFavorites)
      window.removeEventListener("storage", syncFavorites)
    }
  }, [])

  /* Auto set isActive based on the current URL location */
  const dynamicNavMain = data.navMain
    .filter((item) => item.url !== "/app/loans" || enabledModules.includes("loans"))
    .map((item) => ({
    ...item,
    isActive: location.pathname === item.url || (item.url === "/app" && location.pathname === "/app/dashboard")
    }))

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        {sidebar && <AccountSidebarManager userName={sidebar.user.name} inventories={sidebar.inventories} />}
        <NavMain items={dynamicNavMain} />
      </SidebarHeader>
      <SidebarContent>
        <NavFavorites favorites={favorites} onRemove={removeFavorite} />
        <NavAreasList areas={areas} />
        {/* Readding this later */}
       {/*  <NavWorkspaces areas={data.areas} /> */}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarRail />
      <div className="">
        <VersionNumber version={sidebar?.version} />
      </div>
    </Sidebar>
  )
}


export function VersionNumber({ version }: { version?: string }) {
  const displayVersion = version
    ? (version.startsWith("v") ? version : `v${version}`)
    : null

  return (
    <div className="text-sm text-muted-foreground text-center mb-2">
      {displayVersion}
    </div>
  )
}
