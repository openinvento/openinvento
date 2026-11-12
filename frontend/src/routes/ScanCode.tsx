import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { LoaderCircle } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { inventoryApi } from "@/utils/api/inventory"
import { openInventoryOfEntry } from "@/utils/scan-code"

/**
 * Target of the URL in a QR code, /i/:inventory/:identifier, opened by any camera app.
 * Forwards to the page of the entry. It is replaced in the history, so going back does not land
 * here and forward again. Rendered outside AppLayout, which loads the newly selected inventory
 * when it mounts after the redirect.
 */
export default function ScanCode() {
  const { inventory, identifier } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        // A scan URL names one entry, so there is exactly one match.
        const { matches } = await inventoryApi.lookupCodeInInventory(identifier ?? "", inventory ?? "")
        if (!active) return
        const target = matches[0] ? await openInventoryOfEntry(matches[0]) : null
        if (!active) return
        if (target) navigate(target.path, { replace: true })
        else setNotFound(true)
      } catch {
        if (active) setNotFound(true)
      }
    })()
    return () => {
      active = false
    }
  }, [inventory, identifier, navigate])

  if (!notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label={t("scanCode.loading")}>
        <LoaderCircle className="size-6 animate-spin" />
      </div>
    )
  }

  // One message for every case, so the page does not reveal whether a code exists in a foreign inventory.
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">{t("scanCode.notFoundTitle")}</h1>
      <p className="text-muted-foreground">{t("scanCode.notFoundDescription")}</p>
      <Button render={<Link to="/app/dashboard" />} nativeButton={false}>
        {t("scanCode.backToDashboard")}
      </Button>
    </div>
  )
}
