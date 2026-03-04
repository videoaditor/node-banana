"use client";

import { useCallback } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useCommentNavigation } from "@/hooks/useCommentNavigation";
import { useWorkflowStore } from "@/store/workflowStore";
import { PromptConcatenatorNodeData } from "@/types";

type PromptConcatenatorNodeType = Node<PromptConcatenatorNodeData, "promptConcatenator">;

// Common separator presets
const SEPARATOR_PRESETS = [
  { value: "\n", label: "Newline" },
  { value: "\n\n", label: "Double Newline" },
  { value: " ", label: "Space" },
  { value: ", ", label: "Comma + Space" },
  { value: ". ", label: "Period + Space" },
  { value: " | ", label: "Pipe" },
  { value: "custom", label: "Custom..." },
];

export function PromptConcatenatorNode({ id, data, selected }: NodeProps<PromptConcatenatorNodeType>) {
  const nodeData = data;
  const commentNavigation = useCommentNavigation(id);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const handleSeparatorChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value !== "custom") {
        updateNodeData(id, { separator: value });
      }
    },
    [id, updateNodeData]
  );

  const handleCustomSeparatorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { separator: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleAddTextInput = useCallback(() => {
    const currentHandles = nodeData.textInputHandles || 2;
    updateNodeData(id, { textInputHandles: currentHandles + 1 });
  }, [id, nodeData.textInputHandles, updateNodeData]);

  const handleRemoveTextInput = useCallback(() => {
    const currentHandles = nodeData.textInputHandles || 2;
    if (currentHandles > 2) {
      updateNodeData(id, { textInputHandles: currentHandles - 1 });
    }
  }, [id, nodeData.textInputHandles, updateNodeData]);

  // Check if separator is custom
  const isCustomSeparator = !SEPARATOR_PRESETS.some(p => p.value === nodeData.separator && p.value !== "custom");
  const selectedPreset = isCustomSeparator ? "custom" : nodeData.separator;

  return (
    <BaseNode
      id={id}
      title="Text Concatenator"
      customTitle={nodeData.customTitle}
      comment={nodeData.comment}
      onCustomTitleChange={(title) => updateNodeData(id, { customTitle: title || undefined })}
      onCommentChange={(comment) => updateNodeData(id, { comment: comment || undefined })}
      selected={selected}
      commentNavigation={commentNavigation ?? undefined}
      nodeAccentColor="blue"
    >
      {/* Dynamic text input handles */}
      {Array.from({ length: nodeData.textInputHandles || 2 }, (_, i) => {
        const handlePosition = ((i + 1) / ((nodeData.textInputHandles || 2) + 1)) * 100;
        const handleId = i === 0 ? "text" : `text-${i}`;

        return (
          <div key={handleId}>
            <Handle
              type="target"
              position={Position.Left}
              id={handleId}
              style={{ top: `${handlePosition}%` }}
              data-handletype="text"
              isConnectable={true}
            />
            {/* Text input label */}
            <div
              className="absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
              style={{
                right: `calc(100% + 8px)`,
                top: `calc(${handlePosition}% - 18px)`,
                color: "var(--handle-color-text)",
              }}
            >
              {i === 0 ? "Text" : `Text ${i}`}
            </div>
          </div>
        );
      })}

      <div className="flex-1 flex flex-col gap-2">
        {/* Separator selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[var(--text-secondary)]">Separator</label>
          <select
            value={selectedPreset}
            onChange={handleSeparatorChange}
            className="text-[10px] py-1 px-1.5 border border-[var(--border-subtle)] rounded bg-[var(--bg-base)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] text-[var(--text-secondary)]"
          >
            {SEPARATOR_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom separator input */}
        {isCustomSeparator && (
          <input
            type="text"
            value={nodeData.separator}
            onChange={handleCustomSeparatorChange}
            placeholder="Custom separator..."
            className="text-[10px] py-1 px-1.5 border border-[var(--border-subtle)] rounded bg-[var(--bg-base)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
          />
        )}

        {/* Output preview */}
        {nodeData.outputText && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="text-[10px] text-[var(--text-secondary)] mb-1">Output:</div>
            <div className="p-2 text-xs text-[var(--text-primary)] border border-[var(--border-subtle)] rounded bg-[var(--bg-base)]/50 whitespace-pre-wrap break-words">
              {nodeData.outputText}
            </div>
          </div>
        )}

        {/* Add/Remove text input buttons */}
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={handleAddTextInput}
            className="flex-1 text-[10px] py-1.5 px-2 bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] rounded text-[var(--text-secondary)] transition-all duration-[120ms] flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Input
          </button>
          {(nodeData.textInputHandles || 2) > 2 && (
            <button
              onClick={handleRemoveTextInput}
              className="flex-1 text-[10px] py-1.5 px-2 bg-red-700 hover:bg-[var(--node-error)] border border-red-600 rounded text-[var(--text-secondary)] transition-all duration-[120ms] flex items-center justify-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Remove Input
            </button>
          )}
        </div>
      </div>

      {/* Text output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        style={{ top: "50%" }}
        data-handletype="text"
      />
      {/* Output label */}
      <div
        className="absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
        style={{
          left: `calc(100% + 8px)`,
          top: "calc(50% - 18px)",
          color: "var(--handle-color-text)",
        }}
      >
        Text
      </div>
    </BaseNode>
  );
}
