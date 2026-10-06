# Learning of Vivekanand

A Next.js app that turns a personal struggle, described in Hindi or English, into a wisdom story inspired by the life and teachings of Swami Vivekananda — matched against a local index of 147 quotes from Belur Math, illustrated scene by scene in Studio Ghibli style, and narrated into a short downloadable video.

```
Your situation  →  matching quotes (local vector search)  →  Groq-written story
                                                                    │
                        ┌───────────────────────────────────────────┤
                        ▼                                           ▼
          4 scenes planned + illustrated                 English narration (TTS)
          (FLUX.1 Ghibli LoRA, one at a time)                       │
                        └───────────────────┬───────────────────────┘
                                             ▼
                              rendered MP4 (Remotion), playable + downloadable
```

## Features

- **Landing page** (`/`) — minimal, framework-free marketing page with a light/dark theme toggle.
- **Story board** (`/story-board`) — the actual tool:
  - Describe a situation in Hindi, English, or Hinglish.
  - A local TF-IDF-style vector search (no external call) matches it against 147 Vivekananda quotes scraped from Belur Math.
  - Groq (`openai/gpt-oss-120b`) streams a personalized wisdom story that weaves in a matched quote, with a references section at the end.
  - The story is split into 4 scenes; each gets a short caption and a detailed Ghibli-style image prompt, also via Groq.
  - Each scene's text is underlined (not boxed) in a color matching its scene card, so you can trace the story to its illustration.
  - Scene images generate **one at a time** (not in parallel) via the `FLUX.1-Studio-Ghibli-LoRA` Hugging Face Space, each in a 9:16 "phone" frame.
  - Once scenes are ready, a "Story video" panel can generate an English voiceover (Kokoro TTS, via a free public Space) and render a narrated, Ken-Burns-style MP4 (9:16, ~30-50s) with Remotion — previewable in-browser and downloadable.
- **Dev mock mode** — `MOCK_SCENE_IMAGES=true` skips the billed image Space entirely and serves a local placeholder, so UI/layout work never costs an API call.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| UI components | [Arc](https://uiarc.dev) (`@uiarc`, shadcn-compatible registry) — CSS Modules + CSS variables, not Tailwind |
| Styling | CSS Modules, Tailwind v4 (present only because the Arc/shadcn CLI requires it to run; app styling doesn't use Tailwind utility classes) |
| Story generation | [Groq](https://groq.com) Chat Completions, model `openai/gpt-oss-120b` |
| Quote matching | Local, dependency-free vector search over a pre-built index (`data/quotes_indexed.json`) |
| Scene images | [`alvarobartt/FLUX.1-Studio-Ghibli-LoRA`](https://huggingface.co/spaces/alvarobartt/FLUX.1-Studio-Ghibli-LoRA) (Hugging Face Space, via `@gradio/client`) |
| Voiceover | [`ysharma/Make_Custom_Voices_With_KokoroTTS`](https://huggingface.co/spaces/ysharma/Make_Custom_Voices_With_KokoroTTS) (Hugging Face Space, via `@gradio/client`) |
| Video | [Remotion](https://www.remotion.dev) (`remotion`, `@remotion/player`, `@remotion/bundler`, `@remotion/renderer`) |
| Audio/video muxing | system `ffmpeg` / `ffprobe` |
| Markdown rendering | `react-markdown` |

## Project structure

```
src/
  app/
    page.tsx                   landing page
    story-board/page.tsx       the dashboard
    layout.tsx                 fonts, theme-init script, Arc foundation import
    globals.css                base palette (light/dark) + Tailwind import
    api/story/                 all backend routes — see docs/API.md
  features/
    landing/components/        landing page + its own theme toggle (no Arc)
    story/
      components/               StoryForm, StoryPane, ScenePane, SceneCard, StoryVideoPanel, StoryExperience
      hooks/                     useStoryExperience (story+scenes), useStoryVideo (narration+video)
      lib/sceneColors.ts         per-scene accent colors
      types.ts, constants.ts
  components/arc/               Arc components, installed via the shadcn CLI — do not hand-edit casually
                                 (card.tsx has a local fix: its Dialog import was wired for Radix but
                                 written against the Base UI API; see the component for details)
  remotion/
    Root.tsx                    <Composition>, dynamic duration via calculateMetadata
    StoryVideo.tsx               the actual per-scene Ken Burns + caption + audio composition
    index.ts                     registerRoot entry point (used by the bundler/renderer)
  lib/
    groq.ts                     shared Groq chat helper + rate-limit-aware error formatting
    gradio.ts                   Ghibli image generation (cached Gradio client)
    kokoro.ts                   narration TTS (cached Gradio client) + mp3 transcode
    segmentStory.ts             pure text-segmentation used to color-match story ↔ scenes
    vectorSearch.ts             local quote matching
    useTheme.ts                 shared light/dark theme hook
data/                           scraped quotes + prebuilt vector index
scripts/scrape.py               the Belur Math scraper that produced data/
public/
  mock/                         dev-mode placeholder scene image
  generated/                    narration mp3s + rendered mp4s (gitignored, created at runtime)
```

## Getting started

See **[docs/SETUP.md](docs/SETUP.md)** for full setup (API keys, ffmpeg, memory notes). Quick version:

```bash
npm install
cp .env.example .env   # fill in GROQ_API_KEY and HF_TOKEN
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page, or go straight to `/story-board`.

## API

Full request/response reference: **[docs/API.md](docs/API.md)**.

| Route | Purpose |
|---|---|
| `POST /api/story` | Streams the generated wisdom story as plain text |
| `POST /api/story/scenes` | Plans 4 scenes (captions + image prompts) and color-segments the story text |
| `POST /api/story/scenes/image` | Generates (or mocks) one scene's illustration |
| `POST /api/story/narration` | Writes a short English narration script and voices it as mp3 |
| `POST /api/story/video` | Renders the narrated video and returns a downloadable mp4 URL |

## Scripts

```bash
npm run dev     # start the dev server (Turbopack)
npm run build   # production build
npm run start   # run the production build
```

## Notes

- **Rate limits**: Groq's `openai/gpt-oss-120b` is a reasoning model with highly variable hidden-reasoning token usage; calls use generous `max_tokens` and, for narration, a one-shot retry. A 429 from Groq is surfaced as a clean "try again in N seconds" message rather than the raw error body (`src/lib/groq.ts`).
- **Resource use**: video rendering runs a real headless Chromium render via Remotion on the same machine as the dev server — on a memory-constrained machine, close other heavy apps before rendering.
- **External Spaces are free but not infinite**: the Ghibli image Space and the Kokoro voice Space are public, no-API-key Hugging Face Spaces. Use `MOCK_SCENE_IMAGES=true` while iterating on UI/layout so you don't burn real generations.
