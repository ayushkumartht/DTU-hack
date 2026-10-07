import type { Teaching, LangCode } from "./teachings";
import type {
  ReelScript,
  AuthenticityReport,
  ReelProvenance,
  VerifiedQuoteBlock,
} from "@/features/reel/types";

export const DISCLOSURE =
  "The story in this reel is an AI-written dramatisation. The quotation is reproduced verbatim from Belur Math.";

export const DISCLOSURE_HI =
  "यह कहानी AI द्वारा लिखी गई है। उद्धरण बेलूर मठ के स्रोत से हूबहू लिया गया है।";

/**
 * Canonical form for verbatim comparison: NFC-normalise, unify curly quotes and
 * dashes, collapse whitespace. Everything else — wording, punctuation, casing —
 * must match exactly. The ORIGINAL string is always what gets rendered.
 */
export function canonical(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function isVerbatim(candidate: string, source: string): boolean {
  return canonical(candidate) === canonical(source);
}

/** Throws rather than warns. A reel must not render if the quote drifted. */
export function assertVerbatim(block: VerifiedQuoteBlock, teaching: Teaching): void {
  const variant = teaching.variants[block.lang];
  if (!variant) {
    throw new Error(`No verified '${block.lang}' variant exists for teaching ${teaching.id}.`);
  }
  if (!isVerbatim(block.verbatimText, variant.text)) {
    throw new Error(
      `Quote integrity check FAILED for teaching ${teaching.id}: the rendered quote does not ` +
        `match the verified source. Refusing to render.`
    );
  }
}

/** Phrases that claim words belong to Vivekananda, across the scripts we support. */
const ATTRIBUTION_PATTERNS: RegExp[] = [
  /\b(?:swami\s*)?vivekananda\s+(?:once\s+)?(?:said|wrote|taught|declared|told|reminded)\b/i,
  /\bas\s+(?:swami\s*)?vivekananda\s+(?:said|put it|wrote)\b/i,
  /\bin\s+his\s+(?:own\s+)?words\b/i,
  /स्वामी\s*विवेकानन्द\s*ने\s*कहा/,
  /विवेकानन्द\s*जी\s*ने\s*कहा/,
  /স্বামী\s*বিবেকানন্দ\s*বলেছিলেন/,
  /স্বামী\s*বিবেকানন্দ\s*বলেন/,
];

/** Any quoted span in AI-written text is suspect unless it matches a verified variant. */
const QUOTED_SPANS: RegExp[] = [
  /“([^”]{12,})”/g, // “ ... ”
  /"([^"]{12,})"/g, // " ... "
  /«([^»]{12,})»/g, // « ... »
  /„([^“”]{12,})[“”]/g, // „ ... “
];

export function detectFabricatedQuotes(
  aiText: string,
  teaching: Teaching
): { fabricated: string[]; attributions: string[] } {
  const allowed = Object.values(teaching.variants).map((v) => canonical(v.text));

  const fabricated: string[] = [];
  for (const pattern of QUOTED_SPANS) {
    for (const match of aiText.matchAll(pattern)) {
      const span = (match[1] ?? "").trim();
      if (!span) continue;
      const c = canonical(span);
      const isKnown = allowed.some((a) => a === c || a.includes(c));
      if (!isKnown && !fabricated.includes(span)) fabricated.push(span);
    }
  }

  const attributions = ATTRIBUTION_PATTERNS.filter((re) => re.test(aiText)).map((re) => String(re));

  return { fabricated, attributions };
}

export function auditScript(script: ReelScript, teaching: Teaching): AuthenticityReport {
  const aiText = [script.hook, script.situation, script.turn, script.takeaway].join("\n");
  const { fabricated, attributions } = detectFabricatedQuotes(aiText, teaching);

  let quoteVerbatim = true;
  try {
    assertVerbatim(script.quote, teaching);
  } catch {
    quoteVerbatim = false;
  }

  return {
    quoteVerbatim,
    fabricatedQuotations: fabricated,
    unattributedClaims: attributions,
    translationIsOfficial: script.quote.officialTranslation,
    passed: quoteVerbatim && fabricated.length === 0 && attributions.length === 0,
  };
}

export function buildProvenance(script: ReelScript, teaching: Teaching, model: string): ReelProvenance {
  return {
    teachingId: teaching.id,
    sourceUrl: teaching.sourceUrl,
    verbatimQuote: script.quote.verbatimText,
    attribution: `${script.quote.author} — ${script.quote.sourceWork}`,
    language: script.language,
    model,
    generatedAt: new Date().toISOString(),
    disclosure: DISCLOSURE,
  };
}

/** Assembles the quote block from the verified record. The LLM never touches this. */
export function buildQuoteBlock(teaching: Teaching, lang: LangCode): VerifiedQuoteBlock {
  const variant = teaching.variants[lang];
  if (!variant) throw new Error(`No '${lang}' variant for teaching ${teaching.id}.`);
  return {
    teachingId: teaching.id,
    lang,
    verbatimText: variant.text,
    author: variant.author ?? "Swami Vivekananda",
    sourceWork: variant.sourceWork ?? "Belur Math",
    sourceUrl: teaching.sourceUrl,
    officialTranslation: lang !== teaching.primaryLang,
  };
}
