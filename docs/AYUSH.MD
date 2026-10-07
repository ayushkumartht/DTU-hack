# AYUSH.MD — 30-Second Student Wisdom Reel Architecture & Implementation Plan

## 1. Vision & Executive Summary

Bhot saare students modern distractions, exam stress, career anxiety, aur self-doubt se joojh rahe hain. Yeh system ek personalized, engaging aur authentic 30-35 second Instagram Reel / YouTube Short generate karta hai jisme:
1. Student apni relatable problem batata hai.
2. Reel student ke dard ko visually dikhati hai.
3. Wan 2.1 AI video model ke through Swami Vivekananda ki timeless wisdom ko ek relatable story/visual mein transform kiya jata hai.
4. End mein action-oriented takeaway + authentic Belur Math source ka real QR Code aata hai jise scan karke student puri teaching padh sakta hai.

---

## 2. Reel Structure Breakdown (30-35 Seconds Timeline)

Hum reel ko 3 high-impact acts mein divide kar rahe hain:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             30-35s REEL TIMELINE                                 │
├───────────────────────┬────────────────────────────┬─────────────────────────────┤
│  ACT 1: Hook & Pain   │    ACT 2: Wisdom Story     │  ACT 3: Conclusion & Action │
│       (0s - 10s)      │        (10s - 23s)         │         (23s - 35s)         │
├───────────────────────┼────────────────────────────┼─────────────────────────────┤
│ • Relatable student   │ • Wan 2.1 cinematic video  │ • Direct, actionable punch  │
│   struggle/problem    │ • Core teaching revealed   │ • Verbatim quote on screen  │
│ • Fast kinetic caption│ • Mental shift / insight   │ • Belur Math QR Code        │
│ • "Thumb-stop" hook   │ • Swami Vivekananda's rule │ • Scan to read full source  │
└───────────────────────┴────────────────────────────┴─────────────────────────────┘
```

### Detailed Breakdown:

### Act 1: The Relatable Student Struggle (0s – 10s)
* **Goal:** Thumb-stopping hook + student empathy.
* **Duration:** 8 to 10 seconds.
* **Visual:** Student situation (late night study, glowing laptop screen, staring at mock test marks, self-doubt, social media anxiety).
* **Audio / Subtitles:** 
  * Punchy opening hook (e.g. *"Padhte waqt dimaag blank ho jata hai?"* / *"Sab aage nikal rahe hain aur tum wahi khade ho?"*).
  * High-energy, dynamic, kinetic 3-word subtitles centered on screen (MrBeast / Alex Hormozi style) taaki bina audio ke bhi attention capture ho.

### Act 2: The Wan AI Wisdom Story (10s – 23s)
* **Goal:** Visual impact + philosophical solution based on Swami Vivekananda's teachings.
* **Duration:** 13 to 15 seconds.
* **Visual:** **Wan 2.1 Video Model** generated cinematic motion video (3D depth / cinematic anime / realistic motion). Camera panning, lighting shift from darkness/confusion to clarity/strength.
* **Audio / Voiceover:**
  * Concise story / perspective shift rooted in Belur Math's indexed teachings.
  * AI dramatization jo Vivekananda ji ke core principle ko student ki situation se connect karti hai.
  * Voiceover: Natural paced Kokoro / Indic TTS audio.

### Act 3: Conclusion & Belur Math QR Code (23s – 35s)
* **Goal:** Actionable takeaway + undeniable authenticity & research.
* **Duration:** 10 to 12 seconds.
* **Visual Composition:**
  * **Top Half:** Bold takeaway text + Verbatim Quote highlight ("Take up one idea. Make that one idea your life...").
  * **Bottom Half:** Clean, scannable **Dynamic QR Code** pointing directly to the verified Belur Math archive URL (`https://media.belurmath.org/...`).
  * **Badge:** *"Official Archive: Belur Math"* + Call To Action: *"Scan for full discourse"*.
* **Audio:** One clear takeaway line + motivating ending note.

---

## 3. Technology & Architecture Stack

| Layer | Technology | Role |
|---|---|---|
| **Frontend UI** | Next.js 16 (App Router), TypeScript, Arc UI | Reel Studio Dashboard (`/reel`) |
| **Story & Script Engine** | Groq (`openai/gpt-oss-120b`) | 3-Act script generation (Hook, Wisdom, Conclusion) |
| **Authenticity Engine** | Local TF-IDF Vector Search + `teachings.json` | 147 Verified Belur Math records (verbatim quote & source link) |
| **Cinematic Video Model** | **Wan 2.1 (I2V / T2V)** via Gradio / API Client | Generates high-quality 3D/cinematic motion video clips |
| **Backup Visuals** | FLUX.1 LoRA (Ghibli/Anime) | Static image fallback if video quota is exhausted |
| **Audio / TTS** | Kokoro TTS (`ysharma/Make_Custom_Voices_With_KokoroTTS`) | 3-part synced narration MP3 |
| **Dynamic QR Generator** | `qrcode` (Node.js canvas/svg) | Generates scanable QR Code overlay targeting the exact Belur Math link |
| **Video Composition & Render** | **Remotion** (`@remotion/player`, `@remotion/renderer`) | 9:16 vertical 1080x1920 layout, kinetic subtitles, Ken-Burns motion, QR overlay |
| **Audio Muxing** | System `ffmpeg` / `ffprobe` | Transcoding, timing probe & final MP4 mux |

