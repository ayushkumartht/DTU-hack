/**
 * Source of truth for the interactive docs. Every Mermaid diagram and every clickable box's
 * explanation lives here, so the page and docs/ARCHITECTURE.md are generated from the same text.
 * No imports: this file is read by both the browser and a Node script.
 */

export interface NodeDetail {
  title: string;
  text: string;
  /** Repo paths that implement this box. */
  files?: string[];
  /** Keys of package.json dependencies, shown with their installed version. */
  pkg?: string[];
  /** Short facts shown as chips. */
  facts?: string[];
}

export interface DiagramDef {
  id: string;
  label: string;
  title: string;
  summary: string;
  kind: "flowchart" | "sequence";
  code: string;
  /** For sequence diagrams: the steps, shown beside the picture. */
  steps?: string[];
  details?: Record<string, NodeDetail>;
}

/* ------------------------------------------------------------------ architecture */

const ARCHITECTURE = `flowchart LR
  classDef ui fill:#fff7ee,stroke:#c2570c,stroke-width:1.5px,color:#111
  classDef api fill:#eef2ff,stroke:#0b1f4d,stroke-width:1.5px,color:#111
  classDef lib fill:#f8fafc,stroke:#475569,stroke-width:1.5px,color:#111
  classDef data fill:#ecf7ea,stroke:#0f6e06,stroke-width:1.5px,color:#111
  classDef ai fill:#fdf2f8,stroke:#9d174d,stroke-width:1.5px,color:#111
  classDef media fill:#f5f5f4,stroke:#44403c,stroke-width:1.5px,color:#111

  STU["Reel Studio<br/>browser"]:::ui

  subgraph API["Route handlers"]
    TCH["teachings"]:::api
    SCR["script"]:::api
    NAR["narration"]:::api
    CLP["clip"]:::api
    RND["render"]:::api
  end
  subgraph LIB["Core libraries"]
    SRCH["teachings and search"]:::lib
    PROM["prompts"]:::lib
    AUTH["authenticity"]:::lib
  end
  subgraph EXT["External services"]
    GROQ["Groq"]:::ai
    EDGE["Neural voices"]:::ai
    KOK["Kokoro"]:::ai
    LTX["LTX-Video"]:::ai
  end
  subgraph LOCAL["Local data and media"]
    TJ[("teachings.json")]:::data
    REM["Remotion"]:::media
    FFM["ffmpeg"]:::media
    QR["QR code"]:::media
  end

  STU --> TCH
  STU --> SCR
  STU --> NAR
  STU --> CLP
  STU --> RND
  TCH --> SRCH
  SCR --> SRCH
  SCR --> PROM
  SCR --> AUTH
  NAR --> AUTH
  RND --> AUTH
  SCR -->|"story, visuals"| GROQ
  NAR -->|"Hindi"| EDGE
  NAR -->|"English"| KOK
  CLP -->|"text-to-video"| LTX
  SRCH --> TJ
  NAR --> FFM
  RND --> QR
  RND --> REM`;

