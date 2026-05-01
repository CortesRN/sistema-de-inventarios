import { useEffect, useRef, useState } from "react";
import { C, FONT, Btn, Inp, Card, SectionTitle, TopBar,
         InfoBox, Badge, EmptyState, HelpTip } from "./ui.jsx";
import { dbCreate, dbUpdate, nextId, padId } from "./firebase.js";
import { COL, CATEGORIAS, UBICACIONES } from "./config.js";

// ─── FORMATEO ─────────────────────────────────────────────
function fmt(n, dec=2) {
  const num = Math.abs(parseFloat(n) || 0);
  const parts = num.toFixed(dec).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}
function mxn(n) { return "$ " + fmt(n, 2); }
function hoyISO() { return new Date().toISOString().slice(0, 10); }
function qrUrl(value, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(String(value || ""))}`;
}
function terminoNatural(value) {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const conocidos = {
    unisexo: "Unisex",
    unisex: "Unisex",
    boleto: "Ticket",
    boletos: "Tickets",
    ticket: "Ticket",
    tickets: "Tickets",
    // Normalizacion de género sin acentos (datos legacy)
    nina: "Niña",
    nino: "Niño",
    niña: "Niña",
    niño: "Niño",
    mujer: "Mujer",
    hombre: "Hombre",
  };

  return conocidos[raw.toLowerCase()] || raw;
}

function nombreCortoEtiqueta(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Producto CASI";
  return raw.length > 42 ? `${raw.slice(0, 39)}...` : raw;
}

function abrirImpresionEtiquetas(productos) {
  if (!productos.length) return;
  const popup = window.open("", "_blank", "width=1100,height=820");
  if (!popup) return;

  const labelsHtml = productos.map(item => {
    const clave = item.clave || item.idInterno || item.id;
    const titulo = nombreCortoEtiqueta(item.nombre);
    const detalle = [item.talla && `Talla ${item.talla}`, terminoNatural(item.genero)].filter(Boolean).join(" · ");
    const precio = Number(item.precio || 0) > 0 ? `${mxn(item.precio)} MXN` : "Sin precio";
    return `
      <div class="label">
        <div class="top">
          <div class="brand">CASI</div>
          <div class="sku">${clave}</div>
        </div>
        <div class="body">
          <div class="title">${titulo}</div>
          <div class="meta">${detalle || "&nbsp;"}</div>
          <div class="qrWrap">
            <img class="qr" src="${qrUrl(clave, 180)}" alt="QR ${clave}" />
          </div>
          <div class="price">${precio}</div>
        </div>
      </div>
    `;
  }).join("");

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Etiquetas CASI</title>
        <style>
          @page {
            size: letter portrait;
            margin: 0.35in;
          }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f7f1ea;
            color: #0a0a0a;
          }
          body, .label, .top, .price, .qr {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .toolbar {
            position: sticky;
            top: 0;
            z-index: 20;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background: rgba(255,255,255,0.96);
            border-bottom: 1px solid #e5ddd5;
            backdrop-filter: blur(8px);
          }
          .toolbarTitle {
            font-size: 13px;
            font-weight: 700;
            color: #0a0a0a;
            letter-spacing: 0.6px;
          }
          .toolbarBtn {
            padding: 10px 14px;
            border: none;
            background: #0a0a0a;
            color: #ffffff;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .sheet {
            padding: 0.18in;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(3, 2.25in);
            gap: 0.16in;
            justify-content: center;
          }
          .label {
            width: 2.25in;
            min-height: 3.1in;
            border: 1px solid #d9cbbb;
            background: linear-gradient(180deg, #fffaf5 0%, #ffffff 100%);
            box-shadow: 0 3px 10px rgba(0,0,0,0.05);
            box-sizing: border-box;
            overflow: hidden;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .top {
            background: linear-gradient(135deg, #0a0a0a 0%, #3a2619 100%);
            color: #ffffff;
            padding: 0.12in 0.12in 0.1in;
          }
          .brand {
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 2px;
            text-transform: uppercase;
            text-align: center;
            opacity: 0.92;
          }
          .sku {
            font-size: 15px;
            font-weight: 900;
            text-align: center;
            margin-top: 0.08in;
            letter-spacing: 0.6px;
          }
          .body {
            padding: 0.12in 0.11in 0.12in;
          }
          .title {
            font-size: 12px;
            font-weight: 700;
            text-align: center;
            line-height: 1.15;
            min-height: 0.42in;
            margin-bottom: 0.06in;
          }
          .meta {
            font-size: 9px;
            text-align: center;
            color: #7a6a5a;
            min-height: 0.18in;
            text-transform: uppercase;
            letter-spacing: 0.7px;
            margin-bottom: 0.08in;
          }
          .qrWrap {
            display: flex;
            justify-content: center;
            margin-bottom: 0.08in;
          }
          .qr {
            width: 1.28in;
            height: 1.28in;
            object-fit: contain;
            background: #ffffff;
            padding: 4px;
            border: 1px solid #ece2d7;
          }
          .price {
            font-size: 18px;
            font-weight: 900;
            text-align: center;
            color: #c4622d;
            margin-top: 0.03in;
          }
          @media print {
            body {
              background: #ffffff;
            }
            .toolbar {
              display: none;
            }
            .sheet {
              padding: 0;
            }
            .label {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
          <div class="toolbar">
          <div class="toolbarTitle">${productos.length} etiqueta(s) listas para imprimir · si cambia el color al imprimir, activa fondos/graficos de fondo</div>
          <button class="toolbarBtn" onclick="window.print()">Imprimir</button>
        </div>
        <div class="sheet">
          <div class="grid">${labelsHtml}</div>
        </div>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
}

// ─── ESTADO LEGIBLE ───────────────────────────────────────
function infoEstado(estado, esProvisional) {
  if (estado === "en_venta" && esProvisional) {
    return { label:"📦 En bodega (sin envío)", color:C.warn, bg:C.warnFade };
  }
  return {
    disponible:{ label:"🧾 Disponible", color:"#255A88", bg:"#E3EEF9" },
    en_venta:  { label:"✅ En venta",    color:C.ok,     bg:C.okFade     },
    en_bodega: { label:"📦 En bodega",   color:C.info,   bg:C.infoFade   },
    reservado: { label:"⏳ Reservado",   color:C.warn,   bg:C.warnFade   },
    vendido:   { label:"🏷️ Vendido",    color:C.purple, bg:C.purpleFade },
    inactivo:  { label:"⛔ Inactivo",    color:C.muted,  bg:C.stone      },
  }[estado] || { label:"📦 En bodega", color:C.info, bg:C.infoFade };
}

// ─── TABS DE ESTADO ───────────────────────────────────────
const TABS_ESTADO = [
  { id:"todos",     label:"Todos"      },
  { id:"disponible",label:"Disponibles"},
  { id:"en_venta",  label:"En venta"   },
  { id:"en_bodega", label:"En bodega"  },
  { id:"reservado", label:"Reservados" },
  { id:"vendido",   label:"Vendidos"   },
];

const OPTS_EXTRA = [
  { id:"todos",        label:"Sin filtro"          },
  { id:"sin_foto",     label:"Sin foto 📷"         },
  { id:"sin_precio",   label:"Sin precio 💰"       },
  { id:"provisional",  label:"Costo provisional ⚠️"},
  { id:"con_foto",     label:"Con foto ✓"          },
  { id:"con_precio",   label:"Con precio ✓"        },
];

const METODOS_VENTA = [
  { value:"efectivo", label:"Efectivo" },
  { value:"transferencia", label:"Transferencia" },
  { value:"tarjeta", label:"Tarjeta" },
  { value:"mixto", label:"Mixto" },
];

const CANALES_VENTA = [
  { value:"mostrador", label:"Mostrador" },
  { value:"whatsapp", label:"WhatsApp" },
  { value:"instagram", label:"Instagram" },
  { value:"facebook", label:"Facebook" },
  { value:"pedido_directo", label:"Pedido directo" },
  { value:"otro", label:"Otro" },
];

const POR_PAGINA = 30;

const INVENTORY_BG = "#FFFFFF";
const INVENTORY_PANEL = "#FFFFFF";
const INVENTORY_PANEL_ALT = "#F7FAFD";
const INVENTORY_SHADOW = "0 10px 24px rgba(34, 58, 92, 0.08)";

function InventorySectionTitle({ children, help, action, onAction, small }) {
  return (
    <SectionTitle
      action={action}
      onAction={onAction}
      small={small}
    >
      <span style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span>{children}</span>
        {help && <HelpTip text={help} title={typeof children === "string" ? children : "Ayuda"} />}
      </span>
    </SectionTitle>
  );
}

function InventoryPanel({ children, tone="base", style }) {
  const bgMap = {
    base: INVENTORY_PANEL,
    soft: "#FBF7F2",
    warm: INVENTORY_PANEL_ALT,
  };
  return (
    <div style={{
      background:bgMap[tone] || INVENTORY_PANEL,
      border:`1px solid ${C.border}`,
      borderRadius:22,
      boxShadow:INVENTORY_SHADOW,
      padding:"14px 14px 6px",
      marginBottom:14,
      ...style,
    }}>
      {children}
    </div>
  );
}

function buscarProducto(items, raw) {
  const q = String(raw || "").trim().toLowerCase();
  if (!q) return null;
  return items.find(item =>
    [item.clave, item.idInterno, item.nombre, item.ticketOrigen]
      .filter(Boolean)
      .some(value => String(value).trim().toLowerCase() === q)
  ) || null;
}

// ─── LISTA DE INVENTARIO ──────────────────────────────────
export function InventoryList({ items, onEdit, onBack, onRefresh, onLabels, onMultiSale }) {
  const [busqueda,     setBusqueda]     = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroCateg,  setFiltroCateg]  = useState("Todas");
  const [filtroExtra,  setFiltroExtra]  = useState("todos");
  const [filtroMarca,  setFiltroMarca]  = useState("Todas");
  const [filtroTicket, setFiltroTicket] = useState("Todos");
  const [filtroEnvio,  setFiltroEnvio]  = useState("Todos");
  const [filtroGenero, setFiltroGenero] = useState("Todos");
  const [pagina,       setPagina]       = useState(1);
  const [verFiltros,   setVerFiltros]   = useState(false);
  const [modoSeleccion,setModoSeleccion]= useState(false);
  const [seleccion,    setSeleccion]    = useState([]);
  const [destinoLote,  setDestinoLote]  = useState("bodega_scl");
  const [moviendoLote, setMoviendoLote] = useState(false);
  const [flash,        setFlash]        = useState("");

  // Opciones derivadas de los datos reales
  const marcas  = ["Todas", ...new Set(items.map(i => i.marca).filter(Boolean).sort())];
  const tickets = ["Todos", ...new Set(items.map(i => i.ticketOrigen).filter(Boolean).sort())];
  const envios  = ["Todos", ...new Set(items.map(i => i.shipmentId).filter(Boolean).sort())];
  const categs  = ["Todas", ...new Set(items.map(i => i.categoria).filter(Boolean).sort())];

  // Aplicar filtros
  const filtrados = items.filter(item => {
    if (filtroEstado !== "todos"  && item.estado    !== filtroEstado)  return false;
    if (filtroCateg  !== "Todas"  && item.categoria !== filtroCateg)   return false;
    if (filtroMarca  !== "Todas"  && item.marca     !== filtroMarca)   return false;
    if (filtroTicket !== "Todos"  && item.ticketOrigen !== filtroTicket) return false;
    if (filtroEnvio  !== "Todos"  && item.shipmentId !== filtroEnvio) return false;
    if (filtroGenero !== "Todos"  && terminoNatural(item.genero) !== filtroGenero)  return false;
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
              item.color, item.ticketOrigen, item.descripcion, terminoNatural(item.genero)]
        .some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  // Filtrados sin el filtro de estado — para contar cuantos hay por estado
  // respetando los demas filtros activos (categoria, marca, busqueda, etc.)
  const filtradosSinEstado = items.filter(item => {
    if (filtroCateg  !== "Todas"  && item.categoria !== filtroCateg)   return false;
    if (filtroMarca  !== "Todas"  && item.marca     !== filtroMarca)   return false;
    if (filtroTicket !== "Todos"  && item.ticketOrigen !== filtroTicket) return false;
    if (filtroEnvio  !== "Todos"  && item.shipmentId !== filtroEnvio) return false;
    if (filtroGenero !== "Todos"  && terminoNatural(item.genero) !== filtroGenero)  return false;
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
              item.color, item.ticketOrigen, item.descripcion, terminoNatural(item.genero)]
        .some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const visibles = filtrados.slice(0, pagina * POR_PAGINA);
  const hayMas   = filtrados.length > visibles.length;
  function resetPagina() { setPagina(1); }
  const ubicacionesFisicas = UBICACIONES.filter(u => u.value !== "usa");
  const seleccionadosVisibles = visibles.filter(item => seleccion.includes(item.id));
  const filtradosSeleccionables = filtrados.filter(item => item.estado !== "vendido");
  const idsFiltrados = filtradosSeleccionables.map(item => item.id);
  const todosFiltradosTomados = idsFiltrados.length > 0 && idsFiltrados.every(id => seleccion.includes(id));

  function toggleSeleccion(id) {
    setSeleccion(actual => actual.includes(id)
      ? actual.filter(x => x !== id)
      : [...actual, id]);
  }

  function toggleSeleccionVisible() {
    const idsVisibles = visibles.filter(item => item.estado !== "vendido").map(item => item.id);
    const yaTodos = idsVisibles.length > 0 && idsVisibles.every(id => seleccion.includes(id));
    setSeleccion(actual => yaTodos
      ? actual.filter(id => !idsVisibles.includes(id))
      : [...new Set([...actual, ...idsVisibles])]);
  }

  function toggleSeleccionFiltrados() {
    setSeleccion(actual => todosFiltradosTomados
      ? actual.filter(id => !idsFiltrados.includes(id))
      : [...new Set([...actual, ...idsFiltrados])]);
  }

  function aplicarFiltro(cambio, cerrar = false) {
    cambio();
    resetPagina();
    if (cerrar) setVerFiltros(false);
  }

  async function moverSeleccion() {
    const seleccionados = items.filter(item => seleccion.includes(item.id) && item.estado !== "vendido");
    if (!seleccionados.length || moviendoLote) return;
    setMoviendoLote(true);
    setFlash("");
    try {
      for (const item of seleccionados) {
        await dbUpdate(COL.inventario, item.id, { ubicacion: destinoLote });
      }
      if (onRefresh) await onRefresh();
      setFlash(`Se actualizo la ubicacion de ${seleccionados.length} producto(s).`);
      setSeleccion([]);
      setModoSeleccion(false);
    } finally {
      setMoviendoLote(false);
    }
  }

  // Stats
  const total        = items.length;
  const disponibles  = items.filter(i => i.estado === "disponible").length;
  const enVenta      = items.filter(i => i.estado === "en_venta").length;
  const enBodega     = items.filter(i => i.estado === "en_bodega").length;
  const reservados   = items.filter(i => i.estado === "reservado").length;
  const vendidos     = items.filter(i => i.estado === "vendido").length;
  const sinFoto      = items.filter(i => !i.foto).length;
  const sinPrecio    = items.filter(i => i.estado !== "vendido" && !(i.precio > 0)).length;
  const provisionales = items.filter(i => i.esProvisional).length;

  return (
    <div style={{ background:INVENTORY_BG, minHeight:"100%" }}>

      {/* Header */}
      <div style={{ position:"sticky", top:0, zIndex:10, background:"rgba(255,252,248,0.94)",
        backdropFilter:"blur(12px)", borderBottom:`1px solid ${C.border}`, padding:"12px 16px",
        display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {onBack && (
            <button onClick={onBack} style={{ background:C.black, border:"none", width:34, height:34,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              color:C.white, fontSize:18 }}>←</button>
          )}
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:C.info, letterSpacing:3,
              textTransform:"uppercase" }}>Inventario</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.black,
              fontFamily:FONT.display }}>Bodega</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={onMultiSale} style={{
            background:`linear-gradient(135deg, ${C.black} 0%, ${C.terraD} 100%)`,
            border:"1px solid rgba(255,255,255,0.1)",
            padding:"9px 13px", fontSize:11, fontWeight:800, cursor:"pointer",
            color:C.white, borderRadius:16,
            boxShadow:"0 12px 22px rgba(22,22,22,0.16)",
          }}>💸 Vender</button>
          <button onClick={onLabels} style={{
            background:"rgba(255,252,248,0.92)", border:`1.5px solid ${C.border}`,
            padding:"9px 13px", fontSize:11, fontWeight:800, cursor:"pointer",
            color:C.black, borderRadius:16,
            boxShadow:"0 10px 20px rgba(22,22,22,0.05)",
          }}>🏷 Etiquetas</button>
          <button onClick={() => setVerFiltros(!verFiltros)} style={{
            background:verFiltros
              ? `linear-gradient(135deg, ${C.black} 0%, ${C.terraD} 100%)`
              : "rgba(255,252,248,0.92)",
            border:verFiltros ? "1px solid rgba(255,255,255,0.12)" : `1.5px solid ${C.border}`,
            padding:"9px 13px", fontSize:11, fontWeight:800, cursor:"pointer",
            color:verFiltros ? C.white : C.black, borderRadius:16,
            boxShadow:verFiltros ? "0 12px 22px rgba(22,22,22,0.16)" : "0 10px 20px rgba(22,22,22,0.05)",
          }}>{verFiltros ? "✕ Cerrar" : "⚙ Filtros"}</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", overflowX:"auto", gap:6,
        padding:"10px 16px 8px", scrollbarWidth:"none" }}>
        {[
          { label:"Total",       v:total,         c:C.black  },
          { label:"Disponibles", v:disponibles,   c:"#255A88" },
          { label:"En venta",    v:enVenta,        c:C.ok     },
          { label:"En bodega",   v:enBodega,       c:C.info   },
          { label:"Reservados",  v:reservados,     c:C.warn   },
          { label:"Vendidos",    v:vendidos,       c:C.purple },
          { label:"Sin foto",    v:sinFoto,        c:C.danger },
          { label:"Sin precio",  v:sinPrecio,      c:C.warn   },
          { label:"Provisional", v:provisionales,  c:C.warn   },
        ].map(s => (
          <div key={s.label} style={{ flexShrink:0, background:INVENTORY_PANEL,
            padding:"8px 11px", textAlign:"center", minWidth:58,
            border:`1px solid ${C.border}`, borderRadius:14, boxShadow:"0 4px 10px rgba(0,0,0,0.04)" }}>
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
          <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
            <span>⚠️ {provisionales} con costo provisional</span>
            <HelpTip title="Costo provisional" text="Estas piezas ya estan contadas en tu inventario. Solo falta registrar el envio para cerrarles el costo final." />
          </span>
        </div>
      )}
      {flash && (
        <div style={{ margin:"0 16px 8px", background:C.okFade,
          borderLeft:`3px solid ${C.ok}`, padding:"8px 12px",
          fontSize:11, color:C.ok, fontWeight:600 }}>
          {flash}
        </div>
      )}

      <div style={{
        position:"sticky",
        top:66,
        zIndex:9,
        background:"#ffffff",
        boxShadow:"0 8px 20px rgba(24,33,47,0.05)",
      }}>
        {/* Búsqueda */}
        <div style={{ padding:"8px 16px 8px" }}>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:11, top:"50%",
              transform:"translateY(-50%)", fontSize:13, color:C.muted }}>⌕</span>
            <input value={busqueda} onChange={e => { setBusqueda(e.target.value); resetPagina(); }}
              placeholder="Clave, nombre, marca, talla, color, ticket…"
              style={{ width:"100%", boxSizing:"border-box", padding:"10px 32px 10px 32px",
                border:`1.5px solid ${C.border}`, fontSize:12, outline:"none",
                background:INVENTORY_PANEL, color:C.black, fontFamily:FONT.body,
                borderRadius:14, boxShadow:"inset 0 1px 0 rgba(255,255,255,0.6)" }}/>
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
            const cantidad = f.id === "todos" ? filtradosSinEstado.length
              : filtradosSinEstado.filter(i => i.estado === f.id).length;
            const activo = filtroEstado === f.id;
            const si = infoEstado(f.id === "todos" ? "en_bodega" : f.id);
            return (
              <button key={f.id} onClick={() => aplicarFiltro(() => setFiltroEstado(f.id), false)} style={{
                padding:"10px 12px", border:"none", background:"none",
                cursor:"pointer", flexShrink:0, fontSize:10, fontWeight:800,
                letterSpacing:.5, textTransform:"uppercase", whiteSpace:"nowrap",
                color:activo ? si.color : "#4D617B",
                textShadow:activo ? "none" : "0 1px 0 rgba(255,255,255,0.55)",
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
          <>
          <button
            type="button"
            onClick={() => setVerFiltros(false)}
            aria-label="Cerrar filtros"
            style={{
              position:"fixed",
              inset:0,
              zIndex:19,
              background:"rgba(24,33,47,0.18)",
              border:"none",
              padding:0,
              margin:0,
            }}
          />
          <div style={{
            position:"fixed",
            top:118,
            left:10,
            right:10,
            bottom:14,
            zIndex:20,
            padding:"14px 16px 16px",
            background:INVENTORY_PANEL_ALT,
            border:`1px solid ${C.border}`,
            borderRadius:24,
            boxShadow:"0 24px 48px rgba(24,33,47,0.18)",
            overflowY:"auto",
            overscrollBehavior:"contain",
            WebkitOverflowScrolling:"touch",
            touchAction:"pan-y",
          }}>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:800, color:C.info, letterSpacing:2.2, textTransform:"uppercase" }}>
                Filtros
              </div>
              <div style={{ fontSize:13, fontWeight:800, color:C.black }}>
                Afinar inventario
              </div>
            </div>
            <button
              type="button"
              onClick={() => setVerFiltros(false)}
              style={{
                width:30,
                height:30,
                borderRadius:"50%",
                border:`1px solid ${C.border}`,
                background:C.white,
                color:C.muted,
                fontSize:16,
                cursor:"pointer",
                display:"flex",
                alignItems:"center",
                justifyContent:"center",
                boxShadow:"0 8px 18px rgba(24,33,47,0.08)",
              }}
            >
              ×
            </button>
          </div>

          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted,
              letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Género</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {["Todos","Mujer","Hombre","Niña","Niño","Unisex"].map(g => (
                <button key={g} onClick={() => aplicarFiltro(() => setFiltroGenero(g))} style={{
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
                <button key={f.id} onClick={() => aplicarFiltro(() => setFiltroExtra(f.id))} style={{
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
                <select value={val} onChange={e => aplicarFiltro(() => set(e.target.value))}
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
            <select value={filtroTicket} onChange={e => aplicarFiltro(() => setFiltroTicket(e.target.value))}
              style={{ width:"100%", padding:"7px 8px", border:`1.5px solid ${C.border}`,
                fontSize:11, outline:"none", background:C.white,
                color:C.black, fontFamily:FONT.body }}>
              {tickets.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted,
              letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Envío</div>
            <select value={filtroEnvio} onChange={e => aplicarFiltro(() => setFiltroEnvio(e.target.value))}
              style={{ width:"100%", padding:"7px 8px", border:`1.5px solid ${C.border}`,
                fontSize:11, outline:"none", background:C.white,
                color:C.black, fontFamily:FONT.body }}>
              {envios.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <button onClick={() => {
            setFiltroEstado("todos"); setFiltroCateg("Todas"); setFiltroExtra("todos");
            setFiltroMarca("Todas"); setFiltroTicket("Todos"); setFiltroEnvio("Todos"); setFiltroGenero("Todos");
            setBusqueda(""); resetPagina();
          }} style={{ width:"100%", padding:"8px",
            border:`1.5px solid ${C.border}`, fontSize:11, fontWeight:800,
            cursor:"pointer", color:C.black, letterSpacing:.7, textTransform:"uppercase",
            borderRadius:16, background:"rgba(255,252,248,0.84)" }}>
            ✕ Limpiar filtros
          </button>
          <button onClick={() => setVerFiltros(false)} style={{ width:"100%", padding:"10px 12px",
            marginTop:8, border:"1px solid rgba(255,255,255,0.12)", fontSize:11, fontWeight:800,
            cursor:"pointer", color:C.white, letterSpacing:.7, textTransform:"uppercase",
            borderRadius:16, background:`linear-gradient(135deg, ${C.black} 0%, ${C.terraD} 100%)`,
            boxShadow:"0 12px 22px rgba(24,33,47,0.14)" }}>
            Ver productos
          </button>
          </div>
          </>
        )}

      {/* Contador */}
      <div style={{ padding:"6px 16px", display:"flex", justifyContent:"space-between" }}>
        <div style={{ fontSize:10, color:C.muted, letterSpacing:.5 }}>
          {filtrados.length === total
            ? `${total} PRODUCTOS`
            : `${filtrados.length} DE ${total} RESULTADOS`}
        </div>
        <button onClick={() => {
          setModoSeleccion(v => !v);
          setSeleccion([]);
          setFlash("");
        }} style={{
          background:modoSeleccion ? `linear-gradient(135deg, ${C.black} 0%, ${C.terraD} 100%)` : "rgba(255,252,248,0.92)",
          color:modoSeleccion ? C.white : C.black,
          border:modoSeleccion ? "1px solid rgba(255,255,255,0.1)" : `1.5px solid ${C.border}`,
          padding:"8px 12px",
          fontSize:10,
          fontWeight:800,
          cursor:"pointer",
          letterSpacing:.7,
          textTransform:"uppercase",
          borderRadius:16,
          boxShadow:modoSeleccion ? "0 12px 22px rgba(22,22,22,0.16)" : "0 10px 20px rgba(22,22,22,0.05)",
        }}>
          {modoSeleccion ? "Cerrar seleccion" : "Mover en lote"}
        </button>
      </div>

      {modoSeleccion && (
        <div style={{ margin:"0 16px 10px", background:INVENTORY_PANEL, border:`1px solid ${C.border}`, padding:"12px", borderRadius:18, boxShadow:INVENTORY_SHADOW }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:10 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, fontWeight:700, color:C.black }}>
                <span>Mover ubicacion en lote</span>
                <HelpTip title="Mover en lote" text="Esto solo cambia la ubicacion fisica de varias piezas. No toca estado, precio, costo ni datos de venta." />
              </div>
              <div style={{ fontSize:11, color:C.muted }}>
                Selecciona piezas y asignales una ubicacion fisica.
              </div>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end" }}>
              <button onClick={toggleSeleccionFiltrados} style={{
                background:`linear-gradient(135deg, ${C.black} 0%, ${C.terraD} 100%)`, color:C.white,
                border:"1px solid rgba(255,255,255,0.1)", padding:"9px 12px",
                fontSize:10, fontWeight:800, cursor:"pointer", textTransform:"uppercase",
                borderRadius:15, boxShadow:"0 12px 22px rgba(22,22,22,0.14)",
              }}>
                {todosFiltradosTomados ? "Quitar filtrados" : "Tomar filtrados"}
              </button>
              <button onClick={toggleSeleccionVisible} style={{
                background:"rgba(255,252,248,0.92)", color:C.black, border:`1.5px solid ${C.border}`, padding:"9px 12px",
                fontSize:10, fontWeight:800, cursor:"pointer", textTransform:"uppercase",
                borderRadius:15, boxShadow:"0 10px 20px rgba(22,22,22,0.05)",
              }}>
                {seleccionadosVisibles.length === visibles.filter(item => item.estado !== "vendido").length && visibles.some(item => item.estado !== "vendido")
                  ? "Quitar visibles"
                  : "Tomar visibles"}
              </button>
            </div>
          </div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>
            {filtradosSeleccionables.length} producto(s) filtrados listos para seleccion en lote.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, alignItems:"end" }}>
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:C.muted,
                letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Nueva ubicacion</div>
              <select value={destinoLote} onChange={e => setDestinoLote(e.target.value)}
                style={{ width:"100%", padding:"9px 8px", border:`1.5px solid ${C.border}`,
                  fontSize:11, outline:"none", background:C.white,
                  color:C.black, fontFamily:FONT.body }}>
                {ubicacionesFisicas.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            <button onClick={moverSeleccion} disabled={!seleccion.length || moviendoLote} style={{
              padding:"11px 12px",
              background:!seleccion.length || moviendoLote ? C.border : `linear-gradient(135deg, ${C.ok} 0%, #235941 100%)`,
              color:C.white,
              border:"1px solid rgba(255,255,255,0.1)",
              fontSize:11,
              fontWeight:800,
              cursor:!seleccion.length || moviendoLote ? "not-allowed" : "pointer",
              textTransform:"uppercase",
              borderRadius:16,
              boxShadow:!seleccion.length || moviendoLote ? "none" : "0 14px 28px rgba(46,125,87,0.22)",
            }}>
              {moviendoLote ? "Moviendo..." : `Aplicar a ${seleccion.length}`}
            </button>
          </div>
          </div>
        )}
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
            <div key={item.clave || item.idInterno || item.id} onClick={() => modoSeleccion ? undefined : onEdit(item)}
              style={{ display:"flex", gap:12, alignItems:"flex-start",
                padding:"12px", marginBottom:10, border:`1px solid ${C.border}`,
                borderRadius:18, boxShadow:"0 6px 18px rgba(40,30,22,0.05)",
                cursor:modoSeleccion ? "default" : "pointer", background:INVENTORY_PANEL }}>

              {modoSeleccion && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.estado === "vendido") return;
                    toggleSeleccion(item.id);
                  }}
                  disabled={item.estado === "vendido"}
                  style={{
                    marginTop:22,
                    width:24,
                    height:24,
                    borderRadius:"50%",
                    border:`1.5px solid ${seleccion.includes(item.id) ? C.ok : C.border}`,
                    background:item.estado === "vendido" ? C.stone : (seleccion.includes(item.id) ? C.ok : C.white),
                    color:item.estado === "vendido" ? C.muted : C.white,
                    fontSize:12,
                    fontWeight:900,
                    cursor:item.estado === "vendido" ? "not-allowed" : "pointer",
                    flexShrink:0,
                  }}
                >
                  {item.estado === "vendido" ? "—" : (seleccion.includes(item.id) ? "✓" : "")}
                </button>
              )}

              {/* Thumbnail */}
              <div style={{ width:56, height:72, background:C.stone,
                flexShrink:0, overflow:"hidden", position:"relative", borderRadius:12 }}>
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

                <div style={{ fontSize:10, fontWeight:700, color:C.info,
                  letterSpacing:.8, marginBottom:3, textTransform:"uppercase" }}>{item.clave}</div>

                <div style={{ fontSize:13, fontWeight:700, color:C.black,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.3 }}>
                  {item.nombre || "Sin nombre"}
                </div>

                <div style={{ fontSize:11, color:C.muted, marginTop:1 }} translate="no">
                  {[item.marca, item.categoria, terminoNatural(item.genero),
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
            width:"100%", padding:"13px", background:INVENTORY_PANEL,
            border:`1.5px solid ${C.border}`, fontSize:12, fontWeight:700,
            cursor:"pointer", color:C.black, letterSpacing:1, textTransform:"uppercase",
            borderRadius:18, boxShadow:INVENTORY_SHADOW,
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
  const [genero,      setGenero]      = useState(terminoNatural(item.genero) || "");
  const [foto,        setFoto]        = useState(item.foto        || "");
  const [precio,      setPrecio]      = useState(item.precio > 0 ? String(item.precio) : "");
  const [activo,      setActivo]      = useState(item.activo      || false);
  const [ubicacion,   setUbicacion]   = useState(item.ubicacion   || "usa");
  const [fechaCompra, setFechaCompra] = useState(item.fechaCompra || "");
  const [guardando,   setGuardando]   = useState(false);
  const [guardado,    setGuardado]    = useState(false);
  const [showSell,    setShowSell]    = useState(false);
  const [showSaleEdit,setShowSaleEdit]= useState(false);
  const [vendiendo,   setVendiendo]   = useState(false);
  const [ventaOk,     setVentaOk]     = useState(false);
  const [precioVenta, setPrecioVenta] = useState(item.precio > 0 ? String(item.precio) : "");
  const [fechaVenta,  setFechaVenta]  = useState(hoyISO());
  const [metodoPagoVenta, setMetodoPagoVenta] = useState(item.metodoPagoVenta || "efectivo");
  const [canalVenta,  setCanalVenta]  = useState(item.canalVenta || "mostrador");
  const [vendedorVenta, setVendedorVenta] = useState(item.vendedorVenta || "");
  const [clienteVenta, setClienteVenta] = useState(item.clienteVenta || "");
  const [notaVenta,   setNotaVenta]   = useState("");

  // Costo en MXN — soporta campos nuevos
  const costoMXN   = item.costoMXN || ((item.costoTotalUSD||0) * (item.tipoCambio||20));
  const precioNum  = parseFloat(precio) || 0;
  const precioVentaNum = parseFloat(precioVenta) || 0;
  const ganancia   = precioNum > 0 && costoMXN > 0 ? parseFloat((precioNum - costoMXN).toFixed(2)) : 0;
  const margenPct  = precioNum > 0 && costoMXN > 0 ? Math.round((ganancia/costoMXN)*100) : 0;
  const sugerido   = Math.round(costoMXN * 2);
  const datosBaseCompletos = Boolean(nombre && foto && color);
  const completo   = Boolean(datosBaseCompletos && precioNum > 0);
  const visibleEnTienda = Boolean(completo && precioNum > 0 && activo && !item.esProvisional && item.estado !== "vendido");
  const yaVendido = item.estado === "vendido";
  const claveEtiqueta = item.clave || item.idInterno || item.id;
  const etiquetaTitulo = nombreCortoEtiqueta(nombre);
  const etiquetaDetalle = [talla && `Talla ${talla}`, terminoNatural(genero)].filter(Boolean).join(" · ");

  function imprimirEtiqueta() {
    const qr = qrUrl(claveEtiqueta, 260);
    const popup = window.open("", "_blank", "width=420,height=620");
    if (!popup) return;
    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Etiqueta ${claveEtiqueta}</title>
          <style>
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              background: #f7f1ea;
              color: #0a0a0a;
            }
            body, .label, .top, .price, .qr {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .toolbar {
              position: sticky;
              top: 0;
              z-index: 20;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
              padding: 12px 16px;
              background: rgba(255,255,255,0.96);
              border-bottom: 1px solid #e5ddd5;
              backdrop-filter: blur(8px);
            }
            .toolbarTitle {
              font-size: 13px;
              font-weight: 700;
              color: #0a0a0a;
              letter-spacing: 0.6px;
            }
            .toolbarBtn {
              padding: 10px 14px;
              border: none;
              background: #0a0a0a;
              color: #ffffff;
              font-size: 12px;
              font-weight: 700;
              cursor: pointer;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .sheet {
              padding: 18px;
              display: flex;
              justify-content: center;
            }
            .label {
              width: 280px;
              border: 1.5px solid #d9cbbb;
              background:
                linear-gradient(180deg, #fffaf5 0%, #ffffff 100%);
              box-shadow: 0 6px 18px rgba(0,0,0,0.08);
              padding: 0;
              box-sizing: border-box;
              overflow: hidden;
            }
            .top {
              background: linear-gradient(135deg, #0a0a0a 0%, #3a2619 100%);
              color: #ffffff;
              padding: 12px 14px 10px;
            }
            .brand {
              font-size: 12px;
              font-weight: 800;
              letter-spacing: 3px;
              text-transform: uppercase;
              text-align: center;
              opacity: 0.92;
            }
            .sku {
              font-size: 21px;
              font-weight: 900;
              text-align: center;
              margin: 8px 0 0;
              letter-spacing: 1px;
            }
            .body {
              padding: 14px 14px 14px;
            }
            .title {
              font-size: 16px;
              font-weight: 700;
              text-align: center;
              line-height: 1.2;
              margin-bottom: 8px;
            }
            .meta {
              font-size: 12px;
              text-align: center;
              color: #7a6a5a;
              margin-bottom: 12px;
              min-height: 16px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .qrWrap {
              display: flex;
              justify-content: center;
              margin-bottom: 12px;
            }
            .qr {
              width: 170px;
              height: 170px;
              object-fit: contain;
              background: #ffffff;
              padding: 6px;
              border: 1px solid #ece2d7;
            }
            .price {
              font-size: 26px;
              font-weight: 900;
              text-align: center;
              margin: 6px 0 0;
              color: #c4622d;
            }
            .foot {
              font-size: 10px;
              text-align: center;
              color: #6b6b6b;
              margin-top: 8px;
              text-transform: uppercase;
              letter-spacing: 1.5px;
            }
            @media print {
              body { margin: 0; }
              .toolbar { display: none; }
              .sheet { padding: 0; }
              .label { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <div class="toolbarTitle">Etiqueta ${claveEtiqueta} · si cambia el color al imprimir, activa fondos/graficos de fondo</div>
            <button class="toolbarBtn" onclick="window.print()">Imprimir</button>
          </div>
          <div class="sheet">
            <div class="label">
              <div class="top">
                <div class="brand">CASI</div>
                <div class="sku">${claveEtiqueta}</div>
              </div>
              <div class="body">
                <div class="title">${etiquetaTitulo}</div>
                <div class="meta">${etiquetaDetalle || "&nbsp;"}</div>
                <div class="qrWrap"><img class="qr" src="${qr}" alt="QR ${claveEtiqueta}" /></div>
                <div class="price">${precioNum > 0 ? `${mxn(precioNum)} MXN` : "Sin precio"}</div>
                <div class="foot">Escanea o captura la clave</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
  }

  async function guardar() {
    setGuardando(true);
    const nuevoEstado = item.estado === "vendido" ? "vendido"
      : !completo || item.esProvisional ? "en_bodega"
      : activo ? "en_venta"
      : "disponible";

    await dbUpdate(COL.inventario, item.id, {
      nombre, categoria, marca, descripcion, talla, color, genero: terminoNatural(genero),
      foto,
      precio:     precioNum,
      activo:     completo ? activo : false,
      estado:     nuevoEstado,
      ubicacion,
      fechaCompra,
    });
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => { setGuardado(false); onSaved(); }, 1200);
  }

  async function venderProducto() {
    if (precioVentaNum <= 0 || vendiendo) return;
    setVendiendo(true);
    try {
      const ventaNum = await nextId("sale");
      const ventaId = padId(ventaNum, "VEN-");
      const vendidoAt = new Date().toISOString();
      const utilidad = Number((precioVentaNum - costoMXN).toFixed(2));

      await dbCreate(COL.ventas, ventaId, {
        ventaId,
        productoId: item.id,
        clave: item.clave || "",
        idInterno: item.idInterno || "",
        ticketOrigen: item.ticketOrigen || "",
        shipmentId: item.shipmentId || "",
        nombre: nombre || item.nombre || "",
        categoria: categoria || item.categoria || "",
        marca: marca || item.marca || "",
        talla: talla || item.talla || "",
        genero: terminoNatural(genero || item.genero || ""),
        precioVenta: precioVentaNum,
        costoMXN,
        utilidad,
        fechaVenta,
        vendidoAt,
        metodoPago: metodoPagoVenta,
        canalVenta,
        vendedor: vendedorVenta.trim(),
        cliente: clienteVenta.trim(),
        nota: notaVenta.trim(),
        origen: "manual_admin",
        createdAt: vendidoAt,
      });

      await dbUpdate(COL.inventario, item.id, {
        precio: precioVentaNum,
        activo: false,
        estado: "vendido",
        fechaVenta,
        vendidoAt,
        metodoVenta: "manual_admin",
        metodoPagoVenta,
        canalVenta,
        vendedorVenta: vendedorVenta.trim(),
        clienteVenta: clienteVenta.trim(),
        notaVenta: notaVenta.trim(),
        ventaId,
      });
      setVentaOk(true);
      setTimeout(() => { setVentaOk(false); onSaved(); }, 1200);
    } finally {
      setVendiendo(false);
    }
  }

  async function guardarVentaExistente() {
    if (!fechaVenta || vendiendo) return;
    setVendiendo(true);
    try {
      const baseVenta = {
        productoId: item.id,
        clave: item.clave || "",
        idInterno: item.idInterno || "",
        ticketOrigen: item.ticketOrigen || "",
        shipmentId: item.shipmentId || "",
        nombre: nombre || item.nombre || "",
        categoria: categoria || item.categoria || "",
        marca: marca || item.marca || "",
        talla: talla || item.talla || "",
        genero: terminoNatural(genero || item.genero || ""),
        precioVenta: precioVentaNum > 0 ? precioVentaNum : Number(item.precio || 0),
        costoMXN,
        utilidad: Number(((precioVentaNum > 0 ? precioVentaNum : Number(item.precio || 0)) - costoMXN).toFixed(2)),
        fechaVenta,
        vendidoAt: item.vendidoAt || new Date().toISOString(),
        metodoPago: metodoPagoVenta,
        canalVenta,
        vendedor: vendedorVenta.trim(),
        cliente: clienteVenta.trim(),
        nota: notaVenta.trim(),
        origen: "manual_admin",
      };

      let ventaId = item.ventaId || "";
      if (ventaId) {
        await dbUpdate(COL.ventas, ventaId, baseVenta);
      } else {
        const ventaNum = await nextId("sale");
        ventaId = padId(ventaNum, "VEN-");
        await dbCreate(COL.ventas, ventaId, {
          ventaId,
          ...baseVenta,
          createdAt: item.vendidoAt || new Date().toISOString(),
        });
      }

      await dbUpdate(COL.inventario, item.id, {
        fechaVenta,
        metodoPagoVenta,
        canalVenta,
        vendedorVenta: vendedorVenta.trim(),
        clienteVenta: clienteVenta.trim(),
        notaVenta: notaVenta.trim(),
        ventaId,
      });
      setVentaOk(true);
      setTimeout(() => { setVentaOk(false); onSaved(); }, 1200);
    } finally {
      setVendiendo(false);
    }
  }

  return (
    <div style={{ background:INVENTORY_BG, minHeight:"100%", paddingBottom:80 }}>
      <TopBar
        title={item.clave || item.idInterno}
        subtitle={`${item.ticketOrigen || "—"} · ${item.categoria || "—"}`}
        onBack={onBack}
      />

      <div style={{ padding:"14px 16px 0" }}>

        {/* Desglose de costo */}
        <InventoryPanel tone={item.esProvisional ? "warm" : "soft"} style={{ padding:0, overflow:"hidden" }}>
        <div style={{
          background:item.esProvisional ? C.warnFade : C.okFade,
          borderLeft:`3px solid ${item.esProvisional ? C.warn : C.ok}`,
          padding:"14px 16px", marginBottom:0,
        }}>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase",
            color:item.esProvisional ? C.warn : C.ok, marginBottom:8 }}>
            {item.esProvisional ? "⚠️ Costo provisional — sin envío aún" : "✅ Costo completo"}
          </div>
          {item.origen === "usa" ? (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[
                ["Costo USA",   `$${fmt(item.costoUSD||0,2)} USD`              ],
                ["Costo Flete", `$${fmt(item.fletePorPrendaUSD||0,2)} USD`     ],
                ["Total MXN",   mxn(costoMXN)                                  ],
              ].map(([l,v]) => (
                <div key={l} translate="no">
                  <div style={{ fontSize:9, color:C.muted }}>{l}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.black }}>{v}</div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize:9, color:C.muted }}>Costo MXN</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.black }} translate="no">{mxn(costoMXN)}</div>
            </div>
          )}
          <div style={{ fontSize:10, color:C.muted, marginTop:6 }} translate="no">
            {item.origen === "usa" && `TC: $${fmt(item.tipoCambio||0,2)} · `}
            Ticket: {item.ticketOrigen || "—"}
          </div>
        </div>
        </InventoryPanel>

        {/* Fecha de compra */}
        <InventoryPanel>
        <InventorySectionTitle help="Usa la fecha real en la que se compro la pieza. Sirve para ordenar historico y futuras metricas de antiguedad.">📅 Fecha de compra</InventorySectionTitle>
        <Inp
          label="Fecha en que se compró"
          value={fechaCompra}
          onChange={setFechaCompra}
          type="date"
          hint="Corrígela si la compra fue antes de hoy"
        />

        {/* Ubicación */}
        <InventorySectionTitle help="La ubicacion es fisica: USA, en transito o una bodega. No cambia si la pieza esta disponible, reservada o vendida.">📍 Ubicación actual</InventorySectionTitle>
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
        </InventoryPanel>

        {/* Foto */}
        <InventoryPanel>
        <InventorySectionTitle help="La foto es clave para que la pieza pueda prepararse y mostrarse mejor en tienda. Si falta, seguira en bodega.">📸 Foto del producto</InventorySectionTitle>
        {foto ? (
          <div style={{ width:"100%", minHeight:220, height:280, overflow:"hidden",
            marginBottom:8, background:C.stone, borderRadius:18 }}>
            <img src={foto} alt=""
              style={{ width:"100%", height:"100%", objectFit:"contain", background:C.stone }}
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
        </InventoryPanel>

        {/* Datos del producto */}
        <InventoryPanel>
        <InventorySectionTitle help="Aqui completas la ficha base de la pieza. Lo mas importante para pasar de bodega a disponible es nombre, foto, color y precio.">Información del producto</InventorySectionTitle>
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
                <option key={g} value={g} translate="no">{g || "— —"}</option>
              ))}
            </select>
          </div>
        </div>

        <Inp label="Descripción" value={descripcion} onChange={setDescripcion}
          placeholder="Estado, detalles, condición…"/>
        </InventoryPanel>

        {/* Precio */}
        <InventoryPanel>
        <InventorySectionTitle help="El precio de venta define cuanto ganas por pieza. Puedes partir del sugerido y luego ajustarlo segun marca, demanda y estado.">💰 Precio de venta</InventorySectionTitle>
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
        <InventorySectionTitle help="Disponible significa que la pieza ya esta completa internamente. En venta significa que ya la activaste para la tienda publica.">👁️ Visibilidad en tienda</InventorySectionTitle>
        {!datosBaseCompletos && (
          <InfoBox type="warn">Para preparar este producto necesitas: <strong>nombre + foto + color</strong></InfoBox>
        )}
        {datosBaseCompletos && !precioNum && (
          <InfoBox type="warn">Agrega un precio de venta para que pase de bodega a disponible</InfoBox>
        )}
        {item.esProvisional && completo && (
          <InfoBox type="warn">⚠️ Costo provisional — no se puede activar hasta registrar el envío</InfoBox>
        )}
        {completo && !item.esProvisional && (
          <div style={{
            padding:"14px",
            display:"flex",
            justifyContent:"space-between",
            alignItems:"center",
            gap:12,
            border:`1px solid ${activo ? "#CFE0F2" : C.border}`,
            background:activo ? "#F1F7FE" : "#FAFCFF",
            borderRadius:18,
            marginBottom:14,
            boxShadow:"inset 0 1px 0 rgba(255,255,255,0.7)",
          }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <Badge
                  c={activo ? C.info : "#255A88"}
                  bg={activo ? C.infoFade : "#E5EFFA"}
                  label={activo ? "En venta" : "Disponible"}
                  small
                />
                <div style={{ fontSize:13, fontWeight:800, color:C.black }}>
                  {activo ? "Publicada en tienda" : "Lista para publicarse"}
                </div>
              </div>
              <div style={{ fontSize:11, color:C.muted }}>
                {activo ? "Los clientes ya pueden verla y comprarla." : "La ficha ya esta completa, pero aun no aparece en la tienda publica."}
              </div>
            </div>
            <div onClick={() => setActivo(!activo)} style={{
              width:50, height:28, borderRadius:14,
              background:activo ? C.info : "#CDD8E7",
              position:"relative", cursor:"pointer", transition:"background .2s",
              boxShadow:activo ? "0 10px 20px rgba(39,93,140,0.22)" : "none",
            }}>
              <div style={{ position:"absolute", top:3, left:activo?25:3, width:22, height:22,
                borderRadius:"50%", background:C.white, transition:"left .2s",
                boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
            </div>
          </div>
        )}
        </InventoryPanel>

        <InventoryPanel>
        <InventorySectionTitle help="Esta tarjeta te muestra aproximadamente como vera el cliente la pieza cuando ya este activa en la tienda.">Vista previa en tienda</InventorySectionTitle>
        <Card style={{ padding:"12px", marginBottom:0, borderRadius:18, boxShadow:"none", border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ width:100, height:136, background:C.stone, flexShrink:0, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:16, alignSelf:"center" }}>
              {foto ? (
                <img src={foto} alt="" style={{ width:"100%", height:"100%", objectFit:"contain", objectPosition:"center center", background:C.stone, display:"block" }} onError={e => e.target.style.display="none"}/>
              ) : (
                <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, fontSize:24 }}>📷</div>
              )}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
                <Badge c={visibleEnTienda ? C.info : "#255A88"} bg={visibleEnTienda ? C.infoFade : "#E5EFFA"} label={visibleEnTienda ? "En venta" : "Disponible"} small/>
                {yaVendido && <Badge c={C.purple} bg={C.purpleFade} label="Vendido" small/>}
              </div>
              <div style={{ fontSize:14, fontWeight:800, color:C.black, marginBottom:4 }}>
                {nombre || "Nombre pendiente"}
              </div>
              <div style={{ fontSize:11, color:C.muted, marginBottom:8 }} translate="no">
                {[marca, categoria, terminoNatural(genero), talla && `T:${talla}`, color].filter(Boolean).join(" · ") || "Completa los datos para la ficha publica"}
              </div>
              <div style={{ fontSize:18, fontWeight:900, color:precioNum > 0 ? C.info : C.muted, marginBottom:6 }}>
                {precioNum > 0 ? `${mxn(precioNum)} MXN` : "Sin precio"}
              </div>
              <div style={{ fontSize:11, color:C.muted, lineHeight:1.6 }}>
                {descripcion || "Sin descripcion publica todavia."}
              </div>
            </div>
          </div>
        </Card>
        </InventoryPanel>

        <InventoryPanel>
        <InventorySectionTitle help="La etiqueta usa QR y clave visible. Puedes imprimirla para localizar, vender o capturar la pieza mas rapido.">Etiqueta del producto</InventorySectionTitle>
        <Card style={{ padding:"14px", marginBottom:0, borderRadius:18, boxShadow:"none", border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", justifyContent:"center" }}>
            <div style={{
              width:230,
              background:"linear-gradient(180deg, #fffaf5 0%, #ffffff 100%)",
              border:`1.5px solid #d9cbbb`,
              boxSizing:"border-box",
              overflow:"hidden",
              boxShadow:"0 6px 18px rgba(0,0,0,0.08)",
            }}>
              <div style={{
                background:"linear-gradient(135deg, #0A0A0A 0%, #3A2619 100%)",
                padding:"10px 10px 8px",
              }}>
                <div style={{
                  fontSize:10, fontWeight:800, letterSpacing:2.5, textTransform:"uppercase",
                  textAlign:"center", color:C.white, opacity:.92,
                }}>
                  CASI
                </div>
                <div style={{
                  fontSize:18, fontWeight:900, textAlign:"center",
                  color:C.white, marginTop:8, letterSpacing:.6,
                }}>
                  {claveEtiqueta}
                </div>
              </div>
              <div style={{ padding:"12px 10px 12px" }}>
                <div style={{
                  fontSize:13, fontWeight:700, textAlign:"center",
                  color:C.black, lineHeight:1.25, marginBottom:6,
                }}>
                  {etiquetaTitulo}
                </div>
                <div style={{
                  fontSize:10, textAlign:"center", color:C.muted,
                  minHeight:14, marginBottom:10, textTransform:"uppercase", letterSpacing:1,
                }}>
                  {etiquetaDetalle || "Completa talla o genero si quieres mostrarlo"}
                </div>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
                  <img
                    src={qrUrl(claveEtiqueta, 220)}
                    alt={`QR ${claveEtiqueta}`}
                    style={{
                      width:132,
                      height:132,
                      objectFit:"contain",
                      background:C.white,
                      padding:5,
                      border:`1px solid ${C.border}`,
                    }}
                  />
                </div>
                <div style={{
                  fontSize:22, fontWeight:900, textAlign:"center",
                  color:precioNum > 0 ? C.info : C.muted,
                }}>
                  {precioNum > 0 ? `${mxn(precioNum)} MXN` : "Sin precio"}
                </div>
                <div style={{
                  fontSize:9, textAlign:"center", color:C.muted,
                  letterSpacing:1.2, textTransform:"uppercase", marginTop:6,
                }}>
                  Escanea o captura la clave
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop:12 }}>
            <Btn label="Imprimir etiqueta" onClick={imprimirEtiqueta} />
          </div>
        </Card>
        </InventoryPanel>

        <InventoryPanel>
        <InventorySectionTitle help="Usa este bloque para ventas directas desde admin. Si son varias piezas, conviene usar el flujo de Vender desde la lista principal.">Venta manual</InventorySectionTitle>
        {yaVendido ? (
          <>
            <InfoBox type="ok">
              Este producto ya esta marcado como vendido{item.fechaVenta ? ` desde ${item.fechaVenta}` : ""}{item.ventaId ? ` · Venta ${item.ventaId}` : ""}.
            </InfoBox>
            {!showSaleEdit ? (
              <Btn label={item.ventaId ? "Editar datos de venta" : "Completar venta historica"} onClick={() => setShowSaleEdit(true)} />
            ) : (
              <Card style={{ padding:"14px", marginBottom:14, border:`1px solid ${C.border}` }}>
                <Inp label="Fecha de venta" value={fechaVenta} onChange={setFechaVenta} type="date"/>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, letterSpacing:1.5, textTransform:"uppercase" }}>Metodo de pago</div>
                    <select value={metodoPagoVenta} onChange={e => setMetodoPagoVenta(e.target.value)}
                      style={{ width:"100%", padding:"11px 10px", border:`1.5px solid ${C.border}`,
                        fontSize:13, outline:"none", background:C.white, color:C.black, fontFamily:FONT.body }}>
                      {METODOS_VENTA.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, letterSpacing:1.5, textTransform:"uppercase" }}>Canal de venta</div>
                    <select value={canalVenta} onChange={e => setCanalVenta(e.target.value)}
                      style={{ width:"100%", padding:"11px 10px", border:`1.5px solid ${C.border}`,
                        fontSize:13, outline:"none", background:C.white, color:C.black, fontFamily:FONT.body }}>
                      {CANALES_VENTA.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                  </div>
                </div>
                <Inp label="Vendedor" value={vendedorVenta} onChange={setVendedorVenta} placeholder="Nombre de quien cerro la venta"/>
                <Inp label="Cliente o referencia" value={clienteVenta} onChange={setClienteVenta} placeholder="Nombre del cliente, apodo o referencia corta"/>
                <Inp label="Nota interna" value={notaVenta} onChange={setNotaVenta} placeholder="Dato util para este registro"/>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <Btn label={vendiendo ? "Guardando..." : ventaOk ? "Guardado" : "Guardar venta"} onClick={guardarVentaExistente} disabled={vendiendo || ventaOk || !fechaVenta}/>
                  <button onClick={() => setShowSaleEdit(false)} style={{ padding:"12px", background:"rgba(255,252,248,0.92)", border:`1.5px solid ${C.border}`, fontSize:12, fontWeight:800, cursor:"pointer", color:C.black, borderRadius:18, boxShadow:"0 10px 20px rgba(22,22,22,0.05)" }}>
                    Cancelar
                  </button>
                </div>
              </Card>
            )}
          </>
        ) : (
          <>
            <InfoBox type="terra">
              Usa esta accion para ventas directas desde admin. Al vender, el producto saldra del inventario publico y quedara como vendido.
            </InfoBox>
            {!showSell ? (
              <Btn label="Vender producto" onClick={() => setShowSell(true)} />
            ) : (
              <Card style={{ padding:"14px", marginBottom:14, border:`1px solid ${C.border}` }}>
                <Inp label="Precio final de venta" value={precioVenta} onChange={setPrecioVenta} type="number" hint={costoMXN > 0 && precioVentaNum > 0 ? `Ganancia estimada: ${mxn(precioVentaNum - costoMXN)}` : "Puedes ajustarlo antes de cerrar la venta"}/>
                <Inp label="Fecha de venta" value={fechaVenta} onChange={setFechaVenta} type="date"/>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, letterSpacing:1.5, textTransform:"uppercase" }}>Metodo de pago</div>
                    <select value={metodoPagoVenta} onChange={e => setMetodoPagoVenta(e.target.value)}
                      style={{ width:"100%", padding:"11px 10px", border:`1.5px solid ${C.border}`,
                        fontSize:13, outline:"none", background:C.white, color:C.black, fontFamily:FONT.body }}>
                      {METODOS_VENTA.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, letterSpacing:1.5, textTransform:"uppercase" }}>Canal de venta</div>
                    <select value={canalVenta} onChange={e => setCanalVenta(e.target.value)}
                      style={{ width:"100%", padding:"11px 10px", border:`1.5px solid ${C.border}`,
                        fontSize:13, outline:"none", background:C.white, color:C.black, fontFamily:FONT.body }}>
                      {CANALES_VENTA.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                  </div>
                </div>
                <Inp label="Vendedor" value={vendedorVenta} onChange={setVendedorVenta} placeholder="Nombre de quien cerro la venta"/>
                <Inp label="Cliente o referencia" value={clienteVenta} onChange={setClienteVenta} placeholder="Nombre del cliente, apodo o referencia corta"/>
                <Inp label="Nota interna" value={notaVenta} onChange={setNotaVenta} placeholder="Venta en mostrador, feria, cliente recurrente..."/>
                {precioVentaNum <= 0 && <InfoBox type="warn">Ingresa un precio final valido para cerrar la venta.</InfoBox>}
                {precioVentaNum > 0 && costoMXN > 0 && (
                  <InfoBox type={precioVentaNum >= costoMXN ? "ok" : "warn"}>
                    Costo {mxn(costoMXN)} · Venta {mxn(precioVentaNum)} · Utilidad estimada {mxn(precioVentaNum - costoMXN)}
                  </InfoBox>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <Btn label={vendiendo ? "Vendiendo..." : ventaOk ? "Vendido" : "Confirmar venta"} onClick={venderProducto} disabled={vendiendo || ventaOk || precioVentaNum <= 0}/>
                  <button onClick={() => setShowSell(false)} style={{ padding:"12px", background:"rgba(255,252,248,0.92)", border:`1.5px solid ${C.border}`, fontSize:12, fontWeight:800, cursor:"pointer", color:C.black, borderRadius:18, boxShadow:"0 10px 20px rgba(22,22,22,0.05)" }}>
                    Cancelar
                  </button>
                </div>
              </Card>
            )}
          </>
        )}
        </InventoryPanel>
      </div>

      {/* Botón guardar */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:390, padding:"12px 16px", boxSizing:"border-box",
        background:"rgba(248,244,239,0.97)", backdropFilter:"blur(8px)",
        borderTop:`1px solid ${C.border}`, zIndex:50 }}>
        <button onClick={guardar} disabled={guardando || guardado || !nombre} style={{
          width:"100%", padding:"15px", fontSize:13, fontWeight:900,
          letterSpacing:2, textTransform:"uppercase", border:"none",
          background:guardado ? `linear-gradient(135deg, ${C.ok} 0%, #235941 100%)` : !nombre ? "#CCC" : `linear-gradient(135deg, ${C.black} 0%, ${C.terraD} 100%)`,
          color:C.white, cursor:nombre ? "pointer" : "not-allowed", transition:"all .3s",
          borderRadius:20,
          boxShadow:guardado || nombre ? "0 18px 34px rgba(22,22,22,0.18)" : "none",
        }}>
          {guardado ? "✓ GUARDADO" : guardando ? "GUARDANDO…" : "GUARDAR PRODUCTO"}
        </button>
      </div>
    </div>
  );
}

