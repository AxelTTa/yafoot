-- Fix: RLS infinite recursion on league_members.
-- A policy on league_members that SELECTs league_members recurses. The standard
-- solution is SECURITY DEFINER helpers (run as owner, bypass RLS) for the membership checks.

create or replace function public.is_league_member(p_league bigint, p_uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.league_members where league_id = p_league and user_id = p_uid);
$$;

create or replace function public.shares_league(p_a uuid, p_b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.league_members la
    join public.league_members lb on lb.league_id = la.league_id
    where la.user_id = p_a and lb.user_id = p_b
  );
$$;

-- league_members: members see co-members (no self-referential subquery)
drop policy if exists lm_read on public.league_members;
create policy lm_read on public.league_members for select to authenticated
  using (public.is_league_member(league_id, auth.uid()));

-- leagues: public or member
drop policy if exists leagues_read on public.leagues;
create policy leagues_read on public.leagues for select to authenticated
  using (is_public or public.is_league_member(id, auth.uid()));

-- predictions: league mates can read each other's *scored* predictions
drop policy if exists predictions_read_finished on public.predictions;
create policy predictions_read_finished on public.predictions for select to authenticated
  using (scored = true and public.shares_league(auth.uid(), user_id));

-- league chat
drop policy if exists lmsg_read on public.league_messages;
create policy lmsg_read on public.league_messages for select to authenticated
  using (public.is_league_member(league_id, auth.uid()));
drop policy if exists lmsg_insert on public.league_messages;
create policy lmsg_insert on public.league_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_league_member(league_id, auth.uid()));
