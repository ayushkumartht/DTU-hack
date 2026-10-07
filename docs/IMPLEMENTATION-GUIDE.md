# Implementation Guide — Teaching-to-Reel Generator

Step-by-step build instructions, from a cold machine to a demo-ready submission.
Companion to [PROJECT-PLAN.md](../PROJECT-PLAN.md), which explains *why*. This file is *how*.

**How to use this document**

- Steps are ordered. Each one ends in a **Verify** block — do not move on until it passes.
- Every file path is exact. Every command is copy-pasteable PowerShell (Windows).
- `▶ RUN` = execute in a terminal. `📄 CREATE` = new file. `✏️ EDIT` = change an existing file.
- Steps 0–7 are the critical path. Steps 8–13 make it a reel. Steps 14–18 make it survive a judge.

**Conventions used throughout**

- The existing `/story-board` flow stays working the whole time. The new flow is built at `/reel`.
  Never break a working demo mid-build.
- New code lives under `src/features/reel/`, `src/lib/` and `src/app/api/reel/`.
- Existing, proven modules are reused, not rewritten: `src/lib/groq.ts`, `src/lib/gradio.ts`,
  `src/lib/kokoro.ts`, `src/lib/segmentStory.ts`, `src/lib/vectorSearch.ts`.

---

## STEP 0 — Baseline, environment, and a safe branch

### 0.1 Verify the toolchain

▶ RUN
```powershell
node --version          # must be >= 20.9
npm --version
ffmpeg -version         # must print a version, not an error
ffprobe -version
python --version        # 3.9+ for the data scripts
git status
```

If `ffmpeg`/`ffprobe` are missing, narration will fail at Step 11. Install and reopen the terminal:

▶ RUN
```powershell
winget install Gyan.FFmpeg
```

### 0.2 Install and configure

▶ RUN
```powershell
npm install
Copy-Item .env.example .env -Force
```

✏️ EDIT `.env` — fill in both keys and keep both mocks ON for now:

```ini
GROQ_API_KEY=gsk_...          # https://console.groq.com/keys
HF_TOKEN=hf_...               # https://huggingface.co/settings/tokens
MOCK_SCENE_IMAGES=true
MOCK_SCENE_VIDEO=true
```

### 0.3 Confirm the existing prototype actually runs

▶ RUN
```powershell
npm run dev
```

Open <http://localhost:3000/story-board>, paste a sample situation, generate. You should see a
streamed story, four placeholder scene cards, and a working "Create video" button.

### 0.4 Branch

▶ RUN
```powershell
git checkout -b feat/teaching-to-reel
```

### ✅ Verify Step 0
- [ ] `ffmpeg -version` prints a version
- [ ] `npm run dev` serves `/` and `/story-board`
- [ ] A story generates end to end with mocks on
- [ ] You are on branch `feat/teaching-to-reel`

---

## STEP 1 — Rebuild the dataset into verified, per-language teachings

> **This is the most important step in the project, and the one with the biggest surprise in it.**

### 1.1 What is actually in `data/vivekananda_quotes.json`

The scraper stored each Belur Math card as a **single flat `quote` string**. Investigating the
real contents:

| Finding | Number |
|---|---|
| Records total | 147 |
| Records whose `quote` mixes **two or more scripts** (English + Bengali + Hindi concatenated) | **110** |
| Median `quote` length | **504 chars** (max 2,042) |
| Records where a simple "trailing citation" regex works | only 96 / 147 |
| Empty `quote` | 1 |

So the field currently used as "the verified quotation" is frequently a 500–2,000 character blob
containing **the same teaching in two or three languages, each with its own citation**. That blob
is what is being fed to the LLM and the TTS today. This is the root cause of the authenticity
problem — there is no single "the quote" to be verbatim *about*.

### 1.2 The good news

`raw_html` preserves Belur Math's own block structure perfectly:

```html
<hr/>
<p>The aim of the Sangha is to preach those truths which Shri Ramakrishna has ...</p>
<p><strong>Swami Vivekananda</strong></p>
<p>(Resolution of Ramakrishna Mission, 2nd Meeting, 5 May 1897;<br>The Life of Swami Vivekananda, Vol 2)</p>
<hr/>
<p>মানবের হিতার্থ শ্রীরামকৃষ্ণ যে সকল তত্ত্ব ব্যাখ্যা করিয়াছেন ...</p>
<p><strong>স্বামী বিবেকানন্দ</strong></p>
<p>(রামকৃষ্ণ-সঙ্ঘ-স্থাপন, ২য় সভা, ৫ই মে ১৮৯৭;<br>যুগনায়ক বিবেকানন্দ, ৩য় খণ্ড)</p>
<hr/>
```

Structure coverage across the dataset: 133/147 contain `<hr>` separators, 121/147 contain the
`<strong>` author line, and block counts are `{1 block: 64, 2 blocks: 79, 3 blocks: 3}`.

**This means Belur Math already publishes official Bengali and Hindi renderings of these
teachings.** That is a direct, enormous win for requirement #11: regional language reels can use
the **official translation**, not a machine translation — so the quotation stays verifiably
authentic in every language the card provides. Build on this; it is the strongest authenticity
asset the project has.

### 1.3 The parser

📄 CREATE `scripts/build_teachings.py`

