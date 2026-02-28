"use client";

import React, { useCallback } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { ImageIteratorNodeData } from "@/types";

type ImageIteratorNodeType = Node<ImageIteratorNodeData, "imageIterator">;

export function ImageIteratorNode({ id, data, selected }: NodeProps<ImageIteratorNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

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

  return (
    <BaseNode
      id={id}
      selected={selected}
      title="Image Iterator"
      className="bg-neutral-800 border-neutral-700"
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
        {/* Image input controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Image inputs: {nodeData.imageInputHandles}</span>
          <button
            onClick={handleAddImageInput}
            className="px-2 py-0.5 text-xs bg-neutral-700 hover:bg-neutral-600 rounded"
            title="Add image input"
          >
            +
          </button>
          <button
            onClick={handleRemoveImageInput}
            className="px-2 py-0.5 text-xs bg-neutral-700 hover:bg-neutral-600 rounded disabled:opacity-50"
            disabled={nodeData.imageInputHandles <= 1}
            title="Remove image input"
          >
            −
          </button>
        </div>

        {/* Drive folder link */}
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Drive folder link</label>
          <input
            type="text"
            value={nodeData.driveUrl}
            onChange={handleDriveUrlChange}
            placeholder="https://drive.google.com/..."
            className="w-full px-2 py-1 text-xs bg-neutral-900 border border-neutral-700 rounded focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Mode toggle */}
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => handleModeChange("all")}
              className={`px-3 py-1 text-xs rounded ${
                nodeData.mode === "all"
                  ? "bg-orange-600 text-white"
                  : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
              }`}
            >
              All images
            </button>
            <button
              onClick={() => handleModeChange("random")}
              className={`px-3 py-1 text-xs rounded ${
                nodeData.mode === "random"
                  ? "bg-orange-600 text-white"
                  : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
              }`}
            >
              Random
            </button>
          </div>
        </div>

        {/* Random count input */}
        {nodeData.mode === "random" && (
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Number of images</label>
            <input
              type="number"
              min="1"
              value={nodeData.randomCount}
              onChange={handleRandomCountChange}
              className="w-full px-2 py-1 text-xs bg-neutral-900 border border-neutral-700 rounded focus:outline-none focus:border-orange-500"
            />
          </div>
        )}

        {/* Status */}
        {nodeData.status === "loading" && (
          <div className="text-xs text-blue-400">Processing iterations...</div>
        )}
        {nodeData.error && (
          <div className="text-xs text-red-400">{nodeData.error}</div>
        )}
      </div>
    </BaseNode>
  );
}
