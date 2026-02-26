/**
 * OpenClaw-Mobile - External Content Security
 * Utilities for safely handling external web content
 */

// ============================================
// Content Wrapping
// ============================================

/**
 * Wrap web content with security metadata
 * This helps LLMs understand the source and trustworthiness of content
 */
export function wrapWebContent(
  content: string,
  source?: string
): string {
  if (!content) {
    return "";
  }
  
  const sourceLabel = source ? ` [Source: ${source}]` : "";
  
  // Add security wrapper
  return `<!-- EXTERNAL_CONTENT${sourceLabel} -->
${content}
<!-- END_EXTERNAL_CONTENT -->`;
}

/**
 * Wrap content with truncation notice
 */
export function wrapTruncatedContent(
  content: string,
  originalLength: number,
  maxLength: number
): string {
  if (content.length >= originalLength) {
    return content;
  }
  
  return `${content}

[Content truncated: ${originalLength} characters → ${maxLength} characters]`;
}

// ============================================
 * Content Sanitization
// ============================================

/**
 * Remove potentially dangerous content from HTML
 */
export function sanitizeHtml(input: string): string {
  return input
    // Remove script tags and their contents
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    // Remove event handlers
    .replace(/\s*on\w+="[^"]*"/gi, "")
    .replace(/\s*on\w+='[^']*'/gi, "")
    .replace(/\s*on\w+=[^\s>]+/gi, "")
    // Remove javascript: URLs
    .replace(/javascript:/gi, "")
    // Remove data: URLs
    .replace(/data:[^;]*;base64,[A-Za-z0-9+/=]+/g, "[data-url-removed]")
    // Remove iframes
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
    // Remove object/embed tags
    .replace(/<(object|embed)[^>]*>[\s\S]*?<\/\1>/gi, "")
    // Remove style tags
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
}

/**
 * Extract text content from HTML
 */
export function extractTextFromHtml(html: string): string {
  // Remove HTML tags
  let text = html
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  
  // Normalize whitespace
  text = text
    .replace(/\s+/g, " ")
    .trim();
  
  return text;
}

// ============================================
// Content Validation
// ============================================

/**
 * Check if content appears to be valid and useful
 */
export function isValidContent(content: string): boolean {
  if (!content || typeof content !== "string") {
    return false;
  }
  
  const trimmed = content.trim();
  
  // Must have some content
  if (trimmed.length < 10) {
    return false;
  }
  
  // Must not be just whitespace or special characters
  if (/^[\s\n\r\t]*$/.test(trimmed)) {
    return false;
  }
  
  // Must have some alphanumeric content
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return false;
  }
  
  return true;
}

/**
 * Check if content appears to be an error page
 */
export function isErrorPage(content: string): boolean {
  const errorPatterns = [
    /404\s+not\s+found/i,
    /403\s+forbidden/i,
    /500\s+internal\s+server\s+error/i,
    /502\s+bad\s+gateway/i,
    /503\s+service\s+unavailable/i,
    /error\s+page/i,
    /page\s+not\s+found/i,
    /access\s+denied/i,
    /this\s+site\s+can't\s+be\s+reached/i,
    /err_connection_refused/i,
    /err_name_not_resolved/i,
  ];
  
  return errorPatterns.some((pattern) => pattern.test(content));
}

// ============================================
// Content Truncation
// ============================================

/**
 * Truncate content to a maximum length, preserving word boundaries
 */
export function truncateContent(
  content: string,
  maxLength: number,
  options?: {
    preserveWords?: boolean;
    suffix?: string;
  }
): string {
  if (!content || content.length <= maxLength) {
    return content;
  }
  
  const suffix = options?.suffix ?? "\n...[content truncated]";
  const availableLength = maxLength - suffix.length;
  
  if (availableLength <= 0) {
    return content.slice(0, maxLength);
  }
  
  if (options?.preserveWords !== false) {
    // Find the last complete word
    let truncated = content.slice(0, availableLength);
    const lastSpace = truncated.lastIndexOf(" ");
    
    if (lastSpace > availableLength * 0.8) {
      truncated = truncated.slice(0, lastSpace);
    }
    
    return truncated + suffix;
  }
  
  return content.slice(0, availableLength) + suffix;
}

/**
 * Truncate content by lines
 */
export function truncateByLines(
  content: string,
  maxLines: number,
  suffix = "\n...[content truncated]"
): string {
  const lines = content.split("\n");
  
  if (lines.length <= maxLines) {
    return content;
  }
  
  return lines.slice(0, maxLines).join("\n") + suffix;
}

// ============================================
// Content Type Detection
// ============================================

/**
 * Detect if content is likely HTML
 */
export function isHtml(content: string): boolean {
  if (!content) {
    return false;
  }
  
  const htmlIndicators = [
    /<html/i,
    /<body/i,
    /<div/i,
    /<p>/i,
    /<span/i,
    /<a\s+href/i,
    /<script/i,
    /<style/i,
    /<!DOCTYPE\s+html/i,
  ];
  
  return htmlIndicators.some((pattern) => pattern.test(content));
}

/**
 * Detect if content is likely JSON
 */
export function isJson(content: string): boolean {
  if (!content) {
    return false;
  }
  
  const trimmed = content.trim();
  
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

/**
 * Detect if content is likely Markdown
 */
export function isMarkdown(content: string): boolean {
  if (!content) {
    return false;
  }
  
  const mdIndicators = [
    /^#{1,6}\s+/m,
    /\*\*.*?\*\*/,
    /\*.*?\*/,
    /\[.*?\]\(.*?\)/,
    /^\s*[-*+]\s+/m,
    /^\s*\d+\.\s+/m,
    /^```/m,
    /^>/m,
  ];
  
  return mdIndicators.some((pattern) => pattern.test(content));
}

// ============================================
// URL Security
// ============================================

/**
 * Check if a URL is potentially dangerous
 */
export function isDangerousUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Check for dangerous protocols
    const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:"];
    if (dangerousProtocols.includes(parsed.protocol.toLowerCase())) {
      return true;
    }
    
    // Check for IP-based URLs (potential SSRF)
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(parsed.hostname)) {
      const parts = parsed.hostname.split(".").map(Number);
      // Check for private IP ranges
      if (
        parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        parts[0] === 127
      ) {
        return true;
      }
    }
    
    // Check for localhost
    if (parsed.hostname.toLowerCase() === "localhost") {
      return true;
    }
    
    return false;
  } catch {
    return true;
  }
}

/**
 * Sanitize a URL for display
 */
export function sanitizeUrlForDisplay(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Remove credentials
    parsed.username = "";
    parsed.password = "";
    
    // Remove fragment
    parsed.hash = "";
    
    return parsed.toString();
  } catch {
    return url;
  }
}
