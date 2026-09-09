import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router' // 💡 Wichtig: aus 'react-router' importieren
import './index.css'
import Start from './routes/Start.tsx'
import LoginPage from './routes/auth/Login.tsx'
import SignupPage from './routes/auth/Signup.tsx'
import AppLayout from './layouts/AppLayout.tsx'
import Dashboard from './routes/Dashboard.tsx'
import AreasPage from './routes/inventory/AreasPage.tsx'
import AreaDetailScreen from './routes/inventory/AreaDetailScreen.tsx'
import ArticlePage from './routes/inventory/ArticlePage.tsx'
import { TooltipProvider } from "@/components/ui/tooltip"

/* Dark/ white mode handling */
if (
  typeof window !== 'undefined' &&
  (localStorage.theme === 'dark' || 
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches))
) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}


/* Routes configuration */
const router = createBrowserRouter([
  {
    path: "/",
    element: <Start />,
  },
  {
    path: "/app",
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
        path: "areas",
        element: <AreasPage />,
      },
      {
        path: "areas/:areaId",
        element: <AreaDetailScreen />,
      },
      {
        path: "articles/:articleId",
        element: <ArticlePage />,
      },
      {
        path: "settings", 
        element: <div>Settings page</div>,
      },
    ],
  },
  {
    path: "/auth",
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
    <RouterProvider router={router} />
  </TooltipProvider>
  </StrictMode>,
)
