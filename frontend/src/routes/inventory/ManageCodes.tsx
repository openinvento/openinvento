import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { Printer, ScanLine } from "lucide-react"

import Scanner from "@/components/qr-bar-code/Scanner"
import { Button } from "@/components/ui/button"
import BaseScreen from "@/layouts/BaseScreen"
import { inventoryApi, type CodePdfOptions } from "@/utils/api/inventory"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"

type CodeItem = {
	uuid: string
	identifier: string
	name: string
	type: "area" | "shelf" | "chest" | "article"
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
	const [isLoading, setIsLoading] = useState(true)
	const [isGenerating, setIsGenerating] = useState(false)
	const [error, setError] = useState("")

	async function handleCodeDetected(identifier: string) {
		const result = await inventoryApi.lookupCode(identifier)
		const paths: Record<typeof result.type, string> = {
			article: `/app/articles/${result.uuid}`,
			area: `/app/areas/${result.uuid}`,
			shelf: "/app/areas",
			chest: "/app/areas",
			category: "/app/manage-categories-and-fields",
			field: "/app/manage-categories-and-fields",
		}
		navigate(paths[result.type])
	}

	useEffect(() => {
		void (async () => {
			try {
				const [areas, shelves, chests, articles] = await Promise.all([
					inventoryApi.listAreas(),
					inventoryApi.listShelves(),
					inventoryApi.listChests(),
					inventoryApi.listArticles(),
				])
				const allItems = [
					...areas.map((item) => ({ ...item, type: "area" as const })),
					...shelves.map((item) => ({ ...item, type: "shelf" as const })),
					...chests.map((item) => ({ ...item, type: "chest" as const })),
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
                <Button className="w-full py-6 mb-5" onClick={() => setIsScannerOpen(true)}>
                    <ScanLine /> {t("manageCodes.scan")}
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
		</BaseScreen>
	)
}
