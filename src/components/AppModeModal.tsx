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
      // Important: read from getState to get fresh states!
      const currentNodes = useWorkflowStore.getState().nodes;
      const outputNodes = currentNodes.filter(
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
  }, [appInputNodes, inputValues, updateNodeData, executeWorkflow, previousRuns]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 font-['DM_Mono',monospace]">
      <div className="w-full max-w-6xl h-[90vh] flex flex-col border border-[#333] bg-[#0a0a0a] shadow-[0_0_40px_rgba(0,0,0,0.8)]">

        {/* Header - Terminal Style */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#111]">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
            <h2 className="text-[13px] font-bold tracking-widest text-[#888] uppercase">NODE_APP_ENV <span className="text-[#444]">v1.0.0</span></h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-white transition-colors text-[12px] font-bold"
          >
            [CLOSE]
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">

          {/* Left Panel: Inputs */}
          <div className="w-full md:w-1/3 flex flex-col border-r border-[#333] bg-[#0a0a0a]">
            <div className="px-4 py-2 border-b border-[#222] bg-[#111]">
              <span className="text-[10px] text-[#00ffcc] uppercase tracking-widest">--- INPUT_PARAMS ---</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {appInputNodes.length === 0 ? (
                <div className="text-[#666] text-xs leading-relaxed">
                  <span className="text-red-400">ERR:</span> NO_INPUTS_DEFINED<br />
                  <span className="text-[#444]">► Set "App Input" toggle on Prompt or ImageInput nodes in the editor to make them appear here.</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {appInputNodes.map((node) => {
                    const label = node.data.customTitle || (node.type === "prompt" ? "PROMPT_TEXT" : "SOURCE_IMAGE");
                    const isPrompt = node.type === "prompt";

                    return (
                      <div key={node.id} className="space-y-2 group">
                        <label className="flex items-center gap-2 text-[11px] text-[#666] uppercase tracking-wider group-focus-within:text-[#00ffcc] transition-colors">
                          <span className="text-[#444]">{'>'}</span> {label}
                        </label>
                        {isPrompt ? (
                          <textarea
                            value={(inputValues[node.id] as string) || ""}
                            onChange={(e) => handleInputChange(node.id, e.target.value)}
                            placeholder="Awaiting input..."
                            className="w-full px-3 py-2 bg-[#111] border border-[#333] focus:border-[#00ffcc] text-[#ddd] text-[13px] font-['DM_Mono',monospace] placeholder:text-[#444] focus:outline-none focus:ring-1 focus:ring-[#00ffcc]/30 transition-all resize-y min-h-[80px]"
                          />
                        ) : (
                          <div className="space-y-2">
                            <label className="flex flex-col items-center justify-center w-full h-24 border border-dashed border-[#444] hover:border-[#00ffcc] hover:bg-[#111] transition-all cursor-pointer">
                              <span className="text-[#666] text-[11px] uppercase tracking-wider">[ UPLOAD_DATA ]</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(node.id, file);
                                }}
                              />
                            </label>
                            {inputValues[node.id] && (
                              <div className="relative border border-[#333] bg-[#000] p-1">
                                <img
                                  src={inputValues[node.id] as string}
                                  alt="Preview"
                                  className="w-full h-auto object-contain opacity-80"
                                />
                                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/80 text-[#00ffcc] text-[9px]">LOADED_BLOB</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Run Button Area */}
            <div className="p-4 border-t border-[#333] bg-[#0a0a0a]">
              <button
                onClick={handleRun}
                disabled={isRunning || appInputNodes.length === 0}
                className="w-full relative group overflow-hidden border border-[#333] bg-[#111] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#00ffcc] transition-colors"
              >
                <div className="absolute inset-0 bg-[#00ffcc]/10 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <div className="relative px-4 py-3 flex items-center justify-center gap-2">
                  {isRunning ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                      <span className="text-[12px] font-bold tracking-widest text-yellow-400 uppercase">
                        [ EXEC_SEQUENCE_ACTIVE ]
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-[#00ffcc]" />
                      <span className="text-[12px] font-bold tracking-widest text-[#00ffcc] uppercase">
                        [ INIT_SEQUENCE ]
                      </span>
                    </>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Right Panel: Output */}
          <div className="w-full md:w-2/3 flex flex-col bg-[#050505] relative">
            <div className="px-4 py-2 border-b border-[#222] bg-[#111] flex justify-between items-center z-10">
              <span className="text-[10px] text-[#ff3366] uppercase tracking-widest">--- SYSTEM_OUTPUT ---</span>
              <button
                onClick={() => setShowPreviousRuns(!showPreviousRuns)}
                className="text-[10px] text-[#666] hover:text-white transition-colors"
              >
                {showPreviousRuns ? "[ HIDE_CACHE ]" : "[ VIEW_CACHE ]"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col custom-scrollbar relative">
              {isRunning && outputImages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 border border-[#333] relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 border-t-2 border-[#00ffcc] animate-spin"></div>
                    <span className="text-xs text-[#666] font-bold">SYS</span>
                  </div>
                  <div className="text-[#00ffcc] text-[11px] uppercase tracking-widest animate-pulse">Processing Block...</div>
                  <div className="text-[10px] text-[#444] max-w-sm text-center">Allocating secure threads and generating outputs.</div>
                </div>
              ) : outputImages.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-max">
                  {outputImages.map((img, idx) => (
                    <div key={idx} className="relative group border border-[#222] bg-black p-1 hover:border-[#444] transition-colors">
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/80 text-[#ff3366] text-[9px] z-10 border border-[#333]">OUT_{String(idx).padStart(2, '0')}</div>
                      <img
                        src={img}
                        alt={`Output ${idx + 1}`}
                        className="w-full h-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  ))}
                  {/* Append spinner at end if still running with partial outputs */}
                  {isRunning && (
                    <div className="flex items-center justify-center border border-dashed border-[#222] min-h-[150px]">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full border border-t-[var(--accent-primary)] animate-spin border-[#444]"></div>
                        <span className="text-[#555] text-[10px] tracking-widest">AWAITING_ITERATION...</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-[#222]">
                  <span className="text-[#333] text-2xl mb-2">{'//'}</span>
                  <span className="text-[#444] text-[11px] uppercase tracking-widest">No output blocks allocated</span>
                </div>
              )}
            </div>

            {/* Previous Runs Overlay Panel */}
            {showPreviousRuns && previousRuns.length > 0 && (
              <div className="absolute top-[36px] right-0 w-72 max-h-[calc(100%-36px)] overflow-y-auto bg-[#0a0a0a]/95 backdrop-blur-md border-l border-b border-[#333] flex flex-col shadow-[-10px_10px_30px_rgba(0,0,0,0.8)] z-50 custom-scrollbar">
                <div className="px-3 py-2 border-b border-[#222] bg-[#111]">
                  <span className="text-[10px] text-[#aaa] uppercase tracking-widest">CACHE_INDEX</span>
                </div>
                <div className="flex-1 p-3 space-y-3">
                  {previousRuns.map((run, idx) => (
                    <div
                      key={idx}
                      className="border border-[#222] p-2 hover:border-[#00ffcc] bg-[#000] cursor-pointer transition-colors group"
                      onClick={() => setOutputImages(run.images)}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] text-[#555] group-hover:text-[#888] font-bold">
                          {new Date(run.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-[9px] text-[#00ffcc] opacity-0 group-hover:opacity-100">[RESTORE]</span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                        {run.images.slice(0, 4).map((img, imgIdx) => (
                          <div key={imgIdx} className="w-10 h-10 shrink-0 border border-[#333] bg-black">
                            <img src={img} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-100" />
                          </div>
                        ))}
                        {run.images.length > 4 && (
                          <div className="w-10 h-10 shrink-0 border border-[#222] flex items-center justify-center bg-[#111]">
                            <span className="text-[9px] text-[#666]">+{run.images.length - 4}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
