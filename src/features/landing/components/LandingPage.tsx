"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useSpring } from "motion/react";
import { canonical, isVerbatim } from "@/lib/authenticity";
import styles from "./LandingPage.module.css";

/** The exact verified record (teaching 24495, Belur Math). The demo below compares against this string. */
const VERIFIED_QUOTE =
  "Freedom is never to be reached by the weak. Throw away all weakness. Tell your body that it is strong, tell your mind that it is strong, and have unbounded faith and hope in yourself.";
const VERIFIED_SOURCE = "Complete Works of Swami Vivekananda, Vol 1, Raja Yoga, Chapter II, The First Steps";

const STACK_STRIP = [
  "Next.js 16", "React 19", "TypeScript", "Remotion", "Groq", "LTX-Video", "Kokoro",
  "Microsoft neural voices", "ffmpeg", "Mermaid", "Motion", "Python", "TF-IDF search", "QR code",
];

const MOTION_CLIPS = [
  { src: "/samples/motion-1.mp4", poster: "/samples/motion-1.jpg", label: "Situation" },
  { src: "/samples/motion-2.mp4", poster: "/samples/motion-2.jpg", label: "Turn" },
  { src: "/samples/motion-3.mp4", poster: "/samples/motion-3.jpg", label: "Hook" },
  { src: "/samples/motion-4.mp4", poster: "/samples/motion-4.jpg", label: "Classroom" },
];

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ---------- content ---------- */

const STATS = [
  { value: 87, label: "verified teachings from Belur Math" },
  { value: 60, label: "excluded because they could not be verified" },
  { value: 0, label: "quotations written by AI" },
  { value: 8, label: "Indian languages for story and voice" },
];

const SUMMARY = [
  {
    kicker: "The problem",
    title: "Wisdom is not reaching students where they are.",
    text: "Young people learn from short videos, not long speeches. And most AI tools happily invent a ‘Vivekananda quote’ to fill the gap.",
  },
  {
    kicker: "Our approach",
    title: "Start from a verified teaching, then tell a modern story around it.",
    text: "A relatable student moment, a simple explanation, one small action for today — in Hindi, in 30 to 60 seconds.",
  },
  {
    kicker: "The guarantee",
    title: "The quotation is never written by AI.",
    text: "It is copied from the Belur Math record, checked word for word before rendering, and the source travels with every video.",
  },
];

/** Plain facts only — no quotations on this page that are not on a verified card. */
const LIFE = [
  { year: "1863", text: "Born Narendranath Datta on 12 January in Kolkata. India marks his birthday as National Youth Day." },
  { year: "1893", text: "Addressed the Parliament of the World's Religions in Chicago, bringing Vedanta to a world audience." },
  { year: "1897", text: "Founded the Ramakrishna Mission. Belur Math, its headquarters, publishes the quotations we use." },
];

const CHAIN = ["Teaching", "Hindi script", "Audit", "Voice", "Motion", "Reel"];

const STEPS = [
  {
    title: "Choose a verified teaching",
    text: "Pick from the library, or describe a struggle in Hindi, English or Hinglish. A local search matches it to a verified Belur Math card — no network call, no guessing.",
    tag: "Local TF-IDF search · data/teachings.json",
  },
  {
    title: "Write the story in Hindi",
    text: "An LLM writes four spoken beats — hook, situation, turn, takeaway — plus a note for teachers. It is forbidden from quoting, paraphrasing or attributing anything to Swamiji.",
    tag: "Groq · gpt-oss-120b · detailed prompts",
  },
  {
    title: "Audit every word",
    text: "The quote must match the source exactly. Invented quotations and phrases like ‘Vivekananda said’ are detected; a failing script is rewritten and rendering is blocked.",
    tag: "assertVerbatim · detectFabricatedQuotes",
  },
  {
    title: "Give it a calm voice",
    text: "A natural Hindi neural voice, slightly slowed, with a pause between beats so each idea can land. The quote is read in its verified original language.",
    tag: "Microsoft neural voices · ffmpeg",
  },
  {
    title: "Add motion to the story",
    text: "Each story scene gets a short AI motion clip from a detailed shot prompt. When the free GPU runs out, the scene falls back to a calm editorial frame — the reel never breaks.",
    tag: "LTX-Video · text-to-video",
  },
  {
    title: "Render an honest reel",
    text: "A 9:16 MP4 with Hindi captions, a ‘Source: Belur Math’ badge on every frame, the verbatim quote card, a scannable QR code and a provenance file.",
    tag: "Remotion · H.264 · QR · JSON sidecar",
  },
];

