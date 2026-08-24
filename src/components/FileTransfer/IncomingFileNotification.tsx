"use client"

import { useEffect, useRef } from "react"
import { useFileShare } from "../../contexts/FileShareContext"
import {
	Files,
	FolderOpen,
	X,
	FileImage,
	FileVideo,
	FileAudio,
	FileText,
	File,
	Download,
} from "lucide-react"

const AUTO_DISMISS_SECS = 8

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
	if (mimeType.startsWith("image/")) return <FileImage size={22} />
	if (mimeType.startsWith("video/")) return <FileVideo size={22} />
	if (mimeType.startsWith("audio/")) return <FileAudio size={22} />
	if (mimeType.startsWith("text/")) return <FileText size={22} />
	return <File size={22} />
}

export function IncomingFileNotifications() {
	const { notifications, acceptFile, rejectFile, setOverlayOpen } =
		useFileShare()

	const pending = notifications.filter((n) => n.decision === "pending")
	const accepted = notifications.filter((n) => n.decision === "accepted")
	const visible = notifications.filter((n) => n.decision !== "rejected")

	if (visible.length === 0) return null
	if (pending.length >= 2) {
		const totalSize = pending.reduce((acc, n) => acc + n.size, 0)
		return (
			<div
				className="fixed top-14 right-3 z-50 flex flex-col gap-2"
				style={{ maxWidth: "340px", width: "calc(100vw - 24px)" }}
			>
				<MultiFileCard
					count={pending.length}
					totalSize={totalSize}
					onOpen={() => {
						for (const n of pending) rejectFile(n.fileId)
						setOverlayOpen(true)
					}}
					onDismiss={() => {
						for (const n of pending) rejectFile(n.fileId)
					}}
				/>
				{accepted.map((n) => (
					<NotificationCard
						key={n.fileId}
						notification={n}
						onAccept={() => acceptFile(n.fileId)}
						onReject={() => rejectFile(n.fileId)}
					/>
				))}
			</div>
		)
	}

	return (
		<div
			className="fixed top-14 right-3 z-50 flex flex-col gap-2"
			style={{ maxWidth: "340px", width: "calc(100vw - 24px)" }}
		>
			{visible.map((n) => (
				<NotificationCard
					key={n.fileId}
					notification={n}
					onAccept={() => acceptFile(n.fileId)}
					onReject={() => rejectFile(n.fileId)}
				/>
			))}
		</div>
	)
}

function MultiFileCard({
	count,
	totalSize,
	onOpen,
	onDismiss,
}: {
	count: number
	totalSize: number
	onOpen: () => void
	onDismiss: () => void
}) {
	useAutoDismiss(onDismiss)
	return (
		<div
			className="flex flex-col bg-base-100 rounded-2xl overflow-hidden shadow-2xl"
			style={{
				border: "1px solid hsl(var(--b3))",
				animation: "slideIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
			}}
		>
			<div className="p-3">
				{/* Header */}
				<div className="flex items-start gap-3">
					<div
						className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
						style={{
							background:
								"linear-gradient(135deg, hsl(var(--p) / 0.15), hsl(var(--s) / 0.15))",
							color: "hsl(var(--p))",
						}}
					>
						<Files size={22} />
					</div>

					<div className="flex-1 min-w-0">
						<p className="text-[11px] font-semibold uppercase text-primary tracking-widest mb-0.5">
							Incoming Files
						</p>
						<p className="text-sm font-semibold leading-tight">
							{count} files shared
						</p>
						<p className="text-xs opacity-50 mt-0.5">
							{formatBytes(totalSize)} total
						</p>
					</div>

					<button
						type="button"
						id="notification-multi-dismiss"
						className="btn btn-ghost btn-xs btn-circle shrink-0 -mt-0.5 -mr-0.5"
						onClick={onDismiss}
						aria-label="Dismiss"
					>
						<X size={15} />
					</button>
				</div>

				<button
					type="button"
					id="notification-multi-open"
					className="w-full flex items-center justify-center gap-2 mt-3 rounded-xl h-9 text-sm font-semibold transition-all duration-150 active:scale-95 btn btn-primary"
					onClick={onOpen}
				>
					<FolderOpen size={15} />
					Open Files
				</button>
			</div>

			<AnimationStyles />
		</div>
	)
}

