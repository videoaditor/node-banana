"use client";

import React, { useCallback, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { WebScraperNodeData } from "@/types";

type WebScraperNodeType = Node<WebScraperNodeData, "webScraper">;

const SCRAPE_MODES = [
  { value: "best-image", label: "Best product image" },
  { value: "all-images", label: "All images" },
  { value: "page-text", label: "Page text" },
] as const;

export function WebScraperNode({ id, data, selected }: NodeProps<WebScraperNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const [isScraping, setIsScraping] = useState(false);

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { url: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleScrapeModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { scrapeMode: e.target.value as WebScraperNodeData["scrapeMode"] });
    },
    [id, updateNodeData]
  );

  const handleScrape = useCallback(async () => {
    if (!nodeData.url) return;

    setIsScraping(true);
    updateNodeData(id, { status: "loading", error: null });

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: nodeData.url,
          mode: nodeData.scrapeMode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to scrape URL");
      }

      const result = await response.json();

      if (nodeData.scrapeMode === "best-image") {
        updateNodeData(id, {
          status: "complete",
          outputImage: result.image,
          outputText: null,
        });
      } else {
        updateNodeData(id, {
          status: "complete",
          outputImage: null,
          outputText: result.text,
        });
      }
    } catch (error) {
      updateNodeData(id, {
        status: "error",
        error: error instanceof Error ? error.message : "Scraping failed",
      });
    } finally {
      setIsScraping(false);
    }
  }, [id, nodeData.url, nodeData.scrapeMode, updateNodeData]);

  return (
    <BaseNode
      id={id}
      selected={selected}
      title="Web Scraper"
      className="bg-[var(--bg-elevated)] border-[var(--border-subtle)]"
    >
      {/* Text input handle for URL */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{ background: "#3b82f6" }}
        title="URL input (optional)"
      />

      {/* Output handles - conditional based on mode */}
      {nodeData.scrapeMode === "best-image" ? (
        <Handle
          type="source"
          position={Position.Right}
          id="image"
          style={{ background: "#22c55e" }}
          title="Image output"
        />
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="text"
          style={{ background: "#3b82f6" }}
          title="Text output (JSON array or plain text)"
        />
      )}

      <div className="space-y-3 p-3">
        {/* URL input */}
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">URL</label>
          <input
            type="text"
            value={nodeData.url}
            onChange={handleUrlChange}
            placeholder="https://example.com"
            className="w-full px-2 py-1 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Scrape mode dropdown */}
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Scrape mode</label>
          <select
            value={nodeData.scrapeMode}
            onChange={handleScrapeModeChange}
            className="w-full px-2 py-1 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-orange-500"
          >
            {SCRAPE_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>

        {/* Scrape button */}
        <button
          onClick={handleScrape}
          disabled={!nodeData.url || isScraping}
          className="w-full px-3 py-2 text-xs font-medium bg-orange-600 hover:bg-orange-700 disabled:bg-[var(--bg-surface)] disabled:text-[var(--text-muted)] rounded"
        >
          {isScraping ? "Scraping..." : "Scrape"}
        </button>

        {/* Status display */}
        {nodeData.status === "loading" && (
          <div className="text-xs text-[var(--accent-primary)]">Fetching data...</div>
        )}
        {nodeData.status === "complete" && (
          <div className="text-xs text-[var(--node-success)]">
            {nodeData.scrapeMode === "best-image" ? "Image scraped" : "Text scraped"}
          </div>
        )}
        {nodeData.error && (
          <div className="text-xs text-[var(--node-error)]">{nodeData.error}</div>
        )}

        {/* Result preview */}
        {nodeData.outputImage && (
          <div>
            <div className="text-xs text-[var(--text-secondary)] mb-1">Preview:</div>
            <img
              src={nodeData.outputImage}
              alt="Scraped"
              className="w-full rounded border border-[var(--border-subtle)]"
            />
          </div>
        )}
        {nodeData.outputText && (
          <div>
            <div className="text-xs text-[var(--text-secondary)] mb-1">Preview:</div>
            <div className="bg-[var(--bg-base)] p-2 rounded max-h-20 overflow-y-auto text-xs">
              {nodeData.outputText.substring(0, 150)}
              {nodeData.outputText.length > 150 && "..."}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
