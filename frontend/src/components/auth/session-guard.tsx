import { useEffect, useState } from "react"
import { Navigate, Outlet, useLocation } from "react-router"

import { getCurrentSession } from "@/utils/api/auth"

type SessionGuardMode = "protected" | "guest"

type SessionGuardProps = {
  mode: SessionGuardMode
  redirectUnauthenticated?: boolean
}

export function SessionGuard({ mode, redirectUnauthenticated = false }: SessionGuardProps) {
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    let active = true

    async function checkSession() {
      try {
        const session = await getCurrentSession()
        if (active) {
          setAuthenticated(session.authenticated)
        }
      } catch {
        if (active) {
          setAuthenticated(false)
        }
      } finally {
        if (active) {
          setChecking(false)
        }
      }
    }

    checkSession()

    return () => {
      active = false
    }
  }, [location.pathname])

  if (checking) {
    return null
  }

  if (mode === "guest" && authenticated) {
    return <Navigate to="/app" replace />
  }

  if (mode === "guest" && redirectUnauthenticated && !authenticated) {
    return <Navigate to="/auth/login" replace />
  }

  if (mode === "protected" && !authenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />
  }

  return <Outlet />
}