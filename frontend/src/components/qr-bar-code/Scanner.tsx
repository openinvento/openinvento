import { useEffect, useRef, useState } from "react"
import { BarcodeDetector } from "barcode-detector"
import { Camera, LoaderCircle, X } from "lucide-react"

import { Button } from "@/components/ui/button"

type ScannerProps = {
	onClose: () => void
	onCodeDetected: (barcode: string) => Promise<void>
}

export default function Scanner({ onClose, onCodeDetected }: ScannerProps) {
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
					setStatus("looking-up")
					try {
						await onCodeDetected(detectedCode.rawValue)
					} catch (lookupError) {
						if (isActive) {
							setStatus("error")
							setError(lookupError instanceof Error ? lookupError.message : "Unable to find the scanned item.")
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
					throw new Error("Camera access is not available in this browser.")
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
				setError(cameraError instanceof Error ? cameraError.message : "Unable to access the camera.")
			}
		}

		void startScanner()

		return () => {
			isActive = false
			stopScanner()
		}
	}, [onCodeDetected, onClose])

	return (
		<div className="w-full max-w-2xl rounded-xl border bg-card p-4 shadow-sm">
			<div className="mb-4 flex items-center justify-between gap-4">
				<div>
					<h2 className="flex items-center gap-2 text-lg font-semibold">
						<Camera className="size-5" />
						Scan a code
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{status === "scanning" ? "Point your camera at a barcode or QR code." : status === "looking-up" ? "Finding the inventory item..." : "Preparing the camera..."}
					</p>
				</div>
				<Button aria-label="Close scanner" size="icon" variant="ghost" onClick={onClose}>
					<X />
				</Button>
			</div>

			<div className="relative aspect-square overflow-hidden rounded-lg bg-slate-950">
				<video ref={videoRef} className="size-full object-cover" muted playsInline />
				{(status === "starting" || status === "looking-up") && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-white">
						<LoaderCircle className="size-7 animate-spin" />
						<span className="text-sm">{status === "looking-up" ? "Finding item..." : "Starting camera..."}</span>
					</div>
				)}
				{status === "error" && (
					<div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
						{error}
					</div>
				)}
				{status === "scanning" && <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80" />}
			</div>

			{status === "error" && (
				<Button className="mt-4" variant="outline" onClick={onClose}>
					Close
				</Button>
			)}
		</div>
	)
}
