import BaseScreen from "@/layouts/BaseScreen"
import { useTranslation } from "react-i18next"

export default function SearchPage() {
  const { t } = useTranslation()

  return (
    <BaseScreen title={t("search.searchTitle")} description={t("search.searchDescription")}>
        <h1>Search here (backend!!)</h1>
    </BaseScreen>
  )
}
