import { useState, useEffect } from "react";
import { C, FONT, Btn, Card, SectionTitle, TopBar, InfoBox, Loading, Badge, EmptyState } from "./ui.jsx";
import { dbAdd, dbUpdate, dbGetAll, dbWhere, nextId, padId } from "./firebase.js";
import { calcShipmentCost, applyShipmentCost, toMXN, round2 } from "./costing.js";
import { COL, FREIGHT, STORE_CONFIG } from "./config.js";

// ─── SHIPMENT LIST ────────────────────────────────────────
export function ShipmentList({ onNew, onOpen, onBack }) {
  const [shipments, setShipments] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    dbGetAll(COL.shipments).then(s => { setShipments(s); setLoading(false); });
  }, []);

  if (loading) return <Loading message="Cargando envíos…"/>;

  return (
    <div style={{ padding:"0 16px 32px" }}>
      <div style={{ padding:"14px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {onBack && <button onClick={onBack} style={{ background:C.black, border:"none", width:34, height:34, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:C.white, fontSize:18 }}>←</button>}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.terra, letterSpacing:3, textTransform:"uppercase", marginBottom:2 }}>Logística</div>
            <div style={{ fontSize:22, fontWeight:900, color:C.black, fontFamily:FONT.display }}>Envíos USA → MX</div>
          </div>
        </div>
        <Btn label="+ Envío" onClick={onNew} small full={false}/>
      </div>

      <InfoBox type="info">
        Registra el envío cuando llegue la mercancía. El sistema ajusta automáticamente el costo final de todos los productos incluidos.
      </InfoBox>

      {shipments.length === 0 ? (
        <EmptyState icon="✈️" title="Sin envíos registrados" sub="Registra el envío cuando llegue tu mercancía"/>
      ) : shipments.map(s => (
        <Card key={s.id} onClick={() => onOpen(s)}
          style={{ marginBottom:10, cursor:"pointer", borderLeft:`3px solid ${s.applied ? C.ok : C.warn}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.black }}>{s.shipmentId}</div>
            <Badge
              c={s.applied ? C.ok : C.warn}
              bg={s.applied ? C.okFade : C.warnFade}
              label={s.applied ? "✅ Aplicado" : "⏳ Pendiente"}
            />
          </div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>
            {s.weightLbs} lb · {s.ticketIds?.length || 0} ticket{s.ticketIds?.length !== 1 ? "s" : ""} · {s.totalItems || 0} piezas
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:12, color:C.muted }}>{s.createdAt?.slice(0,10)}</span>
            <span style={{ fontSize:13, fontWeight:700, color:C.terra }}>
              Flete: ${(s.totalCostUSD||0).toFixed(2)} USD
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── NEW SHIPMENT ─────────────────────────────────────────
export function NewShipment({ onBack, onCreated }) {
  const [step,        setStep]        = useState("tickets"); // tickets | freight | confirm
  const [tickets,     setTickets]     = useState([]);
  const [selected,    setSelected]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [weightLbs,   setWeightLbs]   = useState("");
  const [insurance,   setInsurance]   = useState(10);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    // Cargar tickets que ya tienen costo pero aún no tienen envío
    dbGetAll(COL.tickets).then(all => {
      const available = all.filter(t =>
        t.status === "costed" && !t.shipmentId
      );
      setTickets(available);
      setLoading(false);
    });
  }, []);

  const rate    = STORE_CONFIG.exchangeRate;
  const weight  = parseFloat(weightLbs) || 0;
  const fCost   = calcShipmentCost({ weightLbs: weight, insurance });

  // Piezas totales de los tickets seleccionados
  const selectedTickets  = tickets.filter(t => selected.includes(t.id));
  const totalSelectedPcs = selectedTickets.reduce((a, t) => a + (t.totalPieces || 0), 0);

  function toggleTicket(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  function selectAll() { setSelected(tickets.map(t => t.id)); }
  function clearAll()  { setSelected([]); }

  async function handleCreate() {
    if (!weight || !selected.length) return;
    setSaving(true);

    const n  = await nextId("shipment");
    const id = padId(n, "ENV-");

    // Obtener todos los items de inventario de los tickets seleccionados
    let allItems = [];
    for (const t of selectedTickets) {
      const items = await dbWhere(COL.inventory, "ticketDocId", "==", t.id);
      allItems = [...allItems, ...items];
    }

    // Prorratear flete por valor
    const withFreight = applyShipmentCost(allItems, fCost.total);

    // Actualizar cada item en Firebase
    for (const item of withFreight) {
      await dbUpdate(COL.inventory, item.id, {
        freightUSD:   item.freightUSD,
        finalCostUSD: item.finalCostUSD,
        finalCostMXN: toMXN(item.finalCostUSD, rate),
        isProvisional: false,
        shipmentId:   id,
      });
    }

    // Marcar tickets como completos
    for (const t of selectedTickets) {
      await dbUpdate(COL.tickets, t.id, {
        status:     "complete",
        shipmentId: id,
      });
    }

    // Crear registro del envío
    await dbAdd(COL.shipments, {
      shipmentId:   id,
      weightLbs:    weight,
      insurance:    fCost.insurance,
      freight:      fCost.freight,
      rate:         fCost.rate,
      totalCostUSD: fCost.total,
      ticketIds:    selected,
      totalItems:   allItems.length,
      applied:      true,
      exchangeRate: rate,
    });

    setSaving(false);
    onCreated();
  }

  if (loading) return <Loading message="Cargando tickets disponibles…"/>;

  // ── PASO 1: Seleccionar tickets ──────────────────────────
  if (step === "tickets") return (
    <div style={{ padding:"0 16px 32px" }}>
      <TopBar title="Nuevo Envío" subtitle="Paso 1 — ¿Qué tickets va este envío?" onBack={onBack}/>
      <div style={{ padding:"20px 0 0" }}>

        <InfoBox type="info">
          Selecciona todos los tickets que llegaron en este mismo envío. El flete se repartirá entre todos sus productos.
        </InfoBox>

        {tickets.length === 0 ? (
          <Card style={{ textAlign:"center", padding:"32px 20px" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
            <div style={{ fontSize:15, fontWeight:700, color:C.black, marginBottom:6, fontFamily:FONT.display }}>
              Sin tickets disponibles
            </div>
            <div style={{ fontSize:13, color:C.muted, lineHeight:1.6 }}>
              Para registrar un envío primero necesitas tener tickets con costeo completado (Paso 3 del ticket).
            </div>
          </Card>
        ) : (
          <>
            {/* Botones de selección rápida */}
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              <button onClick={selectAll} style={{ flex:1, padding:"9px", background:C.black, color:C.white, border:"none", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                ☑ Seleccionar todos
              </button>
              <button onClick={clearAll} style={{ flex:1, padding:"9px", background:C.white, color:C.black, border:`1.5px solid ${C.border}`, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                ☐ Limpiar selección
              </button>
            </div>

            {/* Lista de tickets */}
            {tickets.map(t => {
              const isSelected = selected.includes(t.id);
              return (
                <button key={t.id} onClick={() => toggleTicket(t.id)} style={{
                  width:"100%", textAlign:"left", marginBottom:10,
                  padding:"16px 18px",
                  background: isSelected ? C.black : C.white,
                  border:`2px solid ${isSelected ? C.black : C.border}`,
                  cursor:"pointer",
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  transition:"all .15s",
                }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:800, color:isSelected ? C.white : C.black }}>
                      {t.ticketId}
                    </div>
                    <div style={{ fontSize:12, color:isSelected ? "rgba(255,255,255,0.7)" : C.muted, marginTop:2 }}>
                      {t.totalPieces || 0} piezas · {t.method === "individual" ? "Individual" : "Por lote"}
                      {t.notes ? ` · ${t.notes}` : ""}
                    </div>
                    <div style={{ fontSize:12, color:isSelected ? "rgba(255,255,255,0.6)" : C.muted }}>
                      Creado: {t.createdAt?.slice(0,10)}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                    <div style={{ fontSize:22 }}>{isSelected ? "☑" : "☐"}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:isSelected ? "rgba(255,255,255,0.9)" : C.terra }}>
                      ${(t.totalCostUSD||0).toFixed(2)} USD
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Resumen selección */}
            {selected.length > 0 && (
              <Card style={{ background:C.okFade, borderLeft:`3px solid ${C.ok}`, padding:"12px 14px", marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.ok }}>
                  ✅ {selected.length} ticket{selected.length > 1 ? "s" : ""} seleccionado{selected.length > 1 ? "s" : ""}
                </div>
                <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                  {totalSelectedPcs} piezas en total
                </div>
              </Card>
            )}

            <Btn
              label={selected.length > 0 ? `Continuar con ${selected.length} ticket${selected.length > 1 ? "s" : ""} →` : "Selecciona al menos un ticket"}
              onClick={() => setStep("freight")}
              disabled={selected.length === 0}
            />
          </>
        )}
      </div>
    </div>
  );

  // ── PASO 2: Datos del flete ──────────────────────────────
  if (step === "freight") return (
    <div style={{ padding:"0 16px 32px" }}>
      <TopBar title="Nuevo Envío" subtitle="Paso 2 — Datos del flete" onBack={() => setStep("tickets")}/>
      <div style={{ padding:"20px 0 0" }}>

        <Card style={{ marginBottom:16, background:C.stone, padding:"12px 14px" }}>
          <div style={{ fontSize:12, color:C.muted }}>Tickets seleccionados</div>
          <div style={{ fontSize:14, fontWeight:700, color:C.black, marginTop:4 }}>
            {selectedTickets.map(t => t.ticketId).join(", ")}
          </div>
          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{totalSelectedPcs} piezas totales</div>
        </Card>

        {/* Peso */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:6, letterSpacing:1.5, textTransform:"uppercase" }}>
            Peso total de las cajas (libras) *
          </div>
          <input
            value={weightLbs}
            onChange={e => setWeightLbs(e.target.value)}
            type="number" step="0.1" placeholder="Ej: 120"
            style={{ width:"100%", boxSizing:"border-box", padding:"14px 16px",
              border:`1.5px solid ${C.border}`, fontSize:18, fontWeight:700,
              outline:"none", background:C.white, color:C.terra, fontFamily:FONT.body }}
          />
          {weight > 0 && (
            <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>
              {weight > FREIGHT.threshold
                ? `📦 Más de ${FREIGHT.threshold} lb → tarifa $${FREIGHT.rateHigh}/lb`
                : `📦 ${FREIGHT.threshold} lb o menos → tarifa $${FREIGHT.rateLow}/lb`}
            </div>
          )}
        </div>

        {/* Aseguranza */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:8, letterSpacing:1.5, textTransform:"uppercase" }}>
            Aseguranza
          </div>
          <div style={{ display:"flex", gap:10 }}>
            {[10, 20].map(val => (
              <button key={val} onClick={() => setInsurance(val)} style={{
                flex:1, padding:"14px",
                border:`2px solid ${insurance === val ? C.black : C.border}`,
                background: insurance === val ? C.black : C.white,
                color: insurance === val ? C.white : C.black,
                fontSize:14, fontWeight:700, cursor:"pointer", transition:"all .15s",
              }}>
                ${val} USD
                <div style={{ fontSize:10, fontWeight:400, marginTop:4, color:insurance === val ? "rgba(255,255,255,0.7)" : C.muted }}>
                  {val === 10 ? "Cobertura básica" : "Cobertura extendida"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Preview cálculo de flete */}
        {weight > 0 && (
          <Card style={{ marginBottom:16, background:C.terraL, padding:"14px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.terraD, marginBottom:10 }}>
              📊 Cálculo del flete
            </div>
            {[
              ["Peso",              `${weight} lb`],
              ["Tarifa",            `$${fCost.rate}/lb ${weight > FREIGHT.threshold ? "(>100 lb)" : "(≤100 lb)"}`],
              ["Flete (peso × tarifa)", `$${fCost.freight.toFixed(2)} USD`],
              ["Aseguranza",        `$${fCost.insurance} USD`],
            ].map(([l,v]) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid rgba(0,0,0,0.08)` }}>
                <span style={{ fontSize:12, color:C.muted }}>{l}</span>
                <span style={{ fontSize:12, color:C.black }}>{v}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", paddingTop:10, marginTop:4 }}>
              <span style={{ fontSize:14, fontWeight:700, color:C.terraD }}>Total flete</span>
              <span style={{ fontSize:18, fontWeight:900, color:C.terra }}>${fCost.total.toFixed(2)} USD</span>
            </div>
            <div style={{ borderTop:`1px dashed ${C.border}`, marginTop:10, paddingTop:10 }}>
              <div style={{ fontSize:12, color:C.muted }}>Flete por pieza (aprox.)</div>
              <div style={{ fontSize:13, fontWeight:700, color:C.black, marginTop:2 }}>
                ${totalSelectedPcs > 0 ? (fCost.total / totalSelectedPcs).toFixed(4) : "0.0000"} USD/pza
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2, lineHeight:1.5 }}>
                El sistema distribuye el flete según el valor de cada producto (productos más caros absorben más flete).
              </div>
            </div>
          </Card>
        )}

        <Btn
          label={weight > 0 ? "Revisar y confirmar →" : "Ingresa el peso para continuar"}
          onClick={() => setStep("confirm")}
          disabled={!weight}
        />
      </div>
    </div>
  );

  // ── PASO 3: Confirmar ─────────────────────────────────────
  return (
    <div style={{ padding:"0 16px 32px" }}>
      <TopBar title="Nuevo Envío" subtitle="Paso 3 — Confirmar" onBack={() => setStep("freight")}/>
      <div style={{ padding:"20px 0 0" }}>

        <InfoBox type="warn">
          Al confirmar, el sistema actualizará el costo final de las <strong>{totalSelectedPcs} piezas</strong> de estos tickets. Esta acción no se puede deshacer fácilmente.
        </InfoBox>

        {/* Resumen */}
        <Card style={{ marginBottom:14, padding:"14px" }}>
          <SectionTitle small>Resumen del envío</SectionTitle>
          {[
            ["Tickets incluidos",    selectedTickets.map(t => t.ticketId).join(", ")],
            ["Total de piezas",      `${totalSelectedPcs}`],
            ["Peso total",           `${weight} lb`],
            ["Tarifa aplicada",      `$${fCost.rate}/lb ${weight > FREIGHT.threshold ? "(>100 lb)" : "(≤100 lb)"}`],
            ["Flete",                `$${fCost.freight.toFixed(2)} USD`],
            ["Aseguranza",           `$${fCost.insurance} USD`],
            ["Total flete",          `$${fCost.total.toFixed(2)} USD`],
            ["Flete por pieza",      `$${totalSelectedPcs > 0 ? (fCost.total / totalSelectedPcs).toFixed(4) : "0"} USD`],
          ].map(([l,v]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.muted }}>{l}</span>
              <span style={{ fontSize:12, fontWeight:700, color:C.black }}>{v}</span>
            </div>
          ))}
        </Card>

        <Card style={{ marginBottom:20, background:C.okFade, borderLeft:`3px solid ${C.ok}`, padding:"12px 14px" }}>
          <div style={{ fontSize:12, color:C.ok, fontWeight:700, marginBottom:4 }}>
            ✅ Después de confirmar:
          </div>
          <div style={{ fontSize:12, color:C.black, lineHeight:1.7 }}>
            • Los {totalSelectedPcs} productos pasan a <strong>Costo completo</strong><br/>
            • Se descarta el costo provisional<br/>
            • Los tickets quedan marcados como <strong>Completos</strong>
          </div>
        </Card>

        <Btn
          label={saving ? "Aplicando envío…" : `✓ Confirmar envío con ${totalSelectedPcs} piezas`}
          onClick={handleCreate}
          disabled={saving}
          color={C.ok}
        />
      </div>
    </div>
  );
}

// ─── SHIPMENTS SCREEN ─────────────────────────────────────
export function ShipmentsScreen({ onBack }) {
  const [view, setView] = useState("list");

  if (view === "new") return (
    <NewShipment
      onBack={() => setView("list")}
      onCreated={() => setView("list")}
    />
  );

  return (
    <ShipmentList
      onNew={() => setView("new")}
      onBack={onBack}
      onOpen={() => {}}
    />
  );
}
