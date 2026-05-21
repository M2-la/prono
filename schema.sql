-- ══════════════════════════════════════════════════
--  CHRONO PRONOSTICS — Supabase Schema
--  À coller dans SQL Editor > New Query > Run
-- ══════════════════════════════════════════════════

-- Table des paris
create table if not exists bets (
  id            uuid primary key default gen_random_uuid(),
  user_name     text not null,
  category      text not null,  -- juste_prix | specialiste | transition | tierce | premier_homme | premier_femme
  target        text not null,  -- nom de l'athlète, discipline, T1/T2, podium, homme, femme
  value         text not null,  -- secondes (juste_prix), nom (autres), "nom1,nom2,nom3" (tiercé)
  created_at    timestamptz default now(),
  unique (user_name, category, target)  -- un seul pari par combo = upsert
);

-- Table des résultats réels (saisie admin)
create table if not exists results (
  id        uuid primary key default gen_random_uuid(),
  athlete   text not null unique,
  natation  text,   -- MM:SS
  t1        text,   -- MM:SS
  velo      text,   -- HH:MM:SS ou MM:SS
  t2        text,   -- MM:SS
  course    text,   -- HH:MM:SS ou MM:SS
  updated_at timestamptz default now()
);

-- Trigger pour updated_at automatique
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger results_updated_at
  before update on results
  for each row execute function update_updated_at();

-- Row Level Security (RLS) — accès public en lecture/écriture
-- (Pour une vraie protection, utilise l'auth Supabase)
alter table bets enable row level security;
alter table results enable row level security;

create policy "Lecture publique bets" on bets for select using (true);
create policy "Ecriture publique bets" on bets for insert with check (true);
create policy "Maj publique bets" on bets for update using (true);

create policy "Lecture publique results" on results for select using (true);
create policy "Ecriture admin results" on results for insert with check (true);
create policy "Maj admin results" on results for update using (true);

-- Vue pratique pour debug
create or replace view bets_count as
  select user_name, count(*) as nb_paris
  from bets
  group by user_name
  order by nb_paris desc;
