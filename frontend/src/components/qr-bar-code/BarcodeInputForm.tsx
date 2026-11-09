import { useRef, useState, type FormEvent } from "react"
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
 * digits followed by Enter. The field keeps the focus after each lookup, so the next scan lands here too.
 * After an error the code stays selected, so the next scan replaces it instead of being appended.
 */
export function BarcodeInputForm({ onSubmit, autoFocus = true }: BarcodeInputFormProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = value.trim()
    if (!code || busy) return
    setBusy(true)
    setError("")
    try {
      await onSubmit(code)
      setValue("")
      inputRef.current?.focus()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("barcodeInput.error"))
      inputRef.current?.select()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="grid gap-2" onSubmit={(event) => void submit(event)}>
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
        <Button type="submit" className="h-9" disabled={busy || !value.trim()}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Search />} {t("barcodeInput.submit")}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  )
}
