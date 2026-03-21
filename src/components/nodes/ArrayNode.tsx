"use client";

import React, { useCallback } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { ArrayNodeData } from "@/types";

type ArrayNodeType = Node<ArrayNodeData, "arrayNode">;

export function ArrayNode({ id, data, selected }: NodeProps<ArrayNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const handleItemChange = useCallback(
    (index: number, value: string) => {
      const newItems = [...nodeData.items];
      newItems[index] = value;
      updateNodeData(id, { items: newItems });
    },
    [id, nodeData.items, updateNodeData]
  );

  const handleAddItem = useCallback(() => {
    updateNodeData(id, { items: [...nodeData.items, ""] });
  }, [id, nodeData.items, updateNodeData]);

  const handleRemoveItem = useCallback(
    (index: number) => {
      const newItems = nodeData.items.filter((_, i) => i !== index);
      updateNodeData(id, { items: newItems.length > 0 ? newItems : [""] });
    },
    [id, nodeData.items, updateNodeData]
  );

  return (
    <BaseNode
      id={id}
      selected={selected}
      title="Array"
      nodeAccentColor="blue"
      titlePrefix={
        <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      }
    >
      {/* Text input handle — receives text to append as items */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        data-handletype="text"
        title="Text input (appends to items)"
      />

      {/* Text output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        data-handletype="text"
        title="Text output (per item)"
      />

      <div className="space-y-2 pt-2">
        {/* Items list */}
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {nodeData.items.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5 group">
              <span className="text-[10px] text-[var(--text-muted)] w-4 text-right font-['DM_Mono',monospace] shrink-0">
                {index + 1}
              </span>
              <input
                type="text"
                value={item}
                onChange={(e) => handleItemChange(index, e.target.value)}
                placeholder={`Item ${index + 1}`}
                className="nodrag nopan flex-1 px-2 py-1 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-md focus:outline-none focus:border-[var(--accent-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
              {nodeData.items.length > 1 && (
                <button
                  onClick={() => handleRemoveItem(index)}
                  className="nodrag nopan opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-muted)] hover:text-[var(--node-error)] transition-all duration-[120ms]"
                  title="Remove item"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add item button */}
        <button
          onClick={handleAddItem}
          className="nodrag nopan w-full py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-dashed border-[var(--border-subtle)] hover:border-[var(--accent-primary)] rounded-md transition-all duration-[120ms]"
        >
          + Add item
        </button>

        {/* Item count */}
        <div className="text-[10px] text-[var(--text-muted)] text-right font-['DM_Mono',monospace]">
          {nodeData.items.filter(i => i.trim()).length} items
        </div>

        {/* Status */}
        {nodeData.status === "loading" && (
          <div className="text-xs text-[var(--accent-primary)]">Iterating items...</div>
        )}
        {nodeData.error && (
          <div className="text-xs text-[var(--node-error)]">{nodeData.error}</div>
        )}
      </div>
    </BaseNode>
  );
}
