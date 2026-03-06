"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";

interface SharedWorkflow {
    version: 1;
    name: string;
    nodes: Array<{
        id: string;
        type: string;
        data: Record<string, unknown>;
        position: { x: number; y: number };
    }>;
    edges: Array<{
        id: string;
        source: string;
        target: string;
        sourceHandle?: string;
        targetHandle?: string;
    }>;
    edgeStyle: string;
}

interface AppOutput {
    nodeId: string;
    type: "image" | "video" | "text";
    data: string;
    label: string;
}

export default function SharedAppPage({
    params,
}: {
    params: Promise<{ shareId: string }>;
}) {
    const [shareId, setShareId] = useState<string | null>(null);
    const [workflow, setWorkflow] = useState<SharedWorkflow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [inputValues, setInputValues] = useState<Record<string, string>>({});
    const [outputs, setOutputs] = useState<AppOutput[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Resolve params
    useEffect(() => {
        params.then((p) => setShareId(p.shareId));
    }, [params]);

    // Load shared workflow
    useEffect(() => {
        if (!shareId) return;

        const loadWorkflow = async () => {
            try {
                const response = await fetch(`/api/share?id=${encodeURIComponent(shareId)}`);
                const data = await response.json();
                if (data.success && data.workflow) {
                    setWorkflow(data.workflow);
                } else {
                    setError(data.error || "Workflow not found");
                }
            } catch {
                setError("Failed to load workflow");
            } finally {
                setLoading(false);
            }
        };

        loadWorkflow();
    }, [shareId]);

    // Find app input nodes
    const appInputNodes = useMemo(() => {
        if (!workflow) return [];
        return workflow.nodes.filter((node) => {
            if (node.type === "prompt") return node.data.isAppInput === true;
            if (node.type === "imageInput") return node.data.isAppInput === true;
            return false;
        });
    }, [workflow]);

    // Find output nodes
    const outputNodes = useMemo(() => {
        if (!workflow) return [];
        return workflow.nodes.filter(
            (n) => n.type === "output" || n.type === "outputGallery" || n.type === "llmGenerate"
        );
    }, [workflow]);

    const handleInputChange = useCallback((nodeId: string, value: string) => {
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
        if (!shareId) return;
        setIsRunning(true);
        setOutputs([]);

        try {
            const response = await fetch("/api/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    shareId,
                    inputs: inputValues,
                }),
            });

            const result = await response.json();
            if (result.success && result.outputs) {
                const collectedOutputs: AppOutput[] = [];
                for (const [nodeId, output] of Object.entries(result.outputs)) {
                    const o = output as { type: string; data: string; label: string };
                    collectedOutputs.push({
                        nodeId,
                        type: o.type as AppOutput["type"],
                        data: o.data,
                        label: o.label,
                    });
                }
                setOutputs(collectedOutputs);
            } else {
                setError(result.error || "Execution failed");
            }
        } catch {
            setError("Failed to run workflow");
        } finally {
            setIsRunning(false);
        }
    }, [shareId, inputValues]);

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#0f0f11] to-[#161618] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full border-2 border-white/[0.06] border-t-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-sm text-[#666]">Loading workflow...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error && !workflow) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#0f0f11] to-[#161618] flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-6">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-white mb-2">Workflow Not Found</h2>
                    <p className="text-sm text-[#666]">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0f0f11] to-[#161618]">
            {/* Subtle grid pattern */}
            <div
                className="fixed inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                    backgroundSize: "32px 32px",
                }}
            />

            <div className="relative z-10 max-w-[920px] mx-auto px-6 py-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-white">NB</span>
                            </div>
                            <span className="text-xs text-[#555]">Node Banana</span>
                        </div>
                        <h1 className="text-2xl font-semibold text-white tracking-tight">
                            {workflow?.name || "Shared Workflow"}
                        </h1>
                        <p className="text-sm text-[#666] mt-1">
                            {appInputNodes.length} input{appInputNodes.length !== 1 ? "s" : ""} · {outputNodes.length} output{outputNodes.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>

                {/* Main Card */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.4)]">

                    {/* Inputs */}
                    {appInputNodes.length > 0 ? (
                        <div className="p-8 border-b border-white/[0.04]">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                <span className="text-xs font-medium text-[#666] uppercase tracking-widest">Inputs</span>
                            </div>
                            <div className="space-y-6">
                                {appInputNodes.map((node) => {
                                    const isPrompt = node.type === "prompt";
                                    const label = (node.data.customTitle as string) || (isPrompt ? "Text Prompt" : "Image");

                                    return (
                                        <div key={node.id}>
                                            <label className="block text-sm font-medium text-[#ccc] mb-2">{label}</label>
                                            {isPrompt ? (
                                                <textarea
                                                    value={inputValues[node.id] || ""}
                                                    onChange={(e) => handleInputChange(node.id, e.target.value)}
                                                    placeholder="Enter your text..."
                                                    rows={3}
                                                    className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-sm placeholder:text-[#444] focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 resize-y transition-all duration-200"
                                                />
                                            ) : (
                                                <div className="group">
                                                    {inputValues[node.id] ? (
                                                        <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-black">
                                                            <img
                                                                src={inputValues[node.id]}
                                                                alt="Preview"
                                                                className="w-full max-h-[300px] object-contain"
                                                            />
                                                            <button
                                                                onClick={() => setInputValues((prev) => {
                                                                    const next = { ...prev };
                                                                    delete next[node.id];
                                                                    return next;
                                                                })}
                                                                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-[#999] hover:text-white hover:bg-black/80 transition-all"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-blue-500/30 hover:bg-blue-500/[0.02] cursor-pointer transition-all duration-300">
                                                            <svg className="w-8 h-8 text-[#444] mb-2 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                                                            </svg>
                                                            <span className="text-xs text-[#555] group-hover:text-[#888] transition-colors">Drop image or click to upload</span>
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
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 border-b border-white/[0.04]">
                            <div className="text-center py-6">
                                <p className="text-sm text-[#666]">This workflow has no configurable inputs</p>
                            </div>
                        </div>
                    )}

                    {/* Run Button */}
                    <div className="p-6 border-b border-white/[0.04] bg-white/[0.01]">
                        <button
                            onClick={handleRun}
                            disabled={isRunning}
                            className="w-full py-3.5 rounded-xl font-medium text-sm text-white relative overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed group transition-all duration-300"
                            style={{
                                background: isRunning
                                    ? "linear-gradient(135deg, #1a1a2e, #16213e)"
                                    : "linear-gradient(135deg, #2563eb, #7c3aed)",
                                boxShadow: isRunning
                                    ? "none"
                                    : "0 4px 20px rgba(37,99,235,0.25), 0 0 40px rgba(124,58,237,0.1)",
                            }}
                        >
                            {!isRunning && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                            )}
                            <span className="relative flex items-center justify-center gap-2">
                                {isRunning ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        Running...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                                        </svg>
                                        Run Workflow
                                    </>
                                )}
                            </span>
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="px-8 py-4 bg-red-500/5 border-b border-red-500/10">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Outputs */}
                    {(outputs.length > 0 || isRunning) && (
                        <div className="p-8">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span className="text-xs font-medium text-[#666] uppercase tracking-widest">Outputs</span>
                            </div>

                            {isRunning && outputs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <div className="w-12 h-12 rounded-full border-2 border-white/[0.06] border-t-blue-500 animate-spin mb-4" />
                                    <p className="text-sm text-[#666]">Processing workflow...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {outputs.filter((o) => o.type === "image" || o.type === "video").length > 0 && (
                                        <div className="grid grid-cols-2 gap-3">
                                            {outputs
                                                .filter((o) => o.type === "image" || o.type === "video")
                                                .map((output, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="relative group rounded-xl overflow-hidden border border-white/[0.06] bg-black cursor-pointer hover:border-white/[0.12] transition-all duration-300"
                                                        onClick={() => output.type === "image" && setLightboxImage(output.data)}
                                                    >
                                                        {output.type === "video" ? (
                                                            <video src={output.data} controls className="w-full h-auto" />
                                                        ) : (
                                                            <img
                                                                src={output.data}
                                                                alt={output.label}
                                                                className="w-full h-auto object-contain group-hover:scale-[1.02] transition-transform duration-500"
                                                            />
                                                        )}
                                                        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-xs text-white/80">{output.label}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}

                                    {outputs
                                        .filter((o) => o.type === "text")
                                        .map((output, idx) => (
                                            <div
                                                key={`text-${idx}`}
                                                className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]"
                                            >
                                                <div className="text-xs text-[#666] mb-2">{output.label}</div>
                                                <div className="text-sm text-[#ddd] whitespace-pre-wrap leading-relaxed">{output.data}</div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-xs text-[#444]">
                        Powered by <span className="text-[#666]">Node Banana</span>
                    </p>
                </div>
            </div>

            {/* Lightbox */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-8 cursor-pointer"
                    onClick={() => setLightboxImage(null)}
                >
                    <img
                        src={lightboxImage}
                        alt="Fullscreen"
                        className="max-w-full max-h-full object-contain rounded-lg"
                    />
                    <button
                        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all"
                        onClick={() => setLightboxImage(null)}
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
}
