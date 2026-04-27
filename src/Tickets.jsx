import { useState, useEffect, useRef } from "react";
import { C, FONT, Btn, Inp, Select, Card, SectionTitle, TopBar,
         InfoBox, Table, Loading, Badge, EmptyState } from "./ui.jsx";
import { dbAdd, dbUpdate, dbGetAll, nextId, padId, fetchExchangeRate } from "./firebase.js";
import { costIndividual, costLote } from "./costing.js";
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
  let limpio = String(valor).replace(/[^\d,.-]/g, "").trim();
  if (!limpio) return 0;

  const tieneComa = limpio.includes(",");
  const tienePunto = limpio.includes(".");

  // Si trae ambos separadores, tomamos el último como decimal.
  if (tieneComa && tienePunto) {
    const ultimoComa = limpio.lastIndexOf(",");
    const ultimoPunto = limpio.lastIndexOf(".");
    const decimalEsComa = ultimoComa > ultimoPunto;
    limpio = decimalEsComa
      ? limpio.replace(/\./g, "").replace(",", ".")
      : limpio.replace(/,/g, "");
  } else if (tieneComa && !tienePunto) {
    // Si solo hay coma: "14,99" => 14.99 ; "1,234" => 1234
    const partes = limpio.split(",");
    limpio = partes.length === 2 && partes[1].length <= 2
      ? `${partes[0]}.${partes[1]}`
      : limpio.replace(/,/g, "");
  } else if (!tieneComa && tienePunto) {
    // Si solo hay punto: "14.99" => 14.99 ; "1.234" => 1234
    const partes = limpio.split(".");
    limpio = partes.length === 2 && partes[1].length <= 2
      ? limpio
      : limpio.replace(/\./g, "");
  }

  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
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
            <div style={{ fontSize:22, fontWeight:900, color:C.black, fontFamily:FONT.display }}>Tickets de compra</div>
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
              {origen === "usa" ? "🇺🇸 USA" : "🇲🇽 México"} · {metodo === "individual" ? "Individual" : "Por lote"}
              {tipoCambio ? ` · TC: $${tipoCambio}` : ""}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:C.muted }}>{fechaTicket?.slice(0,10)}</span>
              <span style={{ fontSize:13, fontWeight:700, color:C.terra }}>
                {totalPiezas || 0} pzas · ${Number(costoTotalUSD || 0).toFixed(2)} USD
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
      const id = padId(n, "T-");
      await dbAdd(COL.tickets, {
        ticketId: id,
        ticketNum: n,
        fechaTicket: fechaTicket || hoyISO(),
        origen,
        metodo,
        notas,
        tipoCambio: aNumero(tipoCambio) || STORE_CONFIG.exchangeRate,
        estado: "draft",
        totalPiezas: 0,
        costoTotalUSD: 0,
        lineas: [],
        // Compatibilidad (campos históricos)
        origin: origen,
        method: metodo,
        notes: notas,
        exchangeRate: aNumero(tipoCambio) || STORE_CONFIG.exchangeRate,
        status: "draft",
        totalPieces: 0,
        totalCostUSD: 0,
        lines: [],
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

        <InfoBox type="terra">
          El ID se genera automáticamente. Solo define el origen y método de costeo.
        </InfoBox>

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
                value={tipoCambio} onChange={e => setTipoCambio(e.target.value)} type="number" step="0.01"
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
            <div style={{ fontSize:11, color:C.muted, marginBottom:20, lineHeight:1.6 }}>
              Se guarda con el ticket para que el historial sea correcto aunque el dólar cambie después.
            </div>
          </>
        )}

        <Inp label="Fecha del ticket" value={fechaTicket} onChange={setFechaTicket}
          type="date" hint="Puedes ajustar una fecha histórica real."/>

        <Inp label="Notas" value={notas} onChange={setNotas}
          placeholder="Proveedor, tienda, observaciones…" hint="Opcional"/>

        <Btn label={guardando ? "Creando ticket…" : "Crear ticket y continuar →"}
          onClick={handleCreate} disabled={guardando}/>
      </div>
    </div>
  );
}

