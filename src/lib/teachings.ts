import fs from "fs";
import path from "path";
import { searchRelevantQuotes } from "./vectorSearch";

export type LangCode = "en" | "hi" | "bn" | "ta" | "te" | "mr" | "gu" | "kn";

export interface TeachingVariant {
  /** VERBATIM. Never edited, never regenerated. */
  text: string;
  author: string | null;
  sourceWork: string | null;
}

export interface Teaching {
  id: string;
  kind: "quotation" | "incident";
  topics: string[];
  sourceUrl: string;
  imageUrl: string | null;
  publishedAt: string | null;
  variants: Partial<Record<LangCode, TeachingVariant>>;
  primaryLang: LangCode;
  needsReview: boolean;
  reviewReasons: string[];
}

interface TeachingsFile {
  generatedAt: string;
  source: string;
  verified: Teaching[];
  quarantined: Teaching[];
}

let cache: TeachingsFile | null = null;

function load(): TeachingsFile {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "teachings.json");
  if (!fs.existsSync(file)) {
    throw new Error("data/teachings.json not found — run `python scripts/build_teachings.py` first.");
  }
  cache = JSON.parse(fs.readFileSync(file, "utf-8")) as TeachingsFile;
  return cache;
}

/** A quote is spoken verbatim, so only short ones fit a 30-60s reel (~12s of speech at 320 chars). */
export const MAX_REEL_QUOTE_CHARS = 320;

export function isReelFit(t: Teaching): boolean {
  const v = t.variants[t.primaryLang];
  return Boolean(v) && (v as TeachingVariant).text.length <= MAX_REEL_QUOTE_CHARS;
}

/** Only ever returns human-verifiable entries. Quarantined items are unreachable by design. */
export function listTeachings(filter?: {
  topic?: string;
  lang?: LangCode;
  limit?: number;
  reelFit?: boolean;
}): Teaching[] {
  let items = load().verified;
  if (filter?.reelFit) items = items.filter(isReelFit);
  if (filter?.topic) items = items.filter((t) => t.topics.includes(filter.topic as string));
  if (filter?.lang) items = items.filter((t) => Boolean(t.variants[filter.lang as LangCode]));
  return filter?.limit ? items.slice(0, filter.limit) : items;
}

export function getTeaching(id: string): Teaching | null {
  return load().verified.find((t) => t.id === id) ?? null;
}

/** Reuses the existing TF-IDF index, then maps hits back to verified teachings. */
export function searchTeachings(query: string, topK = 8): Teaching[] {
  const hits = searchRelevantQuotes(query, topK * 4);
  const out: Teaching[] = [];
  for (const hit of hits) {
    const teaching = getTeaching(String(hit.id));
    if (teaching && !out.some((t) => t.id === teaching.id)) out.push(teaching);
    if (out.length >= topK) break;
  }
  return out;
}

/** The variant to quote in a given language, falling back to the card's primary language. */
export function pickVariant(
  teaching: Teaching,
  lang: LangCode
): { lang: LangCode; variant: TeachingVariant } {
  const exact = teaching.variants[lang];
  if (exact) return { lang, variant: exact };
  const primary = teaching.variants[teaching.primaryLang];
  if (primary) return { lang: teaching.primaryLang, variant: primary };
  const first = Object.entries(teaching.variants)[0] as [LangCode, TeachingVariant] | undefined;
  if (!first) throw new Error(`Teaching ${teaching.id} has no verified variants.`);
  return { lang: first[0], variant: first[1] };
}

export function allTopics(): { topic: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of load().verified) {
    for (const topic of t.topics) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);
}

export function quarantineCount(): number {
  return load().quarantined.length;
}
