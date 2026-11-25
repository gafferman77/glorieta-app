/* GLORIETA — Inventario compartido V1.
 * Los datos se guardan exclusivamente en Supabase, nunca en localStorage.
 * El código compartido se recuerda solo en esta pestaña (sessionStorage).
 */
const API='https://czvchpltqyjqyopiiinl.supabase.co/functions/v1/glorieta-api';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let items=[],movements=[],view='inventory',query='',selected=null,editing=null,imageData='',imageIsNew=false;
let access=sessionStorage.getItem('glorieta_access')||'',operator=sessionStorage.getItem('glorieta_operator')||'';
let busy=false;
const fmt=(n)=>Number(n).toLocaleString('es-AR',{maximumFractionDigits:2});
const pic=p=>p.photo_url?'<img src="'+esc(p.photo_url)+'" alt="Foto de '+esc(p.name)+'">':'<span>📦</span>';
const expiring=p=>p.expiration_date&&(new Date(p.expiration_date+'T12:00:00').getTime()-Date.now())/86400000 < 60;
function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(window._timer);window._timer=setTimeout(()=>t.classList.remove('show'),5000)}
function status(s){$('main-panel').innerHTML='<section class="paper"><h2>✳ Glorieta</h2><p>'+esc(s)+'</p></section>'}
async function api(action,rest={}){
 const response=await fetch(API,{method:'POST',mode:'cors',headers:{'Content-Type':'application/json','x-glorieta-key':access},body:JSON.stringify({action,...rest})});
 let result;try{result=await response.json()}catch{throw Error('El servidor no devolvió una respuesta válida')}
 if(!response.ok)throw Error(result.error||'Error del servidor ('+response.status+')');
 return result;
}
function login(){
 document.querySelectorAll('.tile').forEach(b=>b.classList.remove('active'));
 $('main-panel').innerHTML='<section class="paper"><h2>🔑 Ingreso de equipo</h2><p>Acceso a la base compartida para los dos encargados de GLORIETA. Sin cuenta ni contraseña personal.</p><form id="access-form" class="field-grid"><label class="form-field full">Nombre de quien está trabajando<input name="operator" required maxlength="100" placeholder="Nombre o apodo" value="'+esc(operator)+'"></label><label class="form-field full">Código privado del equipo<input name="access" required type="password" autocomplete="off" placeholder="Código de Glorieta"></label><div class="form-actions"><button class="btn btn-green" id="enter" type="submit">Entrar a Glorieta →</button></div></form><p class="mini">El código no se publica en GitHub y no se guarda como contraseña permanente en el dispositivo.</p></section>';
 $('access-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const f=new FormData(e.target);const previous=access;operator=String(f.get('operator')||'').trim();access=String(f.get('access')||'').trim();if(!operator||!access)return;busy=true;$('enter').disabled=true;$('enter').textContent='Conectando...';try{const data=await api('list');items=data.products||[];sessionStorage.setItem('glorieta_access',access);sessionStorage.setItem('glorieta_operator',operator);view='inventory';render();toast('Conectado a la base compartida')}catch(err){access=previous;toast(err.message);$('enter').disabled=false;$('enter').textContent='Entrar a Glorieta →'}finally{busy=false}};
}
async function refresh(){
 if(!access){login();return}
 try{const d=await api('list');items=d.products||[];render()}catch(e){if(/401|código de acceso|incorrecto/i.test(e.message)){sessionStorage.removeItem('glorieta_access');access='';login()}else{status('Error de conexión: '+e.message);toast(e.message)}}
}
function nav(v){if(!access){login();return}view=v;query='';selected=null;editing=null;render()}
document.querySelectorAll('.tile').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.view)));
$('date-text').textContent=new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
function filtered(){return items.filter(p=>[p.name,p.code,p.location,p.color,p.unit].some(v=>String(v||'').toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))))}
function list(prods){return prods.length?'<div class="products">'+prods.map(p=>'<button class="product" data-id="'+esc(p.id)+'"><span class="pic">'+pic(p)+'</span><span class="info"><b>'+esc(p.name)+'</b><small>'+esc(p.code)+' · '+esc(p.location||'Sin ubicación')+'</small><span class="qty '+(Number(p.quantity)<=3?'warning':'')+'">'+fmt(p.quantity)+' '+esc(p.unit)+'</span>'+(expiring(p)?'<span class="qty danger">⚠ Vencimiento próximo</span>':'')+'</span></button>').join('')+'</div>':'<div class="empty">No hay productos con ese nombre. Si es la primera carga, comenzá con «Nuevo».</div>'}
function attach(){document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{selected=b.dataset.id;view='detail';render()})}
function render(){
 document.querySelectorAll('.tile').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 if(view==='inventory'){
  $('main-panel').innerHTML='<section class="paper"><div class="row"><h2>📦 Inventario real</h2><span class="badge-note">'+items.length+' artículos en la nube</span></div><p class="mini">Base compartida · Operador: '+esc(operator)+'</p><div class="search-wrap"><input id="q" placeholder="🔎 Buscar artículos, colores, códigos..." value="'+esc(query)+'"><button class="btn btn-green" id="new">+ Nuevo</button><button class="btn btn-soft" id="sync" type="button">↻ Actualizar</button><button class="btn btn-soft" id="archived-link" type="button">🗑 Eliminados</button></div><div id="results">'+list(filtered())+'</div><p class="mini">La lista se consulta al entrar y al guardar. Tocá «Actualizar» para ver cambios del otro celular.</p></section>';
  $('q').oninput=e=>{query=e.target.value;$('results').innerHTML=list(filtered());attach()};
  $('new').onclick=()=>nav('add');$('sync').onclick=()=>refresh();$('archived-link').onclick=()=>{view='archived';render()};attach();return;
 }
 if(view==='archived'){showArchived();return}
 if(view==='add'){form();return}
 if(view==='detail'){detail();return}
 if(view==='moves'){loadHistory();return}
 if(view==='pedidos'){showPedidos();return}
 if(view==='remitos'){showRemitos();return}
 $('main-panel').innerHTML='<section class="paper"><h2>✳ Acerca de Glorieta</h2><p>Inventario real compartido de PARQUE. Base central en Supabase y fotografías privadas.</p><p>Sesión actual: <b>'+esc(operator)+'</b></p><p class="mini">El código es compartido por dos encargados, y el nombre se declara manualmente. No equivale a una identificación individual verificada.</p><button class="btn btn-red" id="logout">Cerrar acceso de este dispositivo</button></section>';
 $('logout').onclick=()=>{sessionStorage.removeItem('glorieta_access');sessionStorage.removeItem('glorieta_operator');access='';operator='';items=[];login()};
}
async function compress(file){return new Promise((resolve,reject)=>{const r=new FileReader;r.onerror=reject;r.onload=()=>{const im=new Image;im.onerror=reject;im.onload=()=>{const scale=Math.min(1,900/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.7))};im.src=r.result};r.readAsDataURL(file)})}
function normalizedArticleName(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean)
  .map(w=>w.length>4&&w.endsWith('es')?w.slice(0,-2):w.length>3&&w.endsWith('s')?w.slice(0,-1):w)
  .sort().join(' ');
}
function existingNameMatches(name){
 const norm=normalizedArticleName(name);
 if(!norm)return [];
 const tokens=new Set(norm.split(' '));
 return items.filter(p=>{
  const old=normalizedArticleName(p.name);
  if(!old)return false;
  if(old===norm)return true;
  const other=new Set(old.split(' '));
  const overlap=[...tokens].filter(x=>other.has(x)).length;
  return overlap>=2&&overlap/Math.max(tokens.size,other.size)>=.8;
 }).slice(0,3);
}
async function reviewPhotoForDuplicates(photo){
 if(editing||!window.GlorietaVisual)return;
 let panel=$('visual-review');
 if(!panel)return;
 panel.textContent='🔎 Buscando fotos parecidas en el inventario…';
 try{
  const matches=await window.GlorietaVisual.find(photo,items,null);
  if($('visual-review')!==panel||imageData!==photo)return;
  if(!matches.length){panel.textContent='✓ No encontré coincidencias visuales claras. Podés continuar con la carga.';return}
  panel.innerHTML='<strong>¿Este artículo ya está cargado?</strong><p class="mini">Encontré fotografías similares. Revisá antes de crear otra ficha.</p>'+
   matches.map((m,i)=>'<div class="row" style="border-top:1px solid #43545c;padding:10px 0;gap:12px"><div class="row" style="justify-content:flex-start;flex:1;min-width:170px"><div class="pic" style="width:58px;height:58px">'+pic(m.product)+'</div><div><b>'+esc(m.product.name)+'</b><small style="display:block">'+esc(m.product.category)+' · '+fmt(m.product.quantity)+' '+esc(m.product.unit)+'</small></div></div><button class="btn btn-green" type="button" data-match="'+i+'">Ya existe: abrir ficha</button></div>').join('')+
   '<button class="btn btn-soft" id="different-product" type="button">Es otro artículo: continuar</button>';
  panel.querySelectorAll('[data-match]').forEach(b=>b.onclick=()=>{const match=matches[Number(b.dataset.match)];if(!match)return;selected=match.product.id;view='detail';editing=null;render();toast('Artículo existente: podés registrar una entrada en su ficha.')});
  panel.querySelector('#different-product').onclick=()=>{panel.innerHTML='<p class="mini">Entendido. Continuá con el nuevo artículo.</p>'};
 }catch(e){if($('visual-review')===panel)panel.textContent='No pude comparar esta foto. Podés continuar cargando normalmente.'}
}
function form(){const p=editing?items.find(x=>x.id===editing):null;imageData=p?.photo_url||'';imageIsNew=false;
 $('main-panel').innerHTML='<section class="paper"><h2>'+(p?'✎ Editar artículo':'✚ Cargar artículo')+'</h2><p class="mini">Los datos se guardarán en la base compartida. Podés editar cualquier dato, incluida la categoría. Si cambiás la cantidad, explicá el motivo: quedará registrado en Movimientos.</p><form id="product-form"><div class="field-grid"><label class="form-field full">Fotografía<div class="preview" id="preview">'+(imageData?'<img src="'+esc(imageData)+'" alt="Vista previa">':'<span>📷 Tocá para elegir fotografía</span>')+'</div><input type="file" id="photo" accept="image/*"></label><div id="visual-review" class="form-field full" role="status" aria-live="polite" style="margin-top:10px"></div><label class="form-field">¿Qué es? *<input name="name" maxlength="100" required value="'+esc(p?.name||'')+'" placeholder="Gasas"></label><label class="form-field">Código de artículo *<input name="code" maxlength="40" required value="'+esc(p?.code||'GLO-'+Date.now().toString().slice(-7))+'"></label>'+
 '<label class="form-field">'+(p?'Cantidad disponible (corregir error de carga)':'Cantidad inicial')+' *<input type="number" name="quantity" required min="0" max="1000000" step="0.01" value="'+(p?Number(p.quantity):0)+'"></label>'+ (p?'<label class="form-field full">Motivo de corrección (solo si modificás la cantidad)<input name="correction_reason" maxlength="200" placeholder="Ej.: error en carga inicial"></label>':'')+
 '<label class="form-field">Categoría *<select name="category">'+['Deportes','Farmacia','Librería','Taller','Juegos','Varios'].map(x=>'<option value="'+esc(x)+'" '+((p?.category||'Varios')===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>'+
 '<label class="form-field">Unidad *<select name="unit">'+['unidades','pares','cajas','paquetes','frascos','pomos','resmas','rollos','litros','kg','otros'].map(x=>'<option '+(p?.unit===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label class="form-field">Color / variante<input name="color" maxlength="80" value="'+esc(p?.color||'')+'" placeholder="Rojo, blanco, varios"></label><label class="form-field">Presentación<input name="package_size" maxlength="80" value="'+esc(p?.package_size||'')+'" placeholder="250 ml / 100 g"></label><label class="form-field">Fecha de vencimiento<input type="date" name="expiration_date" value="'+esc(p?.expiration_date||'')+'"></label><label class="form-field">Ubicación<input name="location" maxlength="120" value="'+esc(p?.location||'')+'"></label><label class="form-field full">Observaciones<textarea name="notes" rows="2" maxlength="500">'+esc(p?.notes||'')+'</textarea></label></div><div class="form-actions"><button type="submit" class="btn btn-green" id="submit-product">💾 Guardar en la nube</button><button type="button" class="btn btn-soft" id="cancel">Cancelar</button></div></form></section>';
 $('preview').onclick=()=>$('photo').click();$('cancel').onclick=()=>nav('inventory');
 $('photo').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){toast('Elegí una imagen');return}try{imageData=await compress(file);imageIsNew=true;if(imageData.length>1350000)throw Error('La foto es demasiado grande');$('preview').innerHTML='<img src="'+esc(imageData)+'" alt="Vista previa">';if(!p)reviewPhotoForDuplicates(imageData)}catch(err){imageIsNew=false;toast(err.message||'No se pudo procesar la foto')}};
 $('product-form').onsubmit=async e=>{e.preventDefault();if(busy)return;const fd=new FormData(e.target),p2=Object.fromEntries(fd.entries());p2.operator=operator;if(p)p2.id=p.id;p2.quantity=Number(p2.quantity);if(p)p2.expected_quantity=Number(p.quantity);if(!p){
 const existing=existingNameMatches(p2.name);
 if(existing.length){
  const names=existing.map(x=>x.name+' ('+x.category+', stock '+fmt(x.quantity)+' '+x.unit+')').join('\\n');
  if(!window.confirm('ATENCIÓN: este artículo podría estar cargado.\\n\\n'+names+'\\n\\nCancelá para revisar la ficha existente. Aceptá SOLO si verificaste que es un artículo diferente.'))return;
 }
}
if(p && p2.quantity!==Number(p.quantity) && String(p2.correction_reason||'').trim().length<3){toast('Para cambiar la cantidad, escribí el motivo de corrección (mínimo 3 caracteres). Si solo editás la categoría u otros datos, dejá la cantidad original.');const motivo=e.target.elements.namedItem('correction_reason');motivo?.focus();return}busy=true;$('submit-product').disabled=true;$('submit-product').textContent='Guardando...';try{
  if(imageIsNew){const uploaded=await api('upload_photo',{data:imageData});p2.photo_path=uploaded.path}
  await api(p?'update':'create',{product:p2});const d=await api('list');items=d.products||[];selected=items.find(x=>x.code===p2.code)?.id||null;view=selected?'detail':'inventory';toast('Artículo guardado y compartido');render()
 }catch(err){toast('No se pudo guardar: '+err.message);$('submit-product').disabled=false;$('submit-product').textContent='💾 Guardar en la nube'}finally{busy=false}};
}
function detail(){const p=items.find(x=>x.id===selected);if(!p){nav('inventory');return}
 $('main-panel').innerHTML='<section class="paper"><div class="row"><h2>📋 Ficha de artículo</h2><button class="btn btn-soft" id="back">← Volver</button></div><div class="detail-header"><div class="bigpic">'+pic(p)+'</div><div><h3>'+esc(p.name)+'</h3><span class="badge-note">'+esc(p.code)+'</span><p><span class="qty">'+fmt(p.quantity)+' '+esc(p.unit)+'</span></p></div></div><div class="fields-list">'+[['Categoría',p.category],['Color / variante',p.color],['Presentación',p.package_size],['Vencimiento',p.expiration_date||'No aplica'],['Ubicación',p.location],['Observaciones',p.notes]].map(([k,v])=>'<div><small>'+k+'</small><b>'+esc(v||'—')+'</b></div>').join('')+'</div><div class="stock-note"><b>📦 Registrar movimiento</b><p class="mini">Las entradas y salidas quedan registradas en la nube.</p><div class="adjust"><select id="kind"><option value="entrada">Entrada (+)</option><option value="salida">Salida (−)</option></select><input id="amount" type="number" min="0.01" max="1000000" step="0.01" placeholder="Cantidad"><button class="btn" id="move">Registrar</button></div><label class="form-field" style="margin-top:9px">Motivo<input id="reason" maxlength="200" placeholder="Entrega o reposición"></label></div><div class="form-actions"><button class="btn btn-green" id="edit">✎ Editar ficha / corregir stock</button><button class="btn btn-soft" id="refresh-detail">↻ Actualizar stock</button><button class="btn btn-red" id="archive-product">🗑 Eliminar artículo</button></div></section>';
 $('back').onclick=()=>nav('inventory');$('edit').onclick=()=>{editing=p.id;view='add';render()};
 $('refresh-detail').onclick=async()=>{await refresh();selected=p.id;view='detail';render()};
 $('archive-product').onclick=async()=>{
  if(busy)return;
  const confirmFirst=window.confirm('¿Eliminar «'+p.name+'» ('+p.code+') del inventario y el Monitor?\\n\\nEsta ficha tiene '+fmt(p.quantity)+' '+p.unit+'. Las cantidades NO se sumarán a otro artículo. Podrás recuperarla desde «Eliminados».');
  if(!confirmFirst)return;
  const confirmLast=window.prompt('Para confirmar, escribí ELIMINAR. Se conservará una copia recuperable de la ficha.');
  if(confirmLast!=='ELIMINAR'){toast('Eliminación cancelada');return}
  busy=true;$('archive-product').disabled=true;
  try{await api('archive',{id:p.id,operator});const d=await api('list');items=d.products||[];selected=null;view='inventory';render();toast('Artículo eliminado de la lista. Se puede recuperar desde Eliminados.')}
  catch(e){toast('No se pudo eliminar: '+e.message);$('archive-product').disabled=false}
  finally{busy=false}
 };
 $('move').onclick=async()=>{if(busy)return;const n=Number($('amount').value),kind=$('kind').value;if(!Number.isFinite(n)||n<=0||n>1000000){toast('Ingresá una cantidad válida');return}if(kind==='salida'&&n>Number(p.quantity)){toast('Stock insuficiente según esta pantalla; actualizá los datos');return}busy=true;$('move').disabled=true;try{await api('move',{id:p.id,kind,amount:n,operator,note:$('reason').value});const d=await api('list');items=d.products||[];toast('Movimiento guardado para ambos dispositivos');render()}catch(e){toast(e.message);$('move').disabled=false}finally{busy=false}};
}
async function showArchived(){
 status('Cargando artículos eliminados...');
 try{
  const d=await api('archived_list');if(view!=='archived')return;
  const rows=d.products||[];
  $('main-panel').innerHTML='<section class="paper"><div class="row"><h2>🗑 Artículos eliminados</h2><button id="archived-back" class="btn btn-soft">← Inventario</button></div><p class="mini">Estas fichas están ocultas del inventario y del Monitor, pero podés recuperarlas. No se borró su historial.</p>'+
   (rows.length?rows.map(p=>'<div class="movement"><div><b>'+esc(p.name)+'</b><small>'+esc(p.code)+' · '+esc(p.category)+' · '+fmt(p.quantity)+' '+esc(p.unit)+' · Eliminado por '+esc(p.archived_by||'—')+'</small></div><button type="button" class="btn btn-green" data-restore="'+esc(p.id)+'">Recuperar</button></div>').join(''):'<div class="empty">No hay artículos eliminados.</div>')+'</section>';
  $('archived-back').onclick=()=>nav('inventory');
  document.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{if(busy)return;const entry=rows.find(p=>p.id===b.dataset.restore);if(!entry)return;if(!window.confirm('¿Recuperar «'+entry.name+'» y volver a mostrarlo en el inventario y el Monitor?'))return;busy=true;b.disabled=true;try{await api('restore',{id:entry.id,operator});const data=await api('list');items=data.products||[];toast('Artículo recuperado');showArchived()}catch(e){toast(e.message);b.disabled=false}finally{busy=false}});
 }catch(e){status('No se pudo abrir Eliminados: '+e.message)}
}
async function loadHistory(){status('Consultando movimientos compartidos...');try{const d=await api('history');movements=d.history||[];if(view!=='moves')return;$('main-panel').innerHTML='<section class="paper"><div class="row"><h2>⇆ Movimientos reales</h2><button class="btn btn-soft" id="reload">↻ Actualizar</button></div><p class="mini">Historial de ambos encargados. Máximo 300 movimientos recientes.</p>'+(movements.length?movements.map(h=>'<div class="movement"><div><b>'+esc(h.product_name)+'</b><small>'+esc(h.operator_name)+' · '+esc(h.kind)+' · '+esc(h.note||'')+' · '+new Date(h.created_at).toLocaleString('es-AR')+'</small></div><b>'+(Number(h.delta)>0?'+':'')+fmt(h.delta)+'</b></div>').join(''):'<div class="empty">Todavía no hay movimientos.</div>')+'</section>';$('reload').onclick=loadHistory}catch(err){status('No se pudo consultar el historial: '+err.message)}}
if(access)refresh();else login();
