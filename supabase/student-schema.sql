-- VITALS 2.0 (students): its own copy of every VITALS table and function, in the "student" schema.
-- Logins (auth.users) are shared with VITALS, but nothing else is: a person who uses the same email
-- for both gets an astronaut profile (public.profiles, astronaut ID) in VITALS and a separate
-- student profile (student.profiles, student ID) in VITALS 2.0. Generated from schema.sql with
-- "public." -> "student.". The "student" schema must be listed under Exposed schemas in the
-- Supabase dashboard (Project Settings -> Data API) so the website can reach it.

create schema if not exists student;

-- VITALS accounts: tables, roles and Row Level Security.
-- Run in Supabase → SQL Editor. Safe to run again (it creates or replaces what it needs).
--
-- Who sees what:
--   profiles     owner only. Name, crew details and personal baselines (confidential).
--   readings     owner only. Every reading and daily log entry, for trends (confidential).
--   crew_status  owner, plus commanders and flight surgeons (and crewmates, see Crew Link). Name, role,
--                current status, the latest readings (heart rate, SpO2, ECG, room temperature, humidity,
--                sleep, water, exercise, air quality) and when they were last synced.
-- Roles ('crew', 'commander', 'flight_surgeon') can only be changed from the database side
-- (SQL editor / service role), never from the website, and never because of how someone signed in.

-- ---------------------------------------------------------------- profiles
create table if not exists student.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role text not null default 'crew' check (role in ('crew', 'commander', 'flight_surgeon')),
  job text not null default '',                     -- e.g. "Flight engineer"
  crew_id text not null default '',                 -- "2026" + 12 random digits, unique, e.g. "2026 4821 0937 5560"
  mission text not null default '8B',
  mission_end date,
  baselines jsonb not null default '{}'::jsonb,     -- your own normal: {"hr":62,"sleep":7.5,"temp":36.8,...}
  onboarded boolean not null default false,         -- has built their crew card
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- readings
create table if not exists student.readings (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null,                          -- made on the device, so a re-sent offline reading isn't stored twice
  taken_at timestamptz not null,
  source text not null default '',                  -- e.g. "VITALS sensor (USB)", "Typed in", "VITALS demo device"
  data jsonb not null,                              -- {"heart":72,"spo2":98,"temp":36.8,"sleep":7.5,...}
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists readings_user_time on student.readings (user_id, taken_at desc);

-- (if an earlier version of this script was run: body temperature was replaced by room temperature + humidity)

-- ---------------------------------------------------------------- crew_status
create table if not exists student.crew_status (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null default '',
  job text not null default '',
  crew_id text not null default '',
  status text not null default 'green' check (status in ('green', 'yellow', 'red')),
  heart numeric,
  spo2 numeric,
  room_temp numeric,                                -- room temperature, °C (DHT11)
  humidity numeric,                                 -- room humidity, % (DHT11)
  updated_at timestamptz not null default now()
);

alter table student.crew_status drop column if exists temp;
alter table student.crew_status add column if not exists room_temp numeric;
alter table student.crew_status add column if not exists humidity numeric;
-- the rest of the latest readings, so commanders and crewmates see the whole picture
alter table student.crew_status add column if not exists ecg numeric;          -- ECG heart rate, bpm (real electrodes only)
alter table student.crew_status add column if not exists sleep numeric;        -- hours last night (daily log)
alter table student.crew_status add column if not exists water numeric;        -- litres today (daily log)
alter table student.crew_status add column if not exists exercise numeric;     -- minutes today (daily log)
alter table student.crew_status add column if not exists air numeric;          -- air quality, % worse than clean air

-- ---------------------------------------------------------------- helpers
-- Is the signed-in person a commander or flight surgeon? (security definer: reads profiles without RLS recursion)
create or replace function student.is_commander()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from student.profiles p
    where p.id = auth.uid() and p.role in ('commander', 'flight_surgeon')
  );
$$;

-- No two accounts share a crew number.
create unique index if not exists profiles_crew_id_key on student.profiles (crew_id) where crew_id <> '';

