// ─── FIREBASE CONFIG ──────────────────────────────────────
export const FB_CONFIG = {
  apiKey:            "AIzaSyDejeBSPWJtFXLGhki-apCCPq0C5iL0FR4",
  authDomain:        "casi-store.firebaseapp.com",
  projectId:         "casi-store",
  storageBucket:     "casi-store.firebasestorage.app",
  messagingSenderId: "656646363088",
  appId:             "1:656646363088:web:1c22dcc1aafd95f1594bd5",
};

// ─── STORE CONFIG ─────────────────────────────────────────
export const STORE_CONFIG = {
  name:        "CASI",
  ownerPhone:  "2067080497",   // ← Cambia por tu número real
  ownerName:   "Natanael Cortes", // ← Cambia por tu nombre real
  clabe:       "012345678901234567", // ← Cambia por tu CLABE real
  bank:        "BBVA",
  adminPin:    "2829",         // ← 
  exchangeRate: 17.70,         // ← Tipo de cambio base (USD→MXN)
  exchangeBuffer: 0.50,        // ← colchón de .50 por arriba del dólar
};

// ─── ZONAS DE ENTREGA ─────────────────────────────────────
export const ZONES = [
  { id:1, name:"Santa Catarina Loxicha",        maxKm:5,   price:10,  time:"Mismo día",        days:"Lun–Sáb",  active:true  },//personalizar
  { id:2, name:"Ruta SCL-Miahuatlan", maxKm:20,  price:10,  time:" Al día siguiente",        days:"Lun–Sáb",  active:true  },
  { id:3, name:"Ruta SCL-Puerto Escondido", maxKm:40,  price:40,  time:"Al día siguiente", days:"Mar y Jue", active:true  },
  { id:4, name:"Ruta SCL-San Mateo Rio Hondo",    maxKm:100, price:null, time:"Próximamente",    days:"—",         active:false },
];

// ─── GPS BASE ─────────────────────────────────────────────
export const BASE_COORDS = { lat: 16.58, lng: -97.52 };

// ─── COLECCIONES FIREBASE ─────────────────────────────────
export const COL = {
  tickets:   "tickets",
  inventory: "inventory",
  shipments: "shipments",
  orders:    "orders",
  products:  "products",   // catálogo público tienda
  vendors:   "vendors",
  drivers:   "drivers",
  counters:  "counters",
  config:    "config",
};

// ─── ESTADOS ──────────────────────────────────────────────
export const TICKET_STATUS = {
  draft:     { label:"Borrador",         color:"#9A8070", bg:"#F5F0EA" },
  costed:    { label:"Costeo provisional",color:"#B85A00", bg:"#FFF0D4" },
  complete:  { label:"Costo completo",   color:"#1A7A3A", bg:"#D4EDDA" },
};

export const INVENTORY_STATUS = {
  in_warehouse: { label:"En bodega",        color:"#1A5A8A", bg:"#D4E8F5", e:"📦" },
  for_sale:     { label:"En venta",         color:"#1A7A3A", bg:"#D4EDDA", e:"🛍️" },
  sold:         { label:"Vendido",          color:"#7C3AED", bg:"#EDE9FE", e:"✅" },
  reserved:     { label:"Reservado",        color:"#B85A00", bg:"#FFF0D4", e:"⏳" },
};

export const ORDER_STATUS = {
  nuevo:       { label:"Nuevo",            color:"#B85A00", bg:"#FFF0D4", e:"🔔" },
  verificando: { label:"Verificando pago", color:"#7C3AED", bg:"#EDE9FE", e:"⏳" },
  confirmado:  { label:"Confirmado",       color:"#1A5A8A", bg:"#D4E8F5", e:"✅" },
  preparando:  { label:"Preparando",       color:"#0891B2", bg:"#CFFAFE", e:"📦" },
  en_ruta:     { label:"En camino",        color:"#C4622D", bg:"#FCF0E8", e:"🛵" },
  entregado:   { label:"Entregado",        color:"#1A7A3A", bg:"#D4EDDA", e:"🏠" },
  cancelado:   { label:"Cancelado",        color:"#C0392B", bg:"#FDECEA", e:"❌" },
};

// ─── CATEGORÍAS ───────────────────────────────────────────
export const CATS = [
  "Ropa","Calzado","Electrónicos","Accesorios","Deportes","Juguetes","Otro"
];

// ─── FLETE ────────────────────────────────────────────────
export const FREIGHT = {
  rateHigh:    2.40,  // USD/lb cuando peso > 100 lb
  rateLow:     3.00,  // USD/lb cuando peso ≤ 100 lb
  threshold:   100,   // lb
  insurance1:  10,    // USD opción 1
  insurance2:  20,    // USD opción 2
};
