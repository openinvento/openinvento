import { useTranslation } from "react-i18next"
import { X } from "lucide-react"

import { BarcodeInputForm } from "@/components/qr-bar-code/BarcodeInputForm"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type ExternalBarcodeScannerModalProps = {
	onClose: () => void
	onSubmit: (code: string) => Promise<void>
}

export default function ExternalBarcodeScannerModal({ onClose, onSubmit }: ExternalBarcodeScannerModalProps) {
	const { t } = useTranslation()

	return (
		<Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
			<DialogContent showCloseButton={false} className="w-full max-w-md p-6">
				<DialogHeader className="flex-row items-start justify-between gap-4">
					<div>
						<DialogTitle>{t("manageCodes.externalScanner.title")}</DialogTitle>
						<DialogDescription className="mt-2">{t("manageCodes.externalScanner.ready")}</DialogDescription>
					</div>
					<DialogClose render={<Button aria-label={t("manageCodes.externalScanner.close")} size="icon" variant="ghost" />}>
						<X />
					</DialogClose>
				</DialogHeader>
				<div className="mt-4">
					<BarcodeInputForm onSubmit={onSubmit} />
				</div>
			</DialogContent>
		</Dialog>
	)
}
