-- Omax Control Center admin metadata and subscription tiers.
-- Existing activation codes and subscriptions are preserved.
alter table public.omax_activation_codes
  add column if not exists assigned_name text,
  add column if not exists notes text,
  add column if not exists tier text not null default 'standard';

alter table public.omax_subscriptions
  add column if not exists tier text not null default 'standard';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'omax_activation_codes_tier_check'
      and conrelid = 'public.omax_activation_codes'::regclass
  ) then
    alter table public.omax_activation_codes
      add constraint omax_activation_codes_tier_check
      check (tier in ('standard', 'premium'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'omax_subscriptions_tier_check'
      and conrelid = 'public.omax_subscriptions'::regclass
  ) then
    alter table public.omax_subscriptions
      add constraint omax_subscriptions_tier_check
      check (tier in ('standard', 'premium'));
  end if;
end $$;

create index if not exists omax_activation_codes_created_at_idx
  on public.omax_activation_codes (created_at desc);
create index if not exists omax_subscriptions_status_expires_idx
  on public.omax_subscriptions (status, expires_at desc);
create index if not exists omax_audit_logs_created_at_idx
  on public.omax_audit_logs (created_at desc);

-- The existing redemption RPC writes an audit event after applying a code.
-- This trigger copies the redeemed code's tier onto the resulting active subscription,
-- without replacing or weakening the existing redemption RPC's locking/validation logic.
create or replace function public.omax_apply_redeemed_code_tier()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_code_id uuid;
  v_tier text;
begin
  if new.action <> 'activation_code_redeemed' then
    return new;
  end if;

  v_user_id := coalesce(new.target_user_id, new.actor_user_id);
  begin
    v_code_id := (new.metadata ->> 'activation_code_id')::uuid;
  exception when others then
    return new;
  end;

  if v_user_id is null or v_code_id is null then
    return new;
  end if;

  select c.tier into v_tier
  from public.omax_activation_codes c
  where c.id = v_code_id;

  if v_tier not in ('standard', 'premium') then
    return new;
  end if;

  update public.omax_subscriptions s
  set tier = v_tier, updated_at = now()
  where s.id = (
    select s2.id
    from public.omax_subscriptions s2
    where s2.user_id = v_user_id
      and s2.status = 'active'
      and s2.expires_at > now()
    order by s2.expires_at desc
    limit 1
  );

  return new;
end;
$$;

drop trigger if exists omax_apply_redeemed_code_tier_trigger
  on public.omax_audit_logs;

create trigger omax_apply_redeemed_code_tier_trigger
after insert on public.omax_audit_logs
for each row
when (new.action = 'activation_code_redeemed')
execute function public.omax_apply_redeemed_code_tier();