```python
#!/usr/bin/env python3
"""
Build data/teachings.json from data/vivekananda_quotes.json.

Each Belur Math card contains the same teaching in 1-3 languages, separated by
<hr> in raw_html, each language block shaped as:

    <p>quote text</p>
    <p><strong>Author</strong></p>
    <p>(citation)</p>

This splits every card into per-language variants with their own verbatim text
and their own citation, tags topics, and QUARANTINES anything that does not
parse cleanly (needs_review=True) instead of guessing. Nothing quarantined is
ever shown as a verified teaching.
"""

import json
import re
import html
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "vivekananda_quotes.json"
OUT = ROOT / "data" / "teachings.json"

HR = re.compile(r"<hr[^>]*/?>", re.I)
P_TAG = re.compile(r"<p[^>]*>(.*?)</p>", re.I | re.S)
TAG = re.compile(r"<[^>]+>")
STRONG = re.compile(r"<strong>(.*?)</strong>", re.I | re.S)

BENGALI = re.compile(r"[ঀ-৿]")
DEVANAGARI = re.compile(r"[ऀ-ॿ]")
LATIN = re.compile(r"[A-Za-z]{3,}")

# Author strings that count as Swami Vivekananda himself, per script.
VIVEK_AUTHOR = re.compile(
    r"(swami\s*vivekananda|স্বামী\s*বিবেকানন্দ|स्वामी\s*विवेकानन्द|swami\s*vivekanand)",
    re.I,
)

TOPIC_KEYWORDS = {
    "courage":         ["courage", "brave", "bold", "fearless", "dare", "heroic", "lion"],
    "fearlessness":    ["fear", "fearless", "abhih", "no fear", "afraid"],
    "self-confidence": ["faith in yourself", "self-confidence", "believe in yourself",
                        "confidence", "self-reliance", "trust in yourself", "strength of mind"],
    "strength":        ["strength", "strong", "weakness", "weak", "power", "energy", "vigour"],
    "concentration":   ["concentration", "concentrate", "focus", "attention", "mind",
                        "meditation", "steady", "one-pointed"],
    "education":       ["education", "teacher", "student", "learn", "knowledge", "study",
                        "school", "guru", "disciple"],
    "service":         ["service", "serve", "help", "poor", "humanity", "others", "work",
                        "selfless", "daridra"],
    "faith":           ["faith", "belief", "god", "divine", "soul", "spiritual", "religion"],
}


def clean(fragment: str) -> str:
    """HTML fragment -> clean text, preserving <br> as spaces."""
    text = re.sub(r"<br\s*/?>", " ", fragment, flags=re.I)
    text = TAG.sub("", text)
    text = html.unescape(text)
    text = unicodedata.normalize("NFC", text)
    return re.sub(r"\s+", " ", text).strip()


def detect_lang(text: str) -> str:
    if BENGALI.search(text):
        return "bn"
    if DEVANAGARI.search(text):
        return "hi"
    if LATIN.search(text):
        return "en"
    return "unknown"


def is_citation(text: str) -> bool:
    t = text.strip()
    return t.startswith("(") and t.endswith(")") and len(t) > 4


def parse_block(block_html: str):
    """One <hr>-delimited language block -> a variant dict, or None."""
    paras = P_TAG.findall(block_html)
    if not paras:
        return None

    quote_parts, author, source_work = [], None, None

    for raw in paras:
        strong = STRONG.search(raw)
        text = clean(raw)
        if not text:
            continue
        if strong and len(clean(strong.group(1))) > 3 and len(text) < 90:
            author = clean(strong.group(1))
            continue
        if is_citation(text):
            source_work = text.strip("()").strip()
            continue
        quote_parts.append(text)

    quote = " ".join(quote_parts).strip()
    if not quote:
        return None

    return {
        "lang": detect_lang(quote),
        "text": quote,
        "author": author,
        "sourceWork": source_work,
    }


def assign_topics(variants) -> list:
    """Classify on the English variant where available; share across all
    variants of the same card, since they are the same teaching."""
    english = next((v["text"] for v in variants if v["lang"] == "en"), "")
    haystack = english.lower()
    topics = [t for t, kws in TOPIC_KEYWORDS.items()
              if any(k in haystack for k in kws)]
    return topics or ["faith"]


def build():
    records = json.loads(SRC.read_text(encoding="utf-8"))
    teachings, quarantined = [], []

    for rec in records:
        raw = rec.get("raw_html") or ""
        blocks = [b for b in HR.split(raw) if clean(b)]
        variants = [v for v in (parse_block(b) for b in blocks) if v]

        reasons = []
        if not variants:
            reasons.append("no parseable language block")
        for v in variants:
            if not v["sourceWork"]:
                reasons.append(f"missing citation for '{v['lang']}' variant")
            if v["author"] and not VIVEK_AUTHOR.search(v["author"]):
                reasons.append(f"author is '{v['author']}', not Swami Vivekananda")
            if v["lang"] == "unknown":
                reasons.append("could not detect language")

        entry = {
            "id": str(rec["id"]),
            "kind": "quotation",
            "topics": assign_topics(variants) if variants else [],
            "sourceUrl": rec.get("link", ""),
            "imageUrl": rec.get("image_url"),
            "publishedAt": rec.get("date"),
            "variants": {v["lang"]: {"text": v["text"],
                                     "author": v["author"],
                                     "sourceWork": v["sourceWork"]}
                         for v in variants if v["lang"] != "unknown"},
            "primaryLang": "en" if any(v["lang"] == "en" for v in variants)
                           else (variants[0]["lang"] if variants else "unknown"),
            "needsReview": bool(reasons),
            "reviewReasons": sorted(set(reasons)),
        }

        (quarantined if entry["needsReview"] else teachings).append(entry)

    payload = {
        "generatedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "source": "https://media.belurmath.org/tag/quotations/",
        "verified": teachings,
        "quarantined": quarantined,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    langs = {}
    for t in teachings:
        for code in t["variants"]:
            langs[code] = langs.get(code, 0) + 1

    print(f"verified   : {len(teachings)}")
    print(f"quarantined: {len(quarantined)}")
    print(f"variants   : {langs}")
    print(f"written    : {OUT}")


if __name__ == "__main__":
    build()
```

▶ RUN
```powershell
python scripts/build_teachings.py
```

### 1.4 Review the quarantine — by hand, once

Quarantined records are **not bugs to suppress**. They include genuinely tricky cases found in
the data: hymns composed *by* Vivekananda (stotras), verses written *about* him by Swami
Ramakrishnananda, and at least one scripture citation (Manusmriti). Presenting any of those as
"a quotation from Swami Vivekananda" would be exactly the failure the case study warns about.

▶ RUN
```powershell
node -e "const d=require('./data/teachings.json'); d.quarantined.forEach(q=>console.log(q.id, '|', q.reviewReasons.join('; '), '|', q.sourceUrl));"
```

Walk the list. For each, either fix the parser, hand-correct the entry, or leave it quarantined.
**Keep the quarantine count visible in your pitch** — "we excluded N items we could not verify"
is a far stronger claim than "we have 147 quotes."

### 1.5 Actual results (executed)

Running the parser on the real data produced:

| Metric | Result |
|---|---|
| Verified teachings | **87** |
| Quarantined (with stated reason each) | **60** |
| Verified with English text | 86 |
| Verified with an **official Bengali** pair on the same card | **65** |
| Verified with Hindi | 1 |

**Correction to §1.2:** the official-translation win is real for **Bengali**, not Hindi. The 90
"Devanagari" records in the raw data are mostly Sanskrit hymns with English translations mixed
into one block, and were quarantined. Plan for Hindi (and Tamil/Telugu/etc.) as a *labelled
working translation* of the English quote — never presented as the official text.

The builder also rejects cards where citation text leaks into the quotation body, where a Bengali/Hindi
variant mixes in English, and where the text is a hymn or verse rather than his own quotation.

### ✅ Verify Step 1
- [ ] `data/teachings.json` exists with `verified` and `quarantined` arrays
- [ ] Every verified entry has a non-empty `sourceUrl` and at least one variant with a `sourceWork`
- [ ] `variants` shows real counts for `en`, `bn`, and/or `hi`
- [ ] You have personally read the quarantine list

---

## STEP 2 — The teachings library module

📄 CREATE `src/lib/teachings.ts`

