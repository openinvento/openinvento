import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { LoaderCircle, Printer, ScanBarcode, ScanLine, X } from "lucide-react"

import Scanner from "@/components/qr-bar-code/Scanner"
import { Button } from "@/components/ui/button"
import BaseScreen from "@/layouts/BaseScreen"
import { inventoryApi, type CodePdfOptions, type Shelf } from "@/utils/api/inventory"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"

type CodeItem = {
	uuid: string
	identifier: string
	name: string
	type: "area" | "shelf" | "box" | "article"
}

const codeTypes: CodePdfOptions["code_type"][] = [
	"qr",
	"barcode",
]

export default function ManageCodes() {
    const { t } = useTranslation()
	const navigate = useNavigate()

	const [items, setItems] = useState<CodeItem[]>([])
	const [filteredItems, setFilteredItems] = useState<CodeItem[]>([])
	const [searchQuery, setSearchQuery] = useState("")
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [options, setOptions] = useState<Omit<CodePdfOptions, "uuids">>({
		code_type: "qr",
		size: "a4",
		layout: "vertical",
	})

	const [isScannerOpen, setIsScannerOpen] = useState(false)

	const [useExternalBarcodeScanner, setUseExternalBarcodeScanner] = useState(false)
	const [externalScanError, setExternalScanError] = useState("")
	const [isLookingUpExternalCode, setIsLookingUpExternalCode] = useState(false)
	const [isListeningForExternalCode, setIsListeningForExternalCode] = useState(false)
	const externalCodeBuffer = useRef("")

	const externalCodeTimer = useRef<number | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isGenerating, setIsGenerating] = useState(false)
	const [error, setError] = useState("")

	async function handleCodeDetected(code: string) {
		const result = await inventoryApi.lookupCode(code)
		switch (result.type) {
			case "article":
				navigate(`/app/articles/${result.uuid}`)
				break
			case "area":
				navigate(`/app/areas/${result.uuid}`)
				break
			case "shelf": {
				const shelf = await inventoryApi.getEntry<Shelf>(result.uuid)
				if (!shelf) throw new Error(t("manageCodes.externalScanner.errors.lookup"))
				navigate(`/app/areas/${shelf.area}`)
				break
			}
			case "box":
				navigate(`/app/boxes/${result.uuid}`)
				break
		}
	}

	/* External barcode scanners */
	useEffect(() => {
		if (!useExternalBarcodeScanner) return

		const finishInput = async () => {
			if (externalCodeTimer.current !== null) {
				window.clearTimeout(externalCodeTimer.current)
				externalCodeTimer.current = null
			}
			const identifier = externalCodeBuffer.current.trim()
			externalCodeBuffer.current = ""
			setIsListeningForExternalCode(false)
			if (!identifier || isLookingUpExternalCode) return

			setIsLookingUpExternalCode(true)
			setExternalScanError("")
			try {
				await handleCodeDetected(identifier)
			} catch (reason) {
				setExternalScanError(reason instanceof Error ? reason.message : t("manageCodes.externalScanner.errors.lookup"))
			} finally {
				setIsLookingUpExternalCode(false)
			}
		}

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setUseExternalBarcodeScanner(false)
				return
			}
			if (event.key === "Enter") {
				event.preventDefault()
				void finishInput()
				return
			}
			if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) return

			externalCodeBuffer.current += event.key
			if (externalCodeTimer.current !== null) window.clearTimeout(externalCodeTimer.current)
			setIsListeningForExternalCode(true)
			externalCodeTimer.current = window.setTimeout(() => void finishInput(), 300)
		}

		window.addEventListener("keydown", onKeyDown) // register event listener
		return () => {
			window.removeEventListener("keydown", onKeyDown)
			if (externalCodeTimer.current !== null) window.clearTimeout(externalCodeTimer.current)
			externalCodeTimer.current = null
			externalCodeBuffer.current = ""
			setIsListeningForExternalCode(false)
		}
	}, [useExternalBarcodeScanner, isLookingUpExternalCode, t])

	useEffect(() => {
		void (async () => {
			try {
				const [areas, shelves, boxes, articles] = await Promise.all([
					inventoryApi.listAreas(),
					inventoryApi.listShelves(),
					inventoryApi.listBoxes(),
					inventoryApi.listArticles(),
				])
				const allItems = [
					...areas.map((item) => ({ ...item, type: "area" as const })),
					...shelves.map((item) => ({ ...item, type: "shelf" as const })),
					...boxes.map((item) => ({ ...item, type: "box" as const })),
					...articles.map((item) => ({ ...item, type: "article" as const })),
				]
				setFilteredItems(allItems)
				setItems(allItems)
			} catch (reason) {
				setError(reason instanceof Error ? reason.message : t("manageCodes.errors.load"))
			} finally {
				setIsLoading(false)
			}
		})()
	}, [])

	useEffect(() => {
		if (searchQuery.trim() === "") {
			setFilteredItems([])
		} else {
			const filtered = items.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
			setFilteredItems(filtered)
		}
	}, [searchQuery])

	function toggleSelected(uuid: string) {
		setSelectedIds((current) => {
			const next = new Set(current)
			if (next.has(uuid)) next.delete(uuid)
			else next.add(uuid)
			return next
		})
	}

	function toggleAll() {
		setSelectedIds((current) => current.size === items.length ? new Set() : new Set(items.map((item) => item.uuid)))
	}

	async function openCodes(print: boolean) {
		if (selectedIds.size === 0) {
			setError(t("manageCodes.errors.selectItem"))
			return
		}

		setError("")
		setIsGenerating(true)
		try {
			const pdf = await inventoryApi.generateCodesPdf({
				...options,
				uuids: [...selectedIds],
			})
			const url = URL.createObjectURL(pdf)
			const pdfWindow = window.open(url, "_blank", "noopener,noreferrer")
			if (print && pdfWindow) {
				pdfWindow.addEventListener("load", () => pdfWindow.print(), { once: true })
			}
			window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : t("manageCodes.errors.generate"))
		} finally {
			setIsGenerating(false)
		}
	}

	return (
		<BaseScreen
			fullWidth
			title={t("manageCodes.title")}
			description={t("manageCodes.description")}
		>
            <div className="mb-6 flex items-center justify-center gap-3">
                <Button className="flex-1 py-6 mb-5" onClick={() => setIsScannerOpen(true)}>
                    <ScanLine /> {t("manageCodes.scan")}
                </Button>
				<Button 
					variant="outline" size="icon" className="border-dashed py-6 mb-5 w-1/12" 
					onClick={() => setUseExternalBarcodeScanner(true)} title={t("manageCodes.useExternalBarcodeScanner")}
				>
					<ScanBarcode className="h-5 w-5 text-muted-foreground" />
				</Button>
            </div>
			{isScannerOpen ? (
				<Scanner onClose={() => setIsScannerOpen(false)} onCodeDetected={handleCodeDetected} />
			) : (
				<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
					<section className="min-w-0 rounded-xl border bg-card">
						<div className="flex flex-wrap items-center justify-between gap-3 p-4 pb-0">
							<div>
								<h2 className="font-semibold">{t("manageCodes.inventoryItems")}</h2>
								<p className="text-sm text-muted-foreground">{t("manageCodes.selectedCount", { selected: selectedIds.size, total: items.length })}</p>
							</div>
							<Button variant="outline" size="sm" onClick={toggleAll} disabled={items.length === 0}>
								{selectedIds.size === items.length ? t("manageCodes.clearSelection") : t("manageCodes.selectAll")}
							</Button>
						</div>
						<div className="flex items-center justify-between gap-3 border-b p-4">
							<Input placeholder={t("manageCodes.searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
						</div>
						{error && <p className="border-b bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
						{isLoading ? (
							<p className="p-6 text-sm text-muted-foreground">{t("manageCodes.loading")}</p>
						) : items.length === 0 ? (
							<p className="p-6 text-sm text-muted-foreground">{t("manageCodes.noItems")}</p>
						) : (
							<div className="divide-y">
								{filteredItems.map((item) => (
									<label key={item.uuid} className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-muted/50">
										<input type="checkbox" checked={selectedIds.has(item.uuid)} onChange={() => toggleSelected(item.uuid)} />
										<span className="min-w-0 flex-1">
											<span className="block truncate font-medium">{item.name}</span>
											<span className="block text-xs text-muted-foreground">{t(`manageCodes.types.${item.type}`)} · {item.identifier}</span>
										</span>
									</label>
								))}
							</div>
						)}
					</section>

					<aside className="h-fit rounded-xl border bg-card p-4">
						<h2 className="font-semibold">{t("manageCodes.options")}</h2>
						<div className="mt-4 grid gap-4">
							<label className="grid gap-1.5 text-sm font-medium">
								{t("manageCodes.codeType")}
								<select className="h-9 rounded-lg border bg-background px-2" value={options.code_type} onChange={(event) => setOptions({ ...options, code_type: event.target.value as CodePdfOptions["code_type"] })}>
									{codeTypes.map((type) => <option key={type} value={type}>{t(`manageCodes.codeTypes.${type}`)}</option>)}
								</select>
							</label>
							<label className="grid gap-1.5 text-sm font-medium">
								{t("manageCodes.paperSize")}
								<select className="h-9 rounded-lg border bg-background px-2" value={options.size} onChange={(event) => setOptions({ ...options, size: event.target.value as CodePdfOptions["size"] })}>
									<option value="a4">A4</option><option value="a5">A5</option><option value="letter">Letter</option>
								</select>
							</label>
							<label className="grid gap-1.5 text-sm font-medium">
								{t("manageCodes.layout")}
								<select className="h-9 rounded-lg border bg-background px-2" value={options.layout} onChange={(event) => setOptions({ ...options, layout: event.target.value as CodePdfOptions["layout"] })}>
									<option value="vertical">Vertical</option><option value="horizontal">Horizontal</option>
								</select>
							</label>
							<div className="grid gap-2 pt-2">
								<Button variant="outline" onClick={() => void openCodes(true)} disabled={isGenerating || selectedIds.size === 0}>
									<Printer /> {t("manageCodes.print")}
								</Button>
							</div>
						</div>
					</aside>
				</div>
			)}
			{useExternalBarcodeScanner && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => {
					if (event.target === event.currentTarget) setUseExternalBarcodeScanner(false)
				}}>
					<section role="dialog" aria-modal="true" aria-labelledby="external-scanner-title" className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
						<div className="flex items-start justify-between gap-4">
							<div>
								<h2 id="external-scanner-title" className="text-lg font-semibold">{t("manageCodes.externalScanner.title")}</h2>
								<p className="mt-2 text-sm text-muted-foreground">{t("manageCodes.externalScanner.ready")}</p>
							</div>
							<Button aria-label={t("manageCodes.externalScanner.close")} size="icon" variant="ghost" onClick={() => setUseExternalBarcodeScanner(false)}>
								<X />
							</Button>
						</div>
						{(isListeningForExternalCode || isLookingUpExternalCode) && <p className="mt-4 flex items-center gap-2 text-sm"><LoaderCircle className="size-4 animate-spin" />{isLookingUpExternalCode ? t("manageCodes.externalScanner.lookingUp") : t("manageCodes.externalScanner.listening")}</p>}
						{externalScanError && <p className="mt-4 text-sm text-destructive">{externalScanError}</p>}
					</section>
				</div>
			)}
		</BaseScreen>
	)
}
