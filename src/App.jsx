import { useState, useEffect, useRef } from "react";
import { C, FONT, Btn, WaBtn, Inp, Card, SectionTitle, TopBar,
         InfoBox, Badge, Loading, EmptyState, PinLock, StatsRow, OfflineBanner } from "./ui.jsx";
import { initFirebase, dbAdd, dbUpdate, dbGetAll, dbListen } from "./firebase.js";
import { TicketsScreen } from "./Tickets.jsx";
import { ShipmentsScreen } from "./Shipments.jsx";
import { InventoryScreen } from "./Inventory.jsx";
import { COL, ZONES, BASE_COORDS, STORE_CONFIG, ORDER_STATUS, INVENTORY_STATUS } from "./config.js";

// ─── FORMATEO SEGURO ──────────────────────────────────────
function numFmt(n,dec=2){
  const num=parseFloat(n)||0;
  const fixed=Math.abs(num).toFixed(dec);
  const[int,frac]=fixed.split(".");
  const intFmt=int.replace(/\B(?=(\d{3})+(?!\d))/g,",");
  return(num<0?"-":"")+intFmt+"."+frac;
}
function mxn(n,dec=2){return"$ "+numFmt(n,dec);}

// ─── GPS ──────────────────────────────────────────────────
function calcKm(la1,lo1,la2,lo2){
  const R=6371,dL=(la2-la1)*Math.PI/180,dG=(lo2-lo1)*Math.PI/180;
  const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dG/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function zoneFor(lat,lng){
  const d=calcKm(BASE_COORDS.lat,BASE_COORDS.lng,lat,lng);
  return{...ZONES.find(z=>d<=z.maxKm)||ZONES[3],km:d.toFixed(1)};
}
const TOWNS=[
  {name:"Santa Catarina Loxicha",lat:BASE_COORDS.lat,lng:BASE_COORDS.lng},
  {name:"San Mateo R.H.",lat:BASE_COORDS.lat+0.07,lng:BASE_COORDS.lng+0.05},
  {name:"Miahuatlán de Porfirio Díaz",lat:BASE_COORDS.lat+0.18,lng:BASE_COORDS.lng+0.14},
  {name:"Puerto Escondido",lat:BASE_COORDS.lat+0.42,lng:BASE_COORDS.lng+0.35},
];

function optimImg(url){
  if(!url)return url;
  if(url.includes("cloudinary.com"))return url.replace("/upload/","/upload/w_600,q_75,f_auto/");
  return url;
}

function buildWaMsg(order){
  const items=(order.carrito||[]).map(i=>`  • ${i.nombre}${i.talla?" T:"+i.talla:""}${i.color?" / "+i.color:""} — ${mxn(i.precio)}`).join("\n");
  return `🛍️ *PEDIDO ${order.id} — CASI*\n\n👤 *${order.cliente?.nombre}*\n📞 ${order.cliente?.telefono}\n📍 ${order.zona?.name} (${order.zona?.days})\n🏠 ${order.cliente?.referencia||"Sin referencia"}\n\n*Artículos:*\n${items}\n\n💰 *TOTAL: ${mxn(order.total)} MXN*\n${order.metodoPago==="cod"?"💵 Contra entrega":"📲 Transferencia — Ref: "+order.referenciaPago}`;
}

function FadeImg({src,alt}){
  const[ok,setOk]=useState(false);
  return(
    <div style={{position:"relative",width:"100%",height:"100%",background:C.stone}}>
      {!ok&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:C.muted,opacity:.2}}>▣</div>}
      {src&&<img src={optimImg(src)} alt={alt||""} onLoad={()=>setOk(true)} loading="lazy"
        style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:ok?1:0,transition:"opacity .4s"}}/>}
    </div>
  );
}

// ─── GPS LOCATOR ──────────────────────────────────────────
function LocationPicker({onDone,onBack}){
  const[st,setSt]=useState("idle");
  const[zona,setZona]=useState(null);
  function detect(){setSt("busy");if(!navigator.geolocation){setSt("list");return;}navigator.geolocation.getCurrentPosition(p=>{setZona(zoneFor(p.coords.latitude,p.coords.longitude));setSt("found");},()=>setSt("list"),{timeout:8000});}
  function pick(t){setZona({...zoneFor(t.lat,t.lng),km:calcKm(BASE_COORDS.lat,BASE_COORDS.lng,t.lat,t.lng).toFixed(1)});setSt("found");}
  const activeZ=ZONES.filter(z=>z.active&&z.price);
  return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title="¿Dónde entregamos?" subtitle="Selecciona tu zona" onBack={onBack}/>
      <div style={{padding:"16px 18px 32px"}}>
        {st==="idle"&&<div style={{textAlign:"center",padding:"32px 0"}}>
          <div style={{fontSize:56,marginBottom:16}}>🛰️</div>
          <div style={{fontSize:16,fontWeight:800,color:C.black,marginBottom:8,fontFamily:FONT.display}}>Detectar con GPS</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:24,lineHeight:1.7}}>Sin dirección formal. Detectamos tu pueblo automáticamente.</div>
          <Btn label="📍 Usar GPS automático" onClick={detect}/>
          <button onClick={()=>setSt("list")} style={{marginTop:14,fontSize:12,color:C.muted,background:"none",border:"none",cursor:"pointer",letterSpacing:1,textTransform:"uppercase"}}>O elegir pueblo →</button>
        </div>}
        {st==="busy"&&<div style={{textAlign:"center",padding:"48px"}}><div style={{fontSize:52}}>🛰️</div><div style={{fontSize:14,fontWeight:600,color:C.black,marginTop:12}}>Detectando…</div></div>}
        {st==="list"&&<div>
          {activeZ.map(z=>(
            <button key={z.id} onClick={()=>{setZona({...z,km:"—"});setSt("found");}} style={{width:"100%",textAlign:"left",marginBottom:10,padding:"16px 18px",background:C.white,border:`1.5px solid ${C.border}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:14,fontWeight:800,color:C.black}}>📍 {z.name}</div><div style={{fontSize:11,color:C.muted}}>{z.time} · 📅 {z.days}</div></div>
              <span style={{fontSize:16,fontWeight:900,color:C.terra}}>+${z.price} MXN</span>
            </button>
          ))}
          {TOWNS.map(t=>(
            <button key={t.name} onClick={()=>pick(t)} style={{width:"100%",textAlign:"left",marginBottom:8,padding:"10px 16px",background:"transparent",border:`1px dashed ${C.border}`,cursor:"pointer",fontSize:12,color:C.muted}}>
              📍 {t.name} <span style={{fontSize:10}}>(GPS demo)</span>
            </button>
          ))}
        </div>}
        {st==="found"&&zona&&<div>
          <div style={{display:"flex",gap:14,alignItems:"center",padding:"20px 0",borderBottom:`1px solid ${C.border}`,marginBottom:16}}>
            <div style={{fontSize:44}}>📍</div>
            <div><div style={{fontSize:18,fontWeight:900,color:C.black,fontFamily:FONT.display}}>{zona.name}</div>{zona.km!=="—"&&<div style={{fontSize:12,color:C.muted}}>{zona.km} km de la tienda</div>}</div>
          </div>
          {zona.price&&zona.active?<>
            <InfoBox type="ok"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><strong>Con cobertura ✓</strong><br/>{zona.time} · 📅 {zona.days}</div><div style={{fontSize:22,fontWeight:900,color:C.terra}}>+${zona.price}</div></div></InfoBox>
            <Btn label="Confirmar esta zona ✓" onClick={()=>onDone(zona)} color={C.ok}/>
          </>:<><InfoBox type="danger">Sin cobertura aún — próximamente 🙌</InfoBox><Btn label="Elegir otra zona" onClick={()=>setSt("list")} outline/></>}
        </div>}
      </div>
    </div>
  );
}

// ─── CHECKOUT ─────────────────────────────────────────────
function Checkout({carrito,zona,onBack,onConfirm}){
  const[paso,setPaso]=useState("info");
  const[nombre,setNombre]=useState("");
  const[telefono,setTelefono]=useState("");
  const[referencia,setReferencia]=useState("");
  const[metodoPago,setMetodoPago]=useState(null);
  const[referenciaPago,setReferenciaPago]=useState("");
  const[listo,setListo]=useState(false);
  const[guardando,setGuardando]=useState(false);
  const subtotal=carrito.reduce((a,i)=>a+(i.precio||0),0);
  const total=subtotal+(zona?.price||0);
  const pedidoId="C-"+Date.now().toString().slice(-6);
  const puedeInfo=nombre.trim().length>2&&telefono.replace(/\D/g,"").length>=10;
  const puedePagar=metodoPago&&(metodoPago!=="transfer"||referenciaPago.length>3);
  const pedido={id:pedidoId,carrito,zona,metodoPago,referenciaPago,total,status:metodoPago==="transfer"?"verificando":"nuevo",cliente:{nombre,telefono,referencia},createdAt:new Date().toISOString()};
  async function confirmar(){if(!puedePagar)return;setGuardando(true);await onConfirm(pedido);setGuardando(false);setListo(true);}
  if(listo)return(
    <div style={{padding:"0 20px 32px",background:C.cream,minHeight:"100%",textAlign:"center"}}>
      <div style={{padding:"48px 0 24px"}}>
        <div style={{fontSize:64,marginBottom:16}}>🎉</div>
        <div style={{fontSize:10,fontWeight:700,color:C.terra,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>Pedido confirmado</div>
        <div style={{fontSize:26,fontWeight:900,color:C.black,fontFamily:FONT.display,marginBottom:6,lineHeight:1.2}}>Todo listo,<br/>{nombre.split(" ")[0]}</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:24}}>Pedido #{pedidoId}</div>
        <Card style={{marginBottom:16,padding:"14px 20px",textAlign:"left"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,color:C.muted}}>Total</span><span style={{fontSize:18,fontWeight:900,color:C.sale}}>{mxn(total)} MXN</span></div>
          <div style={{fontSize:12,color:C.muted}}>📍 {zona?.name} · 📅 {zona?.days}</div>
        </Card>
        <InfoBox type="ok">✅ Guardado — el equipo CASI ya lo recibió</InfoBox>
        <div style={{marginBottom:14}}><WaBtn tel={STORE_CONFIG.ownerPhone} msg={buildWaMsg(pedido)} label="Confirmar por WhatsApp"/></div>
        <button onClick={onBack} style={{fontSize:13,color:C.terra,background:"none",border:"none",cursor:"pointer",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>← Seguir comprando</button>
      </div>
    </div>
  );
  return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title={paso==="info"?"Tus datos":"Método de pago"} subtitle={`Entrega a ${zona?.name}`} onBack={onBack}/>
      <div style={{padding:"16px 16px 0"}}>
        <div style={{display:"flex",gap:4,marginBottom:20}}>{["info","pago"].map(s=><div key={s} style={{flex:1,height:3,background:paso==="pago"||s==="info"?C.black:C.border,transition:"background .3s"}}/>)}</div>
        {paso==="info"&&<>
          <Card style={{marginBottom:16,background:C.terraL,padding:"12px 16px"}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:C.muted}}>Total</span><span style={{fontSize:18,fontWeight:900,color:C.terra}}>{mxn(total)} MXN</span></div></Card>
          <Inp label="Nombre completo" value={nombre} onChange={setNombre} placeholder="María González" required/>
          <Inp label="WhatsApp (10 dígitos)" value={telefono} onChange={setTelefono} placeholder="951 234 5678" type="tel" required hint="Te avisamos cuando salga tu pedido 🛵"/>
          <Inp label="Referencia de entrega" value={referencia} onChange={setReferencia} placeholder="Casa azul junto a la cancha" hint="Solo cómo encontrarte"/>
          <Btn label="Continuar →" onClick={()=>setPaso("pago")} disabled={!puedeInfo}/>
        </>}
        {paso==="pago"&&<>
          <Card style={{padding:"14px 18px",marginBottom:16}}><div style={{fontSize:14,fontWeight:800,color:C.black,marginBottom:2}}>{nombre}</div><div style={{fontSize:12,color:C.muted}}>📞 {telefono}{referencia&&" · 🏠 "+referencia}</div></Card>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:14}}>Método de pago</div>
          {[{id:"cod",icon:"💵",label:"Contra entrega",desc:"Pagas en efectivo cuando recibes."},{id:"transfer",icon:"📲",label:"Transferencia bancaria",desc:"Pagas antes. Confirmamos más rápido."}].map(m=>(
            <button key={m.id} onClick={()=>setMetodoPago(m.id)} style={{width:"100%",textAlign:"left",padding:"16px 18px",marginBottom:12,background:C.white,border:`2px solid ${metodoPago===m.id?C.black:C.border}`,cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <span style={{fontSize:26}}>{m.icon}</span>
                <div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,color:C.black}}>{m.label}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{m.desc}</div></div>
                <div style={{width:20,height:20,border:`2px solid ${metodoPago===m.id?C.black:C.border}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{metodoPago===m.id&&<div style={{width:10,height:10,background:C.black,borderRadius:"50%"}}/>}</div>
              </div>
            </button>
          ))}
          {metodoPago==="transfer"&&<InfoBox type="info">
            <div style={{marginBottom:8,fontWeight:700}}>Datos bancarios</div>
            {[["Banco",STORE_CONFIG.bank],["Nombre",STORE_CONFIG.ownerName],["CLABE",STORE_CONFIG.clabe],["Monto",`${mxn(total)} MXN`]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted}}>{l}</span><strong>{v}</strong></div>
            ))}
            <div style={{marginTop:10}}><Inp value={referenciaPago} onChange={setReferenciaPago} placeholder="Folio del comprobante" hint="Número de referencia de tu banco"/></div>
          </InfoBox>}
          <Btn label={guardando?"Guardando…":puedePagar?"Confirmar pedido ✓":"Elige cómo pagas"} onClick={confirmar} disabled={!puedePagar||guardando}/>
        </>}
      </div>
    </div>
  );
}

