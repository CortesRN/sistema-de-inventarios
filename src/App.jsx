import { useState, useEffect, useRef } from "react";
import { C, FONT, Btn, WaBtn, Inp, Card, SectionTitle, TopBar,
         InfoBox, Badge, Loading, EmptyState, PinLock, StatsRow, OfflineBanner } from "./ui.jsx";
import { initFirebase, dbAdd, dbUpdate, dbGetAll, dbWhere, dbListen } from "./firebase.js";
import { TicketsScreen } from "./Tickets.jsx";
import { ShipmentsScreen } from "./Shipments.jsx";
import { InventoryScreen } from "./Inventory.jsx";
import { COL, ZONES, BASE_COORDS, STORE_CONFIG, ORDER_STATUS } from "./config.js";

// ─── FORMATEO SEGURO (sin toLocaleString) ────────────────
function numFmt(n, dec=2){
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
  {name:"Tu pueblo (demo)",lat:BASE_COORDS.lat,lng:BASE_COORDS.lng},
  {name:"San Sebastián R.H.",lat:BASE_COORDS.lat+0.07,lng:BASE_COORDS.lng+0.05},
  {name:"Putla de Guerrero",lat:BASE_COORDS.lat+0.18,lng:BASE_COORDS.lng+0.14},
  {name:"Juquila",lat:BASE_COORDS.lat+0.42,lng:BASE_COORDS.lng+0.35},
];

function optimImg(url){
  if(!url)return url;
  if(url.includes("cloudinary.com"))return url.replace("/upload/","/upload/w_600,q_75,f_auto/");
  return url;
}
function buildWaMsg(order){
  const items=(order.cart||[]).map(i=>`  • ${i.name}${i.size?" T:"+i.size:""}${i.color?" / "+i.color:""} — ${mxn(i.price)}`).join("\n");
  return `🛍️ *PEDIDO ${order.id} — CASI*\n\n👤 *${order.client?.name}*\n📞 ${order.client?.phone}\n📍 ${order.zone?.name} (${order.zone?.days})\n🏠 ${order.client?.address||"Sin referencia"}\n\n*Artículos:*\n${items}\n\n💰 *TOTAL: ${mxn(order.total)} MXN*\n${order.method==="cod"?"💵 Contra entrega":"📲 Transferencia — Ref: "+order.ref}`;
}

function FadeImg({src,alt}){
  const[ok,setOk]=useState(false);
  return(
    <div style={{position:"relative",width:"100%",height:"100%",background:C.stone}}>
      {!ok&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:C.muted,opacity:.2}}>▣</div>}
      {src&&<img src={optimImg(src)} alt={alt} onLoad={()=>setOk(true)} loading="lazy"
        style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:ok?1:0,transition:"opacity .4s"}}/>}
    </div>
  );
}

// ─── GPS LOCATOR ──────────────────────────────────────────
function LocationPicker({onDone,onBack}){
  const[st,setSt]=useState("idle");
  const[zone,setZone]=useState(null);
  function detect(){setSt("busy");if(!navigator.geolocation){setSt("list");return;}navigator.geolocation.getCurrentPosition(p=>{setZone(zoneFor(p.coords.latitude,p.coords.longitude));setSt("found");},()=>setSt("list"),{timeout:8000});}
  function pick(t){setZone({...zoneFor(t.lat,t.lng),km:calcKm(BASE_COORDS.lat,BASE_COORDS.lng,t.lat,t.lng).toFixed(1)});setSt("found");}
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
            <button key={z.id} onClick={()=>{setZone({...z,km:"—"});setSt("found");}} style={{width:"100%",textAlign:"left",marginBottom:10,padding:"16px 18px",background:C.white,border:`1.5px solid ${C.border}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
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
        {st==="found"&&zone&&<div>
          <div style={{display:"flex",gap:14,alignItems:"center",padding:"20px 0",borderBottom:`1px solid ${C.border}`,marginBottom:16}}>
            <div style={{fontSize:44}}>📍</div>
            <div><div style={{fontSize:18,fontWeight:900,color:C.black,fontFamily:FONT.display}}>{zone.name}</div>{zone.km!=="—"&&<div style={{fontSize:12,color:C.muted}}>{zone.km} km de la tienda</div>}</div>
          </div>
          {zone.price&&zone.active?<>
            <InfoBox type="ok"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><strong>Con cobertura ✓</strong><br/>{zone.time} · 📅 {zone.days}</div><div style={{fontSize:22,fontWeight:900,color:C.terra}}>+${zone.price}</div></div></InfoBox>
            <Btn label="Confirmar esta zona ✓" onClick={()=>onDone(zone)} color={C.ok}/>
          </>:<><InfoBox type="danger">Sin cobertura aún — próximamente 🙌</InfoBox><Btn label="Elegir otra zona" onClick={()=>setSt("list")} outline/></>}
        </div>}
      </div>
    </div>
  );
}

// ─── CHECKOUT ─────────────────────────────────────────────
function Checkout({cart,zone,onBack,onConfirm}){
  const[step,setStep]=useState("info");
  const[name,setName]=useState("");
  const[phone,setPhone]=useState("");
  const[addr,setAddr]=useState("");
  const[method,setMethod]=useState(null);
  const[ref,setRef]=useState("");
  const[done,setDone]=useState(false);
  const[saving,setSaving]=useState(false);
  const sub=cart.reduce((a,i)=>a+(i.price||0),0);
  const total=sub+(zone?.price||0);
  const orderId="C-"+Date.now().toString().slice(-6);
  const canInfo=name.trim().length>2&&phone.replace(/\D/g,"").length>=10;
  const canPay=method&&(method!=="transfer"||ref.length>3);
  const order={id:orderId,cart,zone,method,ref,total,status:method==="transfer"?"verificando":"nuevo",client:{name,phone,address:addr},createdAt:new Date().toISOString()};
  async function handleConfirm(){if(!canPay)return;setSaving(true);await onConfirm(order);setSaving(false);setDone(true);}
  if(done)return(
    <div style={{padding:"0 20px 32px",background:C.cream,minHeight:"100%",textAlign:"center"}}>
      <div style={{padding:"48px 0 24px"}}>
        <div style={{fontSize:64,marginBottom:16}}>🎉</div>
        <div style={{fontSize:10,fontWeight:700,color:C.terra,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>Pedido confirmado</div>
        <div style={{fontSize:26,fontWeight:900,color:C.black,fontFamily:FONT.display,marginBottom:6,lineHeight:1.2}}>Todo listo,<br/>{name.split(" ")[0]}</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:24}}>Pedido #{orderId}</div>
        <Card style={{marginBottom:16,padding:"14px 20px",textAlign:"left"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,color:C.muted}}>Total</span><span style={{fontSize:18,fontWeight:900,color:C.sale}}>{mxn(total)} MXN</span></div>
          <div style={{fontSize:12,color:C.muted}}>📍 {zone?.name} · 📅 {zone?.days}</div>
        </Card>
        <InfoBox type="ok">✅ Guardado — el equipo CASI ya lo recibió</InfoBox>
        <div style={{marginBottom:14}}><WaBtn tel={STORE_CONFIG.ownerPhone} msg={buildWaMsg(order)} label="Confirmar por WhatsApp"/></div>
        <button onClick={onBack} style={{fontSize:13,color:C.terra,background:"none",border:"none",cursor:"pointer",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>← Seguir comprando</button>
      </div>
    </div>
  );
  return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title={step==="info"?"Tus datos":"Método de pago"} subtitle={`Entrega a ${zone?.name}`} onBack={onBack}/>
      <div style={{padding:"16px 16px 0"}}>
        <div style={{display:"flex",gap:4,marginBottom:20}}>{["info","pago"].map(s=><div key={s} style={{flex:1,height:3,background:step==="pago"||s==="info"?C.black:C.border,transition:"background .3s"}}/>)}</div>
        {step==="info"&&<>
          <Card style={{marginBottom:16,background:C.terraL,padding:"12px 16px"}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:C.muted}}>Total</span><span style={{fontSize:18,fontWeight:900,color:C.terra}}>{mxn(total)} MXN</span></div></Card>
          <Inp label="Nombre completo" value={name} onChange={setName} placeholder="María González" required/>
          <Inp label="WhatsApp (10 dígitos)" value={phone} onChange={setPhone} placeholder="951 234 5678" type="tel" required hint="Te avisamos cuando salga tu pedido 🛵"/>
          <Inp label="Referencia de entrega" value={addr} onChange={setAddr} placeholder="Casa azul junto a la cancha" hint="Solo cómo encontrarte"/>
          <Btn label="Continuar →" onClick={()=>setStep("pago")} disabled={!canInfo}/>
        </>}
        {step==="pago"&&<>
          <Card style={{padding:"14px 18px",marginBottom:16}}><div style={{fontSize:14,fontWeight:800,color:C.black,marginBottom:2}}>{name}</div><div style={{fontSize:12,color:C.muted}}>📞 {phone}{addr&&" · 🏠 "+addr}</div></Card>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:14}}>Método de pago</div>
          {[{id:"cod",icon:"💵",label:"Contra entrega",desc:"Pagas en efectivo cuando recibes."},{id:"transfer",icon:"📲",label:"Transferencia bancaria",desc:"Pagas antes. Confirmamos más rápido."}].map(m=>(
            <button key={m.id} onClick={()=>setMethod(m.id)} style={{width:"100%",textAlign:"left",padding:"16px 18px",marginBottom:12,background:C.white,border:`2px solid ${method===m.id?C.black:C.border}`,cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <span style={{fontSize:26}}>{m.icon}</span>
                <div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,color:C.black}}>{m.label}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{m.desc}</div></div>
                <div style={{width:20,height:20,border:`2px solid ${method===m.id?C.black:C.border}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{method===m.id&&<div style={{width:10,height:10,background:C.black,borderRadius:"50%"}}/>}</div>
              </div>
            </button>
          ))}
          {method==="transfer"&&<InfoBox type="info">
            <div style={{marginBottom:8,fontWeight:700}}>Datos bancarios</div>
            {[["Banco",STORE_CONFIG.bank],["Nombre",STORE_CONFIG.ownerName],["CLABE",STORE_CONFIG.clabe],["Monto",`${mxn(total)} MXN`]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted}}>{l}</span><strong>{v}</strong></div>
            ))}
            <div style={{marginTop:10}}><Inp value={ref} onChange={setRef} placeholder="Folio del comprobante" hint="Número de referencia de tu banco"/></div>
          </InfoBox>}
          <Btn label={saving?"Guardando…":canPay?"Confirmar pedido ✓":"Elige cómo pagas"} onClick={handleConfirm} disabled={!canPay||saving}/>
        </>}
      </div>
    </div>
  );
}

