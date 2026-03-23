/**
 * Unified Models API Endpoint
 *
 * Aggregates models from all configured providers (Replicate, fal.ai, Gemini, WaveSpeed).
 * Uses in-memory caching to reduce external API calls.
 *
 * GET /api/models
 *
 * Query params:
 *   - provider: Optional, filter to specific provider ("replicate" | "fal" | "gemini" | "wavespeed")
 *   - search: Optional, search query
 *   - refresh: Optional, bypass cache if "true"
 *   - capabilities: Optional, filter by capabilities (comma-separated)
 *
 * Headers:
 *   - X-Replicate-Key: Replicate API key
 *   - X-Fal-Key: fal.ai API key (optional, works without but rate limited)
 *   - X-WaveSpeed-Key: WaveSpeed API key
 *
 * Response:
 *   {
 *     success: true,
 *     models: ProviderModel[],
 *     cached: boolean,
 *     providers: { [provider]: { success, count, cached?, error? } },
 *     errors?: string[]
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { ProviderType } from "@/types";
import { ProviderModel, ModelCapability } from "@/lib/providers";
import {
  getCachedModels,
  setCachedModels,
  getCacheKey,
  setCachedWaveSpeedSchemas,
  WaveSpeedApiSchema,
} from "@/lib/providers/cache";

// API base URLs
const REPLICATE_API_BASE = "https://api.replicate.com/v1";
const FAL_API_BASE = "https://api.fal.ai/v1";
const WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3";

// Categories we care about for image/video/3D generation (fal.ai)
const RELEVANT_CATEGORIES = [
  "text-to-image",
  "image-to-image",
  "text-to-video",
  "image-to-video",
  "text-to-3d",
  "image-to-3d",
];

// Kie.ai models (hardcoded - no discovery API available)
const KIE_MODELS: ProviderModel[] = [
  // ============ Image Models (11) ============
  {
    id: "z-image",
    name: "Z-Image",
    description: "Fast, affordable text-to-image generation. Great for quick iterations.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.004, currency: "USD" },
    pageUrl: "https://kie.ai/z-image",
  },
  {
    id: "seedream/4.5-text-to-image",
    name: "Seedream 4.5",
    description: "High-quality text-to-image generation with excellent prompt following.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.032, currency: "USD" },
    pageUrl: "https://kie.ai/seedream",
  },
  {
    id: "seedream/4.5-edit",
    name: "Seedream 4.5 Edit",
    description: "Image editing and transformation using Seedream 4.5.",
    provider: "kie",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.032, currency: "USD" },
    pageUrl: "https://kie.ai/seedream",
  },
  {
    id: "gpt-image/1.5-text-to-image",
    name: "GPT Image 1.5",
    description: "OpenAI-style image generation with excellent prompt understanding.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.06, currency: "USD" },
    pageUrl: "https://kie.ai/gpt-image-1",
  },
  {
    id: "gpt-image/1.5-image-to-image",
    name: "GPT Image 1.5 Edit",
    description: "Image editing using GPT Image 1.5 model.",
    provider: "kie",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.06, currency: "USD" },
    pageUrl: "https://kie.ai/gpt-image-1",
  },
  {
    id: "flux-2/pro-text-to-image",
    name: "FLUX.2 Pro",
    description: "FLUX.2 Pro text-to-image generation via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/flux-2",
  },
  {
    id: "flux-2/pro-image-to-image",
    name: "FLUX.2 Pro Edit",
    description: "FLUX.2 Pro image editing via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/flux-2",
  },
  {
    id: "flux-2/flex-text-to-image",
    name: "FLUX.2 Flex",
    description: "FLUX.2 Flex text-to-image generation via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/flux-2",
  },
  {
    id: "flux-2/flex-image-to-image",
    name: "FLUX.2 Flex Edit",
    description: "FLUX.2 Flex image editing via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/flux-2",
  },

  {
    id: "grok-imagine/text-to-image",
    name: "Grok Imagine",
    description: "Grok Imagine text-to-image generation via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/grok-imagine",
  },
  {
    id: "grok-imagine/image-to-image",
    name: "Grok Imagine Edit",
    description: "Grok Imagine image editing via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/grok-imagine",
  },
  // ============ Video Models (11) ============
  {
    id: "grok-imagine/text-to-video",
    name: "Grok Imagine Video",
    description: "Grok Imagine text-to-video generation via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/grok-imagine",
  },
  {
    id: "grok-imagine/image-to-video",
    name: "Grok Imagine I2V",
    description: "Grok Imagine image-to-video generation via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/grok-imagine",
  },
  {
    id: "kling-2.6/text-to-video",
    name: "Kling 2.6",
    description: "Kling 2.6 video generation from text.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.60, currency: "USD" },
    pageUrl: "https://kie.ai/kling-2-6",
  },
  {
    id: "kling-2.6/image-to-video",
    name: "Kling 2.6 Image-to-Video",
    description: "Kling 2.6 video generation from images.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.60, currency: "USD" },
    pageUrl: "https://kie.ai/kling-2-6",
  },
  {
    id: "kling-2.6/motion-control",
    name: "Kling 2.6 Motion Control",
    description: "Motion transfer from video to static image. Supports 720p and 1080p output.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/kling-2-6",
  },
  {
    id: "kling/v2-5-turbo-text-to-video-pro",
    name: "Kling 2.5 Turbo",
    description: "Kling 2.5 Turbo text-to-video generation via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/kling-2-6",
  },
  {
    id: "kling/v2-5-turbo-image-to-video-pro",
    name: "Kling 2.5 Turbo I2V",
    description: "Kling 2.5 Turbo image-to-video generation via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/kling-2-6",
  },
  {
    id: "wan/2-6-text-to-video",
    name: "Wan 2.6",
    description: "Wan 2.6 video generation from text.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.90, currency: "USD" },
    pageUrl: "https://kie.ai/wan-2-6",
  },
  {
    id: "wan/2-6-image-to-video",
    name: "Wan 2.6 Image-to-Video",
    description: "Wan 2.6 video generation from images.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.90, currency: "USD" },
    pageUrl: "https://kie.ai/wan-2-6",
  },
  {
    id: "wan/2-6-video-to-video",
    name: "Wan 2.6 V2V",
    description: "Wan 2.6 video-to-video transformation via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/wan-2-6",
  },
  {
    id: "topaz/video-upscale",
    name: "Topaz Video Upscale",
    description: "AI video upscaling. Supports 1x, 2x, and 4x scaling factors.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/topaz",
  },
];

// Gemini models (hardcoded - these don't come from an external API)
const GEMINI_MODELS: ProviderModel[] = [
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    description: "Latest image generation with Gemini 3.1 Flash. Fast, high quality, supports text-to-image and image-to-image with aspect ratio control.",
    provider: "gemini",
    capabilities: ["text-to-image", "image-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.039, currency: "USD" },
  },
  {
    id: "nano-banana",
    name: "Nano Banana",
    description: "Image generation with Gemini 2.5 Flash. Supports text-to-image and image-to-image with aspect ratio control.",
    provider: "gemini",
    capabilities: ["text-to-image", "image-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.039, currency: "USD" },
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    description: "High-quality image generation with Gemini 3 Pro. Supports text-to-image, image-to-image, resolution control (1K/2K/4K), and Google Search grounding.",
    provider: "gemini",
    capabilities: ["text-to-image", "image-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.134, currency: "USD" },
  },
  {
    id: "veo-2.0-generate-video-001",
    name: "Veo 2",
    description: "Google Veo 2 high-quality text-to-video and image-to-video generation.",
    provider: "gemini",
    capabilities: ["text-to-video", "image-to-video"],
    coverImage: undefined,
  },
  {
    id: "veo-3.1-fast-generate-001",
    name: "Veo 3.1 Fast",
    description: "Google Veo 3.1 Fast — speed-optimized video generation with native audio, up to 8s at 1080p. Supports text-to-video and image-to-video.",
    provider: "gemini",
    capabilities: ["text-to-video", "image-to-video"],
    coverImage: undefined,
  },
];

// WaveSpeed models are now fetched dynamically from https://api.wavespeed.ai/api/v3/models

// ============ Replicate Types ============

interface ReplicateModelsResponse {
  next: string | null;
  previous: string | null;
  results: ReplicateModel[];
}

interface ReplicateModel {
  url: string;
  owner: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  github_url?: string;
  paper_url?: string;
  license_url?: string;
  run_count: number;
  cover_image_url?: string;
  default_example?: Record<string, unknown>;
  latest_version?: {
    id: string;
    openapi_schema?: Record<string, unknown>;
  };
}

// ============ Fal.ai Types ============

interface FalModelsResponse {
  models: FalModel[];
  next_cursor: string | null;
  has_more: boolean;
}

interface FalModel {
  endpoint_id: string;
  metadata: {
    display_name: string;
    category: string;
    description: string;
    status: "active" | "deprecated";
    tags: string[];
    updated_at: string;
    is_favorited: boolean | null;
    thumbnail_url: string;
    model_url: string;
    date: string;
    highlighted: boolean;
    pinned: boolean;
    thumbnail_animated_url?: string;
    github_url?: string;
    license_type?: "commercial" | "research" | "private";
  };
  openapi?: Record<string, unknown>;
}


// ============ Response Types ============

interface ProviderResult {
  success: boolean;
  count: number;
  cached?: boolean;
  error?: string;
}

interface ModelsSuccessResponse {
  success: true;
  models: ProviderModel[];
  cached: boolean;
  providers: Record<string, ProviderResult>;
  errors?: string[];
}

interface ModelsErrorResponse {
  success: false;
  error: string;
}

type ModelsResponse = ModelsSuccessResponse | ModelsErrorResponse;

// ============ Replicate Helpers ============

function inferReplicateCapabilities(model: ReplicateModel): ModelCapability[] {
  const capabilities: ModelCapability[] = [];
  const searchText = `${model.name} ${model.description ?? ""}`.toLowerCase();

  // Check for 3D-related keywords first
  const is3DModel =
    searchText.includes("3d") ||
    searchText.includes("mesh") ||
    searchText.includes("triposr") ||
    searchText.includes("tripo") ||
    searchText.includes("hunyuan3d") ||
    searchText.includes("instant-mesh") ||
    searchText.includes("point-e") ||
    searchText.includes("shap-e");

  if (is3DModel) {
    // 3D model - determine if image-to-3d or text-to-3d
    const hasImageInput =
      searchText.includes("image") ||
      searchText.includes("img") ||
      searchText.includes("photo");
    if (hasImageInput) {
      capabilities.push("image-to-3d");
    } else {
      capabilities.push("text-to-3d");
    }
    return capabilities;
  }

  // Check for video-related keywords
  const isVideoModel =
    searchText.includes("video") ||
    searchText.includes("animate") ||
    searchText.includes("motion") ||
    searchText.includes("luma") ||
    searchText.includes("kling") ||
    searchText.includes("minimax");

  if (isVideoModel) {
    // Video model - determine video capability type
    if (
      searchText.includes("img2vid") ||
      searchText.includes("image-to-video") ||
      searchText.includes("i2v")
    ) {
      capabilities.push("image-to-video");
    } else {
      capabilities.push("text-to-video");
    }
  } else {
    // Image model - default to text-to-image
    capabilities.push("text-to-image");

    // Check for image-to-image capability
    if (
      searchText.includes("img2img") ||
      searchText.includes("image-to-image") ||
      searchText.includes("inpaint") ||
      searchText.includes("controlnet") ||
      searchText.includes("upscale") ||
      searchText.includes("restore")
    ) {
      capabilities.push("image-to-image");
    }
  }

  return capabilities;
}

function mapReplicateModel(model: ReplicateModel): ProviderModel {
  return {
    id: `${model.owner}/${model.name}`,
    name: model.name,
    description: model.description,
    provider: "replicate",
    capabilities: inferReplicateCapabilities(model),
    coverImage: model.cover_image_url,
  };
}

async function fetchReplicateModels(apiKey: string): Promise<ProviderModel[]> {
  const allModels: ProviderModel[] = [];

  // Always fetch from the models endpoint - search endpoint is unreliable
  let url: string | null = `${REPLICATE_API_BASE}/models`;

  // Paginate through results (limit to 15 pages to avoid timeout)
  let pageCount = 0;
  const maxPages = 15;

  while (url && pageCount < maxPages) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status}`);
    }

    const data: ReplicateModelsResponse = await response.json();
    if (data.results) {
      allModels.push(...data.results.map(mapReplicateModel));
    }
    url = data.next;
    pageCount++;
  }

  return allModels;
}

/**
 * Filter models by search query (client-side filtering for Replicate)
 */
