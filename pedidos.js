/* GLORIETA | Bandeja de pedidos del Monitor. Acceso sólo mediante API de administración. */
let pedidoActual=null,pedidoLineas=[],pedidoBusy=false,pedidosCache=[];
const pedidoNumero=n=>"PED-"+String(n).padStart(5,"0");
function pedidosLabel(p){return p.estado==="entregado"?"Entregado":p.estado==="cancelado"?"Cancelado":"Pendiente"}
async function showPedidos(){
 if(view!=="pedidos")return;
 $('main-panel').innerHTML='<section class="paper"><div class="row"><h2>🛒 Pedidos del Monitor</h2><button class="btn btn-soft" id="pedidos-reload" type="button">↻ Actualizar</button></div><p class="mini">Revisá los pedidos, editá cantidades, agregá o quitá materiales y confirmá la entrega solo al finalizar. Enviar un carrito no descuenta stock.</p><div id="pedidos-results">Cargando pedidos…</div></section>';
 $('pedidos-reload').onclick=showPedidos;
 try{
  const r=await api("pedidos_list");if(view!=="pedidos"||!$('pedidos-results'))return;
  pedidosCache=r.pedidos||[];
  $('pedidos-results').innerHTML=pedidosCache.length?'<div class="remitos-list">'+pedidosCache.map(p=>'<button class="remito-record" type="button" data-pedido="'+esc(p.id)+'"><span><b>'+esc(pedidoNumero(p.numero))+'</b> · '+esc(p.solicitante_nombre+' '+p.solicitante_apellido)+'<small>Para: '+esc(p.para_quien)+' · Destino: '+esc(p.destino)+' · '+(p.items||[]).length+' materiales</small></span><span class="remito-tag">'+esc(pedidosLabel(p))+' →</span></button>').join('')+'</div>':'<div class="empty">Todavía no llegaron pedidos del Monitor.</div>';
  document.querySelectorAll('[data-pedido]').forEach(b=>b.onclick=()=>abrirPedido(b.dataset.pedido));
 }catch(e){if($('pedidos-results'))$('pedidos-results').textContent="No se pudieron cargar pedidos: "+e.message}
}
async function abrirPedido(id){
 if(view!=="pedidos")return;status("Abriendo pedido…");
 try{const d=await api("pedido_get",{id});if(view!=="pedidos")return;dibujarPedido(d.pedido)}
 catch(e){toast(e.message);showPedidos()}
}
function recogerPedidoLineas(){
 pedidoLineas=[...document.querySelectorAll(".pedido-linea")].map(el=>({
  product_id:el.querySelector(".pedido-producto").value,
  cantidad:Number(el.querySelector(".pedido-qty").value)
 }));
}
function pintarPedidoLineas(){
 const root=$('pedido-items');if(!root)return;
 root.innerHTML=pedidoLineas.length?pedidoLineas.map((line,i)=>
 '<div class="remito-linea pedido-linea" data-i="'+i+'"><label>Material<select class="pedido-producto">'+
 items.map(p=>'<option value="'+esc(p.id)+'" '+(line.product_id===p.id?'selected':'')+'>'+esc(p.name)+' · '+fmt(p.quantity)+' '+esc(p.unit)+' disponibles</option>').join('')+
 '</select></label><label>Cantidad<input class="pedido-qty" type="number" min="0.01" max="1000000" step=".01" required value="'+esc(line.cantidad)+'"></label><button type="button" class="btn btn-red" data-pedido-remove="'+i+'">Quitar</button></div>').join(''):'<p class="mini">Este pedido quedó sin materiales. Agregá uno para guardarlo.</p>';
 root.querySelectorAll('[data-pedido-remove]').forEach(b=>b.onclick=()=>{recogerPedidoLineas();pedidoLineas.splice(Number(b.dataset.pedidoRemove),1);pintarPedidoLineas();marcarPedidoCambios()});
 root.querySelectorAll('input,select').forEach(x=>x.addEventListener('change',marcarPedidoCambios));
}
function marcarPedidoCambios(){if($('pedido-entregar')){$('pedido-entregar').disabled=true;$('pedido-nota-edicion').textContent="Hay cambios sin guardar. Guardá primero para confirmar la entrega."}}
function dibujarPedido(p){
 pedidoActual=p;pedidoLineas=(p.items||[]).map(row=>({product_id:row.product_id,cantidad:row.cantidad}));
 const pending=p.estado==="pendiente",r=p.remito_id;
 $('main-panel').innerHTML='<section class="paper"><div class="row"><h2>Pedido '+esc(pedidoNumero(p.numero))+'</h2><button id="pedido-back" class="btn btn-soft" type="button">← Volver a pedidos</button></div><p class="mini">Estado: '+esc(pedidosLabel(p))+' · '+new Date(p.created_at).toLocaleString("es-AR")+'</p><form id="pedido-form"><div class="field-grid">'+
 '<label class="form-field">Nombre solicitante<input name="solicitante_nombre" maxlength="100" required value="'+esc(p.solicitante_nombre)+'" '+(!pending?'disabled':'')+'></label>'+
 '<label class="form-field">Apellido solicitante<input name="solicitante_apellido" maxlength="100" required value="'+esc(p.solicitante_apellido)+'" '+(!pending?'disabled':'')+'></label>'+
 '<label class="form-field">¿Para quién / qué sector? *<input name="para_quien" maxlength="160" required value="'+esc(p.para_quien)+'" '+(!pending?'disabled':'')+'></label>'+
 '<label class="form-field">Destino *<input name="destino" maxlength="160" required value="'+esc(p.destino)+'" '+(!pending?'disabled':'')+'></label>'+
 '<label class="form-field">Responsable del retiro<input name="responsable_retiro" maxlength="120" value="'+esc(p.responsable_retiro||'')+'" '+(!pending?'disabled':'')+' placeholder="Persona que recibe físicamente"></label>'+
 '<label class="form-field">Tipo<select name="tipo" '+(!pending?'disabled':'')+'><option value="entrega" '+(!p.es_prestamo?'selected':'')+'>Entrega</option><option value="prestamo" '+(p.es_prestamo?'selected':'')+'>Préstamo</option></select></label>'+
 '<label class="form-field full">Observaciones<textarea name="observaciones" maxlength="800" rows="2" '+(!pending?'disabled':'')+'>'+esc(p.observaciones||'')+'</textarea></label></div>'+
 '<div class="remito-section"><div class="row"><h3>Materiales del carrito físico</h3>'+(pending?'<button id="pedido-add" type="button" class="btn btn-soft">+ Agregar material</button>':'')+'</div><div id="pedido-items"></div></div>'+
 '<div class="form-actions">'+(pending?'<button id="pedido-save" class="btn btn-green" type="submit">Guardar cambios</button><button id="pedido-entregar" class="btn btn-soft" type="button">✓ Confirmar entrega y descontar stock</button><button id="pedido-cancelar" class="btn btn-red" type="button">Cancelar pedido</button>':'')+
 (r?'<button class="btn btn-soft" id="pedido-remito" type="button">Ver remito generado</button>':'')+'</div><p class="mini" id="pedido-nota-edicion">'+(pending?"El stock se descuenta únicamente al confirmar la entrega. Revisá las cantidades reales.":"Pedido cerrado. No puede volver a descontarse.")+'</p></form></section>';
 $('pedido-back').onclick=showPedidos;
 if(!pending){
  $('pedido-items').innerHTML=(p.items||[]).map(row=>'<div class="movement"><b>'+esc(row.nombre)+' · '+fmt(row.cantidad)+' '+esc(row.unidad)+'</b></div>').join('');
  if(r)$('pedido-remito').onclick=()=>window.open("remito.html?id="+encodeURIComponent(r),"_blank","noopener");
  return;
 }
 pintarPedidoLineas();
 $('pedido-form').querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('input',marcarPedidoCambios));
 $('pedido-add').onclick=()=>{recogerPedidoLineas();const available=items.filter(x=>!pedidoLineas.some(row=>row.product_id===x.id));if(!available.length){toast("No quedan materiales para agregar");return}pedidoLineas.push({product_id:available[0].id,cantidad:1});pintarPedidoLineas();marcarPedidoCambios()};
 $('pedido-form').onsubmit=async e=>{
  e.preventDefault();if(pedidoBusy)return;recogerPedidoLineas();
  if(!pedidoLineas.length){toast("Agregá al menos un material");return}
  if(new Set(pedidoLineas.map(x=>x.product_id)).size!==pedidoLineas.length){toast("Hay artículos repetidos en el pedido");return}
  const fd=new FormData(e.target);
  const draft={id:p.id,expected_updated_at:p.updated_at,operator,
   solicitante_nombre:fd.get("solicitante_nombre"),solicitante_apellido:fd.get("solicitante_apellido"),
   para_quien:fd.get("para_quien"),destino:fd.get("destino"),responsable_retiro:fd.get("responsable_retiro"),
   es_prestamo:fd.get("tipo")==="prestamo",observaciones:fd.get("observaciones"),items:pedidoLineas};
  pedidoBusy=true;$('pedido-save').disabled=true;
  try{const result=await api("pedido_save",{pedido:draft});dibujarPedido(result.pedido);toast("Pedido actualizado. Todavía no se descontó stock.")}
  catch(err){toast("No se pudo guardar: "+err.message);$('pedido-save').disabled=false}
  finally{pedidoBusy=false}
 };
 $('pedido-cancelar').onclick=async()=>{if(pedidoBusy)return;if(!confirm("¿Cancelar este pedido? No se descontará ningún artículo."))return;pedidoBusy=true;try{const res=await api("pedido_cancel",{pedido:{id:p.id,expected_updated_at:p.updated_at,operator}});dibujarPedido(res.pedido);toast("Pedido cancelado")}catch(e){toast(e.message)}finally{pedidoBusy=false}};
 $('pedido-entregar').onclick=async()=>{
  if(pedidoBusy)return;
  if(!confirm("¿Ya preparaste y entregaste físicamente los materiales? Se descontará el stock y se generará el remito. Esta operación no se puede repetir."))return;
  pedidoBusy=true;$('pedido-entregar').disabled=true;
  try{const fd=new FormData($('pedido-form'));const res=await api("pedido_entregar",{id:p.id,operator,responsable_retiro:fd.get("responsable_retiro")||null});
   toast("Entrega confirmada: stock descontado y remito generado");
   await abrirPedido(p.id);
   if(res.remito_id)window.open("remito.html?id="+encodeURIComponent(res.remito_id),"_blank","noopener");
  }catch(e){toast("No se pudo entregar: "+e.message);$('pedido-entregar')?.removeAttribute('disabled')}
  finally{pedidoBusy=false}
 };
}
