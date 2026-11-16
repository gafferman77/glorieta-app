// Glorieta V1 — Supabase Edge Function (not active until deployed).
// Shared access code is a SERVER secret. No service_role key in GitHub Pages.
import { createClient } from "jsr:@supabase/supabase-js@2";
const ORIGIN = "https://gafferman77.github.io";
const headers = { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Headers": "content-type,x-glorieta-key", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json", "Cache-Control": "no-store" };
const respond = (data: unknown, status=200) => new Response(JSON.stringify(data),{status,headers});
const unauthorized = () => respond({error:"Código de acceso incorrecto"},401);
const max = (value:unknown,n:number)=>String(value??"").trim().slice(0,n);
const nullable = (value:unknown,n:number)=>max(value,n)||null;
const good = (value:unknown)=>typeof value==="string" && value.length>=1;
const ERROR = (err: unknown) => err instanceof Error ? err.message : "Error desconocido";
function auth(req:Request){
 const got=req.headers.get("x-glorieta-key")||"";
 const secret=Deno.env.get("GLORIETA_ACCESS_CODE")||"";
 // Require an unpredictable high entropy phrase; do not allow accidental empty key.
 if(secret.length<16||got.length!==secret.length)return false;
 let diff=0;for(let i=0;i<got.length;i++)diff |=got.charCodeAt(i)^secret.charCodeAt(i);
 return diff===0;
}
const db=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
async function imageUrl(path:string|null){
 if(!path)return null;
 const {data}=await db.storage.from("glorieta-photos").createSignedUrl(path,3600);
 return data?.signedUrl||null;
}
async function enrich(items:any[]){
 return await Promise.all(items.map(async p=>({...p,photo_url:await imageUrl(p.photo_path)})));
}
function validItem(p:any){
 const name=max(p.name,100),code=max(p.code,40),qty=Number(p.quantity),unit=max(p.unit,30);
 if(!name||!code||!unit||!Number.isFinite(qty)||qty<0||qty>1000000)throw Error("Datos obligatorios inválidos");
 return {name,code,quantity:qty,unit,operator:max(p.operator,100),color:nullable(p.color,80),package_size:nullable(p.package_size,80),expiration_date:p.expiration_date||null,location:nullable(p.location,120),notes:nullable(p.notes,500)};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return respond({error:"Método no permitido"},405);
 if(req.headers.get("origin")!==ORIGIN)return respond({error:"Origen no permitido"},403);
 if(!auth(req))return unauthorized();
 const contentLength=Number(req.headers.get("content-length")||0);
 if(contentLength>1600000)return respond({error:"Solicitud demasiado grande"},413);
 try{
  const body=await req.json(), action=max(body.action,30);
  if(action==="list"){
   const {data,error}=await db.from("glorieta_products").select("*").order("name").limit(1000);
   if(error)throw error;
   return respond({products:await enrich(data||[])});
  }
  if(action==="history"){
   const {data,error}=await db.from("glorieta_movements").select("*").order("created_at",{ascending:false}).limit(300);
   if(error)throw error;return respond({history:data});
  }
  if(action==="create"||action==="update"){
   const p=validItem(body.product||{});
   if(!p.operator)throw Error("Indicá el responsable del cambio");
   let result:any;
   if(action==="create"){
    const {data,error}=await db.rpc("glorieta_create_product",{
      p_code:p.code,p_name:p.name,p_qty:p.quantity,p_unit:p.unit,p_operator:p.operator,
      p_color:p.color,p_package:p.package_size,p_expiration:p.expiration_date,p_location:p.location,p_notes:p.notes,
      p_photo_path:nullable(body.product.photo_path,160)
    });if(error)throw error;result=data;
   }else{
    if(!good(body.product.id))throw Error("Falta el ID");
    const {data,error}=await db.rpc("glorieta_update_product",{
      p_id:body.product.id,p_code:p.code,p_name:p.name,p_unit:p.unit,p_operator:p.operator,
      p_color:p.color,p_package:p.package_size,p_expiration:p.expiration_date,p_location:p.location,p_notes:p.notes,
      p_photo_path:nullable(body.product.photo_path,160)
    });if(error)throw error;result=data;
   }
   return respond({product:(await enrich([result]))[0]});
  }
  if(action==="move"){
   const amount=Number(body.amount);
   if(!good(body.id)||!Number.isFinite(amount)||amount<=0||amount>1000000)throw Error("Cantidad inválida");
   const operator=max(body.operator,100),kind=max(body.kind,10);
   if(!operator||!["entrada","salida"].includes(kind))throw Error("Movimiento inválido");
   const {data,error}=await db.rpc("glorieta_stock_change",{p_id:body.id,p_kind:kind,p_amount:amount,p_operator:operator,p_note:nullable(body.note,200)});
   if(error)throw error;return respond({product:(await enrich([data]))[0]});
  }
  if(action==="upload_photo"){
   const original=String(body.data||"");
   const match=/^data:image\/(jpeg|png|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(original);
   if(!match||original.length>1350000)throw Error("Foto inválida o demasiado grande");
   const raw=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));
   if(raw.length>1000000)throw Error("Foto superior a 1 MB");
   const type=match[1]==="jpeg"?"image/jpeg":`image/${match[1]}`;
   const path=crypto.randomUUID()+"."+ (match[1]==="jpeg"?"jpg":match[1]);
   const {error}=await db.storage.from("glorieta-photos").upload(path,raw,{contentType:type,upsert:false});
   if(error)throw error;return respond({path,url:await imageUrl(path)});
  }
  return respond({error:"Operación desconocida"},400);
 }catch(e){return respond({error:ERROR(e)},400)}
});