const ARCHITECTURE_DETAILS: Record<string, NodeDetail> = {
  LP: {
    title: "Landing page",
    text: "The public page at /. A client component with scroll-triggered motion, a real sample reel, and a live verbatim-check demo.",
    files: ["src/app/page.tsx", "src/features/landing/components/LandingPage.tsx"],
    pkg: ["next", "motion"],
  },
  STU: {
    title: "Reel Studio",
    text: "The working tool at /reel. One hook (useReel) drives the whole flow: pick a teaching, write the script, then narration, motion clips and render, one step at a time.",
    files: ["src/features/reel/components/ReelExperience.tsx", "src/features/reel/hooks/useReel.ts"],
    facts: ["Locked quote beat", "Authenticity panel", "Teacher note"],
  },
  DOCS: {
    title: "Docs",
    text: "This page. Diagrams are Mermaid source rendered in the browser, with pan, zoom and clickable boxes.",
    files: ["src/features/docs/diagrams.ts", "src/features/docs/components/DiagramExplorer.tsx"],
    pkg: ["mermaid"],
  },
  TCH: {
    title: "GET /api/reel/teachings",
    text: "Lists or searches verified teachings. Only reel-ready ones are offered, because the quotation is read aloud word for word and must be short.",
    files: ["src/app/api/reel/teachings/route.ts"],
    facts: ["87 verified", "69 reel-ready", "60 excluded"],
  },
  SCR: {
    title: "POST /api/reel/script",
    text: "Picks the teaching, then makes two separate Groq calls: the Hindi story with a teacher note, then English shot prompts. The quote block is built from the record, never by the model. Failed audits earn a retry with the exact problems.",
    files: ["src/app/api/reel/script/route.ts"],
    facts: ["Audit before returning", "Rate-limit aware", "QR included"],
  },
  HK: {
    title: "POST /api/reel/hooks",
    text: "Writes five competing opening lines in different forms (question, blunt statement, image, contradiction, direct address) so the creator can pick one.",
    files: ["src/app/api/reel/hooks/route.ts"],
  },
  NAR: {
    title: "POST /api/reel/narration",
    text: "Re-verifies the quote, then voices each of the five beats as its own clip so every scene's real length is known. English uses Kokoro; every other language uses Microsoft neural voices. If a voice fails, the reel becomes subtitle-only with estimated timings.",
    files: ["src/app/api/reel/narration/route.ts", "src/lib/tts/edge.ts", "src/lib/kokoro.ts"],
    facts: ["Pause between beats", "Fitted to 30-60 s"],
  },
  CLP: {
    title: "POST /api/reel/clip",
    text: "One text-to-video clip per call. The client calls it once per story scene, sequentially, because the free GPU is shared. Always answers 200: a missing clip is a fallback, not an error.",
    files: ["src/app/api/reel/clip/route.ts", "src/lib/ltxVideo.ts", "src/lib/clipFiles.ts"],
    facts: ["~4.5 s clips", "Last frame saved", "Never throws"],
  },
  RND: {
    title: "POST /api/reel/render",
    text: "Ignores any quote the browser sends. It rebuilds the quote and the QR from the verified record, re-audits the story, then renders a 9:16 MP4 and writes a provenance JSON beside it. A failed check returns 422 and renders nothing.",
    files: ["src/app/api/reel/render/route.ts"],
    facts: ["720x1280", "30 fps", "H.264 + AAC"],
  },
  GEN: {
    title: "GET /generated/*",
    text: "Serves media written at runtime (narration, clips, reels). next start only serves files that existed at boot, so this route serves them with Range support for seeking.",
    files: ["src/app/generated/[...file]/route.ts"],
  },
  AUTH: {
    title: "Authenticity engine",
    text: "canonical() normalises Unicode, quotes, dashes and whitespace and nothing else, so a changed word always fails. buildQuoteBlock() copies text from the record. detectFabricatedQuotes() flags quotation marks and phrases like 'Vivekananda said' in English, Hindi and Bengali.",
    files: ["src/lib/authenticity.ts"],
    facts: ["No model call in this file", "Runs in 3 places"],
  },
  PROM: {
    title: "Prompt library",
    text: "Every prompt in one file: guardrails, Hindi style rules, beat structure, the teacher note, and a separate English-only cinematographer prompt. It also holds quality checks that reject weak scripts before they are voiced.",
    files: ["src/lib/prompts.ts"],
  },
  DUR: {
    title: "Duration control",
    text: "Spoken-word budgets per language, and fitToWindow(), which nudges playback speed so the total lands inside 30-60 seconds.",
    files: ["src/lib/duration.ts"],
    facts: ["Target 50 s"],
  },
  SRCH: {
    title: "Teachings and search",
    text: "Loads data/teachings.json once, exposes only verified entries, and reuses the local TF-IDF index to match a student's words (Hindi, English or Hinglish) to a card. No network, no embeddings API.",
    files: ["src/lib/teachings.ts", "src/lib/vectorSearch.ts"],
  },
  TJ: {
    title: "teachings.json",
    text: "Per-language verbatim variants with their own author and citation, topic tags, and a quarantine list with a stated reason for every excluded card.",
    files: ["data/teachings.json", "scripts/build_teachings.py"],
    facts: ["87 verified", "60 quarantined"],
  },
  IDX: {
    title: "quotes_indexed.json",
    text: "Pre-built TF-IDF vectors over 2,552 terms, including Devanagari tokens.",
    files: ["data/quotes_indexed.json"],
  },
  GROQ: {
    title: "Groq - gpt-oss-120b",
    text: "A reasoning model, so hidden thinking counts against max_tokens. The story call uses medium effort for better Hindi; the visual call uses low. Rate limits are read from the error and waited out once.",
    files: ["src/lib/groq.ts"],
    facts: ["Free tier", "JSON mode"],
  },
  EDGE: {
    title: "Microsoft neural voices",
    text: "Free neural voices for Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada and Indian English, with no GPU quota. Slowed to 0.92x so each idea can land. An unofficial route, so an official TTS API is the production choice.",
    files: ["src/lib/tts/edge.ts"],
    pkg: ["msedge-tts"],
  },
  KOK: {
    title: "Kokoro TTS Space",
    text: "English-only voice on a free Hugging Face Space. One clip per beat, joined with ffmpeg.",
    files: ["src/lib/kokoro.ts"],
    pkg: ["@gradio/client"],
  },
  LTX: {
    title: "LTX-Video Space",
    text: "Text-to-video from the detailed English shot prompt. Runs on ZeroGPU, a small daily quota per Hugging Face account, so it is treated as an enhancement that can fail.",
    files: ["src/lib/ltxVideo.ts"],
    pkg: ["@gradio/client"],
    facts: ["576x1024", "~4.5 s", "Quota limited"],
  },
  REM: {
    title: "Remotion renderer",
    text: "React components rendered to video by headless Chromium. Beats become Sequences; clips play in slow motion then hold on their last frame; Devanagari fonts are bundled so Hindi never renders as empty boxes.",
    files: ["src/remotion/ReelVideo.tsx", "src/remotion/Root.tsx", "src/remotion/fonts.ts"],
    pkg: ["remotion", "@remotion/renderer", "@remotion/bundler"],
  },
  FFM: {
    title: "ffmpeg and ffprobe",
    text: "Measures real clip lengths, joins narration, inserts pauses, extracts each clip's last frame, and muxes audio in the renderer.",
    files: ["src/lib/ffmpegPath.ts"],
  },
  QR: {
    title: "QR generator",
    text: "Error-correction level H so the code still scans after video compression. It only accepts belurmath.org links.",
    files: ["src/lib/qrcode.ts"],
    pkg: ["qrcode"],
  },
};

