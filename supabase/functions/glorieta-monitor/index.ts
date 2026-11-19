// GLORIETA · Monitor público de solo lectura.
// No permite crear, editar, eliminar ni consultar movimientos o responsables.
import { createClient } from "jsr:@supabase/supabase-js@2";
const ALLOWED_ORIGIN="https://gafferman77.github.io";
const cors={
 "Access-Control-Allow-Origin":ALLOWED_ORIGIN,
 "Access-Control-Allow-Methods":"GET, OPTIONS",
 "Access-Control-Allow-Headers":"content-type",
 "Cache-Control":"no-store",
 "Vary":"Origin",
 "Content-Type":"application/json; charset=utf-8"
};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const db=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="GET")return reply({error:"Solo lectura"},405);
 // Protege contra usos accidentales desde otros sitios; no constituye autenticación.
 const origin=req.headers.get("origin");
 if(origin && origin!==ALLOWED_ORIGIN)return reply({error:"Origen no permitido"},403);
 try {
  const {data,error}=await db.from("glorieta_products")
   .select("code,name,quantity,unit,color,package_size,location,expiration_date,photo_path,updated_at")
   .order("name",{ascending:true}).limit(1500);
  if(error)throw error;
  const products=await Promise.all((data||[]).map(async p=>{
   let photo_url=null;
   if(p.photo_path){
    const {data:link}=await db.storage.from("glorieta-photos").createSignedUrl(p.photo_path,900);
    photo_url=link?.signedUrl||null;
   }
   return {code:p.code,name:p.name,quantity:Number(p.quantity),unit:p.unit,color:p.color,location:p.location,expiration_date:p.expiration_date,
    package_size:p.package_size,photo_url,updated_at:p.updated_at};
  }));
  return reply({products,updated_at:new Date().toISOString()});
 }catch(e){
  console.error("Monitor read failure",e);
  return reply({error:"No se pudo consultar el inventario"},503);
 }
});
