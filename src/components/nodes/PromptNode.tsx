"use client";

import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useCommentNavigation } from "@/hooks/useCommentNavigation";
import { useWorkflowStore } from "@/store/workflowStore";
import { PromptNodeData } from "@/types";
import { PromptEditorModal } from "@/components/modals/PromptEditorModal";

type PromptNodeType = Node<PromptNodeData, "prompt">;

export function PromptNode({ id, data, selected }: NodeProps<PromptNodeType>) {
  const nodeData = data;
  const commentNavigation = useCommentNavigation(id);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const incrementModalCount = useWorkflowStore((state) => state.incrementModalCount);
  const decrementModalCount = useWorkflowStore((state) => state.decrementModalCount);
  const getConnectedInputs = useWorkflowStore((state) => state.getConnectedInputs);
  const edges = useWorkflowStore((state) => state.edges);
  const [isModalOpenLocal, setIsModalOpenLocal] = useState(false);

  // Prompt stack derived values
  const prompts = useMemo(
    () => (nodeData.prompts?.length ? nodeData.prompts : [nodeData.prompt || ""]),
    [nodeData.prompts, nodeData.prompt]
  );
  const activeIndex = nodeData.activePromptIndex ?? 0;
  const safeIndex = Math.min(activeIndex, prompts.length - 1);
  const currentPrompt = prompts[safeIndex] ?? "";
  const totalPrompts = prompts.length;

  // Local state for prompt to prevent cursor jumping during typing
  const [localPrompt, setLocalPrompt] = useState(currentPrompt);
  const [isEditing, setIsEditing] = useState(false);

  // Variable naming dialog state
  const [showVarDialog, setShowVarDialog] = useState(false);
  const [varNameInput, setVarNameInput] = useState(nodeData.variableName || "");

  // JSON mode validation
  const jsonMode = nodeData.jsonMode ?? false;
  const jsonValid = useMemo(() => {
    if (!jsonMode || !localPrompt.trim()) return true;
    try {
      JSON.parse(localPrompt);
      return true;
    } catch {
      return false;
    }
  }, [jsonMode, localPrompt]);

  const handleToggleJsonMode = useCallback(() => {
    const newMode = !jsonMode;
    if (newMode && localPrompt.trim()) {
      // Try to auto-format as JSON when switching to JSON mode
      try {
        const parsed = JSON.parse(localPrompt);
        const formatted = JSON.stringify(parsed, null, 2);
        setLocalPrompt(formatted);
        const newPrompts = [...prompts];
        newPrompts[safeIndex] = formatted;
        updateNodeData(id, { jsonMode: newMode, prompt: formatted, prompts: newPrompts });
        return;
      } catch {
        // Not valid JSON yet, switch anyway
      }
    }
    updateNodeData(id, { jsonMode: newMode });
  }, [jsonMode, localPrompt, prompts, safeIndex, id, updateNodeData]);

  // Check if this node has any incoming text connections
  const hasIncomingTextConnection = useMemo(() => {
    return edges.some((edge) => edge.target === id && edge.targetHandle === "text");
  }, [edges, id]);

  // Track the last received text from connected LLM node to detect when it changes
  const lastReceivedTextRef = useRef<string | null>(null);

  // Get connected text input and update prompt when LLM output changes
  useEffect(() => {
    if (hasIncomingTextConnection) {
      const { text } = getConnectedInputs(id);
      // Only update if the incoming text changed (LLM node ran again)
      if (text !== null && text !== lastReceivedTextRef.current) {
        lastReceivedTextRef.current = text;
        const newPrompts = [...prompts];
        newPrompts[safeIndex] = text;
        updateNodeData(id, { prompt: text, prompts: newPrompts });
      }
    } else {
      // Clear tracking when connection is removed
      lastReceivedTextRef.current = null;
    }
  }, [hasIncomingTextConnection, id, getConnectedInputs, updateNodeData, prompts, safeIndex]);

  // Sync local prompt when active index changes or when not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalPrompt(currentPrompt);
    }
  }, [currentPrompt, isEditing]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalPrompt(e.target.value);
    },
    []
  );

  const handleFocus = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (localPrompt !== currentPrompt) {
      const newPrompts = [...prompts];
      newPrompts[safeIndex] = localPrompt;
      updateNodeData(id, { prompt: localPrompt, prompts: newPrompts });
    }
  }, [id, localPrompt, currentPrompt, prompts, safeIndex, updateNodeData]);

  const handleOpenModal = useCallback(() => {
    setIsModalOpenLocal(true);
    incrementModalCount();
  }, [incrementModalCount]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpenLocal(false);
    decrementModalCount();
  }, [decrementModalCount]);

  const handleSubmitModal = useCallback(
    (prompt: string) => {
      const newPrompts = [...prompts];
      newPrompts[safeIndex] = prompt;
      updateNodeData(id, { prompt, prompts: newPrompts });
    },
    [id, prompts, safeIndex, updateNodeData]
  );

  const handleSaveVariableName = useCallback(() => {
    updateNodeData(id, { variableName: varNameInput || undefined });
    setShowVarDialog(false);
  }, [id, varNameInput, updateNodeData]);

  const handleClearVariableName = useCallback(() => {
    setVarNameInput("");
    updateNodeData(id, { variableName: undefined });
    setShowVarDialog(false);
  }, [id, updateNodeData]);

  const handleVariableNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only alphanumeric and underscore, max 30 chars
    const sanitized = e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30);
    setVarNameInput(sanitized);
  }, []);

  const handleToggleAppInput = useCallback(() => {
    updateNodeData(id, {
      isAppInput: !nodeData.isAppInput,
    });
  }, [id, nodeData.isAppInput, updateNodeData]);

  // Prompt stack navigation
  const handleAddPrompt = useCallback(() => {
    const newPrompts = [...prompts, ""];
    const newIndex = newPrompts.length - 1;
    updateNodeData(id, { prompts: newPrompts, activePromptIndex: newIndex, prompt: "" });
  }, [id, prompts, updateNodeData]);

  const handlePrevPrompt = useCallback(() => {
    if (safeIndex > 0) {
      // Flush any pending local edits before navigating
      const newPrompts = [...prompts];
      newPrompts[safeIndex] = localPrompt;
      const newIndex = safeIndex - 1;
      updateNodeData(id, {
        prompts: newPrompts,
        activePromptIndex: newIndex,
        prompt: newPrompts[newIndex],
      });
    }
  }, [safeIndex, prompts, localPrompt, id, updateNodeData]);

  const handleNextPrompt = useCallback(() => {
    if (safeIndex < totalPrompts - 1) {
      // Flush any pending local edits before navigating
      const newPrompts = [...prompts];
      newPrompts[safeIndex] = localPrompt;
      const newIndex = safeIndex + 1;
      updateNodeData(id, {
        prompts: newPrompts,
        activePromptIndex: newIndex,
        prompt: newPrompts[newIndex],
      });
    }
  }, [safeIndex, totalPrompts, prompts, localPrompt, id, updateNodeData]);

  return (
    <>
      <BaseNode
        id={id}
        title="Prompt"
        customTitle={nodeData.customTitle}
        comment={nodeData.comment}
        onCustomTitleChange={(title) => updateNodeData(id, { customTitle: title || undefined })}
        onCommentChange={(comment) => updateNodeData(id, { comment: comment || undefined })}
        onExpand={handleOpenModal}
        selected={selected}
        commentNavigation={commentNavigation ?? undefined}
        nodeAccentColor="blue"
        titlePrefix={
          nodeData.isAppInput ? (
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] shrink-0" title="App Input" />
          ) : null
        }
        headerButtons={
          <>
            {/* JSON Mode Toggle */}
            <div className="relative ml-2 shrink-0 group">
              <button
                onClick={handleToggleJsonMode}
                className={`nodrag nopan p-0.5 rounded transition-all duration-200 ease-in-out flex items-center overflow-hidden group-hover:pr-2 ${jsonMode
                    ? "text-[var(--accent-primary)] hover:text-blue-200 border border-[var(--accent-primary)]/50"
                    : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
                  }`}
                title={jsonMode ? "JSON mode (click to switch to text)" : "Text mode (click to switch to JSON)"}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
                <span className="max-w-0 opacity-0 whitespace-nowrap text-[10px] transition-all duration-200 ease-in-out overflow-hidden group-hover:max-w-[60px] group-hover:opacity-100 group-hover:ml-1">
                  {jsonMode ? "JSON" : "Text"}
                </span>
              </button>
            </div>
            <div className="relative ml-2 shrink-0 group">
              <button
                onClick={handleToggleAppInput}
                className={`nodrag nopan p-0.5 rounded transition-all duration-200 ease-in-out flex items-center overflow-hidden group-hover:pr-2 ${nodeData.isAppInput
                    ? "text-[var(--accent-primary)] hover:text-blue-200 border border-[var(--accent-primary)]/50"
                    : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
                  }`}
                title={nodeData.isAppInput ? "Enabled as App Input" : "Enable as App Input"}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="max-w-0 opacity-0 whitespace-nowrap text-[10px] transition-all duration-200 ease-in-out overflow-hidden group-hover:max-w-[60px] group-hover:opacity-100 group-hover:ml-1">
                  {nodeData.isAppInput ? "App Input" : "Input"}
                </span>
              </button>
            </div>
            <div className="relative ml-2 shrink-0 group">
              <button
                onClick={() => setShowVarDialog(true)}
                className={`nodrag nopan p-0.5 rounded transition-all duration-200 ease-in-out flex items-center overflow-hidden group-hover:pr-2 ${nodeData.variableName
                    ? "text-[var(--accent-primary)] hover:text-blue-200 border border-[var(--accent-primary)]/50"
                    : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
                  }`}
                title={nodeData.variableName ? `Variable: @${nodeData.variableName}` : "Set variable name"}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 12h4m0 0l-4-4m4 4l-4 4m-8-4H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <span className="max-w-0 opacity-0 whitespace-nowrap text-[10px] transition-all duration-200 ease-in-out overflow-hidden group-hover:max-w-[60px] group-hover:opacity-100 group-hover:ml-1">
                  {nodeData.variableName ? `@${nodeData.variableName}` : "Variable"}
                </span>
              </button>
            </div>
          </>
        }
      >
        {/* Text input handle - for receiving text from LLM nodes */}
        <Handle
          type="target"
          position={Position.Left}
          id="text"
          data-handletype="text"
        />

        <div className="relative flex-1 flex flex-col gap-1">
          <textarea
            value={localPrompt}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={jsonMode
              ? '{\n  "key": "value"\n}'
              : hasIncomingTextConnection ? "Text from connected node (editable)..." : "Describe what to generate..."
            }
            className={`nodrag nopan nowheel w-full flex-1 min-h-[70px] p-2 text-xs leading-relaxed text-[var(--text-primary)] border rounded bg-[var(--bg-base)]/50 resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-muted)] ${
              jsonMode ? "font-['DM_Mono',monospace] tabular-nums" : ""
            } ${
              jsonMode && localPrompt.trim() && !jsonValid
                ? "border-[var(--node-error)]/60"
                : "border-[var(--border-subtle)] focus:border-[var(--border-subtle)]"
            }`}
          />
          {/* JSON validation indicator */}
          {jsonMode && localPrompt.trim() && (
            <div className={`text-[10px] px-0.5 ${jsonValid ? "text-[var(--node-success)]" : "text-[var(--node-error)]"}`}>
              {jsonValid ? "Valid JSON" : "Invalid JSON"}
            </div>
          )}
          {nodeData.variableName && (
            <div className="text-[10px] text-[var(--accent-primary)] px-0.5">
              @{nodeData.variableName}
            </div>
          )}
          {/* Prompt stack nav bar */}
          <div className="flex items-center justify-between px-0.5">
            <button
              onClick={handleAddPrompt}
              className="nodrag nopan text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-[120ms]"
              title="Add a new prompt slot"
            >
              + Add
            </button>
            {totalPrompts > 1 && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handlePrevPrompt}
                  disabled={safeIndex === 0}
                  className="nodrag nopan text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-[120ms] px-1"
                  title="Previous prompt"
                >
                  ‹
                </button>
                <span className="text-[10px] text-[var(--text-secondary)] min-w-[28px] text-center tabular-nums">
                  {safeIndex + 1} / {totalPrompts}
                </span>
                <button
                  onClick={handleNextPrompt}
                  disabled={safeIndex === totalPrompts - 1}
                  className="nodrag nopan text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-[120ms] px-1"
                  title="Next prompt"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Text output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="text"
          data-handletype="text"
        />
      </BaseNode>

      {/* Prompt Editor Modal - rendered via portal to escape React Flow stacking context */}
      {isModalOpenLocal && createPortal(
        <PromptEditorModal
          isOpen={isModalOpenLocal}
          initialPrompt={currentPrompt}
          onSubmit={handleSubmitModal}
          onClose={handleCloseModal}
        />,
        document.body
      )}

      {/* Variable Naming Dialog - rendered via portal */}
      {showVarDialog && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-xl p-4 w-96">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Set Variable Name</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              Use this prompt as a variable in PromptConstructor nodes
            </p>
            <div className="mb-4">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Variable name</label>
              <input
                type="text"
                value={varNameInput}
                onChange={handleVariableNameChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && varNameInput) {
                    handleSaveVariableName();
                  }
                }}
                placeholder="e.g. color, style, subject"
                className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                autoFocus
              />
              {varNameInput && (
                <div className="mt-2 text-xs text-[var(--accent-primary)]">
                  Preview: <span className="font-mono">@{varNameInput}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              {nodeData.variableName && (
                <button
                  onClick={handleClearVariableName}
                  className="px-3 py-1.5 text-xs font-medium text-[var(--node-error)] hover:text-red-300 hover:bg-red-900/30 rounded transition-all duration-[120ms]"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setShowVarDialog(false)}
                className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] rounded transition-all duration-[120ms]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVariableName}
                disabled={!varNameInput}
                className="px-3 py-1.5 text-xs font-medium text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-[120ms]"
              >
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
