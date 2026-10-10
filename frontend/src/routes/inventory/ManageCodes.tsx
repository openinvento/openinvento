import { useEffect, useState } from "react"
import { Eye, Printer, ScanLine } from "lucide-react"

import Scanner from "@/components/qr-bar-code/Scanner"
import { Button } from "@/components/ui/button"
import BaseScreen from "@/layouts/BaseScreen"
import { inventoryApi, type CodePdfOptions } from "@/utils/api/inventory"
import { useTranslation } from "react-i18next"

type CodeItem = {
	uuid: string
	identifier: string
	name: string
	type: string
}

const codeTypes: Array<{ value: CodePdfOptions["code_type"]; label: string }> = [
	{ value: "qr", label: "QR code" },
	{ value: "barcode", label: "Barcode" },
]

export default function ManageCodes() {
    const { t } = useTranslation()

	const [items, setItems] = useState<CodeItem[]>([])
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

	useEffect(() => {
		void (async () => {
			try {
				const [areas, shelves, chests, articles] = await Promise.all([
					inventoryApi.listAreas(),
					inventoryApi.listShelves(),
					inventoryApi.listChests(),
					inventoryApi.listArticles(),
				])
				setItems([
					...areas.map((item) => ({ ...item, type: "Area" })),
					...shelves.map((item) => ({ ...item, type: "Shelf" })),
					...chests.map((item) => ({ ...item, type: "Chest" })),
					...articles.map((item) => ({ ...item, type: "Article" })),
				])
			} catch (reason) {
				setError(reason instanceof Error ? reason.message : "Unable to load inventory items.")
			} finally {
				setIsLoading(false)
			}
		})()
	}, [])

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
			setError("Select at least one item first.")
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
			setError(reason instanceof Error ? reason.message : "Unable to generate the codes.")
		} finally {
			setIsGenerating(false)
		}
	}

	return (
		<BaseScreen
			fullWidth
			title={t("manageCodes.title")}
			description="Select inventory items to print QR codes and barcodes."
		>
            <div className="mb-6 flex items-center justify-center gap-3">
                <Button className="w-full py-6 mb-5" onClick={() => setIsScannerOpen(true)}>
                    <ScanLine /> Scan a code
                </Button>
            </div>
			{isScannerOpen ? (
				<Scanner onClose={() => setIsScannerOpen(false)} />
			) : (
				<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
					<section className="min-w-0 rounded-xl border bg-card">
						<div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
							<div>
								<h2 className="font-semibold">Inventory items</h2>
								<p className="text-sm text-muted-foreground">{selectedIds.size} of {items.length} selected</p>
							</div>
							<Button variant="outline" size="sm" onClick={toggleAll} disabled={items.length === 0}>
								{selectedIds.size === items.length ? "Clear selection" : "Select all"}
							</Button>
						</div>
						{error && <p className="border-b bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
						{isLoading ? (
							<p className="p-6 text-sm text-muted-foreground">Loading inventory items...</p>
						) : items.length === 0 ? (
							<p className="p-6 text-sm text-muted-foreground">No inventory items found.</p>
						) : (
							<div className="divide-y">
								{items.map((item) => (
									<label key={item.uuid} className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-muted/50">
										<input type="checkbox" checked={selectedIds.has(item.uuid)} onChange={() => toggleSelected(item.uuid)} />
										<span className="min-w-0 flex-1">
											<span className="block truncate font-medium">{item.name}</span>
											<span className="block text-xs text-muted-foreground">{item.type} · {item.identifier}</span>
										</span>
									</label>
								))}
							</div>
						)}
					</section>

					<aside className="h-fit rounded-xl border bg-card p-4">
						<h2 className="font-semibold">Code options</h2>
						<div className="mt-4 grid gap-4">
							<label className="grid gap-1.5 text-sm font-medium">
								Code type
								<select className="h-9 rounded-lg border bg-background px-2" value={options.code_type} onChange={(event) => setOptions({ ...options, code_type: event.target.value as CodePdfOptions["code_type"] })}>
									{codeTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
								</select>
							</label>
							<label className="grid gap-1.5 text-sm font-medium">
								Paper size
								<select className="h-9 rounded-lg border bg-background px-2" value={options.size} onChange={(event) => setOptions({ ...options, size: event.target.value as CodePdfOptions["size"] })}>
									<option value="a4">A4</option><option value="a5">A5</option><option value="letter">Letter</option>
								</select>
							</label>
							<label className="grid gap-1.5 text-sm font-medium">
								Layout
								<select className="h-9 rounded-lg border bg-background px-2" value={options.layout} onChange={(event) => setOptions({ ...options, layout: event.target.value as CodePdfOptions["layout"] })}>
									<option value="vertical">Vertical</option><option value="horizontal">Horizontal</option>
								</select>
							</label>
							<div className="grid gap-2 pt-2">
								<Button variant="outline" onClick={() => void openCodes(true)} disabled={isGenerating || selectedIds.size === 0}>
									<Printer /> Print codes
								</Button>
							</div>
						</div>
					</aside>
				</div>
			)}
		</BaseScreen>
	)
}