// ─── CARRUSEL DE FOTOS ────────────────────────────────────
function CarruselFotos({fotos}){
  const[indiceActual,setIndiceActual]=useState(0);
  const inicioToque=useRef(null);
  function alTocarInicio(e){inicioToque.current=e.touches[0].clientX;}
  function alTocarFin(e){
    if(inicioToque.current===null)return;
    const diferencia=inicioToque.current-e.changedTouches[0].clientX;
    if(diferencia>40&&indiceActual<fotos.length-1)setIndiceActual(i=>i+1);
    if(diferencia<-40&&indiceActual>0)setIndiceActual(i=>i-1);
    inicioToque.current=null;
  }
  if(fotos.length===0)return(
    <div style={{width:"100%",aspectRatio:"3/4",background:"#f5f5f5",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
      <span style={{fontSize:48,opacity:.2}}>📷</span>
      <span style={{fontSize:11,color:"#aaa",letterSpacing:1,textTransform:"uppercase"}}>Sin foto</span>
    </div>
  );
  return(
    <div style={{position:"relative",width:"100%",userSelect:"none"}} onTouchStart={alTocarInicio} onTouchEnd={alTocarFin}>
      <div style={{width:"100%",aspectRatio:"3/4",overflow:"hidden",background:"#f7f7f7"}}>
        <img src={optimImg(fotos[indiceActual])} alt="" style={{width:"100%",height:"100%",objectFit:"contain",objectPosition:"center"}}/>
      </div>
      {indiceActual>0&&(
        <button onClick={()=>setIndiceActual(i=>i-1)} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.9)",border:"none",width:36,height:36,borderRadius:"50%",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>‹</button>
      )}
      {indiceActual<fotos.length-1&&(
        <button onClick={()=>setIndiceActual(i=>i+1)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.9)",border:"none",width:36,height:36,borderRadius:"50%",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>›</button>
      )}
      {fotos.length>1&&(
        <div style={{position:"absolute",bottom:10,left:0,right:0,display:"flex",justifyContent:"center",gap:5}}>
          {fotos.map((_,i)=>(
            <div key={i} onClick={()=>setIndiceActual(i)} style={{width:i===indiceActual?18:6,height:6,borderRadius:3,background:i===indiceActual?"#e84040":"rgba(0,0,0,0.25)",cursor:"pointer",transition:"all .2s"}}/>
          ))}
        </div>
      )}
      {fotos.length>1&&(
        <div style={{position:"absolute",top:10,right:10,background:"rgba(0,0,0,0.5)",color:"#fff",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:10}}>
          <span>{indiceActual+1}/{fotos.length}</span>
        </div>
      )}
    </div>
  );
}

// ─── TIENDA ONLINE ────────────────────────────────────────
function Store({onOrder}){
  const[productos,setProductos]=useState([]);
  const[cargando,setCargando]=useState(true);
  const[busqueda,setBusqueda]=useState("");
  const[productoSeleccionado,setProductoSeleccionado]=useState(null);
  const[carrito,setCarrito]=useState(()=>{try{const s=localStorage.getItem("casi:carrito");return s?JSON.parse(s):[];}catch{return[];}});
  const[zona,setZona]=useState(()=>{try{const s=localStorage.getItem("casi:zona");return s?JSON.parse(s):null;}catch{return null;}});
  const[pantalla,setPantalla]=useState("catalogo");
  const[carritoAbierto,setCarritoAbierto]=useState(false);
  const[filtrosAbiertos,setFiltrosAbiertos]=useState(false);

  // ── Filtros
  const[fCategoria,setFCategoria]=useState([]);
  const[fGenero,setFGenero]=useState([]);
  const[fPrecioMax,setFPrecioMax]=useState(null);
  const[ordenar,setOrdenar]=useState("default");

  // ── Cargar productos desde la colección "inventario"
  useEffect(()=>{
    dbGetAll(COL.inventario,"createdAt","desc").then(items=>{
      setProductos(items.filter(p=>p.activo===true));
      setCargando(false);
    }).catch(err=>{
      console.error("Error cargando inventario:",err);
      setCargando(false);
    });
  },[]);

  useEffect(()=>{try{localStorage.setItem("casi:carrito",JSON.stringify(carrito));}catch{}},[carrito]);
  useEffect(()=>{try{if(zona)localStorage.setItem("casi:zona",JSON.stringify(zona));}catch{}},[zona]);

  // ── Opciones de filtro del inventario real
  const opsCategorias=[...new Set(productos.map(p=>p.categoria).filter(Boolean).sort())];
  const opsGeneros=[...new Set(productos.map(p=>p.genero).filter(Boolean).sort())];
  const precios=productos.map(p=>p.precio).filter(p=>typeof p==="number"&&p>0);
  const precioMax=precios.length?Math.ceil(precios.reduce((a,b)=>a>b?a:b,0)/200)*200:1000;
  const opsPrecio=[200,400,600,800,1000].filter(p=>p<=precioMax+200);

  const filtrosActivos=fCategoria.length+fGenero.length+(fPrecioMax?1:0);

  // ── Filtrar y ordenar
  let visibles=productos.filter(p=>{
    if(busqueda&&!p.nombre?.toLowerCase().includes(busqueda.toLowerCase()))return false;
    if(fCategoria.length&&!fCategoria.includes(p.categoria))return false;
    if(fGenero.length&&!fGenero.includes(p.genero))return false;
    if(fPrecioMax&&p.precio>fPrecioMax)return false;
    return true;
  });
  if(ordenar==="precio_asc")visibles=[...visibles].sort((a,b)=>a.precio-b.precio);
  if(ordenar==="precio_desc")visibles=[...visibles].sort((a,b)=>b.precio-a.precio);
  if(ordenar==="recientes")visibles=[...visibles].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  const subtotalCarrito=carrito.reduce((a,i)=>a+(i.precio||0),0);
  function agregarAlCarrito(item){setCarrito(c=>[...c,item]);}
  function quitarDelCarrito(i){setCarrito(c=>c.filter((_,idx)=>idx!==i));}
  async function confirmarPedido(pedido){await onOrder(pedido);setCarrito([]);setProductoSeleccionado(null);setPantalla("catalogo");}
  function alternar(arr,set,val){set(prev=>prev.includes(val)?prev.filter(x=>x!==val):[...prev,val]);}
  function limpiarFiltros(){setFCategoria([]);setFGenero([]);setFPrecioMax(null);setOrdenar("default");}

  if(pantalla==="locator")return<LocationPicker onBack={()=>setPantalla("catalogo")} onDone={z=>{setZona(z);setPantalla("catalogo");}}/>;
  if(pantalla==="checkout")return<Checkout carrito={carrito} zona={zona} onBack={()=>setPantalla("catalogo")} onConfirm={confirmarPedido}/>;

  // ── Detalle del producto
  if(productoSeleccionado){
    const fotosProducto=productoSeleccionado.fotos?.length?productoSeleccionado.fotos:productoSeleccionado.foto?[productoSeleccionado.foto]:[];
    return(
      <div translate="no" style={{background:"#fff",minHeight:"100%",paddingBottom:100}}>
        {/* Barra superior */}
        <div style={{position:"sticky",top:0,zIndex:50,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"rgba(255,255,255,0.97)",backdropFilter:"blur(8px)",borderBottom:"1px solid #f0f0f0"}}>
          <button onClick={()=>setProductoSeleccionado(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:24,color:C.black,padding:4,lineHeight:1}}>←</button>
          <span style={{fontSize:12,fontWeight:800,letterSpacing:3,textTransform:"uppercase"}}>CASI</span>
          <button onClick={()=>setCarritoAbierto(true)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,position:"relative",padding:4}}>
            🛒
            {carrito.length>0&&<div style={{position:"absolute",top:0,right:0,background:"#e84040",color:"#fff",fontSize:9,fontWeight:900,width:15,height:15,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{carrito.length}</div>}
          </button>
        </div>
        {/* Carrusel */}
        <CarruselFotos fotos={fotosProducto}/>
        {/* Info */}
        <div style={{padding:"16px 16px 0"}}>
          <div style={{fontSize:26,fontWeight:900,color:"#e84040",marginBottom:6}}>
            <span>{mxn(productoSeleccionado.precio)}</span>
            <span style={{fontSize:12,color:C.muted,fontWeight:400}}> MXN</span>
          </div>
          <div style={{fontSize:16,fontWeight:700,color:"#222",lineHeight:1.4,marginBottom:12}}>{productoSeleccionado.nombre}</div>
          <div style={{fontSize:10,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:16}}>
            <span>Clave: {productoSeleccionado.clave}</span>
          </div>
          {/* Atributos */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            {productoSeleccionado.talla&&<span style={{padding:"6px 14px",background:"#f5f5f5",fontSize:12,fontWeight:900,color:C.black}}><span>Talla {productoSeleccionado.talla}</span></span>}
            {productoSeleccionado.categoria&&<span style={{padding:"6px 14px",background:"#f5f5f5",fontSize:12,color:C.muted}}><span>{productoSeleccionado.categoria}</span></span>}
            {productoSeleccionado.genero&&<span style={{padding:"6px 14px",background:"#f5f5f5",fontSize:12,color:C.muted}}><span>{productoSeleccionado.genero}</span></span>}
            {productoSeleccionado.color&&<span style={{padding:"6px 14px",background:"#f5f5f5",fontSize:12,color:C.muted}}><span>{productoSeleccionado.color}</span></span>}
            {productoSeleccionado.marca&&<span style={{padding:"6px 14px",background:"#f5f5f5",fontSize:12,color:C.muted}}><span>{productoSeleccionado.marca}</span></span>}
          </div>
          <div style={{height:1,background:"#f0f0f0",marginBottom:16}}/>
          {/* Envío */}
          {zona
            ?<div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"#f9fdf9",border:"1px solid #d4edda",marginBottom:16}}>
              <span style={{fontSize:20}}>🛵</span>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"#2d7a3a"}}><span>Envío a {zona.name}</span></div>
                <div style={{fontSize:11,color:C.muted}}><span>${zona.price} MXN · {zona.time} · {zona.days}</span></div>
              </div>
            </div>
            :<button onClick={()=>{setProductoSeleccionado(null);setPantalla("locator");}} style={{width:"100%",padding:"12px",background:"#fff8e1",border:"1px solid #ffc107",fontSize:12,fontWeight:700,color:"#856404",cursor:"pointer",marginBottom:16,textAlign:"left"}}>
              <span>📍 ¿Dónde entregamos? — Toca para ver tu zona</span>
            </button>
          }
          {/* Descripción */}
          {productoSeleccionado.descripcion&&(
            <>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}><span>Descripción</span></div>
              <div style={{fontSize:13,color:"#444",lineHeight:1.8,marginBottom:16}}>{productoSeleccionado.descripcion}</div>
              <div style={{height:1,background:"#f0f0f0",marginBottom:16}}/>
            </>
          )}
          {/* Info fija */}
          <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}><span>Información</span></div>
          {[["🇺🇸","Ropa americana de segunda mano"],["✅","Revisada y seleccionada por CASI"],["📦","Entrega en Sierra Sur, Oaxaca"]].map(([icono,texto])=>(
            <div key={texto} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}>
              <span style={{fontSize:14,flexShrink:0}}>{icono}</span>
              <span style={{fontSize:12,color:"#555",lineHeight:1.5}}>{texto}</span>
            </div>
          ))}
        </div>
        {/* Botón agregar — estilo SHEIN */}
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:390,padding:"10px 16px 16px",boxSizing:"border-box",background:"#fff",borderTop:"1px solid #f0f0f0",zIndex:50}}>
          <button onClick={()=>{agregarAlCarrito({...productoSeleccionado,precio:productoSeleccionado.precio});setProductoSeleccionado(null);}}
            style={{width:"100%",padding:"16px",fontSize:14,fontWeight:900,letterSpacing:1,textTransform:"uppercase",background:"#e84040",color:"#fff",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span>🛒 Agregar al carrito</span>
          </button>
        </div>
      </div>
    );
  }

  if(cargando)return<Loading message="Cargando productos…"/>;

  return(
    <div translate="no" style={{background:C.cream,minHeight:"100%",paddingBottom:8}}>

      {/* ══ CARRITO DRAWER ══════════════════════════════════ */}
      {carritoAbierto&&(
        <div style={{position:"fixed",inset:0,zIndex:500}}>
          <div onClick={()=>setCarritoAbierto(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)"}}/>
          <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:390,background:C.cream,maxHeight:"88vh",overflowY:"auto",padding:"0 0 32px"}}>
            <div style={{padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:16,fontWeight:900,color:C.black,fontFamily:FONT.display,letterSpacing:2}}>MI CARRITO ({carrito.length})</div>
              <button onClick={()=>setCarritoAbierto(false)} style={{background:C.black,border:"none",width:32,height:32,cursor:"pointer",color:C.white,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <div style={{padding:"0 20px"}}>
              {carrito.length===0
                ?<div style={{textAlign:"center",padding:"40px"}}><div style={{fontSize:48,marginBottom:12}}>🛒</div><div style={{fontSize:16,fontWeight:700,fontFamily:FONT.display}}>Carrito vacío</div></div>
                :<>
                  {carrito.map((item,i)=>(
                    <div key={i} style={{display:"flex",gap:14,paddingBottom:16,marginBottom:16,borderBottom:`1px solid ${C.stone}`}}>
                      <div style={{width:70,height:88,overflow:"hidden",flexShrink:0,position:"relative",background:C.stone}}><FadeImg src={item.foto} alt={item.nombre}/></div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:800,color:C.black,lineHeight:1.3,marginBottom:4,fontFamily:FONT.display}}>{item.nombre}</div>
                        <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{item.talla&&"T:"+item.talla}{item.talla&&item.color&&" · "}{item.color}</div>
                        <div style={{fontSize:17,fontWeight:900,color:C.sale}}>{mxn(item.precio)}</div>
                      </div>
                      <button onClick={()=>quitarDelCarrito(i)} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:18,alignSelf:"flex-start",padding:4}}>✕</button>
                    </div>
                  ))}
                  {zona
                    ?<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${C.stone}`,marginBottom:16}}>
                      <div><div style={{fontSize:13,fontWeight:700,color:C.black}}>📍 {zona.name}</div><div style={{fontSize:11,color:C.muted}}>{zona.time} · {zona.days}</div></div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:900,color:C.terra}}>+${zona.price}</div><button onClick={()=>{setCarritoAbierto(false);setPantalla("locator");}} style={{fontSize:10,color:C.info,background:"none",border:"none",cursor:"pointer"}}>Cambiar</button></div>
                    </div>
                    :<button onClick={()=>{setCarritoAbierto(false);setPantalla("locator");}} style={{width:"100%",padding:"13px",background:C.warnFade,border:`1.5px solid ${C.warn}`,fontSize:12,color:C.warn,fontWeight:700,cursor:"pointer",marginBottom:16,letterSpacing:1,textTransform:"uppercase"}}>📍 Selecciona zona de entrega</button>
                  }
                  <Card style={{padding:"16px",marginBottom:16}}>
                    {[["Subtotal",mxn(subtotalCarrito)],["Envío",zona?`$${zona.price}`:"Pendiente"]].map(([l,v])=>(
                      <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,color:C.muted}}>{l}</span><span style={{fontSize:13}}>{v}</span></div>
                    ))}
                    <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:`1px solid ${C.border}`}}><span style={{fontSize:14,fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>Total</span><span style={{fontSize:22,fontWeight:900,color:C.sale}}>{mxn(subtotalCarrito+(zona?.price||0))} MXN</span></div>
                  </Card>
                  <Btn label={zona?"Ir a pagar →":"Elige zona primero"} onClick={()=>{setCarritoAbierto(false);if(zona)setPantalla("checkout");else setPantalla("locator");}} disabled={!zona}/>
                </>
              }
            </div>
          </div>
        </div>
      )}

      {/* ══ FILTROS DRAWER ══════════════════════════════════ */}
      {filtrosAbiertos&&(
        <div style={{position:"fixed",inset:0,zIndex:500}}>
          <div onClick={()=>setFiltrosAbiertos(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)"}}/>
          <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:390,background:C.cream,maxHeight:"92vh",overflowY:"auto",padding:"0 0 32px"}}>
            <div style={{padding:"18px 20px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.cream,zIndex:1}}>
              <div style={{fontSize:16,fontWeight:900,color:C.black,fontFamily:FONT.display,letterSpacing:2}}>FILTROS</div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                {(filtrosActivos>0||ordenar!=="default")&&(
                  <button onClick={limpiarFiltros} style={{fontSize:11,color:C.terra,background:"none",border:"none",cursor:"pointer",fontWeight:700,letterSpacing:.5,textTransform:"uppercase"}}>Limpiar todo</button>
                )}
                <button onClick={()=>setFiltrosAbiertos(false)} style={{background:C.black,border:"none",width:32,height:32,cursor:"pointer",color:C.white,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
            </div>
            <div style={{padding:"0 20px"}}>
              {/* Ordenar */}
              <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:2,textTransform:"uppercase",padding:"16px 0 10px"}}>Ordenar por</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:4}}>
                {[["default","Relevancia"],["recientes","Más nuevos"],["precio_asc","Precio ↑"],["precio_desc","Precio ↓"]].map(([k,l])=>(
                  <button key={k} onClick={()=>setOrdenar(k)} style={{padding:"8px 14px",border:`1.5px solid ${ordenar===k?C.black:C.border}`,background:ordenar===k?C.black:"transparent",color:ordenar===k?C.white:C.black,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>{l}</button>
                ))}
              </div>
              {/* Categoría */}
              {opsCategorias.length>0&&<>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:2,textTransform:"uppercase",padding:"16px 0 10px"}}>Categoría</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:4}}>
                  {opsCategorias.map(c=>(
                    <button key={c} onClick={()=>alternar(fCategoria,setFCategoria,c)} style={{padding:"8px 14px",border:`1.5px solid ${fCategoria.includes(c)?C.black:C.border}`,background:fCategoria.includes(c)?C.black:"transparent",color:fCategoria.includes(c)?C.white:C.black,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>{c}</button>
                  ))}
                </div>
              </>}
              {/* Género */}
              {opsGeneros.length>0&&<>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:2,textTransform:"uppercase",padding:"16px 0 10px"}}>Género</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:4}}>
                  {opsGeneros.map(g=>(
                    <button key={g} onClick={()=>alternar(fGenero,setFGenero,g)} style={{padding:"8px 14px",border:`1.5px solid ${fGenero.includes(g)?C.black:C.border}`,background:fGenero.includes(g)?C.black:"transparent",color:fGenero.includes(g)?C.white:C.black,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>{g}</button>
                  ))}
                </div>
              </>}
              {/* Precio máximo */}
              {opsPrecio.length>0&&<>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:2,textTransform:"uppercase",padding:"16px 0 10px"}}>Precio máximo</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
                  {opsPrecio.map(p=>(
                    <button key={p} onClick={()=>setFPrecioMax(fPrecioMax===p?null:p)} style={{padding:"8px 14px",border:`1.5px solid ${fPrecioMax===p?C.terra:C.border}`,background:fPrecioMax===p?C.terraL:"transparent",color:fPrecioMax===p?C.terra:C.black,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>hasta ${p}</button>
                  ))}
                </div>
              </>}
            </div>
            <div style={{padding:"0 20px"}}>
              <button onClick={()=>setFiltrosAbiertos(false)} style={{width:"100%",padding:"16px",fontSize:13,fontWeight:900,letterSpacing:2,textTransform:"uppercase",background:C.black,color:C.white,border:"none",cursor:"pointer"}}>
                VER {visibles.length} PRODUCTO{visibles.length!==1?"S":""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ HERO BANNER ══════════════════════════════════════ */}
      <div style={{position:"relative",height:240,overflow:"hidden",background:C.black}}>
        <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80" alt="CASI" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.45}} onError={e=>e.target.style.opacity=0}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(10,10,10,0.9) 0%,rgba(10,10,10,0.2) 60%)"}}/>
        <div style={{position:"absolute",top:16,left:0,right:0,textAlign:"center",fontSize:26,fontWeight:900,color:C.white,letterSpacing:10,fontFamily:"serif"}}>CASI</div>
        <div style={{position:"absolute",top:52,left:0,right:0,textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:4,textTransform:"uppercase"}}>Moda para todos · Sierra Sur, Costa, Oaxaca</div>
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"0 16px 16px",display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>setPantalla("locator")} style={{background:"rgba(255,255,255,0.15)",color:C.white,border:"1px solid rgba(255,255,255,0.3)",padding:"6px 14px",fontSize:11,fontWeight:600,cursor:"pointer"}}>
            {zona?`📍 ${zona.name} · $${zona.price}`:"📍 ¿Dónde entregamos?"}
          </button>
          {carrito.length>0&&(
            <button onClick={()=>setCarritoAbierto(true)} style={{background:"rgba(255,255,255,0.95)",color:C.terra,border:"none",padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
              🛒 {carrito.length} artículo{carrito.length>1?"s":""}
            </button>
          )}
        </div>
      </div>

      {/* ══ BARRA BÚSQUEDA + BOTONES ══════════════════════════ */}
      <div style={{position:"sticky",top:0,zIndex:20,background:"rgba(248,244,239,0.97)",backdropFilter:"blur(8px)",borderBottom:`1px solid ${C.border}`,padding:"10px 12px",display:"flex",gap:8,alignItems:"center"}}>
        <div style={{position:"relative",flex:1}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:C.muted}}>⌕</span>
          <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar en CASI…" style={{width:"100%",boxSizing:"border-box",padding:"10px 12px 10px 36px",border:`1px solid ${C.border}`,fontSize:13,outline:"none",background:C.white,color:C.black,fontFamily:FONT.body}}/>
        </div>
        <button onClick={()=>setFiltrosAbiertos(true)} style={{position:"relative",background:filtrosActivos>0||ordenar!=="default"?C.black:C.white,border:`1.5px solid ${filtrosActivos>0||ordenar!=="default"?C.black:C.border}`,width:42,height:42,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0,color:filtrosActivos>0||ordenar!=="default"?C.white:C.black}}>
          ⚙
          {(filtrosActivos>0||ordenar!=="default")&&(
            <div style={{position:"absolute",top:-4,right:-4,background:C.terra,color:C.white,fontSize:9,fontWeight:900,width:16,height:16,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {filtrosActivos+(ordenar!=="default"?1:0)}
            </div>
          )}
        </button>
        <button onClick={()=>setCarritoAbierto(true)} style={{position:"relative",background:C.black,border:"none",width:42,height:42,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
          🛒
          {carrito.length>0&&(
            <div style={{position:"absolute",top:-3,right:-3,background:C.terra,color:C.white,fontSize:9,fontWeight:900,width:17,height:17,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{carrito.length}</div>
          )}
        </button>
      </div>

      {/* ══ CHIPS DE FILTROS ACTIVOS ════════════════════════ */}
      <div style={{display:(filtrosActivos>0||ordenar!=="default")?"flex":"none",gap:6,overflowX:"auto",scrollbarWidth:"none",padding:"8px 12px",borderBottom:`1px solid ${C.border}`}} translate="no">
        {fCategoria.map(c=>(
          <button key={c} onClick={()=>alternar(fCategoria,setFCategoria,c)} style={{flexShrink:0,padding:"5px 10px",background:C.black,color:C.white,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
            <span>{c}</span><span> ✕</span>
          </button>
        ))}
        {fGenero.map(g=>(
          <button key={g} onClick={()=>alternar(fGenero,setFGenero,g)} style={{flexShrink:0,padding:"5px 10px",background:C.info,color:C.white,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
            <span>{g}</span><span> ✕</span>
          </button>
        ))}
        {fPrecioMax&&(
          <button key="precio" onClick={()=>setFPrecioMax(null)} style={{flexShrink:0,padding:"5px 10px",background:C.terraL,color:C.terra,border:`1px solid ${C.terra}`,fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
            <span>hasta ${fPrecioMax} ✕</span>
          </button>
        )}
        {ordenar!=="default"&&(
          <button key="orden" onClick={()=>setOrdenar("default")} style={{flexShrink:0,padding:"5px 10px",background:C.stone,color:C.black,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
            <span>{{precio_asc:"Precio ↑",precio_desc:"Precio ↓",recientes:"Más nuevos"}[ordenar]}</span><span> ✕</span>
          </button>
        )}
        <button key="limpiar" onClick={limpiarFiltros} style={{flexShrink:0,padding:"5px 10px",background:"transparent",color:C.muted,border:`1px solid ${C.border}`,fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>
          <span>Limpiar todo</span>
        </button>
      </div>

      {/* ══ CONTADOR + ZONA ══════════════════════════════════ */}
      <div style={{padding:"8px 14px 6px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:.5,fontWeight:600}}>
          {visibles.length} PRODUCTO{visibles.length!==1?"S":""}
          {productos.length!==visibles.length&&` de ${productos.length}`}
        </div>
        <button onClick={()=>setPantalla("locator")} style={{fontSize:10,color:zona?C.ok:C.muted,fontWeight:700,background:"none",border:"none",cursor:"pointer"}}>
          📍 {zona?zona.name:"¿Dónde entregamos?"}
        </button>
      </div>

      {/* ══ GRID ESTILO SHEIN — COLUMNAS DESNIVELADAS ══════════ */}
      <div translate="no">
        {visibles.length===0
          ?<div style={{padding:"48px 20px",textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:12}}>⌕</div>
              <div style={{fontSize:16,fontWeight:800,color:C.black,marginBottom:6,fontFamily:FONT.display}}>Sin resultados</div>
              <div style={{fontSize:13,color:C.muted}}>Prueba cambiando o quitando algún filtro</div>
              {busqueda&&<button onClick={()=>setBusqueda("")} style={{marginTop:16,padding:"10px 20px",background:C.black,color:C.white,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:1}}>Limpiar búsqueda</button>}
            </div>
          :(()=>{
            const izquierda=visibles.filter((_,i)=>i%2===0);
            const derecha=visibles.filter((_,i)=>i%2!==0);
            const TarjetaProducto=({p})=>(
              <div onClick={()=>setProductoSeleccionado(p)} style={{cursor:"pointer",background:C.white,marginBottom:3,overflow:"hidden"}}>
                {/* Foto */}
                <div style={{position:"relative",background:"#fff",padding:3}}>
                  {p.foto
                    ?<img src={optimImg(p.foto)} alt="" loading="lazy"
                        style={{width:"100%",display:"block",aspectRatio:"3/4",objectFit:"cover",objectPosition:"top center"}}/>
                    :<div style={{width:"100%",aspectRatio:"3/4",background:"#f5f5f5",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
                      <span style={{fontSize:26,opacity:.2}}>📷</span>
                      <span style={{fontSize:9,color:C.muted,opacity:.4,letterSpacing:1,textTransform:"uppercase"}}>Sin foto</span>
                    </div>
                  }
                  {/* Overlay agotado */}
                  {p.estado==="vendido"&&(
                    <div style={{position:"absolute",inset:0,background:"rgba(255,255,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <div style={{background:C.black,padding:"6px 14px",fontSize:10,fontWeight:900,color:C.white,letterSpacing:2,borderRadius:1}}>
                        <span>AGOTADO</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* Info */}
                <div style={{padding:"6px 8px 10px",overflow:"hidden"}}>
                  <div style={{fontSize:11,fontWeight:600,color:"#222",lineHeight:1.4,marginBottom:3,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                    {p.nombre}
                  </div>
                  {p.categoria&&(
                    <div style={{fontSize:9,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>
                      <span>{p.categoria}</span>{p.color&&<span> . {p.color}</span>}
                    </div>
                  )}
                  <div style={{fontSize:14,fontWeight:900,color:"#e84040"}}>
                    <span>{mxn(p.precio)}</span>
                  </div>
                </div>
              </div>
            );
            return(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3,padding:"0 3px 3px",background:"#f0ece7"}}>
                {/* Columna izquierda — espaciador de 40px */}
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  <div style={{height:40,flexShrink:0}}/>
                  {izquierda.map((p,i)=><TarjetaProducto key={p.clave||i*2} p={p}/>)}
                </div>
                {/* Columna derecha — empieza desde arriba */}
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  {derecha.map((p,i)=><TarjetaProducto key={p.clave||i*2+1} p={p}/>)}
                </div>
              </div>
            );
          })()
        }
      </div>

      {/* ══ BARRA STICKY DEL CARRITO ══════════════════════════ */}
      {carrito.length>0&&(
        <div onClick={()=>setCarritoAbierto(true)} style={{position:"sticky",bottom:0,zIndex:100,background:C.black,margin:"10px 14px 14px",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{position:"relative"}}>
              <span style={{fontSize:22}}>🛒</span>
              <div style={{position:"absolute",top:-4,right:-4,background:C.terra,color:C.white,fontSize:9,fontWeight:900,width:16,height:16,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{carrito.length}</div>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:C.white}}>{carrito.length} artículo{carrito.length>1?"s":""}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>Toca para comprar</div>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:17,fontWeight:900,color:C.white}}>{mxn(subtotalCarrito+(zona?.price||0))}</div>
            <div style={{fontSize:10,color:C.terra,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Ver carrito →</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MIS PEDIDOS ──────────────────────────────────────────
function MisPedidos({onBack}){
  const[telefono,setTelefono]=useState("");
  const[pedidos,setPedidos]=useState([]);
  const[buscado,setBuscado]=useState(false);
  const[cargando,setCargando]=useState(false);
  async function buscar(){if(telefono.length<8)return;setCargando(true);const todos=await dbGetAll(COL.pedidos);setPedidos(todos.filter(o=>o.cliente?.telefono?.replace(/\D/g,"").includes(telefono.replace(/\D/g,""))));setBuscado(true);setCargando(false);}
  return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title="Mis pedidos" subtitle="Historial de compras" onBack={onBack}/>
      <div style={{padding:"16px"}}>
        <Card style={{marginBottom:16,padding:"18px"}}>
          <Inp label="Tu WhatsApp (10 dígitos)" value={telefono} onChange={setTelefono} placeholder="951 234 5678" type="tel"/>
          <Btn label={cargando?"Buscando…":"Buscar mis pedidos"} onClick={buscar} disabled={telefono.length<8||cargando}/>
        </Card>
        {cargando&&<Loading message="Buscando…"/>}
        {buscado&&!cargando&&pedidos.length===0&&<EmptyState icon="📭" title="Sin pedidos" sub="No encontramos pedidos con ese número"/>}
        {pedidos.map((o,i)=>{
          const s=ORDER_STATUS[o.status]||ORDER_STATUS.nuevo;
          const articulos=o.carrito||[];
          return(
            <Card key={i} style={{marginBottom:12,borderLeft:`3px solid ${s.color}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><div style={{fontSize:12,fontWeight:700,color:C.black}}>#{o.id}</div><span style={{fontSize:11,fontWeight:700,color:s.color}}>{s.e} {s.label}</span></div>
              <div style={{fontSize:20,fontWeight:900,color:C.sale,marginBottom:6}}>{mxn(o.total)} MXN</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:4}}>📍 {o.zona?.name} · 📅 {o.zona?.days}</div>
              {articulos.length>0&&<div style={{fontSize:12,color:C.muted,marginBottom:10}}>{articulos.slice(0,2).map(i=>i.nombre).join(", ")}{articulos.length>2?` +${articulos.length-2} más`:""}</div>}
              <WaBtn tel={STORE_CONFIG.ownerPhone} msg={`Hola! Soy ${o.cliente?.nombre}. Pregunto por mi pedido CASI #${o.id} (${mxn(o.total)} MXN). ¿Cuándo llega?`} label="Preguntar por WhatsApp"/>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────
