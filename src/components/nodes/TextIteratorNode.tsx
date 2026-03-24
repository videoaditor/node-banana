"use client";

import React, { useCallback, useEffect, useRef, useMemo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { TextIteratorNodeData } from "@/types";
import { useUpstreamText } from "@/hooks/useUpstreamData";

type TextIteratorNodeType = Node<TextIteratorNodeData, "textIterator">;

const SPLIT_MODES = [
  { value: "newline", label: "Newline" },
  { value: "period", label: "Period (.)" },
  { value: "hash", label: "Hash (#)" },
  { value: "dash", label: "Dash (-)" },
  { value: "asterisk", label: "Asterisk (*)" },
  { value: "custom", label: "Custom" },
] as const;

function splitText(text: string, mode: string, customSep?: string): string[] {
  let items: string[];
  if (mode === "newline") items = text.split("\n");
  else if (mode === "period") items = text.split(".");
  else if (mode === "hash") items = text.split("#");
  else if (mode === "dash") items = text.split("-");
  else if (mode === "asterisk") items = text.split("*");
  else if (mode === "custom" && customSep) items = text.split(customSep);
  else items = [text];
  return items.filter((t) => t.trim());
}

export function TextIteratorNode({ id, data, selected }: NodeProps<TextIteratorNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  // REACTIVE: Live-preview upstream text as it changes
  const upstreamText = useUpstreamText(id);
  const lastUpstreamRef = useRef<string | null>(null);

  useEffect(() => {
    if (upstreamText && upstreamText !== lastUpstreamRef.current) {
      lastUpstreamRef.current = upstreamText;
      updateNodeData(id, { inputText: upstreamText });
    }
  }, [upstreamText, id, updateNodeData]);

  // Show a live preview of how many segments will be created
  const segmentCount = useMemo(() => {
    const text = upstreamText || nodeData.inputText;
    if (!text) return 0;
    return splitText(text, nodeData.splitMode || "newline", nodeData.customSeparator).length;
  }, [upstreamText, nodeData.inputText, nodeData.splitMode, nodeData.customSeparator]);

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

        {/* Input preview — updates live as upstream node types */}
        {(upstreamText || nodeData.inputText) && (
          <div className="text-xs text-[var(--text-secondary)]">
            <div className="mb-1 flex justify-between">
              <span>Input text:</span>
              {segmentCount > 0 && (
                <span className="text-[var(--accent-primary)] font-medium">
                  {segmentCount} segment{segmentCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="bg-[var(--bg-base)] p-2 rounded max-h-20 overflow-y-auto">
              {(upstreamText || nodeData.inputText || "").substring(0, 100)}
              {(upstreamText || nodeData.inputText || "").length > 100 && "..."}
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
