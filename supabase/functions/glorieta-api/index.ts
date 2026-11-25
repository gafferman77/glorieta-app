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
const ERROR = (err: unknown) => { if (err instanceof Error) return err.message; if (err && typeof err === "object" && "message" in err && typeof (err as {message?:unknown}).message === "string") return String((err as {message:string}).message); return "No se pudo completar la operación. Intentá nuevamente."; };
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
 const category=max(p.category,30)||"Varios"; if(!["Deportes","Farmacia","Librería","Taller","Juegos","Varios"].includes(category))throw Error("Categoría inválida"); return {name,code,quantity:qty,unit,category,operator:max(p.operator,100),color:nullable(p.color,80),package_size:nullable(p.package_size,80),expiration_date:p.expiration_date||null,location:nullable(p.location,120),notes:nullable(p.notes,500)};
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
  if(action==="ping")return respond({ok:true});
  if(action==="list"){
   const {data,error}=await db.from("glorieta_products").select("*").is("archived_at",null).order("name").limit(1000);
   if(error)throw error;
   return respond({products:await enrich(data||[])});
  }
  if(action==="archived_list"){
   const {data,error}=await db.from("glorieta_products").select("id,code,name,category,quantity,unit,archived_at,archived_by").not("archived_at","is","null").order("archived_at",{ascending:false}).limit(200);
   if(error)throw error;return respond({products:data||[]});
  }
  if(action==="archive"||action==="restore"){
   const id=max(body.id,60),who=max(body.operator,100);
   if(!/^[0-9a-f-]{36}$/i.test(id)||!who)throw Error("Artículo o encargado incorrecto");
   const archived=action==="archive";
   let update=db.from("glorieta_products")
     .update({archived_at:archived?new Date().toISOString():null,archived_by:archived?who:null})
     .eq("id",id);
   update=archived?update.is("archived_at",null):update.not("archived_at","is","null");
   const {data,error}=await update.select("id,name,code,archived_at").maybeSingle();
   if(error)throw error;
   if(!data)throw Error("El artículo fue modificado o ya no está en ese estado. Actualizá la lista.");
   return respond({product:data});
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

  if(action==="pedidos_list"){
   const {data,error}=await db.from("glorieta_pedidos").select("*").order("created_at",{ascending:false}).limit(300);
   if(error)throw error;return respond({pedidos:data||[]});
  }
  if(action==="pedido_get"){
   const id=max(body.id,50);
   if(!/^[0-9a-f-]{36}$/i.test(id))throw Error("Identificador incorrecto");
   const {data,error}=await db.from("glorieta_pedidos").select("*").eq("id",id).single();
   if(error)throw error;return respond({pedido:data});
  }
  if(action==="pedido_save"||action==="pedido_cancel"){
   const p=body.pedido||{}, id=max(p.id,50),who=max(p.operator,100),expected=max(p.expected_updated_at,70);
   if(!/^[0-9a-f-]{36}$/i.test(id)||!who||!expected)throw Error("Faltan datos para actualizar el pedido");
   const {data:old,error:readError}=await db.from("glorieta_pedidos").select("estado").eq("id",id).single();
   if(readError)throw readError;
   if(old.estado!=="pendiente")throw Error("El pedido ya fue entregado o cancelado");
   const payload:any={updated_by:who,updated_at:new Date().toISOString()};
   if(action==="pedido_cancel")payload.estado="cancelado";
   else{
    const nombre=max(p.solicitante_nombre,100),apellido=max(p.solicitante_apellido,100),
      para=max(p.para_quien,160),destino=max(p.destino,160);
    if(!nombre||!apellido||!para||!destino)throw Error("Completá los datos del pedido");
    if(!Array.isArray(p.items)||p.items.length<1||p.items.length>30)throw Error("Debe haber entre 1 y 30 artículos");
    const ids=p.items.map((it:any)=>max(it.product_id,50));
    if(ids.some((id:string)=>!/^[0-9a-f-]{36}$/i.test(id))||new Set(ids).size!==ids.length)throw Error("Artículos duplicados o inválidos");
    const {data:products,error:productError}=await db.from("glorieta_products")
      .select("id,name,code,unit,quantity").in("id",ids).is("archived_at",null);
    if(productError)throw productError;
    if(!products||products.length!==ids.length)throw Error("Algún material ya no está disponible");
    const rows=p.items.map((it:any)=>{
      const product=products.find((pr:any)=>pr.id===it.product_id);
      const qty=Number(it.cantidad);
      if(!product||!Number.isFinite(qty)||qty<=0||qty>1000000||Math.round(qty*100)!==qty*100)throw Error("Cantidad incorrecta");
      if(qty>Number(product.quantity))throw Error("No hay suficientes unidades de "+product.name);
      return {product_id:product.id,codigo:product.code,nombre:product.name,unidad:product.unit,cantidad:qty};
    });
    Object.assign(payload,{solicitante_nombre:nombre,solicitante_apellido:apellido,
      para_quien:para,destino,observaciones:max(p.observaciones,800),responsable_retiro:nullable(p.responsable_retiro,120),
      es_prestamo:p.es_prestamo===true,items:rows});
   }
   const {data,error}=await db.from("glorieta_pedidos").update(payload).eq("id",id)
     .eq("estado","pendiente").eq("updated_at",expected).select("*").maybeSingle();
   if(error)throw error;
   if(!data)throw Error("Este pedido cambió en otro dispositivo. Volvé a abrirlo");
   return respond({pedido:data});
  }
  if(action==="pedido_entregar"){
   const id=max(body.id,50),who=max(body.operator,100),retira=nullable(body.responsable_retiro,120);
   if(!/^[0-9a-f-]{36}$/i.test(id)||!who)throw Error("Pedido o encargado incorrecto");
   const {data,error}=await db.rpc("glorieta_entregar_pedido",{p_pedido_id:id,p_operator:who,p_retirado_por:retira});
   if(error)throw error;
   return respond({remito_id:data});
  }
  if(action==="remitos_list"){
   const {data,error}=await db.from("glorieta_remitos").select("id,numero,solicitante_nombre,solicitante_apellido,destino,es_prestamo,estado,created_at,updated_at").order("created_at",{ascending:false}).limit(200);
   if(error)throw error;return respond({remitos:data||[]});
  }
  if(action==="remito_get"){
   const id=max(body.id,50);
   if(!/^[0-9a-f-]{36}$/.test(id))throw Error("Identificador incorrecto");
   const {data,error}=await db.from("glorieta_remitos").select("*").eq("id",id).single();
   if(error)throw error;
   if(data.nota_foto_path){const {data:pic}=await db.storage.from("glorieta-photos").createSignedUrl(data.nota_foto_path,3600);data.nota_foto_url=pic?.signedUrl||null}
   return respond({remito:data});
  }
  if(action==="remito_save"){
   const p=body.remito||{};
   const nombre=max(p.solicitante_nombre,100),apellido=max(p.solicitante_apellido,100),destino=max(p.destino,160);
   const quien=max(p.operator,100);
   if(!nombre||!apellido||!destino||!quien)throw Error("Completá nombre, apellido, destino y encargado");
   // Los borradores pueden quedar sin foto ni nota mientras se corrige una carga equivocada.
   if(!Array.isArray(p.items)||p.items.length>100)throw Error("Máximo 100 renglones");
   const lines=p.items.map((row:any)=>{
    const description=max(row.descripcion,180),unit=max(row.unidad,35)||"unidades";
    const quantity=Number(row.cantidad);
    if(!description||!Number.isFinite(quantity)||quantity<=0||quantity>1000000)throw Error("Revisá descripción y cantidad de cada renglón");
    return {descripcion:description,cantidad:quantity,unidad:unit};
   });
   if(p.estado==="preparado" && lines.length===0)throw Error("Para marcarlo preparado agregá al menos un material");
   const payload={
    solicitante_nombre:nombre,solicitante_apellido:apellido,destino,
    responsable_retiro:nullable(p.responsable_retiro,120),es_prestamo:p.es_prestamo===true,
    nota_original:max(p.nota_original,8000),texto_transcripto:max(p.texto_transcripto,8000),
    nota_foto_path:nullable(p.nota_foto_path,160),
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