// ─── PUBLIC STORE ─────────────────────────────────────────
function Store({onOrder}){
  const[products,setProducts]=useState([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[selected,setSelected]=useState(null);
  const[cart,setCart]=useState(()=>{try{const s=localStorage.getItem("casi:cart");return s?JSON.parse(s):[];}catch{return[];}});
  const[zone,setZone]=useState(()=>{try{const s=localStorage.getItem("casi:zone");return s?JSON.parse(s):null;}catch{return null;}});
  const[screen,setScreen]=useState("catalog");
  const[cartOpen,setCartOpen]=useState(false);
  const[filtersOpen,setFiltersOpen]=useState(false);

  // ── Filtros activos
  const[fCat,setFCat]=useState([]);
  const[fGender,setFGender]=useState([]);
  const[fPriceMax,setFPriceMax]=useState(null);
  const[sortBy,setSortBy]=useState("default");

  /*useEffect(()=>{
    dbWhere(COL.inventory,"active","==",true).then(items=>{
      setProducts(items);
      setLoading(false);
    });
  },[]);*/
  // NUEVA VERSIÓN — filtra en el navegador, sin índice:
  useEffect(()=>{
    dbGetAll(COL.inventory,"createdAt","desc").then(items=>{
      setProducts(items.filter(p=>p.active===true));
      setLoading(false);
    }).catch(err=>{
      console.error("Error cargando inventario:",err);
      setLoading(false);
    });
  },[]);
  useEffect(()=>{try{localStorage.setItem("casi:cart",JSON.stringify(cart));}catch{}},[cart]);
  useEffect(()=>{try{if(zone)localStorage.setItem("casi:zone",JSON.stringify(zone));}catch{}},[zone]);

  // ── Opciones de filtro derivadas del inventario real
  const CATS=[...new Set(products.map(p=>p.cat).filter(Boolean).sort())];
  const GENDERS=[...new Set(products.map(p=>p.gender).filter(Boolean).sort())];
  const prices=products.map(p=>p.salePrice).filter(p=>typeof p==="number"&&p>0);
  const maxPrice=prices.length?Math.ceil(prices.reduce((a,b)=>a>b?a:b,0)/200)*200:1000;
  const PRICE_OPTS=[200,400,600,800,1000].filter(p=>p<=maxPrice+200);

  const activeFilters=fCat.length+fGender.length+(fPriceMax?1:0);

  // ── Aplicar filtros y ordenamiento
  let vis=products.filter(p=>{
    if(search&&!p.name?.toLowerCase().includes(search.toLowerCase()))return false;
    if(fCat.length&&!fCat.includes(p.cat))return false;
    if(fGender.length&&!fGender.includes(p.gender))return false;
    if(fPriceMax&&p.salePrice>fPriceMax)return false;
    return true;
  });
  if(sortBy==="price_asc")vis=[...vis].sort((a,b)=>a.salePrice-b.salePrice);
  if(sortBy==="price_desc")vis=[...vis].sort((a,b)=>b.salePrice-a.salePrice);
  if(sortBy==="newest")vis=[...vis].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

  const cartSub=cart.reduce((a,i)=>a+(i.price||0),0);
  function addToCart(item){setCart(c=>[...c,item]);}
  function removeFromCart(i){setCart(c=>c.filter((_,idx)=>idx!==i));}
  async function handleOrder(order){await onOrder(order);setCart([]);setSelected(null);setScreen("catalog");}
  function toggle(arr,set,val){set(prev=>prev.includes(val)?prev.filter(x=>x!==val):[...prev,val]);}
  function clearFilters(){setFCat([]);setFGender([]);setFPriceMax(null);setSortBy("default");}

  if(screen==="locator")return<LocationPicker onBack={()=>setScreen("catalog")} onDone={z=>{setZone(z);setScreen("catalog");}}/>;
  if(screen==="checkout")return<Checkout cart={cart} zone={zone} onBack={()=>setScreen("catalog")} onConfirm={handleOrder}/>;

  // ── Detalle de producto
  if(selected)return(
    <div style={{background:C.cream,minHeight:"100%",paddingBottom:100}}>
      <TopBar title="CASI" onBack={()=>setSelected(null)}/>
      <div style={{width:"100%",height:340,position:"relative",background:C.stone,overflow:"hidden"}}>
        {selected.img
          ?<img src={optimImg(selected.img)} alt={selected.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:64,color:C.muted,opacity:.3}}>📷</div>
        }
      </div>
      <div style={{padding:"20px 18px 0"}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>CASI · {selected.sku}</div>
        <div style={{fontSize:24,fontWeight:900,color:C.black,lineHeight:1.2,marginBottom:10,fontFamily:FONT.display}}>{selected.name}</div>
        <div style={{fontSize:28,fontWeight:900,color:C.sale,marginBottom:12}}>{mxn(selected.salePrice)}<span style={{fontSize:13,color:C.muted,fontWeight:400}}> MXN</span></div>
        {/* Badges de atributos */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          {selected.cat&&<span style={{padding:"5px 12px",background:C.stone,fontSize:11,fontWeight:700,color:C.black,letterSpacing:.5}}>{selected.cat}</span>}
          {selected.gender&&<span style={{padding:"5px 12px",background:C.stone,fontSize:11,fontWeight:600,color:C.muted}}>{selected.gender}</span>}
          {selected.talla&&<span style={{padding:"5px 12px",background:C.terraL,fontSize:11,fontWeight:900,color:C.terra,letterSpacing:.5}}>Talla {selected.talla}</span>}
          {selected.color&&<span style={{padding:"5px 12px",background:C.stone,fontSize:11,color:C.muted}}>{selected.color}</span>}
        </div>
        {selected.descr&&<Card style={{marginBottom:16,padding:"14px 16px"}}><div style={{fontSize:13,color:C.black,lineHeight:1.8}}>{selected.descr}</div></Card>}
        {zone
          ?<InfoBox type="ok">🛵 Envío a {zone.name}: <strong>${zone.price} MXN</strong> · {zone.time} · 📅 {zone.days}</InfoBox>
          :<InfoBox type="warn">📍 Selecciona tu zona para ver el costo de envío</InfoBox>
        }
      </div>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:390,padding:"12px 16px",boxSizing:"border-box",background:"rgba(248,244,239,0.97)",backdropFilter:"blur(8px)",borderTop:`1px solid ${C.border}`,zIndex:50}}>
        <button onClick={()=>{addToCart({...selected,price:selected.salePrice});setSelected(null);}} style={{width:"100%",padding:"16px",fontSize:13,fontWeight:900,letterSpacing:2,textTransform:"uppercase",background:C.black,color:C.white,border:"none",cursor:"pointer"}}>
          + AGREGAR AL CARRITO
        </button>
      </div>
    </div>
  );

  if(loading)return<Loading message="Cargando productos…"/>;

  return(
    <div style={{background:C.cream,minHeight:"100%",paddingBottom:8}}>

      {/* ══ CARRITO DRAWER ══════════════════════════════════ */}
      {cartOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:500}}>
          <div onClick={()=>setCartOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)"}}/>
          <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:390,background:C.cream,maxHeight:"88vh",overflowY:"auto",padding:"0 0 32px"}}>
            <div style={{padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:16,fontWeight:900,color:C.black,fontFamily:FONT.display,letterSpacing:2}}>MI CARRITO ({cart.length})</div>
              <button onClick={()=>setCartOpen(false)} style={{background:C.black,border:"none",width:32,height:32,cursor:"pointer",color:C.white,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
            <div style={{padding:"0 20px"}}>
              {cart.length===0
                ?<div style={{textAlign:"center",padding:"40px"}}><div style={{fontSize:48,marginBottom:12}}>🛒</div><div style={{fontSize:16,fontWeight:700,fontFamily:FONT.display}}>Carrito vacío</div></div>
                :<>
                  {cart.map((item,i)=>(
                    <div key={i} style={{display:"flex",gap:14,paddingBottom:16,marginBottom:16,borderBottom:`1px solid ${C.stone}`}}>
                      <div style={{width:70,height:88,overflow:"hidden",flexShrink:0,position:"relative",background:C.stone}}><FadeImg src={item.img} alt={item.name}/></div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:800,color:C.black,lineHeight:1.3,marginBottom:4,fontFamily:FONT.display}}>{item.name}</div>
                        <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{item.talla&&"T:"+item.talla}{item.talla&&item.color&&" · "}{item.color}</div>
                        <div style={{fontSize:17,fontWeight:900,color:C.sale}}>{mxn(item.price)}</div>
                      </div>
                      <button onClick={()=>removeFromCart(i)} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:18,alignSelf:"flex-start",padding:4}}>✕</button>
                    </div>
                  ))}
                  {zone
                    ?<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${C.stone}`,marginBottom:16}}>
                      <div><div style={{fontSize:13,fontWeight:700,color:C.black}}>📍 {zone.name}</div><div style={{fontSize:11,color:C.muted}}>{zone.time} · {zone.days}</div></div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:900,color:C.terra}}>+${zone.price}</div><button onClick={()=>{setCartOpen(false);setScreen("locator");}} style={{fontSize:10,color:C.info,background:"none",border:"none",cursor:"pointer"}}>Cambiar</button></div>
                    </div>
                    :<button onClick={()=>{setCartOpen(false);setScreen("locator");}} style={{width:"100%",padding:"13px",background:C.warnFade,border:`1.5px solid ${C.warn}`,fontSize:12,color:C.warn,fontWeight:700,cursor:"pointer",marginBottom:16,letterSpacing:1,textTransform:"uppercase"}}>📍 Selecciona zona de entrega</button>
                  }
                  <Card style={{padding:"16px",marginBottom:16}}>
                    {[["Subtotal",mxn(cartSub)],["Envío",zone?`$${zone.price}`:"Pendiente"]].map(([l,v])=>(
                      <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,color:C.muted}}>{l}</span><span style={{fontSize:13}}>{v}</span></div>
                    ))}
                    <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:`1px solid ${C.border}`}}><span style={{fontSize:14,fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>Total</span><span style={{fontSize:22,fontWeight:900,color:C.sale}}>{mxn(cartSub+(zone?.price||0))} MXN</span></div>
                  </Card>
                  <Btn label={zone?"Ir a pagar →":"Elige zona primero"} onClick={()=>{setCartOpen(false);if(zone)setScreen("checkout");else setScreen("locator");}} disabled={!zone}/>
                </>
              }
            </div>
          </div>
        </div>
      )}

      {/* ══ FILTROS DRAWER ══════════════════════════════════ */}
      {filtersOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:500}}>
          <div onClick={()=>setFiltersOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)"}}/>
          <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:390,background:C.cream,maxHeight:"92vh",overflowY:"auto",padding:"0 0 32px"}}>
            {/* Header filtros */}
            <div style={{padding:"18px 20px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.cream,zIndex:1}}>
              <div style={{fontSize:16,fontWeight:900,color:C.black,fontFamily:FONT.display,letterSpacing:2}}>FILTROS</div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                {(activeFilters>0||sortBy!=="default")&&(
                  <button onClick={clearFilters} style={{fontSize:11,color:C.terra,background:"none",border:"none",cursor:"pointer",fontWeight:700,letterSpacing:.5,textTransform:"uppercase"}}>
                    Limpiar todo
                  </button>
                )}
                <button onClick={()=>setFiltersOpen(false)} style={{background:C.black,border:"none",width:32,height:32,cursor:"pointer",color:C.white,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
            </div>

            <div style={{padding:"0 20px"}}>
              {/* Ordenar por */}
              <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:2,textTransform:"uppercase",padding:"16px 0 10px"}}>Ordenar por</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:4}}>
                {[["default","Relevancia"],["newest","Más nuevos"],["price_asc","Precio ↑"],["price_desc","Precio ↓"]].map(([k,l])=>(
                  <button key={k} onClick={()=>setSortBy(k)} style={{padding:"8px 14px",border:`1.5px solid ${sortBy===k?C.black:C.border}`,background:sortBy===k?C.black:"transparent",color:sortBy===k?C.white:C.black,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>{l}</button>
                ))}
              </div>

              {/* Categoría */}
              {CATS.length>0&&<>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:2,textTransform:"uppercase",padding:"16px 0 10px"}}>Categoría</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:4}}>
                  {CATS.map(c=>(
                    <button key={c} onClick={()=>toggle(fCat,setFCat,c)} style={{padding:"8px 14px",border:`1.5px solid ${fCat.includes(c)?C.black:C.border}`,background:fCat.includes(c)?C.black:"transparent",color:fCat.includes(c)?C.white:C.black,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>{c}</button>
                  ))}
                </div>
              </>}

              {/* Género */}
              {GENDERS.length>0&&<>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:2,textTransform:"uppercase",padding:"16px 0 10px"}}>Género</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:4}}>
                  {GENDERS.map(g=>(
                    <button key={g} onClick={()=>toggle(fGender,setFGender,g)} style={{padding:"8px 14px",border:`1.5px solid ${fGender.includes(g)?C.black:C.border}`,background:fGender.includes(g)?C.black:"transparent",color:fGender.includes(g)?C.white:C.black,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>{g}</button>
                  ))}
                </div>
              </>}

              {/* Precio máximo */}
              {PRICE_OPTS.length>0&&<>
                <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:2,textTransform:"uppercase",padding:"16px 0 10px"}}>Precio máximo</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
                  {PRICE_OPTS.map(p=>(
                    <button key={p} onClick={()=>setFPriceMax(fPriceMax===p?null:p)} style={{padding:"8px 14px",border:`1.5px solid ${fPriceMax===p?C.terra:C.border}`,background:fPriceMax===p?C.terraL:"transparent",color:fPriceMax===p?C.terra:C.black,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>hasta ${p}</button>
                  ))}
                </div>
              </>}
            </div>

            {/* Botón aplicar */}
            <div style={{padding:"0 20px"}}>
              <button onClick={()=>setFiltersOpen(false)} style={{width:"100%",padding:"16px",fontSize:13,fontWeight:900,letterSpacing:2,textTransform:"uppercase",background:C.black,color:C.white,border:"none",cursor:"pointer"}}>
                VER {vis.length} PRODUCTO{vis.length!==1?"S":""}
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
        <div style={{position:"absolute",top:52,left:0,right:0,textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:4,textTransform:"uppercase"}}>Ropa americana · Sierra Sur, Oaxaca</div>
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"0 16px 16px",display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>setScreen("locator")} style={{background:"rgba(255,255,255,0.15)",color:C.white,border:"1px solid rgba(255,255,255,0.3)",padding:"6px 14px",fontSize:11,fontWeight:600,cursor:"pointer"}}>
            {zone?`📍 ${zone.name} · $${zone.price}`:"📍 ¿Dónde entregamos?"}
          </button>
          {cart.length>0&&(
            <button onClick={()=>setCartOpen(true)} style={{background:"rgba(255,255,255,0.95)",color:C.terra,border:"none",padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
              🛒 {cart.length} artículo{cart.length>1?"s":""}
            </button>
          )}
        </div>
      </div>

      {/* ══ BARRA BÚSQUEDA + BOTONES ══════════════════════════ */}
      <div style={{position:"sticky",top:0,zIndex:20,background:"rgba(248,244,239,0.97)",backdropFilter:"blur(8px)",borderBottom:`1px solid ${C.border}`,padding:"10px 12px",display:"flex",gap:8,alignItems:"center"}}>
        {/* Búsqueda */}
        <div style={{position:"relative",flex:1}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:C.muted}}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar en CASI…" style={{width:"100%",boxSizing:"border-box",padding:"10px 12px 10px 36px",border:`1px solid ${C.border}`,fontSize:13,outline:"none",background:C.white,color:C.black,fontFamily:FONT.body}}/>
        </div>
        {/* Botón filtros */}
        <button onClick={()=>setFiltersOpen(true)} style={{position:"relative",background:activeFilters>0||sortBy!=="default"?C.black:C.white,border:`1.5px solid ${activeFilters>0||sortBy!=="default"?C.black:C.border}`,width:42,height:42,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0,color:activeFilters>0||sortBy!=="default"?C.white:C.black}}>
          ⚙
          {(activeFilters>0||sortBy!=="default")&&(
            <div style={{position:"absolute",top:-4,right:-4,background:C.terra,color:C.white,fontSize:9,fontWeight:900,width:16,height:16,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {activeFilters+(sortBy!=="default"?1:0)}
            </div>
          )}
        </button>
        {/* Botón carrito */}
        <button onClick={()=>setCartOpen(true)} style={{position:"relative",background:C.black,border:"none",width:42,height:42,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
          🛒
          {cart.length>0&&(
            <div style={{position:"absolute",top:-3,right:-3,background:C.terra,color:C.white,fontSize:9,fontWeight:900,width:17,height:17,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{cart.length}</div>
          )}
        </button>
      </div>

      {/* ══ CHIPS DE FILTROS ACTIVOS ════════════════════════ */}
      <div style={{display:(activeFilters>0||sortBy!=="default")?"flex":"none",gap:6,overflowX:"auto",scrollbarWidth:"none",padding:"8px 12px",borderBottom:`1px solid ${C.border}`}} translate="no">
        {fCat.map(c=>(
          <button key={c} onClick={()=>toggle(fCat,setFCat,c)} style={{flexShrink:0,padding:"5px 10px",background:C.black,color:C.white,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
            <span>{c}</span><span> ✕</span>
          </button>
        ))}
        {fGender.map(g=>(
          <button key={g} onClick={()=>toggle(fGender,setFGender,g)} style={{flexShrink:0,padding:"5px 10px",background:C.info,color:C.white,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
            <span>{g}</span><span> ✕</span>
          </button>
        ))}
        {fPriceMax&&(
          <button key="price" onClick={()=>setFPriceMax(null)} style={{flexShrink:0,padding:"5px 10px",background:C.terraL,color:C.terra,border:`1px solid ${C.terra}`,fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
            <span>hasta ${fPriceMax} ✕</span>
          </button>
        )}
        {sortBy!=="default"&&(
          <button key="sort" onClick={()=>setSortBy("default")} style={{flexShrink:0,padding:"5px 10px",background:C.stone,color:C.black,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
            <span>{{price_asc:"Precio ↑",price_desc:"Precio ↓",newest:"Más nuevos"}[sortBy]}</span><span> ✕</span>
          </button>
        )}
        <button key="clear" onClick={clearFilters} style={{flexShrink:0,padding:"5px 10px",background:"transparent",color:C.muted,border:`1px solid ${C.border}`,fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>
          <span>Limpiar todo</span>
        </button>
      </div>

      {/* ══ CONTADOR + ZONA ══════════════════════════════════ */}
      <div style={{padding:"8px 14px 6px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:.5,fontWeight:600}}>
          {vis.length} PRODUCTO{vis.length!==1?"S":""}
          {products.length!==vis.length&&` de ${products.length}`}
        </div>
        <button onClick={()=>setScreen("locator")} style={{fontSize:10,color:zone?C.ok:C.muted,fontWeight:700,background:"none",border:"none",cursor:"pointer"}}>
          📍 {zone?zone.name:"¿Dónde entregamos?"}
        </button>
      </div>

      {/* ══ GRID DE PRODUCTOS ══════════════════════════════════ */}
      {vis.length===0
        ?<EmptyState icon="⌕" title="Sin resultados" sub="Prueba cambiando o quitando algún filtro"/>
        :(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:C.border}}>
            {vis.map((p,i)=>(
              <div key={p.sku||i} onClick={()=>setSelected(p)} style={{cursor:"pointer",background:C.white}}>
                {/* Foto */}
                <div style={{position:"relative",paddingTop:"125%",background:C.stone,overflow:"hidden"}}>
                  {p.img
                    ?<img src={optimImg(p.img)} alt={p.name} loading="lazy" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
                    :<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:C.muted,opacity:.2}}>📷</div>
                  }
                  {/* Badge talla */}
                  {p.talla&&(
                    <div style={{position:"absolute",top:7,left:7,background:"rgba(255,255,255,0.95)",fontSize:10,fontWeight:900,padding:"3px 8px",color:C.black,letterSpacing:.5}}>
                      {p.talla}
                    </div>
                  )}
                  {/* Overlay agotado */}
                  {p.status==="sold"&&(
                    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.52)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <div style={{background:C.white,padding:"6px 14px",fontSize:11,fontWeight:900,color:C.black,letterSpacing:1.5}}>AGOTADO</div>
                    </div>
                  )}
                  {/* Botón agregar rápido */}
                  {p.status!=="sold"&&(
                    <button onClick={e=>{e.stopPropagation();addToCart({...p,price:p.salePrice});}} style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.80)",color:C.white,border:"none",padding:"9px 8px",fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:1.5,textTransform:"uppercase"}}>
                      + Agregar
                    </button>
                  )}
                </div>
                {/* Info producto */}
                <div style={{padding:"10px 10px 12px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.black,lineHeight:1.35,marginBottom:3,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",fontFamily:"serif"}}>
                    {p.name}
                  </div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:5}}>
                    {p.cat}{p.color?` · ${p.color}`:""}
                  </div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{fontSize:15,fontWeight:900,color:C.sale}}>{mxn(p.salePrice)}</div>
                    {p.gender&&<div style={{fontSize:9,color:C.muted,background:C.stone,padding:"2px 6px",letterSpacing:.5,fontWeight:600}}>{p.gender}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {/* ══ BARRA STICKY DEL CARRITO ══════════════════════════ */}
      {cart.length>0&&(
        <div onClick={()=>setCartOpen(true)} style={{position:"sticky",bottom:0,zIndex:100,background:C.black,margin:"10px 14px 14px",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{position:"relative"}}>
              <span style={{fontSize:22}}>🛒</span>
              <div style={{position:"absolute",top:-4,right:-4,background:C.terra,color:C.white,fontSize:9,fontWeight:900,width:16,height:16,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{cart.length}</div>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:C.white}}>{cart.length} artículo{cart.length>1?"s":""}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>Toca para comprar</div>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:17,fontWeight:900,color:C.white}}>{mxn(cartSub+(zone?.price||0))}</div>
            <div style={{fontSize:10,color:C.terra,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Ver carrito →</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MY ORDERS ────────────────────────────────────────────
function MyOrders({onBack}){
  const[phone,setPhone]=useState("");
  const[orders,setOrders]=useState([]);
  const[searched,setSearched]=useState(false);
  const[loading,setLoading]=useState(false);
  async function search(){if(phone.length<8)return;setLoading(true);const all=await dbGetAll(COL.orders);setOrders(all.filter(o=>o.client?.phone?.replace(/\D/g,"").includes(phone.replace(/\D/g,""))));setSearched(true);setLoading(false);}
  return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title="Mis pedidos" subtitle="Historial de compras" onBack={onBack}/>
      <div style={{padding:"16px"}}>
        <Card style={{marginBottom:16,padding:"18px"}}>
          <Inp label="Tu WhatsApp (10 dígitos)" value={phone} onChange={setPhone} placeholder="951 234 5678" type="tel"/>
          <Btn label={loading?"Buscando…":"Buscar mis pedidos"} onClick={search} disabled={phone.length<8||loading}/>
        </Card>
        {loading&&<Loading message="Buscando…"/>}
        {searched&&!loading&&orders.length===0&&<EmptyState icon="📭" title="Sin pedidos" sub="No encontramos pedidos con ese número"/>}
        {orders.map((o,i)=>{
          const s=ORDER_STATUS[o.status]||ORDER_STATUS.nuevo;
          const items=o.cart||o.items||[];
          return(
            <Card key={i} style={{marginBottom:12,borderLeft:`3px solid ${s.color}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><div style={{fontSize:12,fontWeight:700,color:C.black}}>#{o.id}</div><span style={{fontSize:11,fontWeight:700,color:s.color}}>{s.e} {s.label}</span></div>
              <div style={{fontSize:20,fontWeight:900,color:C.sale,marginBottom:6}}>{mxn(o.total)} MXN</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:4}}>📍 {o.zone?.name} · 📅 {o.zone?.days}</div>
              {items.length>0&&<div style={{fontSize:12,color:C.muted,marginBottom:10}}>{items.slice(0,2).map(i=>i.name).join(", ")}{items.length>2?` +${items.length-2} más`:""}</div>}
              <WaBtn tel={STORE_CONFIG.ownerPhone} msg={`Hola! Soy ${o.client?.name}. Pregunto por mi pedido CASI #${o.id} (${mxn(o.total)} MXN). ¿Cuándo llega?`} label="Preguntar por WhatsApp"/>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────
