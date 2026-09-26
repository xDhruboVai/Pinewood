create table public.manager_history (
  id bigint generated always as identity primary key,
  staff_user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  event text not null check (event in ('appointed', 'removed')),
  branch_id uuid references public.branches (id) on delete set null,
  branch_name text not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index manager_history_created_idx on public.manager_history (created_at desc, id desc);

alter table public.manager_history enable row level security;
revoke all on public.manager_history from anon, authenticated;

create or replace function public.record_manager_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch_name text;
begin
  if tg_op = 'INSERT' then
    if new.role::text = 'manager' and new.is_active then
      select name_en into v_branch_name from public.branches where id = new.branch_id;
      insert into public.manager_history (staff_user_id, full_name, event, branch_id, branch_name, actor_user_id)
      values (new.user_id, new.full_name, 'appointed', new.branch_id, coalesce(v_branch_name, 'Unassigned'), auth.uid());
    end if;
    return new;
  end if;

  if old.role::text = 'manager' and old.is_active and (
    new.role::text <> 'manager' or not new.is_active or new.branch_id is distinct from old.branch_id
  ) then
    select name_en into v_branch_name from public.branches where id = old.branch_id;
    insert into public.manager_history (staff_user_id, full_name, event, branch_id, branch_name, actor_user_id)
    values (old.user_id, old.full_name, 'removed', old.branch_id, coalesce(v_branch_name, 'Unassigned'), auth.uid());
  end if;

  if new.role::text = 'manager' and new.is_active and (
    old.role::text <> 'manager' or not old.is_active or new.branch_id is distinct from old.branch_id
  ) then
    select name_en into v_branch_name from public.branches where id = new.branch_id;
    insert into public.manager_history (staff_user_id, full_name, event, branch_id, branch_name, actor_user_id)
    values (new.user_id, new.full_name, 'appointed', new.branch_id, coalesce(v_branch_name, 'Unassigned'), auth.uid());
  end if;

  return new;
end;
$$;

create trigger staff_profiles_manager_history
  after insert or update of role, branch_id, is_active on public.staff_profiles
  for each row execute function public.record_manager_history();