"use client";

import React from "react";
import { useUpstreamText, useUpstreamImages } from "@/hooks/useUpstreamData";

interface ConnectedInputsPreviewProps {
  nodeId: string;
  /** Show text preview (default: true) */
  showText?: boolean;
  /** Show image preview (default: true) */
  showImages?: boolean;
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
 * Subscribes reactively via useUpstreamText/useUpstreamImages hooks —
 * updates live as the user types in upstream prompt nodes.
 */
export function ConnectedInputsPreview({
  nodeId,
  showText = true,
  showImages = true,
  maxTextLength = 150,
  maxThumbnails = 6,
  textLabel = "Prompt",
}: ConnectedInputsPreviewProps) {
  const upstreamText = showText ? useUpstreamText(nodeId) : null;
  const upstreamImages = showImages ? useUpstreamImages(nodeId) : [];

  if (!upstreamText && upstreamImages.length === 0) return null;

  return (
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
  );
}
