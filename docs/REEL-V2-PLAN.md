# Reel V2 — Implementation Plan + Judgement

Reference video: *"Swami Vivekananda — A Monk with a Mission"* (Sri Ramakrishna Math Chennai, 1:23).
Is doc mein: (1) video ka analysis, (2) aapki requirements, (3) **mera judgement**, (4) exact implementation steps, (5) presentation ki galtiyan jo judges pakad lenge.

---

## 1. Reference video ka analysis (2 screenshots se)

| Cheez | Video mein kya hai | Hum kya seekhen |
|---|---|---|
| Background | Soft off-white / cream, koi busy visual nahi | Calm, "editorial" look. Hamara abhi ka dark+golden look isse alag hai |
| Typography | Bahut bada bold text, ek line: *"A life with a higher purpose.."* | Ek screen = ek idea. Text hi hero hai |
| Do-weight title | `A VISIONARY OF` (patla) + **`MAN MAKING EDUCATION`** (mota), bottom-left | Lower-third title style, do weights mein |
| Visual | Ek chhota **framed real footage** (library mein student), center-right, bahut bada nahi | Full-screen Ghibli image nahi, real moving footage frame mein |
| Pace | 83 sec, har idea ke liye text + ek clip, dheere badalta hai | Aapki "bahut fast" wali shikayat ka jawab yahi hai: **ek idea ko saans lene do** |
| Branding | Corner mein Math ka logo | Hamara "Source: Belur Math" badge isi ka kaam karta hai |

> Limit: maine video dekha/suna nahi, sirf 2 screenshots (0:25 aur title card) dekhe. Narration aur baaki frames ke baare mein main kuch nahi keh sakta.

---

## 2. Aapki requirements (jaise maine samjhi)

1. **Ant mein quote padhi jaye** (awaaz mein) + Swamiji ki image samne aaye.
2. Conclusion par Swamiji ki **image aaye** (aap dengi/denge) aur **Hindi mein achhe tareeke se samjhaya jaye**.
3. Usse pehle ki **story mein Ghibli static images nahi**. Motion wale videos chahiye jo story explain karein.
4. **Video bahut fast ban rahi hai** — slow karni hai.
5. Style: upar wale reference video jaisa.

---

## 3. Mera judgement — kya achha hai, kya risky hai

### Jo achha hai
- **Motion > static**: ye sahi decision hai. Static Ghibli image par slow zoom reel jaisa feel nahi deta.
- **Pace slow karna**: sahi. Abhi ka reel 37s ka hai, ~124 words, aur 3-word captions har ~1 sec mein badalte hain. Isliye fast lagta hai.
- **Hindi explanation + QR + quote verbatim**: ye teeno milkar bahut strong hain. Quote asli (verbatim), samjhaana AI ka (labelled).
- **Reference video ka calm editorial style**: hamare dark golden theme se zyada "trustworthy" lagta hai, aur Belur Math ke tone se milta hai.

### Jo main nahi karunga / badalna padega

**A. "Swami Vivekananda jaisi voice" — nahi karunga.**
Swamiji ki koi verified recording nahi hai (jo ek 1890 wali claim hoti hai wo bhi vivadit hai). To "unki awaaz" banane ka matlab hoga AI se banayi hui awaaz ko unki awaaz bata dena. Ye case study ka sabse bada rule todta hai: *"AI-generated cheezein Swamiji ke asli shabd/awaaz ki tarah present na ho."*
**Kya karenge:** ek gambhir, dheemi "reader" voice, aur screen par saaf likha: *"AI voice mein padha gaya — Swamiji ki awaaz nahi"*.

**B. "Swamiji ki image samne aaye aur padhe" — sirf image, bolta hua chehra nahi.**
Image fade-in / dheemi zoom ke saath aayegi aur quote card ke saath rahegi. **Lip-sync ya animated chehra nahi**, kyunki wo deepfake hota hai aur lagega ki Swamiji khud bol rahe hain.
Image kaunsi: koi public-domain tasveer (jaise 1893 Chicago wali) ya Belur Math ki official image. Credit likhna hoga.

**C. Hindi explanation = AI ki vyakhya, Swamiji ke shabd nahi.**
Screen par label: *"Samjhiye (AI vyakhya)"*. Quote alag, vyakhya alag, kabhi mix nahi. Hamara `detectFabricatedQuotes` isse bhi check karega.

**D. Wan 2.1 par bharosa mat rakho.**
Maine test kiya: `Wan-AI/Wan2.1` Space Alibaba ki paid API ki owner-key par chalta hai aur abhi khaali jawab deta hai (t2v aur i2v dono). Hamare control mein nahi. **Primary motion source: stock video (Pexels)**, Wan sirf optional extra.

