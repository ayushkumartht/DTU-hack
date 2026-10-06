import { NextRequest, NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import { groqChatText } from "@/lib/groq";
import { generateNarrationMp3 } from "@/lib/kokoro";

export const runtime = "nodejs";
export const maxDuration = 300;

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

async function writeNarrationScript(story: string, problem: string, apiKey: string): Promise<string> {
  const systemPrompt = `You are a narrator writing a short spoken voiceover script for a video.
Read the given story (it may be in Hindi or English) and rewrite it as a single flowing ENGLISH narration of 230-270 words that captures its emotional arc and turning point, aiming for a spoken narration of roughly 35-55 seconds.
Write it exactly as it should be spoken aloud: no headings, no markdown, no quotation marks around the whole thing, no stage directions, no speaker labels, no preamble like "Here is the narration" - respond with the narration text itself and nothing else.`;

  const userPrompt = `Original situation: "${problem}"\n\nStory:\n${story}`;
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  // gpt-oss-120b's hidden reasoning for this open-ended rewrite task is
  // highly variable in length - it has, even at a generous budget,
  // occasionally consumed the whole thing with nothing left for visible
  // output. A single retry clears that up in practice.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const content = await groqChatText({ apiKey, messages, temperature: 0.6, maxTokens: 4000 });
      const script = content.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
      if (script) return script;
      lastError = new Error("Narration script came back empty.");
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Narration script generation failed.");
}

export async function POST(req: NextRequest) {
  try {
    const { story, problem } = await req.json();

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

    const script = await writeNarrationScript(story, problem || "", groqKey);

    const id = crypto.randomUUID();
    const outPath = path.join(GENERATED_DIR, `narration-${id}.mp3`);
    const { durationInSeconds } = await generateNarrationMp3(script, outPath, process.env.HF_TOKEN);

    return NextResponse.json({
      audioUrl: `/generated/narration-${id}.mp3`,
      script,
      durationInSeconds,
    });
  } catch (error: any) {
    console.error("Narration generation error:", error);
    return NextResponse.json(
      { error: error.message || "Narration generation failed." },
      { status: 500 }
    );
  }
}
