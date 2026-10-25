import Scanner from "@/components/qr-bar-code/Scanner"
import BaseScreen from "@/layouts/BaseScreen"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"


export default function BarcodeArticleImportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()


  const areaId = new URLSearchParams(window.location.search).get("area") || undefined
  const boxId = new URLSearchParams(window.location.search).get("box") || undefined

  const handleCodeDetected = (code: string) => {
    // Handle the detected code here, e.g., navigate to a specific page or perform an action
    console.log("Detected code:", code)

    return navigate(-1)
  }

  // TODO: suport mass creation like in

  return (
    <BaseScreen title={t("quickActions.barcodeImport")}>
     <div>
      <Scanner onCodeDetected={async (code) => await handleCodeDetected(code)} onClose={() => navigate(-1)} />

     </div>
    </BaseScreen>
  )
}
