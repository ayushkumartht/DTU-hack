"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import pkg from "../../../../package.json";
import { DiagramExplorer } from "./DiagramExplorer";
import styles from "./DocsPage.module.css";

const DEPS: Record<string, string> = {
  ...((pkg as { dependencies?: Record<string, string> }).dependencies ?? {}),
  ...((pkg as { devDependencies?: Record<string, string> }).devDependencies ?? {}),
};
const v = (name: string) => (DEPS[name] ? DEPS[name].replace(/^[\^~]/, "") : "");

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "diagrams", label: "Interactive diagrams" },
  { id: "stack", label: "Tech stack" },
  { id: "api", label: "API reference" },
  { id: "decisions", label: "Design decisions" },
  { id: "limits", label: "Known limits" },
  { id: "run", label: "Run it locally" },
];

const FACTS = [
  { value: "87", label: "verified teachings" },
  { value: "60", label: "quarantined, with reasons" },
  { value: "69", label: "reel-ready quotations" },
  { value: "8", label: "languages with a voice" },
  { value: "3", label: "gates before a render" },
  { value: "9:16", label: "720 x 1280, 30 fps" },
];

type StackRow = { tech: string; version?: string; role: string };
const STACK: { group: string; rows: StackRow[] }[] = [
  {
    group: "Frontend",
    rows: [
      { tech: "Next.js", version: v("next"), role: "App Router, route handlers, fonts, image optimisation" },
      { tech: "React", version: v("react"), role: "Studio, landing page and this explorer" },
      { tech: "TypeScript", version: v("typescript"), role: "Strict typing; npx tsc --noEmit gates every change" },
      { tech: "Motion", version: v("motion"), role: "Scroll reveals, drawing arrows, progress rail (reduced-motion aware)" },
      { tech: "Mermaid", version: v("mermaid"), role: "Diagrams on this page, rendered from text in the browser" },
      { tech: "CSS Modules + Arc UI", role: "Hand-written styles; Arc components power the studio only" },
    ],
  },
  {
    group: "AI",
    rows: [
      { tech: "Groq · gpt-oss-120b", role: "Hindi story, teacher note, English shot prompts, hooks" },
      { tech: "LTX-Video", role: "Text-to-video motion clips through a Hugging Face Space (ZeroGPU)" },
      { tech: "Kokoro", role: "English narration through a Hugging Face Space" },
      { tech: "Microsoft neural voices", version: v("msedge-tts"), role: "Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Indian English" },
      { tech: "Gradio client", version: v("@gradio/client"), role: "Calls the Hugging Face Spaces" },
    ],
  },
  {
    group: "Media",
    rows: [
      { tech: "Remotion", version: v("remotion"), role: "React compositions rendered to H.264 by headless Chromium" },
      { tech: "Google Fonts for Remotion", version: v("@remotion/google-fonts"), role: "Devanagari and other Indic fonts, so captions never render as boxes" },
      { tech: "ffmpeg / ffprobe", role: "Measure, join and pause audio; extract each clip's last frame" },
      { tech: "qrcode", version: v("qrcode"), role: "Belur Math QR code, error-correction level H" },
    ],
  },
  {
    group: "Data",
    rows: [
      { tech: "Python 3", role: "scrape.py and build_teachings.py: offline, one-time data work" },
      { tech: "JSON files", role: "teachings.json and the TF-IDF index. No database needed" },
      { tech: "TF-IDF + cosine", role: "Dependency-free local search with Devanagari-aware tokenising" },
    ],
  },
];

