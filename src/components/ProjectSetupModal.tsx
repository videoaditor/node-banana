"use client";

import { useState, useEffect } from "react";
import { generateWorkflowId, useWorkflowStore } from "@/store/workflowStore";
import { ProviderType, ProviderSettings, NodeDefaultsConfig, LLMProvider, LLMModelType } from "@/types";
import { CanvasNavigationSettings, PanMode, ZoomMode, SelectionMode } from "@/types/canvas";
import { EnvStatusResponse } from "@/app/api/env-status/route";
import { loadNodeDefaults, saveNodeDefaults } from "@/store/utils/localStorage";
import { ProviderModel } from "@/lib/providers/types";
import { ModelSearchDialog } from "@/components/modals/ModelSearchDialog";

// LLM provider and model options (mirrored from LLMGenerateNode)
const LLM_PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "google", label: "Google" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "groq", label: "Groq" },
];

const LLM_MODELS: Record<LLMProvider, { value: LLMModelType; label: string }[]> = {
  google: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
  openai: [
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
  ],
  groq: [
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B" },
    { value: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 70B" },
  ],
};

// Provider icons
const GeminiIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
  </svg>
);

const ReplicateIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 1000 1000" fill="currentColor">
    <polygon points="1000,427.6 1000,540.6 603.4,540.6 603.4,1000 477,1000 477,427.6" />
    <polygon points="1000,213.8 1000,327 364.8,327 364.8,1000 238.4,1000 238.4,213.8" />
    <polygon points="1000,0 1000,113.2 126.4,113.2 126.4,1000 0,1000 0,0" />
  </svg>
);

const FalIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 1855 1855" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M1181.65 78C1212.05 78 1236.42 101.947 1239.32 131.261C1265.25 392.744 1480.07 600.836 1750.02 625.948C1780.28 628.764 1805 652.366 1805 681.816V1174.18C1805 1203.63 1780.28 1227.24 1750.02 1230.05C1480.07 1255.16 1265.25 1463.26 1239.32 1724.74C1236.42 1754.05 1212.05 1778 1181.65 1778H673.354C642.951 1778 618.585 1754.05 615.678 1724.74C589.754 1463.26 374.927 1255.16 104.984 1230.05C74.7212 1227.24 50 1203.63 50 1174.18V681.816C50 652.366 74.7213 628.764 104.984 625.948C374.927 600.836 589.754 392.744 615.678 131.261C618.585 101.946 642.951 78 673.353 78H1181.65ZM402.377 926.561C402.377 1209.41 638.826 1438.71 930.501 1438.71C1222.18 1438.71 1458.63 1209.41 1458.63 926.561C1458.63 643.709 1222.18 414.412 930.501 414.412C638.826 414.412 402.377 643.709 402.377 926.561Z" />
  </svg>
);

const WaveSpeedIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 512 512" fill="currentColor">
    <path d="M308.946 153.758C314.185 153.758 318.268 158.321 317.516 163.506C306.856 237.02 270.334 302.155 217.471 349.386C211.398 354.812 203.458 357.586 195.315 357.586H127.562C117.863 357.586 110.001 349.724 110.001 340.025V333.552C110.001 326.82 113.882 320.731 119.792 317.505C176.087 286.779 217.883 232.832 232.32 168.537C234.216 160.09 241.509 153.758 250.167 153.758H308.946Z" />
    <path d="M183.573 153.758C188.576 153.758 192.592 157.94 192.069 162.916C187.11 210.12 160.549 250.886 122.45 275.151C116.916 278.676 110 274.489 110 267.928V171.318C110 161.62 117.862 153.758 127.56 153.758H183.573Z" />
    <path d="M414.815 153.758C425.503 153.758 433.734 163.232 431.799 173.743C420.697 234.038 398.943 290.601 368.564 341.414C362.464 351.617 351.307 357.586 339.419 357.586H274.228C266.726 357.586 262.611 348.727 267.233 342.819C306.591 292.513 334.86 233.113 348.361 168.295C350.104 159.925 357.372 153.758 365.922 153.758H414.815Z" />
  </svg>
);

// Get provider icon component
const getProviderIcon = (provider: ProviderType) => {
  switch (provider) {
    case "gemini":
      return <GeminiIcon />;
    case "replicate":
      return <ReplicateIcon />;
    case "fal":
      return <FalIcon />;
    case "wavespeed":
      return <WaveSpeedIcon />;
    default:
      return null;
  }
};

interface ProjectSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, name: string, directoryPath: string) => void;
  mode: "new" | "settings";
}

