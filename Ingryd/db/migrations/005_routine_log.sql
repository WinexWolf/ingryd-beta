-- Daily routine check-in: one row per user per day (morning done, evening done, how the skin feels).
-- Safe to run more than once.
create table if not exists public.routine_log (
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_date   date not null,
  am         boolean not null default false,
  pm         boolean not null default false,
  feel       text check (feel in ('good', 'ok', 'rough')),
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

alter table public.routine_log enable row level security;

drop policy if exists "routine_log_select_own" on public.routine_log;
create policy "routine_log_select_own" on public.routine_log
  for select using (auth.uid() = user_id);

drop policy if exists "routine_log_insert_own" on public.routine_log;
create policy "routine_log_insert_own" on public.routine_log
  for insert with check (auth.uid() = user_id);

drop policy if exists "routine_log_update_own" on public.routine_log;
create policy "routine_log_update_own" on public.routine_log
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
