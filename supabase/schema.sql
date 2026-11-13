-- V4: run in a NEW Supabase project. All business data is server-only.
create table if not exists public.shop_wallets(user_id uuid primary key references auth.users(id), balance bigint not null default 0 check(balance>=0));
create table if not exists public.shop_prices(sku text primary key, sell_price bigint not null check(sell_price>0), enabled boolean not null default true);
create table if not exists public.shop_deposits(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), code text unique not null, amount bigint not null check(amount between 1000 and 10000000), status text not null default 'pending' check(status in ('pending','paid')), created_at timestamptz not null default now(), paid_at timestamptz);
create table if not exists public.shop_payments(tx_id text primary key, amount bigint not null, account text not null, memo text not null, deposit_id uuid references public.shop_deposits(id), result text not null, created_at timestamptz default now());
create table if not exists public.shop_orders(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), request_id uuid not null, sku text not null, title text not null, codes jsonb not null, qty integer not null, note text not null default '', sale bigint not null check(sale>0), cost bigint not null check(cost>0), status text not null default 'reserved' check(status in ('reserved','sending','review','pending','running','done','cancelled','rejected')), provider_code text unique, provider_price bigint, progress jsonb, message text, created_at timestamptz default now(), updated_at timestamptz default now(), unique(user_id,request_id));
create table if not exists public.shop_ledger(id bigint generated always as identity primary key,user_id uuid not null references auth.users(id), delta bigint not null, kind text not null, ref text not null, created_at timestamptz default now(), unique(kind,ref));
create index if not exists shop_orders_user_idx on public.shop_orders(user_id,created_at desc);
create index if not exists shop_deposits_user_idx on public.shop_deposits(user_id,created_at desc);
-- No client table access, even authenticated users. All RPCs restricted to service_role.
alter table public.shop_wallets enable row level security;
alter table public.shop_prices enable row level security;
alter table public.shop_deposits enable row level security;
alter table public.shop_payments enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_ledger enable row level security;
revoke all on public.shop_wallets,public.shop_prices,public.shop_deposits,public.shop_payments,public.shop_orders,public.shop_ledger from anon,authenticated;
grant all on public.shop_wallets,public.shop_prices,public.shop_deposits,public.shop_payments,public.shop_orders,public.shop_ledger to service_role;
grant usage,select on sequence public.shop_ledger_id_seq to service_role;
create or replace function public.shop_reserve(p_user uuid,p_request uuid,p_sku text,p_title text,p_codes jsonb,p_qty integer,p_note text,p_sale bigint,p_cost bigint) returns jsonb language plpgsql set search_path=public as $$
declare o shop_orders; b bigint; begin
 insert into shop_wallets(user_id) values(p_user) on conflict do nothing;
 select balance into b from shop_wallets where user_id=p_user for update;
 select * into o from shop_orders where user_id=p_user and request_id=p_request;
 if found then return jsonb_build_object('order',to_jsonb(o),'new',false); end if;
 if p_sale<p_cost or p_sale<=0 or b<p_sale then raise exception 'INSUFFICIENT_WALLET'; end if;
 update shop_wallets set balance=balance-p_sale where user_id=p_user;
 insert into shop_orders(user_id,request_id,sku,title,codes,qty,note,sale,cost) values(p_user,p_request,p_sku,p_title,p_codes,p_qty,p_note,p_sale,p_cost) returning * into o;
 insert into shop_ledger(user_id,delta,kind,ref) values(p_user,-p_sale,'order',o.id::text);
 return jsonb_build_object('order',to_jsonb(o),'new',true);
end $$;
create or replace function public.shop_claim(p_id uuid) returns boolean language plpgsql set search_path=public as $$
begin update shop_orders set status='sending',updated_at=now() where id=p_id and status='reserved'; return found; end $$;
create or replace function public.shop_finish(p_id uuid,p_status text,p_code text,p_price bigint,p_progress jsonb,p_message text) returns jsonb language plpgsql set search_path=public as $$
declare o shop_orders; begin
 select * into o from shop_orders where id=p_id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if o.status in ('done','cancelled','rejected') then return to_jsonb(o); end if;
 if p_status not in ('review','pending','running','done','cancelled','rejected') then raise exception 'BAD_STATUS'; end if;
 if p_code is not null and o.provider_code is not null and p_code<>o.provider_code then raise exception 'CODE_MISMATCH'; end if;
 if p_status='rejected' and o.provider_code is not null then raise exception 'ALREADY_SENT'; end if;
 if p_status in ('pending','running','done','cancelled') and coalesce(p_code,o.provider_code) is null then raise exception 'MISSING_CODE'; end if;
 if p_status in ('cancelled','rejected') then
  update shop_wallets set balance=balance+o.sale where user_id=o.user_id;
  insert into shop_ledger(user_id,delta,kind,ref) values(o.user_id,o.sale,'refund',o.id::text);
 end if;
 update shop_orders set status=p_status,provider_code=coalesce(p_code,provider_code),provider_price=coalesce(p_price,provider_price),progress=p_progress,message=p_message,updated_at=now() where id=p_id returning * into o;
 return to_jsonb(o);
end $$;
create or replace function public.shop_credit(p_tx text,p_account text,p_amount bigint,p_memo text,p_code text) returns jsonb language plpgsql set search_path=public as $$
declare d shop_deposits; outcome text; begin
 insert into shop_payments(tx_id,amount,account,memo,result) values(p_tx,p_amount,p_account,p_memo,'review') on conflict do nothing;
 if not found then return jsonb_build_object('result','duplicate'); end if;
 select * into d from shop_deposits where code=p_code for update;
 if not found then outcome:='unmatched';
 elsif d.status<>'pending' then outcome:='already_paid';
 elsif d.amount<>p_amount then outcome:='amount_mismatch';
 else
  insert into shop_wallets(user_id,balance) values(d.user_id,p_amount) on conflict(user_id) do update set balance=shop_wallets.balance+excluded.balance;
  update shop_deposits set status='paid',paid_at=now() where id=d.id;
  insert into shop_ledger(user_id,delta,kind,ref) values(d.user_id,p_amount,'deposit',p_tx);
  outcome:='credited';
 end if;
 update shop_payments set result=outcome,deposit_id=d.id where tx_id=p_tx;
 return jsonb_build_object('result',outcome);
end $$;
revoke all on function public.shop_reserve(uuid,uuid,text,text,jsonb,integer,text,bigint,bigint),public.shop_claim(uuid),public.shop_finish(uuid,text,text,bigint,jsonb,text),public.shop_credit(text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.shop_reserve(uuid,uuid,text,text,jsonb,integer,text,bigint,bigint),public.shop_claim(uuid),public.shop_finish(uuid,text,text,bigint,jsonb,text),public.shop_credit(text,text,bigint,text,text) to service_role;
