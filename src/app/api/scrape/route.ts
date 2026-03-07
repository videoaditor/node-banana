import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface ScrapeRequest {
  url: string;
  maxImages?: number;    // Max images to return (default 4)
  minImageSize?: number; // Min width/height in px to filter icons (default 100)
}

interface ScrapeResponse {
  success: boolean;
  images: string[];       // Base64 data URIs of scraped images
  text: string;           // Cleaned page text
  pageTitle: string;      // Page <title>
  imageCount: number;     // Total images found (before limit)
  error?: string;
}

async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout per image

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    // Skip non-image responses
    if (!contentType.startsWith("image/")) return null;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Skip very small files (likely tracking pixels)
    if (buffer.length < 1000) return null;

    const mimeType = contentType.split(";")[0] || "image/jpeg";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null; // Skip failed images silently
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ScrapeRequest = await request.json();
    const { url, maxImages = 4, minImageSize = 100 } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // ── Extract page title ──
    const pageTitle = $("title").text().trim() || $('meta[property="og:title"]').attr("content") || "";

    // ── Extract page text ──
    // Remove non-content elements
    $("script, style, noscript, iframe, svg, nav, footer, header").remove();

    // Get structured text from key elements
    const textParts: string[] = [];

    // Page title / heading
    const h1 = $("h1").first().text().trim();
    if (h1) textParts.push(h1);

    // Meta description
    const metaDesc = $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") || "";
    if (metaDesc.trim()) textParts.push(metaDesc.trim());

    // Body text (paragraphs, headings, list items)
    $("h2, h3, h4, p, li, td, blockquote, figcaption").each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        textParts.push(text);
      }
    });

    // Deduplicate and clean
    const seen = new Set<string>();
    const cleanText = textParts
      .filter(t => {
        const normalized = t.toLowerCase().replace(/\s+/g, " ");
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      })
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Limit text length (keep it useful for LLMs)
    const outputText = cleanText.length > 5000 ? cleanText.substring(0, 5000) + "\n\n[...truncated]" : cleanText;

    // ── Extract images ──
    // Collect candidate image URLs with metadata
    interface ImageCandidate {
      url: string;
      width: number;
      height: number;
      isOg: boolean;
      isHero: boolean;
    }

    const candidates: ImageCandidate[] = [];
    const seenUrls = new Set<string>();

    // OG image first (highest priority)
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      const absUrl = new URL(ogImage, url).href;
      if (!seenUrls.has(absUrl)) {
        seenUrls.add(absUrl);
        candidates.push({ url: absUrl, width: 1200, height: 630, isOg: true, isHero: true });
      }
    }

    // All <img> tags
    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src");
      if (!src) return;

      // Skip data URIs (inline tracking pixels), SVGs, and tiny placeholders
      if (src.startsWith("data:") || src.endsWith(".svg") || src.includes("pixel") || src.includes("blank.gif")) return;

      try {
        const absUrl = new URL(src, url).href;
        if (seenUrls.has(absUrl)) return;
        seenUrls.add(absUrl);

        const width = parseInt($(el).attr("width") || "0", 10);
        const height = parseInt($(el).attr("height") || "0", 10);
        const alt = ($(el).attr("alt") || "").toLowerCase();

        // Skip known tiny elements
        if (width > 0 && width < minImageSize && height > 0 && height < minImageSize) return;

        // Hero image heuristic: large dimensions, product-related alt text, or in main content
        const isHero = width >= 400 || height >= 400 ||
          alt.includes("product") || alt.includes("hero") || alt.includes("main") ||
          $(el).closest("main, article, [role='main']").length > 0;

        candidates.push({ url: absUrl, width, height, isOg: false, isHero });
      } catch {
        // Invalid URL, skip
      }
    });

    // Sort: OG first, then hero images, then by size descending
    candidates.sort((a, b) => {
      if (a.isOg !== b.isOg) return a.isOg ? -1 : 1;
      if (a.isHero !== b.isHero) return a.isHero ? -1 : 1;
      return (b.width * b.height) - (a.width * a.height);
    });

    // Fetch top N images as base64
    const imageLimit = Math.min(maxImages, candidates.length);
    const imagePromises = candidates.slice(0, imageLimit + 2) // Fetch a few extra in case some fail
      .map(c => fetchImageAsBase64(c.url));

    const imageResults = await Promise.all(imagePromises);
    const images = imageResults.filter((img): img is string => img !== null).slice(0, maxImages);

    const result: ScrapeResponse = {
      success: true,
      images,
      text: outputText,
      pageTitle,
      imageCount: candidates.length,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      {
        success: false,
        images: [],
        text: "",
        pageTitle: "",
        imageCount: 0,
        error: error instanceof Error ? error.message : "Scraping failed",
      },
      { status: 500 }
    );
  }
}
