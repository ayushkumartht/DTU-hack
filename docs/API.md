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

Writes a short English narration script from the story and voices it.

**Request body**

```json
{ "story": "<the full story text>", "problem": "<original situation text>" }
```

**Response** `200 OK`

```json
{
  "audioUrl": "/generated/narration-<uuid>.mp3",
  "script": "<the ~230-270 word English narration that was voiced>",
  "durationInSeconds": 28.4
}
```

`audioUrl` is a root-relative path served straight out of `public/generated/` (gitignored, created at runtime).

**What it does internally**

1. `writeNarrationScript`: asks Groq (plain text, not JSON mode — see "Why text mode" below) for a 230-270 word flowing English narration (`temperature: 0.6`, `max_tokens: 4000`), with **one retry** if the response comes back empty. Strips a stray wrapping quote/backtick if the model adds one.
2. `generateNarrationMp3` (`src/lib/kokoro.ts`): calls the public `ysharma/Make_Custom_Voices_With_KokoroTTS` Space's `/text_to_speech` endpoint with `formula: "1.0 * af_bella"` (that Space's older Kokoro v0.19 voice set doesn't include the newer `af_heart`), downloads the returned WAV, transcodes it to mp3 via `ffmpeg -codec:a libmp3lame -b:a 128k`, and reads back the exact duration via `ffprobe`.
3. Saves to `public/generated/narration-<uuid>.mp3` and deletes the intermediate WAV.

**Why text mode, not JSON mode**: this call originally used `response_format: json_object` wrapping the script in `{"script": "..."}`. In practice `openai/gpt-oss-120b` was unreliable for this specific open-ended rewriting task under JSON mode — it would sometimes spend its entire token budget on hidden reasoning and return `failed_generation: ""`. Plain text completion, with a larger budget and a retry, has been reliable in testing.

**Why a Hugging Face Space, not the `kokoro-js` npm package**: an earlier version ran `kokoro-js` directly in the Next.js process. Two real problems showed up: Turbopack rewrites module paths, which breaks `kokoro-js`'s internal resolution of its bundled voice files (worked around at the time via `serverExternalPackages`, since removed since the package is no longer used); and a single local `generate()` call caps out at roughly 25-30 seconds of audio *regardless of input length* (confirmed: 130 words and 216 words both produced ~26-27s). The remote Space has neither limitation, and offloads the ONNX inference entirely, which matters on a memory-constrained dev machine.

**Errors**

| Status | Cause |
|---|---|
| 400 | `story` missing or empty |
| 500 | `GROQ_API_KEY` not configured |
| 500 | Narration script generation failed (both attempts) |
| 500 | The Kokoro Space call failed, or `ffmpeg`/`ffprobe` isn't on `PATH` |

---

## `POST /api/story/video`

Renders the final narrated video from a set of scenes and a narration track. This is the slow route — expect tens of seconds.

**Request body**

```json
{
  "scenes": [
    { "imageUrl": "/mock/scene-placeholder.webp", "caption": "The overwhelmed young monk" }
  ],
  "audioUrl": "/generated/narration-<uuid>.mp3",
  "durationInSeconds": 28.4
}
```

| Field | Type | Notes |
|---|---|---|
| `scenes` | `{ imageUrl: string \| null; caption: string }[]` | scenes with a `null` `imageUrl` (still generating / failed) are filtered out server-side; at least one usable scene is required |
| `audioUrl` | `string` | root-relative (`/generated/...`) or absolute — root-relative paths are resolved against the request's own origin |
| `durationInSeconds` | `number` | the real measured narration duration from `/api/story/narration`; falls back to 45 if omitted or invalid |

**Response** `200 OK`

```json
{ "videoUrl": "/generated/video-<uuid>.mp4" }
```

9:16 (720×1280), 30fps, h264/aac, duration matches `durationInSeconds` exactly (video length is driven by the audio, not the other way around).

**What it does internally**

1. Resolves every `imageUrl`/`audioUrl` to an absolute URL using the request's own origin (`req.nextUrl.origin`), since Remotion's headless Chromium render needs fully-qualified URLs, not root-relative paths.
2. Bundles the Remotion composition (`@remotion/bundler`'s `bundle()`, entry point `src/remotion/index.ts`) — cached per server process after the first call, since the output is immutable for the process's lifetime.
3. `selectComposition` resolves the composition's metadata: `src/remotion/Root.tsx`'s `calculateMetadata` sets `durationInFrames = round(audioDurationInSeconds * 30)`, which is why the video always matches the narration length.
4. `renderMedia` renders to `public/generated/video-<uuid>.mp4` with `codec: "h264"`.

See `src/remotion/StoryVideo.tsx` for the actual per-scene composition: each scene gets an equal share of the timeline (the last scene absorbs any rounding remainder), a slow Ken Burns zoom (`scale 1 → 1.12` over its own duration), a 12-frame fade in/out between scenes, and its caption overlaid at the bottom over a gradient scrim. A single `<Audio>` spans the whole composition.

**Errors**

| Status | Cause |
|---|---|
| 400 | `scenes` empty, or none have a non-null `imageUrl` |
| 400 | `audioUrl` missing |
| 500 | Bundling, composition selection, or the render itself failed (check server logs — Remotion's own error is passed through) |

---

## Shared backend modules

These aren't routes, but are what the routes above are built on:

| Module | Responsibility |
|---|---|
| `src/lib/groq.ts` | `groqChatCompletion` (raw), `groqChatJson` (forces `response_format: json_object`), `groqChatText` (plain completion). All non-OK responses are normalized through `formatGroqError`, which special-cases HTTP 429 to extract Groq's own "try again in Ns" hint and re-word it cleanly. |
| `src/lib/gradio.ts` | `generateGhibliImage` — cached `@gradio/client` connection to the image Space. |
| `src/lib/kokoro.ts` | `generateNarrationMp3` — cached `@gradio/client` connection to the voice Space, plus the WAV→mp3 transcode and duration probe. |
| `src/lib/segmentStory.ts` | `splitStory` (pulls the trailing reference section off the narrative) and `segmentNarrative` (groups paragraphs into N balanced, contiguous chunks — guarantees exactly N chunks whenever there are at least N paragraphs). |
| `src/lib/vectorSearch.ts` | Loads `data/quotes_indexed.json` once per process and scores it against a query — no network call, no LLM. |
