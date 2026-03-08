/**
 * Generate API Route
 * 
 * TIMEOUT CONFIGURATION:
 * - maxDuration: Only applies on Vercel, not locally
 * - AbortSignal.timeout: Controls outgoing fetch to providers
 * - For local development, server.requestTimeout must be set in server.js (Node.js default is 5 minutes)
 * 
 * FAL.AI QUEUE API NOTE:
 * Uses generateWithFalQueue with async queue submission + polling.
 * Images are uploaded to fal CDN before submission to avoid payload size issues.
 */
import { NextRequest, NextResponse } from "next/server";
import { GenerateRequest, GenerateResponse, ModelType, SelectedModel, ProviderType } from "@/types";
import { GenerationInput } from "@/lib/providers/types";
import { generateWithGemini } from "./providers/gemini";
import { generateWithReplicate } from "./providers/replicate";
import { clearFalInputMappingCache as _clearFalInputMappingCache, generateWithFalQueue } from "./providers/fal";
import { generateWithKie } from "./providers/kie";
import { generateWithWaveSpeed } from "./providers/wavespeed";

// Re-export for backward compatibility (test file imports from route)
export const clearFalInputMappingCache = _clearFalInputMappingCache;

export const maxDuration = 300; // 5 minute timeout (Vercel hobby plan limit)
export const dynamic = 'force-dynamic'; // Ensure this route is always dynamic


/**
 * Extended request format that supports both legacy and multi-provider requests
 */
interface MultiProviderGenerateRequest extends GenerateRequest {
  selectedModel?: SelectedModel;
  parameters?: Record<string, unknown>;
  /** Dynamic inputs from schema-based connections (e.g., image_url, tail_image_url, prompt) */
  dynamicInputs?: Record<string, string | string[]>;
}


