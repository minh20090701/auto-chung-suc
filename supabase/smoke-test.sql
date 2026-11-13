-- OPTIONAL: use only in a disposable Supabase project with at least one TEST Auth user.
-- Rolls back all rows. No external call. Run schema.sql first.
begin;
do $$
declare u uuid; w bigint; v bigint; d uuid; c text; t text; req uuid; o jsonb; oid uuid; j jsonb;
begin
 select id into u from auth.users order by created_at limit 1;
 if u is null then raise exception 'Create a test Auth user first'; end if;
 insert into public.shop_wallets(user_id) values(u) on conflict do nothing;
 select balance into w from public.shop_wallets where user_id=u;
 c:='CS'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));t:='test-'||gen_random_uuid()::text;
 insert into public.shop_deposits(user_id,code,amount) values(u,c,10000) returning id into d;
 j:=public.shop_credit(t,'TEST',9999,c,c);if j->>'result'<>'amount_mismatch' then raise exception 'mismatch'; end if;
 j:=public.shop_credit(t||'b','TEST',10000,c,c);if j->>'result'<>'credited' then raise exception 'credit'; end if;
 j:=public.shop_credit(t||'b','TEST',10000,c,c);if j->>'result'<>'duplicate' then raise exception 'duplicate'; end if;
 select balance into v from public.shop_wallets where user_id=u;if v<>w+10000 then raise exception 'balance after payment'; end if;
 req:=gen_random_uuid();o:=public.shop_reserve(u,req,'p:1','test','["ABCDE"]'::jsonb,1,'',7000,5000);oid:=(o->'order'->>'id')::uuid;
 o:=public.shop_reserve(u,req,'p:1','test','["ABCDE"]'::jsonb,1,'',7000,5000);if (o->>'new')::boolean then raise exception 'duplicate order';end if;
 select balance into v from public.shop_wallets where user_id=u;if v<>w+3000 then raise exception 'debit'; end if;
 if not public.shop_claim(oid) then raise exception 'claim'; end if;
 if public.shop_claim(oid) then raise exception 'second claim'; end if;
 perform public.shop_finish(oid,'rejected',null,null,null,'test');
 perform public.shop_finish(oid,'rejected',null,null,null,'test');
 select balance into v from public.shop_wallets where user_id=u;if v<>w+10000 then raise exception 'refund'; end if;
 raise notice 'PASS: wrong amount, duplicate payment, reserve, claim and refund';
end $$;
rollback;
