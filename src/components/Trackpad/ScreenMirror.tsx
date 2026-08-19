"use client"

import type React from "react"
import { useEffect, useRef } from "react"

import { t } from "../../utils/i18n"

interface ScreenMirrorProps {
	scrollMode: boolean
	isTracking: boolean
	handlers: React.HTMLAttributes<HTMLDivElement>
	videoStream: MediaStream | null
	trackActive: boolean
	connecting: boolean
	status: "connecting" | "connected" | "disconnected"
}

const TEXTS = {
	get AUTOMATIC() {
		return t("screenMirror", "establishingSecure")
	},
}

export const ScreenMirror = ({
	scrollMode,
	isTracking,
	handlers,
	videoStream,
	trackActive,
	connecting,
	status,
}: ScreenMirrorProps) => {
	const videoElementRef = useRef<HTMLVideoElement | null>(null)
	useEffect(() => {
		const video = videoElementRef.current
		if (!video) return

		if (video.srcObject !== videoStream) {
			video.srcObject = videoStream
		}

		if (videoStream && videoStream.getTracks().length > 0) {
			// Try to play unmuted first
			video.muted = false
			video.play().catch((err) => {
				if (err.name === "AbortError") return
				console.log(
					"[ScreenMirror] Unmuted autoplay blocked, retrying muted (expected behavior):",
					err.message,
				)
				if (video) {
					video.muted = true
					video.play().catch((e) => {
						if (e.name !== "AbortError") {
							console.error("[ScreenMirror] Muted autoplay failed:", e)
						}
					})
				}
			})
		}
		return () => {
			if (!videoStream && video) {
				video.srcObject = null
			}
		}
	}, [videoStream])

	const handleInteraction = () => {
		const video = videoElementRef.current
		if (video?.muted) {
			console.log("[ScreenMirror] User interaction detected, unmuting audio.")
			video.muted = false
			if (video.paused) {
				video.play().catch((err) => {
					if (err.name !== "AbortError") {
						console.error("[ScreenMirror] Failed to play after unmuting:", err)
					}
				})
			}
		}
	}

	const getWaitingText = () => {
		if (connecting) return t("screenMirror", "establishingConnection")
		switch (status) {
			case "disconnected":
				return t("screenMirror", "disconnected")
			case "connected":
				return t("screenMirror", "connectedButNoVideo")
			default:
				return t("screenMirror", "connecting")
		}
	}

	const getSubText = () => {
		if (connecting) return t("screenMirror", "negotiatingWebRtc")
		switch (status) {
			case "disconnected":
				return t("screenMirror", "checkNetwork")
			case "connected":
				return t("screenMirror", "settingUpScreen")
			default:
				return TEXTS.AUTOMATIC
		}
	}

	return (
		<div
			onPointerDown={handleInteraction}
			onTouchStart={handleInteraction}
			className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden select-none touch-none"
		>
			{/* Hardware Accelerated Video/Audio Renderer */}
			{/* biome-ignore lint/a11y/useMediaCaption: screen mirror stream does not contain timed text track */}
			<video
				ref={videoElementRef}
				aria-label={t("screenMirror", "ariaLabel")}
				autoPlay
				playsInline
				controls={false}
				className={`w-full h-full object-contain transition-opacity duration-500 ${
					trackActive ? "opacity-100" : "opacity-0"
				}`}
			/>

			{/* Standby Loading UI */}
			{!trackActive && (
				<div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-4 bg-base-300">
					<div className="loading loading-spinner loading-lg text-primary" />
					<div className="text-center px-6">
						<p className="font-semibold text-lg">{getWaitingText()}</p>
						<p className="text-sm opacity-60">{getSubText()}</p>
					</div>
				</div>
			)}

			{/* Gesture Event Interaction Overlay */}
			<div
				className="absolute inset-0 z-10"
				{...handlers}
				style={{
					cursor: scrollMode ? "ns-resize" : isTracking ? "none" : "default",
				}}
			/>
		</div>
	)
}