**E. Quote ki language.**
Verified data mein Hindi quote lagbhag nahi hai (87 verified mein sirf 1 Hindi). To quote **English (verbatim)** mein padhi jayegi (Bengali jahan official pair hai, 65 cards mein). **Hindi mein sirf vyakhya hogi.** Ye honest hai. Hindi mein khud translate karke quote dikhana "official" jaisa lagega, wo nahi.

---

## 4. Naya reel structure (~50 sec, abhi 37 sec)

```
ACT 1  HOOK            0–6s     Bada bold text, off-white bg, ek line. Halka motion.
ACT 2  STORY           6–32s    3 chhote scenes. Har scene = framed REAL motion clip + do-weight title
                                (lower-third, reference video jaisa). Hindi/Hinglish narration, dheemi.
ACT 3  CONCLUSION      32–55s   a) Swamiji ki image fade-in + quote card, quote ENGLISH mein padhi jaati hai
                                b) "Samjhiye (AI vyakhya)" — Hindi mein 2-3 vaakya
                                c) Takeaway + Belur Math QR + disclosure
```

Beats badalte hain: pehle 5 (`hook, situation, turn, quote, takeaway`), ab 7:
`hook, scene1, scene2, scene3, quote, explain, takeaway`.

---

## 5. Implementation — function by function

Har step ke baad `npx tsc --noEmit` aur `npm run build` chalana.

### Step A — Pace slow karna (sabse jaldi, 15 min)
| File | Change |
|---|---|
| `src/lib/duration.ts` | `TARGET_SECONDS` 35 → **52**. `WPM.en` 165 → **135**. `fitToWindow`: speed ko `[0.9, 1.0]` tak limit karo (kabhi tez nahi, sirf slow). |
| `src/lib/kokoro.ts` | Beats ke beech **0.5s silence** (ffmpeg `anullsrc`), concat se pehle. Kokoro ki default speed `0.92`. |
| `src/lib/subtitles.ts` | `buildCues`: har cue kam se kam **1.3s** (`minCueSeconds`), 3 → **4 words** per cue. |
| `src/remotion/ReelVideo.tsx` | `FADE` 8 → **15 frames**. Quote beat par kam se kam **9s** hold. |

### Step B — Motion footage (Ghibli hatao)
| File | Kya karna hai |
|---|---|
| `.env` | `PEXELS_API_KEY=` (free key: pexels.com/api) |
| `src/lib/stockVideo.ts` *(naya)* | `searchStockClip(query): Promise<{url, durationSec} \| null>` → `GET https://api.pexels.com/videos/search?query=…&orientation=portrait&per_page=6`, `video_files` mein se HD portrait chuno |
| `src/lib/stockVideo.ts` | `downloadClip(url): Promise<string>` → `public/generated/clip-<uuid>.mp4`, ffprobe se duration |
| `src/app/api/reel/clip/route.ts` | Provider chain: **Pexels → Wan (agar `MOCK_WAN_VIDEO=false`) → null** |
| `src/app/api/reel/script/route.ts` | Visual prompts ki jagah har scene ke liye **`searchQuery`** (2–4 English keywords, jaise `"student studying night library"`). Ghibli wording hatao. |
| `src/features/reel/hooks/useReel.ts` | `/api/story/scenes/image` calls **hata do** (story scenes ke liye). Image generation sirf fallback ke taur par. |

Licence: Pexels free hai, attribution zaroori nahi. Phir bhi credits line daal do.
Rule: stock footage mein Swamiji ka naam/chehra dikhane wali cheez **nahi** chunni.

### Step C — Reference video jaisa editorial design (Remotion)
| File | Change |
|---|---|
| `src/remotion/ReelVideo.tsx` | Naya theme: bg `#F6F2EA`, text `#3B3A4A` |
| `src/remotion/components/TitleLowerThird.tsx` *(naya)* | Do-weight title: `A VISIONARY OF` (weight 300) + **`MAN MAKING EDUCATION`** (weight 800), bottom-left |
| `src/remotion/components/FramedClip.tsx` *(naya)* | Clip ek rounded frame mein (screen ka ~55%), halka shadow, slow scale-in |
| `src/remotion/components/BigStatement.tsx` *(naya)* | Hook ke liye full-screen bada text, ek-ek line fade-in |

### Step D — Conclusion: Swamiji ki image + quote padhna + Hindi vyakhya
| File | Change |
|---|---|
| `public/swamiji/portrait.jpg` | **Aap deNge** (public-domain ya Belur Math official). Credit `public/swamiji/CREDIT.txt` mein |
| `src/remotion/components/PortraitQuote.tsx` *(naya)* | Portrait fade-in + dheemi zoom, uske neeche verbatim quote card. **Koi face-animation nahi.** Label: *"AI voice mein padha gaya"* |
| `src/features/reel/types.ts` | `BEAT_ORDER` 7 beats. Naya `explain` beat |
| `src/app/api/reel/script/route.ts` | Naya field `explain` (Hindi, 2–3 vaakya, quotation marks nahi, "Swamiji ne kaha" nahi). Prompt: *"Is teaching ko ek student ki zindagi se jodkar saral Hindi mein samjhao."* |
| `src/lib/authenticity.ts` | `auditScript` mein `explain` bhi shamil. Attribution patterns Hindi ke liye pehle se hain |
| `src/remotion/ReelVideo.tsx` | `explain` beat par label **"Samjhiye (AI vyakhya)"**, quote se alag card |

