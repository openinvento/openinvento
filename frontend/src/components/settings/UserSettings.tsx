import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getAuthErrorMessage } from "@/utils/api/auth-errors"
import { getCurrentSession, updatePersonalAccount } from "@/utils/api/auth"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ThemeOption = "light" | "dark" | "system"

export default function UserSettings() {
  const { t, i18n } = useTranslation()
  const [username, setUsername] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [accountError, setAccountError] = useState<string | null>(null)
  const [accountSaving, setAccountSaving] = useState(false)
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
        }
      })
      .catch(() => setAccountError(t("settings.accountLoadError")))
  }, [t])

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

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section className="border-b pb-7">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">
            {t("settings.personalAccount")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("settings.personalAccountDescription")}
          </p>
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

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("settings.languageLabel")}</label>
        <Select value={i18n.resolvedLanguage ?? "en"} onValueChange={(language) => language && i18n.changeLanguage(language)}>
          <SelectTrigger className="w-45">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="de">Deutsch</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("settings.themeLabel")}</label>
        <Select value={theme} onValueChange={handleThemeChange}>
          <SelectTrigger className="w-45">
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
  )
}