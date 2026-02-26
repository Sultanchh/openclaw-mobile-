/**
 * OpenClaw-Mobile - General Utilities
 * Common utility functions
 */

import { normalizeSecretInput } from "./utils/normalize-secret-input.js";

// Re-export from submodules
export { normalizeSecretInput };

// ============================================
// Type Guards
// ============================================

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

// ============================================
// String Utilities
// ============================================

export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function camelCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
      index === 0 ? word.toLowerCase() : word.toUpperCase()
    )
    .replace(/\s+/g, "");
}

export function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export function snakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

// ============================================
// Number Utilities
// ============================================

export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

export function round(num: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

// ============================================
// Array Utilities
// ============================================

export function uniq<T>(array: T[]): T[] {
  return [...new Set(array)];
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================
// Object Utilities
// ============================================

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(deepClone) as unknown as T;
  }
  
  const cloned = {} as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
  }
  
  return cloned as T;
}

export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>
): T {
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    if (isObject(source[key]) && isObject(result[key])) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

// ============================================
// Async Utilities
// ============================================

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function timeout<T>(
  promise: Promise<T>,
  ms: number,
  message = "Operation timed out"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

// ============================================
// E164 Phone Number Utilities
// ============================================

export function normalizeE164(phoneNumber: string): string | null {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, "");
  
  // Must be at least 10 digits (without country code) or 11+ with country code
  if (digits.length < 10) {
    return null;
  }
  
  // If it starts with a country code (1 for US/Canada, etc.)
  if (digits.length >= 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  
  // Assume US/Canada if no country code
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Already has country code
  return `+${digits}`;
}

export function toWhatsappJid(phoneNumber: string): string | null {
  const normalized = normalizeE164(phoneNumber);
  if (!normalized) {
    return null;
  }
  return `${normalized}@s.whatsapp.net`;
}

// ============================================
// Web Channel Utilities
// ============================================

export function assertWebChannel(channel: string): asserts channel is "web" {
  if (channel !== "web") {
    throw new Error(`Expected channel "web", got "${channel}"`);
  }
}

// ============================================
// Environment Utilities
// ============================================

export function getEnvVar(name: string, defaultValue?: string): string | undefined {
  return process.env[name] ?? defaultValue;
}

export function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

// ============================================
// File Path Utilities
// ============================================

export function expandHomeDir(path: string): string {
  if (path.startsWith("~/")) {
    return path.replace("~", process.env.HOME || "");
  }
  return path;
}

// ============================================
// Date Utilities
// ============================================

export function formatDate(date: Date, format = "iso"): string {
  switch (format) {
    case "iso":
      return date.toISOString();
    case "date":
      return date.toDateString();
    case "time":
      return date.toTimeString();
    default:
      return date.toISOString();
  }
}

export function parseDate(input: string): Date | null {
  const date = new Date(input);
  return isNaN(date.getTime()) ? null : date;
}
