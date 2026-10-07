import type { LangCode } from "./teachings";
import { languageName } from "./i18n/languages";

/**
 * Every prompt used to write a reel lives here, so they can be reviewed and tuned in one place.
 * The verified quotation is NEVER given to the model to reproduce — only as private context.
 */

export interface BeatBudget {
  hook: number;
  situation: number;
  turn: number;
  takeaway: number;
  total: number;
}

/** Splits the spoken-word budget across the four AI-written beats. */
export function splitBudget(totalWords: number): BeatBudget {
  const total = Math.max(50, Math.round(totalWords));
  const hook = 11;
  const rest = total - hook;
  return {
    hook,
    situation: Math.round(rest * 0.32),
    turn: Math.round(rest * 0.45),
    takeaway: Math.round(rest * 0.23),
    total,
  };
}

const GUARDRAIL = `ABSOLUTE RULES (breaking any one makes the whole answer unusable):
1. You write an ORIGINAL modern dramatisation. You never reproduce or invent historical text.
2. NEVER write any sentence attributed to Swami Vivekananda: no "Vivekananda said / wrote / taught", no "as he put it", no "in his words", and no equivalents in Hindi or any other language (for example "स्वामी विवेकानंद ने कहा", "स्वामीजी के अनुसार").
3. NEVER use quotation marks of any kind ("", “”, «», ' ') anywhere in your output.
4. The verified quotation is inserted separately by the system. Do NOT quote it, translate it as if official, or restate it as his wording. You may only explain the IDEA in your own plain words, as an idea ("यह विचार सिखाता है कि…"), never as his sentence.
5. Do not invent facts about his life, dates, places, or events. No statistics, no studies, no "scientists say".
6. Do not promise results ("सफलता पक्की", "सब ठीक हो जाएगा"). No medical, diagnostic or mental-health claims. If the situation sounds like serious distress, stay gentle and simply encourage talking to a trusted person.`;

const HINDI_STYLE = `HINDI WRITING STYLE (this is spoken aloud by a text-to-speech voice, so write for the ear):
- Plain, warm, spoken Hindi, the way a good teacher explains in class. Not heavily Sanskritised, and not Hinglish. Use everyday words (मुश्किल, डर, कोशिश, आदत), not literary ones (क्लिष्ट, तादात्म्य).
- Devanagari script only. No English letters, no digits (write "पाँच मिनट", not "5 मिनट"), no emojis, no hashtags, no brackets, no "...", no symbols.
- Short sentences, at most 14 words each. End statements with "।" and questions with "?". Use commas where a speaker would pause.
- Use Indian names and settings (रिया, अर्जुन, आयुष, नेहा; हॉस्टल का कमरा, कोचिंग की बेंच, बस की खिड़की, सुबह का पाँच बजे का अलार्म).
- Address the viewer as "तुम" (warm, like an elder sibling or teacher), never "आप" in a stiff way and never "तू".`;

