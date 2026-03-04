"use client";

import { useEffect } from "react";

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const modKey = isMac ? "⌘" : "Ctrl";

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "General",
    shortcuts: [
      { keys: [`${modKey}`, "Enter"], description: "Run workflow" },
      { keys: [`${modKey}`, "C"], description: "Copy selected nodes" },
      { keys: [`${modKey}`, "V"], description: "Paste nodes / image / text" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
    ],
  },
  {
    title: "Add Nodes",
    shortcuts: [
      { keys: ["Shift", "P"], description: "Add Prompt node" },
      { keys: ["Shift", "I"], description: "Add Image Input node" },
      { keys: ["Shift", "G"], description: "Add Generate Image node" },
      { keys: ["Shift", "V"], description: "Add Generate Video node" },
      { keys: ["Shift", "L"], description: "Add LLM Text node" },
      { keys: ["Shift", "A"], description: "Add Annotation node" },
    ],
  },
  {
    title: "Layout (select 2+ nodes first)",
    shortcuts: [
      { keys: ["V"], description: "Stack selected vertically" },
      { keys: ["H"], description: "Stack selected horizontally" },
      { keys: ["G"], description: "Arrange selected as grid" },
    ],
  },
  {
    title: "Canvas",
    shortcuts: [
      { keys: ["Scroll"], description: "Zoom in / out" },
      { keys: ["Trackpad"], description: "Pan (macOS)" },
      { keys: ["Delete"], description: "Delete selected nodes" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-[11px] font-medium text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded shadow-sm">
      {children}
    </kbd>
  );
}

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-elevated)] rounded-lg w-[520px] max-h-[80vh] border border-[var(--border-subtle)] shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded transition-all duration-[120ms]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[var(--bg-surface)]/40 transition-all duration-[120ms]"
                  >
                    <span className="text-sm text-[var(--text-secondary)]">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1 ml-4 shrink-0">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx} className="flex items-center gap-1">
                          {keyIdx > 0 && (
                            <span className="text-[10px] text-[var(--text-muted)]">+</span>
                          )}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--border-subtle)] rounded transition-all duration-[120ms]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

