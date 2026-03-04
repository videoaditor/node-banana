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

type FilterTab = "all" | "images" | "videos" | "ugc" | "templates";

export function QuickstartInitialView({
  onNewProject,
  onSelectTemplates,
  onSelectVibe,
  onSelectLoad,
  onWorkflowSelected,
}: QuickstartInitialViewProps) {
  const [recentProjects, setRecentProjects] = useState<ProjectMeta[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectMeta[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  const presets = getAllPresets();

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
          setRecentProjects(result.projects.slice(0, 5));
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

  // Filter projects based on active tab
  const filteredProjects = allProjects.filter((project) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "templates") return false; // Templates shown separately
    if (activeFilter === "images") {
      return project.name.toLowerCase().includes("image") ||
        project.name.toLowerCase().includes("photo") ||
        project.name.toLowerCase().includes("product");
    }
    if (activeFilter === "videos") {
      return project.name.toLowerCase().includes("video") ||
        project.name.toLowerCase().includes("sora") ||
        project.name.toLowerCase().includes("kling");
    }
    if (activeFilter === "ugc") {
      return project.name.toLowerCase().includes("ugc") ||
        project.name.toLowerCase().includes("ad") ||
        project.name.toLowerCase().includes("advertorial");
    }
    return true;
  });

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

  const genWorkflows = [
    {
      id: "ugc-pipeline",
      name: "UGC Pipeline",
      description: "AI actor + product → full ad video",
      icon: "M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z",
      color: "#e85d04",
      url: "https://gen.aditor.ai/#ugc",
      tag: "VIDEO",
      tagColor: "bg-orange-500/20 text-orange-400",
    },
    {
      id: "image-gen",
      name: "Image Gen",
      description: "Nano Banana Pro — product & ad images",
      icon: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
      color: "#7c3aed",
      url: "https://gen.aditor.ai/#image",
      tag: "IMAGE",
      tagColor: "bg-violet-500/20 text-violet-400",
    },
    {
      id: "bulk-i2v",
      name: "Bulk I2V",
      description: "Batch image-to-video with Kling / Wan",
      icon: "M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 19.5m9.75-9.75c0 .621-.504 1.125-1.125 1.125H12.75a1.125 1.125 0 01-1.125-1.125v-4.5c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v4.5z",
      color: "#0891b2",
      url: "https://gen.aditor.ai/#bulk",
      tag: "VIDEO",
      tagColor: "bg-cyan-500/20 text-cyan-400",
    },
    {
      id: "brand-dna",
      name: "Brand DNA",
      description: "Store product refs, characters, brand voice",
      icon: "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L9.568 3z M6 6h.008v.008H6V6z",
      color: "#059669",
      url: "https://gen.aditor.ai/#brands",
      tag: "CONFIG",
      tagColor: "bg-emerald-500/20 text-emerald-400",
    },
    {
      id: "scorecard",
      name: "Brand Scorecard",
      description: "Pipeline health, editor dispatch, brand status",
      icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
      color: "#d97706",
      url: "https://scorecard.aditor.ai",
      tag: "ADMIN",
      tagColor: "bg-yellow-500/20 text-yellow-400",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col p-8 md:p-12 lg:p-16" style={{ background: 'radial-gradient(ellipse at top left, rgba(74,144,217,0.06) 0%, transparent 50%)' }}>
      {/* Section 1 — Hero Row */}
      <div className="mb-12">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left: Hero Text + CTA */}
          <div className="flex-1 flex flex-col gap-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 leading-tight">
                What will you create today?
              </h1>
              <p className="text-lg text-[var(--text-secondary)]">
                Build AI image workflows by connecting nodes
              </p>
            </div>

            <button
              onClick={onNewProject}
              className="group inline-flex items-center gap-3 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 w-fit hover:-translate-y-[1px]"
              style={{
                background: 'var(--accent-primary)',
                boxShadow: '0 4px 24px rgba(74, 144, 217, 0.3), 0 0 0 1px rgba(74, 144, 217, 0.2)',
              }}
            >
              New Project
              <svg
                className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </button>
          </div>

          {/* Right: Recent Workflows Carousel */}
          <div className="flex-1 w-full">
            <h3 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.12em] mb-4 font-['DM_Mono',monospace]">
              Recent Workflows
            </h3>

            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-12">
                <svg
                  className="w-6 h-6 text-[var(--text-muted)] animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[var(--bg-surface)] scrollbar-track-transparent">
                {recentProjects.map((project) => (
                  <button
                    key={project.filename}
                    onClick={() => handleLoadProject(project)}
                    disabled={loadingProjectId !== null}
                    className="group flex-shrink-0 w-48 border border-[var(--border-subtle)] rounded-lg overflow-hidden transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-[1px]"
                    style={{
                      background: 'rgba(28, 30, 36, 0.5)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="w-full h-32 overflow-hidden bg-[var(--bg-base)]">
                      {project.previewDataUrl ? (
                        <img
                          src={project.previewDataUrl!}
                          alt={project.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-white text-xs font-medium"
                          style={{
                            background: `linear-gradient(135deg, ${project.placeholderColor}, ${project.placeholderColor}99)`,
                          }}
                        >

                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 text-left">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-white transition-all duration-[120ms]">
                          {project.name}
                        </h4>
                        <svg
                          className="w-4 h-4 text-[var(--text-muted)] group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                          />
                        </svg>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        {getRelativeTime(project.modifiedAt)}
                      </p>
                    </div>
                  </button>
                ))}

                {/* Browse All Card */}
                {recentProjects.length < 5 && (
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="group flex-shrink-0 w-48 bg-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]/50 border border-[var(--border-subtle)] border-dashed hover:border-[var(--border-subtle)] rounded-lg overflow-hidden transition-all flex flex-col items-center justify-center h-[180px]"
                  >
                    <svg
                      className="w-8 h-8 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                      />
                    </svg>
                    <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-secondary)]">
                      Browse all →
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2 — Gen Workflows Row */}
      <div className="mb-10">
        <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider mb-4">
          Gen Workflows
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
          {genWorkflows.map((wf) => (
            <a
              key={wf.id}
              href={wf.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex-shrink-0 w-48 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 rounded-lg overflow-hidden transition-all"
            >
              {/* Color strip + icon */}
              <div
                className="w-full h-24 flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${wf.color}22, ${wf.color}44)` }}
              >
                <svg
                  className="w-10 h-10 transition-transform group-hover:scale-110"
                  style={{ color: wf.color }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={wf.icon} />
                </svg>
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-neutral-200 truncate group-hover:text-white transition-colors">
                    {wf.name}
                  </h4>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ml-1 ${wf.tagColor}`}>
                    {wf.tag}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 line-clamp-2 group-hover:text-neutral-400 transition-colors">
                  {wf.description}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Section 3 — Browse All Workflows (Expandable) */}
      {isExpanded && (
        <div className="border-t border-[var(--border-subtle)] pt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white">Browse All Workflows</h2>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-[120ms]"
            >
              Collapse ↑
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6 border-b border-[var(--border-subtle)] pb-2">
            {(["all", "images", "videos", "ugc", "templates"] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-[120ms] ${activeFilter === tab
                    ? "bg-[var(--bg-elevated)] text-white border-b-2 border-[var(--accent-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Content Grid */}
          {activeFilter === "templates" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleLoadTemplate(preset.id)}
                  disabled={loadingProjectId !== null}
                  className="group bg-[var(--bg-elevated)]/50 hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] rounded-lg overflow-hidden transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Thumbnail Placeholder */}
                  <div className="w-full h-40 bg-[var(--bg-base)] flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-[var(--text-muted)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={preset.icon}
                      />
                    </svg>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-[var(--text-primary)] group-hover:text-white transition-all duration-[120ms] mb-1">
                      {preset.name}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                      {preset.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {preset.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-[10px] font-medium bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProjects.map((project) => (
                <button
                  key={project.filename}
                  onClick={() => handleLoadProject(project)}
                  disabled={loadingProjectId !== null}
                  className="group bg-[var(--bg-elevated)]/50 hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] rounded-lg overflow-hidden transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Thumbnail */}
                  <div className="w-full h-40 bg-[var(--bg-base)] overflow-hidden">
                    {project.previewDataUrl ? (
                      <img
                        src={project.previewDataUrl!}
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white text-sm font-medium"
                        style={{
                          background: `linear-gradient(135deg, ${project.placeholderColor}, ${project.placeholderColor}99)`,
                        }}
                      >

                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-[var(--text-primary)] group-hover:text-white transition-all duration-[120ms] mb-1 truncate">
                      {project.name}
                    </h4>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[var(--text-muted)]">
                        {getRelativeTime(project.modifiedAt)}
                      </p>
                      <span className="text-xs text-[var(--text-muted)]">

                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Row — Secondary Actions */}
      <div className="mt-auto pt-12 flex items-center gap-6 text-sm">
        <button
          onClick={onSelectVibe}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-[120ms] flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
            />
          </svg>
          Prompt a workflow (Beta)
        </button>

        <button
          onClick={onSelectLoad}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-[120ms] flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          Import .json file
        </button>
      </div>
    </div>
  );
}