export function ProjectSetupModal({
  isOpen,
  onClose,
  onSave,
  mode,
}: ProjectSetupModalProps) {
  const {
    workflowName,
    saveDirectoryPath,
    useExternalImageStorage,
    setUseExternalImageStorage,
    providerSettings,
    updateProviderApiKey,
    toggleProvider,
    maxConcurrentCalls,
    setMaxConcurrentCalls,
    canvasNavigationSettings,
    updateCanvasNavigationSettings,
  } = useWorkflowStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<"project" | "providers" | "nodeDefaults" | "canvas">("project");

  // Project tab state
  const [name, setName] = useState("");
  const [directoryPath, setDirectoryPath] = useState("");
  const [externalStorage, setExternalStorage] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Provider tab state
  const [localProviders, setLocalProviders] = useState<ProviderSettings>(providerSettings);
  const [showApiKey, setShowApiKey] = useState<Record<ProviderType, boolean>>({
    gemini: false,
    openai: false,
    replicate: false,
    fal: false,
    kie: false,
    wavespeed: false,
    anthropic: false,
    groq: false,
  });
  const [overrideActive, setOverrideActive] = useState<Record<ProviderType, boolean>>({
    gemini: false,
    openai: false,
    replicate: false,
    fal: false,
    kie: false,
    wavespeed: false,
    anthropic: false,
    groq: false,
  });
  const [envStatus, setEnvStatus] = useState<EnvStatusResponse | null>(null);

  // Node defaults tab state
  const [localNodeDefaults, setLocalNodeDefaults] = useState<NodeDefaultsConfig>({});
  const [showImageModelDialog, setShowImageModelDialog] = useState(false);
  const [showVideoModelDialog, setShowVideoModelDialog] = useState(false);

  // Canvas tab state
  const [localCanvasSettings, setLocalCanvasSettings] = useState<CanvasNavigationSettings>(canvasNavigationSettings);

  // Pre-fill when opening in settings mode
  useEffect(() => {
    if (isOpen) {
      // Reset to project tab when opening
      if (mode === "new") {
        setActiveTab("project");
      }

      if (mode === "settings") {
        setName(workflowName || "");
        setExternalStorage(useExternalImageStorage);
        
        // If no directory is set, fetch default
        if (!saveDirectoryPath) {
          fetch("/api/projects/default-path")
            .then((res) => res.json())
            .then((data) => {
              if (data.success && data.defaultPath) {
                setDirectoryPath(data.defaultPath);
              }
            })
            .catch(() => {
              setDirectoryPath("");
            });
        } else {
          setDirectoryPath(saveDirectoryPath);
        }
      } else if (mode === "new") {
        setName("aditor-workflows");
        setExternalStorage(true);
        // Fetch default directory path from server
        fetch("/api/projects/default-path")
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.defaultPath) {
              setDirectoryPath(data.defaultPath);
            }
          })
          .catch(() => {
            // Fallback in case API fails
            setDirectoryPath("");
          });
      }

      // Sync local providers state
      setLocalProviders(providerSettings);
      setShowApiKey({ gemini: false, openai: false, replicate: false, fal: false, kie: false, wavespeed: false, anthropic: false, groq: false });
      // Initialize override as active if user already has a key set
      setOverrideActive({
        gemini: !!providerSettings.providers.gemini?.apiKey,
        openai: !!providerSettings.providers.openai?.apiKey,
        replicate: !!providerSettings.providers.replicate?.apiKey,
        fal: !!providerSettings.providers.fal?.apiKey,
        kie: !!providerSettings.providers.kie?.apiKey,
        wavespeed: !!providerSettings.providers.wavespeed?.apiKey,
        anthropic: !!providerSettings.providers.anthropic?.apiKey,
        groq: !!providerSettings.providers.groq?.apiKey,
      });
      setError(null);

      // Load node defaults
      setLocalNodeDefaults(loadNodeDefaults());
      setShowImageModelDialog(false);
      setShowVideoModelDialog(false);

      // Sync canvas settings
      setLocalCanvasSettings(canvasNavigationSettings);

      // Fetch env status
      fetch("/api/env-status")
        .then((res) => res.json())
        .then((data: EnvStatusResponse) => setEnvStatus(data))
        .catch(() => setEnvStatus(null));
    }
  }, [isOpen, mode, workflowName, saveDirectoryPath, useExternalImageStorage, providerSettings, canvasNavigationSettings]);

  const handleBrowse = async () => {
    setIsBrowsing(true);
    setError(null);

    try {
      const response = await fetch("/api/browse-directory");
      const result = await response.json();

      if (!result.success) {
        setError(result.error || "Failed to open directory picker");
        return;
      }

      if (result.cancelled) {
        return;
      }

      if (result.path) {
        setDirectoryPath(result.path);
      }
    } catch (err) {
      setError(
        `Failed to open directory picker: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleSaveProject = async () => {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    if (!directoryPath.trim()) {
      setError("Project directory is required");
      return;
    }

    const trimmedPath = directoryPath.trim();
    if (!(trimmedPath.startsWith("/") || /^[A-Za-z]:[\\\/]/.test(trimmedPath) || trimmedPath.startsWith("\\\\"))) {
      setError("Project directory must be an absolute path (starting with /, a drive letter, or a UNC path)");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      // Validate project directory exists
      const response = await fetch(
        `/api/workflow?path=${encodeURIComponent(directoryPath.trim())}`
      );
      const result = await response.json();

      if (!result.exists) {
        setError("Project directory does not exist");
        setIsValidating(false);
        return;
      }

      if (!result.isDirectory) {
        setError("Project path is not a directory");
        setIsValidating(false);
        return;
      }

      const id = mode === "new" ? generateWorkflowId() : useWorkflowStore.getState().workflowId || generateWorkflowId();
      // Update external storage setting
      setUseExternalImageStorage(externalStorage);
      onSave(id, name.trim(), directoryPath.trim());
      setIsValidating(false);
    } catch (err) {
      setError(
        `Failed to validate directory: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      setIsValidating(false);
    }
  };

  const handleSaveProviders = () => {
    // Save each provider's settings
    const providerIds: ProviderType[] = ["gemini", "openai", "replicate", "fal", "kie", "wavespeed", "anthropic", "groq"];
    for (const providerId of providerIds) {
      const local = localProviders.providers[providerId];
      const current = providerSettings.providers[providerId];

      if (!local || !current) continue;

      // Update enabled state if changed
      if (local.enabled !== current.enabled) {
        toggleProvider(providerId, local.enabled);
      }

      // Update API key if changed
      if (local.apiKey !== current.apiKey) {
        updateProviderApiKey(providerId, local.apiKey);
      }
    }
    onClose();
  };

  const handleSaveNodeDefaults = () => {
    saveNodeDefaults(localNodeDefaults);
    onClose();
  };

  const handleSaveCanvas = () => {
    updateCanvasNavigationSettings(localCanvasSettings);
    onClose();
  };

  const handleSave = () => {
    if (activeTab === "project") {
      handleSaveProject();
    } else if (activeTab === "providers") {
      handleSaveProviders();
    } else if (activeTab === "canvas") {
      handleSaveCanvas();
    } else {
      handleSaveNodeDefaults();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isValidating && !isBrowsing) {
      handleSave();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  const updateLocalProvider = (
    providerId: ProviderType,
    updates: { enabled?: boolean; apiKey?: string | null }
  ) => {
    setLocalProviders((prev) => ({
      providers: {
        ...prev.providers,
        [providerId]: {
          ...prev.providers[providerId],
          ...updates,
        },
      },
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div
        className="bg-[var(--bg-elevated)] rounded-lg w-[480px] border border-[var(--border-subtle)] shadow-xl flex flex-col max-h-[80vh]"
        onKeyDown={handleKeyDown}
      >
        <div className="px-6 pt-6 pb-0 shrink-0">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            {mode === "new" ? "New Project" : "Project Settings"}
          </h2>

          {/* Tab Bar */}
          <div className="flex gap-4 border-b border-[var(--border-subtle)]">
          <button
            onClick={() => setActiveTab("project")}
            className={`pb-2 text-sm ${activeTab === "project" ? "text-[var(--text-primary)] border-b-2 border-white" : "text-[var(--text-secondary)]"}`}
          >
            Project
          </button>
          <button
            onClick={() => setActiveTab("providers")}
            className={`pb-2 text-sm ${activeTab === "providers" ? "text-[var(--text-primary)] border-b-2 border-white" : "text-[var(--text-secondary)]"}`}
          >
            Providers
          </button>
          <button
            onClick={() => setActiveTab("nodeDefaults")}
            className={`pb-2 text-sm ${activeTab === "nodeDefaults" ? "text-[var(--text-primary)] border-b-2 border-white" : "text-[var(--text-secondary)]"}`}
          >
            Node Defaults
          </button>
          <button
            onClick={() => setActiveTab("canvas")}
            className={`pb-2 text-sm ${activeTab === "canvas" ? "text-[var(--text-primary)] border-b-2 border-white" : "text-[var(--text-secondary)]"}`}
          >
            Canvas
          </button>
          </div>
        </div>

        {/* Scrollable tab content area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">

        {/* Project Tab Content */}
        {activeTab === "project" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                Project Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-project"
                autoFocus
                className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--border-subtle)]"
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                Project Directory
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={directoryPath}
                  onChange={(e) => setDirectoryPath(e.target.value)}
                  placeholder="/Users/username/projects/my-project"
                  className="flex-1 px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--border-subtle)]"
                />
                <button
                  type="button"
                  onClick={handleBrowse}
                  disabled={isBrowsing}
                  className="px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] disabled:bg-[var(--bg-surface)] disabled:opacity-50 text-[var(--text-primary)] text-sm rounded transition-all duration-[120ms]"
                >
                  {isBrowsing ? "..." : "Browse"}
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Workflow files and images will be saved here. Subfolders for inputs and generations will be auto-created.
              </p>
            </div>

            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!externalStorage}
                  onChange={(e) => setExternalStorage(!e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] focus:ring-offset-[var(--bg-elevated)]"
                />
                <div>
                  <span className="text-sm text-[var(--text-primary)]">Embed images as base64</span>
                  <p className="text-xs text-[var(--text-muted)]">
                    Embeds all images in workflow, larger workflow files. Can hit memory limits on very large workflows.
                  </p>
                </div>
              </label>
            </div>

            {error && <p className="text-sm text-[var(--node-error)]">{error}</p>}
          </div>
        )}

        {/* Providers Tab Content */}
        {activeTab === "providers" && (
          <div className="space-y-3">
            <div className="p-6 bg-[var(--bg-base)] rounded-lg border border-[var(--border-subtle)] text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Server-Side Configuration
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                All API keys are configured server-side for security and centralized management.
              </p>
              <div className="text-xs text-[var(--text-muted)] space-y-2">
                <p>
                  Supported providers: <span className="text-[var(--text-secondary)]">Gemini</span>, <span className="text-[var(--text-secondary)]">OpenAI</span>, <span className="text-[var(--text-secondary)]">Anthropic</span>, <span className="text-[var(--text-secondary)]">Replicate</span>, <span className="text-[var(--text-secondary)]">fal.ai</span>, <span className="text-[var(--text-secondary)]">Kie.ai</span>, <span className="text-[var(--text-secondary)]">WaveSpeed</span>, <span className="text-[var(--text-secondary)]">Groq</span>
                </p>
                <p className="pt-2 border-t border-[var(--border-subtle)]">
                  Server configuration: <code className="px-1 py-0.5 bg-[var(--bg-elevated)] rounded">.env.local</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Node Defaults Tab Content */}
        {activeTab === "nodeDefaults" && (
          <div className="space-y-3">
            {/* GenerateImage Section */}
            <div className="p-3 bg-[var(--bg-base)] rounded-lg border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">Default Image Model</span>
                <div className="flex items-center gap-2">
                  {localNodeDefaults.generateImage?.selectedModel ? (
                    <>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        {getProviderIcon(localNodeDefaults.generateImage.selectedModel.provider)}
                        <span className="truncate max-w-[150px]">
                          {localNodeDefaults.generateImage.selectedModel.displayName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowImageModelDialog(true)}
                        className="px-2 py-1 text-xs bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] rounded transition-all duration-[120ms]"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const { generateImage, ...rest } = localNodeDefaults;
                          setLocalNodeDefaults(rest);
                        }}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        Clear
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-[var(--text-muted)]">System default (Gemini nano-banana-pro)</span>
                      <button
                        type="button"
                        onClick={() => setShowImageModelDialog(true)}
                        className="px-2 py-1 text-xs bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] rounded transition-all duration-[120ms]"
                      >
                        Select Model
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* GenerateVideo Section */}
            <div className="p-3 bg-[var(--bg-base)] rounded-lg border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">Default Video Model</span>
                <div className="flex items-center gap-2">
                  {localNodeDefaults.generateVideo?.selectedModel ? (
                    <>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        {getProviderIcon(localNodeDefaults.generateVideo.selectedModel.provider)}
                        <span className="truncate max-w-[150px]">
                          {localNodeDefaults.generateVideo.selectedModel.displayName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowVideoModelDialog(true)}
                        className="px-2 py-1 text-xs bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] rounded transition-all duration-[120ms]"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const { generateVideo, ...rest } = localNodeDefaults;
                          setLocalNodeDefaults(rest);
                        }}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        Clear
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-[var(--text-muted)]">None set (select on first use)</span>
                      <button
                        type="button"
                        onClick={() => setShowVideoModelDialog(true)}
                        className="px-2 py-1 text-xs bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] rounded transition-all duration-[120ms]"
                      >
                        Select Model
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* LLM Section */}
            <div className="p-3 bg-[var(--bg-base)] rounded-lg border border-[var(--border-subtle)]">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Default LLM Settings</span>
                  {localNodeDefaults.llm && (
                    <button
                      type="button"
                      onClick={() => {
                        const { llm, ...rest } = localNodeDefaults;
                        setLocalNodeDefaults(rest);
                      }}
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {!localNodeDefaults.llm ? (
                  <p className="text-xs text-[var(--text-muted)]">Using system defaults (Google Gemini 3 Flash)</p>
                ) : null}

                {/* Provider dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--text-secondary)] w-20">Provider</label>
                  <select
                    value={localNodeDefaults.llm?.provider || "google"}
                    onChange={(e) => {
                      const newProvider = e.target.value as LLMProvider;
                      const firstModelForProvider = LLM_MODELS[newProvider][0].value;
                      setLocalNodeDefaults(prev => ({
                        ...prev,
                        llm: {
                          ...prev.llm,
                          provider: newProvider,
                          model: firstModelForProvider,
                        }
                      }));
                    }}
                    className="flex-1 px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-subtle)]"
                  >
                    {LLM_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {/* Model dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--text-secondary)] w-20">Model</label>
                  <select
                    value={localNodeDefaults.llm?.model || LLM_MODELS[localNodeDefaults.llm?.provider || "google"][0].value}
                    onChange={(e) => {
                      setLocalNodeDefaults(prev => ({
                        ...prev,
                        llm: { ...prev.llm, model: e.target.value as LLMModelType }
                      }));
                    }}
                    className="flex-1 px-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-subtle)]"
                  >
                    {LLM_MODELS[localNodeDefaults.llm?.provider || "google"].map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {/* Temperature slider */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--text-secondary)] w-20">
                    Temp: {(localNodeDefaults.llm?.temperature ?? 0.7).toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={localNodeDefaults.llm?.temperature ?? 0.7}
                    onChange={(e) => {
                      setLocalNodeDefaults(prev => ({
                        ...prev,
                        llm: { ...prev.llm, temperature: parseFloat(e.target.value) }
                      }));
                    }}
                    className="flex-1 h-1 bg-[var(--bg-surface)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
                  />
                </div>

                {/* Max Tokens slider */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--text-secondary)] w-20">
                    Tokens: {(localNodeDefaults.llm?.maxTokens ?? 8192).toLocaleString()}
                  </label>
                  <input
                    type="range"
                    min="256"
                    max="16384"
                    step="256"
                    value={localNodeDefaults.llm?.maxTokens ?? 8192}
                    onChange={(e) => {
                      setLocalNodeDefaults(prev => ({
                        ...prev,
                        llm: { ...prev.llm, maxTokens: parseInt(e.target.value, 10) }
                      }));
                    }}
                    className="flex-1 h-1 bg-[var(--bg-surface)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
                  />
                </div>
              </div>
            </div>

            {/* Execution Section */}
            <div className="p-3 bg-[var(--bg-base)] rounded-lg border border-[var(--border-subtle)]">
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-[var(--text-primary)]">Execution Settings</span>

                {/* Concurrency slider */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--text-secondary)] w-32">
                    Max Parallel Calls: {maxConcurrentCalls}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={maxConcurrentCalls}
                    onChange={(e) => setMaxConcurrentCalls(parseInt(e.target.value, 10))}
                    className="flex-1 h-1 bg-[var(--bg-surface)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Maximum number of nodes to execute in parallel during workflow execution.
                  Higher values may improve speed but increase API rate limit risk.
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-muted)] mt-2">
              These defaults are applied when creating nodes via keyboard shortcuts (Shift+G, Shift+L, etc).
            </p>
          </div>
        )}

        {/* Canvas Tab Content */}
        {activeTab === "canvas" && (
          <div className="space-y-5">
            {/* Pan Mode */}
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Pan Mode</h3>
              <div className="space-y-1.5">
                {([
                  { value: "space" as PanMode, label: "Space + Drag", description: "Hold Space and drag to pan (default)" },
                  { value: "middleMouse" as PanMode, label: "Middle Mouse", description: "Click and drag with middle mouse button" },
                  { value: "always" as PanMode, label: "Always On", description: "Pan without holding any keys" },
                ] as const).map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-all duration-[120ms] ${
                      localCanvasSettings.panMode === option.value
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                        : "border-[var(--border-subtle)] hover:border-[var(--border-subtle)] bg-[var(--bg-base)]/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="panMode"
                      value={option.value}
                      checked={localCanvasSettings.panMode === option.value}
                      onChange={(e) => setLocalCanvasSettings({ ...localCanvasSettings, panMode: e.target.value as PanMode })}
                      className="mt-0.5 mr-3"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[var(--text-primary)]">{option.label}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Zoom Mode */}
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Zoom Mode</h3>
              <div className="space-y-1.5">
                {([
                  { value: "altScroll" as ZoomMode, label: "Alt + Scroll", description: "Hold Alt and scroll to zoom (default)" },
                  { value: "ctrlScroll" as ZoomMode, label: "Ctrl + Scroll", description: "Hold Ctrl/Cmd and scroll to zoom" },
                  { value: "scroll" as ZoomMode, label: "Scroll", description: "Scroll to zoom without holding any keys" },
                ] as const).map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-all duration-[120ms] ${
                      localCanvasSettings.zoomMode === option.value
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                        : "border-[var(--border-subtle)] hover:border-[var(--border-subtle)] bg-[var(--bg-base)]/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="zoomMode"
                      value={option.value}
                      checked={localCanvasSettings.zoomMode === option.value}
                      onChange={(e) => setLocalCanvasSettings({ ...localCanvasSettings, zoomMode: e.target.value as ZoomMode })}
                      className="mt-0.5 mr-3"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[var(--text-primary)]">{option.label}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Selection Mode */}
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Selection Mode</h3>
              <div className="space-y-1.5">
                {([
                  { value: "click" as SelectionMode, label: "Click", description: "Click to select nodes (default)" },
                  { value: "altDrag" as SelectionMode, label: "Alt + Drag", description: "Hold Alt and drag to select multiple nodes" },
                  { value: "shiftDrag" as SelectionMode, label: "Shift + Drag", description: "Hold Shift and drag to select multiple nodes" },
                ] as const).map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-all duration-[120ms] ${
                      localCanvasSettings.selectionMode === option.value
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                        : "border-[var(--border-subtle)] hover:border-[var(--border-subtle)] bg-[var(--bg-base)]/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="selectionMode"
                      value={option.value}
                      checked={localCanvasSettings.selectionMode === option.value}
                      onChange={(e) => setLocalCanvasSettings({ ...localCanvasSettings, selectionMode: e.target.value as SelectionMode })}
                      className="mt-0.5 mr-3"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[var(--text-primary)]">{option.label}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        </div>

        {/* Fixed footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-[120ms]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={activeTab === "project" && (isValidating || isBrowsing)}
            className="px-4 py-2 text-sm bg-white text-[var(--bg-base)] rounded hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-[120ms]"
          >
            {activeTab === "project"
              ? (isValidating ? "Validating..." : mode === "new" ? "Create" : "Save")
              : "Save"
            }
          </button>
        </div>
      </div>

      {/* Model Selection Dialogs */}
      {showImageModelDialog && (
        <ModelSearchDialog
          isOpen={showImageModelDialog}
          onClose={() => setShowImageModelDialog(false)}
          onModelSelected={(model: ProviderModel) => {
            setLocalNodeDefaults(prev => ({
              ...prev,
              generateImage: {
                ...prev.generateImage,
                selectedModel: {
                  provider: model.provider,
                  modelId: model.id,
                  displayName: model.name,
                }
              }
            }));
            setShowImageModelDialog(false);
          }}
          initialCapabilityFilter="image"
        />
      )}
      {showVideoModelDialog && (
        <ModelSearchDialog
          isOpen={showVideoModelDialog}
          onClose={() => setShowVideoModelDialog(false)}
          onModelSelected={(model: ProviderModel) => {
            setLocalNodeDefaults(prev => ({
              ...prev,
              generateVideo: {
                ...prev.generateVideo,
                selectedModel: {
                  provider: model.provider,
                  modelId: model.id,
                  displayName: model.name,
                }
              }
            }));
            setShowVideoModelDialog(false);
          }}
          initialCapabilityFilter="video"
        />
      )}
    </div>
  );
}