/* ------------------------------------------------------------------ pipeline (sequence) */

const PIPELINE = `sequenceDiagram
  autonumber
  actor S as Student or teacher
  participant UI as Reel Studio
  participant API as Next.js API
  participant DB as teachings.json
  participant LLM as Groq
  participant TTS as Neural voice
  participant GPU as LTX-Video
  participant RM as Remotion

  S->>UI: Pick a teaching or describe a struggle
  UI->>API: POST /api/reel/script
  API->>DB: Find the verified teaching
  API->>LLM: Story prompt (quote kept private)
  LLM-->>API: Hook, situation, turn, takeaway, teacher note
  API->>API: Audit: no quotations, no attribution
  alt audit or style check fails
    API->>LLM: Retry with the exact problems
  end
  API->>LLM: English shot prompts
  API-->>UI: Script, QR and provenance
  S->>UI: Create video
  UI->>API: POST /api/reel/narration
  API->>API: assertVerbatim(quote)
  API->>TTS: One clip per beat
  TTS-->>API: Audio and real durations
  loop Three story scenes
    UI->>API: POST /api/reel/clip
    API->>GPU: text-to-video
    GPU-->>API: Clip, or quota error and a fallback
  end
  UI->>API: POST /api/reel/render
  API->>API: Rebuild quote and QR from the record, re-audit
  API->>RM: Compose the 9:16 reel
  RM-->>API: MP4 and provenance JSON
  API-->>UI: Download links`;

