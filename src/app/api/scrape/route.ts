import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface ScrapeRequest {
  url: string;
  maxImages?: number;    // Max images to return (0 = all, default 20)
  minImageSize?: number; // Min width/height in px to filter icons (default 100)
}

interface ScrapeResponse {
  success: boolean;
  images: string[];       // Base64 data URIs of scraped images
  text: string;           // Cleaned page text
  pageTitle: string;      // Page <title>
  imageCount: number;     // Total candidates found (before filtering)
  error?: string;
}

// Patterns that indicate junk images (logos, icons, badges, social, tracking)
const JUNK_URL_PATTERNS = [
  /logo/i, /icon/i, /favicon/i, /badge/i, /sprite/i,
  /pixel/i, /tracker/i, /beacon/i, /spacer/i, /blank\./i,
  /social/i, /share/i, /facebook/i, /twitter/i, /instagram/i, /linkedin/i, /pinterest/i,
  /payment/i, /visa/i, /mastercard/i, /paypal/i, /stripe/i,
  /trust/i, /secure/i, /ssl/i, /verified/i,
  /spinner/i, /loading/i, /placeholder/i,
  /avatar/i, /flag/i, /arrow/i, /caret/i, /chevron/i,
  /star-rating/i, /rating/i,
];

const JUNK_EXTENSIONS = [".svg", ".gif", ".ico", ".webp"]; // webp kept for manual override
const KEEP_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]; // actual product images

function isJunkUrl(imageUrl: string): boolean {
  const urlLower = imageUrl.toLowerCase();
  // Always skip SVG and ICO
  if (urlLower.endsWith(".svg") || urlLower.endsWith(".ico")) return true;
  // Check junk patterns
  return JUNK_URL_PATTERNS.some(p => p.test(urlLower));
}

