# 🧠 PROJECT KYA HAI — FULL SIMPLE EXPLANATION
### (Bilkul easy language mein — jaise dost ko samjha rahe ho)

---

## 📌 EK LINE MEIN KYA KARTA HAI YEH PROJECT?

> **Student apni problem likhta hai → AI ek 30-60 second ka reel banata hai → Reel mein Vivekananda ki REAL, verified teaching hoti hai → End mein QR code hota hai jo seedha Belur Math ke official page pe jaata hai.**

---

## 🏗️ PROJECT KE 3 BADE HISSE

```
┌─────────────────────────────────────────────────────┐
│  HISSA 1: WEBSITE (jo tum browser mein dekhte ho)   │
│  HISSA 2: BACKEND (server pe jo kaam hota hai)      │  
│  HISSA 3: VIDEO BANANA (Remotion se final MP4)      │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 HISSA 1 — WEBSITE (Pages)

### Page 1: `/` — Landing Page
- **Kya hai?** Sirf ek sundar welcome page
- **Koi AI nahi** — bas HTML/CSS ka design

### Page 2: `/story-board` — Story Board
- **Yahan student apni problem likhta hai**
- Yeh purana feature hai — story + 4 Ghibli images + video

### Page 3: `/reel` — Reel Studio ⭐ (Naya)
- **Yahan naya 3-act reel banta hai**
- Student problem likhta hai → puri reel generate hoti hai

---

## 🤖 HISSA 2 — BACKEND ROUTES (APIs)

### Yeh socho ki yeh sab "kaam karne wale workers" hain

---

### 📚 TEACHING DHUNDHNA — `/api/reel/teachings`

```
Student ne likha: "exam mein focus nahi hota"
        ↓
Kaam: Database mein se sabse related teaching dhundho
        ↓
Tool: LOCAL TF-IDF (koi bhi internet call nahi)
        ↓
Mila: "Take up one idea. Make that one idea your life..."
      (Source: Belur Math — verified ✅)
```

**Simple words mein:** Google ki tarah search — par sirf Belur Math ki 147 teachings ke andar

---

### ✍️ SCRIPT LIKHNA — `/api/reel/script`

```
Teaching mili → Ab reel ka script likho
        ↓
Kaun likhta hai: GROQ AI (model: openai/gpt-oss-120b)
        ↓
Kya likhta hai:
  - HOOK (0-10s): "Raat ke 2 baje bhi neend nahi aati?" 
  - SITUATION (10-25s): Ek student ki relatable story
  - TURN (25-45s): Teaching ka idea APNE words mein (NEVER Vivekananda ke words copy nahi karta)
  - TAKEAWAY (45-60s): "Aaj raat ek kaam karo..."
        ↓
SABSE IMPORTANT RULE: AI KABHI BHI VIVEKANANDA KA QUOTE NAHI LIKHTA
Quote alag se locked record se aata hai — AI touch nahi karta
```

**Simple words mein:** Ek experienced teacher jo student ki situation ko samajh ke story likhta hai — par quote kabhi nahi todta

---

### 🪝 HOOKS BANANA — `/api/reel/hooks`

```
Kaam: 5 alag-alag opening lines banao reel ke liye
      (thumb-stop karne wali — 3 second mein attention pakad le)
        ↓
Kaun: GROQ AI
        ↓
5 types:
  1. Question (private feeling)    → "Sab aage nikal rahe hain?"
  2. Blunt statement               → "Mehnat ki nahi, direction ki kami hai."
  3. Vivid image                   → "Raat ke 3 baje wala alarm..."
  4. Contradiction/surprise        → "Jitna daro, utna hi hoga."
  5. Direct address                → "Yeh reel tere liye hai."
```

---

### 🖼️ IMAGES BANANA — `/api/reel/clip` (visual ke liye)

```
Script ready hai → Ab visuals banao
        ↓
Kaunsa model: FLUX.1-Studio-Ghibli-LoRA
              (Hugging Face Space — free ZeroGPU)
        ↓
Kya banta hai: 4 Ghibli-style scenes
               - Hook scene (student frustrated)
               - Situation scene (specific moment)  
               - Turn scene (clarity/insight)
               - Takeaway scene (action/hope)
        ↓
Format: 9:16 (phone ka size, 576x1024)
        ↓
Agar quota khatam: Fallback → placeholder image (pipeline crash nahi hota)
```

**Simple words mein:** Studio Ghibli (anime) style ki beautiful illustrations

---

### 🎬 WAN VIDEO — `src/lib/wanVideo.ts`

```
Image ready hai → Ab use motion video banao
        ↓
Kaunsa model: Wan 2.1 (I2V — Image to Video)
              Space: Wan-AI/Wan2.1-I2V-14B-480P
        ↓
Kya hota hai: Static image → 13-15 second cinematic video
              Camera pan karta hai, light shift hoti hai
        ↓
Act 2 ke liye: Inspiring story wala part
        ↓
Agar quota khatam: Fallback → Ken-Burns (zoom in/out animation)
```

**Simple words mein:** Image ko zindagi deta hai — Hollywood jaise camera movement

---

### 🎙️ NARRATION (AWAAZ) — `/api/reel/narration`

```
Script ready → Ab awaaz banao
        ↓
Kaunsa model: Kokoro TTS
              (Hugging Face Space — free)
        ↓
Kya karta hai: Text → MP3 audio
               3 parts: Hook audio + Story audio + Takeaway audio
        ↓
