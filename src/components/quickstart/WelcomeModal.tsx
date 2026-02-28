"use client";

import { useState, useCallback, useRef } from "react";
import { WorkflowFile } from "@/store/workflowStore";
import { QuickstartView } from "@/types/quickstart";
import { QuickstartInitialView } from "./QuickstartInitialView";
import { TemplateExplorerView } from "./TemplateExplorerView";
import { PromptWorkflowView } from "./PromptWorkflowView";

interface WelcomeModalProps {
  onWorkflowGenerated: (workflow: WorkflowFile) => void;
  onClose: () => void;
  onNewProject: () => void;
}

export function WelcomeModal({
  onWorkflowGenerated,
  onClose,
  onNewProject,
}: WelcomeModalProps) {
  const [currentView, setCurrentView] = useState<QuickstartView>("initial");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNewProject = useCallback(() => {
    onNewProject();
  }, [onNewProject]);

  const handleSelectTemplates = useCallback(() => {
    setCurrentView("templates");
  }, []);

  const handleSelectVibe = useCallback(() => {
    setCurrentView("vibe");
  }, []);

  const handleSelectLoad = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const workflow = JSON.parse(
            event.target?.result as string
          ) as WorkflowFile;
          if (workflow.version && workflow.nodes && workflow.edges) {
            onWorkflowGenerated(workflow);
          } else {
            alert("Invalid workflow file format");
          }
        } catch {
          alert("Failed to parse workflow file");
        }
      };
      reader.readAsText(file);

      // Reset input so same file can be loaded again
      e.target.value = "";
    },
    [onWorkflowGenerated]
  );

  const handleBack = useCallback(() => {
    setCurrentView("initial");
  }, []);

  const handleWorkflowSelected = useCallback(
    (workflow: WorkflowFile) => {
      onWorkflowGenerated(workflow);
    },
    [onWorkflowGenerated]
  );

  // Click outside to close (only on initial view)
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && currentView === "initial") {
        onClose();
      }
    },
    [onClose, currentView]
  );

  return (
    <div
      className="fixed inset-0 z-[100] bg-neutral-950/95 backdrop-blur-sm overflow-y-auto overscroll-contain"
      onWheelCapture={(e) => e.stopPropagation()}
      onClick={handleOverlayClick}
    >
      {currentView === "initial" && (
        <QuickstartInitialView
          onNewProject={handleNewProject}
          onSelectTemplates={handleSelectTemplates}
          onSelectVibe={handleSelectVibe}
          onSelectLoad={handleSelectLoad}
          onWorkflowSelected={handleWorkflowSelected}
        />
      )}
      {currentView === "templates" && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="w-full max-w-6xl bg-neutral-800 rounded-xl border border-neutral-700 shadow-2xl overflow-clip max-h-[85vh] flex flex-col">
            <TemplateExplorerView
              onBack={handleBack}
              onWorkflowSelected={handleWorkflowSelected}
            />
          </div>
        </div>
      )}
      {currentView === "vibe" && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="w-full max-w-2xl bg-neutral-800 rounded-xl border border-neutral-700 shadow-2xl overflow-clip max-h-[80vh] flex flex-col">
            <PromptWorkflowView
              onBack={handleBack}
              onWorkflowGenerated={handleWorkflowSelected}
            />
          </div>
        </div>
      )}

      {/* Hidden file input for loading workflows */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />
    </div>
  );
}
