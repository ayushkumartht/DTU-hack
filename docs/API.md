# API Reference

All routes live under `src/app/api/story/` and run with `export const runtime = "nodejs"` (they need real Node APIs — `fetch`-based streaming, `child_process` for ffmpeg, filesystem writes — so they can't run on the Edge runtime). All are `POST`, all accept and return JSON except `/api/story`, which streams plain text.

On failure, every route returns:

```json
{ "error": "Human-readable message" }
```

with an appropriate HTTP status (`400` for a bad request, `500` for a server/upstream failure). Groq rate-limit errors are reformatted into a plain "try again in N seconds" message rather than the raw provider error (see `src/lib/groq.ts`).

---

## `POST /api/story`

Streams the generated wisdom story as it's written.

**Request body**

```json
{ "problem": "I feel overwhelmed by stress and self-doubt." }
```

| Field | Type | Required |
|---|---|---|
| `problem` | `string` | yes — the user's situation, in Hindi, English, or Hinglish |

**Response**

`200 OK`, `Content-Type: text/plain; charset=utf-8`, `Cache-Control: no-cache`. The body is a raw token stream (not SSE-framed — each chunk is appended directly to the accumulating story text by the client). The story always ends with a Markdown references section:

```markdown
---
### 📖 Reference & Belur Math Sources
- **Title**: ...
- **Belur Math Link**: ...
- **Quote**: "..."
```

**What it does internally**

1. Looks up the top 3 matching quotes for `problem` via the local vector index (`src/lib/vectorSearch.ts`) — no network call.
2. Sends a system + user prompt to Groq (`openai/gpt-oss-120b`, `temperature: 0.7`, `max_tokens: 1500`, `stream: true`) instructing it to respond in the same language family as the input (Hindi/Hinglish → Hindi, English → English).
3. Re-streams Groq's SSE token stream back to the client as plain decoded text.

**Errors**

| Status | Cause |
|---|---|
| 400 | `problem` missing or empty |
| 500 | `GROQ_API_KEY` not configured |
| 500 | Groq request failed (network, rate limit, etc.) |

---

## `POST /api/story/scenes`

Plans exactly 4 scenes from a finished story and splits the story's own text into 4 matching, color-coded segments.

**Request body**

```json
{ "story": "<the full generated story text>", "problem": "<original situation text>" }
```

| Field | Type | Required |
|---|---|---|
| `story` | `string` | yes |
| `problem` | `string` | no (used only to give the scene planner more context) |

**Response** `200 OK`

```json
{
  "scenes": [
    { "caption": "The overwhelmed young monk", "imagePrompt": "Ghibli style ..." }
  ],
  "segments": ["<narrative chunk 1>", "<narrative chunk 2>", "..."],
  "reference": "<the story's trailing reference section, or null if none was found>"
}
```

- `scenes.length` is normally 4 (`SCENE_COUNT` in the route file), but can be fewer if the model returns malformed entries for some of them — the route filters, it doesn't pad.
- `segments` has the same length as `scenes`: `src/lib/segmentStory.ts` strips the reference section (if present), then deterministically groups the remaining paragraphs into N character-length-balanced, contiguous chunks — this is plain text splitting, not an LLM call, so it always lines up with however many scenes came back.
- `reference` is extracted with a regex looking for `\n---\n### ...reference...` (case-insensitive); it's `null` if the story didn't include one.

**What it does internally**

1. Asks Groq for a JSON object (`response_format: json_object`, `max_tokens: 2000`) shaped `{"scenes": [{"caption", "imagePrompt"}, ...]}`, instructing it to always write `imagePrompt` in English even if the story is in Hindi, following the template `"Ghibli style [subject] with [features], [action], [environment], [lighting], [details]"`.
2. Parses the response defensively (`extractScenesArray`): tries a direct `JSON.parse`, then falls back to scanning for the outermost `{...}` or `[...]` if the model wrapped the JSON in prose or code fences.
3. Runs `splitStory` + `segmentNarrative` locally against the original `story` text.

**Errors**

| Status | Cause |
|---|---|
| 400 | `story` missing or empty |
| 500 | `GROQ_API_KEY` not configured |
| 500 | Groq response wasn't valid/parseable JSON, or contained zero usable scenes |

---

## `POST /api/story/scenes/image`

Generates (or mocks) the illustration for **one** scene. The frontend calls this once per scene, sequentially — never in parallel — so scenes visibly render one at a time.

**Request body**

```json
{ "imagePrompt": "Ghibli style a young monk sitting by a river at dawn, ..." }
```

**Response** `200 OK`

```json
{ "imageUrl": "https://....hf.space/.../image.webp?__sign=...", "seed": 1280516434, "mock": false }
```

- `imageUrl` is a signed URL straight from the Hugging Face Space's file server — it expires, so don't persist it long-term without downloading it.
- `seed`: the seed the Space used (random each call); `null` in mock mode.
- `mock`: `true` when `MOCK_SCENE_IMAGES=true` — in that case `imageUrl` is always the local `/mock/scene-placeholder.webp`, the response is delayed 600-1200ms to keep the sequential-reveal UI meaningful to watch, and the real Space is never called.

**What it does internally (non-mock)**

Calls `generateGhibliImage` (`src/lib/gradio.ts`), which lazily connects once (`Client.connect`, cached at module scope for the life of the server process) to `alvarobartt/FLUX.1-Studio-Ghibli-LoRA` and invokes its `/inference` endpoint with:

| Param | Value |
|---|---|
| `prompt` | the given `imagePrompt`, prefixed with `"Ghibli style, "` if it doesn't already start with that |
| `seed` | `0` |
| `randomize_seed` | `true` |
| `width` × `height` | `576` × `1024` (9:16 portrait) |
| `guidance_scale` | `3.5` |
| `num_inference_steps` | `28` |

**Errors**

| Status | Cause |
|---|---|
| 400 | `imagePrompt` missing or empty |
| 500 | `HF_TOKEN` not configured (non-mock mode only) |
| 500 | The Space call failed (quota, cold start, network) |

---

## `POST /api/story/narration`

Writes the narration as **one segment per scene** (not one flat script) and voices all of them, so each scene's video time, and its subtitle, can match exactly how long its own dialogue takes to speak.

**Request body**

```json
{
  "story": "<the full story text>",
  "problem": "<original situation text>",
  "sceneCount": 4,
  "voice": "female",
  "speed": 1
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `story` | `string` | yes | |
| `problem` | `string` | no | extra context for the narrator |
| `sceneCount` | `number` | no | defaults to 4, clamped to `[1, 8]` — should match the number of scenes you have images for |
| `voice` | `"female" \| "male"` | no | defaults to `"female"` |
| `speed` | `number` | no | defaults to `1`; applied post-synthesis via ffmpeg's `atempo` filter, clamped to `[0.5, 2]` |

**Response** `200 OK`

```json
{
  "audioUrl": "/generated/narration-<uuid>.mp3",
  "segments": [
    { "text": "Arjun, a young monk, woke each morning...", "durationInSeconds": 14.8 }
  ],
  "durationInSeconds": 55.4
}
```

`segments.length === sceneCount` always (see the guaranteed-split guarantee below). `audioUrl` is root-relative, served out of `public/generated/`.

**What it does internally**

1. `writeNarrationSegments`: asks Groq (JSON mode, `temperature: 0.6`, `max_tokens: 4000`) for `{"segments": ["...", ...]}` with exactly `sceneCount` entries, roughly 140-170 words combined (calibrated to this voice's ~150-175 wpm pace, landing around 45-60s before any `speed` adjustment), explicitly instructed not to make one segment a full-story summary while the rest are short.
2. **Validates the split, not just the JSON.** A response is only accepted if it has exactly `sceneCount` entries *and* no segment is severely imbalanced (`isSeverelyImbalanced`: the longest segment isn't disproportionately longer than the others' average). Up to 3 attempts.
3. **Guaranteed fallback.** `gpt-oss-120b` has been observed *consistently* (not just occasionally) collapsing an entire story into one giant segment across every retry for some inputs — so retries alone aren't a guarantee. If every attempt fails validation, the best text seen is mechanically re-split into exactly `sceneCount` sentence-balanced pieces by `segmentIntoSentenceGroups` (`src/lib/segmentStory.ts`, plain sentence-boundary splitting, no LLM) rather than erroring out.
4. `generateNarrationMp3` (`src/lib/kokoro.ts`): synthesizes **one TTS clip per segment** (not one call for the whole script — see below), measures each clip's real duration via `ffprobe`, concatenates them (ffmpeg concat demuxer), applies the `speed` retime if not `1`, and transcodes to mp3. Each segment's reported `durationInSeconds` is scaled by `speed` too, so it still matches the final audio exactly.

**Why per-segment TTS calls, not one call for the whole script**: a single Kokoro `generate()`-equivalent call caps out at roughly 25-30 seconds of audio *regardless of input length* (confirmed: 130 words and 216 words in one call both produced ~26-27s). Splitting into per-scene calls was already necessary for scene timing, and it incidentally fixes this cap too, since no individual segment is long enough to hit it.

**Why JSON mode here, unlike the single-script version this replaced**: the original single-flat-script endpoint used plain text completion because JSON mode was unreliable for that free-form prose task. Segments are structured data (an array), which is the same shape `/api/story/scenes` already gets right reliably in JSON mode — the failure mode here is different (wrong count / imbalance, not empty output), which is why it's handled with content validation rather than a mode switch.

**Why a Hugging Face Space, not the `kokoro-js` npm package**: an earlier version ran `kokoro-js` directly in the Next.js process. Turbopack rewrites module paths, which broke `kokoro-js`'s internal resolution of its own bundled voice files, and offloading the ONNX inference to a remote Space matters on a memory-constrained dev machine regardless.

**Errors**

| Status | Cause |
|---|---|
| 400 | `story` missing or empty |
| 500 | `GROQ_API_KEY` not configured |
| 500 | Narration segment generation failed (all attempts *and* the deterministic fallback had nothing to work with — i.e. Groq returned nothing usable at all) |
| 500 | The Kokoro Space call failed, or `ffmpeg`/`ffprobe` isn't on `PATH` |

---

## `POST /api/story/scenes/video`

Generates (or mocks) a short real motion clip for **one** scene's already-generated image, via image-to-video. The frontend calls this once per scene, sequentially, after narration — same pattern as `/api/story/scenes/image`.

**Request body**

```json
{ "imageUrl": "https://....hf.space/.../image.webp?...", "motionPrompt": "Ghibli style young monk sitting by a river, gentle breeze, cinematic" }
```

**Response** `200 OK` (always — a failed clip is not a fatal error, see below)

```json
{ "videoUrl": "https://....hf.space/.../output.mp4", "seed": 42, "mock": false }
```

- `mock: true` (default — see `MOCK_SCENE_VIDEO` in `.env`) skips the real Space entirely; `videoUrl` is `null` and the frontend falls back to that scene's static image with a Ken Burns pan only.
- On a real but failed generation, this still returns `200` with `videoUrl: null` and an `error` field, rather than `500` — motion is an enhancement, not a requirement, so a failed clip degrades to the static-image fallback instead of breaking the whole video.

**What it does internally (non-mock)**: calls `generateSceneClip` (`src/lib/ltxVideo.ts`), a cached `@gradio/client` connection to `Lightricks/ltx-video-distilled`'s `/image_to_video` endpoint, `mode: "image-to-video"`, `duration_ui: 4.5` seconds, at the same 576×1024 portrait frame as the scene images.

**Why this is mocked by default, unlike scene images**: this Space runs on ZeroGPU — a GPU-minutes quota shared across *every* ZeroGPU Space on the Hugging Face account, not per-Space. It was exhausted after a single call to an unrelated ZeroGPU Space earlier in this project's development. Video diffusion is also far more compute-heavy than image generation or TTS, and there's no CPU fallback (unlike the TTS Space) because it would be far too slow to be usable. Leave `MOCK_SCENE_VIDEO=true` unless you specifically want real clips and are prepared for the quota risk.

**Why 4.5 seconds**: the Space's own `duration_ui` parameter caps at 8.5s regardless of what's requested. A scene's remaining time (its narration segment's duration, typically 10-17s) beyond the clip is filled by freezing into the static image + Ken Burns pan (`src/remotion/StoryVideo.tsx`), not by looping the clip — LTX clips aren't guaranteed to loop seamlessly.

---

## `POST /api/story/video`

Renders the final narrated video from a set of scenes and a narration track. This is the slow route — expect tens of seconds.

**Request body**

```json
{
  "scenes": [
    {
      "imageUrl": "https://....hf.space/.../image.webp?...",
      "videoUrl": null,
      "caption": "The overwhelmed young monk",
      "subtitle": "Arjun, a young monk, woke each morning with a heavy heart...",
      "durationInSeconds": 14.8
    }
  ],
  "audioUrl": "/generated/narration-<uuid>.mp3"
}
```

| Field | Type | Notes |
|---|---|---|
| `scenes` | array | a scene is dropped server-side if its `imageUrl` is falsy or `durationInSeconds <= 0`; at least one usable scene is required |
| `scenes[].videoUrl` | `string \| null` | from `/api/story/scenes/video`; `null` means static image + Ken Burns only for that scene |
| `scenes[].subtitle` | `string` | the exact narration text spoken during this scene — shown as a subtitle, not the short `caption` |
| `scenes[].durationInSeconds` | `number` | **this scene's own slice of the narration** (from `/api/story/narration`'s `segments[i].durationInSeconds`), not an even division of the total |
| `audioUrl` | `string` | root-relative or absolute; root-relative paths are resolved against the request's own origin |

Note there's no longer a top-level `durationInSeconds` — the video's total length is the *sum* of `scenes[].durationInSeconds`, computed identically on both the server (`sumSceneSeconds` in `src/remotion/Root.tsx`, used by `calculateMetadata`) and the client (same function, used to size the `@remotion/player` preview).

**Response** `200 OK`

```json
{ "videoUrl": "/generated/video-<uuid>.mp4" }
```

9:16 (720×1280), 30fps, h264/aac.

**What it does internally**

1. Resolves every `imageUrl`/`videoUrl`/`audioUrl` to an absolute URL using the request's own origin, since Remotion's headless Chromium render needs fully-qualified URLs.
2. Bundles the Remotion composition (`@remotion/bundler`'s `bundle()`, entry point `src/remotion/index.ts`) — cached per server process after the first call.
3. `selectComposition` resolves metadata via `calculateMetadata`, which sums every scene's `durationInSeconds` for the total `durationInFrames`.
4. `renderMedia` renders to `public/generated/video-<uuid>.mp4` with `codec: "h264"`.

See `src/remotion/StoryVideo.tsx` for the per-scene composition: each scene occupies exactly its own `durationInSeconds` (scenes are placed back to back by a running cursor, not divided evenly). Within a scene: if `videoUrl` is set, it plays for `min(scene duration, 4.5s)`, then the remaining time (if any) shows the static image with a Ken Burns zoom (`scale 1 → 1.12`); if `videoUrl` is `null`, it's Ken Burns for the whole scene. A 12-frame fade in/out plays between scenes, and `subtitle` is overlaid at the bottom over a gradient scrim for the scene's full duration. A single `<Audio>` spans the whole composition.

**Errors**

| Status | Cause |
|---|---|
| 400 | `scenes` empty, or none have both a usable `imageUrl` and a positive `durationInSeconds` |
| 400 | `audioUrl` missing |
| 500 | Bundling, composition selection, or the render itself failed (check server logs — Remotion's own error is passed through) |

---

## Shared backend modules

These aren't routes, but are what the routes above are built on:

| Module | Responsibility |
|---|---|
| `src/lib/groq.ts` | `groqChatCompletion` (raw), `groqChatJson` (forces `response_format: json_object`), `groqChatText` (plain completion). All non-OK responses are normalized through `formatGroqError`, which special-cases HTTP 429 to extract Groq's own "try again in Ns" hint and re-word it cleanly. |
| `src/lib/gradio.ts` | `generateGhibliImage` — cached `@gradio/client` connection to the image Space. |
| `src/lib/ltxVideo.ts` | `generateSceneClip` — cached `@gradio/client` connection to the LTX-Video Space. |
| `src/lib/kokoro.ts` | `generateNarrationMp3` — cached `@gradio/client` connection to the voice Space; synthesizes one clip per segment, concatenates, retimes, and transcodes. |
| `src/lib/segmentStory.ts` | `splitStory` (pulls the trailing reference section off the narrative), `segmentNarrative` (paragraph-level balanced split, used for the story/scenes color-highlighting), and `segmentIntoSentenceGroups` (sentence-level balanced split, used as narration's deterministic fallback). All three share one balancing algorithm (`balanceIntoGroups`) that guarantees exactly N groups whenever there are at least N units. |
| `src/lib/vectorSearch.ts` | Loads `data/quotes_indexed.json` once per process and scores it against a query — no network call, no LLM. |