export function buildScriptSystemPrompt(opts: {
  language: LangCode;
  quoteText: string;
  quoteLang: LangCode;
  topics: string[];
  budget: BeatBudget;
}): string {
  const { language, quoteText, topics, budget } = opts;
  const lang = languageName(language);
  const style = language === "hi" ? HINDI_STYLE : `Write natural, spoken ${lang}, short sentences, no English letters, no digits, no emojis.`;

  return `You are an experienced Indian school teacher and a gifted short-video scriptwriter. You make 45-55 second vertical reels that bring one verified teaching of Swami Vivekananda to students aged 14-24, so that a teacher can also use the reel in class.

${GUARDRAIL}

${style}

LANGUAGE OF EVERY SPOKEN BEAT: ${lang}.

THE FOUR BEATS (they are read aloud back to back; total about ${budget.total} words):

1. "hook" — about ${budget.hook} words, ONE line. Must make a student stop scrolling within three seconds. Use ONE of: a question that names a private feeling, a blunt true statement, or a vivid tiny image. No clickbait, no lies, no shouting. It must be about the same struggle the teaching answers.
   Style reference only (do not copy): "रात के दो बजे भी नींद नहीं आ रही, और डर वही का वही?"

2. "situation" — about ${budget.situation} words. ONE specific modern scene with one named student, one place, and one concrete detail the viewer can see or hear. Show the inner thought in a single line. Make the viewer feel understood before anything else. Do not preach or blame.

3. "turn" — about ${budget.turn} words. This is the teaching moment, and it is where learning happens:
   a) one everyday comparison a child can picture, stated with its mapping spelled out ("जैसे बीज को मिट्टी में दबकर ही उगना होता है, वैसे ही…"). It must be physically accurate and logically clear. Choose a fresh one (a seed, a bicycle balance, a pressure-cooker whistle, a rope pulled from both ends, a muscle after exercise). Do NOT use phone batteries or other screen icons;
   b) then the IDEA of the teaching in plain words, as an idea and not as his sentence;
   c) then one sentence linking that idea back to the student's scene.
   EXPLAIN, do not command. The turn must NOT be a string of orders ("मजबूत बनो, भरोसा रखो, आगे बढ़ो") and must not repeat the teaching's own phrases. The student should be able to repeat the idea in their own words after hearing it once.

4. "takeaway" — about ${budget.takeaway} words. ONE small action to try TODAY that takes under five minutes, starts with a verb, is specific enough to check ("आज रात सोने से पहले एक पन्ने पर लिखो…"), and says how the viewer will know they did it. No lists. It must be an observable behaviour linked to the idea in the turn, not an empty affirmation (not just "मैं सक्षम हूँ कहो").

THE TEACHING (private context ONLY. Never reproduce it, quote it, or paraphrase it as his words). Themes: ${topics.join(", ") || "general"}.
"""${quoteText}"""

TEACHER NOTE (for the classroom, not spoken in the video), written in ${lang}:
- "keyIdea": the idea in one plain sentence a student could write in a notebook.
- "discussionQuestion": ONE open question that has no single right answer and links the idea to students' own lives.
- "classroomActivity": ONE five-minute activity with no materials beyond paper and pen.

Before you answer, re-read every spoken beat once: each sentence must be natural, grammatical ${lang} that means something clear. Delete any phrase that sounds like a literal translation or does not make sense.

Reply with ONLY one raw JSON object, no markdown, no commentary:
{"hook":"","situation":"","turn":"","takeaway":"","teacherNote":{"keyIdea":"","discussionQuestion":"","classroomActivity":""}}`;
}

/**
 * Second, separate call: turns the finished story into English prompts for image/video models.
 * Kept apart from the story so each task gets the model's full attention, and so the prompts
 * stay English whatever language the story is in.
 */
export function buildVisualsSystemPrompt(): string {
  return `You are a cinematographer writing shot descriptions for AI image and video models. EVERY word of your output is ENGLISH, even though the story you are given is in another language. Do not output any non-English characters.

You receive the four spoken beats of a short vertical reel (hook, situation, turn, takeaway) for Indian students. Turn them into shots.

PROTAGONIST. First write ONE "protagonist" sentence in English: age, build, hair, school or college clothing, and ONE natural, ordinary detail (a red school bag, a steel wristwatch, round spectacles). Never an odd or unrelated object. Reuse that sentence word for word at the very START of the hook, situation, turn and takeaway prompts, so the same student appears in every shot.

EACH SHOT PROMPT is 60-85 words (count them; shorter is not acceptable) and covers, in this order: subject and expression, setting with three concrete props, camera (shot size, angle, lens in mm), lighting (time of day, direction, colour temperature), colour grade, mood. Photorealistic, cinematic documentary look, vertical 9:16. Each shot must show what its beat says, so the video explains the story even with the sound off.
- Show ideas physically (a seed in soil, a cycle being balanced, a rope held taut), never as a screen, app, icon or UI element, because anything that looks like text or an icon renders badly.
- Make it unmistakably Indian and real: school uniforms, chalk dust, ceiling fans, steel tiffin boxes, hostel desks, tube lights, crowded buses. Not a Western stock photo.
- Never include: any text, sign, logo, watermark or caption in the frame; any real person; any depiction of Swami Vivekananda, a monk or a historic figure; religious idols as props.

OTHER FIELDS
- "quote": a calm, empty, low-detail, low-contrast background for text to sit on (open pre-dawn sky, still water, soft mist, an empty field). No people, nothing in the centre. 40-60 words.
- "motion": 25-40 words describing ONE smooth camera move for a 5-second clip of the "turn" shot (slow push-in or gentle parallax) plus small natural motion (breathing, hair, a curtain). No cuts, no morphing, no text.
- "stock": for each of hook, situation, turn and takeaway, 3-5 plain English keywords to search a stock-video library (for example "indian student studying night desk").

Reply with ONLY one raw JSON object, no markdown, no commentary:
{"protagonist":"","hook":"","situation":"","turn":"","quote":"","takeaway":"","motion":"","stock":{"hook":"","situation":"","turn":"","takeaway":""}}`;
}

