import { NextRequest, NextResponse } from "next/server";
import { groqChatJson } from "@/lib/groq";
import { getTeaching, pickVariant, searchTeachings, isReelFit, type LangCode, type Teaching } from "@/lib/teachings";
import { buildQuoteBlock, auditScript, buildProvenance } from "@/lib/authenticity";
import { estimateSpokenSeconds, targetWordCount, TARGET_SECONDS } from "@/lib/duration";
import {
  buildScriptSystemPrompt,
  buildScriptUserPrompt,
  buildVisualsSystemPrompt,
  buildVisualsUserPrompt,
  checkScriptQuality,
  checkVisualPrompts,
  splitBudget,
} from "@/lib/prompts";
import { generateBelurQr } from "@/lib/qrcode";
import type { ReelScript, ReelVisuals, TeacherNote } from "@/features/reel/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "openai/gpt-oss-120b";
const MAX_STORY_ATTEMPTS = 3;
const MAX_VISUAL_ATTEMPTS = 3;
const PAUSE_SECONDS_TOTAL = 2.5; // silence between beats

const FALLBACK_SCENE = "Pre-dawn sky over an open field, soft mist, calm and empty, photorealistic, vertical 9:16, no text";

type Beats = { hook: string; situation: string; turn: string; takeaway: string };

function parseJson(text: string): any {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned);
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const isRateLimit = (err: unknown) => /rate-limited/i.test(err instanceof Error ? err.message : "");

interface WrittenStory {
  beats: Beats;
  teacherNote: TeacherNote;
  issues: string[];
}

/** Call 1: the spoken story and the classroom note, in the chosen language. */
async function writeStory(teaching: Teaching, language: LangCode, problem: string, apiKey: string, feedback: string[]): Promise<WrittenStory> {
  const { lang: quoteLang, variant } = pickVariant(teaching, language);

  // Whatever time the verbatim quote takes to read is subtracted from the beat budget.
  const quoteSeconds = estimateSpokenSeconds(variant.text, quoteLang);
  const storySeconds = Math.max(22, TARGET_SECONDS - quoteSeconds - PAUSE_SECONDS_TOTAL);
  const budget = splitBudget(targetWordCount(language, storySeconds));

  const content = await groqChatJson({
    apiKey,
    messages: [
      { role: "system", content: buildScriptSystemPrompt({ language, quoteText: variant.text, quoteLang, topics: teaching.topics, budget }) },
      { role: "user", content: buildScriptUserPrompt({ problem, topics: teaching.topics, feedback }) },
    ],
    temperature: 0.75,
    // Hindi prose needs real thinking, but the reasoning counts against max_tokens: medium leaves room to answer.
    reasoningEffort: "medium",
    maxTokens: 3500,
  });
  const parsed = parseJson(content);

  const beats = { hook: str(parsed.hook), situation: str(parsed.situation), turn: str(parsed.turn), takeaway: str(parsed.takeaway) };
  if (Object.values(beats).some((b) => !b)) throw new Error("Model omitted a beat.");
  const safeBeats = beats as Beats;

  const tn = parsed.teacherNote ?? {};
  return {
    beats: safeBeats,
    teacherNote: {
      keyIdea: str(tn.keyIdea) ?? "",
      discussionQuestion: str(tn.discussionQuestion) ?? "",
      classroomActivity: str(tn.classroomActivity) ?? "",
    },
    issues: checkScriptQuality(safeBeats, language, budget),
  };
}

function toVisuals(parsed: any): ReelVisuals {
  const scene = (key: string) => str(parsed?.[key]) ?? FALLBACK_SCENE;
  return {
    protagonist: str(parsed?.protagonist) ?? undefined,
    hook: scene("hook"),
    situation: scene("situation"),
    turn: scene("turn"),
    quote: scene("quote"),
    takeaway: scene("takeaway"),
    motion: str(parsed?.motion) ?? "Slow smooth push-in, gentle natural motion, golden light, no cuts, no text",
    stock: parsed?.stock && typeof parsed.stock === "object" ? parsed.stock : undefined,
  };
}

