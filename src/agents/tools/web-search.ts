/**
 * OpenClaw-Mobile - Web Search Tool
 * API-Free Stack: SearXNG + Jina Reader Pipeline
 * 
 * This module replaces paid API dependencies with a decentralized
 * search approach using public SearXNG instances and Jina AI's
 * free content extraction service.
 */

import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import { logVerbose } from "../../globals.js";
import { wrapWebContent } from "../../security/external-content.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";
import {
  CacheEntry,
  DEFAULT_CACHE_TTL_MINUTES,
  DEFAULT_TIMEOUT_SECONDS,
  normalizeCacheKey,
  readCache,
  readResponseText,
  resolveCacheTtlMs,
  resolveTimeoutSeconds,
  withTimeout,
  writeCache,
} from "./web-shared.js";

// ============================================
// SearXNG + Jina Reader Configuration
// ============================================

// Public SearXNG instances for decentralized search
// These are community-maintained instances that support JSON output
const SEARXNG_INSTANCES = [
  "https://searx.be",
  "https://searx.dresden.network",
  "https://search.sapti.me",
  "https://searx.tiekoetter.com",
  "https://searx.fmac.xyz",
  "https://searx.nixnet.services",
  "https://searx.prvcy.eu",
  "https://search.bus-hit.me",
];

// Jina AI Reader API for content extraction
const JINA_READER_URL = "https://r.jina.ai/http://";
const JINA_READER_HTTPS_URL = "https://r.jina.ai/";

// Maximum content length to return (5000 chars as per spec)
const MAX_CONTENT_LENGTH = 5000;

// Search configuration
const DEFAULT_SEARCH_COUNT = 5;
const MAX_SEARCH_COUNT = 10;

// Cache for search results
const SEARCH_CACHE = new Map<string, CacheEntry<Record<string, unknown>>>();

// ============================================
// Type Definitions
// ============================================

const WebSearchSchema = Type.Object({
  query: Type.String({ description: "Search query string." }),
  count: Type.Optional(
    Type.Number({
      description: "Number of results to return (1-10).",
      minimum: 1,
      maximum: MAX_SEARCH_COUNT,
    }),
  ),
  country: Type.Optional(
    Type.String({
      description:
        "2-letter country code for region-specific results (e.g., 'DE', 'US', 'ALL'). Default: 'US'.",
    }),
  ),
  search_lang: Type.Optional(
    Type.String({
      description:
        "Short ISO language code for search results (e.g., 'de', 'en', 'fr', 'tr'). Must be a 2-letter code, NOT a locale.",
    }),
  ),
  fetch_content: Type.Optional(
    Type.Boolean({
      description: "Whether to fetch full page content via Jina Reader. Default: true.",
    }),
  ),
});

type SearXNGResult = {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
  score?: number;
};

type SearXNGResponse = {
  query?: string;
  results?: SearXNGResult[];
  answers?: string[];
  suggestions?: string[];
};

type SearchResult = {
  title: string;
  url: string;
  description: string;
  content?: string;
  siteName?: string;
};

// ============================================
// SearXNG Search Implementation
// ============================================

/**
 * Cycle through SearXNG instances to find one that works
 * Returns the JSON search results from the first successful instance
 */
