import { FREIGHT, STORE_CONFIG } from "./config.js";

// ─── HELPERS ──────────────────────────────────────────────
export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;

  const raw = String(value).trim();
  if (!raw) return 0;

  const clean = raw.replace(/[$\s]/g, "");
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  let normalized = clean;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? clean.replace(/\./g, "").replace(",", ".")
      : clean.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = clean.replace(",", ".");
  }

  normalized = normalized.replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function allocateProportional(total, weights) {
  const safeTotal = round2(Number(total) || 0);
  if (!weights.length) return [];

  const normalized = weights.map(w => Number(w) || 0);
  const sumWeights = normalized.reduce((a, b) => a + b, 0);
  if (sumWeights <= 0) {
    const even = safeTotal / weights.length;
    let remaining = safeTotal;
    return weights.map((_, idx) => {
      const value = idx === weights.length - 1 ? round2(remaining) : round2(even);
      remaining = round2(remaining - value);
      return value;
    });
  }

  let remaining = safeTotal;
  return normalized.map((weight, idx) => {
    if (idx === normalized.length - 1) return round2(remaining);
    const value = round2(safeTotal * (weight / sumWeights));
    remaining = round2(remaining - value);
    return value;
  });
}

// ─── 1. COSTEO INDIVIDUAL ─────────────────────────────────
// Cada línea tiene: descripción, cantidad, costo unitario USD.
// Los gastos extras (bolsa, otros) se capturan UNA SOLA VEZ
// a nivel de ticket y se prorratean por valor entre todas las piezas.
//
// detail = {
//   lines: [{ descr, qty, unitCost, cat }],
//   ticketOtherCosts: number,   // bolsa + otros gastos del ticket (total)
//   taxMode: "pct" | "fixed",
//   taxPct: number,
//   taxFixed: number,
// }
//
// Retorna: [{ ...line, subtotal, taxAmt, otherAmt, totalCostLine, costUSD }]
export function costIndividual(detail) {
  const lines = detail.lines || [];
  if (!lines.length) return [];

  // Subtotal por línea = qty × unitCost
  const withSub = lines.map(l => ({
    ...l,
    qty:      toNumber(l.qty),
    unitCost: toNumber(l.unitCost),
    subtotal: toNumber(l.qty) * toNumber(l.unitCost),
  }));

  const totalSubtotal = withSub.reduce((a, l) => a + l.subtotal, 0);

  // Impuestos sobre el subtotal total
  let totalTax = 0;
  if (detail.taxMode === "pct") {
    totalTax = totalSubtotal * (toNumber(detail.taxPct) / 100);
  } else {
    totalTax = toNumber(detail.taxFixed);
  }

  // Otros gastos del ticket (bolsa, etc.) — UN SOLO MONTO para todo el ticket
  const totalOther = toNumber(detail.ticketOtherCosts);

  // Prorrateo por valor (peso = subtotal de la línea / total del ticket)
  const weights = withSub.map(l => totalSubtotal > 0 ? l.subtotal / totalSubtotal : 1 / withSub.length);
  const allocatedTax = allocateProportional(totalTax, weights);
  const allocatedOther = allocateProportional(totalOther, weights);

  return withSub.map((l, idx) => {
    const weight = weights[idx];
    const taxAmt = allocatedTax[idx] || 0;
    const otherAmt = allocatedOther[idx] || 0;
    const totalCostLine = round2(l.subtotal + taxAmt + otherAmt);
    const costUSD       = l.qty > 0 ? round2(totalCostLine / l.qty) : 0;

    return {
      ...l,
      weight:        round2(weight * 100),   // % del ticket
      taxAmt,
      otherAmt,
      totalCostLine,
      costUSD,                               // costo provisional por pieza
    };
  });
}

