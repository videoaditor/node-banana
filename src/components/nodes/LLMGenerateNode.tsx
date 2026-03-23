"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useCommentNavigation } from "@/hooks/useCommentNavigation";
import { useWorkflowStore } from "@/store/workflowStore";
import { LLMGenerateNodeData, LLMProvider, LLMModelType } from "@/types";

const PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "google", label: "Google" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "groq", label: "Groq" },
];

const MODELS: Record<LLMProvider, { value: LLMModelType; label: string }[]> = {
  google: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
  openai: [
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
  ],
  groq: [
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B" },
    { value: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 70B" },
  ],
};

type LLMGenerateNodeType = Node<LLMGenerateNodeData, "llmGenerate">;

export function LLMGenerateNode({ id, data, selected }: NodeProps<LLMGenerateNodeType>) {
  const nodeData = data;
  const commentNavigation = useCommentNavigation(id);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const handleProviderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newProvider = e.target.value as LLMProvider;
      const firstModelForProvider = MODELS[newProvider][0].value;
      updateNodeData(id, {
        provider: newProvider,
        model: firstModelForProvider
      });
    },
    [id, updateNodeData]
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { model: e.target.value as LLMModelType });
    },
    [id, updateNodeData]
  );

  const handleTemperatureChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { temperature: parseFloat(e.target.value) });
    },
    [id, updateNodeData]
  );

  const handleMaxTokensChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { maxTokens: parseInt(e.target.value, 10) });
    },
    [id, updateNodeData]
  );

  const [showParams, setShowParams] = useState(false);
  const [viewMode, setViewMode] = useState<"compact" | "full">("compact");
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);

  const handleRegenerate = useCallback(() => {
    regenerateNode(id);
  }, [id, regenerateNode]);

  const handleClearOutput = useCallback(() => {
    updateNodeData(id, {
      outputText: null,
      outputHistory: [],
      selectedHistoryIndex: -1,
      status: "idle",
      error: null,
    });
  }, [id, updateNodeData]);

  // History / pagination
  const history = nodeData.outputHistory ?? (nodeData.outputText ? [nodeData.outputText] : []);
  const storedIndex = nodeData.selectedHistoryIndex ?? -1;
  const currentIndex = storedIndex === -1 ? history.length - 1 : Math.min(storedIndex, history.length - 1);
  const displayText = history.length > 0 ? history[currentIndex] : null;
  const totalPages = history.length;
  const currentPage = totalPages > 0 ? currentIndex + 1 : 0;

  const goToPrev = useCallback(() => {
    const newIdx = Math.max(0, currentIndex - 1);
    updateNodeData(id, { selectedHistoryIndex: newIdx });
  }, [id, currentIndex, updateNodeData]);

  const goToNext = useCallback(() => {
    const newIdx = currentIndex + 1;
    // If advancing to last entry, store -1 (latest)
    const storeIdx = newIdx >= history.length - 1 ? -1 : newIdx;
    updateNodeData(id, { selectedHistoryIndex: storeIdx });
  }, [id, currentIndex, history.length, updateNodeData]);

  const handleCopyOutput = useCallback(async () => {
    if (displayText) {
      try {
        await navigator.clipboard.writeText(displayText);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch (err) {
        console.error("Failed to copy text:", err);
      }
    }
  }, [displayText]);

  const provider = nodeData.provider || "google";
  const availableModels = MODELS[provider] || MODELS.google;
  const model = availableModels.some(m => m.value === nodeData.model)
    ? nodeData.model
    : availableModels[0].value;

  return (
    <>
      <BaseNode
        id={id}
        title="LLM Generate"
        customTitle={nodeData.customTitle}
        comment={nodeData.comment}
        onCustomTitleChange={(title) => updateNodeData(id, { customTitle: title || undefined })}
        onCommentChange={(comment) => updateNodeData(id, { comment: comment || undefined })}
        selected={selected}
        hasError={nodeData.status === "error"}
        commentNavigation={commentNavigation ?? undefined}
        onRun={handleRegenerate}
        isExecuting={isRunning}
        nodeAccentColor="coral"
      >
        {/* Image input - optional */}
        <Handle
          type="target"
          position={Position.Left}
          id="image"
          style={{ top: "35%" }}
          data-handletype="image"
        />
        {/* Text input */}
        <Handle
          type="target"
          position={Position.Left}
          id="text"
          style={{ top: "65%" }}
          data-handletype="text"
        />
        {/* Text output */}
        <Handle
          type="source"
          position={Position.Right}
          id="text"
          data-handletype="text"
        />

        <div className="flex-1 flex flex-col min-h-0 gap-2">
          {/* Output area */}
          <div className={`nodrag nopan nowheel relative w-full flex flex-col border border-dashed border-[var(--border-subtle)] rounded p-2 ${viewMode === "full" ? "flex-1 min-h-0" : ""}`}>
            {nodeData.status === "loading" ? (
              <div className="h-[80px] flex items-center justify-center">
                <svg
                  className="w-4 h-4 animate-spin text-[var(--text-secondary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            ) : nodeData.status === "error" ? (
              <div className="min-h-[80px] flex items-center justify-center">
                <span className="text-[10px] text-[var(--node-error)]">
                  {nodeData.error || "Failed"}
                </span>
              </div>
            ) : totalPages > 0 ? (
              <>
                {/* Pagination bar */}
                <div className="flex items-center gap-1 shrink-0 mb-1">
                  <button
                    onClick={() => setViewMode(m => m === "compact" ? "full" : "compact")}
                    className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-[120ms] px-0.5"
                    title={viewMode === "compact" ? "Expand output" : "Collapse output"}
                  >
                    ⊡
                  </button>
                  <button
                    onClick={goToPrev}
                    disabled={currentIndex === 0}
                    className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-[120ms] px-0.5"
                    title="Previous output"
                  >
                    ‹
                  </button>
                  <span className="text-[10px] text-[var(--text-secondary)] min-w-[32px] text-center">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    onClick={goToNext}
                    disabled={currentIndex >= history.length - 1}
                    className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-[120ms] px-0.5"
                    title="Next output"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-[120ms] px-0.5"
                    title="Open full text"
                  >
                    ↗
                  </button>
                  {/* Action buttons pushed right */}
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={handleCopyOutput}
                      className={`w-5 h-5 ${copied ? "bg-green-600/80" : "bg-[var(--bg-base)]/80 hover:bg-[var(--bg-surface)]/80"} rounded flex items-center justify-center text-[var(--text-secondary)] hover:text-white transition-all duration-[120ms]`}
                      title={copied ? "Copied!" : "Copy to clipboard"}
                    >
                      {copied ? (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={handleRegenerate}
                      disabled={isRunning}
                      className="w-5 h-5 bg-[var(--bg-base)]/80 hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center text-[var(--text-secondary)] hover:text-white transition-all duration-[120ms]"
                      title="Regenerate"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={handleClearOutput}
                      className="w-5 h-5 bg-[var(--bg-base)]/80 hover:bg-[var(--node-error)]/80 rounded flex items-center justify-center text-[var(--text-secondary)] hover:text-white transition-all duration-[120ms]"
                      title="Clear output"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Text area */}
                <div className={`overflow-auto ${viewMode === "full" ? "flex-1 min-h-0" : "max-h-[120px]"}`}>
                  <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words">
                    {displayText}
                  </p>
                </div>
              </>
            ) : (
              <div className="h-[80px] flex items-center justify-center">
                <span className="text-[var(--text-muted)] text-[10px]">
                  Run to generate
                </span>
              </div>
            )}
          </div>

          {/* Provider selector */}
          <select
            value={provider}
            onChange={handleProviderChange}
            className="w-full text-[10px] py-1 px-1.5 border border-[var(--border-subtle)] rounded bg-[var(--bg-base)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] text-[var(--text-secondary)] shrink-0"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {/* Model selector */}
          <select
            value={model}
            onChange={handleModelChange}
            className="w-full text-[10px] py-1 px-1.5 border border-[var(--border-subtle)] rounded bg-[var(--bg-base)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] text-[var(--text-secondary)] shrink-0"
          >
            {availableModels.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Collapsible parameters section */}
          <div className="shrink-0">
            <button
              onClick={() => setShowParams(!showParams)}
              className="w-full flex items-center justify-between text-[9px] text-[var(--text-secondary)] hover:text-[var(--text-secondary)] py-1"
            >
              <span>Parameters</span>
              <svg
                className={`w-3 h-3 transition-transform ${showParams ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showParams && (
              <div className="flex flex-col gap-2 pt-1 border-t border-[var(--border-subtle)]/50">
                {/* Temperature slider */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] text-[var(--text-muted)]">Temperature: {nodeData.temperature.toFixed(1)}</label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={nodeData.temperature}
                    onChange={handleTemperatureChange}
                    className="nodrag w-full h-1 bg-[var(--bg-surface)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
                  />
                </div>
                {/* Max tokens slider */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] text-[var(--text-muted)]">Max Tokens: {nodeData.maxTokens.toLocaleString()}</label>
                  <input
                    type="range"
                    min="256"
                    max="16384"
                    step="256"
                    value={nodeData.maxTokens}
                    onChange={handleMaxTokensChange}
                    className="nodrag w-full h-1 bg-[var(--bg-surface)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </BaseNode>

      {/* Full-text modal - rendered via portal to escape React Flow stacking context */}
      {isExpanded && createPortal(
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-lg shadow-xl flex flex-col w-[640px] max-w-[90vw] max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                LLM Output
                {totalPages > 1 && (
                  <span className="ml-2 text-xs text-[var(--text-muted)]">{currentPage} / {totalPages}</span>
                )}
              </span>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-[120ms]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Modal body */}
            <textarea
              readOnly
              value={displayText ?? ""}
              className="flex-1 min-h-0 p-4 text-sm text-[var(--text-primary)] bg-transparent resize-none focus:outline-none leading-relaxed"
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
