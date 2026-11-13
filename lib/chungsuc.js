import { timingSafeEqual, createHash } from 'node:crypto';
const base='https://chungsucliqi.com/api/v1.php';
const response=(status,data,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const fail=(status,message,extra={})=>response(status,{success:false,message,...extra});
const digest=s=>createHash('sha256').update(String(s??'')).digest();
const statuses={pending:'pending',processing:'running',completed:'done',cancelled:'cancelled'};
const reverse={pending:'pending',running:'processing',done:'completed',cancelled:'cancelled'};
const labels={pending:'Đang chờ',running:'Đang chạy',done:'Hoàn thành',cancelled:'Đã hủy'};
class ApiError extends Error{constructor(status,code,message,retry){super(message);this.status=status;this.code=code;this.retry=retry;}}
async function call(env,action,params={},body){
 const url=new URL(base);url.searchParams.set('action',action);for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
 const r=await fetch(url,{method:body?'POST':'GET',headers:{Accept:'application/json','X-API-Key':env.CS_API_KEY,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});
 let j;try{j=await r.json()}catch{throw new ApiError(502,'bad_response','Chung Sức không trả JSON.');}
 if(!r.ok||j.ok!==true){const code=String(j?.error?.code||'upstream_error');const retry=r.headers.get('Retry-After');throw new ApiError([400,401,402,403,404,409,429].includes(r.status)?r.status:502,code,`Chung Sức: ${String(j?.error?.message||code).slice(0,240)}`,retry);}
 if(!j.data||typeof j.data!=='object')throw new ApiError(502,'bad_response','Phản hồi API thiếu dữ liệu.');
 return j;
}
const order=o=>{if(!o||typeof o.code!=='string'||!o.code)throw new ApiError(502,'bad_response','Phản hồi thiếu mã đơn.');return {...o,id:o.code,package_name:o.product||o.type||'—',referral_code:Array.isArray(o.codes)?o.codes.join(', '):String(o.codes??''),total_price:o.price,status:reverse[o.status]||o.status,status_label:labels[o.status]||o.status,progress:o.progress?.percent,progress_detail:o.progress};};
function products(d){if(!Array.isArray(d.products))throw new ApiError(502,'bad_response','Thiếu danh sách products.');return d.products.map(p=>({id:p.id,name:p.name,price:p.price,tickets:p.tickets,require_code:p.require_code,description:`${p.tickets??'—'} vé / gói`}));}
function retail(d){if(!d||!Array.isArray(d.packs))throw new ApiError(502,'bad_response','Thiếu bảng giá đặt lẻ.');return {enabled:d.enabled===true,min:d.min,max:d.max,per_unit:d.per_unit,unit_name:d.unit_name,unit_price:d.unit_price,packs:d.packs};}
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const money=v=>Number.isSafeInteger(v)&&v>0;
const balance=d=>{if(!Number.isSafeInteger(d.balance)||d.balance<0)throw new ApiError(502,'bad_response','Số dư không hợp lệ.');return d.balance;};
const allowed=new Set(['balance','services','orders','detail','order','retail','retail_order','status']);
async function readBody(req){if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||''))throw new ApiError(415,'content_type','Cần gửi JSON.');if(Number(req.headers.get('content-length'))>40000)throw new ApiError(413,'size','Dữ liệu quá lớn.');const reader=req.body?.getReader();if(!reader)throw new ApiError(400,'body','Thiếu dữ liệu.');let bytes=0,s='';const decoder=new TextDecoder();while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>40000){await reader.cancel();throw new ApiError(413,'size','Dữ liệu quá lớn.');}s+=decoder.decode(value,{stream:true});}try{const b=JSON.parse(s+decoder.decode());if(!b||typeof b!=='object'||Array.isArray(b))throw Error();return b;}catch{throw new ApiError(400,'json','JSON không hợp lệ.');}}
export async function handleRequest({request,env}){
 const u=new URL(request.url),q=u.searchParams,a=q.get('action');
 if(request.headers.has('Origin')&&request.headers.get('Origin')!==u.origin)return fail(403,'Origin không hợp lệ.');
 if(!env.APP_PASSWORD||env.APP_PASSWORD.length<16||!env.CS_API_KEY)return fail(503,'Chưa cấu hình APP_PASSWORD và CS_API_KEY.');
 if(!timingSafeEqual(digest(request.headers.get('X-App-Password')),digest(env.APP_PASSWORD)))return fail(401,'Mật khẩu quản trị không đúng.');
 if(!allowed.has(a))return fail(400,'Thao tác không hợp lệ.');const write=a==='order'||a==='retail_order';
 if(request.method!==(write?'POST':'GET'))return fail(405,'Phương thức không hợp lệ.');
 let sent=false;
 try{
 if(a==='balance'){const d=(await call(env,'me')).data;return response(200,{success:true,data:{balance:balance(d),name:d.name,role:d.role,currency:'Xu',order_enabled:env.CS_ENABLE_ORDER==='true'}});}
 if(a==='services')return response(200,{success:true,data:{services:products((await call(env,'products')).data),currency:'Xu'}});
 if(a==='retail')return response(200,{success:true,data:retail((await call(env,'retail')).data)});
 if(a==='status'){const d=(await call(env,'status')).data;return response(200,{success:true,data:{order_enabled:d.order_enabled,retail_enabled:d.retail_enabled,auto_run:d.auto_run,eta_seconds:d.eta_seconds}});}
 if(a==='orders'){const page=Number(q.get('page')||1);if(!int(page,1,100000))return fail(400,'Trang không hợp lệ.');const p={page,limit:20};const s=q.get('status');if(s){if(!Object.hasOwn(statuses,s))return fail(400,'Trạng thái không hợp lệ.');p.status=statuses[s];}const d=(await call(env,'history',p)).data;if(!Array.isArray(d.orders)||!Number.isSafeInteger(d.total)||d.total<0)throw new ApiError(502,'bad_response','Lịch sử không đúng định dạng.');return response(200,{success:true,data:{orders:d.orders.map(order),pagination:{total_pages:Math.max(1,Math.ceil(d.total/20)),total:d.total},spent:d.spent,balance:d.balance}});}
 if(a==='detail'){const code=q.get('order_id')||'';if(!/^[A-Za-z0-9_.:-]{1,64}$/.test(code))return fail(400,'Mã đơn không hợp lệ.');return response(200,{success:true,data:{order:order((await call(env,'order',{code})).data)}});}
 if(env.CS_ENABLE_ORDER!=='true')return fail(403,'Đặt đơn thật đang tắt.');
 const b=await readBody(request),ref=b.client_ref,qty=b.quantity,codes=b.referral_codes;
 if(typeof ref!=='string'||!/^[A-Za-z0-9_.:-]{1,64}$/.test(ref)||typeof b.note!=='string'||b.note.length>500||!Array.isArray(codes)||codes.length<1||codes.length>200||new Set(codes).size!==codes.length||codes.some(c=>typeof c!=='string'||c.length<1||c.length>40||c!==c.trim()||/[\s,]/.test(c)))return fail(400,'Mã sự kiện, ghi chú hoặc client_ref không hợp lệ.');
 const max=Number(env.CS_MAX_ORDER_TOTAL);if(!money(max)||!money(b.confirmed_total))return fail(409,'Cần giới hạn Xu và giá xác nhận hợp lệ.');
 const st=(await call(env,'status')).data;let total,payload;
 if(a==='order'){
  if(st.order_enabled!==true)return fail(409,'Chung Sức đang tắt đặt đơn.');if(qty!==1||!int(b.package_id,1,Number.MAX_SAFE_INTEGER))return fail(400,'Đơn sản phẩm: mỗi mã một suất.');
  const item=products((await call(env,'products')).data).find(p=>p.id===b.package_id);if(!item||!money(item.price))return fail(409,'Sản phẩm hoặc giá không hợp lệ.');total=item.price*codes.length;payload={product_id:b.package_id,codes,client_ref:ref,note:b.note,allow_duplicate:false};
 }else{
  if(st.retail_enabled!==true)return fail(409,'Chung Sức đang tắt đặt lẻ.');if(codes.length!==1||codes[0].length<5)return fail(400,'Đặt lẻ cần đúng một mã (5–40 ký tự).');const d=retail((await call(env,'retail')).data);if(!d.enabled||!int(qty,d.min,d.max))return fail(400,'Số lượt/gói ngoài giới hạn.');const pack=b.pack||'';if(typeof pack!=='string'||pack.length>64)return fail(400,'Gói vé không hợp lệ.');const price=pack?d.packs.find(p=>p.key===pack)?.price:d.unit_price;if(!money(price))return fail(409,'Gói hoặc giá đặt lẻ không hợp lệ.');total=price*qty;payload={code:codes[0],qty,client_ref:ref,note:b.note,...(pack?{pack}:{})};
 }
 if(!money(total)||total>max||total!==b.confirmed_total)return fail(409,'Giá đã đổi hoặc vượt giới hạn Xu. Làm mới dịch vụ và xác nhận lại.');
 // Do not automatically retry a charge. Provider deduplicates by client_ref.
 sent=true;const j=await call(env,a,{},payload);const o=order(j.data);return response(200,{success:true,data:{order:o,order_ids:[o.id],balance:j.balance,duplicate_request:j.duplicate_request===true}});
 }catch(e){if(e instanceof ApiError){const retry=e.retry&&/^\d+$/.test(e.retry)?{'Retry-After':e.retry}:{};const uncertain=sent&&(e.status>=500||e.status===429);return response(e.status,{success:false,message:e.message,code:e.code,uncertain,...(e.retry?{retry_after:e.retry}:{})},retry);}return fail(502,sent?'Chưa xác nhận được đơn. Kiểm tra lịch sử; giữ nguyên client_ref nếu gửi lại.':'Không kết nối được Chung Sức.',{uncertain:sent});}
}