const PIPELINE_STEPS = [
  "The script call picks a verified teaching and writes the story in two focused Groq calls, so each task gets the model's full attention.",
  "The audit runs before anything is returned. A script with a quotation mark or an attribution is rewritten, not shown.",
  "Narration measures each beat's real duration. Those durations, not an even split, set every scene's length.",
  "Motion clips are made one at a time. If the daily GPU quota is gone, the remaining scenes use a calm editorial background.",
  "Render never trusts the browser: the quote and QR are rebuilt from the verified record before a single frame is drawn.",
];

/* ------------------------------------------------------------------ authenticity */

const AUTHENTICITY = `flowchart TD
  classDef ok fill:#ecf7ea,stroke:#0f6e06,stroke-width:1.5px,color:#111
  classDef warn fill:#fff7ee,stroke:#c2570c,stroke-width:1.5px,color:#111
  classDef bad fill:#fef2f2,stroke:#b91c1c,stroke-width:1.5px,color:#111
  classDef step fill:#eef2ff,stroke:#0b1f4d,stroke-width:1.5px,color:#111

  REC[("Verified record<br/>Belur Math card")]:::ok
  BQ["buildQuoteBlock<br/>copy the text from the record"]:::ok
  LLM["LLM writes the story<br/>the quote is private context"]:::step
  DET["detectFabricatedQuotes<br/>quotation marks, 'Vivekananda said'"]:::step
  OK1{"Clean?"}:::warn
  RETRY["Rewrite with the exact problems"]:::warn
  NARR["Narration route<br/>assertVerbatim"]:::step
  OK2{"Quote identical?"}:::warn
  REND["Render route<br/>rebuild quote and QR from the record<br/>re-audit the story"]:::step
  OK3{"Still clean?"}:::warn
  OUT["MP4 and provenance.json"]:::ok
  BLOCK["422: render blocked"]:::bad

  REC --> BQ
  REC -.->|"private context"| LLM
  LLM --> DET
  DET --> OK1
  OK1 -->|"no"| RETRY
  RETRY --> LLM
  OK1 -->|"yes"| NARR
  BQ --> NARR
  NARR --> OK2
  OK2 -->|"no"| BLOCK
  OK2 -->|"yes"| REND
  REND --> OK3
  OK3 -->|"no"| BLOCK
  OK3 -->|"yes"| OUT`;

const AUTHENTICITY_DETAILS: Record<string, NodeDetail> = {
  REC: {
    title: "Verified record",
    text: "A Belur Math card that parsed cleanly: the quote, its author line and its citation, per language. Anything that did not parse is quarantined and cannot be reached.",
    files: ["data/teachings.json"],
  },
  BQ: {
    title: "buildQuoteBlock()",
    text: "Assembles the quote shown in the reel straight from the record. There is no model call anywhere in src/lib/authenticity.ts.",
    files: ["src/lib/authenticity.ts"],
  },
  LLM: {
    title: "The story model",
    text: "Told never to quote, paraphrase as his words, or attribute anything to Swami Vivekananda. It sees the teaching only as private context and may explain the idea, never state it as his sentence.",
    files: ["src/lib/prompts.ts"],
  },
  DET: {
    title: "detectFabricatedQuotes()",
    text: "Finds any quoted span that is not a known verified variant, and attribution phrases in English, Hindi and Bengali.",
    files: ["src/lib/authenticity.ts"],
  },
  OK1: { title: "First gate", text: "Authenticity failures outrank style problems when choosing which script to keep." },
  RETRY: {
    title: "Retry with feedback",
    text: "The next attempt is told exactly what was wrong ('you wrote a quotation', 'hook is 17 words'), which fixes problems far more reliably than a blind retry.",
    files: ["src/app/api/reel/script/route.ts"],
  },
  NARR: {
    title: "assertVerbatim()",
    text: "Throws, rather than warns, if the quote differs from the record by anything beyond Unicode, quote-style, dash and whitespace normalisation.",
    files: ["src/app/api/reel/narration/route.ts"],
  },
  OK2: { title: "Second gate", text: "A drifted quote is never voiced." },
  REND: {
    title: "Render-time rebuild",
    text: "Whatever quote the browser sends is ignored. The quote and QR are rebuilt from the record and the story is audited again, so a hand-edited script cannot slip through.",
    files: ["src/app/api/reel/render/route.ts"],
  },
  OK3: { title: "Third gate", text: "Hand-edited beats are re-checked for invented quotations and attributions." },
  OUT: {
    title: "MP4 and provenance",
    text: "The video carries the source badge, the quote card and a scannable QR. Beside it, a JSON file records the teaching id, the verbatim quote, the source URL, the model and the time.",
  },
  BLOCK: { title: "Blocked", text: "HTTP 422 and nothing is rendered. This is the behaviour the landing page's live demo shows." },
};

