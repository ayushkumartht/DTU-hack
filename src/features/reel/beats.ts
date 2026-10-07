import { BEAT_ORDER, type ReelScript } from "./types";

/** The spoken text of each beat, in order. The quote beat is always the verbatim record text. */
export function beatTexts(script: ReelScript): string[] {
  return BEAT_ORDER.map((id) => (id === "quote" ? script.quote.verbatimText : script[id]));
}