```ts
import fs from "fs";
import path from "path";
import { searchRelevantQuotes } from "./vectorSearch";

export type LangCode = "en" | "hi" | "bn" | "ta" | "te" | "mr" | "gu" | "kn";

export interface TeachingVariant {
  text: string;            // VERBATIM. Never edited, never regenerated.
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

/** Only ever returns human-verifiable entries. Quarantined items are unreachable by design. */
export function listTeachings(filter?: { topic?: string; lang?: LangCode; limit?: number }): Teaching[] {
  let items = load().verified;
  if (filter?.topic) items = items.filter((t) => t.topics.includes(filter.topic!));
  if (filter?.lang) items = items.filter((t) => Boolean(t.variants[filter.lang!]));
  return filter?.limit ? items.slice(0, filter.limit) : items;
}

export function getTeaching(id: string): Teaching | null {
  return load().verified.find((t) => t.id === id) ?? null;
}

/** Reuses the existing TF-IDF index, then maps hits back to verified teachings. */
export function searchTeachings(query: string, topK = 8): Teaching[] {
  const hits = searchRelevantQuotes(query, topK * 2);
  const out: Teaching[] = [];
  for (const hit of hits) {
    const teaching = getTeaching(String(hit.id));
    if (teaching && !out.some((t) => t.id === teaching.id)) out.push(teaching);
    if (out.length >= topK) break;
  }
  return out;
}

/** The variant to quote in a given language, falling back to the card's primary language. */
export function pickVariant(teaching: Teaching, lang: LangCode): { lang: LangCode; variant: TeachingVariant } {
  const exact = teaching.variants[lang];
  if (exact) return { lang, variant: exact };
  const primary = teaching.variants[teaching.primaryLang];
  if (primary) return { lang: teaching.primaryLang, variant: primary };
  const [code, variant] = Object.entries(teaching.variants)[0] as [LangCode, TeachingVariant];
  return { lang: code, variant };
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
```

### ✅ Verify Step 2
▶ RUN
```powershell
npx tsc --noEmit
```
No errors in `src/lib/teachings.ts`.

---

## STEP 3 — Reel types

📄 CREATE `src/features/reel/types.ts`

```ts
import type { LangCode } from "@/lib/teachings";

/** The quote block. NOT generated — assembled from a verified Teaching record. */
export interface VerifiedQuoteBlock {
  teachingId: string;
  lang: LangCode;
  verbatimText: string;
  author: string;
  sourceWork: string;
  sourceUrl: string;
  /** True when the displayed language is an official Belur Math rendering from the same card. */
  officialTranslation: boolean;
}

/** 3-Act Student Reel script. Every field is AI-written EXCEPT `quote`. */
export interface ReelScript {
  teachingId: string;
  language: LangCode;
  // Act 1: Hook & Student Pain (0s - 10s)
  act1_hook: string;
  act1_situation: string;
  // Act 2: Wisdom Story & Wan 2.1 Motion (10s - 23s)
  act2_wisdom: string;
  act2_wanPrompt: string;
  // Act 3: Takeaway & Belur Math QR Code (23s - 35s)
  act3_takeaway: string;
  quote: VerifiedQuoteBlock;
  qrDataUrl?: string;
}

export type ActId = "act1_hook" | "act2_wisdom" | "act3_conclusion";
export const ACT_ORDER: ActId[] = ["act1_hook", "act2_wisdom", "act3_conclusion"];

export interface ReelBeat {
  id: ActId;
  /** The words spoken/shown for this act. */
  text: string;
  /** True for Act 3 quotation — renders verbatim and is never regenerated. */
  verified: boolean;
  visualPrompt: string;
  visualUrl: string | null;
  videoClipUrl?: string | null;
  status: "pending" | "generating" | "done" | "error";
  error?: string;
  durationInSeconds: number;
}

export interface AuthenticityReport {
  quoteVerbatim: boolean;
  fabricatedQuotations: string[];
  unattributedClaims: string[];
  translationIsOfficial: boolean;
  passed: boolean;
}

export interface ReelProvenance {
  teachingId: string;
  sourceUrl: string;
  verbatimQuote: string;
  attribution: string;
  language: LangCode;
  model: string;
  generatedAt: string;
  disclosure: string;
}
```

---

## STEP 4 — The authenticity engine (the graded differentiator)

📄 CREATE `src/lib/authenticity.ts`

```ts
import type { Teaching, LangCode } from "./teachings";
import type { ReelScript, AuthenticityReport, ReelProvenance, VerifiedQuoteBlock } from "@/features/reel/types";

export const DISCLOSURE =
  "The story in this reel is an AI-written dramatisation. The quotation is reproduced verbatim from Belur Math.";

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
const QUOTED_SPAN = /[""„«“]([^""»”]{12,})[""»”]|"([^"]{12,})"/g;

export function detectFabricatedQuotes(
  aiText: string,
  teaching: Teaching
): { fabricated: string[]; attributions: string[] } {
  const allowed = Object.values(teaching.variants).map((v) => canonical(v.text));

  const fabricated: string[] = [];
  for (const match of aiText.matchAll(QUOTED_SPAN)) {
    const span = (match[1] ?? match[2] ?? "").trim();
    if (!span) continue;
    const c = canonical(span);
    const isKnown = allowed.some((a) => a === c || a.includes(c));
    if (!isKnown) fabricated.push(span);
  }

  const attributions = ATTRIBUTION_PATTERNS
    .filter((re) => re.test(aiText))
    .map((re) => String(re));

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

export function buildProvenance(
  script: ReelScript,
  teaching: Teaching,
  model: string
): ReelProvenance {
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
```

### ✅ Verify Step 4
The quote block is built from the record, never parsed out of model output. Confirm by reading
`buildQuoteBlock` — there is no model call anywhere in this file. That property is the pitch.

---

## STEP 5 — Duration control (enforce 30–35s Student Reel)

📄 CREATE `src/lib/duration.ts`

```ts
import type { LangCode } from "./teachings";

export const MIN_SECONDS = 30;
export const MAX_SECONDS = 35;
export const TARGET_SECONDS = 32;

/**
 * 3-Act Student Reel Timing Targets:
 * Act 1 (Hook & Pain): 8 - 10s (approx 20-25 words)
 * Act 2 (Wan 2.1 Video & Wisdom): 13 - 15s (approx 35-40 words)
 * Act 3 (Conclusion & Belur Math QR): 10 - 12s (approx 22-26 words)
 */
export const ACT_TARGETS = {
  act1_hook: { min: 8, max: 10, target: 9 },
  act2_wisdom: { min: 13, max: 15, target: 14 },
  act3_conclusion: { min: 9, max: 12, target: 10 },
};

/** Measured speaking rates, words per minute, per language. */
const WPM: Record<string, number> = {
  en: 165, hi: 140, bn: 140, ta: 130, te: 130, mr: 140, gu: 140, kn: 130,
};

export function estimateSpokenSeconds(text: string, lang: LangCode): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return (words / (WPM[lang] ?? 150)) * 60;
}

export function targetWordCount(lang: LangCode, seconds = TARGET_SECONDS): number {
  return Math.round(((WPM[lang] ?? 150) / 60) * seconds);
}

export interface DurationFit {
  totalSeconds: number;
  inRange: boolean;
  /** Playback speed to apply so the total lands inside the 30-35s window. Clamped to [0.85, 1.2]. */
  suggestedSpeed: number;
  advice: "ok" | "too-short" | "too-long";
}

export function fitToWindow(perBeatSeconds: number[]): DurationFit {
  const total = perBeatSeconds.reduce((a, b) => a + b, 0);
  if (total >= MIN_SECONDS && total <= MAX_SECONDS) {
    return { totalSeconds: total, inRange: true, suggestedSpeed: 1, advice: "ok" };
  }
  const raw = total / (total > MAX_SECONDS ? MAX_SECONDS : MIN_SECONDS);
  const speed = Math.min(1.2, Math.max(0.85, Number(raw.toFixed(3))));
  const adjusted = total / speed;
  return {
    totalSeconds: adjusted,
    inRange: adjusted >= MIN_SECONDS && adjusted <= MAX_SECONDS,
    suggestedSpeed: speed,
    advice: total > MAX_SECONDS ? "too-long" : "too-short",
  };
}
```

