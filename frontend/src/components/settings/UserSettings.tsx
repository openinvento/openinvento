import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getAuthErrorMessage } from "@/utils/api/auth-errors"
import { getCurrentSession, logout, updatePersonalAccount } from "@/utils/api/auth"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useNavigate } from "react-router"
import { createAPIKey, getAPIKeys, renameAPIKey, revokeAPIKey, type APIKey } from "@/utils/api/settings"
import { Switch } from "@/components/ui/switch"

type ThemeOption = "light" | "dark" | "system"

export default function UserSettings() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  
  const [username, setUsername] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [hasPassword, setHasPassword] = useState(true)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [accountSaving, setAccountSaving] = useState(false)
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [apiKeyName, setApiKeyName] = useState("")
  const [apiKeyValue, setApiKeyValue] = useState<string | null>(null)
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [apiKeysLoading, setApiKeysLoading] = useState(true)
  const [apiKeysSaving, setApiKeysSaving] = useState(false)
  const [disableMobileZoom, setDisableMobileZoom] = useState(() => localStorage.getItem("disableMobileZoom") !== "false")
  
  const [theme, setTheme] = useState<ThemeOption>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as ThemeOption) || "system"
    }
    return "system"
  })

  useEffect(() => {
    getCurrentSession()
      .then((session) => {
        if (session.user) {
          setUsername(session.user.username)
          setName(session.user.name || session.user.username)
          setHasPassword(session.user.has_password)
        }
      })
      .catch(() => setAccountError(t("settings.accountLoadError")))
  }, [t])

  useEffect(() => {
    getAPIKeys()
      .then(setApiKeys)
      .catch(() => setApiKeyError(t("settings.apiKeys.loadError")))
      .finally(() => setApiKeysLoading(false))
  }, [t])

  async function handleCreateAPIKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setApiKeyError(null)
    setApiKeysSaving(true)
    try {
      const created = await createAPIKey(apiKeyName.trim())
      setApiKeys((current) => [created, ...current])
      setApiKeyValue(created.key)
      setApiKeyName("")
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : t("settings.apiKeys.createError"))
    } finally {
      setApiKeysSaving(false)
    }
  }

  async function handleRenameAPIKey(key: APIKey) {
    const name = window.prompt(t("settings.apiKeys.renamePrompt"), key.name)?.trim()
    if (!name || name === key.name) return
    setApiKeyError(null)
    try {
      const updated = await renameAPIKey(key.id, name)
      setApiKeys((current) => current.map((item) => item.id === key.id ? updated : item))
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : t("settings.apiKeys.updateError"))
    }
  }

  async function handleRevokeAPIKey(key: APIKey) {
    if (!window.confirm(t("settings.apiKeys.revokeConfirm", { name: key.name }))) return
    setApiKeyError(null)
    try {
      await revokeAPIKey(key.id)
      setApiKeys((current) => current.map((item) => item.id === key.id ? { ...item, revoked: true } : item))
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : t("settings.apiKeys.revokeError"))
    }
  }

  async function handleAccountSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAccountError(null)

    if (password !== confirmPassword) {
      setAccountError(t("auth.errors.passwordMismatch"))
      return
    }

    setAccountSaving(true)
    try {
      const response = await updatePersonalAccount(
        username.trim(),
        name.trim() || username.trim(),
        password || undefined,
      )
      setUsername(response.user.username)
      setName(response.user.name)
      setPassword("")
      setConfirmPassword("")
    } catch (error) {
      setAccountError(getAuthErrorMessage(error, t))
    } finally {
      setAccountSaving(false)
    }
  }

  async function handleLogout() {
    try {
      await logout()
      console.log("Redirecting to login page...")
      navigate("/auth/login?logged_out=1", { replace: true })
    } catch (error) {
      console.error("Error during logout:", error)
    }
  }
  
  function handleThemeChange(newTheme: ThemeOption | null) {
    if (!newTheme) {
      return
    }
    const nextTheme = newTheme as ThemeOption
    setTheme(nextTheme)
    if (nextTheme === "system") {
      localStorage.removeItem("theme")
    } else {
      localStorage.setItem("theme", nextTheme)
    }
    window.dispatchEvent(new Event("storage"))
  }

  function handleDisableMobileZoomChange(checked: boolean) {
    setDisableMobileZoom(checked)
    localStorage.setItem("disableMobileZoom", String(checked))
    window.dispatchEvent(new Event("mobile-zoom-setting-changed"))
  }

  const languageName = (language: string) => {
    switch (language) {
      case "de":
        return "Deutsch"
      case "en":
        return "English"
      case "es":
        return "Español"
      case "fr":
        return "Français"
      default:
        return language
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="border-b pb-7">
        <div className="flex items-center justify-between">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">
              {t("settings.personalAccount")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("settings.personalAccountDescription")}
            </p>
          </div>
          <Button variant="outline" className="px-10" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        <form onSubmit={handleAccountSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="account-username">
              {t("settings.accountUsername")}
            </FieldLabel>
            <Input
              id="account-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoComplete="username"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="account-name">
              {t("settings.accountName")}
            </FieldLabel>
            <Input
              id="account-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoComplete="name"
            />
          </Field>

          {hasPassword ? (
            <>
              <Field>
                <FieldLabel htmlFor="account-password">
                  {t("settings.accountPassword")}
                </FieldLabel>
                <Input
                  id="account-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="account-password-confirm">
                  {t("settings.accountPasswordConfirm")}
                </FieldLabel>
                <Input
                  id="account-password-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>

            </>
          ) : (
            <FieldDescription className="sm:col-span-2">
              {t("settings.accountPasswordManagedBySso")}
            </FieldDescription>
          )}

          <FieldError className="sm:col-span-2">{accountError}</FieldError>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={accountSaving}>
              {accountSaving
                ? t("settings.accountSaving")
                : t("settings.accountSave")}
            </Button>
          </div>
        </form>
      </section>

      <section className="border-b pb-7">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">{t("settings.apiKeys.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.apiKeys.description")}</p>
        </div>
        {apiKeyValue && (
          <div className="mb-4 rounded-md border bg-muted/30 p-4">
            <p className="mb-2 text-sm font-medium">{t("settings.apiKeys.createdOnce")}</p>
            <code className="block break-all text-sm">{apiKeyValue}</code>
            <Button type="button" variant="outline" className="mt-3" onClick={() => void navigator.clipboard?.writeText(apiKeyValue)}>
              {t("settings.apiKeys.copy")}
            </Button>
            <Button type="button" variant="ghost" className="ml-2 mt-3" onClick={() => setApiKeyValue(null)}>
              {t("settings.apiKeys.dismiss")}
            </Button>
          </div>
        )}
        <form onSubmit={handleCreateAPIKey} className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Input value={apiKeyName} onChange={(event) => setApiKeyName(event.target.value)} maxLength={50} placeholder={t("settings.apiKeys.namePlaceholder")} required aria-label={t("settings.apiKeys.nameLabel")} />
          <Button type="submit" disabled={apiKeysSaving}>{apiKeysSaving ? t("settings.apiKeys.creating") : t("settings.apiKeys.create")}</Button>
        </form>
        <FieldError>{apiKeyError}</FieldError>
        {apiKeysLoading ? <p className="text-sm text-muted-foreground">{t("settings.apiKeys.loading")}</p> : apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("settings.apiKeys.empty")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {apiKeys.map((key) => (
              <li key={key.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-medium">{key.name} {key.revoked && <span className="text-xs text-muted-foreground">({t("settings.apiKeys.revoked")})</span>}</p>
                  <p className="text-sm text-muted-foreground">{t("settings.apiKeys.prefix", { prefix: key.prefix })}</p>
                </div>
                {!key.revoked && <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => void handleRenameAPIKey(key)}>{t("settings.apiKeys.rename")}</Button>
                  <Button type="button" variant="destructive" onClick={() => void handleRevokeAPIKey(key)}>{t("settings.apiKeys.revoke")}</Button>
                </div>}
              </li>
            ))}
          </ul>
        )}
      </section>


      <h2 className="text-xl font-semibold">{t("settings.UISettings")}</h2>
      <section className="border-b pb-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="disable-mobile-zoom" className="text-sm font-medium">{t("settings.disableMobileZoom")}</label>
            <p className="text-sm text-muted-foreground">{t("settings.mobileZoomDescription")}</p>
          </div>
          <Switch id="disable-mobile-zoom" checked={disableMobileZoom} onCheckedChange={handleDisableMobileZoomChange} aria-label={t("settings.disableMobileZoom")} />
        </div>
      </section>

      <div className="flex flex-row justify-between gap-6 ">
        <div className="flex flex-1 flex-col gap-2">
          <label className="text-sm font-medium">{t("settings.languageLabel")}</label>
          <Select value={i18n.resolvedLanguage ?? "en"} itemToStringLabel={() => (languageName(i18n.resolvedLanguage ?? "en"))} onValueChange={(language) => language && i18n.changeLanguage(language)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>{t("settings.language.description")}</FieldDescription>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <label className="text-sm font-medium">{t("settings.themeLabel")}</label>
          <Select value={theme} onValueChange={handleThemeChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("settings.themePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t("settings.themeLight")}</SelectItem>
              <SelectItem value="dark">{t("settings.themeDark")}</SelectItem>
              <SelectItem value="system">{t("settings.themeSystem")}</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>{t("settings.description")}</FieldDescription>
        </div>

      </div>
    </div>
  )
}
