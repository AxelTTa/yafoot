-- football-data.org LIVE cron: keeps scores/status/minute current every 2 min,
-- and auto-fills knockout teams + flags as they're decided. Durable, server-side.

create table if not exists public.wc_flags(tla text primary key, flag text not null);
insert into public.wc_flags(tla,flag) values
('ALG','🇩🇿'),('ARG','🇦🇷'),('AUS','🇦🇺'),('AUT','🇦🇹'),('BEL','🇧🇪'),('BIH','🇧🇦'),('BRA','🇧🇷'),
('CAN','🇨🇦'),('CIV','🇨🇮'),('COD','🇨🇩'),('COL','🇨🇴'),('CPV','🇨🇻'),('CRO','🇭🇷'),('CUW','🇨🇼'),
('CZE','🇨🇿'),('ECU','🇪🇨'),('EGY','🇪🇬'),('ESP','🇪🇸'),('FRA','🇫🇷'),('GER','🇩🇪'),('GHA','🇬🇭'),
('HAI','🇭🇹'),('IRN','🇮🇷'),('IRQ','🇮🇶'),('JOR','🇯🇴'),('JPN','🇯🇵'),('KOR','🇰🇷'),('KSA','🇸🇦'),
('MAR','🇲🇦'),('MEX','🇲🇽'),('NED','🇳🇱'),('NOR','🇳🇴'),('NZL','🇳🇿'),('PAN','🇵🇦'),('PAR','🇵🇾'),
('POR','🇵🇹'),('QAT','🇶🇦'),('RSA','🇿🇦'),('SEN','🇸🇳'),('SUI','🇨🇭'),('SWE','🇸🇪'),('TUN','🇹🇳'),
('TUR','🇹🇷'),('URY','🇺🇾'),('USA','🇺🇸'),('UZB','🇺🇿'),
('ENG','🏴󠁧󠁢󠁥󠁮󠁧󠁿'),('SCO','🏴󠁧󠁢󠁳󠁣󠁴󠁿'),('WAL','🏴󠁧󠁢󠁷󠁬󠁳󠁿')
on conflict (tla) do update set flag=excluded.flag;

-- Set the football-data.org key once (kept out of source control; already stored in the DB):
--   insert into public.app_config(key,value) values ('fd_api_key','<YOUR_KEY>')
--   on conflict (key) do update set value=excluded.value;

create or replace function public.sync_worldcup_fd()
returns int language plpgsql security definer set search_path = public, extensions as $func$
declare v_key text; resp record; doc jsonb; m jsonb; st text; htla text; atla text; n int := 0;
begin
  select value into v_key from public.app_config where app_config.key = 'fd_api_key';
  if v_key is null then return -1; end if;
  select * into resp from extensions.http((
    'GET',
    'https://api.football-data.org/v4/competitions/WC/matches',
    array[extensions.http_header('X-Auth-Token', v_key)],
    null, null)::extensions.http_request);
  if resp.status <> 200 then return -2; end if;
  doc := resp.content::jsonb;
  for m in select jsonb_array_elements(doc->'matches') loop
    st := m->>'status';
    htla := m->'homeTeam'->>'tla'; atla := m->'awayTeam'->>'tla';
    update public.matches set
      home_score = (m->'score'->'fullTime'->>'home')::int,
      away_score = (m->'score'->'fullTime'->>'away')::int,
      status = case when st in ('IN_PLAY','PAUSED') then 'IN_PLAY'
                    when st in ('FINISHED','AWARDED') then 'FINISHED'
                    else 'SCHEDULED' end,
      minute = m->>'minute',
      home_team = coalesce(m->'homeTeam'->>'name', home_team),
      away_team = coalesce(m->'awayTeam'->>'name', away_team),
      home_code = coalesce(htla, home_code),
      away_code = coalesce(atla, away_code),
      home_flag = coalesce((select flag from public.wc_flags where tla = htla), home_flag),
      away_flag = coalesce((select flag from public.wc_flags where tla = atla), away_flag),
      last_updated = now()
    where external_id = 'wc-' || (m->>'id');
    if found then n := n + 1; end if;
  end loop;
  return n;
end; $func$;

-- swap openfootball cron for the football-data one (every 2 minutes)
select cron.unschedule('yafoot-sync') where exists (select 1 from cron.job where jobname = 'yafoot-sync');
select cron.unschedule('yafoot-fd-sync') where exists (select 1 from cron.job where jobname = 'yafoot-fd-sync');
select cron.schedule('yafoot-fd-sync', '*/2 * * * *', $$select public.sync_worldcup_fd();$$);
