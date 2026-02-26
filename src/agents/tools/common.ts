/**
 * OpenClaw-Mobile - Common Tool Utilities
 * Shared utilities for agent tools
 */

import { Type, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

// ============================================
// Tool Result Types
// ============================================

export type ToolResult = {
  type: "content";
  content: Array<{
    type: "text";
    text: string;
  }>;
};

export type AnyAgentTool = {
  label: string;
  name: string;
  description: string;
  parameters: TSchema;
  execute: (toolCallId: string, args: Record<string, unknown>) => Promise<ToolResult>;
};

// ============================================
// Result Helpers
// ============================================

export function jsonResult(data: Record<string, unknown>): ToolResult {
  return {
    type: "content",
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function textResult(text: string): ToolResult {
  return {
    type: "content",
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

// ============================================
// Parameter Readers
// ============================================

export function readStringParam(
  params: Record<string, unknown>,
  key: string,
  options?: { required?: boolean; default?: string }
): string | undefined {
  const value = params[key];

  if (value === undefined || value === null) {
    if (options?.required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return options?.default;
  }

  if (typeof value !== "string") {
    throw new Error(`Parameter ${key} must be a string`);
  }

  return value;
}

export function readNumberParam(
  params: Record<string, unknown>,
  key: string,
  options?: { required?: boolean; default?: number; integer?: boolean }
): number | undefined {
  const value = params[key];

  if (value === undefined || value === null) {
    if (options?.required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return options?.default;
  }

  if (typeof value !== "number") {
    throw new Error(`Parameter ${key} must be a number`);
  }

  if (options?.integer && !Number.isInteger(value)) {
    throw new Error(`Parameter ${key} must be an integer`);
  }

  return value;
}

export function readBooleanParam(
  params: Record<string, unknown>,
  key: string,
  options?: { required?: boolean; default?: boolean }
): boolean | undefined {
  const value = params[key];

  if (value === undefined || value === null) {
    if (options?.required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return options?.default;
  }

  if (typeof value !== "boolean") {
    throw new Error(`Parameter ${key} must be a boolean`);
  }

  return value;
}

export function readArrayParam<T>(
  params: Record<string, unknown>,
  key: string,
  options?: { required?: boolean }
): T[] | undefined {
  const value = params[key];

  if (value === undefined || value === null) {
    if (options?.required) {
      throw new Error(`Missing required parameter: ${key}`);
    }
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Parameter ${key} must be an array`);
  }

  return value as T[];
}

// ============================================
// Schema Validation
// ============================================

export function validateParams<T extends TSchema>(
  schema: T,
  params: Record<string, unknown>
): { success: true; data: unknown } | { success: false; errors: string[] } {
  try {
    const validated = Value.Decode(schema, params);
    return { success: true, data: validated };
  } catch (error) {
    const errors = error instanceof Error ? [error.message] : ["Validation failed"];
    return { success: false, errors };
  }
}

// ============================================
// Tool Schema Helpers
// ============================================

export function createToolSchema(properties: Record<string, TSchema>) {
  return Type.Object(properties);
}

// ============================================
// Error Handling
// ============================================

export function createErrorResult(error: string, details?: Record<string, unknown>): ToolResult {
  return jsonResult({
    error,
    ...details,
  });
}

export function createSuccessResult(data: Record<string, unknown>): ToolResult {
  return jsonResult({
    success: true,
    ...data,
  });
}
