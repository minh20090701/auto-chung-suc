import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../lib/chungsuc.js';
import gateway from '../api/gateway.js';
const env={APP_PASSWORD:'test-password-123456',CS_API_KEY:'mock-key',CS_API_KEY_HEADER:'X-API-Key',CS_MAX_ORDER_TOTAL:'500',CS_ENABLE_ORDER:'false'};
for(const a of ['BALANCE','SERVICES','ORDERS','DETAIL','ORDER'])env['CS_'+a+'_PATH']='/mock/'+a.toLowerCase();
const body={package_id:1,quantity:2,referral_codes:['TEST1','TEST2'],note:'',confirmed_total:400};
const req=(action,b,opts={})=>handleRequest({env:opts.env??env,request:new Request('https://test.vercel.app/api?action='+action,{method:opts.method??(b===undefined?'GET':'POST'),headers:{'X-App-Password':opts.password??env.APP_PASSWORD,...(b===undefined?{}:{'Content-Type':'application/json'}),...opts.headers},body:b===undefined?undefined:typeof b==='string'?b:JSON.stringify(b)})});
test('Vercel API core: auth, routes, schema, limits and one outbound order',async()=>{
 const original=globalThis.fetch;let calls=[];
 globalThis.fetch=async(url,opts)=>{calls.push({url:String(url),opts});assert.equal(url.hostname,'chungsucliqi.com');assert.equal(opts.headers['X-API-Key'],'mock-key');let data=url.pathname.endsWith('/services')?{services:[{id:1,price:100}]}:url.pathname.endsWith('/balance')?{balance:1000}:url.pathname.endsWith('/orders')?{orders:[]}:url.pathname.endsWith('/detail')?{order:{id:123}}:{order_ids:[123]};return new Response(JSON.stringify({success:true,data}));};
 try{
 assert.equal((await req('balance',undefined,{env:{}})).status,503);
 assert.equal((await req('balance',undefined,{password:'wrong'})).status,401);
 assert.equal((await req('balance',undefined,{headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await req('unknown')).status,400);
 assert.equal((await req('order')).status,405);
 assert.deepEqual((await (await req('balance')).json()).data,{balance:1000});
 assert.equal((await req('services')).status,200);
 assert.equal((await req('orders&page=2')).status,200);
 assert.equal((await req('detail&order_id=123')).status,200);
 assert.equal((await req('order',body)).status,403);
 env.CS_ENABLE_ORDER='true';
 assert.equal((await req('order','{')).status,400);
 assert.equal((await req('order',null)).status,400);
 assert.equal((await req('order',body,{headers:{'Content-Type':'text/plain'}})).status,415);
 assert.equal((await req('order','x'.repeat(40001))).status,413);
 assert.equal((await req('order',{...body,confirmed_total:300})).status,409);
 assert.equal((await req('order',{...body,quantity:3,confirmed_total:600})).status,409);
 assert.equal((await req('order',{...body,referral_codes:['A','A']})).status,400);
 const r=await req('order',body);assert.equal(r.status,200);assert.deepEqual((await r.json()).data.order_ids,[123]);assert.equal(calls.filter(c=>c.opts.method==='POST').length,1);
 assert.equal(r.headers.get('Cache-Control'),'no-store');
 assert.equal((await req('balance',undefined,{env:{...env,CS_BALANCE_PATH:'/\\evil.example'}})).status,502);
 }finally{globalThis.fetch=original;}
});

test('Vercel gateway: production entry reads environment, preserves request and response',async()=>{
 const previous={...process.env},original=globalThis.fetch;
 try {
  Object.assign(process.env,env,{CS_ENABLE_ORDER:'false'});
  globalThis.fetch=async(url,opts)=>{assert.equal(url.pathname,'/mock/balance');assert.equal(opts.headers['X-API-Key'],'mock-key');return Response.json({success:true,data:{balance:42}});};
  const r=await gateway.fetch(new Request('https://test.vercel.app/api?action=balance',{headers:{'X-App-Password':env.APP_PASSWORD,Origin:'https://test.vercel.app'}}));
  assert.equal(r.status,200);assert.deepEqual(await r.json(),{success:true,data:{balance:42}});
  assert.equal((await gateway.fetch(new Request('https://test.vercel.app/api?action=balance'))).status,401);
  const disabled=await gateway.fetch(new Request('https://test.vercel.app/api?action=order',{method:'POST',headers:{'X-App-Password':env.APP_PASSWORD,'Content-Type':'application/json'},body:JSON.stringify(body)}));assert.equal(disabled.status,403);
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in previous))delete process.env[k];Object.assign(process.env,previous);}
});
