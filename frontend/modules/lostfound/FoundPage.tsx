import { useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { lostFoundApi, type FoundEntry } from "./api"

type FoundPageProps = {
  inventory: string
  identifier: string
  entry: FoundEntry
}

/** Public contact page for someone who scans an entry and is not signed in. Shows only what the owner enabled. */
export default function FoundPage({ inventory, identifier, entry }: FoundPageProps) {
  const { t } = useTranslation()
  const [message, setMessage] = useState("")
  const [contact, setContact] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setError("")
    try {
      await lostFoundApi.contact(inventory, identifier, message.trim(), contact.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("lostfound.found.error"))
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      <header className="grid gap-2 text-center">
        <h1 className="text-2xl font-bold">{t("lostfound.found.title")}</h1>
        {entry.name && <p className="text-lg font-medium">{entry.name}</p>}
      </header>
      {entry.has_photo && (
        <img
          src={lostFoundApi.photoUrl(inventory, identifier)}
          alt={entry.name ?? t("lostfound.found.photo")}
          className="mx-auto max-h-64 rounded-xl border object-contain"
        />
      )}
      {entry.note && <p className="whitespace-pre-line rounded-xl border bg-muted/20 p-4 text-sm">{entry.note}</p>}
      {sent ? (
        <p role="status" className="rounded-xl bg-primary/10 p-4 text-center text-sm">{t("lostfound.found.sent")}</p>
      ) : (
        <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
          <p className="text-sm text-muted-foreground">{t("lostfound.found.description")}</p>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("lostfound.found.message")}
            <Textarea required maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t("lostfound.found.messagePlaceholder")} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("lostfound.found.contact")}
            <Input maxLength={200} value={contact} onChange={(event) => setContact(event.target.value)} />
            <span className="text-xs font-normal text-muted-foreground">{t("lostfound.found.contactHint")}</span>
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={sending || !message.trim()}>{t("lostfound.found.send")}</Button>
        </form>
      )}
    </main>
  )
}
