import { useState } from "react";

// ─── TOKENS ───────────────────────────────────────────────
export const C = {
  black:"#0A0A0A",  white:"#FFFFFF",  cream:"#F8F4EF",
  stone:"#E8E2DA",  warm:"#C8BAA8",
  terra:"#C4622D",  terraD:"#8B3A18", terraL:"#FCF0E8",
  gold:"#D4A847",   muted:"#7A6A5A",  border:"#E5DDD5",
  ok:"#1A7A3A",     okFade:"#D4EDDA",
  info:"#1A5A8A",   infoFade:"#D4E8F5",
  warn:"#B85A00",   warnFade:"#FFF0D4",
  danger:"#C0392B", dangerFade:"#FDECEA",
  purple:"#7C3AED", purpleFade:"#EDE9FE",
  sale:"#C0392B",
};

// ─── TYPOGRAPHY ───────────────────────────────────────────
export const FONT = {
  display: "'Cormorant Garamond',serif",
  body:    "'DM Sans',sans-serif",
};

// ─── ATOMS ────────────────────────────────────────────────
export function Btn({ label, onClick, color, outline, disabled, small, icon, full=true }) {
  return (
    <button onClick={!disabled ? onClick : undefined} style={{
      padding:      small ? "9px 16px" : "14px 20px",
      width:        full  ? "100%" : "auto",
      fontSize:     small ? 12 : 13,
      fontWeight:   700,
      letterSpacing:1.5,
      textTransform:"uppercase",
      cursor:       disabled ? "not-allowed" : "pointer",
      background:   disabled ? "#CCC" : outline ? C.white : (color || C.black),
      color:        disabled ? "#999" : outline ? (color || C.black) : C.white,
      border:       outline  ? `2px solid ${color || C.black}` : "none",
      boxShadow:    (!outline && !disabled) ? "0 4px 16px rgba(0,0,0,0.2)" : "none",
      transition:   "all .2s",
      fontFamily:   FONT.body,
      display:      "flex", alignItems:"center", justifyContent:"center", gap:8,
    }}>
      {icon && <span style={{ fontSize:16, textTransform:"none" }}>{icon}</span>}
      {label}
    </button>
  );
}

export function WaBtn({ tel, msg, label, small }) {
  const url = `https://wa.me/52${tel}?text=${encodeURIComponent(msg)}`;
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{
      display:"flex", alignItems:"center", justifyContent:"center", gap:8,
      padding: small ? "8px 12px" : "13px",
      background:"#25D366", color:C.white,
      fontSize: small ? 11 : 13, fontWeight:700,
      textDecoration:"none", letterSpacing:1, textTransform:"uppercase",
      boxShadow:"0 4px 14px rgba(37,211,102,0.35)",
    }}>
      <span style={{ textTransform:"none" }}>💬</span>{label}
    </a>
  );
}

export function Inp({ label, value, onChange, placeholder, type="text", inputMode, step, hint, required, small, readOnly }) {
  return (
    <div style={{ marginBottom: small ? 10 : 16 }}>
      {label && (
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, letterSpacing:1.5, textTransform:"uppercase" }}>
          {label}{required && <span style={{ color:C.danger }}> *</span>}
        </div>
      )}
      <input
        type={type} value={value}
        inputMode={inputMode}
        step={step}
        onChange={e => !readOnly && onChange && onChange(e.target.value)}
        placeholder={placeholder} readOnly={readOnly}
        style={{
          width:"100%", boxSizing:"border-box",
          padding: small ? "9px 12px" : "12px 16px",
          border:`1.5px solid ${C.border}`,
          fontSize: small ? 12 : 13,
          outline:"none", background: readOnly ? C.cream : C.white,
          color:C.black, fontFamily:FONT.body,
        }}
      />
      {hint && <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{hint}</div>}
    </div>
  );
}

export function HelpTip({ text, title="Ayuda" }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:"relative", display:"inline-flex", alignItems:"center" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width:20, height:20, borderRadius:"50%",
          border:`1px solid ${C.border}`, background:C.white,
          color:C.muted, fontSize:11, fontWeight:800, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center",
          padding:0, lineHeight:1,
        }}
        aria-label={title}
      >
        ?
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 8px)", right:0, zIndex:40,
          width:220, background:C.white, border:`1px solid ${C.border}`,
          boxShadow:"0 8px 24px rgba(0,0,0,0.12)", padding:"10px 12px",
        }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.black, marginBottom:4 }}>{title}</div>
          <div style={{ fontSize:11, color:C.muted, lineHeight:1.5 }}>{text}</div>
        </div>
      )}
    </div>
  );
}

