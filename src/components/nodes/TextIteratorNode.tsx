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

  // Live-compute the split segments for display
  const segments = useMemo(() => {
    const text = upstreamText || nodeData.inputText;
    if (!text) return [];
    return splitText(text, nodeData.splitMode || "newline", nodeData.customSeparator);
  }, [upstreamText, nodeData.inputText, nodeData.splitMode, nodeData.customSeparator]);

  const segmentCount = segments.length;

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

        {/* Segment list — shows each split item with index */}
        {segments.length > 0 && (
          <div className="text-xs text-[var(--text-secondary)]">
            <div className="mb-1 flex justify-between">
              <span className="font-medium">Segments</span>
              <span className="text-[var(--accent-primary)] font-medium">
                {segmentCount} item{segmentCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="bg-[var(--bg-base)] rounded max-h-40 overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {segments.map((seg, i) => {
                const isActive = nodeData.status === "loading" && nodeData.currentText === seg;
                return (
                  <div
                    key={i}
                    className={`px-2 py-1.5 flex gap-2 items-start ${
                      isActive ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]" : ""
                    }`}
                  >
                    <span className="text-[var(--text-muted)] shrink-0 w-4 text-right font-mono text-[9px] pt-0.5">
                      {i + 1}
                    </span>
                    <span className="break-words min-w-0">
                      {seg.length > 80 ? seg.substring(0, 80) + "…" : seg}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state — no upstream text connected */}
        {segments.length === 0 && !(upstreamText || nodeData.inputText) && (
          <div className="text-[10px] text-[var(--text-muted)] italic py-2">
            Connect a text output to split into segments
          </div>
        )}

        {/* Status */}
        {nodeData.status === "loading" && (
          <div className="text-xs text-[var(--accent-primary)]">
            Processing {segmentCount} segment{segmentCount !== 1 ? "s" : ""}…
          </div>
        )}
        {nodeData.status === "complete" && segmentCount > 0 && (
          <div className="text-xs text-green-400">
            ✓ Iterated {segmentCount} segment{segmentCount !== 1 ? "s" : ""}
          </div>
        )}
        {nodeData.error && (
          <div className="text-xs text-[var(--node-error)]">{nodeData.error}</div>
        )}
      </div>
    </BaseNode>
  );
}
