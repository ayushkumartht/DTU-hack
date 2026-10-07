import { NextRequest, NextResponse } from "next/server";
import { generateGhibliImage } from "@/lib/gradio";

export const runtime = "nodejs";
export const maxDuration = 120;

const MOCK_IMAGE_URL = "/mock/scene-placeholder.webp";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isMockMode(): boolean {
  return process.env.MOCK_SCENE_IMAGES === "true";
}

export async function POST(req: NextRequest) {
  try {
    const { imagePrompt } = await req.json();

    if (!imagePrompt || typeof imagePrompt !== "string" || !imagePrompt.trim()) {
      return NextResponse.json({ error: "imagePrompt is required." }, { status: 400 });
    }

    if (isMockMode()) {
      // Mimics real generation pacing (so the sequential reveal UI is still
      // exercised) without ever calling the billed Hugging Face Space.
      await sleep(600 + Math.random() * 600);
      return NextResponse.json({ imageUrl: MOCK_IMAGE_URL, seed: null, mock: true });
    }

    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      return NextResponse.json(
        { error: "HF_TOKEN is not configured on the server." },
        { status: 500 }
      );
    }

    try {
      const { imageUrl, seed } = await generateGhibliImage(imagePrompt, hfToken);
      return NextResponse.json({ imageUrl, seed, mock: false });
    } catch (error: any) {
      console.warn("Scene image generation failed (falling back to mock placeholder):", error?.message || error);
      return NextResponse.json({
        imageUrl: MOCK_IMAGE_URL,
        seed: null,
        mock: true,
        warning: "ZeroGPU quota limit hit or Space busy — using placeholder image so video can continue.",
      });
    }
  } catch (error: any) {
    console.error("Scene image generation error:", error);
    return NextResponse.json(
      { error: error.message || "Image generation failed." },
      { status: 500 }
    );
  }
}
