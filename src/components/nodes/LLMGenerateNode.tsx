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
];

const MODELS: Record<LLMProvider, { value: LLMModelType; label: string }[]> = {
  google: [
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-3-pro-preview", label: "Gemini 3.0 Pro" },
  ],
  openai: [
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
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
          <div className={`nodrag nopan nowheel relative w-full flex flex-col border border-dashed border-neutral-600 rounded p-2 ${viewMode === "full" ? "flex-1 min-h-0" : ""}`}>
            {nodeData.status === "loading" ? (
              <div className="h-[80px] flex items-center justify-center">
                <svg
                  className="w-4 h-4 animate-spin text-neutral-400"
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
                <span className="text-[10px] text-red-400">
                  {nodeData.error || "Failed"}
                </span>
              </div>
            ) : totalPages > 0 ? (
              <>
                {/* Pagination bar */}
                <div className="flex items-center gap-1 shrink-0 mb-1">
                  <button
                    onClick={() => setViewMode(m => m === "compact" ? "full" : "compact")}
                    className="text-[10px] text-neutral-400 hover:text-neutral-200 transition-colors px-0.5"
                    title={viewMode === "compact" ? "Expand output" : "Collapse output"}
                  >
                    ⊡
                  </button>
                  <button
                    onClick={goToPrev}
                    disabled={currentIndex === 0}
                    className="text-[10px] text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-0.5"
                    title="Previous output"
                  >
                    ‹
                  </button>
                  <span className="text-[10px] text-neutral-300 min-w-[32px] text-center">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    onClick={goToNext}
                    disabled={currentIndex >= history.length - 1}
                    className="text-[10px] text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-0.5"
                    title="Next output"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="text-[10px] text-neutral-400 hover:text-neutral-200 transition-colors px-0.5"
                    title="Open full text"
                  >
                    ↗
                  </button>
                  {/* Action buttons pushed right */}
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={handleCopyOutput}
                      className={`w-5 h-5 ${copied ? "bg-green-600/80" : "bg-neutral-900/80 hover:bg-neutral-700/80"} rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors`}
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
                      className="w-5 h-5 bg-neutral-900/80 hover:bg-blue-600/80 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                      title="Regenerate"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={handleClearOutput}
                      className="w-5 h-5 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
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
                  <p className="text-xs text-neutral-300 whitespace-pre-wrap break-words">
                    {displayText}
                  </p>
                </div>
              </>
            ) : (
              <div className="h-[80px] flex items-center justify-center">
                <span className="text-neutral-500 text-[10px]">
                  Run to generate
                </span>
              </div>
            )}
          </div>

          {/* Provider selector */}
          <select
            value={provider}
            onChange={handleProviderChange}
            className="w-full text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 focus:outline-none focus:ring-1 focus:ring-neutral-600 text-neutral-300 shrink-0"
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
            className="w-full text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 focus:outline-none focus:ring-1 focus:ring-neutral-600 text-neutral-300 shrink-0"
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
              className="w-full flex items-center justify-between text-[9px] text-neutral-400 hover:text-neutral-300 py-1"
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
              <div className="flex flex-col gap-2 pt-1 border-t border-neutral-700/50">
                {/* Temperature slider */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] text-neutral-500">Temperature: {nodeData.temperature.toFixed(1)}</label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={nodeData.temperature}
                    onChange={handleTemperatureChange}
                    className="nodrag w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-neutral-400"
                  />
                </div>
                {/* Max tokens slider */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] text-neutral-500">Max Tokens: {nodeData.maxTokens.toLocaleString()}</label>
                  <input
                    type="range"
                    min="256"
                    max="16384"
                    step="256"
                    value={nodeData.maxTokens}
                    onChange={handleMaxTokensChange}
                    className="nodrag w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-neutral-400"
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
            className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl flex flex-col w-[640px] max-w-[90vw] max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 shrink-0">
              <span className="text-sm font-medium text-neutral-200">
                LLM Output
                {totalPages > 1 && (
                  <span className="ml-2 text-xs text-neutral-500">{currentPage} / {totalPages}</span>
                )}
              </span>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-neutral-400 hover:text-neutral-200 transition-colors"
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
              className="flex-1 min-h-0 p-4 text-sm text-neutral-100 bg-transparent resize-none focus:outline-none leading-relaxed"
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
