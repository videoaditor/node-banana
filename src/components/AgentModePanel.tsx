"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import { SkillNodeData } from "@/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface PlanStep {
  skillNodeId: string;
  description: string;
  inputs: Record<string, string>;
}

interface SkillInfo {
  skillName: string;
  skillDescription: string;
  inputs: Array<{ type: string; description: string }>;
  outputDescription: string;
  nodeId: string;
}

interface AgentModePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentModePanel({ isOpen, onClose }: AgentModePanelProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<PlanStep[] | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Discover skill nodes on the canvas
  const skills: SkillInfo[] = nodes
    .filter((n) => n.type === "skill")
    .map((n) => {
      const data = n.data as SkillNodeData;
      return {
        skillName: data.skillName || "Unnamed Skill",
        skillDescription: data.skillDescription || "",
        inputs: (data.inputDescriptions || []).map((d) => ({
          type: d.handleId,
          description: d.description,
        })),
        outputDescription: data.outputDescription || "",
        nodeId: n.id,
      };
    });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          skills,
          chatHistory: chatHistory, // Send history before this message
        }),
      });

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.response || "No response from agent.",
      };

      setChatHistory([...newHistory, assistantMessage]);

      if (data.plan?.steps) {
        setCurrentPlan(data.plan.steps);
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to reach agent";
      setChatHistory([
        ...newHistory,
        { role: "assistant", content: `Error: ${errorMsg}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, chatHistory, skills]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const toggleAgent = useCallback(() => {
    if (isAgentActive) {
      setIsAgentActive(false);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: "Agent stopped." },
      ]);
      setCurrentPlan(null);
    } else {
      setIsAgentActive(true);
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Agent started. I found ${skills.length} skill${skills.length !== 1 ? "s" : ""} on the canvas. How can I help you?`,
        },
      ]);
    }
  }, [isAgentActive, skills.length]);

  const clearChat = useCallback(() => {
    setChatHistory([]);
    setCurrentPlan(null);
  }, []);

  return (
    <div
      className={`fixed top-0 right-0 h-full z-[80] transition-transform duration-300 ease-out ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ width: "380px" }}
    >
      <div
        className="h-full flex flex-col border-l border-[var(--border-subtle)]"
        style={{
          background: "rgba(13, 14, 17, 0.95)",
          backdropFilter: "blur(24px) saturate(1.5)",
          WebkitBackdropFilter: "blur(24px) saturate(1.5)",
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between shrink-0"
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            background: "rgba(20, 21, 25, 0.8)",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: isAgentActive ? "#22d3ee" : "var(--text-muted)",
                boxShadow: isAgentActive
                  ? "0 0 8px #22d3ee, 0 0 3px #22d3ee"
                  : "none",
              }}
            />
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)] font-['DM_Mono',monospace]">
              Agent Mode
            </span>
            <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] rounded bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/25 font-['DM_Mono',monospace]">
              Beta
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearChat}
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors duration-[120ms]"
              title="Clear chat"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-[120ms]"
              title="Close panel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Skills chips */}
        {skills.length > 0 && (
          <div className="px-4 py-2 flex flex-wrap gap-1.5 shrink-0 border-b border-[var(--border-subtle)]">
            <span className="text-[9px] uppercase tracking-wide text-[var(--text-muted)] font-['DM_Mono',monospace] w-full mb-0.5">
              Skills ({skills.length})
            </span>
            {skills.map((skill) => (
              <span
                key={skill.nodeId}
                className="px-2 py-0.5 text-[10px] rounded-full bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/20 font-['DM_Mono',monospace]"
                title={skill.skillDescription}
              >
                {skill.skillName}
              </span>
            ))}
          </div>
        )}

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {chatHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <svg className="w-10 h-10 text-[var(--text-muted)] mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              <p className="text-[12px] text-[var(--text-muted)] font-['DM_Mono',monospace] mb-1">
                Agent Mode
              </p>
              <p className="text-[11px] text-[var(--text-muted)] opacity-60 leading-relaxed">
                Start the agent and describe your goal. The agent will plan which skills to use from your canvas.
              </p>
            </div>
          )}

          {chatHistory.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-lg text-[11px] leading-relaxed font-['DM_Mono',monospace] ${
                  msg.role === "user"
                    ? "bg-[var(--accent-primary)]/15 text-[var(--text-primary)] border border-[var(--accent-primary)]/20"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22d3ee] animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22d3ee] animate-pulse" style={{ animationDelay: "0.2s" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22d3ee] animate-pulse" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            </div>
          )}

          {/* Current plan display */}
          {currentPlan && currentPlan.length > 0 && (
            <div className="bg-[#22d3ee]/5 border border-[#22d3ee]/15 rounded-lg p-3 space-y-2">
              <span className="text-[9px] uppercase tracking-wide text-[#22d3ee] font-bold font-['DM_Mono',monospace]">
                Plan
              </span>
              {currentPlan.map((step, i) => {
                const skillName = skills.find(
                  (s) => s.nodeId === step.skillNodeId
                )?.skillName;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-[10px] text-[var(--text-secondary)] font-['DM_Mono',monospace]"
                  >
                    <span className="shrink-0 w-4 h-4 rounded-full bg-[#22d3ee]/15 text-[#22d3ee] flex items-center justify-center text-[9px] font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      {skillName && (
                        <span className="text-[#22d3ee] font-medium">
                          {skillName}:{" "}
                        </span>
                      )}
                      {step.description}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="px-4 py-3 shrink-0 border-t border-[var(--border-subtle)]" style={{ background: "rgba(20, 21, 25, 0.6)" }}>
          {/* Agent toggle */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={toggleAgent}
              className={`px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-[0.08em] transition-all duration-200 font-['DM_Mono',monospace] ${
                isAgentActive
                  ? "bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/30 hover:bg-[#22d3ee]/25"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)]"
              }`}
            >
              {isAgentActive ? "Stop Agent" : "Start Agent"}
            </button>
            <span className="text-[9px] text-[var(--text-muted)] font-['DM_Mono',monospace]">
              {skills.length} skill{skills.length !== 1 ? "s" : ""} available
            </span>
          </div>

          {/* Text input */}
          <div className="relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isAgentActive
                  ? "Describe what you want to achieve..."
                  : "Start the agent first..."
              }
              disabled={!isAgentActive || isLoading}
              rows={2}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] rounded-lg px-3 py-2 pr-10 resize-none focus:outline-none focus:border-[#22d3ee]/40 focus:ring-1 focus:ring-[#22d3ee]/20 placeholder:text-[var(--text-muted)] disabled:opacity-40 disabled:cursor-not-allowed font-['DM_Mono',monospace]"
            />
            <button
              onClick={sendMessage}
              disabled={!isAgentActive || isLoading || !inputValue.trim()}
              className="absolute right-2 bottom-2 p-1 rounded text-[var(--text-muted)] hover:text-[#22d3ee] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-[120ms]"
              title="Send message"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
