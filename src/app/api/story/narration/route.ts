import { NextRequest, NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import { groqChatJson } from "@/lib/groq";
import { generateNarrationMp3, type NarratorVoice } from "@/lib/kokoro";
import { segmentIntoSentenceGroups } from "@/lib/segmentStory";

export const runtime = "nodejs";
export const maxDuration = 300;

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

function extractSegmentsArray(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "```").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.segments)) return obj.segments;
      const firstArray = Object.values(obj).find((v) => Array.isArray(v));
      if (firstArray) return firstArray;
    }
  } catch {
    // fall through to brace/bracket scanning below
  }

  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    try {
      const parsed = JSON.parse(cleaned.slice(objStart, objEnd + 1));
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.segments)) return obj.segments;
        const firstArray = Object.values(obj).find((v) => Array.isArray(v));
        if (firstArray) return firstArray;
      }
    } catch {
      // fall through to array scanning below
    }
  }

  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
    return JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
  }

  throw new Error("No JSON segments array found in model response.");
}

/** True if the longest segment (by word count) is disproportionately longer
 * than the rest - a sign the model wrote one segment as a full-story
 * recap instead of splitting the narrative evenly across all of them. */
function isSeverelyImbalanced(segments: string[]): boolean {
  if (segments.length < 2) return false;
  const wordCounts = segments.map((s) => s.split(/\s+/).filter(Boolean).length);
  const longest = Math.max(...wordCounts);
  const others = wordCounts.filter((_, i) => wordCounts[i] !== longest);
  const othersAvg = others.reduce((sum, n) => sum + n, 0) / Math.max(others.length, 1);
  return longest > Math.max(15, othersAvg * 2.2);
}

async function writeNarrationSegments(
  story: string,
  problem: string,
  sceneCount: number,
  apiKey: string
): Promise<string[]> {
  const systemPrompt = `You are a narrator writing a short spoken voiceover script for a video, broken into exactly ${sceneCount} parts that will be read aloud back to back as one continuous narration.
Read the given story (it may be in Hindi or English) and write ${sceneCount} ENGLISH narration segments, one per scene in chronological order, that together flow as a single continuous narration of the story's emotional arc and turning point - totalling roughly 140-170 words altogether (this will be read aloud at a natural pace of about 150-175 words per minute, so this length lands the combined narration around 45-60 seconds).
Each segment is one to three sentences and roughly the same length as the others (do not make one segment a long summary of the whole story while the rest are short - split the narrative evenly), written exactly as it should be spoken aloud: no headings, no markdown, no quotation marks, no stage directions, no speaker labels, no segment numbering, no preamble.

Respond with ONLY a raw JSON object of the exact shape {"segments": ["...", "...", ...]} containing exactly ${sceneCount} entries. No markdown, no commentary, no code fences.`;

  const userPrompt = `Original situation: "${problem}"\n\nStory:\n${story}`;
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  // gpt-oss-120b's hidden reasoning is highly variable, and for some inputs
  // (observed with heavily quoted/markdown-structured stories) it has
  // *consistently*, not just occasionally, collapsed everything into one
  // giant segment across every retry - so retries alone aren't a guarantee.
  // The best usable text seen across attempts is kept so there is always a
  // deterministic fallback: mechanically re-split it into `sceneCount`
  // sentence-balanced pieces ourselves rather than fail the whole request.
  let lastError: unknown;
  let bestText: string | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const content = await groqChatJson({ apiKey, messages, temperature: 0.6, maxTokens: 4000 });
      const parsed = extractSegmentsArray(content);
      if (Array.isArray(parsed)) {
        const segments = parsed.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim());
        if (segments.length === sceneCount && !isSeverelyImbalanced(segments)) {
          return segments;
        }
        if (segments.length > 0) {
          const joined = segments.join(" ");
          if (!bestText || joined.length > bestText.length) bestText = joined;
          lastError = new Error(
            segments.length !== sceneCount
              ? `Expected ${sceneCount} narration segments, got ${segments.length}.`
              : "One narration segment was far longer than the others (likely a full-story summary instead of an even split)."
          );
          continue;
        }
      }
      lastError = new Error("Narration segments came back empty or malformed.");
    } catch (err) {
      lastError = err;
    }
  }

  if (bestText) {
    const segments = segmentIntoSentenceGroups(bestText, sceneCount);
    if (segments.length > 0) return segments;
  }

  throw lastError instanceof Error ? lastError : new Error("Narration segment generation failed.");
}

export async function POST(req: NextRequest) {
  try {
    const { story, problem, sceneCount, voice, speed } = (await req.json()) as {
      story: string;
      problem?: string;
      sceneCount?: number;
      voice?: NarratorVoice;
      speed?: number;
    };

    if (!story || typeof story !== "string" || !story.trim()) {
      return NextResponse.json({ error: "Story text is required." }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const count = Math.min(Math.max(Math.round(sceneCount || 4), 1), 8);
    const segments = await writeNarrationSegments(story, problem || "", count, groqKey);

    const id = crypto.randomUUID();
    const outPath = path.join(GENERATED_DIR, `narration-${id}.mp3`);
    const result = await generateNarrationMp3(segments, outPath, {
      hfToken: process.env.HF_TOKEN,
      voice: voice === "male" ? "male" : "female",
      speed: typeof speed === "number" ? speed : 1,
    });

    return NextResponse.json({
      audioUrl: `/generated/narration-${id}.mp3`,
      segments: result.segments,
      durationInSeconds: result.durationInSeconds,
    });
  } catch (error: any) {
    console.error("Narration generation error:", error);
    return NextResponse.json(
      { error: error.message || "Narration generation failed." },
      { status: 500 }
    );
  }
}