export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`\n[API:${requestId}] ========== NEW GENERATE REQUEST ==========`);

  try {
    const body: MultiProviderGenerateRequest = await request.json();
    const {
      images,
      prompt,
      model = "nano-banana-2",
      aspectRatio,
      resolution,
      useGoogleSearch,
      selectedModel,
      parameters,
      dynamicInputs,
      mediaType,
    } = body;

    // Prompt is required unless:
    // - Provided via dynamicInputs
    // - Images are provided (image-to-video/image-to-image models)
    // - Dynamic inputs contain image frames (first_frame, last_frame, etc.)
    const hasPrompt = prompt || (dynamicInputs && (
      typeof dynamicInputs.prompt === 'string'
        ? dynamicInputs.prompt
        : Array.isArray(dynamicInputs.prompt) && dynamicInputs.prompt.length > 0
    ));
    const hasImages = (images && images.length > 0);
    const hasImageInputs = dynamicInputs && Object.keys(dynamicInputs).some(key =>
      key.includes('frame') || key.includes('image')
    );

    if (!hasPrompt && !hasImages && !hasImageInputs) {
      return NextResponse.json<GenerateResponse>(
        {
          success: false,
          error: "Prompt or image input is required",
        },
        { status: 400 }
      );
    }

    // Determine which provider to use
    let provider: ProviderType = selectedModel?.provider || "gemini";
    let actualModelId = selectedModel?.modelId || model;

    // Comprehensive Gemini model ID whitelist — these model IDs MUST always go to Gemini,
    // regardless of what provider was saved in the workflow node.
    // This handles backward compatibility when nodes were saved with provider="kie" or "fal".
    const GEMINI_MODEL_IDS = new Set([
      "nano-banana",
      "nano-banana-2",
      "nano-banana-pro",
      "veo-2.0-generate-video-001",
      "veo-3.1-fast-generate-001",
      // Underlying Gemini API model IDs (in case selectedModel.modelId was set directly)
      "gemini-2.5-flash-image",
      "gemini-2.5-flash-preview-image-generation",
      "gemini-3-pro-image-preview",
      "gemini-3.1-flash-image-preview",
      "nano-banana-pro-preview",
      "gemini-2.0-flash-exp-image-generation",
    ]);

    if (GEMINI_MODEL_IDS.has(actualModelId) && provider !== "gemini") {
      console.log(`[API:${requestId}] Rerouting model "${actualModelId}" from "${provider}" → "gemini" (provider mismatch corrected).`);
      provider = "gemini";
    }

    console.log(`[API:${requestId}] Provider: ${provider}, Model: ${actualModelId}`);


    // Route to appropriate provider
    if (provider === "replicate") {
      // User-provided key takes precedence over env variable
      const replicateApiKey = request.headers.get("X-Replicate-API-Key") || process.env.REPLICATE_API_KEY;
      if (!replicateApiKey) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: "Replicate API key not configured. Add REPLICATE_API_KEY to .env.local or configure in Settings.",
          },
          { status: 401 }
        );
      }

      // Keep Data URIs as-is since localhost URLs won't work (provider can't reach them)
      const processedImages: string[] = images ? [...images] : [];

      // Process dynamicInputs: filter empty values, keep Data URIs
      let processedDynamicInputs: Record<string, string | string[]> | undefined = undefined;

      if (dynamicInputs) {
        processedDynamicInputs = {};
        for (const key of Object.keys(dynamicInputs)) {
          const value = dynamicInputs[key];

          // Skip empty/null/undefined values (arrays pass through)
          if (value === null || value === undefined || value === '') {
            continue;
          }

          // Keep the value as-is (Data URIs work with Replicate)
          processedDynamicInputs[key] = value;
        }
      }

      // Build generation input
      const genInput: GenerationInput = {
        model: {
          id: selectedModel!.modelId,
          name: selectedModel!.displayName,
          provider: "replicate",
          capabilities: mediaType === "video" ? ["text-to-video"] : mediaType === "3d" ? ["text-to-3d"] : ["text-to-image"],
          description: null,
        },
        prompt: prompt || "",
        images: processedImages,
        parameters,
        dynamicInputs: processedDynamicInputs,
      };

      const result = await generateWithReplicate(requestId, replicateApiKey, genInput);

      if (!result.success) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: result.error || "Generation failed",
          },
          { status: 500 }
        );
      }

      // Return first output (image or video)
      const output = result.outputs?.[0];
      if (!output?.data && !output?.url) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: "No output in generation result",
          },
          { status: 500 }
        );
      }

      // Return appropriate fields based on output type
      if (output.type === "3d") {
        return NextResponse.json<GenerateResponse>({
          success: true,
          model3dUrl: output.url,
          contentType: "3d",
        });
      }

      if (output.type === "video") {
        // Large videos have data="" with url set; normal videos have base64 data
        const isLargeVideo = !output.data && output.url;
        return NextResponse.json<GenerateResponse>({
          success: true,
          video: isLargeVideo ? undefined : output.data,
          videoUrl: isLargeVideo ? output.url : undefined,
          contentType: "video",
        });
      }

      return NextResponse.json<GenerateResponse>({
        success: true,
        image: output.data,
        contentType: "image",
      });
    }

    if (provider === "fal") {
      // User-provided key takes precedence over env variable
      const falApiKey = request.headers.get("X-Fal-API-Key") || process.env.FAL_API_KEY || null;

      if (!falApiKey) {
        console.warn(`[API:${requestId}] No FAL API key configured. Proceeding without auth (rate-limited).`);
      }

      // Pass images as-is; generateWithFalQueue uploads base64 to CDN internally
      const processedImages: string[] = images ? [...images] : [];

      // Process dynamicInputs: filter empty values
      let processedDynamicInputs: Record<string, string | string[]> | undefined = undefined;

      if (dynamicInputs) {
        processedDynamicInputs = {};
        for (const key of Object.keys(dynamicInputs)) {
          const value = dynamicInputs[key];

          // Skip empty/null/undefined values (arrays pass through)
          if (value === null || value === undefined || value === '') {
            continue;
          }

          // Keep the value as-is; CDN upload happens in generateWithFalQueue
          processedDynamicInputs[key] = value;
        }
      }

      // Build generation input
      const genInput: GenerationInput = {
        model: {
          id: selectedModel!.modelId,
          name: selectedModel!.displayName,
          provider: "fal",
          capabilities: mediaType === "video" ? ["text-to-video"] : mediaType === "3d" ? ["text-to-3d"] : ["text-to-image"],
          description: null,
        },
        prompt: prompt || "",
        images: processedImages,
        parameters,
        dynamicInputs: processedDynamicInputs,
      };

      const result = await generateWithFalQueue(requestId, falApiKey, genInput);

      if (!result.success) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: result.error || "Generation failed",
          },
          { status: 500 }
        );
      }

      // Return first output (image or video)
      const output = result.outputs?.[0];
      if (!output?.data && !output?.url) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: "No output in generation result",
          },
          { status: 500 }
        );
      }

      // Return appropriate fields based on output type
      if (output.type === "3d") {
        return NextResponse.json<GenerateResponse>({
          success: true,
          model3dUrl: output.url,
          contentType: "3d",
        });
      }

      if (output.type === "video") {
        // Large videos have data="" with url set; normal videos have base64 data
        const isLargeVideo = !output.data && output.url;
        return NextResponse.json<GenerateResponse>({
          success: true,
          video: isLargeVideo ? undefined : output.data,
          videoUrl: isLargeVideo ? output.url : undefined,
          contentType: "video",
        });
      }

      return NextResponse.json<GenerateResponse>({
        success: true,
        image: output.data,
        contentType: "image",
      });
    }

    if (provider === "kie") {
      // User-provided key takes precedence over env variable
      const kieApiKey = request.headers.get("X-Kie-Key") || process.env.KIE_API_KEY;
      if (!kieApiKey) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: "Kie.ai API key not configured. Add KIE_API_KEY to .env.local or configure in Settings.",
          },
          { status: 401 }
        );
      }

      // Process images - Kie requires URLs, we'll upload base64 images in generateWithKie
      const processedImages: string[] = images ? [...images] : [];

      // Process dynamicInputs: filter empty values
      let processedDynamicInputs: Record<string, string | string[]> | undefined = undefined;

      if (dynamicInputs) {
        processedDynamicInputs = {};
        for (const key of Object.keys(dynamicInputs)) {
          const value = dynamicInputs[key];

          // Skip empty/null/undefined values
          if (value === null || value === undefined || value === '') {
            continue;
          }

          processedDynamicInputs[key] = value;
        }
      }

      // Build generation input
      const genInput: GenerationInput = {
        model: {
          id: selectedModel!.modelId,
          name: selectedModel!.displayName,
          provider: "kie",
          capabilities: mediaType === "video" ? ["text-to-video"] : mediaType === "3d" ? ["text-to-3d"] : ["text-to-image"],
          description: null,
        },
        prompt: prompt || "",
        images: processedImages,
        parameters,
        dynamicInputs: processedDynamicInputs,
      };

      const result = await generateWithKie(requestId, kieApiKey, genInput);

      if (!result.success) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: result.error || "Generation failed",
          },
          { status: 500 }
        );
      }

      // Return first output (image or video)
      const output = result.outputs?.[0];
      if (!output?.data && !output?.url) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: "No output in generation result",
          },
          { status: 500 }
        );
      }

      // Return appropriate fields based on output type
      if (output.type === "3d") {
        return NextResponse.json<GenerateResponse>({
          success: true,
          model3dUrl: output.url,
          contentType: "3d",
        });
      }

      if (output.type === "video") {
        // Large videos have data="" with url set; normal videos have base64 data
        const isLargeVideo = !output.data && output.url;
        return NextResponse.json<GenerateResponse>({
          success: true,
          video: isLargeVideo ? undefined : output.data,
          videoUrl: isLargeVideo ? output.url : undefined,
          contentType: "video",
        });
      }

      return NextResponse.json<GenerateResponse>({
        success: true,
        image: output.data,
        contentType: "image",
      });
    }

    if (provider === "wavespeed") {
      // User-provided key takes precedence over env variable
      const wavespeedApiKey = request.headers.get("X-WaveSpeed-Key") || process.env.WAVESPEED_API_KEY;
      if (!wavespeedApiKey) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: "WaveSpeed API key not configured. Add WAVESPEED_API_KEY to .env.local or configure in Settings.",
          },
          { status: 401 }
        );
      }

      // Keep Data URIs as-is since localhost URLs won't work
      const processedImages: string[] = images ? [...images] : [];

      // Process dynamicInputs: filter empty values
      let processedDynamicInputs: Record<string, string | string[]> | undefined = undefined;

      if (dynamicInputs) {
        processedDynamicInputs = {};
        for (const key of Object.keys(dynamicInputs)) {
          const value = dynamicInputs[key];

          // Skip empty/null/undefined values
          if (value === null || value === undefined || value === '') {
            continue;
          }

          processedDynamicInputs[key] = value;
        }
      }

      // Build generation input
      const genInput: GenerationInput = {
        model: {
          id: selectedModel!.modelId,
          name: selectedModel!.displayName,
          provider: "wavespeed",
          capabilities: mediaType === "video" ? ["text-to-video"] : mediaType === "3d" ? ["text-to-3d"] : ["text-to-image"],
          description: null,
        },
        prompt: prompt || "",
        images: processedImages,
        parameters,
        dynamicInputs: processedDynamicInputs,
      };

      const result = await generateWithWaveSpeed(requestId, wavespeedApiKey, genInput);

      if (!result.success) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: result.error || "Generation failed",
          },
          { status: 500 }
        );
      }

      // Return first output (image or video)
      const output = result.outputs?.[0];
      if (!output?.data && !output?.url) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: "No output in generation result",
          },
          { status: 500 }
        );
      }

      // Return appropriate fields based on output type
      if (output.type === "3d") {
        return NextResponse.json<GenerateResponse>({
          success: true,
          model3dUrl: output.url,
          contentType: "3d",
        });
      }

      if (output.type === "video") {
        // Large videos have data="" with url set; normal videos have base64 data
        const isLargeVideo = !output.data && output.url;
        return NextResponse.json<GenerateResponse>({
          success: true,
          video: isLargeVideo ? undefined : output.data,
          videoUrl: isLargeVideo ? output.url : undefined,
          contentType: "video",
        });
      }

      return NextResponse.json<GenerateResponse>({
        success: true,
        image: output.data,
        contentType: "image",
      });
    }

    // Default: Use Gemini
    // User-provided key (from settings) takes precedence, but fall back to env key on auth error.
    const userGeminiKey = request.headers.get("X-Gemini-API-Key") || null;
    const envGeminiKey = process.env.GEMINI_API_KEY || null;
    const geminiApiKey = userGeminiKey || envGeminiKey;

    if (!geminiApiKey) {
      return NextResponse.json<GenerateResponse>(
        {
          success: false,
          error: "API key not configured. Add GEMINI_API_KEY to .env.local or configure in Settings.",
        },
        { status: 500 }
      );
    }

    // Use selectedModel.modelId if available (new format), fallback to legacy model field
    const geminiModel = (selectedModel?.modelId as ModelType) || model;

    const geminiResult = await generateWithGemini(
      requestId,
      geminiApiKey,
      prompt,
      images || [],
      geminiModel,
      aspectRatio,
      resolution,
      useGoogleSearch
    );

    // If user key caused auth error, retry transparently with env key
    if (userGeminiKey && envGeminiKey && userGeminiKey !== envGeminiKey) {
      const cloned = geminiResult.clone();
      const body = await cloned.json() as GenerateResponse;
      if (!body.success && body.error && /expired|invalid.*key|api.*key|INVALID_ARGUMENT/i.test(body.error)) {
        console.log(`[API:${requestId}] User Gemini key auth error, retrying with env key`);
        return await generateWithGemini(requestId, envGeminiKey, prompt, images || [], geminiModel, aspectRatio, resolution, useGoogleSearch);
      }
    }

    return geminiResult;
  } catch (error) {
    // Extract error information
    let errorMessage = "Generation failed";
    let errorDetails = "";

    if (error instanceof Error) {
      errorMessage = error.message;
      if ("cause" in error && error.cause) {
        errorDetails = JSON.stringify(error.cause);
      }
    }

    // Strip HTML error pages (e.g. Cloudflare 524 timeout pages)
    if (errorMessage.includes("<!DOCTYPE") || errorMessage.includes("<html")) {
      errorMessage = "Request timed out — the provider took too long to respond. Try again or use a different model.";
      errorDetails = "";
    }

    // Try to extract more details from API errors
    if (error && typeof error === "object") {
      const apiError = error as Record<string, unknown>;
      if (apiError.status) {
        errorDetails += ` Status: ${apiError.status}`;
      }
      if (apiError.statusText) {
        errorDetails += ` ${apiError.statusText}`;
      }
    }

    // Handle rate limiting
    if (errorMessage.includes("429")) {
      return NextResponse.json<GenerateResponse>(
        {
          success: false,
          error: "Rate limit reached. Please wait and try again.",
        },
        { status: 429 }
      );
    }

    console.error(`[API:${requestId}] Generation error: ${errorMessage}${errorDetails ? ` (${errorDetails.substring(0, 200)})` : ""}`);
    return NextResponse.json<GenerateResponse>(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
