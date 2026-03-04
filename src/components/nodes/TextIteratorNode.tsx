"use client";

import React, { useCallback } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { TextIteratorNodeData } from "@/types";

type TextIteratorNodeType = Node<TextIteratorNodeData, "textIterator">;

const SPLIT_MODES = [
  { value: "newline", label: "Newline" },
  { value: "period", label: "Period (.)" },
  { value: "hash", label: "Hash (#)" },
  { value: "dash", label: "Dash (-)" },
  { value: "custom", label: "Custom" },
] as const;

export function TextIteratorNode({ id, data, selected }: NodeProps<TextIteratorNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const handleSplitModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { splitMode: e.target.value as TextIteratorNodeData["splitMode"] });
    },
    [id, updateNodeData]
  );

  const handleCustomSeparatorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { customSeparator: e.target.value });
    },
    [id, updateNodeData]
  );

  return (
    <BaseNode
      id={id}
      selected={selected}
      title="Text Iterator"
      className="bg-[var(--bg-elevated)] border-[var(--border-subtle)]"
    >
      {/* Text input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{ background: "#3b82f6" }}
        title="Text input"
      />

      {/* Text output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        style={{ background: "#3b82f6" }}
        title="Text output (per segment)"
      />

      <div className="space-y-3 p-3">
        {/* Split mode dropdown */}
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Split at</label>
          <select
            value={nodeData.splitMode}
            onChange={handleSplitModeChange}
            className="w-full px-2 py-1 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-[var(--accent-primary)]"
          >
            {SPLIT_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom separator input */}
        {nodeData.splitMode === "custom" && (
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Custom separator</label>
            <input
              type="text"
              value={nodeData.customSeparator}
              onChange={handleCustomSeparatorChange}
              placeholder="Enter separator"
              className="w-full px-2 py-1 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
        )}

        {/* Input preview */}
        {nodeData.inputText && (
          <div className="text-xs text-[var(--text-secondary)]">
            <div className="mb-1">Input text:</div>
            <div className="bg-[var(--bg-base)] p-2 rounded max-h-20 overflow-y-auto">
              {nodeData.inputText.substring(0, 100)}
              {nodeData.inputText.length > 100 && "..."}
            </div>
          </div>
        )}

        {/* Status */}
        {nodeData.status === "loading" && (
          <div className="text-xs text-[var(--accent-primary)]">Processing segments...</div>
        )}
        {nodeData.error && (
          <div className="text-xs text-[var(--node-error)]">{nodeData.error}</div>
        )}
      </div>
    </BaseNode>
  );
}
