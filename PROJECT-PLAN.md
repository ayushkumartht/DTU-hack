# Teaching-to-Reel Generator — Project Plan

**Case Study 06** — *Turning verified teachings into honest, engaging 30–60 second reels.*

This document is the single source of truth for where the prototype stands today, what the
case study actually demands, where the two diverge, and exactly what has to be built to score
a full grade. Written after a full read of the repo at commit `54830ab`.

- Architecture and route contracts that already exist: [docs/API.md](docs/API.md)
- Local setup: [docs/SETUP.md](docs/SETUP.md)
- What the app does today: [README.md](README.md)

---

## 1. The brief, in one line

> Take a **verified** teaching / quotation / incident from Swami Vivekananda → produce a
> **30–60 second reel** with a strong hook, a modern-day situation, visual ideas, narration,
> subtitles and an actionable takeaway — **without ever inventing a quotation or passing AI
> prose off as his words** — always showing the original source, and adaptable into **Indian
> regional languages**.

Three things in that sentence are graded hardest, because they are what make this case study
different from "an AI video generator":

1. **Authenticity** — verbatim quotes, visible provenance, AI content clearly labelled.
2. **Source visibility** — the viewer of the exported reel must be able to trace the claim.
3. **Regional language adaptation** — not just Hindi; actual Indian languages.

---

## 2. Where the prototype stands today

### 2.1 What is genuinely built and working

The existing app — "Learning of Vivekanand" — is a solid, non-trivial media pipeline. None of
this is throwaway.

| Layer | Status | Where |
|---|---|---|
| Next.js 16 App Router + React 19 + TypeScript, Arc UI (CSS Modules) | ✅ working | [src/app/](src/app/), [src/components/arc/](src/components/arc/) |
| Landing page + theme toggle | ✅ working | [src/features/landing/components/LandingPage.tsx](src/features/landing/components/LandingPage.tsx) |
| Story board dashboard (form → story → scenes → video) | ✅ working | [src/app/story-board/page.tsx](src/app/story-board/page.tsx) |
| **147 verified Belur Math quotes**, scraped with source link + image + date | ✅ working | [scripts/scrape.py](scripts/scrape.py), [data/vivekananda_quotes.json](data/vivekananda_quotes.json) |
| **Local TF-IDF + cosine vector search** over 2,552 indexed terms — no network, no embeddings API | ✅ working | [src/lib/vectorSearch.ts](src/lib/vectorSearch.ts), [data/quotes_indexed.json](data/quotes_indexed.json) |
| Streaming story generation via Groq `openai/gpt-oss-120b` | ✅ working | [src/app/api/story/route.ts](src/app/api/story/route.ts) |
| 4-scene planner (caption + Ghibli image prompt), defensive JSON parsing | ✅ working | [src/app/api/story/scenes/route.ts](src/app/api/story/scenes/route.ts) |
| Deterministic text segmentation (story ↔ scene colour matching) | ✅ working | [src/lib/segmentStory.ts](src/lib/segmentStory.ts) |
| Ghibli scene images, 576×1024 portrait, generated **sequentially** | ✅ working | [src/lib/gradio.ts](src/lib/gradio.ts) |
| **Per-scene TTS** with real ffprobe-measured durations, ffmpeg concat + `atempo` retime | ✅ working | [src/lib/kokoro.ts](src/lib/kokoro.ts) |
| Narration split validation + guaranteed deterministic fallback | ✅ working | [src/app/api/story/narration/route.ts](src/app/api/story/narration/route.ts) |
| Image-to-video motion clips (LTX-Video) | ⚠️ built, **mocked by default** (ZeroGPU quota) | [src/lib/ltxVideo.ts](src/lib/ltxVideo.ts) |
| Remotion render → 720×1280 @30fps h264 MP4, Ken Burns, fades, subtitles | ✅ working | [src/remotion/StoryVideo.tsx](src/remotion/StoryVideo.tsx) |
| In-browser preview via `@remotion/player` + MP4 download | ✅ working | [src/features/story/components/StoryVideoPanel.tsx](src/features/story/components/StoryVideoPanel.tsx) |
| Cost-control mock modes (`MOCK_SCENE_IMAGES`, `MOCK_SCENE_VIDEO`) | ✅ working | [.env.example](.env.example) |
| Rate-limit-aware Groq error formatting | ✅ working | [src/lib/groq.ts](src/lib/groq.ts) |

