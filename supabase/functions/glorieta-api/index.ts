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
async function auth(req:Request){
 const got=req.headers.get("x-glorieta-key")||"";
 if(got.length<16||got.length>128)return false;
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(got));
 const received=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
 const expected="142f51b582033573d2c82789b68549444499e82eb6864c450162a59dad4e9e55";
 let diff=0;for(let i=0;i<expected.length;i++)diff |=expected.charCodeAt(i)^received.charCodeAt(i);
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
 const category=max(p.category,30)||"Varios"; if(!["Deportes","Farmacia","Librería","Taller","Varios"].includes(category))throw Error("Categoría inválida"); return {name,code,quantity:qty,unit,category,operator:max(p.operator,100),color:nullable(p.color,80),package_size:nullable(p.package_size,80),expiration_date:p.expiration_date||null,location:nullable(p.location,120),notes:nullable(p.notes,500)};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return respond({error:"Método no permitido"},405);
 if(req.headers.get("origin")!==ORIGIN)return respond({error:"Origen no permitido"},403);
 if(!(await auth(req)))return unauthorized();
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
    const {data,error}=await db.rpc("glorieta_edit_product",{
      p_id:body.product.id,p_code:p.code,p_name:p.name,p_unit:p.unit,p_operator:p.operator,
      p_quantity:p.quantity,p_expected_quantity:Number(body.product.expected_quantity),
      p_reason:nullable(body.product.correction_reason,200),
      p_color:p.color,p_package:p.package_size,p_expiration:p.expiration_date,p_location:p.location,p_notes:p.notes,
      p_photo_path:nullable(body.product.photo_path,160)
    });if(error)throw error;result=data;
   }
   // Guardamos la categoría mediante la misma API protegida, nunca desde el monitor.
   const {data:categorized,error:categoryError}=await db.from("glorieta_products")
     .update({category:p.category}).eq("id",result.id).select("*").single();
   if(categoryError)throw categoryError;
   return respond({product:(await enrich([categorized]))[0]});
  }
  if(action==="move"){
   const amount=Number(body.amount);
   if(!good(body.id)||!Number.isFinite(amount)||amount<=0||amount>1000000)throw Error("Cantidad inválida");
   const operator=max(body.operator,100),kind=max(body.kind,10);
   if(!operator||!["entrada","salida"].includes(kind))throw Error("Movimiento inválido");
   const {data,error}=await db.rpc("glorieta_stock_change",{p_id:body.id,p_kind:kind,p_amount:amount,p_operator:operator,p_note:nullable(body.note,200)});
   if(error)throw error;return respond({product:(await enrich([data]))[0]});
  }

  if(action==="remitos_list"){
   const {data,error}=await db.from("glorieta_remitos").select("id,numero,solicitante_nombre,solicitante_apellido,destino,es_prestamo,estado,created_at,updated_at").order("created_at",{ascending:false}).limit(200);
   if(error)throw error;return respond({remitos:data||[]});
  }
  if(action==="remito_get"){
   const id=max(body.id,50);
   if(!/^[0-9a-f-]{36}$/.test(id))throw Error("Identificador incorrecto");
   const {data,error}=await db.from("glorieta_remitos").select("*").eq("id",id).single();
   if(error)throw error;return respond({remito:data});
  }
  if(action==="remito_save"){
   const p=body.remito||{};
   const nombre=max(p.solicitante_nombre,100),apellido=max(p.solicitante_apellido,100),destino=max(p.destino,160);
   const quien=max(p.operator,100);
   if(!nombre||!apellido||!destino||!quien)throw Error("Completá nombre, apellido, destino y encargado");
   if(!Array.isArray(p.items)||p.items.length>100)throw Error("Máximo 100 renglones");
   const lines=p.items.map((row:any)=>{
    const description=max(row.descripcion,180),unit=max(row.unidad,35)||"unidades";
    const quantity=Number(row.cantidad);
    if(!description||!Number.isFinite(quantity)||quantity<=0||quantity>1000000)throw Error("Revisá descripción y cantidad de cada renglón");
    return {descripcion:description,cantidad:quantity,unidad:unit};
   });
   const payload={
    solicitante_nombre:nombre,solicitante_apellido:apellido,destino,
    responsable_retiro:nullable(p.responsable_retiro,120),es_prestamo:p.es_prestamo===true,
    nota_original:max(p.nota_original,8000),texto_transcripto:max(p.texto_transcripto,8000),
    items:lines,estado:p.estado==="preparado"?"preparado":"borrador",
    updated_by:quien,updated_at:new Date().toISOString()
   };
   if(p.id){
    const id=max(p.id,50),expected=max(p.expected_updated_at,70);
    if(!/^[0-9a-f-]{36}$/.test(id)||!expected)throw Error("Faltan datos para editar");
    const {data,error}=await db.from("glorieta_remitos").update(payload).eq("id",id).eq("updated_at",expected).select("*").maybeSingle();
    if(error)throw error;
    if(!data)throw Error("Este remito fue modificado desde otro dispositivo. Volvé a abrirlo antes de guardar.");
    return respond({remito:data});
   }
   const {data,error}=await db.from("glorieta_remitos").insert({...payload,creado_por:quien}).select("*").single();
   if(error)throw error;
   return respond({remito:data});
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