/* ------------------------------------------------------------------ data */

const DATA = `flowchart LR
  classDef src fill:#fff7ee,stroke:#c2570c,stroke-width:1.5px,color:#111
  classDef step fill:#eef2ff,stroke:#0b1f4d,stroke-width:1.5px,color:#111
  classDef ok fill:#ecf7ea,stroke:#0f6e06,stroke-width:1.5px,color:#111
  classDef bad fill:#fef2f2,stroke:#b91c1c,stroke-width:1.5px,color:#111

  WP["Belur Math WordPress API<br/>media.belurmath.org"]:::src
  SC["scripts/scrape.py"]:::step
  Q[("vivekananda_quotes.json<br/>147 cards")]:::src
  BT["scripts/build_teachings.py"]:::step
  SPLIT["Split raw_html on hr<br/>one block per language"]:::step
  PARSE["Find quote, author, citation"]:::step
  CHK{"Checks pass?"}:::step
  V[("Verified<br/>87 teachings")]:::ok
  QU[("Quarantined<br/>60, reason for each")]:::bad
  FIT["Reel-fit filter<br/>quote up to 320 characters"]:::step
  R69["69 reel-ready"]:::ok
  IDX[("TF-IDF index<br/>2,552 terms")]:::ok

  WP --> SC
  SC --> Q
  Q --> BT
  BT --> SPLIT
  SPLIT --> PARSE
  PARSE --> CHK
  CHK -->|"yes"| V
  CHK -->|"no"| QU
  V --> FIT
  FIT --> R69
  Q --> IDX
  IDX -.-> R69`;

const DATA_DETAILS: Record<string, NodeDetail> = {
  WP: { title: "Belur Math media archive", text: "The official source of the verified quotation cards, read through its public WordPress API.", files: ["scripts/scrape.py"] },
  SC: { title: "scrape.py", text: "Fetches every card tagged 'quotations' and keeps the raw HTML, link, image and date.", files: ["scripts/scrape.py"] },
  Q: { title: "147 raw cards", text: "The flat 'quote' field often holds the same teaching in two or three languages, each with its own citation, so the structured raw_html is parsed instead.", files: ["data/vivekananda_quotes.json"] },
  BT: { title: "build_teachings.py", text: "Turns each card into per-language verbatim variants and decides, card by card, whether it can be trusted.", files: ["scripts/build_teachings.py"] },
  SPLIT: { title: "Language blocks", text: "Belur Math separates languages with horizontal rules. 133 of 147 cards use them, which is why Bengali official translations can be paired with the English original." },
  PARSE: { title: "Quote, author, citation", text: "Text-based attribution detection handles every layout seen in the data: a separate author line, a combined 'Swami Vivekananda (citation)' line, or a dash-prefixed name." },
  CHK: {
    title: "The checks",
    text: "A card is quarantined if it has no citation, no author line, a citation leaking into the quote body, a Bengali or Hindi variant mixing in English, or looks like a hymn or a verse written about him.",
    facts: ["No guessing", "Reason recorded"],
  },
  V: { title: "87 verified", text: "86 have an English variant and 65 also carry an official Bengali one. Only one Hindi variant survived, so Hindi reels explain in Hindi and read the quote in its verified language.", files: ["data/teachings.json"] },
  QU: { title: "60 quarantined", text: "Including hymns he composed, verses written about him, and a scripture citation. Showing any of them as his quotation would be exactly the failure the case study warns about.", facts: ["Kept visible in the UI"] },
  FIT: { title: "Reel-fit filter", text: "The quote is read aloud verbatim, so only quotations of up to 320 characters (about 12 seconds) are offered.", files: ["src/lib/teachings.ts"] },
  R69: { title: "69 reel-ready", text: "The set a student or teacher can choose from in the studio." },
  IDX: { title: "TF-IDF index", text: "Cosine similarity over weighted terms with a small keyword bonus. Tokenisation keeps Devanagari sequences, so Hindi and Hinglish queries match.", files: ["src/lib/vectorSearch.ts", "data/quotes_indexed.json"] },
};

