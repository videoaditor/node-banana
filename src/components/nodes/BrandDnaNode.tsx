"use client";

import { useCallback, useEffect, useRef } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { BrandDnaNodeData, BrandDnaTrait } from "@/types";

type BrandDnaNodeType = Node<BrandDnaNodeData, "brandDna">;

/**
 * Merges all enabled traits into a single JSON string.
 */
function mergeTraits(traits: BrandDnaTrait[]): string | null {
  const enabled = traits.filter((t) => t.enabled);
  if (enabled.length === 0) return null;

  const merged: Record<string, unknown> = {};
  for (const trait of enabled) {
    try {
      merged[trait.label || "untitled"] = JSON.parse(trait.value);
    } catch {
      // If value is not valid JSON, store as raw string
      merged[trait.label || "untitled"] = trait.value;
    }
  }
  return JSON.stringify(merged, null, 2);
}

export function BrandDnaNode({ id, data, selected }: NodeProps<BrandDnaNodeType>) {
  const nodeData = data as BrandDnaNodeData;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const isFirstRender = useRef(true);

  // Recompute merged output whenever traits change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // On first render, compute if not already set
      const merged = mergeTraits(nodeData.traits);
      if (merged !== nodeData.outputJson) {
        updateNodeData(id, { outputJson: merged });
      }
      return;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateTraits = useCallback(
    (newTraits: BrandDnaTrait[]) => {
      const merged = mergeTraits(newTraits);
      updateNodeData(id, { traits: newTraits, outputJson: merged });
    },
    [id, updateNodeData]
  );

  const handleAddTrait = useCallback(() => {
    const newTrait: BrandDnaTrait = {
      id: `trait-${Date.now()}`,
      label: "",
      value: "{}",
      enabled: true,
    };
    updateTraits([...nodeData.traits, newTrait]);
  }, [nodeData.traits, updateTraits]);

  const handleRemoveTrait = useCallback(
    (traitId: string) => {
      updateTraits(nodeData.traits.filter((t) => t.id !== traitId));
    },
    [nodeData.traits, updateTraits]
  );

  const handleTraitLabelChange = useCallback(
    (traitId: string, label: string) => {
      const newTraits = nodeData.traits.map((t) =>
        t.id === traitId ? { ...t, label } : t
      );
      updateTraits(newTraits);
    },
    [nodeData.traits, updateTraits]
  );

  const handleTraitValueChange = useCallback(
    (traitId: string, value: string) => {
      const newTraits = nodeData.traits.map((t) =>
        t.id === traitId ? { ...t, value } : t
      );
      updateTraits(newTraits);
    },
    [nodeData.traits, updateTraits]
  );

  const handleTraitToggle = useCallback(
    (traitId: string) => {
      const newTraits = nodeData.traits.map((t) =>
        t.id === traitId ? { ...t, enabled: !t.enabled } : t
      );
      updateTraits(newTraits);
    },
    [nodeData.traits, updateTraits]
  );

  return (
    <BaseNode
      id={id}
      title="Brand DNA"
      customTitle={nodeData.customTitle}
      comment={nodeData.comment}
      onCustomTitleChange={(title) =>
        updateNodeData(id, { customTitle: title || undefined })
      }
      onCommentChange={(comment) =>
        updateNodeData(id, { comment: comment || undefined })
      }
      selected={selected}
      nodeAccentColor="blue"
    >
      <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto nowheel nodrag nopan">
        {nodeData.traits.map((trait) => (
          <div
            key={trait.id}
            className="flex flex-col gap-1 p-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-base)]/50"
          >
            {/* Header row: label input + toggle + remove */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={trait.label}
                onChange={(e) =>
                  handleTraitLabelChange(trait.id, e.target.value)
                }
                placeholder="Trait label..."
                className="nodrag nopan flex-1 min-w-0 px-1.5 py-0.5 text-[11px] text-[var(--text-primary)] bg-transparent border border-[var(--border-subtle)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-muted)]"
              />
              {/* Toggle switch */}
              <button
                onClick={() => handleTraitToggle(trait.id)}
                className="nodrag nopan shrink-0 w-7 h-4 rounded-full transition-colors duration-150 relative"
                style={{
                  backgroundColor: trait.enabled
                    ? "var(--accent-primary)"
                    : "var(--border-subtle)",
                }}
                title={trait.enabled ? "Disable trait" : "Enable trait"}
              >
                <span
                  className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-150"
                  style={{
                    left: trait.enabled ? "14px" : "2px",
                  }}
                />
              </button>
              {/* Remove button */}
              <button
                onClick={() => handleRemoveTrait(trait.id)}
                className="nodrag nopan shrink-0 w-4 h-4 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--node-error)] transition-colors duration-150 rounded"
                title="Remove trait"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {/* JSON value textarea */}
            <textarea
              value={trait.value}
              onChange={(e) =>
                handleTraitValueChange(trait.id, e.target.value)
              }
              placeholder="{}"
              rows={3}
              className="nodrag nopan nowheel w-full px-1.5 py-1 text-[10px] leading-relaxed text-[var(--text-primary)] bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-muted)]"
              style={{ fontFamily: "'DM Mono', monospace" }}
            />
          </div>
        ))}
      </div>

      {/* Add trait button */}
      <button
        onClick={handleAddTrait}
        className="nodrag nopan w-full mt-1 py-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-dashed border-[var(--border-subtle)] hover:border-[var(--accent-primary)] rounded transition-all duration-150"
      >
        + Add Trait
      </button>

      {/* Text output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        data-handletype="text"
      />
    </BaseNode>
  );
}
