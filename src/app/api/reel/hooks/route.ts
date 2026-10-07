import { NextRequest, NextResponse } from "next/server";
import { groqChatJson } from "@/lib/groq";
import { getTeaching, pickVariant, type LangCode } from "@/lib/teachings";
import { buildHooksSystemPrompt } from "@/lib/prompts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { teachingId, language = "hi" } = (await req.json()) as { teachingId?: string; language?: LangCode };
    const teaching = teachingId ? getTeaching(teachingId) : null;
    if (!teaching) return NextResponse.json({ error: "Unknown teaching id." }, { status: 400 });
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY is not configured." }, { status: 500 });

    const { variant } = pickVariant(teaching, language);
    const content = await groqChatJson({
      apiKey,
      messages: [
        { role: "system", content: buildHooksSystemPrompt(language) },
        { role: "user", content: `Themes: ${teaching.topics.join(", ")}.\nTeaching (private context only, never reproduce or paraphrase):\n${variant.text}` },
      ],
      temperature: 0.95,
      maxTokens: 1500,
    });

    const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
    const hooks = (Array.isArray(parsed.hooks) ? parsed.hooks : []).filter(
      (h: unknown): h is string => typeof h === "string" && h.trim().length > 0 && !/["“”„«»]/.test(h)
    );
    return NextResponse.json({ hooks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not write hooks." }, { status: 500 });
  }
}