export function buildVisualsUserPrompt(opts: {
  beats: { hook: string; situation: string; turn: string; takeaway: string };
  topics: string[];
  feedback?: string[];
}): string {
  const parts = [
    `Themes: ${opts.topics.join(", ") || "general"}.`,
    `hook: ${opts.beats.hook}`,
    `situation: ${opts.beats.situation}`,
    `turn: ${opts.beats.turn}`,
    `takeaway: ${opts.beats.takeaway}`,
  ];
  if (opts.feedback?.length) {
    parts.push(`YOUR PREVIOUS ATTEMPT WAS REJECTED. Fix exactly these problems:\n- ${opts.feedback.join("\n- ")}`);
  }
  return parts.join("\n");
}

export function buildScriptUserPrompt(opts: { problem: string; topics: string[]; audience?: string; feedback?: string[] }): string {
  const parts = [
    opts.problem
      ? `The student describes their situation (it may be Hindi, English or Hinglish; understand it, but write the answer in the required language): ${opts.problem}`
      : `Target viewer: ${opts.audience || "Indian students aged 14-24 facing exam pressure, self-doubt or distraction"}.`,
    `Themes: ${opts.topics.join(", ") || "general"}.`,
  ];
  if (opts.feedback?.length) {
    parts.push(`YOUR PREVIOUS ATTEMPT WAS REJECTED. Fix exactly these problems and change nothing else that was fine:\n- ${opts.feedback.join("\n- ")}`);
  }
  return parts.join("\n");
}

export function buildHooksSystemPrompt(language: LangCode): string {
  const lang = languageName(language);
  return `You write opening lines for a vertical reel for Indian students, to be read aloud in ${lang}.

Write 5 different hooks. Each is ONE line of at most 10 words that makes the viewer stop within three seconds. Use five different forms, one each:
1. a question that names a private feeling,
2. a blunt true statement,
3. a tiny vivid image,
4. a contradiction or surprise,
5. a direct address to the viewer.

Rules: no clickbait or lies, no shouting, no quotation marks of any kind, never attribute anything to Swami Vivekananda, never claim a result. They are original lines, not quotations. ${language === "hi" ? "Plain spoken Hindi in Devanagari only: no English letters, no digits, no emojis." : "No English letters if the language is not English, no digits, no emojis."}
They must be about the same struggle as the teaching below, but must not reproduce or paraphrase it.

Reply with ONLY {"hooks":["","","","",""]}.`;
}

