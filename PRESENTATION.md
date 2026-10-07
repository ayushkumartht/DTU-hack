# 📊 PRESENTATION DECK
## Case Study 06 — Teaching-to-Reel Generator
### *Turning verified teachings into honest, engaging 30–60 second reels.*

> **Official Problem**: Bring Swami Vivekananda's verified teachings into the language and format of today's youth — while keeping the original message authentic and meaningful.

---

## SLIDE 1 — The Challenge

### What the Problem Asks For:
> *"Create an AI-powered tool that takes a verified teaching, quotation or incident from Swami Vivekananda's life and works and turns it into an engaging 30–60 second reel."*
> — Case Study 06, Official Problem Statement

### Why This Matters:
| The Reality | The Gap |
|---|---|
| Vivekananda's teachings cover **courage, self-confidence, concentration, education, service** | Young audiences prefer **short-form video** over books or long speeches |
| Belur Math publishes **verified quotations** officially at `media.belurmath.org` | Most AI tools **fabricate quotes** or present interpretations as Vivekananda's actual words |
| His message is **timeless and universal** | It is not reaching youth **in their language, on their device** |

### The Core Constraint (Non-Negotiable):
> ❌ **"The system must be careful not to invent quotations or present AI-generated interpretations as Swami Vivekananda's actual words."**
> ✅ **"It should clearly show the original source."**
> ✅ **"Allow the creator to adapt the content into Indian regional languages."**

---

## SLIDE 2 — Proposed Solution

### **VivekReel — Teaching-to-Reel Generator**
> An AI tool that starts from a **verified Belur Math teaching** and generates a complete, honest 30–60 second student reel — with the original source always visible and the quote never altered.

### How It Works (Input → Output):

```
INPUT: A verified teaching from Belur Math
       (e.g. "Take up one idea. Make that one idea your life...")

         ↓  AI builds a 3-Act student reel around it

OUTPUT: 30–60 second vertical MP4
        ├── Strong hook (relatable student situation)
        ├── Story connecting teaching to modern student life
        ├── Narration + kinetic subtitles (Hindi / English / regional)
        ├── Visual ideas (Ghibli-style scenes + Wan 2.1 cinematic video)
        ├── Meaningful takeaway action
        └── Original Belur Math source — QR code + text citation always visible
```

### The 3-Act Reel Architecture:

| Act | Duration | What It Does |
|-----|----------|-------------|
| **Act 1 — Hook** | 0s – 10s | Relatable student situation (exam stress, self-doubt, fear of speaking in class) |
| **Act 2 — Story & Teaching** | 10s – 45s | Vivekananda's teaching woven into a simple modern story; narration + visuals |
| **Act 3 — Takeaway & Source** | 45s – 60s | One small action for the viewer + **verbatim quote on screen + Belur Math QR** |

---

## SLIDE 3 — Proposed Methodology

### Full AI Pipeline:

```
STEP 1: Creator selects / pastes a verified teaching
        └── from data/teachings.json (147 records scraped from media.belurmath.org)

STEP 2: Local TF-IDF vector search
        └── finds the best matching teaching for a given student situation keyword

STEP 3: Groq LLM (openai/gpt-oss-120b) — 3-Act Script Generation
        └── Strict prompt rules:
            • Cannot write or rephrase the quote
            • Cannot use "Vivekananda said…" attribution
            • Quote is injected verbatim from the verified record

STEP 4: Authenticity Check — assertVerbatim()
        └── Byte-by-byte comparison of generated script quote vs source record
        └── If mismatch → render is BLOCKED, error surfaced to creator

STEP 5: Visuals Generation
        ├── Act 1 & 3: FLUX.1 Ghibli-style scene images (FLUX.1-Studio-Ghibli-LoRA)
        └── Act 2:     Wan 2.1 cinematic 3D video clip (image-to-video, 9:16)

STEP 6: Narration — Kokoro TTS
        └── 3 audio segments synced to each act
        └── Language: Hindi / English / Hinglish (regional language support in pipeline)

STEP 7: Remotion Video Composition
        └── 9:16, 1080×1920, 30fps
        └── Kinetic subtitles (MrBeast-style, 3-word blocks, centered)
        └── Act 3: Verbatim quote card (locked, read-only) + Belur Math QR Code overlay

STEP 8: Output
        └── Downloadable MP4
        └── Provenance sidecar .json:
            { teachingId, verbatimQuote, sourceWork, sourceUrl, generatedAt, modelUsed }
```

