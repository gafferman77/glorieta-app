import { createClient } from "jsr:@supabase/supabase-js@2";
const ORIGIN="https://gafferman77.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"content-type","Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"};
const reply=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{status,headers});
const db=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
const val=(s:unknown,n:number)=>String(s??"").trim().slice(0,n);
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply({error:"Método no permitido"},405);
 if(req.headers.get("origin")!==ORIGIN)return reply({error:"Origen no permitido"},403);
 const contentLength=Number(req.headers.get("content-length")||"0");
 if(contentLength>16000)return reply({error:"Pedido demasiado grande"},413);
 try{
  const p=await req.json();
  if(p.website)return reply({ok:true});
  const nombre=val(p.nombre,100),apellido=val(p.apellido,100),para=val(p.para_quien,160),destino=val(p.destino,160);
  if(!nombre||!apellido||!para||!destino)throw Error("Completá nombre, apellido, para quién y destino");
  if(!Array.isArray(p.items)||p.items.length<1||p.items.length>30)throw Error("El carrito debe contener entre 1 y 30 artículos");
  const map=new Map<string,number>();
  for(const item of p.items){
   const code=val(item.code,40),qty=Number(item.cantidad);
   if(!code||!Number.isFinite(qty)||qty<=0||qty>10000||Math.round(qty*100)!==qty*100)throw Error("Revisá las cantidades");
   map.set(code,(map.get(code)||0)+qty);
  }
  const {data:products,error}=await db.from("glorieta_products").select("id,code,name,unit,quantity,archived_at").in("code",[...map.keys()]).is("archived_at",null);
  if(error)throw error;
  if(!products||products.length!==map.size)throw Error("Algún artículo ya no está disponible. Actualizá el catálogo.");
  const items=products.map(prod=>({product_id:prod.id,codigo:prod.code,nombre:prod.name,unidad:prod.unit,cantidad:map.get(prod.code)}));
  for(const item of items){
   const prod=products.find(x=>x.id===item.product_id)!;
   if(item.cantidad!>Number(prod.quantity))throw Error("La cantidad solicitada supera el stock de "+prod.name);
  }
  const payload={solicitante_nombre:nombre,solicitante_apellido:apellido,para_quien:para,destino,observaciones:val(p.observaciones,800),es_prestamo:p.es_prestamo===true,items,estado:"pendiente"};
  const {data,error:saveError}=await db.from("glorieta_pedidos").insert(payload).select("id,numero").single();
  if(saveError)throw saveError;
  return reply({ok:true,numero:data.numero});
 }catch(e){return reply({error:e instanceof Error?e.message:"No se pudo enviar el pedido"},400)}
});