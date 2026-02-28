"use client";

import { useState, useEffect, useCallback } from "react";
import { WorkflowFile, useWorkflowStore } from "@/store/workflowStore";
import { getAllPresets } from "@/lib/quickstart/templates";
import { QuickstartBackButton } from "./QuickstartBackButton";
import { CommunityWorkflowMeta } from "@/types/quickstart";

type Tab = "templates" | "projects";

interface ProjectMeta {
  name: string;
  filename: string;
  path: string;
  modifiedAt: string;
  nodeCount: number;
}

interface QuickstartTemplatesViewProps {
  onBack: () => void;
  onWorkflowSelected: (workflow: WorkflowFile) => void;
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function QuickstartTemplatesView({
  onBack,
  onWorkflowSelected,
}: QuickstartTemplatesViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("templates");
  const [communityWorkflows, setCommunityWorkflows] = useState<CommunityWorkflowMeta[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [loadingWorkflowId, setLoadingWorkflowId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Projects state
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [loadingProjectFile, setLoadingProjectFile] = useState<string | null>(null);

  const saveDirectoryPath = useWorkflowStore((s) => s.saveDirectoryPath);
  const presets = getAllPresets();

  // Fetch community workflows on mount
  useEffect(() => {
    async function fetchCommunityWorkflows() {
      try {
        const response = await fetch("/api/community-workflows");
        const result = await response.json();
        if (result.success) {
          setCommunityWorkflows(result.workflows);
        }
      } catch (err) {
        console.error("Error fetching community workflows:", err);
      } finally {
        setIsLoadingList(false);
      }
    }
    fetchCommunityWorkflows();
  }, []);

  // Fetch projects when tab switches to projects
  useEffect(() => {
    if (activeTab !== "projects" || !saveDirectoryPath) return;
    let cancelled = false;
    setIsLoadingProjects(true);

    async function fetchProjects() {
      try {
        const response = await fetch(
          `/api/projects?path=${encodeURIComponent(saveDirectoryPath!)}`
        );
        const result = await response.json();
        if (!cancelled && result.success) {
          setProjects(result.projects);
        }
      } catch (err) {
        console.error("Error fetching projects:", err);
      } finally {
        if (!cancelled) setIsLoadingProjects(false);
      }
    }
    fetchProjects();
    return () => { cancelled = true; };
  }, [activeTab, saveDirectoryPath]);

  const handlePresetSelect = useCallback(
    async (templateId: string) => {
      setLoadingWorkflowId(templateId);
      setError(null);
      try {
        const response = await fetch("/api/quickstart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, contentLevel: "full" }),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error || "Failed to load template");
        if (result.workflow) onWorkflowSelected(result.workflow);
      } catch (err) {
        console.error("Error loading preset:", err);
        setError(err instanceof Error ? err.message : "Failed to load template");
      } finally {
        setLoadingWorkflowId(null);
      }
    },
    [onWorkflowSelected]
  );

  const handleCommunitySelect = useCallback(
    async (workflowId: string) => {
      setLoadingWorkflowId(workflowId);
      setError(null);
      try {
        const response = await fetch(`/api/community-workflows/${workflowId}`);
        const result = await response.json();
        if (!result.success || !result.downloadUrl) {
          throw new Error(result.error || "Failed to get download URL");
        }
        const workflowResponse = await fetch(result.downloadUrl);
        if (!workflowResponse.ok) throw new Error("Failed to download workflow");
        const workflow = await workflowResponse.json();
        onWorkflowSelected(workflow);
      } catch (err) {
        console.error("Error loading community workflow:", err);
        setError(err instanceof Error ? err.message : "Failed to load workflow");
      } finally {
        setLoadingWorkflowId(null);
      }
    },
    [onWorkflowSelected]
  );

  const handleProjectSelect = useCallback(
    async (project: ProjectMeta) => {
      setLoadingProjectFile(project.filename);
      setError(null);
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(project.filename)}?path=${encodeURIComponent(saveDirectoryPath!)}`
        );
        const result = await response.json();
        if (!result.success) throw new Error(result.error || "Failed to load project");
        onWorkflowSelected(result.workflow);
      } catch (err) {
        console.error("Error loading project:", err);
        setError(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        setLoadingProjectFile(null);
      }
    },
    [onWorkflowSelected, saveDirectoryPath]
  );

  const isLoading = loadingWorkflowId !== null || loadingProjectFile !== null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-700 flex items-center gap-4">
        <QuickstartBackButton onClick={onBack} disabled={isLoading} />
        <h2 className="text-lg font-semibold text-neutral-100">Workflows</h2>
      </div>

      {/* Tab Switcher */}
      <div className="px-6 pt-4 flex gap-1">
        {(["templates", "projects"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab
                ? "bg-neutral-800 text-white border-b-2 border-blue-500"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
            }`}
          >
            {tab === "templates" ? "Templates" : "Projects"}
            {tab === "projects" && projects.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-neutral-700 text-neutral-300 px-1.5 py-0.5 rounded-full">
                {projects.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === "templates" ? (
          <>
            <p className="text-sm text-neutral-400">
              Pre-built workflows to help you get started quickly. Select a template to load it into the canvas.
            </p>

            {/* Quick Start Templates */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                Quick Start
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset.id)}
                    disabled={isLoading}
                    className={`
                      group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left
                      ${loadingWorkflowId === preset.id
                        ? "bg-blue-600/20 border-blue-500/50"
                        : "bg-neutral-800/50 border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800"}
                      ${isLoading && loadingWorkflowId !== preset.id ? "opacity-50" : ""}
                      ${isLoading ? "cursor-not-allowed" : "cursor-pointer"}
                    `}
                  >
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                      loadingWorkflowId === preset.id ? "bg-blue-500/30" : "bg-neutral-700/50 group-hover:bg-neutral-700"
                    }`}>
                      {loadingWorkflowId === preset.id ? (
                        <svg className="w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-neutral-400 group-hover:text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={preset.icon} />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-neutral-200 truncate">{preset.name}</div>
                      <div className="text-[10px] text-neutral-500 truncate">{preset.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-700" />

            {/* Community Workflows */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                Community Workflows
              </h3>
              {isLoadingList ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="w-5 h-5 text-neutral-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : communityWorkflows.length === 0 ? (
                <p className="text-sm text-neutral-500 py-4">No community workflows available</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {communityWorkflows.map((workflow) => (
                    <button
                      key={workflow.id}
                      onClick={() => handleCommunitySelect(workflow.id)}
                      disabled={isLoading}
                      className={`
                        group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left
                        ${loadingWorkflowId === workflow.id
                          ? "bg-purple-600/20 border-purple-500/50"
                          : "bg-neutral-800/50 border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800"}
                        ${isLoading && loadingWorkflowId !== workflow.id ? "opacity-50" : ""}
                        ${isLoading ? "cursor-not-allowed" : "cursor-pointer"}
                      `}
                    >
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                        loadingWorkflowId === workflow.id ? "bg-purple-500/30" : "bg-neutral-700/50 group-hover:bg-neutral-700"
                      }`}>
                        {loadingWorkflowId === workflow.id ? (
                          <svg className="w-4 h-4 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-neutral-400 group-hover:text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-neutral-200 truncate">{workflow.name}</div>
                        <div className="text-[10px] text-purple-400/80">@{workflow.author}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-neutral-500 mt-3">
                Want to share your workflow?{" "}
                <a href="https://discord.com/invite/89Nr6EKkTf" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">
                  Join our Discord
                </a>{" "}
                to submit it to the community templates.
              </p>
            </div>
          </>
        ) : (
          /* Projects Tab */
          <div className="space-y-3">
            {!saveDirectoryPath ? (
              <div className="text-center py-12">
                <svg className="w-10 h-10 text-neutral-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                <p className="text-sm text-neutral-400 mb-1">No project directory configured</p>
                <p className="text-xs text-neutral-500">Set up a project directory in the settings to see your saved workflows here.</p>
              </div>
            ) : isLoadingProjects ? (
              <div className="flex items-center justify-center py-12">
                <svg className="w-5 h-5 text-neutral-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-10 h-10 text-neutral-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-sm text-neutral-400 mb-1">No saved workflows yet</p>
                <p className="text-xs text-neutral-500">Workflows you save will appear here automatically.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <button
                    key={project.filename}
                    onClick={() => handleProjectSelect(project)}
                    disabled={isLoading}
                    className={`
                      w-full group flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left
                      ${loadingProjectFile === project.filename
                        ? "bg-green-600/20 border-green-500/50"
                        : "bg-neutral-800/50 border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800"}
                      ${isLoading && loadingProjectFile !== project.filename ? "opacity-50" : ""}
                      ${isLoading ? "cursor-not-allowed" : "cursor-pointer"}
                    `}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      loadingProjectFile === project.filename ? "bg-green-500/30" : "bg-neutral-700/50 group-hover:bg-neutral-700"
                    }`}>
                      {loadingProjectFile === project.filename ? (
                        <svg className="w-5 h-5 text-green-400 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-neutral-400 group-hover:text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-neutral-200 truncate">{project.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-neutral-500">{formatRelativeDate(project.modifiedAt)}</span>
                        <span className="text-[10px] text-neutral-600">•</span>
                        <span className="text-[10px] text-neutral-500">{project.nodeCount} nodes</span>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={() => setError(null)} className="text-xs text-red-400/70 hover:text-red-400 mt-1">Dismiss</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
