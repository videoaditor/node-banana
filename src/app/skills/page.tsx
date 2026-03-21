import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Node Banana — Skills API Reference",
  description:
    "Machine-readable reference for all node types, inputs, outputs, and workflow capabilities. Designed for AI agents to crawl and understand available creative pipeline skills.",
};

// ── Node catalogue ─────────────────────────────────────────────────
// Each entry is the single source-of-truth that both the HTML table
// and any future /api/skills.json endpoint will consume.

interface NodeSpec {
  type: string;
  name: string;
  category: "input" | "processing" | "generation" | "output" | "utility";
  description: string;
  inputs: { id: string; type: "image" | "text" | "audio" | "video" | "3d" | "easeCurve"; description: string }[];
  outputs: { id: string; type: "image" | "text" | "audio" | "video" | "3d" | "easeCurve"; description: string }[];
  parameters?: { name: string; type: string; description: string; default?: string }[];
  executionNotes?: string;
}

const NODES: NodeSpec[] = [
  // ── INPUT ──
  {
    type: "imageInput",
    name: "Image Input",
    category: "input",
    description: "Upload or drag-and-drop an image to feed into the workflow. Supports PNG, JPG, WebP.",
    inputs: [],
    outputs: [{ id: "image", type: "image", description: "The loaded image as base64 data URL" }],
  },
  {
    type: "audioInput",
    name: "Audio Input",
    category: "input",
    description: "Upload an audio file (MP3, WAV, OGG) to feed into audio-capable nodes.",
    inputs: [],
    outputs: [{ id: "audio", type: "audio", description: "Audio file as base64 data URL" }],
  },
  {
    type: "webScraper",
    name: "Web Scraper",
    category: "input",
    description: "Fetches a URL and extracts images and/or text from the page. Dual output.",
    inputs: [{ id: "text", type: "text", description: "URL to scrape (or type directly)" }],
    outputs: [
      { id: "image", type: "image", description: "Extracted images from the page" },
      { id: "text", type: "text", description: "Cleaned page text content" },
    ],
    parameters: [
      { name: "scrapeMode", type: "enum", description: "What to extract", default: "all-images" },
      { name: "maxImages", type: "number", description: "Max images to extract", default: "4" },
    ],
  },

  // ── PROCESSING ──
  {
    type: "prompt",
    name: "Prompt",
    category: "processing",
    description: "Text input node. Type a prompt that feeds into generation or LLM nodes. Supports multi-segment prompts with + Add.",
    inputs: [],
    outputs: [{ id: "text", type: "text", description: "The prompt text" }],
  },
  {
    type: "promptConstructor",
    name: "Prompt Constructor",
    category: "processing",
    description: "Build prompts from a static template with dynamic variable slots filled by upstream text connections.",
    inputs: [{ id: "text", type: "text", description: "Dynamic text values to insert into template slots" }],
    outputs: [{ id: "text", type: "text", description: "Assembled prompt" }],
    parameters: [
      { name: "staticText", type: "string", description: "Template text with {slot} placeholders" },
    ],
  },
  {
    type: "promptConcatenator",
    name: "Combine Text",
    category: "processing",
    description: "Joins multiple text inputs into a single output with a configurable separator.",
    inputs: [{ id: "text", type: "text", description: "Text inputs to combine (accepts multiple)" }],
    outputs: [{ id: "text", type: "text", description: "Combined text" }],
    parameters: [
      { name: "separator", type: "string", description: "Separator between joined texts", default: "\\n" },
    ],
  },
  {
    type: "imageIterator",
    name: "Image Iterator",
    category: "processing",
    description: "Batches multiple images and runs the downstream workflow once per image. Supports random sampling.",
    inputs: [{ id: "image", type: "image", description: "Images to iterate over (accepts multiple connections)" }],
    outputs: [{ id: "image", type: "image", description: "Current image in iteration" }],
    parameters: [
      { name: "mode", type: "enum", description: "'all' or 'random'", default: "all" },
      { name: "randomCount", type: "number", description: "How many random images to pick", default: "1" },
    ],
    executionNotes: "Runs all downstream nodes once per image. Supports local image uploads combined with connected inputs.",
  },
  {
    type: "textIterator",
    name: "Text Iterator",
    category: "processing",
    description: "Splits incoming text by a separator and runs the downstream workflow once per segment.",
    inputs: [{ id: "text", type: "text", description: "Text to split into segments" }],
    outputs: [{ id: "text", type: "text", description: "Current text segment in iteration" }],
    parameters: [
      { name: "splitMode", type: "enum", description: "How to split: newline, period, hash, dash, custom", default: "newline" },
      { name: "customSeparator", type: "string", description: "Custom split character (when splitMode is 'custom')" },
    ],
    executionNotes: "Each segment triggers a full downstream execution pass.",
  },
  {
    type: "arrayNode",
    name: "Array",
    category: "processing",
    description: "Holds a list of text items. Each item becomes a separate text output during batch iteration. Can also receive items from upstream text connections.",
    inputs: [{ id: "text", type: "text", description: "Incoming text split by newlines and appended to local items" }],
    outputs: [{ id: "text", type: "text", description: "Current item during iteration" }],
    executionNotes: "Works like an iterator: runs downstream once per item. Merges local items with connected upstream text (split by newlines).",
  },
  {
    type: "listSelector",
    name: "List Selector",
    category: "processing",
    description: "Dropdown picker that selects one item from a configurable set of options and outputs it as text.",
    inputs: [{ id: "text", type: "text", description: "Optional: populates options from upstream" }],
    outputs: [{ id: "text", type: "text", description: "The currently selected option" }],
    parameters: [
      { name: "selectedIndex", type: "number", description: "Index of the selected option", default: "0" },
    ],
  },
  {
    type: "splitGrid",
    name: "Split Grid",
    category: "processing",
    description: "Detects a grid layout in an image and splits it into individual cells. Useful for extracting frames from contact sheets.",
    inputs: [{ id: "image", type: "image", description: "Image containing a grid layout" }],
    outputs: [{ id: "image", type: "image", description: "Individual grid cells as separate images" }],
  },
  {
    type: "annotation",
    name: "Annotate",
    category: "processing",
    description: "Draw on an image using a Konva canvas — freehand, shapes, text overlays. Outputs the annotated image.",
    inputs: [{ id: "image", type: "image", description: "Base image to draw on" }],
    outputs: [{ id: "image", type: "image", description: "Annotated image" }],
  },
  {
    type: "imageCompare",
    name: "Image Compare",
    category: "processing",
    description: "Side-by-side comparison of two images with a draggable slider.",
    inputs: [{ id: "image", type: "image", description: "Two images to compare (accepts two connections)" }],
    outputs: [],
  },

  // ── GENERATION ──
  {
    type: "nanoBanana",
    name: "Generate Image",
    category: "generation",
    description: "AI image generation using Gemini or Kie.ai models. Accepts prompt text and optional reference images. Supports multiple aspect ratios and model-specific parameters.",
    inputs: [
      { id: "image", type: "image", description: "Reference image(s) for image-to-image generation" },
      { id: "text", type: "text", description: "Text prompt describing what to generate" },
    ],
    outputs: [{ id: "image", type: "image", description: "Generated image" }],
    parameters: [
      { name: "model", type: "string", description: "Model ID (e.g. nano-banana, nano-banana-pro, or Kie model)" },
      { name: "aspectRatio", type: "enum", description: "Output aspect ratio: 1:1, 16:9, 9:16, 4:3, 3:4" },
      { name: "count", type: "number", description: "Number of images to generate per run", default: "1" },
    ],
    executionNotes: "Calls /api/generate. Supports Gemini native and 40+ Kie.ai models.",
  },
  {
    type: "generateVideo",
    name: "Generate Video",
    category: "generation",
    description: "AI video generation from text prompts and/or reference images using Kie.ai video models (Sora, Veo, Kling, etc.).",
    inputs: [
      { id: "image", type: "image", description: "Reference image for image-to-video generation" },
      { id: "text", type: "text", description: "Text prompt describing the video" },
    ],
    outputs: [{ id: "video", type: "video", description: "Generated video" }],
    parameters: [
      { name: "model", type: "string", description: "Kie model ID" },
      { name: "duration", type: "string", description: "Video duration in seconds" },
      { name: "aspectRatio", type: "enum", description: "Output aspect ratio" },
    ],
  },
  {
    type: "generate3d",
    name: "Generate 3D",
    category: "generation",
    description: "AI 3D model generation from images using Kie.ai 3D models.",
    inputs: [{ id: "image", type: "image", description: "Reference image for 3D reconstruction" }],
    outputs: [{ id: "3d", type: "3d", description: "Generated 3D model (GLB)" }],
  },
  {
    type: "llmGenerate",
    name: "LLM Generate",
    category: "generation",
    description: "Text generation using LLMs (Gemini, OpenAI, Anthropic, Groq). Can accept images for vision tasks. Outputs text.",
    inputs: [
      { id: "text", type: "text", description: "Input prompt or context" },
      { id: "image", type: "image", description: "Image(s) for vision/multimodal tasks" },
    ],
    outputs: [{ id: "text", type: "text", description: "Generated text response" }],
    parameters: [
      { name: "provider", type: "enum", description: "LLM provider: google, openai, anthropic, groq" },
      { name: "model", type: "string", description: "Model ID within the provider" },
      { name: "systemPrompt", type: "string", description: "System instructions for the LLM" },
    ],
    executionNotes: "Calls /api/llm. Supports streaming. Can chain with prompts and image inputs.",
  },

  // ── OUTPUT ──
  {
    type: "output",
    name: "Output",
    category: "output",
    description: "Displays the final image result. End node of a workflow branch.",
    inputs: [{ id: "image", type: "image", description: "Image to display" }],
    outputs: [],
  },
  {
    type: "outputGallery",
    name: "Output Gallery",
    category: "output",
    description: "Collects and displays multiple images in a gallery grid. Useful with iterators.",
    inputs: [{ id: "image", type: "image", description: "Images to collect (accepts multiple / iterated)" }],
    outputs: [],
    executionNotes: "Accumulates images across iterator runs into a single gallery view.",
  },
  {
    type: "videoStitch",
    name: "Video Stitch",
    category: "output",
    description: "Combines multiple video clips into a single output with transitions.",
    inputs: [{ id: "video", type: "video", description: "Video clips to stitch together" }],
    outputs: [{ id: "video", type: "video", description: "Combined video" }],
  },

  // ── UTILITY ──
  {
    type: "stickyNote",
    name: "Sticky Note",
    category: "utility",
    description: "Colored note for workflow annotations. No data connections — purely visual.",
    inputs: [],
    outputs: [],
  },
];

