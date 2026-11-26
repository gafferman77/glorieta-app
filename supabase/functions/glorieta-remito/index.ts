// Remito por enlace no adivinable: consulta exclusiva, sin credenciales ni escritura.
// Un enlace compartido permite ver su contenido; evitar datos sensibles en las notas.
import { createClient } from "jsr:@supabase/supabase-js@2";
const CORS={"Access-Control-Allow-Origin":"https://gafferman77.github.io","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"content-type","Content-Type":"application/json;charset=utf-8","Cache-Control":"no-store","Vary":"Origin"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:CORS});
const db=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
 if(req.method!=="GET")return reply({error:"Solo lectura"},405);
 const origin=req.headers.get("origin");
 if(origin && origin!=="https://gafferman77.github.io")return reply({error:"Origen no permitido"},403);
 const u=new URL(req.url),id=u.searchParams.get("id")||"";
 try{
  if(u.searchParams.get("list")==="1"){
   const {data,error}=await db.from("glorieta_remitos")
    .select("id,numero,solicitante_nombre,solicitante_apellido,destino,es_prestamo,created_at")
    .eq("estado","preparado").order("created_at",{ascending:false}).limit(250);
   if(error)throw error;
   return reply({remitos:data||[]});
  }
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return reply({error:"Enlace de remito no válido"},400);
  const {data,error}=await db.from("glorieta_remitos")
   .select("numero,solicitante_nombre,solicitante_apellido,destino,responsable_retiro,autorizado_por,creado_por,es_prestamo,nota_original,items,estado,created_at,updated_at")
   .eq("id",id).eq("estado","preparado").single();
  if(error||!data)return reply({error:"Remito no encontrado o todavía en borrador"},404);
  return reply({remito:data});
 }catch(e){console.error("remito read error",e);return reply({error:"No se pudo abrir el remito"},503)}
});
