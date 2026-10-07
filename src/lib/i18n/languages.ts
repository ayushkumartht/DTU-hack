import type { LangCode } from "../teachings";

export interface LanguageDef {
  code: LangCode;
  englishName: string;
  nativeName: string;
  /** True once a TTS provider can voice this language. Only English today (Kokoro). */
  ttsReady: boolean;
}

export const LANGUAGES: LanguageDef[] = [
  { code: "en", englishName: "English", nativeName: "English", ttsReady: true },
  { code: "hi", englishName: "Hindi", nativeName: "हिन्दी", ttsReady: false },
  { code: "bn", englishName: "Bengali", nativeName: "বাংলা", ttsReady: false },
  { code: "ta", englishName: "Tamil", nativeName: "தமிழ்", ttsReady: false },
  { code: "te", englishName: "Telugu", nativeName: "తెలుగు", ttsReady: false },
  { code: "mr", englishName: "Marathi", nativeName: "मराठी", ttsReady: false },
  { code: "gu", englishName: "Gujarati", nativeName: "ગુજરાતી", ttsReady: false },
  { code: "kn", englishName: "Kannada", nativeName: "ಕನ್ನಡ", ttsReady: false },
];

export function getLanguage(code: LangCode): LanguageDef {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export function languageName(code: LangCode): string {
  const l = getLanguage(code);
  return l.code === "en" ? "English" : `${l.englishName} (${l.nativeName}, in its own script)`;
}
