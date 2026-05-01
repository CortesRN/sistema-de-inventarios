import { FB_CONFIG, COL } from "./config.js";

// ─── FIREBASE SINGLETON ───────────────────────────────────
let _db   = null;
let _fb   = null;
let _auth = null;
let _authApi = null;
let _ready = false;

export async function initFirebase() {
  if (_ready) return { db: _db, fb: _fb, auth: _auth, authApi: _authApi };
  try {
    const { initializeApp, getApps } =
      await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js");
    const fs =
      await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js");
    const authApi =
      await import("https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js");

    const app = getApps().length ? getApps()[0] : initializeApp(FB_CONFIG);
    _db  = fs.getFirestore(app);
    _fb  = fs;
    _auth = authApi.getAuth(app);
    _authApi = authApi;
    await authApi.setPersistence(_auth, authApi.browserLocalPersistence);
    _ready = true;
    return { db: _db, fb: _fb, auth: _auth, authApi: _authApi };
  } catch (e) {
    console.error("Firebase init error:", e);
    throw e;
  }
}

export async function adminSignIn(email, password) {
  const { auth, authApi } = await initFirebase();
  return authApi.signInWithEmailAndPassword(auth, email, password);
}

export async function adminSignOut() {
  const { auth, authApi } = await initFirebase();
  return authApi.signOut(auth);
}

export async function onAdminAuthChanged(cb) {
  const { auth, authApi } = await initFirebase();
  return authApi.onAuthStateChanged(auth, cb);
}

// ─── COUNTER (IDs secuenciales) ───────────────────────────
// Usa transacción para garantizar unicidad
export async function nextId(name) {
  const { db, fb } = await initFirebase();
  const ref = fb.doc(db, COL.contadores, name);
  let next;
  await fb.runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    next = (snap.exists() ? snap.data().value : 0) + 1;
    tx.set(ref, { value: next });
  });
  return next;
}

export function padId(n, prefix="", digits=6) {
  return `${prefix}${String(n).padStart(digits,"0")}`;
}

// ─── CRUD GENÉRICO ────────────────────────────────────────
export async function dbAdd(col, data) {
  const { db, fb } = await initFirebase();
  const ref = await fb.addDoc(fb.collection(db, col), {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function dbCreate(col, id, data) {
  const { db, fb } = await initFirebase();
  await fb.setDoc(fb.doc(db, col, id), {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return id;
}

export async function dbSet(col, id, data) {
  const { db, fb } = await initFirebase();
  await fb.setDoc(fb.doc(db, col, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function dbUpdate(col, id, data) {
  const { db, fb } = await initFirebase();
  await fb.updateDoc(fb.doc(db, col, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function dbDelete(col, id) {
  const { db, fb } = await initFirebase();
  await fb.deleteDoc(fb.doc(db, col, id));
}

export async function dbGetAll(col, orderField="createdAt", dir="desc") {
  const { db, fb } = await initFirebase();
  const q = fb.query(
    fb.collection(db, col),
    fb.orderBy(orderField, dir)
  );
  const snap = await fb.getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function dbGet(col, id) {
  const { db, fb } = await initFirebase();
  const snap = await fb.getDoc(fb.doc(db, col, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function dbWhere(col, field, op, value) {
  const { db, fb } = await initFirebase();
  const q = fb.query(
    fb.collection(db, col),
    fb.where(field, op, value),
    fb.orderBy("createdAt", "desc")
  );
  const snap = await fb.getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function dbListen(col, cb, orderField="createdAt", dir="desc") {
  let unsub = () => {};
  initFirebase().then(({ db, fb }) => {
    const q = fb.query(
      fb.collection(db, col),
      fb.orderBy(orderField, dir)
    );
    unsub = fb.onSnapshot(q, snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  });
  return () => unsub();
}

// ─── TIPO DE CAMBIO (API gratuita) ────────────────────────
export async function fetchExchangeRate() {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const d = await r.json();
    return d.rates?.MXN || null;
  } catch {
    return null;
  }
}
