import { useEffect, useState } from "react"
import { useParams } from "react-router"

import { SessionGuard } from "@/components/auth/session-guard"
import { getCurrentSession } from "@/utils/api/auth"

import { publicPageApi, type PublicEntry } from "./api"
import PublicPageView from "./PublicPageView"

/**
 * Element of the scan route /i/:inventory/:identifier. Someone who is not signed in sees the
 * public contact page if the owner enabled it. Everybody else gets the usual protected route:
 * signed-in users go on to the entry, the rest to the login. With the module off the public
 * endpoint is a 404, so scans go to the login as before.
 */
export default function PublicPageScanRoute() {
  const { inventory = "", identifier = "" } = useParams()
  // A new instance per code, so the result for one code is never shown under another.
  return <ScanRoute key={`${inventory}/${identifier}`} inventory={inventory} identifier={identifier} />
}

function ScanRoute({ inventory, identifier }: { inventory: string; identifier: string }) {
  const [found, setFound] = useState<PublicEntry | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const session = await getCurrentSession()
        const result = session.authenticated ? null : await publicPageApi.view(inventory, identifier)
        if (active) setFound(result)
      } catch {
        if (active) setFound(null)
      }
    })()
    return () => {
      active = false
    }
  }, [inventory, identifier])

  if (found === undefined) return null
  if (found) return <PublicPageView inventory={inventory} identifier={identifier} entry={found} />
  return <SessionGuard mode="protected" />
}
