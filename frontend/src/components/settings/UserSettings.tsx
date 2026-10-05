import { useState } from "react"
import { useTranslation } from "react-i18next"

import { FieldDescription } from "@/components/ui/field"
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
  const [theme, setTheme] = useState<ThemeOption>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as ThemeOption) || "system"
    }
    return "system"
  })

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