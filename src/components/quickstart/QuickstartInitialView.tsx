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

  const favoriteProjects = allProjects.filter((p) => favorites.has(p.filename));

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] selection:bg-[var(--accent-primary)] selection:text-white">

      {/* ── Hero Section ── */}
      <div className="px-8 md:px-16 pt-12 pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 max-w-[1400px] mx-auto">
          {/* Left: Logo + Headline */}
          <div className="flex items-start gap-5">
            <img
              src="/leaking-barrel.png"
              alt=""
              className="w-16 h-16 mt-1 opacity-90 object-contain drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]"
              draggable={false}
            />
            <div>
              <h1
                className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]"
                style={{ fontFamily: "'Inter', 'SF Pro Display', -apple-system, system-ui, sans-serif" }}
              >
                Welcome to<br />
                <span className="bg-gradient-to-r from-[#f97316] to-[#ef4444] bg-clip-text text-transparent">
                  Aditors Gas Station
                </span>
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-3 max-w-md leading-relaxed">
                Node-based workflow editor for AI image &amp; video generation.
                Build, iterate, and ship creative pipelines.
              </p>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onNewProject}
              className="group flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#f97316] to-[#ef4444] hover:from-[#ea580c] hover:to-[#dc2626] text-white rounded-lg text-sm font-semibold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all duration-200 hover:scale-[1.02]"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Workflow
            </button>
            <button
              onClick={onSelectVibe}
              className="flex items-center gap-2 px-4 py-3 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium transition-all duration-200 hover:border-[var(--text-muted)]"
            >
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              AI Wizard
            </button>
            <button
              onClick={onSelectLoad}
              className="flex items-center gap-2 px-4 py-3 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg text-sm font-medium transition-all duration-200 hover:border-[var(--text-muted)]"
            >
              <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Load JSON
            </button>
          </div>
        </div>
      </div>

      {/* ── Favorites Row (pinned, always visible when favorites exist) ── */}
      {activeFilter !== "templates" && favoriteProjects.length > 0 && (
        <div className="px-8 md:px-16 mb-6">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              <span className="text-sm font-semibold text-[var(--text-primary)]">Favorites</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {favoriteProjects.map((project) => (
                <button
                  key={`fav-${project.filename}`}
                  onClick={() => handleLoadProject(project)}
                  disabled={loadingProjectId !== null}
                  className="group shrink-0 w-[200px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-yellow-500/30 rounded-xl overflow-hidden transition-all duration-200 text-left disabled:opacity-50 hover:shadow-lg hover:shadow-yellow-500/5"
                >
                  {/* Thumbnail */}
                  <div className="w-full h-24 bg-[var(--bg-base)] relative overflow-hidden">
                    {project.previewDataUrl ? (
                      <img src={project.previewDataUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: project.placeholderColor, opacity: 0.15 }}>
                        <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V15m0 6.75l-2.25-1.313M12 15l2.25 1.313M12 15l-2.25 1.313" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <svg className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="px-3 py-2.5">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">{project.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{getRelativeTime(project.modifiedAt)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex-1 px-8 md:px-16 pb-10">
        <div className="max-w-[1400px] mx-auto">
          {/* Tabs */}
          <div className="flex items-center gap-1 mb-5 border-b border-[var(--border-subtle)]">
            {(["all", "favorites", "templates"] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors relative ${activeFilter === tab
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
              >
                {tab === "all" ? "All Workflows" : tab === "favorites" ? "Favorites" : "Templates"}
                {activeFilter === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#f97316] to-[#ef4444] rounded-full" />
                )}
              </button>
            ))}
            {/* Project count */}
            <span className="ml-auto text-xs text-[var(--text-muted)]">
              {activeFilter === "templates" ? `${presets.length} templates` : `${filteredProjects.length} workflows`}
            </span>
          </div>

          {/* Content */}
          {isLoadingProjects ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-[var(--text-muted)]">
                <div className="w-5 h-5 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading workflows...</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {activeFilter === "templates" ? (
                presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleLoadTemplate(preset.id)}
                    disabled={loadingProjectId !== null}
                    className="group bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-purple-500/30 rounded-xl overflow-hidden transition-all duration-200 text-left disabled:opacity-50 hover:shadow-lg hover:shadow-purple-500/5"
                  >
                    {/* Template icon area */}
                    <div className="w-full h-32 bg-[var(--bg-base)] flex items-center justify-center relative">
                      <svg className="w-10 h-10 text-[var(--text-muted)] group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={preset.icon} />
                      </svg>
                      {/* Tags */}
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        {preset.tags.map((tag) => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-muted)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* Info */}
                    <div className="p-3">
                      <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-purple-300 transition-colors truncate">
                        {preset.name}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                filteredProjects.length === 0 ? (
                  <div className="col-span-full py-16 text-center">
                    <svg className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    <p className="text-sm text-[var(--text-muted)]">
                      {activeFilter === "favorites" ? "No favorites yet. Star a workflow to pin it here." : "No workflows found."}
                    </p>
                  </div>
                ) : (
                  filteredProjects.map((project) => {
                    const isFav = favorites.has(project.filename);
                    return (
                      <button
                        key={project.filename}
                        onClick={() => handleLoadProject(project)}
                        disabled={loadingProjectId !== null}
                        className="group bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/30 rounded-xl overflow-hidden transition-all duration-200 text-left disabled:opacity-50 hover:shadow-lg hover:shadow-[var(--accent-primary)]/5"
                      >
                        {/* Thumbnail header */}
                        <div className="w-full h-32 bg-[var(--bg-base)] relative overflow-hidden">
                          {project.previewDataUrl ? (
                            <img src={project.previewDataUrl!} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: project.placeholderColor, opacity: 0.1 }}>
                              <svg className="w-10 h-10 text-[var(--text-muted)] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V15m0 6.75l-2.25-1.313M12 15l2.25 1.313M12 15l-2.25 1.313" />
                              </svg>
                            </div>
                          )}
                          {/* Favorite toggle */}
                          <div
                            className="absolute top-2 right-2 p-1 rounded-md hover:bg-black/30 transition-colors cursor-pointer"
                            onClick={(e) => toggleFavorite(e, project.filename)}
                          >
                            <svg
                              className={`w-4 h-4 transition-colors ${isFav ? "text-yellow-500" : "text-white/40 group-hover:text-white/60"}`}
                              fill={isFav ? "currentColor" : "none"}
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                            </svg>
                          </div>
                          {/* Node count badge */}
                          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/50 backdrop-blur-sm rounded text-[10px] text-white/70">
                            {project.nodeCount} nodes
                          </div>
                        </div>
                        {/* Info */}
                        <div className="p-3">
                          <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
                            {project.name}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] mt-1">
                            {getRelativeTime(project.modifiedAt)}
                          </div>
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