const BEATS = [
  { name: "Hook", seconds: 6, note: "Stops the scroll" },
  { name: "Situation", seconds: 8, note: "A real student moment" },
  { name: "Turn", seconds: 13, note: "The idea, explained" },
  { name: "Quote", seconds: 15, note: "Verbatim, with source" },
  { name: "Takeaway", seconds: 6, note: "One action for today" },
];

const VERBATIM = ["The quotation itself", "Author and source work", "Belur Math link and QR code", "Language of the original card"];
const AI_WRITTEN = ["The modern story and its characters", "The Hindi explanation and teacher note", "The narration voice", "Every visual and motion clip"];

const LANGUAGES = [
  { name: "हिन्दी", note: "default" },
  { name: "বাংলা", note: "official translations" },
  { name: "தமிழ்" },
  { name: "తెలుగు" },
  { name: "मराठी" },
  { name: "ગુજરાતી" },
  { name: "ಕನ್ನಡ" },
  { name: "English" },
];



/* ---------- building blocks ---------- */

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce || to === 0) {
      setValue(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1100);
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, to]);

  return <span ref={ref}>{value}</span>;
}

function SectionHead({ kicker, title, text }: { kicker: string; title: string; text?: string }) {
  return (
    <Reveal className={styles.sectionHead}>
      <span className={styles.kicker}>{kicker}</span>
      <h2 className={styles.h2}>{title}</h2>
      {text && <p className={styles.lead}>{text}</p>}
    </Reveal>
  );
}

/** Plays only while on screen, so several clips never decode at once. */
function LoopVideo({ src, poster, className, label }: { src: string; poster: string; className?: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    const v = ref.current;
    if (!v || reduce) return;
    if (inView) void v.play().catch(() => {});
    else v.pause();
  }, [inView, reduce]);

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={label}
      // Decorative loops: no browser overlays (fullscreen, picture-in-picture, cast) on hover.
      disablePictureInPicture
      disableRemotePlayback
      controlsList="nofullscreen nodownload noremoteplayback"
      tabIndex={-1}
    />
  );
}

