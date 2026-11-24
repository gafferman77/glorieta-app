/* GLORIETA · detector visual preventivo. Comparación local, sin enviar fotos a terceros. */
window.GlorietaVisual=(()=>{
 const canvas=document.createElement('canvas');canvas.width=9;canvas.height=8;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 async function load(src,cross=false){return new Promise((resolve,reject)=>{const img=new Image();if(cross)img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Imagen inaccesible'));img.src=src})}
 async function signature(src,cross=false){
  const img=await load(src,cross);ctx.clearRect(0,0,9,8);ctx.drawImage(img,0,0,9,8);
  const d=ctx.getImageData(0,0,9,8).data;const light=[],rgb=[0,0,0];
  for(let i=0;i<72;i++){let j=i*4;light.push(.299*d[j]+.587*d[j+1]+.114*d[j+2]);for(let k=0;k<3;k++)rgb[k]+=d[j+k]/72}
  const bits=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)bits.push(light[y*9+x]>light[y*9+x+1]?1:0);
  return {bits,rgb};
 }
 function score(a,b){
  let dist=0;for(let i=0;i<64;i++)dist+=a.bits[i]!==b.bits[i]?1:0;
  const colors=Math.sqrt(a.rgb.reduce((s,v,i)=>s+(v-b.rgb[i])**2,0))/441.67;
  return .8*(1-dist/64)+.2*(1-colors);
 }
 const cache=new Map();
 async function find(photo,products,excluded){
  const base=await signature(photo);
  const candidates=products.filter(p=>p.id!==excluded&&p.photo_url);
  const out=[];let cursor=0;const workers=Array.from({length:4},async()=>{while(cursor<candidates.length){const p=candidates[cursor++];try{
   let sig=cache.get(p.photo_url);if(!sig){sig=await signature(p.photo_url,true);cache.set(p.photo_url,sig)}
   const similarity=score(base,sig);if(similarity>=.78)out.push({product:p,similarity});
  }catch{/* Una imagen sin permiso CORS no impide cargar el artículo. */}
  }});
  await Promise.all(workers);
  return out.sort((a,b)=>b.similarity-a.similarity).slice(0,3);
 }
 return {find};
})();