**Honest summary:** the *media pipeline* is ~75% of a finished product. The *case study* is
~35% satisfied. The engineering is ahead of the brief.

### 2.2 The core mismatch — read this before anything else

The brief's input is **a verified teaching**. The prototype's input is **the user's personal
problem**.

```
BRIEF:      verified teaching/quote/incident  →  modern situation  →  30-60s reel
PROTOTYPE:  user's personal problem  →  quote retrieved as supporting detail  →  long story  →  reel
```

In the current flow ([src/app/api/story/route.ts:27](src/app/api/story/route.ts#L27)) the quote
is a *retrieval detail* fed into a prompt that says "naturally weave the quote into the
narrative." The teaching is not the anchor — it is seasoning. Everything downstream
(scene planning, narration) then re-writes that text one or two more times, so by the time
audio is spoken the original wording has passed through two LLM hops with nothing checking it.

**This is the single highest-value change in the project.** It is also not a rewrite: the whole
pipeline below the input stays. See §4.1.

---

## 3. Requirement-by-requirement scorecard

| # | Case study requirement | Status | Evidence / gap |
|---|---|---|---|
| 1 | Input is a **verified teaching, quotation or incident** | ❌ **Missing** | Only free-text problem input ([StoryForm.tsx](src/features/story/components/StoryForm.tsx)). No teaching browser, no topic filter. Dataset has **quotations only** — no life incidents. |
| 2 | Output is **30–60 seconds** | ⚠️ Emergent, not enforced | Narration prompt targets 140–170 words ≈ 45–60s ([narration/route.ts:73](src/app/api/story/narration/route.ts#L73)), but total duration is the *sum* of measured TTS segments. Nothing clamps, validates, or retries if it lands at 38s or 74s. |
| 3 | **Strong opening / hook** | ❌ **Missing** | No hook concept anywhere. Scene 1 is simply the start of the prose. Reels live or die in the first 3 seconds. |
| 4 | Simple story / **modern-day situation** | ⚠️ Partial | Stories are long-form parables (`maxTokens: 1500`) often set in a monastic register, then compressed. No explicit "modern situation" beat (the brief's own example: a student afraid to speak in class). |
| 5 | **Visual ideas** | ⚠️ Partial | Image prompts are generated and used, but hard-locked to Ghibli style, not shown as editable creative options, and a failed scene is terminal — no per-scene regenerate. |
| 6 | **Narration** | ✅ Good | Per-segment TTS with real durations is genuinely better than most implementations. English only. |
| 7 | **Subtitles** | ⚠️ Weak | One full segment of text burned in and held for 10–17s at fixed 27px, no wrapping/overflow guard, no word-level timing, no `.srt`/`.vtt` export ([StoryVideo.tsx:43](src/remotion/StoryVideo.tsx#L43)). |
| 8 | **Meaningful takeaway / small action to try** | ❌ **Missing** | Not modelled in any type, prompt, scene, or frame. No end card, no CTA. |
| 9 | **Never invent quotations / never present AI text as his words** | ❌ **Critical gap** | Nothing verifies the quote appears verbatim. The prompt invites paraphrase. Narration is a *second* LLM rewrite of the story. Spoken audio makes no distinction between his words and AI prose. No disclosure label. |
| 10 | **Clearly show the original source** | ❌ **Critical gap** | Attribution exists only in the on-screen text story's trailing reference block. **The exported MP4 — the artifact that actually travels — carries zero attribution.** No quote card, no Belur Math URL, no source frame. |
| 11 | **Indian regional languages** | ❌ **Missing** | Story: Hindi/English only. Narration: English only (Kokoro `af_bella`/`am_michael`, [kokoro.ts:19](src/lib/kokoro.ts#L19)). Subtitles: English only. Image prompts explicitly forced to English. No Bengali, Tamil, Telugu, Marathi, Kannada, Gujarati, Malayalam, Punjabi, Odia. |

**Score: 2 solid ✅, 4 partial ⚠️, 5 missing ❌ — with the three heaviest-weighted criteria
(authenticity, source visibility, regional languages) all in the ❌ column.**

### 3.1 Engineering gaps (not in the brief, but they will be noticed)

| Issue | Impact |
|---|---|
| **No persistence** — reload destroys everything | A judge who refreshes loses the demo. No history, no library, no shareable link. |
| **HF image URLs are signed and expire** | They are never downloaded locally. A re-render an hour later silently breaks. |
| `public/generated/` is written at runtime, never cleaned | Grows forever; also breaks on any serverless/Vercel deploy (read-only FS). |
| Remotion renders **in-process on the web server** | Blocks the route for tens of seconds; no job queue, no progress %, no cancel. |
| `SCENE_COUNT = 4` hard-coded | [scenes/route.ts:7](src/app/api/story/scenes/route.ts#L7) — can't adapt scene count to duration. |
| Scene errors are terminal | No "retry this scene" affordance in the UI. |
| **Zero tests** | Nothing guards the deterministic logic (`segmentStory`, `vectorSearch`) that everything else depends on. |
| No rate limiting / auth on API routes | Any public deploy burns the Groq key. |
| `MOCK_SCENE_VIDEO=true` by default | Demo-day output is Ken Burns only unless deliberately flipped. |

---

## 4. What we have to build

Organised by priority. **P0 is non-negotiable** — without it the submission does not answer
the case study, however good the video looks.

### 4.1 P0 — Reframe the input around a verified teaching

**Goal:** the user starts by picking (or searching for) a verified teaching, and that teaching
is carried through the entire pipeline as structured, immutable data — never as free text an
LLM can rewrite.

#### New data model — `src/features/reel/types.ts`

```ts
/** A verified source item. Immutable. Never passes through an LLM as editable text. */
export interface Teaching {
  id: string;
  kind: "quotation" | "incident";
  text: string;              // VERBATIM. The exact words.
  title: string;
  sourceWork: string;        // e.g. "Complete Works, Vol 1, Raja Yoga, Ch. II"
  sourceUrl: string;         // the Belur Math permalink
  topics: Topic[];
  imageUrl?: string;
}

export type Topic =
  | "courage" | "self-confidence" | "concentration"
  | "education" | "service" | "fearlessness" | "strength" | "faith";

/** The reel script. Every field is AI-written EXCEPT `quote`. */
export interface ReelScript {
  hook: string;              // 0-3s. One scroll-stopping line.
  situation: string;         // 3-15s. A modern, relatable scene.
  turn: string;              // 15-30s. The moment the teaching lands.
  quote: VerifiedQuoteBlock; // 30-45s. NOT generated. Copied from Teaching.
  takeaway: string;          // 45-60s. One small action the viewer can try today.
}

export interface VerifiedQuoteBlock {
  teachingId: string;
  verbatimText: string;      // === Teaching.text, byte for byte
  attribution: string;       // "Swami Vivekananda — <sourceWork>"
  sourceUrl: string;
}
```

#### Functions to write

| Function | File | Responsibility |
|---|---|---|
| `classifyTopics()` | `scripts/enrich_topics.py` | One-time offline pass: tag all 147 quotes with the brief's topics. Output `data/teachings.json`. |
| `parse_block()` | `scripts/build_teachings.py` | Split each card into per-language variants with their own verbatim text and citation. **See [docs/IMPLEMENTATION-GUIDE.md](docs/IMPLEMENTATION-GUIDE.md) Step 1 — this is harder and more valuable than it first looked: 110 of 147 records concatenate the same teaching in two or three languages into one `quote` string, median 504 chars. A trailing-citation regex only works on 96/147, but `raw_html` splits cleanly on `<hr>` for 133/147.** |
| `listTeachings(filter)` | `src/lib/teachings.ts` | Browse/filter by topic, kind, keyword. |
| `getTeaching(id)` | `src/lib/teachings.ts` | Single lookup by id. |
| `searchTeachings(q, k)` | `src/lib/teachings.ts` | Reuse the existing TF-IDF search, returning `Teaching[]`. |
| `POST /api/reel/script` | `src/app/api/reel/script/route.ts` | **Replaces `/api/story`.** Takes `{ teachingId, audience?, language }`, returns a `ReelScript`. The LLM writes hook/situation/turn/takeaway only; `quote` is assembled server-side from the `Teaching` record and never sent to the model as something to reproduce. |

#### New UI

| Component | File | Notes |
|---|---|---|
| `TeachingPicker` | `src/features/reel/components/TeachingPicker.tsx` | Topic chips (courage, self-confidence, concentration, education, service) + search + card grid. This is the new landing action. |
| `TeachingCard` | `src/features/reel/components/TeachingCard.tsx` | Verbatim text, source work, Belur Math link, "Make a reel" button. |
| `ScriptEditor` | `src/features/reel/components/ScriptEditor.tsx` | Five labelled beats. The quote beat is **read-only**, visually locked, with a source link. Everything else is editable before render. |

> Keep `/story-board` working as-is during the migration. Build the new flow at `/reel` and
> switch the landing CTA over once it is stable. Do not break a working demo mid-build.

---

### 4.2 P0 — Authenticity guardrails (the graded differentiator)

This is what separates this submission from a generic AI reel tool. Build it visibly, and
**show it to the judges on screen** — a guardrail nobody can see scores nothing.

| Function | File | Responsibility |
|---|---|---|
| `assertVerbatim(generated, teaching)` | `src/lib/authenticity.ts` | Hard check that the quote block is byte-identical to the source. Throws on any drift. Runs before render, not as a warning. |
| `detectFabricatedQuotes(text, allowed)` | `src/lib/authenticity.ts` | Scan all AI-written beats for quotation marks or attribution phrasing ("Vivekananda said", "स्वामी जी ने कहा"). Any quoted span that is not in the verified set is flagged and the beat is regenerated. |
| `buildProvenance(teaching, script)` | `src/lib/authenticity.ts` | Produce the provenance record rendered into the video and the export sidecar. |
| `AuthenticityPanel` | `src/features/reel/components/AuthenticityPanel.tsx` | Visible per-reel report: ✅ quote verbatim · ✅ no fabricated attributions · source link · "narrative is an AI-written dramatisation". |

**Prompt changes required** in every generation route:

- Add a standing system clause: *"You are writing an original modern dramatisation. You must
  NOT write any sentence attributed to Swami Vivekananda. You must NOT use quotation marks
  around any line. The single verified quotation is inserted separately by the system."*
- Remove *"naturally weave the provided quote into the narrative"* from
  [src/app/api/story/route.ts:43](src/app/api/story/route.ts#L43) — that instruction is the
  direct cause of the paraphrase risk.
- Narration: pass the **structured script**, not the finished prose, so there is no second
  uncontrolled rewrite hop.

---

### 4.3 P0 — Source attribution inside the video

The MP4 is the artifact that leaves the building. Right now it is anonymous.

| Function | File | Responsibility |
|---|---|---|
| `QuoteCard` | `src/remotion/components/QuoteCard.tsx` | A dedicated frame (~30–45s) showing the verbatim quote in quotation marks, large and still, with the attribution line beneath. Visually distinct from the dramatisation scenes. |
| `SourceBadge` | `src/remotion/components/SourceBadge.tsx` | Persistent small corner badge: `belurmath.org` — present on every frame. |
| `EndCard` | `src/remotion/components/EndCard.tsx` | Final 3–5s: takeaway line + full source citation + "Dramatisation — the quotation is verbatim from Belur Math." |
| `DisclosureStrip` | `src/remotion/components/DisclosureStrip.tsx` | Thin label distinguishing dramatised scenes from the verified quote frame. |
| `writeSidecar()` | `src/lib/export.ts` | Emit `<video>.json` alongside the MP4 with teaching id, verbatim text, source URL, model + prompt versions, generation timestamp. |

[src/remotion/StoryVideo.tsx](src/remotion/StoryVideo.tsx) needs a restructure from "N uniform
scenes" to the five-beat reel timeline with the quote card as a first-class, non-generated beat.

---

### 4.4 P1 — Reel craft (duration, hook, subtitles, takeaway)

| Function | File | Responsibility |
|---|---|---|
| `enforceDuration(segments, {min:30, max:60})` | `src/lib/duration.ts` | Measure, then **actively correct**: tighten/expand the script or nudge `speed` within [0.9, 1.15] until the total lands in range. Fail loudly if it can't. |
| `estimateSpokenSeconds(text, lang)` | `src/lib/duration.ts` | Per-language WPM table so the script is right *before* paying for TTS. |
| `generateHookVariants(teaching, n)` | `src/app/api/reel/hooks/route.ts` | 3–5 competing hook lines, creator picks one. Cheap, high-impact, demos beautifully. |
| `buildWordTimings(segment, duration)` | `src/lib/subtitles.ts` | Split each segment into 3–5-word phrase chunks with timings, for readable reel-style captions instead of a 17-second wall of text. |
| `toSRT()` / `toVTT()` | `src/lib/subtitles.ts` | Downloadable subtitle files — directly serves the brief's "subtitles" requirement and the regional-language one. |
| `PhraseSubtitle` | `src/remotion/components/PhraseSubtitle.tsx` | Replaces the current static `Subtitle`. Auto-fit font size, safe-area padding, max 2 lines, outline for legibility on bright frames. |
| `generateTakeaway(script)` | part of `/api/reel/script` | One concrete action for *today* — "tomorrow, ask one question in class." Rendered on the end card and in the narration. |

---

### 4.5 P1 — Regional language support

The brief names this explicitly. Target an initial set of **Hindi, Bengali, Tamil, Telugu,
Marathi, Gujarati, Kannada** — Bengali matters disproportionately here given Belur Math.

| Function | File | Responsibility |
|---|---|---|
| `SUPPORTED_LANGUAGES` | `src/lib/i18n/languages.ts` | Code, native name, script, TTS voice id, WPM, font family. |
| `translateScript(script, lang)` | `src/lib/i18n/translate.ts` | Translate the **AI-written beats only**. The verified quote is handled separately — see below. |
| `resolveQuoteTranslation(teaching, lang)` | `src/lib/i18n/quotes.ts` | **The subtle, important one.** A translated quote is no longer verbatim. Rule: show the English verbatim quote *and* a clearly-labelled translation ("working translation — not an official Belur Math translation"), never a translation presented as the quotation itself. |
| `synthesizeMultilingual(segments, lang)` | `src/lib/tts/index.ts` | Kokoro has no Indic voices. Needs a second provider — evaluate IndicTTS / AI4Bharat Spaces, or Sarvam AI / ElevenLabs multilingual. Keep the existing ffmpeg concat + ffprobe duration machinery; only the synthesis call changes. |
| `getFontForScript(script)` | `src/lib/i18n/fonts.ts` | Noto Sans Devanagari / Bengali / Tamil / Telugu / Kannada / Gujarati, loaded into the Remotion bundle. **Without this, Indic subtitles render as tofu boxes in the MP4 even when the text is correct.** |
| `LanguageSelector` | `src/features/reel/components/LanguageSelector.tsx` | Language picker + "regenerate in this language" — ideally reusing existing images so only audio and subtitles change. That reuse makes a *fantastic* 20-second demo moment. |

---

### 4.6 P2 — Durability and polish

| Item | Why |
|---|---|
| Persist reels (SQLite/Postgres or even a JSON store) | Survive reload; reel library; shareable permalinks. |
| `downloadToLocal(url)` before render | Stop depending on expiring HF signed URLs. |
| Move `public/generated/` → object storage or a temp dir + served route | Required for any real deployment. |
| Per-scene **Regenerate** button | Image generation is non-deterministic; one bad frame currently ruins the reel. |
| Render progress streaming | `renderMedia`'s `onProgress` → SSE → progress bar. |
| Vitest on `segmentStory`, `vectorSearch`, `authenticity`, `duration` | These are pure functions carrying the whole pipeline. Cheap to test, catastrophic if wrong. |
| Rate limiting on API routes | Protects the key on a public demo URL. |
| Alternate visual styles beyond Ghibli | "Visual ideas" in the brief implies creative choice. |

---

## 5. Suggested build order

| Phase | Work | Outcome |
|---|---|---|
| **0** | `data/teachings.json` with clean `text` / `sourceWork` / `topics` split | Unblocks everything. Half a day. |
| **1** | `TeachingPicker` + `/api/reel/script` + five-beat `ReelScript` | The brief's actual input flow exists. |
| **2** | `authenticity.ts` + `AuthenticityPanel` + prompt hardening | The graded differentiator. |
| **3** | `QuoteCard` + `SourceBadge` + `EndCard` in Remotion | The exported MP4 is now honest and traceable. |
| **4** | `enforceDuration` + `PhraseSubtitle` + hook variants | It is now a *reel*, not a slideshow. |
| **5** | Indic TTS + fonts + `LanguageSelector` | The regional-language requirement is met. |
| **6** | Persistence, retries, tests, progress | It survives contact with a judge. |

**Run phases 1–3 before touching anything cosmetic.** A beautiful reel that paraphrases
Vivekananda fails this specific case study.

---

## 6. Demo-day checklist

- [ ] Flip `MOCK_SCENE_IMAGES=false`; decide deliberately on `MOCK_SCENE_VIDEO`.
- [ ] Pre-render 3 finished reels (one English, one Hindi, one Bengali) as a fallback for flaky Wi-Fi or an HF cold start.
- [ ] Have the **authenticity panel on screen** during the pitch — narrate it out loud.
- [ ] Show the Belur Math source page side by side with the quote card to prove verbatim.
- [ ] Prepare the honest answer to *"what stops it hallucinating a quote?"* — "the quote never passes through the model; it is copied from a verified record and byte-checked before render."
- [ ] Keep `ffmpeg`/`ffprobe` on PATH on the demo machine; close heavy apps before rendering.
- [ ] Know the real numbers: 147 source cards (→ verified + quarantined counts after Step 1), 2,552-term local index, zero embedding API calls.

---

## 7. Known risks

| Risk | Mitigation |
|---|---|
| **No Indic TTS provider chosen yet** — the single largest unknown | Spike this in week 1, before building the UI around it. Fall back to English voiceover + regional subtitles if nothing viable lands. |
| **The dataset is messier than it looks** — some records are hymns by Vivekananda, verses written *about* him, or scripture citations, not his quotations | Step 1's quarantine. Never show an unparsed record as a verified teaching; state the excluded count openly. |
| LTX-Video ZeroGPU quota is shared account-wide and already exhausted once | Keep motion as an enhancement with the Ken Burns fallback; do not make the demo depend on it. |
| Groq free-tier rate limits during a live demo | Pre-rendered fallbacks; `gpt-oss-120b`'s hidden reasoning makes latency unpredictable. |
| Remotion render time on a constrained machine | Render the demo reels in advance. |
| Scope creep into "a video tool" | The brief rewards authenticity over polish. Guardrails before effects. |

---

## 8. What NOT to throw away

The vector search, the per-segment TTS duration machinery, the deterministic segmentation
fallbacks, the sequential generation UX, the mock modes, and the Remotion composition are all
good work and all survive the reframe. The change needed is **what enters the pipeline and
what is guaranteed about what comes out** — not how the pipeline itself works.
