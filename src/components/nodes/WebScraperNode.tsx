"use client";

import React, { useCallback, useState, useMemo } from "react";
import { Handle, Position, NodeProps, Node, useEdges, useNodes } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { WebScraperNodeData, PromptNodeData, PromptConstructorNodeData, LLMGenerateNodeData } from "@/types";

type WebScraperNodeType = Node<WebScraperNodeData, "webScraper">;

export function WebScraperNode({ id, data, selected }: NodeProps<WebScraperNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const [isScraping, setIsScraping] = useState(false);

  // Resolve URL from connected text input (upstream Prompt/LLM/etc.)
  const edges = useEdges();
  const nodes = useNodes();
  const connectedUrl = useMemo(() => {
    const incomingEdge = edges.find(e => e.target === id && (e.targetHandle === "text" || !e.targetHandle));
    if (!incomingEdge) return null;
    const sourceNode = nodes.find(n => n.id === incomingEdge.source);
    if (!sourceNode) return null;
    const d = sourceNode.data as Record<string, unknown>;
    const text = (d.outputText as string) ?? (d.prompt as string) ?? null;
    return text?.trim() || null;
  }, [id, edges, nodes]);

  // Effective URL: connected input takes priority
  const effectiveUrl = connectedUrl || nodeData.url;

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { url: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleMaxImagesChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { maxImages: parseInt(e.target.value, 10) });
    },
    [id, updateNodeData]
  );

  const handleScrape = useCallback(async () => {
    const urlToScrape = connectedUrl || nodeData.url;
    if (!urlToScrape) return;

    // Normalize: add https:// if missing
    const normalizedUrl = urlToScrape.startsWith("http") ? urlToScrape : `https://${urlToScrape}`;

    setIsScraping(true);
    updateNodeData(id, {
      status: "loading",
      error: null,
      outputImage: null,
      outputImages: [],
      outputText: null,
      pageTitle: null,
      imageCount: 0,
    });

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: normalizedUrl,
          maxImages: nodeData.maxImages || 4,
          minImageSize: nodeData.minImageSize || 100,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to scrape URL");
      }

      const result = await response.json();

      updateNodeData(id, {
        status: "complete",
        outputImage: result.images?.[0] || null,
        outputImages: result.images || [],
        outputText: result.text || null,
        pageTitle: result.pageTitle || null,
        imageCount: result.imageCount || 0,
      });
    } catch (error) {
      updateNodeData(id, {
        status: "error",
        error: error instanceof Error ? error.message : "Scraping failed",
      });
    } finally {
      setIsScraping(false);
    }
  }, [id, connectedUrl, nodeData.url, nodeData.maxImages, nodeData.minImageSize, updateNodeData]);

  const hasImages = nodeData.outputImages && nodeData.outputImages.length > 0;
  const hasText = !!nodeData.outputText;

  return (
    <BaseNode
      id={id}
      selected={selected}
      title="Web Scraper"
      className="bg-[var(--bg-elevated)] border-[var(--border-subtle)]"
    >
      {/* Input handle for URL from upstream (e.g. text node) */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{ background: "#3b82f6", top: "50%" }}
        title="URL input"
      />

      {/* Dual output handles — always visible */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        style={{ background: "#22c55e", top: "38%" }}
        title="Images output"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        style={{ background: "#3b82f6", top: "62%" }}
        title="Text output"
      />

      <div className="space-y-2.5 p-3">
        {/* URL input — shows connected URL or manual entry */}
        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-0.5 font-medium uppercase tracking-wider">
            URL {connectedUrl && <span className="text-emerald-400 normal-case">← from input</span>}
          </label>
          {connectedUrl ? (
            <div className="w-full px-2 py-1.5 text-xs bg-emerald-500/5 border border-emerald-500/20 rounded-md text-[var(--text-secondary)] truncate" title={connectedUrl}>
              {connectedUrl}
            </div>
          ) : (
            <input
              type="text"
              value={nodeData.url}
              onChange={handleUrlChange}
              placeholder="https://store.example.com"
              className="nodrag nopan w-full px-2 py-1.5 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-md focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          )}
        </div>

        {/* Settings row */}
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <label className="block text-[10px] text-[var(--text-muted)] mb-0.5 font-medium uppercase tracking-wider">
              Max images
            </label>
            <select
              value={nodeData.maxImages || 4}
              onChange={handleMaxImagesChange}
              className="nodrag nopan w-full px-2 py-1 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-md focus:outline-none focus:border-orange-500 text-[var(--text-secondary)]"
            >
              {[1, 2, 3, 4, 6, 8, 10].map(n => (
                <option key={n} value={n}>{n} {n === 1 ? "image" : "images"}</option>
              ))}
            </select>
          </div>

          {/* Output indicators */}
          <div className="flex flex-col gap-0.5 text-[9px] text-[var(--text-muted)] pt-3">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }} />
              Images
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: "#3b82f6" }} />
              Text
            </div>
          </div>
        </div>

        {/* Scrape button */}
        <button
          onClick={handleScrape}
          disabled={!effectiveUrl || isScraping}
          className="w-full px-3 py-2 text-xs font-semibold rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: isScraping
              ? "var(--bg-surface)"
              : "linear-gradient(135deg, #f97316, #ea580c)",
            color: isScraping ? "var(--text-muted)" : "white",
          }}
        >
          {isScraping ? (
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" className="opacity-75" />
              </svg>
              Scraping…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              Scrape
            </span>
          )}
        </button>

        {/* Status */}
        {nodeData.status === "loading" && (
          <div className="text-[10px] text-[var(--accent-primary)] flex items-center gap-1">
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" className="opacity-75" />
            </svg>
            Fetching page & images…
          </div>
        )}

        {nodeData.error && (
          <div className="text-[10px] text-red-400 bg-red-500/5 px-2 py-1 rounded border border-red-500/10">
            {nodeData.error}
          </div>
        )}

        {/* Results summary */}
        {nodeData.status === "complete" && (
          <div className="text-[10px] text-emerald-400 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 flex items-center justify-between">
            <span>
              {nodeData.pageTitle ? `"${nodeData.pageTitle.substring(0, 30)}${nodeData.pageTitle.length > 30 ? '…' : ''}"` : "Scraped"}
            </span>
            <span className="text-[var(--text-muted)]">
              {nodeData.outputImages?.length || 0} img · {nodeData.outputText?.length || 0} chars
            </span>
          </div>
        )}

        {/* Image grid preview */}
        {hasImages && (
          <div>
            <div className="text-[9px] text-[var(--text-muted)] mb-1 uppercase tracking-wider font-medium">
              Images ({nodeData.outputImages.length} / {nodeData.imageCount} found)
            </div>
            <div className={`grid gap-1 rounded overflow-hidden ${nodeData.outputImages.length === 1 ? "grid-cols-1" :
              nodeData.outputImages.length <= 4 ? "grid-cols-2" : "grid-cols-3"
              }`}>
              {nodeData.outputImages.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`Scraped ${i + 1}`}
                  className="w-full aspect-square object-cover rounded border border-[var(--border-subtle)]"
                />
              ))}
            </div>
          </div>
        )}

        {/* Text preview */}
        {hasText && (
          <div>
            <div className="text-[9px] text-[var(--text-muted)] mb-1 uppercase tracking-wider font-medium">
              Page text
            </div>
            <div className="bg-[var(--bg-base)] px-2 py-1.5 rounded max-h-16 overflow-y-auto text-[10px] text-[var(--text-secondary)] leading-relaxed border border-[var(--border-subtle)]">
              {nodeData.outputText!.substring(0, 200)}
              {nodeData.outputText!.length > 200 && (
                <span className="text-[var(--text-muted)]"> …({nodeData.outputText!.length} chars)</span>
              )}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
