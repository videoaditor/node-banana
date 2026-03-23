"use client";

import { useCallback, useEffect, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { SubWorkflowNodeData } from "@/types";

type SubWorkflowNodeType = Node<SubWorkflowNodeData, "subWorkflow">;

interface TeamWorkflow {
  name: string;
  filename: string;
  modifiedAt: string;
}

export function SubWorkflowNode({ id, data, selected }: NodeProps<SubWorkflowNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const [teamWorkflows, setTeamWorkflows] = useState<TeamWorkflow[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Fetch team workflows list
  useEffect(() => {
    async function fetchTeamWorkflows() {
      try {
        const res = await fetch("/api/team-workflows");
        const result = await res.json();
        if (result.success && result.workflows) {
          setTeamWorkflows(result.workflows);
        }
      } catch {
        // ignore
      } finally {
        setIsLoadingList(false);
      }
    }
    fetchTeamWorkflows();
  }, []);

  const handleWorkflowSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const filename = e.target.value || null;
      const found = teamWorkflows.find((w) => w.filename === filename);
      updateNodeData(id, {
        selectedWorkflowFilename: filename,
        selectedWorkflowName: found?.name ?? null,
        outputText: null,
        outputImage: null,
        status: "idle",
        error: null,
      });
    },
    [id, updateNodeData, teamWorkflows]
  );

  const statusColor =
    nodeData.status === "loading"
      ? "text-yellow-400"
      : nodeData.status === "complete"
      ? "text-emerald-400"
      : nodeData.status === "error"
      ? "text-red-400"
      : "text-[#555]";

  return (
    <BaseNode id={id} selected={selected} title="Sub-Workflow" customTitle={nodeData.customTitle}>
      {/* Input handles */}
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

      {/* Output handles */}
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

      <div className="px-3 pb-3 space-y-3">
        {/* Workflow picker */}
        <div>
          <label className="text-[10px] text-[#666] uppercase tracking-wide block mb-1">Team Workflow</label>
          {isLoadingList ? (
            <div className="text-[11px] text-[#555] italic">Loading workflows...</div>
          ) : (
            <select
              value={nodeData.selectedWorkflowFilename ?? ""}
              onChange={handleWorkflowSelect}
              className="w-full bg-[#1a1a1f] border border-[#333] text-[12px] text-[#ccc] rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500/50 nodrag"
            >
              <option value="">— Select a workflow —</option>
              {teamWorkflows.map((wf) => (
                <option key={wf.filename} value={wf.filename}>
                  {wf.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Status */}
        {nodeData.status !== "idle" && (
          <div className={`text-[10px] font-medium ${statusColor}`}>
            {nodeData.status === "loading" && "Running sub-workflow..."}
            {nodeData.status === "complete" && "Done"}
            {nodeData.status === "error" && `Error: ${nodeData.error}`}
          </div>
        )}

        {/* Output preview */}
        {nodeData.outputText && (
          <div className="p-2 rounded-lg bg-[#111] border border-[#2a2a2a] text-[11px] text-[#bbb] max-h-24 overflow-y-auto leading-relaxed">
            {nodeData.outputText}
          </div>
        )}
        {nodeData.outputImage && (
          <div className="rounded-lg overflow-hidden border border-[#2a2a2a]">
            <img src={nodeData.outputImage} alt="Sub-workflow output" className="w-full h-auto" />
          </div>
        )}

        {/* Handle labels */}
        <div className="flex justify-between text-[9px] text-[#444]">
          <span>in: text · image</span>
          <span>out: text · image</span>
        </div>
      </div>
    </BaseNode>
  );
}
