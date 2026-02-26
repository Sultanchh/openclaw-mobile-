/**
 * OpenClaw-Mobile - Gateway Server
 * Termux/Proot Optimized Gateway with Stability Patches
 */

// ============================================
// STABILITY PATCH: Proot Error 13 Fix
// ============================================
// This patch must be at the absolute top of the entry file
// to bypass Proot's /proc/net/dev restriction on Android
import os from 'os';
try {
  os.networkInterfaces();
} catch (e) {
  console.log('[OpenClaw Mobile] Proot environment detected — patching networkInterfaces to prevent Error 13.');
  os.networkInterfaces = () => ({});
}
// ============================================

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { logInfo, logVerbose, logWarn } from "../globals.js";
import { loadConfig } from "../config/config.js";
import { BrowserService } from "../browser/service.js";

// ============================================
// Gateway Configuration
// ============================================

export interface GatewayConfig {
  /** Port to listen on */
  port: number;
  /** Host to bind to */
  host: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Browser configuration */
  browser?: {
    enabled?: boolean;
    headless?: boolean;
    executablePath?: string;
  };
}

// ============================================
// Gateway Server Implementation
// ============================================

export class GatewayServer {
  private httpServer: Server | null = null;
  private wsServer: WebSocketServer | null = null;
  private browserService: BrowserService | null = null;
  private config: GatewayConfig;
  private isRunning = false;

  constructor(config: GatewayConfig) {
    this.config = {
      port: config.port || 18789,
      host: config.host || "127.0.0.1",
      verbose: config.verbose ?? false,
      browser: config.browser || { enabled: true },
    };

    logVerbose(`[OpenClaw Mobile] GatewayServer initialized`);
    logVerbose(`[OpenClaw Mobile] Port: ${this.config.port}`);
    logVerbose(`[OpenClaw Mobile] Host: ${this.config.host}`);
  }

  /**
   * Start the gateway server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logWarn(`[OpenClaw Mobile] Gateway is already running`);
      return;
    }

    logInfo(`[OpenClaw Mobile] Starting Gateway server...`);

    // Initialize browser service if enabled
    if (this.config.browser?.enabled) {
      logInfo(`[OpenClaw Mobile] Initializing browser service...`);
      this.browserService = new BrowserService({
        executablePath: this.config.browser.executablePath,
        headless: this.config.browser.headless ?? true,
      });
    }

    // Create HTTP server
    this.httpServer = createServer((req, res) => {
      // CORS headers for mobile environments
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      // Health check endpoint
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          status: "ok",
          version: "mobile-1.0.0",
          timestamp: new Date().toISOString(),
          browser: this.browserService ? "enabled" : "disabled",
        }));
        return;
      }

      // Default response
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        name: "OpenClaw-Mobile Gateway",
        version: "mobile-1.0.0",
        status: "running",
      }));
    });

    // Create WebSocket server
    this.wsServer = new WebSocketServer({
      server: this.httpServer,
      path: "/ws",
    });

    // Handle WebSocket connections
    this.wsServer.on("connection", (ws: WebSocket, req) => {
      const clientIp = req.socket.remoteAddress;
      logVerbose(`[OpenClaw Mobile] WebSocket client connected: ${clientIp}`);

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(ws, message);
        } catch (error) {
          logWarn(`[OpenClaw Mobile] Invalid WebSocket message: ${String(error)}`);
          ws.send(JSON.stringify({
            type: "error",
            error: "Invalid message format",
          }));
        }
      });

      ws.on("close", () => {
        logVerbose(`[OpenClaw Mobile] WebSocket client disconnected: ${clientIp}`);
      });

      ws.on("error", (error) => {
        logWarn(`[OpenClaw Mobile] WebSocket error: ${String(error)}`);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: "connected",
        message: "OpenClaw-Mobile Gateway connected",
      }));
    });

    // Start listening
    return new Promise((resolve, reject) => {
      this.httpServer!.listen(this.config.port, this.config.host, () => {
        const address = this.httpServer!.address() as AddressInfo;
        logInfo(`[OpenClaw Mobile] Gateway server listening on ${address.address}:${address.port}`);
        this.isRunning = true;
        resolve();
      });

      this.httpServer!.on("error", (error) => {
        logWarn(`[OpenClaw Mobile] Gateway server error: ${String(error)}`);
        reject(error);
      });
    });
  }

  /**
   * Handle WebSocket messages
   */
  private async handleWebSocketMessage(ws: WebSocket, message: Record<string, unknown>): Promise<void> {
    const { type, id, payload } = message;

    switch (type) {
      case "ping":
        ws.send(JSON.stringify({ type: "pong", id }));
        break;

      case "browser.create":
        if (!this.browserService) {
          ws.send(JSON.stringify({
            type: "error",
            id,
            error: "Browser service is disabled",
          }));
          return;
        }
        try {
          const session = await this.browserService.createSession();
          ws.send(JSON.stringify({
            type: "browser.created",
            id,
            payload: { sessionId: session.id },
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            type: "error",
            id,
            error: String(error),
          }));
        }
        break;

      case "browser.navigate":
        if (!this.browserService) {
          ws.send(JSON.stringify({
            type: "error",
            id,
            error: "Browser service is disabled",
          }));
          return;
        }
        try {
          const { sessionId, url } = payload as { sessionId: string; url: string };
          await this.browserService.navigate(sessionId, url);
          ws.send(JSON.stringify({
            type: "browser.navigated",
            id,
            payload: { success: true },
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            type: "error",
            id,
            error: String(error),
          }));
        }
        break;

      case "browser.content":
        if (!this.browserService) {
          ws.send(JSON.stringify({
            type: "error",
            id,
            error: "Browser service is disabled",
          }));
          return;
        }
        try {
          const { sessionId } = payload as { sessionId: string };
          const content = await this.browserService.getTextContent(sessionId);
          ws.send(JSON.stringify({
            type: "browser.content",
            id,
            payload: { content: content.slice(0, 5000) }, // Limit to 5000 chars
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            type: "error",
            id,
            error: String(error),
          }));
        }
        break;

      case "browser.close":
        if (!this.browserService) {
          ws.send(JSON.stringify({
            type: "error",
            id,
            error: "Browser service is disabled",
          }));
          return;
        }
        try {
          const { sessionId } = payload as { sessionId: string };
          await this.browserService.closeSession(sessionId);
          ws.send(JSON.stringify({
            type: "browser.closed",
            id,
            payload: { success: true },
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            type: "error",
            id,
            error: String(error),
          }));
        }
        break;

      default:
        ws.send(JSON.stringify({
          type: "error",
          id,
          error: `Unknown message type: ${type}`,
        }));
    }
  }