interface NotificationCardProps {
	notification: {
		fileId: string
		name: string
		size: number
		mimeType: string
		uploadedBy: string
		decision: "pending" | "accepted" | "rejected"
	}
	onAccept: () => void
	onReject: () => void
}

function NotificationCard({
	notification,
	onAccept,
	onReject,
}: NotificationCardProps) {
	const isPending = notification.decision === "pending"
	const isAccepted = notification.decision === "accepted"

	// Auto-dismiss only while the card is still pending
	useAutoDismiss(isPending ? onReject : null)

	return (
		<div
			className="flex bg-base-100 flex-col rounded-2xl overflow-hidden shadow-2xl"
			style={{
				border: "1px solid hsl(var(--b3))",
				animation: "slideIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
				backdropFilter: "blur(12px)",
			}}
		>
			<div className="p-3">
				{/* Header row */}
				<div className="flex items-start gap-3">
					<div
						className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
						style={{
							background:
								"linear-gradient(135deg, hsl(var(--p) / 0.15), hsl(var(--s) / 0.15))",
							color: "hsl(var(--p))",
						}}
					>
						<FileTypeIcon mimeType={notification.mimeType} />
					</div>

					<div className="flex-1 min-w-0">
						<p className="text-[11px] font-semibold uppercase text-primary tracking-widest mb-0.5">
							Incoming File
						</p>
						<p className="text-sm font-semibold truncate leading-tight">
							{notification.name}
						</p>
						<p className="text-xs opacity-50 mt-0.5">
							{formatBytes(notification.size)}
						</p>
					</div>

					<button
						type="button"
						id={`notification-reject-${notification.fileId}`}
						className="btn btn-ghost btn-xs btn-circle shrink-0 -mt-0.5 -mr-0.5"
						onClick={onReject}
						aria-label="Dismiss"
					>
						<X size={15} />
					</button>
				</div>

				{/* Action buttons */}
				{isPending && (
					<div className="flex gap-2 mt-3">
						<button
							type="button"
							id={`notification-accept-${notification.fileId}`}
							className="flex-1 flex items-center justify-center btn rounded-md shadow-sm btn-primary p-0 gap-1.5 h-9 text-sm transition-all duration-150 active:scale-95"
							onClick={onAccept}
						>
							<Download size={15} />
							Accept
						</button>
						<button
							type="button"
							id={`notification-dismiss-${notification.fileId}`}
							className="flex-1 flex items-center justify-center btn rounded-md shadow-sm btn-error p-0 gap-1.5 h-9 text-sm transition-all duration-150 active:scale-95"
							onClick={onReject}
						>
							<X size={15} />
							Reject
						</button>
					</div>
				)}

				{isAccepted && (
					<div
						className="flex items-center justify-center gap-2 mt-3 rounded-xl h-9"
						style={{ background: "hsl(var(--su) / 0.15)" }}
					>
						<span className="text-sm font-semibold">Download has started</span>
					</div>
				)}
			</div>

			<AnimationStyles />
		</div>
	)
}

function useAutoDismiss(onDismiss: (() => void) | null) {
	const cbRef = useRef(onDismiss)
	cbRef.current = onDismiss

	useEffect(() => {
		if (!cbRef.current) return
		const id = setTimeout(() => {
			cbRef.current?.()
		}, AUTO_DISMISS_SECS * 1000)
		return () => clearTimeout(id)
	}, [])
}

function AnimationStyles() {
	return (
		<style>{`
			@keyframes slideIn {
				from { opacity: 0; transform: translateX(40px) scale(0.92); }
				to   { opacity: 1; transform: translateX(0)  scale(1); }
			}
		`}</style>
	)
}
