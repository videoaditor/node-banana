"use client";

import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useWorkflowStore, WorkflowFile } from "@/store/workflowStore";

interface ImportWorkflowDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ImportWorkflowDialog({ isOpen, onClose }: ImportWorkflowDialogProps) {
    const [image, setImage] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const loadWorkflow = useWorkflowStore((state) => state.loadWorkflow);

    const handleImageUpload = useCallback((file: File) => {
        if (!file.type.startsWith("image/")) {
            setError("Please upload an image file (PNG, JPG, etc.)");
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            setError("Image too large. Max 20MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            setImage(e.target?.result as string);
            setError(null);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleImageUpload(file);
        },
        [handleImageUpload]
    );

    const handlePaste = useCallback(
        (e: React.ClipboardEvent) => {
            const items = e.clipboardData.items;
            for (const item of Array.from(items)) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) handleImageUpload(file);
                    break;
                }
            }
        },
        [handleImageUpload]
    );

    const handleImport = useCallback(async () => {
        if (!image) return;

        setIsImporting(true);
        setError(null);
        setProgress("Analyzing workflow screenshot...");

        try {
            // Get API key from settings
            const settingsJson = localStorage.getItem("node-banana-provider-settings");
            const settings = settingsJson ? JSON.parse(settingsJson) : {};
            const geminiKey = settings?.providers?.gemini?.apiKey;

            const headers: HeadersInit = {
                "Content-Type": "application/json",
            };
            if (geminiKey) {
                headers["X-Gemini-API-Key"] = geminiKey;
            }

            setProgress("AI is reading the workflow structure...");

            const response = await fetch("/api/import-workflow", {
                method: "POST",
                headers,
                body: JSON.stringify({ image }),
            });

            const result = await response.json();

            if (!result.success) {
                setError(result.error || "Import failed");
                setIsImporting(false);
                setProgress("");
                return;
            }

            setProgress(`Found ${result.workflow.nodes.length} nodes! Loading...`);

            // Small delay so user sees the success message
            await new Promise((r) => setTimeout(r, 500));

            // Load the workflow into the canvas
            await loadWorkflow(result.workflow as WorkflowFile);

            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Import failed");
        } finally {
            setIsImporting(false);
            setProgress("");
        }
    }, [image, loadWorkflow, onClose]);

    const handleClose = useCallback(() => {
        if (isImporting) return; // Don't close while importing
        setImage(null);
        setError(null);
        setProgress("");
        onClose();
    }, [isImporting, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            onClick={handleClose}
            onPaste={handlePaste}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Dialog */}
            <div
                className="relative w-full max-w-[640px] mx-4 rounded-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: "linear-gradient(180deg, #1a1a1e 0%, #131315 100%)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 25px 100px rgba(0,0,0,0.6), 0 0 60px rgba(249,115,22,0.05)",
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{
                                background: "linear-gradient(135deg, #f97316, #ef4444)",
                                boxShadow: "0 2px 10px rgba(249,115,22,0.3)",
                            }}
                        >
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">Import from Screenshot</h2>
                            <p className="text-[11px] text-[#666]">
                                Paste or upload a workflow screenshot from Weavy, ComfyUI, n8n, etc.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isImporting}
                        className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-[#666] hover:text-white transition-all disabled:opacity-30"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-5">
                    {/* Image upload area */}
                    {image ? (
                        <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-black">
                            <img
                                src={image}
                                alt="Workflow screenshot"
                                className="w-full max-h-[400px] object-contain"
                            />
                            {!isImporting && (
                                <button
                                    onClick={() => { setImage(null); setError(null); }}
                                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-[#999] hover:text-white hover:bg-black/80 transition-all"
                                >
                                    ✕
                                </button>
                            )}
                            {isImporting && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-full border-2 border-white/10 border-t-orange-500 animate-spin"
                                    />
                                    <span className="text-sm text-white/90 font-medium">{progress}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <label
                            className="flex flex-col items-center justify-center w-full h-[240px] rounded-xl border-2 border-dashed border-white/[0.08] hover:border-orange-500/30 hover:bg-orange-500/[0.02] cursor-pointer transition-all duration-300 group"
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
                                style={{
                                    background: "rgba(249,115,22,0.06)",
                                    border: "1px solid rgba(249,115,22,0.12)",
                                }}
                            >
                                <svg className="w-7 h-7 text-[#555] group-hover:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                </svg>
                            </div>
                            <span className="text-sm text-[#666] group-hover:text-[#999] transition-colors mb-1">
                                Drop screenshot or click to upload
                            </span>
                            <span className="text-[11px] text-[#444]">
                                Or press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[#888] text-[10px] font-mono">⌘V</kbd> to paste from clipboard
                            </span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleImageUpload(file);
                                }}
                            />
                        </label>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-3 px-4 py-2.5 rounded-xl bg-red-500/[0.06] border border-red-500/[0.12]">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Supported tools */}
                    <div className="mt-4 flex items-center gap-2">
                        <span className="text-[10px] text-[#444] uppercase tracking-widest">Works with</span>
                        <div className="flex items-center gap-1.5">
                            {["Weavy", "ComfyUI", "n8n", "Make", "Zapier"].map((tool) => (
                                <span
                                    key={tool}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-[#777]"
                                >
                                    {tool}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between">
                    <p className="text-[11px] text-[#444] max-w-[300px]">
                        AI will analyze the screenshot and recreate the workflow using Node Banana nodes.
                    </p>
                    <button
                        onClick={handleImport}
                        disabled={!image || isImporting}
                        className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:brightness-110"
                        style={{
                            background: !image || isImporting
                                ? "rgba(255,255,255,0.06)"
                                : "linear-gradient(135deg, #f97316, #ef4444)",
                            boxShadow: !image || isImporting
                                ? "none"
                                : "0 2px 12px rgba(249,115,22,0.3)",
                        }}
                    >
                        {isImporting ? "Importing..." : "Import Workflow"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