---

## STEP 6 — Language registry

📄 CREATE `src/lib/i18n/languages.ts`

```ts
import type { LangCode } from "../teachings";

export interface LanguageDef {
  code: LangCode;
  englishName: string;
  nativeName: string;
  /** Google Fonts family that covers this script — must be loaded in Remotion. */
  font: string;
  /** Set once a TTS provider is confirmed for this language. */
  ttsReady: boolean;
}

export const LANGUAGES: LanguageDef[] = [
  { code: "en", englishName: "English", nativeName: "English",  font: "Noto Serif",             ttsReady: true  },
  { code: "hi", englishName: "Hindi",   nativeName: "हिन्दी",    font: "Noto Sans Devanagari",   ttsReady: false },
  { code: "bn", englishName: "Bengali", nativeName: "বাংলা",     font: "Noto Sans Bengali",      ttsReady: false },
  { code: "ta", englishName: "Tamil",   nativeName: "தமிழ்",     font: "Noto Sans Tamil",        ttsReady: false },
  { code: "te", englishName: "Telugu",  nativeName: "తెలుగు",    font: "Noto Sans Telugu",       ttsReady: false },
  { code: "mr", englishName: "Marathi", nativeName: "मराठी",     font: "Noto Sans Devanagari",   ttsReady: false },
  { code: "gu", englishName: "Gujarati",nativeName: "ગુજરાતી",   font: "Noto Sans Gujarati",     ttsReady: false },
  { code: "kn", englishName: "Kannada", nativeName: "ಕನ್ನಡ",     font: "Noto Sans Kannada",      ttsReady: false },
];

export function getLanguage(code: LangCode): LanguageDef {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
```

> **Spike this before Step 11.** Kokoro has no Indic voices. Evaluate, in order:
> AI4Bharat IndicTTS (Hugging Face Space), Sarvam AI, ElevenLabs multilingual.
> As each is confirmed working, flip its `ttsReady` to `true`. If none lands in time, the
> fallback is **English voiceover + regional on-screen subtitles**, which still partially
> satisfies the requirement — say so honestly rather than faking it.

---

## STEP 7 — API: browse and search teachings

📄 CREATE `src/app/api/reel/teachings/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { listTeachings, searchTeachings, allTopics, quarantineCount, type LangCode } from "@/lib/teachings";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const topic = searchParams.get("topic") ?? undefined;
  const lang = (searchParams.get("lang") as LangCode) ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? 24), 60);

  const teachings = q
    ? searchTeachings(q, limit)
    : listTeachings({ topic, lang, limit });

  return NextResponse.json({
    teachings,
    topics: allTopics(),
    stats: { verified: listTeachings().length, quarantined: quarantineCount() },
  });
}
```

### ✅ Verify Step 7
▶ RUN (with `npm run dev` running in another terminal)
```powershell
curl.exe "http://localhost:3000/api/reel/teachings?topic=courage&limit=3"
curl.exe "http://localhost:3000/api/reel/teachings?q=fear%20of%20speaking"
```
Both return JSON with a `teachings` array and a `stats` object.

---

## STEP 8 — API: generate the reel script

📄 CREATE `src/app/api/reel/script/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { groqChatJson } from "@/lib/groq";
import { getTeaching, pickVariant, type LangCode } from "@/lib/teachings";
import { buildQuoteBlock, auditScript, buildProvenance } from "@/lib/authenticity";
import { targetWordCount } from "@/lib/duration";
import type { ReelScript } from "@/features/reel/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "openai/gpt-oss-120b";

const GUARDRAIL = `
ABSOLUTE RULES — violating any of these invalidates your entire output:
1. You are writing an ORIGINAL, MODERN dramatisation. You are NOT reproducing historical text.
2. NEVER write a sentence attributed to Swami Vivekananda. Do not write "Vivekananda said",
   "as he taught", "in his words", or any equivalent in any language.
3. NEVER use quotation marks anywhere in your output.
4. Do NOT paraphrase, rephrase, or restate the teaching as if it were his wording.
   The verified quotation is inserted separately by the system — you never write it.
5. Write about a believable PRESENT-DAY Indian situation: a student, a first job, an exam,
   a hostel room, a crowded bus, a group chat. Concrete and specific, never abstract.
`.trim();

export async function POST(req: NextRequest) {
  try {
    const { teachingId, language = "en", audience } = (await req.json()) as {
      teachingId: string;
      language?: LangCode;
      audience?: string;
    };

    const teaching = teachingId ? getTeaching(teachingId) : null;
    if (!teaching) {
      return NextResponse.json({ error: "Unknown or unverified teaching id." }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GROQ_API_KEY is not configured on the server." }, { status: 500 });
    }

    const { lang: quoteLang, variant } = pickVariant(teaching, language);
    const budget = targetWordCount(language);

    const systemPrompt = `You write 30-60 second vertical reel scripts that bring a verified teaching of Swami Vivekananda to young Indian viewers.

${GUARDRAIL}

Write FOUR beats, in ${language === "en" ? "English" : `the ${language} language, in its own script`}:
- "hook": ONE line, max 12 words. It must stop a thumb mid-scroll. A question or a sharp image. No hashtags.
- "situation": 2-3 sentences. A specific modern scene showing the problem the teaching answers.
- "turn": 2-3 sentences. The moment something shifts. Lead the viewer toward the teaching WITHOUT stating it as his words.
- "takeaway": 1-2 sentences. ONE small concrete action the viewer can try today. Start with a verb.

All four beats together must total roughly ${budget} words — they will be read aloud.

The teaching being honoured (for your understanding only — DO NOT reproduce or paraphrase it):
"""
${variant.text}
"""