// ─── PANTALLA PRINCIPAL ───────────────────────────────────
function ScanInventoryItem({ items, onBack, onFound }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(null);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [cameraState, setCameraState] = useState("idle");
  const detectorDisponible = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    let cancelled = false;

    function stopScanner() {
      if (loopRef.current) {
        window.clearTimeout(loopRef.current);
        loopRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setCameraState("idle");
    }

    async function startScanner() {
      if (!detectorDisponible || !navigator?.mediaDevices?.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector({
          formats: ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e"],
        });

        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results?.length) {
              const value = results[0]?.rawValue || "";
              const found = buscarProducto(items, value);
              setCodigo(value);
              if (found) {
                stopScanner();
                onFound(found);
                return;
              }
              setError(`Se detecto "${value}", pero no coincide con un producto del inventario.`);
            }
          } catch {
            // Ignora lecturas intermitentes mientras la camara sigue escaneando.
          }
          loopRef.current = window.setTimeout(scan, 700);
        };

        setCameraState("scanning");
        loopRef.current = window.setTimeout(scan, 700);
      } catch {
        setCameraState("error");
        setError("No se pudo abrir la camara. Usa la captura manual.");
      }
    }

    startScanner();
    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [detectorDisponible, items, onFound]);

  function buscarManual() {
    const found = buscarProducto(items, codigo);
    if (!found) {
      setError("No encontre ningun producto con ese SKU, clave o id interno.");
      return;
    }
    setError("");
    onFound(found);
  }

  return (
    <div style={{ background:INVENTORY_BG, minHeight:"100%", paddingBottom:24 }}>
      <TopBar
        title="Escanear producto"
        subtitle="Abrir producto por QR, SKU o id interno"
        onBack={onBack}
      />

      <div style={{ padding:"14px 16px 0" }}>
        <InfoBox type="info">
          Apunta la camara a un QR o codigo de barras. Si tu etiqueta solo tiene texto, captura el SKU manualmente.
        </InfoBox>

        {error && <InfoBox type="warn">{error}</InfoBox>}

        <SectionTitle>Camara</SectionTitle>
        <Card style={{ padding:"12px", marginBottom:14 }}>
          {detectorDisponible ? (
            <>
              <div style={{
                width:"100%", height:280, background:C.black, overflow:"hidden",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  style={{ width:"100%", height:"100%", objectFit:"cover" }}
                />
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>
                {cameraState === "scanning"
                  ? "La camara esta buscando codigos..."
                  : "Si no detecta nada, usa la captura manual."}
              </div>
            </>
          ) : (
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
              Este navegador no soporta escaneo nativo aqui. Usa la captura manual o abre la app en un navegador moderno desde tu celular.
            </div>
          )}
        </Card>

        <SectionTitle>Captura manual</SectionTitle>
        <Inp
          label="SKU, clave o id interno"
          value={codigo}
          onChange={(value) => {
            setCodigo(value);
            setError("");
          }}
          placeholder="OA-000123 / INV-000456"
          hint="Tambien puedes pegar el contenido del QR si ya lo leiste con otra app"
        />

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <Btn label="Abrir producto" onClick={buscarManual} disabled={!codigo.trim()} />
          <button onClick={onBack} style={{
            padding:"12px", background:"rgba(255,252,248,0.92)", border:`1.5px solid ${C.border}`,
            fontSize:12, fontWeight:800, cursor:"pointer", color:C.black,
            borderRadius:18, boxShadow:"0 10px 20px rgba(22,22,22,0.05)",
          }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function MultiSaleScreen({ items, onBack, onSaved }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(null);
  const [codigo, setCodigo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [fechaVenta, setFechaVenta] = useState(hoyISO());
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [canalVenta, setCanalVenta] = useState("mostrador");
  const [vendedor, setVendedor] = useState("");
  const [cliente, setCliente] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cameraState, setCameraState] = useState("idle");
  const detectorDisponible = typeof window !== "undefined" && "BarcodeDetector" in window;
  const lastScanRef = useRef({ value:"", at:0 });

  const candidatos = items.filter(item => {
    if (["vendido", "reservado"].includes(item.estado)) return false;
    if (!busqueda.trim()) return true;
    const q = busqueda.trim().toLowerCase();
    return [item.clave, item.idInterno, item.nombre, item.ticketOrigen]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(q));
  });

  const totalVenta = carrito.reduce((acc, item) => acc + (Number(item.precio) || 0), 0);
  const totalCosto = carrito.reduce((acc, item) => acc + (Number(item.costoMXN) || (Number(item.costoTotalUSD || 0) * Number(item.tipoCambio || 20)) || 0), 0);
  const utilidad = totalVenta - totalCosto;

  useEffect(() => {
    let cancelled = false;

    function stopScanner() {
      if (loopRef.current) {
        window.clearTimeout(loopRef.current);
        loopRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setCameraState("idle");
    }

    async function startScanner() {
      if (!detectorDisponible || !navigator?.mediaDevices?.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector({
          formats: ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e"],
        });

        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results?.length) {
              const value = String(results[0]?.rawValue || "").trim();
              const now = Date.now();
              if (value && !(lastScanRef.current.value === value && now - lastScanRef.current.at < 1800)) {
                lastScanRef.current = { value, at: now };
                setCodigo(value);
                const found = buscarProducto(items, value);
                if (found) {
                  agregarProducto(found);
                } else {
                  setError(`Se detecto "${value}", pero no coincide con un producto del inventario.`);
                }
              }
            }
          } catch {
            // Ignora lecturas intermitentes mientras la camara sigue escaneando.
          }
          loopRef.current = window.setTimeout(scan, 650);
        };

        setCameraState("scanning");
        loopRef.current = window.setTimeout(scan, 650);
      } catch {
        setCameraState("error");
      }
    }

    startScanner();
    return () => {
      cancelled = true;
      stopScanner();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectorDisponible, items, carrito.length]);

  function agregarProducto(item) {
    if (!item) return;
    if (carrito.some(prod => prod.id === item.id)) {
      setError("Ese producto ya esta agregado a la venta.");
      return;
    }
    if (["vendido", "reservado"].includes(item.estado)) {
      setError("Ese producto no esta disponible para una venta multiple.");
      return;
    }
    setCarrito(actual => [...actual, item]);
    setCodigo("");
    setError("");
  }

  function buscarYAgregar() {
    const found = buscarProducto(items, codigo);
    if (!found) {
      setError("No encontre ningun producto con ese SKU, clave o id interno.");
      return;
    }
    agregarProducto(found);
  }

  function quitarProducto(id) {
    setCarrito(actual => actual.filter(item => item.id !== id));
  }

  async function confirmarVentaMultiple() {
    if (!carrito.length || guardando) return;
    setGuardando(true);
    setError("");
    try {
      const ventaNum = await nextId("sale");
      const ventaId = padId(ventaNum, "VEN-");
      const vendidoAt = new Date().toISOString();
      const principal = carrito[0];
      const itemsVenta = carrito.map(item => {
        const costo = Number(item.costoMXN) || (Number(item.costoTotalUSD || 0) * Number(item.tipoCambio || 20)) || 0;
        const precio = Number(item.precio) || 0;
        return {
          productoId: item.id,
          clave: item.clave || "",
          idInterno: item.idInterno || "",
          nombre: item.nombre || "",
          categoria: item.categoria || "",
          marca: item.marca || "",
          talla: item.talla || "",
          genero: terminoNatural(item.genero || ""),
          precioVenta: precio,
          costoMXN: costo,
          utilidad: Number((precio - costo).toFixed(2)),
        };
      });

      await dbCreate(COL.ventas, ventaId, {
        ventaId,
        multi: itemsVenta.length > 1,
        itemCount: itemsVenta.length,
        productoId: itemsVenta.length === 1 ? principal.id : "",
        clave: itemsVenta.length === 1 ? (principal.clave || "") : "",
        idInterno: itemsVenta.length === 1 ? (principal.idInterno || "") : "",
        nombre: itemsVenta.length === 1 ? (principal.nombre || "") : `Venta multiple · ${itemsVenta.length} producto(s)`,
        categoria: itemsVenta.length === 1 ? (principal.categoria || "") : "",
        marca: itemsVenta.length === 1 ? (principal.marca || "") : "",
        talla: itemsVenta.length === 1 ? (principal.talla || "") : "",
        genero: itemsVenta.length === 1 ? terminoNatural(principal.genero || "") : "",
        items: itemsVenta,
        totalVenta,
        totalCosto,
        utilidad: Number(utilidad.toFixed(2)),
        fechaVenta,
        vendidoAt,
        metodoPago,
        canalVenta,
        vendedor: vendedor.trim(),
        cliente: cliente.trim(),
        nota: nota.trim(),
        origen: "manual_admin_multiple",
      });

      for (const item of carrito) {
        await dbUpdate(COL.inventario, item.id, {
          activo: false,
          estado: "vendido",
          fechaVenta,
          vendidoAt,
          metodoVenta: "manual_admin_multiple",
          metodoPagoVenta: metodoPago,
          canalVenta,
          vendedorVenta: vendedor.trim(),
          clienteVenta: cliente.trim(),
          notaVenta: nota.trim(),
          ventaId,
        });
      }

      await onSaved?.();
    } catch (err) {
      setError(err?.message || "No se pudo cerrar la venta multiple.");
      setGuardando(false);
      return;
    }
    setGuardando(false);
  }

  return (
    <div style={{ background:INVENTORY_BG, minHeight:"100%", paddingBottom:24 }}>
      <TopBar
        title="Nueva venta"
        subtitle="Agrega varios productos a una sola operacion"
        onBack={onBack}
      />

      <div style={{ padding:"14px 16px 0" }}>
        <Card style={{ padding:"12px 14px", marginBottom:14, background:INVENTORY_PANEL, border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:C.black }}>Venta multiple</div>
              <div style={{ fontSize:11, color:C.muted }}>Escanea o escribe claves desde un solo flujo.</div>
            </div>
            <HelpTip title="Venta multiple" text="Agrega varias piezas a una sola operacion. Se guarda un solo folio de venta, pero cada producto queda ligado a esa misma venta." />
          </div>
        </Card>
        {error && <InfoBox type="warn">{error}</InfoBox>}

        <InventorySectionTitle help="Puedes vender capturando una clave manual o escaneando varias piezas seguidas desde la camara.">Agregar productos</InventorySectionTitle>
        <Card style={{ padding:"12px", marginBottom:14 }}>
          {detectorDisponible ? (
            <>
              <div style={{
                width:"100%", height:220, background:C.black, overflow:"hidden",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  style={{ width:"100%", height:"100%", objectFit:"cover" }}
                />
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>
                {cameraState === "scanning"
                  ? "Escanea productos y se iran agregando a la venta automaticamente."
                  : "Si la camara no arranca, usa la captura manual de codigo."}
              </div>
            </>
          ) : (
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
              Este navegador no soporta escaneo nativo aqui. Usa la captura manual o abre la app en un navegador moderno desde tu celular.
            </div>
          )}
        </Card>
        <Inp
          label="Escribir codigo"
          value={codigo}
          onChange={(value) => { setCodigo(value); setError(""); }}
          placeholder="OA-000123 / INV-000456"
          hint="Puedes seguir agregando varios productos uno tras otro sin salir de esta pantalla"
        />
        <div style={{ marginBottom:14 }}>
          <Btn label="Agregar por clave" onClick={buscarYAgregar} disabled={!codigo.trim()} />
        </div>

        <Inp
          label="Buscar en inventario"
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Nombre, SKU, ticket..."
        />
        <Card style={{ padding:"0", marginBottom:14 }}>
          <div style={{ maxHeight:240, overflow:"auto" }}>
            {candidatos.slice(0, 80).map(item => (
              <button
                key={item.id}
                onClick={() => agregarProducto(item)}
                style={{
                  width:"100%",
                  textAlign:"left",
                  padding:"10px 12px",
                  border:"none",
                  borderBottom:`1px solid ${C.border}`,
                  background:carrito.some(prod => prod.id === item.id) ? C.okFade : C.white,
                  cursor:"pointer",
                }}
              >
                <div style={{ fontSize:12, fontWeight:700, color:C.black }}>
                  {item.clave || item.idInterno} · {item.nombre || "Sin nombre"}
                </div>
                <div style={{ fontSize:11, color:C.muted }}>
                  {item.ticketOrigen || "—"} · {item.precio > 0 ? mxn(item.precio) : "Sin precio"}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <InventorySectionTitle help="Aqui se juntan todas las piezas que formaran parte de la misma venta. Puedes quitar cualquiera antes de confirmar.">Productos en la venta</InventorySectionTitle>
        {carrito.length === 0 ? (
          <EmptyState icon="🧾" title="Sin productos" sub="Agrega piezas por clave o desde la lista"/>
        ) : (
          <Card style={{ padding:"12px", marginBottom:14 }}>
            {carrito.map(item => (
              <div key={item.id} style={{ display:"flex", justifyContent:"space-between", gap:10, padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.black }}>
                    {item.nombre || "Producto"} 
                  </div>
                  <div style={{ fontSize:11, color:C.muted }}>
                    {item.clave || item.idInterno} · {mxn(item.precio || 0)}
                  </div>
                </div>
                <button onClick={() => quitarProducto(item.id)} style={{
                  background:"rgba(251,232,227,0.9)", border:`1px solid rgba(187,68,52,0.12)`, color:C.danger, cursor:"pointer", fontSize:12, fontWeight:800,
                  borderRadius:14, padding:"8px 10px",
                }}>
                  Quitar
                </button>
              </div>
            ))}
          </Card>
        )}

        <InventorySectionTitle help="Estos datos se guardan para reportes, historico y conciliacion. Metodo, canal y vendedor te ayudaran despues a medir resultados.">Datos de la venta</InventorySectionTitle>
        <Inp label="Fecha de venta" value={fechaVenta} onChange={setFechaVenta} type="date"/>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, letterSpacing:1.5, textTransform:"uppercase" }}>Metodo de pago</div>
            <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
              style={{ width:"100%", padding:"11px 10px", border:`1.5px solid ${C.border}`, fontSize:13, outline:"none", background:C.white, color:C.black, fontFamily:FONT.body }}>
              {METODOS_VENTA.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, letterSpacing:1.5, textTransform:"uppercase" }}>Canal de venta</div>
            <select value={canalVenta} onChange={e => setCanalVenta(e.target.value)}
              style={{ width:"100%", padding:"11px 10px", border:`1.5px solid ${C.border}`, fontSize:13, outline:"none", background:C.white, color:C.black, fontFamily:FONT.body }}>
              {CANALES_VENTA.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
          </div>
        </div>
        <Inp label="Vendedor" value={vendedor} onChange={setVendedor} placeholder="Nombre de quien cerro la venta"/>
        <Inp label="Cliente o referencia" value={cliente} onChange={setCliente} placeholder="Nombre del cliente o referencia"/>
        <Inp label="Nota interna" value={nota} onChange={setNota} placeholder="Observaciones de esta venta"/>

        <Card style={{ padding:"12px", marginBottom:14, background:"#EAF2FB", border:`1px solid #D6E4F3` }}>
          <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0" }}>
            <span style={{ fontSize:12, color:C.muted }}>Piezas</span>
            <strong>{carrito.length}</strong>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0" }}>
            <span style={{ fontSize:12, color:C.muted }}>Total venta</span>
            <strong>{mxn(totalVenta)}</strong>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0" }}>
            <span style={{ fontSize:12, color:C.muted }}>Costo acumulado</span>
            <strong>{mxn(totalCosto)}</strong>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0" }}>
            <span style={{ fontSize:12, color:C.muted }}>Utilidad estimada</span>
            <strong style={{ color: utilidad >= 0 ? C.ok : C.warn }}>{mxn(utilidad)}</strong>
          </div>
        </Card>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <Btn label={guardando ? "Guardando..." : `Confirmar ${carrito.length} producto(s)`} onClick={confirmarVentaMultiple} disabled={guardando || !carrito.length} />
          <button onClick={onBack} style={{ padding:"12px", background:"rgba(255,252,248,0.92)", border:`1.5px solid ${C.border}`, fontSize:12, fontWeight:800, cursor:"pointer", color:C.black, borderRadius:18, boxShadow:"0 10px 20px rgba(22,22,22,0.05)" }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function PrintLabelsScreen({ items, onBack }) {
  const [modo, setModo] = useState("envio");
  const [shipmentId, setShipmentId] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState([]);

  const shipmentIds = [...new Set(items.map(item => item.shipmentId).filter(Boolean))].sort();
  const ticketIds = [...new Set(items.map(item => item.ticketOrigen).filter(Boolean))].sort();
  const manualItems = items.filter(item => {
    if (!busqueda.trim()) return true;
    const q = busqueda.trim().toLowerCase();
    return [item.clave, item.idInterno, item.nombre, item.ticketOrigen]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(q));
  });

  const productos =
    modo === "envio"
      ? items.filter(item => shipmentId && item.shipmentId === shipmentId)
      : modo === "ticket"
        ? items.filter(item => ticketId && item.ticketOrigen === ticketId)
        : items.filter(item => seleccion.includes(item.id));

  function toggleSeleccion(id) {
    setSeleccion(actual => actual.includes(id)
      ? actual.filter(x => x !== id)
      : [...actual, id]);
  }

  function tomarManualVisibles() {
    setSeleccion(actual => [...new Set([...actual, ...manualItems.map(item => item.id)])]);
  }

  function limpiarManual() {
    setSeleccion([]);
  }

  return (
    <div style={{ background:C.cream, minHeight:"100%", paddingBottom:24 }}>
      <TopBar
        title="Imprimir etiquetas"
        subtitle="Por envio, ticket o seleccion manual"
        onBack={onBack}
      />

      <div style={{ padding:"14px 16px 0" }}>
        <Card style={{ padding:"12px 14px", marginBottom:14, background:INVENTORY_PANEL, border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:C.black }}>Etiquetas por lote</div>
              <div style={{ fontSize:11, color:C.muted }}>Imprime por envio, ticket o seleccion manual.</div>
            </div>
            <HelpTip title="Etiquetas por lote" text="Usa envio para mercancia recien llegada, ticket para una compra especifica y manual para mezclas, reposiciones o grupos pequeños." />
          </div>
        </Card>

        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
          {[
            { id:"envio", label:"Por envio" },
            { id:"ticket", label:"Por ticket" },
            { id:"manual", label:"Manual" },
          ].map(op => (
            <button
              key={op.id}
              onClick={() => setModo(op.id)}
              style={{
                padding:"8px 12px",
                border:`1.5px solid ${modo === op.id ? C.black : C.border}`,
                background:modo === op.id ? C.black : C.white,
                color:modo === op.id ? C.white : C.black,
                fontSize:11,
                fontWeight:700,
                cursor:"pointer",
              }}
            >
              {op.label}
            </button>
          ))}
        </div>

        {modo === "envio" && (
          <Card style={{ padding:"14px", marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:6,
              letterSpacing:1.5, textTransform:"uppercase" }}>
              Selecciona envio
            </div>
            <select value={shipmentId} onChange={(e) => setShipmentId(e.target.value)}
              style={{ width:"100%", padding:"11px 10px", border:`1.5px solid ${C.border}`,
                fontSize:13, outline:"none", background:C.white, color:C.black, fontFamily:FONT.body }}>
              <option value="">— —</option>
              {shipmentIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
            <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>
              {shipmentId ? `${productos.length} producto(s) en este envio.` : "Elige un envio para tomar todas sus piezas."}
            </div>
          </Card>
        )}

        {modo === "ticket" && (
          <Card style={{ padding:"14px", marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:6,
              letterSpacing:1.5, textTransform:"uppercase" }}>
              Selecciona ticket
            </div>
            <select value={ticketId} onChange={(e) => setTicketId(e.target.value)}
              style={{ width:"100%", padding:"11px 10px", border:`1.5px solid ${C.border}`,
                fontSize:13, outline:"none", background:C.white, color:C.black, fontFamily:FONT.body }}>
              <option value="">— —</option>
              {ticketIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
            <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>
              {ticketId ? `${productos.length} producto(s) en este ticket.` : "Elige un ticket para tomar todas sus piezas."}
            </div>
          </Card>
        )}

        {modo === "manual" && (
          <Card style={{ padding:"14px", marginBottom:14 }}>
            <Inp
              label="Buscar para seleccion manual"
              value={busqueda}
              onChange={setBusqueda}
              placeholder="SKU, nombre, ticket..."
            />
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              <button onClick={tomarManualVisibles} style={{
                flex:1, padding:"10px 12px", background:`linear-gradient(135deg, ${C.black} 0%, ${C.terraD} 100%)`, color:C.white,
                border:"1px solid rgba(255,255,255,0.1)", fontSize:11, fontWeight:800, cursor:"pointer",
                borderRadius:16, boxShadow:"0 12px 22px rgba(22,22,22,0.14)",
              }}>
                Tomar visibles
              </button>
              <button onClick={limpiarManual} style={{
                flex:1, padding:"10px 12px", background:"rgba(255,252,248,0.92)", color:C.black,
                border:`1.5px solid ${C.border}`, fontSize:11, fontWeight:800, cursor:"pointer",
                borderRadius:16, boxShadow:"0 10px 20px rgba(22,22,22,0.05)",
              }}>
                Limpiar
              </button>
            </div>
            <div style={{ maxHeight:320, overflow:"auto", border:`1px solid ${C.border}` }}>
              {manualItems.slice(0, 120).map(item => {
                const picked = seleccion.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleSeleccion(item.id)}
                    style={{
                      width:"100%",
                      textAlign:"left",
                      padding:"10px 12px",
                      border:"none",
                      borderBottom:`1px solid ${C.border}`,
                      background:picked ? C.okFade : C.white,
                      cursor:"pointer",
                    }}
                  >
                    <div style={{ fontSize:12, fontWeight:700, color:C.black }}>
                      {item.clave || item.idInterno}
                    </div>
                    <div style={{ fontSize:11, color:C.muted }}>
                      {item.nombre || "Sin nombre"} · {item.ticketOrigen || "—"}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>
              {seleccion.length} producto(s) seleccionados manualmente.
            </div>
          </Card>
        )}

        <Card style={{ padding:"14px", marginBottom:14, background:"#EAF2FB", border:`1px solid #D6E4F3` }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.info, marginBottom:6 }}>
            Resumen para impresion
          </div>
          <div style={{ fontSize:13, color:C.black, marginBottom:4 }}>
            {productos.length} etiqueta(s) listas
          </div>
          <div style={{ fontSize:11, color:C.muted, lineHeight:1.6 }}>
            El formato actual imprime varias etiquetas compactas por hoja. Si la cantidad excede una pagina, el navegador la repartira automaticamente en hojas adicionales.
          </div>
        </Card>

        <Btn
          label={productos.length ? `Imprimir ${productos.length} etiqueta(s)` : "Selecciona productos para imprimir"}
          onClick={() => abrirImpresionEtiquetas(productos)}
          disabled={!productos.length}
        />
      </div>
    </div>
  );
}

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

  if (vista === "scan") return (
    <ScanInventoryItem
      items={inventory}
      onBack={() => setVista("lista")}
      onFound={(productoEncontrado) => {
        setProducto(productoEncontrado);
        setVista("editar");
      }}
    />
  );

  if (vista === "labels") return (
    <PrintLabelsScreen
      items={inventory}
      onBack={() => setVista("lista")}
    />
  );

  if (vista === "multisale") return (
    <MultiSaleScreen
      items={inventory}
      onBack={() => setVista("lista")}
      onSaved={alGuardar}
    />
  );

  return (
    <InventoryList
      items={inventory}
      onBack={onBack}
      onRefresh={onRefresh}
      onLabels={() => setVista("labels")}
      onMultiSale={() => setVista("multisale")}
      onEdit={p => { setProducto(p); setVista("editar"); }}
    />
  );
}