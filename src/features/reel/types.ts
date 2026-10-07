import type { LangCode } from "@/lib/teachings";

/** The quote block. NOT generated — assembled from a verified Teaching record. */
export interface VerifiedQuoteBlock {
  teachingId: string;
  lang: LangCode;
  verbatimText: string;
  author: string;
  sourceWork: string;
  sourceUrl: string;
  /** True when the displayed language is an official Belur Math rendering from the same card. */
  officialTranslation: boolean;
}

/** Five-beat reel script. Every field is AI-written EXCEPT `quote`. */
export interface ReelScript {
  teachingId: string;
  language: LangCode;
  hook: string; //  0-3s  — one scroll-stopping line
  situation: string; //  3-15s — a modern, relatable moment
  turn: string; // 15-30s — where the teaching lands
  quote: VerifiedQuoteBlock;
  takeaway: string; // 45-60s — one small action to try today
}

export type BeatId = "hook" | "situation" | "turn" | "quote" | "takeaway";
export const BEAT_ORDER: BeatId[] = ["hook", "situation", "turn", "quote", "takeaway"];

export interface ReelBeat {
  id: BeatId;
  /** The words spoken/shown for this beat. */
  text: string;
  /** True only for the quote beat — renders differently and is never regenerated. */
  verified: boolean;
  imagePrompt: string;
  imageUrl: string | null;
  status: "pending" | "generating" | "done" | "error";
  error?: string;
  durationInSeconds: number;
}

/** English image prompts, one per beat, plus the motion prompt for the Wan 2.1 clip on "turn". */
export interface ReelVisuals {
  hook: string;
  situation: string;
  turn: string;
  quote: string;
  takeaway: string;
  motion: string;
  /** One sentence describing the recurring student, reused verbatim in every scene prompt. */
  protagonist?: string;
  /** 3-5 English keywords per beat, for searching stock motion footage. */
  stock?: Partial<Record<"hook" | "situation" | "turn" | "takeaway", string>>;
}

/** Classroom material that accompanies the reel. Not spoken in the video. */
export interface TeacherNote {
  keyIdea: string;
  discussionQuestion: string;
  classroomActivity: string;
}

export interface AuthenticityReport {
  quoteVerbatim: boolean;
  fabricatedQuotations: string[];
  unattributedClaims: string[];
  translationIsOfficial: boolean;
  passed: boolean;
}

export interface ReelProvenance {
  teachingId: string;
  sourceUrl: string;
  verbatimQuote: string;
  attribution: string;
  language: LangCode;
  model: string;
  generatedAt: string;
  disclosure: string;
}
