import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { logger } from "@/utils/logger";

export const maxDuration = 60; // 1 minute timeout

interface SkillInfo {
  skillName: string;
  skillDescription: string;
  inputs: Array<{ type: string; description: string }>;
  outputDescription: string;
  nodeId: string;
}

interface AgentRequest {
  message: string;
  skills: SkillInfo[];
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

interface PlanStep {
  skillNodeId: string;
  description: string;
  inputs: Record<string, string>;
}

interface AgentResponse {
  success: boolean;
  response: string;
  plan?: {
    steps: PlanStep[];
  };
}

function buildSystemPrompt(skills: SkillInfo[]): string {
  const skillDescriptions = skills
    .map((s, i) => {
      const inputList = s.inputs
        .map((inp) => `    - ${inp.type}: ${inp.description}`)
        .join("\n");
      return `  ${i + 1}. "${s.skillName}" (nodeId: ${s.nodeId})
     Description: ${s.skillDescription}
     Inputs:
${inputList}
     Output: ${s.outputDescription}`;
    })
    .join("\n\n");

  return `You are an AI agent assistant for Node Banana, a visual workflow editor for AI image and text generation.

You have access to the following skills (workflows) on the user's canvas:

${skills.length > 0 ? skillDescriptions : "  (No skills are currently defined on the canvas)"}

Your role is to:
1. Understand what the user wants to accomplish
2. Review the available skills on the canvas
3. Create a plan describing which skills to use and in what order to achieve the user's goal
4. If you need more information or the available skills are insufficient, ask the user for clarification

When creating a plan, respond with a clear description of each step and which skill node to invoke.
If no skills are available, let the user know they need to create Skill nodes on the canvas first.

Format your plan steps clearly with numbered steps. For each step, mention which skill to use and what inputs to provide.

Always be helpful, concise, and specific about how the available skills can be combined to achieve the user's goal.

IMPORTANT: After your text response, if you have a concrete plan, include a JSON block at the very end of your response wrapped in \`\`\`json and \`\`\` markers with the following structure:
\`\`\`json
{
  "steps": [
    {
      "skillNodeId": "the-node-id",
      "description": "What this step does",
      "inputs": { "text": "input value", "image": "description of needed image" }
    }
  ]
}
\`\`\`

Only include the JSON block if you have a concrete actionable plan. If you're asking questions or the plan isn't ready, omit the JSON block.`;
}

function extractPlan(responseText: string): PlanStep[] | null {
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.steps && Array.isArray(parsed.steps)) {
      return parsed.steps;
    }
  } catch {
    // JSON parsing failed, no plan
  }
  return null;
}

function cleanResponseText(text: string): string {
  // Remove the JSON block from the displayed response
  return text.replace(/```json\s*[\s\S]*?\s*```/, "").trim();
}

export async function POST(request: NextRequest) {
  const requestId = `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  try {
    const body: AgentRequest = await request.json();
    const { message, skills, chatHistory } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, response: "Message is required." } as AgentResponse,
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.error("api.error", "GEMINI_API_KEY not configured for agent", { requestId }, undefined);
      return NextResponse.json(
        {
          success: false,
          response: "GEMINI_API_KEY not configured. Add it to .env.local to use Agent Mode.",
        } as AgentResponse,
        { status: 500 }
      );
    }

    const genAI = new GoogleGenAI({ apiKey });

    // Build conversation history for the model
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Add chat history
    for (const msg of chatHistory) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }

    // Add the current message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const systemPrompt = buildSystemPrompt(skills);

    logger.info("api.llm", "Calling Gemini for agent", {
      requestId,
      skillCount: skills.length,
      historyLength: chatHistory.length,
    });

    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    });

    const responseText = response.text ?? "";

    // Extract plan if present
    const planSteps = extractPlan(responseText);
    const cleanedResponse = cleanResponseText(responseText);

    const result: AgentResponse = {
      success: true,
      response: cleanedResponse,
    };

    if (planSteps && planSteps.length > 0) {
      result.plan = { steps: planSteps };
    }

    logger.info("api.llm", "Agent response generated", {
      requestId,
      hasplan: !!result.plan,
      stepCount: result.plan?.steps.length ?? 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("api.error", `Agent error: ${errorMessage}`, { requestId });

    return NextResponse.json(
      {
        success: false,
        response: `Agent error: ${errorMessage}`,
      } as AgentResponse,
      { status: 500 }
    );
  }
}
