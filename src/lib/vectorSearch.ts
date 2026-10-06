import path from "path";
import fs from "fs";

export interface QuoteItem {
  id: number | string;
  title: string;
  quote: string;
  link: string;
  image_url?: string;
  vec?: Record<string, number>;
}

interface VectorIndexData {
  idf: Record<string, number>;
  quotes: QuoteItem[];
}

let cachedData: VectorIndexData | null = null;

function loadIndexData(): VectorIndexData {
  if (cachedData) return cachedData;

  const indexPath = path.join(process.cwd(), "data", "quotes_indexed.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Index file not found at ${indexPath}`);
  }

  const raw = fs.readFileSync(indexPath, "utf-8");
  cachedData = JSON.parse(raw) as VectorIndexData;
  return cachedData;
}

function tokenize(text: string): string[] {
  // Support both English words and Devanagari/Hindi character sequences
  const matches = text.toLowerCase().match(/[\w\u0900-\u097F]+/g);
  return matches || [];
}

/**
  Vector similarity search over the 147 Vivekananda quotes index using TF-IDF + Cosine similarity.
 */
export function searchRelevantQuotes(queryText: string, topK: number = 3): QuoteItem[] {
  const data = loadIndexData();
  const idf = data.idf;
  const quotes = data.quotes;

  const qTokens = tokenize(queryText);
  if (qTokens.length === 0) {
    return quotes.slice(0, topK);
  }

  // Count frequencies
  const tf: Record<string, number> = {};
  for (const token of qTokens) {
    tf[token] = (tf[token] || 0) + 1;
  }

  // Build query vector with TF-IDF weights
  const qVec: Record<string, number> = {};
  let normSq = 0;
  for (const [term, count] of Object.entries(tf)) {
    const weight = count * (idf[term] || 1.5);
    qVec[term] = weight;
    normSq += weight * weight;
  }

  const norm = normSq > 0 ? Math.sqrt(normSq) : 1.0;
  for (const term in qVec) {
    qVec[term] /= norm;
  }

  // Calculate similarity scores
  const scored = quotes.map((item) => {
    const vec = item.vec || {};
    let score = 0;

    for (const [term, weight] of Object.entries(qVec)) {
      if (vec[term]) {
        score += weight * vec[term];
      }
    }

    // Direct term match bonus
    const textLower = (item.title + " " + item.quote).toLowerCase();
    let keywordBonus = 0;
    for (const token of qTokens) {
      if (token.length > 2 && textLower.includes(token)) {
        keywordBonus += 0.12;
      }
    }

    return {
      quote: item,
      score: score + keywordBonus,
    };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map((s) => s.quote);
}
