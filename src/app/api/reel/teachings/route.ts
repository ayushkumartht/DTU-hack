import { NextRequest, NextResponse } from "next/server";
import { listTeachings, searchTeachings, allTopics, quarantineCount, isReelFit, type LangCode } from "@/lib/teachings";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const topic = searchParams.get("topic") ?? undefined;
  const lang = (searchParams.get("lang") as LangCode | null) ?? undefined;
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 24), 1), 60);

  // Only reel-fit teachings are offered: the quote is spoken verbatim, so it must be short.
  const teachings = q
    ? searchTeachings(q, limit * 3).filter(isReelFit).slice(0, limit)
    : listTeachings({ topic, lang, limit, reelFit: true });

  return NextResponse.json({
    teachings,
    topics: allTopics(),
    stats: { verified: listTeachings().length, reelFit: listTeachings({ reelFit: true }).length, quarantined: quarantineCount() },
  });
}
