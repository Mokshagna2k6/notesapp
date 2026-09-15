-- Run this in your Supabase SQL Editor (supabase.com → your project → SQL Editor)

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'Untitled',
  scene jsonb not null default '{}',
  folder_id uuid,
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

-- Folders for organizing notes
create table folders (
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

alter table notes add constraint fk_notes_folder foreign key (folder_id) references folders(id) on delete set null;