async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; byteSize: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Skip tiny files (tracking pixels, spacers) — under 2KB
    if (buffer.length < 2000) return null;

    const mimeType = contentType.split(";")[0] || "image/jpeg";
    return {
      data: `data:${mimeType};base64,${buffer.toString("base64")}`,
      byteSize: buffer.length,
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ScrapeRequest = await request.json();
    const { url, maxImages = 20, minImageSize = 100 } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

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
    $("script, style, noscript, iframe, svg, nav, footer, header").remove();

    const textParts: string[] = [];
    const h1 = $("h1").first().text().trim();
    if (h1) textParts.push(h1);

    const metaDesc = $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") || "";
    if (metaDesc.trim()) textParts.push(metaDesc.trim());

    $("h2, h3, h4, p, li, td, blockquote, figcaption").each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        textParts.push(text);
      }
    });

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

    const outputText = cleanText.length > 5000 ? cleanText.substring(0, 5000) + "\n\n[...truncated]" : cleanText;

    // ── Extract images ──
    interface ImageCandidate {
      url: string;
      width: number;
      height: number;
      score: number; // Higher = more likely to be important content
    }

    const candidates: ImageCandidate[] = [];
    const seenUrls = new Set<string>();

    const addCandidate = (imgUrl: string, width: number, height: number, score: number) => {
      try {
        const absUrl = new URL(imgUrl, url).href;
        if (seenUrls.has(absUrl)) return;
        if (isJunkUrl(absUrl)) return;
        seenUrls.add(absUrl);
        candidates.push({ url: absUrl, width, height, score });
      } catch {
        // Invalid URL
      }
    };

    // 1. OG image (highest priority)
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) addCandidate(ogImage, 1200, 630, 100);

    // 2. Product-specific meta images
    $('meta[property="product:image"]').each((_, el) => {
      const content = $(el).attr("content");
      if (content) addCandidate(content, 800, 800, 95);
    });

    // 3. Structured data images (JSON-LD product images)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || "");
        const extractImages = (obj: any) => {
          if (!obj) return;
          if (obj.image) {
            const imgs = Array.isArray(obj.image) ? obj.image : [obj.image];
            for (const img of imgs) {
              const imgUrl = typeof img === "string" ? img : img?.url || img?.contentUrl;
              if (imgUrl) addCandidate(imgUrl, 800, 800, 90);
            }
          }
          // Check @graph array
          if (Array.isArray(obj["@graph"])) {
            obj["@graph"].forEach(extractImages);
          }
        };
        extractImages(json);
      } catch {
        // Invalid JSON-LD
      }
    });

    // 4. Gallery and product container images (high priority)
    const gallerySelectors = [
      '[class*="gallery"] img', '[class*="Gallery"] img',
      '[class*="carousel"] img', '[class*="Carousel"] img',
      '[class*="slider"] img', '[class*="Slider"] img',
      '[class*="product-image"] img', '[class*="productImage"] img',
      '[class*="product_image"] img', '[class*="ProductImage"] img',
      '[data-gallery] img', '[data-product] img',
      '.swiper-slide img', '.slick-slide img',
      '[class*="lightbox"] img', '[class*="zoom"] img',
      'figure img', 'picture img',
    ];

    for (const selector of gallerySelectors) {
      $(selector).each((_, el) => {
        const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src") ||
                    $(el).attr("data-zoom-image") || $(el).attr("data-large");
        if (!src || src.startsWith("data:")) return;
        const width = parseInt($(el).attr("width") || "0", 10);
        const height = parseInt($(el).attr("height") || "0", 10);
        addCandidate(src, width || 600, height || 600, 80);
      });
    }

    // 5. <picture> source elements (often have high-res product images)
    $("picture source").each((_, el) => {
      const srcset = $(el).attr("srcset");
      if (!srcset) return;
      // Parse srcset — take the largest variant
      const parts = srcset.split(",").map(s => s.trim().split(/\s+/));
      let bestUrl = "";
      let bestWidth = 0;
      for (const [imgUrl, descriptor] of parts) {
        const w = parseInt(descriptor || "0", 10);
        if (w > bestWidth || !bestUrl) {
          bestWidth = w;
          bestUrl = imgUrl;
        }
      }
      if (bestUrl && !bestUrl.startsWith("data:")) {
        addCandidate(bestUrl, bestWidth || 600, 0, 75);
      }
    });

    // 6. All remaining <img> tags
    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src") ||
                  $(el).attr("data-original") || $(el).attr("data-srcset")?.split(",")[0]?.trim().split(/\s+/)[0];
      if (!src || src.startsWith("data:")) return;

      const width = parseInt($(el).attr("width") || "0", 10);
      const height = parseInt($(el).attr("height") || "0", 10);
      const alt = ($(el).attr("alt") || "").toLowerCase();
      const className = ($(el).attr("class") || "").toLowerCase();
      const parentClass = ($(el).parent()?.attr("class") || "").toLowerCase();

      // Skip known tiny elements
      if (width > 0 && width < minImageSize && height > 0 && height < minImageSize) return;

      // Score based on context
      let score = 30; // Base score for any qualifying image

      // Boost: in main content area
      if ($(el).closest("main, article, [role='main'], .content, .main").length > 0) score += 20;

      // Boost: large dimensions
      if (width >= 400 || height >= 400) score += 15;
      if (width >= 800 || height >= 800) score += 10;

      // Boost: product-related context
      if (alt.includes("product") || alt.includes("item") || alt.includes("photo")) score += 10;
      if (className.includes("product") || className.includes("hero") || className.includes("main")) score += 10;
      if (parentClass.includes("product") || parentClass.includes("gallery") || parentClass.includes("hero")) score += 10;

      // Penalize: likely UI elements
      if (alt.includes("logo") || alt.includes("icon") || alt.includes("avatar")) score -= 30;
      if (className.includes("logo") || className.includes("icon") || className.includes("avatar")) score -= 30;

      addCandidate(src, width, height, score);
    });

    // 7. Background images in style attributes (common for hero/product images)
    $("[style*='background-image']").each((_, el) => {
      const style = $(el).attr("style") || "";
      const match = style.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
      if (match && match[1] && !match[1].startsWith("data:")) {
        addCandidate(match[1], 600, 400, 40);
      }
    });

    // Sort by score descending, then by estimated size
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.width * b.height) - (a.width * a.height);
    });

    // Filter: only keep candidates with positive score
    const qualifiedCandidates = candidates.filter(c => c.score > 0);

    // Determine how many to fetch (0 = all)
    const fetchLimit = maxImages === 0
      ? qualifiedCandidates.length
      : Math.min(maxImages, qualifiedCandidates.length);

    // Fetch extra in case some fail
    const fetchCount = Math.min(fetchLimit + 4, qualifiedCandidates.length);
    const imagePromises = qualifiedCandidates.slice(0, fetchCount)
      .map(c => fetchImageAsBase64(c.url));

    const imageResults = await Promise.all(imagePromises);

    // Filter successful fetches, then apply size filter (skip images under 5KB — likely thumbnails/placeholders)
    const images = imageResults
      .filter((r): r is { data: string; byteSize: number } => r !== null && r.byteSize > 5000)
      .map(r => r.data)
      .slice(0, maxImages === 0 ? undefined : maxImages);

    const result: ScrapeResponse = {
      success: true,
      images,
      text: outputText,
      pageTitle,
      imageCount: qualifiedCandidates.length,
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
