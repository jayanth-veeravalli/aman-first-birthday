-- RSVPs for Aman's first birthday.
-- Tables are locked down; the browser (anon role) can only call the two functions below.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Private schema: not exposed through the Supabase API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_secrets (
  key   text primary key,
  value text not null
);

create table if not exists public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  name_key   text not null unique,
  attending  boolean not null,
  guests     int not null default 0 check (guests between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rsvps enable row level security;
revoke all on table public.rsvps from public, anon, authenticated;

-- Guest submits or changes their RSVP. Same name (ignoring case/extra spaces) replaces the earlier answer.
create or replace function public.submit_rsvp(p_name text, p_attending boolean, p_guests int)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name   text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_guests int;
begin
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'Please enter your name (up to 80 characters).' using errcode = '22023';
  end if;
  if p_attending is null then
    raise exception 'Please choose whether you can come.' using errcode = '22023';
  end if;

  if p_attending then
    v_guests := coalesce(p_guests, 1);
    if v_guests < 1 or v_guests > 10 then
      raise exception 'Number of guests must be between 1 and 10.' using errcode = '22023';
    end if;
  else
    v_guests := 0;
  end if;

  insert into public.rsvps (name, name_key, attending, guests)
  values (v_name, lower(v_name), p_attending, v_guests)
  on conflict (name_key) do update
    set name = excluded.name,
        attending = excluded.attending,
        guests = excluded.guests,
        updated_at = now();
end;
$$;

-- Hosts read all RSVPs with the passcode.
create or replace function public.get_rsvps(p_passcode text)
returns table (name text, attending boolean, guests int, created_at timestamptz, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions, private
as $$
#variable_conflict use_column
declare
  v_hash text;
begin
  select s.value into v_hash from private.app_secrets s where s.key = 'rsvp_passcode_hash';
  if v_hash is null or p_passcode is null or crypt(p_passcode, v_hash) <> v_hash then
    perform pg_sleep(0.5); -- slow down guessing
    raise exception 'invalid passcode' using errcode = '28P01';
  end if;

  return query
    select r.name, r.attending, r.guests, r.created_at, r.updated_at
    from public.rsvps r
    order by r.updated_at desc;
end;
$$;

revoke all on function public.submit_rsvp(text, boolean, int) from public;
revoke all on function public.get_rsvps(text) from public;
grant execute on function public.submit_rsvp(text, boolean, int) to anon, authenticated;
grant execute on function public.get_rsvps(text) to anon, authenticated;
