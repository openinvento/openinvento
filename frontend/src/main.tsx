import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router' // 💡 Wichtig: aus 'react-router' importieren
import './index.css'
import Start from './routes/Start.tsx'


/* Routes configuration */
const router = createBrowserRouter([
  {
    path: "/",
    element: <Start />,
  },
  {
    path: "/about",
    element: <div>Das ist die About-Seite!</div>,
  }
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
