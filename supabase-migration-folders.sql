-- Run this in Supabase SQL Editor to add folders to your EXISTING database

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'New Folder',
  created_at timestamptz not null default now()
);

alter table folders enable row level security;

create policy "Users can do everything with own folders"
  on folders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table notes add column if not exists folder_id uuid references folders(id) on delete set null;
