"use client";

import React, { useCallback, useRef, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { ImageIteratorNodeData } from "@/types";

type ImageIteratorNodeType = Node<ImageIteratorNodeData, "imageIterator">;

export function ImageIteratorNode({ id, data, selected }: NodeProps<ImageIteratorNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sourceMode = nodeData.sourceMode ?? "files";
  const localImages = nodeData.localImages ?? [];

  const handleSourceModeChange = useCallback(
    (mode: "files" | "drive") => {
      updateNodeData(id, { sourceMode: mode });
    },
    [id, updateNodeData]
  );

  const handleDriveUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { driveUrl: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleModeChange = useCallback(
    (mode: "all" | "random") => {
      updateNodeData(id, { mode });
    },
    [id, updateNodeData]
  );

  const handleRandomCountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const count = parseInt(e.target.value, 10);
      if (!isNaN(count) && count > 0) {
        updateNodeData(id, { randomCount: count });
      }
    },
    [id, updateNodeData]
  );

  const handleAddImageInput = useCallback(() => {
    updateNodeData(id, { imageInputHandles: nodeData.imageInputHandles + 1 });
  }, [id, nodeData.imageInputHandles, updateNodeData]);

  const handleRemoveImageInput = useCallback(() => {
    if (nodeData.imageInputHandles > 1) {
      updateNodeData(id, { imageInputHandles: nodeData.imageInputHandles - 1 });
    }
  }, [id, nodeData.imageInputHandles, updateNodeData]);

  // Handle file drop
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      imageFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          const current = nodeData.localImages ?? [];
          updateNodeData(id, { localImages: [...current, dataUrl] });
        };
        reader.readAsDataURL(file);
      });
    },
    [id, nodeData.localImages, updateNodeData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
      }
      e.target.value = "";
    },
    [processFiles]
  );

  const handleRemoveLocalImage = useCallback(
    (index: number) => {
      const current = nodeData.localImages ?? [];
      const updated = current.filter((_, i) => i !== index);
      updateNodeData(id, { localImages: updated });
    },
    [id, nodeData.localImages, updateNodeData]
  );

  return (
    <BaseNode
      id={id}
      selected={selected}
      title="Image Iterator"
      className="bg-[var(--bg-elevated)] border-[var(--border-subtle)]"
    >
      {/* Dynamic image input handles */}
      {Array.from({ length: nodeData.imageInputHandles }).map((_, i) => (
        <Handle
          key={`image-${i}`}
          type="target"
          position={Position.Left}
          id={`image-${i}`}
          style={{
            top: `${((i + 1) * 100) / (nodeData.imageInputHandles + 1)}%`,
            background: "#22c55e",
          }}
          title={`Image ${i + 1} input`}
        />
      ))}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        style={{ background: "#22c55e" }}
        title="Image output (per iteration)"
      />

      <div className="space-y-3 p-3">
        {/* Source mode toggle: Files / Drive */}
        <div className="flex rounded-md overflow-hidden border border-[var(--border-subtle)]">
          <button
            onClick={() => handleSourceModeChange("files")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${sourceMode === "files"
                ? "bg-emerald-600 text-white"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]"
              }`}
          >
            📁 Files
          </button>
          <button
            onClick={() => handleSourceModeChange("drive")}
            className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${sourceMode === "drive"
                ? "bg-emerald-600 text-white"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]"
              }`}
          >
            ☁️ Drive
          </button>
        </div>

        {/* Files mode: Drag & Drop zone */}
        {sourceMode === "files" && (
          <div>
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full min-h-[80px] border-2 border-dashed rounded-md flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${isDragOver
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-[var(--border-subtle)] hover:border-[var(--text-muted)] bg-[var(--bg-base)]/50"
                }`}
            >
              {localImages.length === 0 ? (
                <>
                  <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Drop images here or click to browse
                  </span>
                </>
              ) : (
                <div className="w-full p-1.5">
                  <div className="grid grid-cols-4 gap-1">
                    {localImages.map((img, idx) => (
                      <div key={idx} className="relative group aspect-square rounded overflow-hidden bg-[var(--bg-base)]">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveLocalImage(idx);
                          }}
                          className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {/* Add more indicator */}
                    <div className="aspect-square rounded border border-dashed border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] text-lg">
                      +
                    </div>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-1.5 text-center">
                    {localImages.length} image{localImages.length !== 1 ? "s" : ""}
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        )}

        {/* Drive mode: URL input */}
        {sourceMode === "drive" && (
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Drive folder link</label>
            <input
              type="text"
              value={nodeData.driveUrl}
              onChange={handleDriveUrlChange}
              placeholder="https://drive.google.com/..."
              className="w-full px-2 py-1 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-orange-500"
            />
          </div>
        )}

        {/* Image input controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">Image inputs: {nodeData.imageInputHandles}</span>
          <button
            onClick={handleAddImageInput}
            className="px-2 py-0.5 text-xs bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] rounded"
            title="Add image input"
          >
            +
          </button>
          <button
            onClick={handleRemoveImageInput}
            className="px-2 py-0.5 text-xs bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] rounded disabled:opacity-50"
            disabled={nodeData.imageInputHandles <= 1}
            title="Remove image input"
          >
            −
          </button>
        </div>

        {/* Mode toggle */}
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => handleModeChange("all")}
              className={`px-3 py-1 text-xs rounded ${nodeData.mode === "all"
                  ? "bg-orange-600 text-white"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]"
                }`}
            >
              All images
            </button>
            <button
              onClick={() => handleModeChange("random")}
              className={`px-3 py-1 text-xs rounded ${nodeData.mode === "random"
                  ? "bg-orange-600 text-white"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]"
                }`}
            >
              Random
            </button>
          </div>
        </div>

        {/* Random count input */}
        {nodeData.mode === "random" && (
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Number of images</label>
            <input
              type="number"
              min="1"
              value={nodeData.randomCount}
              onChange={handleRandomCountChange}
              className="w-full px-2 py-1 text-xs bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-orange-500"
            />
          </div>
        )}

        {/* Status */}
        {nodeData.status === "loading" && (
          <div className="text-xs text-[var(--accent-primary)]">Processing iterations...</div>
        )}
        {nodeData.error && (
          <div className="text-xs text-[var(--node-error)]">{nodeData.error}</div>
        )}
      </div>
    </BaseNode>
  );
}
