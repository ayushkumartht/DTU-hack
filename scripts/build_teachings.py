#!/usr/bin/env python3
"""
Build data/teachings.json from data/vivekananda_quotes.json.

Each Belur Math card contains the same teaching in 1-3 languages, separated by
<hr> in raw_html, each language block shaped as:

    <p>quote text</p>
    <p><strong>Author</strong></p>
    <p>(citation)</p>

This splits every card into per-language variants with their own verbatim text
and their own citation, tags topics, and QUARANTINES anything that does not
parse cleanly (needsReview=True) instead of guessing. Nothing quarantined is
ever shown as a verified teaching.
"""

import datetime
import html
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "vivekananda_quotes.json"
OUT = ROOT / "data" / "teachings.json"

HR = re.compile(r"<hr[^>]*/?>", re.I)
P_TAG = re.compile(r"<p[^>]*>(.*?)</p>", re.I | re.S)
TAG = re.compile(r"<[^>]+>")

BENGALI = re.compile(r"[ঀ-৿]")
DEVANAGARI = re.compile(r"[ऀ-ॿ]")
LATIN = re.compile(r"[A-Za-z]{3,}")

# Author strings that count as Swami Vivekananda himself, per script.
VIVEK_AUTHOR = re.compile(
    r"(swami\s*vivekananda|স্বামী\s*বিবেকানন্দ|স্বামি\s*বিবেকানন্দ|स्वामी\s*विवेकानन्द|swami\s*vivekanand)",
    re.I,
)

# Words that mark a card as something other than a Vivekananda quotation.
NOT_HIS_WORDS = re.compile(
    r"(বিরচিত|রচিত|স্তোত্র|स्तोत्र|\bhymn\b|\bstotra|salutations to swami|বিবেকানন্দকে নমস্কার|বিবেকানন্দপঞ্চকম্)",
    re.I,
)

# Citation text that must never appear inside a quotation body.
CITATION_IN_TEXT = re.compile(
    r"(complete\s+works|বাণী\s*ও\s*রচনা|বানী\s*ও\s*রচনা|swami\s*vivekananda\s*[(\[])",
    re.I,
)
LATIN_WORD = re.compile(r"[A-Za-z]{3,}")

TOPIC_KEYWORDS = {
    "courage": ["courage", "brave", "bold", "dare", "heroic", "lion"],
    "fearlessness": ["fear", "fearless", "afraid"],
    "self-confidence": ["faith in yourself", "self-confidence", "believe in yourself",
                        "confidence", "self-reliance", "trust in yourself",
                        "faith in yourselves", "faith in ourselves", "in yourselves",
                        "believe in yourselves", "self-faith", "unbounded faith"],
    "strength": ["strength", "strong", "weakness", "weak", "power", "energy", "vigour"],
    "concentration": ["concentration", "concentrate", "focus", "attention",
                      "meditation", "steady", "one-pointed"],
    "education": ["education", "teacher", "student", "learn", "knowledge", "study",
                  "school", "guru", "disciple"],
    "service": ["service", "serve", "help", "poor", "humanity", "others",
                "selfless"],
    "faith": ["faith", "belief", "god", "divine", "soul", "spiritual", "religion"],
}


def clean(fragment: str) -> str:
    """HTML fragment -> clean text, preserving <br> as spaces."""
    text = re.sub(r"<br\s*/?>", " ", fragment, flags=re.I)
    text = TAG.sub("", text)
    text = html.unescape(text)
    text = unicodedata.normalize("NFC", text)
    return re.sub(r"\s+", " ", text).strip()


def detect_lang(text: str) -> str:
    if BENGALI.search(text):
        return "bn"
    if DEVANAGARI.search(text):
        return "hi"
    if LATIN.search(text):
        return "en"
    return "unknown"


AUTHOR_RE = re.compile(
    r"(swami\s*vivekananda|স্বামী\s*বিবেকানন্দ|স্বামি\s*বিবেকানন্দ|स्वामी\s*विवेकानन्द|swami\s*vivekanand)",
    re.I,
)
# What may legitimately follow an author name when it is an attribution line.
CITATION_START = re.compile(
    r"^(?:[(\[]|[,:;\-–—]|(?:the\s+)?complete\s+works|life\s+of|স্বামী|স্বামি|स्वामी)",
    re.I,
)
BARE_CITATION = re.compile(r"^(?:the\s+)?complete\s+works", re.I)
EDGE_PUNCT = " \t -–—:;,\"“”‘’"


def strip_citation(text: str) -> str:
    t = text.strip(EDGE_PUNCT)
    if t.startswith("(") and t.endswith(")"):
        t = t[1:-1]
    elif t.startswith("[") and t.endswith("]"):
        t = t[1:-1]
    return t.strip()


