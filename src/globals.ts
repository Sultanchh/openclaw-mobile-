/**
 * OpenClaw-Mobile - Global Utilities
 * Global logging and utility functions
 */

// ============================================
// Logging
// ============================================

export type LogLevel = "debug" | "verbose" | "info" | "warn" | "error";

let currentLogLevel: LogLevel = "info";
let verboseEnabled = false;

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
  verboseEnabled = level === "verbose" || level === "debug";
}

export function setVerbose(enabled: boolean): void {
  verboseEnabled = enabled;
}

export function isVerbose(): boolean {
  return verboseEnabled || process.env.VERBOSE === "true" || process.env.DEBUG === "true";
}

function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ["debug", "verbose", "info", "warn", "error"];
  const currentIndex = levels.indexOf(currentLogLevel);
  const levelIndex = levels.indexOf(level);
  return levelIndex >= currentIndex;
}

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export function logDebug(message: string): void {
  if (shouldLog("debug")) {
    console.debug(formatMessage("debug", message));
  }
}

export function logVerbose(message: string): void {
  if (isVerbose() || shouldLog("verbose")) {
    console.log(formatMessage("verbose", message));
  }
}

export function logInfo(message: string): void {
  if (shouldLog("info")) {
    console.log(formatMessage("info", message));
  }
}

export function logWarn(message: string): void {
  if (shouldLog("warn")) {
    console.warn(formatMessage("warn", message));
  }
}

export function logError(message: string): void {
  if (shouldLog("error")) {
    console.error(formatMessage("error", message));
  }
}

// ============================================
// Environment Detection
// ============================================

export function isTermux(): boolean {
  return (
    typeof process !== "undefined" &&
    (process.env.TERMUX_VERSION !== undefined ||
      process.env.PREFIX?.includes("termux") === true)
  );
}

export function isProot(): boolean {
  return (
    typeof process !== "undefined" &&
    (process.env.PROOT === "1" || process.env.PROOT_TMP_DIR !== undefined)
  );
}

export function isMobileEnvironment(): boolean {
  return isTermux() || isProot() || process.env.OPENCLAW_MOBILE === "1";
}

// ============================================
// Memory Management
// ============================================

export function getMemoryLimitMB(): number {
  const envLimit = process.env.NODE_OPTIONS?.match(/max-old-space-size=(\d+)/);
  if (envLimit) {
    return parseInt(envLimit[1], 10);
  }
  return 512; // Default 512MB for mobile
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// ============================================
// Timing Utilities
// ============================================

export function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  return fn().then((result) => ({
    result,
    durationMs: Date.now() - start,
  }));
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = "Operation timed out"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

// ============================================
// String Utilities
// ============================================

export function truncate(str: string, maxLength: number, suffix = "..."): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - suffix.length) + suffix;
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 255);
}

// ============================================
// Object Utilities
// ============================================

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

// ============================================
// Async Utilities
// ============================================

export async function parallel<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const [index, task] of tasks.entries()) {
    const promise = task().then((result) => {
      results[index] = result;
    });
    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}