function filterModelsBySearch(
  models: ProviderModel[],
  searchQuery: string
): ProviderModel[] {
  const searchLower = searchQuery.toLowerCase();
  return models.filter((model) => {
    const nameMatch = model.name.toLowerCase().includes(searchLower);
    const descMatch =
      model.description?.toLowerCase().includes(searchLower) || false;
    const idMatch = model.id.toLowerCase().includes(searchLower);
    return nameMatch || descMatch || idMatch;
  });
}

// ============ WaveSpeed Types ============

interface WaveSpeedModel {
  // Model ID can be in different fields depending on API version
  model_id?: string;
  id?: string;
  modelId?: string;
  name?: string;
  display_name?: string;
  description?: string;
  category?: string;
  type?: string;
  thumbnail_url?: string;
  cover_image?: string;
  coverImage?: string;
  pricing?: {
    amount?: number;
    currency?: string;
  };
  // Dynamic schema from API (contains api_schemas[] with request_schema)
  api_schema?: WaveSpeedApiSchema;
}

interface WaveSpeedModelsResponse {
  models?: WaveSpeedModel[];
  data?: WaveSpeedModel[];
  results?: WaveSpeedModel[];
}

// ============ WaveSpeed Helpers ============

function inferWaveSpeedCapabilities(model: WaveSpeedModel): ModelCapability[] {
  const capabilities: ModelCapability[] = [];
  const modelId = model.model_id?.toLowerCase() || "";
  const name = (model.name || model.display_name || "").toLowerCase();
  const description = (model.description || "").toLowerCase();
  const category = (model.category || model.type || "").toLowerCase();
  const searchText = `${modelId} ${name} ${description} ${category}`;

  // Check for 3D-related keywords first
  const is3DModel =
    searchText.includes("3d") ||
    searchText.includes("mesh") ||
    searchText.includes("tripo") ||
    searchText.includes("hunyuan3d") ||
    category.includes("3d");

  if (is3DModel) {
    const hasImageInput =
      searchText.includes("image") ||
      searchText.includes("img") ||
      searchText.includes("photo");
    if (hasImageInput) {
      capabilities.push("image-to-3d");
    } else {
      capabilities.push("text-to-3d");
    }
    return capabilities;
  }

  // Check for video-related keywords
  const isVideoModel =
    searchText.includes("video") ||
    searchText.includes("animate") ||
    searchText.includes("motion") ||
    searchText.includes("wan") ||
    searchText.includes("kling") ||
    searchText.includes("luma") ||
    searchText.includes("minimax") ||
    searchText.includes("i2v") ||
    searchText.includes("t2v") ||
    category.includes("video");

  if (isVideoModel) {
    if (
      searchText.includes("img2vid") ||
      searchText.includes("image-to-video") ||
      searchText.includes("i2v")
    ) {
      capabilities.push("image-to-video");
    } else {
      capabilities.push("text-to-video");
    }
  } else {
    // Image model
    capabilities.push("text-to-image");

    // Check for image-to-image capability
    if (
      searchText.includes("img2img") ||
      searchText.includes("image-to-image") ||
      searchText.includes("inpaint") ||
      searchText.includes("controlnet") ||
      searchText.includes("upscale") ||
      searchText.includes("edit") ||
      searchText.includes("kontext")
    ) {
      capabilities.push("image-to-image");
    }
  }

  return capabilities.length > 0 ? capabilities : ["text-to-image"];
}

