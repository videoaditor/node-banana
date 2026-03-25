/**
 * API Header Builder Utilities
 *
 * Simplified header builder - all API keys are server-side only.
 */

/**
 * Build headers for image/video generation API calls.
 * All API keys are server-side - no client-side configuration needed.
 */
export function buildGenerateHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
  };
}

/**
 * Build headers for LLM API calls.
 * All API keys are server-side - no client-side configuration needed.
 */
export function buildLlmHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
  };
}