const API: { method: string; path: string; body: string; does: string }[] = [
  { method: "GET", path: "/api/reel/teachings", body: "?topic= &q= &limit=", does: "Lists or searches reel-ready verified teachings" },
  { method: "POST", path: "/api/reel/script", body: "{ teachingId?, problem?, language }", does: "Story, teacher note, visuals, audit, QR, provenance" },
  { method: "POST", path: "/api/reel/hooks", body: "{ teachingId, language }", does: "Five competing opening lines" },
  { method: "POST", path: "/api/reel/narration", body: "{ script, voice?, speed? }", does: "Voices the five beats; returns real per-beat durations" },
  { method: "POST", path: "/api/reel/clip", body: "{ prompt }", does: "One text-to-video clip, its length and its last frame" },
  { method: "POST", path: "/api/reel/render", body: "{ teachingId, language, beats[], audioUrl }", does: "Rebuilds quote and QR, re-audits, renders MP4 and provenance" },
  { method: "GET", path: "/generated/[...file]", body: "Range supported", does: "Serves media written at runtime" },
];

const DECISIONS = [
  {
    q: "Why does the quotation never pass through the model?",
    a: "The case study's first rule is never to invent a quotation. A model asked to include a quote will paraphrase it. So the model sees the teaching only as private context, and the quote shown in the reel is copied from the verified record and checked three times.",
  },
  {
    q: "Why are the story and the visuals two separate calls?",
    a: "One combined prompt made the model write the English image prompts in Hindi and produce thin, generic scenes. Two focused calls fixed both, and the visual call is cheap to retry on its own.",
  },
  {
    q: "Why quarantine instead of using all 147 cards?",
    a: "The raw data mixes hymns he composed, verses written about him and scripture citations. Showing any of them as his quotation is the exact failure to avoid. Excluding 60 cards with a stated reason is a stronger claim than 'we have 147'.",
  },
  {
    q: "Why Microsoft neural voices for Hindi?",
    a: "Kokoro has no Indian-language voices, and the free Hugging Face GPU quota is too small to depend on. These voices are free, have no GPU quota and cover eight languages. They are an unofficial route, so an official TTS API is the production choice.",
  },
  {
    q: "Why text-to-video, and why a fallback that is not a video?",
    a: "A detailed shot prompt makes a clip without any still image. When the daily GPU quota is gone, a calm editorial background drawn by Remotion keeps the reel watchable and consistent, instead of showing a placeholder.",
  },
  {
    q: "Why is the narration timed per beat?",
    a: "Each beat is voiced separately and measured with ffprobe, so a scene lasts exactly as long as its own narration. An even split would cut sentences off or leave dead air.",
  },
  {
    q: "Why does render rebuild everything from the record?",
    a: "The browser is not trusted. A hand-edited script or a tampered request cannot change the quote, the attribution or the QR: they are rebuilt from the record server-side, and a failed check returns 422.",
  },
];

const LIMITS = [
  { t: "Wan 2.1 is not used.", d: "The public Wan-AI/Wan2.1 Space is a front end to a paid third-party API and returns empty results. LTX-Video replaced it." },
  { t: "Motion depends on a small free GPU quota.", d: "Each Hugging Face account gets minutes a day, so only a few clips. Stock footage or a paid tier is the production answer." },
  { t: "Groq's free tier is tight.", d: "Story and visuals run back to back, so a rate-limit wait of up to 45 seconds can occur." },
  { t: "Hindi quality varies.", d: "A model-written Hindi script should be read once before it is shared. The quality checks catch structure, not taste." },
  { t: "Only Bengali has official translations.", d: "One Hindi variant survived verification, so Hindi reels read the quote in its verified original and explain it in Hindi." },
  { t: "Automated tests are not written yet.", d: "Verification so far is type-checking, production builds and end-to-end runs of the real pipeline." },
];

const RUN = `npm install
python scripts/build_teachings.py     # builds data/teachings.json

# .env
GROQ_API_KEY=...
HF_TOKEN=...                          # Hugging Face, for LTX-Video and Kokoro
MOCK_WAN_VIDEO=true

npm run dev                           # http://localhost:3000
# /      landing      /reel   studio      /docs   this page`;