function mapWaveSpeedModel(model: WaveSpeedModel): ProviderModel {
  // Handle different field names for model ID
  const modelId = model.model_id || model.id || model.modelId || model.name || "unknown";
  const displayName = model.display_name || model.name || modelId;

  return {
    id: modelId,
    name: displayName,
    description: model.description || null,
    provider: "wavespeed",
    capabilities: inferWaveSpeedCapabilities(model),
    coverImage: model.thumbnail_url || model.cover_image || model.coverImage,
    pricing: model.pricing
      ? {
        type: "per-run",
        amount: model.pricing.amount || 0,
        currency: model.pricing.currency || "USD",
      }
      : undefined,
  };
}

async function fetchWaveSpeedModels(apiKey: string): Promise<ProviderModel[]> {
  const response = await fetch(`${WAVESPEED_API_BASE}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`WaveSpeed API error: ${response.status}`);
  }

  const data: WaveSpeedModelsResponse = await response.json();

  // Handle different response formats (models, data, or results array)
  const models = data.models || data.data || data.results || [];

  if (!Array.isArray(models)) {
    console.warn("[WaveSpeed] Unexpected response format:", data);
    return [];
  }

  // Log first model structure for debugging (including api_schema if present)
  if (models.length > 0) {
    const firstModel = models[0];
    console.log("[WaveSpeed] First model sample:", JSON.stringify(firstModel, null, 2).substring(0, 1000));
    console.log(`[WaveSpeed] Total models: ${models.length}`);
    console.log(`[WaveSpeed] First model has api_schema: ${!!firstModel.api_schema}`);
  }

  // Extract and cache schemas from models that have them
  const schemaMap = new Map<string, WaveSpeedApiSchema>();
  for (const model of models) {
    const modelId = model.model_id || model.id || model.modelId || model.name;
    if (modelId && model.api_schema) {
      schemaMap.set(modelId, model.api_schema);
    }
  }

  // Bulk cache all schemas
  if (schemaMap.size > 0) {
    console.log(`[WaveSpeed] Caching ${schemaMap.size} model schemas`);
    setCachedWaveSpeedSchemas(schemaMap);
  }

  return models.map(mapWaveSpeedModel);
}

// ============ Fal.ai Helpers ============

// Curated list of reliable, popular fal.ai models that are proven to work
const FAL_CURATED_MODELS: ProviderModel[] = [
  // ============ Image Models ============
  {
    id: "fal-ai/flux/dev",
    name: "FLUX.1 Dev",
    description: "High-quality text-to-image model from Black Forest Labs. Great balance of speed and quality.",
    provider: "fal",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/flux/dev",
  },
  {
    id: "fal-ai/flux/schnell",
    name: "FLUX.1 Schnell",
    description: "Ultra-fast text-to-image model from Black Forest Labs. Best for rapid iteration.",
    provider: "fal",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/flux/schnell",
  },
  {
    id: "fal-ai/flux-pro/v1.1-ultra",
    name: "FLUX Pro 1.1 Ultra",
    description: "Highest quality FLUX model. Premium image generation with ultra-high resolution output.",
    provider: "fal",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/flux-pro/v1.1-ultra",
  },
  {
    id: "fal-ai/recraft-v3",
    name: "Recraft V3",
    description: "State-of-the-art image generation with exceptional prompt following and typography support.",
    provider: "fal",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/recraft-v3",
  },
  {
    id: "fal-ai/ideogram/v3",
    name: "Ideogram V3",
    description: "High-quality text-to-image with excellent text rendering in images.",
    provider: "fal",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/ideogram/v3",
  },
  {
    id: "fal-ai/stable-diffusion-v35-large",
    name: "Stable Diffusion 3.5 Large",
    description: "Stability AI's latest large diffusion model for high-quality image generation.",
    provider: "fal",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/stable-diffusion-v35-large",
  },
  // ============ Image-to-Image / Edit Models ============
  {
    id: "fal-ai/flux-pro/kontext/max",
    name: "FLUX Kontext Max",
    description: "Advanced image editing with FLUX Kontext. High-quality image-to-image transformation.",
    provider: "fal",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/flux-pro/kontext/max",
  },
  {
    id: "fal-ai/flux/dev/image-to-image",
    name: "FLUX.1 Dev Image-to-Image",
    description: "FLUX.1 Dev model adapted for image editing and transformation.",
    provider: "fal",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/flux/dev/image-to-image",
  },
  {
    id: "fal-ai/bria/product-shot",
    name: "Bria Product Shot",
    description: "Generate professional product photography with custom backgrounds.",
    provider: "fal",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/bria/product-shot",
  },
  // ============ Video Models ============
  // --- Veo 3.1 ---
  {
    id: "fal-ai/veo3.1",
    name: "Veo 3.1",
    description: "Google's most advanced video model. Up to 4K resolution with native audio and lip sync.",
    provider: "fal",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/veo3.1",
  },
  {
    id: "fal-ai/veo3.1/fast",
    name: "Veo 3.1 Fast",
    description: "Fast variant of Veo 3.1. 60-80% cheaper, optimized for speed and iteration.",
    provider: "fal",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/veo3.1/fast",
  },
  {
    id: "fal-ai/veo3.1/image-to-video",
    name: "Veo 3.1 Image-to-Video",
    description: "Animate images with Veo 3.1. High-quality image-to-video with native audio.",
    provider: "fal",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/veo3.1/image-to-video",
  },
  {
    id: "fal-ai/veo3.1/fast/image-to-video",
    name: "Veo 3.1 Fast Image-to-Video",
    description: "Fast image-to-video with Veo 3.1. Cost-effective animation from images.",
    provider: "fal",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/veo3.1/fast/image-to-video",
  },
  // --- Kling 3.0 ---
  {
    id: "fal-ai/kling-video/v3/standard/text-to-video",
    name: "Kling 3.0 Text-to-Video",
    description: "Kling 3.0 cinematic video generation with multi-shot storyboarding, element referencing, and native audio.",
    provider: "fal",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/kling-video/v3/standard/text-to-video",
  },
  {
    id: "fal-ai/kling-video/v3/standard/image-to-video",
    name: "Kling 3.0 Image-to-Video",
    description: "Kling 3.0 image-to-video with cinematic visuals, fluid motion, and native audio.",
    provider: "fal",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video",
  },
  // --- Kling 3.0 Omni (Edit) ---
  {
    id: "fal-ai/kling-video/o3/standard/text-to-video",
    name: "Kling 3.0 Omni Text-to-Video",
    description: "Kling O3 Omni with native audio, multi-shot, video element referencing, and voice control.",
    provider: "fal",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/kling-video/o3/standard/text-to-video",
  },
  {
    id: "fal-ai/kling-video/o3/standard/image-to-video",
    name: "Kling 3.0 Omni Image-to-Video",
    description: "Kling O3 Omni image-to-video with visual and audio capture, voice control for elements.",
    provider: "fal",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/kling-video/o3/standard/image-to-video",
  },
  // --- Older / Other ---
  {
    id: "fal-ai/kling-video/v2.1/standard/text-to-video",
    name: "Kling 2.1 Text-to-Video",
    description: "Kling 2.1 high-quality text-to-video generation.",
    provider: "fal",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/kling-video/v2.1/standard/text-to-video",
  },
  {
    id: "fal-ai/kling-video/v2.1/standard/image-to-video",
    name: "Kling 2.1 Image-to-Video",
    description: "Kling 2.1 image-to-video generation with high fidelity.",
    provider: "fal",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/kling-video/v2.1/standard/image-to-video",
  },
  {
    id: "fal-ai/minimax-video/video-01-live",
    name: "MiniMax Video 01 Live",
    description: "MiniMax live video generation. Fast, high-quality results.",
    provider: "fal",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/minimax-video/video-01-live",
  },
  {
    id: "fal-ai/hunyuan-video",
    name: "HunyuanVideo",
    description: "Tencent's high-quality video generation model.",
    provider: "fal",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/hunyuan-video",
  },
  // ============ 3D Models ============
  {
    id: "fal-ai/triposr",
    name: "TripoSR",
    description: "Fast single-image 3D mesh generation. Generate 3D models from a single photo.",
    provider: "fal",
    capabilities: ["image-to-3d"],
    coverImage: undefined,
    pageUrl: "https://fal.ai/models/fal-ai/triposr",
  },
];

/**
 * Get curated fal.ai models, optionally filtered by search query
 */
function getCuratedFalModels(searchQuery?: string): ProviderModel[] {
  if (!searchQuery) return FAL_CURATED_MODELS;
  return filterModelsBySearch(FAL_CURATED_MODELS, searchQuery);
}

// ============ Main Handler ============

export async function GET(
  request: NextRequest
): Promise<NextResponse<ModelsResponse>> {
  // Parse query params
  const providerFilter = request.nextUrl.searchParams.get("provider") as
    | ProviderType
    | null;
  const searchQuery = request.nextUrl.searchParams.get("search") || undefined;
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";
  const capabilitiesParam = request.nextUrl.searchParams.get("capabilities");
  const capabilitiesFilter: ModelCapability[] | null = capabilitiesParam
    ? (capabilitiesParam.split(",") as ModelCapability[])
    : null;

  // Get API keys from headers, falling back to env variables
  const replicateKey = request.headers.get("X-Replicate-Key") || process.env.REPLICATE_API_KEY || null;
  const falKey = request.headers.get("X-Fal-Key") || process.env.FAL_API_KEY || null;
  const kieKey = request.headers.get("X-Kie-Key") || process.env.KIE_API_KEY || null;
  const wavespeedKey = request.headers.get("X-WaveSpeed-Key") || process.env.WAVESPEED_API_KEY || null;

  // Determine which providers to fetch from (excluding gemini/kie - handled separately as hardcoded)
  const providersToFetch: ProviderType[] = [];
  let includeGemini = false;
  let includeKie = false;
  let includeFal = false;

  if (providerFilter) {
    if (providerFilter === "gemini") {
      // Only Gemini requested - no external API calls needed
      includeGemini = true;
    } else if (providerFilter === "kie") {
      // Only Kie requested - no external API calls needed (hardcoded models)
      includeKie = true;
    } else if (providerFilter === "wavespeed") {
      if (wavespeedKey) {
        // WaveSpeed requested with key - fetch from API
        providersToFetch.push("wavespeed");
      } else {
        // WaveSpeed requested but no key configured
        return NextResponse.json<ModelsErrorResponse>(
          {
            success: false,
            error:
              "WaveSpeed API key required. Add WAVESPEED_API_KEY to .env.local or configure in Settings.",
          },
          { status: 400 }
        );
      }
    } else if (providerFilter === "replicate" && replicateKey) {
      providersToFetch.push("replicate");
    } else if (providerFilter === "fal") {
      // Fal uses curated models — no API call needed, always available
      includeFal = true;
    }
  } else {
    // Include all providers that have keys configured
    includeGemini = true; // Gemini always available
    includeFal = true; // Fal curated models always available
    includeKie = kieKey ? true : false; // Kie only if API key is configured
    if (wavespeedKey) {
      providersToFetch.push("wavespeed"); // WaveSpeed if key is configured
    }
    if (replicateKey) {
      providersToFetch.push("replicate");
    }
  }

  // Gemini and Kie are always available (with key for Kie), so we don't fail if no external providers
  if (providersToFetch.length === 0 && !includeGemini && !includeKie && !includeFal) {
    return NextResponse.json<ModelsErrorResponse>(
      {
        success: false,
        error:
          "No providers available. Add REPLICATE_API_KEY, FAL_API_KEY, KIE_API_KEY, or WAVESPEED_API_KEY to .env.local or configure in Settings.",
      },
      { status: 400 }
    );
  }

  const allModels: ProviderModel[] = [];
  const providerResults: Record<string, ProviderResult> = {};
  const errors: string[] = [];
  let anyFromCache = false;
  let allFromCache = true;

  // Add Gemini models first if included (they appear at the top)
  if (includeGemini) {
    // Filter by search query if provided
    let geminiModels = GEMINI_MODELS;
    if (searchQuery) {
      geminiModels = filterModelsBySearch(geminiModels, searchQuery);
    }
    allModels.push(...geminiModels);
    providerResults["gemini"] = {
      success: true,
      count: geminiModels.length,
      cached: true, // Hardcoded models are effectively "cached"
    };
    anyFromCache = true;
  }

  // Add Kie models if included (hardcoded, no API call needed)
  if (includeKie) {
    // Filter by search query if provided
    let kieModels = KIE_MODELS;
    if (searchQuery) {
      kieModels = filterModelsBySearch(kieModels, searchQuery);
    }
    allModels.push(...kieModels);
    providerResults["kie"] = {
      success: true,
      count: kieModels.length,
      cached: true, // Hardcoded models are effectively "cached"
    };
    anyFromCache = true;
  }

  // Add curated fal.ai models if included (hardcoded, no API call needed)
  if (includeFal) {
    const falModels = getCuratedFalModels(searchQuery);
    allModels.push(...falModels);
    providerResults["fal"] = {
      success: true,
      count: falModels.length,
      cached: true,
    };
    anyFromCache = true;
  }

  // Fetch from each provider (replicate, fal, wavespeed)
  for (const provider of providersToFetch) {
    // For Replicate and WaveSpeed, always use base cache key since we filter client-side
    // For fal.ai, include search in cache key since their API supports search
    const cacheKey =
      provider === "replicate" || provider === "wavespeed"
        ? getCacheKey(provider)
        : getCacheKey(provider, searchQuery);
    let models: ProviderModel[] | null = null;
    let fromCache = false;

    // Check cache first (unless refresh=true)
    if (!refresh) {
      const cached = getCachedModels(cacheKey);
      if (cached) {
        models = cached;
        fromCache = true;
        anyFromCache = true;

        // For Replicate and WaveSpeed, apply client-side search filtering on cached models
        if ((provider === "replicate" || provider === "wavespeed") && searchQuery) {
          models = filterModelsBySearch(models, searchQuery);
        }
      }
    }

    // Fetch from API if cache miss
    if (!models) {
      allFromCache = false;
      try {
        if (provider === "replicate") {
          // Fetch all models (no search param - we filter client-side)
          const allReplicateModels = await fetchReplicateModels(replicateKey!);
          // Cache the full list
          setCachedModels(cacheKey, allReplicateModels);
          // Apply search filter if needed
          models = searchQuery
            ? filterModelsBySearch(allReplicateModels, searchQuery)
            : allReplicateModels;
        } else if (provider === "fal") {
          // Use curated model list (no API call needed)
          const curatedModels = getCuratedFalModels(searchQuery);
          models = curatedModels;
          setCachedModels(cacheKey, curatedModels);
        } else if (provider === "wavespeed") {
          // Fetch all models from WaveSpeed API
          const allWaveSpeedModels = await fetchWaveSpeedModels(wavespeedKey!);
          // Cache the full list
          setCachedModels(cacheKey, allWaveSpeedModels);
          // Apply search filter if needed (client-side filtering like Replicate)
          models = searchQuery
            ? filterModelsBySearch(allWaveSpeedModels, searchQuery)
            : allWaveSpeedModels;
        } else {
          models = [];
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`[Models] ${provider}: ${errorMessage}`);
        errors.push(`${provider}: ${errorMessage}`);
        providerResults[provider] = {
          success: false,
          count: 0,
          error: errorMessage,
        };
        continue;
      }
    }

    // Add to results
    allModels.push(...models);
    providerResults[provider] = {
      success: true,
      count: models.length,
      cached: fromCache,
    };
  }

  // Check if we got any models
  if (allModels.length === 0 && errors.length === providersToFetch.length) {
    // All providers failed
    return NextResponse.json<ModelsErrorResponse>(
      {
        success: false,
        error: `All providers failed: ${errors.join("; ")}`,
      },
      { status: 500 }
    );
  }

  // Filter by capabilities if specified
  let filteredModels = allModels;
  if (capabilitiesFilter && capabilitiesFilter.length > 0) {
    filteredModels = allModels.filter((model) =>
      model.capabilities.some((cap) => capabilitiesFilter.includes(cap))
    );
  }

  // Sort models by provider, then by name
  filteredModels.sort((a, b) => {
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider);
    }
    return a.name.localeCompare(b.name);
  });

  const response: ModelsSuccessResponse = {
    success: true,
    models: filteredModels,
    cached: anyFromCache && allFromCache,
    providers: providerResults,
  };

  if (errors.length > 0) {
    response.errors = errors;
  }

  return NextResponse.json<ModelsSuccessResponse>(response);
}