function AdminDashboard({pedidos,inventario,onNav}){
  const hoy=new Date().toISOString().slice(0,10);
  const pedidosHoy=pedidos.filter(o=>o.createdAt?.startsWith(hoy));
  const ventasHoy=pedidosHoy.reduce((a,o)=>a+(o.total||0),0);
  const nuevos=pedidos.filter(o=>o.status==="nuevo").length;
  const verificando=pedidos.filter(o=>o.status==="verificando").length;
  const enVenta=inventario.filter(p=>p.estado==="en_venta").length;
  const enBodega=inventario.filter(p=>p.estado==="en_bodega").length;
  const provisionales=inventario.filter(p=>p.esProvisional).length;
  return(
    <div style={{padding:"0 16px 32px",background:C.cream,minHeight:"100%"}}>
      <div style={{padding:"20px 0 14px"}}>
        <div style={{fontSize:11,fontWeight:700,color:C.terra,letterSpacing:3,textTransform:"uppercase",marginBottom:2}}>Panel de control</div>
        <div style={{fontSize:24,fontWeight:900,color:C.black,fontFamily:FONT.display}}>Inicio</div>
      </div>
      {(nuevos>0||verificando>0)&&<InfoBox type="warn">🔔 {nuevos>0?`${nuevos} pedido${nuevos>1?"s":""} nuevo${nuevos>1?"s":""}`:""}{nuevos>0&&verificando>0?" · ":""}{verificando>0?`${verificando} transferencia${verificando>1?"s":""} por verificar`:""}</InfoBox>}
      {provisionales>0&&<InfoBox type="info">⚠️ {provisionales} productos con costo provisional — registra el envío para completar</InfoBox>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {[{e:"💰",l:"Ventas hoy",v:mxn(ventasHoy),c:C.terra,sc:"orders"},{e:"📋",l:"Pedidos hoy",v:pedidosHoy.length,c:C.info,sc:"orders"},{e:"🛍️",l:"En venta",v:enVenta,c:C.ok,sc:"inventory"},{e:"📦",l:"En bodega",v:enBodega,c:C.warn,sc:"inventory"}].map(s=>(
          <Card key={s.l} onClick={()=>onNav(s.sc)} style={{borderLeft:`3px solid ${s.c}`,padding:12,cursor:"pointer"}}>
            <div style={{fontSize:20}}>{s.e}</div>
            <div style={{fontSize:20,fontWeight:900,color:C.black,fontFamily:FONT.display,marginTop:4}}>{s.v}</div>
            <div style={{fontSize:11,color:C.muted}}>{s.l}</div>
          </Card>
        ))}
      </div>
      <SectionTitle>Accesos rápidos</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {[{e:"🧾",l:"Tickets",sc:"tickets"},{e:"✈️",l:"Envíos",sc:"shipments"},{e:"📦",l:"Inventario",sc:"inventory"},{e:"📋",l:"Pedidos",sc:"orders"},{e:"🛵",l:"Repartidores",sc:"drivers"},{e:"🏪",l:"Vendedores",sc:"vendors"}].map(a=>(
          <button key={a.sc} onClick={()=>onNav(a.sc)} style={{background:C.white,border:`1.5px solid ${C.border}`,padding:"14px 12px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
            <span style={{fontSize:22}}>{a.e}</span><span style={{fontSize:13,fontWeight:700,color:C.black}}>{a.l}</span>
          </button>
        ))}
      </div>
      <SectionTitle>Últimos pedidos</SectionTitle>
      {pedidos.length===0&&<div style={{fontSize:13,color:C.muted,textAlign:"center",padding:"20px 0"}}>Sin pedidos aún</div>}
      {pedidos.slice(0,5).map((o,i)=>{
        const s=ORDER_STATUS[o.status]||ORDER_STATUS.nuevo;
        const articulos=o.carrito||[];
        return(
          <Card key={i} style={{marginBottom:8,padding:"12px 14px",borderLeft:`3px solid ${s.color}`}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.black}}>{o.cliente?.nombre||"—"}</div>
                <div style={{fontSize:11,color:C.muted}}>#{o.id} · {o.zona?.name}</div>
                {articulos.length>0&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{articulos.slice(0,2).map(i=>i.nombre).join(", ")}{articulos.length>2?` +${articulos.length-2} más`:""}</div>}
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:13,fontWeight:700,color:C.sale}}>{mxn(o.total)}</div>
                <Badge c={s.color} bg={s.bg} label={`${s.e} ${s.label}`}/>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── ADMIN PEDIDOS ────────────────────────────────────────
function AdminPedidos({pedidos,onActualizarEstado,onBack}){
  const[filtro,setFiltro]=useState("todos");
  const filtros=["todos",...Object.keys(ORDER_STATUS)];
  const visibles=filtro==="todos"?pedidos:pedidos.filter(o=>o.status===filtro);
  const nuevos=pedidos.filter(o=>o.status==="nuevo").length;
  const verificando=pedidos.filter(o=>o.status==="verificando").length;
  return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title="Pedidos" subtitle={`${pedidos.length} en total`} onBack={onBack}/>
      <div style={{padding:"0 14px 32px"}}>
        <div style={{display:"flex",gap:8,paddingTop:12,marginBottom:12,flexWrap:"wrap"}}>
          {nuevos>0&&<Badge c={C.warn} bg={C.warnFade} label={`🔔 ${nuevos} nuevo${nuevos>1?"s":""}`}/>}
          {verificando>0&&<Badge c={C.purple} bg={C.purpleFade} label={`⏳ ${verificando} verificando`}/>}
        </div>
        <InfoBox type="ok">🔴 En vivo — actualización automática en tiempo real</InfoBox>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,marginBottom:14,scrollbarWidth:"none"}}>
          {filtros.map(f=>{const s=ORDER_STATUS[f]||{};return(
            <button key={f} onClick={()=>setFiltro(f)} style={{padding:"7px 12px",border:"none",cursor:"pointer",flexShrink:0,background:filtro===f?(s.color||C.black):C.white,color:filtro===f?C.white:C.muted,fontSize:11,fontWeight:700,letterSpacing:.5,textTransform:"uppercase"}}>
              {s.e||"📋"} {f==="todos"?"Todos":s.label}
            </button>
          );})}
        </div>
        {visibles.length===0&&<EmptyState icon="📭" title="Sin pedidos" sub="Los pedidos aparecerán aquí en tiempo real"/>}
        {visibles.map((o,i)=>{
          const s=ORDER_STATUS[o.status]||ORDER_STATUS.nuevo;
          const d=new Date(o.createdAt);
          const fecha=`${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
          const articulos=o.carrito||[];
          return(
            <Card key={i} style={{marginBottom:12,borderLeft:`3px solid ${s.color}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div><div style={{fontSize:13,fontWeight:700,color:C.black}}>#{o.id}</div><div style={{fontSize:11,color:C.muted}}>{fecha}</div></div><Badge c={s.color} bg={s.bg} label={`${s.e} ${s.label}`}/></div>
              {o.status==="verificando"&&<InfoBox type="warn">
                <div style={{fontWeight:700,marginBottom:6}}>⏳ Verifica en tu banco</div>
                <div style={{marginBottom:8}}>Referencia: <strong>{o.referenciaPago||"no indicó"}</strong></div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>onActualizarEstado(o.id,"confirmado")} style={{flex:1,padding:"8px",background:C.ok,color:C.white,border:"none",fontSize:12,fontWeight:700,cursor:"pointer"}}>✓ Recibida</button>
                  <button onClick={()=>onActualizarEstado(o.id,"cancelado")} style={{flex:1,padding:"8px",background:C.dangerFade,color:C.danger,border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>✕ No recibida</button>
                </div>
              </InfoBox>}
              <div style={{fontSize:14,fontWeight:800,color:C.black,marginBottom:2}}>{o.cliente?.nombre}</div>
              <div style={{fontSize:12,color:C.muted}}>📞 {o.cliente?.telefono}</div>
              <div style={{fontSize:12,color:C.muted}}>📍 {o.zona?.name} · 📅 {o.zona?.days}{o.cliente?.referencia?` · 🏠 ${o.cliente.referencia}`:""}</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{o.metodoPago==="cod"?"💵 Contra entrega":"📲 Transferencia"+(o.referenciaPago?" · Ref: "+o.referenciaPago:"")}</div>
              {articulos.length>0&&(
                <div style={{background:C.stone,padding:"10px 12px",marginBottom:10}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Productos del pedido</div>
                  {articulos.map((item,idx)=>(
                    <div key={idx} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:idx<articulos.length-1?`1px solid ${C.border}`:"none"}}>
                      <span style={{fontSize:12,color:C.black}}>{item.nombre}{item.talla?" T:"+item.talla:""}{item.color?" / "+item.color:""}</span>
                      <span style={{fontSize:12,fontWeight:700,color:C.terra}}>{mxn(item.precio)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${C.border}`,paddingTop:10,marginBottom:10}}>
                <div style={{fontSize:18,fontWeight:900,color:C.sale}}>{mxn(o.total)} MXN</div>
                {o.cliente?.telefono&&<WaBtn small tel={o.cliente.telefono} msg={`Hola ${o.cliente?.nombre}! Soy CASI 🛍️. Tu pedido #${o.id} está *${s.label.toLowerCase()}*. Total: ${mxn(o.total)} MXN.`} label="WA Cliente"/>}
              </div>
              <div style={{fontSize:10,color:C.muted,marginBottom:6,letterSpacing:1.5,textTransform:"uppercase"}}>Cambiar estado:</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {Object.entries(ORDER_STATUS).filter(([k])=>k!==o.status).map(([k,v])=>(
                  <button key={k} onClick={()=>onActualizarEstado(o.id,k)} style={{padding:"6px 10px",background:v.bg,border:`1px solid ${v.color}33`,fontSize:11,fontWeight:600,cursor:"pointer",color:v.color}}>{v.e} {v.label}</button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── REPARTIDOR ───────────────────────────────────────────
function AppRepartidor({onBack}){
  const[pedidos,setPedidos]=useState([]);
  const[cargando,setCargando]=useState(true);
  const[telefono,setTelefono]=useState("");
  const[entro,setEntro]=useState(false);
  const unsubRef=useRef(null);
  useEffect(()=>{
    if(!entro)return;
    unsubRef.current=dbListen(COL.pedidos,data=>{setPedidos(data.filter(o=>["confirmado","preparando","en_ruta"].includes(o.status)));setCargando(false);});
    return()=>unsubRef.current?.();
  },[entro]);
  if(!entro)return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title="Repartidor" subtitle="Acceso a mis entregas" onBack={onBack}/>
      <div style={{padding:"24px 18px"}}>
        <InfoBox type="info">Ingresa tu número de WhatsApp para ver tus entregas del día.</InfoBox>
        <Inp label="Tu WhatsApp" value={telefono} onChange={setTelefono} placeholder="951 234 5678" type="tel"/>
        <Btn label="Entrar" onClick={()=>setEntro(true)} disabled={telefono.length<10}/>
      </div>
    </div>
  );
  if(cargando)return<Loading message="Cargando entregas…"/>;
  return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title="Mis entregas" subtitle="Hoy" onBack={()=>{setEntro(false);unsubRef.current?.();}}/>
      <div style={{padding:"0 16px 32px"}}>
        <StatsRow items={[{value:pedidos.filter(o=>o.status==="en_ruta").length,label:"En ruta",color:C.terra},{value:pedidos.filter(o=>o.status==="preparando").length,label:"Preparando",color:C.info},{value:pedidos.filter(o=>o.status==="confirmado").length,label:"Por salir",color:C.warn}]}/>
        {pedidos.length===0&&<EmptyState icon="🛵" title="Sin entregas asignadas" sub="Tus entregas aparecerán aquí"/>}
        {pedidos.map((o,i)=>{
          const s=ORDER_STATUS[o.status]||ORDER_STATUS.confirmado;
          const articulos=o.carrito||[];
          return(
            <Card key={i} style={{marginBottom:12,borderLeft:`3px solid ${s.color}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{fontSize:14,fontWeight:800,color:C.black}}>{o.cliente?.nombre}</div><Badge c={s.color} bg={s.bg} label={`${s.e} ${s.label}`}/></div>
              <div style={{fontSize:12,color:C.muted}}>📍 {o.zona?.name}</div>
              <div style={{fontSize:12,color:C.muted}}>🏠 {o.cliente?.referencia||"Sin referencia"}</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:6}}>📞 {o.cliente?.telefono} · {o.metodoPago==="cod"?`💵 Cobrar ${mxn(o.total)} MXN`:"📲 Ya pagó"}</div>
              {articulos.length>0&&<div style={{background:C.stone,padding:"8px 10px",marginBottom:10,fontSize:12,color:C.black}}>{articulos.map(i=>i.nombre+(i.talla?" T:"+i.talla:"")).join(" · ")}</div>}
              <div style={{display:"flex",gap:8}}>
                {o.status!=="en_ruta"&&<button onClick={()=>dbUpdate(COL.pedidos,o.id,{status:"en_ruta"})} style={{flex:1,padding:"10px",background:C.terra,color:C.white,border:"none",fontSize:12,fontWeight:700,cursor:"pointer"}}>🛵 Salir a entregar</button>}
                {o.status==="en_ruta"&&<button onClick={()=>dbUpdate(COL.pedidos,o.id,{status:"entregado",entregadoEn:new Date().toISOString()})} style={{flex:1,padding:"10px",background:C.ok,color:C.white,border:"none",fontSize:12,fontWeight:700,cursor:"pointer"}}>✅ Entregado</button>}
                <WaBtn small tel={o.cliente?.telefono} msg={`Hola ${o.cliente?.nombre}! Soy el repartidor de CASI 🛵. Voy en camino a ${o.zona?.name}.`} label="Avisar"/>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── VENDEDOR ─────────────────────────────────────────────
function AppVendedor({onBack}){
  const[nombreTienda,setNombreTienda]=useState("");
  const[entro,setEntro]=useState(false);
  const[pedidos,setPedidos]=useState([]);
  const[productos,setProductos]=useState([]);
  const[cargando,setCargando]=useState(false);
  async function entrar(){if(!nombreTienda.trim())return;setCargando(true);const[prods,peds]=await Promise.all([dbGetAll(COL.inventario),dbGetAll(COL.pedidos)]);setProductos(prods.filter(p=>p.vendedor===nombreTienda));setPedidos(peds.filter(o=>(o.carrito||[]).some(i=>i.vendedor===nombreTienda)));setEntro(true);setCargando(false);}
  if(!entro)return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title="Vendedor" subtitle="Acceso a mi tienda" onBack={onBack}/>
      <div style={{padding:"24px 18px"}}>
        <InfoBox type="info">Ingresa el nombre de tu tienda tal como fue registrado con CASI.</InfoBox>
        <Inp label="Nombre de tu tienda" value={nombreTienda} onChange={setNombreTienda} placeholder="TechOax"/>
        <Btn label={cargando?"Cargando…":"Entrar"} onClick={entrar} disabled={nombreTienda.trim().length<2||cargando}/>
      </div>
    </div>
  );
  const totalVentas=pedidos.reduce((a,o)=>{const mios=(o.carrito||[]).filter(i=>i.vendedor===nombreTienda);return a+mios.reduce((x,i)=>x+(i.precio||0),0);},0);
  const comision=totalVentas*0.10;
  return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title={nombreTienda} subtitle="Mi tienda en CASI" onBack={()=>setEntro(false)}/>
      <div style={{padding:"16px 16px 32px"}}>
        <Card style={{background:`linear-gradient(135deg,${C.terra},${C.terraD})`,padding:"18px 20px",marginBottom:16}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Pendiente de cobro</div>
          <div style={{fontSize:28,fontWeight:900,color:C.white,fontFamily:FONT.display}}>{mxn(totalVentas-comision)}</div>
          <div style={{display:"flex",gap:16,marginTop:10}}>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>Ventas</div><div style={{fontSize:13,fontWeight:700,color:C.white}}>{mxn(totalVentas)}</div></div>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>Comisión 10%</div><div style={{fontSize:13,fontWeight:700,color:"rgba(255,200,150,.9)"}}>-{mxn(comision)}</div></div>
          </div>
        </Card>
        <InfoBox type="info">💡 CASI retiene 10% de comisión. El resto se liquida cada lunes.</InfoBox>
        <SectionTitle>Mis productos ({productos.length})</SectionTitle>
        {productos.length===0&&<EmptyState icon="🏪" title="Sin productos" sub="Habla con CASI para agregar tus productos"/>}
        {productos.slice(0,10).map(p=>(
          <Card key={p.clave} style={{marginBottom:8,padding:"12px 14px"}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <div style={{width:48,height:60,overflow:"hidden",flexShrink:0,position:"relative",background:C.stone}}><FadeImg src={p.foto} alt={p.nombre}/></div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.black}}>{p.nombre}</div>
                <div style={{fontSize:12,fontWeight:700,color:C.sale}}>{mxn(p.precio)} MXN</div>
                <Badge c={p.estado==="en_venta"?C.ok:C.warn} bg={p.estado==="en_venta"?C.okFade:C.warnFade} label={p.estado==="en_venta"?"✅ En venta":"📦 En bodega"} small/>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── APP RAÍZ ─────────────────────────────────────────────
export default function App(){
  const[modo,setModo]=useState("store");
  const[tabAdmin,setTabAdmin]=useState("dashboard");
  const[adminAbierto,setAdminAbierto]=useState(false);
  const[tabTienda,setTabTienda]=useState("store");
  const[pedidos,setPedidos]=useState([]);
  const[inventario,setInventario]=useState([]);
  const[fbOk,setFbOk]=useState(false);
  const[listo,setListo]=useState(false);
  const unsubRef=useRef(null);

  useEffect(()=>{
    const l=document.createElement("link");
    l.href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap";
    l.rel="stylesheet";document.head.appendChild(l);
    initFirebase().then(async()=>{
      setFbOk(true);
      unsubRef.current=dbListen(COL.pedidos,data=>setPedidos(data));
      const inv=await dbGetAll(COL.inventario,"createdAt","desc");
      setInventario(inv);
      setListo(true);
    }).catch(()=>setListo(true));
    return()=>{if(unsubRef.current)unsubRef.current();};
  },[]);

  async function guardarPedido(pedido){try{await dbAdd(COL.pedidos,pedido);}catch(e){console.error(e);}}
  async function actualizarEstado(id,status){try{await dbUpdate(COL.pedidos,id,{status});}catch(e){console.error(e);}}

  const alertas=pedidos.filter(o=>["nuevo","verificando"].includes(o.status)).length;

  if(!listo)return(
    <div translate="no" style={{minHeight:"100vh",background:C.black,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT.body}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:42,fontWeight:900,color:C.white,letterSpacing:16,fontFamily:"serif",marginBottom:16}}>CASI</div>
        <div style={{display:"flex",gap:6,justifyContent:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:C.terra,animation:`ld .8s ease-in-out ${i*0.2}s infinite alternate`}}/>)}</div>
        <style>{`@keyframes ld{from{opacity:.3;transform:scale(.8)}to{opacity:1;transform:scale(1)}}`}</style>
      </div>
    </div>
  );

  const MODOS=[{id:"store",label:"🛍️ Tienda"},{id:"driver",label:"🛵 Repartidor"},{id:"vendor",label:"🏪 Vendedor"},{id:"admin",label:"👑 Admin"}];
  const TABS_ADMIN=[{id:"dashboard",label:"Inicio"},{id:"orders",label:`Pedidos${alertas>0?" ("+alertas+")":""}`},{id:"tickets",label:"Tickets"},{id:"shipments",label:"Envíos"},{id:"inventory",label:"Inventario"},{id:"drivers",label:"Repartos"},{id:"vendors",label:"Vendedores"}];
  const TABS_TIENDA=[{id:"store",label:"Tienda",icon:"◈"},{id:"orders",label:"Pedidos",icon:"◎"}];

  function renderContenido(){
    if(modo==="store"){
      if(tabTienda==="store")return<Store onOrder={guardarPedido}/>;
      if(tabTienda==="orders")return<MisPedidos onBack={()=>setTabTienda("store")}/>;
    }
    if(modo==="driver")return<AppRepartidor onBack={()=>setModo("store")}/>;
    if(modo==="vendor")return<AppVendedor onBack={()=>setModo("store")}/>;
    if(modo==="admin"){
      if(!adminAbierto)return<PinLock correct={STORE_CONFIG.adminPin} onUnlock={()=>setAdminAbierto(true)} title="Admin CASI"/>;
      if(tabAdmin==="dashboard")return<AdminDashboard pedidos={pedidos} inventario={inventario} onNav={t=>setTabAdmin(t)}/>;
      if(tabAdmin==="orders")return<AdminPedidos pedidos={pedidos} onActualizarEstado={actualizarEstado} onBack={()=>setTabAdmin("dashboard")}/>;
      if(tabAdmin==="tickets")return<TicketsScreen onBack={()=>setTabAdmin("dashboard")}/>;
      if(tabAdmin==="shipments")return<ShipmentsScreen onBack={()=>setTabAdmin("dashboard")}/>;
      if(tabAdmin==="inventory")return<InventoryScreen
          inventory={inventario}
          onRefresh={async()=>{const inv=await dbGetAll(COL.inventario,"createdAt","desc");setInventario(inv);}}
          onBack={()=>setTabAdmin("dashboard")}/>;
      if(tabAdmin==="drivers")return<EmptyState icon="🛵" title="Repartidores" sub="Módulo en construcción"/>;
      if(tabAdmin==="vendors")return<EmptyState icon="🏪" title="Vendedores" sub="Módulo en construcción"/>;
    }
    return null;
  }

  return(
    <div style={{minHeight:"100vh",background:"#111",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 12px",fontFamily:FONT.body}}>
      <div style={{marginBottom:12,display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
        {MODOS.map(m=>(
          <button key={m.id} onClick={()=>{setModo(m.id);if(m.id!=="admin")setAdminAbierto(false);if(m.id==="store")setTabTienda("store");}} style={{padding:"7px 14px",border:"none",cursor:"pointer",background:modo===m.id?C.terra:"rgba(255,255,255,0.1)",color:C.white,fontSize:12,fontWeight:700,letterSpacing:.5,boxShadow:modo===m.id?`0 4px 14px ${C.terra}55`:"none",transition:"all .2s"}}>{m.label}</button>
        ))}
      </div>
      <div style={{width:390,maxWidth:"100%",background:C.cream,overflow:"hidden",boxShadow:"0 60px 120px rgba(0,0,0,0.9),0 0 0 1px rgba(255,255,255,0.08)",display:"flex",flexDirection:"column",maxHeight:"90vh"}}>
        <OfflineBanner/>
        {fbOk&&<div style={{background:C.okFade,padding:"5px 14px",display:"flex",alignItems:"center",gap:8,borderBottom:`1px solid ${C.border}`}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:C.ok,animation:"pulse 2s infinite"}}/>
          <span style={{fontSize:10,color:C.ok,fontWeight:700,letterSpacing:1}}>FIREBASE · EN VIVO</span>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </div>}
        {modo==="admin"&&adminAbierto&&(
          <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,display:"flex",overflowX:"auto",scrollbarWidth:"none",flexShrink:0}}>
            {TABS_ADMIN.map(t=>(
              <button key={t.id} onClick={()=>setTabAdmin(t.id)} style={{padding:"10px 11px",background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:tabAdmin===t.id?700:500,color:tabAdmin===t.id?C.terra:C.muted,borderBottom:`2px solid ${tabAdmin===t.id?C.terra:"transparent"}`,transition:"all .2s",whiteSpace:"nowrap",flexShrink:0}}>{t.label}</button>
            ))}
          </div>
        )}
        <div style={{flex:1,overflowY:"auto",background:C.cream}}>
          {renderContenido()}
        </div>
        {modo==="store"&&(
          <div style={{background:C.white,borderTop:`1px solid ${C.border}`,display:"flex"}}>
            {TABS_TIENDA.map(t=>(
              <button key={t.id} onClick={()=>setTabTienda(t.id)} style={{flex:1,padding:"14px 0",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,borderTop:`2px solid ${tabTienda===t.id?C.black:"transparent"}`,transition:"all .2s"}}>
                <span style={{fontSize:18,color:tabTienda===t.id?C.black:C.muted}}>{t.icon}</span>
                <span style={{fontSize:10,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:tabTienda===t.id?C.black:C.muted}}>{t.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{marginTop:12,fontSize:10,color:"rgba(255,255,255,0.2)",textAlign:"center",lineHeight:2,letterSpacing:1}}>
        CASI · SIERRA SUR, OAXACA · FIREBASE EN VIVO<br/>ADMIN PIN: {STORE_CONFIG.adminPin}
      </div>
    </div>
  );
}