### Anti-Fabrication Enforcement (Technical):

| Rule | Enforcement |
|---|---|
| Quote text must be verbatim | `assertVerbatim()` blocks render on mismatch |
| No invented quotations | AI prompt hardcoded to never generate quote text |
| No false attribution | "Vivekananda said…" phrases forbidden in prompt |
| Source always visible | Belur Math URL + QR mandatory in Act 3 — cannot be removed |
| Quarantined data | Records that don't pass integrity check are excluded before indexing |

---

## SLIDE 4 — Alignment to Vivekananda's Ideas

### Platform Philosophy = Vivekananda's Philosophy:

| Core Teaching | How VivekReel Embodies It |
|---|---|
| **"Arise, Awake, Stop not till the goal is reached"** | Meets youth where they are (short-form video), making wisdom *impossible to ignore* |
| **"Education is the manifestation of perfection already in man"** | Contextualizes each teaching to the student's *specific* situation — it unlocks their own insight, not lectures them |
| **"Strength is life, weakness is death"** | Every reel ends with one small, concrete action — rooted in the teaching, not AI opinion |
| **"All knowledge is within us"** | Answers come only from verified Vedantic wisdom — never hallucinated AI content |
| **"Purity, patience and perseverance"** | Authenticity engine = *purity in technology*: zero fabricated quotes, full traceability |

### Example — The Platform in Action:

> **Teaching:** *"Our duty is to encourage every one in his struggle to live up to his own highest idea..."*
> *(Source: Complete Works, Vol 3 | media.belurmath.org)*

| Reel Element | Content |
|---|---|
| **Hook (0–10s)** | "Sab log bol rahe hain doctor bano — aur tum artist banana chahte ho?" |
| **Story (10–45s)** | Student hesitant to present in class → Vivekananda's teaching on courage of conviction |
| **Takeaway (45–60s)** | "Aaj ek cheez karo jo tumhara dil kehta hai. Scan karo — puri teaching padhne ke liye." |
| **QR Code** | Links to original Belur Math page for this exact quote |

### Respect for Belur Math's Official Stance:
- Belur Math maintains a dedicated **Fact Check & Clarifications** page (`belurmath.org/fact-check-and-clarifications`) — the platform's anti-fabrication engine is built to pass this standard
- All 147 teachings are sourced from Belur Math's **verified quotation cards** (`media.belurmath.org/tag/quotations/`)

---

## SLIDE 5 — Business Idea

### Product: **VivekReel — Teaching-to-Reel Studio**
India's first **authenticity-first** AI reel generator for Vivekananda's teachings — built for students, educators, and content creators.

### Two Core Modes:

| Mode | User | Flow |
|---|---|---|
| **Teaching-First Mode** | Educator / Creator | Select a teaching from the library → AI generates reel around it |
| **Problem-First Mode** | Student | Type your struggle → AI finds the best matching teaching → generates reel |

### Target Segments:

| Segment | Size | Use Case |
|---|---|---|
| **Students (Primary)** | 560M youth in India | Exam stress, focus, fear, self-doubt in Hindi/Hinglish |
| **Educational Institutions** | 1.5M+ schools & colleges | Branded weekly reel content for assemblies, WhatsApp groups |
| **Coaching Institutes** | JEE/NEET/UPSC (Allen, Aakash, Unacademy) | Differentiated motivational content at scale |
| **Belur Math / Ramakrishna Mission** | Institutional partner | Verified-source content amplification to youth audiences |
| **Regional Content Creators** | Bharat-focused creators (Hindi, Bengali, Tamil) | Legally safe, authentic spiritual content in native language |

---

## SLIDE 6 — Revenue Model

### Stream 1: Freemium Consumer (B2C)

| Tier | Price | Features |
|---|---|---|
| **Free** | ₹0 | 3 reels/month, watermark, Hindi + English only |
| **Student Pro** | ₹49/month | 30 reels/month, Wan 2.1 video, no watermark, 5 Indian languages |
| **Creator** | ₹149/month | Unlimited, custom voice, MP4 + SRT + provenance JSON |

### Stream 2: Institutional API (B2B)

| Package | Price | Target |
|---|---|---|
| **School Bundle** | ₹999/month | 500 students, 1,000 reels/month, admin dashboard |
| **Coaching Institute** | ₹4,999/month | Branded reels, custom hook library, analytics |
| **Enterprise / White-Label** | Custom | API access, Indic TTS, SLA, co-branding |

