import { NextRequest, NextResponse } from "next/server";
import { groqChatJson } from "@/lib/groq";
import { splitStory, segmentNarrative } from "@/lib/segmentStory";

export const runtime = "nodejs";

export const SCENE_COUNT = 4;

export interface ScenePlan {
  caption: string;
  imagePrompt: string;
}

function extractScenesArray(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "```").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.scenes)) return obj.scenes;
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
        if (Array.isArray(obj.scenes)) return obj.scenes;
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

  throw new Error("No JSON scenes array found in model response.");
}

function isScenePlan(value: unknown): value is ScenePlan {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.caption === "string" && typeof v.imagePrompt === "string";
}

async function planScenes(story: string, problem: string, apiKey: string): Promise<ScenePlan[]> {
  const systemPrompt = `You are a visual art director for a Studio Ghibli-style illustrated storybook.
Read the given story and break it into exactly ${SCENE_COUNT} key visual scenes, in chronological order.

For each scene output:
- "caption": a short 3-6 word English title for the scene.
- "imagePrompt": a detailed English prompt for a Studio Ghibli-style text-to-image diffusion model, following this template: "Ghibli style [subject/character description] with [distinctive features], [action or pose], [environment or background], [lighting or atmosphere], [additional details]." Always write the imagePrompt in English even if the story is in Hindi.

Respond with ONLY a raw JSON object of the exact shape {"scenes": [{"caption": "...", "imagePrompt": "..."}, ...]} containing exactly ${SCENE_COUNT} entries. No markdown, no commentary, no code fences, no extra keys.`;

  const userPrompt = `Original situation: "${problem}"\n\nStory:\n${story}`;

  const content = await groqChatJson({
    apiKey,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.6,
    // openai/gpt-oss-120b is a reasoning model: it can spend a large, variable
    // share of the budget on hidden reasoning before emitting the JSON itself.
    // Too low a cap here reliably produces an empty/truncated generation.
    maxTokens: 2000,
  });

  let parsed: unknown;
  try {
    parsed = extractScenesArray(content);
  } catch (err) {
    console.error("Scene plan parse failure. Raw content was:", content);
    throw err;
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Scene plan is not an array.");
  }

  const scenes = parsed.filter(isScenePlan).slice(0, SCENE_COUNT);
  if (scenes.length === 0) {
    console.error("No valid scenes parsed. Raw content was:", content);
    throw new Error("No valid scenes parsed from model response.");
  }
  return scenes;
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

    const scenes = await planScenes(story, problem || "", groqKey);
    const { narrative, reference } = splitStory(story);
    const segments = segmentNarrative(narrative, scenes.length);

    return NextResponse.json({ scenes, segments, reference });
  } catch (error: any) {
    console.error("Scene planning error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
