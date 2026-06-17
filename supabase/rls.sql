-- YaFoot — Row Level Security + auth trigger + helper RPCs

-- ---------- auto-create profile on signup ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'fan_' || substr(new.id::text,1,8)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- enable RLS ----------
alter table public.profiles        enable row level security;
alter table public.matches         enable row level security;
alter table public.predictions     enable row level security;
alter table public.leagues         enable row level security;
alter table public.league_members  enable row level security;
alter table public.friendships     enable row level security;
alter table public.league_messages enable row level security;
alter table public.direct_messages enable row level security;

-- profiles: anyone authed can read; you can update only your own
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (auth.uid() = id);

-- matches: read-only to all authed (writes via service role only)
drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select to authenticated using (true);

-- predictions: only your own (full CRUD)
drop policy if exists predictions_own on public.predictions;
create policy predictions_own on public.predictions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- but league mates can READ each other's predictions for finished matches (transparency)
drop policy if exists predictions_read_finished on public.predictions;
create policy predictions_read_finished on public.predictions for select to authenticated
  using (
    scored = true
    and exists (
      select 1 from public.league_members me
      join public.league_members them on them.league_id = me.league_id
      where me.user_id = auth.uid() and them.user_id = predictions.user_id
    )
  );

-- leagues: members can read; public leagues readable by all; owner can update/delete; any authed can create
drop policy if exists leagues_read on public.leagues;
create policy leagues_read on public.leagues for select to authenticated
  using (is_public or exists (select 1 from public.league_members lm where lm.league_id = leagues.id and lm.user_id = auth.uid()));
drop policy if exists leagues_insert on public.leagues;
create policy leagues_insert on public.leagues for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists leagues_update on public.leagues;
create policy leagues_update on public.leagues for update to authenticated using (auth.uid() = owner_id);
drop policy if exists leagues_delete on public.leagues;
create policy leagues_delete on public.leagues for delete to authenticated using (auth.uid() = owner_id);

-- league_members: members can see co-members; you can join/leave yourself
drop policy if exists lm_read on public.league_members;
create policy lm_read on public.league_members for select to authenticated
  using (exists (select 1 from public.league_members x where x.league_id = league_members.league_id and x.user_id = auth.uid()));
drop policy if exists lm_join on public.league_members;
create policy lm_join on public.league_members for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists lm_leave on public.league_members;
create policy lm_leave on public.league_members for delete to authenticated using (auth.uid() = user_id);

-- friendships: you can see/manage rows you're part of
drop policy if exists fr_read on public.friendships;
create policy fr_read on public.friendships for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
drop policy if exists fr_insert on public.friendships;
create policy fr_insert on public.friendships for insert to authenticated with check (auth.uid() = requester_id);
drop policy if exists fr_update on public.friendships;
create policy fr_update on public.friendships for update to authenticated
  using (auth.uid() = addressee_id or auth.uid() = requester_id);
drop policy if exists fr_delete on public.friendships;
create policy fr_delete on public.friendships for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- league_messages: members read + post
drop policy if exists lmsg_read on public.league_messages;
create policy lmsg_read on public.league_messages for select to authenticated
  using (exists (select 1 from public.league_members lm where lm.league_id = league_messages.league_id and lm.user_id = auth.uid()));
drop policy if exists lmsg_insert on public.league_messages;
create policy lmsg_insert on public.league_messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (select 1 from public.league_members lm where lm.league_id = league_messages.league_id and lm.user_id = auth.uid()));

-- direct_messages: only sender/recipient
drop policy if exists dm_read on public.direct_messages;
create policy dm_read on public.direct_messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
drop policy if exists dm_insert on public.direct_messages;
create policy dm_insert on public.direct_messages for insert to authenticated with check (auth.uid() = sender_id);
drop policy if exists dm_update on public.direct_messages;
create policy dm_update on public.direct_messages for update to authenticated using (auth.uid() = recipient_id);

-- ---------- helper RPCs ----------
-- join a league by code (returns league id)
create or replace function public.join_league_by_code(p_code text)
returns bigint language plpgsql security definer set search_path = public as $$
declare lid bigint;
begin
  select id into lid from public.leagues where code = upper(p_code);
  if lid is null then raise exception 'League not found'; end if;
  insert into public.league_members(league_id, user_id, role)
  values (lid, auth.uid(), 'member') on conflict do nothing;
  return lid;
end;
$$;

-- create league with a random 6-char code
create or replace function public.create_league(p_name text, p_description text default null, p_public boolean default false)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare new_code text; row public.leagues;
begin
  loop
    new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.leagues where code = new_code);
  end loop;
  insert into public.leagues(name, code, owner_id, description, is_public)
  values (p_name, new_code, auth.uid(), p_description, p_public)
  returning * into row;
  return row;
end;
$$;

-- realtime: add tables to supabase_realtime publication
do $$ begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.league_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.league_members;
exception when duplicate_object then null; end $$;
