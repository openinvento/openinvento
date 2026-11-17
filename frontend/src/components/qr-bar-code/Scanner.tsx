import { useEffect, useRef, useState } from "react"
import { BarcodeDetector, prepareZXingModule } from "barcode-detector/ponyfill"
import zxingReaderWasm from "zxing-wasm/reader/zxing_reader.wasm?url"
import { Camera, LoaderCircle, RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

interface PrepareZXingOptions {
	overrides?: {
		locateFile?: (path: string, prefix: string) => string;
	};
}

prepareZXingModule({
	overrides: {
		locateFile: (path: string, prefix: string): string => {
			if (path.endsWith(".wasm")) {
				return zxingReaderWasm
			}
			return prefix + path
		},
	},
} as PrepareZXingOptions);

type ScannerProps = {
	onClose: () => void
	onCodeDetected: (barcode: string) => Promise<void>
}

export default function Scanner({ onClose, onCodeDetected }: ScannerProps) {
	const { t } = useTranslation()
	const videoRef = useRef<HTMLVideoElement>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const frameRef = useRef<number | null>(null)
	const hasDetectedCodeRef = useRef(false)
	const [status, setStatus] = useState<"starting" | "scanning" | "looking-up" | "error">("starting")
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let isActive = true

		const stopScanner = () => {
			if (frameRef.current !== null) {
				cancelAnimationFrame(frameRef.current)
			}
			streamRef.current?.getTracks().forEach((track) => track.stop())
			streamRef.current = null
		}

		const scan = async (detector: BarcodeDetector) => {
			if (!isActive || !videoRef.current) return

			try {
				const detectedCodes = await detector.detect(videoRef.current)
				const detectedCode = detectedCodes[0]

				if (detectedCode && !hasDetectedCodeRef.current) {
					hasDetectedCodeRef.current = true
					setError(null)
					setStatus("looking-up")
					try {
						await onCodeDetected(detectedCode.rawValue)
					} catch (lookupError) {
						if (isActive) {
							setStatus("scanning")
							setError(lookupError instanceof Error ? lookupError.message : t("scanner.errors.lookup"))
						}
					} finally {
						if (isActive) {
							setStatus("scanning")
							frameRef.current = requestAnimationFrame(() => void scan(detector))
						}
					}
					return
				}

				if (!detectedCode) {
					hasDetectedCodeRef.current = false
				}
			} catch {
				if (isActive) {
					frameRef.current = requestAnimationFrame(() => void scan(detector))
				}
				return
			}

			if (isActive) {
				frameRef.current = requestAnimationFrame(() => void scan(detector))
			}
		}

		const startScanner = async () => {
			try {
				if (!navigator.mediaDevices?.getUserMedia) {
					throw new Error(t("scanner.errors.unavailable"))
				}

				const stream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: { ideal: "environment" } },
					audio: false,
				})
				streamRef.current = stream

				if (!videoRef.current || !isActive) return
				videoRef.current.srcObject = stream
				await videoRef.current.play()
				setStatus("scanning")

				const detector = new BarcodeDetector()
				void scan(detector)
			} catch (cameraError) {
				stopScanner()
				setStatus("error")
				setError(cameraError instanceof Error ? cameraError.message : t("scanner.errors.access"))
			}
		}

		void startScanner()

		return () => {
			isActive = false
			stopScanner()
		}
	}, [onCodeDetected, onClose])

	return (
		<div className="w-full">
			<div className="mb-4 flex items-center justify-between gap-4">
				<div>
					<h2 className="flex items-center gap-2 text-lg font-semibold">
						<Camera className="size-5" />
						{t("scanner.title")}
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{status === "scanning" ? t("scanner.description") : status === "looking-up" ? t("scanner.lookingUp") : t("scanner.preparing")}
					</p>
				</div>
				<Button aria-label={t("scanner.close")} className="px-5" variant={"outline"} onClick={onClose}>
					{t("scanner.cancel")}
				</Button>
			</div>

			<div className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden rounded-lg bg-slate-950">
				<video ref={videoRef} className="size-full object-cover" muted playsInline />
				{(status === "starting" || status === "looking-up") && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-white">
						<LoaderCircle className="size-7 animate-spin" />
						<span className="text-sm">{status === "looking-up" ? t("scanner.lookingUp") : t("scanner.starting")}</span>
					</div>
				)}
				{status === "error" && (
					<div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
						{error}
					</div>
				)}
				{status === "scanning" && error && (
					<div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-md bg-slate-950/85 p-3 text-left text-sm text-white">
						<span>{error}</span>
						<Button
							aria-label={t("scanner.retry")}
							size="icon"
							variant="ghost"
							onClick={() => {
								setError(null)
								hasDetectedCodeRef.current = false
							}}
						>
							<RotateCcw />
						</Button>
					</div>
				)}
				{status === "scanning" && (
					<div className="pointer-events-none absolute inset-x-8 inset-y-10" aria-hidden="true">
						<div className="absolute inset-x-0 top-0 h-1 animate-scanner-scan rounded-full bg-white/50" />
					</div>
				)}
			</div>

			{status === "error" && (
				<Button className="mt-4" variant="outline" onClick={onClose}>
					{t("scanner.close")}
				</Button>
			)}
		</div>
	)
}
