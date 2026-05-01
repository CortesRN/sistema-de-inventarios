import { useState, useEffect, useRef } from "react";
import { C, FONT, Btn, Inp, Select, Card, SectionTitle, TopBar,
         InfoBox, Table, Loading, Badge, EmptyState, HelpTip } from "./ui.jsx";
import { dbCreate, dbUpdate, dbGetAll, nextId, padId, fetchExchangeRate } from "./firebase.js";
import { costIndividual, costLote, round2 } from "./costing.js";
import { COL, CATEGORIAS, STORE_CONFIG, TICKET_STATUS, UBICACIONES } from "./config.js";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}
function leer(ticket, campoEs, campoEn, fallback = null) {
  if (ticket?.[campoEs] !== undefined) return ticket[campoEs];
  if (ticket?.[campoEn] !== undefined) return ticket[campoEn];
  return fallback;
}
function aNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  if (valor === null || valor === undefined) return 0;
  const raw = String(valor).trim();
  if (!raw) return 0;

  const limpio = raw.replace(/[$\s]/g, "");
  const lastComma = limpio.lastIndexOf(",");
  const lastDot = limpio.lastIndexOf(".");
  let normalizado = limpio;

  if (lastComma >= 0 && lastDot >= 0) {
    normalizado = lastComma > lastDot
      ? limpio.replace(/\./g, "").replace(",", ".")
      : limpio.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalizado = limpio.replace(",", ".");
  }

  normalizado = normalizado.replace(/[^0-9.-]/g, "");
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}
function aCantidad(valor) {
  return Math.max(0, Math.round(aNumero(valor)));
}
function normalizaLinea(line) {
  return {
    ...line,
    qty: aCantidad(line.qty),
    unitCost: aNumero(line.unitCost),
  };
}
function TituloConAyuda({ title, help }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:8 }}>
      <div style={{ fontSize:12, fontWeight:700, color:C.black }}>{title}</div>
      {help ? <HelpTip text={help} title={title}/> : null}
    </div>
  );
}
function resumenCosteo(ticketLike) {
  const isLote = leer(ticketLike, "metodo", "method", "individual") === "lote";
  const rate = aNumero(leer(ticketLike, "tipoCambio", "exchangeRate", STORE_CONFIG.exchangeRate)) || STORE_CONFIG.exchangeRate;
  const lineasNormalizadas = leer(ticketLike, "lineas", "lines", []).map(normalizaLinea);

  if (isLote) {
    const loteResult = costLote({
      totalPieces:      leer(ticketLike, "totalPiezas", "totalPieces", 0),
      ticketCost:       leer(ticketLike, "costoTicket", "ticketCost", 0),
      ticketOtherCosts: leer(ticketLike, "otrosGastosTicket", "ticketOtherCosts", 0),
      taxMode:          leer(ticketLike, "modoImpuesto", "taxMode", "fixed"),
      taxPct:           leer(ticketLike, "impuestoPct", "taxPct", 0),
      taxFixed:         leer(ticketLike, "impuestoFijo", "taxFixed", 0),
    });

    return {
      isLote,
      rate,
      totalPiezas: loteResult.totalPieces || 0,
      costedLines: [],
      loteResult,
      previewBase: loteResult.ticketCost || 0,
      previewTax: loteResult.taxAmt || 0,
      previewOther: loteResult.otherAmt || 0,
      previewTotal: loteResult.totalCost || 0,
    };
  }

  const costedLines = costIndividual({
    lines:            lineasNormalizadas,
    ticketOtherCosts: leer(ticketLike, "otrosGastosTicket", "ticketOtherCosts", 0),
    taxMode:          leer(ticketLike, "modoImpuesto", "taxMode", "fixed"),
    taxPct:           leer(ticketLike, "impuestoPct", "taxPct", 0),
    taxFixed:         leer(ticketLike, "impuestoFijo", "taxFixed", 0),
  });

  const previewBase = round2(costedLines.reduce((a, l) => a + (l.subtotal || 0), 0));
  const previewTax = round2(costedLines.reduce((a, l) => a + (l.taxAmt || 0), 0));
  const previewOther = round2(costedLines.reduce((a, l) => a + (l.otherAmt || 0), 0));
  const previewTotal = round2(costedLines.reduce((a, l) => a + (l.totalCostLine || 0), 0));

  return {
    isLote,
    rate,
    totalPiezas: costedLines.reduce((a, l) => a + aCantidad(l.qty), 0),
    costedLines,
    loteResult: null,
    previewBase,
    previewTax,
    previewOther,
    previewTotal,
  };
}

