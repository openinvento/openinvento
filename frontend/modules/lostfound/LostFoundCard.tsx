import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { SlotProps } from "@/slots/slot-manager"
import { ApiError } from "@/utils/api/base"

import { lostFoundApi, type LostFoundSettings } from "./api"

const DEFAULT_SETTINGS: LostFoundSettings = { show_name: true, show_photo: false, note: "" }

/** Owner settings for the public contact page of one entry, shown in the entry-details slot. */
export default function LostFoundCard({ entryUuid }: SlotProps["entry-details"]) {
  // Entry pages stay mounted when navigating to another entry; a new card keeps one entry's state off the next.
  return <EntryLostFoundCard key={entryUuid} entryUuid={entryUuid} />
}

function EntryLostFoundCard({ entryUuid }: { entryUuid: string }) {
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState(false)
  // null: no public page for this entry.
  const [settings, setSettings] = useState<LostFoundSettings | null>(null)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const current = await lostFoundApi.get(entryUuid).catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 404) return null
          throw err
        })
        if (!active) return
        setSettings(current)
        setNote(current?.note ?? "")
        setLoaded(true)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      active = false
    }
  }, [entryUuid])

  async function save(next: LostFoundSettings | null) {
    setSaving(true)
    setError("")
    try {
      if (next) {
        // Leaves the note draft alone, so toggling a checkbox keeps unsaved text.
        setSettings(await lostFoundApi.save(entryUuid, next))
      } else {
        await lostFoundApi.remove(entryUuid)
        setSettings(null)
        setNote("")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // Without the current settings the controls stay hidden; the switch would look off and overwrite them.
  if (!loaded) return error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null

  return (
    <section className="grid gap-4 rounded-xl border bg-muted/15 p-4 sm:p-5" aria-labelledby={`lostfound-${entryUuid}`}>
      <h2 id={`lostfound-${entryUuid}`} className="text-sm font-semibold">{t("lostfound.card.title")}</h2>
      <div className="flex items-start justify-between gap-4 text-sm">
        <label htmlFor={`lostfound-enable-${entryUuid}`}>
          <span className="block font-medium">{t("lostfound.card.enable")}</span>
          <span className="block text-muted-foreground">{t("lostfound.card.enableHint")}</span>
        </label>
        <Switch id={`lostfound-enable-${entryUuid}`} checked={settings !== null} disabled={saving} onCheckedChange={(checked: boolean) => void save(checked ? DEFAULT_SETTINGS : null)} />
      </div>
      {settings && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.show_name} disabled={saving} onChange={(event) => void save({ ...settings, show_name: event.target.checked })} />
            {t("lostfound.card.showName")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.show_photo} disabled={saving} onChange={(event) => void save({ ...settings, show_photo: event.target.checked })} />
            {t("lostfound.card.showPhoto")}
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("lostfound.card.note")}
            <Textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("lostfound.card.notePlaceholder")} />
          </label>
          <Button type="button" variant="outline" className="justify-self-start" disabled={saving || note === settings.note} onClick={() => void save({ ...settings, note })}>
            {t("lostfound.card.saveNote")}
          </Button>
        </>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
