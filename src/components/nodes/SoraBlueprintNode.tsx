"use client";

import React, { useCallback, useRef } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { SoraBlueprintNodeData } from "@/types";

type SoraBlueprintNodeType = Node<SoraBlueprintNodeData, "soraBlueprint">;

export function SoraBlueprintNode({ id, data, selected }: NodeProps<SoraBlueprintNodeType>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);

  const handleRegenerate = useCallback(() => regenerateNode(id), [id, regenerateNode]);

  const handleAspectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { aspectRatio: e.target.value as SoraBlueprintNodeData["aspectRatio"] });
    },
    [id, updateNodeData]
  );

  const handleResolutionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { resolution: e.target.value as SoraBlueprintNodeData["resolution"] });
    },
    [id, updateNodeData]
  );

  const handleClear = useCallback(() => {
    updateNodeData(id, { outputBlueprint: null, status: "idle", error: null });
  }, [id, updateNodeData]);

  return (
    <BaseNode
      id={id}
      title="Sora Blueprint"
      customTitle={data.customTitle}
      comment={data.comment}
      onCustomTitleChange={(t) => updateNodeData(id, { customTitle: t || undefined })}
      onCommentChange={(c) => updateNodeData(id, { comment: c || undefined })}
      onRun={handleRegenerate}
      selected={selected}
      isExecuting={isRunning}
      hasError={data.status === "error"}
    >
      {/* Input handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="char"
        style={{ top: "35%" }}
        data-handletype="image"
        isConnectable
      />
      <div
        className="absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
        style={{ right: "calc(100% + 8px)", top: "calc(35% - 18px)", color: "var(--handle-color-image)" }}
      >
        Character
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="product"
        style={{ top: "55%" }}
        data-handletype="image"
        isConnectable
      />
      <div
        className="absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
        style={{ right: "calc(100% + 8px)", top: "calc(55% - 18px)", color: "var(--handle-color-image)" }}
      >
        Product
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="style"
        style={{ top: "75%" }}
        data-handletype="text"
        isConnectable
      />
      <div
        className="absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
        style={{ right: "calc(100% + 8px)", top: "calc(75% - 18px)", color: "var(--handle-color-text)" }}
      >
        Style
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="blueprint"
        data-handletype="image"
      />
      <div
        className="absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
        style={{ left: "calc(100% + 8px)", top: "calc(50% - 18px)", color: "var(--handle-color-image)" }}
      >
        Blueprint
      </div>

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Controls row */}
        <div className="flex gap-2 shrink-0">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] text-neutral-500 uppercase tracking-wider">Aspect</label>
            <select
              value={data.aspectRatio}
              onChange={handleAspectChange}
              className="nodrag nopan w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
            >
              <option value="9:16">9:16 (Portrait)</option>
              <option value="16:9">16:9 (Landscape)</option>
              <option value="1:1">1:1 (Square)</option>
            </select>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] text-neutral-500 uppercase tracking-wider">Resolution</label>
            <select
              value={data.resolution}
              onChange={handleResolutionChange}
              className="nodrag nopan w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
            >
              <option value="1K">1K</option>
              <option value="2K">2K</option>
            </select>
          </div>
        </div>

        {/* Preview */}
        {data.outputBlueprint ? (
          <div className="relative w-full flex-1 min-h-0">
            <img
              src={data.outputBlueprint}
              alt="Blueprint"
              className="w-full h-full object-contain rounded"
            />
            {data.status === "loading" && (
              <div className="absolute inset-0 bg-neutral-900/70 rounded flex items-center justify-center">
                <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
            <button
              onClick={handleClear}
              className="absolute top-1 right-1 w-5 h-5 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="w-full flex-1 min-h-[120px] border border-dashed border-neutral-600 rounded flex flex-col items-center justify-center gap-2">
            {data.status === "loading" ? (
              <svg className="w-5 h-5 animate-spin text-neutral-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : data.status === "error" ? (
              <span className="text-[10px] text-red-400 text-center px-2">{data.error || "Failed"}</span>
            ) : (
              <>
                <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                <span className="text-neutral-600 text-[10px]">Connect char + product → Run</span>
              </>
            )}
          </div>
        )}
      </div>
    </BaseNode>
  );
}