ffmpeg se: Sab audio merge hote hain ek file mein
```

**Simple words mein:** AI voice artist jo reel ke liye awaaz deta hai

---

### 📹 FINAL VIDEO BANANA — `/api/reel/render`

```
Sab ready: Images + Videos + Audio + Script
        ↓
Kaun banata hai: REMOTION
                 (React se video banti hai — headless Chrome)
        ↓
Final output: 9:16 MP4 (1080x1920, 30fps)
        ↓
3 Acts:
  [0-10s]  → Hook scene + Kinetic subtitles (3-word flashing)
  [10-45s] → Wan 2.1 video + Story narration
  [45-60s] → Quote card (locked) + Belur Math QR Code
        ↓
Download hota hai: MP4 + provenance.json (proof file)
```

---

### 🔒 AUTHENTICITY ENGINE — `src/lib/authenticity.ts`

```
YEH SABSE IMPORTANT SYSTEM HAI
        ↓
Kya karta hai: QUOTE KI SECURITY GUARD
        ↓
3 checks:
  ✅ assertVerbatim()  → Quote ek bhi character se alag? RENDER BLOCK.
  ✅ detectFabricated() → AI ne khud koi quote likha? BLOCK.
  ✅ ATTRIBUTION check  → AI ne "Vivekananda said..." likha? BLOCK.
        ↓
Agar sab pass: ✅ Reel render hoti hai
Agar koi fail: ❌ Error — "Refusing to render"
```

**Simple words mein:** Security guard jo ensure karta hai ki Vivekananda ke naam pe koi jhooth nahi bola ja raha

---

### 📲 QR CODE — `src/lib/qrcode.ts`

```
Teaching mili → uski Belur Math URL se QR code banao
        ↓
Tool: qrcode npm package
Error correction: Level H (highest — video mein bhi scan hoga)
Format: Base64 PNG image
        ↓
Reel ke Act 3 mein neeche dikhta hai
Student scan kare → Seedha Belur Math ka page khule
```

---

## 🔄 PURI FLOW EK SAATH

```
STUDENT → problem likhe
    ↓
[1] TF-IDF Search → Best teaching dhundho (LOCAL, koi API nahi)
    ↓
[2] Groq AI → Script likho (4 beats: hook, situation, turn, takeaway)
    ↓
[3] Authenticity Check → Quote sahi hai? fabricated nahi? ✅
    ↓
[4] Groq AI → 5 hook options banao
    ↓
[5] FLUX.1 → 4 Ghibli images banao
    ↓
[6] Wan 2.1 → Act 2 ka cinematic video banao
    ↓
[7] Kokoro TTS → 3 audio clips banao
    ↓
[8] ffmpeg → Audio merge karo
    ↓
[9] qrcode → Belur Math QR banao
    ↓
[10] Remotion → Sab kuch ek 9:16 MP4 mein daalo
    ↓
STUDENT → Download kare reel + provenance.json ✅
```

---

## 🧰 KONSA MODEL — KISKE LIYE

| Model | Kaam | Free/Paid |
|---|---|---|
| **Groq (openai/gpt-oss-120b)** | Script likhna, hooks banana | Free tier |
| **FLUX.1-Studio-Ghibli-LoRA** | Ghibli style images | Free (HF ZeroGPU) |
| **Wan 2.1 I2V** | Image → Cinematic video | Free (HF ZeroGPU) |
| **Kokoro TTS** | Text → Awaaz | Free (HF Space) |
| **TF-IDF (local code)** | Teaching dhundhna | Free (no API) |
| **Remotion** | Final MP4 banana | Free (open source) |
| **ffmpeg** | Audio/video muxing | Free (bundled) |
| **qrcode (npm)** | QR code banana | Free (npm) |

---

## 📁 IMPORTANT FILES — EK NAZAR MEIN

| File | Kya karta hai |
|---|---|
| `src/lib/prompts.ts` | Sare AI prompts — rules, style, script format |
| `src/lib/authenticity.ts` | Quote security — assertVerbatim, fabrication detector |
| `src/lib/teachings.ts` | 147 Belur Math teachings ka data handler |
| `src/lib/vectorSearch.ts` | TF-IDF search engine |
| `src/lib/wanVideo.ts` | Wan 2.1 model integration |
| `src/lib/gradio.ts` | FLUX.1 image generation |
| `src/lib/kokoro.ts` | Kokoro TTS awaaz |
| `src/lib/qrcode.ts` | QR code generator |
| `src/lib/ffmpegPath.ts` | ffmpeg ka path resolver |
| `src/remotion/` | Final video composition |
| `data/teachings.json` | 147 verified Belur Math teachings |

---

## 🎯 SABSE SIMPLE SUMMARY

```
Problem Statement
      ↓ (TF-IDF — free, local)
Best Teaching
      ↓ (Groq AI — writes AROUND it, never copies it)
3-Act Script
      ↓
Images (FLUX.1) + Video (Wan 2.1) + Voice (Kokoro)
      ↓ (Authenticity Check — if quote wrong → BLOCK)
Final Reel (Remotion)
      ↓
Student ko milta hai:
  ✅ 30-60s vertical MP4
  ✅ Kinetic subtitles
  ✅ Real Belur Math quote (locked, verbatim)
  ✅ QR Code → Official page
  ✅ provenance.json (proof of authenticity)
```

---

*File: `docs/HOW-IT-WORKS.md`*
*Project: Vivekananda Teaching-to-Reel Generator*
