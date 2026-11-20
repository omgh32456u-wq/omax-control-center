-- Omax Control Center metadata extension.
-- Existing code hashes, subscriptions, redemption RPC, and status/duration constraints are preserved.
begin;

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

  if not exists (
    select 1 from pg_constraint
    where conname = 'omax_activation_codes_assigned_name_length'
      and conrelid = 'public.omax_activation_codes'::regclass
  ) then
    alter table public.omax_activation_codes
      add constraint omax_activation_codes_assigned_name_length
      check (assigned_name is null or char_length(assigned_name) <= 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'omax_activation_codes_notes_length'
      and conrelid = 'public.omax_activation_codes'::regclass
  ) then
    alter table public.omax_activation_codes
      add constraint omax_activation_codes_notes_length
      check (notes is null or char_length(notes) <= 500);
  end if;
end
$$;

-- Preserve the existing redemption RPC implementation. It already writes
-- activation_code_id into the subscription; this trigger copies that code's tier.
create or replace function public.omax_set_subscription_tier_from_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tier text;
begin
  if new.activation_code_id is not null then
    select c.tier into v_tier
    from public.omax_activation_codes as c
    where c.id = new.activation_code_id;

    if v_tier is not null then
      new.tier := v_tier;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists omax_subscriptions_set_tier_from_code
  on public.omax_subscriptions;

create trigger omax_subscriptions_set_tier_from_code
before insert or update of activation_code_id
on public.omax_subscriptions
for each row
execute function public.omax_set_subscription_tier_from_code();

commit;
