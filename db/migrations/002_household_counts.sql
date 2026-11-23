-- RSVPs: Yes / Maybe / No, with adult and child counts per household.

alter table public.rsvps
  add column if not exists response text,
  add column if not exists adults   int,
  add column if not exists children int;

update public.rsvps
set response = case when attending then 'yes' else 'no' end,
    adults   = guests,
    children = 0
where response is null;

alter table public.rsvps
  alter column response set not null,
  alter column adults   set not null,
  alter column adults   set default 0,
  alter column children set not null,
  alter column children set default 0,
  add constraint rsvps_response_check check (response in ('yes', 'maybe', 'no')),
  add constraint rsvps_adults_check   check (adults between 0 and 10),
  add constraint rsvps_children_check check (children between 0 and 10),
  drop column attending,
  drop column guests;

drop function if exists public.submit_rsvp(text, boolean, int);
drop function if exists public.get_rsvps(text);

create function public.submit_rsvp(p_name text, p_response text, p_adults int, p_children int)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name     text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_response text := lower(trim(coalesce(p_response, '')));
  v_adults   int  := coalesce(p_adults, 0);
  v_children int  := coalesce(p_children, 0);
begin
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'Please enter your name (up to 80 characters).' using errcode = '22023';
  end if;
  if v_response not in ('yes', 'maybe', 'no') then
    raise exception 'Please choose Yes, Maybe or No.' using errcode = '22023';
  end if;

  if v_response = 'no' then
    v_adults := 0;
    v_children := 0;
  else
    if v_adults not between 0 and 10 or v_children not between 0 and 10 then
      raise exception 'Adults and children must each be between 0 and 10.' using errcode = '22023';
    end if;
    if v_adults + v_children < 1 then
      raise exception 'Please tell us how many are coming.' using errcode = '22023';
    end if;
  end if;

  insert into public.rsvps (name, name_key, response, adults, children)
  values (v_name, lower(v_name), v_response, v_adults, v_children)
  on conflict (name_key) do update
    set name = excluded.name,
        response = excluded.response,
        adults = excluded.adults,
        children = excluded.children,
        updated_at = now();
end;
$$;

create function public.get_rsvps(p_passcode text)
returns table (name text, response text, adults int, children int, created_at timestamptz, updated_at timestamptz)
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
    select r.name, r.response, r.adults, r.children, r.created_at, r.updated_at
    from public.rsvps r
    order by r.updated_at desc;
end;
$$;

revoke all on function public.submit_rsvp(text, text, int, int) from public;
revoke all on function public.get_rsvps(text) from public;
grant execute on function public.submit_rsvp(text, text, int, int) to anon, authenticated;
grant execute on function public.get_rsvps(text) to anon, authenticated;

-- Tell the Supabase API to pick up the new function signatures right away.
notify pgrst, 'reload schema';
