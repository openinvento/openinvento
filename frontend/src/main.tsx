import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router' // 💡 Wichtig: aus 'react-router' importieren
import './index.css'
import LoginPage from './routes/auth/Login.tsx'
import SignupPage from './routes/auth/Signup.tsx'
import AppLayout from './layouts/AppLayout.tsx'
import Dashboard from './routes/Dashboard.tsx'
import SettingsPage from './routes/Settings.tsx'
import InventorySettingsPage from './routes/InventorySettings.tsx'
import AreasPage from './routes/inventory/AreasPage.tsx'
import AreaDetailScreen from './routes/inventory/AreaDetailScreen.tsx'
import BoxPage from './routes/inventory/BoxPage.tsx'
import ArticleCreateScreen from './routes/inventory/ArticleCreateScreen.tsx'
import ArticlePage from './routes/inventory/ArticlePage.tsx'
import { TooltipProvider } from "@/components/ui/tooltip"

import './i18n.ts' // Initialize i18next
import ErrorPage from './routes/Error.tsx'
import SearchPage from './routes/inventory/SearchPage.tsx'
import MagicArticleImportPage from './routes/inventory/MagicArticleImportPage.tsx'
import { SessionGuard } from './components/auth/session-guard.tsx'
import ManageCategoriesAndFieldsPage from './routes/inventory/ManageCategoriesAndFields.tsx'
import ManageCodes from './routes/inventory/ManageCodes.tsx'
import ResetCredentialsPage from './routes/auth/ResetCredentials.tsx'
import LoansPage from '../modules/loans/LoansPage.tsx'
import { getEnabledModules, MODULES_CHANGED_EVENT } from './utils/api/modules'
import BarcodeArticleImportPage from './routes/inventory/BarcodeArticleImport.tsx'

function EnabledModuleRoute({ name, children }: { name: string; children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    let active = true
    const loadModules = () => {
      void getEnabledModules(true)
        .then((modules) => { if (active) setEnabled(modules.includes(name)) })
        .catch(() => { if (active) setEnabled(false) })
    }
    loadModules()
    window.addEventListener(MODULES_CHANGED_EVENT, loadModules)
    return () => { active = false; window.removeEventListener(MODULES_CHANGED_EVENT, loadModules) }
  }, [name])
  if (enabled === null) return null
  return enabled ? children : <Navigate to="/app/dashboard" replace />
}

function MobileZoomControl() {
  useEffect(() => {
    let enabled = localStorage.getItem('disableMobileZoom') !== 'false'
    let lastTouchEnd = 0
    const preventPinchZoom = (event: TouchEvent) => {
    const touchEvent = event as any; 
      if (enabled && touchEvent.scale !== undefined && touchEvent.scale !== 1) touchEvent.preventDefault()
    }
    const preventDoubleTapZoom = (touchEvent: TouchEvent) => {
      if (!enabled) return
      const now = Date.now()
      if (now - lastTouchEnd <= 300) touchEvent.preventDefault()
      lastTouchEnd = now
    }
    
    const updateSetting = () => { enabled = localStorage.getItem('disableMobileZoom') !== 'false' }
    document.addEventListener('touchmove', preventPinchZoom, { passive: false })
    document.addEventListener('touchend', preventDoubleTapZoom, { passive: false })
    window.addEventListener('storage', updateSetting)
    window.addEventListener('mobile-zoom-setting-changed', updateSetting)
    return () => {
      document.removeEventListener('touchmove', preventPinchZoom)
      document.removeEventListener('touchend', preventDoubleTapZoom)
      window.removeEventListener('storage', updateSetting)
      window.removeEventListener('mobile-zoom-setting-changed', updateSetting)
    }
  }, [])
  return null
}


/* Dark / White mode handling */
function updateTheme() {
  if (
    typeof window !== 'undefined' &&
    (localStorage.theme === 'dark' || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches))
  ) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

updateTheme();

// Instant reaction when localStorage changes (e.g., from SettingsPage)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', updateTheme);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme);
}


/* Routes configuration */
const router = createBrowserRouter([
  {
    path: "/",
    element: <SessionGuard mode="guest" redirectUnauthenticated />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/app",
    element: <SessionGuard mode="protected" />,
    children: [
      {
        element: <AppLayout />,
        children: [
      {
        /* Auto redirect to /app/dashboard */
        index: true, 
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "loans",
        element: <EnabledModuleRoute name="loans"><LoansPage /></EnabledModuleRoute>,
      },
      {
        path: "search",
        element: <SearchPage />,
      },
      {
        path: "magic-article-import",
        element: <MagicArticleImportPage />,
      },
      {
        path: "barcode-article-import",
        element: <BarcodeArticleImportPage />,
      },
      {
        path: "areas",
        element: <AreasPage />,
      },
      {
        path: "areas/:areaId/articles/new",
        element: <ArticleCreateScreen />,
      },
      {
        path: "areas/:areaId",
        element: <AreaDetailScreen />,
      },
      {
        path: "boxes/:boxId",
        element: <BoxPage />,
      },
      {
        path: "articles/:articleId",
        element: <ArticlePage />,
      },
      {
        path: "settings", 
        element: <SettingsPage />,
      },
      {
        path: "inventory-settings",
        element: <InventorySettingsPage />,
      },
      {
        path: "codemanagement", 
        element: <ManageCodes />,
      },
      {
        path: "manage-categories-and-fields", 
        element: <ManageCategoriesAndFieldsPage />,
      },
        ],
      },
    ],
  },
  {
    path: "/auth/reset",
    element: <SessionGuard mode="protected" />,
    children: [{ index: true, element: <ResetCredentialsPage /> }],
  },
  {
    path: "/auth",
    element: <SessionGuard mode="guest" />,
    children: [
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "signup",
        element: <SignupPage />,
      },
    ],
  }
]);


createRoot(document.getElementById('root')!).render(
  <StrictMode>
  <TooltipProvider>
    <MobileZoomControl />
    <RouterProvider router={router} />
  </TooltipProvider>
  </StrictMode>,
)
