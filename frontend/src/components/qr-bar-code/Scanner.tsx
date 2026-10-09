import { useEffect, useRef, useState } from "react"
import { BarcodeDetector } from "barcode-detector"
import { Camera, LoaderCircle, X } from "lucide-react"

import { Button } from "@/components/ui/button"

type ScannerProps = {
	onClose: () => void
}

export default function Scanner({ onClose }: ScannerProps) {
	const videoRef = useRef<HTMLVideoElement>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const frameRef = useRef<number | null>(null)
	const hasDetectedCodeRef = useRef(false)
	const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting")
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
			if (!isActive || hasDetectedCodeRef.current || !videoRef.current) return

			try {
				const detectedCodes = await detector.detect(videoRef.current)
				const detectedCode = detectedCodes[0]

				if (detectedCode) {
					hasDetectedCodeRef.current = true
					stopScanner()
					window.alert(
						`Code detected\n\nFormat: ${detectedCode.format}\nValue: ${detectedCode.rawValue}`,

					)
					onClose()
					return
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
	}, [onClose])

	return (
		<div className="w-full max-w-2xl rounded-xl border bg-card p-4 shadow-sm">
			<div className="mb-4 flex items-center justify-between gap-4">
				<div>
					<h2 className="flex items-center gap-2 text-lg font-semibold">
						<Camera className="size-5" />
						Scan a code
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{status === "scanning" ? "Point your camera at a barcode or QR code." : "Preparing the camera..."}
					</p>
				</div>
				<Button aria-label="Close scanner" size="icon" variant="ghost" onClick={onClose}>
					<X />
				</Button>
			</div>

			<div className="relative aspect-video overflow-hidden rounded-lg bg-slate-950">
				<video ref={videoRef} className="size-full object-cover" muted playsInline />
				{status === "starting" && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-white">
						<LoaderCircle className="size-7 animate-spin" />
						<span className="text-sm">Starting camera...</span>
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