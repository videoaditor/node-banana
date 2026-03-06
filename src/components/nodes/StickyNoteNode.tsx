"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { NodeProps, NodeResizeControl } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflowStore";

const STICKY_COLORS = {
    yellow: {
        bg: "#fef9c3",
        bgDark: "#fef08a",
        shadow: "rgba(234, 179, 8, 0.25)",
        text: "#854d0e",
        accent: "#eab308",
        tape: "rgba(253, 224, 71, 0.7)",
        label: "Yellow",
    },
    green: {
        bg: "#dcfce7",
        bgDark: "#bbf7d0",
        shadow: "rgba(34, 197, 94, 0.2)",
        text: "#166534",
        accent: "#22c55e",
        tape: "rgba(134, 239, 172, 0.7)",
        label: "Green",
    },
    blue: {
        bg: "#dbeafe",
        bgDark: "#bfdbfe",
        shadow: "rgba(59, 130, 246, 0.2)",
        text: "#1e40af",
        accent: "#3b82f6",
        tape: "rgba(147, 197, 253, 0.7)",
        label: "Blue",
    },
    pink: {
        bg: "#fce7f3",
        bgDark: "#fbcfe8",
        shadow: "rgba(236, 72, 153, 0.2)",
        text: "#9d174d",
        accent: "#ec4899",
        tape: "rgba(249, 168, 212, 0.7)",
        label: "Pink",
    },
    orange: {
        bg: "#fff7ed",
        bgDark: "#fed7aa",
        shadow: "rgba(249, 115, 22, 0.2)",
        text: "#9a3412",
        accent: "#f97316",
        tape: "rgba(253, 186, 116, 0.7)",
        label: "Orange",
    },
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
            className={`relative transition-all duration-150`}
            style={{
                minWidth: 160,
                minHeight: 100,
                width: '100%',
                height: '100%',
                filter: selected
                    ? `drop-shadow(0 8px 20px ${palette.shadow}) drop-shadow(0 2px 6px rgba(0,0,0,0.15))`
                    : `drop-shadow(0 4px 12px ${palette.shadow}) drop-shadow(0 1px 4px rgba(0,0,0,0.1))`,
            }}
        >
            {/* Tape strip at top */}
            <div
                style={{
                    position: 'absolute',
                    top: -6,
                    left: '50%',
                    transform: 'translateX(-50%) rotate(-1deg)',
                    width: 48,
                    height: 14,
                    background: palette.tape,
                    borderRadius: 1,
                    zIndex: 2,
                    backdropFilter: 'blur(4px)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                }}
            />

            {/* Main sticky note body */}
            <div
                style={{
                    background: `linear-gradient(145deg, ${palette.bg} 0%, ${palette.bgDark} 100%)`,
                    borderRadius: '2px 2px 2px 12px',
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    border: selected ? `2px solid ${palette.accent}` : '1px solid rgba(0,0,0,0.06)',
                    transform: 'rotate(-0.3deg)',
                }}
            >
                {/* Subtle paper texture / fold line */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: 20,
                        height: 20,
                        background: `linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.04) 50%)`,
                        borderRadius: '0 8px 0 0',
                    }}
                />

                {/* Resize handle */}
                <NodeResizeControl
                    minWidth={160}
                    minHeight={100}
                    style={{ background: 'transparent', border: 'none' }}
                >
                    <svg
                        className="absolute bottom-1 right-1 w-3 h-3 opacity-20 hover:opacity-50 transition-opacity"
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
                <div className="flex gap-1.5 px-3 pt-2.5 items-center">
                    {(Object.keys(STICKY_COLORS) as Array<keyof typeof STICKY_COLORS>).map((c) => (
                        <button
                            key={c}
                            onClick={() => handleColorChange(c)}
                            className={`w-3 h-3 rounded-full transition-all duration-100 border ${c === color
                                ? 'ring-1 ring-offset-1 scale-110 border-black/20'
                                : 'opacity-60 hover:opacity-100 border-black/10'
                                }`}
                            style={{
                                background: STICKY_COLORS[c].accent,
                            }}
                        />
                    ))}
                    <span
                        className="ml-auto text-[7px] font-bold uppercase tracking-[0.15em] select-none"
                        style={{ color: palette.accent, opacity: 0.5 }}
                    >
                        ✎ NOTE
                    </span>
                </div>

                {/* Text area — handwriting-style font */}
                <textarea
                    ref={textareaRef}
                    value={localText}
                    onChange={(e) => setLocalText(e.target.value)}
                    onFocus={() => setIsEditing(true)}
                    onBlur={handleBlur}
                    placeholder="Type your note..."
                    className="nodrag nopan nowheel w-full h-[calc(100%-32px)] px-3 py-2 text-[13px] leading-[1.6] bg-transparent resize-none focus:outline-none"
                    style={{
                        color: palette.text,
                        caretColor: palette.accent,
                        fontFamily: "'Caveat', 'Segoe Print', 'Comic Sans MS', cursive",
                        fontWeight: 500,
                        letterSpacing: '0.01em',
                    }}
                />
            </div>
        </div>
    );
}
