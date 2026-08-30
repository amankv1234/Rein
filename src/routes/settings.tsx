import { createFileRoute } from "@tanstack/react-router"
import QRCode from "qrcode"
import { useEffect, useState, useRef } from "react"
import { Copy, Check, Link2 } from "lucide-react"
import { APP_CONFIG, THEMES } from "../config"
import serverConfig from "../server-config.json"
import pkg from "../../package.json"
import { t } from "../utils/i18n"
import {
	getLocalStorageItem,
	setLocalStorageItem,
} from "../utils/safeLocalStorage"
export const Route = createFileRoute("/settings")({
	component: SettingsPage,
})

const copyWithFallback = (text: string) => {
	const textArea = document.createElement("textarea")
	textArea.value = text
	textArea.setAttribute("readonly", "")
	textArea.style.position = "absolute"
	textArea.style.left = "-9999px"

	document.body.appendChild(textArea)
	textArea.select()
	textArea.setSelectionRange(0, text.length)

	try {
		return document.execCommand("copy")
	} finally {
		document.body.removeChild(textArea)
	}
}

function SettingsPage() {
	const [ip, setIp] = useState("")
	const [copied, setCopied] = useState(false)
	const [copyError, setCopyError] = useState("")
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		return () => {
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
		}
	}, [])
	const [frontendPort, setFrontendPort] = useState("")
	const [originalPort] = useState(String(serverConfig.frontendPort))
	const serverConfigChanged =
		frontendPort !== "" && frontendPort !== originalPort

	useEffect(() => {
		setFrontendPort(window.location.port)
	}, [])
	// Client Side Settings (LocalStorage) — safe when storage is blocked
	const [initialSensitivity, initialInvert] = (() => {
		const savedSensitivity = getLocalStorageItem("rein_sensitivity")
		const parsed = savedSensitivity
			? Number.parseFloat(savedSensitivity)
			: Number.NaN
		return [
			Number.isFinite(parsed) ? parsed : 1.0,
			getLocalStorageItem("rein_invert") === "true",
		] as const
	})()

	const sensitivity = useRef(initialSensitivity)
	const invertScroll = useRef(initialInvert)

	const [theme, setTheme] = useState(() => {
		const saved = getLocalStorageItem(APP_CONFIG.THEME_STORAGE_KEY)
		return saved === THEMES.LIGHT || saved === THEMES.DARK
			? saved
			: THEMES.DEFAULT
	})

	const [qrData, setQrData] = useState("")
	const setConfig = (sensitivity_val: number, invertedScroll_val: boolean) => {
		sensitivity.current = sensitivity_val
		invertScroll.current = invertedScroll_val
		setLocalStorageItem("rein_sensitivity", String(sensitivity_val))
		setLocalStorageItem("rein_invert", JSON.stringify(invertedScroll_val))
		const timer = setTimeout(() => {
			fetch("/api/config", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
				},
				body: JSON.stringify({
					sensitivity: sensitivity_val,
					invertScroll: invertedScroll_val,
				}),
			})
				.then((r) => r.json())
				.then((data) => {
					if (!data.ok) {
						console.error("Failed to update config on server:", data.error)
					}
				})
				.catch((err) => console.error("Error updating config:", err))
		}, 300)
		return () => clearTimeout(timer)
	}

	// Load initial state (IP is not stored in localStorage; only sensitivity, invert, theme are client settings)
	const [authToken, setAuthToken] = useState(
		() => getLocalStorageItem("rein_auth_token") || "",
	)

	// Derive URLs once at the top
	const protocol =
		typeof window !== "undefined" ? window.location.protocol : "http:"
	const shareUrl = ip
		? `${protocol}//${ip}:${window.location.port}/trackpad${authToken ? `?token=${encodeURIComponent(authToken)}` : ""}`
		: ""

	useEffect(() => {
		const defaultIp =
			typeof window !== "undefined" ? window.location.hostname : "localhost"
		setIp(defaultIp)
		setFrontendPort(String(serverConfig.frontendPort))
	}, [])

	// Auto-generate token on settings page load (localhost only)
	useEffect(() => {
		if (typeof window === "undefined") return
		const isLocal =
			window.location.hostname === "localhost" ||
			window.location.hostname === "127.0.0.1" ||
			window.location.hostname === "::1"
		if (!isLocal) return

		let isMounted = true

		fetch("/api/auth/token", { method: "POST" })
			.then((r) => r.json())
			.then((data) => {
				if (isMounted && data.token) {
					setAuthToken(data.token)
					setLocalStorageItem("rein_auth_token", data.token)
				}
			})
			.catch((e) => console.error("Token fetch error:", e))

		return () => {
			isMounted = false
		}
	}, [])

	// Effect: Theme
	useEffect(() => {
		if (typeof window === "undefined") return
		setLocalStorageItem(APP_CONFIG.THEME_STORAGE_KEY, theme)
		document.documentElement.setAttribute("data-theme", theme)
	}, [theme])

	// Generate QR when IP changes or Token changes
	useEffect(() => {
		if (!ip || typeof window === "undefined" || !shareUrl) return

		QRCode.toDataURL(shareUrl)
			.then(setQrData)
			.catch((e) => console.error("QR Error:", e))
	}, [ip, shareUrl])

	// Effect: Auto-detect LAN IP from Server (only if on loopback/localhost)
	useEffect(() => {
		if (typeof window === "undefined") return
		const isLocal =
			window.location.hostname === "localhost" ||
			window.location.hostname === "127.0.0.1" ||
			window.location.hostname === "::1"
		if (!isLocal) return

		fetch("/api/host/ip")
			.then((res) => res.json())
			.then((data) => {
				if (data.ip) {
					setIp(data.ip)
				}
			})
			.catch((e) => console.error("IP fetch error:", e))
	}, [])

	return (
		<div className="h-full overflow-y-auto w-full">
			<div className="p-6 pb-safe max-w-5xl mx-auto min-h-full">
				<h1 className="text-3xl font-bold pt-4 mb-8">Settings</h1>

				<div className="flex flex-col md:flex-row gap-8 items-start">
					{/* Left Column: Settings Form */}
					<div className="w-full flex-1 space-y-8">
						<h2 className="text-xl font-semibold">Client Settings</h2>

						<div className="form-control w-full">
							<label className="label mb-3" htmlFor="sensitivity-slider">
								<span className="label-text">Mouse Sensitivity</span>
								<span className="label-text-alt font-mono">
									{sensitivity.current.toFixed(1)}x
								</span>
							</label>

							<input
								type="range"
								id="sensitivity-slider"
								min="0.1"
								max="6.0"
								step="0.1"
								defaultValue={sensitivity.current}
								onChange={(e) =>
									setConfig(
										parseFloat(e.target.value) || 1.0,
										invertScroll.current,
									)
								}
								className="range range-primary range-sm w-full"
							/>

							<div className="mt-2 flex w-full justify-between px-2 text-xs opacity-50">
								<span>Slow</span>
								<span>Default</span>
								<span>Fast</span>
							</div>
						</div>

						<div className="form-control w-full">
							<label
								className="label cursor-pointer"
								htmlFor="invert-scroll-toggle"
							>
								<span className="label-text font-medium">Invert Scroll</span>
								<input
									id="invert-scroll-toggle"
									type="checkbox"
									className="toggle toggle-primary"
									defaultChecked={invertScroll.current}
									onChange={(e) =>
										setConfig(sensitivity.current, e.target.checked)
									}
								/>
							</label>

							<label className="label" htmlFor="invert-scroll-toggle">
								<span className="label-text-alt opacity-50">
									{invertScroll
										? "Traditional scrolling enabled"
										: "Natural scrolling"}
								</span>
							</label>
						</div>

						<div className="form-control w-full">
							<label className="label mb-3" htmlFor="theme-select">
								<span className="label-text">Theme</span>
							</label>
							<select
								id="theme-select"
								className="select select-bordered w-full rounded-md"
								value={theme}
								onChange={(e) => setTheme(e.target.value)}
							>
								<option value={THEMES.DARK}>Dark</option>
								<option value={THEMES.LIGHT}>Light</option>
							</select>
						</div>

						<div className="divider" />

						<h2 className="text-xl font-semibold">Server Settings</h2>

						<div className="form-control w-full">
							<label className="label mb-3" htmlFor="server-ip-input">
								<span className="label-text">Server IP (for Remote)</span>
							</label>

							<input
								id="server-ip-input"
								type="text"
								placeholder="192.168.1.X"
								className="input input-bordered w-full rounded-md"
								value={ip}
								onChange={(e) => setIp(e.target.value)}
							/>

							<label className="label" htmlFor="server-ip-input">
								<span className="label-text-alt opacity-50">
									This Computer's LAN IP
								</span>
							</label>
						</div>

						<div className="form-control w-full">
							<label className="label mb-3" htmlFor="port-input">
								<span className="label-text">Port</span>
							</label>
							<input
								id="port-input"
								type="text"
								placeholder={String(serverConfig.frontendPort)}
								className="input input-bordered w-full rounded-md"
								value={frontendPort}
								onChange={(e) => setFrontendPort(e.target.value)}
							/>
						</div>

						<div className="alert alert-warning text-xs shadow-lg">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="stroke-current shrink-0 h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
							>
								<title>Warning</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
							<span>
								Important: Ensure port {frontendPort} is allowed in your
								computer's firewall!
							</span>
						</div>

						<button
							type="button"
							className="btn btn-primary w-full rounded-md"
							disabled={!serverConfigChanged}
							onClick={() => {
								const port = Number.parseInt(frontendPort, 10)
								if (!Number.isFinite(port) || port < 1 || port > 65535) {
									alert("Please enter a valid port number (1–65535).")
									return
								}

								fetch("/api/config", {
									method: "POST",
									headers: {
										"Content-Type": "application/json",
										...(authToken
											? { Authorization: `Bearer ${authToken}` }
											: {}),
									},
									body: JSON.stringify({
										frontendPort: port,
									}),
								})
									.then((r) => r.json())
									.then((data) => {
										if (data.ok) {
											setTimeout(() => {
												const newProtocol = window.location.protocol
												const newHostname = window.location.hostname
												const newUrl = `${newProtocol}//${newHostname}:${port}/settings`
												window.location.href = newUrl
											}, 1000)
										} else {
											alert(
												`Failed to save configuration: ${data.error || "Unknown error"}`,
											)
										}
									})
									.catch((err) => {
										alert(`Failed to connect to the server: ${String(err)}`)
									})
							}}
						>
							Save Config
						</button>
					</div>

					{/* Right Column: QR Code & Connection Info */}
					<div className="w-full md:w-96 flex-shrink-0">
						<div className="card bg-base-200 shadow-xl sticky top-6">
							<div className="card-body items-center text-center">
								<h2 className="card-title">Connect Mobile</h2>
								<p className="text-sm opacity-70">Scan to open remote</p>

								{qrData && (
									<div className="bg-white p-4 rounded-xl shadow-inner my-4">
										<img
											src={qrData}
											alt="Connection QR"
											className="w-48 h-48 mix-blend-multiply"
										/>
									</div>
								)}

								<div className="flex flex-col gap-2 mt-2 w-full px-2 items-center">
									{/* URL row: truncated preview + copy button */}
									<div className="flex items-center gap-2 w-full bg-base-100 rounded-2xl px-3 py-2">
										{/* Link icon */}
										<Link2 size={16} className="shrink-0 opacity-50" />
										{/* Truncated URL preview — strips the token query param */}
										<span
											className="flex-1 font-mono text-sm opacity-80 min-w-0"
											style={{
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
											}}
										>
											{ip ? `${ip}:${window.location.port}/trackpad` : ""}
										</span>
										{/* Copy button */}
										<button
											type="button"
											className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 bg-primary/15 text-primary hover:bg-primary/25 active:scale-95"
											onClick={async () => {
												setCopyError("")
												try {
													if (
														window.isSecureContext &&
														navigator.clipboard?.writeText
													) {
														await navigator.clipboard.writeText(shareUrl)
													} else if (!copyWithFallback(shareUrl)) {
														throw new Error("Clipboard copy failed")
													}
													setCopied(true)
													if (copyTimerRef.current)
														clearTimeout(copyTimerRef.current)
													copyTimerRef.current = setTimeout(() => {
														setCopied(false)
														copyTimerRef.current = null
													}, 1500)
												} catch (err) {
													console.error("Failed to copy URL:", err)
													if (copyTimerRef.current) {
														clearTimeout(copyTimerRef.current)
														copyTimerRef.current = null
													}
													setCopied(false)
													setCopyError(t("settings", "copyFailed"))
												}
											}}
										>
											{copied ? <Check size={16} /> : <Copy size={16} />}
											{copied ? t("settings", "copied") : t("settings", "copy")}
										</button>
									</div>
									{copyError && (
										<p className="text-error text-xs text-center max-w-xs">
											{copyError}
										</p>
									)}
								</div>
							</div>
						</div>

						<div className="text-xs text-center opacity-50 pt-8 pb-8">
							{t("settings", "appVersion", { version: pkg.version })}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
