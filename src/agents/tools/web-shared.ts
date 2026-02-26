/**
 * OpenClaw-Mobile - Web Tool Shared Utilities
 * Shared utilities for web-based tools (search, fetch, etc.)
 */

// ============================================
// Cache Types
// ============================================

export type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

// ============================================
// Default Constants
// ============================================

export const DEFAULT_CACHE_TTL_MINUTES = 60;
export const DEFAULT_TIMEOUT_SECONDS = 30;
export const MAX_CACHE_TTL_MINUTES = 1440; // 24 hours
export const MAX_TIMEOUT_SECONDS = 120;

// ============================================
// Cache Operations
// ============================================

export function readCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string
): CacheEntry<T> | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  return entry;
}

export function writeCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number
): void {
  cache.set(key, {
    value,
    timestamp: Date.now(),
  });

  // Schedule cleanup
  setTimeout(() => {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp >= ttlMs) {
      cache.delete(key);
    }
  }, ttlMs);
}

export function isCacheValid<T>(
  entry: CacheEntry<T> | null,
  ttlMs: number
): boolean {
  if (!entry) {
    return false;
  }
  return Date.now() - entry.timestamp < ttlMs;
}

export function clearCache<T>(cache: Map<string, CacheEntry<T>>): void {
  cache.clear();
}

// ============================================
// Cache Key Normalization
// ============================================

export function normalizeCacheKey(key: string): string {
  return key
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 256);
}

// ============================================
// Timeout Handling
// ============================================

export function withTimeout(
  signal: AbortSignal | undefined,
  timeoutMs: number
): AbortSignal {
  const controller = new AbortController();
  
  // If external signal provided, chain it
  if (signal) {
    signal.addEventListener("abort", () => {
      controller.abort();
    });
  }
  
  // Set timeout
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Operation timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  
  // Clear timeout if aborted externally
  controller.signal.addEventListener("abort", () => {
    clearTimeout(timeoutId);
  });
  
  return controller.signal;
}

export function resolveTimeoutSeconds(
  configured: number | undefined,
  defaultValue: number
): number {
  if (configured === undefined || configured === null) {
    return defaultValue;
  }
  
  if (typeof configured !== "number" || !Number.isFinite(configured)) {
    return defaultValue;
  }
  
  const clamped = Math.max(1, Math.min(MAX_TIMEOUT_SECONDS, configured));
  return Math.floor(clamped);
}

export function resolveCacheTtlMs(
  configuredMinutes: number | undefined,
  defaultValue: number
): number {
  if (configuredMinutes === undefined || configuredMinutes === null) {
    return defaultValue * 60 * 1000;
  }
  
  if (typeof configuredMinutes !== "number" || !Number.isFinite(configuredMinutes)) {
    return defaultValue * 60 * 1000;
  }
  
  const clamped = Math.max(1, Math.min(MAX_CACHE_TTL_MINUTES, configuredMinutes));
  return Math.floor(clamped) * 60 * 1000;
}

// ============================================
// Response Reading
// ============================================

export type ReadResponseResult = {
  text: string;
  truncated: boolean;
  bytesRead: number;
};

export async function readResponseText(
  response: Response,
  options?: { maxBytes?: number }
): Promise<ReadResponseResult> {
  const maxBytes = options?.maxBytes ?? 1024 * 1024; // 1MB default
  
  const reader = response.body?.getReader();
  if (!reader) {
    return {
      text: "",
      truncated: false,
      bytesRead: 0,
    };
  }
  
  const chunks: Uint8Array[] = [];
  let bytesRead = 0;
  let truncated = false;
  
  try {
    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      if (value) {
        const remaining = maxBytes - bytesRead;
        const toRead = Math.min(value.length, remaining);
        
        chunks.push(value.slice(0, toRead));
        bytesRead += toRead;
        
        if (bytesRead >= maxBytes) {
          truncated = true;
          break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  // Concatenate chunks
  const allChunks = new Uint8Array(bytesRead);
  let position = 0;
  
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }
  
  // Decode as UTF-8
  const text = new TextDecoder("utf-8", { fatal: false }).decode(allChunks);
  
  return {
    text,
    truncated,
    bytesRead,
  };
}

// ============================================
// URL Validation
// ============================================

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ============================================
// Content Type Detection
// ============================================

export function getContentType(headers: Headers): string {
  return headers.get("content-type") || "application/octet-stream";
}

export function isJsonContentType(contentType: string): boolean {
  return contentType.includes("application/json");
}

export function isTextContentType(contentType: string): boolean {
  return (
    contentType.includes("text/") ||
    contentType.includes("application/json") ||
    contentType.includes("application/xml") ||
    contentType.includes("application/javascript")
  );
}

// ============================================
// Retry Logic
// ============================================

export type RetryOptions = {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
};

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  retryDelayMs: 1000,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delay = opts.retryDelayMs;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < opts.maxRetries) {
        await sleep(delay);
        delay *= opts.backoffMultiplier;
      }
    }
  }
  
  throw lastError || new Error("Operation failed after retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
