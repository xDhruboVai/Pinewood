-- Promote the requested existing Auth account after the owner enum label is committed.
insert into public.staff_profiles (user_id, full_name, role, branch_id, is_active)
select u.id, 'Dihan Islam Dhrubo', 'owner', null, true
  from auth.users u
 where lower(u.email) = 'dhrubo7054@gmail.com'
on conflict (user_id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      branch_id = null,
      is_active = true;