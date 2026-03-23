"use client";

import React, { useCallback } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { ImageFilterNodeData } from "@/types";

type ImageFilterNodeType = Node<ImageFilterNodeData, "imageFilter">;

const LLM_MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "google" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", provider: "openai" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano", provider: "openai" },
] as const;

export function ImageFilterNode({ id, data, selected }: NodeProps<ImageFilterNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const handleCriteriaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { filterCriteria: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = LLM_MODELS.find(m => m.value === e.target.value);
      if (selected) {
        updateNodeData(id, { model: selected.value, provider: selected.provider });
      }
    },
    [id, updateNodeData]
  );

  const handleToggleOverride = useCallback(
    (index: number) => {
      const results = [...(nodeData.filterResults || [])];
      if (results[index]) {
        const wasOverridden = results[index].overridden;
        results[index] = {
          ...results[index],
          passed: wasOverridden ? !results[index].passed : !results[index].passed,
          overridden: true,
        };
        // Rebuild outputImages from results
        const outputImages = results
          .filter(r => r.passed)
          .map(r => r.image);
        updateNodeData(id, { filterResults: results, outputImages });
      }
    },
    [id, nodeData.filterResults, updateNodeData]
  );

  const passedCount = nodeData.filterResults?.filter(r => r.passed).length || 0;
  const totalCount = nodeData.filterResults?.length || 0;

  return (
    <BaseNode
      id={id}
      selected={selected}
      title="Image Filter"
      nodeAccentColor="cyan"
      className="bg-[var(--bg-elevated)] border-[var(--border-subtle)]"
    >
      {/* Image input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        style={{ background: "#3ecf8e", top: "38%" }}
        title="Image input"
      />

      {/* Text criteria input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{ background: "#3b82f6", top: "62%" }}
        title="Filter criteria (text)"
      />

      {/* Filtered image output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        style={{ background: "#3ecf8e" }}
        title="Filtered images"
      />

      <div className="space-y-3 p-3">
        {/* Filter criteria */}
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Filter criteria</label>
          <textarea
            value={nodeData.filterCriteria}
            onChange={handleCriteriaChange}
            placeholder="e.g. only product photos, no logos"
            rows={2}
            className="nodrag nopan w-full px-2 py-1 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded resize-none focus:outline-none focus:border-cyan-500 text-[var(--text-secondary)]"
          />
        </div>

        {/* Model selector */}
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Vision model</label>
          <select
            value={nodeData.model}
            onChange={handleModelChange}
            className="nodrag nopan w-full px-2 py-1 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-cyan-500 text-[var(--text-secondary)]"
          >
            {LLM_MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Thumbnail grid with results */}
        {nodeData.filterResults && nodeData.filterResults.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--text-secondary)]">Results</span>
              <span className="text-xs font-medium" style={{ color: passedCount > 0 ? "#3ecf8e" : "#ef4444" }}>
                {passedCount}/{totalCount} passed
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {nodeData.filterResults.map((result, i) => (
                <button
                  key={i}
                  onClick={() => handleToggleOverride(i)}
                  className="nodrag nopan relative aspect-square rounded overflow-hidden border-2 transition-colors"
                  style={{
                    borderColor: result.passed ? "#3ecf8e" : "#ef4444",
                    opacity: result.passed ? 1 : 0.5,
                  }}
                  title={`Click to ${result.passed ? "exclude" : "include"} this image${result.overridden ? " (manually overridden)" : ""}`}
                >
                  <img
                    src={result.image}
                    alt={`Image ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ background: result.passed ? "#3ecf8e" : "#ef4444" }}
                  >
                    {result.passed ? "✓" : "✗"}
                  </div>
                  {result.overridden && (
                    <div className="absolute bottom-0.5 left-0.5 w-3 h-3 rounded-full bg-yellow-500 flex items-center justify-center text-[7px]">
                      ✎
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        {nodeData.status === "loading" && (
          <div className="text-xs text-cyan-400">Evaluating images...</div>
        )}
        {nodeData.error && (
          <div className="text-xs text-[var(--node-error)]">{nodeData.error}</div>
        )}
      </div>
    </BaseNode>
  );
}
