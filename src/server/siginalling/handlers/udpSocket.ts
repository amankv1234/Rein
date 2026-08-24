import dgram from "node:dgram"
import logger from "../../../utils/logger.ts"
import { RTP_HOST, RTP_PORT, RTP_PORT_AUDIO } from "../../constants.ts"
import type { ClientSession } from "./sessionStore.ts"

// ---------------------------------------------------------------------------
// UdpSocketManager — owns the UDP sockets that receive RTP from GStreamer
// ---------------------------------------------------------------------------

export class UdpSocketManager {
	private videoSocket: dgram.Socket | null = null
	private audioSocket: dgram.Socket | null = null
	private isBound = false
	private hasError = false
	private isShutdown = false
	private rebindTimer: NodeJS.Timeout | null = null
	private rebindBackoffMs = 500
	private readonly maxBackoffMs = 10_000

	constructor(private readonly clients: Map<string, ClientSession>) {
		this.setup()
	}

	public healthy(): boolean {
		return !this.hasError && this.isBound
	}

	public shutdown(): void {
		this.isShutdown = true
		if (this.rebindTimer) {
			clearTimeout(this.rebindTimer)
			this.rebindTimer = null
		}
		this.closeSockets()
	}

	// -------------------------------------------------------------------------
	// Private
	// -------------------------------------------------------------------------

	private setup(): void {
		if (this.isShutdown) return

		if (this.rebindTimer) {
			clearTimeout(this.rebindTimer)
			this.rebindTimer = null
		}

		this.closeSockets()

		try {
			this.videoSocket = this.createRtpSocket(RTP_PORT, "video")
			this.audioSocket = this.createRtpSocket(RTP_PORT_AUDIO, "audio")

			this.isBound = true
			this.hasError = false
			this.rebindBackoffMs = 500
		} catch (err) {
			logger.error(`Failed to create/bind UDP sockets: ${String(err)}`)
			this.onFailure()
		}
	}

	private createRtpSocket(
		port: number,
		trackKind: "video" | "audio",
	): dgram.Socket {
		const socket = dgram.createSocket("udp4")

		socket.on("error", (err) => {
			logger.error(
				`UDP socket error on port ${port} (${trackKind}):\n${err.stack ?? err}`,
			)
			this.onFailure()
		})

		socket.on("message", (msg) => {
			for (const client of this.clients.values()) {
				try {
					if (trackKind === "video") {
						client.videoTrack.writeRtp(msg)
					} else {
						client.audioTrack.writeRtp(msg)
					}
					client.bytesSent += msg.length
				} catch {
					// Individual track write errors are non-fatal
				}
			}
		})

		socket.bind(port, RTP_HOST, () => {
			logger.info(
				`UDP socket listening for ${trackKind} RTP packets on ${RTP_HOST}:${port}`,
			)
		})

		return socket
	}

	private onFailure(): void {
		this.isBound = false
		this.hasError = true
		this.closeSockets()

		if (this.isShutdown || this.rebindTimer) return

		const delay = this.rebindBackoffMs
		logger.warn(`Scheduling UDP socket rebind in ${delay}ms`)
		this.rebindTimer = setTimeout(() => {
			this.rebindTimer = null
			this.setup()
		}, delay)

		this.rebindBackoffMs = Math.min(this.rebindBackoffMs * 2, this.maxBackoffMs)
	}

	private closeSockets(): void {
		for (const socket of [this.videoSocket, this.audioSocket]) {
			if (!socket) continue
			try {
				socket.removeAllListeners()
				socket.close()
			} catch {}
		}
		this.videoSocket = null
		this.audioSocket = null
	}
}
