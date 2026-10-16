-- Per-user, per-day count of live YouCam skin scans. The backend (service role) reads and
-- writes it to enforce the per-user and total scan caps, so limits survive server restarts.
create table if not exists public.youcam_usage (
  user_id uuid not null,
  day date not null,
  n integer not null default 0,
  primary key (user_id, day)
);

-- RLS on with no policies: the browser (anon/authenticated roles) cannot touch it at all.
alter table public.youcam_usage enable row level security;