/** Call 2: English shot prompts for the finished story. Never fatal: a generic fallback keeps the reel going. */
async function writeVisuals(beats: Beats, teaching: Teaching, apiKey: string): Promise<{ visuals: ReelVisuals; issues: string[] }> {
  let best: { visuals: ReelVisuals; issues: string[] } | null = null;
  let feedback: string[] = [];

  for (let attempt = 0; attempt < MAX_VISUAL_ATTEMPTS; attempt++) {
    try {
      const content = await groqChatJson({
        apiKey,
        messages: [
          { role: "system", content: buildVisualsSystemPrompt() },
          { role: "user", content: buildVisualsUserPrompt({ beats, topics: teaching.topics, feedback }) },
        ],
        temperature: 0.6,
        reasoningEffort: "low",
        maxTokens: 2500,
      });
      const visuals = toVisuals(parseJson(content));
      const issues = checkVisualPrompts(visuals);
      if (!best || issues.length < best.issues.length) best = { visuals, issues };
      if (issues.length === 0) break;
      feedback = issues;
    } catch (err) {
      console.warn("Reel visuals attempt failed:", err instanceof Error ? err.message : err);
      // The story call just before this one often uses up the free per-minute budget.
      // Waiting once (the route allows 120s) beats falling back to generic scenes.
      const waitSeconds = Number(/try again in (\d+) second/i.exec(err instanceof Error ? err.message : "")?.[1]);
      if (isRateLimit(err) && waitSeconds > 0 && waitSeconds <= 45) {
        await new Promise((r) => setTimeout(r, (waitSeconds + 1) * 1000));
      } else if (isRateLimit(err)) {
        break;
      }
    }
  }

  return best ?? { visuals: toVisuals({}), issues: ["Image prompts could not be written; generic scenes are used."] };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { teachingId?: string; problem?: string; language?: LangCode };
    const language: LangCode = body.language ?? "hi";
    const problem = (body.problem ?? "").trim().slice(0, 600);

    // Pick the teaching: explicit id, else best verified match for the student's problem.
    let teaching: Teaching | null = body.teachingId ? getTeaching(body.teachingId) : null;
    if (!teaching && problem) teaching = searchTeachings(problem, 12).find(isReelFit) ?? null;
    if (!teaching) return NextResponse.json({ error: "Choose a verified teaching or describe your situation." }, { status: 400 });
    if (!isReelFit(teaching)) return NextResponse.json({ error: "That quotation is too long for a reel." }, { status: 400 });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY is not configured on the server." }, { status: 500 });

    const { lang: quoteLang } = pickVariant(teaching, language);
    let best: { script: ReelScript; teacherNote: TeacherNote; audit: ReturnType<typeof auditScript>; issues: string[] } | null = null;
    let feedback: string[] = [];

    for (let attempt = 0; attempt < MAX_STORY_ATTEMPTS; attempt++) {
      let written: WrittenStory;
      try {
        written = await writeStory(teaching, language, problem, apiKey, feedback);
      } catch (err) {
        // Retrying into a rate limit only burns more tokens. Keep the best script we already have;
        // only fail if there is nothing usable yet.
        if (isRateLimit(err)) {
          if (best) break;
          throw err;
        }
        if (attempt === MAX_STORY_ATTEMPTS - 1 && !best) throw err;
        continue;
      }

      const script: ReelScript = {
        teachingId: teaching.id,
        language,
        ...written.beats,
        quote: buildQuoteBlock(teaching, quoteLang), // assembled from the record, never generated
      };
      const audit = auditScript(script, teaching);

      // Authenticity problems always outrank style problems when choosing what to keep.
      const candidate = { script, teacherNote: written.teacherNote, audit, issues: written.issues };
      const score = (c: typeof candidate) => (c.audit.passed ? 0 : 100) + c.issues.length;
      if (!best || score(candidate) < score(best)) best = candidate;

      // Style problems earn ONE retry; authenticity failures keep retrying up to MAX_STORY_ATTEMPTS.
      if (audit.passed && (written.issues.length === 0 || attempt >= 1)) break;

      feedback = [
        ...written.issues,
        ...audit.fabricatedQuotations.map((q) => `You wrote a quotation (${q.slice(0, 60)}…). Remove it; write no quotations at all.`),
        ...audit.unattributedClaims.map(() => "You attributed words to Swami Vivekananda. Remove every such phrase."),
      ];
    }
    if (!best) return NextResponse.json({ error: "Script generation failed. Try again." }, { status: 502 });

    const { visuals, issues: visualIssues } = await writeVisuals(
      { hook: best.script.hook, situation: best.script.situation, turn: best.script.turn, takeaway: best.script.takeaway },
      teaching,
      apiKey
    );

    return NextResponse.json({
      script: best.script,
      visuals,
      teacherNote: best.teacherNote,
      audit: best.audit,
      qualityIssues: [...best.issues, ...visualIssues],
      provenance: buildProvenance(best.script, teaching, MODEL),
      qrDataUri: await generateBelurQr(teaching.sourceUrl),
      teaching,
    });
  } catch (error: any) {
    console.error("Reel script error:", error);
    return NextResponse.json({ error: error.message || "Script generation failed." }, { status: 500 });
  }
}
