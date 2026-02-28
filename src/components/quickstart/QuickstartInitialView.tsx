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

  return (
    <div className="min-h-screen flex flex-col p-8 md:p-12 lg:p-16">
      {/* Section 1 — Hero Row */}
      <div className="mb-12">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left: Hero Text + CTA */}
          <div className="flex-1 flex flex-col gap-6">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 leading-tight">
                What will you create today?
              </h1>
              <p className="text-lg text-neutral-400">
                Build AI image workflows by connecting nodes
              </p>
            </div>

            <button
              onClick={onNewProject}
              className="group inline-flex items-center gap-3 bg-orange-600 hover:bg-orange-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-orange-600/30 hover:shadow-orange-500/40 w-fit"
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
            <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider mb-4">
              Recent Workflows
            </h3>

            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-12">
                <svg
                  className="w-6 h-6 text-neutral-500 animate-spin"
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
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                {recentProjects.map((project) => (
                  <button
                    key={project.filename}
                    onClick={() => handleLoadProject(project)}
                    disabled={loadingProjectId !== null}
                    className="group flex-shrink-0 w-48 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 rounded-lg overflow-hidden transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {/* Thumbnail */}
                    <div className="w-full h-32 overflow-hidden bg-neutral-900">
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
                        <h4 className="text-sm font-medium text-neutral-200 truncate group-hover:text-white transition-colors">
                          {project.name}
                        </h4>
                        <svg
                          className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-1"
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
                      <p className="text-xs text-neutral-500">
                        {getRelativeTime(project.modifiedAt)}
                      </p>
                    </div>
                  </button>
                ))}

                {/* Browse All Card */}
                {recentProjects.length < 5 && (
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="group flex-shrink-0 w-48 bg-neutral-800/30 hover:bg-neutral-800/50 border border-neutral-700 border-dashed hover:border-neutral-600 rounded-lg overflow-hidden transition-all flex flex-col items-center justify-center h-[180px]"
                  >
                    <svg
                      className="w-8 h-8 text-neutral-600 group-hover:text-neutral-400 mb-2"
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
                    <span className="text-sm font-medium text-neutral-400 group-hover:text-neutral-300">
                      Browse all →
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2 — Browse All Workflows (Expandable) */}
      {isExpanded && (
        <div className="border-t border-neutral-800 pt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white">Browse All Workflows</h2>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Collapse ↑
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-6 border-b border-neutral-800 pb-2">
            {(["all", "images", "videos", "ugc", "templates"] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeFilter === tab
                    ? "bg-neutral-800 text-white border-b-2 border-orange-500"
                    : "text-neutral-400 hover:text-neutral-200"
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
                  className="group bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 rounded-lg overflow-hidden transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Thumbnail Placeholder */}
                  <div className="w-full h-40 bg-neutral-900 flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-neutral-600"
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
                    <h4 className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors mb-1">
                      {preset.name}
                    </h4>
                    <p className="text-xs text-neutral-500 line-clamp-2">
                      {preset.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {preset.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 rounded"
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
                  className="group bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 rounded-lg overflow-hidden transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Thumbnail */}
                  <div className="w-full h-40 bg-neutral-900 overflow-hidden">
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
                    <h4 className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors mb-1 truncate">
                      {project.name}
                    </h4>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-neutral-500">
                        {getRelativeTime(project.modifiedAt)}
                      </p>
                      <span className="text-xs text-neutral-600">
                        
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
          className="text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-2"
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
          className="text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-2"
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
