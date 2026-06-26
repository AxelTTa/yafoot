-- Apple-safe competition UX + latency pass.
-- Host-only final scores, country metadata on custom matches, and targeted indexes.

create index if not exists matches_competition_kickoff_idx on public.matches(competition, utc_kickoff);
create index if not exists league_members_user_idx on public.league_members(user_id, league_id);
create index if not exists friendships_requester_status_idx on public.friendships(requester_id, status);
create index if not exists friendships_addressee_status_idx on public.friendships(addressee_id, status);
create index if not exists dm_recipient_sender_idx on public.direct_messages(recipient_id, sender_id, created_at);
drop index if exists public.predictions_user_match_idx;

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
  home_code text;
  away_code text;
  home_flag text;
  away_flag text;
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
    null,
    coalesce(p_public, false),
    jsonb_array_length(p_matches),
    nullif(trim(p_punishment), '')
  )
  returning * into league_row;

  for item in select * from jsonb_array_elements(p_matches) loop
    idx := idx + 1;
    clean_home := nullif(trim(item->>'home_team'), '');
    clean_away := nullif(trim(item->>'away_team'), '');
    home_code := nullif(upper(trim(coalesce(item->>'home_code', ''))), '');
    away_code := nullif(upper(trim(coalesce(item->>'away_code', ''))), '');
    home_flag := nullif(trim(coalesce(item->>'home_flag', '')), '');
    away_flag := nullif(trim(coalesce(item->>'away_flag', '')), '');

    if clean_home is null or length(clean_home) < 2 then
      raise exception 'Match % needs country A', idx;
    end if;
    if clean_away is null or length(clean_away) < 2 then
      raise exception 'Match % needs country B', idx;
    end if;
    if lower(clean_home) = lower(clean_away) or (home_code is not null and home_code = away_code) then
      raise exception 'Match % needs two different countries', idx;
    end if;

    begin
      kickoff := (item->>'kickoff')::timestamptz;
    exception when others then
      raise exception 'Match % needs a valid start time', idx;
    end;
    if kickoff is null then
      raise exception 'Match % needs a start time', idx;
    end if;
    if kickoff <= now() + interval '1 minute' then
      raise exception 'Match % start time must be in the future', idx;
    end if;

    insert into public.matches (
      external_id,
      competition,
      season,
      stage,
      group_name,
      home_team,
      home_code,
      home_flag,
      away_team,
      away_code,
      away_flag,
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
      home_code,
      home_flag,
      clean_away,
      away_code,
      away_flag,
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

create or replace function public.league_scored_points(p_league_id bigint, p_user_id uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(sum(p.points_awarded), 0)::int
  from public.predictions p
  join public.league_matches lm on lm.match_id = p.match_id
  where lm.league_id = p_league_id
    and p.user_id = p_user_id
    and p.scored = true;
$$;

create or replace function public.join_league_by_code(p_code text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  lid bigint;
  has_private_matches boolean;
  backfill int;
begin
  select id into lid from public.leagues where code = upper(trim(p_code));
  if lid is null then raise exception 'League not found'; end if;

  select exists(select 1 from public.league_matches where league_id = lid) into has_private_matches;
  if has_private_matches then
    backfill := public.league_scored_points(lid, auth.uid());
  else
    select coalesce(sum(points_awarded),0)::int into backfill
    from public.predictions
    where user_id = auth.uid() and scored = true;
  end if;

  insert into public.league_members(league_id, user_id, role, points)
  values (lid, auth.uid(), 'member', backfill)
  on conflict (league_id, user_id) do nothing;
  return lid;
end;
$$;

create or replace function public.on_league_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  backfill int;
begin
  select coalesce(sum(points_awarded),0)::int into backfill
  from public.predictions
  where user_id = new.owner_id and scored = true;

  insert into public.league_members(league_id, user_id, role, points)
  values (new.id, new.owner_id, 'owner', backfill)
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.score_match(p_match_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  pts int;
  pr record;
  has_private_matches boolean;
begin
  perform pg_advisory_xact_lock(p_match_id);

  select * into m from public.matches where id = p_match_id;
  if not found or m.status <> 'FINISHED' or m.home_score is null or m.away_score is null then
    return;
  end if;

  select exists(select 1 from public.league_matches where match_id = p_match_id) into has_private_matches;

  for pr in select * from public.predictions where match_id = p_match_id and scored = false for update loop
    if pr.pred_home = m.home_score and pr.pred_away = m.away_score then
      pts := 3;
    elsif sign(pr.pred_home - pr.pred_away) = sign(m.home_score - m.away_score) then
      pts := 1;
    else
      pts := 0;
    end if;

    update public.predictions
      set points_awarded = pts, scored = true, updated_at = now()
      where id = pr.id;

    update public.profiles
      set total_points = total_points + pts
      where id = pr.user_id;

    if has_private_matches then
      update public.league_members lm
        set points = lm.points + pts
        where lm.user_id = pr.user_id
          and exists (
            select 1
            from public.league_matches lmx
            where lmx.match_id = p_match_id
              and lmx.league_id = lm.league_id
          );
    else
      update public.league_members lm
        set points = lm.points + pts
        where lm.user_id = pr.user_id;
    end if;
  end loop;
end;
$$;

create or replace function public.finalize_competition_match(
  p_league_id bigint,
  p_match_id bigint,
  p_home_score int,
  p_away_score int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_home_score is null or p_away_score is null or p_home_score < 0 or p_home_score > 99 or p_away_score < 0 or p_away_score > 99 then
    raise exception 'Final score must be between 0 and 99';
  end if;

  select exists(
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.owner_id = auth.uid()
  ) into is_owner;
  if not is_owner then
    raise exception 'Only the competition host can set the final score';
  end if;

  if not exists (
    select 1
    from public.league_matches lm
    where lm.league_id = p_league_id
      and lm.match_id = p_match_id
  ) then
    raise exception 'Match is not in this competition';
  end if;

  update public.matches
    set home_score = p_home_score,
        away_score = p_away_score,
        status = 'FINISHED',
        minute = null,
        last_updated = now()
    where id = p_match_id
      and status <> 'FINISHED';

  if not found then
    raise exception 'This match already has a final score';
  end if;
end;
$$;

grant execute on function public.finalize_competition_match(bigint, bigint, int, int) to authenticated;
