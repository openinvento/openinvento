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
  const [sessionUser, setSessionUser] = useState<Awaited<ReturnType<typeof getCurrentSession>>["user"]>(null)

  useEffect(() => {
    let active = true

    async function checkSession() {
      try {
        const session = await getCurrentSession()
        if (active) {
          setSessionUser(session.authenticated ? session.user : null)
        }
      } catch {
        if (active) {
          setSessionUser(null)
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

  const authenticated = Boolean(sessionUser)
  const navigationState = location.state as { credentialsReset?: boolean } | null

  if (mode === "guest" && authenticated) {
    return <Navigate to="/app" replace />
  }

  if (mode === "guest" && redirectUnauthenticated && !authenticated) {
    return <Navigate to="/auth/login" replace />
  }

  if (mode === "protected" && !authenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />
  }

  // Redirect to reset credentials page if the user is required to reset their credentials
  if (
    mode === "protected" &&
    sessionUser?.require_reset &&
    location.pathname !== "/auth/reset" &&
    // Don't redirect if the user has already reset their credentials in this session
    !navigationState?.credentialsReset
  ) {
    return <Navigate to="/auth/reset" replace state={{ from: location }} />
  }

  return <Outlet />
}