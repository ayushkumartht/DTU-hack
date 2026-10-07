import { NextRequest, NextResponse } from "next/server";
import { generateReelClip } from "@/lib/ltxVideo";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * One motion clip per call (the client calls this once per scene, sequentially).
 * Always 200: a missing clip is not an error, the reel falls back to a still frame with a slow zoom.
 */
export async function POST(req: NextRequest) {
  const { prompt } = (await req.json()) as { prompt?: string };
  if (!prompt?.trim()) return NextResponse.json({ error: "prompt is required." }, { status: 400 });
  return NextResponse.json(await generateReelClip(prompt.trim(), process.env.HF_TOKEN));
}
