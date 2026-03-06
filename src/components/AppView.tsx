"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import {
    WorkflowNode,
    PromptNodeData,
    ImageInputNodeData,
    ImageIteratorNodeData,
    OutputNodeData,
    OutputGalleryNodeData,
    LLMGenerateNodeData,
} from "@/types";

interface AppOutput {
    nodeId: string;
    type: "image" | "video" | "text";
    data: string;
    label: string;
    timestamp: number;
}

export function AppView() {
    const nodes = useWorkflowStore((state) => state.nodes);
    const workflowName = useWorkflowStore((state) => state.workflowName);
    const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
    const executeWorkflow = useWorkflowStore((state) => state.executeWorkflow);
    const isRunning = useWorkflowStore((state) => state.isRunning);

    const [latestOutputs, setLatestOutputs] = useState<AppOutput[]>([]);
    const [mediaArchive, setMediaArchive] = useState<AppOutput[]>([]);
    const [showApiDocs, setShowApiDocs] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [inputValues, setInputValues] = useState<Record<string, string>>({});
    const [multiImageInputs, setMultiImageInputs] = useState<Record<string, string[]>>({});
    const [showArchive, setShowArchive] = useState(false);

    const appInputNodes = useMemo(() => {
        return nodes.filter((node) => {
            if (node.type === "prompt") return (node.data as PromptNodeData).isAppInput === true;
            if (node.type === "imageInput") return (node.data as ImageInputNodeData).isAppInput === true;
            if (node.type === "imageIterator") return (node.data as ImageIteratorNodeData).isAppInput === true;
            return false;
        });
    }, [nodes]);

    const outputNodes = useMemo(() => {
        return nodes.filter(
            (n) => n.type === "output" || n.type === "outputGallery" || n.type === "llmGenerate"
        );
    }, [nodes]);

    const apiSchema = useMemo(() => {
        const inputs = appInputNodes.map((node) => ({
            nodeId: node.id,
            type: node.type === "prompt" ? "text" : "images",
            label: node.data.customTitle || (node.type === "prompt" ? "Text Prompt" : node.type === "imageIterator" ? "Image Collection" : "Image Input"),
            required: true,
        }));
        const outs = outputNodes.map((node) => ({
            nodeId: node.id,
            type: node.type === "llmGenerate" ? "text" : "image",
            label: node.data.customTitle || "Output",
        }));
        return { inputs, outputs: outs };
    }, [appInputNodes, outputNodes]);

    const handleInputChange = useCallback((nodeId: string, value: string) => {
        setInputValues((prev) => ({ ...prev, [nodeId]: value }));
    }, []);

    const handleMultiFileUpload = useCallback((nodeId: string, files: FileList | File[]) => {
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
        imageFiles.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                setMultiImageInputs((prev) => ({
                    ...prev,
                    [nodeId]: [...(prev[nodeId] || []), result],
                }));
            };
            reader.readAsDataURL(file);
        });
    }, []);

    const handleSingleFileUpload = useCallback((nodeId: string, file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            setInputValues((prev) => ({ ...prev, [nodeId]: result }));
        };
        reader.readAsDataURL(file);
    }, []);

    const handleRemoveMultiImage = useCallback((nodeId: string, idx: number) => {
        setMultiImageInputs((prev) => ({
            ...prev,
            [nodeId]: (prev[nodeId] || []).filter((_, i) => i !== idx),
        }));
    }, []);

    const handleRun = useCallback(async () => {
        setLatestOutputs([]);

        try {
            for (const node of appInputNodes) {
                if (node.type === "prompt") {
                    const value = inputValues[node.id];
                    if (value !== undefined) updateNodeData(node.id, { prompt: value });
                } else if (node.type === "imageInput") {
                    const value = inputValues[node.id];
                    if (value !== undefined) updateNodeData(node.id, { image: value });
                } else if (node.type === "imageIterator") {
                    const images = multiImageInputs[node.id] || [];
                    if (images.length > 0) updateNodeData(node.id, { localImages: images });
                }
            }

            await executeWorkflow();

            const currentNodes = useWorkflowStore.getState().nodes;
            const collectedOutputs: AppOutput[] = [];
            const now = Date.now();

            for (const node of currentNodes) {
                if (node.type === "output") {
                    const data = node.data as OutputNodeData;
                    if (data.image) {
                        collectedOutputs.push({
                            nodeId: node.id,
                            type: data.contentType === "video" ? "video" : "image",
                            data: data.video || data.image,
                            label: data.customTitle || "Output",
                            timestamp: now,
                        });
                    }
                } else if (node.type === "outputGallery") {
                    const data = node.data as OutputGalleryNodeData;
                    for (const img of data.images) {
                        collectedOutputs.push({
                            nodeId: node.id,
                            type: "image",
                            data: img,
                            label: data.customTitle || "Gallery",
                            timestamp: now,
                        });
                    }
                } else if (node.type === "llmGenerate") {
                    const data = node.data as LLMGenerateNodeData;
                    if (data.outputText) {
                        collectedOutputs.push({
                            nodeId: node.id,
                            type: "text",
                            data: data.outputText,
                            label: data.customTitle || "Text Output",
                            timestamp: now,
                        });
                    }
                }
            }

            setLatestOutputs(collectedOutputs);
            // Prepend to archive
            setMediaArchive((prev) => [...collectedOutputs, ...prev]);
        } catch (error) {
            console.error("Workflow execution failed:", error);
        }
    }, [appInputNodes, inputValues, multiImageInputs, updateNodeData, executeWorkflow]);

    const handleShare = useCallback(async () => {
        setIsSharing(true);
        try {
            const state = useWorkflowStore.getState();
            const workflow = {
                version: 1 as const,
                name: state.workflowName || "Shared Workflow",
                nodes: state.nodes.map((n) => ({ ...n, data: { ...n.data } })),
                edges: state.edges,
                edgeStyle: state.edgeStyle,
                groups: state.groups,
            };
            const response = await fetch("/api/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workflow }),
            });
            const result = await response.json();
            if (result.success && result.shareId) {
                const url = `${window.location.origin}/app/${result.shareId}`;
                setShareUrl(url);
                await navigator.clipboard.writeText(url);
            }
        } catch (error) {
            console.error("Failed to share:", error);
        } finally {
            setIsSharing(false);
        }
    }, []);

    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

    const curlExample = `curl -X POST ${origin}/api/run \\
  -H "Content-Type: application/json" \\
  -d '{
    "inputs": {
${apiSchema.inputs.map((i) => `      "${i.nodeId}": ${i.type === "text" ? '"your text here"' : '"data:image/png;base64,..."'}`).join(",\n")}
    }
  }'`;

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    };

    return (
        <div className="flex-1 overflow-hidden relative" style={{ background: "linear-gradient(170deg, #0c0c0f 0%, #111115 40%, #0e0f13 100%)" }}>
            {/* Ambient warm glow */}
            <div className="absolute top-[-20%] left-[30%] w-[600px] h-[600px] rounded-full opacity-[0.035]"
                style={{ background: "radial-gradient(circle, #f97316, transparent 70%)" }} />
            <div className="absolute bottom-[-10%] right-[15%] w-[500px] h-[500px] rounded-full opacity-[0.025]"
                style={{ background: "radial-gradient(circle, #ef4444, transparent 70%)" }} />

            <div className="relative z-10 h-full overflow-y-auto">
                <div className="max-w-[880px] mx-auto px-6 py-12">

                    {/* App Header */}
                    <div className="mb-10">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">
                                    {workflowName || "Untitled Workflow"}
                                </h1>
                                <p className="text-[13px] text-[#555] mt-2 font-light">
                                    {appInputNodes.length === 0 ? "No inputs configured" : `${appInputNodes.length} input${appInputNodes.length !== 1 ? "s" : ""}`} · {outputNodes.length} output{outputNodes.length !== 1 ? "s" : ""}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <button
                                    onClick={() => setShowApiDocs(!showApiDocs)}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 border ${showApiDocs
                                            ? "bg-white/[0.08] text-white border-white/[0.12]"
                                            : "text-[#777] bg-transparent border-white/[0.06] hover:bg-white/[0.04] hover:text-[#aaa]"
                                        }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                                    </svg>
                                    API
                                </button>
                                <button
                                    onClick={handleShare}
                                    disabled={isSharing}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium text-[#777] border border-white/[0.06] hover:bg-white/[0.04] hover:text-[#aaa] transition-all duration-200 disabled:opacity-50"
                                >
                                    {isSharing ? (
                                        <div className="w-3.5 h-3.5 border border-[#555] border-t-white rounded-full animate-spin" />
                                    ) : shareUrl ? (
                                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                                        </svg>
                                    )}
                                    {shareUrl ? "Copied!" : "Share"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Container */}
                    <div className="space-y-5">

                        {/* Inputs Card */}
                        {appInputNodes.length > 0 && (
                            <div className="rounded-[20px] border border-white/[0.06] overflow-hidden" style={{ background: "rgba(255,255,255,0.015)" }}>
                                <div className="px-7 pt-6 pb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-[5px] h-[5px] rounded-full bg-orange-400/80" />
                                        <span className="text-[10px] font-semibold text-[#555] uppercase tracking-[0.15em]">Inputs</span>
                                    </div>
                                </div>
                                <div className="px-7 pb-7 space-y-5">
                                    {appInputNodes.map((node) => {
                                        const isPrompt = node.type === "prompt";
                                        const isIterator = node.type === "imageIterator";
                                        const label = node.data.customTitle || (isPrompt ? "Text Prompt" : isIterator ? "Images" : "Image");
                                        const iteratorImages = isIterator ? (multiImageInputs[node.id] || []) : [];

                                        return (
                                            <div key={node.id}>
                                                <label className="block text-[13px] font-medium text-[#bbb] mb-2.5">{label}</label>

                                                {isPrompt && (
                                                    <textarea
                                                        value={inputValues[node.id] || ""}
                                                        onChange={(e) => handleInputChange(node.id, e.target.value)}
                                                        placeholder="Describe what you want..."
                                                        rows={3}
                                                        className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.07] text-white text-sm placeholder:text-[#333] focus:outline-none focus:border-orange-500/30 focus:shadow-[0_0_0_3px_rgba(249,115,22,0.08)] resize-y transition-all duration-300 leading-relaxed"
                                                        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
                                                    />
                                                )}

                                                {node.type === "imageInput" && (
                                                    <div className="group">
                                                        {inputValues[node.id] ? (
                                                            <div className="relative rounded-2xl overflow-hidden border border-white/[0.07] bg-black/40">
                                                                <img src={inputValues[node.id]} alt="Preview" className="w-full max-h-[280px] object-contain" />
                                                                <button
                                                                    onClick={() => setInputValues((prev) => { const next = { ...prev }; delete next[node.id]; return next; })}
                                                                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center text-[#999] hover:text-white transition-all"
                                                                >✕</button>
                                                            </div>
                                                        ) : (
                                                            <label className="flex flex-col items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed border-white/[0.06] hover:border-orange-500/20 hover:bg-orange-500/[0.015] cursor-pointer transition-all duration-300">
                                                                <svg className="w-7 h-7 text-[#333] mb-2.5 group-hover:text-orange-400/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                                                                </svg>
                                                                <span className="text-[11px] text-[#444] group-hover:text-[#666] transition-colors">Drop image or click to upload</span>
                                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleSingleFileUpload(node.id, file); }} />
                                                            </label>
                                                        )}
                                                    </div>
                                                )}

                                                {isIterator && (
                                                    <div>
                                                        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}>
                                                            {iteratorImages.map((img, idx) => (
                                                                <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-white/[0.06] bg-black/40">
                                                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                                                    <button
                                                                        onClick={() => handleRemoveMultiImage(node.id, idx)}
                                                                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 backdrop-blur-sm text-[9px] text-[#999] hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                                                                    >✕</button>
                                                                </div>
                                                            ))}
                                                            <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-white/[0.06] hover:border-orange-500/20 hover:bg-orange-500/[0.015] cursor-pointer transition-all duration-300 min-h-[100px]">
                                                                <svg className="w-5 h-5 text-[#333] mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                                                </svg>
                                                                <span className="text-[9px] text-[#444]">{iteratorImages.length > 0 ? "Add more" : "Upload images"}</span>
                                                                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) handleMultiFileUpload(node.id, e.target.files); e.target.value = ""; }} />
                                                            </label>
                                                        </div>
                                                        {iteratorImages.length > 0 && (
                                                            <p className="text-[10px] text-[#444] mt-2 text-center">
                                                                {iteratorImages.length} image{iteratorImages.length !== 1 ? "s" : ""} — each will be processed through the workflow
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Empty state */}
                        {appInputNodes.length === 0 && (
                            <div className="rounded-[20px] border border-white/[0.06] p-10 text-center" style={{ background: "rgba(255,255,255,0.015)" }}>
                                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-6 h-6 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                    </svg>
                                </div>
                                <p className="text-sm text-[#555] mb-1 font-medium">No inputs configured</p>
                                <p className="text-[11px] text-[#3a3a3a]">Toggle &quot;App Input&quot; on nodes in Edit mode</p>
                            </div>
                        )}

                        {/* Run Button — Orange gradient matching homepage */}
                        <button
                            onClick={handleRun}
                            disabled={isRunning || appInputNodes.length === 0}
                            className="w-full py-4 rounded-2xl font-semibold text-[14px] text-white relative overflow-hidden disabled:opacity-30 disabled:cursor-not-allowed group transition-all duration-300"
                            style={{
                                background: isRunning
                                    ? "linear-gradient(135deg, #2a1a0e, #1a1510)"
                                    : "linear-gradient(135deg, #f97316, #ef4444)",
                                boxShadow: isRunning
                                    ? "none"
                                    : "0 8px 32px rgba(249,115,22,0.3), 0 0 60px rgba(239,68,68,0.12), inset 0 1px 0 rgba(255,255,255,0.15)",
                            }}
                        >
                            {!isRunning && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out" />
                            )}
                            <span className="relative flex items-center justify-center gap-2.5">
                                {isRunning ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5.14v14l11-7-11-7z" />
                                        </svg>
                                        Run Workflow
                                    </>
                                )}
                            </span>
                        </button>

                        {/* Output Area — Always visible */}
                        <div className="rounded-[20px] border border-white/[0.06] overflow-hidden" style={{ background: "rgba(255,255,255,0.015)" }}>
                            <div className="px-7 pt-6 pb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-[5px] h-[5px] rounded-full bg-emerald-400/80" />
                                    <span className="text-[10px] font-semibold text-[#555] uppercase tracking-[0.15em]">Output</span>
                                </div>
                                {mediaArchive.length > 0 && (
                                    <button
                                        onClick={() => setShowArchive(!showArchive)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium transition-all duration-200 border ${showArchive
                                                ? "bg-white/[0.06] text-[#aaa] border-white/[0.1]"
                                                : "text-[#555] border-white/[0.04] hover:bg-white/[0.03] hover:text-[#888]"
                                            }`}
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                                        </svg>
                                        Archive ({mediaArchive.length})
                                    </button>
                                )}
                            </div>
                            <div className="px-7 pb-7">
                                {/* Running state */}
                                {isRunning && latestOutputs.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <div className="w-10 h-10 rounded-full border-2 border-white/[0.05] border-t-orange-500/70 animate-spin mb-4" />
                                        <p className="text-[13px] text-[#555] font-light">Processing your workflow...</p>
                                    </div>
                                )}

                                {/* No results yet (idle) */}
                                {!isRunning && latestOutputs.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-14">
                                        <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.06] flex items-center justify-center mb-3">
                                            <svg className="w-5 h-5 text-[#333]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                                            </svg>
                                        </div>
                                        <p className="text-[12px] text-[#444] font-medium">Results will appear here</p>
                                        <p className="text-[10px] text-[#333] mt-0.5">Configure inputs above and hit Run</p>
                                    </div>
                                )}

                                {/* Latest results */}
                                {latestOutputs.length > 0 && (
                                    <div className="space-y-4">
                                        {latestOutputs.filter((o) => o.type === "image" || o.type === "video").length > 0 && (
                                            <div className="grid grid-cols-2 gap-3">
                                                {latestOutputs
                                                    .filter((o) => o.type === "image" || o.type === "video")
                                                    .map((output, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="relative group rounded-2xl overflow-hidden border border-white/[0.06] bg-black cursor-pointer hover:border-orange-500/20 transition-all duration-500"
                                                            onClick={() => output.type === "image" && setLightboxImage(output.data)}
                                                        >
                                                            {output.type === "video" ? (
                                                                <video src={output.data} controls className="w-full h-auto" />
                                                            ) : (
                                                                <img src={output.data} alt={output.label} className="w-full h-auto object-contain group-hover:scale-[1.015] transition-transform duration-700 ease-out" />
                                                            )}
                                                            <div className="absolute bottom-0 inset-x-0 p-3.5 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                                <span className="text-[11px] text-white/80 font-medium">{output.label}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                        {latestOutputs
                                            .filter((o) => o.type === "text")
                                            .map((output, idx) => (
                                                <div key={`text-${idx}`} className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                                    <div className="text-[10px] text-[#555] font-semibold uppercase tracking-wider mb-2.5">{output.label}</div>
                                                    <div className="text-[13px] text-[#ccc] whitespace-pre-wrap leading-[1.7]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>{output.data}</div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Media Archive */}
                        {showArchive && mediaArchive.length > 0 && (
                            <div className="rounded-[20px] border border-white/[0.06] overflow-hidden" style={{ background: "rgba(255,255,255,0.015)" }}>
                                <div className="px-7 pt-6 pb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-[5px] h-[5px] rounded-full bg-amber-400/80" />
                                        <span className="text-[10px] font-semibold text-[#555] uppercase tracking-[0.15em]">Past Generations</span>
                                    </div>
                                </div>
                                <div className="px-7 pb-7">
                                    <div className="grid grid-cols-4 gap-2">
                                        {mediaArchive
                                            .filter((o) => o.type === "image" || o.type === "video")
                                            .map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className="relative group aspect-square rounded-xl overflow-hidden border border-white/[0.04] bg-black cursor-pointer hover:border-orange-500/20 transition-all duration-300"
                                                    onClick={() => item.type === "image" && setLightboxImage(item.data)}
                                                >
                                                    {item.type === "video" ? (
                                                        <video src={item.data} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <img src={item.data} alt={item.label} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                                                    )}
                                                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-[9px] text-white/70">{formatTime(item.timestamp)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                    {mediaArchive.filter((o) => o.type === "text").length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {mediaArchive
                                                .filter((o) => o.type === "text")
                                                .map((item, idx) => (
                                                    <div key={`arch-text-${idx}`} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[9px] text-[#555] font-medium">{item.label}</span>
                                                            <span className="text-[9px] text-[#444]">{formatTime(item.timestamp)}</span>
                                                        </div>
                                                        <div className="text-[11px] text-[#999] line-clamp-2">{item.data}</div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* API Documentation */}
                        {showApiDocs && (
                            <div className="rounded-[20px] border border-white/[0.06] overflow-hidden" style={{ background: "rgba(255,255,255,0.015)" }}>
                                <div className="px-7 pt-6 pb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-[5px] h-[5px] rounded-full bg-orange-400/80" />
                                        <span className="text-[10px] font-semibold text-[#555] uppercase tracking-[0.15em]">API Documentation</span>
                                    </div>
                                </div>
                                <div className="px-7 pb-7 space-y-5">
                                    <div>
                                        <h4 className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-3">Endpoint</h4>
                                        <code className="block px-4 py-3 rounded-xl bg-black/30 text-[12px] text-orange-400/90 font-mono border border-white/[0.04]">
                                            POST {origin}/api/run
                                        </code>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-3">Schema</h4>
                                        <div className="space-y-1.5">
                                            {apiSchema.inputs.map((input) => (
                                                <div key={input.nodeId} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-black/20 border border-white/[0.03]">
                                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400/80 border border-orange-500/15">
                                                        {input.type}
                                                    </span>
                                                    <code className="text-[11px] text-[#888] font-mono">{input.nodeId}</code>
                                                    <span className="text-[11px] text-[#555]">— {input.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">cURL Example</h4>
                                            <button onClick={() => navigator.clipboard.writeText(curlExample)} className="text-[9px] text-[#555] hover:text-white transition-colors uppercase tracking-wider font-medium">Copy</button>
                                        </div>
                                        <pre className="px-4 py-3 rounded-xl bg-black/30 text-[11px] text-[#888] font-mono border border-white/[0.04] overflow-x-auto whitespace-pre">
                                            {curlExample}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-8" />
                </div>
            </div>

            {/* Lightbox */}
            {lightboxImage && (
                <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-8 cursor-pointer" onClick={() => setLightboxImage(null)}>
                    <img src={lightboxImage} alt="Fullscreen" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
                    <button
                        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/[0.06] backdrop-blur-sm flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.12] transition-all"
                        onClick={() => setLightboxImage(null)}
                    >✕</button>
                </div>
            )}
        </div>
    );
}