-- A crew number: the one the sign-up page showed, if it's well formed and free, otherwise a new random one.
create or replace function student.new_crew_id(wanted text default null)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  -- not called "id": that's also a profiles column, and the lookup below would be ambiguous
  candidate text := wanted;
begin
  loop
    if candidate ~ '^2026( [0-9]{4}){3}$' and not exists (select 1 from student.profiles p where p.crew_id = candidate) then
      return candidate;
    end if;
    candidate := '2026 ' || lpad(floor(random() * 10000)::int::text, 4, '0')
        || ' ' || lpad(floor(random() * 10000)::int::text, 4, '0')
        || ' ' || lpad(floor(random() * 10000)::int::text, 4, '0');
  end loop;
end;
$$;
revoke execute on function student.new_crew_id(text) from public, anon, authenticated;

-- A new account gets a profile straight away (Google sign-ins bring their name with them).
create or replace function student.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into student.profiles (id, display_name, crew_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), ''),
    student.new_crew_id(new.raw_user_meta_data ->> 'crew_id')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_student on auth.users;
create trigger on_auth_user_created_student
  after insert on auth.users
  for each row execute function student.handle_new_user();

-- Nobody can change a role from the website. Only the database side (SQL editor, service role) can.
create or replace function student.protect_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
    raise exception 'Roles can only be changed by a school administrator';
  end if;
  -- the crew number is assigned once; the website can't change it (or copy someone else's)
  if old.crew_id <> '' and coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
    new.crew_id := old.crew_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on student.profiles;
create trigger profiles_protect_role
  before update on student.profiles
  for each row execute function student.protect_role();

-- ---------------------------------------------------------------- Row Level Security
alter table student.profiles enable row level security;
alter table student.readings enable row level security;
alter table student.crew_status enable row level security;

-- profiles: owner only
drop policy if exists "profiles: read own" on student.profiles;
create policy "profiles: read own" on student.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles: update own" on student.profiles;
create policy "profiles: update own" on student.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- readings: owner only
drop policy if exists "readings: read own" on student.readings;
create policy "readings: read own" on student.readings
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "readings: add own" on student.readings;
create policy "readings: add own" on student.readings
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "readings: delete own" on student.readings;
create policy "readings: delete own" on student.readings
  for delete to authenticated using ((select auth.uid()) = user_id);

-- crew_status: owner writes; owner, commanders and flight surgeons read
drop policy if exists "crew_status: read own or as commander" on student.crew_status;
create policy "crew_status: read own or as commander" on student.crew_status
  for select to authenticated using ((select auth.uid()) = user_id or (select student.is_commander()));
drop policy if exists "crew_status: add own" on student.crew_status;
create policy "crew_status: add own" on student.crew_status
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "crew_status: update own" on student.crew_status;
create policy "crew_status: update own" on student.crew_status
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- access for the website (RLS still applies)
grant usage on schema student to anon, authenticated, service_role;
grant select, update on student.profiles to authenticated;
grant select, insert, delete on student.readings to authenticated;
grant select, insert, update on student.crew_status to authenticated;
grant execute on function student.is_commander() to authenticated;
revoke all on student.profiles, student.readings, student.crew_status from anon;

-- Accounts made before this script ran get a profile too.
insert into student.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1), '')
from auth.users u
on conflict (id) do nothing;

-- ...and every profile has a unique crew number.
update student.profiles set crew_id = student.new_crew_id(null) where crew_id = '';

-- To make someone a commander (run here, in the SQL editor):
--   update student.profiles set role = 'commander' where id = (select id from auth.users where email = 'someone@example.com');

