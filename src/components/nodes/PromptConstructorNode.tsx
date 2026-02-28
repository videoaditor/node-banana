"use client";

import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useCommentNavigation } from "@/hooks/useCommentNavigation";
import { useWorkflowStore } from "@/store/workflowStore";
import { PromptConstructorNodeData, PromptNodeData } from "@/types";
import { PromptConstructorEditorModal } from "@/components/modals/PromptConstructorEditorModal";

type PromptConstructorNodeType = Node<PromptConstructorNodeData, "promptConstructor">;

// Maximum number of input handles allowed
const MAX_INPUTS = 6;
const MIN_INPUTS = 2;

export function PromptConstructorNode({ id, data, selected }: NodeProps<PromptConstructorNodeType>) {
  const nodeData = data;
  const commentNavigation = useCommentNavigation(id);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);
  const incrementModalCount = useWorkflowStore((state) => state.incrementModalCount);
  const decrementModalCount = useWorkflowStore((state) => state.decrementModalCount);

  // Local state for template and static text to prevent cursor jumping
  const [localTemplate, setLocalTemplate] = useState(nodeData.template);
  const [localStaticText, setLocalStaticText] = useState(nodeData.staticText);
  const [isEditing, setIsEditing] = useState(false);
  const [isModalOpenLocal, setIsModalOpenLocal] = useState(false);

  const templateTextareaRef = useRef<HTMLTextAreaElement>(null);
  const staticTextareaRef = useRef<HTMLTextAreaElement>(null);

  const inputCount = nodeData.inputCount || MIN_INPUTS;

  // Sync from props when not actively editing
  useEffect(() => {
    if (!isEditing) {
      setLocalTemplate(nodeData.template);
      setLocalStaticText(nodeData.staticText);
    }
  }, [nodeData.template, nodeData.staticText, isEditing]);

  // Get connected input labels for display in footer
  const connectedInputLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 1; i <= inputCount; i++) {
      const handleId = `text_input_${i}`;
      const isConnected = edges.some(
        (e) => e.target === id && e.targetHandle === handleId
      );
      if (isConnected) {
        labels.push(`Input ${i}`);
      }
    }
    return labels;
  }, [edges, id, inputCount]);

  // Compute available @variables from connected prompt nodes (backward compat)
  const availableVariables = useMemo(() => {
    const connectedPromptNodes = edges
      .filter((e) => e.target === id && e.targetHandle === "text")
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter((n): n is typeof nodes[0] => n !== undefined && n.type === "prompt");

    return connectedPromptNodes
      .map((promptNode) => {
        const promptData = promptNode.data as PromptNodeData;
        return promptData.variableName
          ? { name: promptData.variableName, value: promptData.prompt || "", nodeId: promptNode.id }
          : null;
      })
      .filter((v): v is { name: string; value: string; nodeId: string } => v !== null);
  }, [edges, nodes, id]);

  // Handle input count changes
  const handleAddInput = useCallback(() => {
    if (inputCount < MAX_INPUTS) {
      updateNodeData(id, { inputCount: inputCount + 1 });
    }
  }, [id, inputCount, updateNodeData]);

  const handleRemoveInput = useCallback(() => {
    if (inputCount > MIN_INPUTS) {
      updateNodeData(id, { inputCount: inputCount - 1 });
    }
  }, [id, inputCount, updateNodeData]);

  // Template textarea handlers
  const handleTemplateFocus = useCallback(() => setIsEditing(true), []);
  const handleTemplateBlur = useCallback(() => {
    setIsEditing(false);
    if (localTemplate !== nodeData.template) {
      updateNodeData(id, { template: localTemplate });
    }
  }, [id, localTemplate, nodeData.template, updateNodeData]);

  // Static text textarea handlers
  const handleStaticFocus = useCallback(() => setIsEditing(true), []);
  const handleStaticBlur = useCallback(() => {
    setIsEditing(false);
    if (localStaticText !== nodeData.staticText) {
      updateNodeData(id, { staticText: localStaticText });
    }
  }, [id, localStaticText, nodeData.staticText, updateNodeData]);

  const handleTemplateChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalTemplate(e.target.value);
  }, []);

  const handleStaticChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalStaticText(e.target.value);
  }, []);

  // Modal handlers
  const handleOpenModal = useCallback(() => {
    setIsModalOpenLocal(true);
    incrementModalCount();
  }, [incrementModalCount]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpenLocal(false);
    decrementModalCount();
  }, [decrementModalCount]);

  const handleSubmitModal = useCallback(
    (template: string) => {
      updateNodeData(id, { template });
    },
    [id, updateNodeData]
  );

  // Build handle style positions (evenly distributed vertically)
  const getHandleStyle = (index: number, total: number): React.CSSProperties => {
    // Leave padding at top and bottom, distribute evenly
    const padding = 40; // px from top/bottom
    const availableHeight = 100 - (padding * 2 / 280 * 100); // approximate percentage
    const step = availableHeight / (total + 1);
    const top = padding / 280 * 100 + step * (index + 1);
    return { top: `${top}%` };
  };

  return (
    <>
      <BaseNode
        id={id}
        title="Prompt Constructor"
        customTitle={nodeData.customTitle}
        comment={nodeData.comment}
        onCustomTitleChange={(title) => updateNodeData(id, { customTitle: title || undefined })}
        onCommentChange={(comment) => updateNodeData(id, { comment: comment || undefined })}
        onExpand={handleOpenModal}
        selected={selected}
        commentNavigation={commentNavigation ?? undefined}
      >
        {/* Dynamic labeled text input handles */}
        {Array.from({ length: inputCount }, (_, i) => {
          const inputNum = i + 1;
          const handleId = `text_input_${inputNum}`;
          const handleStyle = getHandleStyle(i, inputCount);

          return (
            <div key={handleId}>
              <Handle
                type="target"
                position={Position.Left}
                id={handleId}
                style={handleStyle}
                data-handletype="text"
                isConnectable={true}
              />
              {/* Input label */}
              <div
                className="absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
                style={{
                  right: `calc(100% + 8px)`,
                  top: `calc(${handleStyle.top} - 8px)`,
                  color: "var(--handle-color-text)",
                }}
              >
                Input {inputNum}
              </div>
            </div>
          );
        })}

        <div className="relative flex flex-col gap-2 flex-1 min-h-0">
          {/* Static text section — appended after all connected inputs */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            <label className="text-[10px] text-neutral-400">Static Text (appended to output)</label>
            <textarea
              ref={staticTextareaRef}
              value={localStaticText}
              onChange={handleStaticChange}
              onFocus={handleStaticFocus}
              onBlur={handleStaticBlur}
              placeholder="Additional text appended after all inputs..."
              className="nodrag nopan nowheel w-full h-[50px] p-2 text-xs leading-relaxed text-neutral-100 border border-neutral-700 rounded bg-neutral-900/50 resize-none focus:outline-none focus:ring-1 focus:ring-neutral-600 focus:border-neutral-600 placeholder:text-neutral-500"
            />
          </div>

          {/* Add/Remove input buttons */}
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={handleAddInput}
              disabled={inputCount >= MAX_INPUTS}
              className="flex-1 text-[10px] py-1.5 px-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed border border-neutral-600 rounded text-neutral-300 transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Input
            </button>
            <button
              onClick={handleRemoveInput}
              disabled={inputCount <= MIN_INPUTS}
              className="flex-1 text-[10px] py-1.5 px-2 bg-red-700 hover:bg-red-600 disabled:bg-red-900/50 disabled:text-red-400/50 disabled:cursor-not-allowed border border-red-600 rounded text-neutral-300 transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Remove Input
            </button>
          </div>

          {/* Footer showing connected inputs */}
          <div className="flex flex-col gap-0.5 mt-1">
            {connectedInputLabels.length > 0 && (
              <div className="text-[10px] text-neutral-500">
                Connected: {connectedInputLabels.join(", ")}
              </div>
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
            top: "calc(50% - 8px)",
            color: "var(--handle-color-text)",
          }}
        >
          Output
        </div>
      </BaseNode>

      {/* Prompt Constructor Editor Modal */}
      {isModalOpenLocal && createPortal(
        <PromptConstructorEditorModal
          isOpen={isModalOpenLocal}
          initialTemplate={nodeData.template}
          availableVariables={availableVariables}
          onSubmit={handleSubmitModal}
          onClose={handleCloseModal}
        />,
        document.body
      )}
    </>
  );
}