// ─── 2. COSTEO POR LOTE ───────────────────────────────────
// detail = {
//   totalPieces: number,
//   ticketCost: number,          // costo total del ticket
//   ticketOtherCosts: number,    // otros gastos (bolsa, etc.) total
//   taxMode: "pct" | "fixed",
//   taxPct: number,
//   taxFixed: number,
// }
export function costLote(detail) {
  const qty  = toNumber(detail.totalPieces) || 1;
  const base = toNumber(detail.ticketCost);

  let tax = 0;
  if (detail.taxMode === "pct") {
    tax = base * (toNumber(detail.taxPct) / 100);
  } else {
    tax = toNumber(detail.taxFixed);
  }

  const other = toNumber(detail.ticketOtherCosts);
  const total = base + tax + other;

  return {
    totalPieces: qty,
    ticketCost:  round2(base),
    taxAmt:      round2(tax),
    otherAmt:    round2(other),
    totalCost:   round2(total),
    costUSD:     round2(total / qty),
  };
}

// ─── 3. COSTO DE ENVÍO ────────────────────────────────────
export function calcShipmentCost(shipment) {
  const w         = Number(shipment.weightLbs) || 0;
  const rate      = w > FREIGHT.threshold ? FREIGHT.rateHigh : FREIGHT.rateLow;
  const freight   = round2(w * rate);
  const insurance = Number(shipment.insurance) || FREIGHT.insurance1;
  const total     = round2(freight + insurance);
  return { weightLbs:w, rate, freight, insurance, total };
}

// ─── 4. PRORRATEO DEL ENVÍO ───────────────────────────────
// Distribuye el flete entre todos los items ponderado por costo base.
export function applyShipmentCost(items, shipmentCostUSD) {
  if (!items.length) return items;
  if (!shipmentCostUSD) return items.map(i => ({
    ...i,
    freightUSD:   0,
    finalCostUSD: round2(i.costUSD || 0),
  }));

  const totalValue = items.reduce((a, i) => a + (Number(i.costUSD) || 0), 0);

  return items.map(i => {
    const weight     = totalValue > 0
      ? (Number(i.costUSD) || 0) / totalValue
      : 1 / items.length;
    const freightUSD = round2(shipmentCostUSD * weight);
    return {
      ...i,
      freightUSD,
      finalCostUSD: round2((Number(i.costUSD) || 0) + freightUSD),
    };
  });
}

// ─── 5. CONVERSIÓN USD → MXN ─────────────────────────────
export function toMXN(usd, rate) {
  const r = Number(rate) || STORE_CONFIG.exchangeRate;
  return round2(Number(usd) * r);
}

// ─── 6. PRECIO SUGERIDO ───────────────────────────────────
export function suggestedPrice(finalCostMXN, margin = 2.0) {
  return round2(Number(finalCostMXN) * margin);
}

// ─── 7. RESUMEN COMPLETO POR PIEZA ───────────────────────
export function buildCostSummary(item, exchangeRate) {
  const rate         = Number(exchangeRate) || STORE_CONFIG.exchangeRate;
  const costUSD      = Number(item.costUSD)      || 0;
  const freightUSD   = Number(item.freightUSD)   || 0;
  const finalCostUSD = Number(item.finalCostUSD) || costUSD;
  const finalCostMXN = toMXN(finalCostUSD, rate);

  return {
    costUSD:       round2(costUSD),
    freightUSD:    round2(freightUSD),
    finalCostUSD:  round2(finalCostUSD),
    finalCostMXN,
    exchangeRate:  rate,
    suggestedMXN:  suggestedPrice(finalCostMXN),
    isProvisional: freightUSD === 0,
  };
}

// ─── 8. VALIDACIÓN ───────────────────────────────────────
export function validateTicketLines(lines) {
  const errors = [];
  lines.forEach((l, i) => {
    if (!l.descr) errors.push(`Línea ${i+1}: falta la descripción`);
    if (!(toNumber(l.qty) > 0)) errors.push(`Línea ${i+1}: la cantidad debe ser mayor a 0`);
    if (!(toNumber(l.unitCost) > 0)) errors.push(`Línea ${i+1}: el costo unitario debe ser mayor a 0`);
  });
  return errors;
}
