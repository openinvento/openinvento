import { useState } from "react"
import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { resetCredentials } from "@/utils/api/auth"
import { getAuthErrorMessage } from "@/utils/api/auth-errors"

export default function ResetCredentialsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmPassword) {
      setError(t("auth.errors.passwordMismatch"))
      return
    }

    setSaving(true)
    setError(null)
    try {
      await resetCredentials(username.trim(), password)
      navigate("/app", { replace: true })
    } catch (submissionError) {
      setError(getAuthErrorMessage(submissionError, t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <form onSubmit={handleSubmit} className="w-full space-y-6">
        <FieldGroup>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{t("auth.reset.title")}</h1>
            <FieldDescription>{t("auth.reset.warning")}</FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="username">{t("auth.fields.username")}</FieldLabel>
            <Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-password">{t("auth.reset.newPassword")}</FieldLabel>
            <Input id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-password">{t("auth.reset.confirmPassword")}</FieldLabel>
            <Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required autoComplete="new-password" />
          </Field>
          <Field>
            <FieldError>{error}</FieldError>
            <Button type="submit" disabled={saving}>{saving ? t("auth.reset.saving") : t("auth.reset.submit")}</Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}