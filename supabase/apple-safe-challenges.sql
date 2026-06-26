-- Apple-safe v1: user-created football prediction challenges.
-- Keeps the existing provider match feed intact, but gives review-safe builds a
-- generic creation path tagged as YaFoot Challenge.

create or replace function public.create_challenge_match(
  p_home_team text,
  p_away_team text,
  p_kickoff timestamptz,
  p_challenge_name text default null
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.matches;
  clean_home text := nullif(trim(p_home_team), '');
  clean_away text := nullif(trim(p_away_team), '');
  clean_name text := nullif(trim(p_challenge_name), '');
begin
  if clean_home is null or length(clean_home) < 2 then
    raise exception 'Team or country A needs at least 2 characters';
  end if;
  if clean_away is null or length(clean_away) < 2 then
    raise exception 'Team or country B needs at least 2 characters';
  end if;
  if lower(clean_home) = lower(clean_away) then
    raise exception 'Choose two different teams or countries';
  end if;
  if p_kickoff is null then
    raise exception 'Start time is required';
  end if;

  insert into public.matches (
    external_id,
    competition,
    season,
    stage,
    group_name,
    home_team,
    away_team,
    status,
    utc_kickoff,
    venue
  )
  values (
    'challenge-' || gen_random_uuid()::text,
    'YaFoot Challenge',
    null,
    'Friend Challenge',
    coalesce(clean_name, 'Friend challenge'),
    clean_home,
    clean_away,
    'SCHEDULED',
    p_kickoff,
    'Created by friends'
  )
  returning * into row;

  return row;
end;
$$;

grant execute on function public.create_challenge_match(text, text, timestamptz, text) to authenticated;

-- Apple-safe v2: private prediction competitions own their custom matches.
create table if not exists public.league_matches (
  league_id bigint not null references public.leagues(id) on delete cascade,
  match_id bigint not null references public.matches(id) on delete cascade,
  ordinal int not null default 1,
  created_at timestamptz not null default now(),
  primary key (league_id, match_id)
);

create index if not exists league_matches_league_ordinal_idx on public.league_matches(league_id, ordinal);
create index if not exists league_matches_match_idx on public.league_matches(match_id);

alter table public.league_matches enable row level security;

drop policy if exists league_matches_read on public.league_matches;
create policy league_matches_read on public.league_matches for select to authenticated
  using (
    exists (
      select 1
      from public.league_members lm
      where lm.league_id = league_matches.league_id
        and lm.user_id = auth.uid()
    )
  );

create or replace function public.create_prediction_competition(
  p_name text,
  p_description text default null,
  p_public boolean default false,
  p_punishment text default null,
  p_matches jsonb default '[]'::jsonb
)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  league_row public.leagues;
  match_row public.matches;
  item jsonb;
  clean_name text := nullif(trim(p_name), '');
  clean_home text;
  clean_away text;
  kickoff timestamptz;
  idx int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if clean_name is null or length(clean_name) < 2 then
    raise exception 'Competition name needs at least 2 characters';
  end if;
  if jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) < 1 then
    raise exception 'Add at least one match';
  end if;
  if jsonb_array_length(p_matches) > 40 then
    raise exception 'A competition can have up to 40 matches';
  end if;

  loop
    new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.leagues where code = new_code);
  end loop;

  insert into public.leagues(name, code, owner_id, description, is_public, max_matches, punishment)
  values (
    clean_name,
    new_code,
    auth.uid(),
    nullif(trim(p_description), ''),
    coalesce(p_public, false),
    jsonb_array_length(p_matches),
    nullif(trim(p_punishment), '')
  )
  returning * into league_row;

  for item in select * from jsonb_array_elements(p_matches) loop
    idx := idx + 1;
    clean_home := nullif(trim(item->>'home_team'), '');
    clean_away := nullif(trim(item->>'away_team'), '');

    if clean_home is null or length(clean_home) < 2 then
      raise exception 'Match % needs side A', idx;
    end if;
    if clean_away is null or length(clean_away) < 2 then
      raise exception 'Match % needs side B', idx;
    end if;
    if lower(clean_home) = lower(clean_away) then
      raise exception 'Match % needs two different sides', idx;
    end if;

    begin
      kickoff := (item->>'kickoff')::timestamptz;
    exception when others then
      raise exception 'Match % needs a valid start time', idx;
    end;
    if kickoff is null then
      raise exception 'Match % needs a start time', idx;
    end if;

    insert into public.matches (
      external_id,
      competition,
      season,
      stage,
      group_name,
      home_team,
      away_team,
      status,
      utc_kickoff,
      venue
    )
    values (
      'competition-' || league_row.id::text || '-' || idx::text || '-' || gen_random_uuid()::text,
      'YaFoot Challenge',
      null,
      'Private Competition',
      clean_name,
      clean_home,
      clean_away,
      'SCHEDULED',
      kickoff,
      'Created by friends'
    )
    returning * into match_row;

    insert into public.league_matches(league_id, match_id, ordinal)
    values (league_row.id, match_row.id, idx);
  end loop;

  return league_row;
end;
$$;

grant execute on function public.create_prediction_competition(text, text, boolean, text, jsonb) to authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  delete from public.profiles where id = auth.uid();
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
