"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { NodeProps, NodeResizeControl } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflowStore";
import type { StickyNoteNodeData } from "@/types";

const STICKY_COLORS = {
    yellow: { bg: "rgba(250, 204, 21, 0.12)", border: "rgba(250, 204, 21, 0.25)", text: "#fbbf24", label: "Yellow" },
    green: { bg: "rgba(74, 222, 128, 0.12)", border: "rgba(74, 222, 128, 0.25)", text: "#4ade80", label: "Green" },
    blue: { bg: "rgba(96, 165, 250, 0.12)", border: "rgba(96, 165, 250, 0.25)", text: "#60a5fa", label: "Blue" },
    pink: { bg: "rgba(244, 114, 182, 0.12)", border: "rgba(244, 114, 182, 0.25)", text: "#f472b6", label: "Pink" },
    orange: { bg: "rgba(251, 146, 60, 0.12)", border: "rgba(251, 146, 60, 0.25)", text: "#fb923c", label: "Orange" },
};

export function StickyNoteNode({ id, data, selected }: NodeProps) {
    const nodeData = data as any;
    const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
    const [localText, setLocalText] = useState((nodeData).text || "");
    const [isEditing, setIsEditing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const color = (nodeData.color || "yellow") as keyof typeof STICKY_COLORS;
    const palette = STICKY_COLORS[color];

    // Sync from props when not editing
    useEffect(() => {
        if (!isEditing) setLocalText(nodeData.text || "");
    }, [nodeData.text, isEditing]);

    const handleBlur = useCallback(() => {
        setIsEditing(false);
        if (localText !== nodeData.text) {
            updateNodeData(id, { text: localText });
        }
    }, [id, localText, nodeData.text, updateNodeData]);

    const handleColorChange = useCallback((newColor: string) => {
        updateNodeData(id, { color: newColor });
    }, [id, updateNodeData]);

    return (
        <div
            className={`relative rounded-[6px] transition-all duration-150 ${selected ? 'ring-1 ring-[var(--accent-primary)]' : ''}`}
            style={{
                background: palette.bg,
                border: `1px solid ${palette.border}`,
                backdropFilter: 'blur(8px)',
                minWidth: 160,
                minHeight: 100,
                width: '100%',
                height: '100%',
                boxShadow: selected
                    ? `0 0 16px ${palette.border}, 0 4px 12px rgba(0,0,0,0.3)`
                    : '0 2px 8px rgba(0,0,0,0.2)',
            }}
        >
            {/* Resize handle */}
            <NodeResizeControl
                minWidth={160}
                minHeight={100}
                style={{ background: 'transparent', border: 'none' }}
            >
                <svg
                    className="absolute bottom-1 right-1 w-3 h-3 opacity-30 hover:opacity-60 transition-opacity"
                    viewBox="0 0 6 6"
                    fill={palette.text}
                >
                    <circle cx="5" cy="1" r="0.6" />
                    <circle cx="5" cy="3" r="0.6" />
                    <circle cx="5" cy="5" r="0.6" />
                    <circle cx="3" cy="3" r="0.6" />
                    <circle cx="3" cy="5" r="0.6" />
                    <circle cx="1" cy="5" r="0.6" />
                </svg>
            </NodeResizeControl>

            {/* Color picker strip */}
            <div className="flex gap-1 px-2 pt-2">
                {(Object.keys(STICKY_COLORS) as Array<keyof typeof STICKY_COLORS>).map((c) => (
                    <button
                        key={c}
                        onClick={() => handleColorChange(c)}
                        className={`w-3 h-3 rounded-full transition-all duration-100 ${c === color ? 'ring-1 ring-offset-1 ring-offset-transparent scale-110' : 'opacity-50 hover:opacity-80'}`}
                        style={{
                            background: STICKY_COLORS[c].text,
                        }}
                    />
                ))}
                <span
                    className="ml-auto text-[8px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: palette.text, opacity: 0.6 }}
                >
                    NOTE
                </span>
            </div>

            {/* Text area */}
            <textarea
                ref={textareaRef}
                value={localText}
                onChange={(e) => setLocalText(e.target.value)}
                onFocus={() => setIsEditing(true)}
                onBlur={handleBlur}
                placeholder="Type your note..."
                className="nodrag nopan nowheel w-full h-[calc(100%-28px)] p-2 text-xs leading-relaxed bg-transparent resize-none focus:outline-none placeholder:opacity-40"
                style={{
                    color: 'var(--text-primary)',
                    caretColor: palette.text,
                }}
            />
        </div>
    );
}
