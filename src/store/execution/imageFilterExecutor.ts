/**
 * Image Filter Executor
 *
 * Uses LLM vision to evaluate each input image against a text criteria,
 * passing through only images that match.
 */

import type { ImageFilterNodeData } from "@/types";
import { buildLlmHeaders } from "@/store/utils/buildApiHeaders";
import type { NodeExecutionContext } from "./types";

const MAX_CONCURRENT = 4;

async function evaluateImage(
  image: string,
  criteria: string,
  provider: string,
  model: string,
  headers: Record<string, string>,
  signal?: AbortSignal
): Promise<boolean> {
  const prompt = `You are an image filter. Evaluate this image against the following criteria:
"${criteria}"

Respond with ONLY the word "PASS" if the image matches the criteria, or "FAIL" if it does not. Do not include any other text.`;

  const response = await fetch("/api/llm", {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt,
      images: [image],
      provider,
      model,
      temperature: 0,
      maxTokens: 10,
    }),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    // If a single evaluation fails, default to including the image
    console.warn(`Image filter evaluation failed with status ${response.status}`);
    return true;
  }

  const result = await response.json();
  if (result.success && result.text) {
    const answer = result.text.trim().toUpperCase();
    return answer.includes("PASS");
  }
  // Default to including on ambiguous responses
  return true;
}

async function evaluateBatch(
  images: string[],
  criteria: string,
  provider: string,
  model: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
  onProgress?: (completed: number) => void
): Promise<boolean[]> {
  const results: boolean[] = new Array(images.length);
  let completed = 0;

  // Process in batches of MAX_CONCURRENT
  for (let i = 0; i < images.length; i += MAX_CONCURRENT) {
    const batch = images.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(
      batch.map(img => evaluateImage(img, criteria, provider, model, headers, signal))
    );
    batchResults.forEach((result, j) => {
      results[i + j] = result;
    });
    completed += batch.length;
    onProgress?.(completed);
  }

  return results;
}

export async function executeImageFilter(ctx: NodeExecutionContext): Promise<void> {
  const {
    node,
    getConnectedInputs,
    updateNodeData,
    signal,
    providerSettings,
  } = ctx;

  const nodeData = node.data as ImageFilterNodeData;
  const inputs = getConnectedInputs(node.id);

  const images = inputs.images;
  const criteria = inputs.text || nodeData.filterCriteria;

  if (images.length === 0) {
    updateNodeData(node.id, {
      status: "error",
      error: "No images connected — connect an image source",
    });
    throw new Error("No images connected");
  }

  if (!criteria || criteria.trim().length === 0) {
    updateNodeData(node.id, {
      status: "error",
      error: "No filter criteria — enter criteria or connect text input",
    });
    throw new Error("No filter criteria");
  }

  updateNodeData(node.id, {
    inputImages: images,
    status: "loading",
    error: null,
    filterResults: [],
    outputImages: [],
  });

  const headers = buildLlmHeaders();

  try {
    const passed = await evaluateBatch(
      images,
      criteria,
      nodeData.provider,
      nodeData.model,
      headers,
      signal,
    );

    const filterResults = images.map((image, i) => ({
      image,
      passed: passed[i],
    }));

    const outputImages = images.filter((_, i) => passed[i]);

    updateNodeData(node.id, {
      filterResults,
      outputImages,
      status: "complete",
      error: null,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : "Image filter failed";
    updateNodeData(node.id, {
      status: "error",
      error: errorMessage,
    });
    throw new Error(errorMessage);
  }
}
