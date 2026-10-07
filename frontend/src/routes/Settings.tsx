import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import BaseScreen from "@/layouts/BaseScreen";
import AdminSettings from "@/components/settings/AdminSettings";
import UserSettings from "@/components/settings/UserSettings";
import { getCurrentSession } from "@/utils/api/auth";

export default function SettingsPage() {
  const { t } = useTranslation();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"user" | "admin">("user");

  useEffect(() => {
    getCurrentSession()
      .then((session) => setIsAdmin(Boolean(session.user?.is_superuser)))
      .catch(() => setIsAdmin(false));
  }, []);

  return (
    <BaseScreen title={t("settings.title")}>
      <div className="flex flex-col gap-6">
      {isAdmin && (
        <div className="flex gap-1 border-b" role="tablist" aria-label={t("settings.tabsLabel")}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "user"}
            className="border-b-2 px-3 py-2 text-sm font-medium data-[active=false]:border-transparent data-[active=false]:text-muted-foreground"
            data-active={activeTab === "user"}
            onClick={() => setActiveTab("user")}
          >
            {t("settings.userTab")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "admin"}
            className="border-b-2 px-3 py-2 text-sm font-medium data-[active=false]:border-transparent data-[active=false]:text-muted-foreground"
            data-active={activeTab === "admin"}
            onClick={() => setActiveTab("admin")}
          >
            {t("settings.adminTab")}
          </button>
        </div>
      )}
      {isAdmin === false && <UserSettings />}
      {isAdmin === true && activeTab === "user" && <UserSettings />}
      {isAdmin === true && activeTab === "admin" && <AdminSettings />}
      </div>
    </BaseScreen>
  );
}
