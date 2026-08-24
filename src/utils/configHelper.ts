import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export interface ServerConfig {
	host?: string
	frontendPort?: number
	address?: string
	inputThrottleMs?: number
	sensitivity?: number
	invertScroll?: boolean
	verboseLogs?: boolean
	useSystemGstreamer?: boolean
	useGlobalGstreamer?: boolean
	disableBundledGstreamer?: boolean
	/** framerate: null = dynamic frame rate. */
	framerate?: number | null
	audioSource?: string
	version?: string
}
let cachedConfig: ServerConfig | null = null

export function getServerConfigPath(): string | null {
	const candidates: string[] = []

	// Electron resourcesPath if packaged
	const resourcesPath = (process as unknown as { resourcesPath?: string })
		.resourcesPath
	if (resourcesPath) {
		candidates.push(
			path.join(resourcesPath, "src", "server-config.json"),
			path.join(resourcesPath, "server-config.json"),
		)
	}

	// Current working directory
	const cwd = process.cwd()
	candidates.push(
		path.join(cwd, "src", "server-config.json"),
		path.join(cwd, "server-config.json"),
	)

	// Relative to current module file
	try {
		const currentDir = path.dirname(fileURLToPath(import.meta.url))
		candidates.push(
			path.join(currentDir, "..", "server-config.json"),
			path.join(currentDir, "..", "..", "src", "server-config.json"),
			path.join(currentDir, "..", "..", "server-config.json"),
		)
	} catch {}

	for (const candidate of candidates) {
		try {
			if (fs.existsSync(candidate)) {
				return candidate
			}
		} catch {}
	}

	return null
}

/**
 * Parses server-config.json. Returns empty object if missing/unreadable.
 */
export function loadServerConfig(): ServerConfig {
	if (cachedConfig) return cachedConfig
	const configPath = getServerConfigPath()
	if (!configPath) {
		cachedConfig = {}
		return cachedConfig
	}
	try {
		const raw = fs.readFileSync(configPath, "utf-8")
		const parsed: unknown = JSON.parse(raw)
		cachedConfig =
			parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
				? (parsed as ServerConfig)
				: {}
	} catch {
		cachedConfig = {}
	}
	return cachedConfig
}
