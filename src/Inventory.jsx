import { useState } from "react";
import { C, FONT, Btn, Inp, Card, SectionTitle, TopBar,
         InfoBox, Badge, EmptyState, Loading } from "./ui.jsx";
import { dbUpdate } from "./firebase.js";
import { COL, CATS, STORE_CONFIG } from "./config.js";

// ─── FORMATEO MANUAL (sin depender del locale del navegador) ──────
// Siempre: $ antes, punto para decimales, coma para miles
// Ej: 1234.5 → "$ 1,234.50"
function fmt(n, dec=2) {
  const num = Math.abs(parseFloat(n) || 0);
  const parts = num.toFixed(dec).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}
function mxn(n)          { return "$ " + fmt(n, 2); }
function pct(val, total) { return total > 0 ? Math.round((val/total)*100) : 0; }

// ─── ESTADO LEGIBLE ───────────────────────────────────────
function statusInfo(st, isProvisional) {
  if (st === "for_sale" && isProvisional) {
    // Tiene precio pero el costo no es final — mostrar en bodega con aviso
    return { label:"📦 En bodega (sin envío)", color:C.warn, bg:C.warnFade };
  }
  return {
    for_sale:     { label:"✅ Disponible para venta", color:C.ok,     bg:C.okFade     },
    in_warehouse: { label:"📦 En bodega",              color:C.info,   bg:C.infoFade   },
    sold:         { label:"🏷️ Vendido",               color:C.purple, bg:C.purpleFade },
    inactive:     { label:"⛔ Inactivo",               color:C.muted,  bg:C.stone      },
  }[st] || { label:"📦 En bodega", color:C.info, bg:C.infoFade };
}

// ─── FILTROS ──────────────────────────────────────────────
const STATUS_TABS = [
  { id:"all",          label:"Todos"              },
  { id:"for_sale",     label:"Disponible p/venta" },
  { id:"in_warehouse", label:"En bodega"           },
  { id:"sold",         label:"Vendidos"            },
  { id:"inactive",     label:"Inactivos"           },
];

const EXTRA_OPTS = [
  { id:"all",         label:"Sin filtro"          },
  { id:"no_photo",    label:"Sin foto 📷"         },
  { id:"no_price",    label:"Sin precio 💰"       },
  { id:"provisional", label:"Costo provisional ⚠️"},
  { id:"with_photo",  label:"Con foto ✓"          },
  { id:"with_price",  label:"Con precio ✓"        },
];

const GENDER_OPTS = ["Todos","Hombre","Mujer","Niño","Niña","Unisex"];
const PAGE = 30;