// ─── TICKET LIST ──────────────────────────────────────────
export function TicketList({ onNew, onOpen, onBack }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dbGetAll(COL.tickets).then(t => { setTickets(t); setLoading(false); });
  }, []);

  if (loading) return <Loading message="Cargando tickets…"/>;

  return (
    <div style={{ padding:"0 16px 32px" }}>
      <div style={{ padding:"14px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {onBack && <button onClick={onBack} style={{ background:C.black, border:"none", width:34, height:34, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:C.white, fontSize:18 }}>←</button>}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.terra, letterSpacing:3, textTransform:"uppercase", marginBottom:2 }}>Compras</div>
            <div style={{ fontSize:22, fontWeight:900, color:C.black, fontFamily:FONT.display }} translate="no">Tickets de compra</div>
          </div>
        </div>
        <Btn label="+ Nuevo" onClick={onNew} small full={false}/>
      </div>

      {tickets.length === 0 ? (
        <EmptyState icon="🧾" title="Sin tickets de compra" sub="Agrega tu primer ticket de compra"/>
      ) : tickets.map(t => {
        const estado = leer(t, "estado", "status", "draft");
        const origen = leer(t, "origen", "origin", "usa");
        const metodo = leer(t, "metodo", "method", "individual");
        const tipoCambio = leer(t, "tipoCambio", "exchangeRate", null);
        const fechaTicket = t.fechaTicket || t.createdAt;
        const totalPiezas = leer(t, "totalPiezas", "totalPieces", 0);
        const costoTotalUSD = leer(t, "costoTotalUSD", "totalCostUSD", 0);
        const s = TICKET_STATUS[estado] || TICKET_STATUS.draft;
        return (
          <Card key={t.id} onClick={() => onOpen(t)}
            style={{ marginBottom:10, cursor:"pointer", borderLeft:`3px solid ${s.color}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.black }}>{t.ticketId}</div>
              <Badge c={s.color} bg={s.bg} label={s.label}/>
            </div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>
              <span translate="no">{origen === "usa" ? "🇺🇸 USA" : "🇲🇽 México"} · {metodo === "individual" ? "Individual" : "Por lote"}</span>
              {tipoCambio ? <span translate="no">{` · TC: $${tipoCambio}`}</span> : ""}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:C.muted }}>{fechaTicket?.slice(0,10)}</span>
              <span style={{ fontSize:13, fontWeight:700, color:C.terra }}>
                <span translate="no">{totalPiezas || 0} pzas · ${Number(costoTotalUSD || 0).toFixed(2)} USD</span>
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── PASO 1: NUEVO TICKET ─────────────────────────────────
export function NewTicket({ onBack, onCreated }) {
  const [origen,          setOrigen]          = useState("usa");
  const [metodo,          setMetodo]          = useState("individual");
  const [notas,           setNotas]           = useState("");
  const [tipoCambio,      setTipoCambio]      = useState(String(STORE_CONFIG.exchangeRate));
  const [fechaTicket,     setFechaTicket]     = useState(hoyISO());
  const [cargandoCambio,  setCargandoCambio]  = useState(false);
  const [guardando,       setGuardando]       = useState(false);
  const creandoRef = useRef(false);

  async function autoRate() {
    setCargandoCambio(true);
    const r = await fetchExchangeRate();
    if (r) setTipoCambio((r + STORE_CONFIG.exchangeBuffer).toFixed(2));
    setCargandoCambio(false);
  }

  async function handleCreate() {
    if (guardando || creandoRef.current) return;
    creandoRef.current = true;
    setGuardando(true);
    try {
      const n  = await nextId("ticket");
      const id = padId(n, "T");
      await dbCreate(COL.tickets, id, {
        ticketId: id,
        ticketNum: n,
        fechaTicket: fechaTicket || hoyISO(),
        origen,
        metodo,
        notas,
        tipoCambio: parseFloat(tipoCambio) || STORE_CONFIG.exchangeRate,
        estado: "draft",
        totalPiezas: 0,
        costoTotalUSD: 0,
        lineas: [],
        // Compatibilidad (campos históricos)
      });
      onCreated(id);
    } finally {
      setGuardando(false);
      creandoRef.current = false;
    }
  }

  return (
    <div style={{ padding:"0 16px 32px" }}>
      <TopBar title="Nuevo Ticket" subtitle="Paso 1 de 3 — Datos generales" onBack={onBack}/>
      <div style={{ padding:"20px 0 0" }}>

        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
          <HelpTip
            title="Nuevo ticket"
            text="El ID del ticket se genera automáticamente. Aquí solo defines origen, método de costeo y fecha de compra."
          />
        </div>

        <Select label="Origen de la compra" value={origen} onChange={setOrigen} options={[
          { value:"usa",    label:"🇺🇸 USA — Importación (USD)" },
          { value:"mexico", label:"🇲🇽 México — Compra local (MXN)" },
        ]}/>

        {origen === "usa" && (
          <Select label="Método de costeo" value={metodo} onChange={setMetodo} options={[
            { value:"individual", label:"Individual — cada producto tiene precio base distinto" },
            { value:"lote",       label:"Por lote — se cuenta y divide entre piezas" },
          ]}/>
        )}

        {origen === "mexico" && (
          <InfoBox type="info">Las compras en México solo usan método individual en MXN.</InfoBox>
        )}

        {origen === "usa" && (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:6, letterSpacing:1.5, textTransform:"uppercase" }}>
              Tipo de cambio USD → MXN
            </div>
            <div style={{ display:"flex", gap:10, marginBottom:4 }}>
              <input
                value={tipoCambio} onChange={e => setTipoCambio(e.target.value)} type="text" inputMode="decimal"
                style={{ flex:1, padding:"12px 16px", border:`1.5px solid ${C.border}`,
                  fontSize:15, fontWeight:700, outline:"none", background:C.white, color:C.terra, fontFamily:FONT.body }}
              />
              <button onClick={autoRate} style={{
                padding:"12px 16px", background:C.stone, border:`1px solid ${C.border}`,
                fontSize:12, cursor:"pointer", fontWeight:700, color:C.black, whiteSpace:"nowrap",
              }}>
                {cargandoCambio ? "…" : "📡 Automático"}
              </button>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16 }}>
              <HelpTip
                title="Tipo de cambio"
                text="El tipo de cambio se guarda dentro del ticket para conservar el histórico correcto aunque el dólar cambie después."
              />
            </div>
          </>
        )}

        <Inp label="Fecha del ticket" value={fechaTicket} onChange={setFechaTicket}
          type="date" hint="Puedes ajustar una fecha histórica real."/>

        <Inp label="Notas" value={notas} onChange={setNotas}
          placeholder="Proveedor, tienda, observaciones…" hint="Opcional"/>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <button onClick={onBack} style={{
            padding:"12px",
            background:C.white,
            border:`1.5px solid ${C.border}`,
            fontSize:12,
            fontWeight:800,
            cursor:"pointer",
            color:C.black,
            borderRadius:16,
          }}>
            Cancelar
          </button>
          <Btn label={guardando ? "Creando ticket…" : "Crear ticket y continuar →"}
            onClick={handleCreate} disabled={guardando}/>
        </div>
      </div>
    </div>
  );
}

// ─── PASO 2: DETALLE DEL TICKET ───────────────────────────
export function TicketDetail({ ticket, onBack, onNext }) {
  const isLote = leer(ticket, "metodo", "method", "individual") === "lote";
  const [fechaTicket, setFechaTicket] = useState(ticket.fechaTicket || ticket.createdAt?.slice(0,10) || hoyISO());
  const ticketRate = aNumero(leer(ticket, "tipoCambio", "exchangeRate", STORE_CONFIG.exchangeRate)) || STORE_CONFIG.exchangeRate;

  // ── Estado Individual ──────────────────────────────────
  const [lines,       setLines]       = useState(leer(ticket, "lineas", "lines", []));
  const [otherCosts,  setOtherCosts]  = useState(String(leer(ticket, "otrosGastosTicket", "ticketOtherCosts", "")));
  const [taxMode,     setTaxMode]     = useState(leer(ticket, "modoImpuesto", "taxMode", "fixed"));
  const [taxPct,      setTaxPct]      = useState(String(leer(ticket, "impuestoPct", "taxPct", "")));
  const [taxFixed,    setTaxFixed]    = useState(String(leer(ticket, "impuestoFijo", "taxFixed", "")));

  // ── Estado Lote ────────────────────────────────────────
  const [totalPieces, setTotalPieces] = useState(String(leer(ticket, "totalPiezas", "totalPieces", "")));
  const [ticketCost,  setTicketCost]  = useState(String(leer(ticket, "costoTicket", "ticketCost", "")));

  const [errors,  setErrors]  = useState([]);
  const [saving,  setSaving]  = useState(false);

  // ── Líneas (solo individual) ───────────────────────────
  function addLine() {
    setLines(l => [...l, {
      id:       Date.now(),
      descr:    "",
      cat:      "Ropa",
      qty:      "",
      unitCost: "",
    }]);
  }

  function updateLine(idx, key, val) {
    setLines(l => l.map((x, i) => i === idx ? { ...x, [key]: val } : x));
  }

  function removeLine(idx) {
    setLines(l => l.filter((_, i) => i !== idx));
  }

  // ── Preview en tiempo real ─────────────────────────────
  // Calcula el subtotal de cada línea para mostrar al usuario
  function lineSubtotal(line) {
    const q = aCantidad(line.qty);
    const c = aNumero(line.unitCost);
    return q * c;
  }

  const totalBase = lines.reduce((a, l) => a + lineSubtotal(l), 0);
  const normalizedLines = lines.map(normalizaLinea);
  const preview = resumenCosteo({
    ...ticket,
    fechaTicket: fechaTicket || hoyISO(),
    tipoCambio: ticketRate,
    exchangeRate: ticketRate,
    lineas: normalizedLines,
    lines: normalizedLines,
    modoImpuesto: taxMode,
    taxMode,
    impuestoPct: aNumero(taxPct),
    taxPct: aNumero(taxPct),
    impuestoFijo: aNumero(taxFixed),
    taxFixed: aNumero(taxFixed),
    otrosGastosTicket: aNumero(otherCosts),
    ticketOtherCosts: aNumero(otherCosts),
    totalPiezas: isLote ? aCantidad(totalPieces) : normalizedLines.reduce((a, l) => a + aCantidad(l.qty), 0),
    totalPieces: isLote ? aCantidad(totalPieces) : normalizedLines.reduce((a, l) => a + aCantidad(l.qty), 0),
    costoTicket: isLote ? aNumero(ticketCost) : 0,
    ticketCost: isLote ? aNumero(ticketCost) : 0,
  });
  const previewBase = preview.previewBase;
  const previewTax = preview.previewTax;
  const previewOther = preview.previewOther;
  const previewTotal = preview.previewTotal;
  const previewRate = preview.rate;
  const previewLines = preview.costedLines || [];
  const previewPieces = preview.totalPiezas || 0;
  const averagePieceCost = previewPieces > 0 ? round2(previewTotal / previewPieces) : 0;

  // ── Guardar ────────────────────────────────────────────
  async function handleSave() {
    // Validar
    const errs = [];
    if (!isLote) {
      if (lines.length === 0) errs.push("Agrega al menos una línea de producto.");
      lines.forEach((l, i) => {
        if (!l.descr) errs.push(`Línea ${i+1}: escribe la descripción.`);
        if (!(aNumero(l.qty) > 0)) errs.push(`Línea ${i+1}: la cantidad debe ser mayor a 0.`);
        if (aNumero(l.unitCost) < 0) errs.push(`Línea ${i+1}: el costo USD no puede ser negativo.`);
      });
    } else {
      if (!(parseInt(totalPieces) > 0)) errs.push("Ingresa el número de piezas.");
      if (aNumero(ticketCost) < 0) errs.push("El costo total del ticket no puede ser negativo.");
    }
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setSaving(true);

    const update = {
      fechaTicket: fechaTicket || hoyISO(),
      lineas: normalizedLines,
      modoImpuesto: taxMode,
      impuestoPct: aNumero(taxPct),
      impuestoFijo: aNumero(taxFixed),
      otrosGastosTicket: aNumero(otherCosts),
      totalPiezas: isLote
        ? aCantidad(totalPieces)
        : normalizedLines.reduce((a, l) => a + aCantidad(l.qty), 0),
      costoTicket: isLote ? aNumero(ticketCost) : 0,
      estado: "draft",
      costoTotalUSD: previewTotal,
      totalCostUSD: previewTotal,
    };

    await dbUpdate(COL.tickets, ticket.id, update);
    setSaving(false);
    onNext({ ...ticket, ...update, tipoCambio: ticketRate, exchangeRate: ticketRate });
  }

  return (
    <div style={{ padding:"0 16px 32px" }}>
      <TopBar title={ticket.ticketId} subtitle="Paso 2 de 3 — Detalle de productos" onBack={onBack}/>
      <div style={{ padding:"20px 0 0" }}>
        <Inp label="Fecha del ticket" value={fechaTicket} onChange={setFechaTicket} type="date"
          hint="Este valor se guarda para reportes e histórico real."/>

        {/* ── LOTE ── */}
        {isLote && <>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
            <HelpTip
              title="Modo lote"
              text="Captura piezas totales y costo total del ticket. Luego se suman otros gastos e impuestos y el total se divide entre todas las piezas para obtener el costo provisional por pieza."
            />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Inp label="Total de piezas *" value={totalPieces}
              onChange={setTotalPieces} type="number" small required
              hint="Las que contaste físicamente"/>
            <Inp label="Costo total del ticket USD *" value={ticketCost}
              onChange={setTicketCost} type="text" inputMode="decimal" small required
              hint="Lo que dice el recibo en USD"/>
          </div>
        </>}

        {/* ── INDIVIDUAL: Líneas ── */}
        {!isLote && <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, borderBottom:`1px solid ${C.border}`, paddingBottom:8 }}>
            <span style={{ fontSize:14, fontWeight:700, color:C.black, fontFamily:FONT.display }}>Productos del ticket</span>
            <button onClick={addLine} style={{ background:C.black, color:C.white, border:"none",
              padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", letterSpacing:1 }}>
              + Agregar línea
            </button>
          </div>

          {lines.length === 0 && (
            <div style={{ textAlign:"center", padding:"24px 0", color:C.muted, fontSize:13, marginBottom:16 }}>
              Toca "+ Agregar línea" para cada tipo de producto del ticket
            </div>
          )}

          {lines.map((line, idx) => {
            const sub = lineSubtotal(line);
            const previewLine = previewLines[idx];
            return (
              <Card key={line.id} style={{ marginBottom:10, background:C.cream }}>
                {/* Header de línea */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:C.muted, letterSpacing:1.5 }}>
                    LÍNEA {String(idx+1).padStart(2,"0")}
                  </span>
                  <button onClick={() => removeLine(idx)} style={{
                    background:"none", border:"none", cursor:"pointer",
                    color:C.danger, fontSize:16, padding:"0 4px",
                  }}>✕</button>
                </div>

                {/* Descripción + categoría */}
                <Inp
                  label="Descripción del producto *"
                  value={line.descr}
                  onChange={v => updateLine(idx, "descr", v)}
                  placeholder="Ej: Tenis Nike Air Max, Jeans Levi's, etc."
                  small
                />
                <Select
                  label="Categoría"
                  value={line.cat}
                  onChange={v => updateLine(idx, "cat", v)}
                  options={CATEGORIAS}
                  small
                />

                {/* Cantidad + Costo */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <Inp
                    label="Cantidad (piezas) *"
                    value={String(line.qty)}
                    onChange={v => updateLine(idx, "qty", v)}
                    type="number"
                    placeholder="Ej: 10"
                    small
                    required
                  />
                  <Inp
                    label="Costo c/u en USD *"
                    value={String(line.unitCost)}
                    onChange={v => updateLine(idx, "unitCost", v)}
                    type="text"
                    inputMode="decimal"
                    placeholder="Ej: 12.50"
                    small
                    required
                  />
                </div>

                {/* Preview subtotal */}
                {sub > 0 && (
                  <div style={{ background:C.white, padding:"10px 12px", borderTop:`1px solid ${C.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: previewLine ? 8 : 0 }}>
                      <span style={{ fontSize:11, color:C.muted }}>
                        {aCantidad(line.qty)} pza{aCantidad(line.qty) !== 1 ? "s" : ""} × ${aNumero(line.unitCost).toFixed(2)} USD
                      </span>
                      <span style={{ fontSize:13, fontWeight:700, color:C.terra }}>
                        Base de la línea: ${sub.toFixed(2)} USD
                      </span>
                    </div>
                    {previewLine && (
                      <>
                        <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
                          <span style={{ fontSize:11, color:C.muted }}>+ Otros gastos asignados a esta línea</span>
                          <span style={{ fontSize:11, color:C.black }}>${(previewLine.otherAmt || 0).toFixed(2)}</span>
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
                          <span style={{ fontSize:11, color:C.muted }}>+ Impuestos asignados a esta línea</span>
                          <span style={{ fontSize:11, color:C.black }}>${(previewLine.taxAmt || 0).toFixed(2)}</span>
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", paddingTop:6, marginTop:6, borderTop:`1px solid ${C.border}` }}>
                          <span style={{ fontSize:11, fontWeight:700, color:C.black }}>Total de entrada de esta línea</span>
                          <span style={{ fontSize:12, fontWeight:800, color:C.ok }}>${(previewLine.totalCostLine || 0).toFixed(2)} USD</span>
                        </div>
                        <div style={{ fontSize:10, color:C.muted, lineHeight:1.5, marginTop:5 }}>
                          Fórmula: ${sub.toFixed(2)} + ${(previewLine.otherAmt || 0).toFixed(2)} + ${(previewLine.taxAmt || 0).toFixed(2)} = ${(previewLine.totalCostLine || 0).toFixed(2)} USD
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", paddingTop:4 }}>
                          <span style={{ fontSize:11, color:C.muted }}>Costo estimado por pieza</span>
                          <span style={{ fontSize:12, fontWeight:700, color:C.terra }}>${(previewLine.costUSD || 0).toFixed(2)} USD</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Preview total base */}
          {totalBase > 0 && (
            <Card style={{ marginBottom:16, background:C.stone, padding:"10px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, color:C.muted }}>Subtotal base del ticket</span>
                <span style={{ fontSize:14, fontWeight:700, color:C.black }}>${totalBase.toFixed(2)} USD</span>
              </div>
            </Card>
          )}
        </>}

        {/* ── GASTOS COMUNES (aplica a ambos métodos) ── */}
        <SectionTitle>Gastos del ticket</SectionTitle>

        {/* Otros gastos — UN SOLO CAMPO */}
        <Card style={{ marginBottom:14, background:C.terraL, padding:"14px" }}>
          <TituloConAyuda
            title="📦 Otros gastos del ticket (USD)"
            help="Incluye aquí bolsas, empaque u otros gastos. El sistema reparte ese monto entre las líneas según el valor de cada una."
          />
          <Inp
            value={otherCosts}
            onChange={setOtherCosts}
            type="text"
            inputMode="decimal"
            placeholder="Ej: 5.00  (dejar en 0 si no aplica)"
            hint="Total de otros gastos en USD."
          />
        </Card>

        {/* Impuestos */}
        <Card style={{ marginBottom:16, padding:"14px" }}>
          <TituloConAyuda
            title="🧾 Impuestos del ticket"
            help="Usa primero monto fijo si ya tienes el dato real del ticket. El porcentaje solo sirve como estimación temporal."
          />
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            {["fixed","pct"].map(m => (
              <button key={m} onClick={() => setTaxMode(m)} style={{
                flex:1, padding:"10px",
                border:`1.5px solid ${taxMode===m ? C.black : C.border}`,
                background: taxMode===m ? C.black : C.white,
                color: taxMode===m ? C.white : C.black,
                fontSize:12, fontWeight:700, cursor:"pointer",
              }}>
                {m === "fixed" ? "$ Monto fijo" : "% Porcentaje"}
              </button>
            ))}
          </div>

          {taxMode === "fixed" ? (
            <Inp
              value={taxFixed}
              onChange={setTaxFixed}
              type="text"
              inputMode="decimal"
              placeholder="Monto exacto del comprobante en USD"
              hint="Ejemplo: si el ticket dice 18 USD, captura 18"
            />
          ) : (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <input
                  value={taxPct}
                  onChange={e => setTaxPct(e.target.value)}
                  type="text"
                  inputMode="decimal"
                  style={{ flex:1, padding:"11px 14px", border:`1.5px solid ${C.border}`,
                    fontSize:16, fontWeight:700, outline:"none", background:C.white, color:C.terra, fontFamily:FONT.body }}
                />
                <span style={{ fontSize:18, fontWeight:700, color:C.muted }}>%</span>
              </div>
              <div style={{ fontSize:11, color:C.warn, marginTop:6, lineHeight:1.5 }}>
                ⚠️ Estimado. Cuando tengas el recibo exacto cambia a "Monto fijo".
              </div>
            </>
          )}
        </Card>

        {!isLote && previewLines.length > 0 && (
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
            <HelpTip
              title="Costeo individual"
              text='Cada línea conserva su costo base. Después, otros gastos e impuestos se reparten proporcionalmente: los productos más caros absorben más gasto y los más baratos menos. El dato clave es el costo estimado por pieza.'
            />
          </div>
        )}

        {/* ── PREVIEW TOTAL ── */}
        {(totalBase > 0 || (isLote && aNumero(ticketCost) > 0)) && (
          <Card style={{ marginBottom:16, background:C.okFade, borderLeft:`3px solid ${C.ok}`, padding:"14px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.ok, marginBottom:10 }}>
              Resumen de entrada
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {[
                ["Base del ticket",   `$${previewBase.toFixed(2)} USD`],
                ["+ Otros gastos",    `$${previewOther.toFixed(2)} USD`],
                ["+ Impuestos",       `$${previewTax.toFixed(2)} USD`],
              ].map(([l,v]) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:12, color:C.muted }}>{l}</span>
                  <span style={{ fontSize:12, color:C.black }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8, display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:14, fontWeight:700, color:C.black }}>Total de entrada del ticket</span>
                <span style={{ fontSize:16, fontWeight:900, color:C.ok }}>${previewTotal.toFixed(2)} USD</span>
              </div>
              <div style={{ background:"rgba(255,255,255,0.6)", padding:"8px 10px", marginTop:4 }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>Fórmula</div>
                <div style={{ fontSize:12, fontWeight:700, color:C.black }}>
                  Base ${previewBase.toFixed(2)} + Otros ${previewOther.toFixed(2)} + Impuestos ${previewTax.toFixed(2)} = ${previewTotal.toFixed(2)} USD
                </div>
              </div>
              {previewPieces > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:12, color:C.muted }}>Promedio estimado por pieza</span>
                  <span style={{ fontSize:13, fontWeight:700, color:C.terra }}>${averagePieceCost.toFixed(2)} USD</span>
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, color:C.muted }}>En MXN ({previewTotal.toFixed(2)} × TC {previewRate.toFixed(2)})</span>
                <span style={{ fontSize:13, fontWeight:700, color:C.terra }}>
                  ${(previewTotal * previewRate).toFixed(2)} MXN
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Errores */}
        {errors.length > 0 && (
          <Card style={{ marginBottom:16, background:C.dangerFade, borderLeft:`3px solid ${C.danger}`, padding:"14px" }}>
            {errors.map((e, i) => (
              <div key={i} style={{ fontSize:12, color:C.danger, marginBottom:4 }}>❌ {e}</div>
            ))}
          </Card>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <button onClick={onBack} style={{
            padding:"12px",
            background:C.white,
            border:`1.5px solid ${C.border}`,
            fontSize:12,
            fontWeight:800,
            cursor:"pointer",
            color:C.black,
            borderRadius:16,
          }}>
            Cancelar
          </button>
          <Btn
            label={saving ? "Guardando…" : "Guardar y ver costos →"}
            onClick={handleSave}
            disabled={saving}
          />
        </div>
      </div>
    </div>
  );
}

// ─── PASO 3: RESUMEN DE COSTOS ────────────────────────────
export function CostPreview({ ticket, onBack, onGenerate }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { isLote, rate, costedLines, loteResult, totalPiezas, previewTotal } = resumenCosteo(ticket);

  async function handleGenerate() {
    setError("");
    setSuccess("");
    setGenerating(true);

    try {
      const allInventory = await dbGetAll(COL.inventario);
      const existingItems = allInventory.filter(item => item.ticketDocId === ticket.id);
    if (existingItems.length > 0 && existingItems.length !== totalPiezas) {
      setError(`Este ticket ya tiene ${existingItems.length} pieza(s) generadas y ahora calcula ${totalPiezas}. Para evitar duplicados no se volvió a generar.`);
      setGenerating(false);
      return;
    }

    // Marcar ticket como costado
    await dbUpdate(COL.tickets, ticket.id, {
      estado:      "costed",
      status:      "costed",
      costedAt:    new Date().toISOString(),
      costedLines: isLote ? [] : costedLines,
      loteResult,
      costoTotalUSD: previewTotal,
      totalCostUSD: previewTotal,
      totalPiezas,
      totalPieces: totalPiezas,
    });

    const origen = leer(ticket, "origen", "origin", "usa");
    const esOrigenUSA = origen === "usa";
    const fechaTicketProducto = ticket.fechaTicket || ticket.createdAt?.slice(0, 10) || hoyISO();

    // Generar piezas en inventario o actualizar las existentes para no duplicar.
    if (existingItems.length === 0 && isLote) {
      for (let i = 0; i < totalPiezas; i++) {
        const invNum = await nextId("inventory");
        const skuNum = await nextId("sku");
        await dbCreate(COL.inventario, padId(invNum, "INV-"), {
          // ── Identificadores
          idInterno:         padId(invNum, "INV-"),
          clave:             padId(skuNum, "OA-"),
          ticketOrigen:      ticket.ticketId,
          ticketDocId:       ticket.id,
          metodo:            "lote",

          // ── Descripción del producto (se completa después en inventario)
          nombre:            "Artículo de lote",
          categoria:         "Ropa",
          talla:             "",
          color:             "",
          genero:            "",
          marca:             "",
          descripcion:       "",
          foto:              "",
          fotos:             [],

          // ── Costo USA
          ...(esOrigenUSA ? {
            costoUSD:          loteResult.costUSD,
            fletePorPrendaUSD: 0,           // se actualiza al registrar el envío
            costoTotalUSD:     loteResult.costUSD,
            tipoCambio:        rate,
            costoMXN:          loteResult.costUSD * rate,
          } : {
            costoMXN:          loteResult.costUSD, // en México el "costUSD" ya viene en MXN
            fleteMXN:          0,
          }),

          // ── Estado
          esProvisional:     esOrigenUSA,    // se actualiza al registrar envío
          estado:            "en_bodega",
          ubicacion:         esOrigenUSA ? "usa" : "bodega_scl",
          activo:            false,
          precio:            0,
          origen:            origen,
          fechaCompra:       fechaTicketProducto,
          ticketLineId:      `lote-${i + 1}`,
          ticketLineIndex:   i,
        });
      }
    } else if (existingItems.length === 0) {
      for (const line of costedLines) {
        const qty = parseInt(line.qty) || 0;
        for (let i = 0; i < qty; i++) {
          const invNum = await nextId("inventory");
          const skuNum = await nextId("sku");
        await dbCreate(COL.inventario, padId(invNum, "INV-"), {
            // ── Identificadores
            idInterno:         padId(invNum, "INV-"),
            clave:             padId(skuNum, "OA-"),
            ticketOrigen:      ticket.ticketId,
            ticketDocId:       ticket.id,
            metodo:            "individual",

            // ── Descripción (se completa después en inventario)
            nombre:            line.descr,
            categoria:         line.cat || "Ropa",
            talla:             line.talla || "",
            color:             "",
            genero:            line.genero || "",
            marca:             line.marca || "",
            descripcion:       line.descripcion || "",
            foto:              "",
            fotos:             [],

            // ── Costo
            ...(esOrigenUSA ? {
              costoUSD:          line.costUSD,
              fletePorPrendaUSD: 0,           // se actualiza al registrar envío
              costoTotalUSD:     line.costUSD,
              tipoCambio:        rate,
              costoMXN:          line.costUSD * rate,
            } : {
              costoMXN:          line.costUSD, // en México costUSD contiene el monto en MXN
              fleteMXN:          0,
            }),

            // ── Estado
            esProvisional:     esOrigenUSA,    // México no necesita esperar el envío
            estado:            "en_bodega",
            ubicacion:         esOrigenUSA ? "usa" : "bodega_scl",
            activo:            false,
            precio:            0,
            origen:            origen,
            fechaCompra:       fechaTicketProducto,
            ticketLineId:      String(line.id || `${line.descr}-${line.cat}-${i + 1}`),
            ticketLineIndex:   i,
          });
        }
      }
    } else if (isLote) {
      for (const item of existingItems) {
        await dbUpdate(COL.inventario, item.id, {
          ticketOrigen: ticket.ticketId,
          ticketDocId: ticket.id,
          metodo: "lote",
          origen,
          fechaCompra: item.fechaCompra || fechaTicketProducto,
          esProvisional: esOrigenUSA,
          ...(esOrigenUSA ? {
            costoUSD: loteResult.costUSD,
            fletePorPrendaUSD: item.fletePorPrendaUSD || 0,
            costoTotalUSD: loteResult.costUSD,
            tipoCambio: rate,
            costoMXN: loteResult.costUSD * rate,
          } : {
            costoMXN: loteResult.costUSD,
            fleteMXN: item.fleteMXN || 0,
          }),
        });
      }
    } else {
      const sortedItems = [...existingItems].sort((a, b) => {
        const byCreated = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
        return byCreated || String(a.id).localeCompare(String(b.id));
      });
      let cursor = 0;

      for (const line of costedLines) {
        const qty = parseInt(line.qty) || 0;
        for (let i = 0; i < qty; i++) {
          const item = sortedItems[cursor++];
          if (!item) continue;
          await dbUpdate(COL.inventario, item.id, {
            ticketOrigen: ticket.ticketId,
            ticketDocId: ticket.id,
            metodo: "individual",
            origen,
            categoria: line.cat || item.categoria || "Ropa",
            fechaCompra: item.fechaCompra || fechaTicketProducto,
            esProvisional: esOrigenUSA,
            ...(esOrigenUSA ? {
              costoUSD: line.costUSD,
              fletePorPrendaUSD: item.fletePorPrendaUSD || 0,
              costoTotalUSD: line.costUSD,
              tipoCambio: rate,
              costoMXN: line.costUSD * rate,
            } : {
              costoMXN: line.costUSD,
              fleteMXN: item.fleteMXN || 0,
            }),
            ticketLineId:      String(line.id || item.ticketLineId || `${line.descr}-${line.cat}-${i + 1}`),
            ticketLineIndex:   i,
          });
        }
      }
    }

      // Actualizar total de piezas en el ticket
      await dbUpdate(COL.tickets, ticket.id, {
        totalPiezas,
        totalPieces: totalPiezas,
        inventoryItemCount: totalPiezas,
        inventoryGeneratedAt: new Date().toISOString(),
      });

      setSuccess(existingItems.length > 0
        ? `Se actualizaron ${totalPiezas} pieza(s) de este ticket.`
        : `Se generaron ${totalPiezas} pieza(s) en inventario.`);
      await onGenerate?.();
    } catch (e) {
      console.error("Error al generar inventario del ticket:", e);
      setError(e?.message || "Ocurrió un error al generar o actualizar inventario.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ padding:"0 16px 32px" }}>
      <TopBar title={ticket.ticketId} subtitle="Paso 3 de 3 — Revisión de costos" onBack={onBack}/>
      <div style={{ padding:"20px 0 0" }}>

        <InfoBox type="warn">
          ⚠️ Estos son costos <strong>provisionales</strong> — sin el envío todavía. Se actualizan automáticamente cuando registres el envío.
        </InfoBox>
        <InfoBox type={leer(ticket, "estado", "status", "draft") === "costed" ? "info" : "terra"}>
          {leer(ticket, "estado", "status", "draft") === "costed"
            ? "Si este ticket ya fue generado antes, volver a confirmar actualizará costos en las piezas existentes y no creará duplicados."
            : "Al confirmar por primera vez, este ticket creará sus piezas provisionales en inventario."}
        </InfoBox>

        {/* TC */}
        <Card style={{ marginBottom:14, background:C.terraL, padding:"10px 14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:12, color:C.muted }}>Tipo de cambio usado</span>
            <span style={{ fontSize:14, fontWeight:700, color:C.terra }}>${rate} MXN/USD</span>
          </div>
        </Card>

        {/* ── LOTE ── */}
        {isLote && loteResult && <>
          <SectionTitle>Resumen del lote</SectionTitle>
          <Card style={{ marginBottom:14 }}>
            {[
              ["Costo del ticket",    `$${loteResult.ticketCost.toFixed(2)} USD`],
              ["+ Otros gastos",      `$${loteResult.otherAmt.toFixed(2)} USD`],
              ["+ Impuestos",         `$${loteResult.taxAmt.toFixed(2)} USD`],
              ["= Total del ticket",  `$${loteResult.totalCost.toFixed(2)} USD`],
            ].map(([l,v]) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontSize:12, color:C.muted }}>{l}</span>
                <span style={{ fontSize:12, fontWeight:700, color:C.black }}>{v}</span>
              </div>
            ))}
          </Card>
          <Card style={{ background:C.okFade, padding:"14px", marginBottom:14 }}>
            <div style={{ fontSize:12, color:C.ok, marginBottom:4 }}>Costo provisional por pieza</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:22, fontWeight:900, color:C.ok }}>${loteResult.costUSD.toFixed(4)} USD</span>
              <span style={{ fontSize:16, fontWeight:700, color:C.terra }}>${(loteResult.costUSD * rate).toFixed(2)} MXN</span>
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
              Total: {loteResult.totalPieces} piezas × ${loteResult.costUSD.toFixed(4)} = ${loteResult.totalCost.toFixed(2)} ✓
            </div>
          </Card>
        </>}

        {/* ── INDIVIDUAL ── */}
        {!isLote && costedLines.length > 0 && <>
          <SectionTitle>Costo por línea</SectionTitle>
          {costedLines.map((line, i) => (
            <Card key={i} style={{ marginBottom:12 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.black, marginBottom:10, fontFamily:FONT.display }}>
                {line.descr} × {line.qty} pzas ({line.weight}% del ticket)
              </div>
              {[
                ["Base de la línea",   `$${line.subtotal.toFixed(2)}`],
                ["+ Otros gastos",     `$${line.otherAmt.toFixed(2)}`],
                ["+ Impuestos",        `$${line.taxAmt.toFixed(2)}`],
                ["= Total línea",      `$${line.totalCostLine.toFixed(2)}`],
              ].map(([l,v]) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:12, color:C.muted }}>{l}</span>
                  <span style={{ fontSize:12, fontWeight:l.startsWith("=") ? 700 : 400, color:C.black }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop:10, background:C.okFade, padding:"10px 12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.ok }}>
                    Costo por pieza
                  </span>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:16, fontWeight:900, color:C.ok }}>${line.costUSD.toFixed(4)} USD</div>
                    <div style={{ fontSize:13, fontWeight:700, color:C.terra }}>${(line.costUSD * rate).toFixed(2)} MXN</div>
                  </div>
                </div>
                <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>
                  Verificación: base ${line.subtotal.toFixed(2)} + otros ${line.otherAmt.toFixed(2)} + impuestos ${line.taxAmt.toFixed(2)} = total línea ${line.totalCostLine.toFixed(2)} USD. Luego ${line.totalCostLine.toFixed(2)} / ${line.qty} = ${line.costUSD.toFixed(4)} USD por pieza.
                </div>
              </div>
            </Card>
          ))}
        </>}

        <div style={{ marginTop:8, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <button onClick={onBack} style={{
            padding:"12px",
            background:C.white,
            border:`1.5px solid ${C.border}`,
            fontSize:12,
            fontWeight:800,
            cursor:"pointer",
            color:C.black,
            borderRadius:16,
          }}>
            Cancelar
          </button>
          <Btn
            label={generating
              ? "Generando inventario…"
              : `${leer(ticket, "estado", "status", "draft") === "costed" ? "↻ Actualizar" : "✓ Generar"} ${totalPiezas} pieza${totalPiezas !== 1 ? "s" : ""} en inventario`}
            onClick={handleGenerate}
            disabled={generating}
            color={C.ok}
          />
        </div>
        {error && (
          <Card style={{ marginTop:12, background:C.dangerFade, borderLeft:`3px solid ${C.danger}`, padding:"14px" }}>
            <div style={{ fontSize:12, color:C.danger }}>❌ {error}</div>
          </Card>
        )}
        {success && (
          <Card style={{ marginTop:12, background:C.okFade, borderLeft:`3px solid ${C.ok}`, padding:"14px" }}>
            <div style={{ fontSize:12, color:C.ok }}>✓ {success}</div>
          </Card>
        )}
        <div style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:10, lineHeight:1.6 }}>
          {leer(ticket, "estado", "status", "draft") === "costed"
            ? `Se actualizarán ${totalPiezas} artículos ya vinculados a este ticket.`
            : `Se crean ${totalPiezas} artículos en bodega con costo provisional.`}
          <br/>
          El costo final se actualiza al registrar el envío.
        </div>
      </div>
    </div>
  );
}

// ─── ORQUESTADOR ──────────────────────────────────────────
export function TicketsScreen({ onBack, onRefresh }) {
  const [view,   setView]   = useState("list");
  const [ticket, setTicket] = useState(null);

  if (view === "new") return (
    <NewTicket
      onBack={() => setView("list")}
      onCreated={async ticketId => {
        const all = await dbGetAll(COL.tickets);
        const t   = all.find(x => x.ticketId === ticketId);
        setTicket(t);
        setView("detail");
      }}
    />
  );

  if (view === "detail" && ticket) return (
    <TicketDetail
      ticket={ticket}
      onBack={() => setView("list")}
      onNext={updated => { setTicket(updated); setView("cost"); }}
    />
  );

  if (view === "cost" && ticket) return (
    <CostPreview
      ticket={ticket}
      onBack={() => setView("detail")}
      onGenerate={async () => {
        if (onRefresh) await onRefresh();
        setView("list");
      }}
    />
  );

  return (
    <TicketList
      onNew={() => setView("new")}
      onBack={onBack}
      onOpen={t => {
        setTicket(t);
        setView(leer(t, "estado", "status", "draft") === "draft" ? "detail" : "cost");
      }}
    />
  );
}
