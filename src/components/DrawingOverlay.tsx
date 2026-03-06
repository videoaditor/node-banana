"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useReactFlow } from "@xyflow/react";

interface DrawingPath {
    id: string;
    points: { x: number; y: number }[];
    color: string;
    width: number;
    opacity: number;
    type: "freehand" | "arrow";
}

interface DrawingOverlayProps {
    isActive: boolean;
    onDeactivate: () => void;
}

export function DrawingOverlay({ isActive, onDeactivate }: DrawingOverlayProps) {
    const [paths, setPaths] = useState<DrawingPath[]>([]);
    const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
    const [drawMode, setDrawMode] = useState<"freehand" | "arrow">("freehand");
    const [brushWidth, setBrushWidth] = useState(3);
    const svgRef = useRef<SVGSVGElement>(null);
    const isDrawing = useRef(false);
    const arrowStartRef = useRef<{ x: number; y: number } | null>(null);
    const { getViewport } = useReactFlow();

    // Refs for current state to avoid stale closures in native event listeners
    const drawModeRef = useRef(drawMode);
    const brushWidthRef = useRef(brushWidth);
    const currentPathRef = useRef(currentPath);
    const isActiveRef = useRef(isActive);

    useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
    useEffect(() => { brushWidthRef.current = brushWidth; }, [brushWidth]);
    useEffect(() => { currentPathRef.current = currentPath; }, [currentPath]);
    useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

    // Convert screen coords to flow coords (matching viewport transformations)
    const screenToFlow = useCallback(
        (screenX: number, screenY: number) => {
            const viewport = getViewport();
            const svgRect = svgRef.current?.getBoundingClientRect();
            if (!svgRect) return { x: screenX, y: screenY };
            return {
                x: (screenX - svgRect.left - viewport.x) / viewport.zoom,
                y: (screenY - svgRect.top - viewport.y) / viewport.zoom,
            };
        },
        [getViewport]
    );

    // Use native pointer events to bypass React Flow's event interception
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg || !isActive) return;

        const handlePointerDown = (e: PointerEvent) => {
            if (!isActiveRef.current || e.button !== 0) return;

            // Check if the click is on the floating toolbar (don't capture those)
            const target = e.target as Element;
            if (target.closest("[data-drawing-toolbar]")) return;

            e.preventDefault();
            e.stopPropagation();

            // Capture pointer to get events even outside the SVG
            svg.setPointerCapture(e.pointerId);

            const pos = screenToFlow(e.clientX, e.clientY);
            isDrawing.current = true;

            if (drawModeRef.current === "arrow") {
                arrowStartRef.current = pos;
            } else {
                const newPath: DrawingPath = {
                    id: `draw-${Date.now()}`,
                    points: [pos],
                    color: "rgba(249, 115, 22, 0.65)",
                    width: brushWidthRef.current,
                    opacity: 1,
                    type: "freehand",
                };
                setCurrentPath(newPath);
            }
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (!isDrawing.current || !isActiveRef.current) return;
            e.preventDefault();
            e.stopPropagation();

            const pos = screenToFlow(e.clientX, e.clientY);

            if (drawModeRef.current === "arrow" && arrowStartRef.current) {
                const arrowPath: DrawingPath = {
                    id: `arrow-preview`,
                    points: [arrowStartRef.current, pos],
                    color: "rgba(249, 115, 22, 0.65)",
                    width: brushWidthRef.current,
                    opacity: 1,
                    type: "arrow",
                };
                setCurrentPath(arrowPath);
            } else {
                setCurrentPath((prev) => {
                    if (!prev) return null;
                    return { ...prev, points: [...prev.points, pos] };
                });
            }
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (!isDrawing.current) return;
            e.preventDefault();
            e.stopPropagation();

            svg.releasePointerCapture(e.pointerId);
            isDrawing.current = false;

            if (drawModeRef.current === "arrow" && arrowStartRef.current) {
                const pos = screenToFlow(e.clientX, e.clientY);
                const arrowPath: DrawingPath = {
                    id: `arrow-${Date.now()}`,
                    points: [arrowStartRef.current, pos],
                    color: "rgba(249, 115, 22, 0.65)",
                    width: brushWidthRef.current,
                    opacity: 1,
                    type: "arrow",
                };
                setPaths((prev) => [...prev, arrowPath]);
                arrowStartRef.current = null;
                setCurrentPath(null);
            } else {
                setCurrentPath((prev) => {
                    if (prev && prev.points.length > 1) {
                        setPaths((paths) => [...paths, prev]);
                    }
                    return null;
                });
            }
        };

        svg.addEventListener("pointerdown", handlePointerDown, { capture: true });
        svg.addEventListener("pointermove", handlePointerMove, { capture: true });
        svg.addEventListener("pointerup", handlePointerUp, { capture: true });

        return () => {
            svg.removeEventListener("pointerdown", handlePointerDown, { capture: true });
            svg.removeEventListener("pointermove", handlePointerMove, { capture: true });
            svg.removeEventListener("pointerup", handlePointerUp, { capture: true });
        };
    }, [isActive, screenToFlow]);

    const handleUndo = useCallback(() => {
        setPaths((prev) => prev.slice(0, -1));
    }, []);

    const handleClearAll = useCallback(() => {
        setPaths([]);
    }, []);

    // Keyboard shortcut: Escape to deactivate, Z to undo
    useEffect(() => {
        if (!isActive) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onDeactivate();
            } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isActive, onDeactivate, handleUndo]);

    // Build SVG path from points
    const buildSVGPath = (points: { x: number; y: number }[]): string => {
        if (points.length < 2) return "";
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const midX = (prev.x + curr.x) / 2;
            const midY = (prev.y + curr.y) / 2;
            d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
        }
        const last = points[points.length - 1];
        d += ` L ${last.x} ${last.y}`;
        return d;
    };

    // Build arrow SVG
    const buildArrow = (
        start: { x: number; y: number },
        end: { x: number; y: number }
    ) => {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.atan2(dy, dx);
        const headLen = 14;

        return {
            line: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
            head: `M ${end.x} ${end.y} L ${end.x - headLen * Math.cos(angle - Math.PI / 6)} ${end.y - headLen * Math.sin(angle - Math.PI / 6)} M ${end.x} ${end.y} L ${end.x - headLen * Math.cos(angle + Math.PI / 6)} ${end.y - headLen * Math.sin(angle + Math.PI / 6)}`,
        };
    };

    const viewport = getViewport();
    const allPaths = currentPath ? [...paths, currentPath] : paths;

    if (!isActive && paths.length === 0) return null;

    return (
        <>
            {/* SVG drawing layer — z-index must be above React Flow's pane (z-index ~5) */}
            <svg
                ref={svgRef}
                className="absolute inset-0"
                style={{
                    zIndex: 1000,
                    pointerEvents: isActive ? "all" : "none",
                    cursor: isActive
                        ? drawMode === "arrow"
                            ? "crosshair"
                            : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Ccircle cx='10' cy='10' r='3' fill='%23f97316' opacity='0.8'/%3E%3C/svg%3E") 10 10, crosshair`
                        : "default",
                    touchAction: "none",
                }}
            >
                <g
                    transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}
                >
                    {allPaths.map((path) => {
                        if (path.type === "arrow" && path.points.length === 2) {
                            const arrow = buildArrow(path.points[0], path.points[1]);
                            return (
                                <g key={path.id}>
                                    <path
                                        d={arrow.line}
                                        fill="none"
                                        stroke={path.color}
                                        strokeWidth={path.width}
                                        strokeLinecap="round"
                                        strokeDasharray="8 4"
                                    />
                                    <path
                                        d={arrow.head}
                                        fill="none"
                                        stroke={path.color}
                                        strokeWidth={path.width + 1}
                                        strokeLinecap="round"
                                    />
                                </g>
                            );
                        }

                        return (
                            <path
                                key={path.id}
                                d={buildSVGPath(path.points)}
                                fill="none"
                                stroke={path.color}
                                strokeWidth={path.width}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity={path.opacity}
                            />
                        );
                    })}
                </g>
            </svg>

            {/* Floating toolbar when drawing mode is active */}
            {isActive && (
                <div
                    data-drawing-toolbar
                    className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                    style={{
                        zIndex: 1001,
                        background: "rgba(28, 30, 36, 0.85)",
                        backdropFilter: "blur(16px) saturate(1.5)",
                        border: "1px solid rgba(249, 115, 22, 0.15)",
                        boxShadow:
                            "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(249,115,22,0.08)",
                    }}
                >
                    {/* Pen mode */}
                    <button
                        onClick={() => setDrawMode("freehand")}
                        className={`p-1.5 rounded-lg transition-all ${drawMode === "freehand"
                            ? "bg-orange-500/20 text-orange-400"
                            : "text-[#666] hover:text-[#999]"
                            }`}
                        title="Freehand pen"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
                        </svg>
                    </button>

                    {/* Arrow mode */}
                    <button
                        onClick={() => setDrawMode("arrow")}
                        className={`p-1.5 rounded-lg transition-all ${drawMode === "arrow"
                            ? "bg-orange-500/20 text-orange-400"
                            : "text-[#666] hover:text-[#999]"
                            }`}
                        title="Arrow"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                        </svg>
                    </button>

                    <div className="w-px h-4 bg-white/10 mx-1" />

                    {/* Brush sizes */}
                    {[2, 3, 5].map((w) => (
                        <button
                            key={w}
                            onClick={() => setBrushWidth(w)}
                            className={`p-1.5 rounded-lg transition-all ${brushWidth === w
                                ? "bg-orange-500/15 text-orange-400"
                                : "text-[#555] hover:text-[#888]"
                                }`}
                            title={`Brush size ${w}`}
                        >
                            <div
                                className="rounded-full bg-current mx-auto"
                                style={{ width: w + 2, height: w + 2 }}
                            />
                        </button>
                    ))}

                    <div className="w-px h-4 bg-white/10 mx-1" />

                    {/* Undo */}
                    <button
                        onClick={handleUndo}
                        disabled={paths.length === 0}
                        className="p-1.5 rounded-lg text-[#666] hover:text-[#999] disabled:opacity-30 transition-all"
                        title="Undo (⌘Z)"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                    </button>

                    {/* Clear all */}
                    <button
                        onClick={handleClearAll}
                        disabled={paths.length === 0}
                        className="p-1.5 rounded-lg text-[#666] hover:text-red-400 disabled:opacity-30 transition-all"
                        title="Clear all drawings"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                    </button>

                    <div className="w-px h-4 bg-white/10 mx-1" />

                    {/* Done */}
                    <button
                        onClick={onDeactivate}
                        className="px-3 py-1 rounded-lg text-[11px] font-medium bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition-all"
                    >
                        Done
                    </button>
                </div>
            )}
        </>
    );
}
