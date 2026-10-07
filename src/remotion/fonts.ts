import { loadFont as loadSerif } from "@remotion/google-fonts/NotoSerif";
import { loadFont as loadBengali } from "@remotion/google-fonts/NotoSansBengali";
import { loadFont as loadDevanagari } from "@remotion/google-fonts/NotoSansDevanagari";
import { loadFont as loadTamil } from "@remotion/google-fonts/NotoSansTamil";
import { loadFont as loadTelugu } from "@remotion/google-fonts/NotoSansTelugu";
import { loadFont as loadGujarati } from "@remotion/google-fonts/NotoSansGujarati";
import { loadFont as loadKannada } from "@remotion/google-fonts/NotoSansKannada";
import type { LangCode } from "../lib/teachings";

// Without these, Indic subtitles render as empty boxes in the exported MP4.
const serif = loadSerif("normal", { weights: ["600"], subsets: ["latin"] });
const bengali = loadBengali("normal", { weights: ["600"], subsets: ["bengali", "latin"] });
const devanagari = loadDevanagari("normal", { weights: ["600"], subsets: ["devanagari", "latin"] });
const tamil = loadTamil("normal", { weights: ["600"], subsets: ["tamil", "latin"] });
const telugu = loadTelugu("normal", { weights: ["600"], subsets: ["telugu", "latin"] });
const gujarati = loadGujarati("normal", { weights: ["600"], subsets: ["gujarati", "latin"] });
const kannada = loadKannada("normal", { weights: ["600"], subsets: ["kannada", "latin"] });

export function fontFamilyFor(lang: LangCode): string {
  switch (lang) {
    case "bn": return bengali.fontFamily;
    case "hi":
    case "mr": return devanagari.fontFamily;
    case "ta": return tamil.fontFamily;
    case "te": return telugu.fontFamily;
    case "gu": return gujarati.fontFamily;
    case "kn": return kannada.fontFamily;
    default: return serif.fontFamily;
  }
}