---

## 4. Implementation Steps (Execution Plan)

### Step 1: Data & QR Setup
1. **Belur Math Link Extractor:** Ensure har teaching record mein `sourceUrl` (`https://media.belurmath.org/...`) validated ho.
2. **QR Code Generator Utility:**
   * File: `src/lib/qrcode.ts`
   * Function: `generateBelurQr(sourceUrl: string): Promise<string>` jo ek base64 data-URI PNG generate kare with high error correction (`H`) taaki video mein bhi aasani se scan ho sake.

### Step 2: 3-Act Script Generation API (`/api/reel/script`)
Create specialized Groq prompt designed for Indian students:
* Input: Student's problem statement (Hindi / English / Hinglish).
* Match: Vector search matches the best Vivekananda quote from `data/teachings.json`.
* Output JSON:
  ```json
  {
    "teachingId": "123",
    "act1_hook": {
      "speech": "Jab lagta hai ki tumhare efforts ka koi result nahi aa raha...",
      "visualPrompt": "Tired Indian engineering student sitting with open books at night, stressed look, warm desk lamp"
    },
    "act2_wisdom": {
      "speech": "Swami Vivekananda ne sikhaya tha: apne pure dhyan ko ek target par focus karo...",
      "wanMotionPrompt": "Cinematic 3D slow motion camera tracking, student standing up with fiery confidence, glowing golden sunrise background, 8k quality"
    },
    "act3_conclusion": {
      "speech": "Aaj se overthinking band, action shuru. Puri teaching padhne ke liye niche QR scan karo.",
      "takeaway": "Choose one task. Do not stop until it is finished.",
      "verbatimQuote": "Take up one idea. Make that one idea your life...",
      "sourceWork": "Complete Works of Swami Vivekananda, Vol 1",
      "sourceUrl": "https://media.belurmath.org/tag/quotations/..."
    }
  }
  ```

### Step 3: Wan 2.1 Video Model Integration
* File: `src/lib/wanVideo.ts`
* Model: Connect to Wan 2.1 Space / API for image-to-video or text-to-video:
  * Width: 576, Height: 1024 (9:16 vertical)
  * Motion strength & guidance scale tuned for cinematic realism.
  * Graceful fallback: Agar ZeroGPU quota hit ho, fallback to animated Ken-Burns image so pipeline never crashes.

### Step 4: Narration & Duration Sync (`src/lib/duration.ts`)
* Total Reel Duration: 30 - 34 seconds.
  * Act 1: ~8.5 seconds (20-25 words)
  * Act 2: ~14.0 seconds (35-40 words)
  * Act 3: ~10.0 seconds (22-26 words)
* Kokoro TTS generates 3 audio clips, combined with seamless background ambient music.

### Step 5: Remotion Reel Composition (`src/remotion/StudentReel.tsx`)
Create Remotion component for 9:16 video (1080x1920, 30fps):
1. **Frames 0 - 270 (0s - 9s):** Act 1 Scene + Large Kinetic Subtitles (center).
2. **Frames 270 - 690 (9s - 23s):** Wan 2.1 3D Video Clip playing full-screen + Inspiring voiceover + subtitle.
3. **Frames 690 - 1020 (23s - 34s):**
   * Background: Soft blurred background of previous scene.
   * Top Card: Quote & Takeaway box with gold border.
   * Bottom Card: Crisp white QR Code card + text: *"Scan to read original Belur Math discourse"* + Belur Math logo/badge.

### Step 6: Full Studio UI (`src/app/reel/page.tsx`)
* Student Problem Input: Box jisme student apni problem likhe (e.g., *"Exam me focus nahi ho raha, bohot distract hota hu"*).
* Instant One-Click Generator:
  1. Matches authentic teaching.
  2. Generates script & Wan prompt.
  3. Synthesizes voice & Wan video clip.
  4. Encodes QR code.
  5. Live Remotion Player preview with instant Play / Download MP4.

---

## 5. Deliverables & Next Steps

1. [x] **Architecture Blueprint**: Detailed in `docs/AYUSH.MD`.
2. [ ] **Step A**: Install `qrcode` package (`npm install qrcode @types/qrcode`).
3. [ ] **Step B**: Create `src/lib/qrcode.ts` and `src/lib/wanVideo.ts`.
4. [ ] **Step C**: Build `src/remotion/StudentReel.tsx` with QR code overlay and 3-Act layout.
5. [ ] **Step D**: Wire up `/api/reel/generate` and test with real student situations.
