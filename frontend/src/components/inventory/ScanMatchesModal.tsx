import { useState } from "react"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { type CodeLookupMatch } from "@/utils/api/inventory"

type ScanMatchesModalProps = {
	matches: CodeLookupMatch[]
	onClose: () => void
	onSelect: (match: CodeLookupMatch) => Promise<void>
}

export default function ScanMatchesModal({ matches, onClose, onSelect }: ScanMatchesModalProps) {
	const { t } = useTranslation()
	const [error, setError] = useState("")

	return (
		<Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
			<DialogContent showCloseButton={false} className="flex h-full max-h-[100dvh] w-full flex-col rounded-none p-4 sm:h-auto sm:max-h-[80vh] sm:max-w-md sm:rounded-xl sm:p-6">
				<DialogHeader className="flex-row items-start justify-between gap-4">
					<div>
						<DialogTitle>{t("manageCodes.matches.title", { count: matches.length })}</DialogTitle>
						<DialogDescription className="mt-2">{t("manageCodes.matches.description")}</DialogDescription>
					</div>
					<DialogClose render={<Button aria-label={t("manageCodes.matches.close")} size="icon" variant="ghost" />}>
						<X />
					</DialogClose>
				</DialogHeader>
				<ul className="mt-4 min-h-0 divide-y overflow-y-auto rounded-lg border">
					{matches.map((match) => (
						<li key={match.uuid}>
							<button
								type="button"
								className="flex min-h-16 w-full flex-col items-start justify-center gap-0.5 p-3 text-left transition-colors hover:bg-muted/50 sm:min-h-0"
								onClick={() => {
									setError("")
									onSelect(match).catch((reason) => setError(reason instanceof Error ? reason.message : t("manageCodes.externalScanner.errors.lookup")))
								}}
							>
								<span className="font-medium">{match.name}</span>
								<span className="text-xs text-muted-foreground">
									{t(`manageCodes.types.${match.type}`, { defaultValue: match.type })} · {match.inventory.name}
								</span>
							</button>
						</li>
					))}
				</ul>
				{error && <p className="mt-4 text-sm text-destructive">{error}</p>}
			</DialogContent>
		</Dialog>
	)
}