-- ================================================================ Crew Link
-- Crew members link their crew cards into one crew, see each other's live status on one board,
-- check in, and keep a shared crew log. Safe to run again.
--
-- Who sees what:
--   crews         members of that crew only. Name, mission and the invite code.
--   crew_members  members of that crew only. Who is in it, and who leads it.
--   crew_log      members of that crew only. Check-ins, buddy checks and notes.
--   crew_invites  only through functions: the invited person sees their own, the crew sees who's invited.
--   directory     signed-in people can search crew cards (name, job, crew number) to invite them.
--   crew_status   (above) also readable by your crewmates: status, latest readings and last sync. Joining a crew is how you agree to share these; your full
--                 history in readings stays owner-only.
-- Crews are made, joined and left only through the functions below, never by writing the tables.

create table if not exists student.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  mission text not null default '8B',
  code text not null unique,                        -- join code: 10 random digits, e.g. "48213-90375"
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists student.crew_members (
  user_id uuid primary key references auth.users (id) on delete cascade,   -- one crew per person
  crew uuid not null references student.crews (id) on delete cascade,
  role text not null default 'member' check (role in ('lead', 'member')),
  joined_at timestamptz not null default now()
);
create index if not exists crew_members_crew on student.crew_members (crew);

create table if not exists student.crew_log (
  id bigint generated always as identity primary key,
  crew uuid not null references student.crews (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null default '',
  kind text not null default 'note' check (kind in ('note', 'ok', 'watch', 'help', 'buddy')),
  body text not null default '' check (char_length(body) <= 500),
  client_id uuid not null,                          -- made on the device, so a re-sent offline entry isn't stored twice
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists crew_log_crew_time on student.crew_log (crew, created_at desc);

-- The signed-in person's crew (security definer: reads crew_members without RLS recursion).
create or replace function student.my_crew()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.crew from student.crew_members m where m.user_id = auth.uid();
$$;

-- Is this person in the signed-in person's crew?
create or replace function student.is_crewmate(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from student.crew_members a join student.crew_members b on a.crew = b.crew
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- A fresh join code: 10 random digits shown as "48213-90375". The unique column guarantees no two crews share one.
create or replace function student.new_crew_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  c text;
begin
  loop
    c := lpad(floor(random() * 100000)::int::text, 5, '0') || '-' || lpad(floor(random() * 100000)::int::text, 5, '0');
    if not exists (select 1 from student.crews where code = c) then return c; end if;
  end loop;
end;
$$;
revoke execute on function student.new_crew_code() from public, anon, authenticated;

-- Crews made with the older 6-character codes get a 10-digit one.
update student.crews set code = student.new_crew_code() where code !~ '^[0-9]{5}-[0-9]{5}$';

-- Invitations: a crew lead picks crewmates by their crew card; each one accepts or declines.
-- Nobody is put in a crew (and shares their vitals) without saying yes.
create table if not exists student.crew_invites (
  crew uuid not null references student.crews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (crew, user_id)
);
create index if not exists crew_invites_user on student.crew_invites (user_id);
alter table student.crew_invites enable row level security;
revoke all on student.crew_invites from anon, authenticated;   -- read and written only through the functions below

-- Crew cards to pick from: name, job and crew number of every account that has built its card,
-- found by name or by crew number (any part of it, with or without spaces). Signed-in people only.
create or replace function student.crew_directory(search text default '')
returns table (user_id uuid, display_name text, job text, crew_number text, in_crew boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.job, p.crew_id,
         exists (select 1 from student.crew_members m where m.user_id = p.id)
  from student.profiles p
  where auth.uid() is not null
    and p.onboarded
    and p.id <> auth.uid()
    and (
      btrim(coalesce(search, '')) = ''
      or p.display_name ilike '%' || btrim(search) || '%'
      or (regexp_replace(search, '[^0-9]', '', 'g') <> ''
          and replace(p.crew_id, ' ', '') like '%' || regexp_replace(search, '[^0-9]', '', 'g') || '%')
    )
  order by lower(p.display_name), p.crew_id
  limit 50;
$$;

-- Invites the picked crew cards to your crew (crew lead only). People already in a crew are skipped.
create or replace function student.invite_to_crew(members uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  mine uuid;
  added integer;
begin
  select crew into mine from student.crew_members where user_id = uid and role = 'lead';
  if mine is null then raise exception 'Only the class lead can invite student cards.'; end if;
  insert into student.crew_invites (crew, user_id, invited_by)
  select mine, x, uid
  from unnest(coalesce(members, '{}')) as x
  where x <> uid
    and exists (select 1 from student.profiles p where p.id = x and p.onboarded)
    and not exists (select 1 from student.crew_members m where m.user_id = x)
  on conflict do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;

-- Start a crew, lead it, and invite the crew cards you picked.
drop function if exists student.create_crew(text);
create or replace function student.create_crew(crew_name text, members uuid[] default '{}')
returns student.crews
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  made student.crews;
  clean text := btrim(coalesce(crew_name, ''));
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from student.crew_members where user_id = uid) then
    raise exception 'You are already in a class. Leave it first.';
  end if;
  if clean = '' or char_length(clean) > 60 then raise exception 'Give your class a name (up to 60 characters).'; end if;
  if coalesce(array_length(members, 1), 0) > 11 then raise exception 'A class has up to 12 members.'; end if;
  insert into student.crews (name, mission, code, created_by)
  values (clean, coalesce((select p.mission from student.profiles p where p.id = uid), '8B'), student.new_crew_code(), uid)
  returning * into made;
  insert into student.crew_members (user_id, crew, role) values (uid, made.id, 'lead');
  perform student.invite_to_crew(members);
  return made;
end;
$$;

-- Adds the signed-in person to a crew (used by joining with a code and by accepting an invite).
create or replace function student.add_me_to_crew(target uuid)
returns student.crews
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  found student.crews;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from student.crew_members where user_id = uid) then
    raise exception 'You are already in a class. Leave it first.';
  end if;
  select * into found from student.crews where id = target;
  if found.id is null then raise exception 'That class no longer exists.'; end if;
  if (select count(*) from student.crew_members where crew = found.id) >= 12 then
    raise exception 'That class is full (12 members).';
  end if;
  insert into student.crew_members (user_id, crew) values (uid, found.id);
  delete from student.crew_invites where user_id = uid;
  return found;
end;
$$;
revoke execute on function student.add_me_to_crew(uuid) from public, anon, authenticated;

-- Join a crew with its 10-digit code (dashes and spaces don't matter).
create or replace function student.join_crew(invite text)
returns student.crews
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := regexp_replace(coalesce(invite, ''), '[^0-9]', '', 'g');
  target uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(wanted) <> 10 then raise exception 'A class code has 10 digits, like 48213-90375.'; end if;
  select c.id into target from student.crews c where replace(c.code, '-', '') = wanted;
  if target is null then raise exception 'No class has that code. Check it with your class lead.'; end if;
  return student.add_me_to_crew(target);
end;
$$;

-- Your invitations: which crew, who invited you, and how many are in it.
create or replace function student.my_invites()
returns table (crew uuid, crew_name text, mission text, invited_by text, members integer, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.crew, c.name, c.mission, coalesce(p.display_name, ''),
         (select count(*)::int from student.crew_members m where m.crew = i.crew), i.created_at
  from student.crew_invites i
  join student.crews c on c.id = i.crew
  left join student.profiles p on p.id = i.invited_by
  where i.user_id = auth.uid()
  order by i.created_at desc;
$$;

create or replace function student.accept_invite(target uuid)
returns student.crews
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from student.crew_invites where crew = target and user_id = auth.uid()) then
    raise exception 'That invitation is no longer open.';
  end if;
  return student.add_me_to_crew(target);
end;
$$;

create or replace function student.decline_invite(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from student.crew_invites where crew = target and user_id = auth.uid();
$$;

-- Who has been invited to your crew and hasn't answered yet.
create or replace function student.crew_invited()
returns table (user_id uuid, display_name text, crew_number text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.user_id, coalesce(p.display_name, ''), coalesce(p.crew_id, ''), i.created_at
  from student.crew_invites i
  left join student.profiles p on p.id = i.user_id
  where i.crew = student.my_crew()
  order by i.created_at;
$$;

-- Leave your crew. The longest-serving member takes over as lead; an empty crew is removed.
create or replace function student.leave_crew()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  mine uuid;
  was_lead boolean;
begin
  select crew, role = 'lead' into mine, was_lead from student.crew_members where user_id = uid;
  if mine is null then return; end if;
  delete from student.crew_members where user_id = uid;
  if not exists (select 1 from student.crew_members where crew = mine) then
    delete from student.crews where id = mine;
  elsif was_lead then
    update student.crew_members set role = 'lead'
    where user_id = (select user_id from student.crew_members where crew = mine order by joined_at limit 1);
  end if;
end;
$$;

-- The crew board in one call: each member's name, job and role, with what they share in crew_status.
drop function if exists student.crew_roster();
create or replace function student.crew_roster()
returns table (
  user_id uuid, display_name text, job text, crew_number text, role text, joined_at timestamptz,
  status text, heart numeric, spo2 numeric, room_temp numeric, humidity numeric,
  ecg numeric, sleep numeric, water numeric, exercise numeric, air numeric, updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, coalesce(p.display_name, ''), coalesce(p.job, ''), coalesce(p.crew_id, ''), m.role, m.joined_at,
         s.status, s.heart, s.spo2, s.room_temp, s.humidity,
         s.ecg, s.sleep, s.water, s.exercise, s.air, s.updated_at
  from student.crew_members m
  left join student.profiles p on p.id = m.user_id
  left join student.crew_status s on s.user_id = m.user_id
  where m.crew = student.my_crew()
  order by m.role = 'lead' desc, m.joined_at;
$$;

alter table student.crews enable row level security;
alter table student.crew_members enable row level security;
alter table student.crew_log enable row level security;

drop policy if exists "crews: read own crew" on student.crews;
create policy "crews: read own crew" on student.crews
  for select to authenticated using (id = (select student.my_crew()));
drop policy if exists "crew_members: read own crew" on student.crew_members;
create policy "crew_members: read own crew" on student.crew_members
  for select to authenticated using (crew = (select student.my_crew()));
drop policy if exists "crew_log: read own crew" on student.crew_log;
create policy "crew_log: read own crew" on student.crew_log
  for select to authenticated using (crew = (select student.my_crew()));
drop policy if exists "crew_log: post to own crew" on student.crew_log;
create policy "crew_log: post to own crew" on student.crew_log
  for insert to authenticated with check ((select auth.uid()) = user_id and crew = (select student.my_crew()));
drop policy if exists "crew_status: read as crewmate" on student.crew_status;
create policy "crew_status: read as crewmate" on student.crew_status
  for select to authenticated using ((select student.is_crewmate(user_id)));

grant select on student.crews, student.crew_members to authenticated;
grant select, insert on student.crew_log to authenticated;
grant execute on function student.my_crew(), student.is_crewmate(uuid), student.create_crew(text, uuid[]), student.join_crew(text),
  student.leave_crew(), student.crew_roster(), student.crew_directory(text), student.invite_to_crew(uuid[]), student.my_invites(),
  student.accept_invite(uuid), student.decline_invite(uuid), student.crew_invited() to authenticated;
revoke execute on function student.my_crew(), student.is_crewmate(uuid), student.create_crew(text, uuid[]), student.join_crew(text),
  student.leave_crew(), student.crew_roster(), student.crew_directory(text), student.invite_to_crew(uuid[]), student.my_invites(),
  student.accept_invite(uuid), student.decline_invite(uuid), student.crew_invited() from public, anon;
revoke all on student.crews, student.crew_members, student.crew_log from anon;

-- Live updates on the crew board: changes to crew_status and new crew_log entries are pushed to the
-- website (Row Level Security still decides who receives each one).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'student' and tablename = 'crew_status') then
      alter publication supabase_realtime add table student.crew_status;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'student' and tablename = 'crew_log') then
      alter publication supabase_realtime add table student.crew_log;
    end if;
  end if;
end;
$$;
