"use client";

import React, { useState } from "react";

const sections = [
  {
    id: "overview",
    title: "Overview",
    content: `
**Node Banana** is a visual AI workflow builder. Users create node-based workflows that chain together LLMs, image generators, scrapers, and custom logic.

| Item | Value |
|------|-------|
| **Live URL** | https://nodes.aditor.ai |
| **Repo** | https://github.com/videoaditor/node-banana |
| **Branch** | \`develop\` (primary), merges to \`main\` for stable |
| **Framework** | Next.js 14 (App Router) + TypeScript |
| **Port** | 3100 |
| **Host** | Alan's Mac mini (local machine) |
| **Tunnel** | Cloudflare Tunnel → localhost:3100 |
| **Process Manager** | launchd (\`com.aditor.node-banana\`) |
| **Auto-restart** | Yes (KeepAlive: true) |
`,
  },
  {
    id: "architecture",
    title: "Architecture",
    content: `
\`\`\`
┌──────────────────────────────────────────────────────┐
│  nodes.aditor.ai (Cloudflare Tunnel)                 │
│  ↓                                                   │
│  Mac mini ← launchd (com.aditor.node-banana)         │
│  ↓                                                   │
│  Next.js on port 3100                                │
│  ├── /src/app/           → Pages (App Router)        │
│  ├── /src/app/api/       → API routes                │
│  ├── /src/components/    → React components          │
│  │   └── /nodes/         → Node type components      │
│  ├── /src/store/         → Zustand stores            │
│  │   ├── workflowStore   → Main state + execution    │
│  │   ├── execution/      → Per-node executors        │
│  │   └── utils/          → Helpers                   │
│  ├── /src/types/         → TypeScript types          │
│  ├── /.shared-workflows/ → Team workflow storage     │
│  └── /.env.local         → API keys (gitignored)     │
└──────────────────────────────────────────────────────┘
\`\`\`

**Key files:**
- \`src/store/workflowStore.ts\` — Central store: node CRUD, execution engine, save/load
- \`src/types/nodes.ts\` — All node type definitions (\`NodeType\`, \`WorkflowNodeData\`)
- \`src/components/WorkflowCanvas.tsx\` — Main canvas: node registry, context menu, drag/drop
- \`src/store/utils/nodeDefaults.ts\` — Default data for each node type
- \`src/store/utils/connectedInputs.ts\` — How nodes read upstream outputs
- \`src/store/execution/index.ts\` — Executor registry (maps node types to functions)
- \`src/components/AppView.tsx\` — App mode (end-user view)
- \`server.js\` — Custom server wrapper
`,
  },
  {
    id: "deploy",
    title: "Deployment",
    content: `
### Quick Deploy (from Mac mini terminal)

\`\`\`bash
cd /Users/player/clawd/projects/node-banana
git pull origin develop
npm run build
launchctl stop com.aditor.node-banana
launchctl start com.aditor.node-banana
\`\`\`

### One-liner
\`\`\`bash
cd /Users/player/clawd/projects/node-banana && git pull origin develop && npm run build && launchctl stop com.aditor.node-banana && sleep 1 && launchctl start com.aditor.node-banana
\`\`\`

### Via API (from anywhere)
\`\`\`bash
curl -X POST https://nodes.aditor.ai/api/restart-server
\`\`\`
This triggers \`auto-deploy.sh banana\` which pulls, builds, and restarts.

### Via GitHub webhook
Push to \`develop\` branch → GitHub webhook → \`deploy.aditor.ai\` → \`auto-deploy.sh banana\`

### Verify deployment
\`\`\`bash
curl -s -o /dev/null -w "%{http_code}" https://nodes.aditor.ai/
# Should return 200
\`\`\`

### Logs
\`\`\`bash
# stdout
tail -f /Users/player/clawd/projects/node-banana/logs/server.log

# stderr
tail -f /Users/player/clawd/projects/node-banana/logs/server-error.log
\`\`\`

### If it won't start
\`\`\`bash
# Check launchd status
launchctl list | grep banana

# Manual start (see errors directly)
cd /Users/player/clawd/projects/node-banana
PORT=3100 NODE_ENV=production node server.js

# Nuclear option: rebuild from scratch
rm -rf .next node_modules
npm install
npm run build
launchctl start com.aditor.node-banana
\`\`\`
`,
  },
  {
    id: "api-keys",
    title: "API Keys",
    content: `
All keys are in \`.env.local\` (gitignored). The server reads them at startup.

| Provider | Env Variable | Used For |
|----------|-------------|----------|
| Google Gemini | \`GEMINI_API_KEY\` | Image gen (Nano Banana) + LLM |
| fal.ai | \`FAL_API_KEY\` | Seedream, Flux, Qwen TTS, etc. |
| OpenAI | \`OPENAI_API_KEY\` | GPT-4o LLM + Sora |
| Anthropic | \`ANTHROPIC_API_KEY\` | Claude LLM |
| Groq | \`GROQ_API_KEY\` | Fast LLM inference |
| xAI | \`XAI_API_KEY\` | Grok LLM |
| Kimi | \`KIMI_API_KEY\` | Moonshot LLM |
| RunComfy | \`RUNCOMFY_API_KEY\` | Kling, Wan, Hailuo video |
| ElevenLabs | \`ELEVENLABS_API_KEY\` | Voice synthesis |

**Key fallback:** If a user has a stale API key in their browser settings, the server automatically falls back to the env key.

**After updating keys:** Restart the service (\`launchctl stop/start com.aditor.node-banana\`).
`,
  },
  {
    id: "adding-nodes",
    title: "Adding a New Node Type",
    content: `
### Checklist for a new node type:

1. **Define the type** in \`src/types/nodes.ts\`:
   - Add to \`NodeType\` union
   - Create \`YourNodeData extends BaseNodeData\` interface
   - Add to \`WorkflowNodeData\` union

2. **Create the component** in \`src/components/nodes/YourNode.tsx\`:
   - Import \`BaseNode\`, \`Handle\` from react-flow
   - Define input/output handles with positions
   - Export from \`src/components/nodes/index.ts\`

3. **Register in canvas** in \`src/components/WorkflowCanvas.tsx\`:
   - Add to \`nodeTypes\` object
   - Add to \`defaultDimensions\` (two places: context menu + drag)
   - Add to the toolbar section (with SVG icon path + color)

4. **Set defaults** in \`src/store/utils/nodeDefaults.ts\`:
   - Add dimensions to \`defaultNodeDimensions\`
   - Add case to \`createDefaultNodeData()\`

5. **Wire up execution** in \`src/store/workflowStore.ts\`:
   - Import executor
   - Add \`case "yourNode":\` in both \`executeSingleNode\` switches (around lines 940 and 1345)

6. **Create executor** in \`src/store/execution/yourNodeExecutor.ts\`:
   - Export from \`src/store/execution/index.ts\`
   - Follow \`NodeExecutionContext\` pattern

7. **Wire connected inputs** in \`src/store/utils/connectedInputs.ts\`:
   - Add case for how downstream nodes read this node's output

### Current node types:
prompt, imageInput, imageIterator, nanoBanana, llmGenerate, output, outputGallery, 
promptConcatenator, promptConstructor, annotation, generateVideo, conditionalRouter, 
textIterator, generate3d, webScraper, stickyNote, soraBlueprint, brollBatch, subWorkflow
`,
  },
  {
    id: "workflows",
    title: "Team Workflows",
    content: `
### Storage
All team workflows are stored in \`.shared-workflows/\` as JSON files on the Mac mini.

### API
\`\`\`
GET  /api/team-workflows          — List all team workflows
POST /api/team-workflows          — Save: { workflow: { name, nodes, edges, ... } }
DELETE /api/team-workflows        — Delete: { filename: "name.json" }
GET  /api/workflow?path=<path>    — Load a specific workflow file
\`\`\`

### Auto-sync
Every time a user saves a workflow (manual or auto-save), it also pushes a copy to \`.shared-workflows/\`. This means all workflows are automatically available as team workflows.

### Sub-Workflow Node
The \`subWorkflow\` node lets any workflow call another team workflow as a step:
1. User adds Sub-Workflow node from Utility section
2. Selects a team workflow from the dropdown
3. Connects text/image inputs and outputs
4. On execution: loads the sub-workflow, maps inputs to its app-input nodes, runs headlessly, returns outputs

### Workflow JSON structure
\`\`\`json
{
  "version": 1,
  "name": "Workflow Name",
  "nodes": [{ "id": "...", "type": "prompt", "position": {...}, "data": {...} }],
  "edges": [{ "source": "...", "target": "...", "sourceHandle": "...", "targetHandle": "..." }],
  "edgeStyle": "default",
  "groups": []
}
\`\`\`
`,
  },
  {
    id: "api-run",
    title: "Run API",
    content: `
### Execute a workflow via API

\`\`\`
POST /api/run
Content-Type: application/json

{
  "shareId": "<shareId>",
  "inputs": {
    "<nodeId>": "text value or base64 image"
  },
  "apiKeys": {
    "gemini": "optional-key",
    "openai": "optional-key",
    "fal": "optional-key"
  }
}
\`\`\`

You can provide either \`shareId\` (for published workflows) or \`workflow\` (inline JSON). The \`apiKeys\` field is optional — the server falls back to env variables.

**Response:**
\`\`\`
{
  "success": true,
  "outputs": {
    "output-1": { "type": "image", "data": "base64...", "label": "Output" }
  },
  "executionTimeMs": 12345,
  "cost": 0.05
}
\`\`\`

Output types: \`image\`, \`video\`, \`text\`, \`3d\`

### Get workflow schema

\`\`\`
GET /api/run/schema?shareId=<shareId>
\`\`\`

Returns input/output schema, an OpenAPI-compatible request schema, example request body, and a curl command.

### Discover published apps

\`\`\`
GET /api/apps
\`\`\`

Lists all published workflow apps with their schemas, share IDs, and API endpoints. Use this to discover available workflows for automation.

### Share a workflow

\`\`\`
POST /api/share
Content-Type: application/json

{
  "workflow": { ...full workflow JSON... }
}
\`\`\`

Returns \`{ shareId }\` — accessible at \`/app/<shareId>\` (UI) and \`POST /api/run\` with \`{ shareId }\` (API).

### Workflow as API: Quick Start

1. Build your workflow in the editor
2. Mark input nodes as "App Input" (toggle in prompt/imageInput nodes)
3. Share via \`POST /api/share\` or the Share button
4. Get the schema: \`GET /api/run/schema?shareId=<id>\`
5. Call it: \`POST /api/run\` with \`{ shareId, inputs }\`
`,
  },
];

