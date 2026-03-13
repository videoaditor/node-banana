"use client";

import { useState, useCallback, useRef, DragEvent } from "react";
import { WorkflowFile } from "@/store/workflowStore";
import { QuickstartBackButton } from "./QuickstartBackButton";

interface PromptWorkflowViewProps {
  onBack: () => void;
  onWorkflowGenerated: (workflow: WorkflowFile) => void;
}

/**
 * Convert a File to a base64 data URL
 */
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PromptWorkflowView({
  onBack,
  onWorkflowGenerated,
}: PromptWorkflowViewProps) {
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshotImage, setScreenshotImage] = useState<string | null>(null);
  const [screenshotFilename, setScreenshotFilename] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, WebP, etc.)");
      return;
    }
    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB");
      return;
    }
    try {
      const dataUrl = await fileToDataURL(file);
      setScreenshotImage(dataUrl);
      setScreenshotFilename(file.name);
      setError(null);
    } catch {
      setError("Failed to read image file");
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleImageFile(file);
        return;
      }
    }
  }, [handleImageFile]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  const handleGenerate = useCallback(async () => {
    if (!description || description.trim().length < 3) {
      setError("Please describe your workflow (at least 3 characters)");
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/quickstart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          contentLevel: "full",
          ...(screenshotImage ? { screenshotImage } : {}),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to generate workflow");
      }

      if (result.workflow) {
        onWorkflowGenerated(result.workflow);
      }
    } catch (err) {
      console.error("Prompt workflow error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate workflow"
      );
    } finally {
      setIsGenerating(false);
    }
  }, [description, screenshotImage, onWorkflowGenerated]);

  const canGenerate = description.trim().length >= 3 && !isGenerating;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center gap-4">
        <QuickstartBackButton onClick={onBack} disabled={isGenerating} />
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Prompt a Workflow
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Description Input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            Describe your workflow
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setError(null);
            }}
            placeholder="e.g., Create product photography with consistent lighting and style from reference images..."
            disabled={isGenerating}
            rows={5}
            className={`
              w-full px-4 py-3 rounded-lg border bg-[var(--bg-base)]/50 text-sm text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)] resize-none
              focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)]/50
              ${isGenerating ? "opacity-50 cursor-not-allowed" : ""}
              border-[var(--border-subtle)] hover:border-[var(--border-subtle)]
            `}
          />
          <p className="text-xs text-[var(--text-secondary)]">
            Describe what you want your workflow to accomplish. Be specific
            about inputs, outputs, and any transformations.
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Note: This feature currently only works with Gemini models.
          </p>
        </div>

        {/* Screenshot Upload */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            Reference screenshot{" "}
            <span className="text-[var(--text-muted)]">(optional)</span>
          </label>
          {screenshotImage ? (
            <div className="relative group rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]/50 p-3">
              <div className="flex items-center gap-3">
                <img
                  src={screenshotImage}
                  alt="Screenshot"
                  className="w-20 h-20 object-cover rounded border border-[var(--border-subtle)]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)] truncate">
                    {screenshotFilename || "Pasted image"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    The AI will analyze this image to help design your workflow
                  </p>
                </div>
                <button
                  onClick={() => {
                    setScreenshotImage(null);
                    setScreenshotFilename(null);
                  }}
                  disabled={isGenerating}
                  className="p-1.5 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  title="Remove screenshot"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onPaste={handlePaste}
              onClick={() => !isGenerating && fileInputRef.current?.click()}
              className={`
                flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-lg border-2 border-dashed cursor-pointer transition-all
                ${isDragging
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5"
                  : "border-[var(--border-subtle)] hover:border-[var(--text-muted)] bg-[var(--bg-base)]/30"
                }
                ${isGenerating ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
              <p className="text-xs text-[var(--text-muted)] text-center">
                Drop a screenshot, paste from clipboard, or click to browse
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--node-error)]/10 border border-[var(--node-error)]/30">
            <svg
              className="w-4 h-4 text-[var(--node-error)] mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-[var(--node-error)]">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-[var(--node-error)]/70 hover:text-[var(--node-error)] mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex justify-end bg-[var(--bg-elevated)]/50">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={`
            flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all
            ${
              canGenerate
                ? "bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)] shadow-lg shadow-blue-500/20"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] cursor-not-allowed"
            }
          `}
        >
          {isGenerating ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
              <span>Generate Workflow</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