  /**
   * Stop the gateway server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logInfo(`[OpenClaw Mobile] Stopping Gateway server...`);

    // Shutdown browser service
    if (this.browserService) {
      await this.browserService.shutdown();
      this.browserService = null;
    }

    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }

    // Close HTTP server
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }

    this.isRunning = false;
    logInfo(`[OpenClaw Mobile] Gateway server stopped`);
  }

  /**
   * Check if the gateway is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get the browser service instance
   */
  get browser(): BrowserService | null {
    return this.browserService;
  }
}

// ============================================
// Standalone Server Runner
// ============================================

export async function runGateway(config?: Partial<GatewayConfig>): Promise<GatewayServer> {
  // Load configuration from file if available
  let fileConfig: Partial<GatewayConfig> = {};
  try {
    const loadedConfig = await loadConfig();
    if (loadedConfig.gateway) {
      fileConfig = {
        port: loadedConfig.gateway.port,
        host: loadedConfig.gateway.host,
        verbose: loadedConfig.gateway.verbose,
      };
    }
  } catch {
    // Use defaults if config file not found
  }

  // Merge configs: defaults < file < passed
  const mergedConfig: GatewayConfig = {
    port: config?.port ?? fileConfig.port ?? 18789,
    host: config?.host ?? fileConfig.host ?? "127.0.0.1",
    verbose: config?.verbose ?? fileConfig.verbose ?? false,
    browser: config?.browser ?? { enabled: true },
  };

  const gateway = new GatewayServer(mergedConfig);
  await gateway.start();
  return gateway;
}

// ============================================
// CLI Entry Point
// ============================================

if (require.main === module) {
  const port = parseInt(process.env.GATEWAY_PORT || "18789", 10);
  const host = process.env.GATEWAY_HOST || "127.0.0.1";
  const verbose = process.env.GATEWAY_VERBOSE === "true";

  runGateway({ port, host, verbose }).catch((error) => {
    console.error("[OpenClaw Mobile] Failed to start gateway:", error);
    process.exit(1);
  });
}