// ─── INVENTORY LIST ───────────────────────────────────────
export function InventoryList({ items, onEdit, onBack }) {
  const [search,      setSearch]      = useState("");
  const [statusF,     setStatusF]     = useState("all");
  const [catF,        setCatF]        = useState("Todo");
  const [extraF,      setExtraF]      = useState("all");
  const [brandF,      setBrandF]      = useState("Todas");
  const [ticketF,     setTicketF]     = useState("Todos");
  const [genderF,     setGenderF]     = useState("Todos");
  const [page,        setPage]        = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Opciones de filtro derivadas de los datos
  const brands  = ["Todas", ...new Set(items.map(i => i.brand).filter(Boolean).sort())];
  const tickets = ["Todos", ...new Set(items.map(i => i.ticketId).filter(Boolean).sort())];
  const cats    = ["Todo",  ...new Set(items.map(i => i.cat).filter(Boolean).sort())];

  // Aplicar filtros
  const filtered = items.filter(item => {
    if (statusF !== "all" && item.status !== statusF)  return false;
    if (catF !== "Todo"   && item.cat !== catF)         return false;
    if (brandF !== "Todas"  && item.brand !== brandF)   return false;
    if (ticketF !== "Todos" && item.ticketId !== ticketF) return false;
    if (genderF !== "Todos" && item.gender !== genderF) return false;
    switch (extraF) {
      case "no_photo":    if (item.img)              return false; break;
      case "no_price":    if (item.salePrice > 0)    return false; break;
      case "provisional": if (!item.isProvisional)   return false; break;
      case "with_photo":  if (!item.img)             return false; break;
      case "with_price":  if (!(item.salePrice > 0)) return false; break;
    }
    if (search) {
      const q = search.toLowerCase();
      return [item.sku, item.name, item.brand, item.talla,
              item.color, item.ticketId, item.descr, item.gender]
        .some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const visible = filtered.slice(0, page * PAGE);
  const hasMore = filtered.length > visible.length;
  function reset() { setPage(1); }

  // Stats
  const total       = items.length;
  const forSale     = items.filter(i => i.status === "for_sale").length;
  const inWarehouse = items.filter(i => i.status === "in_warehouse").length;
  const sold        = items.filter(i => i.status === "sold").length;
  const noPhoto     = items.filter(i => !i.img).length;
  const noPrice     = items.filter(i => i.status !== "sold" && !(i.salePrice > 0)).length;
  const provisional = items.filter(i => i.isProvisional).length;

  return (
    <div style={{ background:C.cream, minHeight:"100%" }}>

      {/* Header pegajoso */}
      <div style={{ position:"sticky", top:0, zIndex:10, background:C.cream,
        borderBottom:`1px solid ${C.border}`, padding:"12px 16px",
        display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {onBack && (
            <button onClick={onBack} style={{ background:C.black, border:"none", width:34, height:34,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              color:C.white, fontSize:18 }}>←</button>
          )}
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:C.terra, letterSpacing:3,
              textTransform:"uppercase" }}>Inventario</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.black,
              fontFamily:FONT.display }}>Bodega</div>
          </div>
        </div>
        <button onClick={() => setShowFilters(!showFilters)} style={{
          background:showFilters ? C.black : C.stone, border:"none",
          padding:"7px 12px", fontSize:11, fontWeight:700, cursor:"pointer",
          color:showFilters ? C.white : C.black,
        }}>{showFilters ? "✕ Cerrar" : "⚙ Filtros"}</button>
      </div>

      {/* Stats compactas */}
      <div style={{ display:"flex", overflowX:"auto", gap:6,
        padding:"10px 16px 8px", scrollbarWidth:"none" }}>
        {[
          { label:"Total",        v:total,       c:C.black  },
          { label:"P/Venta",      v:forSale,     c:C.ok     },
          { label:"En bodega",    v:inWarehouse, c:C.info   },
          { label:"Vendidos",     v:sold,        c:C.purple },
          { label:"Sin foto",     v:noPhoto,     c:C.danger },
          { label:"Sin precio",   v:noPrice,     c:C.warn   },
          { label:"Provisional",  v:provisional, c:C.warn   },
        ].map(s => (
          <div key={s.label} style={{ flexShrink:0, background:C.white,
            padding:"7px 10px", textAlign:"center", minWidth:52,
            border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:17, fontWeight:900, color:s.c }}>{s.v}</div>
            <div style={{ fontSize:7.5, color:C.muted, textTransform:"uppercase",
              letterSpacing:.3, marginTop:2, lineHeight:1.2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {noPhoto > 0 && (
        <div style={{ margin:"0 16px 6px", background:C.dangerFade,
          borderLeft:`3px solid ${C.danger}`, padding:"8px 12px",
          fontSize:11, color:C.danger, fontWeight:600 }}>
          📷 {noPhoto} sin foto — no visibles en tienda
        </div>
      )}
      {provisional > 0 && (
        <div style={{ margin:"0 16px 8px", background:C.warnFade,
          borderLeft:`3px solid ${C.warn}`, padding:"8px 12px",
          fontSize:11, color:C.warn, fontWeight:600 }}>
          ⚠️ {provisional} con costo provisional
        </div>
      )}

      {/* Búsqueda */}
      <div style={{ padding:"0 16px 8px" }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:11, top:"50%",
            transform:"translateY(-50%)", fontSize:13, color:C.muted }}>⌕</span>
          <input value={search} onChange={e => { setSearch(e.target.value); reset(); }}
            placeholder="SKU, nombre, marca, talla, color, ticket…"
            style={{ width:"100%", boxSizing:"border-box", padding:"10px 32px 10px 32px",
              border:`1.5px solid ${C.border}`, fontSize:12, outline:"none",
              background:C.white, color:C.black, fontFamily:FONT.body }}/>
          {search && (
            <button onClick={() => { setSearch(""); reset(); }} style={{
              position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
              background:"none", border:"none", cursor:"pointer",
              color:C.muted, fontSize:16 }}>✕</button>
          )}
        </div>
      </div>

      {/* Tabs de estado — sin loading, cambio instantáneo */}
      <div style={{ display:"flex", overflowX:"auto", scrollbarWidth:"none",
        borderBottom:`2px solid ${C.border}`, padding:"0 16px" }}>
        {STATUS_TABS.map(f => {
          const count = f.id === "all" ? total
            : items.filter(i => i.status === f.id).length;
          const active = statusF === f.id;
          const si = statusInfo(f.id === "all" ? "in_warehouse" : f.id);
          return (
            <button key={f.id} onClick={() => { setStatusF(f.id); reset(); }} style={{
              padding:"9px 10px", border:"none", background:"none",
              cursor:"pointer", flexShrink:0, fontSize:10, fontWeight:700,
              letterSpacing:.5, textTransform:"uppercase", whiteSpace:"nowrap",
              color:active ? si.color : C.muted,
              borderBottom:`2px solid ${active ? si.color : "transparent"}`,
              marginBottom:-2, transition:"all .15s",
            }}>
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Filtros avanzados */}
      {showFilters && (
        <div style={{ padding:"12px 16px", background:C.stone,
          borderBottom:`1px solid ${C.border}` }}>

          {/* Género */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted,
              letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Género</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {GENDER_OPTS.map(g => (
                <button key={g} onClick={() => { setGenderF(g); reset(); }} style={{
                  padding:"5px 10px", border:`1.5px solid ${genderF===g ? C.black : C.border}`,
                  background:genderF===g ? C.black : C.white,
                  color:genderF===g ? C.white : C.black,
                  fontSize:11, fontWeight:600, cursor:"pointer",
                }}>{g}</button>
              ))}
            </div>
          </div>

          {/* Condición */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted,
              letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Condición</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {EXTRA_OPTS.map(f => (
                <button key={f.id} onClick={() => { setExtraF(f.id); reset(); }} style={{
                  padding:"5px 10px", border:`1.5px solid ${extraF===f.id ? C.black : C.border}`,
                  background:extraF===f.id ? C.black : C.white,
                  color:extraF===f.id ? C.white : C.black,
                  fontSize:11, fontWeight:600, cursor:"pointer",
                }}>{f.label}</button>
              ))}
            </div>
          </div>

          {/* Cat + Marca */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            {[
              { label:"Categoría", val:catF, set:setCatF, opts:cats },
              { label:"Marca",     val:brandF, set:setBrandF, opts:brands },
            ].map(({ label, val, set, opts }) => (
              <div key={label}>
                <div style={{ fontSize:9, fontWeight:700, color:C.muted,
                  letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>{label}</div>
                <select value={val} onChange={e => { set(e.target.value); reset(); }}
                  style={{ width:"100%", padding:"7px 8px", border:`1.5px solid ${C.border}`,
                    fontSize:11, outline:"none", background:C.white,
                    color:C.black, fontFamily:FONT.body }}>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Ticket */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted,
              letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Ticket de origen</div>
            <select value={ticketF} onChange={e => { setTicketF(e.target.value); reset(); }}
              style={{ width:"100%", padding:"7px 8px", border:`1.5px solid ${C.border}`,
                fontSize:11, outline:"none", background:C.white,
                color:C.black, fontFamily:FONT.body }}>
              {tickets.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <button onClick={() => {
            setStatusF("all"); setCatF("Todo"); setExtraF("all");
            setBrandF("Todas"); setTicketF("Todos"); setGenderF("Todos");
            setSearch(""); reset();
          }} style={{ width:"100%", padding:"8px", background:"none",
            border:`1.5px solid ${C.border}`, fontSize:11, fontWeight:700,
            cursor:"pointer", color:C.muted, letterSpacing:.5, textTransform:"uppercase" }}>
            ✕ Limpiar filtros
          </button>
        </div>
      )}

      {/* Resultado */}
      <div style={{ padding:"6px 16px", display:"flex", justifyContent:"space-between" }}>
        <div style={{ fontSize:10, color:C.muted, letterSpacing:.5 }}>
          {filtered.length === total
            ? `${total} PRODUCTOS`
            : `${filtered.length} DE ${total} RESULTADOS`}
        </div>
        {filtered.length !== total && (
          <button onClick={() => {
            setStatusF("all"); setCatF("Todo"); setExtraF("all");
            setBrandF("Todas"); setTicketF("Todos"); setGenderF("Todos");
            setSearch(""); reset();
          }} style={{ fontSize:10, color:C.terra, background:"none",
            border:"none", cursor:"pointer", fontWeight:700 }}>
            Limpiar ✕
          </button>
        )}
      </div>

      {/* Lista — renderizado instantáneo sin loading */}
      <div style={{ padding:"0 16px" }}>
        {visible.length === 0 ? (
          <EmptyState icon="🔍" title="Sin resultados" sub="Prueba con otros filtros"/>
        ) : visible.map(item => {
          const si = statusInfo(item.status, item.isProvisional);
          const hasPhoto = Boolean(item.img);
          const hasPrice = item.salePrice > 0;
          const costMXN  = (item.finalCostUSD||0) * (item.exchangeRate||20);

          return (
            <div key={item.sku || item.invId} onClick={() => onEdit(item)}
              style={{ display:"flex", gap:12, alignItems:"flex-start",
                padding:"11px 0", borderBottom:`1px solid ${C.border}`,
                cursor:"pointer", background:C.cream }}>

              {/* Thumbnail */}
              <div style={{ width:56, height:72, background:C.stone,
                flexShrink:0, overflow:"hidden", position:"relative" }}>
                {hasPhoto ? (
                  <img src={item.img} alt={item.name} loading="lazy"
                    style={{ width:"100%", height:"100%", objectFit:"cover" }}
                    onError={e => e.target.style.display="none"}/>
                ) : (
                  <div style={{ width:"100%", height:"100%", display:"flex",
                    alignItems:"center", justifyContent:"center",
                    fontSize:20, color:C.muted, opacity:.25 }}>📷</div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                {/* Badges */}
                <div style={{ display:"flex", gap:3, marginBottom:3, flexWrap:"wrap" }}>
                  <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:20,
                    color:si.color, background:si.bg, whiteSpace:"nowrap" }}>{si.label}</span>
                  {item.isProvisional && (
                    <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20,
                      color:C.warn, background:C.warnFade }}>⚠️ Prov.</span>
                  )}
                  {!hasPhoto && (
                    <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20,
                      color:C.danger, background:C.dangerFade }}>Sin foto</span>
                  )}
                </div>

                {/* SKU */}
                <div style={{ fontSize:10, fontWeight:700, color:C.terra,
                  letterSpacing:.5, marginBottom:1 }}>{item.sku}</div>

                {/* Nombre */}
                <div style={{ fontSize:13, fontWeight:700, color:C.black,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {item.name || "Sin nombre"}
                </div>

                {/* Meta */}
                <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
                  {[item.brand, item.cat, item.gender,
                    item.talla && "T:" + item.talla, item.color
                  ].filter(Boolean).join(" · ")}
                </div>

                {/* Ticket */}
                <div style={{ fontSize:9.5, color:C.muted, marginTop:1 }}>
                  {item.ticketId}
                  {item.shipmentId ? " · " + item.shipmentId : " · Sin envío"}
                </div>

                {/* Precios en MXN */}
                <div style={{ display:"flex", gap:10, marginTop:4,
                  alignItems:"baseline", flexWrap:"wrap" }}>
                  {costMXN > 0 && (
                    <div>
                      <span style={{ fontSize:9, color:C.muted }}>Costo: </span>
                      <span style={{ fontSize:12, fontWeight:700, color:C.black }}>
                        {mxn(costMXN)}{item.isProvisional ? " ⚠️" : ""}
                      </span>
                    </div>
                  )}
                  {hasPrice ? (
                    <div>
                      <span style={{ fontSize:9, color:C.muted }}>Precio sugerido: </span>
                      <span style={{ fontSize:13, fontWeight:800,
                        color:item.status==="sold" ? C.purple : C.ok }}>
                        {mxn(item.salePrice)}
                      </span>
                    </div>
                  ) : (
                    item.status !== "sold" && (
                      <span style={{ fontSize:10, color:C.warn, fontWeight:600 }}>Sin precio</span>
                    )
                  )}
                </div>
              </div>

              <div style={{ color:C.muted, fontSize:18, paddingTop:4, flexShrink:0 }}>›</div>
            </div>
          );
        })}
      </div>

      {/* Ver más */}
      {hasMore && (
        <div style={{ padding:"12px 16px" }}>
          <button onClick={() => setPage(p => p+1)} style={{
            width:"100%", padding:"12px", background:C.white,
            border:`1.5px solid ${C.border}`, fontSize:12, fontWeight:700,
            cursor:"pointer", color:C.black, letterSpacing:1, textTransform:"uppercase",
          }}>
            Ver más ({filtered.length - visible.length} más)
          </button>
        </div>
      )}
    </div>
  );
}

// ─── EDIT ITEM ────────────────────────────────────────────
export function EditInventoryItem({ item, onBack, onSaved }) {
  const [name,   setName]   = useState(item.name   || "");
  const [cat,    setCat]    = useState(item.cat     || "Ropa");
  const [brand,  setBrand]  = useState(item.brand   || "");
  const [descr,  setDescr]  = useState(item.descr  || "");
  const [talla,  setTalla]  = useState(item.talla  || "");
  const [color,  setColor]  = useState(item.color  || "");
  const [gender, setGender] = useState(item.gender || "");
  const [img,    setImg]    = useState(item.img     || "");
  const [price,  setPrice]  = useState(item.salePrice > 0 ? String(item.salePrice) : "");
  const [active, setActive] = useState(item.active || false);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const rate       = item.exchangeRate || 20;
  const costMXN    = parseFloat(((item.finalCostUSD||0) * rate).toFixed(2));
  const priceNum   = parseFloat(price) || 0;
  const gain       = priceNum > 0 && costMXN > 0 ? parseFloat((priceNum - costMXN).toFixed(2)) : 0;
  const marginPct  = priceNum > 0 && costMXN > 0 ? Math.round((gain/costMXN)*100) : 0;
  const suggested  = Math.round(costMXN * 2);
  const isComplete = Boolean(name && img && color);

  async function handleSave() {
    setSaving(true);
    // No marcar como "disponible para venta" si el costo es provisional
    // (producto que aún no ha llegado a México / sin envío registrado)
    const finalStatus = item.status === "sold" ? "sold"
      : isComplete && priceNum > 0 && !item.isProvisional ? "for_sale"
      : "in_warehouse";
    await dbUpdate(COL.inventory, item.sku || item.invId || item.id, {
      name, cat, brand, descr, talla, color, gender, img,
      salePrice: priceNum,
      active:    isComplete && priceNum > 0 ? active : false,
      status:    finalStatus,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onSaved(); }, 1200);
  }

  return (
    <div style={{ background:C.cream, minHeight:"100%", paddingBottom:80 }}>
      <TopBar title={item.sku} subtitle={`${item.ticketId} · ${item.cat}`} onBack={onBack}/>

      <div style={{ padding:"14px 16px 0" }}>

        {/* Costo en pesos — sin escribir "USD" para evitar traducción */}
        <div style={{
          background:item.isProvisional ? C.warnFade : C.okFade,
          borderLeft:`3px solid ${item.isProvisional ? C.warn : C.ok}`,
          padding:"12px 14px", marginBottom:14,
        }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase",
            color:item.isProvisional ? C.warn : C.ok, marginBottom:8 }}>
            {item.isProvisional ? "⚠️ Costo provisional — sin envío aún" : "✅ Costo completo"}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {[
              ["Costo base MXN",  mxn((item.costUSD||0)*rate)    ],
              ["Flete MXN",       mxn((item.freightUSD||0)*rate)  ],
              ["Costo final MXN", mxn(costMXN)                    ],
            ].map(([l,v]) => (
              <div key={l}>
                <div style={{ fontSize:9, color:C.muted }}>{l}</div>
                <div style={{ fontSize:12, fontWeight:700, color:C.black }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:9, color:C.muted, marginTop:6 }}>
            Tipo de cambio: {fmt(rate,2)} · Ticket: {item.ticketId}
            {item.shipmentId ? " · " + item.shipmentId : " · Sin envío"}
          </div>
        </div>

        {/* Foto */}
        <SectionTitle>📸 Foto del producto</SectionTitle>
        {img ? (
          <div style={{ width:"100%", height:170, overflow:"hidden",
            marginBottom:8, background:C.stone }}>
            <img src={img} alt={name}
              style={{ width:"100%", height:"100%", objectFit:"cover" }}
              onError={e => e.target.style.display="none"}/>
          </div>
        ) : (
          <div style={{ width:"100%", height:80, background:C.stone,
            display:"flex", alignItems:"center", justifyContent:"center",
            marginBottom:8, gap:8 }}>
            <span style={{ fontSize:28 }}>📷</span>
            <span style={{ fontSize:11, color:C.muted }}>Sin foto — no visible en tienda</span>
          </div>
        )}
        <Inp value={img} onChange={setImg}
          placeholder="https://res.cloudinary.com/…"
          hint="Sube en cloudinary.com → copia URL → pega aquí"/>

        {/* Datos del producto */}
        <SectionTitle>Información del producto</SectionTitle>
        <Inp label="Nombre *" value={name} onChange={setName}
          placeholder="Tenis Nike Air Max 90" required/>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:5,
              letterSpacing:1.5, textTransform:"uppercase" }}>Categoría</div>
            <select value={cat} onChange={e => setCat(e.target.value)}
              style={{ width:"100%", padding:"11px 10px", border:`1.5px solid ${C.border}`,
                fontSize:13, outline:"none", background:C.white,
                color:C.black, fontFamily:FONT.body }}>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Inp label="Marca" value={brand} onChange={setBrand}
            placeholder="Nike, Levi's…" small/>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          <Inp label="Color *" value={color} onChange={setColor}
            placeholder="Negro…" small required/>
          <Inp label="Talla" value={talla} onChange={setTalla}
            placeholder="M, 27…" small/>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:5,
              letterSpacing:1.5, textTransform:"uppercase" }}>Género</div>
            <select value={gender} onChange={e => setGender(e.target.value)}
              style={{ width:"100%", padding:"9px 6px", border:`1.5px solid ${C.border}`,
                fontSize:11, outline:"none", background:C.white,
                color:C.black, fontFamily:FONT.body }}>
              {["","Hombre","Mujer","Niño","Niña","Unisex"].map(g => (
                <option key={g} value={g}>{g || "— —"}</option>
              ))}
            </select>
          </div>
        </div>

        <Inp label="Descripción" value={descr} onChange={setDescr}
          placeholder="Estado, detalles, condición…"/>

        {/* Precio */}
        <SectionTitle>💰 Precio de venta</SectionTitle>

        {costMXN > 0 && (
          <div style={{ background:C.infoFade, borderLeft:`3px solid ${C.info}`,
            padding:"10px 14px", marginBottom:10 }}>
            <div style={{ fontSize:10, color:C.info, fontWeight:700, marginBottom:4 }}>
              💡 Precio sugerido (margen x2)
            </div>
            <div style={{ fontSize:20, fontWeight:900, color:C.info }}>{mxn(suggested)}</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>
              Basado en costo {mxn(costMXN)} × 2
            </div>
          </div>
        )}

        <Inp label="Precio de venta MXN" value={price} onChange={setPrice} type="number"
          hint={costMXN > 0 ? `Costo MXN: ${mxn(costMXN)} · Sugerido: ${mxn(suggested)} MXN` : ""}/>

        {costMXN > 0 && priceNum > 0 && (
          <div style={{
            background:marginPct>=50 ? C.okFade : marginPct>=20 ? C.warnFade : C.dangerFade,
            borderLeft:`3px solid ${marginPct>=50 ? C.ok : marginPct>=20 ? C.warn : C.danger}`,
            padding:"10px 14px", marginBottom:14,
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:10, color:C.muted }}>Ganancia por pieza</div>
                <div style={{ fontSize:14, fontWeight:700, color:C.black }}>{mxn(gain)}</div>
              </div>
              <div style={{ fontSize:26, fontWeight:900,
                color:marginPct>=50?C.ok:marginPct>=20?C.warn:C.danger }}>
                {marginPct}%
              </div>
            </div>
          </div>
        )}

        {/* Activar en tienda */}
        <SectionTitle>👁️ Visibilidad en tienda</SectionTitle>
        {!isComplete && (
          <InfoBox type="warn">Para activar necesitas: <strong>nombre + foto + color</strong></InfoBox>
        )}
        {isComplete && !priceNum && (
          <InfoBox type="warn">Agrega un precio de venta para activar en tienda</InfoBox>
        )}
        {isComplete && priceNum > 0 && (
          <div style={{ padding:"12px 0", display:"flex", justifyContent:"space-between",
            alignItems:"center", borderTop:`1px solid ${C.border}`,
            borderBottom:`1px solid ${C.border}`, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:C.black }}>
                {active ? "✅ Visible en tienda CASI" : "📦 Solo en bodega"}
              </div>
              <div style={{ fontSize:11, color:C.muted }}>
                {active ? "Clientes pueden ver y comprar" : "No aparece en la tienda pública"}
              </div>
            </div>
            <div onClick={() => setActive(!active)} style={{
              width:44, height:24, borderRadius:12,
              background:active ? C.ok : C.border,
              position:"relative", cursor:"pointer", transition:"background .2s",
            }}>
              <div style={{ position:"absolute", top:3, left:active?23:3, width:18, height:18,
                borderRadius:"50%", background:C.white, transition:"left .2s",
                boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
            </div>
          </div>
        )}
      </div>

      {/* Guardar fijo abajo */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:390, padding:"12px 16px", boxSizing:"border-box",
        background:"rgba(248,244,239,0.97)", backdropFilter:"blur(8px)",
        borderTop:`1px solid ${C.border}`, zIndex:50 }}>
        <button onClick={handleSave} disabled={saving || saved || !name} style={{
          width:"100%", padding:"14px", fontSize:13, fontWeight:900,
          letterSpacing:2, textTransform:"uppercase", border:"none",
          background:saved ? C.ok : !name ? "#CCC" : C.black,
          color:C.white, cursor:name ? "pointer" : "not-allowed", transition:"all .3s",
        }}>
          {saved ? "✓ GUARDADO" : saving ? "GUARDANDO…" : "GUARDAR PRODUCTO"}
        </button>
      </div>
    </div>
  );
}

// ─── SCREEN ───────────────────────────────────────────────
// Ahora recibe los items del padre (App.jsx) — NO hace fetch propio
// Esto elimina el parpadeo oscuro al cambiar tabs
export function InventoryScreen({ inventory=[], onRefresh, onBack }) {
  const [view, setView] = useState("list");
  const [item, setItem] = useState(null);

  async function handleSaved() {
    // Actualizar datos en el padre
    if (onRefresh) await onRefresh();
    setView("list");
  }

  if (view === "edit" && item) return (
    <EditInventoryItem
      item={item}
      onBack={() => setView("list")}
      onSaved={handleSaved}
    />
  );

  return (
    <InventoryList
      items={inventory}
      onBack={onBack}
      onEdit={i => { setItem(i); setView("edit"); }}
    />
  );
}
