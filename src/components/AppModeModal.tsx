"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import { WorkflowNode, PromptNodeData, ImageInputNodeData, OutputNodeData, OutputGalleryNodeData } from "@/types";

interface AppModeRun {
  timestamp: number;
  images: string[];
}

const MAX_RUNS = 20;

export function AppModeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const executeWorkflow = useWorkflowStore((state) => state.executeWorkflow);
  const [isRunning, setIsRunning] = useState(false);
  const [outputImages, setOutputImages] = useState<string[]>([]);
  const [showPreviousRuns, setShowPreviousRuns] = useState(false);

  // Load previous runs from localStorage
  const [previousRuns, setPreviousRuns] = useState<AppModeRun[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("appmode-runs");
    return stored ? JSON.parse(stored) : [];
  });

  // Find app input nodes (prompt and imageInput with isAppInput: true)
  const appInputNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (node.type === "prompt") {
        return (node.data as PromptNodeData).isAppInput === true;
      }
      if (node.type === "imageInput") {
        return (node.data as ImageInputNodeData).isAppInput === true;
      }
      return false;
    });
  }, [nodes]);

  // Input state for app inputs
  const [inputValues, setInputValues] = useState<Record<string, string | File>>({});

  const handleInputChange = useCallback((nodeId: string, value: string | File) => {
    setInputValues((prev) => ({ ...prev, [nodeId]: value }));
  }, []);

  const handleFileUpload = useCallback((nodeId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setInputValues((prev) => ({ ...prev, [nodeId]: result }));
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setOutputImages([]);

    try {
      // Inject app input values into nodes
      for (const node of appInputNodes) {
        const value = inputValues[node.id];
        if (value !== undefined) {
          if (node.type === "prompt") {
            updateNodeData(node.id, { prompt: value as string });
          } else if (node.type === "imageInput") {
            updateNodeData(node.id, { image: value as string });
          }
        }
      }

      // Execute workflow
      await executeWorkflow();

      // Collect outputs from output and outputGallery nodes
      const outputNodes = nodes.filter(
        (n) => n.type === "output" || n.type === "outputGallery"
      );
      const images: string[] = [];

      for (const node of outputNodes) {
        if (node.type === "output") {
          const data = node.data as OutputNodeData;
          if (data.image) {
            images.push(data.image);
          }
        } else if (node.type === "outputGallery") {
          const data = node.data as OutputGalleryNodeData;
          images.push(...data.images);
        }
      }

      setOutputImages(images);

      // Save run to localStorage
      if (images.length > 0) {
        const newRun: AppModeRun = {
          timestamp: Date.now(),
          images: images.slice(0, 10), // Store max 10 images per run
        };
        const updatedRuns = [newRun, ...previousRuns].slice(0, MAX_RUNS);
        setPreviousRuns(updatedRuns);
        localStorage.setItem("appmode-runs", JSON.stringify(updatedRuns));
      }
    } catch (error) {
      console.error("Workflow execution failed:", error);
      alert("Workflow execution failed. Check console for details.");
    } finally {
      setIsRunning(false);
    }
  }, [appInputNodes, inputValues, updateNodeData, executeWorkflow, nodes, previousRuns]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-neutral-900 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-800">
          <h2 className="text-2xl font-semibold text-neutral-100">App Mode</h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Inputs */}
            <div>
              <h3 className="text-lg font-medium text-neutral-200 mb-4">Inputs</h3>
              {appInputNodes.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No app inputs configured. Enable "App Input" toggle on Prompt or ImageInput nodes.
                </p>
              ) : (
                <div className="space-y-4">
                  {appInputNodes.map((node) => {
                    const label =
                      node.data.customTitle ||
                      (node.type === "prompt" ? "Prompt" : "Image Input");
                    const isPrompt = node.type === "prompt";

                    return (
                      <div key={node.id} className="space-y-2">
                        <label className="block text-sm font-medium text-neutral-300">
                          {label}
                        </label>
                        {isPrompt ? (
                          <textarea
                            value={(inputValues[node.id] as string) || ""}
                            onChange={(e) => handleInputChange(node.id, e.target.value)}
                            placeholder="Enter text..."
                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-orange-500 resize-none"
                            rows={3}
                          />
                        ) : (
                          <div className="space-y-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleFileUpload(node.id, file);
                                }
                              }}
                              className="w-full text-sm text-neutral-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-700 file:cursor-pointer"
                            />
                            {inputValues[node.id] && (
                              <img
                                src={inputValues[node.id] as string}
                                alt="Preview"
                                className="w-full rounded-lg border border-neutral-700"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Output */}
            <div>
              <h3 className="text-lg font-medium text-neutral-200 mb-4">Output</h3>
              {isRunning ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-sm text-neutral-400">Running workflow...</p>
                  </div>
                </div>
              ) : outputImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {outputImages.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`Output ${idx + 1}`}
                      className="w-full rounded-lg border border-neutral-700"
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-neutral-700 rounded-lg">
                  <p className="text-sm text-neutral-500">
                    Results will appear here after running
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={() => setShowPreviousRuns(!showPreviousRuns)}
            className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {showPreviousRuns ? "Hide" : "View"} previous runs
          </button>
          <button
            onClick={handleRun}
            disabled={isRunning || appInputNodes.length === 0}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-semibold rounded-lg transition-colors"
          >
            {isRunning ? "Running..." : "Run Workflow"}
          </button>
        </div>

        {/* Previous runs panel */}
        {showPreviousRuns && previousRuns.length > 0 && (
          <div className="border-t border-neutral-800 p-6 bg-neutral-950 max-h-60 overflow-y-auto">
            <h4 className="text-sm font-medium text-neutral-300 mb-3">Previous Runs</h4>
            <div className="space-y-3">
              {previousRuns.map((run, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 bg-neutral-900 rounded-lg hover:bg-neutral-800 cursor-pointer"
                  onClick={() => setOutputImages(run.images)}
                >
                  <div className="flex gap-2">
                    {run.images.slice(0, 3).map((img, imgIdx) => (
                      <img
                        key={imgIdx}
                        src={img}
                        alt=""
                        className="w-12 h-12 object-cover rounded border border-neutral-700"
                      />
                    ))}
                  </div>
                  <span className="text-xs text-neutral-500">
                    {new Date(run.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
