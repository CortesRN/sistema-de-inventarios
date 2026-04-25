// ─── FIREBASE CONFIG ──────────────────────────────────────
export const FB_CONFIG = {
  apiKey:            "AIzaSyDejeBSPWJtFXLGhki-apCCPq0C5iL0FR4",
  authDomain:        "casi-store.firebaseapp.com",
  projectId:         "casi-store",
  storageBucket:     "casi-store.firebasestorage.app",
  messagingSenderId: "656646363088",
  appId:             "1:656646363088:web:1c22dcc1aafd95f1594bd5",
};

// ─── CONFIGURACIÓN DE LA TIENDA ───────────────────────────
export const STORE_CONFIG = {
  name:           "CASI",
  ownerPhone:     "2067080497",        // Numero de Casi (WhatsApp)
  ownerName:      "Natanael Cortes",   // Mi nombre 
  clabe:          "012345678901234567",// Clabe de coppel cambiar
  bank:           "BBVA",
  adminPin:       "1234",
  exchangeRate:   17.70,               // Tipo de cambio base (USD-MXN) usar API 
  exchangeBuffer: 0.50,                // Colchón de seguridad sobre el dólar
};

// ─── ZONAS DE ENTREGA ─────────────────────────────────────
export const ZONES = [
  { id:1, name:"Santa Catarina Loxicha",   maxKm:5,   price:10,  time:"Mismo día",        days:"Lun–Sáb", active:true  },
  { id:2, name:"Ruta SCL–Miahuatlán",      maxKm:20,  price:10,  time:"Al día siguiente", days:"Lun–Sáb", active:true  },
  { id:3, name:"Ruta SCL–Puerto Escondido",maxKm:40,  price:40,  time:"Al día siguiente", days:"Mar y Jue",active:true  },
  { id:4, name:"Ruta SCL–San Mateo Río Hondo",maxKm:100,price:null,time:"Próximamente",   days:"—",        active:false },
];

// ─── GPS BASE ─────────────────────────────────────────────
export const BASE_COORDS = { lat: 16.58, lng: -97.52 };

// ─── COLECCIONES FIREBASE ─────────────────────────────────
export const COL = {
  tickets:      "tickets",
  inventario:   "inventario",
  envios:       "envios",
  pedidos:      "orders",
  vendedores:   "vendors",
  repartidores: "drivers",
  contadores:   "contadores",
  config:       "config",
  gastos:       "gastos",
  // ── Compatibilidad con firebase.js (no renombrar) ──────
  counters:     "counters",   // usado internamente por nextId()
  inventory:    "inventario", // compatibilidad con Inventory.jsx
  orders:       "orders",     // compatibilidad con archivos no actualizados
};

// ─── CATEGORÍAS DE PRODUCTO ───────────────────────────────
export const CATEGORIAS = [
  //"Playera",  "Camisa",  "Blusa",  "Vestido",  "Pantalón",  "Short",  "Falda",  "Chamarra",  "Sudadera",  "Conjunto",  "Ropa interior",  "Calcetines",  "Tenis",  "Zapatos",
  //"Botas",  "Sandalias",  "Bolsa",  "Cinturón",  "Gorra",  "Accesorio",  "Juguete",  "Electrónico",  "Otro",
"Ropa", "Calzado", "Accesorios", "Juguetes", "Electrónicos", "Decoración", "Hogar", "Deportes", "Libros", "Otro",
];

// ─── GÉNEROS ──────────────────────────────────────────────
export const GENEROS = [
  "Mujer",
  "Hombre",
  "Niña",
  "Niño",
  "Unisex",
];

// ─── CONDICIÓN DE LA PRENDA ───────────────────────────────
export const CONDICIONES = [
  { value:"excelente", label:"Excelente — como nueva, sin defectos" },
  { value:"buena",     label:"Buena — uso mínimo, sin daños visibles" },
  { value:"regular",   label:"Regular — uso notable, pequeños detalles" },
];

// ─── UBICACIONES ──────────────────────────────────────────
export const UBICACIONES = [
  { value:"usa",           label:"🇺🇸 Estados Unidos — sin envío asignado" },
  { value:"en_transito",   label:"✈️ En tránsito — envío registrado, en camino" },
  { value:"bodega_scl",    label:"📦 Bodega Santa Catarina Loxicha" },
  { value:"bodega_mia",    label:"📦 Bodega Miahuatlán" },
  { value:"vendido",       label:"✅ Vendido" },
];

// ─── ESTADOS DEL TICKET ───────────────────────────────────
export const TICKET_STATUS = {
  draft:    { label:"Borrador",          color:"#9A8070", bg:"#F5F0EA" },
  costed:   { label:"Costeo provisional",color:"#B85A00", bg:"#FFF0D4" },
  complete: { label:"Costo completo",    color:"#1A7A3A", bg:"#D4EDDA" },
};

// ─── ESTADOS DEL INVENTARIO ───────────────────────────────
export const INVENTORY_STATUS = {
  en_bodega:  { label:"En bodega",  color:"#1A5A8A", bg:"#D4E8F5", e:"📦" },
  en_venta:   { label:"En venta",   color:"#1A7A3A", bg:"#D4EDDA", e:"🛍️" },
  vendido:    { label:"Vendido",    color:"#7C3AED", bg:"#EDE9FE", e:"✅" },
  reservado:  { label:"Reservado",  color:"#B85A00", bg:"#FFF0D4", e:"⏳" },
};

// ─── ESTADOS DEL PEDIDO ───────────────────────────────────
export const ORDER_STATUS = {
  nuevo:       { label:"Nuevo",           color:"#B85A00", bg:"#FFF0D4", e:"🔔" },
  verificando: { label:"Verificando pago",color:"#7C3AED", bg:"#EDE9FE", e:"⏳" },
  confirmado:  { label:"Confirmado",      color:"#1A5A8A", bg:"#D4E8F5", e:"✅" },
  preparando:  { label:"Preparando",      color:"#0891B2", bg:"#CFFAFE", e:"📦" },
  en_ruta:     { label:"En camino",       color:"#C4622D", bg:"#FCF0E8", e:"🛵" },
  entregado:   { label:"Entregado",       color:"#1A7A3A", bg:"#D4EDDA", e:"🏠" },
  cancelado:   { label:"Cancelado",       color:"#C0392B", bg:"#FDECEA", e:"❌" },
};

// ─── FLETE USA ────────────────────────────────────────────
export const FLETE = {
  tarifaAlta:  2.40,  // USD/lb cuando peso > 100 lb
  tarifaBaja:  3.00,  // USD/lb cuando peso ≤ 100 lb
  umbral:      100,   // lb
  seguro1:     10,    // USD opción básica
  seguro2:     20,    // USD opción completa
};

// ─── COMPATIBILIDAD — CATEGORIAS Y FLETE
export const CATS   = CATEGORIAS;
export const FREIGHT = {
  rateHigh:   2.40,
  rateLow:    3.00,
  threshold:  100,
  insurance1: 10,
  insurance2: 20,
};