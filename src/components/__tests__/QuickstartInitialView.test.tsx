import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickstartInitialView } from "@/components/quickstart/QuickstartInitialView";

describe("QuickstartInitialView", () => {
  const mockOnNewProject = vi.fn();
  const mockOnSelectTemplates = vi.fn();
  const mockOnSelectVibe = vi.fn();
  const mockOnSelectLoad = vi.fn();
  const mockOnWorkflowSelected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render the Aditors Gas Station headline and logo", () => {
      render(
        <QuickstartInitialView
          onNewProject={mockOnNewProject}
          onSelectTemplates={mockOnSelectTemplates}
          onSelectVibe={mockOnSelectVibe}
          onSelectLoad={mockOnSelectLoad}
          onWorkflowSelected={mockOnWorkflowSelected}
        />
      );

      expect(screen.getByText("Aditors Gas Station")).toBeInTheDocument();
      expect(screen.getByText(/Welcome to/)).toBeInTheDocument();
      expect(screen.getByAltText("")).toBeInTheDocument(); // Logo image
    });

    it("should render the description text", () => {
      render(
        <QuickstartInitialView
          onNewProject={mockOnNewProject}
          onSelectTemplates={mockOnSelectTemplates}
          onSelectVibe={mockOnSelectVibe}
          onSelectLoad={mockOnSelectLoad}
          onWorkflowSelected={mockOnWorkflowSelected}
        />
      );

      expect(
        screen.getByText(/node.based workflow editor for AI image/i)
      ).toBeInTheDocument();
    });

    it("should render action buttons", () => {
      render(
        <QuickstartInitialView
          onNewProject={mockOnNewProject}
          onSelectTemplates={mockOnSelectTemplates}
          onSelectVibe={mockOnSelectVibe}
          onSelectLoad={mockOnSelectLoad}
          onWorkflowSelected={mockOnWorkflowSelected}
        />
      );

      expect(screen.getByText("New Workflow")).toBeInTheDocument();
      expect(screen.getByText("AI Wizard")).toBeInTheDocument();
      expect(screen.getByText("Load JSON")).toBeInTheDocument();
    });
  });

  describe("New Project Option", () => {
    it("should call onNewProject when clicked", () => {
      render(
        <QuickstartInitialView
          onNewProject={mockOnNewProject}
          onSelectTemplates={mockOnSelectTemplates}
          onSelectVibe={mockOnSelectVibe}
          onSelectLoad={mockOnSelectLoad}
          onWorkflowSelected={mockOnWorkflowSelected}
        />
      );

      fireEvent.click(screen.getByText("New Workflow"));

      expect(mockOnNewProject).toHaveBeenCalledTimes(1);
    });
  });

  describe("Load Workflow Option", () => {
    it("should call onSelectLoad when clicked", () => {
      render(
        <QuickstartInitialView
          onNewProject={mockOnNewProject}
          onSelectTemplates={mockOnSelectTemplates}
          onSelectVibe={mockOnSelectVibe}
          onSelectLoad={mockOnSelectLoad}
          onWorkflowSelected={mockOnWorkflowSelected}
        />
      );

      fireEvent.click(screen.getByText("Load JSON"));

      expect(mockOnSelectLoad).toHaveBeenCalledTimes(1);
    });
  });

  describe("AI Wizard Option", () => {
    it("should call onSelectVibe when clicked", () => {
      render(
        <QuickstartInitialView
          onNewProject={mockOnNewProject}
          onSelectTemplates={mockOnSelectTemplates}
          onSelectVibe={mockOnSelectVibe}
          onSelectLoad={mockOnSelectLoad}
          onWorkflowSelected={mockOnWorkflowSelected}
        />
      );

      fireEvent.click(screen.getByText("AI Wizard"));

      expect(mockOnSelectVibe).toHaveBeenCalledTimes(1);
    });
  });

  describe("Tabs", () => {
    it("should render tab navigation", () => {
      render(
        <QuickstartInitialView
          onNewProject={mockOnNewProject}
          onSelectTemplates={mockOnSelectTemplates}
          onSelectVibe={mockOnSelectVibe}
          onSelectLoad={mockOnSelectLoad}
          onWorkflowSelected={mockOnWorkflowSelected}
        />
      );

      expect(screen.getByText("All Workflows")).toBeInTheDocument();
      expect(screen.getByText("Favorites")).toBeInTheDocument();
      expect(screen.getByText("Templates")).toBeInTheDocument();
    });
  });
});
