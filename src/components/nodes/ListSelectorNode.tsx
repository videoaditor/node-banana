"use client";

import React, { useCallback } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { ListSelectorNodeData } from "@/types";

type ListSelectorNodeType = Node<ListSelectorNodeData, "listSelector">;

const SPLIT_MODES = [
  { value: "newline", label: "Newline" },
  { value: "period", label: "Period (.)" },
  { value: "hash", label: "Hash (#)" },
  { value: "dash", label: "Dash (-)" },
  { value: "custom", label: "Custom" },
] as const;

export function ListSelectorNode({ id, data, selected }: NodeProps<ListSelectorNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const hasUpstreamItems = !!(nodeData.upstreamItems && nodeData.upstreamItems.length > 0);

  const handleSelectionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const index = parseInt(e.target.value, 10);
      updateNodeData(id, {
        selectedIndex: index,
        outputText: nodeData.items[index] || null,
      });
    },
    [id, nodeData.items, updateNodeData]
  );

  const handleSplitModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { splitMode: e.target.value as ListSelectorNodeData["splitMode"] });
    },
    [id, updateNodeData]
  );

  const handleCustomSeparatorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { customSeparator: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleItemChange = useCallback(
    (index: number, value: string) => {
      const newItems = [...nodeData.items];
      newItems[index] = value;
      const updates: Partial<ListSelectorNodeData> = { items: newItems };
      if (index === nodeData.selectedIndex) {
        updates.outputText = value;
      }
      updateNodeData(id, updates);
    },
    [id, nodeData.items, nodeData.selectedIndex, updateNodeData]
  );

  const handleAddItem = useCallback(() => {
    updateNodeData(id, { items: [...nodeData.items, `Option ${nodeData.items.length + 1}`] });
  }, [id, nodeData.items, updateNodeData]);

  const handleRemoveItem = useCallback(
    (index: number) => {
      const newItems = nodeData.items.filter((_, i) => i !== index);
      if (newItems.length === 0) return;
      const newSelectedIndex = Math.min(nodeData.selectedIndex, newItems.length - 1);
      updateNodeData(id, {
        items: newItems,
        selectedIndex: newSelectedIndex,
        outputText: newItems[newSelectedIndex] || null,
      });
    },
    [id, nodeData.items, nodeData.selectedIndex, updateNodeData]
  );

  return (
    <BaseNode
      id={id}
      selected={selected}
      title="List Selector"
      nodeAccentColor="blue"
      titlePrefix={
        <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      }
    >
      {/* Text input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        data-handletype="text"
        title="Text input (populates options)"
      />

      {/* Text output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        data-handletype="text"
        title="Selected text output"
      />

      <div className="space-y-3 pt-2">
        {/* Split mode dropdown */}
        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-1 uppercase tracking-wider font-medium">
            Split at
          </label>
          <select
            value={nodeData.splitMode || "newline"}
            onChange={handleSplitModeChange}
            className="nodrag nopan w-full px-2 py-1.5 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-md focus:outline-none focus:border-[var(--accent-primary)] text-[var(--text-primary)]"
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
            <input
              type="text"
              value={nodeData.customSeparator || ""}
              onChange={handleCustomSeparatorChange}
              placeholder="Enter separator"
              className="nodrag nopan w-full px-2 py-1 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-md focus:outline-none focus:border-[var(--accent-primary)] text-[var(--text-primary)]"
            />
          </div>
        )}

        {/* Upstream indicator */}
        {hasUpstreamItems && (
          <div className="text-[10px] text-[var(--accent-primary)] font-medium">
            {nodeData.items.length} items from upstream
          </div>
        )}

        {/* Selector dropdown */}
        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-1 uppercase tracking-wider font-medium">
            Selected
          </label>
          <select
            value={nodeData.selectedIndex}
            onChange={handleSelectionChange}
            className="nodrag nopan w-full px-2 py-1.5 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-md focus:outline-none focus:border-[var(--accent-primary)] text-[var(--text-primary)]"
          >
            {nodeData.items.map((item, index) => (
              <option key={index} value={index}>
                {item.length > 60 ? item.substring(0, 60) + "..." : item || `(empty ${index + 1})`}
              </option>
            ))}
          </select>
        </div>

        {/* Items list */}
        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-1 uppercase tracking-wider font-medium">
            Options ({nodeData.items.length})
          </label>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {nodeData.items.map((item, index) => (
              <div key={index} className="flex items-center gap-1 group">
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    index === nodeData.selectedIndex
                      ? "bg-[var(--accent-primary)]"
                      : "bg-[var(--text-muted)]"
                  }`}
                />
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleItemChange(index, e.target.value)}
                  className="nodrag nopan flex-1 px-1.5 py-0.5 text-[11px] bg-transparent border-b border-transparent hover:border-[var(--border-subtle)] focus:border-[var(--accent-primary)] focus:outline-none text-[var(--text-primary)]"
                />
                {nodeData.items.length > 1 && (
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="nodrag nopan opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-muted)] hover:text-[var(--node-error)] transition-all duration-[120ms]"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          {!hasUpstreamItems && (
            <button
              onClick={handleAddItem}
              className="nodrag nopan mt-1.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-all duration-[120ms]"
            >
              + Add option
            </button>
          )}
        </div>

        {/* Output preview */}
        {nodeData.outputText && (
          <div className="text-[10px] text-[var(--text-secondary)] font-medium bg-[var(--bg-base)] p-1.5 rounded max-h-16 overflow-y-auto">
            {nodeData.outputText.substring(0, 150)}{nodeData.outputText.length > 150 ? "..." : ""}
          </div>
        )}
      </div>
    </BaseNode>
  );
}
