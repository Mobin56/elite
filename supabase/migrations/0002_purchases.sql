-- Elite Academy: manual payment flow (Phase 6)
-- Run in Supabase SQL Editor after 0001_schema.sql.
--
-- Flow: the student sends money by bKash / Nagad / Rocket, then submits the transaction ID.
-- request_purchase() creates a PENDING purchase. An admin checks the payment in the bKash/Nagad app
-- and calls approve_purchase(), which sets it to paid and starts the access period.
-- Students can never mark anything as paid themselves.

-- ---------------------------------------------------------------- profile email (so admins can identify payers)
alter table public.profiles add column if not exists email text;

update public.profiles p set email = u.email
from auth.users u where u.id = p.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone, email)
  values (new.id, nullif(new.phone, ''), nullif(new.email, ''))
  on conflict (id) do update set email = coalesce(public.profiles.email, excluded.email);
  return new;
end $$;

-- ---------------------------------------------------------------- price quote
create or replace function public.quote_price(p_batch_id uuid, p_coupon_code text)
returns table (q_amount int, q_coupon uuid)
language plpgsql stable security definer set search_path = public
as $$
declare
  b      public.batches;
  c      public.coupons;
  v_code text := upper(nullif(trim(coalesce(p_coupon_code, '')), ''));
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select * into b from public.batches x where x.id = p_batch_id and x.is_active;
  if not found then
    raise exception 'batch not found';
  end if;

  if v_code is null then
    return query select b.price_bdt, null::uuid;
    return;
  end if;

  select * into c from public.coupons x
  where x.code = v_code
    and x.is_active
    and x.valid_from <= now()
    and (x.valid_until is null or x.valid_until > now())
    and (x.max_uses is null or x.used_count < x.max_uses)
    and (x.batch_id is null or x.batch_id = p_batch_id);
  if not found then
    raise exception 'invalid coupon';
  end if;

  return query select ceil(b.price_bdt * (100 - c.percent_off) / 100.0)::int, c.id;
end $$;

-- ---------------------------------------------------------------- student: request a purchase
create or replace function public.request_purchase(
  p_batch_id    uuid,
  p_coupon_code text,
  p_gateway     text,
  p_txn_id      text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  v_amt  int;
  v_cpn  uuid;
  v_txn  text := upper(trim(coalesce(p_txn_id, '')));
  v_id   uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_gateway not in ('bkash', 'nagad', 'rocket') then
    raise exception 'invalid payment method';
  end if;
  if length(v_txn) < 6 or length(v_txn) > 40 or v_txn !~ '^[A-Z0-9]+$' then
    raise exception 'invalid transaction id';
  end if;
  if (select count(*) from public.purchases where user_id = uid and status = 'pending') >= 3 then
    raise exception 'too many pending requests, wait for approval';
  end if;

  select q_amount, q_coupon into v_amt, v_cpn from public.quote_price(p_batch_id, p_coupon_code);

  begin
    insert into public.purchases (user_id, batch_id, coupon_id, amount_bdt, status, gateway, gateway_txn_id)
    values (uid, p_batch_id, v_cpn, v_amt, 'pending', p_gateway, v_txn)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'this transaction id was already submitted';
  end;

  return jsonb_build_object('purchase_id', v_id, 'amount_bdt', v_amt);
end $$;

-- ---------------------------------------------------------------- admin: approve or reject
create or replace function public.approve_purchase(p_purchase_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  p public.purchases;
  b public.batches;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select * into p from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'purchase not found'; end if;
  if p.status <> 'pending' then raise exception 'purchase is not pending'; end if;

  select * into b from public.batches where id = p.batch_id;

  update public.purchases
     set status = 'paid', paid_at = now(), expires_at = now() + make_interval(days => b.duration_days)
   where id = p.id;

  if p.coupon_id is not null then
    update public.coupons set used_count = used_count + 1 where id = p.coupon_id;
  end if;
end $$;

create or replace function public.reject_purchase(p_purchase_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update public.purchases set status = 'failed' where id = p_purchase_id and status = 'pending';
  if not found then raise exception 'purchase not found or not pending'; end if;
end $$;

-- ---------------------------------------------------------------- permissions
revoke all on function public.quote_price(uuid, text)               from public;
revoke all on function public.request_purchase(uuid, text, text, text) from public;
revoke all on function public.approve_purchase(uuid)                from public;
revoke all on function public.reject_purchase(uuid)                 from public;

grant execute on function public.quote_price(uuid, text)               to authenticated;
grant execute on function public.request_purchase(uuid, text, text, text) to authenticated;
grant execute on function public.approve_purchase(uuid)                to authenticated;
grant execute on function public.reject_purchase(uuid)                 to authenticated;

-- Nobody writes purchases directly from the browser. Students use request_purchase(),
-- admins use approve_purchase() / reject_purchase(). Reading stays allowed (RLS limits it to own rows, admins see all).
revoke insert, update, delete on public.purchases from authenticated;
