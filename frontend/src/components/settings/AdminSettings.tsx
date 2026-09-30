import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { getInstanceSettings, updateInstanceSettings } from "@/utils/api/auth"

export default function AdminSettings() {
  const { t } = useTranslation()
  const [allowEmailLogin, setAllowEmailLogin] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getInstanceSettings()
      .then((settings) => setAllowEmailLogin(settings.allow_email_login))
      .catch(() => setSettingsError(t("settings.instanceSettingsLoadError")))
  }, [t])

  async function handleEmailLoginChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.checked
    setAllowEmailLogin(value)
    setSaving(true)
    setSettingsError(null)
    try {
      await updateInstanceSettings({ allow_email_login: value })
    } catch {
      setAllowEmailLogin(!value)
      setSettingsError(t("settings.instanceSettingsSaveError"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Field>
        <FieldLabel htmlFor="allow-email-login" className="flex-row items-start">
          <input
            id="allow-email-login"
            type="checkbox"
            checked={allowEmailLogin}
            onChange={handleEmailLoginChange}
            disabled={saving}
            className="mt-1 size-4"
          />
          <span>
            {t("settings.allowEmailLogin")}
            <FieldDescription>{t("settings.allowEmailLoginDescription")}</FieldDescription>
          </span>
        </FieldLabel>
        <FieldError>{settingsError}</FieldError>
      </Field>
    </div>
  )
}