def is_citation(text: str) -> bool:
    t = text.strip()
    if t.startswith("(") and t.endswith(")") and len(t) > 4:
        return True
    return bool(BARE_CITATION.match(t))


def split_attribution(text: str):
    """Split '<quote> Swami Vivekananda (<citation>)' style text.

    Returns (before, author, citation) or None when the author name is not
    acting as an attribution (e.g. it appears mid-sentence)."""
    m = AUTHOR_RE.search(text)
    if not m:
        return None
    after = text[m.end():].strip()
    if after and not CITATION_START.match(after):
        return None
    before = text[: m.start()].strip(EDGE_PUNCT)
    return before, m.group(0), strip_citation(after) or None


def parse_block(block_html: str):
    """One <hr>-delimited language block -> a variant dict, or None."""
    paras = P_TAG.findall(block_html)
    if not paras:
        return None

    quote_parts, author, source_work = [], None, None

    for raw in paras:
        text = clean(raw)
        if not text:
            continue
        if is_citation(text) and not AUTHOR_RE.match(text):
            source_work = source_work or strip_citation(text)
            continue
        attribution = split_attribution(text)
        if attribution:
            before, found_author, citation = attribution
            if before:
                quote_parts.append(before)
            author = author or found_author
            if citation:
                source_work = source_work or citation
            continue
        quote_parts.append(text)

    quote = " ".join(quote_parts).strip()
    if not quote:
        return None

    return {
        "lang": detect_lang(quote),
        "text": quote,
        "author": author,
        "sourceWork": source_work,
    }


def assign_topics(variants) -> list:
    """Classify on the English variant where available; share across all
    variants of the same card, since they are the same teaching."""
    english = next((v["text"] for v in variants if v["lang"] == "en"), "")
    haystack = english.lower()
    topics = [t for t, kws in TOPIC_KEYWORDS.items()
              if any(k in haystack for k in kws)]
    return topics or ["faith"]


def review_reasons(variants) -> list:
    reasons = []
    if not variants:
        return ["no parseable language block"]
    seen = set()
    for v in variants:
        if v["lang"] == "unknown":
            reasons.append("could not detect language")
            continue
        if v["lang"] in seen:
            reasons.append(f"duplicate '{v['lang']}' variant in one card")
        seen.add(v["lang"])
        if not v["sourceWork"]:
            reasons.append(f"missing citation for '{v['lang']}' variant")
        if not v["author"]:
            reasons.append(f"missing author for '{v['lang']}' variant")
        elif not VIVEK_AUTHOR.search(v["author"]):
            reasons.append(f"author is '{v['author']}', not Swami Vivekananda")
        if NOT_HIS_WORDS.search(v["text"]) or (
            v["sourceWork"] and NOT_HIS_WORDS.search(v["sourceWork"])
        ):
            reasons.append("looks like a hymn or verse not written as his own quotation")
        if CITATION_IN_TEXT.search(v["text"]):
            reasons.append(f"citation text leaked into the '{v['lang']}' quotation body")
        if v["lang"] in ("bn", "hi") and len(LATIN_WORD.findall(v["text"])) >= 4:
            reasons.append(f"'{v['lang']}' variant mixes in English text")
    return reasons


def build():
    records = json.loads(SRC.read_text(encoding="utf-8"))
    teachings, quarantined = [], []

    for rec in records:
        raw = rec.get("raw_html") or ""
        blocks = [b for b in HR.split(raw) if clean(b)]
        variants = [v for v in (parse_block(b) for b in blocks) if v]
        reasons = review_reasons(variants)

        known = [v for v in variants if v["lang"] != "unknown"]
        entry = {
            "id": str(rec["id"]),
            "kind": "quotation",
            "topics": assign_topics(variants) if variants else [],
            "sourceUrl": rec.get("link", ""),
            "imageUrl": rec.get("image_url"),
            "publishedAt": rec.get("date"),
            "variants": {
                v["lang"]: {
                    "text": v["text"],
                    "author": v["author"],
                    "sourceWork": v["sourceWork"],
                }
                for v in known
            },
            "primaryLang": "en" if any(v["lang"] == "en" for v in known)
            else (known[0]["lang"] if known else "unknown"),
            "needsReview": bool(reasons),
            "reviewReasons": sorted(set(reasons)),
        }

        (quarantined if entry["needsReview"] else teachings).append(entry)

    payload = {
        "generatedAt": datetime.datetime.now().isoformat(timespec="seconds"),
        "source": "https://media.belurmath.org/tag/quotations/",
        "verified": teachings,
        "quarantined": quarantined,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    langs = {}
    for t in teachings:
        for code in t["variants"]:
            langs[code] = langs.get(code, 0) + 1

    print(f"verified   : {len(teachings)}")
    print(f"quarantined: {len(quarantined)}")
    print(f"variants   : {langs}")
    print(f"written    : {OUT}")


if __name__ == "__main__":
    build()