// ── Helpers ────────────────────────────────────────────────────────

const CATEGORY_ORDER = ["input", "processing", "generation", "output", "utility"] as const;

const HANDLE_TYPE_COLORS: Record<string, string> = {
  image: "#3ecf8e",
  text: "#4a90d9",
  video: "#c084fc",
  audio: "#e85d75",
  "3d": "#f5a623",
  easeCurve: "#bef264",
};

function HandleBadge({ type }: { type: string }) {
  const color = HANDLE_TYPE_COLORS[type] || "#6c7280";
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {type}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function SkillsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] px-6 py-8 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Skills API Reference</h1>
        <p className="text-[var(--text-secondary)] max-w-2xl">
          Machine-readable reference for all node types, their inputs, outputs,
          and capabilities. AI agents can crawl this page to understand which
          creative pipeline skills are available and how to compose them into
          workflows.
        </p>
        <div className="mt-4 flex gap-3 text-xs text-[var(--text-muted)]">
          <span>{NODES.length} nodes</span>
          <span>|</span>
          <span>{CATEGORY_ORDER.length} categories</span>
          <span>|</span>
          <span>Handle types: {Object.keys(HANDLE_TYPE_COLORS).join(", ")}</span>
        </div>
      </header>

      {/* Quick-nav */}
      <nav className="border-b border-[var(--border-subtle)] px-6 py-3 max-w-5xl mx-auto flex gap-4 text-xs">
        {CATEGORY_ORDER.map((cat) => (
          <a
            key={cat}
            href={`#${cat}`}
            className="uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {cat}
          </a>
        ))}
      </nav>

      {/* Connection rules summary */}
      <section className="px-6 py-6 max-w-5xl mx-auto">
        <h2 className="text-lg font-semibold mb-3">Connection Rules</h2>
        <ul className="text-sm text-[var(--text-secondary)] space-y-1 list-disc list-inside">
          <li>Handles only connect to matching types (<HandleBadge type="image" /> → <HandleBadge type="image" />, <HandleBadge type="text" /> → <HandleBadge type="text" />)</li>
          <li>Connections flow left (input) → right (output)</li>
          <li>Image inputs accept multiple connections; text inputs accept one</li>
          <li>Iterators (Image Iterator, Text Iterator, Array) run downstream once per item</li>
        </ul>
      </section>

      {/* Node catalogue by category */}
      <main className="px-6 pb-16 max-w-5xl mx-auto space-y-10">
        {CATEGORY_ORDER.map((category) => {
          const catNodes = NODES.filter((n) => n.category === category);
          if (catNodes.length === 0) return null;
          return (
            <section key={category} id={category}>
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-4 border-b border-[var(--border-subtle)] pb-2">
                {category}
              </h2>
              <div className="space-y-6">
                {catNodes.map((node) => (
                  <article
                    key={node.type}
                    id={`node-${node.type}`}
                    className="rounded-xl border border-[var(--border-subtle)] p-5"
                    style={{ background: "rgba(28, 30, 38, 0.6)" }}
                  >
                    <div className="flex items-baseline gap-3 mb-2">
                      <h3 className="text-base font-semibold">{node.name}</h3>
                      <code className="text-xs text-[var(--text-muted)] font-mono bg-[var(--bg-base)] px-1.5 py-0.5 rounded">
                        {node.type}
                      </code>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                      {node.description}
                    </p>

                    {/* Inputs / Outputs grid */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      {/* Inputs */}
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-mono">
                          Inputs
                        </span>
                        {node.inputs.length === 0 ? (
                          <span className="text-[var(--text-muted)] italic">None</span>
                        ) : (
                          <ul className="space-y-1">
                            {node.inputs.map((h) => (
                              <li key={h.id} className="flex items-start gap-2">
                                <HandleBadge type={h.type} />
                                <span className="text-[var(--text-secondary)]">{h.description}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Outputs */}
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-mono">
                          Outputs
                        </span>
                        {node.outputs.length === 0 ? (
                          <span className="text-[var(--text-muted)] italic">None</span>
                        ) : (
                          <ul className="space-y-1">
                            {node.outputs.map((h) => (
                              <li key={h.id} className="flex items-start gap-2">
                                <HandleBadge type={h.type} />
                                <span className="text-[var(--text-secondary)]">{h.description}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Parameters */}
                    {node.parameters && node.parameters.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                        <span className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 font-mono">
                          Parameters
                        </span>
                        <table className="w-full text-xs">
                          <tbody>
                            {node.parameters.map((p) => (
                              <tr key={p.name} className="border-b border-[var(--border-subtle)]/50 last:border-0">
                                <td className="py-1 pr-3 font-mono text-[var(--text-primary)]">{p.name}</td>
                                <td className="py-1 pr-3 text-[var(--text-muted)]">{p.type}</td>
                                <td className="py-1 text-[var(--text-secondary)]">
                                  {p.description}
                                  {p.default && (
                                    <span className="ml-1 text-[var(--text-muted)]">
                                      (default: <code>{p.default}</code>)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Execution notes */}
                    {node.executionNotes && (
                      <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)] italic">
                        {node.executionNotes}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] px-6 py-6 max-w-5xl mx-auto text-xs text-[var(--text-muted)]">
        <p>
          This page is designed to be crawled by AI agents. All node specs are
          server-rendered HTML for maximum accessibility. To compose a workflow
          programmatically, use the <code>/api/workflow</code> endpoint with a
          JSON payload containing <code>nodes</code> and <code>edges</code>{" "}
          arrays referencing the node types documented above.
        </p>
      </footer>
    </div>
  );
}
