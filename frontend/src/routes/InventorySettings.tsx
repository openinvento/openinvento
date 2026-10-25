import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { Download, KeyRound, Plus, Trash2, TriangleAlert, UserMinus, UserPlus } from "lucide-react"
import { useTranslation } from "react-i18next"
import BaseScreen from "@/layouts/BaseScreen"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  clearSelectedInventory,
  getSelectedInventory,
  getSelectedInventoryUuid,
  inventoryApi,
  type InventoryMembership,
  type ThirdPartyProviderConfiguration,
} from "@/utils/api/inventory"
import { Input } from "@/components/ui/input"

export default function InventorySettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [membership, setMembership] = useState<InventoryMembership | null>(null)
  const [inventoryName, setInventoryName] = useState("")
  const [selectedUser, setSelectedUser] = useState("")
  const [nameChanged, setNameChanged] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState("")
  const [providers, setProviders] = useState<Awaited<ReturnType<typeof inventoryApi.listThirdPartyProviders>>>([])
  const [configurations, setConfigurations] = useState<ThirdPartyProviderConfiguration[]>([])
  const [configurationIndex, setConfigurationIndex] = useState(0)
  const [providerName, setProviderName] = useState("")
  const [providerKey, setProviderKey] = useState("")
  const [providerModel, setProviderModel] = useState("")
  const [providerUrl, setProviderUrl] = useState("")
  const providerConfigurationGroups = configurations.reduce<Array<{ label: string; items: ThirdPartyProviderConfiguration[] }>>((groups, configuration) => {
    const group = groups.find((item) => item.label === configuration.type_label)
    if (group) group.items.push(configuration)
    else groups.push({ label: configuration.type_label, items: [configuration] })
    return groups
  }, [])

  async function load() {
    setLoading(true)
    setError("")
    const inventories = await inventoryApi.listInventories()

    try {
      const availableConfigurations = await inventoryApi.listThirdPartyProviderConfigurations()
      setConfigurations(availableConfigurations)
      setProviderModel(availableConfigurations[0]?.default_model ?? "")
      let inventoryUuid = getSelectedInventoryUuid()
      if (!inventoryUuid) {
        inventoryUuid = getSelectedInventory(inventories)?.uuid ?? null
      }
      if (!inventoryUuid) return
      const loadedMembership = await inventoryApi.getMembership(inventoryUuid)
      setProviders(await inventoryApi.listThirdPartyProviders(inventoryUuid))
      setInventoryName(loadedMembership.inventory.name)
      setMembership(loadedMembership)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("settings.inventory.loadError"))
    } finally {
      setLoading(false)
    }
  }

  async function saveProvider() {
    const configuration = configurations[configurationIndex]
    if (!membership || !configuration || !providerName.trim() || (configuration.requires_api_key && !providerKey.trim()) || (configuration.requires_model && !providerModel.trim())) return
    setSaving(true)
    setError("")
    try {
      await inventoryApi.createThirdPartyProvider({ inventory: membership.inventory.uuid, provider: configuration.provider, type: configuration.type, name: providerName.trim(), ...(configuration.requires_api_key ? { api_key: providerKey.trim() } : {}), ...(configuration.requires_model ? { model_name: providerModel.trim() } : {}), ...(configuration.requires_api_url && providerUrl.trim() ? { api_url: providerUrl.trim() } : {}) })
      setProviderKey("")
      setProviderModel(configuration.default_model ?? "")
      setProviderUrl("")
      setProviderName("")
      setProviders(await inventoryApi.listThirdPartyProviders(membership.inventory.uuid))
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("settings.inventory.saveError")) }
    finally { setSaving(false) }
  }

  async function removeProvider(uuid: string) {
    if (!membership) return
    setSaving(true)
    try {
      await inventoryApi.deleteThirdPartyProvider(uuid)
      setProviders(await inventoryApi.listThirdPartyProviders(membership.inventory.uuid))
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("settings.inventory.saveError")) }
    finally { setSaving(false) }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!nameChanged || !membership) return

    const timeout = window.setTimeout(async () => {
      setSaving(true)
      setError("")
      try {
        const updatedInventory = await inventoryApi.updateInventory(membership.inventory.uuid, inventoryName)
        setMembership((current) => current ? { ...current, inventory: updatedInventory } : current)
        setNameChanged(false)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : t("settings.inventory.saveError"))
      } finally {
        setSaving(false)
      }
    }, 1000)

    return () => window.clearTimeout(timeout)
  }, [inventoryName, membership, nameChanged, t])

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

  async function exportInventory() {
    if (!membership) return
    setExporting(true)
    setError("")
    try {
      await inventoryApi.exportInventoryCsv(membership.inventory.uuid)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("settings.inventory.exportError"))
    } finally {
      setExporting(false)
    }
  }

  return (
    <BaseScreen title={t("settings.inventory.title")} description={membership?.inventory.name}>
      {error && <p className="mb-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {loading ? <p className="text-sm text-muted-foreground">{t("settings.inventory.loading")}</p> : membership && (
        <div className="flex flex-col gap-8">
          <section>
            <section className="mb-5">
              <h2 className="text-xl mb-2 font-semibold">{t("settings.inventory.general")}</h2>
              <label htmlFor="inventoryName" className="text-sm text-muted-foreground">{t("settings.inventory.name")}</label>
              <br />
              <Input value={inventoryName} onChange={(event) => { setInventoryName(event.target.value); setNameChanged(true) }} className="w-64" />
            </section>

            <section className="mb-8 flex items-center justify-between gap-4 my-8 mb-12 py-5">
              <div>
                <h2 className="text-xl font-semibold">{t("settings.inventory.exportTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("settings.inventory.exportDescription")}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void exportInventory()} disabled={exporting}>
                <Download /> {exporting ? t("settings.inventory.exporting") : t("settings.inventory.exportCsv")}
              </Button>
            </section>

            <section id="third-party-providers" className="mb-10 grid gap-4 rounded-xl scroll-mt-6">
              <div><h2 className="text-xl font-semibold">{t("settings.inventory.providers.title")}</h2><p className="text-sm text-muted-foreground">{t("settings.inventory.providers.description")}</p></div>
              {providers.map((configured) => <div key={configured.uuid} className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3"><div className="flex items-center gap-3">{configured.has_api_key && <KeyRound className="size-4" />}<div><p className="font-medium">{configured.name} · {configurations.find((item) => item.provider === configured.provider && item.type === configured.type)?.display_name ?? configured.provider}</p><p className="text-xs text-muted-foreground">{configurations.find((item) => item.provider === configured.provider && item.type === configured.type)?.type_label ?? configured.type}{configured.has_api_key ? ` · ${t("settings.inventory.providers.keySaved")}` : ""}</p></div></div><Button type="button" variant="ghost" size="icon-sm" aria-label={t("settings.inventory.providers.remove")} disabled={saving} onClick={() => void removeProvider(configured.uuid)}><Trash2 className="text-destructive" /></Button></div>)}
              
              <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1.5fr_auto]">
                <Combobox<ThirdPartyProviderConfiguration>
                  items={providerConfigurationGroups}
                  value={configurations[configurationIndex] ?? null}
                  onValueChange={(configuration) => {
                    if (!configuration) return
                    setConfigurationIndex(configurations.indexOf(configuration))
                    setProviderKey("")
                    setProviderModel(configuration.default_model ?? "")
                    setProviderUrl("")
                  }}
                  itemToStringValue={(configuration) => `${configuration.provider}:${configuration.type}`}
                  itemToStringLabel={(configuration) => configuration.display_name}
                  disabled={configurations.length === 0 || saving}
                >
                  <ComboboxInput className="h-9 w-full" aria-label={t("settings.inventory.providers.configurationLabel")} placeholder={t("settings.inventory.providers.configurationLabel")} />
                  <ComboboxContent>
                    <ComboboxEmpty>{t("settings.inventory.providers.noConfigurations")}</ComboboxEmpty>
                    <ComboboxList>
                      {(group) => <ComboboxGroup key={group.label} items={group.items}>
                        <ComboboxLabel>{group.label}</ComboboxLabel>
                        <ComboboxCollection>
                          {(configuration) => <ComboboxItem key={`${configuration.provider}:${configuration.type}`} value={configuration}>{configuration.display_name}</ComboboxItem>}
                        </ComboboxCollection>
                      </ComboboxGroup>}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>

                <Input aria-label={t("settings.inventory.providers.nameLabel")} value={providerName} onChange={(event) => setProviderName(event.target.value)} placeholder={t("settings.inventory.providers.namePlaceholder")} />
                {configurations[configurationIndex]?.requires_api_key && <Input aria-label={t("settings.inventory.providers.keyLabel")} type="password" autoComplete="new-password" value={providerKey} onChange={(event) => setProviderKey(event.target.value)} placeholder={t("settings.inventory.providers.keyPlaceholder")} />}
                {configurations[configurationIndex]?.requires_model && <Input aria-label={t("settings.inventory.providers.modelLabel")} value={providerModel} onChange={(event) => setProviderModel(event.target.value)} placeholder={t("settings.inventory.providers.modelPlaceholder")} />}
                {configurations[configurationIndex]?.requires_api_url && <Input aria-label={t("settings.inventory.providers.urlLabel")} value={providerUrl} onChange={(event) => setProviderUrl(event.target.value)} placeholder={t("settings.inventory.providers.urlPlaceholder")} />}
                <Button type="button" onClick={() => void saveProvider()} disabled={saving || !providerName.trim() || !configurations[configurationIndex] || (configurations[configurationIndex]?.requires_api_key && !providerKey.trim()) || (configurations[configurationIndex]?.requires_model && !providerModel.trim())}><Plus />{t("settings.inventory.providers.addProvider")}</Button>
              </div>
            </section>

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
