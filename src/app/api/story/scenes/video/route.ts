import { NextRequest, NextResponse } from "next/server";
import { generateSceneClip } from "@/lib/ltxVideo";

export const runtime = "nodejs";
export const maxDuration = 180;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isMockMode(): boolean {
  return process.env.MOCK_SCENE_VIDEO === "true";
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, motionPrompt } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "imageUrl is required." }, { status: 400 });
    }

    if (isMockMode()) {
      // No real motion clip in mock mode - the frontend falls back to the
      // static scene image (with a Ken Burns pan) for this scene. Delayed
      // to keep the sequential reveal UI meaningful to watch.
      await sleep(500 + Math.random() * 500);
      return NextResponse.json({ videoUrl: null, mock: true });
    }

    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      return NextResponse.json(
        { error: "HF_TOKEN is not configured on the server." },
        { status: 500 }
      );
    }

    try {
      const { videoUrl, seed } = await generateSceneClip(
        imageUrl,
        motionPrompt || "Gentle, subtle cinematic motion",
        hfToken
      );
      return NextResponse.json({ videoUrl, seed, mock: false });
    } catch (err: any) {
      // Motion is an enhancement, not a requirement: a failed clip (quota,
      // cold start, etc.) falls back to the static image rather than
      // failing the whole video.
      console.error("Scene video generation error (falling back to static image):", err);
      return NextResponse.json({ videoUrl: null, mock: false, error: err.message || "Scene video generation failed." });
    }
  } catch (error: any) {
    console.error("Scene video request error:", error);
    return NextResponse.json(
      { error: error.message || "Scene video generation failed." },
      { status: 500 }
    );
  }
}