// ─── PASO 2: DETALLE DEL TICKET ───────────────────────────
export function TicketDetail({ ticket, onBack, onNext }) {
  const isLote = leer(ticket, "metodo", "method", "individual") === "lote";
  const [fechaTicket, setFechaTicket] = useState(ticket.fechaTicket || ticket.createdAt?.slice(0,10) || hoyISO());

  // ── Estado Individual ──────────────────────────────────
  const [lines,       setLines]       = useState(leer(ticket, "lineas", "lines", []));
  const [otherCosts,  setOtherCosts]  = useState(String(leer(ticket, "otrosGastosTicket", "ticketOtherCosts", "")));
  const [taxMode,     setTaxMode]     = useState(leer(ticket, "modoImpuesto", "taxMode", "pct"));
  const [taxPct,      setTaxPct]      = useState(String(leer(ticket, "impuestoPct", "taxPct", "10")));
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
    const q = aNumero(line.qty);
    const c = aNumero(line.unitCost);
    return q * c;
  }

  const totalBase = lines.reduce((a, l) => a + lineSubtotal(l), 0);
  const baseLote = aNumero(ticketCost);

  let previewTax = 0;
  if (taxMode === "pct") {
    const baseImpuestos = isLote ? baseLote : totalBase;
    previewTax = baseImpuestos * (aNumero(taxPct) / 100);
  } else {
    previewTax = aNumero(taxFixed);
  }
  const previewOther = aNumero(otherCosts);
  const previewBase = isLote ? baseLote : totalBase;
  const previewTotal = previewBase + previewTax + previewOther;

  // ── Guardar ────────────────────────────────────────────
  async function handleSave() {
    // Validar
    const errs = [];
    if (!isLote) {
      if (lines.length === 0) errs.push("Agrega al menos una línea de producto.");
      lines.forEach((l, i) => {
        if (!l.descr) errs.push(`Línea ${i+1}: escribe la descripción.`);
        if (!(aNumero(l.qty) > 0)) errs.push(`Línea ${i+1}: la cantidad debe ser mayor a 0.`);
        if (!(aNumero(l.unitCost) > 0)) errs.push(`Línea ${i+1}: el costo USD debe ser mayor a 0.`);
      });
    } else {
      if (!(parseInt(totalPieces) > 0)) errs.push("Ingresa el número de piezas.");
      if (!(aNumero(ticketCost) > 0)) errs.push("Ingresa el costo total del ticket.");
    }
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    setSaving(true);

    const update = {
      fechaTicket: fechaTicket || hoyISO(),
      lineas: lines,
      modoImpuesto: taxMode,
      impuestoPct: aNumero(taxPct),
      impuestoFijo: aNumero(taxFixed),
      otrosGastosTicket: aNumero(otherCosts),
      totalPiezas: isLote
        ? (parseInt(totalPieces) || 0)
        : lines.reduce((a, l) => a + (parseInt(l.qty) || 0), 0),
      costoTicket: isLote ? aNumero(ticketCost) : 0,
      estado: "draft",
      // Compatibilidad
      lines,
      taxMode,
      taxPct: aNumero(taxPct),
      taxFixed: aNumero(taxFixed),
      ticketOtherCosts: aNumero(otherCosts),
      totalPieces: isLote
        ? (parseInt(totalPieces) || 0)
        : lines.reduce((a, l) => a + (parseInt(l.qty) || 0), 0),
      ticketCost: isLote ? aNumero(ticketCost) : 0,
      status: "draft",
    };

    await dbUpdate(COL.tickets, ticket.id, update);
    setSaving(false);
    onNext({ ...ticket, ...update });
  }

  return (
    <div style={{ padding:"0 16px 32px" }}>
      <TopBar title={ticket.ticketId} subtitle="Paso 2 de 3 — Detalle de productos" onBack={onBack}/>
      <div style={{ padding:"20px 0 0" }}>
        <Inp label="Fecha del ticket" value={fechaTicket} onChange={setFechaTicket} type="date"
          hint="Este valor se guarda para reportes e histórico real."/>

        {/* ── LOTE ── */}
        {isLote && <>
          <InfoBox type="info">
            Ingresa el total de piezas contadas y el costo total del ticket en USD. El sistema divide automáticamente entre todas las piezas.
          </InfoBox>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Inp label="Total de piezas *" value={totalPieces}
              onChange={setTotalPieces} type="number" small required
              hint="Las que contaste físicamente"/>
            <Inp label="Costo total del ticket USD *" value={ticketCost}
              onChange={setTicketCost} type="number" small required
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
                    type="number"
                    placeholder="Ej: 12.50"
                    small
                    required
                  />
                </div>

                {/* Preview subtotal */}
                {sub > 0 && (
                  <div style={{ background:C.white, padding:"8px 12px", borderTop:`1px solid ${C.border}`,
                    display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:11, color:C.muted }}>
                      {aNumero(line.qty)||0} pzas × ${aNumero(line.unitCost)||0}
                    </span>
                    <span style={{ fontSize:13, fontWeight:700, color:C.terra }}>
                      = ${sub.toFixed(2)} USD
                    </span>
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
          <div style={{ fontSize:12, fontWeight:700, color:C.terraD, marginBottom:4 }}>
            📦 Otros gastos del ticket (total en USD)
          </div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:10, lineHeight:1.6 }}>
            Incluye aquí el total de bolsas, empaque u otros gastos del ticket. Se prorratea automáticamente entre todos los productos según su valor.
          </div>
          <Inp
            value={otherCosts}
            onChange={setOtherCosts}
            type="number"
            placeholder="Ej: 5.00  (dejar en 0 si no aplica)"
            hint="Si los tenis llevan bolsa y los demás no, pon el total de todas las bolsas aquí"
          />
        </Card>

        {/* Impuestos */}
        <Card style={{ marginBottom:16, padding:"14px" }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.black, marginBottom:10 }}>
            🧾 Impuestos del ticket
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            {["pct","fixed"].map(m => (
              <button key={m} onClick={() => setTaxMode(m)} style={{
                flex:1, padding:"10px",
                border:`1.5px solid ${taxMode===m ? C.black : C.border}`,
                background: taxMode===m ? C.black : C.white,
                color: taxMode===m ? C.white : C.black,
                fontSize:12, fontWeight:700, cursor:"pointer",
              }}>
                {m === "pct" ? "% Porcentaje" : "$ Monto fijo"}
              </button>
            ))}
          </div>

          {taxMode === "pct" ? (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <input
                  value={taxPct}
                  onChange={e => setTaxPct(e.target.value)}
                  type="number" step="0.1"
                  style={{ flex:1, padding:"11px 14px", border:`1.5px solid ${C.border}`,
                    fontSize:16, fontWeight:700, outline:"none", background:C.white, color:C.terra, fontFamily:FONT.body }}
                />
                <span style={{ fontSize:18, fontWeight:700, color:C.muted }}>%</span>
              </div>
              <div style={{ fontSize:11, color:C.warn, marginTop:6, lineHeight:1.5 }}>
                ⚠️ Estimado. Cuando tengas el recibo exacto cambia a "Monto fijo".
              </div>
            </>
          ) : (
            <Inp
              value={taxFixed}
              onChange={setTaxFixed}
              type="number"
              placeholder="Monto exacto del comprobante en USD"
              hint="Usa esto cuando tengas el recibo con el monto exacto"
            />
          )}
        </Card>

        {/* ── PREVIEW TOTAL ── */}
        {(totalBase > 0 || (isLote && aNumero(ticketCost) > 0)) && (
          <Card style={{ marginBottom:16, background:C.okFade, borderLeft:`3px solid ${C.ok}`, padding:"14px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.ok, marginBottom:10 }}>
              Vista previa del costo total
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
                <span style={{ fontSize:14, fontWeight:700, color:C.black }}>Total del ticket</span>
                <span style={{ fontSize:16, fontWeight:900, color:C.ok }}>${previewTotal.toFixed(2)} USD</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, color:C.muted }}>En MXN (TC: ${leer(ticket, "tipoCambio", "exchangeRate", STORE_CONFIG.exchangeRate)})</span>
                <span style={{ fontSize:13, fontWeight:700, color:C.terra }}>
                  ${(previewTotal * (aNumero(leer(ticket, "tipoCambio", "exchangeRate", STORE_CONFIG.exchangeRate)) || STORE_CONFIG.exchangeRate)).toFixed(2)} MXN
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

        <Btn
          label={saving ? "Guardando…" : "Guardar y ver costos →"}
          onClick={handleSave}
          disabled={saving}
        />
      </div>
    </div>
  );
}

// ─── PASO 3: RESUMEN DE COSTOS ────────────────────────────
export function CostPreview({ ticket, onBack, onGenerate }) {
  const [generating, setGenerating] = useState(false);
  const isLote = leer(ticket, "metodo", "method", "individual") === "lote";
  const rate   = leer(ticket, "tipoCambio", "exchangeRate", STORE_CONFIG.exchangeRate);

  // Calcular
  let costedLines = [];
  let loteResult  = null;

  if (isLote) {
    loteResult = costLote({
      totalPieces:      leer(ticket, "totalPiezas", "totalPieces", 0),
      ticketCost:       leer(ticket, "costoTicket", "ticketCost", 0),
      ticketOtherCosts: leer(ticket, "otrosGastosTicket", "ticketOtherCosts", 0),
      taxMode:          leer(ticket, "modoImpuesto", "taxMode", "pct"),
      taxPct:           leer(ticket, "impuestoPct", "taxPct", 0),
      taxFixed:         leer(ticket, "impuestoFijo", "taxFixed", 0),
    });
  } else {
    costedLines = costIndividual({
      lines:            leer(ticket, "lineas", "lines", []),
      ticketOtherCosts: leer(ticket, "otrosGastosTicket", "ticketOtherCosts", 0),
      taxMode:          leer(ticket, "modoImpuesto", "taxMode", "pct"),
      taxPct:           leer(ticket, "impuestoPct", "taxPct", 0),
      taxFixed:         leer(ticket, "impuestoFijo", "taxFixed", 0),
    });
  }

  const totalPiezas = isLote
    ? (leer(ticket, "totalPiezas", "totalPieces", 0) || 0)
    : costedLines.reduce((a, l) => a + (parseInt(l.qty) || 0), 0);

  async function handleGenerate() {
    setGenerating(true);

    // Marcar ticket como costado
    await dbUpdate(COL.tickets, ticket.id, {
      estado:      "costed",
      status:      "costed",
      costedAt:    new Date().toISOString(),
      costedLines: isLote ? [] : costedLines,
      loteResult,
      costoTotalUSD: isLote
        ? loteResult.totalCost
        : costedLines.reduce((a, l) => a + (l.totalCostLine || 0), 0),
      totalCostUSD: isLote
        ? loteResult.totalCost
        : costedLines.reduce((a, l) => a + (l.totalCostLine || 0), 0),
      totalPiezas,
      totalPieces: totalPiezas,
    });

    const origen = leer(ticket, "origen", "origin", "usa");
    const esOrigenUSA = origen === "usa";

    // Generar piezas en inventario con nuevos campos en español
    if (isLote) {
      for (let i = 0; i < totalPiezas; i++) {
        const invNum = await nextId("inventory");
        const skuNum = await nextId("sku");
        await dbAdd(COL.inventario, {
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
          condicion:         "buena",
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
          esProvisional:     true,           // se actualiza al registrar envío
          estado:            "en_bodega",
          ubicacion:         esOrigenUSA ? "usa" : "bodega_scl",
          activo:            false,
          precio:            0,
          origen:            origen,
          fechaIngreso:      new Date().toISOString().slice(0, 10),
        });
      }
    } else {
      for (const line of costedLines) {
        const qty = parseInt(line.qty) || 0;
        for (let i = 0; i < qty; i++) {
          const invNum = await nextId("inventory");
          const skuNum = await nextId("sku");
          await dbAdd(COL.inventario, {
            // ── Identificadores
            idInterno:         padId(invNum, "INV-"),
            clave:             padId(skuNum, "OA-"),
            ticketOrigen:      ticket.ticketId,
            ticketDocId:       ticket.id,
            metodo:            "individual",

            // ── Descripción (se completa después en inventario)
            nombre:            line.descr,
            categoria:         line.cat || "Ropa",
            talla:             "",
            color:             "",
            genero:            "",
            marca:             "",
            condicion:         "buena",
            descripcion:       "",
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
            fechaIngreso:      new Date().toISOString().slice(0, 10),
          });
        }
      }
    }

    // Actualizar total de piezas en el ticket
    await dbUpdate(COL.tickets, ticket.id, { totalPiezas, totalPieces: totalPiezas });

    setGenerating(false);
    onGenerate();
  }

  return (
    <div style={{ padding:"0 16px 32px" }}>
      <TopBar title={ticket.ticketId} subtitle="Paso 3 de 3 — Revisión de costos" onBack={onBack}/>
      <div style={{ padding:"20px 0 0" }}>

        <InfoBox type="warn">
          ⚠️ Estos son costos <strong>provisionales</strong> — sin el envío todavía. Se actualizan automáticamente cuando registres el envío.
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
                  Verificación: {line.qty} × ${line.costUSD.toFixed(4)} = ${(line.qty * line.costUSD).toFixed(2)} ≈ ${line.totalCostLine.toFixed(2)} ✓
                </div>
              </div>
            </Card>
          ))}
        </>}

        <div style={{ marginTop:8 }}>
          <Btn
            label={generating
              ? "Generando inventario…"
              : `✓ Generar ${totalPiezas} pieza${totalPiezas !== 1 ? "s" : ""} en inventario`}
            onClick={handleGenerate}
            disabled={generating}
            color={C.ok}
          />
        </div>
        <div style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:10, lineHeight:1.6 }}>
          Se crean {totalPiezas} artículos en bodega con costo provisional.<br/>
          El costo final se actualiza al registrar el envío.
        </div>
      </div>
    </div>
  );
}

// ─── ORQUESTADOR ──────────────────────────────────────────
export function TicketsScreen({ onBack }) {
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
      onGenerate={() => { setView("list"); }}
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
