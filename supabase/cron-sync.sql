-- Server-side auto-sync: pulls openfootball results into matches every 5 min via pg_cron + http.
-- No API key needed. When a match flips to FINISHED with scores, the existing trigger auto-scores predictions.

create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

-- config table for secrets (e.g. future football-data.org key); service-role only, RLS denies all
create table if not exists public.app_config (key text primary key, value text);
alter table public.app_config enable row level security;  -- no policies => no anon/authed access

create or replace function public.sync_worldcup_openfootball()
returns int language plpgsql security definer set search_path = public, extensions as $$
declare
  resp record; doc jsonb; m jsonb; eid text; ft jsonb;
  hs int; aw int; isft boolean; n int := 0;
begin
  select * into resp from extensions.http_get('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json');
  if resp.status <> 200 then return -1; end if;
  doc := resp.content::jsonb;

  for m in select jsonb_array_elements(doc->'matches') loop
    eid := regexp_replace('of-2026-' || (m->>'date') || '-' || (m->>'team1') || '-' || (m->>'team2'), '\s+', '_', 'g');
    ft := m->'score'->'ft';
    isft := jsonb_typeof(ft) = 'array';
    if isft then hs := (ft->>0)::int; aw := (ft->>1)::int; else hs := null; aw := null; end if;

    update public.matches mt set
      home_score = coalesce(hs, mt.home_score),
      away_score = coalesce(aw, mt.away_score),
      status = case
        when isft then 'FINISHED'
        when mt.status = 'FINISHED' then 'FINISHED'
        when mt.utc_kickoff is not null and now() >= mt.utc_kickoff
             and now() < mt.utc_kickoff + interval '2.5 hours' then 'IN_PLAY'
        when mt.utc_kickoff is not null and now() >= mt.utc_kickoff + interval '2.5 hours' then mt.status
        else 'SCHEDULED'
      end,
      last_updated = now()
    where mt.external_id = eid;

    if found then n := n + 1; end if;
  end loop;
  return n;
end;
$$;

-- (re)schedule every 5 minutes
select cron.unschedule('yafoot-sync') where exists (select 1 from cron.job where jobname = 'yafoot-sync');
select cron.schedule('yafoot-sync', '*/5 * * * *', $$select public.sync_worldcup_openfootball();$$);