Respond with ONLY a raw JSON object: {"hook":"...","situation":"...","turn":"...","takeaway":"..."}`;

    const userPrompt = audience
      ? `Target viewer: ${audience}. Topics: ${teaching.topics.join(", ")}.`
      : `Target viewer: Indian students and young professionals, 16-26. Topics: ${teaching.topics.join(", ")}.`;

    const content = await groqChatJson({
      apiKey,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      maxTokens: 2500,
    });

    const beats = JSON.parse(stripFences(content)) as Record<string, string>;
    for (const key of ["hook", "situation", "turn", "takeaway"]) {
      if (typeof beats[key] !== "string" || !beats[key].trim()) {
        return NextResponse.json({ error: `Model omitted the "${key}" beat. Try again.` }, { status: 502 });
      }
    }

    const script: ReelScript = {
      teachingId: teaching.id,
      language,
      hook: beats.hook.trim(),
      situation: beats.situation.trim(),
      turn: beats.turn.trim(),
      quote: buildQuoteBlock(teaching, quoteLang),   // assembled, never generated
      takeaway: beats.takeaway.trim(),
    };

    const audit = auditScript(script, teaching);
    if (!audit.passed) {
      // Surface it rather than silently shipping it. The UI offers "regenerate".
      return NextResponse.json(
        { script, audit, provenance: buildProvenance(script, teaching, MODEL), warning: "Authenticity audit failed." },
        { status: 200 }
      );
    }

    return NextResponse.json({
      script,
      audit,
      provenance: buildProvenance(script, teaching, MODEL),
    });
  } catch (error: any) {
    console.error("Reel script error:", error);
    return NextResponse.json({ error: error.message || "Script generation failed." }, { status: 500 });
  }
}

function stripFences(text: string): string {
  const cleaned = text.replace(/```json/gi, "```").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;
}
```

### ✅ Verify Step 8
▶ RUN
```powershell
$id = (curl.exe -s "http://localhost:3000/api/reel/teachings?topic=courage&limit=1" | ConvertFrom-Json).teachings[0].id
curl.exe -s -X POST "http://localhost:3000/api/reel/script" -H "Content-Type: application/json" -d "{\"teachingId\":\"$id\",\"language\":\"en\"}"
```
- [ ] `script.quote.verbatimText` is byte-identical to the dataset entry
- [ ] `audit.passed` is `true`
- [ ] No quotation marks appear in `hook`, `situation`, `turn`, `takeaway`

Deliberately break it once, to prove the guardrail works: temporarily edit `buildQuoteBlock` to
append a character to `verbatimText`, re-run, confirm `audit.quoteVerbatim` is `false`, then
revert. **This is the demo moment.**

---

## STEP 9 — API: hook variants

📄 CREATE `src/app/api/reel/hooks/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { groqChatJson } from "@/lib/groq";
import { getTeaching, pickVariant, type LangCode } from "@/lib/teachings";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { teachingId, language = "en" } = (await req.json()) as { teachingId: string; language?: LangCode };
  const teaching = teachingId ? getTeaching(teachingId) : null;
  if (!teaching) return NextResponse.json({ error: "Unknown teaching id." }, { status: 400 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY is not configured." }, { status: 500 });

  const { variant } = pickVariant(teaching, language);

  const content = await groqChatJson({
    apiKey,
    messages: [
      {
        role: "system",
        content: `Write 5 competing opening lines for a vertical reel. Each is ONE line, max 12 words, designed to stop a scroll in under 3 seconds. Mix forms: a question, a blunt statement, a specific image, a contradiction, a direct address.
NEVER use quotation marks. NEVER attribute anything to Swami Vivekananda. These are original lines, not quotations.
Write in ${language === "en" ? "English" : `the ${language} language, in its own script`}.
Respond with ONLY {"hooks":["...","...","...","...","..."]}.`,
      },
      { role: "user", content: `Theme: ${teaching.topics.join(", ")}.\nTeaching (context only, do not reproduce):\n${variant.text}` },
    ],
    temperature: 0.95,
    maxTokens: 1200,
  });

  const parsed = JSON.parse(content.replace(/```json/gi, "").replace(/```/g, "").trim());
  const hooks = (parsed.hooks ?? []).filter((h: unknown): h is string => typeof h === "string" && h.trim().length > 0);

  return NextResponse.json({ hooks });
}
```

---

## STEP 10 — The reel UI

### 10.1 Teaching picker

📄 CREATE `src/features/reel/components/TeachingPicker.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/arc/badge/badge";
import type { Teaching } from "@/lib/teachings";
import styles from "./TeachingPicker.module.css";

interface Props {
  onSelect: (teaching: Teaching) => void;
}

export function TeachingPicker({ onSelect }: Props) {
  const [teachings, setTeachings] = useState<Teaching[]>([]);
  const [topics, setTopics] = useState<{ topic: string; count: number }[]>([]);
  const [stats, setStats] = useState<{ verified: number; quarantined: number } | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    else if (topic) params.set("topic", topic);
    params.set("limit", "24");

    setLoading(true);
    fetch(`/api/reel/teachings?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setTeachings(d.teachings ?? []);
        setTopics(d.topics ?? []);
        setStats(d.stats ?? null);
      })
      .finally(() => setLoading(false));
  }, [topic, query]);

  return (
    <section className={styles.picker}>
      <header className={styles.header}>
        <h2>Choose a verified teaching</h2>
        {stats && (
          <p className={styles.stats}>
            {stats.verified} verified from Belur Math · {stats.quarantined} excluded pending review
          </p>
        )}
      </header>

      <input
        className={styles.search}
        placeholder="Search a theme — fear of speaking, giving up, concentration…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className={styles.topics}>
        <button className={!topic ? styles.topicActive : styles.topic} onClick={() => setTopic(null)}>
          All
        </button>
        {topics.map((t) => (
          <button
            key={t.topic}
            className={topic === t.topic ? styles.topicActive : styles.topic}
            onClick={() => setTopic(t.topic)}
          >
            {t.topic} <span className={styles.count}>{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className={styles.loading}>Loading teachings…</p>
      ) : (
        <ul className={styles.grid}>
          {teachings.map((t) => {
            const variant = t.variants[t.primaryLang];
            return (
              <li key={t.id} className={styles.card}>
                <blockquote className={styles.quote}>{variant?.text}</blockquote>
                <p className={styles.source}>{variant?.sourceWork}</p>
                <div className={styles.cardFooter}>
                  <div className={styles.langs}>
                    {Object.keys(t.variants).map((code) => (
                      <Badge key={code}>{code.toUpperCase()}</Badge>
                    ))}
                  </div>
                  <a className={styles.link} href={t.sourceUrl} target="_blank" rel="noreferrer">
                    Source ↗
                  </a>
                </div>
                <Button onClick={() => onSelect(t)}>Make a reel</Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

📄 CREATE `src/features/reel/components/TeachingPicker.module.css` — follow the patterns in
[src/features/story/components/StoryForm.module.css](../src/features/story/components/StoryForm.module.css);
this project uses CSS Modules with the Arc CSS variables, **not** Tailwind utility classes.

### 10.2 Authenticity panel — show the judges the guardrail

📄 CREATE `src/features/reel/components/AuthenticityPanel.tsx`

```tsx
"use client";

import { Alert } from "@/components/arc/alert/alert";
import type { AuthenticityReport } from "../types";
import type { VerifiedQuoteBlock } from "../types";
import styles from "./AuthenticityPanel.module.css";

export function AuthenticityPanel({
  report,
  quote,
}: {
  report: AuthenticityReport;
  quote: VerifiedQuoteBlock;
}) {
  return (
    <section className={styles.panel}>
      <h3 className={styles.title}>Authenticity</h3>

      <ul className={styles.checks}>
        <Check ok={report.quoteVerbatim} label="Quotation is verbatim from the verified source" />
        <Check ok={report.fabricatedQuotations.length === 0} label="No invented quotations in the narrative" />
        <Check ok={report.unattributedClaims.length === 0} label="Nothing is attributed to Swami Vivekananda but the quotation" />
        <Check
          ok
          label={
            report.translationIsOfficial
              ? "Shown in an official Belur Math translation from the same source card"
              : "Shown in the source's original language"
          }
        />
      </ul>

      <dl className={styles.provenance}>
        <dt>Quotation</dt>
        <dd className={styles.verbatim}>{quote.verbatimText}</dd>
        <dt>Attribution</dt>
        <dd>{quote.author} — {quote.sourceWork}</dd>
        <dt>Source</dt>
        <dd><a href={quote.sourceUrl} target="_blank" rel="noreferrer">{quote.sourceUrl}</a></dd>
      </dl>

      {!report.passed && (
        <Alert variant="error">
          This script failed the authenticity audit and cannot be rendered. Regenerate it.
          {report.fabricatedQuotations.length > 0 && (
            <ul>{report.fabricatedQuotations.map((f, i) => <li key={i}>Invented quotation: {f}</li>)}</ul>
          )}
        </Alert>
      )}

      <p className={styles.disclosure}>
        The story is an AI-written dramatisation. Only the quotation is Swami Vivekananda&apos;s own words.
      </p>
    </section>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? styles.pass : styles.fail}>
      <span aria-hidden>{ok ? "✓" : "✕"}</span> {label}
    </li>
  );
}
```

### 10.3 Script editor

📄 CREATE `src/features/reel/components/ScriptEditor.tsx` — five labelled beats. Four are
`<Textarea>`. **The quote beat is read-only**: render it in a visually locked card with a padlock,
the attribution line and the source link. There must be no code path that lets a user or a model
edit it.

### 10.4 The page

📄 CREATE `src/app/reel/page.tsx`

```tsx
import { ReelExperience } from "@/features/reel/components/ReelExperience";

export const metadata = {
  title: "Teaching to Reel — Swami Vivekananda",
  description: "Turn a verified teaching into an honest 30-60 second reel.",
};

export default function ReelPage() {
  return <ReelExperience />;
}
```

📄 CREATE `src/features/reel/components/ReelExperience.tsx` — the `"use client"` orchestrator,
modelled on the existing
[StoryExperience.tsx](../src/features/story/components/StoryExperience.tsx). State machine:

```
pick teaching → generate script → choose hook → edit beats → generate visuals
  → narrate → render → download
```

### ✅ Verify Step 10
- [ ] `/reel` loads, shows topic chips and teaching cards
- [ ] Selecting a teaching produces a 5-beat script
- [ ] The quote beat cannot be edited
- [ ] The authenticity panel is visible on screen, not hidden in a drawer

---

## STEP 11 — Visuals & Wan 2.1 Video Generation
 
The reel is visually anchored by **Wan 2.1** for Act 2's wisdom story, with static prompt generation for Act 1 and a calm backdrop for Act 3's quote & QR card.

📄 CREATE `src/lib/wanVideo.ts` — Client wrapper for the **Wan 2.1 Video Model** (Image-to-Video / Text-to-Video):

```ts
import { Client } from "@gradio/client";

// Wan 2.1 Video Space or API Endpoint (9:16 vertical framing)
const WAN_SPACE = "Wan-AI/Wan2.1-I2V-14B-480P";

export const WAN_CLIP_WIDTH = 576;
export const WAN_CLIP_HEIGHT = 1024;
export const WAN_CLIP_SECONDS = 5.0;

let wanClientPromise: Promise<Client> | null = null;

function connect(hfToken?: string): Promise<Client> {
  if (!wanClientPromise) {
    wanClientPromise = Client.connect(WAN_SPACE, hfToken ? { token: hfToken as `hf_${string}` } : {}).catch((err) => {
      wanClientPromise = null;
      throw err;
    });
  }
  return wanClientPromise;
}

export interface WanVideoResult {
  videoUrl: string | null;
  seed: number | null;
}

export async function generateWanClip(
  prompt: string,
  imageUrl?: string,
  hfToken?: string
): Promise<WanVideoResult> {
  const client = await connect(hfToken);
  
  const result = await client.predict("/generate", {
    prompt: `Cinematic 3D animation, photorealistic lighting, 8k, inspirational, smooth camera motion: ${prompt}`,
    negative_prompt: "low quality, blurry, distorted, jerky motion, unrealistic limbs",
    input_image: imageUrl ? { url: imageUrl } : null,
  });

  const data = result.data as [{ url?: string } | null, number];
  return {
    videoUrl: data?.[0]?.url ?? null,
    seed: typeof data?.[1] === "number" ? data[1] : null,
  };
}
```

📄 CREATE `src/app/api/reel/visuals/route.ts` — asks Groq for 3 act-specific prompts:
- **Act 1 (Student Pain):** Relatable student scenario prompt (late night study, dark room, overwhelmed with books).
- **Act 2 (Wan 2.1 3D Video):** Detailed Wan 2.1 cinematic motion prompt (character transition from self-doubt to unshakable inner power, golden dawn lighting, dynamic 3D camera pan).
- **Act 3 (Conclusion & QR Card):** Calm, clean, high-contrast backdrop suitable for overlaying the quotation text and scannable QR Code.

---

## STEP 12 — Narration, with a language fallback that is honest

✏️ EDIT `src/lib/kokoro.ts` → generalise into `src/lib/tts/index.ts`:

```ts
import type { LangCode } from "../teachings";
import { getLanguage } from "../i18n/languages";
import { generateNarrationMp3, type NarratorVoice } from "../kokoro";

export interface TtsRequest {
  segments: string[];
  lang: LangCode;
  voice: NarratorVoice;
  speed: number;
  outPath: string;
  hfToken?: string;
}

export interface TtsResult {
  mp3Path: string;
  durationInSeconds: number;
  segments: { text: string; durationInSeconds: number }[];
  /** True when we could not voice the requested language and fell back to English. */
  languageFallback: boolean;
  spokenLang: LangCode;
}

export async function synthesize(req: TtsRequest): Promise<TtsResult> {
  const lang = getLanguage(req.lang);

  if (lang.ttsReady && req.lang !== "en") {
    // TODO (Step 6 spike): route to the confirmed Indic provider here.
  }

  // Fallback: English voiceover. Subtitles still render in the chosen language.
  const result = await generateNarrationMp3(req.segments, req.outPath, {
    hfToken: req.hfToken,
    voice: req.voice,
    speed: req.speed,
  });

  return { ...result, languageFallback: req.lang !== "en", spokenLang: "en" };
}
```

> **Surface `languageFallback` in the UI.** "Voiceover in English; subtitles in Bengali" shown
> plainly is worth more than a silent substitution a judge discovers themselves.

📄 CREATE `src/app/api/reel/narration/route.ts` — same shape as the existing narration route, but
it narrates **the five beats directly** instead of re-deriving narration from prose. That removes
the second uncontrolled LLM rewrite entirely. The quote beat's narration text is
`script.quote.verbatimText` — passed through verbatim, never rewritten.

After measuring durations, apply `fitToWindow` from Step 5 and re-synthesise once at
`suggestedSpeed` if the total is outside 30–60s.

---

## STEP 13 — The Remotion reel composition

### 13.1 Fonts (do this first — otherwise Indic text renders as empty boxes)

▶ RUN
```powershell
npm install @remotion/google-fonts
```

📄 CREATE `src/remotion/fonts.ts`

```ts
import { loadFont as loadDevanagari } from "@remotion/google-fonts/NotoSansDevanagari";
import { loadFont as loadBengali } from "@remotion/google-fonts/NotoSansBengali";
import { loadFont as loadTamil } from "@remotion/google-fonts/NotoSansTamil";
import { loadFont as loadSerif } from "@remotion/google-fonts/NotoSerif";
import type { LangCode } from "@/lib/teachings";

const devanagari = loadDevanagari();
const bengali = loadBengali();
const tamil = loadTamil();
const serif = loadSerif();

export function fontFamilyFor(lang: LangCode): string {
  switch (lang) {
    case "hi":
    case "mr": return devanagari.fontFamily;
    case "bn": return bengali.fontFamily;
    case "ta": return tamil.fontFamily;
    default:   return serif.fontFamily;
  }
}
```

### 13.2 Components & Dynamic QR Code
 
📄 CREATE `src/lib/qrcode.ts` — High-res scannable QR Code generator for Belur Math archives:

```ts
import QRCode from "qrcode";

export async function generateBelurQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 2,
    color: {
      dark: "#0F0F0F",
      light: "#FFFFFF",
    },
    width: 320,
  });
}
```

📄 CREATE `src/remotion/components/SourceBadge.tsx` — persistent corner badge reading `belurmath.org`.

📄 CREATE `src/remotion/components/BelurQrCard.tsx` — High-impact bottom card containing the generated QR Code and CTA:

```tsx
import { Img } from "remotion";

