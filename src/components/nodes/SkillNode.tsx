"use client";

import { useCallback } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { SkillNodeData } from "@/types";

type SkillNodeType = Node<SkillNodeData, "skill">;

export function SkillNode({ id, data, selected }: NodeProps<SkillNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const handleSkillNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { skillName: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { skillDescription: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleOutputDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { outputDescription: e.target.value });
    },
    [id, updateNodeData]
  );

  const handleInputDescriptionChange = useCallback(
    (handleId: string, description: string) => {
      const updated = (nodeData.inputDescriptions || []).map((d) =>
        d.handleId === handleId ? { ...d, description } : d
      );
      updateNodeData(id, { inputDescriptions: updated });
    },
    [id, nodeData.inputDescriptions, updateNodeData]
  );

  return (
    <BaseNode
      id={id}
      selected={selected}
      title="Skill"
      customTitle={nodeData.customTitle}
      nodeAccentColor="cyan"
      headerAction={
        <span
          className="ml-1.5 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] rounded bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/25 font-['DM_Mono',monospace]"
        >
          Agent
        </span>
      }
    >
      {/* Input handles: text (top), image (bottom) */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{ top: "35%", background: "#3b82f6", border: "2px solid #1d4ed8" }}
        title="Text input"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        style={{ top: "65%", background: "#22c55e", border: "2px solid #15803d" }}
        title="Image input"
      />

      {/* Output handles: text (top), image (bottom) */}
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        style={{ top: "35%", background: "#3b82f6", border: "2px solid #1d4ed8" }}
        title="Text output"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        style={{ top: "65%", background: "#22c55e", border: "2px solid #15803d" }}
        title="Image output"
      />

      <div className="px-3 pb-3 space-y-2.5">
        {/* Skill Name */}
        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide block mb-1 font-['DM_Mono',monospace]">
            Skill Name
          </label>
          <input
            type="text"
            value={nodeData.skillName || ""}
            onChange={handleSkillNameChange}
            placeholder="e.g. Animate Scene"
            className="nodrag nopan w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] font-bold text-[var(--text-primary)] rounded-md px-2 py-1.5 focus:outline-none focus:border-[#22d3ee]/50 focus:ring-1 focus:ring-[#22d3ee]/30 font-['DM_Mono',monospace]"
          />
        </div>

        {/* Skill Description */}
        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide block mb-1 font-['DM_Mono',monospace]">
            Description
          </label>
          <textarea
            value={nodeData.skillDescription || ""}
            onChange={handleDescriptionChange}
            placeholder="Describe what this skill does for the agent..."
            rows={2}
            className="nodrag nopan nowheel w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] rounded-md px-2 py-1.5 resize-none focus:outline-none focus:border-[#22d3ee]/50 focus:ring-1 focus:ring-[#22d3ee]/30 font-['DM_Mono',monospace]"
          />
        </div>

        {/* Input Descriptions */}
        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide block mb-1 font-['DM_Mono',monospace]">
            Inputs
          </label>
          <div className="space-y-1.5">
            {(nodeData.inputDescriptions || []).map((inputDesc) => (
              <div key={inputDesc.handleId} className="flex items-center gap-1.5">
                <span
                  className="shrink-0 px-1.5 py-0.5 text-[9px] font-medium uppercase rounded font-['DM_Mono',monospace]"
                  style={{
                    background: inputDesc.handleId === "image" ? "rgba(34,197,94,0.15)" : "rgba(59,130,246,0.15)",
                    color: inputDesc.handleId === "image" ? "#22c55e" : "#3b82f6",
                    border: `1px solid ${inputDesc.handleId === "image" ? "rgba(34,197,94,0.25)" : "rgba(59,130,246,0.25)"}`,
                  }}
                >
                  {inputDesc.handleId}
                </span>
                <input
                  type="text"
                  value={inputDesc.description}
                  onChange={(e) => handleInputDescriptionChange(inputDesc.handleId, e.target.value)}
                  placeholder={`Describe ${inputDesc.handleId} input...`}
                  className="nodrag nopan flex-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] rounded px-1.5 py-1 focus:outline-none focus:border-[#22d3ee]/50 font-['DM_Mono',monospace]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Output Description */}
        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide block mb-1 font-['DM_Mono',monospace]">
            Output
          </label>
          <input
            type="text"
            value={nodeData.outputDescription || ""}
            onChange={handleOutputDescriptionChange}
            placeholder="Describe what this skill outputs..."
            className="nodrag nopan w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] rounded-md px-2 py-1.5 focus:outline-none focus:border-[#22d3ee]/50 focus:ring-1 focus:ring-[#22d3ee]/30 font-['DM_Mono',monospace]"
          />
        </div>

        {/* Handle labels */}
        <div className="flex justify-between text-[9px] text-[var(--text-muted)] font-['DM_Mono',monospace]">
          <span>in: text · image</span>
          <span>out: text · image</span>
        </div>
      </div>
    </BaseNode>
  );
}