/** Edit the quote and watch the same integrity check the renderer runs. */
function VerbatimDemo() {
  const [text, setText] = useState(VERIFIED_QUOTE);
  const ok = isVerbatim(text, VERIFIED_QUOTE);

  // Point at the first word that differs, the way a reviewer would.
  const firstDiff = (() => {
    if (ok) return null;
    const a = canonical(text).split(" ");
    const b = canonical(VERIFIED_QUOTE).split(" ");
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) return { index: i, got: a[i] ?? "(missing)", want: b[i] ?? "(nothing)" };
    }
    return null;
  })();

  const tamper = () => setText(VERIFIED_QUOTE.replace("unbounded faith", "great faith"));

  return (
    <div className={styles.demo}>
      <div className={styles.demoBar}>
        <span className={styles.demoDots} aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className={styles.demoTitle}>quote-check · live</span>
      </div>

      <div className={styles.demoBody}>
        <label className={styles.demoLabel} htmlFor="verbatim-demo">
          Quotation as it would appear in the reel
        </label>
        <textarea
          id="verbatim-demo"
          className={`${styles.demoText} ${ok ? "" : styles.demoTextBad}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          spellCheck={false}
        />

        <div className={styles.demoActions}>
          <button type="button" className={styles.demoBtn} onClick={tamper}>
            Change a word
          </button>
          <button type="button" className={styles.demoBtnGhost} onClick={() => setText(VERIFIED_QUOTE)} disabled={ok}>
            Reset
          </button>
          <span className={styles.demoHint}>Try editing it yourself.</span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={ok ? "ok" : "bad"}
            className={`${styles.verdict} ${ok ? styles.verdictOk : styles.verdictBad}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            role="status"
          >
            <span className={styles.verdictIcon} aria-hidden>
              {ok ? "✓" : "✕"}
            </span>
            <div>
              <strong>{ok ? "Matches the Belur Math record" : "Integrity check failed. Render blocked (HTTP 422)."}</strong>
              <p>
                {ok
                  ? `Source: ${VERIFIED_SOURCE}`
                  : firstDiff
                    ? `Word ${firstDiff.index + 1} is “${firstDiff.got}”; the record says “${firstDiff.want}”.`
                    : "The text differs from the verified record."}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Horizontal pill chain whose connecting arrows draw in one after another. */
function FlowChain() {
  const reduce = useReducedMotion();
  return (
    <div className={styles.chain}>
      {CHAIN.map((name, i) => (
        <div key={name} className={styles.chainItem}>
          <motion.span
            className={`${styles.chainPill} ${i === 2 ? styles.chainPillAccent : ""}`}
            initial={reduce ? false : { opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, ease: EASE, delay: i * 0.22 }}
          >
            {name}
          </motion.span>
          {i < CHAIN.length - 1 && (
            <svg className={styles.chainArrow} viewBox="0 0 40 16" aria-hidden>
              <motion.path
                d="M2 8 H34 M28 3 L35 8 L28 13"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.22 + 0.18 }}
              />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

/** Vertical flowchart; its rail fills as you scroll through the steps. */
function FlowSteps() {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <ol ref={ref} className={styles.steps}>
      <span className={styles.rail} aria-hidden>
        <motion.span className={styles.railFill} style={{ scaleY: reduce ? 1 : fill }} />
      </span>
      {STEPS.map((step, i) => (
        <li key={step.title} className={styles.step}>
          <motion.span
            className={styles.stepNode}
            initial={reduce ? false : { backgroundColor: "#FFFFFF", color: "#9A9A9A" }}
            whileInView={{ backgroundColor: "#0B1F4D", color: "#FFFFFF" }}
            viewport={{ once: true, margin: "-45% 0px -45% 0px" }}
            transition={{ duration: 0.35 }}
          >
            {i + 1}
          </motion.span>
          <Reveal className={styles.stepCard}>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepText}>{step.text}</p>
            <span className={styles.stepTag}>{step.tag}</span>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}

function ReelAnatomy() {
  const reduce = useReducedMotion();
  const total = BEATS.reduce((s, b) => s + b.seconds, 0);
  return (
    <Reveal className={styles.anatomy}>
      <div className={styles.anatomyBar}>
        {BEATS.map((b, i) => (
          <motion.div
            key={b.name}
            className={`${styles.anatomySeg} ${b.name === "Quote" ? styles.anatomySegQuote : ""}`}
            style={{ flexGrow: b.seconds, transformOrigin: "left center" }}
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.15 + i * 0.12 }}
          >
            <span>{b.seconds}s</span>
          </motion.div>
        ))}
      </div>
      <div className={styles.anatomyLegend}>
        {BEATS.map((b) => (
          <div key={b.name} style={{ flexGrow: b.seconds }} className={styles.anatomyItem}>
            <strong>{b.name}</strong>
            <span>{b.note}</span>
          </div>
        ))}
      </div>
      <p className={styles.anatomyFoot}>Timings from a real {total}-second Hindi render. The narration sets every scene&apos;s length.</p>
    </Reveal>
  );
}

/* ---------- page ---------- */

export function LandingPage() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });

  return (
    <div className={styles.page}>
      <div className={styles.tricolor} aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <motion.div className={styles.progress} style={{ scaleX: reduce ? scrollYProgress : progress }} aria-hidden />

      <nav className={styles.nav}>
        <Link href="/" className={styles.wordmark}>
          VivekReel
        </Link>
        <div className={styles.navLinks}>
          <a href="#how">How it works</a>
          <a href="#authenticity">Authenticity</a>
          <a href="#teachers">For teachers</a>
          <Link href="/docs">Docs</Link>
        </div>
        <Link href="/reel" className={styles.navCta}>
          Open studio
        </Link>
      </nav>

      {/* Hero */}
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <Reveal>
            <span className={styles.eyebrow}>Case Study 06 · Teaching-to-Reel Generator</span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className={styles.h1}>
              Swami Vivekananda&apos;s verified words, <span className={styles.h1Accent}>told the way students listen today.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className={styles.heroLead}>
              Pick a teaching or describe a struggle. VivekReel writes a short Hindi story around it, voices it, adds motion,
              and renders a 30–60 second reel — while the quotation itself stays exactly as Belur Math published it.
            </p>
          </Reveal>
          <Reveal delay={0.24} className={styles.heroActions}>
            <Link href="/reel" className={styles.btnPrimary}>
              Make a reel
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <a href="#how" className={styles.btnGhost}>
              See how it works
            </a>
          </Reveal>
        </div>
        <Reveal delay={0.2} className={styles.heroVisual}>
          <figure className={styles.portraitWrap}>
            <span className={styles.portraitBack} aria-hidden />
            <Image
              src="/swamiji/portrait-chicago-1893.jpg"
              alt="Swami Vivekananda, arms folded, photographed in Chicago in September 1893"
              width={933}
              height={1280}
              priority
              sizes="(max-width: 900px) 80vw, 380px"
              className={styles.portrait}
            />
            <figcaption className={styles.portraitCaption}>Swami Vivekananda · Chicago, 1893</figcaption>
            <div className={styles.phoneFloat}>
              <div className={styles.realPhone}>
                <LoopVideo src="/samples/reel-teaser.mp4" poster="/samples/reel-poster.jpg" label="A real reel generated by VivekReel" />
                <span className={styles.realPhoneTag}>Real output</span>
              </div>
            </div>
            <span className={`${styles.floatChip} ${styles.floatChipA}`}>
              <i aria-hidden /> Quote verbatim from Belur Math
            </span>
            <span className={`${styles.floatChip} ${styles.floatChipB}`}>
              <i aria-hidden /> Story: AI-written
            </span>
          </figure>
        </Reveal>
      </header>

      <section className={styles.stats}>
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.06} className={styles.stat}>
            <span className={styles.statValue}>
              <CountUp to={s.value} />
            </span>
            <span className={styles.statLabel}>{s.label}</span>
          </Reveal>
        ))}
      </section>

      {/* Built with */}
      <div className={styles.marquee} aria-label="Technology used">
        <div className={styles.marqueeTrack}>
          {[...STACK_STRIP, ...STACK_STRIP].map((name, i) => (
            <span key={`${name}-${i}`} className={styles.marqueeItem} aria-hidden={i >= STACK_STRIP.length}>
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Who he was */}
      <section className={`${styles.section} ${styles.sectionLife}`}>
        <div className={styles.life}>
          <div>
            <SectionHead
              kicker="Swami Vivekananda · 1863–1902"
              title="A monk who spoke straight to young India."
              text="Courage, self-confidence, concentration, education and service — his ideas still speak to students. We keep his words exactly as he said them, and only change the way they reach you."
            />
            <ol className={styles.lifeList}>
              {LIFE.map((item, i) => (
                <li key={item.year}>
                  <Reveal delay={i * 0.08} className={styles.lifeItem}>
                    <span className={styles.lifeYear}>{item.year}</span>
                    <p>{item.text}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.lifeImages}>
            <Reveal className={styles.lifeWide}>
              <Image
                src="/swamiji/parliament-1893.jpg"
                alt="Swami Vivekananda seated on the platform of the Parliament of the World's Religions, Chicago, 1893"
                width={1280}
                height={898}
                sizes="(max-width: 900px) 92vw, 560px"
              />
              <span>Parliament of the World&apos;s Religions, Chicago, 1893</span>
            </Reveal>
            <Reveal delay={0.1} className={styles.lifeSmall}>
              <Image
                src="/swamiji/portrait-jaipur.jpg"
                alt="Swami Vivekananda seated cross-legged, photographed in Jaipur"
                width={819}
                height={1024}
                sizes="220px"
              />
              <span>Jaipur</span>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Summary */}
      <section className={styles.section}>
        <SectionHead kicker="In short" title="What we are building, and why." />
        <div className={styles.summary}>
          {SUMMARY.map((card, i) => (
            <Reveal key={card.kicker} delay={i * 0.08} className={styles.summaryCard}>
              <span className={styles.summaryKicker}>{card.kicker}</span>
              <h3 className={styles.summaryTitle}>{card.title}</h3>
              <p className={styles.summaryText}>{card.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Flow */}
      <section id="how" className={`${styles.section} ${styles.sectionTint}`}>
        <SectionHead
          kicker="How it works"
          title="From a verified teaching to a finished reel."
          text="Six steps, one direction. The quotation enters at the start and is never handed to a model to rewrite."
        />
        <FlowChain />
        <FlowSteps />
      </section>

      {/* Real output */}
      <section id="output" className={styles.section}>
        <SectionHead
          kicker="Real output"
          title="This reel was made by the pipeline above."
          text="Not a mock-up. A 52-second Hindi reel, voiced and rendered end to end, with three AI motion clips, the verbatim quote card and a scannable QR code."
        />
        <div className={styles.showcase}>
          <Reveal className={styles.showcasePlayer}>
            <video
              className={styles.showcaseVideo}
              src="/samples/reel-hindi.mp4"
              poster="/samples/reel-poster.jpg"
              controls
              playsInline
              preload="none"
            />
            <span className={styles.showcaseCaption}>Press play · sound on · 52 s · 720 × 1280</span>
          </Reveal>

          <div className={styles.showcaseSide}>
            <Reveal delay={0.05}>
              <h3 className={styles.showcaseH}>Generated motion</h3>
              <p className={styles.showcaseP}>
                Text-to-video clips from detailed shot prompts, about 4.5 seconds each, played in slow motion so each idea can be read.
              </p>
              <div className={styles.motionGrid}>
                {MOTION_CLIPS.map((c) => (
                  <figure key={c.src} className={styles.motionItem}>
                    <LoopVideo src={c.src} poster={c.poster} label={`AI motion clip: ${c.label}`} />
                    <figcaption>{c.label}</figcaption>
                  </figure>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.12} className={styles.provenance}>
              <div className={styles.provenanceHead}>
                <span>provenance.json</span>
                <a href="/samples/reel-hindi.provenance.json" target="_blank" rel="noreferrer">
                  open file ↗
                </a>
              </div>
              <pre>{`{
  "teachingId": "22992",
  "sourceUrl": "https://media.belurmath.org/…/22992/",
  "verbatimQuote": "The aim of the Sangha is to preach…",
  "model": "openai/gpt-oss-120b",
  "disclosure": "The story in this reel is an AI-written
    dramatisation. The quotation is reproduced
    verbatim from Belur Math."
}`}</pre>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Anatomy */}
      <section className={styles.section}>
        <SectionHead
          kicker="Anatomy of a reel"
          title="Five beats, paced for understanding."
          text="Slower than a typical reel on purpose: a pause between beats, and captions that stay long enough to read."
        />
        <ReelAnatomy />
      </section>

      {/* Authenticity */}
      <section id="authenticity" className={`${styles.section} ${styles.sectionTint}`}>
        <SectionHead
          kicker="Authenticity"
          title="Always clear what is his, and what is ours."
          text="The case study's first rule: never invent a quotation or present AI interpretation as Swami Vivekananda's words."
        />
        <Reveal className={styles.demoWrap}>
          <VerbatimDemo />
        </Reveal>
        <div className={styles.split}>
          <Reveal className={`${styles.splitCard} ${styles.splitVerbatim}`}>
            <span className={styles.splitLabel}>Verbatim · never generated</span>
            <ul>
              {VERBATIM.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.08} className={styles.splitCard}>
            <span className={styles.splitLabel}>AI-written · always labelled</span>
            <ul>
              {AI_WRITTEN.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </Reveal>
        </div>
        <Reveal className={styles.rules}>
          <p>
            <strong>We deliberately do not</strong> imitate Swamiji&apos;s voice, animate his face, translate a quote and call
            it official, or show any of the 60 cards we could not verify.
          </p>
        </Reveal>
      </section>

      {/* Teachers + languages */}
      <section id="teachers" className={styles.section}>
        <div className={styles.twoCol}>
          <div>
            <SectionHead
              kicker="For teachers"
              title="Every reel comes with a lesson."
              text="A key idea for the notebook, a discussion question with no single right answer, and a five-minute activity that needs only paper and pen."
            />
            <Reveal className={styles.note}>
              <dl>
                <dt>मुख्य विचार</dt>
                <dd>मन की शक्ति में भरोसा रखो और खुद को सक्षम समझो।</dd>
                <dt>चर्चा का प्रश्न</dt>
                <dd>जब तुम्हें डर लगे, तो कौन सी छोटी चीज़ तुम्हें भरोसा दिला सकती है?</dd>
                <dt>पाँच मिनट की गतिविधि</dt>
                <dd>हर छात्र एक पन्ने पर अपनी ताकत की तीन बातें लिखे, फिर साथी को बताए।</dd>
              </dl>
              <span className={styles.noteFoot}>Example teacher note, generated with a reel · AI-written</span>
            </Reveal>
          </div>
          <div>
            <SectionHead
              kicker="Languages"
              title="Hindi first. Seven more ready."
              text="Story, voice and captions in the viewer's language. The quotation keeps the language of its verified card — Belur Math's own Bengali translations are used where they exist."
            />
            <Reveal className={styles.langs}>
              {LANGUAGES.map((l) => (
                <span key={l.name} className={`${styles.lang} ${l.note === "default" ? styles.langOn : ""}`}>
                  {l.name}
                  {l.note && <small>{l.note}</small>}
                </span>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* Docs */}
      <section className={styles.docsBand}>
        <Reveal className={styles.docsCard}>
          <div>
            <span className={styles.kicker}>Documentation</span>
            <h2 className={styles.docsTitle}>See exactly how it is built.</h2>
            <p className={styles.docsText}>
              Six interactive diagrams: architecture, the reel pipeline, the authenticity gates, the data pipeline, fallbacks and the
              full tech stack. Pan, zoom, and click any box for its files and versions.
            </p>
            <Link href="/docs" className={styles.btnPrimary}>
              Open the interactive docs
            </Link>
          </div>
          <ul className={styles.docsList} aria-hidden>
            {["Architecture", "Reel pipeline", "Authenticity", "Data pipeline", "Fallbacks", "Tech stack"].map((t, i) => (
              <li key={t}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <Reveal>
          <h2 className={styles.ctaTitle}>Make your first reel.</h2>
          <p className={styles.ctaText}>About three minutes from teaching to downloadable MP4.</p>
          <div className={styles.heroActions}>
            <Link href="/reel" className={styles.btnPrimary}>
              Open the Reel Studio
            </Link>
            <Link href="/story-board" className={styles.btnGhost}>
              Personal story board
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className={styles.footer}>
        <span>VivekReel · inspired by the life and teachings of Swami Vivekananda.</span>
        <span>
          Quotations from{" "}
          <a href="https://media.belurmath.org/tag/quotations/" target="_blank" rel="noreferrer">
            Belur Math
          </a>
          . Stories, voices and visuals are AI-generated. Photographs: public domain, via Wikimedia Commons.
        </span>
      </footer>
      <div className={styles.tricolor} aria-hidden>
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