export function BelurQrCard({ qrDataUrl, sourceUrl }: { qrDataUrl: string; sourceUrl: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      background: "rgba(15, 15, 15, 0.88)",
      backdropFilter: "blur(12px)",
      borderRadius: 20,
      padding: "16px 24px",
      border: "1px solid rgba(232, 195, 158, 0.4)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
      gap: 20,
      width: "88%",
      margin: "0 auto",
    }}>
      <Img src={qrDataUrl} style={{ width: 100, height: 100, borderRadius: 12 }} />
      <div style={{ color: "#FAF9F6", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#E8C39E" }}>Scan for Full Teaching</div>
        <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>Official Belur Math Archive</div>
        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>{sourceUrl.replace(/^https?:\/\//, "")}</div>
      </div>
    </div>
  );
}
```

📄 CREATE `src/remotion/components/QuoteCard.tsx` — Displays verbatim teaching + Belur Math QR Code in Act 3.

📄 CREATE `src/remotion/components/KineticSubtitle.tsx` — MrBeast/Alex Hormozi style high-impact 2-to-3 word kinetic captions for Act 1 and Act 2.

📄 CREATE `src/remotion/StudentReel.tsx` — 3-Act vertical video timeline (0s-10s Hook, 10s-23s Wan Video, 23s-35s Conclusion & QR Card).

📄 CREATE `src/remotion/components/EndCard.tsx` — final 3–5s: the takeaway line, the full
citation, `belurmath.org`, and the disclosure *"Dramatisation. The quotation is verbatim."*

📄 CREATE `src/remotion/components/PhraseSubtitle.tsx` — replaces the current static
[Subtitle](../src/remotion/StoryVideo.tsx#L43). Split each beat's text into 3–5-word phrases
timed across the beat, auto-fit the font size, cap at two lines, add a text outline for
legibility over bright frames, and respect a bottom safe area so platform UI does not cover it.

📄 CREATE `src/remotion/ReelVideo.tsx` — the five-beat timeline. Key difference from
`StoryVideo.tsx`: beat 4 renders `QuoteCard`, is **visually distinct**, and does **not** pan.

✏️ EDIT `src/remotion/Root.tsx` — register a second `<Composition id="ReelVideo">` alongside the
existing `StoryVideo`. Do not replace it; the old flow must keep working.

### ✅ Verify Step 13
▶ RUN
```powershell
npx remotion studio src/remotion/index.ts
```
- [ ] `ReelVideo` appears in the sidebar
- [ ] The quote card renders Bengali/Hindi text as real glyphs, **not** `□□□` boxes
- [ ] The source badge is visible on every frame
- [ ] Total duration shows between 30 and 60 seconds

---

## STEP 14 — Render, export and the provenance sidecar

📄 CREATE `src/app/api/reel/render/route.ts` — modelled on the existing
[video route](../src/app/api/story/video/route.ts). Two additions:

1. **Re-run `assertVerbatim` server-side immediately before `renderMedia`.** The client cannot be
   trusted. If it throws, return `422` and render nothing.
2. Write `public/generated/reel-<uuid>.json` next to the MP4, containing the `ReelProvenance`.

📄 CREATE `src/lib/subtitles.ts`

```ts
export interface SubtitleCue { startSeconds: number; endSeconds: number; text: string; }

function stamp(seconds: number, comma: boolean): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${comma ? "," : "."}${pad(ms, 3)}`;
}

export function toSRT(cues: SubtitleCue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${stamp(c.startSeconds, true)} --> ${stamp(c.endSeconds, true)}\n${c.text}\n`)
    .join("\n");
}

