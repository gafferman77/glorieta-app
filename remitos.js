/* GLORIETA Remitos — gestión autenticada, sin cambios automáticos de stock.
   OCR de fotos se procesa localmente en el navegador y siempre es revisable.
*/
let remitoActual=null,remitoFoto=null,remitoFotoNueva=null,remitoFotoEliminada=false,remitoLineas=[],remitoBusy=false;
const remitoLink=id=>"https://gafferman77.github.io/glorieta-app/remito.html?id="+encodeURIComponent(id);
const remitoNumero=n=>"REM-"+String(n).padStart(5,"0");
const remitoOpts=["unidades","cajas","paquetes","frascos","pomos","resmas","rollos","litros","kg","otros"];
function remitoUnidades(u){return remitoOpts.map(x=>'<option value="'+esc(x)+'" '+(u===x?"selected":"")+'>'+esc(x)+'</option>').join("")}
async function showRemitos(){
 $('main-panel').innerHTML='<section class="paper"><div class="row"><h2>Remitos</h2><button type="button" id="nuevo-remito" class="btn btn-green">+ Nuevo remito</button></div><p class="mini">Pedí materiales con una nota, revisá el detalle y generá un documento para compartir. Un remito no descuenta stock automáticamente.</p><div id="lista-remitos">Cargando remitos...</div></section>';
 $('nuevo-remito').onclick=()=>abrirEditorRemito();
 try{
  const d=await api("remitos_list");
  if(view!=="remitos"||!$('lista-remitos'))return;
  const list=d.remitos||[];
  $('lista-remitos').innerHTML=list.length?'<div class="remitos-list">'+list.map(r=>'<button type="button" class="remito-record" data-remito="'+esc(r.id)+'"><span><b>'+esc(remitoNumero(r.numero))+'</b> · '+esc(r.solicitante_nombre+' '+r.solicitante_apellido)+'<small>Destino: '+esc(r.destino)+' · '+(r.es_prestamo?"Préstamo abierto":"Entrega")+'</small></span><span class="remito-tag">'+esc(r.estado==='preparado'?"Preparado":"Borrador")+' →</span></button>').join("")+'</div>':'<p class="empty">Todavía no hay remitos. Tocá «Nuevo remito» para comenzar.</p>';
  document.querySelectorAll('[data-remito]').forEach(b=>b.onclick=()=>cargarRemito(b.dataset.remito));
 }catch(e){if($('lista-remitos'))$('lista-remitos').textContent='No se pudo cargar la lista: '+e.message}
}
async function cargarRemito(id){
 status("Abriendo remito...");
 try{
  const d=await api("remito_get",{id});
  if(view!=="remitos")return;
  abrirEditorRemito(d.remito);
 }catch(e){toast(e.message);showRemitos()}
}
function lineasHtml(){
 const root=$('remito-lineas');if(!root)return;
 root.innerHTML=remitoLineas.length?remitoLineas.map((l,i)=>'<div class="remito-linea" data-line="'+i+'"><label>Material<input aria-label="Material '+(i+1)+'" class="remito-desc" maxlength="180" placeholder="Descripción del artículo" value="'+esc(l.descripcion||'')+'"></label><label>Cantidad<input aria-label="Cantidad '+(i+1)+'" class="remito-cant" type="number" inputmode="decimal" min="0.01" step="0.01" max="1000000" placeholder="Cantidad" value="'+esc(l.cantidad||'')+'"></label><label>Unidad<select class="remito-unit">'+remitoUnidades(l.unidad||"unidades")+'</select></label><button class="btn btn-soft remito-remove" type="button" data-drop="'+i+'" aria-label="Quitar renglón '+(i+1)+'">✕</button></div>').join(""):'<p class="mini">Agregá artículos manualmente o convertí la nota en renglones editables.</p>';
 document.querySelectorAll('[data-drop]').forEach(b=>b.onclick=()=>{capturarLineas();remitoLineas.splice(Number(b.dataset.drop),1);lineasHtml()});
}
function capturarLineas(){
 const rows=[...document.querySelectorAll('.remito-linea')];
 remitoLineas=rows.map(row=>({
  descripcion:row.querySelector('.remito-desc').value.trim(),
  cantidad:row.querySelector('.remito-cant').value.trim(),
  unidad:row.querySelector('.remito-unit').value
 }));
}
function parsearNota(texto){
 // Conserva las líneas dudosas sin inventar cantidades.
 return texto.split(/\n/).map(x=>x.trim()).filter(Boolean).filter(x=>!/^\s*(solicitante|destino|fecha|firma|responsable)\s*:/i.test(x)).slice(0,80).map(line=>{
  line=line.replace(/^[•\-*\s]+/,"").trim();
  let m=line.match(/^(\d+(?:[.,]\d+)?)\s*(?:x|×)?\s+(.+)$/i);
  if(m){let desc=m[2].trim(),unit="unidades";const pieces=desc.match(/^(cajas|paquetes|frascos|pomos|resmas|rollos|litros|kg|unidades)\s+(?:de\s+)?(.+)$/i);if(pieces){unit=pieces[1].toLocaleLowerCase("es-AR");desc=pieces[2].trim()}return{cantidad:m[1].replace(",","."),descripcion:desc,unidad:unit}}
  m=line.match(/^(.+?)\s*[-:—]\s*(\d+(?:[.,]\d+)?)\s*(\w+)?$/);
  if(m)return{descripcion:m[1].trim(),cantidad:m[2].replace(",","."),unidad:remitoOpts.includes((m[3]||"").toLowerCase())?m[3].toLowerCase():"unidades"};
  return{descripcion:line,cantidad:"",unidad:"unidades"};
 }).filter(l=>l.descripcion);
}
function interpretarNota(){
 const text=$('nota-remito').value.trim();if(!text){toast("Primero escribí o transcribí la nota");return}
 capturarLineas();if(remitoLineas.length&&!confirm("¿Reemplazar los renglones actuales por los extraídos de la nota?"))return;
 remitoLineas=parsearNota(text);lineasHtml();toast("Borrador extraído: revisá cada descripción y cantidad");
 $('remito-lineas')?.scrollIntoView({behavior:"smooth",block:"center"});
}
async function scriptOCR(){
 if(window.Tesseract)return window.Tesseract;
 await new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  script.onload=resolve;script.onerror=()=>reject(Error("No se pudo cargar el lector de imágenes. Escribí la nota manualmente."));
  document.head.appendChild(script);
 });
 if(!window.Tesseract)throw Error("El lector de fotos no está disponible");
 return window.Tesseract;
}
async function leerFotoRemito(){
 const file=remitoFotoNueva;if(!file){toast("Primero elegí una foto de la nota");return}
 const btn=$('remito-ocr');btn.disabled=true;btn.textContent="Leyendo la fotografía...";
 try{
  const t=await scriptOCR();
  const result=await t.recognize(file,"spa");
  const text=String(result.data?.text||"").trim();
  if(!text)throw Error("La fotografía no contiene texto que pueda leer.");
  const original=$('nota-remito').value.trim();
  $('nota-remito').value=original?(original+"\n\n"+text):text;
  $('ocr-status').textContent="Lectura completada. Revisá las palabras y tocá «Pasar a renglones».";
  toast("Texto extraído de la foto; revisalo antes de guardar.");
 }catch(e){$('ocr-status').textContent="No se pudo transcribir automáticamente: "+e.message+" La foto igualmente podrá adjuntarse al remito.";toast(e.message)}
 finally{btn.disabled=false;btn.textContent="Leer texto de la foto"}
}
function actualizarFotoRemito(){
 const estado=$('foto-estado'),quitar=$('quitar-foto-remito');
 if(!estado||!quitar)return;
 const adjunta=Boolean(remitoActual?.nota_foto_path)&&!remitoFotoEliminada;
 const nueva=Boolean(remitoFotoNueva);
 quitar.hidden=!(adjunta||nueva);
 if(nueva)estado.textContent="Foto seleccionada: "+remitoFotoNueva.name+" (se guardará al confirmar).";
 else if(adjunta){
  const url=remitoActual?.nota_foto_url;
  if(url){const a=document.createElement("a");a.className="remito-photo";a.href=url;a.target="_blank";a.rel="noopener";a.textContent="Ver fotografía original adjunta";estado.replaceChildren(a)}
  else estado.textContent="Fotografía adjunta al remito.";
 }else estado.textContent=remitoFotoEliminada?"Foto quitada. Guardá el remito para confirmar.":"Sin foto adjunta";
}
function abrirEditorRemito(data=null){
 remitoActual=data;remitoFoto=null;remitoFotoNueva=null;remitoFotoEliminada=false;
 remitoLineas=Array.isArray(data?.items)?data.items.map(x=>({...x})):[];
 const saved=data?'<span class="badge-note">'+esc(remitoNumero(data.numero))+'</span>':'<span class="badge-note">Nuevo · Borrador</span>';
 $('main-panel').innerHTML='<section class="paper remito-editor"><div class="row"><h2>Remito '+saved+'</h2><button id="remito-back" class="btn btn-soft" type="button">← Lista de remitos</button></div><p class="mini">Solicitante: persona que realiza el pedido. Responsable del retiro: quien se lleva físicamente los materiales; puede completarse después. Los préstamos quedan abiertos sin fecha de devolución.</p><form id="form-remito"><div class="field-grid"><label class="form-field">Nombre del solicitante *<input name="solicitante_nombre" required maxlength="100" value="'+esc(data?.solicitante_nombre||'')+'"></label><label class="form-field">Apellido del solicitante *<input name="solicitante_apellido" required maxlength="100" value="'+esc(data?.solicitante_apellido||'')+'"></label><label class="form-field full">Destino / ¿a qué lugar va? *<input name="destino" required maxlength="160" placeholder="Área, dependencia, institución..." value="'+esc(data?.destino||'')+'"></label><label class="form-field">Responsable del retiro <small>(se completa cuando retira)</small><input name="responsable_retiro" maxlength="120" placeholder="Pendiente" value="'+esc(data?.responsable_retiro||'')+'"></label><label class="form-field">Tipo de pedido<select name="tipo"><option value="entrega" '+(!data?.es_prestamo?"selected":"")+'>Entrega de materiales</option><option value="prestamo" '+(data?.es_prestamo?"selected":"")+'>Préstamo · devolución abierta</option></select></label></div><div class="remito-section"><h3>Nota del pedido</h3><p class="mini">Pegá aquí el mensaje recibido (WhatsApp, papel o texto). Conservarlo permite verificar el pedido original.</p><textarea id="nota-remito" maxlength="8000" rows="5" placeholder="Ejemplo: 5 cajas de curitas\n2 pelotas\n1 botiquín...">'+esc(data?.nota_original||'')+'</textarea><div class="remito-actions"><button id="interpretar-nota" class="btn btn-soft" type="button">Pasar texto a renglones</button></div><label class="form-field full" style="margin-top:15px">Fotografía de la nota / pedido<input id="foto-remito" type="file" accept="image/*"></label><div id="foto-estado" class="mini"></div><div class="remito-actions"><button id="quitar-foto-remito" class="btn btn-red" type="button" hidden>Quitar foto</button><button id="remito-ocr" class="btn btn-soft" type="button">Leer texto de la foto</button></div><p id="ocr-status" class="mini">La lectura de fotos utiliza reconocimiento de texto y requiere conexión. Siempre revisá las cantidades.</p></div><div class="remito-section"><div class="row"><h3>Detalle de materiales</h3><button id="remito-add" class="btn btn-soft" type="button">+ Agregar renglón</button></div><div id="remito-lineas"></div></div><div class="remito-section"><p class="mini">Solo los remitos marcados como «Preparado» se publican en MONITOR GLORIETA. Guardá el documento antes de compartir.</p><label class="form-field">Estado<select name="estado"><option value="borrador" '+(data?.estado!=="preparado"?"selected":"")+'>Borrador · pendiente de revisión</option><option value="preparado" '+(data?.estado==="preparado"?"selected":"")+'>Preparado · listo para compartir</option></select></label></div><div class="form-actions"><button class="btn btn-green" id="guardar-remito" type="submit">Guardar remito</button><button class="btn btn-soft" type="button" id="cancelar-remito">Cancelar</button></div></form>'+(data && data.estado==="preparado"?'<div class="remito-section"><h3>Compartir remito</h3><p class="mini">El enlace permite consultar el remito sin editar. Compartilo solamente con sus destinatarios.</p><div class="remito-actions"><button class="btn btn-soft" type="button" id="enlace-remito">Copiar enlace</button><button class="btn btn-soft" type="button" id="whatsapp-remito">WhatsApp</button><button class="btn btn-soft" type="button" id="pdf-remito">Ver / Guardar PDF</button></div></div>':'')+'</section>';
 $('remito-back').onclick=()=>showRemitos();$('cancelar-remito').onclick=()=>showRemitos();
 $('interpretar-nota').onclick=interpretarNota;
 $('remito-add').onclick=()=>{capturarLineas();remitoLineas.push({descripcion:"",cantidad:"",unidad:"unidades"});lineasHtml();const all=document.querySelectorAll(".remito-desc");all[all.length-1]?.focus()};
 $('foto-remito').onchange=e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){toast("Elegí una fotografía válida");return}remitoFotoNueva=file;remitoFotoEliminada=false;actualizarFotoRemito()};
 $('quitar-foto-remito').onclick=()=>{remitoFotoNueva=null;remitoFotoEliminada=true;$('foto-remito').value="";actualizarFotoRemito();toast("Foto quitada del remito. Guardá para confirmar el cambio.")};
 actualizarFotoRemito();
 $('remito-ocr').onclick=leerFotoRemito;
 $('form-remito').onsubmit=guardarRemito;
 lineasHtml();
 if(data && data.estado==="preparado"){
  $('enlace-remito').onclick=async()=>{const url=remitoLink(data.id);try{await navigator.clipboard.writeText(url);toast("Enlace copiado")}catch{prompt("Copiá el enlace",url)}};
  $('whatsapp-remito').onclick=()=>window.open("https://wa.me/?text="+encodeURIComponent("Remito GLORIETA "+remitoNumero(data.numero)+"\n"+remitoLink(data.id)),"_blank","noopener");
  $('pdf-remito').onclick=()=>window.open(remitoLink(data.id),"_blank","noopener");
 }
}
async function guardarRemito(e){
 e.preventDefault();if(remitoBusy)return;
 capturarLineas();
 const form=new FormData(e.currentTarget);
 const draft=remitoLineas.filter(x=>x.descripcion||x.cantidad);
 const noQty=draft.some(x=>!x.descripcion||!Number.isFinite(Number(x.cantidad))||Number(x.cantidad)<=0);
 if(noQty){toast("Revisá las cantidades y descripciones de los renglones");return}
 if(!form.get("solicitante_nombre")||!form.get("solicitante_apellido")||!form.get("destino")){toast("Completá los datos del solicitante y destino");return}
 // Se permite guardar un borrador aunque se quite su única foto por error.
 remitoBusy=true;const btn=$('guardar-remito');btn.disabled=true;btn.textContent="Guardando...";
 try{
  let photo=remitoFotoEliminada?null:(remitoActual?.nota_foto_path||null);
  if(remitoFotoNueva){
   const data=await compress(remitoFotoNueva);if(data.length>1350000)throw Error("Foto demasiado grande; probá con otra.");
   const upload=await api("upload_photo",{data});photo=upload.path;
  }
  const obj={id:remitoActual?.id||null,expected_updated_at:remitoActual?.updated_at||null,
   solicitante_nombre:String(form.get("solicitante_nombre")||"").trim(),
   solicitante_apellido:String(form.get("solicitante_apellido")||"").trim(),
   destino:String(form.get("destino")||"").trim(),
   responsable_retiro:String(form.get("responsable_retiro")||"").trim(),
   es_prestamo:form.get("tipo")==="prestamo",
   estado:String(form.get("estado")||"borrador"),nota_original:$('nota-remito').value.trim(),
   texto_transcripto:$('nota-remito').value.trim(),nota_foto_path:photo,
   items:draft.map(x=>({descripcion:x.descripcion,cantidad:Number(x.cantidad),unidad:x.unidad})),
   operator};
  const result=await api("remito_save",{remito:obj});
  const saved=result.remito;remitoActual=saved;
  if(photo){
   const loaded=await api("remito_get",{id:saved.id});
   remitoActual=loaded.remito;
  }
  abrirEditorRemito(remitoActual);toast("Remito "+remitoNumero(saved.numero)+" guardado. Ya podés compartirlo.");
 }catch(e){toast("No se pudo guardar: "+e.message);btn.disabled=false;btn.textContent="Guardar remito"}
 finally{remitoBusy=false}
}
