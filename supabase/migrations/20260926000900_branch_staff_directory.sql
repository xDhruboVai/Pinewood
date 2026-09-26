-- Branch employees are directory records; only owners and branch managers need Auth accounts.
create table public.branch_staff (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  full_name text not null check (char_length(trim(full_name)) between 2 and 100),
  job_title text not null check (char_length(trim(job_title)) between 2 and 80),
  email text check (email is null or (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text check (phone is null or char_length(phone) <= 32),
  notes text check (notes is null or char_length(notes) <= 1000),
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index branch_staff_branch_active_idx on public.branch_staff (branch_id, is_active, full_name);

alter table public.branch_staff enable row level security;
revoke all on public.branch_staff from anon, authenticated;

create or replace function public.manager_upsert_branch_staff(
  p_id uuid,
  p_branch_id uuid,
  p_full_name text,
  p_job_title text,
  p_email text,
  p_phone text,
  p_notes text,
  p_is_active boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_actor_branch uuid;
  v_target_branch uuid;
  v_id uuid;
begin
  select role::text, branch_id into v_role, v_actor_branch
    from public.staff_profiles
   where user_id = auth.uid() and is_active;
  if v_role is null or v_role not in ('manager', 'owner') then
    raise exception 'PW_FORBIDDEN';
  end if;
  if v_role = 'manager' and v_actor_branch is distinct from p_branch_id then
    raise exception 'PW_FORBIDDEN';
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id) then
    raise exception 'PW_NOT_FOUND';
  end if;
  if p_full_name is null or char_length(trim(p_full_name)) not between 2 and 100
     or p_job_title is null or char_length(trim(p_job_title)) not between 2 and 80
     or p_email is not null and (char_length(p_email) > 254 or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
     or p_phone is not null and char_length(p_phone) > 32
     or p_notes is not null and char_length(p_notes) > 1000
     or p_is_active is null then
    raise exception 'PW_INVALID_STAFF';
  end if;

  if p_id is null then
    insert into public.branch_staff (branch_id, full_name, job_title, email, phone, notes, is_active, created_by, updated_by)
    values (p_branch_id, trim(p_full_name), trim(p_job_title), nullif(trim(p_email), ''), nullif(trim(p_phone), ''), nullif(trim(p_notes), ''), p_is_active, auth.uid(), auth.uid())
    returning id into v_id;
    return v_id;
  end if;

  select branch_id into v_target_branch from public.branch_staff where id = p_id for update;
  if not found then
    raise exception 'PW_NOT_FOUND';
  end if;
  if v_target_branch is distinct from p_branch_id then
    raise exception 'PW_FORBIDDEN';
  end if;

  update public.branch_staff
     set full_name = trim(p_full_name),
         job_title = trim(p_job_title),
         email = nullif(trim(p_email), ''),
         phone = nullif(trim(p_phone), ''),
         notes = nullif(trim(p_notes), ''),
         is_active = p_is_active,
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_id;
  return p_id;
end;
$$;

revoke all on function public.manager_upsert_branch_staff(uuid, uuid, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.manager_upsert_branch_staff(uuid, uuid, text, text, text, text, text, boolean) to authenticated;