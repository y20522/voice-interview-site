-- Voice interview app database bootstrap (prototype-friendly)
-- Run this in Supabase SQL Editor once.

create extension if not exists pgcrypto;

-- =========================
-- Surveys (published questionnaire)
-- =========================
create table if not exists public.surveys (
  id text primary key,
  title text,
  config jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.surveys enable row level security;

-- Public clients can read published surveys
drop policy if exists "surveys_public_read" on public.surveys;
create policy "surveys_public_read"
on public.surveys
for select
to anon, authenticated
using (true);

-- Public clients can publish/overwrite surveys (prototype only)
drop policy if exists "surveys_public_write" on public.surveys;
create policy "surveys_public_write"
on public.surveys
for insert
to anon, authenticated
with check (true);

drop policy if exists "surveys_public_update" on public.surveys;
create policy "surveys_public_update"
on public.surveys
for update
to anon, authenticated
using (true)
with check (true);

-- =========================
-- Submissions (answers + audios)
-- =========================
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  participant_name text,
  survey_title text,
  answers jsonb,
  audio_files jsonb,
  submitted_at timestamptz not null default now()
);

alter table public.submissions enable row level security;

-- Participants can submit answers
drop policy if exists "submissions_public_insert" on public.submissions;
create policy "submissions_public_insert"
on public.submissions
for insert
to anon, authenticated
with check (true);

-- Admin page in this prototype uses the same anon key, so allow read
drop policy if exists "submissions_public_read" on public.submissions;
create policy "submissions_public_read"
on public.submissions
for select
to anon, authenticated
using (true);