### Step E — Hindi / regional awaaz (Kokoro Hindi nahi bolta)
Abhi ka Space (`ysharma/Make_Custom_Voices_With_KokoroTTS`) sirf English hai. Hindi ke liye:

| Option | Fayda | Nuksaan |
|---|---|---|
| **Edge neural voices** (`hi-IN-SwaraNeural`, `hi-IN-MadhurNeural`; Bengali/Tamil/Telugu/Marathi/Gujarati/Kannada bhi) | Free, GPU quota nahi, achhi quality, saari regional languages | Unofficial service. Package install ke waqt verify karna (npm `msedge-tts`) |
| Google Cloud / Azure TTS (official) | Stable, licence saaf | API key + billing/free tier |
| Hugging Face Indic Spaces | Free | ZeroGPU quota ki wahi dikkat |

**Meri salah:** hackathon ke liye Edge voices. `src/lib/tts/index.ts` mein `synthesize({lang})`: `en` → Kokoro, baaki → Edge. `ttsReady` flags `src/lib/i18n/languages.ts` mein `true` karo.
Is se "voiceover sirf English" wali limit hat jaati hai.

### Step F — Test + verify
1. `npm run build` → 0 errors.
2. Ek reel banao, **ffprobe se duration 45–58s** check karo.
3. 3 frames nikalo (hook, scene, conclusion) aur dekho: off-white theme, framed clip, portrait + quote.
4. Quote ko Belur Math page se milao (side-by-side).
5. Sabotage test dobara: quote 1 character badlo → render block hona chahiye.

---

## 6. Presentation (PRESENTATION.md) ki galtiyan — judges ye pakad sakte hain

| Slide mein likha hai | Asli sach |
|---|---|
| "147 verified teachings" | **87 verified**, 60 quarantined; reel ke layak **69** (quote ≤320 chars) |
| "Kokoro TTS supports Hindi, Bengali" | **Galat.** Hamara Kokoro Space sirf English hai. Hindi/Bengali ke liye Edge/Indic TTS chahiye |
| "Wan 2.1 integrated" / "🔄 quota-dependent" | Abhi **kaam nahi kar raha** (Space khaali jawab deta hai). "Integrated, currently unavailable" likhein, ya Step B ke baad "stock motion + optional Wan" |
| "1080×1920" | Render abhi **720×1280** hai |
| "3 audio segments" | Abhi **5 beats** (Step D ke baad 7) |
| "byte-by-byte comparison" | Normalised comparison hai (NFC, whitespace, curly quotes). "Exact wording match" kehna safe hai |
| "Wan-AI/Wan2.1-I2V-14B-480P" | Hamne ye model nahi, `Wan-AI/Wan2.1` Space try kiya |
| "Regional languages (Tamil, Telugu…)" | Pipeline mein hain, par **voice abhi nahi**. Step E ke baad hi claim karein |
| Team slide: `[Member 2..5]` | Placeholders bharo, warna adhoori lagegi |
| Revenue: "₹1.02 Crore ARR" | Bina source ke projections hain. "Illustrative assumptions" likhein |
| Live demo `localhost` | Pre-rendered 3 reels backup rakhein (internet/quota fail hone par) |

**Sabse bada pitch point jo sach bhi hai:** *"Quote model se nahi guzarta. Wo verified record se copy hota hai aur render se pehle check hota hai."* Isko dabaye, aur jo cheezein abhi nahi hain unhe "next" mein daalein.

---

## 7. Order mein kya karein (agar time kam hai)

1. **Step A** — pace (turant farak dikhega)
2. **Step B** — Pexels motion (Ghibli hata, sabse bada visual upgrade)
3. **Step D** — portrait + Hindi vyakhya (aapka main ask)
4. **Step C** — editorial design
5. **Step E** — Hindi awaaz
6. Presentation fixes (Section 6) — demo se pehle zaroor

## 8. Mujhe aapse chahiye

- [ ] Swamiji ki **portrait image** (`public/swamiji/portrait.jpg`) aur uska credit
- [ ] **Pexels API key** (free)
- [ ] Faisla: Hindi awaaz ke liye **Edge voices** theek hain? (unofficial hai)
- [ ] Team ke 4 naam aur kaam (slide 9)
