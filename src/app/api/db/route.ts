import { NextRequest, NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

// Dummy table: reels(id, problem, teaching_id, created_at). See supabase/schema.sql.

// GET /api/db -> connection check + last 10 saved reels
export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ connected: false, reason: "SUPABASE_URL / SUPABASE_ANON_KEY not set" });
  }
  const { data, error } = await supabase.from("reels").select("*").order("created_at", { ascending: false }).limit(10);
  if (error) return NextResponse.json({ connected: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ connected: true, reels: data });
}

// POST /api/db { problem, teaching_id } -> save a dummy reel row
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ saved: false, reason: "Supabase not configured" }, { status: 503 });
  }
  const { problem, teaching_id } = await req.json();
  const { data, error } = await getSupabase()!.from("reels").insert({ problem, teaching_id }).select().single();
  if (error) return NextResponse.json({ saved: false, reason: error.message }, { status: 500 });
  return NextResponse.json({ saved: true, reel: data });
}