### Stream 3: Institutional Partnership
- **Belur Math / Ramakrishna Mission** co-branded distribution — "Verified by Belur Math" trust badge
- **Government Education Boards** (CBSE, KV Sangathan, State Boards) — official content licensing
- **Spiritual Tourism** (West Bengal, Uttarakhand tourism boards) — outreach to youth via authentic content

### Financial Projections (Year 1):

| Metric | Conservative | Optimistic |
|---|---|---|
| Monthly Active Users | 10,000 | 50,000 |
| Paid Conversion | 5% | 12% |
| ARPU | ₹75/month | ₹120/month |
| B2B Institutions | 5 | 25 |
| **Total Year 1 ARR** | **₹7.5 Lakh** | **₹1.02 Crore** |

---

## SLIDE 7 — App Prototype

### Mode 1: Problem-First (Student Flow)

```
Student types: "Class mein bolne se darta hoon, log judge karenge..."
        ↓
TF-IDF matches: "Be not afraid of anything. You will do marvellous work..."
                (Source: Lectures from Colombo to Almora | Belur Math)
        ↓
Groq generates 3-act script (streamed live in UI)
        ↓
Visuals: Ghibli scene (Act 1) + Wan 2.1 video (Act 2) + Quote card (Act 3)
        ↓
Kokoro TTS → 3 audio segments → Remotion renders 9:16 MP4
        ↓
Preview in browser → Download MP4 + SRT + provenance.json
```

### Mode 2: Teaching-First (Educator Flow)

```
Educator picks a teaching from the Belur Math library (browse / search)
        ↓
Chooses student situation template (exam anxiety / career fear / peer pressure)
        ↓
Selects output language (Hindi / Bengali / Tamil / Telugu / English)
        ↓
System generates full reel with teaching locked as the central piece
        ↓
Download branded MP4 for school WhatsApp group / YouTube channel
```

### Key UI Guarantees (Always Visible):
- ✅ **Authenticity Panel**: Quote verbatim ✓ | No fabrication ✓ | Belur Math source ✓
- 🔒 **Locked Quote Beat**: Quote card is read-only, padlocked — cannot be edited or removed
- 📄 **Provenance Sidecar**: Every MP4 ships with `.json` — teaching ID, source URL, timestamp, model used

### Tech Stack:

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| AI Script | Groq `openai/gpt-oss-120b` |
| Teaching Data | Local TF-IDF over 147 verified Belur Math records |
| Scene Images | FLUX.1-Studio-Ghibli-LoRA (Hugging Face) |
| Cinematic Video | Wan 2.1 I2V — `Wan-AI/Wan2.1-I2V-14B-480P` |
| TTS / Voice | Kokoro TTS (multi-voice, Hugging Face) |
| Video Render | Remotion → H.264 MP4 (1080×1920, 9:16, 30fps) |
| QR Code | `qrcode` npm (error-correction level H, scannable in video) |
| Audio Mux | `@ffmpeg-installer/ffmpeg` (bundled, no system install needed) |

---

## SLIDE 8 — Feasibility Analysis

### Technical Feasibility — Live Status:

| Component | Status | Risk |
|---|---|---|
| Next.js 16 App + API routes | ✅ Running on localhost | Low |
| 147 Verified Teachings Dataset | ✅ Scraped from Belur Math | Low |
| Local TF-IDF Vector Search | ✅ Tested | Low |
| Groq Story + Script Generation | ✅ Working, 3–5s response | Low |
| `assertVerbatim()` Auth Engine | ✅ Blocks fabricated renders | Low |
| FLUX.1 Ghibli Scene Images | ✅ Working (quota-managed) | Medium |
| Wan 2.1 Cinematic Video | 🔄 Integrated, quota-dependent | Medium |
| Kokoro TTS Narration | ✅ Working, ffmpeg bundled | Low |
| Remotion MP4 Renderer | ✅ No system ffmpeg needed | Low |
| Belur Math QR Code Overlay | ✅ `qrcode` integrated | Low |
| Provenance JSON Sidecar | ✅ Implemented | Low |

### Risk Mitigations:

