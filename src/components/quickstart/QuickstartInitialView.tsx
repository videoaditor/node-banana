"use client";

import { useState, useEffect, useCallback } from "react";
import { WorkflowFile } from "@/store/workflowStore";
import { getAllPresets } from "@/lib/quickstart/templates";

interface QuickstartInitialViewProps {
  onNewProject: () => void;
  onSelectTemplates: () => void;
  onSelectVibe: () => void;
  onSelectLoad: () => void;
  onWorkflowSelected: (workflow: WorkflowFile) => void;
}

interface ProjectMeta {
  name: string;
  filename: string;
  path: string;
  modifiedAt: string;
  nodeCount: number;
  previewDataUrl: string | null;
  placeholderColor: string;
}

type FilterTab = "all" | "favorites" | "templates";

const FAVORITES_STORAGE_KEY = "node-banana-favorites";

export function QuickstartInitialView({
  onNewProject,
  onSelectTemplates,
  onSelectVibe,
  onSelectLoad,
  onWorkflowSelected,
}: QuickstartInitialViewProps) {
  const [allProjects, setAllProjects] = useState<ProjectMeta[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  const presets = getAllPresets();

  // Load favorites from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) {
        setFavorites(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.error("Failed to parse favorites", e);
    }
  }, []);

  const toggleFavorite = (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const newFavs = new Set(prev);
      if (newFavs.has(filename)) {
        newFavs.delete(filename);
      } else {
        newFavs.add(filename);
      }
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(newFavs)));
      return newFavs;
    });
  };

  // Fetch recent projects on mount
  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await fetch(
          `/api/projects?path=${encodeURIComponent(
            "/Users/player/clawd/projects/node-banana-workflows"
          )}`
        );
        const result = await response.json();

        if (result.success && result.projects) {
          setAllProjects(result.projects);
        }
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setIsLoadingProjects(false);
      }
    }

    fetchProjects();
  }, []);

  // Load a workflow from file path
  const handleLoadProject = useCallback(
    async (project: ProjectMeta) => {
      setLoadingProjectId(project.filename);
      try {
        const response = await fetch(`/api/workflow?path=${encodeURIComponent(project.path)}`);
        const result = await response.json();

        if (result.success && result.workflow) {
          onWorkflowSelected(result.workflow);
        } else {
          alert("Failed to load workflow");
        }
      } catch (error) {
        console.error("Failed to load workflow:", error);
        alert("Failed to load workflow");
      } finally {
        setLoadingProjectId(null);
      }
    },
    [onWorkflowSelected]
  );

  // Load a template
  const handleLoadTemplate = useCallback(
    async (templateId: string) => {
      setLoadingProjectId(templateId);
      try {
        const response = await fetch("/api/quickstart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId,
            contentLevel: "full",
          }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to load template");
        }

        if (result.workflow) {
          onWorkflowSelected(result.workflow);
        }
      } catch (error) {
        console.error("Failed to load template:", error);
        alert("Failed to load template");
      } finally {
        setLoadingProjectId(null);
      }
    },
    [onWorkflowSelected]
  );

  const getRelativeTime = (isoDate: string): string => {
    const now = new Date();
    const date = new Date(isoDate);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredProjects = allProjects.filter((project) => {
    if (activeFilter === "favorites") {
      return favorites.has(project.filename);
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] font-mono p-6 md:p-10 selection:bg-[var(--accent-primary)] selection:text-white">
      {/* Top Section - Welcome & Actions */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-[var(--node-success)] rounded-full animate-pulse"></div>
            <span className="text-xs text-[var(--node-success)] uppercase tracking-wider">System Ready</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            NODE_TERMINAL
          </h1>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">
            Awaiting Command Input // Select or Initialize Workflow
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onNewProject}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/50 rounded-sm text-sm font-medium transition-colors"
          >
            <span className="text-lg leading-none">+</span> [INIT] New Workflow
          </button>
          <button
            onClick={onSelectVibe}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white border border-[var(--border-subtle)] rounded-sm text-sm font-medium transition-colors"
          >
            [PROMPT] AI Wizard
          </button>
          <button
            onClick={onSelectLoad}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white border border-[var(--border-subtle)] rounded-sm text-sm font-medium transition-colors"
          >
            [LOAD] JSON
          </button>
        </div>
      </div>

      {/* Main Content Area - Split Layout */}
      <div className="flex-1 flex flex-col border border-[var(--border-subtle)] bg-[var(--bg-elevated)] rounded-sm overflow-hidden">

        {/* Directory Navigator (Tabs) */}
        <div className="flex bg-[var(--bg-base)] border-b border-[var(--border-subtle)] px-2 pt-2 gap-1 overflow-x-auto shrink-0">
          {(["all", "favorites", "templates"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-2 text-xs uppercase tracking-wider font-medium border-t border-x rounded-t transition-colors whitespace-nowrap ${activeFilter === tab
                ? "bg-[var(--bg-elevated)] text-[var(--accent-primary)] border-[var(--border-subtle)]"
                : "bg-transparent text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]/50"
                }`}
            >
              /dir/{tab}
            </button>
          ))}
        </div>

        {/* List Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {isLoadingProjects ? (
            <div className="flex items-center gap-3 text-[var(--text-muted)] p-4 text-sm">
              <span className="w-2 h-4 bg-[var(--text-muted)] animate-pulse"></span>
              Scanning file system...
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border-subtle)]/50 mb-2">
                <div className="col-span-1 text-center">Fav</div>
                <div className="col-span-1 text-center">Data</div>
                <div className="col-span-5">Filename</div>
                <div className="col-span-2 text-right">Nodes</div>
                <div className="col-span-3 text-right">Last Modified</div>
              </div>

              {activeFilter === "templates" ? (
                presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleLoadTemplate(preset.id)}
                    disabled={loadingProjectId !== null}
                    className="group grid grid-cols-12 gap-4 items-center px-4 py-3 bg-[var(--bg-surface)]/30 hover:bg-[var(--bg-surface)] border border-transparent hover:border-[var(--border-subtle)] rounded transition-all text-left disabled:opacity-50"
                  >
                    <div className="col-span-1 flex justify-center text-[var(--text-muted)]">
                      -
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <div className="w-8 h-8 flex items-center justify-center bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-sm text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={preset.icon} />
                        </svg>
                      </div>
                    </div>
                    <div className="col-span-5 flex flex-col truncate pr-4">
                      <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
                        {preset.name}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                        {preset.description}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1 flex-wrap">
                      {preset.tags.map((tag) => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 border border-[var(--border-subtle)] rounded-sm text-[var(--text-secondary)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="col-span-3 text-right text-xs text-[var(--text-muted)]">
                      Built-in
                    </div>
                  </button>
                ))
              ) : (
                filteredProjects.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[var(--text-muted)]">
                    No workflows found in this directory.
                  </div>
                ) : (
                  filteredProjects.map((project) => {
                    const isFav = favorites.has(project.filename);
                    return (
                      <button
                        key={project.filename}
                        onClick={() => handleLoadProject(project)}
                        disabled={loadingProjectId !== null}
                        className="group grid grid-cols-12 gap-4 items-center px-4 py-3 bg-[var(--bg-surface)]/30 hover:bg-[var(--bg-surface)] border border-transparent hover:border-[var(--border-subtle)] rounded transition-all text-left disabled:opacity-50"
                      >
                        {/* Fav Toggle */}
                        <div
                          className="col-span-1 flex justify-center cursor-pointer p-2"
                          onClick={(e) => toggleFavorite(e, project.filename)}
                        >
                          <svg
                            className={`w-4 h-4 transition-colors ${isFav ? "text-yellow-500" : "text-[var(--text-muted)] hover:text-yellow-500/50"}`}
                            fill={isFav ? "currentColor" : "none"}
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                          </svg>
                        </div>

                        {/* Thumbnail */}
                        <div className="col-span-1 flex justify-center">
                          <div className="w-8 h-8 rounded-sm overflow-hidden bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                            {project.previewDataUrl ? (
                              <img src={project.previewDataUrl!} alt="" className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
                            ) : (
                              <div className="w-full h-full" style={{ backgroundColor: project.placeholderColor, opacity: 0.3 }} />
                            )}
                          </div>
                        </div>

                        {/* Name */}
                        <div className="col-span-5 flex flex-col truncate pr-4">
                          <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
                            {project.name}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] truncate mt-0.5 font-mono">
                            {project.filename}
                          </span>
                        </div>

                        {/* Nodes count */}
                        <div className="col-span-2 text-right text-xs text-[var(--text-muted)] font-mono">
                          {project.nodeCount} <span className="text-[10px]">obj</span>
                        </div>

                        {/* Modified */}
                        <div className="col-span-3 text-right text-xs text-[var(--text-muted)] font-mono flex flex-col justify-end items-end">
                          <span>{getRelativeTime(project.modifiedAt)}</span>
                        </div>
                      </button>
                    );
                  })
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