export function DocsPage() {
  const [active, setActive] = useState(NAV[0].id);

  useEffect(() => {
    const sections = NAV.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.tricolor} aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          VivekReel <span>/ docs</span>
        </Link>
        <div className={styles.topLinks}>
          <Link href="/">Home</Link>
          <Link href="/reel" className={styles.topCta}>
            Open studio
          </Link>
        </div>
      </header>

      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="Sections">
          <span className={styles.navLabel}>On this page</span>
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className={active === n.id ? styles.navOn : undefined}>
              {n.label}
            </a>
          ))}
        </nav>

        <main className={styles.main}>
          <section id="overview" className={styles.section}>
            <span className={styles.kicker}>Documentation</span>
            <h1 className={styles.h1}>How VivekReel works, end to end.</h1>
            <p className={styles.lead}>
              VivekReel turns a verified teaching of Swami Vivekananda into a 30 to 60 second Hindi reel, with the original
              Belur Math source on every frame. This page documents the architecture, every technology used, and why each
              decision was made. The diagrams are live: pan, zoom, and click any box.
            </p>
            <div className={styles.facts}>
              {FACTS.map((f) => (
                <div key={f.label} className={styles.fact}>
                  <strong>{f.value}</strong>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="diagrams" className={styles.section}>
            <span className={styles.kicker}>Diagrams</span>
            <h2 className={styles.h2}>Explore the system.</h2>
            <p className={styles.lead}>Six views of the same system. Everything is drawn from text, so the source is one click away.</p>
            <DiagramExplorer />
          </section>

          <section id="stack" className={styles.section}>
            <span className={styles.kicker}>Technology</span>
            <h2 className={styles.h2}>Tech stack.</h2>
            <p className={styles.lead}>Versions are read from package.json, so this table cannot drift from the code.</p>
            <div className={styles.stack}>
              {STACK.map((g) => (
                <div key={g.group} className={styles.stackGroup}>
                  <h3 className={styles.h3}>{g.group}</h3>
                  <table className={styles.table}>
                    <tbody>
                      {g.rows.map((r) => (
                        <tr key={r.tech}>
                          <th scope="row">{r.tech}</th>
                          <td>{r.version ? <code>{r.version}</code> : <span className={styles.dash}>—</span>}</td>
                          <td>{r.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>

          <section id="api" className={styles.section}>
            <span className={styles.kicker}>Interfaces</span>
            <h2 className={styles.h2}>API reference.</h2>
            <p className={styles.lead}>
              Every route runs on the Node runtime (it needs the filesystem, ffmpeg and Remotion). Errors are JSON:{" "}
              <code>{"{ error }"}</code>. A failed authenticity check returns 422.
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.apiTable}>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Input</th>
                    <th>Does</th>
                  </tr>
                </thead>
                <tbody>
                  {API.map((a) => (
                    <tr key={a.path}>
                      <td>
                        <span className={a.method === "GET" ? styles.get : styles.post}>{a.method}</span>
                      </td>
                      <td>
                        <code>{a.path}</code>
                      </td>
                      <td>
                        <code>{a.body}</code>
                      </td>
                      <td>{a.does}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="decisions" className={styles.section}>
            <span className={styles.kicker}>Reasoning</span>
            <h2 className={styles.h2}>Design decisions.</h2>
            <div className={styles.accordion}>
              {DECISIONS.map((d, i) => (
                <details key={d.q} className={styles.item} open={i === 0}>
                  <summary>{d.q}</summary>
                  <p>{d.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section id="limits" className={styles.section}>
            <span className={styles.kicker}>Honesty</span>
            <h2 className={styles.h2}>Known limits.</h2>
            <p className={styles.lead}>What does not work yet, or works only within a free tier.</p>
            <ul className={styles.limits}>
              {LIMITS.map((l) => (
                <li key={l.t}>
                  <strong>{l.t}</strong>
                  <span>{l.d}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="run" className={styles.section}>
            <span className={styles.kicker}>Setup</span>
            <h2 className={styles.h2}>Run it locally.</h2>
            <pre className={styles.code}>{RUN}</pre>
            <p className={styles.note}>
              ffmpeg and ffprobe must be reachable by the Node process. Open a new terminal after installing them.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
