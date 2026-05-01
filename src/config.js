function envText(key, fallback = "") {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function envNumber(key, fallback) {
  const raw = envText(key, "");
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(key, fallback = false) {
  const raw = envText(key, "");
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function envList(key) {
  return envText(key, "")
    .split(",")
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
}

// Variables de entorno recomendadas para produccion:
// - VITE_ENABLE_ADMIN_AUTH
// - VITE_ADMIN_EMAILS
// - VITE_OWNER_PHONE / VITE_OWNER_NAME
// - VITE_BANK_NAME / VITE_BANK_CLABE
// - VITE_BASE_EXCHANGE_RATE / VITE_EXCHANGE_BUFFER
// - VITE_FIREBASE_*
//
// La config web de Firebase no es secreta por si misma.
// La seguridad real depende de Firebase Auth y Firestore Rules.

// FIREBASE CONFIG
export const FB_CONFIG = {
  apiKey:            envText("VITE_FIREBASE_API_KEY", "AIzaSyDejeBSPWJtFXLGhki-apCCPq0C5iL0FR4"),
  authDomain:        envText("VITE_FIREBASE_AUTH_DOMAIN", "casi-store.firebaseapp.com"),
  projectId:         envText("VITE_FIREBASE_PROJECT_ID", "casi-store"),
  storageBucket:     envText("VITE_FIREBASE_STORAGE_BUCKET", "casi-store.firebasestorage.app"),
  messagingSenderId: envText("VITE_FIREBASE_MESSAGING_SENDER_ID", "656646363088"),
  appId:             envText("VITE_FIREBASE_APP_ID", "1:656646363088:web:1c22dcc1aafd95f1594bd5"),
};

// CONFIGURACION DE LA TIENDA
export const STORE_CONFIG = {
  name:           "CASI",
  adminAuthEnabled: envBool("VITE_ENABLE_ADMIN_AUTH", false),
  adminEmails:    envList("VITE_ADMIN_EMAILS"),
  ownerPhone:     envText("VITE_OWNER_PHONE", "2067080497"),
  ownerName:      envText("VITE_OWNER_NAME", "Natanael Cortes"),
  clabe:          envText("VITE_BANK_CLABE", ""),
  bank:           envText("VITE_BANK_NAME", ""),
  exchangeRate:   envNumber("VITE_BASE_EXCHANGE_RATE", 17.70),
  exchangeBuffer: envNumber("VITE_EXCHANGE_BUFFER", 0.50),
};

// ZONAS DE ENTREGA
export const ZONES = [
  { id:1, name:"Santa Catarina Loxicha", maxKm:5, price:10, time:"Mismo dia", days:"Lun-Sab", active:true },
  { id:2, name:"Ruta SCL-Miahuatlan", maxKm:20, price:10, time:"Al dia siguiente", days:"Lun-Sab", active:true },
  { id:3, name:"Ruta SCL-Puerto Escondido", maxKm:40, price:40, time:"Al dia siguiente", days:"Mar y Jue", active:true },
  { id:4, name:"Ruta SCL-San Mateo Rio Hondo", maxKm:100, price:null, time:"Proximamente", days:"-", active:false },
];

// GPS BASE
export const BASE_COORDS = { lat: 16.58, lng: -97.52 };

// COLECCIONES FIREBASE
export const COL = {
  tickets:      "tickets",
  inventario:   "inventario",
  envios:       "envios",
  pedidos:      "orders",
  ventas:       "ventas",
  vendedores:   "vendors",
  repartidores: "drivers",
  contadores:   "contadores",
  config:       "config",
  gastos:       "gastos",
  // Compatibilidad con firebase.js (no renombrar)
  counters:     "counters",
  inventory:    "inventario",
  orders:       "orders",
};

// CATEGORIAS DE PRODUCTO
export const CATEGORIAS = [
  "Ropa",
  "Calzado",
  "Accesorios",
  "Juguetes",
  "Electronicos",
  "Decoracion",
  "Hogar",
  "Deportes",
  "Libros",
  "Otro",
];

// GENEROS
export const GENEROS = [
  "Mujer",
  "Hombre",
  "Nina",
  "Nino",
  "Unisex",
];

// CONDICION DE LA PRENDA
export const CONDICIONES = [
  { value:"excelente", label:"Excelente - como nueva, sin defectos" },
  { value:"buena", label:"Buena - uso minimo, sin danos visibles" },
  { value:"regular", label:"Regular - uso notable, pequenos detalles" },
];

// UBICACIONES
export const UBICACIONES = [
  { value:"usa", label:"Estados Unidos - sin envio asignado" },
  { value:"en_transito", label:"En transito - envio registrado, en camino" },
  { value:"bodega_scl", label:"Bodega Santa Catarina Loxicha" },
  { value:"bodega_mia", label:"Bodega Miahuatlan" },
];

// ESTADOS DEL TICKET
export const TICKET_STATUS = {
  draft:    { label:"Borrador", color:"#9A8070", bg:"#F5F0EA" },
  costed:   { label:"Costeo provisional", color:"#B85A00", bg:"#FFF0D4" },
  complete: { label:"Costo completo", color:"#1A7A3A", bg:"#D4EDDA" },
};

// ESTADOS DEL INVENTARIO
export const INVENTORY_STATUS = {
  en_bodega:  { label:"En bodega", color:"#1A5A8A", bg:"#D4E8F5", e:"📦" },
  disponible: { label:"Disponible", color:"#0F766E", bg:"#CCFBF1", e:"🧾" },
  en_venta:   { label:"En venta", color:"#1A7A3A", bg:"#D4EDDA", e:"🛍️" },
  vendido:    { label:"Vendido", color:"#7C3AED", bg:"#EDE9FE", e:"✅" },
  reservado:  { label:"Reservado", color:"#B85A00", bg:"#FFF0D4", e:"⏳" },
};

// ESTADOS DEL PEDIDO
export const ORDER_STATUS = {
  nuevo:       { label:"Nuevo", color:"#B85A00", bg:"#FFF0D4", e:"🔔" },
  verificando: { label:"Verificando pago", color:"#7C3AED", bg:"#EDE9FE", e:"⏳" },
  confirmado:  { label:"Confirmado", color:"#1A5A8A", bg:"#D4E8F5", e:"✅" },
  preparando:  { label:"Preparando", color:"#0891B2", bg:"#CFFAFE", e:"📦" },
  en_ruta:     { label:"En camino", color:"#C4622D", bg:"#FCF0E8", e:"🛵" },
  entregado:   { label:"Entregado", color:"#1A7A3A", bg:"#D4EDDA", e:"🏠" },
  cancelado:   { label:"Cancelado", color:"#C0392B", bg:"#FDECEA", e:"❌" },
};

// FLETE USA
export const FLETE = {
  tarifaAlta:  2.40,
  tarifaBaja:  3.00,
  umbral:      100,
  seguro1:     10,
  seguro2:     20,
};

// COMPATIBILIDAD
export const CATS = CATEGORIAS;
export const FREIGHT = {
  rateHigh:   2.40,
  rateLow:    3.00,
  threshold:  100,
  insurance1: 10,
  insurance2: 20,
};
