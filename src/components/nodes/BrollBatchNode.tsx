"use client";

import React, { useCallback } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { BrollBatchNodeData } from "@/types";

type BrollBatchNodeType = Node<BrollBatchNodeData, "brollBatch">;

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-neutral-600",
  loading: "bg-yellow-500 animate-pulse",
  complete: "bg-emerald-500",
  error: "bg-red-500",
};

export function BrollBatchNode({ id, data, selected }: NodeProps<BrollBatchNodeType>) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);

  const handleRegenerate = useCallback(() => regenerateNode(id), [id, regenerateNode]);

  const handleShotCountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const count = Math.max(1, Math.min(8, parseInt(e.target.value) || 1));
      // Resize shots array to match new count
      const existing = data.shots || [];
      const shots = Array.from({ length: count }, (_, i) => existing[i] ?? {
        index: i,
        prompt: "",
        status: "idle" as const,
        videoUrl: null,
        error: null,
      });
      updateNodeData(id, { shotCount: count, shots });
    },
    [id, data.shots, updateNodeData]
  );

  const handleDurationChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { duration: e.target.value as "4" | "8" });
    },
    [id, updateNodeData]
  );

  const handleRunModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { runMode: e.target.value as "sequential" | "parallel" });
    },
    [id, updateNodeData]
  );

  const shotCount = data.shotCount || 4;
  const shots = data.shots || [];

  // Build evenly-spaced output handle positions
  const shotPositions = Array.from({ length: shotCount }, (_, i) => {
    return ((i + 1) / (shotCount + 1)) * 100;
  });

  return (
    <BaseNode
      id={id}
      title="Broll Batch"
      customTitle={data.customTitle}
      comment={data.comment}
      onCustomTitleChange={(t) => updateNodeData(id, { customTitle: t || undefined })}
      onCommentChange={(c) => updateNodeData(id, { comment: c || undefined })}
      onRun={handleRegenerate}
      selected={selected}
      isExecuting={isRunning}
      hasError={data.status === "error"}
    >
      {/* Input: blueprint image */}
      <Handle
        type="target"
        position={Position.Left}
        id="blueprint"
        style={{ top: "35%" }}
        data-handletype="image"
        isConnectable
      />
      <div
        className="absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
        style={{ right: "calc(100% + 8px)", top: "calc(35% - 18px)", color: "var(--handle-color-image)" }}
      >
        Blueprint
      </div>

      {/* Input: shot prompt template */}
      <Handle
        type="target"
        position={Position.Left}
        id="template"
        style={{ top: "65%" }}
        data-handletype="text"
        isConnectable
      />
      <div
        className="absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
        style={{ right: "calc(100% + 8px)", top: "calc(65% - 18px)", color: "var(--handle-color-text)" }}
      >
        Shot Template
      </div>

      {/* Output handles — one per shot */}
      {shotPositions.map((topPct, i) => (
        <React.Fragment key={`shot-${i}`}>
          <Handle
            type="source"
            position={Position.Right}
            id={`shot-${i}`}
            style={{ top: `${topPct}%` }}
            data-handletype="video"
          />
          <div
            className="absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
            style={{ left: "calc(100% + 8px)", top: `calc(${topPct}% - 18px)`, color: "var(--handle-color-image)" }}
          >
            Shot {i + 1}
          </div>
        </React.Fragment>
      ))}

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Controls */}
        <div className="flex gap-2 shrink-0">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-neutral-500 uppercase tracking-wider">Shots</label>
            <input
              type="number"
              min={1}
              max={8}
              value={shotCount}
              onChange={handleShotCountChange}
              className="nodrag nopan w-14 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] text-neutral-500 uppercase tracking-wider">Duration</label>
            <select
              value={data.duration}
              onChange={handleDurationChange}
              className="nodrag nopan w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
            >
              <option value="4">4s</option>
              <option value="8">8s</option>
            </select>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[10px] text-neutral-500 uppercase tracking-wider">Mode</label>
            <select
              value={data.runMode}
              onChange={handleRunModeChange}
              className="nodrag nopan w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
            >
              <option value="parallel">Parallel</option>
              <option value="sequential">Sequential</option>
            </select>
          </div>
        </div>

        {/* Shot status grid */}
        <div className="flex-1 min-h-0 flex flex-col gap-1.5">
          <label className="text-[10px] text-neutral-500 uppercase tracking-wider shrink-0">Shot Status</label>
          <div className="flex-1 grid gap-1.5 overflow-hidden" style={{ gridTemplateColumns: `repeat(${Math.min(shotCount, 4)}, 1fr)` }}>
            {Array.from({ length: shotCount }, (_, i) => {
              const shot = shots[i];
              const status = shot?.status || "idle";
              const hasVideo = !!shot?.videoUrl;

              return (
                <div
                  key={i}
                  className="relative bg-neutral-800/80 border border-neutral-700 rounded overflow-hidden flex flex-col items-center justify-center min-h-[48px]"
                >
                  {hasVideo ? (
                    <video
                      src={shot.videoUrl!}
                      className="w-full h-full object-cover absolute inset-0"
                      muted
                      loop
                      autoPlay
                      playsInline
                    />
                  ) : null}

                  <div className="relative z-10 flex flex-col items-center gap-1 p-1">
                    <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
                    <span className="text-[9px] text-neutral-400 font-medium">Shot {i + 1}</span>
                    {shot?.error && (
                      <span className="text-[8px] text-red-400 text-center leading-tight">{shot.error}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Overall status */}
        {data.status === "error" && data.error && (
          <div className="text-[10px] text-red-400 text-center shrink-0">{data.error}</div>
        )}
        {data.status === "loading" && (
          <div className="text-[10px] text-neutral-400 text-center shrink-0 flex items-center justify-center gap-1">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Rendering {shotCount} shots...
          </div>
        )}
        {data.status === "idle" && shots.length === 0 && (
          <div className="text-[10px] text-neutral-600 text-center shrink-0">
            Connect blueprint + template → Run
          </div>
        )}
      </div>
    </BaseNode>
  );
}
