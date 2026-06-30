-- Provider-backed World Cup leagues: selected matches link to official public.matches rows.
-- Results stay owned by the football-data/openfootball sync path, not by host-entered scores.

create or replace function public.create_official_prediction_competition(
  p_name text,
  p_description text default null,
  p_public boolean default false,
  p_punishment text default null,
  p_match_ids bigint[] default '{}'
)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  league_row public.leagues;
  clean_name text := nullif(trim(p_name), '');
  mid bigint;
  idx int := 0;
  valid_count int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if clean_name is null or length(clean_name) < 2 then
    raise exception 'Competition name needs at least 2 characters';
  end if;
  if coalesce(array_length(p_match_ids, 1), 0) < 1 then
    raise exception 'Add at least one match';
  end if;
  if array_length(p_match_ids, 1) > 40 then
    raise exception 'A competition can have up to 40 matches';
  end if;

  select count(*) into valid_count
  from public.matches m
  where m.id = any(p_match_ids)
    and m.competition = 'FIFA World Cup'
    and m.status in ('SCHEDULED', 'TIMED', 'POSTPONED')
    and coalesce(m.stage, '') !~* 'GROUP';

  if valid_count <> array_length(p_match_ids, 1) then
    raise exception 'Some selected matches are no longer open World Cup fixtures';
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
    array_length(p_match_ids, 1),
    nullif(trim(p_punishment), '')
  )
  returning * into league_row;

  foreach mid in array p_match_ids loop
    idx := idx + 1;
    insert into public.league_matches(league_id, match_id, ordinal)
    values (league_row.id, mid, idx)
    on conflict do nothing;
  end loop;

  return league_row;
end;
$$;

grant execute on function public.create_official_prediction_competition(text, text, boolean, text, bigint[]) to authenticated;

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
  custom_match boolean;
begin
  perform pg_advisory_xact_lock(p_match_id);

  select * into m from public.matches where id = p_match_id;
  if not found or m.status <> 'FINISHED' or m.home_score is null or m.away_score is null then
    return;
  end if;

  custom_match := coalesce(m.competition, '') = 'YaFoot Challenge';

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

    if custom_match then
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
        where lm.user_id = pr.user_id
          and (
            not exists (select 1 from public.league_matches lmx where lmx.league_id = lm.league_id)
            or exists (
              select 1
              from public.league_matches lmx
              where lmx.match_id = p_match_id
                and lmx.league_id = lm.league_id
            )
          );
    end if;
  end loop;
end;
$$;
