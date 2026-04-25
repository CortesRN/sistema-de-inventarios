import { useState } from "react";
import { C, FONT, Btn, Inp, Card, SectionTitle, TopBar,
         InfoBox, Badge, EmptyState } from "./ui.jsx";
import { dbUpdate } from "./firebase.js";
import { COL, CATEGORIAS, GENEROS, UBICACIONES } from "./config.js";

// ─── FORMATEO ─────────────────────────────────────────────
function fmt(n, dec=2) {
  const num = Math.abs(parseFloat(n) || 0);
  const parts = num.toFixed(dec).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}
function mxn(n) { return "$ " + fmt(n, 2); }

// ─── ESTADO LEGIBLE ───────────────────────────────────────
function infoEstado(estado, esProvisional) {
  if (estado === "en_venta" && esProvisional) {
    return { label:"📦 En bodega (sin envío)", color:C.warn, bg:C.warnFade };
  }
  return {
    en_venta:  { label:"✅ En venta",    color:C.ok,     bg:C.okFade     },
    en_bodega: { label:"📦 En bodega",   color:C.info,   bg:C.infoFade   },
    vendido:   { label:"🏷️ Vendido",    color:C.purple, bg:C.purpleFade },
    inactivo:  { label:"⛔ Inactivo",    color:C.muted,  bg:C.stone      },
  }[estado] || { label:"📦 En bodega", color:C.info, bg:C.infoFade };
}

// ─── TABS DE ESTADO ───────────────────────────────────────
const TABS_ESTADO = [
  { id:"todos",     label:"Todos"      },
  { id:"en_venta",  label:"En venta"   },
  { id:"en_bodega", label:"En bodega"  },
  { id:"vendido",   label:"Vendidos"   },
  { id:"inactivo",  label:"Inactivos"  },
];

const OPTS_EXTRA = [
  { id:"todos",        label:"Sin filtro"          },
  { id:"sin_foto",     label:"Sin foto 📷"         },
  { id:"sin_precio",   label:"Sin precio 💰"       },
  { id:"provisional",  label:"Costo provisional ⚠️"},
  { id:"con_foto",     label:"Con foto ✓"          },
  { id:"con_precio",   label:"Con precio ✓"        },
];

const POR_PAGINA = 30;

