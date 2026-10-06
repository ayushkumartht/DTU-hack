# Setup

## Prerequisites

| Requirement | Why |
|---|---|
| Node.js ≥ 20.9 | Required by Next.js 16 |
| `ffmpeg` + `ffprobe` on `PATH` | Narration mp3 transcoding and duration probing (`src/lib/kokoro.ts`). Tested against ffmpeg 7.1.2; any reasonably recent build works. Install via your OS package manager (`dnf install ffmpeg`, `apt install ffmpeg`, `brew install ffmpeg`, ...). |
| A free [Groq](https://console.groq.com) account | Story generation, scene planning, narration script |
| A free [Hugging Face](https://huggingface.co) account | Scene images and narration voice (both via public Spaces — no paid tier needed) |

Everything else (the Remotion video renderer's headless Chromium, the quote vector index) is self-contained — no extra installs.

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in:

- **`GROQ_API_KEY`** — from [console.groq.com/keys](https://console.groq.com/keys). Free tier is enough; see "Rate limits" below for what to expect.
- **`HF_TOKEN`** — from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens). The default read-only token is sufficient. This isn't strictly required for the public Spaces to respond at all, but an authenticated request gets a materially better queue position than an anonymous one.
- **`MOCK_SCENE_IMAGES`** — leave as `true` while you're working on anything that isn't the image generation itself (layout, copy, the video pipeline, etc). Every scene card will show a local placeholder image instead of calling the billed Hugging Face Space. Flip to `false` only when you actually want real illustrations.

## 3. Run it

```bash
npm run dev
```

- Landing page: [http://localhost:3000](http://localhost:3000)
- The actual tool: [http://localhost:3000/story-board](http://localhost:3000/story-board)

For a production build: `npm run build && npm run start`.

## Data

`data/quotes_indexed.json` (the vector index `src/lib/vectorSearch.ts` loads) is already built and committed — you don't need to do anything to use it. If you want to refresh the underlying quotes from Belur Math:

```bash
python3 scripts/scrape.py
```

then re-run whatever indexing step produced `data/quotes_indexed.json` from `data/vivekananda_quotes.json` (the scraper itself only produces the raw JSON/CSV; see `scripts/scrape.py`'s own docstring for its output format).

## Troubleshooting

**"Groq is rate-limited right now — try again in N seconds."**
Groq's free tier has a tokens-per-minute cap. This is expected under heavy iteration (e.g. repeatedly regenerating a story). Just wait the stated number of seconds — the app surfaces Groq's own retry hint directly (`src/lib/groq.ts`).

**A scene image or the narration fails with a Space/quota error.**
Both external Spaces are free, public, and shared — they can be slow to cold-start, or occasionally rate-limit anonymous/low-priority traffic. Make sure `HF_TOKEN` is set (it measurably helps). For the image Space specifically, just use `MOCK_SCENE_IMAGES=true` unless you specifically need real output.

**Video rendering is slow or the process seems to hang.**
`/api/story/video` runs a real headless-Chromium render via Remotion on the same machine as your dev server. On a memory-constrained machine (⪅8GB RAM) with a lot of other things open, this can thrash into swap and take minutes instead of seconds, or in the worst case get killed. Close other heavy applications (browser tabs, etc.) before rendering if you hit this. A render of a ~30s, 4-scene, 720×1280 video should normally take under a minute.

**`ffmpeg: command not found` from the narration route.**
`ffmpeg`/`ffprobe` need to be on `PATH` for the Node process — install them system-wide (see Prerequisites) rather than as an npm package; there isn't one bundled.

**Files piling up in `public/generated/`.**
Narration mp3s and rendered mp4s are written there at runtime and are gitignored. There's no automatic cleanup — delete the directory's contents periodically if disk space matters to you.