| Risk | Mitigation |
|---|---|
| HF ZeroGPU quota exhausted | Graceful fallback to Ken-Burns still image — pipeline never crashes |
| Groq rate limit 429 | Built-in retry with user-facing countdown |
| ffmpeg not on PATH | `@ffmpeg-installer` npm binary — zero manual setup |
| AI fabricates a quote | `assertVerbatim()` hard-blocks render — zero tolerance |
| Regional language quality | Kokoro TTS supports Hindi, Bengali; additional Indic TTS planned (IndicTTS) |

### Infrastructure Cost to Launch:

| Item | Monthly Cost |
|---|---|
| Vercel Pro (hosting) | $20 (~₹1,700) |
| Groq API (free tier) | ₹0 |
| Hugging Face Spaces | ₹0 – ₹750 (HF Pro) |
| Domain (`vivekreel.in`) | ₹67/month |
| **Total** | **< ₹2,500/month** |

---

## SLIDE 9 — Team Member Contribution

| Member | Role | Key Contribution |
|---|---|---|
| **Ayush Kumar** | Project Lead & Full-Stack Dev | System architecture, Next.js App Router, Remotion pipeline, `assertVerbatim()` authenticity engine, QR integration, `AYUSH.MD` blueprint |
| **[Member 2]** | AI/ML & Data Engineering | Belur Math scraper (`scripts/scrape.py`), TF-IDF vector index, 147 verified teachings dataset, Groq prompt engineering |
| **[Member 3]** | UI/UX & Frontend | Reel Studio dashboard (`/reel`), Arc UI components, kinetic subtitle design, dark/light theme |
| **[Member 4]** | Business & Research | Revenue model, market analysis, Vivekananda alignment analysis, this presentation |
| **[Member 5]** | DevOps & Integration | API route testing, ffmpeg/ffprobe path resolution, HF Space Gradio client integration, deployment |

### Deliverables Status:

| Deliverable | Status |
|---|---|
| Working Web App on localhost | ✅ |
| Story Board — Problem-First Mode (`/story-board`) | ✅ |
| Reel Studio — Teaching-First Mode (`/reel`) | ✅ |
| 147 Verified Teachings Dataset (Belur Math) | ✅ |
| Anti-Fabrication Engine (`assertVerbatim`) | ✅ |
| Wan 2.1 Cinematic Video Integration | 🔄 |
| Belur Math QR Code Overlay | ✅ |
| Multi-language Support Pipeline | 🔄 |
| Provenance JSON Sidecar | ✅ |
| Architecture Documentation (`AYUSH.MD`) | ✅ |

---

## SLIDE 10 — References

### Official Belur Math Sources (Primary Data Source):
1. **Verified Quotation Cards** — `https://media.belurmath.org/tag/quotations/`
   All 147 teachings are sourced here — verbatim text, source work, official translations
2. **Videos on Swami Vivekananda** — `https://belurmath.org/videos-on-swami-vivekananda/`
   Official Belur Math video content; referenced for visual storytelling style
3. **Fact Check and Clarifications** — `https://belurmath.org/fact-check-and-clarifications/`
   Standard against which our anti-fabrication engine is designed and validated

### Works of Swami Vivekananda:
4. *Complete Works of Swami Vivekananda* (9 Volumes) — Advaita Ashrama, Mayavati
5. *Lectures from Colombo to Almora* — Advaita Ashrama, 1897
6. Romain Rolland, *The Life of Vivekananda and the Universal Gospel*, 1930

### AI & Technology:
7. **Groq Cloud API** — `https://groq.com` | `openai/gpt-oss-120b`
8. **Wan 2.1 Video Model** — `https://huggingface.co/Wan-AI/Wan2.1-I2V-14B-480P`
9. **FLUX.1 Studio Ghibli LoRA** — `https://huggingface.co/spaces/alvarobartt/FLUX.1-Studio-Ghibli-LoRA`
10. **Kokoro TTS** — `https://huggingface.co/spaces/ysharma/Make_Custom_Voices_With_KokoroTTS`
11. **Remotion** — React programmatic video — `https://www.remotion.dev`
12. **Next.js 16** — `https://nextjs.org`

### Statistics:
13. UNICEF India, *State of the World's Children 2023* — youth mental health data
14. Statista, *India Social Media Usage Report 2024* — Gen-Z screen time
15. UNESCO Institute for Statistics — India youth population (560M, age 15–34)

---

*Submission for: Case Study 06 — Teaching-to-Reel Generator*
*Repository: `github.com/ayushkumartht/Vivekanand`*
*Live Demo: `http://localhost:3000/story-board` | `http://localhost:3000/reel`*