/** Catches thin or unusable image/video prompts. Returns human-readable problems. */
export function checkVisualPrompts(visuals: {
  protagonist?: string;
  hook: string;
  situation: string;
  turn: string;
  takeaway: string;
  motion: string;
}): string[] {
  const issues: string[] = [];
  const all = [visuals.protagonist ?? "", visuals.hook, visuals.situation, visuals.turn, visuals.takeaway, visuals.motion].join(" ");
  const letters = all.replace(/[\s\d\p{P}]/gu, "");
  const latin = (all.match(/[A-Za-z]/g) ?? []).length;
  if (letters.length > 0 && latin / letters.length < 0.95) {
    issues.push("Some of the prompts are not in English. Write every word of every prompt in English, including the protagonist sentence.");
  }
  if (!visuals.protagonist) issues.push('"protagonist" is missing. Define the recurring student first.');
  for (const key of ["hook", "situation", "turn", "takeaway"] as const) {
    const text = visuals[key];
    if (wordCount(text) < 45) issues.push(`The "${key}" scene prompt is only ${wordCount(text)} words. Write 60-85 words with subject, three props, camera, lighting, colour grade and mood.`);
    if (/\b(icon|app|screen|ui|logo|caption|text on)\b/i.test(text)) issues.push(`The "${key}" scene prompt shows a screen, icon or text. Show the idea physically instead.`);
    if (visuals.protagonist && !text.toLowerCase().includes(visuals.protagonist.slice(0, 24).toLowerCase())) {
      issues.push(`The "${key}" scene prompt does not start with the protagonist sentence. Reuse it word for word.`);
    }
  }
  if (wordCount(visuals.motion) < 18) issues.push('The "motion" prompt is too short. Write 25-40 words describing one smooth camera move and small natural motion.');
  return issues;
}

const SCRIPT_RANGES: Partial<Record<LangCode, RegExp>> = {
  hi: /[ऀ-ॿ]/g,
  mr: /[ऀ-ॿ]/g,
  bn: /[ঀ-৿]/g,
  gu: /[઀-૿]/g,
  ta: /[஀-௿]/g,
  te: /[ఀ-౿]/g,
  kn: /[ಀ-೿]/g,
};

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Cheap checks that catch a weak script before it is voiced and rendered. Returns human-readable problems. */
export function checkScriptQuality(
  beats: { hook: string; situation: string; turn: string; takeaway: string },
  language: LangCode,
  budget: BeatBudget
): string[] {
  const issues: string[] = [];
  const spoken = Object.entries(beats) as [string, string][];

  for (const [name, text] of spoken) {
    if (/["“”„«»]/.test(text)) issues.push(`"${name}" contains quotation marks. Remove every quotation mark.`);
    if (/[#@]|[\u{1F300}-\u{1FAFF}]/u.test(text)) issues.push(`"${name}" contains an emoji or hashtag. Remove it.`);
  }

  const range = SCRIPT_RANGES[language];
  if (range) {
    for (const [name, text] of spoken) {
      const letters = text.replace(/[\s\d\p{P}]/gu, "");
      const native = (text.match(range) ?? []).length;
      if (letters.length > 0 && native / letters.length < 0.9) {
        issues.push(`"${name}" is not fully in the required script. Write it entirely in ${languageName(language)} with no English letters.`);
      }
      if (/\d/.test(text)) issues.push(`"${name}" contains digits. Write numbers as words.`);
    }
  }

  if (wordCount(beats.hook) > 14) issues.push(`"hook" is ${wordCount(beats.hook)} words. It must be at most 12.`);
  const total = spoken.reduce((s, [, t]) => s + wordCount(t), 0);
  if (total < budget.total * 0.7) issues.push(`The four beats total ${total} words, too short. Aim for about ${budget.total}. Add concrete detail to "situation" and a clearer comparison to "turn".`);
  if (total > budget.total * 1.3) issues.push(`The four beats total ${total} words, too long. Aim for about ${budget.total}. Tighten every beat.`);

  for (const [name, text] of spoken) {
    const longest = Math.max(...text.split(/[।.?!]/).map(wordCount));
    if (longest > 22) issues.push(`"${name}" has a sentence of ${longest} words. Split it into sentences of at most 14 words.`);
  }
  return issues;
}