/* ------------------------------------------------------------------ resilience */

const RESILIENCE = `flowchart TD
  classDef step fill:#eef2ff,stroke:#0b1f4d,stroke-width:1.5px,color:#111
  classDef warn fill:#fff7ee,stroke:#c2570c,stroke-width:1.5px,color:#111
  classDef ok fill:#ecf7ea,stroke:#0f6e06,stroke-width:1.5px,color:#111

  START["Make a reel"]:::step
  G1{"Groq rate limit?"}:::warn
  G2["Wait up to 45 s<br/>keep the best script"]:::warn
  V1["Narration<br/>Microsoft neural voice"]:::step
  V2{"Voice failed?"}:::warn
  V3["Subtitle-only reel<br/>estimated timings"]:::warn
  C1["LTX motion clips x 3"]:::step
  C2{"GPU quota or error?"}:::warn
  C3["Cream editorial background<br/>no image, no clip"]:::warn
  C4["Slow-motion clip<br/>then hold on its last frame"]:::ok
  R1["Remotion render"]:::step
  DONE["Reel always finishes"]:::ok

  START --> G1
  G1 -->|"yes"| G2
  G2 --> V1
  G1 -->|"no"| V1
  V1 --> V2
  V2 -->|"yes"| V3
  V3 --> C1
  V2 -->|"no"| C1
  C1 --> C2
  C2 -->|"yes"| C3
  C2 -->|"no"| C4
  C3 --> R1
  C4 --> R1
  R1 --> DONE`;

const RESILIENCE_DETAILS: Record<string, NodeDetail> = {
  START: { title: "Make a reel", text: "Every step after the script is allowed to degrade, so a demo never ends on an error screen." },
  G1: { title: "Groq free tier", text: "Roughly 8,000 tokens a minute. The story and visual calls run back to back, so a rate limit between them is common.", files: ["src/lib/groq.ts"] },
  G2: { title: "Wait, do not fall back", text: "The error says 'try again in N seconds'. Waiting once beats generic visuals. The best script already obtained is always kept.", files: ["src/app/api/reel/script/route.ts"] },
  V1: { title: "Narration", text: "English uses Kokoro; every other language uses Microsoft neural voices, slowed to 0.92x.", files: ["src/app/api/reel/narration/route.ts"] },
  V2: { title: "Voice check", text: "A network failure here must not lose the story." },
  V3: { title: "Subtitle-only", text: "Durations are estimated from word counts and the reel still renders with captions.", files: ["src/lib/duration.ts"] },
  C1: { title: "Motion clips", text: "Hook, situation and turn. The quote and takeaway sit on a calm blurred frame so the text stays readable.", files: ["src/features/reel/hooks/useReel.ts"] },
  C2: { title: "Quota check", text: "ZeroGPU quota is shared per Hugging Face account. Once it is gone, remaining scenes skip the call." },
  C3: {
    title: "Editorial fallback",
    text: "Drawn by Remotion with no external service: a warm cream background, drifting soft light and large type, in the calm style of Belur Math's own videos.",
    files: ["src/remotion/ReelVideo.tsx"],
  },
  C4: { title: "Clip behaviour", text: "Clips play at 0.5x to 1x, never faster, so they fill more of the beat. The remaining time holds on the clip's last frame with a slow zoom." },
  R1: { title: "Render", text: "Remotion composes captions, badge, quote card and QR over whatever visuals exist.", files: ["src/app/api/reel/render/route.ts"] },
  DONE: { title: "Always finishes", text: "Every fallback produces a valid, watchable reel with the same authenticity guarantees." },
};

