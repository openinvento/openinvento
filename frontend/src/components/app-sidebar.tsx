"use client"

import * as React from "react"
import { useLocation } from "react-router"

import { NavFavorites } from "@/components/nav-favorites"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavWorkspaces } from "@/components/nav-areas"
import { AccountSwitcher } from "@/components/account-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { TerminalIcon, SearchIcon, HomeIcon, DoorClosedIcon, Settings2Icon, MessageCircleQuestionIcon, QrCodeIcon } from "lucide-react"
import { FAVORITES_CHANGED_EVENT, getFavorites, removeFavorite, type Favorite } from "@/utils/favorites"

// This is sample data.
const data = {
  teams: [
    {
      name: "Your Name",
      logo: (
        <TerminalIcon
        />
      ),
      plan: "Enterprise",
    },
  ],
  navMain: [
    {
      title: "Search",
      url: "#",
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
      title: "Home",
      url: "/app",
      icon: (
        <HomeIcon
        />
      ),
      isActive: true,
    },
    {
      title: "Areas",
      url: "/app/areas",
      icon: (
        <DoorClosedIcon
        />
      ),
      isActive: false,
      badge: "10",
    },
    {
      title: "Code Management",
      url: "/app/codemanagement",
      icon: (
        <QrCodeIcon
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
      title: "Settings",
      url: "/app/settings",
      icon: (
        <Settings2Icon
        />
      ),
    },
    {
      title: "Help",
      url: "#",
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
    {
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
    }
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const [favorites, setFavorites] = React.useState<Favorite[]>([])

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
  const dynamicNavMain = data.navMain.map((item) => ({
    ...item,
    isActive: location.pathname === item.url || (item.url === "/app" && location.pathname === "/app/dashboard")
  }))

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <AccountSwitcher teams={data.teams} />
        <NavMain items={dynamicNavMain} />
      </SidebarHeader>
      <SidebarContent>
        <NavFavorites favorites={favorites} onRemove={removeFavorite} />
        <NavWorkspaces areas={data.areas} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
