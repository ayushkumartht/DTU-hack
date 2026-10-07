import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { generateNarrationMp3, type NarratorVoice } from "@/lib/kokoro";
import { generateEdgeNarration, isEdgeLanguage } from "@/lib/tts/edge";
import { getTeaching } from "@/lib/teachings";
import { assertVerbatim } from "@/lib/authenticity";
import { estimateSpokenSeconds, fitToWindow } from "@/lib/duration";
import { beatTexts } from "@/features/reel/beats";
import { BEAT_ORDER, type ReelScript } from "@/features/reel/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");
const EDGE_SPEED = 0.92; // a little slower than natural: a reel for learning, not for racing

interface NarrationOut {
  segments: { text: string; durationInSeconds: number }[];
  durationInSeconds: number;
}

export async function POST(req: NextRequest) {
  try {
    const { script, voice, speed } = (await req.json()) as { script: ReelScript; voice?: NarratorVoice; speed?: number };

    const teaching = script?.teachingId ? getTeaching(script.teachingId) : null;
    if (!teaching) return NextResponse.json({ error: "Unknown teaching." }, { status: 400 });
    assertVerbatim(script.quote, teaching); // never voice a drifted quote

    const texts = beatTexts(script);
    const gender = voice === "male" ? "male" : "female";
    await fs.mkdir(GENERATED_DIR, { recursive: true });
    const id = crypto.randomUUID();
    const outPath = path.join(GENERATED_DIR, `narration-${id}.mp3`);

    let result: NarrationOut | null = null;
    let engine = "none";

    if (script.language === "en") {
      const options = { hfToken: process.env.HF_TOKEN, voice: gender as NarratorVoice };
      let r = await generateNarrationMp3(texts, outPath, { ...options, speed: typeof speed === "number" ? speed : 1 });
      const fit = fitToWindow(r.segments.map((s) => s.durationInSeconds));
      if (!fit.inRange && fit.suggestedSpeed !== 1 && (speed ?? 1) === 1) {
        r = await generateNarrationMp3(texts, outPath, { ...options, speed: fit.suggestedSpeed });
      }
      result = r;
      engine = "kokoro";
    } else if (isEdgeLanguage(script.language)) {
      // The story is in the chosen language; the verified quote keeps its own (usually English) voice.
      const segments = BEAT_ORDER.map((beat, i) => ({
        text: texts[i],
        lang: beat === "quote" ? script.quote.lang : script.language,
      }));
      try {
        let r = await generateEdgeNarration(segments, outPath, { gender, speed: EDGE_SPEED });
        const fit = fitToWindow(r.segments.map((s) => s.durationInSeconds));
        if (!fit.inRange && fit.suggestedSpeed !== 1) {
          r = await generateEdgeNarration(segments, outPath, { gender, speed: EDGE_SPEED * fit.suggestedSpeed });
        }
        result = r;
        engine = "edge";
      } catch (err) {
        console.error("Edge narration failed, falling back to subtitles only:", err);
      }
    }

    if (result) {
      return NextResponse.json({
        audioUrl: `/generated/narration-${id}.mp3`,
        segments: result.segments,
        durationInSeconds: result.durationInSeconds,
        voiceover: true,
        engine,
      });
    }

    // No voice available (or it failed): durations are estimated and the reel is subtitle-only.
    const segments = texts.map((text, i) => ({
      text,
      durationInSeconds: Math.max(2.5, estimateSpokenSeconds(text, BEAT_ORDER[i] === "quote" ? script.quote.lang : script.language)),
    }));
    return NextResponse.json({
      audioUrl: null,
      segments,
      durationInSeconds: segments.reduce((s, x) => s + x.durationInSeconds, 0),
      voiceover: false,
      engine,
    });
  } catch (error: any) {
    console.error("Reel narration error:", error);
    const integrity = /integrity check/i.test(error?.message ?? "");
    return NextResponse.json({ error: error.message || "Narration failed." }, { status: integrity ? 422 : 500 });
  }
}