async function searchWithSearXNG(params: {
  query: string;
  count: number;
  language?: string;
  timeoutSeconds: number;
}): Promise<{ results: SearXNGResult[]; instance: string } | null> {
  const { query, count, language, timeoutSeconds } = params;
  
  // Shuffle instances for load distribution
  const shuffledInstances = [...SEARXNG_INSTANCES].sort(() => Math.random() - 0.5);
  
  for (const instance of shuffledInstances) {
    try {
      logVerbose(`[OpenClaw Mobile] Trying SearXNG instance: ${instance}`);
      
      const url = new URL(`${instance}/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("categories", "general");
      url.searchParams.set("language", language || "en-US");
      
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "OpenClaw-Mobile/1.0",
        },
        signal: withTimeout(undefined, timeoutSeconds * 1000),
      });
      
      if (!res.ok) {
        logVerbose(`[OpenClaw Mobile] SearXNG instance ${instance} returned ${res.status}`);
        continue;
      }
      
      const data = (await res.json()) as SearXNGResponse;
      
      if (data.results && data.results.length > 0) {
        logVerbose(`[OpenClaw Mobile] SearXNG instance ${instance} returned ${data.results.length} results`);
        return { 
          results: data.results.slice(0, count),
          instance 
        };
      }
    } catch (err) {
      logVerbose(`[OpenClaw Mobile] SearXNG instance ${instance} failed: ${String(err)}`);
      continue;
    }
  }
  
  return null;
}

// ============================================
// Jina Reader Content Extraction
// ============================================

/**
 * Fetch clean Markdown content from a URL using Jina Reader
 * Returns the first MAX_CONTENT_LENGTH characters
 */
async function fetchWithJinaReader(params: {
  url: string;
  timeoutSeconds: number;
}): Promise<string | null> {
  const { url, timeoutSeconds } = params;
  
  try {
    // Determine if URL is HTTP or HTTPS
    const isHttp = url.startsWith("http://");
    const jinaUrl = isHttp 
      ? `${JINA_READER_URL}${url.slice(7)}`  // Remove http:// prefix
      : `${JINA_READER_HTTPS_URL}${url}`;
    
    logVerbose(`[OpenClaw Mobile] Fetching content via Jina: ${url}`);
    
    const res = await fetch(jinaUrl, {
      method: "GET",
      headers: {
        Accept: "text/markdown,text/plain,text/html,*/*",
        "User-Agent": "OpenClaw-Mobile/1.0",
      },
      signal: withTimeout(undefined, timeoutSeconds * 1000),
    });
    
    if (!res.ok) {
      logVerbose(`[OpenClaw Mobile] Jina Reader returned ${res.status} for ${url}`);
      return null;
    }
    
    const content = await res.text();
    
    // Return first 5000 characters as per specification
    if (content.length > MAX_CONTENT_LENGTH) {
      return content.slice(0, MAX_CONTENT_LENGTH) + "\n...[content truncated]";
    }
    
    return content;
  } catch (err) {
    logVerbose(`[OpenClaw Mobile] Jina Reader failed for ${url}: ${String(err)}`);
    return null;
  }
}

// ============================================
// Utility Functions
// ============================================

function resolveSiteName(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function resolveSearchCount(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const clamped = Math.max(1, Math.min(MAX_SEARCH_COUNT, Math.floor(parsed)));
  return clamped;
}

// ============================================
// Main Search Implementation
// ============================================

async function runWebSearch(params: {
  query: string;
  count: number;
  timeoutSeconds: number;
  cacheTtlMs: number;
  language?: string;
  fetchContent?: boolean;
}): Promise<Record<string, unknown>> {
  const cacheKey = normalizeCacheKey(
    `searxng:${params.query}:${params.count}:${params.language || "default"}:${String(params.fetchContent)}`
  );
  
  const cached = readCache(SEARCH_CACHE, cacheKey);
  if (cached) {
    return { ...cached.value, cached: true };
  }
  
  const start = Date.now();
  
  // Step 1: Search using SearXNG
  const searchResult = await searchWithSearXNG({
    query: params.query,
    count: params.count,
    language: params.language,
    timeoutSeconds: params.timeoutSeconds,
  });
  
  if (!searchResult || searchResult.results.length === 0) {
    const payload = {
      query: params.query,
      provider: "searxng",
      count: 0,
      tookMs: Date.now() - start,
      error: "No results found from any SearXNG instance",
      results: [],
    };
    writeCache(SEARCH_CACHE, cacheKey, payload, params.cacheTtlMs);
    return payload;
  }
  
  // Step 2: Process results and optionally fetch content via Jina
  const mappedResults: SearchResult[] = [];
  
  for (const entry of searchResult.results) {
    const url = entry.url || "";
    const title = entry.title || "";
    const description = entry.content || "";
    
    let content: string | undefined;
    
    // Fetch full content via Jina Reader if enabled
    if (params.fetchContent !== false && url) {
      content = await fetchWithJinaReader({
        url,
        timeoutSeconds: Math.min(params.timeoutSeconds, 10), // Shorter timeout for content fetch
      }) || undefined;
    }
    
    mappedResults.push({
      title: title ? wrapWebContent(title, "web_search") : "",
      url,
      description: description ? wrapWebContent(description, "web_search") : "",
      content: content ? wrapWebContent(content, "web_search") : undefined,
      siteName: resolveSiteName(url) || undefined,
    });
  }
  
  const payload = {
    query: params.query,
    provider: "searxng",
    instance: searchResult.instance,
    count: mappedResults.length,
    tookMs: Date.now() - start,
    externalContent: {
      untrusted: true,
      source: "web_search",
      provider: "searxng+jina",
      wrapped: true,
    },
    results: mappedResults,
  };
  
  writeCache(SEARCH_CACHE, cacheKey, payload, params.cacheTtlMs);
  return payload;
}

// ============================================
// Tool Factory
// ============================================

type WebSearchConfig = NonNullable<OpenClawConfig["tools"]>["web"] extends infer Web
  ? Web extends { search?: infer Search }
    ? Search
    : undefined
  : undefined;

function resolveSearchConfig(cfg?: OpenClawConfig): WebSearchConfig {
  const search = cfg?.tools?.web?.search;
  if (!search || typeof search !== "object") {
    return undefined;
  }
  return search as WebSearchConfig;
}

function resolveSearchEnabled(params: { search?: WebSearchConfig; sandboxed?: boolean }): boolean {
  if (typeof params.search?.enabled === "boolean") {
    return params.search.enabled;
  }
  if (params.sandboxed) {
    return true;
  }
  return true;
}

export function createWebSearchTool(options?: {
  config?: OpenClawConfig;
  sandboxed?: boolean;
}): AnyAgentTool | null {
  const search = resolveSearchConfig(options?.config);
  if (!resolveSearchEnabled({ search, sandboxed: options?.sandboxed })) {
    return null;
  }

  const description = 
    "Search the web using SearXNG (decentralized, API-free search) with optional Jina Reader " +
    "content extraction. Returns search results with titles, URLs, snippets, and optionally " +
    "full page content. No API key required.";

  return {
    label: "Web Search",
    name: "web_search",
    description,
    parameters: WebSearchSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const query = readStringParam(params, "query", { required: true });
      const count = readNumberParam(params, "count", { integer: true }) ?? search?.maxResults ?? DEFAULT_SEARCH_COUNT;
      const language = readStringParam(params, "search_lang") || readStringParam(params, "language");
      const fetchContent = params.fetch_content !== false;
      
      const result = await runWebSearch({
        query,
        count: resolveSearchCount(count, DEFAULT_SEARCH_COUNT),
        timeoutSeconds: resolveTimeoutSeconds(search?.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS),
        cacheTtlMs: resolveCacheTtlMs(search?.cacheTtlMinutes, DEFAULT_CACHE_TTL_MINUTES),
        language: language || undefined,
        fetchContent,
      });
      
      return jsonResult(result);
    },
  };
}

// ============================================
// Testing Exports
// ============================================

export const __testing = {
  resolveSearchCount,
  SEARXNG_INSTANCES,
  MAX_CONTENT_LENGTH,
} as const;
