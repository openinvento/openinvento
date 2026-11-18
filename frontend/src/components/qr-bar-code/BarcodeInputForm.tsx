import { useEffect, useRef, useState, type FormEvent } from "react"
import { LoaderCircle, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type BarcodeInputFormProps = {
  onSubmit: (code: string) => Promise<void>
  autoFocus?: boolean
}

/**
 * Takes a code typed by hand or sent by a barcode scanner in keyboard (HID) mode, which types the
 * digits followed by Enter. The field is cleared as soon as a code is submitted and keeps the focus,
 * so the next scan can follow right away. Codes scanned while a lookup is still running are queued
 * and looked up in order, so none of them is lost or merged with the previous one.
 */
export function BarcodeInputForm({ onSubmit, autoFocus = true }: BarcodeInputFormProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const queue = useRef<string[]>([])
  const draining = useRef(false)
  const mounted = useRef(true)
  const latestOnSubmit = useRef(onSubmit)
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    latestOnSubmit.current = onSubmit
  }, [onSubmit])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function drain() {
    if (draining.current) return
    draining.current = true
    setBusy(true)
    // Stop when the page is left, e.g. after a lookup opened an entry.
    while (queue.current.length > 0 && mounted.current) {
      const code = queue.current.shift() as string
      try {
        await latestOnSubmit.current(code)
      } catch (reason) {
        if (mounted.current) setError(`${code}: ${reason instanceof Error ? reason.message : t("barcodeInput.error")}`)
      }
    }
    queue.current = []
    draining.current = false
    if (mounted.current) setBusy(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = value.trim()
    if (!code) return
    setValue("")
    setError("")
    queue.current.push(code)
    inputRef.current?.focus()
    void drain()
  }

  return (
    <form className="grid gap-2" onSubmit={submit}>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          aria-label={t("barcodeInput.label")}
          placeholder={t("barcodeInput.placeholder")}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          className="h-9 min-w-0 flex-1"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" className="h-9" disabled={!value.trim()}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Search />} {t("barcodeInput.submit")}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  )
}
