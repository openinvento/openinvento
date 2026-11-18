import { X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { BarcodeInputForm } from "@/components/qr-bar-code/BarcodeInputForm"
import { Button } from "@/components/ui/button"

type ExternalBarcodeScannerModalProps = {
	onClose: () => void
	onSubmit: (code: string) => Promise<void>
}

export default function ExternalBarcodeScannerModal({ onClose, onSubmit }: ExternalBarcodeScannerModalProps) {
	const { t } = useTranslation()

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose()
			}}
		>
			<section
				role="dialog"
				aria-modal="true"
				aria-labelledby="external-scanner-title"
				className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg"
				onKeyDown={(event) => { if (event.key === "Escape") onClose() }}
			>
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 id="external-scanner-title" className="text-lg font-semibold">{t("manageCodes.externalScanner.title")}</h2>
						<p className="mt-2 text-sm text-muted-foreground">{t("manageCodes.externalScanner.ready")}</p>
					</div>
					<Button aria-label={t("manageCodes.externalScanner.close")} size="icon" variant="ghost" onClick={onClose}>
						<X />
					</Button>
				</div>
				<div className="mt-4">
					<BarcodeInputForm onSubmit={onSubmit} />
				</div>
			</section>
		</div>
	)
}
