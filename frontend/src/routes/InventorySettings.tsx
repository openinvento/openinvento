import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { TriangleAlert, UserMinus, UserPlus } from "lucide-react"
import { useTranslation } from "react-i18next"
import BaseScreen from "@/layouts/BaseScreen"
import { Button } from "@/components/ui/button"
import {
  clearSelectedInventory,
  getSelectedInventory,
  getSelectedInventoryUuid,
  inventoryApi,
  type InventoryMembership,
} from "@/utils/api/inventory"

export default function InventorySettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [membership, setMembership] = useState<InventoryMembership | null>(null)
  const [selectedUser, setSelectedUser] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function load() {
    setLoading(true)
    setError("")
    try {
      let inventoryUuid = getSelectedInventoryUuid()
      if (!inventoryUuid) {
        const inventories = await inventoryApi.listInventories()
        inventoryUuid = getSelectedInventory(inventories)?.uuid ?? null
      }
      if (!inventoryUuid) return
      setMembership(await inventoryApi.getMembership(inventoryUuid))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("settings.inventory.loadError"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function addMember() {
    if (!membership || !selectedUser) return
    setSaving(true)
    try {
      await inventoryApi.addMember(membership.inventory.uuid, selectedUser)
      setSelectedUser("")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("settings.inventory.saveError"))
    } finally {
      setSaving(false)
    }
  }

  async function removeMember(uuid: string, name: string) {
    if (!membership || !window.confirm(t("settings.inventory.removeMemberConfirm", { name }))) return
    setSaving(true)
    try {
      await inventoryApi.removeMember(membership.inventory.uuid, uuid)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("settings.inventory.saveError"))
    } finally {
      setSaving(false)
    }
  }

  async function deleteInventory() {
    if (!membership || !window.confirm(t("settings.inventory.deleteConfirm", { name: membership.inventory.name }))) return
    setSaving(true)
    try {
      await inventoryApi.deleteInventory(membership.inventory.uuid)
      clearSelectedInventory()
      navigate("/app/dashboard", { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("settings.inventory.deleteError"))
      setSaving(false)
    }
  }

  return (
    <BaseScreen title={t("settings.inventory.title")} description={membership?.inventory.name}>
      {error && <p className="mb-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {loading ? <p className="text-sm text-muted-foreground">{t("settings.inventory.loading")}</p> : membership && (
        <div className="flex flex-col gap-8">
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{t("settings.inventory.members")}</h2>
              </div>
              {membership.can_invite && <div className="flex gap-2">
                <select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)} className="h-9 min-w-48 rounded-md border bg-background px-3 text-sm" aria-label={t("settings.inventory.selectPerson")} disabled={saving || membership.available_users.length === 0}>
                  <option value="">{t("settings.inventory.selectPerson")}</option>
                  {membership.available_users.map((user) => <option key={user.uuid} value={user.uuid}>{user.name || user.username}</option>)}
                </select>
                <Button onClick={() => void addMember()} disabled={saving || !selectedUser}><UserPlus /> {t("settings.inventory.addMember")}</Button>
              </div>}
            </div>
            {!membership.can_invite && <p className="mb-4 text-sm text-muted-foreground">{t("settings.inventory.invitesDisabled")}</p>}

            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">{t("settings.admin.name")}</th><th className="hidden px-4 py-3 font-medium sm:table-cell">{t("settings.admin.username")}</th><th className="px-4 py-3 text-right font-medium">{t("settings.admin.actions")}</th></tr></thead>
                <tbody className="divide-y">{membership.members.length === 0 ? 
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">{t("settings.inventory.noMembers")}</td>
                  </tr> : membership.members.map((user) => <tr key={user.uuid} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{user.name || user.username}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{user.username}</td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => void removeMember(user.uuid, user.name || user.username)} disabled={saving} aria-label={t("settings.inventory.removeMember")}>
                    <UserMinus /></Button>
                  </td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </section>
          <section className="rounded-xl border border-destructive/40 p-5">
            <div className="flex items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <TriangleAlert className=" size-5 text-destructive" />
                <h2 className="font-semibold text-destructive">{t("settings.inventory.dangerZone")}</h2>
                <p className="text-sm text-muted-foreground">{t("settings.inventory.deleteConfirm", { name: membership.inventory.name })}</p>
              </div>
              <Button variant="destructive" className="px-10" onClick={() => void deleteInventory()} disabled={saving}>{t("settings.inventory.deleteInventory")}</Button>
            </div>
            
          </section>
        </div>
      )}
    </BaseScreen>
  )
}
