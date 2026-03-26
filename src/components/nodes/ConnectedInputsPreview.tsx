"use client";

import React from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import { useUpstreamText, useUpstreamImages } from "@/hooks/useUpstreamData";
import { useShallow } from "zustand/shallow";

interface ConnectedInputsPreviewProps {
  nodeId: string;
  /** Show text preview (default: true) */
  showText?: boolean;
  /** Show image preview (default: true) */
  showImages?: boolean;
  /** Text input is required — shows warning when missing (default: false) */
  requireText?: boolean;
  /** Image input is required — shows warning when missing (default: false) */
  requireImages?: boolean;
  /** Max chars for text preview (default: 150) */
  maxTextLength?: number;
  /** Max image thumbnails shown (default: 6) */
  maxThumbnails?: number;
  /** Custom label for text (default: "Prompt") */
  textLabel?: string;
}

/**
 * Shared component that shows live-updating previews of connected inputs.
 * Drop this into any node to see what text and images are connected.
 *
 * When requireText/requireImages is set, shows a warning hint when
 * the required input is missing — visible BEFORE the user clicks Run.
 */
export function ConnectedInputsPreview({
  nodeId,
  showText = true,
  showImages = true,
  requireText = false,
  requireImages = false,
  maxTextLength = 150,
  maxThumbnails = 6,
  textLabel = "Prompt",
}: ConnectedInputsPreviewProps) {
  // Check which handles have edges connected
  const { hasTextEdge, hasImageEdge } = useWorkflowStore(
    useShallow((state) => {
      let hasText = false;
      let hasImage = false;
      for (const e of state.edges) {
        if (e.target !== nodeId) continue;
        if (e.targetHandle === "text" || e.targetHandle?.startsWith("text")) hasText = true;
        if (e.targetHandle === "image" || e.targetHandle?.startsWith("image")) hasImage = true;
      }
      return { hasTextEdge: hasText, hasImageEdge: hasImage };
    })
  );

  const upstreamText = showText ? useUpstreamText(nodeId) : null;
  const upstreamImages = showImages ? useUpstreamImages(nodeId) : [];

  const hasContent = upstreamText || upstreamImages.length > 0;
  const needsTextWarning = requireText && !hasTextEdge;
  const needsImageWarning = requireImages && !hasImageEdge;
  const hasTextEdgeButEmpty = hasTextEdge && !upstreamText;

  // Nothing to show and no warnings needed
  if (!hasContent && !needsTextWarning && !needsImageWarning && !hasTextEdgeButEmpty) return null;

  return (
    <div className="space-y-1.5">
      {/* Missing required input warnings */}
      {needsTextWarning && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-amber-500/10 border border-amber-500/20">
          <svg className="w-3 h-3 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span className="text-[10px] text-amber-400">No prompt connected</span>
        </div>
      )}
      {needsImageWarning && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-amber-500/10 border border-amber-500/20">
          <svg className="w-3 h-3 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span className="text-[10px] text-amber-400">No image connected</span>
        </div>
      )}

      {/* Connected but upstream hasn't produced data yet */}
      {hasTextEdgeButEmpty && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[var(--bg-base)]/50 border border-[var(--border-subtle)]">
          <svg className="w-3 h-3 text-[var(--text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] text-[var(--text-muted)]">Waiting for upstream text…</span>
        </div>
      )}

      {/* Filled inputs preview */}
      {hasContent && (
        <div className="border border-[var(--border-subtle)] rounded bg-[var(--bg-base)]/30 p-2 space-y-1.5">
          {/* Text preview */}
          {upstreamText && (
            <div>
              <div className="text-[9px] font-medium text-blue-400 mb-0.5 flex items-center gap-1">
                <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                {textLabel}
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-base)] rounded px-1.5 py-1 max-h-16 overflow-y-auto leading-tight">
                {upstreamText.length > maxTextLength
                  ? upstreamText.substring(0, maxTextLength) + "…"
                  : upstreamText}
              </div>
            </div>
          )}

          {/* Image thumbnails */}
          {upstreamImages.length > 0 && (
            <div>
              <div className="text-[9px] font-medium text-green-400 mb-0.5 flex items-center gap-1">
                <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
                {upstreamImages.length} image{upstreamImages.length !== 1 ? "s" : ""} connected
              </div>
              <div className="flex gap-1 flex-wrap">
                {upstreamImages.slice(0, maxThumbnails).map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`Input ${i + 1}`}
                    className="w-8 h-8 object-cover rounded border border-[var(--border-subtle)]"
                  />
                ))}
                {upstreamImages.length > maxThumbnails && (
                  <div className="w-8 h-8 rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] flex items-center justify-center text-[8px] text-[var(--text-muted)]">
                    +{upstreamImages.length - maxThumbnails}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