export function Select({ label, value, onChange, options, small, required }) {
  return (
    <div style={{ marginBottom: small ? 10 : 16 }}>
      {label && (
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, marginBottom:5, letterSpacing:1.5, textTransform:"uppercase" }}>
          {label}{required && <span style={{ color:C.danger }}> *</span>}
        </div>
      )}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width:"100%", padding: small ? "9px 12px" : "12px 16px",
          border:`1.5px solid ${C.border}`, fontSize: small ? 12 : 13,
          outline:"none", background:C.white, color:C.black, fontFamily:FONT.body }}>
        {options.map(o => (
          <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
        ))}
      </select>
    </div>
  );
}

export function Toggle({ on, onChange, label }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
      <span style={{ fontSize:13, color:C.black }}>{label}</span>
      <div onClick={() => onChange(!on)} style={{
        width:44, height:24, borderRadius:12,
        background: on ? C.ok : C.border,
        position:"relative", cursor:"pointer", transition:"background .2s",
      }}>
        <div style={{
          position:"absolute", top:3, left: on ? 23 : 3,
          width:18, height:18, borderRadius:"50%",
          background:C.white, transition:"left .2s",
          boxShadow:"0 1px 4px rgba(0,0,0,0.2)",
        }}/>
      </div>
    </div>
  );
}

export function Badge({ c, bg, label, small }) {
  return (
    <span style={{
      fontSize: small ? 9 : 10, fontWeight:700,
      padding: small ? "2px 7px" : "3px 10px",
      borderRadius:20, color:c, background:bg, whiteSpace:"nowrap",
    }}>{label}</span>
  );
}

export function Card({ children, style, onClick, pad=14 }) {
  return (
    <div onClick={onClick} style={{
      background:C.white, padding:pad,
      boxShadow:"0 2px 10px rgba(0,0,0,0.07)",
      cursor: onClick ? "pointer" : "default",
      ...style,
    }}>{children}</div>
  );
}

export function SectionTitle({ children, action, onAction, small }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      marginBottom:10, borderBottom:`1px solid ${C.border}`, paddingBottom:8 }}>
      <span style={{
        fontSize: small ? 12 : 14, fontWeight:700, color:C.black,
        fontFamily:FONT.display, letterSpacing:.5,
      }}>{children}</span>
      {action && (
        <button onClick={onAction} style={{ fontSize:12, color:C.terra, background:"none",
          border:"none", cursor:"pointer", fontWeight:700, letterSpacing:1, textTransform:"uppercase" }}>
          {action}
        </button>
      )}
    </div>
  );
}