function AdminDashboard({orders,inventory,onNav}){
  const today=new Date().toISOString().slice(0,10);
  const todayOrders=orders.filter(o=>o.createdAt?.startsWith(today));
  const todaySales=todayOrders.reduce((a,o)=>a+(o.total||0),0);
  const newCount=orders.filter(o=>o.status==="nuevo").length;
  const verCount=orders.filter(o=>o.status==="verificando").length;
  const forSale=inventory.filter(p=>p.status==="for_sale").length;
  const inWarehouse=inventory.filter(p=>p.status==="in_warehouse").length;
  const provisional=inventory.filter(p=>p.isProvisional).length;
  return(
    <div style={{padding:"0 16px 32px",background:C.cream,minHeight:"100%"}}>
      <div style={{padding:"20px 0 14px"}}>
        <div style={{fontSize:11,fontWeight:700,color:C.terra,letterSpacing:3,textTransform:"uppercase",marginBottom:2}}>Panel de control</div>
        <div style={{fontSize:24,fontWeight:900,color:C.black,fontFamily:FONT.display}}>Inicio</div>
      </div>
      {(newCount>0||verCount>0)&&<InfoBox type="warn">🔔 {newCount>0?`${newCount} pedido${newCount>1?"s":""} nuevo${newCount>1?"s":""}`:""}{newCount>0&&verCount>0?" · ":""}{verCount>0?`${verCount} transferencia${verCount>1?"s":""} por verificar`:""}</InfoBox>}
      {provisional>0&&<InfoBox type="info">⚠️ {provisional} productos con costo provisional — registra el envío para completar</InfoBox>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {[{e:"💰",l:"Ventas hoy",v:mxn(todaySales),c:C.terra,sc:"orders"},{e:"📋",l:"Pedidos hoy",v:todayOrders.length,c:C.info,sc:"orders"},{e:"🛍️",l:"Disponibles",v:forSale,c:C.ok,sc:"inventory"},{e:"📦",l:"En bodega",v:inWarehouse,c:C.warn,sc:"inventory"}].map(s=>(
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
      {orders.length===0&&<div style={{fontSize:13,color:C.muted,textAlign:"center",padding:"20px 0"}}>Sin pedidos aún</div>}
      {orders.slice(0,5).map((o,i)=>{
        const s=ORDER_STATUS[o.status]||ORDER_STATUS.nuevo;
        const items=o.cart||o.items||[];
        return(
          <Card key={i} style={{marginBottom:8,padding:"12px 14px",borderLeft:`3px solid ${s.color}`}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.black}}>{o.client?.name||"—"}</div>
                <div style={{fontSize:11,color:C.muted}}>#{o.id} · {o.zone?.name}</div>
                {items.length>0&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{items.slice(0,2).map(i=>i.name).join(", ")}{items.length>2?` +${items.length-2} más`:""}</div>}
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

// ─── ADMIN ORDERS ─────────────────────────────────────────
function AdminOrders({orders,onUpdateStatus,onBack}){
  const[filter,setFilter]=useState("todos");
  const filters=["todos",...Object.keys(ORDER_STATUS)];
  const vis=filter==="todos"?orders:orders.filter(o=>o.status===filter);
  const newCount=orders.filter(o=>o.status==="nuevo").length;
  const verCount=orders.filter(o=>o.status==="verificando").length;
  return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title="Pedidos" subtitle={`${orders.length} en total`} onBack={onBack}/>
      <div style={{padding:"0 14px 32px"}}>
        <div style={{display:"flex",gap:8,paddingTop:12,marginBottom:12,flexWrap:"wrap"}}>
          {newCount>0&&<Badge c={C.warn} bg={C.warnFade} label={`🔔 ${newCount} nuevo${newCount>1?"s":""}`}/>}
          {verCount>0&&<Badge c={C.purple} bg={C.purpleFade} label={`⏳ ${verCount} verificando`}/>}
        </div>
        <InfoBox type="ok">🔴 En vivo — actualización automática en tiempo real</InfoBox>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,marginBottom:14,scrollbarWidth:"none"}}>
          {filters.map(f=>{const s=ORDER_STATUS[f]||{};return(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:"7px 12px",border:"none",cursor:"pointer",flexShrink:0,background:filter===f?(s.color||C.black):C.white,color:filter===f?C.white:C.muted,fontSize:11,fontWeight:700,letterSpacing:.5,textTransform:"uppercase"}}>
              {s.e||"📋"} {f==="todos"?"Todos":s.label}
            </button>
          );})}
        </div>
        {vis.length===0&&<EmptyState icon="📭" title="Sin pedidos" sub="Los pedidos aparecerán aquí en tiempo real"/>}
        {vis.map((o,i)=>{
          const s=ORDER_STATUS[o.status]||ORDER_STATUS.nuevo;
          const d=new Date(o.createdAt);
          const fecha=`${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
          const items=o.cart||o.items||[];
          return(
            <Card key={i} style={{marginBottom:12,borderLeft:`3px solid ${s.color}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div><div style={{fontSize:13,fontWeight:700,color:C.black}}>#{o.id}</div><div style={{fontSize:11,color:C.muted}}>{fecha}</div></div><Badge c={s.color} bg={s.bg} label={`${s.e} ${s.label}`}/></div>
              {o.status==="verificando"&&<InfoBox type="warn">
                <div style={{fontWeight:700,marginBottom:6}}>⏳ Verifica en tu banco</div>
                <div style={{marginBottom:8}}>Referencia: <strong>{o.ref||"no indicó"}</strong></div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>onUpdateStatus(o.id,"confirmado")} style={{flex:1,padding:"8px",background:C.ok,color:C.white,border:"none",fontSize:12,fontWeight:700,cursor:"pointer"}}>✓ Recibida</button>
                  <button onClick={()=>onUpdateStatus(o.id,"cancelado")} style={{flex:1,padding:"8px",background:C.dangerFade,color:C.danger,border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>✕ No recibida</button>
                </div>
              </InfoBox>}
              <div style={{fontSize:14,fontWeight:800,color:C.black,marginBottom:2}}>{o.client?.name}</div>
              <div style={{fontSize:12,color:C.muted}}>📞 {o.client?.phone}</div>
              <div style={{fontSize:12,color:C.muted}}>📍 {o.zone?.name} · 📅 {o.zone?.days}{o.client?.address?` · 🏠 ${o.client.address}`:""}</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:8}}>{o.method==="cod"?"💵 Contra entrega":"📲 Transferencia"+(o.ref?" · Ref: "+o.ref:"")}</div>
              {items.length>0&&(
                <div style={{background:C.stone,padding:"10px 12px",marginBottom:10}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Productos del pedido</div>
                  {items.map((item,idx)=>(
                    <div key={idx} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:idx<items.length-1?`1px solid ${C.border}`:"none"}}>
                      <span style={{fontSize:12,color:C.black}}>{item.name}{item.size?" T:"+item.size:""}{item.color?" / "+item.color:""}</span>
                      <span style={{fontSize:12,fontWeight:700,color:C.terra}}>{mxn(item.price)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${C.border}`,paddingTop:10,marginBottom:10}}>
                <div style={{fontSize:18,fontWeight:900,color:C.sale}}>{mxn(o.total)} MXN</div>
                {o.client?.phone&&<WaBtn small tel={o.client.phone} msg={`Hola ${o.client?.name}! Soy CASI 🛍️. Tu pedido #${o.id} está *${s.label.toLowerCase()}*. Total: ${mxn(o.total)} MXN.`} label="WA Cliente"/>}
              </div>
              <div style={{fontSize:10,color:C.muted,marginBottom:6,letterSpacing:1.5,textTransform:"uppercase"}}>Cambiar estado:</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {Object.entries(ORDER_STATUS).filter(([k])=>k!==o.status).map(([k,v])=>(
                  <button key={k} onClick={()=>onUpdateStatus(o.id,k)} style={{padding:"6px 10px",background:v.bg,border:`1px solid ${v.color}33`,fontSize:11,fontWeight:600,cursor:"pointer",color:v.color}}>{v.e} {v.label}</button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── DRIVER APP ───────────────────────────────────────────
function DriverApp({onBack}){
  const[orders,setOrders]=useState([]);
  const[loading,setLoading]=useState(true);
  const[phone,setPhone]=useState("");
  const[logged,setLogged]=useState(false);
  const unsubRef=useRef(null);
  useEffect(()=>{
    if(!logged)return;
    unsubRef.current=dbListen(COL.orders,data=>{setOrders(data.filter(o=>["confirmado","preparando","en_ruta"].includes(o.status)));setLoading(false);});
    return()=>unsubRef.current?.();
  },[logged]);
  if(!logged)return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title="Repartidor" subtitle="Acceso a mis entregas" onBack={onBack}/>
      <div style={{padding:"24px 18px"}}>
        <InfoBox type="info">Ingresa tu número de WhatsApp para ver tus entregas del día.</InfoBox>
        <Inp label="Tu WhatsApp" value={phone} onChange={setPhone} placeholder="951 234 5678" type="tel"/>
        <Btn label="Entrar" onClick={()=>setLogged(true)} disabled={phone.length<10}/>
      </div>
    </div>
  );
  if(loading)return<Loading message="Cargando entregas…"/>;
  return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title="Mis entregas" subtitle="Hoy" onBack={()=>{setLogged(false);unsubRef.current?.();}}/>
      <div style={{padding:"0 16px 32px"}}>
        <StatsRow items={[{value:orders.filter(o=>o.status==="en_ruta").length,label:"En ruta",color:C.terra},{value:orders.filter(o=>o.status==="preparando").length,label:"Preparando",color:C.info},{value:orders.filter(o=>o.status==="confirmado").length,label:"Por salir",color:C.warn}]}/>
        {orders.length===0&&<EmptyState icon="🛵" title="Sin entregas asignadas" sub="Tus entregas aparecerán aquí"/>}
        {orders.map((o,i)=>{
          const s=ORDER_STATUS[o.status]||ORDER_STATUS.confirmado;
          const items=o.cart||o.items||[];
          return(
            <Card key={i} style={{marginBottom:12,borderLeft:`3px solid ${s.color}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{fontSize:14,fontWeight:800,color:C.black}}>{o.client?.name}</div><Badge c={s.color} bg={s.bg} label={`${s.e} ${s.label}`}/></div>
              <div style={{fontSize:12,color:C.muted}}>📍 {o.zone?.name}</div>
              <div style={{fontSize:12,color:C.muted}}>🏠 {o.client?.address||"Sin referencia"}</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:6}}>📞 {o.client?.phone} · {o.method==="cod"?`💵 Cobrar ${mxn(o.total)} MXN`:"📲 Ya pagó"}</div>
              {items.length>0&&<div style={{background:C.stone,padding:"8px 10px",marginBottom:10,fontSize:12,color:C.black}}>{items.map(i=>i.name+(i.size?" T:"+i.size:"")).join(" · ")}</div>}
              <div style={{display:"flex",gap:8}}>
                {o.status!=="en_ruta"&&<button onClick={()=>dbUpdate(COL.orders,o.id,{status:"en_ruta"})} style={{flex:1,padding:"10px",background:C.terra,color:C.white,border:"none",fontSize:12,fontWeight:700,cursor:"pointer"}}>🛵 Salir a entregar</button>}
                {o.status==="en_ruta"&&<button onClick={()=>dbUpdate(COL.orders,o.id,{status:"entregado",deliveredAt:new Date().toISOString()})} style={{flex:1,padding:"10px",background:C.ok,color:C.white,border:"none",fontSize:12,fontWeight:700,cursor:"pointer"}}>✅ Entregado</button>}
                <WaBtn small tel={o.client?.phone} msg={`Hola ${o.client?.name}! Soy el repartidor de CASI 🛵. Voy en camino a ${o.zone?.name}.`} label="Avisar"/>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── VENDOR APP ───────────────────────────────────────────
function VendorApp({onBack}){
  const[vendorName,setVendorName]=useState("");
  const[logged,setLogged]=useState(false);
  const[orders,setOrders]=useState([]);
  const[products,setProducts]=useState([]);
  const[loading,setLoading]=useState(false);
  async function login(){if(!vendorName.trim())return;setLoading(true);const[prods,ords]=await Promise.all([dbGetAll(COL.inventory),dbGetAll(COL.orders)]);setProducts(prods.filter(p=>p.seller===vendorName));setOrders(ords.filter(o=>(o.cart||o.items||[]).some(i=>i.seller===vendorName)));setLogged(true);setLoading(false);}
  if(!logged)return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title="Vendedor" subtitle="Acceso a mi tienda" onBack={onBack}/>
      <div style={{padding:"24px 18px"}}>
        <InfoBox type="info">Ingresa el nombre de tu tienda tal como fue registrado con CASI.</InfoBox>
        <Inp label="Nombre de tu tienda" value={vendorName} onChange={setVendorName} placeholder="TechOax"/>
        <Btn label={loading?"Cargando…":"Entrar"} onClick={login} disabled={vendorName.trim().length<2||loading}/>
      </div>
    </div>
  );
  const totalSales=orders.reduce((a,o)=>{const mine=(o.cart||o.items||[]).filter(i=>i.seller===vendorName);return a+mine.reduce((x,i)=>x+(i.price||0),0);},0);
  const commission=totalSales*0.10;
  return(
    <div style={{background:C.cream,minHeight:"100%"}}>
      <TopBar title={vendorName} subtitle="Mi tienda en CASI" onBack={()=>setLogged(false)}/>
      <div style={{padding:"16px 16px 32px"}}>
        <Card style={{background:`linear-gradient(135deg,${C.terra},${C.terraD})`,padding:"18px 20px",marginBottom:16}}>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Pendiente de cobro</div>
          <div style={{fontSize:28,fontWeight:900,color:C.white,fontFamily:FONT.display}}>{mxn(totalSales-commission)}</div>
          <div style={{display:"flex",gap:16,marginTop:10}}>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>Ventas</div><div style={{fontSize:13,fontWeight:700,color:C.white}}>{mxn(totalSales)}</div></div>
            <div><div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>Comisión 10%</div><div style={{fontSize:13,fontWeight:700,color:"rgba(255,200,150,.9)"}}>-{mxn(commission)}</div></div>
          </div>
        </Card>
        <InfoBox type="info">💡 CASI retiene 10% de comisión. El resto se liquida cada lunes.</InfoBox>
        <SectionTitle>Mis productos ({products.length})</SectionTitle>
        {products.length===0&&<EmptyState icon="🏪" title="Sin productos" sub="Habla con CASI para agregar tus productos"/>}
        {products.slice(0,10).map(p=>(
          <Card key={p.sku} style={{marginBottom:8,padding:"12px 14px"}}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <div style={{width:48,height:60,overflow:"hidden",flexShrink:0,position:"relative",background:C.stone}}><FadeImg src={p.img} alt={p.name}/></div>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.black}}>{p.name}</div><div style={{fontSize:12,fontWeight:700,color:C.sale}}>{mxn(p.salePrice)} MXN</div><Badge c={p.status==="for_sale"?C.ok:C.warn} bg={p.status==="for_sale"?C.okFade:C.warnFade} label={p.status==="for_sale"?"✅ Disponible":"📦 En bodega"} small/></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────
export default function App(){
  const[mode,setMode]=useState("store");
  const[adminTab,setAdminTab]=useState("dashboard");
  const[adminOpen,setAdminOpen]=useState(false);
  const[storeTab,setStoreTab]=useState("store");
  const[orders,setOrders]=useState([]);
  const[inventory,setInventory]=useState([]);
  const[fbOk,setFbOk]=useState(false);
  const[ready,setReady]=useState(false);
  const unsubRef=useRef(null);

  useEffect(()=>{
    const l=document.createElement("link");
    l.href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap";
    l.rel="stylesheet";document.head.appendChild(l);
    initFirebase().then(async()=>{
      setFbOk(true);
      unsubRef.current=dbListen(COL.orders,data=>setOrders(data));
      const inv=await dbGetAll(COL.inventory,"createdAt","desc");
      setInventory(inv);
      setReady(true);
    }).catch(()=>setReady(true));
    return()=>{if(unsubRef.current)unsubRef.current();};
  },[]);

  async function handleOrder(order){try{await dbAdd(COL.orders,order);}catch(e){console.error(e);}}
  async function handleUpdateStatus(id,status){try{await dbUpdate(COL.orders,id,{status});}catch(e){console.error(e);}}

  const alertCount=orders.filter(o=>["nuevo","verificando"].includes(o.status)).length;

  if(!ready)return(
    <div translate="no" style={{minHeight:"100vh",background:C.black,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT.body}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:42,fontWeight:900,color:C.white,letterSpacing:16,fontFamily:"serif",marginBottom:16}}>CASI</div>
        <div style={{display:"flex",gap:6,justifyContent:("center")}}>{[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:C.terra,animation:`ld .8s ease-in-out ${i*0.2}s infinite alternate`}}/>)}</div>
        <style>{`@keyframes ld{from{opacity:.3;transform:scale(.8)}to{opacity:1;transform:scale(1)}}`}</style>
      </div>
    </div>
  );

  const MODES=[{id:"store",label:"🛍️ Tienda"},{id:"driver",label:"🛵 Repartidor"},{id:"vendor",label:"🏪 Vendedor"},{id:"admin",label:"👑 Admin"}];
  const ADMIN_TABS=[{id:"dashboard",label:"Inicio"},{id:"orders",label:`Pedidos${alertCount>0?" ("+alertCount+")":""}`},{id:"tickets",label:"Tickets"},{id:"shipments",label:"Envíos"},{id:"inventory",label:"Inventario"},{id:"drivers",label:"Repartos"},{id:"vendors",label:"Vendedores"}];
  const STORE_TABS=[{id:"store",label:"Tienda",icon:"◈"},{id:"orders",label:"Pedidos",icon:"◎"}];

  function renderContent(){
    if(mode==="store"){
      if(storeTab==="store")return<Store onOrder={handleOrder}/>;
      if(storeTab==="orders")return<MyOrders onBack={()=>setStoreTab("store")}/>;
    }
    if(mode==="driver")return<DriverApp onBack={()=>setMode("store")}/>;
    if(mode==="vendor")return<VendorApp onBack={()=>setMode("store")}/>;
    if(mode==="admin"){
      if(!adminOpen)return<PinLock correct={STORE_CONFIG.adminPin} onUnlock={()=>setAdminOpen(true)} title="Admin CASI"/>;
      if(adminTab==="dashboard")return<AdminDashboard orders={orders} inventory={inventory} onNav={t=>setAdminTab(t)}/>;
      if(adminTab==="orders")return<AdminOrders orders={orders} onUpdateStatus={handleUpdateStatus} onBack={()=>setAdminTab("dashboard")}/>;
      if(adminTab==="tickets")return<TicketsScreen onBack={()=>setAdminTab("dashboard")}/>;
      if(adminTab==="shipments")return<ShipmentsScreen onBack={()=>setAdminTab("dashboard")}/>;
      if(adminTab==="inventory")return<InventoryScreen
          inventory={inventory}
          onRefresh={async()=>{const inv=await dbGetAll(COL.inventory,"createdAt","desc");setInventory(inv);}}
          onBack={()=>setAdminTab("dashboard")}/>;
      if(adminTab==="drivers")return<EmptyState icon="🛵" title="Repartidores" sub="Módulo en construcción"/>;
      if(adminTab==="vendors")return<EmptyState icon="🏪" title="Vendedores" sub="Módulo en construcción"/>;
    }
    return null;
  }

  return(
    <div style={{minHeight:"100vh",background:"#111",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 12px",fontFamily:FONT.body}}>
      <div style={{marginBottom:12,display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
        {MODES.map(m=>(
          <button key={m.id} onClick={()=>{setMode(m.id);if(m.id!=="admin")setAdminOpen(false);if(m.id==="store")setStoreTab("store");}} style={{padding:"7px 14px",border:"none",cursor:"pointer",background:mode===m.id?C.terra:"rgba(255,255,255,0.1)",color:C.white,fontSize:12,fontWeight:700,letterSpacing:.5,boxShadow:mode===m.id?`0 4px 14px ${C.terra}55`:"none",transition:"all .2s"}}>{m.label}</button>
        ))}
      </div>
      <div style={{width:390,maxWidth:"100%",background:C.cream,overflow:"hidden",boxShadow:"0 60px 120px rgba(0,0,0,0.9),0 0 0 1px rgba(255,255,255,0.08)",display:"flex",flexDirection:"column",maxHeight:"90vh"}}>
        <OfflineBanner/>
        {fbOk&&<div style={{background:C.okFade,padding:"5px 14px",display:"flex",alignItems:"center",gap:8,borderBottom:`1px solid ${C.border}`}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:C.ok,animation:"pulse 2s infinite"}}/>
          <span style={{fontSize:10,color:C.ok,fontWeight:700,letterSpacing:1}}>FIREBASE · EN VIVO</span>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </div>}
        {mode==="admin"&&adminOpen&&(
          <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,display:"flex",overflowX:"auto",scrollbarWidth:"none",flexShrink:0}}>
            {ADMIN_TABS.map(t=>(
              <button key={t.id} onClick={()=>setAdminTab(t.id)} style={{padding:"10px 11px",background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:adminTab===t.id?700:500,color:adminTab===t.id?C.terra:C.muted,borderBottom:`2px solid ${adminTab===t.id?C.terra:"transparent"}`,transition:"all .2s",whiteSpace:"nowrap",flexShrink:0}}>{t.label}</button>
            ))}
          </div>
        )}
        {/* FIX PANTALLA OSCURA: background siempre blanco/crema */}
        <div style={{flex:1,overflowY:"auto",background:C.cream}}>
          {renderContent()}
        </div>
        {mode==="store"&&(
          <div style={{background:C.white,borderTop:`1px solid ${C.border}`,display:"flex"}}>
            {STORE_TABS.map(t=>(
              <button key={t.id} onClick={()=>setStoreTab(t.id)} style={{flex:1,padding:"14px 0",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,borderTop:`2px solid ${storeTab===t.id?C.black:"transparent"}`,transition:"all .2s"}}>
                <span style={{fontSize:18,color:storeTab===t.id?C.black:C.muted}}>{t.icon}</span>
                <span style={{fontSize:10,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:storeTab===t.id?C.black:C.muted}}>{t.label}</span>
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