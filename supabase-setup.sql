-- Run this in your Supabase SQL Editor (supabase.com → your project → SQL Editor)

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'Untitled',
  scene jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notes enable row level security;

create policy "Users can do everything with own notes"
  on notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_notes_user_id on notes(user_id);
create index idx_notes_updated_at on notes(updated_at desc);