function MarkdownBlock({ text }: { text: string }) {
  // Simple markdown-ish renderer
  const lines = text.trim().split("\n");
  const elements: React.ReactNode[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    elements.push(
      <div key={`table-${elements.length}`} className="overflow-x-auto my-4">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr>
              {tableRows[0].map((cell, i) => (
                <th key={i} className="text-left px-3 py-2 border-b border-white/[0.08] text-[#888] font-semibold">
                  <span dangerouslySetInnerHTML={{ __html: inlineFormat(cell.trim()) }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.slice(2).map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-1.5 border-b border-white/[0.04] text-[#aaa]">
                    <span dangerouslySetInnerHTML={{ __html: inlineFormat(cell.trim()) }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  const inlineFormat = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-white/[0.06] text-orange-400/90 text-[11px] font-mono">$1</code>');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inTable) flushTable();
      if (inCode) {
        elements.push(
          <pre key={`code-${elements.length}`} className="my-3 px-4 py-3 rounded-xl bg-black/40 border border-white/[0.04] text-[11px] text-[#999] font-mono overflow-x-auto whitespace-pre leading-relaxed">
            {codeLines.join("\n")}
          </pre>
        );
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      inTable = true;
      tableRows.push(line.split("|").filter((_, i, a) => i > 0 && i < a.length - 1));
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (line.startsWith("### ")) {
      elements.push(<h3 key={`h3-${i}`} className="text-[14px] font-semibold text-white mt-6 mb-2">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={`h2-${i}`} className="text-[16px] font-bold text-white mt-8 mb-3">{line.slice(3)}</h2>);
    } else if (line.match(/^\d+\.\s/)) {
      elements.push(
        <div key={`ol-${i}`} className="flex gap-2 ml-1 my-1">
          <span className="text-orange-400/60 text-[12px] font-mono mt-0.5">{line.match(/^(\d+)\./)?.[1]}.</span>
          <p className="text-[12px] text-[#bbb] leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFormat(line.replace(/^\d+\.\s/, "")) }} />
        </div>
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <div key={`li-${i}`} className="flex gap-2 ml-1 my-1">
          <span className="text-[#444] mt-1.5">•</span>
          <p className="text-[12px] text-[#bbb] leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(2)) }} />
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={`br-${i}`} className="h-2" />);
    } else {
      elements.push(
        <p key={`p-${i}`} className="text-[12px] text-[#bbb] leading-relaxed my-1" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
      );
    }
  }

  if (inTable) flushTable();

  return <>{elements}</>;
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(170deg, #0c0c0f 0%, #111115 40%, #0e0f13 100%)" }}>
      <div className="flex">
        {/* Sidebar */}
        <nav className="w-56 min-h-screen border-r border-white/[0.06] p-6 sticky top-0">
          <a href="/" className="flex items-center gap-2 mb-8 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-[11px] font-bold shadow-lg shadow-orange-500/20">
              NB
            </div>
            <span className="text-[13px] font-semibold text-[#888] group-hover:text-white transition-colors">Node Banana</span>
          </a>
          <div className="space-y-0.5">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-150 ${
                  activeSection === s.id
                    ? "bg-white/[0.06] text-white"
                    : "text-[#666] hover:text-[#aaa] hover:bg-white/[0.02]"
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
          <div className="mt-8 pt-4 border-t border-white/[0.04]">
            <a href="/" className="text-[11px] text-[#555] hover:text-orange-400 transition-colors">
              ← Back to editor
            </a>
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 max-w-3xl px-10 py-12">
          {sections
            .filter((s) => s.id === activeSection)
            .map((s) => (
              <div key={s.id}>
                <h1 className="text-2xl font-bold text-white mb-6 tracking-tight">{s.title}</h1>
                <MarkdownBlock text={s.content} />
              </div>
            ))}
        </main>
      </div>
    </div>
  );
}
