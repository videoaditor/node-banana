"use client";

import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Header } from "@/components/Header";
import { WorkflowCanvas } from "@/components/WorkflowCanvas";
import { FloatingActionBar } from "@/components/FloatingActionBar";
import { AnnotationModal } from "@/components/AnnotationModal";
import { AppView } from "@/components/AppView";
import { useWorkflowStore } from "@/store/workflowStore";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Home() {
  const initializeAutoSave = useWorkflowStore(
    (state) => state.initializeAutoSave
  );
  const cleanupAutoSave = useWorkflowStore((state) => state.cleanupAutoSave);
  const viewMode = useWorkflowStore((state) => state.viewMode);

  useEffect(() => {
    initializeAutoSave();
    return () => cleanupAutoSave();
  }, [initializeAutoSave, cleanupAutoSave]);

  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <div className="h-screen flex flex-col">
          <Header />
          {viewMode === "edit" ? (
            <>
              <WorkflowCanvas />
              <FloatingActionBar />
              <AnnotationModal />
            </>
          ) : (
            <AppView />
          )}
        </div>
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}
