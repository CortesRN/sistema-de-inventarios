import { useEffect, useState } from "react";
import { C, FONT, Btn, Card, SectionTitle, TopBar, InfoBox, Loading, Badge, EmptyState } from "./ui.jsx";
import { dbCreate, dbUpdate, dbGetAll, nextId, padId } from "./firebase.js";
import { calcShipmentCost, applyShipmentCost, toMXN } from "./costing.js";
import { COL, FREIGHT, STORE_CONFIG } from "./config.js";

function leer(doc, campoEs, campoEn, fallback = null) {
  if (doc?.[campoEs] !== undefined) return doc[campoEs];
  if (doc?.[campoEn] !== undefined) return doc[campoEn];
  return fallback;
}

function ticketPieces(ticket) {
  return Number(leer(ticket, "totalPiezas", "totalPieces", 0)) || 0;
}

function ticketMethod(ticket) {
  return leer(ticket, "metodo", "method", "individual");
}

function ticketNotes(ticket) {
  return leer(ticket, "notas", "notes", "");
}

function ticketCostUSD(ticket) {
  return Number(leer(ticket, "costoTotalUSD", "totalCostUSD", 0)) || 0;
}

function ticketLabel(ticket) {
  return leer(ticket, "ticketId", "ticketId", ticket.id);
}

function SecondaryButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width:"100%",
        padding:"12px",
        background:C.white,
        color:C.black,
        border:`1.5px solid ${C.border}`,
        fontSize:12,
        fontWeight:700,
        cursor:"pointer",
        marginTop:10,
      }}
    >
      {label}
    </button>
  );
}

