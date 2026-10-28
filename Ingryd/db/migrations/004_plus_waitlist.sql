-- "Ingryd Plus" waitlist + price survey. One row per user; they can change their answer.
-- Safe to run more than once.
create table if not exists public.plus_waitlist (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text,
  price_choice text not null check (price_choice in ('3_99', '5_99', '9_99', 'none')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.plus_waitlist enable row level security;

drop policy if exists "plus_waitlist_select_own" on public.plus_waitlist;
create policy "plus_waitlist_select_own" on public.plus_waitlist
  for select using (auth.uid() = user_id);

drop policy if exists "plus_waitlist_insert_own" on public.plus_waitlist;
create policy "plus_waitlist_insert_own" on public.plus_waitlist
  for insert with check (auth.uid() = user_id);

drop policy if exists "plus_waitlist_update_own" on public.plus_waitlist;
create policy "plus_waitlist_update_own" on public.plus_waitlist
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- See the demand (run in the SQL editor; the service role bypasses RLS):
--   select price_choice, count(*) from public.plus_waitlist group by 1 order by 2 desc;
