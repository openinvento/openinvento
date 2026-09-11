import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentSession, type SessionUser } from "@/utils/api/auth";
import { FieldDescription } from "@/components/ui/field";
import BaseScreen from "@/layouts/BaseScreen";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ThemeOption = "light" | "dark" | "system";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();

  const [theme, setTheme] = useState<ThemeOption>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as ThemeOption) || "system";
    }
    return "system";
  });

  const handleThemeChange = (newTheme: any) => {
    setTheme(newTheme);
    if (typeof window !== "undefined") {
      if (newTheme === "system") {
        localStorage.removeItem("theme");
      } else {
        localStorage.setItem("theme", newTheme);
      }
      window.dispatchEvent(new Event("storage"));
    }
  };

  const handleLanguageChange = (lng: any) => {
    i18n.changeLanguage(lng);
  };

  return (
    <BaseScreen title={t("settings.title")}>
      <div className="flex max-w-2xl flex-col gap-6">

      {/* language settings */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Sprache / Language</label>
        <Select value={i18n.resolvedLanguage} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-45">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="de">Deutsch</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* design settings */}
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
        <FieldDescription>
          {t("settings.description")}
        </FieldDescription>
      </div>
      </div>
    </BaseScreen>
  );
}
