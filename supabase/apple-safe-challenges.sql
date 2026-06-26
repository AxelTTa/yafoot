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
