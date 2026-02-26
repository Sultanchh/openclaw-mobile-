/**
 * OpenClaw-Mobile - Secret Input Normalization
 * Utilities for normalizing and validating secret inputs (API keys, tokens)
 */

// ============================================
// Secret Normalization
// ============================================

/**
 * Normalize a secret input (API key, token, etc.)
 * - Trims whitespace
 * - Removes common prefixes/suffixes
 * - Validates format
 */
export function normalizeSecretInput(input: unknown): string {
  if (input === undefined || input === null) {
    return "";
  }
  
  if (typeof input !== "string") {
    return "";
  }
  
  // Trim whitespace and newlines
  let normalized = input.trim();
  
  // Remove surrounding quotes if present
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }
  
  // Remove common prefixes that might be accidentally included
  const prefixesToRemove = [
    "Bearer ",
    "Basic ",
    "Token ",
    "ApiKey ",
    "api-key=",
    "api_key=",
    "key=",
    "token=",
  ];
  
  for (const prefix of prefixesToRemove) {
    if (normalized.toLowerCase().startsWith(prefix.toLowerCase())) {
      normalized = normalized.slice(prefix.length);
    }
  }
  
  return normalized.trim();
}

/**
 * Check if a secret appears to be valid
 */
export function isValidSecret(secret: string): boolean {
  if (!secret) {
    return false;
  }
  
  // Must have some content
  if (secret.length < 8) {
    return false;
  }
  
  // Must not be a placeholder
  const placeholders = [
    "your-api-key",
    "your_api_key",
    "yourapikey",
    "api-key-here",
    "placeholder",
    "example",
    "test",
    "dummy",
    "xxx",
    "***",
    "...",
  ];
  
  const lowerSecret = secret.toLowerCase();
  for (const placeholder of placeholders) {
    if (lowerSecret.includes(placeholder)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Mask a secret for logging/display
 */
export function maskSecret(secret: string, visibleChars = 4): string {
  if (!secret) {
    return "[empty]";
  }
  
  if (secret.length <= visibleChars * 2) {
    return "*".repeat(secret.length);
  }
  
  const start = secret.slice(0, visibleChars);
  const end = secret.slice(-visibleChars);
  const middleLength = secret.length - visibleChars * 2;
  
  return `${start}${"*".repeat(middleLength)}${end}`;
}

/**
 * Detect the likely type of an API key
 */
export function detectKeyType(key: string): string {
  const lowerKey = key.toLowerCase();
  
  // OpenAI
  if (lowerKey.startsWith("sk-")) {
    return "openai";
  }
  
  // Anthropic
  if (lowerKey.startsWith("sk-ant-")) {
    return "anthropic";
  }
  
  // Google/Gemini
  if (lowerKey.startsWith("ai") && key.length > 20) {
    return "google";
  }
  
  // Brave Search
  if (lowerKey.startsWith("bsa")) {
    return "brave";
  }
  
  // Perplexity
  if (lowerKey.startsWith("pplx-")) {
    return "perplexity";
  }
  
  // OpenRouter
  if (lowerKey.startsWith("sk-or-")) {
    return "openrouter";
  }
  
  // xAI/Grok
  if (lowerKey.startsWith("xai-") || key.startsWith("grok-")) {
    return "xai";
  }
  
  // Moonshot/Kimi
  if (key.startsWith("sk-") && key.length > 30) {
    return "moonshot";
  }
  
  return "unknown";
}

/**
 * Validate an API key format
 */
export function validateKeyFormat(key: string, expectedType?: string): boolean {
  if (!isValidSecret(key)) {
    return false;
  }
  
  if (expectedType) {
    const detectedType = detectKeyType(key);
    if (detectedType !== expectedType && detectedType !== "unknown") {
      return false;
    }
  }
  
  return true;
}
