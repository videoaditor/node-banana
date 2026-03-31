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
      const replicateApiKey = process.env.REPLICATE_API_KEY;
      if (!replicateApiKey) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: "Replicate API key not configured on server.",
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
      const falApiKey = process.env.FAL_API_KEY || null;

      if (!falApiKey) {
        console.warn(`[API:${requestId}] No FAL API key configured on server. Proceeding without auth (rate-limited).`);
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
      const kieApiKey = process.env.KIE_API_KEY;
      if (!kieApiKey) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: "Kie.ai API key not configured on server.",
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
      const wavespeedApiKey = process.env.WAVESPEED_API_KEY;
      if (!wavespeedApiKey) {
        return NextResponse.json<GenerateResponse>(
          {
            success: false,
            error: "WaveSpeed API key not configured on server.",
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
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return NextResponse.json<GenerateResponse>(
        {
          success: false,
          error: "Gemini API key not configured on server.",
        },
        { status: 500 }
      );
    }

    // Use selectedModel.modelId if available (new format), fallback to legacy model field
    const geminiModel = (selectedModel?.modelId as ModelType) || model;

    // Helper: check if an error is a transient Gemini failure (503, overloaded, rate limit)
    const isTransientGeminiError = (err: string) =>
      /503|UNAVAILABLE|overloaded|high demand|capacity|temporarily|RESOURCE_EXHAUSTED/i.test(err);

    // Helper: attempt fal.ai fallback for image generation
    const tryFalFallback = async (fallbackPrompt: string, fallbackImages: string[]): Promise<NextResponse<GenerateResponse> | null> => {
      const falApiKey = process.env.FAL_API_KEY || null;
      if (!falApiKey) {
        console.log(`[API:${requestId}] No FAL_API_KEY configured, cannot fallback`);
        return null;
      }

      // Only fallback for image generation, not video/3d
      if (mediaType === "video" || mediaType === "3d") {
        console.log(`[API:${requestId}] Skipping fal.ai fallback for ${mediaType} (image-only)`);
        return null;
      }

      console.log(`[API:${requestId}] ⚡ Gemini overloaded — falling back to fal.ai (flux-schnell)`);

      try {
        const genInput: GenerationInput = {
          model: {
            id: "fal-ai/flux/schnell",
            name: "Flux Schnell (fallback)",
            provider: "fal",
            capabilities: ["text-to-image"],
            description: null,
          },
          prompt: fallbackPrompt || "",
          images: fallbackImages,
          parameters: {
            image_size: aspectRatio === "16:9" ? "landscape_16_9"
              : aspectRatio === "9:16" ? "portrait_16_9"
              : aspectRatio === "4:3" ? "landscape_4_3"
              : aspectRatio === "3:4" ? "portrait_4_3"
              : "square",
            num_images: 1,
          },
        };

        const result = await generateWithFalQueue(requestId, falApiKey, genInput);

        if (!result.success) {
          console.log(`[API:${requestId}] fal.ai fallback also failed: ${result.error}`);
          return null;
        }

        const output = result.outputs?.[0];
        if (!output?.data) {
          console.log(`[API:${requestId}] fal.ai fallback returned no output`);
          return null;
        }

        console.log(`[API:${requestId}] ✅ fal.ai fallback succeeded`);
        return NextResponse.json<GenerateResponse>({
          success: true,
          image: output.data,
          contentType: "image",
        });
      } catch (falErr) {
        console.error(`[API:${requestId}] fal.ai fallback error:`, falErr);
        return null;
      }
    };

    // Merge dynamicInputs.prompt into the prompt for Gemini
    // (other providers receive dynamicInputs via GenerationInput, but Gemini uses a direct prompt string)
    let geminiPrompt = prompt || "";
    if (dynamicInputs?.prompt) {
      const diPrompt = Array.isArray(dynamicInputs.prompt)
        ? dynamicInputs.prompt.join("\n")
        : dynamicInputs.prompt;
      geminiPrompt = geminiPrompt ? `${geminiPrompt}\n${diPrompt}` : diPrompt;
    }

    // Try Gemini (with fal.ai fallback on transient errors)
    try {
      const geminiResult = await generateWithGemini(
        requestId,
        geminiApiKey,
        geminiPrompt,
        images || [],
        geminiModel,
        aspectRatio,
        resolution,
        useGoogleSearch
      );

      // Check response for transient errors
      const cloned = geminiResult.clone();
      const body = await cloned.json() as GenerateResponse;
      if (!body.success && body.error && isTransientGeminiError(body.error)) {
        const falResult = await tryFalFallback(prompt || "", images || []);
        if (falResult) return falResult;
      }

      return geminiResult;
    } catch (geminiErr) {
      // Gemini threw an exception (e.g. 503 from SDK) — try fal.ai fallback
      const errMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      if (isTransientGeminiError(errMsg)) {
        const falResult = await tryFalFallback(prompt || "", images || []);
        if (falResult) return falResult;
      }
      // Re-throw to be caught by outer catch
      throw geminiErr;
    }
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
