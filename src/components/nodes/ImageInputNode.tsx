"use client";

import { useCallback, useRef } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useCommentNavigation } from "@/hooks/useCommentNavigation";
import { useWorkflowStore } from "@/store/workflowStore";
import { ImageInputNodeData } from "@/types";

type ImageInputNodeType = Node<ImageInputNodeData, "imageInput">;

export function ImageInputNode({ id, data, selected }: NodeProps<ImageInputNodeType>) {
  const nodeData = data;
  const commentNavigation = useCommentNavigation(id);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
        alert("Unsupported format. Use PNG, JPG, or WebP.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert("Image too large. Maximum size is 10MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          updateNodeData(id, {
            image: base64,
            imageRef: undefined,
            filename: file.name,
            dimensions: { width: img.width, height: img.height },
          });
        };
        img.src = base64;
      };
      reader.readAsDataURL(file);
    },
    [id, updateNodeData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemove = useCallback(() => {
    updateNodeData(id, {
      image: null,
      imageRef: undefined,
      filename: null,
      dimensions: null,
    });
  }, [id, updateNodeData]);

  const handleToggleAppInput = useCallback(() => {
    updateNodeData(id, {
      isAppInput: !nodeData.isAppInput,
    });
  }, [id, nodeData.isAppInput, updateNodeData]);

  return (
    <BaseNode
      id={id}
      title="Image"
      customTitle={nodeData.customTitle}
      comment={nodeData.comment}
      onCustomTitleChange={(title) => updateNodeData(id, { customTitle: title || undefined })}
      onCommentChange={(comment) => updateNodeData(id, { comment: comment || undefined })}
      selected={selected}
      commentNavigation={commentNavigation ?? undefined}
      nodeAccentColor="green"
      titlePrefix={
        nodeData.isAppInput ? (
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] shrink-0" title="App Input" />
        ) : null
      }
      headerButtons={
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
      }
    >
      {/* Reference input handle for visual links from Split Grid node */}
      <Handle
        type="target"
        position={Position.Left}
        id="reference"
        data-handletype="reference"
        className="!bg-gray-500"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {nodeData.image ? (
        <div className="relative group flex-1 flex flex-col min-h-0">
          <img
            src={nodeData.image}
            alt={nodeData.filename || "Uploaded image"}
            className="w-full flex-1 min-h-0 object-contain rounded"
          />
          <button
            onClick={handleRemove}
            className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="mt-1.5 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-[var(--text-secondary)] truncate max-w-[120px]">
              {nodeData.filename}
            </span>
            {nodeData.dimensions && (
              <span className="text-[10px] text-[var(--text-muted)]">
                {nodeData.dimensions.width}x{nodeData.dimensions.height}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="w-full flex-1 min-h-[112px] border border-dashed border-[var(--border-subtle)] rounded flex flex-col items-center justify-center cursor-pointer hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]/50 transition-all duration-[120ms]"
        >
          <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="text-[10px] text-[var(--text-secondary)] mt-1">
            Drop or click
          </span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="image"
        data-handletype="image"
      />
    </BaseNode>
  );
}
