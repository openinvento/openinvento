import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router' // 💡 Wichtig: aus 'react-router' importieren
import './index.css'
import Start from './routes/Start.tsx'
import LoginPage from './routes/auth/Login.tsx'
import AppLayout from './layouts/AppLayout.tsx'
import { TooltipProvider } from "@/components/ui/tooltip"


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
        element: <Start />,
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
