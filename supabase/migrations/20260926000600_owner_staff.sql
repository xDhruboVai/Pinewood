-- Add the owner role and branch-scoped manager appointments.
alter type public.staff_role add value if not exists 'owner';

alter table public.staff_profiles
  add column if not exists branch_id uuid references public.branches (id) on delete set null;

create index if not exists staff_profiles_branch_idx
  on public.staff_profiles (branch_id) where branch_id is not null;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles
    where user_id = auth.uid() and is_active and role::text in ('manager', 'owner')
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles
    where user_id = auth.uid() and is_active and role::text = 'owner'
  );
$$;

drop policy if exists "managers update staff" on public.staff_profiles;
create policy "managers update staff" on public.staff_profiles for update to authenticated
  using (
    public.is_manager()
    and user_id <> (select auth.uid())
    and (public.is_owner() or role::text = 'foh')
  )
  with check (
    public.is_manager()
    and user_id <> (select auth.uid())
    and (public.is_owner() or role::text = 'foh')
  );

revoke update on public.staff_profiles from anon, authenticated;
grant update (full_name, is_active) on public.staff_profiles to authenticated;

create or replace function public.admin_update_staff(
  p_user_id uuid,
  p_role public.staff_role default null,
  p_is_active boolean default null,
  p_branch_id uuid default null,
  p_set_branch boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_target_role text;
begin
  select role::text into v_actor_role
    from public.staff_profiles
   where user_id = auth.uid() and is_active;
  if v_actor_role is null or v_actor_role not in ('manager', 'owner') then
    raise exception 'PW_FORBIDDEN';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'PW_FORBIDDEN';
  end if;

  select role::text into v_target_role
    from public.staff_profiles
   where user_id = p_user_id
   for update;
  if not found then
    raise exception 'PW_NOT_FOUND';
  end if;

  if v_actor_role <> 'owner' and (
    v_target_role in ('manager', 'owner')
    or p_role::text in ('manager', 'owner')
    or p_set_branch
  ) then
    raise exception 'PW_FORBIDDEN';
  end if;

  update public.staff_profiles
     set role = coalesce(p_role, role),
         is_active = coalesce(p_is_active, is_active),
         branch_id = case when p_set_branch then p_branch_id else branch_id end
   where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_update_staff(uuid, public.staff_role, boolean, uuid, boolean) from public, anon;
grant execute on function public.admin_update_staff(uuid, public.staff_role, boolean, uuid, boolean) to authenticated;