/* ------------------------------------------------------------------ tech stack */

const STACK = `flowchart LR
  classDef fe fill:#fff7ee,stroke:#c2570c,stroke-width:1.5px,color:#111
  classDef be fill:#eef2ff,stroke:#0b1f4d,stroke-width:1.5px,color:#111
  classDef ai fill:#fdf2f8,stroke:#9d174d,stroke-width:1.5px,color:#111
  classDef md fill:#f5f5f4,stroke:#44403c,stroke-width:1.5px,color:#111
  classDef dt fill:#ecf7ea,stroke:#0f6e06,stroke-width:1.5px,color:#111

  subgraph FE["Frontend"]
    NEXT["Next.js App Router"]:::fe
    REACT["React 19"]:::fe
    TS["TypeScript"]:::fe
    MOT["Motion"]:::fe
    MERM["Mermaid"]:::fe
    CSS["CSS Modules + Arc UI"]:::fe
  end
  subgraph BE["Backend"]
    RH["Route handlers"]:::be
    NODE["Node.js"]:::be
    GRAD["Gradio client"]:::be
  end
  subgraph AI["AI services"]
    GQ["Groq"]:::ai
    LT["LTX-Video"]:::ai
    KO["Kokoro"]:::ai
    ED["Microsoft neural voices"]:::ai
  end
  subgraph MD["Media"]
    RM["Remotion"]:::md
    FF["ffmpeg"]:::md
    QRC["qrcode"]:::md
  end
  subgraph DT["Data and tooling"]
    PY["Python scripts"]:::dt
    JS["JSON datasets"]:::dt
    TF["TF-IDF search"]:::dt
  end

  NEXT --> REACT
  NEXT --> TS
  REACT --> MOT
  NEXT --> MERM
  NEXT --> CSS
  NEXT --> RH
  RH --> NODE
  RH --> GRAD
  RH --> GQ
  GRAD --> LT
  GRAD --> KO
  RH --> ED
  RH --> RM
  RM --> FF
  RH --> QRC
  PY --> JS
  JS --> TF
  RH --> TF`;

