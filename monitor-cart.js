/* MONITOR GLORIETA | Carrito de pedidos. No descuenta inventario. */
(()=>{
const ENDPOINT="https://czvchpltqyjqyopiiinl.supabase.co/functions/v1/glorieta-pedido";
const cart=new Map();
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number(n).toLocaleString("es-AR",{maximumFractionDigits:2});
let sending=false;
function currentProducts(){return typeof all!=="undefined"?all:[]}
function add(code){
 const p=currentProducts().find(x=>x.code===code);
 if(!p){alert("El material no está disponible. Actualizá la lista.");return}
 if(Number(p.quantity)<=0){alert("Este artículo está sin stock");return}
 const prev=cart.get(code)||0;
 if(prev+1>Number(p.quantity)){alert("No hay más unidades disponibles");return}
 cart.set(code,prev+1);badge();
 const note=$("cart-notice");if(note){note.textContent="Agregado al carrito: "+p.name;note.hidden=false;setTimeout(()=>{if(note)note.hidden=true},2600)}
}
function badge(){const n=[...cart.values()].reduce((a,b)=>a+b,0);const el=$("cart-count");if(el)el.textContent=n?" ("+fmt(n)+")":""}
function hide(){const section=$("cart-view");if(section)section.hidden=true;$("tab-cart")?.classList.remove("active")}
function show(){
 if(typeof currentSection!=="undefined")currentSection="cart";
 $("tab-catalog")?.classList.remove("active");$("tab-remitos")?.classList.remove("active");
 $("tab-cart")?.classList.add("active");$("tab-catalog")?.setAttribute("aria-current","false");
 $("tab-remitos")?.setAttribute("aria-current","false");$("tab-cart")?.setAttribute("aria-current","page");
 $("catalog-view").hidden=true;$("detail-view").hidden=true;$("remitos-view").hidden=true;
 $("cart-view").hidden=false;draw();window.scrollTo(0,0);
}
function draw(){
 const root=$("cart-items");if(!root)return;
 const list=[...cart.entries()].map(([code,qty])=>({product:currentProducts().find(p=>p.code===code),code,qty})).filter(x=>x.product);
 root.innerHTML=list.length?list.map(({product:p,code,qty})=>'<div class="cart-row"><div><b>'+esc(p.name)+'</b><small>'+esc(p.category)+" · Disponibles: "+fmt(p.quantity)+" "+esc(p.unit)+'</small></div><div class="cart-quantity"><button type="button" data-cart-down="'+esc(code)+'" aria-label="Quitar una unidad">−</button><strong>'+fmt(qty)+'</strong><button type="button" data-cart-up="'+esc(code)+'" aria-label="Agregar una unidad">+</button><button type="button" data-cart-remove="'+esc(code)+'" aria-label="Quitar artículo">✕</button></div></div>').join(""):'<div class="empty">El carrito está vacío. Volvé a Materiales y elegí lo que necesitás.</div>';
 $("cart-form").hidden=!list.length;
 $("cart-summary").textContent=list.length?list.length+" materiales distintos · "+fmt(list.reduce((n,x)=>n+x.qty,0))+" unidades solicitadas":"";
 root.querySelectorAll("[data-cart-down]").forEach(b=>b.onclick=()=>{const code=b.dataset.cartDown,qty=cart.get(code)||0;if(qty<=1)cart.delete(code);else cart.set(code,qty-1);badge();draw()});
 root.querySelectorAll("[data-cart-up]").forEach(b=>b.onclick=()=>{add(b.dataset.cartUp);draw()});
 root.querySelectorAll("[data-cart-remove]").forEach(b=>b.onclick=()=>{cart.delete(b.dataset.cartRemove);badge();draw()});
}
document.addEventListener("click",e=>{
 const target=e.target.closest?.("[data-cart-code]");if(!target)return;
 e.preventDefault();e.stopPropagation();add(target.dataset.cartCode)
});
$("tab-cart").addEventListener("click",show);
$("cart-back").addEventListener("click",()=>setTab("catalog"));
$("cart-form").addEventListener("submit",async e=>{
 e.preventDefault();if(sending||cart.size===0)return;
 const fd=new FormData(e.currentTarget);
 const rows=[...cart.entries()].map(([code,cantidad])=>({code,cantidad}));
 const button=$("cart-submit");sending=true;button.disabled=true;button.textContent="Enviando pedido...";
 try{
  const res=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   nombre:fd.get("nombre"),apellido:fd.get("apellido"),para_quien:fd.get("para_quien"),destino:fd.get("destino"),
   observaciones:fd.get("observaciones"),es_prestamo:fd.get("tipo")==="prestamo",items:rows,website:fd.get("website")
  })});
  const data=await res.json();if(!res.ok)throw Error(data.error||"No se pudo enviar");
  cart.clear();badge();$("cart-form").reset();draw();
  $("cart-success").hidden=false;
  $("cart-success").textContent="✓ Pedido #"+String(data.numero).padStart(5,"0")+" enviado a GLORIETA. Gaby lo revisará y preparará. Todavía no se descontó stock.";
 }catch(err){alert("No se pudo enviar el pedido: "+err.message)}
 finally{sending=false;button.disabled=false;button.textContent="Enviar pedido a GLORIETA"}
});
window.GlorietaCart={add,show,hide,badge};
})();