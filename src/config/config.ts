/**
 * OpenClaw-Mobile - Configuration Module
 * Configuration loading and management
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { logVerbose, logWarn } from "../globals.js";

// ============================================
// Configuration Types
// ============================================

export type OpenClawConfig = {
  metadata?: {
    name?: string;
    version?: string;
    description?: string;
    target?: string;
  };
  gateway?: {
    host?: string;
    port?: number;
    verbose?: boolean;
    websocket?: {
      path?: string;
      heartbeat?: number;
    };
  };
  browser?: {
    enabled?: boolean;
    headless?: boolean;
    executablePath?: string;
    args?: string[];
    userAgent?: string;
    viewport?: {
      width: number;
      height: number;
    };
    navigationTimeout?: number;
    pageTimeout?: number;
  };
  resources?: {
    memoryLimitMB?: number;
    concurrency?: number;
    maxBrowserSessions?: number;
    maxSearchConcurrency?: number;
    cache?: {
      enabled?: boolean;
      ttlMinutes?: number;
      maxSizeMB?: number;
    };
  };
  tools?: {
    web?: {
      search?: {
        enabled?: boolean;
        provider?: string;
        maxResults?: number;
        timeoutSeconds?: number;
        cacheTtlMinutes?: number;
        fetchContent?: boolean;
        searxng?: {
          instances?: Array<{
            url: string;
            priority: number;
          }>;
        };
      };
    };
  };
  agent?: {
    model?: string;
    thinking?: string;
    verbose?: boolean;
    session?: {
      maxHistory?: number;
      compactThreshold?: number;
    };
  };
  security?: {
    ssrfProtection?: boolean;
    allowedPrivateNetworks?: string[];
    contentSecurity?: {
      wrapExternal?: boolean;
      maxContentLength?: number;
    };
  };
  logging?: {
    level?: string;
    file?: {
      enabled?: boolean;
      path?: string;
      maxSize?: string;
      maxFiles?: number;
    };
    console?: {
      enabled?: boolean;
      colors?: boolean;
    };
  };
  mobile?: {
    prootCompat?: boolean;
    networkPatch?: boolean;
    batteryAware?: boolean;
    networkAware?: boolean;
  };
  channels?: {
    webchat?: {
      enabled?: boolean;
      port?: number;
    };
    terminal?: {
      enabled?: boolean;
    };
  };
  extensions?: {
    autoLoad?: boolean;
    allowed?: string[];
  };
};

// ============================================
// Default Configuration
// ============================================

export const DEFAULT_CONFIG: OpenClawConfig = {
  gateway: {
    host: "127.0.0.1",
    port: 18789,
    verbose: false,
    websocket: {
      path: "/ws",
      heartbeat: 30000,
    },
  },
  browser: {
    enabled: true,
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-zygote",
    ],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    viewport: {
      width: 1280,
      height: 720,
    },
    navigationTimeout: 30000,
    pageTimeout: 30000,
  },
  resources: {
    memoryLimitMB: 512,
    concurrency: 1,
    maxBrowserSessions: 1,
    maxSearchConcurrency: 2,
    cache: {
      enabled: true,
      ttlMinutes: 60,
      maxSizeMB: 50,
    },
  },
  tools: {
    web: {
      search: {
        enabled: true,
        provider: "searxng",
        maxResults: 5,
        timeoutSeconds: 30,
        cacheTtlMinutes: 60,
        fetchContent: true,
      },
    },
  },
  agent: {
    model: "openai/gpt-4o-mini",
    thinking: "medium",
    verbose: false,
    session: {
      maxHistory: 50,
      compactThreshold: 4000,
    },
  },
  security: {
    ssrfProtection: true,
    allowedPrivateNetworks: [],
    contentSecurity: {
      wrapExternal: true,
      maxContentLength: 5000,
    },
  },
  logging: {
    level: "info",
    file: {
      enabled: true,
      path: "~/.openclaw/logs/openclaw-mobile.log",
      maxSize: "10MB",
      maxFiles: 3,
    },
    console: {
      enabled: true,
      colors: true,
    },
  },
  mobile: {
    prootCompat: true,
    networkPatch: true,
    batteryAware: true,
    networkAware: true,
  },
  channels: {
    webchat: {
      enabled: true,
      port: 18790,
    },
    terminal: {
      enabled: true,
    },
  },
  extensions: {
    autoLoad: false,
    allowed: [],
  },
};

// ============================================
// Configuration Loading
// ============================================

export async function loadConfig(configPath?: string): Promise<OpenClawConfig> {
  const paths = configPath ? [configPath] : getConfigPaths();
  
  for (const path of paths) {
    const resolvedPath = resolvePath(path);
    logVerbose(`[Config] Trying: ${resolvedPath}`);
    
    if (existsSync(resolvedPath)) {
      try {
        const content = await readFile(resolvedPath, "utf-8");
        const parsed = parseToml(content);
        logVerbose(`[Config] Loaded from: ${resolvedPath}`);
        return mergeConfig(DEFAULT_CONFIG, parsed);
      } catch (error) {
        logWarn(`[Config] Failed to load ${resolvedPath}: ${String(error)}`);
      }
    }
  }
  
  logVerbose("[Config] Using default configuration");
  return DEFAULT_CONFIG;
}

export function getConfigPaths(): string[] {
  return [
    process.env.OPENCLAW_CONFIG || "",
    join(process.cwd(), "config.toml"),
    join(process.cwd(), "config.mobile.toml"),
    join(homedir(), ".openclaw", "config.toml"),
    join(homedir(), ".config", "openclaw", "config.toml"),
    "/etc/openclaw/config.toml",
  ].filter(Boolean);
}

function resolvePath(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return resolve(path);
}

// ============================================
// Simple TOML Parser
// ============================================

function parseToml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentSection: Record<string, unknown> = result;
  const sectionStack: Record<string, unknown>[] = [];
  
  const lines = content.split("\n");
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and comments
    if (!line || line.startsWith("#")) {
      continue;
    }
    
    // Handle section headers
    if (line.startsWith("[") && line.endsWith("]")) {
      const sectionPath = line.slice(1, -1).trim();
      
      // Handle nested sections like [tools.web.search]
      const parts = sectionPath.split(".");
      currentSection = result;
      
      for (const part of parts) {
        if (!currentSection[part]) {
          currentSection[part] = {};
        }
        currentSection = currentSection[part] as Record<string, unknown>;
      }
      
      continue;
    }
    
    // Handle array of tables [[section]]
    if (line.startsWith("[[") && line.endsWith("]]")) {
      const sectionPath = line.slice(2, -2).trim();
      const parts = sectionPath.split(".");
      
      currentSection = result;
      for (let j = 0; j < parts.length - 1; j++) {
        const part = parts[j];
        if (!currentSection[part]) {
          currentSection[part] = {};
        }
        currentSection = currentSection[part] as Record<string, unknown>;
      }
      
      const arrayKey = parts[parts.length - 1];
      if (!currentSection[arrayKey]) {
        currentSection[arrayKey] = [];
      }
      const newItem: Record<string, unknown> = {};
      (currentSection[arrayKey] as Record<string, unknown>[]).push(newItem);
      currentSection = newItem;
      
      continue;
    }
    
    // Handle key-value pairs
    const equalIndex = line.indexOf("=");
    if (equalIndex > 0) {
      const key = line.slice(0, equalIndex).trim();
      let value: unknown = line.slice(equalIndex + 1).trim();
      
      // Remove inline comments
      const commentIndex = (value as string).indexOf("#");
      if (commentIndex > 0) {
        value = (value as string).slice(0, commentIndex).trim();
      }
      
      // Parse value types
      value = parseValue(value as string);
      
      currentSection[key] = value;
    }
  }
  
  return result;
}

function parseValue(value: string): unknown {
  // Boolean
  if (value === "true") return true;
  if (value === "false") return false;
  
  // Null
  if (value === "null") return null;
  
  // Number
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }
  
  // Array
  if (value.startsWith("[") && value.endsWith("]")) {
    const arrayContent = value.slice(1, -1);
    if (!arrayContent.trim()) {
      return [];
    }
    
    // Simple array parsing (doesn't handle nested arrays or complex objects)
    return arrayContent.split(",").map((item) => {
      const trimmed = item.trim();
      // Remove quotes if present
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
          (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
      }
      return parseValue(trimmed);
    });
  }
  
  // String (remove quotes)
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  
  // Return as string
  return value;
}

// ============================================
// Configuration Merging
// ============================================

function mergeConfig<T>(defaultConfig: T, userConfig: Record<string, unknown>): T {
  if (typeof defaultConfig !== "object" || defaultConfig === null) {
    return defaultConfig;
  }
  
  const result = { ...defaultConfig } as Record<string, unknown>;
  
  for (const [key, value] of Object.entries(userConfig)) {
    if (value === undefined) {
      continue;
    }
    
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = mergeConfig(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }
  
  return result as T;
}

// ============================================
// Configuration Validation
// ============================================

export function validateConfig(config: OpenClawConfig): string[] {
  const errors: string[] = [];
  
  // Validate gateway port
  if (config.gateway?.port !== undefined) {
    if (config.gateway.port < 1 || config.gateway.port > 65535) {
      errors.push("gateway.port must be between 1 and 65535");
    }
  }
  
  // Validate memory limit
  if (config.resources?.memoryLimitMB !== undefined) {
    if (config.resources.memoryLimitMB < 64) {
      errors.push("resources.memoryLimitMB must be at least 64");
    }
  }
  
  // Validate browser executable path
  if (config.browser?.executablePath) {
    if (!config.browser.executablePath.startsWith("/")) {
      errors.push("browser.executablePath must be an absolute path");
    }
  }
  
  return errors;
}