export function TopBar({ title, subtitle, onBack, right }) {
  return (
    <div style={{
      position:"sticky", top:0, zIndex:30,
      background:"rgba(248,244,239,0.97)", backdropFilter:"blur(8px)",
      padding:"12px 16px", borderBottom:`1px solid ${C.border}`,
      display:"flex", justifyContent:"space-between", alignItems:"center",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {onBack && (
          <button onClick={onBack} style={{ background:C.black, border:"none", width:34, height:34,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            color:C.white, fontSize:18 }}>←</button>
        )}
        <div>
          <div style={{ fontSize:16, fontWeight:900, color:C.black, fontFamily:FONT.display }}>{title}</div>
          {subtitle && <div style={{ fontSize:11, color:C.muted }}>{subtitle}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function InfoBox({ type="info", children }) {
  const map = {
    info:    { c:C.info,   bg:C.infoFade,   border:C.info   },
    warn:    { c:C.warn,   bg:C.warnFade,   border:C.warn   },
    ok:      { c:C.ok,     bg:C.okFade,     border:C.ok     },
    danger:  { c:C.danger, bg:C.dangerFade, border:C.danger },
    terra:   { c:C.terra,  bg:C.terraL,     border:C.terra  },
  };
  const s = map[type] || map.info;
  return (
    <div style={{ background:s.bg, borderLeft:`3px solid ${s.border}`,
      padding:"12px 16px", marginBottom:14, fontSize:12, color:s.c, lineHeight:1.6 }}>
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign:"center", padding:"48px 20px" }}>
      <div style={{ fontSize:48, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:18, fontWeight:900, color:C.black, fontFamily:FONT.display, marginBottom:6 }}>{title}</div>
      {sub && <div style={{ fontSize:13, color:C.muted }}>{sub}</div>}
    </div>
  );
}

// ─── PIN LOCK Lo dejé por si lo uso despues─────────────────────────────────────────────
export function PinLock({ correct, onUnlock, title="Acceso" }) {
  const [pin,   setPin]   = useState("");
  const [err,   setErr]   = useState(false);
  const [shake, setShake] = useState(false);

  function tap(d) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      if (next === correct) { onUnlock(); }
      else {
        setErr(true); setShake(true);
        setTimeout(() => { setPin(""); setErr(false); setShake(false); }, 600);
      }
    }
  }

  return (
    <div style={{ padding:"0 24px 32px", display:"flex", flexDirection:"column", alignItems:"center" }}>
      <div style={{ padding:"40px 0 24px", textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔐</div>
        <div style={{ fontSize:22, fontWeight:900, color:C.black, fontFamily:FONT.display, marginBottom:4 }}>{title}</div>
        <div style={{ fontSize:13, color:C.muted }}>Ingresa tu PIN</div>
      </div>
      <div style={{ display:"flex", gap:16, marginBottom:8,
        animation: shake ? "pinShake .3s" : undefined }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width:16, height:16, borderRadius:"50%",
            background: i < pin.length ? (err ? C.danger : C.black) : C.border,
            transition:"background .15s" }}/>
        ))}
      </div>
      {err && <div style={{ fontSize:12, color:C.danger, marginBottom:12 }}>PIN incorrecto</div>}
      <div style={{ marginBottom:32 }}/>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, width:"100%", maxWidth:260 }}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i) => (
          <button key={i}
            onClick={d===""?undefined:d==="⌫"?()=>setPin(p=>p.slice(0,-1)):()=>tap(String(d))}
            style={{ height:60, border:`1.5px solid ${C.border}`,
              background: d===""?"transparent":C.white,
              fontSize: d==="⌫" ? 20 : 22, fontWeight:600, color:C.black,
              cursor: d===""?"default":"pointer",
              opacity: d==="" ? 0 : 1,
              boxShadow: d!=="" ? "0 2px 8px rgba(0,0,0,0.06)" : undefined }}>
            {d}
          </button>
        ))}
      </div>
      <style>{`@keyframes pinShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}`}</style>
    </div>
  );
}

// ─── LOADING ──────────────────────────────────────────────
export function Loading({ message="Cargando…" }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:"60px 20px", gap:16 }}>
      <div style={{ display:"flex", gap:6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:C.terra,
            animation:`ldot .8s ease-in-out ${i*0.2}s infinite alternate` }}/>
        ))}
      </div>
      <div style={{ fontSize:13, color:C.muted }}>{message}</div>
      <style>{`@keyframes ldot{from{opacity:.3;transform:scale(.8)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

// ─── TABLE ────────────────────────────────────────────────
export function Table({ cols, rows, small }) {
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize: small ? 11 : 12 }}>
        <thead>
          <tr>
            {cols.map(col => (
              <th key={col.key||col.label} style={{
                padding: small ? "6px 8px" : "8px 12px",
                textAlign: col.align || "left",
                background:C.stone, color:C.black, fontWeight:700,
                letterSpacing:.5, textTransform:"uppercase",
                borderBottom:`2px solid ${C.border}`, whiteSpace:"nowrap",
              }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i%2===0?C.white:C.cream }}>
              {cols.map(col => (
                <td key={col.key||col.label} style={{
                  padding: small ? "6px 8px" : "8px 12px",
                  textAlign: col.align || "left",
                  borderBottom:`1px solid ${C.border}`,
                  color: col.color?.(row) || C.black,
                  fontWeight: col.bold ? 700 : 400,
                }}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── OFFLINE BANNER ───────────────────────────────────────
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useState(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online",on); window.removeEventListener("offline",off); };
  });
  if (!offline) return null;
  return (
    <div style={{ background:C.danger, color:C.white, fontSize:11, fontWeight:600,
      padding:"7px 16px", textAlign:"center", letterSpacing:.5 }}>
      📡 Sin conexión
    </div>
  );
}

// ─── STATS ROW ────────────────────────────────────────────
export function StatsRow({ items }) {
  return (
    <div style={{ display:"flex", borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`,
      marginBottom:16 }}>
      {items.map((item, i) => (
        <div key={i} style={{ flex:1, padding:"12px 0", textAlign:"center",
          borderRight: i < items.length-1 ? `1px solid ${C.border}` : "none" }}>
          <div style={{ fontSize:20, fontWeight:900, color: item.color || C.black }}>{item.value}</div>
          <div style={{ fontSize:10, color:C.muted, letterSpacing:.5, marginTop:2 }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}
