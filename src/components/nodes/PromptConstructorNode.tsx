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
      updateNodeData(id, {
        staticText: localStaticText,
      });
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

  // Helper: read the current user-facing text from a source node.
  // For prompt/promptConstructor/promptConcatenator nodes, prefer the live editable
  // value (prompt / outputText computed from inputs) over stale execution artifacts.
  // For all other nodes (LLM, scraper, etc.), prefer outputText (the execution result).
  const getSourceNodeText = useCallback((sourceNode: typeof nodes[0]): string | null => {
    const d = sourceNode.data as Record<string, unknown>;
    if (sourceNode.type === "prompt") {
      // Prompt nodes: the user-edited value is in `prompt`, always prefer it
      return (d.prompt as string | null) || null;
    }
    if (sourceNode.type === "promptConstructor" || sourceNode.type === "promptConcatenator") {
      // These dynamically compute outputText from their inputs — use it
      return (d.outputText as string | null) || null;
    }
    // All other nodes: prefer outputText (execution result), fallback to prompt
    return (d.outputText as string | null) ?? (d.prompt as string | null) ?? null;
  }, []);

  // Dynamically compute outputText so downstream nodes have access immediately
  useEffect(() => {
    if (isEditing) return;

    const inputTexts: string[] = [];
    for (let i = 1; i <= inputCount; i++) {
      const handleId = `text_input_${i}`;
      const edge = edges.find(e => e.target === id && e.targetHandle === handleId);
      if (edge) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const sourceText = sourceNode ? getSourceNodeText(sourceNode) : null;
        if (sourceText && sourceText.trim()) {
          inputTexts.push(sourceText.trim());
        }
      }
    }

    // Pass 2: fallback catch-all text edges
    const seenSourceIds = new Set(
      edges.filter(e => e.target === id && e.targetHandle?.startsWith('text_input_')).map(e => e.source)
    );
    const allIncomingEdges = edges.filter(e => e.target === id);
    for (const edge of allIncomingEdges) {
      if (seenSourceIds.has(edge.source)) continue;
      const th = edge.targetHandle || "";
      const isTextEdge = th === "text" || th.startsWith("text") || th.includes("prompt") || !th;
      if (!isTextEdge) continue;
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (!sourceNode) continue;
      const text = getSourceNodeText(sourceNode);
      if (text && text.trim()) {
        inputTexts.push(text.trim());
        seenSourceIds.add(sourceNode.id);
      }
    }

    const parts: string[] = [];
    if (inputTexts.length > 0) parts.push(inputTexts.join("\n\n"));
    if (localStaticText.trim()) parts.push(localStaticText.trim());

    const assembledText = parts.join("\n\n") || null;

    if (nodeData.outputText !== assembledText) {
      setTimeout(() => {
        updateNodeData(id, { outputText: assembledText });
      }, 0);
    }
  }, [edges, nodes, id, inputCount, localStaticText, nodeData.outputText, updateNodeData, isEditing, getSourceNodeText]);

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
        nodeAccentColor="blue"
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
          {/* Live assembly preview — shows connected input values */}
          <div className="flex flex-col gap-0.5">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Assembly</div>
            {Array.from({ length: inputCount }, (_, i) => {
              const inputNum = i + 1;
              const handleId = `text_input_${inputNum}`;
              const edge = edges.find(e => e.target === id && e.targetHandle === handleId);
              const sourceNode = edge ? nodes.find(n => n.id === edge.source) : null;
              const sourceText = sourceNode ? getSourceNodeText(sourceNode) : null;
              const isConnected = !!edge;

              return (
                <div
                  key={handleId}
                  className={`flex items-start gap-1.5 px-1.5 py-1 rounded text-[10px] border ${isConnected
                    ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5'
                    : 'border-[var(--border-subtle)]/50 bg-transparent'
                    }`}
                >
                  <span className={`shrink-0 font-medium ${isConnected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>
                    {inputNum}.
                  </span>
                  <span className={`truncate ${isConnected ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)] italic'}`}>
                    {sourceText ? (sourceText.length > 60 ? sourceText.slice(0, 60) + '…' : sourceText) : 'not connected'}
                  </span>
                </div>
              );
            })}

            {/* Append text indicator */}
            {localStaticText.trim() && (
              <div className="flex items-start gap-1.5 px-1.5 py-1 rounded text-[10px] border border-[var(--node-warning)]/30 bg-[var(--node-warning)]/5">
                <span className="shrink-0 font-medium text-[var(--node-warning)]">+</span>
                <span className="truncate text-[var(--text-secondary)]">
                  {localStaticText.length > 60 ? localStaticText.slice(0, 60) + '…' : localStaticText}
                </span>
              </div>
            )}
          </div>

          {/* Suffix text — optional, always appended after all inputs */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Suffix (always added)</label>
            <textarea
              ref={staticTextareaRef}
              value={localStaticText}
              onChange={handleStaticChange}
              onFocus={handleStaticFocus}
              onBlur={handleStaticBlur}
              placeholder="e.g. 4k, cinematic lighting, detailed..."
              className="nodrag nopan nowheel w-full h-[42px] p-2 text-xs leading-relaxed text-[var(--text-primary)] border border-[var(--border-subtle)] rounded bg-[var(--bg-base)]/50 resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>

          {/* Output preview — shows assembled result */}
          {nodeData.outputText && (
            <div className="flex flex-col gap-0.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--node-success)]">→ Output</div>
              <div className="p-1.5 text-[10px] text-[var(--text-secondary)] border border-[var(--node-success)]/20 rounded bg-[var(--node-success)]/5 whitespace-pre-wrap break-words max-h-[60px] overflow-y-auto leading-relaxed">
                {nodeData.outputText}
              </div>
            </div>
          )}

          {/* Add/Remove buttons — minimal, same style */}
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={handleAddInput}
              disabled={inputCount >= MAX_INPUTS}
              className="flex-1 text-[10px] py-1 px-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] disabled:opacity-30 disabled:cursor-not-allowed border border-[var(--border-subtle)] rounded text-[var(--text-secondary)] transition-all duration-[120ms] flex items-center justify-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Input
            </button>
            <button
              onClick={handleRemoveInput}
              disabled={inputCount <= MIN_INPUTS}
              className="flex-1 text-[10px] py-1 px-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] disabled:opacity-30 disabled:cursor-not-allowed border border-[var(--border-subtle)] rounded text-[var(--text-secondary)] transition-all duration-[120ms] flex items-center justify-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
              Remove Input
            </button>
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
