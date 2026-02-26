/**
 * OpenClaw-Mobile - Browser Service
 * Android Chromium Optimization for Termux/Proot Environments
 * 
 * This service provides Puppeteer-based browser automation optimized
 * for running on Android via Termux + Proot with system Chromium.
 */

import puppeteer, {
  type Browser,
  type BrowserContext,
  type Page,
  type PuppeteerLaunchOptions,
} from "puppeteer-core";
import { logVerbose } from "../globals.js";

// ============================================
// Android Chromium Configuration
// ============================================

/**
 * Default Puppeteer launch options for Android Termux/Proot environment
 * 
 * Key optimizations:
 * - --no-sandbox: Required for running as non-root in Proot
 * - --disable-setuid-sandbox: Disable setuid sandbox (not available in Proot)
 * - --disable-dev-shm-usage: Use /tmp instead of /dev/shm (memory constraints)
 * - --disable-gpu: No GPU acceleration in Termux
 * - --single-process: Run in single-process mode (resource constrained)
 * - --no-zygote: Disable zygote process (not supported in Proot)
 * - Desktop User-Agent: Bypass mobile-only redirects
 */
export const ANDROID_CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--single-process",
  "--no-zygote",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-breakpad",
  "--disable-client-side-phishing-detection",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-features=TranslateUI",
  "--disable-hang-monitor",
  "--disable-ipc-flooding-protection",
  "--disable-popup-blocking",
  "--disable-prompt-on-repost",
  "--disable-renderer-backgrounding",
  "--force-color-profile=srgb",
  "--metrics-recording-only",
  "--safebrowsing-disable-auto-update",
  "--enable-automation",
  "--password-store=basic",
  "--use-mock-keychain",
  "--headless=new",
];

/**
 * Desktop User-Agent to bypass mobile-only redirects
 * Mimics Chrome on Windows to get desktop versions of sites
 */
export const DESKTOP_USER_AGENT = 
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

/**
 * Default executable paths to try (in order)
 */
export const CHROMIUM_PATHS = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/data/data/com.termux/files/usr/bin/chromium",
  "/data/data/com.termux/files/usr/bin/chromium-browser",
  process.env.PUPPETEER_EXECUTABLE_PATH,
].filter(Boolean) as string[];

// ============================================
// Browser Service Types
// ============================================

export interface BrowserServiceConfig {
  /** Path to Chromium executable */
  executablePath?: string;
  /** Run in headless mode */
  headless?: boolean;
  /** Additional Chrome arguments */
  args?: string[];
  /** Default viewport */
  defaultViewport?: {
    width: number;
    height: number;
  };
  /** Timeout for navigation (ms) */
  navigationTimeout?: number;
  /** Timeout for page operations (ms) */
  pageTimeout?: number;
}

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  id: string;
}

// ============================================
// Browser Service Implementation
// ============================================

export class BrowserService {
  private sessions = new Map<string, BrowserSession>();
  private config: Required<BrowserServiceConfig>;
  private isShuttingDown = false;

  constructor(config: BrowserServiceConfig = {}) {
    this.config = {
      executablePath: config.executablePath || this.resolveChromiumPath(),
      headless: config.headless ?? true,
      args: [...ANDROID_CHROMIUM_ARGS, ...(config.args || [])],
      defaultViewport: config.defaultViewport || { width: 1280, height: 720 },
      navigationTimeout: config.navigationTimeout || 30000,
      pageTimeout: config.pageTimeout || 30000,
    };

    logVerbose(`[OpenClaw Mobile] BrowserService initialized`);
    logVerbose(`[OpenClaw Mobile] Chromium path: ${this.config.executablePath}`);
    logVerbose(`[OpenClaw Mobile] Headless: ${this.config.headless}`);
  }

  /**
   * Resolve the Chromium executable path
   * Tries common paths and falls back to system chromium
   */
  private resolveChromiumPath(): string {
    // Check environment variable first
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // Try common paths
    for (const path of CHROMIUM_PATHS) {
      try {
        const fs = require("fs");
        if (fs.existsSync(path)) {
          logVerbose(`[OpenClaw Mobile] Found Chromium at: ${path}`);
          return path;
        }
      } catch {
        // Continue to next path
      }
    }

    // Default fallback
    logVerbose(`[OpenClaw Mobile] Using default Chromium path: /usr/bin/chromium`);
    return "/usr/bin/chromium";
  }

