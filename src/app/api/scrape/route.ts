import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface ScrapeRequest {
  url: string;
  mode: "best-image" | "all-images" | "page-text";
}

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: ScrapeRequest = await request.json();
    const { url, mode } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.statusText}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    if (mode === "best-image") {
      // Try og:image first
      let imageUrl = $('meta[property="og:image"]').attr("content");

      // If no og:image, find the largest image
      if (!imageUrl) {
        const images = $("img")
          .map((_, el) => {
            const src = $(el).attr("src");
            const width = parseInt($(el).attr("width") || "0", 10);
            const height = parseInt($(el).attr("height") || "0", 10);
            return { src, width, height, size: width * height };
          })
          .get()
          .filter((img) => img.src)
          .sort((a, b) => b.size - a.size);

        if (images.length > 0) {
          imageUrl = images[0].src;
        }
      }

      if (!imageUrl) {
        return NextResponse.json({ error: "No images found on page" }, { status: 404 });
      }

      // Convert relative URLs to absolute
      const absoluteUrl = new URL(imageUrl, url).href;

      // Fetch and convert to base64
      const base64Image = await fetchImageAsBase64(absoluteUrl);

      return NextResponse.json({ image: base64Image });
    } else if (mode === "all-images") {
      // Extract all image URLs
      const imageUrls = $("img")
        .map((_, el) => {
          const src = $(el).attr("src");
          if (src) {
            return new URL(src, url).href;
          }
          return null;
        })
        .get()
        .filter((url): url is string => url !== null);

      // Return as JSON array string
      return NextResponse.json({ text: JSON.stringify(imageUrls, null, 2) });
    } else if (mode === "page-text") {
      // Extract page text (remove script and style tags)
      $("script, style").remove();
      const text = $("body").text().trim().replace(/\s+/g, " ");

      return NextResponse.json({ text });
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scraping failed" },
      { status: 500 }
    );
  }
}
