-- Tabell för projekten. Körs en gång i Supabase (SQL Editor).
--
-- Hela projektet ligger som JSON i data-kolumnen. Fälten bredvid finns bara
-- för att kunna sortera och filtrera utan att packa upp JSON:en, och speglar
-- alltid det som står inuti data.

create table if not exists public.projects (
  id text primary key,
  name text not null default '',
  archived boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  data jsonb not null
);

create index if not exists projects_updated_at_idx on public.projects (updated_at desc);

-- Radnivåsäkerhet är på och ingen policy släpper in någon. All åtkomst går
-- via appens serverrutter med den hemliga nyckeln, som passerar RLS. Det gör
-- att en läckt publik nyckel inte ger åtkomst till projekten.
alter table public.projects enable row level security;