export function ShipmentList({ onNew, onOpen, onBack }) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dbGetAll(COL.envios)
      .then(data => {
        setShipments(data);
        setLoading(false);
      })
      .catch(() => {
        setShipments([]);
        setLoading(false);
      });
  }, []);

  if (loading) return <Loading message="Cargando envios..." />;

  return (
    <div style={{ padding:"0 16px 32px" }}>
      <div style={{ padding:"14px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{ background:C.black, border:"none", width:34, height:34, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:C.white, fontSize:18 }}
            >
              ←
            </button>
          )}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:C.terra, letterSpacing:3, textTransform:"uppercase", marginBottom:2 }}>Logistica</div>
            <div style={{ fontSize:22, fontWeight:900, color:C.black, fontFamily:FONT.display }}>Envios USA a MX</div>
          </div>
        </div>
        <Btn label="+ Envio" onClick={onNew} small full={false} />
      </div>

      <InfoBox type="info">
        Registra el envio cuando llegue la mercancia. El sistema ajusta automaticamente el costo final de todos los productos incluidos.
      </InfoBox>

      {shipments.length === 0 ? (
        <EmptyState icon="✈️" title="Sin envios registrados" sub="Registra el envio cuando llegue tu mercancia" />
      ) : shipments.map(s => (
        <Card
          key={s.id}
          onClick={() => onOpen?.(s)}
          style={{ marginBottom:10, borderLeft:`3px solid ${s.applied ? C.ok : C.warn}` }}
        >
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.black }}>{s.shipmentId}</div>
            <Badge c={s.applied ? C.ok : C.warn} bg={s.applied ? C.okFade : C.warnFade} label={s.applied ? "Aplicado" : "Pendiente"} />
          </div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>
            {s.weightLbs} lb · {s.ticketIds?.length || 0} ticket{s.ticketIds?.length !== 1 ? "s" : ""} · {s.totalItems || 0} piezas
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:12, color:C.muted }}>{s.createdAt?.slice(0, 10)}</span>
            <span style={{ fontSize:13, fontWeight:700, color:C.terra }}>
              Flete: ${(s.totalCostUSD || 0).toFixed(2)} USD
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function NewShipment({ onBack, onCreated }) {
  const [step, setStep] = useState("tickets");
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weightLbs, setWeightLbs] = useState("");
  const [insurance, setInsurance] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      dbGetAll(COL.tickets),
      dbGetAll(COL.envios).catch(() => []),
      dbGetAll(COL.inventory, "createdAt", "desc").catch(() => []),
    ])
      .then(([allTickets, allShipments, allInventory]) => {
        const existingShipmentIds = new Set(allShipments.map(s => s.shipmentId).filter(Boolean));
        const available = allTickets.filter(t => {
          const estado = leer(t, "estado", "status", "draft");
          const ticketShipmentId = t.shipmentId || "";
          const ticketItems = allInventory.filter(item => item.ticketDocId === t.id);
          const hasProvisionalItems = ticketItems.some(item => item.esProvisional || item.isProvisional);
          const hasDanglingShipment = Boolean(
            ticketShipmentId &&
            !existingShipmentIds.has(ticketShipmentId)
          );

          if (hasDanglingShipment) return true;
          if (hasProvisionalItems) return true;
          return estado === "costed" && !ticketShipmentId;
        });
        setTickets(available);
        setLoading(false);
      })
      .catch(() => {
        setTickets([]);
        setLoading(false);
      });
  }, []);

  const weight = parseFloat(weightLbs) || 0;
  const fCost = calcShipmentCost({ weightLbs: weight, insurance });
  const selectedTickets = tickets.filter(t => selected.includes(t.id));
  const totalSelectedPcs = selectedTickets.reduce((acc, t) => acc + ticketPieces(t), 0);

  function toggleTicket(id) {
    setSelected(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  }

  function selectAll() {
    setSelected(tickets.map(t => t.id));
  }

  function clearAll() {
    setSelected([]);
  }

  async function handleCreate() {
    if (!weight || !selected.length || saving) return;
    setSaving(true);
    setError("");

    try {
      const n = await nextId("shipment");
      const id = padId(n, "ENV-");

      const allInventory = await dbGetAll(COL.inventory, "createdAt", "desc");
      const allItems = allInventory.filter(item => selectedTickets.some(t => item.ticketDocId === t.id));
      if (!allItems.length) {
        throw new Error("No se encontraron piezas de inventario vinculadas a los tickets seleccionados.");
      }

      const normalizedItems = allItems.map(item => ({
        ...item,
        costUSD: Number(item.costoUSD ?? item.costUSD ?? 0) || 0,
      }));
      const withFreight = applyShipmentCost(normalizedItems, fCost.total);

      for (const item of withFreight) {
        const sourceTicket = selectedTickets.find(t => t.id === item.ticketDocId);
        const ticketRate = Number(leer(sourceTicket, "tipoCambio", "exchangeRate", 0)) || 0;
        const itemRate = ticketRate || Number(item.tipoCambio ?? item.exchangeRate ?? 0) || STORE_CONFIG.exchangeRate;
        const finalMXN = toMXN(item.finalCostUSD, itemRate);
        await dbUpdate(COL.inventory, item.id, {
          fletePorPrendaUSD: item.freightUSD,
          costoTotalUSD: item.finalCostUSD,
          costoMXN: finalMXN,
          esProvisional: false,
          ubicacion: item.ubicacion === "usa" ? "en_transito" : item.ubicacion,
          tipoCambio: itemRate,
          freightUSD: item.freightUSD,
          finalCostUSD: item.finalCostUSD,
          finalCostMXN: finalMXN,
          exchangeRate: itemRate,
          isProvisional: false,
          shipmentId: id,
        });
      }

      for (const t of selectedTickets) {
        await dbUpdate(COL.tickets, t.id, {
          estado: "complete",
          status: "complete",
          shipmentId: id,
        });
      }

      await dbCreate(COL.envios, id, {
        shipmentId: id,
        weightLbs: weight,
        insurance: fCost.insurance,
        freight: fCost.freight,
        rate: fCost.rate,
        totalCostUSD: fCost.total,
        ticketIds: selected,
        totalItems: allItems.length,
        applied: true,
        exchangeRate: selectedTickets.length === 1
          ? (Number(leer(selectedTickets[0], "tipoCambio", "exchangeRate", STORE_CONFIG.exchangeRate)) || STORE_CONFIG.exchangeRate)
          : null,
      });

      onCreated?.(`Se actualizo el costo final de ${allItems.length} pieza(s) en ${selectedTickets.length} ticket(s).`);
    } catch (err) {
      setError(err?.message || "No se pudo aplicar el envio.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading message="Cargando tickets disponibles..." />;

  if (step === "tickets") {
    return (
      <div style={{ padding:"0 16px 32px" }}>
        <TopBar title="Nuevo Envio" subtitle="Paso 1 - Que tickets van en este envio?" onBack={onBack} />
        <div style={{ padding:"20px 0 0" }}>
          <InfoBox type="info">
            Selecciona todos los tickets que llegaron en este mismo envio. El flete se repartira entre todos sus productos.
          </InfoBox>
          <InfoBox type="terra">
            Si un envio fue borrado en Firebase pero el ticket o sus piezas conservaron `shipmentId`, aqui volvera a aparecer para recuperarlo y reaplicar costos.
          </InfoBox>

          {tickets.length === 0 ? (
            <Card style={{ textAlign:"center", padding:"32px 20px" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
              <div style={{ fontSize:15, fontWeight:700, color:C.black, marginBottom:6, fontFamily:FONT.display }}>
                Sin tickets disponibles
              </div>
              <div style={{ fontSize:13, color:C.muted, lineHeight:1.6 }}>
                Para registrar un envio necesitas tickets pendientes de envio o tickets recuperables. Si ya aparecen en verde como completos, ese envio ya fue aplicado.
              </div>
            </Card>
          ) : (
            <>
              <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                <button onClick={selectAll} style={{ flex:1, padding:"9px", background:C.black, color:C.white, border:"none", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  Seleccionar todos
                </button>
                <button onClick={clearAll} style={{ flex:1, padding:"9px", background:C.white, color:C.black, border:`1.5px solid ${C.border}`, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  Limpiar seleccion
                </button>
              </div>

              {tickets.map(t => {
                const isSelected = selected.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTicket(t.id)}
                    style={{
                      width:"100%",
                      textAlign:"left",
                      marginBottom:10,
                      padding:"16px 18px",
                      background:isSelected ? C.black : C.white,
                      border:`2px solid ${isSelected ? C.black : C.border}`,
                      cursor:"pointer",
                      display:"flex",
                      justifyContent:"space-between",
                      alignItems:"center",
                      transition:"all .15s",
                    }}
                  >
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:isSelected ? C.white : C.black }}>
                        {ticketLabel(t)}
                      </div>
                      <div style={{ fontSize:12, color:isSelected ? "rgba(255,255,255,0.7)" : C.muted, marginTop:2 }}>
                        {ticketPieces(t)} piezas · {ticketMethod(t) === "individual" ? "Individual" : "Por lote"}
                        {ticketNotes(t) ? ` · ${ticketNotes(t)}` : ""}
                      </div>
                      <div style={{ fontSize:12, color:isSelected ? "rgba(255,255,255,0.6)" : C.muted }}>
                        Creado: {t.createdAt?.slice(0, 10)}
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                      <div style={{ fontSize:22 }}>{isSelected ? "☑" : "☐"}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:isSelected ? "rgba(255,255,255,0.9)" : C.terra }}>
                        ${ticketCostUSD(t).toFixed(2)} USD
                      </div>
                    </div>
                  </button>
                );
              })}

              {selected.length > 0 && (
                <Card style={{ background:C.okFade, borderLeft:`3px solid ${C.ok}`, padding:"12px 14px", marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.ok }}>
                    {selected.length} ticket{selected.length > 1 ? "s" : ""} seleccionado{selected.length > 1 ? "s" : ""}
                  </div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                    {totalSelectedPcs} piezas en total
                  </div>
                </Card>
              )}

              <Btn
                label={selected.length > 0 ? `Continuar con ${selected.length} ticket${selected.length > 1 ? "s" : ""}` : "Selecciona al menos un ticket"}
                onClick={() => setStep("freight")}
                disabled={selected.length === 0}
              />
              <SecondaryButton label="Cancelar" onClick={onBack} />
            </>
          )}
          {tickets.length === 0 && <SecondaryButton label="Cancelar" onClick={onBack} />}
        </div>
      </div>
    );
  }

  if (step === "freight") {
    return (
      <div style={{ padding:"0 16px 32px" }}>
        <TopBar title="Nuevo Envio" subtitle="Paso 2 - Datos del flete" onBack={() => setStep("tickets")} />
        <div style={{ padding:"20px 0 0" }}>
          <Card style={{ marginBottom:16, background:C.stone, padding:"12px 14px" }}>
            <div style={{ fontSize:12, color:C.muted }}>Tickets seleccionados</div>
            <div style={{ fontSize:14, fontWeight:700, color:C.black, marginTop:4 }}>
              {selectedTickets.map(ticketLabel).join(", ")}
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{totalSelectedPcs} piezas totales</div>
          </Card>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:6, letterSpacing:1.5, textTransform:"uppercase" }}>
              Peso total de las cajas (libras) *
            </div>
            <input
              value={weightLbs}
              onChange={e => setWeightLbs(e.target.value)}
              type="number"
              step="0.1"
              placeholder="Ej: 120"
              style={{ width:"100%", boxSizing:"border-box", padding:"14px 16px", border:`1.5px solid ${C.border}`, fontSize:18, fontWeight:700, outline:"none", background:C.white, color:C.terra, fontFamily:FONT.body }}
            />
            {weight > 0 && (
              <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>
                {weight > FREIGHT.threshold
                  ? `Mas de ${FREIGHT.threshold} lb -> tarifa $${FREIGHT.rateHigh}/lb`
                  : `${FREIGHT.threshold} lb o menos -> tarifa $${FREIGHT.rateLow}/lb`}
              </div>
            )}
          </div>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:8, letterSpacing:1.5, textTransform:"uppercase" }}>
              Aseguranza
            </div>
            <div style={{ display:"flex", gap:10 }}>
              {[10, 20].map(val => (
                <button
                  key={val}
                  onClick={() => setInsurance(val)}
                  style={{
                    flex:1,
                    padding:"14px",
                    border:`2px solid ${insurance === val ? C.black : C.border}`,
                    background:insurance === val ? C.black : C.white,
                    color:insurance === val ? C.white : C.black,
                    fontSize:14,
                    fontWeight:700,
                    cursor:"pointer",
                    transition:"all .15s",
                  }}
                >
                  ${val} USD
                  <div style={{ fontSize:10, fontWeight:400, marginTop:4, color:insurance === val ? "rgba(255,255,255,0.7)" : C.muted }}>
                    {val === 10 ? "Cobertura basica" : "Cobertura extendida"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {weight > 0 && (
            <Card style={{ marginBottom:16, background:C.terraL, padding:"14px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.terraD, marginBottom:10 }}>
                Calculo del flete
              </div>
              {[
                ["Peso", `${weight} lb`],
                ["Tarifa", `$${fCost.rate}/lb ${weight > FREIGHT.threshold ? "(>100 lb)" : "(<=100 lb)"}`],
                ["Flete", `$${fCost.freight.toFixed(2)} USD`],
                ["Aseguranza", `$${fCost.insurance} USD`],
              ].map(([l, v]) => (
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
                <div style={{ fontSize:12, color:C.muted }}>Promedio visual por pieza</div>
                <div style={{ fontSize:13, fontWeight:700, color:C.black, marginTop:2 }}>
                  ${totalSelectedPcs > 0 ? (fCost.total / totalSelectedPcs).toFixed(4) : "0.0000"} USD/pza
                </div>
                <div style={{ fontSize:11, color:C.muted, marginTop:2, lineHeight:1.5 }}>
                  Este numero es solo una referencia. El reparto real del flete se hace por valor: las piezas mas caras absorben mas y las mas baratas menos.
                </div>
              </div>
            </Card>
          )}

          <Btn label={weight > 0 ? "Revisar y confirmar" : "Ingresa el peso para continuar"} onClick={() => setStep("confirm")} disabled={!weight} />
          <SecondaryButton label="Cancelar" onClick={onBack} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:"0 16px 32px" }}>
      <TopBar title="Nuevo Envio" subtitle="Paso 3 - Confirmar" onBack={() => setStep("freight")} />
      <div style={{ padding:"20px 0 0" }}>
        {error && <InfoBox type="danger">{error}</InfoBox>}
        <InfoBox type="warn">
          Al confirmar, el sistema actualizara el costo final de las <strong>{totalSelectedPcs} piezas</strong> de estos tickets.
        </InfoBox>

        <Card style={{ marginBottom:14, padding:"14px" }}>
          <SectionTitle small>Resumen del envio</SectionTitle>
          {[
            ["Tickets incluidos", selectedTickets.map(ticketLabel).join(", ")],
            ["Total de piezas", `${totalSelectedPcs}`],
            ["Peso total", `${weight} lb`],
            ["Tarifa aplicada", `$${fCost.rate}/lb ${weight > FREIGHT.threshold ? "(>100 lb)" : "(<=100 lb)"}`],
            ["Flete", `$${fCost.freight.toFixed(2)} USD`],
            ["Aseguranza", `$${fCost.insurance} USD`],
            ["Total flete", `$${fCost.total.toFixed(2)} USD`],
            ["Promedio visual por pieza", `$${totalSelectedPcs > 0 ? (fCost.total / totalSelectedPcs).toFixed(4) : "0"} USD`],
          ].map(([l, v]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.muted }}>{l}</span>
              <span style={{ fontSize:12, fontWeight:700, color:C.black }}>{v}</span>
            </div>
          ))}
        </Card>

        <InfoBox type="info">
          El promedio por pieza es solo una referencia visual. El sistema reparte el flete por valor del producto, no igual para todos.
        </InfoBox>

        <Card style={{ marginBottom:20, background:C.okFade, borderLeft:`3px solid ${C.ok}`, padding:"12px 14px" }}>
          <div style={{ fontSize:12, color:C.ok, fontWeight:700, marginBottom:4 }}>
            Despues de confirmar:
          </div>
          <div style={{ fontSize:12, color:C.black, lineHeight:1.7 }}>
            - Los {totalSelectedPcs} productos pasan a costo completo<br />
            - Se descarta el costo provisional<br />
            - Los tickets quedan marcados como completos
          </div>
        </Card>

        <Btn
          label={saving ? "Aplicando envio..." : `Confirmar envio con ${totalSelectedPcs} piezas`}
          onClick={handleCreate}
          disabled={saving}
          color={C.ok}
        />
        <SecondaryButton label="Cancelar" onClick={onBack} />
      </div>
    </div>
  );
}

export function ShipmentsScreen({ onBack }) {
  const [view, setView] = useState("list");
  const [flash, setFlash] = useState("");

  if (view === "new") {
    return <NewShipment onBack={() => setView("list")} onCreated={(message) => { setFlash(message || "Envio aplicado correctamente."); setView("list"); }} />;
  }

  return (
    <div style={{ background:C.cream, minHeight:"100%" }}>
      {flash && (
        <div style={{ padding:"12px 16px 0" }}>
          <InfoBox type="ok">{flash}</InfoBox>
        </div>
      )}
      <ShipmentList onNew={() => { setFlash(""); setView("new"); }} onBack={onBack} onOpen={() => {}} />
    </div>
  );
}
