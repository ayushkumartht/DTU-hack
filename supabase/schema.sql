-- Run this in Supabase Dashboard -> SQL Editor.
create table if not exists public.reels (
  id          uuid primary key default gen_random_uuid(),
  problem     text not null,
  teaching_id text,
  created_at  timestamptz not null default now()
);

-- Dummy/dev only: open access with the anon key. Tighten before going live.
alter table public.reels enable row level security;
create policy "dev anon read"   on public.reels for select using (true);
create policy "dev anon insert" on public.reels for insert with check (true);
