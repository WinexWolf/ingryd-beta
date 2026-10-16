-- Run once in the Supabase SQL editor BEFORE deploying the matching frontend.
-- Stores the latest scan's per-concern scores on the user's profile so every Fit
-- Score can weight ingredients by how severe each concern actually is.
alter table public.profiles
  add column if not exists concern_scores jsonb not null default '{}'::jsonb,
  add column if not exists scanned_at timestamptz;