// ─── LISTA DE INVENTARIO ──────────────────────────────────
export function InventoryList({ items, onEdit, onBack }) {
  const [busqueda,     setBusqueda]     = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroCateg,  setFiltroCateg]  = useState("Todas");
  const [filtroExtra,  setFiltroExtra]  = useState("todos");
  const [filtroMarca,  setFiltroMarca]  = useState("Todas");
  const [filtroTicket, setFiltroTicket] = useState("Todos");
  const [filtroGenero, setFiltroGenero] = useState("Todos");
  const [pagina,       setPagina]       = useState(1);
  const [verFiltros,   setVerFiltros]   = useState(false);

  // Opciones derivadas de los datos reales
  const marcas  = ["Todas", ...new Set(items.map(i => i.marca).filter(Boolean).sort())];
  const tickets = ["Todos", ...new Set(items.map(i => i.ticketOrigen).filter(Boolean).sort())];
  const categs  = ["Todas", ...new Set(items.map(i => i.categoria).filter(Boolean).sort())];

  // Aplicar filtros
  const filtrados = items.filter(item => {
    if (filtroEstado !== "todos"  && item.estado    !== filtroEstado)  return false;
    if (filtroCateg  !== "Todas"  && item.categoria !== filtroCateg)   return false;
    if (filtroMarca  !== "Todas"  && item.marca     !== filtroMarca)   return false;
    if (filtroTicket !== "Todos"  && item.ticketOrigen !== filtroTicket) return false;
    if (filtroGenero !== "Todos"  && item.genero    !== filtroGenero)  return false;
    switch (filtroExtra) {
      case "sin_foto":    if (item.foto)              return false; break;
      case "sin_precio":  if (item.precio > 0)        return false; break;
      case "provisional": if (!item.esProvisional)    return false; break;
      case "con_foto":    if (!item.foto)             return false; break;
      case "con_precio":  if (!(item.precio > 0))     return false; break;
    }
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return [item.clave, item.nombre, item.marca, item.talla,
              item.color, item.ticketOrigen, item.descripcion, item.genero]
        .some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const visibles = filtrados.slice(0, pagina * POR_PAGINA);
  const hayMas   = filtrados.length > visibles.length;
  function resetPagina() { setPagina(1); }

  // Stats
  const total        = items.length;
  const enVenta      = items.filter(i => i.estado === "en_venta").length;
  const enBodega     = items.filter(i => i.estado === "en_bodega").length;
  const vendidos     = items.filter(i => i.estado === "vendido").length;
  const sinFoto      = items.filter(i => !i.foto).length;
  const sinPrecio    = items.filter(i => i.estado !== "vendido" && !(i.precio > 0)).length;
  const provisionales = items.filter(i => i.esProvisional).length;

  return (
    <div style={{ background:C.cream, minHeight:"100%" }}>

      {/* Header */}
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
        <button onClick={() => setVerFiltros(!verFiltros)} style={{
          background:verFiltros ? C.black : C.stone, border:"none",
          padding:"7px 12px", fontSize:11, fontWeight:700, cursor:"pointer",
          color:verFiltros ? C.white : C.black,
        }}>{verFiltros ? "✕ Cerrar" : "⚙ Filtros"}</button>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", overflowX:"auto", gap:6,
        padding:"10px 16px 8px", scrollbarWidth:"none" }}>
        {[
          { label:"Total",       v:total,         c:C.black  },
          { label:"En venta",    v:enVenta,        c:C.ok     },
          { label:"En bodega",   v:enBodega,       c:C.info   },
          { label:"Vendidos",    v:vendidos,       c:C.purple },
          { label:"Sin foto",    v:sinFoto,        c:C.danger },
          { label:"Sin precio",  v:sinPrecio,      c:C.warn   },
          { label:"Provisional", v:provisionales,  c:C.warn   },
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
      {sinFoto > 0 && (
        <div style={{ margin:"0 16px 6px", background:C.dangerFade,
          borderLeft:`3px solid ${C.danger}`, padding:"8px 12px",
          fontSize:11, color:C.danger, fontWeight:600 }}>
          📷 {sinFoto} sin foto — no visibles en tienda
        </div>
      )}
      {provisionales > 0 && (
        <div style={{ margin:"0 16px 8px", background:C.warnFade,
          borderLeft:`3px solid ${C.warn}`, padding:"8px 12px",
          fontSize:11, color:C.warn, fontWeight:600 }}>
          ⚠️ {provisionales} con costo provisional — registra el envío para completar
        </div>
      )}

      {/* Búsqueda */}
      <div style={{ padding:"0 16px 8px" }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:11, top:"50%",
            transform:"translateY(-50%)", fontSize:13, color:C.muted }}>⌕</span>
          <input value={busqueda} onChange={e => { setBusqueda(e.target.value); resetPagina(); }}
            placeholder="Clave, nombre, marca, talla, color, ticket…"
            style={{ width:"100%", boxSizing:"border-box", padding:"10px 32px 10px 32px",
              border:`1.5px solid ${C.border}`, fontSize:12, outline:"none",
              background:C.white, color:C.black, fontFamily:FONT.body }}/>
          {busqueda && (
            <button onClick={() => { setBusqueda(""); resetPagina(); }} style={{
              position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
              background:"none", border:"none", cursor:"pointer",
              color:C.muted, fontSize:16 }}>✕</button>
          )}
        </div>
      </div>

      {/* Tabs de estado */}
      <div style={{ display:"flex", overflowX:"auto", scrollbarWidth:"none",
        borderBottom:`2px solid ${C.border}`, padding:"0 16px" }}>
        {TABS_ESTADO.map(f => {
          const cantidad = f.id === "todos" ? total
            : items.filter(i => i.estado === f.id).length;
          const activo = filtroEstado === f.id;
          const si = infoEstado(f.id === "todos" ? "en_bodega" : f.id);
          return (
            <button key={f.id} onClick={() => { setFiltroEstado(f.id); resetPagina(); }} style={{
              padding:"9px 10px", border:"none", background:"none",
              cursor:"pointer", flexShrink:0, fontSize:10, fontWeight:700,
              letterSpacing:.5, textTransform:"uppercase", whiteSpace:"nowrap",
              color:activo ? si.color : C.muted,
              borderBottom:`2px solid ${activo ? si.color : "transparent"}`,
              marginBottom:-2, transition:"all .15s",
            }}>
              {f.label} ({cantidad})
            </button>
          );
        })}
      </div>

      {/* Filtros avanzados */}
      {verFiltros && (
        <div style={{ padding:"12px 16px", background:C.stone,
          borderBottom:`1px solid ${C.border}` }}>

          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted,
              letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Género</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {["Todos","Mujer","Hombre","Niña","Niño","Unisex"].map(g => (
                <button key={g} onClick={() => { setFiltroGenero(g); resetPagina(); }} style={{
                  padding:"5px 10px", border:`1.5px solid ${filtroGenero===g ? C.black : C.border}`,
                  background:filtroGenero===g ? C.black : C.white,
                  color:filtroGenero===g ? C.white : C.black,
                  fontSize:11, fontWeight:600, cursor:"pointer",
                }}>{g}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted,
              letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Extras</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {OPTS_EXTRA.map(f => (
                <button key={f.id} onClick={() => { setFiltroExtra(f.id); resetPagina(); }} style={{
                  padding:"5px 10px", border:`1.5px solid ${filtroExtra===f.id ? C.black : C.border}`,
                  background:filtroExtra===f.id ? C.black : C.white,
                  color:filtroExtra===f.id ? C.white : C.black,
                  fontSize:11, fontWeight:600, cursor:"pointer",
                }}>{f.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            {[
              { label:"Categoría", val:filtroCateg,  set:setFiltroCateg,  opts:categs  },
              { label:"Marca",     val:filtroMarca,   set:setFiltroMarca,  opts:marcas  },
            ].map(({ label, val, set, opts }) => (
              <div key={label}>
                <div style={{ fontSize:9, fontWeight:700, color:C.muted,
                  letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>{label}</div>
                <select value={val} onChange={e => { set(e.target.value); resetPagina(); }}
                  style={{ width:"100%", padding:"7px 8px", border:`1.5px solid ${C.border}`,
                    fontSize:11, outline:"none", background:C.white,
                    color:C.black, fontFamily:FONT.body }}>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted,
              letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Ticket de origen</div>
            <select value={filtroTicket} onChange={e => { setFiltroTicket(e.target.value); resetPagina(); }}
              style={{ width:"100%", padding:"7px 8px", border:`1.5px solid ${C.border}`,
                fontSize:11, outline:"none", background:C.white,
                color:C.black, fontFamily:FONT.body }}>
              {tickets.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <button onClick={() => {
            setFiltroEstado("todos"); setFiltroCateg("Todas"); setFiltroExtra("todos");
            setFiltroMarca("Todas"); setFiltroTicket("Todos"); setFiltroGenero("Todos");
            setBusqueda(""); resetPagina();
          }} style={{ width:"100%", padding:"8px", background:"none",
            border:`1.5px solid ${C.border}`, fontSize:11, fontWeight:700,
            cursor:"pointer", color:C.muted, letterSpacing:.5, textTransform:"uppercase" }}>
            ✕ Limpiar filtros
          </button>
        </div>
      )}

      {/* Contador */}
      <div style={{ padding:"6px 16px", display:"flex", justifyContent:"space-between" }}>
        <div style={{ fontSize:10, color:C.muted, letterSpacing:.5 }}>
          {filtrados.length === total
            ? `${total} PRODUCTOS`
            : `${filtrados.length} DE ${total} RESULTADOS`}
        </div>
      </div>

      {/* Lista */}
      <div style={{ padding:"0 16px" }}>
        {visibles.length === 0 ? (
          <EmptyState icon="🔍" title="Sin resultados" sub="Prueba con otros filtros"/>
        ) : visibles.map(item => {
          const si        = infoEstado(item.estado, item.esProvisional);
          const tieneFoto = Boolean(item.foto);
          const tienePrecio = item.precio > 0;
          // Costo en MXN — soporta campos nuevos y viejos
          const costoMXN  = item.costoMXN || ((item.costoTotalUSD||0) * (item.tipoCambio||20));

          // Ubicación legible
          const ubic = UBICACIONES.find(u => u.value === item.ubicacion);

          return (
            <div key={item.clave || item.idInterno || item.id} onClick={() => onEdit(item)}
              style={{ display:"flex", gap:12, alignItems:"flex-start",
                padding:"11px 0", borderBottom:`1px solid ${C.border}`,
                cursor:"pointer", background:C.cream }}>

              {/* Thumbnail */}
              <div style={{ width:56, height:72, background:C.stone,
                flexShrink:0, overflow:"hidden", position:"relative" }}>
                {tieneFoto ? (
                  <img src={item.foto} alt="" loading="lazy"
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
                <div style={{ display:"flex", gap:3, marginBottom:3, flexWrap:"wrap" }}>
                  <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:20,
                    color:si.color, background:si.bg, whiteSpace:"nowrap" }}>{si.label}</span>
                  {item.esProvisional && (
                    <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20,
                      color:C.warn, background:C.warnFade }}>⚠️ Provisional</span>
                  )}
                  {!tieneFoto && (
                    <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20,
                      color:C.danger, background:C.dangerFade }}>Sin foto</span>
                  )}
                </div>

                <div style={{ fontSize:10, fontWeight:700, color:C.terra,
                  letterSpacing:.5, marginBottom:1 }}>{item.clave}</div>

                <div style={{ fontSize:13, fontWeight:700, color:C.black,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {item.nombre || "Sin nombre"}
                </div>

                <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
                  {[item.marca, item.categoria, item.genero,
                    item.talla && "T:" + item.talla, item.color
                  ].filter(Boolean).join(" · ")}
                </div>

                <div style={{ fontSize:9.5, color:C.muted, marginTop:1 }}>
                  {ubic ? ubic.label : item.ubicacion || "—"}
                  {item.ticketOrigen ? " · " + item.ticketOrigen : ""}
                </div>

                <div style={{ display:"flex", gap:10, marginTop:4,
                  alignItems:"baseline", flexWrap:"wrap" }}>
                  {costoMXN > 0 && (
                    <div>
                      <span style={{ fontSize:9, color:C.muted }}>Costo: </span>
                      <span style={{ fontSize:12, fontWeight:700, color:C.black }}>
                        {mxn(costoMXN)}{item.esProvisional ? " ⚠️" : ""}
                      </span>
                    </div>
                  )}
                  {tienePrecio ? (
                    <div>
                      <span style={{ fontSize:9, color:C.muted }}>Precio: </span>
                      <span style={{ fontSize:13, fontWeight:800,
                        color:item.estado==="vendido" ? C.purple : C.ok }}>
                        {mxn(item.precio)}
                      </span>
                    </div>
                  ) : (
                    item.estado !== "vendido" && (
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

      {hayMas && (
        <div style={{ padding:"12px 16px" }}>
          <button onClick={() => setPagina(p => p+1)} style={{
            width:"100%", padding:"12px", background:C.white,
            border:`1.5px solid ${C.border}`, fontSize:12, fontWeight:700,
            cursor:"pointer", color:C.black, letterSpacing:1, textTransform:"uppercase",
          }}>
            Ver más ({filtrados.length - visibles.length} más)
          </button>
        </div>
      )}
    </div>
  );
}

// ─── EDITAR PRODUCTO ──────────────────────────────────────
export function EditInventoryItem({ item, onBack, onSaved }) {
  const [nombre,      setNombre]      = useState(item.nombre      || "");
  const [categoria,   setCategoria]   = useState(item.categoria   || "Ropa");
  const [marca,       setMarca]       = useState(item.marca       || "");
  const [descripcion, setDescripcion] = useState(item.descripcion || "");
  const [talla,       setTalla]       = useState(item.talla       || "");
  const [color,       setColor]       = useState(item.color       || "");
  const [genero,      setGenero]      = useState(item.genero      || "");
  const [foto,        setFoto]        = useState(item.foto        || "");
  const [precio,      setPrecio]      = useState(item.precio > 0 ? String(item.precio) : "");
  const [activo,      setActivo]      = useState(item.activo      || false);
  const [ubicacion,   setUbicacion]   = useState(item.ubicacion   || "usa");
  const [fechaCompra, setFechaCompra] = useState(item.fechaCompra || item.fechaIngreso || "");
  const [guardando,   setGuardando]   = useState(false);
  const [guardado,    setGuardado]    = useState(false);

  // Costo en MXN — soporta campos nuevos
  const costoMXN   = item.costoMXN || ((item.costoTotalUSD||0) * (item.tipoCambio||20));
  const precioNum  = parseFloat(precio) || 0;
  const ganancia   = precioNum > 0 && costoMXN > 0 ? parseFloat((precioNum - costoMXN).toFixed(2)) : 0;
  const margenPct  = precioNum > 0 && costoMXN > 0 ? Math.round((ganancia/costoMXN)*100) : 0;
  const sugerido   = Math.round(costoMXN * 2);
  const completo   = Boolean(nombre && foto && color);

  async function guardar() {
    setGuardando(true);
    const nuevoEstado = item.estado === "vendido" ? "vendido"
      : completo && precioNum > 0 && !item.esProvisional ? "en_venta"
      : "en_bodega";

    await dbUpdate(COL.inventario, item.id, {
      nombre, categoria, marca, descripcion, talla, color, genero,
      foto,
      precio:     precioNum,
      activo:     completo && precioNum > 0 ? activo : false,
      estado:     nuevoEstado,
      ubicacion,
      fechaCompra,
    });
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => { setGuardado(false); onSaved(); }, 1200);
  }

  return (
    <div style={{ background:C.cream, minHeight:"100%", paddingBottom:80 }}>
      <TopBar
        title={item.clave || item.idInterno}
        subtitle={`${item.ticketOrigen || "—"} · ${item.categoria || "—"}`}
        onBack={onBack}
      />

      <div style={{ padding:"14px 16px 0" }}>

        {/* Desglose de costo */}
        <div style={{
          background:item.esProvisional ? C.warnFade : C.okFade,
          borderLeft:`3px solid ${item.esProvisional ? C.warn : C.ok}`,
          padding:"12px 14px", marginBottom:14,
        }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase",
            color:item.esProvisional ? C.warn : C.ok, marginBottom:8 }}>
            {item.esProvisional ? "⚠️ Costo provisional — sin envío aún" : "✅ Costo completo"}
          </div>
          {item.origen === "usa" ? (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[
                ["Costo USA",   `$${fmt(item.costoUSD||0,2)} USD`              ],
                ["Flete",       `$${fmt(item.fletePorPrendaUSD||0,2)} USD`     ],
                ["Total MXN",   mxn(costoMXN)                                  ],
              ].map(([l,v]) => (
                <div key={l}>
                  <div style={{ fontSize:9, color:C.muted }}>{l}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.black }}>{v}</div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize:9, color:C.muted }}>Costo MXN</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.black }}>{mxn(costoMXN)}</div>
            </div>
          )}
          <div style={{ fontSize:9, color:C.muted, marginTop:6 }}>
            {item.origen === "usa" && `TC: $${fmt(item.tipoCambio||0,2)} · `}
            Ticket: {item.ticketOrigen || "—"}
          </div>
        </div>

        {/* Fecha de compra */}
        <SectionTitle>📅 Fecha de compra</SectionTitle>
        <Inp
          label="Fecha en que se compró"
          value={fechaCompra}
          onChange={setFechaCompra}
          type="date"
          hint="Corrígela si la compra fue antes de hoy"
        />

        {/* Ubicación */}
        <SectionTitle>📍 Ubicación actual</SectionTitle>
        <div style={{ marginBottom:14 }}>
          <select value={ubicacion} onChange={e => setUbicacion(e.target.value)}
            style={{ width:"100%", padding:"11px 10px", border:`1.5px solid ${C.border}`,
              fontSize:13, outline:"none", background:C.white,
              color:C.black, fontFamily:FONT.body }}>
            {UBICACIONES.map(u => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>

        {/* Foto */}
        <SectionTitle>📸 Foto del producto</SectionTitle>
        {foto ? (
          <div style={{ width:"100%", height:170, overflow:"hidden",
            marginBottom:8, background:C.stone }}>
            <img src={foto} alt=""
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
        <Inp value={foto} onChange={setFoto}
          placeholder="https://res.cloudinary.com/dkea1bi9v/…"
          hint="Sube en cloudinary.com → copia URL → pega aquí"/>

        {/* Datos del producto */}
        <SectionTitle>Información del producto</SectionTitle>
        <Inp label="Nombre *" value={nombre} onChange={setNombre}
          placeholder="Tenis Nike Air Max 90" required/>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:5,
              letterSpacing:1.5, textTransform:"uppercase" }}>Categoría</div>
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
              style={{ width:"100%", padding:"11px 10px", border:`1.5px solid ${C.border}`,
                fontSize:13, outline:"none", background:C.white,
                color:C.black, fontFamily:FONT.body }}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Inp label="Marca" value={marca} onChange={setMarca}
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
            <select value={genero} onChange={e => setGenero(e.target.value)}
              style={{ width:"100%", padding:"9px 6px", border:`1.5px solid ${C.border}`,
                fontSize:11, outline:"none", background:C.white,
                color:C.black, fontFamily:FONT.body }}>
              {["","Mujer","Hombre","Niño","Niña","Unisex"].map(g => (
                <option key={g} value={g}>{g || "— —"}</option>
              ))}
            </select>
          </div>
        </div>

        <Inp label="Descripción" value={descripcion} onChange={setDescripcion}
          placeholder="Estado, detalles, condición…"/>

        {/* Precio */}
        <SectionTitle>💰 Precio de venta</SectionTitle>
        {costoMXN > 0 && (
          <div style={{ background:C.infoFade, borderLeft:`3px solid ${C.info}`,
            padding:"10px 14px", marginBottom:10 }}>
            <div style={{ fontSize:10, color:C.info, fontWeight:700, marginBottom:4 }}>
              💡 Precio sugerido (margen ×2)
            </div>
            <div style={{ fontSize:20, fontWeight:900, color:C.info }}>{mxn(sugerido)}</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>
              Costo {mxn(costoMXN)} × 2
            </div>
          </div>
        )}
        <Inp label="Precio de venta MXN" value={precio} onChange={setPrecio} type="number"
          hint={costoMXN > 0 ? `Costo: ${mxn(costoMXN)} · Sugerido: ${mxn(sugerido)}` : ""}/>

        {costoMXN > 0 && precioNum > 0 && (
          <div style={{
            background:margenPct>=50 ? C.okFade : margenPct>=20 ? C.warnFade : C.dangerFade,
            borderLeft:`3px solid ${margenPct>=50 ? C.ok : margenPct>=20 ? C.warn : C.danger}`,
            padding:"10px 14px", marginBottom:14,
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:10, color:C.muted }}>Ganancia por pieza</div>
                <div style={{ fontSize:14, fontWeight:700, color:C.black }}>{mxn(ganancia)}</div>
              </div>
              <div style={{ fontSize:26, fontWeight:900,
                color:margenPct>=50?C.ok:margenPct>=20?C.warn:C.danger }}>
                {margenPct}%
              </div>
            </div>
          </div>
        )}

        {/* Visibilidad */}
        <SectionTitle>👁️ Visibilidad en tienda</SectionTitle>
        {!completo && (
          <InfoBox type="warn">Para activar necesitas: <strong>nombre + foto + color</strong></InfoBox>
        )}
        {completo && !precioNum && (
          <InfoBox type="warn">Agrega un precio de venta para activar en tienda</InfoBox>
        )}
        {item.esProvisional && completo && precioNum > 0 && (
          <InfoBox type="warn">⚠️ Costo provisional — no se puede activar hasta registrar el envío</InfoBox>
        )}
        {completo && precioNum > 0 && !item.esProvisional && (
          <div style={{ padding:"12px 0", display:"flex", justifyContent:"space-between",
            alignItems:"center", borderTop:`1px solid ${C.border}`,
            borderBottom:`1px solid ${C.border}`, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:C.black }}>
                {activo ? "✅ Visible en tienda CASI" : "📦 Solo en bodega"}
              </div>
              <div style={{ fontSize:11, color:C.muted }}>
                {activo ? "Clientes pueden ver y comprar" : "No aparece en la tienda pública"}
              </div>
            </div>
            <div onClick={() => setActivo(!activo)} style={{
              width:44, height:24, borderRadius:12,
              background:activo ? C.ok : C.border,
              position:"relative", cursor:"pointer", transition:"background .2s",
            }}>
              <div style={{ position:"absolute", top:3, left:activo?23:3, width:18, height:18,
                borderRadius:"50%", background:C.white, transition:"left .2s",
                boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
            </div>
          </div>
        )}
      </div>

      {/* Botón guardar */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:390, padding:"12px 16px", boxSizing:"border-box",
        background:"rgba(248,244,239,0.97)", backdropFilter:"blur(8px)",
        borderTop:`1px solid ${C.border}`, zIndex:50 }}>
        <button onClick={guardar} disabled={guardando || guardado || !nombre} style={{
          width:"100%", padding:"14px", fontSize:13, fontWeight:900,
          letterSpacing:2, textTransform:"uppercase", border:"none",
          background:guardado ? C.ok : !nombre ? "#CCC" : C.black,
          color:C.white, cursor:nombre ? "pointer" : "not-allowed", transition:"all .3s",
        }}>
          {guardado ? "✓ GUARDADO" : guardando ? "GUARDANDO…" : "GUARDAR PRODUCTO"}
        </button>
      </div>
    </div>
  );
}

// ─── PANTALLA PRINCIPAL ───────────────────────────────────
export function InventoryScreen({ inventory=[], onRefresh, onBack }) {
  const [vista,    setVista]    = useState("lista");
  const [producto, setProducto] = useState(null);

  async function alGuardar() {
    if (onRefresh) await onRefresh();
    setVista("lista");
  }

  if (vista === "editar" && producto) return (
    <EditInventoryItem
      item={producto}
      onBack={() => setVista("lista")}
      onSaved={alGuardar}
    />
  );

  return (
    <InventoryList
      items={inventory}
      onBack={onBack}
      onEdit={p => { setProducto(p); setVista("editar"); }}
    />
  );
}