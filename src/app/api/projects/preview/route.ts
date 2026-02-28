import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";

// GET: Serve a preview image for a workflow
export async function GET(request: NextRequest) {
  const imagePath = request.nextUrl.searchParams.get("path");

  if (!imagePath) {
    return NextResponse.json(
      { success: false, error: "Missing 'path' query parameter" },
      { status: 400 }
    );
  }

  try {
    // Read the image file
    const buffer = await fs.readFile(imagePath);

    // Determine content type based on file extension
    const ext = imagePath.toLowerCase().split(".").pop();
    const contentType = ext === "png" ? "image/png" :
                       ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
                       ext === "webp" ? "image/webp" :
                       "image/png"; // default

    // Return the image
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Failed to load preview image:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load image" },
      { status: 404 }
    );
  }
}
