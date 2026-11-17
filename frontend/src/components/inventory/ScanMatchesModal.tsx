import { useState } from "react"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
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
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose()
			}}
		>
			<section
				role="dialog"
				aria-modal="true"
				aria-labelledby="scan-matches-title"
				className="flex h-full max-h-[100dvh] w-full flex-col rounded-none border bg-card p-4 shadow-lg sm:h-auto sm:max-h-[80vh] sm:max-w-md sm:rounded-xl sm:p-6"
			>
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 id="scan-matches-title" className="text-lg font-semibold">{t("manageCodes.matches.title", { count: matches.length })}</h2>
						<p className="mt-2 text-sm text-muted-foreground">{t("manageCodes.matches.description")}</p>
					</div>
					<Button aria-label={t("manageCodes.matches.close")} size="icon" variant="ghost" onClick={onClose}>
						<X />
					</Button>
				</div>
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
			</section>
		</div>
	)
}
