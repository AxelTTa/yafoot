-- Security/correctness fixes from the code-review audit.

-- #1 + #13: lock predictions at kickoff and bound scores (DB-enforced, not just UI).
-- Allow internal updates (scoring changes points_awarded/scored but not the pick).
-- Block only when kickoff has passed AND the match is no longer SCHEDULED/TIMED
-- (handles delayed starts — match might be SCHEDULED past its printed kickoff time).
create or replace function public.predictions_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare ko timestamptz; st text;
begin
  if TG_OP = 'UPDATE'
     and new.pred_home is not distinct from old.pred_home
     and new.pred_away is not distinct from old.pred_away then
    return new; -- not a pick change (e.g. scoring); allow
  end if;
  if new.pred_home < 0 or new.pred_home > 99 or new.pred_away < 0 or new.pred_away > 99 then
    raise exception 'Score must be between 0 and 99';
  end if;
  select utc_kickoff, status into ko, st from public.matches where id = new.match_id;
  if ko is not null and ko <= now() and st not in ('SCHEDULED', 'TIMED') then
    raise exception 'Predictions are locked: this match has already kicked off';
  end if;
  return new;
end; $$;
drop trigger if exists trg_predictions_guard on public.predictions;
create trigger trg_predictions_guard before insert or update on public.predictions
  for each row execute function public.predictions_guard();

-- #2: private leagues can no longer be joined by direct insert (enumerable ids).
-- Public leagues may be joined directly; private leagues only via join_league_by_code (security definer).
drop policy if exists lm_join on public.league_members;
create policy lm_join on public.league_members for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.leagues l where l.id = league_id and l.is_public)
  );

-- #6: backfill a joining member's league points from their already-scored predictions,
-- so the league leaderboard matches reality for late joiners.
create or replace function public.join_league_by_code(p_code text)
returns bigint language plpgsql security definer set search_path = public as $$
declare lid bigint; backfill int;
begin
  select id into lid from public.leagues where code = upper(p_code);
  if lid is null then raise exception 'League not found'; end if;
  select coalesce(sum(points_awarded),0) into backfill from public.predictions where user_id = auth.uid() and scored = true;
  insert into public.league_members(league_id, user_id, role, points)
  values (lid, auth.uid(), 'member', backfill)
  on conflict (league_id, user_id) do nothing;
  return lid;
end; $$;

-- also backfill the owner on league creation
create or replace function public.on_league_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare backfill int;
begin
  select coalesce(sum(points_awarded),0) into backfill from public.predictions where user_id = new.owner_id and scored = true;
  insert into public.league_members(league_id, user_id, role, points)
  values (new.id, new.owner_id, 'owner', backfill)
  on conflict do nothing;
  return new;
end; $$;

-- #4: direct messages only between accepted friends.
drop policy if exists dm_insert on public.direct_messages;
create policy dm_insert on public.direct_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = recipient_id)
          or (f.addressee_id = auth.uid() and f.requester_id = recipient_id))
    )
  );

-- #5: prevent double-scoring under concurrent invocations.
create or replace function public.score_match(p_match_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare m record; pts int; pr record;
begin
  perform pg_advisory_xact_lock(p_match_id);  -- serialize scoring per match
  select * into m from public.matches where id = p_match_id;
  if not found or m.status <> 'FINISHED' or m.home_score is null or m.away_score is null then
    return;
  end if;
  for pr in select * from public.predictions where match_id = p_match_id and scored = false for update loop
    if pr.pred_home = m.home_score and pr.pred_away = m.away_score then pts := 3;
    elsif sign(pr.pred_home - pr.pred_away) = sign(m.home_score - m.away_score) then pts := 1;
    else pts := 0; end if;
    update public.predictions set points_awarded = pts, scored = true, updated_at = now() where id = pr.id;
    update public.profiles set total_points = total_points + pts where id = pr.user_id;
    update public.league_members lm set points = lm.points + pts where lm.user_id = pr.user_id;
  end loop;
end; $$;
