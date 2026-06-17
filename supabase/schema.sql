-- YaFoot — prediction-first World Cup social app
-- Full schema: profiles, matches, predictions, leagues, friendships, messaging
-- Scoring: exact score = 3 pts, correct outcome = 1 pt, else 0

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  display_name  text,
  avatar_url    text,
  country       text,
  total_points  int  not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------- matches (World Cup fixtures, cached from data provider) ----------
create table if not exists public.matches (
  id            bigint generated always as identity primary key,
  external_id   text unique,                 -- provider match id
  competition   text not null default 'FIFA World Cup',
  season        text,                         -- e.g. '2026'
  stage         text,                         -- GROUP_STAGE, LAST_16, QUARTER_FINALS, ...
  group_name    text,                         -- 'Group A' etc
  matchday      int,
  home_team     text not null,
  home_code     text,                         -- 'FRA'
  home_flag     text,                         -- emoji or url
  away_team     text not null,
  away_code     text,
  away_flag     text,
  home_score    int,
  away_score    int,
  status        text not null default 'SCHEDULED', -- SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, POSTPONED
  minute        text,                         -- live minute display
  utc_kickoff   timestamptz,
  venue         text,
  last_updated  timestamptz not null default now()
);
create index if not exists matches_kickoff_idx on public.matches(utc_kickoff);
create index if not exists matches_status_idx  on public.matches(status);

-- ---------- predictions ----------
create table if not exists public.predictions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  match_id       bigint not null references public.matches(id) on delete cascade,
  pred_home      int not null,
  pred_away      int not null,
  points_awarded int not null default 0,
  scored         boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique(user_id, match_id)
);
create index if not exists predictions_user_idx  on public.predictions(user_id);
create index if not exists predictions_match_idx on public.predictions(match_id);

-- ---------- leagues (competitions among friends) ----------
create table if not exists public.leagues (
  id          bigint generated always as identity primary key,
  name        text not null,
  code        text unique not null,           -- join code
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  description text,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.league_members (
  league_id bigint not null references public.leagues(id) on delete cascade,
  user_id   uuid   not null references public.profiles(id) on delete cascade,
  role      text   not null default 'member', -- owner | member
  points    int    not null default 0,        -- points within this league window
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- ---------- friendships ----------
create table if not exists public.friendships (
  id           bigint generated always as identity primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending', -- pending | accepted
  created_at   timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

-- ---------- messaging ----------
-- league chat
create table if not exists public.league_messages (
  id         bigint generated always as identity primary key,
  league_id  bigint not null references public.leagues(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists league_messages_idx on public.league_messages(league_id, created_at);

-- direct messages between friends (canonical pair ordering: a < b)
create table if not exists public.direct_messages (
  id         bigint generated always as identity primary key,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists dm_pair_idx on public.direct_messages(sender_id, recipient_id, created_at);

-- ---------- scoring function ----------
-- Awards points for a finished match to all predictions, updates totals.
create or replace function public.score_match(p_match_id bigint)
returns void
language plpgsql
security definer
as $$
declare
  m record;
  pts int;
  pr record;
begin
  select * into m from public.matches where id = p_match_id;
  if not found or m.status <> 'FINISHED' or m.home_score is null or m.away_score is null then
    return;
  end if;

  for pr in select * from public.predictions where match_id = p_match_id and scored = false loop
    if pr.pred_home = m.home_score and pr.pred_away = m.away_score then
      pts := 3;                                            -- exact score
    elsif sign(pr.pred_home - pr.pred_away) = sign(m.home_score - m.away_score) then
      pts := 1;                                            -- correct outcome
    else
      pts := 0;
    end if;

    update public.predictions
      set points_awarded = pts, scored = true, updated_at = now()
      where id = pr.id;

    update public.profiles
      set total_points = total_points + pts
      where id = pr.user_id;

    update public.league_members lm
      set points = lm.points + pts
      where lm.user_id = pr.user_id;
  end loop;
end;
$$;

-- Trigger: when a match flips to FINISHED with scores, run scoring once.
create or replace function public.on_match_finished()
returns trigger language plpgsql as $$
begin
  if new.status = 'FINISHED' and new.home_score is not null and new.away_score is not null
     and (old.status is distinct from 'FINISHED') then
    perform public.score_match(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_match_finished on public.matches;
create trigger trg_match_finished after update on public.matches
  for each row execute function public.on_match_finished();

-- auto-add owner as member on league creation
create or replace function public.on_league_created()
returns trigger language plpgsql security definer as $$
begin
  insert into public.league_members(league_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists trg_league_created on public.leagues;
create trigger trg_league_created after insert on public.leagues
  for each row execute function public.on_league_created();