const STACK_DETAILS: Record<string, NodeDetail> = {
  NEXT: { title: "Next.js", text: "App Router with route handlers on the Node runtime. This version differs from older ones, so the bundled docs in node_modules/next/dist/docs were followed.", pkg: ["next"], files: ["src/app"] },
  REACT: { title: "React", text: "Client components for the studio, the docs explorer and the landing page.", pkg: ["react", "react-dom"] },
  TS: { title: "TypeScript", text: "Strict types across routes, hooks and the Remotion props; npx tsc --noEmit gates every change.", pkg: ["typescript"] },
  MOT: { title: "Motion", text: "Scroll reveals, the flowchart arrows drawing in, and the scroll-linked rail. All of it is disabled for users who prefer reduced motion.", pkg: ["motion"] },
  MERM: { title: "Mermaid", text: "Renders every diagram on this page from text, in the browser. Click handling is attached to the generated SVG.", pkg: ["mermaid"], files: ["src/features/docs/components/DiagramExplorer.tsx"] },
  CSS: { title: "CSS Modules and Arc UI", text: "Hand-written CSS modules; the Arc component set powers the studio, while the landing page and docs use none of it.", pkg: ["class-variance-authority", "@base-ui/react"] },
  RH: { title: "Route handlers", text: "Every backend endpoint lives under src/app/api. All are POST except teachings and the file server.", files: ["src/app/api/reel"] },
  NODE: { title: "Node.js", text: "Needed for child_process (ffmpeg), the filesystem and Remotion's renderer, so these routes cannot run on the Edge runtime." },
  GRAD: { title: "Gradio client", text: "Talks to Hugging Face Spaces: Kokoro for English voice and LTX-Video for motion.", pkg: ["@gradio/client"], files: ["src/lib/ltxVideo.ts", "src/lib/kokoro.ts"] },
  GQ: { title: "Groq", text: "Hosts the openai/gpt-oss-120b chat model used for the story, the visuals and the hooks.", files: ["src/lib/groq.ts"] },
  LT: { title: "LTX-Video", text: "Lightricks' distilled model, called through its Space.", files: ["src/lib/ltxVideo.ts"] },
  KO: { title: "Kokoro TTS", text: "English narration.", files: ["src/lib/kokoro.ts"] },
  ED: { title: "Microsoft neural voices", text: "Hindi and other Indian languages, through the msedge-tts package.", pkg: ["msedge-tts"], files: ["src/lib/tts/edge.ts"] },
  RM: { title: "Remotion", text: "Programmatic video from React: compositions, sequences, the bundler and the renderer.", pkg: ["remotion", "@remotion/renderer", "@remotion/bundler", "@remotion/google-fonts"], files: ["src/remotion"] },
  FF: { title: "ffmpeg", text: "Used directly for audio joining and frame extraction, and by Remotion for muxing.", files: ["src/lib/ffmpegPath.ts"] },
  QRC: { title: "qrcode", text: "Generates the Belur Math QR as a data URI.", pkg: ["qrcode"], files: ["src/lib/qrcode.ts"] },
  PY: { title: "Python scripts", text: "Offline data work: scraping and building the verified dataset.", files: ["scripts/scrape.py", "scripts/build_teachings.py"] },
  JS: { title: "JSON datasets", text: "Plain files under data/, committed to the repo, so the app needs no database.", files: ["data/teachings.json", "data/quotes_indexed.json"] },
  TF: { title: "TF-IDF search", text: "A dependency-free local vector search.", files: ["src/lib/vectorSearch.ts"] },
};

/* ------------------------------------------------------------------ export */

export const DIAGRAMS: DiagramDef[] = [
  {
    id: "architecture",
    label: "Architecture",
    title: "System architecture",
    summary: "Who talks to whom. Click any box for what it does and which files implement it.",
    kind: "flowchart",
    code: ARCHITECTURE,
    details: ARCHITECTURE_DETAILS,
  },
  {
    id: "pipeline",
    label: "Reel pipeline",
    title: "From request to MP4",
    summary: "The order of every call, including the retry and the per-scene motion loop.",
    kind: "sequence",
    code: PIPELINE,
    steps: PIPELINE_STEPS,
  },
  {
    id: "authenticity",
    label: "Authenticity",
    title: "How a quotation stays verbatim",
    summary: "Three independent gates. The quote never passes through a model.",
    kind: "flowchart",
    code: AUTHENTICITY,
    details: AUTHENTICITY_DETAILS,
  },
  {
    id: "data",
    label: "Data pipeline",
    title: "From Belur Math to verified teachings",
    summary: "147 raw cards become 87 verified teachings and 60 quarantined, with a reason for each.",
    kind: "flowchart",
    code: DATA,
    details: DATA_DETAILS,
  },
  {
    id: "resilience",
    label: "Fallbacks",
    title: "What happens when something fails",
    summary: "Every external dependency can fail on a free tier. None of them ends the reel.",
    kind: "flowchart",
    code: RESILIENCE,
    details: RESILIENCE_DETAILS,
  },
  {
    id: "stack",
    label: "Tech stack",
    title: "Technology map",
    summary: "Every library and service, grouped by layer. Click one to see its version and where it is used.",
    kind: "flowchart",
    code: STACK,
    details: STACK_DETAILS,
  },
];