  /**
   * Create a new browser session
   */
  async createSession(sessionId?: string): Promise<BrowserSession> {
    if (this.isShuttingDown) {
      throw new Error("BrowserService is shutting down");
    }

    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    logVerbose(`[OpenClaw Mobile] Creating browser session: ${id}`);

    const launchOptions: PuppeteerLaunchOptions = {
      executablePath: this.config.executablePath,
      headless: this.config.headless,
      args: this.config.args,
      defaultViewport: this.config.defaultViewport,
      // Ignore HTTPS errors (common in mobile environments)
      ignoreHTTPSErrors: true,
      // Slow mo for debugging (set to 0 for production)
      slowMo: 0,
    };

    try {
      const browser = await puppeteer.launch(launchOptions);
      const context = await browser.createIncognitoBrowserContext();
      const page = await context.newPage();

      // Set desktop User-Agent to bypass mobile redirects
      await page.setUserAgent(DESKTOP_USER_AGENT);

      // Set timeouts
      page.setDefaultNavigationTimeout(this.config.navigationTimeout);
      page.setDefaultTimeout(this.config.pageTimeout);

      // Disable JavaScript for faster loading (optional, can be enabled per-page)
      // await page.setJavaScriptEnabled(false);

      const session: BrowserSession = {
        browser,
        context,
        page,
        id,
      };

      this.sessions.set(id, session);
      logVerbose(`[OpenClaw Mobile] Browser session created: ${id}`);

      return session;
    } catch (error) {
      logVerbose(`[OpenClaw Mobile] Failed to create browser session: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Get an existing session
   */
  getSession(id: string): BrowserSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * List all active sessions
   */
  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Navigate to a URL
   */
  async navigate(sessionId: string, url: string, options?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    timeout?: number;
  }): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const waitUntil = options?.waitUntil || "domcontentloaded";
    const timeout = options?.timeout || this.config.navigationTimeout;

    logVerbose(`[OpenClaw Mobile] Navigating to: ${url}`);

    await session.page.goto(url, {
      waitUntil,
      timeout,
    });
  }

  /**
   * Get page content
   */
  async getContent(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return await session.page.content();
  }

  /**
   * Get page text content (extracted)
   */
  async getTextContent(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return await session.page.evaluate(() => document.body.innerText);
  }

  /**
   * Take a screenshot
   */
  async screenshot(sessionId: string, options?: {
    path?: string;
    fullPage?: boolean;
    type?: "png" | "jpeg" | "webp";
  }): Promise<Buffer | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return await session.page.screenshot({
      fullPage: options?.fullPage ?? false,
      type: options?.type || "png",
      path: options?.path,
    });
  }

  /**
   * Execute JavaScript on the page
   */
  async evaluate<T>(sessionId: string, fn: (...args: unknown[]) => T, ...args: unknown[]): Promise<T> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return await session.page.evaluate(fn, ...args);
  }

  /**
   * Close a session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    logVerbose(`[OpenClaw Mobile] Closing browser session: ${sessionId}`);

    try {
      await session.context.close();
      await session.browser.close();
    } catch (error) {
      logVerbose(`[OpenClaw Mobile] Error closing session: ${String(error)}`);
    } finally {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Shutdown the service and close all sessions
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logVerbose(`[OpenClaw Mobile] BrowserService shutting down`);

    const closePromises = Array.from(this.sessions.keys()).map((id) =>
      this.closeSession(id).catch(() => {})
    );

    await Promise.all(closePromises);
    this.sessions.clear();

    logVerbose(`[OpenClaw Mobile] BrowserService shutdown complete`);
  }
}

// ============================================
// Singleton Instance
// ============================================

let defaultService: BrowserService | null = null;

export function getBrowserService(config?: BrowserServiceConfig): BrowserService {
  if (!defaultService) {
    defaultService = new BrowserService(config);
  }
  return defaultService;
}

export function resetBrowserService(): void {
  defaultService = null;
}

// ============================================
// Exports
// ============================================

export {
  puppeteer,
  type Browser,
  type BrowserContext,
  type Page,
  type PuppeteerLaunchOptions,
};