export function toVTT(cues: SubtitleCue[]): string {
  const body = cues
    .map((c) => `${stamp(c.startSeconds, false)} --> ${stamp(c.endSeconds, false)}\n${c.text}\n`)
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

/** Splits a beat's text into evenly-timed phrase cues of `wordsPerCue` words. */
export function buildCues(text: string, startSeconds: number, durationSeconds: number, wordsPerCue = 4): SubtitleCue[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const groups: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerCue) {
    groups.push(words.slice(i, i + wordsPerCue).join(" "));
  }
  const per = durationSeconds / groups.length;
  return groups.map((g, i) => ({
    startSeconds: startSeconds + i * per,
    endSeconds: startSeconds + (i + 1) * per,
    text: g,
  }));
}
```

Expose downloads in the UI: **MP4**, **.srt**, and **provenance .json**.

---

## STEP 15 — Asset durability

The Hugging Face image URLs are **signed and expire**. A re-render an hour later silently breaks.

📄 CREATE `src/lib/assets.ts`

```ts
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const DIR = path.join(process.cwd(), "public", "generated", "assets");

/** Downloads a remote asset once and returns a stable root-relative URL. */
export async function persistRemoteAsset(url: string, ext = "webp"): Promise<string> {
  if (url.startsWith("/")) return url;                  // already local
  await fs.mkdir(DIR, { recursive: true });

  const name = `${crypto.createHash("sha1").update(url).digest("hex").slice(0, 16)}.${ext}`;
  const filePath = path.join(DIR, name);

  try {
    await fs.access(filePath);
    return `/generated/assets/${name}`;                 // cached
  } catch { /* not cached yet */ }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download asset (${res.status}).`);
  await fs.writeFile(filePath, Buffer.from(await res.arrayBuffer()));
  return `/generated/assets/${name}`;
}
```

Call it in the image route the moment a generation succeeds, and store the **local** URL.

---

## STEP 16 — Tests on the logic that must never silently break

▶ RUN
```powershell
npm install -D vitest
```

✏️ EDIT `package.json` → add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

📄 CREATE `src/lib/__tests__/authenticity.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { canonical, isVerbatim, detectFabricatedQuotes } from "../authenticity";
import type { Teaching } from "../teachings";

const teaching = {
  id: "t1",
  kind: "quotation",
  topics: ["strength"],
  sourceUrl: "https://media.belurmath.org/x/",
  imageUrl: null,
  publishedAt: null,
  primaryLang: "en",
  needsReview: false,
  reviewReasons: [],
  variants: { en: { text: "Throw away all weakness.", author: "Swami Vivekananda", sourceWork: "CW Vol 1" } },
} as unknown as Teaching;

describe("canonical", () => {
  it("normalises curly quotes and whitespace but nothing else", () => {
    expect(canonical("  Don’t   stop ")).toBe("Don't stop");
  });

  it("does NOT treat different wording as equal", () => {
    expect(isVerbatim("Throw away your weakness.", "Throw away all weakness.")).toBe(false);
  });

  it("accepts an exact match with incidental whitespace", () => {
    expect(isVerbatim("Throw away  all weakness.", "Throw away all weakness.")).toBe(true);
  });
});

describe("detectFabricatedQuotes", () => {
  it("flags an invented quotation", () => {
    const r = detectFabricatedQuotes('He told them, "Rise and never look back."', teaching);
    expect(r.fabricated).toContain("Rise and never look back.");
  });

  it("flags an attribution phrase", () => {
    const r = detectFabricatedQuotes("As Vivekananda said, courage is everything.", teaching);
    expect(r.attributions.length).toBeGreaterThan(0);
  });

  it("passes clean AI narrative", () => {
    const r = detectFabricatedQuotes("Riya sat in the back row, hand half-raised, then lowered it.", teaching);
    expect(r.fabricated).toHaveLength(0);
    expect(r.attributions).toHaveLength(0);
  });
});
```

📄 CREATE `src/lib/__tests__/duration.test.ts` — assert `fitToWindow` pulls a 72s total and a 24s
total back toward the window, and leaves a 45s total untouched at speed `1`.

📄 CREATE `src/lib/__tests__/subtitles.test.ts` — assert `toSRT` numbering starts at 1, uses
commas in timestamps, and that `buildCues` covers the full duration with no gap.

▶ RUN
```powershell
npm test
```

---

## STEP 17 — Persistence and durability

| Task | Minimum viable approach |
|---|---|
| Save each reel | Write `data/reels/<id>.json` on render; list them at `/reel/library` |
| Survive reload | Load the reel by id from a URL param |
| Clean up generated files | `scripts/clean_generated.ps1` deleting `public/generated/*` older than 24h |
| Rate limit | In-memory token bucket keyed by IP in each `/api/reel/*` route |
| Render progress | `renderMedia`'s `onProgress` → an SSE route → a progress bar |

▶ RUN (cleanup helper)
```powershell
Get-ChildItem public\generated -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } | Remove-Item -Force
```

---

## STEP 18 — Demo preparation

### 18.1 Switch on real generation

✏️ EDIT `.env`
```ini
MOCK_SCENE_IMAGES=false
MOCK_SCENE_VIDEO=true     # leave true — ZeroGPU quota is shared and unreliable
```

### 18.2 Pre-render fallbacks

Render and keep **three finished reels** on disk before you present: one English, one Hindi, one
Bengali. Hugging Face cold starts and Groq rate limits do not care that you are on stage.

### 18.3 The three-minute script

1. **Open on the problem** (20s) — "AI tools will happily invent a Vivekananda quote. Ours cannot."
2. **Pick a teaching** (20s) — topic chip → card → show the Belur Math source link.
3. **Generate** (40s) — script appears; point at the locked quote beat.
4. **The authenticity panel** (30s) — read the four checks out loud. This is the whole pitch.
5. **Play the reel** (60s) — let it run. Point at the source badge and the quote card.
6. **Switch language** (20s) — regenerate in Bengali reusing the same images. Say plainly which
   parts are official Belur Math translation and which are the AI's.
7. **Close on the quarantine** (10s) — "we excluded N items we could not verify."

### 18.4 Answers to have ready

| Question | Answer |
|---|---|
| "What stops it hallucinating a quote?" | The quote never passes through the model. It is copied from a verified record and byte-checked before render; the render refuses if it drifted. |
| "How do you handle other languages?" | Belur Math publishes official Bengali and Hindi renderings on the same card. We use those, not machine translation. Where no official rendering exists we label the translation as unofficial. |
| "How do you know the data is right?" | We parse Belur Math's own HTML structure and quarantine everything that does not parse cleanly — N items excluded, each with a stated reason. |
| "Is the voice his?" | No, and we say so on screen. The narration is synthetic and the story is an AI dramatisation; only the quotation is his. |

### ✅ Final checklist
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] Three reels pre-rendered
- [ ] Indic subtitles render as glyphs, not boxes
- [ ] The authenticity panel is on screen during the demo
- [ ] `ffmpeg` on PATH on the demo machine; heavy apps closed
- [ ] Numbers memorised: verified count, quarantined count, language variants

