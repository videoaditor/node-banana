"use client";

import React, { useCallback } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { ZipIteratorNodeData } from "@/types";

type ZipIteratorNodeType = Node<ZipIteratorNodeData, "zipIterator">;

const SPLIT_MODES = [
  { value: "newline", label: "Newline" },
  { value: "period", label: "Period (.)" },
  { value: "hash", label: "Hash (#)" },
  { value: "dash", label: "Dash (-)" },
  { value: "custom", label: "Custom" },
] as const;

export function ZipIteratorNode({ id, data, selected }: NodeProps<ZipIteratorNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const handleSplitModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { splitMode: e.target.value as ZipIteratorNodeData["splitMode"] });
    },
    [id, updateNodeData]
  );

  const handleCustomSeparatorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { customSeparator: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleModeChange = useCallback(
    (mode: "zip" | "product") => {
      updateNodeData(id, { mode });
    },
    [id, updateNodeData]
  );

  const textCount = nodeData.textItems?.length || 0;
  const imageCount = nodeData.imageItems?.length || 0;
  const isRunning = nodeData.status === "loading";

  return (
    <BaseNode
      id={id}
      selected={selected}
      title="Zip Iterator"
      nodeAccentColor="cyan"
      className="bg-[var(--bg-elevated)] border-[var(--border-subtle)]"
    >
      {/* Image input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        style={{ background: "#3ecf8e", top: "35%" }}
        title="Image inputs"
      />

      {/* Text input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{ background: "#3b82f6", top: "55%" }}
        title="Text input (will be split)"
      />

      {/* Image output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        style={{ background: "#3ecf8e", top: "35%" }}
        title="Current image (per iteration)"
      />

      {/* Text output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        style={{ background: "#3b82f6", top: "55%" }}
        title="Current text (per iteration)"
      />

      <div className="space-y-3 p-3">
        {/* Mode toggle */}
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Mode</label>
          <div className="flex gap-1">
            <button
              onClick={() => handleModeChange("zip")}
              className={`nodrag nopan flex-1 px-2 py-1 text-xs rounded transition-colors ${
                nodeData.mode === "zip"
                  ? "bg-cyan-600 text-white"
                  : "bg-[var(--bg-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              Zip (1:1)
            </button>
            <button
              onClick={() => handleModeChange("product")}
              className={`nodrag nopan flex-1 px-2 py-1 text-xs rounded transition-colors ${
                nodeData.mode === "product"
                  ? "bg-cyan-600 text-white"
                  : "bg-[var(--bg-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              Product (N×M)
            </button>
          </div>
        </div>

        {/* Text split mode */}
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Split text at</label>
          <select
            value={nodeData.splitMode}
            onChange={handleSplitModeChange}
            className="nodrag nopan w-full px-2 py-1 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-cyan-500 text-[var(--text-secondary)]"
          >
            {SPLIT_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
        </div>

        {/* Custom separator */}
        {nodeData.splitMode === "custom" && (
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Custom separator</label>
            <input
              type="text"
              value={nodeData.customSeparator}
              onChange={handleCustomSeparatorChange}
              placeholder="Enter separator"
              className="nodrag nopan w-full px-2 py-1 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-cyan-500 text-[var(--text-secondary)]"
            />
          </div>
        )}

        {/* Input counts */}
        <div className="flex gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#3ecf8e]" />
            <span className="text-[var(--text-secondary)]">{imageCount} images</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#3b82f6]" />
            <span className="text-[var(--text-secondary)]">{textCount} texts</span>
          </div>
        </div>

        {/* Paired preview */}
        {(textCount > 0 || imageCount > 0) && (
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">
              {nodeData.mode === "zip"
                ? `${nodeData.totalPairs || Math.max(textCount, imageCount)} pairs`
                : `${nodeData.totalPairs || textCount * imageCount} combinations`
              }
            </label>
            <div className="bg-[var(--bg-base)] rounded p-1.5 max-h-32 overflow-y-auto space-y-1">
              {Array.from({ length: Math.min(nodeData.mode === "zip" ? Math.max(textCount, imageCount) : textCount * imageCount, 8) }).map((_, i) => {
                let tIdx: number, iIdx: number;
                if (nodeData.mode === "zip") {
                  tIdx = i;
                  iIdx = i;
                } else {
                  tIdx = Math.floor(i / Math.max(imageCount, 1));
                  iIdx = i % Math.max(imageCount, 1);
                }
                const text = nodeData.textItems?.[tIdx];
                const image = nodeData.imageItems?.[iIdx];
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-1.5 text-[10px] px-1 py-0.5 rounded ${
                      isRunning && nodeData.currentIndex === i ? "bg-cyan-900/30 border border-cyan-500/30" : ""
                    }`}
                  >
                    <span className="text-[var(--text-muted)] w-3 shrink-0">{i + 1}.</span>
                    {image ? (
                      <img src={image} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-[var(--bg-hover)] shrink-0 flex items-center justify-center text-[8px] text-[var(--text-muted)]">—</div>
                    )}
                    <span className="text-[var(--text-secondary)] truncate">
                      {text ? (text.length > 40 ? text.substring(0, 40) + "..." : text) : "—"}
                    </span>
                  </div>
                );
              })}
              {(nodeData.mode === "zip" ? Math.max(textCount, imageCount) : textCount * imageCount) > 8 && (
                <div className="text-[9px] text-[var(--text-muted)] text-center">
                  + {(nodeData.mode === "zip" ? Math.max(textCount, imageCount) : textCount * imageCount) - 8} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status */}
        {isRunning && (
          <div className="text-xs text-cyan-400">
            Iterating... {nodeData.currentIndex + 1}/{nodeData.totalPairs || "?"}
          </div>
        )}
        {nodeData.status === "complete" && (
          <div className="text-xs text-[#3ecf8e]">
            ✓ Completed {nodeData.totalPairs} iterations
          </div>
        )}
        {nodeData.error && (
          <div className="text-xs text-[var(--node-error)]">{nodeData.error}</div>
        )}
      </div>
    </BaseNode>
  );
}