---

## Appendix A — Command cheat sheet

```powershell
npm run dev                                  # dev server (Turbopack)
npm run build; npm run start                 # production build
npm test                                     # vitest
python scripts/build_teachings.py            # rebuild data/teachings.json
python scripts/scrape.py                     # re-scrape Belur Math (rarely needed)
npx remotion studio src/remotion/index.ts    # preview compositions
npx tsc --noEmit                             # typecheck
Get-ChildItem public\generated -File | Remove-Item -Force   # clear generated media
```

## Appendix B — Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Groq is rate-limited — try again in N seconds` | Free-tier TPM cap | Wait; the message is Groq's own hint, surfaced by [groq.ts](../src/lib/groq.ts) |
| Indic subtitles render as `□□□` | Font not loaded into the Remotion bundle | Step 13.1 — `@remotion/google-fonts` |
| `ffmpeg: command not found` | Not on PATH for the Node process | Install system-wide, reopen the terminal |
| Scene image 404s on a later re-render | HF signed URL expired | Step 15 — `persistRemoteAsset` |
| Render hangs or is killed | Headless Chromium on a constrained machine | Close heavy apps; pre-render demo reels |
| `data/teachings.json not found` | Step 1 not run | `python scripts/build_teachings.py` |
| Quote fails the verbatim check | Script was hand-edited, or the dataset was rebuilt after generation | Regenerate the script — do not relax the check |
| Narration is far from 45s | `fitToWindow` not applied | Step 12 — re-synthesise once at `suggestedSpeed` |
