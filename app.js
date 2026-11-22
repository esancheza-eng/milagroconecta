// ============================================================
//  MILAGRO CONECTA · app.js
//  Directorio de negocios + bolsa de empleo + perfiles tipo LinkedIn
//  Firebase (Auth + Firestore) · sin servidor propio
// ============================================================
import { firebaseConfig, APP } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, updateProfile } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, increment, limit }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const clip = (s, n) => (s || '').length > n ? s.slice(0, n - 1) + '…' : (s || '');
const DAY = 86400000;
const safeImg = v => (typeof v === 'string' && v.startsWith('data:image/')) ? v : '';
const safeUrl = u => { try { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
const digits = t => String(t || '').replace(/\D/g, '');
const waNum = t => { let d = digits(t); if (d.startsWith('593')) return d; if (d.startsWith('0')) return '593' + d.slice(1); if (d.length === 9) return '593' + d; return d; };
const waLink = (t, msg) => `https://wa.me/${waNum(t)}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;
const ago = ms => { const d = Math.floor((Date.now() - ms) / DAY); return d <= 0 ? 'Hoy' : d === 1 ? 'Ayer' : d < 30 ? `Hace ${d} días` : `Hace ${Math.floor(d / 30)} mes(es)`; };
const fdate = ms => new Date(ms).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DIAS_N = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const CATS = [
  { n: 'Comercio y tiendas', i: '🛒', c: '#1677ff' }, { n: 'Comida y bebidas', i: '🍽️', c: '#ff7a00' },
  { n: 'Moda y calzado', i: '👗', c: '#7a2cf0' }, { n: 'Salud y bienestar', i: '🩺', c: '#e5367a' },
  { n: 'Belleza y cuidado', i: '💇', c: '#c026d3' }, { n: 'Educación', i: '🎓', c: '#0ea5e9' },
  { n: 'Hogar y construcción', i: '🔨', c: '#a16207' }, { n: 'Tecnología', i: '💻', c: '#2563eb' },
  { n: 'Vehículos y repuestos', i: '🚗', c: '#dc2626' }, { n: 'Agro y campo', i: '🌾', c: '#20b514' },
  { n: 'Profesionales', i: '⚖️', c: '#0f766e' }, { n: 'Servicios', i: '🛠️', c: '#ea580c' },
  { n: 'Turismo y hospedaje', i: '🏨', c: '#0891b2' }, { n: 'Otros', i: '📍', c: '#64748b' }
];
const catOf = n => CATS.find(c => c.n === n) || CATS[CATS.length - 1];
const LIM = { gratis: { gal: 0, jobs: 1 }, pro: { gal: 3, jobs: 3 }, premium: { gal: 5, jobs: 99 } };
const PLAN_NAME = { gratis: 'Gratis', pro: 'Pro', premium: 'Premium' };
const rank = p => ({ premium: 3, pro: 2, gratis: 1 }[p] || 1);
const effPlan = x => (x && x.plan && x.plan !== 'gratis' && (x.planHasta || 0) > Date.now()) ? x.plan : 'gratis';
const favs = () => { try { return JSON.parse(localStorage.getItem('mc_favs') || '[]'); } catch { return []; } };

/* ---------- estado ---------- */
const S = { user: null, isAdmin: false, neg: [], perf: [], emp: [], cfg: { ...APP.defaults }, t: 0, tk: 0, loc: null, seed: {},
  f: { q: '', cat: '', cerca: false, abierto: false, fav: false }, tq: '', mine: null, adm: null, admTab: 'pend', next: '' };
const seed = id => (S.seed[id] ??= Math.random());
const byTier = (a, b) => rank(effPlan(b)) - rank(effPlan(a)) || seed(a.id) - seed(b.id);

/* ---------- firebase ---------- */
const ok = !String(firebaseConfig.apiKey).startsWith('PEGA');
let auth, db;
if (ok) { const fb = initializeApp(firebaseConfig); auth = getAuth(fb); db = getFirestore(fb); }

/* ---------- UI helpers ---------- */
function toast(m) { const t = document.createElement('div'); t.className = 'tt'; t.textContent = m; $('#toast').append(t); setTimeout(() => t.remove(), 3200); }
function modal(h) { $('#modal').innerHTML = `<div class="mb">${h}</div>`; }
function closeModal() { $('#modal').innerHTML = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
const busy = (b, on, txt) => { if (!b) return; if (on) { b.dataset.t = b.textContent; b.textContent = txt || '…'; b.disabled = true; } else { b.textContent = b.dataset.t || b.textContent; b.disabled = false; } };

function comprimir(file, max = 900, cap = 200000) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = rej;
    r.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error('Imagen no válida'));
      img.onload = () => {
        let k = Math.min(1, max / Math.max(img.width, img.height)), q = .78, out = '';
        for (let i = 0; i < 12; i++) {
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length <= cap) break;
          q > .45 ? q -= .08 : k *= .85;
        }
        res(out);
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/* ---------- negocio: utilidades ---------- */
const abierto = n => {
  if (!n.desde || !n.hasta || !Array.isArray(n.dias) || !n.dias.length) return null;
  const d = new Date(), day = d.getDay(), m = d.getHours() * 60 + d.getMinutes();
  const t = s => { const [h, mi] = s.split(':').map(Number); return h * 60 + mi; };
  const a = t(n.desde), b = t(n.hasta);
  if (a === b) return n.dias.includes(day);
  if (a < b) return n.dias.includes(day) && m >= a && m < b;
  return (n.dias.includes(day) && m >= a) || (n.dias.includes((day + 6) % 7) && m < b);
};
const diasTxt = ds => { if (!ds || !ds.length) return ''; if (ds.length === 7) return 'Todos los días'; const o = [1, 2, 3, 4, 5, 6, 0].filter(x => ds.includes(x)); return o.map(x => DIAS_N[x]).join(', '); };
const km = (a, b, c, d) => { const R = 6371, p = Math.PI / 180, x = (c - a) * p, y = (d - b) * p, h = Math.sin(x / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const dist = n => S.loc && n.lat != null ? km(S.loc[0], S.loc[1], n.lat, n.lng) : null;
const planTag = (p, inl) => p === 'premium' ? `<span class="badge gold ${inl ? 'inl' : ''}">★ PREMIUM</span>` : p === 'pro' ? `<span class="badge blue ${inl ? 'inl' : ''}">✔ PRO</span>` : '';

function cardNeg(n) {
  const p = effPlan(n), ab = abierto(n), d = dist(n), c = catOf(n.categoria);
  return `<a class="card ${p}" href="#/negocio/${esc(n.id)}">
    <div class="img" style="background-image:url('${safeImg(n.imagen)}')">${planTag(p)}
      <button class="heart ${favs().includes(n.id) ? 'on' : ''}" data-act="fav" data-id="${esc(n.id)}" aria-label="Favorito">❤️</button>
      ${ab === true ? '<span class="open on">● Abierto</span>' : ab === false ? '<span class="open off">Cerrado</span>' : ''}</div>
    <div class="body"><h3>${esc(n.nombre)}</h3>
      <p class="cat">${c.i} ${esc(n.categoria)}${d != null ? ` · 📍 ${d.toFixed(1)} km` : ''}</p>
      <p class="desc">${esc(n.descripcion)}</p></div></a>`;
}
const vigentes = l => l.filter(e => (e.venceAt || 0) > Date.now()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
function cardEmp(e) {
  const n = S.neg.find(x => x.id === e.negocioId);
  return `<a class="job" href="#/empleo/${esc(e.id)}"><div class="ic">💼</div><div style="flex:1;min-width:0">
    <h3>${esc(e.titulo)}</h3><p>${esc(e.negocioNombre || '')} · ${esc(e.tipo || '')}${e.sueldo ? ' · 💲' + esc(e.sueldo) : ''}</p>
    <p>${ago(e.createdAt || 0)}${n && effPlan(n) !== 'gratis' ? ' · ' + (effPlan(n) === 'premium' ? '★' : '✔') : ''}</p></div><span>›</span></a>`;
}
function cardPerf(p) {
  const pl = effPlan(p), ini = esc((p.nombre || '?')[0]);
  return `<a class="card pf ${pl}" href="#/perfil/${esc(p.id)}">
    <div class="avatar" style="${safeImg(p.foto) ? `background-image:url('${safeImg(p.foto)}')` : ''}">${safeImg(p.foto) ? '' : ini}</div>
    <h3>${esc(p.nombre)}</h3><p class="cat">${esc(p.titular)}</p>
    <div style="margin-top:6px">${pl === 'premium' ? '<span class="tag y">★ Destacado</span>' : ''}${p.disponibilidad ? `<span class="tag g">${esc(p.disponibilidad)}</span>` : ''}</div>
    <div style="margin-top:4px">${(p.habilidades || []).slice(0, 3).map(h => `<span class="tag">${esc(h)}</span>`).join('')}</div></a>`;
}

/* ---------- datos ---------- */
async function cargar(force) {
  if (!force && Date.now() - S.t < 90000) return;
  try {
    const q = c => getDocs(query(collection(db, c), where('estado', '==', 'aprobado'), limit(500)));
    const [n, p, e, c] = await Promise.all([q('negocios'), q('perfiles'), q('empleos'), getDoc(doc(db, 'config', 'general')).catch(() => null)]);
    S.neg = n.docs.map(d => ({ id: d.id, ...d.data() }));
    S.perf = p.docs.map(d => ({ id: d.id, ...d.data() }));
    S.emp = e.docs.map(d => ({ id: d.id, ...d.data() }));
    if (c && c.exists()) S.cfg = { ...APP.defaults, ...c.data() };
    S.t = Date.now(); S.error = '';
    const a = $('#anuncio'); a.hidden = !S.cfg.anuncio; a.textContent = S.cfg.anuncio || '';
  } catch (err) { console.error(err); S.error = err.message || 'Error al cargar'; }
}
async function getOne(col, id) {
  const l = { negocios: S.neg, perfiles: S.perf, empleos: S.emp }[col].find(x => x.id === id);
  if (l) return l;
  try { const d = await getDoc(doc(db, col, id)); return d.exists() ? { id: d.id, ...d.data() } : null; } catch { return null; }
}
async function cargarMio() {
  if (!S.user) return null;
  const q = c => getDocs(query(collection(db, c), where('ownerId', '==', S.user.uid)));
  const [n, p, e, s] = await Promise.all([q('negocios'), getDoc(doc(db, 'perfiles', S.user.uid)), q('empleos'), q('solicitudes')]);
  S.mine = { neg: n.docs.map(d => ({ id: d.id, ...d.data() })), perf: p.exists() ? { id: p.id, ...p.data() } : null,
    emp: e.docs.map(d => ({ id: d.id, ...d.data() })), sol: s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt) };
  return S.mine;
}
const track = (col, id, f) => updateDoc(doc(db, col, id), { [f]: increment(1) }).catch(() => { });

/* ---------- router ---------- */
const skeleton = `<div class="grid" style="margin-top:20px">${'<div class="sk"></div>'.repeat(6)}</div>`;
async function router() {
  const h = location.hash || '#/', tk = ++S.tk;
  $$('[data-nav]').forEach(a => a.classList.toggle('on', (h === '#/' || h === '') ? a.dataset.nav === 'home' : h.startsWith('#/' + a.dataset.nav)));
  if (!ok) return paint({ html: vSetup() });
  $('#app').innerHTML = skeleton;
  await cargar();
  if (tk !== S.tk) return;
  const m = re => h.match(re); let r, out;
  try {
    if (m(/^#\/negocios/)) out = vNegocios();
    else if ((r = m(/^#\/negocio\/(.+)/))) out = await vNegocio(r[1]);
    else if (m(/^#\/empleos/)) out = vEmpleos();
    else if ((r = m(/^#\/empleo\/(.+)/))) out = await vEmpleo(r[1]);
    else if (m(/^#\/talento/)) out = vTalento();
    else if ((r = m(/^#\/perfil\/(.+)/))) out = await vPerfil(r[1]);
    else if (m(/^#\/planes/)) out = vPlanes();
    else if (m(/^#\/ingresar/)) out = vAuth();
    else if (m(/^#\/panel\/negocio\/(.+)/)) out = await vFormNeg(m(/^#\/panel\/negocio\/(.+)/)[1]);
    else if (m(/^#\/panel\/perfil/)) out = await vFormPerfil();
    else if ((r = m(/^#\/panel\/empleo\/(.+)/))) out = await vFormEmpleo(r[1]);
    else if (m(/^#\/panel/)) out = await vPanel();
    else if (m(/^#\/admin/)) out = await vAdmin();
    else out = vHome();
  } catch (err) { console.error(err); out = { html: `<div class="empty"><big>😕</big>Ocurrió un error.<br><small>${esc(err.message)}</small></div>` }; }
  if (tk !== S.tk) return;
  paint(out);
}
function paint(o) { $('#app').innerHTML = (o.html || '') + (o.nofoot ? '' : footer()); window.scrollTo(0, 0); o.after && o.after(); }
const footer = () => `<footer class="ft noprint"><b>Milagro Conecta</b> · Comercio · Servicios · Emprendimientos de nuestro cantón<br>
  <a href="#/planes">Planes</a> · <a href="#/ingresar">Registrar mi negocio</a> · <a href="#/admin" style="opacity:.4">Admin</a><br>© ${new Date().getFullYear()} ElhyAi Consultores</footer>`;
window.addEventListener('hashchange', router);
const go = h => { if (location.hash === h) router(); else location.hash = h; };
const needAuth = (next) => { if (S.user) return false; S.next = next; return { html: `<div class="empty"><big>🔐</big><h3>Inicia sesión para continuar</h3><p class="muted">Es gratis y toma 1 minuto.</p><br><a class="btn" href="#/ingresar">Ingresar o crear cuenta</a></div>`, after: () => { } }; };

/* ---------- vistas públicas ---------- */
function vSetup() {
  return `<div class="setup"><h2>⚙️ Falta conectar Firebase</h2><p class="muted" style="margin-top:8px">Abre el archivo <code>firebase-config.js</code> y pega los datos de tu proyecto Firebase (Configuración del proyecto → Tus apps → Web). Luego vuelve a subir el archivo. La guía paso a paso está en <code>README.md</code>.</p></div>`;
}
function vHome() {
  const dest = S.neg.filter(n => effPlan(n) === 'premium' || n.destacado).sort(byTier).slice(0, 10);
  const nuevos = [...S.neg].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);
  const emp = vigentes(S.emp).slice(0, 5);
  const perf = [...S.perf].sort((a, b) => rank(effPlan(b)) - rank(effPlan(a)) || seed(a.id) - seed(b.id)).slice(0, 8);
  const err = S.error ? `<div class="box" style="border-left:4px solid #f0506e">⚠️ No se pudieron cargar los datos: <small>${esc(S.error)}</small><br><small class="muted">Revisa que las reglas de Firestore estén publicadas (README, paso 4).</small></div>` : '';
  return {
    html: `${err}<section class="hero"><img class="lg" src="logo.jpg" alt="Milagro Conecta">
      <h1>Todo Milagro, en un solo lugar</h1><p>Encuentra negocios, servicios, emprendimientos y empleo. Publica tu negocio o sube tu hoja de vida.</p>
      <form class="search" id="hs"><input id="hq" placeholder="¿Qué buscas? pizza, mecánico, dentista…" autocomplete="off"><button class="btn green">Buscar</button></form>
      <div class="chips" style="margin-top:12px;justify-content:center;flex-wrap:wrap">${CATS.slice(0, 6).map(c => `<span class="chip" data-act="cat" data-v="${esc(c.n)}">${c.i} ${esc(c.n)}</span>`).join('')}</div>
      <div class="cta2"><a class="btn gold" href="#/panel/negocio/nuevo">🏪 Registrar mi negocio gratis</a><a class="btn ghost" href="#/panel/perfil">🧑‍💼 Subir mi hoja de vida</a></div></section>
    <div class="stats"><div class="stat"><b>${S.neg.length}</b><span>Negocios</span></div><div class="stat"><b>${vigentes(S.emp).length}</b><span>Empleos</span></div><div class="stat"><b>${S.perf.length}</b><span>Perfiles</span></div></div>
    <section class="sec"><div class="sech"><h2>⭐ Destacados</h2><a href="#/negocios">Ver todos ›</a></div>
      <div class="hs">${dest.map(cardNeg).join('')}<div class="card promo"><h3>🚀 Tu negocio aquí</h3><p class="sm">Aparece primero y con sello ★ Premium. Más clientes, más ventas.</p><a class="btn gold mini" href="#/planes">Ver planes</a></div></div></section>
    <section class="sec"><div class="sech"><h2>Categorías</h2></div><div class="cats">${CATS.map(c => `<div class="cat-t" style="--c:${c.c}" data-act="cat" data-v="${esc(c.n)}"><i>${c.i}</i>${esc(c.n)}</div>`).join('')}</div></section>
    ${emp.length ? `<section class="sec"><div class="sech"><h2>💼 Ofertas de empleo</h2><a href="#/empleos">Ver todas ›</a></div><div class="grid">${emp.map(cardEmp).join('')}</div></section>` : ''}
    ${nuevos.length ? `<section class="sec"><div class="sech"><h2>🆕 Recién llegados</h2><a href="#/negocios">Ver todos ›</a></div><div class="grid">${nuevos.map(cardNeg).join('')}</div></section>` : `<div class="empty"><big>🏪</big><h3>¡Sé el primero!</h3><p>Registra tu negocio gratis y aparece aquí.</p></div>`}
    ${perf.length ? `<section class="sec"><div class="sech"><h2>🧑‍💼 Talento de Milagro</h2><a href="#/talento">Ver todos ›</a></div><div class="hs">${perf.map(cardPerf).join('')}</div></section>` : ''}
    <section class="sec"><div class="hero" style="padding:26px 16px"><h2 style="font-size:24px">¿Listo para crecer con Milagro Conecta?</h2><p style="margin-top:6px">Empieza gratis. Mejora cuando quieras.</p><div class="cta2"><a class="btn green" href="#/ingresar">Crear cuenta gratis</a><a class="btn ghost" href="#/planes">Comparar planes</a></div></div></section>`,
    after: () => { $('#hs').onsubmit = e => { e.preventDefault(); S.f = { ...S.f, q: $('#hq').value.trim(), cat: '' }; go('#/negocios'); }; }
  };
}
function filtrar() {
  const f = S.f; const qn = norm(f.q);
  let r = S.neg.filter(n => (!f.cat || n.categoria === f.cat) && (!qn || (n.busqueda || '').includes(qn)) && (!f.abierto || abierto(n) === true) && (!f.fav || favs().includes(n.id)));
  r = f.cerca && S.loc ? r.sort((a, b) => dist(a) - dist(b)) : r.sort(byTier);
  return r;
}
function vNegocios() {
  const pintar = () => { const r = filtrar(); $('#res').innerHTML = r.length ? r.map(cardNeg).join('') : `<div class="empty" style="grid-column:1/-1"><big>🔎</big>No encontramos resultados.<br><small>Prueba otra búsqueda o categoría.</small></div>`; $('#cnt').textContent = `${r.length} resultado(s)`; $$('[data-f]').forEach(c => c.classList.toggle('on', !!S.f[c.dataset.f])); $$('[data-act=cat]').forEach(c => c.classList.toggle('on', c.dataset.v === S.f.cat)); };
  S.pintarNeg = pintar;
  return {
    html: `<h2 style="margin-top:20px">Negocios y servicios</h2>
    <form class="search" style="margin:12px 0;box-shadow:var(--sh)" id="fs"><input id="q" placeholder="Buscar negocio, servicio, dirección…" value="${esc(S.f.q)}" autocomplete="off"><button class="btn">🔎</button></form>
    <div class="chips"><span class="chip" data-act="flt" data-f="cerca">📍 Cerca de mí</span><span class="chip" data-act="flt" data-f="abierto">🟢 Abierto ahora</span><span class="chip" data-act="flt" data-f="fav">❤️ Favoritos</span></div>
    <div class="chips"><span class="chip" data-act="cat" data-v="">Todos</span>${CATS.map(c => `<span class="chip" data-act="cat" data-v="${esc(c.n)}">${c.i} ${esc(c.n)}</span>`).join('')}</div>
    <p class="muted sm" id="cnt" style="margin:6px 2px 10px"></p><div class="grid" id="res"></div>`,
    after: () => { pintar(); $('#fs').onsubmit = e => { e.preventDefault(); }; $('#q').oninput = e => { S.f.q = e.target.value; pintar(); }; }
  };
}
async function vNegocio(id) {
  const n = await getOne('negocios', id);
  if (!n) return { html: `<div class="empty"><big>🤷</big>Este negocio no existe o aún no está aprobado.</div>` };
  const p = n.estado === 'aprobado' ? effPlan(n) : 'gratis', pro = p !== 'gratis', ab = abierto(n), c = catOf(n.categoria);
  if (n.estado === 'aprobado' && !sessionStorage.getItem('v_' + id)) { sessionStorage.setItem('v_' + id, 1); track('negocios', id, 'vistas'); }
  const jobs = vigentes(S.emp.filter(e => e.negocioId === id));
  const redes = [['facebook', '📘 Facebook'], ['instagram', '📸 Instagram'], ['tiktok', '🎵 TikTok'], ['web', '🌐 Sitio web']].map(([k, t]) => safeUrl(n[k]) ? `<a class="btn light mini" target="_blank" rel="noopener" href="${esc(safeUrl(n[k]))}">${t}</a>` : '').join('');
  const gal = (n.galeria || []).map(safeImg).filter(Boolean);
  const nav = `https://www.google.com/maps/dir/?api=1&destination=${n.lat},${n.lng}`;
  return {
    html: `${n.estado !== 'aprobado' ? `<div class="box" style="border-left:4px solid var(--orange)">🕒 Vista previa: este negocio está <b>${esc(n.estado)}</b> y no es público todavía.</div>` : ''}
    <div class="det-h" style="background-image:url('${safeImg(n.imagen)}')">${planTag(p)}<div class="t"><span class="tag">${c.i} ${esc(n.categoria)}</span>
      ${ab === true ? '<span class="tag g">● Abierto ahora</span>' : ab === false ? '<span class="tag o">Cerrado ahora</span>' : ''}<h1>${esc(n.nombre)}</h1></div></div>
    <div class="acts"><a class="btn green" href="tel:${esc(digits(n.telefono))}" data-track="clicsLlamar" data-id="${esc(id)}">📞 Llamar</a>
      ${pro && n.whatsapp ? `<a class="btn" style="background:#25d366;box-shadow:none" target="_blank" rel="noopener" href="${waLink(n.whatsapp, 'Hola, vi su negocio en Milagro Conecta 👋')}" data-track="clicsWhatsapp" data-id="${esc(id)}">💬 WhatsApp</a>` : ''}
      <a class="btn orange" target="_blank" rel="noopener" href="${nav}">🧭 Cómo llegar</a>
      <button class="btn light" data-act="share" data-t="${esc(n.nombre)}">↗ Compartir</button>
      <button class="btn light heartb ${favs().includes(id) ? 'on' : ''}" data-act="fav" data-id="${esc(id)}">❤️ Guardar</button></div>
    <div class="two"><div>
      <div class="box"><h3>Acerca de</h3><p style="white-space:pre-line">${esc(n.descripcion)}</p></div>
      ${gal.length && pro ? `<div class="box"><h3>Galería</h3><div class="gal">${gal.map(g => `<img src="${g}" alt="" data-act="zoom">`).join('')}</div></div>` : ''}
      ${jobs.length ? `<div class="box"><h3>💼 Trabaja con nosotros</h3><div style="display:grid;gap:10px">${jobs.map(cardEmp).join('')}</div></div>` : ''}
    </div><div>
      <div class="box"><h3>Información</h3>
        <div class="kv"><b>Teléfono</b><span>${esc(n.telefono)}</span></div>
        <div class="kv"><b>Dirección</b><span>${esc(n.direccion)}</span></div>
        ${n.desde ? `<div class="kv"><b>Horario</b><span>${esc(diasTxt(n.dias))}<br>${esc(n.desde)} – ${esc(n.hasta)}</span></div>` : ''}
        ${redes ? `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">${redes}</div>` : (!pro ? '' : '')}</div>
      <div class="box"><h3>Ubicación</h3><div class="map" id="map"></div></div>
      ${!pro && S.user && S.user.uid === n.ownerId ? `<div class="lock" style="margin-top:14px">🚀 Activa <b>Pro</b> o <b>Premium</b> para mostrar WhatsApp, galería y redes.<br><a class="btn gold mini" style="margin-top:8px" href="#/planes">Ver planes</a></div>` : ''}
    </div></div>`,
    after: () => { if (window.L && n.lat != null) { const m = L.map('map', { scrollWheelZoom: false }).setView([n.lat, n.lng], 16); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(m); L.marker([n.lat, n.lng], { icon: L.divIcon({ className: 'pin', html: '📍', iconSize: [30, 30], iconAnchor: [15, 30] }) }).addTo(m); } }
  };
}
function vEmpleos() {
  const l = vigentes(S.emp).filter(e => !S.tq || norm(e.titulo + ' ' + e.negocioNombre + ' ' + e.descripcion).includes(norm(S.tq)));
  return {
    html: `<h2 style="margin-top:20px">💼 Ofertas de empleo</h2><form class="search" style="margin:12px 0;box-shadow:var(--sh)" onsubmit="return false"><input id="eq" placeholder="Buscar empleo…" value="${esc(S.tq)}"><button class="btn">🔎</button></form>
    <div class="grid" id="eres">${l.map(cardEmp).join('') || '<div class="empty" style="grid-column:1/-1"><big>💼</big>Aún no hay ofertas. ¿Tienes un negocio? ¡Publica la tuya!</div>'}</div>
    <div class="box c" style="margin-top:20px"><b>¿Buscas trabajo?</b> Crea tu perfil y que los negocios te encuentren.<br><a class="btn green mini" style="margin-top:8px" href="#/panel/perfil">Subir mi hoja de vida</a></div>`,
    after: () => { $('#eq').oninput = e => { S.tq = e.target.value; const r = vigentes(S.emp).filter(x => !S.tq || norm(x.titulo + ' ' + x.negocioNombre + ' ' + x.descripcion).includes(norm(S.tq))); $('#eres').innerHTML = r.map(cardEmp).join('') || '<div class="empty" style="grid-column:1/-1">Sin resultados</div>'; }; }
  };
}
async function vEmpleo(id) {
  const e = await getOne('empleos', id);
  if (!e) return { html: `<div class="empty"><big>🤷</big>Oferta no disponible.</div>` };
  const n = await getOne('negocios', e.negocioId);
  const wa = e.whatsapp || (n && n.whatsapp) || (n && n.telefono);
  return {
    html: `<div class="box" style="margin-top:20px"><span class="tag">💼 ${esc(e.tipo || 'Empleo')}</span>${e.sueldo ? `<span class="tag g">💲 ${esc(e.sueldo)}</span>` : ''}<span class="tag o">${ago(e.createdAt || 0)}</span>
    <h1 style="font-size:26px;margin:8px 0">${esc(e.titulo)}</h1><p class="muted">en <a href="#/negocio/${esc(e.negocioId)}" style="color:var(--blue);font-weight:600">${esc(e.negocioNombre)}</a></p>
    <p style="white-space:pre-line;margin-top:14px">${esc(e.descripcion)}</p>
    <div class="acts">${wa ? `<a class="btn green" target="_blank" rel="noopener" href="${waLink(wa, `Hola, me interesa la vacante "${e.titulo}" que vi en Milagro Conecta.`)}">💬 Postular por WhatsApp</a>` : ''}<button class="btn light" data-act="share" data-t="${esc(e.titulo)}">↗ Compartir</button></div></div>`
  };
}
function vTalento() {
  const f = () => S.perf.filter(p => !S.tq || norm(p.nombre + ' ' + p.titular + ' ' + (p.habilidades || []).join(' ') + ' ' + (p.sector || '')).includes(norm(S.tq))).sort((a, b) => rank(effPlan(b)) - rank(effPlan(a)) || seed(a.id) - seed(b.id));
  return {
    html: `<h2 style="margin-top:20px">🧑‍💼 Talento de Milagro</h2><p class="muted">Encuentra personal calificado. Inicia sesión para ver su contacto.</p>
    <form class="search" style="margin:12px 0;box-shadow:var(--sh)" onsubmit="return false"><input id="tq" placeholder="Cargo, habilidad o nombre…" value="${esc(S.tq)}"><button class="btn">🔎</button></form>
    <div class="grid" id="tres">${f().map(cardPerf).join('') || '<div class="empty" style="grid-column:1/-1"><big>🧑‍💼</big>Aún no hay perfiles. ¡Sube el tuyo!</div>'}</div>`,
    after: () => { $('#tq').oninput = e => { S.tq = e.target.value; $('#tres').innerHTML = f().map(cardPerf).join('') || '<div class="empty" style="grid-column:1/-1">Sin resultados</div>'; }; }
  };
}
async function vPerfil(id) {
  const p = await getOne('perfiles', id);
  if (!p) return { html: `<div class="empty"><big>🤷</big>Perfil no disponible.</div>` };
  const pl = p.estado === 'aprobado' ? effPlan(p) : 'gratis'; let ct = null;
  if (S.user) { try { const d = await getDoc(doc(db, 'perfiles', id, 'contacto', 'datos')); if (d.exists()) ct = d.data(); } catch { } }
  const ini = esc((p.nombre || '?')[0]);
  return {
    html: `${p.estado !== 'aprobado' ? `<div class="box" style="border-left:4px solid var(--orange)">🕒 Vista previa: tu perfil está <b>${esc(p.estado)}</b>.</div>` : ''}
    <div class="pcard"><div class="pcov"></div><div class="in"><div class="avatar" style="${safeImg(p.foto) ? `background-image:url('${safeImg(p.foto)}')` : ''}">${safeImg(p.foto) ? '' : ini}</div>
      <h1 style="font-size:26px;margin-top:10px">${esc(p.nombre)} ${pl === 'premium' ? '<span class="tag y">★ Destacado</span>' : ''}</h1>
      <p style="font-weight:500">${esc(p.titular)}</p><p class="muted sm">📍 ${esc(p.sector || 'Milagro')}${p.disponibilidad ? ` · <b style="color:var(--green)">${esc(p.disponibilidad)}</b>` : ''}</p>
      <div class="acts noprint">${ct ? `${ct.whatsapp ? `<a class="btn green" target="_blank" rel="noopener" href="${waLink(ct.whatsapp, 'Hola, vi tu perfil en Milagro Conecta.')}">💬 WhatsApp</a>` : ''}${ct.telefono ? `<a class="btn" href="tel:${esc(digits(ct.telefono))}">📞 Llamar</a>` : ''}${ct.email ? `<a class="btn light" href="mailto:${esc(ct.email)}">✉️ Correo</a>` : ''}` : `<button class="btn orange" data-act="needlogin">🔒 Ver contacto</button>`}
        <button class="btn light" data-act="print">🖨 Guardar PDF</button><button class="btn light" data-act="share" data-t="${esc(p.nombre)}">↗ Compartir</button></div></div></div>
    ${p.resumen ? `<div class="box"><h3>Acerca de mí</h3><p style="white-space:pre-line">${esc(p.resumen)}</p></div>` : ''}
    ${(p.experiencia || []).length ? `<div class="box"><h3>💼 Experiencia</h3><div class="tl">${p.experiencia.map(x => `<div class="it"><b>${esc(x.cargo)}</b><div class="sm">${esc(x.empresa)} · <span class="muted">${esc(x.desde)} – ${esc(x.hasta || 'Actual')}</span></div>${x.desc ? `<p class="sm" style="margin-top:3px;white-space:pre-line">${esc(x.desc)}</p>` : ''}</div>`).join('')}</div></div>` : ''}
    ${(p.educacion || []).length ? `<div class="box"><h3>🎓 Educación</h3><div class="tl">${p.educacion.map(x => `<div class="it"><b>${esc(x.titulo)}</b><div class="sm">${esc(x.institucion)} · <span class="muted">${esc(x.anio)}</span></div></div>`).join('')}</div></div>` : ''}
    ${(p.habilidades || []).length ? `<div class="box"><h3>⚡ Habilidades</h3>${p.habilidades.map(h => `<span class="tag">${esc(h)}</span>`).join('')}</div>` : ''}
    ${safeUrl(p.cvLink) ? `<div class="box noprint"><a class="btn light" target="_blank" rel="noopener" href="${esc(safeUrl(p.cvLink))}">📄 Ver hoja de vida completa</a></div>` : ''}`
  };
}
function vPlanes() {
  const c = S.cfg, li = (t, y = true) => `<li class="${y ? '' : 'no'}">${t}</li>`;
  return {
    html: `<div class="c" style="margin-top:24px"><h1 style="font-size:28px;font-weight:800">Elige cómo quieres crecer 🚀</h1><p class="muted">Empieza gratis. Mejora cuando tu negocio lo pida.</p></div>
    <div class="plans" style="margin-top:26px">
      <div class="plan"><h3>🌱 Gratis</h3><div class="pr">$0<small> / siempre</small></div><ul>${li('Ficha con foto, descripción y horario')}${li('Teléfono y ubicación GPS')}${li('Aparece en el directorio')}${li('1 oferta de empleo')}${li('WhatsApp, galería y redes', false)}${li('Posición destacada', false)}</ul><a class="btn light block" href="#/panel/negocio/nuevo">Registrar gratis</a></div>
      <div class="plan pro"><h3>✔ Pro</h3><div class="pr">$${esc(c.precioPro)}<small> / mes</small></div><ul>${li('Todo lo del plan Gratis')}${li('Botón de WhatsApp directo')}${li('Galería de hasta 3 fotos')}${li('Facebook, Instagram, TikTok y web')}${li('Sello ✔ Pro')}${li('3 ofertas de empleo')}${li('Estadísticas', false)}</ul><button class="btn block" data-act="plan" data-p="pro" data-t="negocio">Elegir Pro</button></div>
      <div class="plan premium"><span class="pill">MÁS POPULAR</span><h3>★ Premium</h3><div class="pr">$${esc(c.precioPremium)}<small> / mes</small></div><ul>${li('Todo lo del plan Pro')}${li('<b>Aparece primero</b> en búsquedas')}${li('Sección ⭐ Destacados del inicio')}${li('Galería de hasta 5 fotos')}${li('Ofertas de empleo ilimitadas')}${li('Estadísticas: vistas y clics')}${li('Sello dorado ★')}</ul><button class="btn gold block" data-act="plan" data-p="premium" data-t="negocio">Elegir Premium</button></div></div>
    <div class="box" style="margin-top:22px;display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><h3>🧑‍💼 ¿Buscas trabajo? Perfil Premium</h3><p class="sm muted">Perfil tipo LinkedIn gratis. Con Premium (<b>$${esc(c.precioPerfilPremium)}/mes</b>) apareces primero y con sello ★ Destacado para que te contacten antes.</p></div><button class="btn gold" data-act="plan" data-p="premium" data-t="perfil">Destacar mi perfil</button></div>
    <p class="c sm muted" style="margin-top:14px">Pago por transferencia o depósito. Envías tu comprobante y el administrador activa tu plan.</p>`
  };
}

/* ---------- autenticación ---------- */
function vAuth() {
  if (S.user) { go('#/panel'); return { html: '' }; }
  return {
    html: `<div class="form" style="max-width:460px"><div class="c"><img src="icon-192.png" style="width:84px;margin:0 auto;border-radius:20px" alt=""><h2 style="margin-top:8px">Bienvenido a Milagro Conecta</h2><p class="muted sm">Crea tu cuenta para publicar tu negocio o subir tu perfil.</p></div>
    <div class="tabs" style="justify-content:center"><button class="on" data-act="atab" data-v="in">Ingresar</button><button data-act="atab" data-v="up">Crear cuenta</button></div>
    <form id="af"><div class="f" id="fn" hidden><label>Tu nombre</label><input type="text" id="an" autocomplete="name"></div>
    <div class="f"><label>Correo</label><input type="email" id="ae" required autocomplete="email"></div>
    <div class="f"><label>Contraseña</label><input type="password" id="ap" required minlength="6" autocomplete="current-password"><small id="ah">Mínimo 6 caracteres</small></div>
    <button class="btn block" style="margin-top:18px" id="ab">Ingresar</button></form>
    <button class="btn light block" style="margin-top:10px" data-act="google">🔵 Continuar con Google</button>
    <p class="c sm" style="margin-top:12px"><a href="#" data-act="reset" style="color:var(--blue)">Olvidé mi contraseña</a></p></div>`,
    nofoot: true,
    after: () => {
      S.mode = 'in';
      $('#af').onsubmit = async e => {
        e.preventDefault(); const b = $('#ab'), em = $('#ae').value.trim(), pw = $('#ap').value; busy(b, true, 'Un momento…');
        try {
          if (S.mode === 'up') { const c = await createUserWithEmailAndPassword(auth, em, pw); const nm = $('#an').value.trim(); if (nm) await updateProfile(c.user, { displayName: nm }); }
          else await signInWithEmailAndPassword(auth, em, pw);
        } catch (err) { busy(b, false); toast(authMsg(err)); }
      };
    }
  };
}
const authMsg = e => ({ 'auth/invalid-credential': 'Correo o contraseña incorrectos', 'auth/email-already-in-use': 'Ese correo ya tiene cuenta', 'auth/weak-password': 'Contraseña muy corta', 'auth/invalid-email': 'Correo no válido', 'auth/popup-closed-by-user': 'Cancelado', 'auth/unauthorized-domain': 'Dominio no autorizado en Firebase (ver README)', 'auth/operation-not-allowed': 'Método no habilitado en Firebase' }[e.code] || 'Error: ' + (e.code || e.message));
if (ok) onAuthStateChanged(auth, async u => {
  S.user = u; S.isAdmin = false; S.mine = null;
  if (u) { try { S.isAdmin = (await getDoc(doc(db, 'admins', u.uid))).exists(); } catch { } }
  const b = $('#btnCuenta'); b.textContent = u ? (S.isAdmin ? '⚙️ Admin' : '👤 ' + clip(u.displayName || u.email.split('@')[0], 12)) : 'Ingresar'; b.href = u ? (S.isAdmin ? '#/admin' : '#/panel') : '#/ingresar';
  if (u && location.hash.startsWith('#/ingresar')) { const n = S.next || '#/panel'; S.next = ''; location.hash = n; } else router();
});
if (!ok) router();

/* ---------- panel del usuario ---------- */
const estTag = e => e === 'aprobado' ? '<span class="tag g">✅ Aprobado</span>' : e === 'rechazado' ? '<span class="tag r">❌ Rechazado</span>' : '<span class="tag y">🕒 En revisión</span>';
async function vPanel() {
  const na = needAuth('#/panel'); if (na) return na;
  const m = await cargarMio();
  const nm = S.user.displayName || S.user.email;
  return {
    html: `<div style="margin-top:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><div><h2>Hola, ${esc(clip(nm, 24))} 👋</h2><p class="muted sm">Administra tu presencia en Milagro Conecta</p></div><button class="btn light mini" data-act="logout">Salir</button></div>
    ${S.isAdmin ? `<a class="btn gold block" style="margin-top:12px" href="#/admin">⚙️ Ir al panel de administrador</a>` : ''}
    <section class="sec"><div class="sech"><h2>🏪 Mis negocios</h2><a href="#/panel/negocio/nuevo">+ Nuevo</a></div>
    ${m.neg.map(n => { const p = effPlan(n); return `<div class="li"><div class="th" style="background-image:url('${safeImg(n.imagen)}')"></div><div class="tx"><b>${esc(n.nombre)}</b> ${planTag(p, true)}<div>${estTag(n.estado)}<span class="tag">${PLAN_NAME[p]}</span>${p !== 'gratis' ? `<span class="tag o">hasta ${fdate(n.planHasta)}</span>` : ''}</div>
      ${n.estado === 'rechazado' && n.motivo ? `<p class="sm" style="color:#c4203f">Motivo: ${esc(n.motivo)}</p>` : ''}
      ${p === 'premium' ? `<div class="kpi">👁 <b>${n.vistas || 0}</b> vistas · 📞 <b>${n.clicsLlamar || 0}</b> llamadas · 💬 <b>${n.clicsWhatsapp || 0}</b> WhatsApp</div>` : `<div class="kpi">👁 ${n.vistas || 0} vistas${p === 'gratis' ? ' · <a href="#/planes" style="color:var(--blue)">ver llamadas y WhatsApp con Premium</a>' : ''}</div>`}
      <div class="bt"><a class="btn mini light" href="#/negocio/${esc(n.id)}">Ver</a><a class="btn mini" href="#/panel/negocio/${esc(n.id)}">Editar</a>${n.estado === 'aprobado' ? `<button class="btn mini gold" data-act="plan" data-p="${p === 'gratis' ? 'pro' : 'premium'}" data-t="negocio" data-id="${esc(n.id)}">⬆ Mejorar plan</button><a class="btn mini green" href="#/panel/empleo/nuevo?n=${esc(n.id)}">+ Oferta de empleo</a>` : ''}<button class="btn mini red" data-act="delneg" data-id="${esc(n.id)}">Eliminar</button></div></div></div>`; }).join('') || `<div class="box c">Aún no registras ningún negocio.<br><a class="btn green mini" style="margin-top:8px" href="#/panel/negocio/nuevo">Registrar mi negocio gratis</a></div>`}</section>
    <section class="sec"><div class="sech"><h2>🧑‍💼 Mi perfil profesional</h2></div>
    ${m.perf ? `<div class="li"><div class="th" style="border-radius:50%;background-image:url('${safeImg(m.perf.foto)}')"></div><div class="tx"><b>${esc(m.perf.nombre)}</b><div>${estTag(m.perf.estado)}<span class="tag">${PLAN_NAME[effPlan(m.perf)]}</span>${effPlan(m.perf) !== 'gratis' ? `<span class="tag o">hasta ${fdate(m.perf.planHasta)}</span>` : ''}</div>${m.perf.estado === 'rechazado' && m.perf.motivo ? `<p class="sm" style="color:#c4203f">Motivo: ${esc(m.perf.motivo)}</p>` : ''}
      <div class="bt"><a class="btn mini light" href="#/perfil/${esc(m.perf.id)}">Ver</a><a class="btn mini" href="#/panel/perfil">Editar</a>${m.perf.estado === 'aprobado' && effPlan(m.perf) === 'gratis' ? `<button class="btn mini gold" data-act="plan" data-p="premium" data-t="perfil" data-id="${esc(m.perf.id)}">★ Destacar</button>` : ''}<button class="btn mini red" data-act="delperf">Eliminar</button></div></div></div>` : `<div class="box c">Crea tu perfil tipo LinkedIn y que los negocios te contacten.<br><a class="btn green mini" style="margin-top:8px" href="#/panel/perfil">Crear mi perfil</a></div>`}</section>
    ${m.emp.length ? `<section class="sec"><div class="sech"><h2>💼 Mis ofertas</h2></div>${m.emp.map(e => `<div class="li"><div class="tx"><b>${esc(e.titulo)}</b><div>${estTag(e.estado)}<span class="tag">${esc(e.negocioNombre)}</span><span class="tag o">vence ${fdate(e.venceAt)}</span></div></div><button class="btn mini red" data-act="delemp" data-id="${esc(e.id)}">Eliminar</button></div>`).join('')}</section>` : ''}
    ${m.sol.length ? `<section class="sec"><div class="sech"><h2>💳 Mis solicitudes de plan</h2></div>${m.sol.map(s => `<div class="li"><div class="tx"><b>Plan ${PLAN_NAME[s.plan]}</b> · ${s.tipo}<div><span class="tag ${s.estado === 'activada' ? 'g' : s.estado === 'rechazada' ? 'r' : 'y'}">${esc(s.estado)}</span><span class="tag">${fdate(s.createdAt)}</span></div></div></div>`).join('')}</section>` : ''}`
  };
}

/* ---------- formulario de negocio ---------- */
async function vFormNeg(id) {
  const na = needAuth('#/panel/negocio/' + id); if (na) return na;
  let n = {}; if (id !== 'nuevo') { n = await getOne('negocios', id); if (!n || n.ownerId !== S.user.uid) return { html: '<div class="empty">No encontrado.</div>' }; }
  const p = id === 'nuevo' ? 'gratis' : effPlan(n), lim = LIM[p].gal, nuevo = id === 'nuevo';
  const st = { img: n.imagen || '', gal: [...(n.galeria || [])], lat: n.lat ?? null, lng: n.lng ?? null };
  const dias = new Set(n.dias || [1, 2, 3, 4, 5, 6]);
  return {
    html: `<form class="form" id="nf"><h2>${nuevo ? '🏪 Registrar mi negocio' : '✏️ Editar negocio'}</h2><p class="muted sm">${nuevo ? 'Es gratis. El administrador revisará tu información antes de publicarla.' : '⚠️ Al guardar, tu ficha volverá a revisión antes de mostrarse.'}</p>
    <div class="f"><label>Nombre del negocio *</label><input type="text" name="nombre" required maxlength="70" value="${esc(n.nombre)}"></div>
    <div class="f"><label>Categoría *</label><select name="categoria" required><option value="">Selecciona…</option>${CATS.map(c => `<option ${n.categoria === c.n ? 'selected' : ''}>${esc(c.n)}</option>`).join('')}</select></div>
    <div class="f"><label>Descripción *</label><textarea name="descripcion" required maxlength="600" placeholder="¿Qué vendes u ofreces? Productos, servicios, promociones…">${esc(n.descripcion)}</textarea></div>
    <div class="row2"><div class="f"><label>Teléfono *</label><input type="tel" name="telefono" required value="${esc(n.telefono)}" placeholder="0991234567"></div>
    <div class="f"><label>WhatsApp</label><input type="tel" name="whatsapp" value="${esc(n.whatsapp)}" placeholder="0991234567"><small>El botón se muestra en planes Pro/Premium</small></div></div>
    <div class="f"><label>Dirección / referencia *</label><input type="text" name="direccion" required maxlength="140" value="${esc(n.direccion)}" placeholder="Calle, sector, referencia"></div>
    <div class="f"><label>Días de atención</label><div class="days">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" name="dias" value="${d}" ${dias.has(d) ? 'checked' : ''}><span title="${DIAS_N[d]}">${DIAS[d]}</span></label>`).join('')}</div></div>
    <div class="row2"><div class="f"><label>Abre</label><input type="time" name="desde" value="${esc(n.desde || '08:00')}"></div><div class="f"><label>Cierra</label><input type="time" name="hasta" value="${esc(n.hasta || '18:00')}"></div></div>
    <div class="f"><label>Foto principal del negocio *</label><div class="up"><span>📷 Toca para subir una foto</span><input type="file" accept="image/*" id="fimg"><div id="pimg">${st.img ? `<img src="${safeImg(st.img)}">` : ''}</div></div></div>
    <div class="f"><label>Ubicación en el mapa (GPS) *</label><div class="map pick" id="pmap"></div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button type="button" class="btn light mini" data-act="mygps">📍 Usar mi ubicación actual</button><small id="gpsok" style="align-self:center">${st.lat != null ? '✅ Ubicación marcada' : 'Toca el mapa o arrastra el pin'}</small></div></div>
    <div class="f"><label>Galería de fotos ${lim ? `(hasta ${lim})` : '🔒'}</label>${lim ? `<div class="up"><span>🖼️ Agregar fotos</span><input type="file" accept="image/*" multiple id="fgal"></div><div class="thumbs" id="pgal"></div>` : `<div class="lock sm">Disponible en <b>Pro</b> (3 fotos) y <b>Premium</b> (5 fotos). <a href="#/planes" style="color:var(--blue)">Ver planes</a></div>`}</div>
    <div class="sub"><b class="sm">Redes sociales ${p === 'gratis' ? '🔒 (Pro/Premium)' : ''}</b>
      <div class="f"><label>Facebook</label><input type="url" name="facebook" value="${esc(n.facebook)}" placeholder="https://facebook.com/..."></div>
      <div class="f"><label>Instagram</label><input type="url" name="instagram" value="${esc(n.instagram)}" placeholder="https://instagram.com/..."></div>
      <div class="f"><label>TikTok</label><input type="url" name="tiktok" value="${esc(n.tiktok)}"></div><div class="f"><label>Sitio web</label><input type="url" name="web" value="${esc(n.web)}"></div></div>
    <button class="btn green block" style="margin-top:20px" id="nb">${nuevo ? 'Enviar para aprobación' : 'Guardar cambios'}</button></form>`,
    after: () => {
      const f = $('#nf'), pgal = () => { const t = $('#pgal'); if (t) t.innerHTML = st.gal.map((g, i) => `<div style="position:relative"><img src="${safeImg(g)}"><button type="button" data-act="rmgal" data-i="${i}" style="position:absolute;top:-6px;right:-6px;border:0;border-radius:50%;width:22px;height:22px;background:#d62a4a;color:#fff;cursor:pointer">×</button></div>`).join(''); };
      S.rmgal = i => { st.gal.splice(i, 1); pgal(); }; pgal();
      let map = null, mk = null;
      const setPin = (lat, lng) => { st.lat = lat; st.lng = lng; $('#gpsok').textContent = '✅ Ubicación marcada'; if (map) { mk ? mk.setLatLng([lat, lng]) : (mk = L.marker([lat, lng], { draggable: true, icon: L.divIcon({ className: 'pin', html: '📍', iconSize: [30, 30], iconAnchor: [15, 30] }) }).addTo(map).on('dragend', ev => { const q = ev.target.getLatLng(); st.lat = q.lat; st.lng = q.lng; })); map.setView([lat, lng], Math.max(map.getZoom(), 16)); } };
      S.setPin = setPin;
      if (window.L) { map = L.map('pmap').setView(st.lat != null ? [st.lat, st.lng] : APP.centro, st.lat != null ? 16 : 14); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map); map.on('click', e => setPin(e.latlng.lat, e.latlng.lng)); if (st.lat != null) setPin(st.lat, st.lng); }
      $('#fimg').onchange = async e => { const fl = e.target.files[0]; if (!fl) return; try { st.img = await comprimir(fl, 900, 200000); $('#pimg').innerHTML = `<img src="${st.img}">`; } catch { toast('No se pudo leer la imagen'); } };
      const fg = $('#fgal'); if (fg) fg.onchange = async e => { for (const fl of [...e.target.files]) { if (st.gal.length >= lim) { toast(`Máximo ${lim} fotos en tu plan`); break; } try { st.gal.push(await comprimir(fl, 700, 110000)); } catch { } } pgal(); fg.value = ''; };
      f.onsubmit = async e => {
        e.preventDefault(); const b = $('#nb'), v = Object.fromEntries(new FormData(f));
        if (!st.img) return toast('Sube la foto principal'); if (st.lat == null) return toast('Marca la ubicación en el mapa');
        const diasSel = $$('input[name=dias]:checked', f).map(x => +x.value);
        const data = { nombre: v.nombre.trim(), categoria: v.categoria, descripcion: v.descripcion.trim(), telefono: v.telefono.trim(), whatsapp: v.whatsapp.trim(), direccion: v.direccion.trim(),
          dias: diasSel, desde: v.desde, hasta: v.hasta, lat: st.lat, lng: st.lng, imagen: st.img, galeria: lim ? st.gal : [],
          facebook: p === 'gratis' ? '' : v.facebook.trim(), instagram: p === 'gratis' ? '' : v.instagram.trim(), tiktok: p === 'gratis' ? '' : v.tiktok.trim(), web: p === 'gratis' ? '' : v.web.trim(),
          estado: 'pendiente', updatedAt: Date.now() };
        data.busqueda = norm([data.nombre, data.categoria, data.descripcion, data.direccion].join(' '));
        busy(b, true, 'Guardando…');
        try {
          if (nuevo) await addDoc(collection(db, 'negocios'), { ...data, ownerId: S.user.uid, plan: 'gratis', planHasta: 0, destacado: false, vistas: 0, clicsWhatsapp: 0, clicsLlamar: 0, createdAt: Date.now() });
          else await updateDoc(doc(db, 'negocios', id), data);
          S.t = 0; toast('✅ Enviado. Te avisaremos cuando sea aprobado.'); go('#/panel');
        } catch (err) { console.error(err); busy(b, false); toast('Error al guardar: ' + (err.code || err.message)); }
      };
    }
  };
}

/* ---------- formulario de perfil ---------- */
async function vFormPerfil() {
  const na = needAuth('#/panel/perfil'); if (na) return na;
  const uid = S.user.uid; let p = await getOne('perfiles', uid) || {}, c = {};
  if (p.id) { try { const d = await getDoc(doc(db, 'perfiles', uid, 'contacto', 'datos')); if (d.exists()) c = d.data(); } catch { } }
  const st = { foto: p.foto || '', exp: (p.experiencia || []).map(x => ({ ...x })), edu: (p.educacion || []).map(x => ({ ...x })) };
  const nuevo = !p.id;
  return {
    html: `<form class="form" id="pf"><h2>🧑‍💼 ${nuevo ? 'Crear mi perfil profesional' : 'Editar mi perfil'}</h2><p class="muted sm">Tu perfil será público (sin contacto). Tu teléfono y correo solo los ven usuarios registrados.</p>
    <div class="f"><label>Foto de perfil</label><div class="up"><span>📷 Subir foto</span><input type="file" accept="image/*" id="ffoto"><div id="pfoto">${st.foto ? `<img src="${safeImg(st.foto)}" style="max-height:120px;border-radius:50%">` : ''}</div></div></div>
    <div class="f"><label>Nombre completo *</label><input type="text" name="nombre" required maxlength="70" value="${esc(p.nombre || S.user.displayName || '')}"></div>
    <div class="f"><label>Titular profesional *</label><input type="text" name="titular" required maxlength="90" value="${esc(p.titular)}" placeholder="Ej: Contadora · Chofer profesional · Vendedor con experiencia"></div>
    <div class="row2"><div class="f"><label>Sector / parroquia</label><input type="text" name="sector" maxlength="60" value="${esc(p.sector || 'Milagro')}"></div>
    <div class="f"><label>Disponibilidad</label><select name="disponibilidad">${['Disponible ya', 'Disponible en 15 días', 'Medio tiempo', 'Trabajos ocasionales', 'Solo escucho ofertas'].map(o => `<option ${p.disponibilidad === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div></div>
    <div class="f"><label>Resumen *</label><textarea name="resumen" required maxlength="700" placeholder="Cuéntanos quién eres, qué sabes hacer y qué buscas.">${esc(p.resumen)}</textarea></div>
    <div class="f"><label>Experiencia laboral</label><div id="lexp"></div><button type="button" class="btn light mini" data-act="addexp" style="margin-top:8px">+ Agregar experiencia</button></div>
    <div class="f"><label>Educación y cursos</label><div id="ledu"></div><button type="button" class="btn light mini" data-act="addedu" style="margin-top:8px">+ Agregar estudio</button></div>
    <div class="f"><label>Habilidades</label><input type="text" name="habilidades" value="${esc((p.habilidades || []).join(', '))}" placeholder="Atención al cliente, Excel, Conducción, Ventas"><small>Sepáralas con comas (máx. 12)</small></div>
    <div class="f"><label>Enlace a tu hoja de vida (opcional)</label><input type="url" name="cvLink" value="${esc(p.cvLink)}" placeholder="Link de Google Drive, LinkedIn…"></div>
    <div class="sub"><b class="sm">🔒 Contacto (solo usuarios registrados)</b><div class="row2"><div class="f"><label>Teléfono *</label><input type="tel" name="telefono" required value="${esc(c.telefono)}"></div><div class="f"><label>WhatsApp</label><input type="tel" name="whatsapp" value="${esc(c.whatsapp)}"></div></div>
    <div class="f"><label>Correo</label><input type="email" name="email" value="${esc(c.email || S.user.email)}"></div></div>
    <label class="f" style="display:flex;gap:8px;align-items:flex-start;font-weight:400"><input type="checkbox" id="cons" required style="margin-top:4px"> Autorizo mostrar mi perfil en Milagro Conecta.</label>
    <button class="btn green block" style="margin-top:16px" id="pb">${nuevo ? 'Enviar para aprobación' : 'Guardar cambios'}</button></form>`,
    after: () => {
      const rexp = () => { $('#lexp').innerHTML = st.exp.map((x, i) => `<div class="sub"><input type="text" placeholder="Cargo" data-l="exp" data-i="${i}" data-k="cargo" value="${esc(x.cargo)}" style="width:100%;margin-bottom:6px;padding:9px;border:1.5px solid var(--line);border-radius:10px"><input type="text" placeholder="Empresa" data-l="exp" data-i="${i}" data-k="empresa" value="${esc(x.empresa)}" style="width:100%;margin-bottom:6px;padding:9px;border:1.5px solid var(--line);border-radius:10px"><div class="row2"><input type="text" placeholder="Desde (2021)" data-l="exp" data-i="${i}" data-k="desde" value="${esc(x.desde)}" style="padding:9px;border:1.5px solid var(--line);border-radius:10px"><input type="text" placeholder="Hasta (Actual)" data-l="exp" data-i="${i}" data-k="hasta" value="${esc(x.hasta)}" style="padding:9px;border:1.5px solid var(--line);border-radius:10px"></div><textarea placeholder="Funciones y logros" data-l="exp" data-i="${i}" data-k="desc" style="margin-top:6px;min-height:60px;width:100%;padding:9px;border:1.5px solid var(--line);border-radius:10px">${esc(x.desc)}</textarea><button type="button" class="btn red mini" data-act="rmexp" data-i="${i}" style="margin-top:6px">Quitar</button></div>`).join(''); };
      const redu = () => { $('#ledu').innerHTML = st.edu.map((x, i) => `<div class="sub"><input type="text" placeholder="Título o curso" data-l="edu" data-i="${i}" data-k="titulo" value="${esc(x.titulo)}" style="width:100%;margin-bottom:6px;padding:9px;border:1.5px solid var(--line);border-radius:10px"><div class="row2"><input type="text" placeholder="Institución" data-l="edu" data-i="${i}" data-k="institucion" value="${esc(x.institucion)}" style="padding:9px;border:1.5px solid var(--line);border-radius:10px"><input type="text" placeholder="Año" data-l="edu" data-i="${i}" data-k="anio" value="${esc(x.anio)}" style="padding:9px;border:1.5px solid var(--line);border-radius:10px"></div><button type="button" class="btn red mini" data-act="rmedu" data-i="${i}" style="margin-top:6px">Quitar</button></div>`).join(''); };
      S.pf = { addexp: () => { if (st.exp.length < 6) { st.exp.push({}); rexp(); } }, addedu: () => { if (st.edu.length < 4) { st.edu.push({}); redu(); } }, rmexp: i => { st.exp.splice(i, 1); rexp(); }, rmedu: i => { st.edu.splice(i, 1); redu(); } };
      rexp(); redu();
      $('#pf').addEventListener('input', e => { const t = e.target; if (t.dataset.l) (t.dataset.l === 'exp' ? st.exp : st.edu)[+t.dataset.i][t.dataset.k] = t.value; });
      $('#ffoto').onchange = async e => { const fl = e.target.files[0]; if (!fl) return; try { st.foto = await comprimir(fl, 400, 60000); $('#pfoto').innerHTML = `<img src="${st.foto}" style="max-height:120px;border-radius:50%">`; } catch { toast('No se pudo leer la imagen'); } };
      $('#pf').onsubmit = async e => {
        e.preventDefault(); const b = $('#pb'), v = Object.fromEntries(new FormData(e.target));
        const data = { nombre: v.nombre.trim(), titular: v.titular.trim(), sector: v.sector.trim(), disponibilidad: v.disponibilidad, resumen: v.resumen.trim(), foto: st.foto,
          experiencia: st.exp.filter(x => x.cargo), educacion: st.edu.filter(x => x.titulo), habilidades: v.habilidades.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12), cvLink: v.cvLink.trim(),
          estado: 'pendiente', updatedAt: Date.now() };
        data.busqueda = norm([data.nombre, data.titular, data.sector, data.habilidades.join(' ')].join(' '));
        busy(b, true, 'Guardando…');
        try {
          if (nuevo) await setDoc(doc(db, 'perfiles', uid), { ...data, ownerId: uid, plan: 'gratis', planHasta: 0, destacado: false, createdAt: Date.now() });
          else await updateDoc(doc(db, 'perfiles', uid), data);
          await setDoc(doc(db, 'perfiles', uid, 'contacto', 'datos'), { telefono: v.telefono.trim(), whatsapp: v.whatsapp.trim(), email: v.email.trim(), ownerId: uid });
          S.t = 0; toast('✅ Perfil enviado para aprobación'); go('#/panel');
        } catch (err) { console.error(err); busy(b, false); toast('Error al guardar: ' + (err.code || err.message)); }
      };
    }
  };
}

/* ---------- formulario de oferta de empleo ---------- */
async function vFormEmpleo() {
  const na = needAuth('#/panel/empleo/nuevo'); if (na) return na;
  const m = S.mine || await cargarMio(); const aprob = m.neg.filter(n => n.estado === 'aprobado');
  if (!aprob.length) return { html: `<div class="empty"><big>🏪</big>Necesitas un negocio <b>aprobado</b> para publicar ofertas.<br><br><a class="btn mini" href="#/panel">Volver</a></div>` };
  const pre = (location.hash.match(/n=([^&]+)/) || [])[1];
  return {
    html: `<form class="form" id="ef"><h2>💼 Nueva oferta de empleo</h2><p class="muted sm">Se publica 30 días después de ser aprobada.</p>
    <div class="f"><label>Negocio *</label><select name="negocioId" required>${aprob.map(n => `<option value="${esc(n.id)}" ${pre === n.id ? 'selected' : ''}>${esc(n.nombre)} (${PLAN_NAME[effPlan(n)]})</option>`).join('')}</select></div>
    <div class="f"><label>Cargo / vacante *</label><input type="text" name="titulo" required maxlength="80" placeholder="Ej: Vendedor/a de mostrador"></div>
    <div class="row2"><div class="f"><label>Tipo</label><select name="tipo">${['Tiempo completo', 'Medio tiempo', 'Por horas', 'Ocasional', 'Prácticas'].map(o => `<option>${o}</option>`).join('')}</select></div><div class="f"><label>Sueldo (opcional)</label><input type="text" name="sueldo" maxlength="30" placeholder="$470 + beneficios"></div></div>
    <div class="f"><label>Descripción y requisitos *</label><textarea name="descripcion" required maxlength="800"></textarea></div>
    <div class="f"><label>WhatsApp para postular</label><input type="tel" name="whatsapp" placeholder="Si lo dejas vacío usamos el del negocio"></div>
    <button class="btn green block" style="margin-top:18px" id="eb">Enviar para aprobación</button></form>`,
    after: () => {
      $('#ef').onsubmit = async e => {
        e.preventDefault(); const b = $('#eb'), v = Object.fromEntries(new FormData(e.target)), n = aprob.find(x => x.id === v.negocioId);
        const activas = m.emp.filter(x => x.negocioId === n.id && x.estado !== 'rechazado' && x.venceAt > Date.now()).length;
        if (activas >= LIM[effPlan(n)].jobs) return toast(`Tu plan ${PLAN_NAME[effPlan(n)]} permite ${LIM[effPlan(n)].jobs} oferta(s) activa(s). Mejora tu plan.`);
        busy(b, true, 'Enviando…');
        try { await addDoc(collection(db, 'empleos'), { ownerId: S.user.uid, negocioId: n.id, negocioNombre: n.nombre, titulo: v.titulo.trim(), tipo: v.tipo, sueldo: v.sueldo.trim(), descripcion: v.descripcion.trim(), whatsapp: v.whatsapp.trim(), estado: 'pendiente', createdAt: Date.now(), venceAt: Date.now() + 30 * DAY });
          S.mine = null; toast('✅ Oferta enviada para aprobación'); go('#/panel'); }
        catch (err) { busy(b, false); toast('Error: ' + (err.code || err.message)); }
      };
    }
  };
}

/* ---------- solicitud de plan ---------- */
function abrirPlan(tipo, plan, refId) {
  if (!S.user) { S.next = '#/planes'; toast('Primero inicia sesión'); return go('#/ingresar'); }
  (S.mine ? Promise.resolve(S.mine) : cargarMio()).then(m => {
    const refs = tipo === 'negocio' ? m.neg.filter(n => n.estado === 'aprobado') : (m.perf && m.perf.estado === 'aprobado' ? [m.perf] : []);
    if (!refs.length) { toast(tipo === 'negocio' ? 'Primero registra tu negocio y espera su aprobación' : 'Primero crea tu perfil y espera su aprobación'); return go(tipo === 'negocio' ? '#/panel/negocio/nuevo' : '#/panel/perfil'); }
    const c = S.cfg, precio = tipo === 'perfil' ? c.precioPerfilPremium : (plan === 'pro' ? c.precioPro : c.precioPremium);
    modal(`<h2>${plan === 'premium' ? '★' : '✔'} Plan ${PLAN_NAME[plan]} · $${esc(precio)}/mes</h2><p class="muted sm">1) Paga por transferencia/depósito. 2) Sube el comprobante. 3) El administrador activa tu plan.</p>
    <div class="box" style="margin-top:10px;white-space:pre-line;font-size:14px">${esc(c.datosPago)}</div>
    <form id="sf"><div class="f"><label>${tipo === 'negocio' ? 'Negocio' : 'Perfil'}</label><select name="ref">${refs.map(r => `<option value="${esc(r.id)}" ${refId === r.id ? 'selected' : ''}>${esc(r.nombre)}</option>`).join('')}</select></div>
    ${tipo === 'negocio' ? `<div class="f"><label>Plan</label><select name="plan"><option value="pro" ${plan === 'pro' ? 'selected' : ''}>Pro · $${esc(c.precioPro)}/mes</option><option value="premium" ${plan === 'premium' ? 'selected' : ''}>Premium · $${esc(c.precioPremium)}/mes</option></select></div>` : ''}
    <div class="f"><label>Meses a pagar</label><select name="meses"><option>1</option><option>3</option><option>6</option><option>12</option></select></div>
    <div class="f"><label>Comprobante de pago</label><div class="up"><span>🧾 Subir foto del comprobante</span><input type="file" accept="image/*" id="fcomp"><div id="pcomp"></div></div></div>
    <div class="f"><label>Nota (opcional)</label><input type="text" name="nota" maxlength="140"></div>
    <button class="btn gold block" style="margin-top:14px" id="sb">Enviar solicitud</button>
    ${c.whatsappAdmin ? `<a class="btn light block" style="margin-top:8px" target="_blank" rel="noopener" href="${waLink(c.whatsappAdmin, 'Hola, quiero activar el plan ' + PLAN_NAME[plan] + ' en Milagro Conecta.')}">💬 Hablar con el administrador</a>` : ''}
    <button type="button" class="btn ghost block" style="margin-top:8px;color:var(--muted)" data-act="cerrar">Cancelar</button></form>`);
    let comp = '';
    $('#fcomp').onchange = async e => { const fl = e.target.files[0]; if (!fl) return; comp = await comprimir(fl, 900, 250000); $('#pcomp').innerHTML = `<img src="${comp}">`; };
    $('#sf').onsubmit = async e => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(e.target)), b = $('#sb'); busy(b, true, 'Enviando…');
      try { await addDoc(collection(db, 'solicitudes'), { ownerId: S.user.uid, ownerEmail: S.user.email, tipo, refId: v.ref, refNombre: refs.find(r => r.id === v.ref).nombre, plan: tipo === 'perfil' ? 'premium' : v.plan, meses: +v.meses, comprobante: comp, nota: v.nota, estado: 'pendiente', createdAt: Date.now() });
        closeModal(); S.mine = null; toast('✅ Solicitud enviada. Te activaremos pronto.'); go('#/panel'); }
      catch (err) { busy(b, false); toast('Error: ' + (err.code || err.message)); }
    };
  });
}

/* ---------- administrador ---------- */
async function vAdmin() {
  const na = needAuth('#/admin'); if (na) return na;
  if (!S.isAdmin) return { html: `<div class="empty"><big>⛔</big><h3>Solo administradores</h3><p class="muted">Tu usuario no tiene permisos de administrador.<br><small>UID: ${esc(S.user.uid)}</small></p></div>` };
  const all = c => getDocs(query(collection(db, c), limit(1000))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() })));
  const [neg, perf, emp, sol] = await Promise.all([all('negocios'), all('perfiles'), all('empleos'), all('solicitudes')]);
  S.adm = { neg, perf, emp, sol: sol.sort((a, b) => b.createdAt - a.createdAt) };
  return { html: admHtml(), after: admAfter };
}
const pendientes = () => ({ neg: S.adm.neg.filter(x => x.estado === 'pendiente'), perf: S.adm.perf.filter(x => x.estado === 'pendiente'), emp: S.adm.emp.filter(x => x.estado === 'pendiente'), sol: S.adm.sol.filter(x => x.estado === 'pendiente') });
function admHtml() {
  const p = pendientes(), t = S.admTab, nP = p.neg.length + p.perf.length + p.emp.length;
  const tab = (k, l, n) => `<button class="${t === k ? 'on' : ''}" data-act="atabadm" data-v="${k}">${l}${n ? `<b>${n}</b>` : ''}</button>`;
  let body = '';
  if (t === 'pend') body = [...p.neg.map(x => admNeg(x)), ...p.perf.map(x => admPerf(x)), ...p.emp.map(x => admEmp(x))].join('') || '<div class="empty"><big>🎉</big>Nada pendiente.</div>';
  else if (t === 'sol') body = S.adm.sol.map(admSol).join('') || '<div class="empty">Sin solicitudes.</div>';
  else if (t === 'neg') body = S.adm.neg.map(x => admNeg(x, true)).join('') || '<div class="empty">Sin negocios.</div>';
  else if (t === 'perf') body = S.adm.perf.map(x => admPerf(x, true)).join('') || '<div class="empty">Sin perfiles.</div>';
  else if (t === 'emp') body = S.adm.emp.map(x => admEmp(x, true)).join('') || '<div class="empty">Sin ofertas.</div>';
  else body = admAjustes();
  const v = S.adm.neg.reduce((a, n) => a + (n.vistas || 0), 0);
  return `<h2 style="margin-top:20px">⚙️ Panel de administrador</h2>
  <div class="stats" style="grid-template-columns:repeat(4,1fr)"><div class="stat"><b>${S.adm.neg.length}</b><span>Negocios</span></div><div class="stat"><b>${S.adm.perf.length}</b><span>Perfiles</span></div><div class="stat"><b>${S.adm.neg.filter(n => effPlan(n) !== 'gratis').length}</b><span>De pago</span></div><div class="stat"><b>${v}</b><span>Vistas</span></div></div>
  <div class="tabs">${tab('pend', '🕒 Pendientes', nP)}${tab('sol', '💳 Pagos', p.sol.length)}${tab('neg', '🏪 Negocios')}${tab('perf', '🧑‍💼 Perfiles')}${tab('emp', '💼 Empleos')}${tab('cfg', '⚙️ Ajustes')}</div><div id="adm">${body}</div>`;
}
const admBtns = (col, x, full) => `<div class="bt">${x.estado !== 'aprobado' ? `<button class="btn mini green" data-act="aprob" data-c="${col}" data-id="${esc(x.id)}">✅ Aprobar</button>` : ''}${x.estado !== 'rechazado' ? `<button class="btn mini orange" data-act="rech" data-c="${col}" data-id="${esc(x.id)}">❌ Rechazar</button>` : ''}<button class="btn mini red" data-act="admdel" data-c="${col}" data-id="${esc(x.id)}">🗑</button></div>`;
const planCtl = (col, x) => `<div class="bt" style="align-items:center"><select data-pl="${esc(x.id)}" style="padding:6px;border-radius:8px;border:1.5px solid var(--line)">${['gratis', 'pro', 'premium'].filter(p => col === 'negocios' || p !== 'pro').map(p => `<option ${effPlan(x) === p ? 'selected' : ''}>${p}</option>`).join('')}</select><select data-mes="${esc(x.id)}" style="padding:6px;border-radius:8px;border:1.5px solid var(--line)"><option value="1">1 mes</option><option value="3">3</option><option value="6">6</option><option value="12">12</option></select><button class="btn mini" data-act="setplan" data-c="${col}" data-id="${esc(x.id)}">Aplicar plan</button>${col === 'negocios' ? `<button class="btn mini light" data-act="destacar" data-id="${esc(x.id)}">${x.destacado ? '★ Quitar destacado' : '☆ Destacar'}</button>` : ''}${effPlan(x) !== 'gratis' ? `<span class="tag o">hasta ${fdate(x.planHasta)}</span>` : ''}</div>`;
const admNeg = (x, full) => `<div class="li"><div class="th" style="background-image:url('${safeImg(x.imagen)}')"></div><div class="tx"><b>${esc(x.nombre)}</b> ${estTag(x.estado)}<span class="tag">${esc(x.categoria)}</span><p class="sm">${esc(clip(x.descripcion, 200))}</p><p class="sm muted">📞 ${esc(x.telefono)} · 📍 ${esc(x.direccion)} · <a style="color:var(--blue)" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${x.lat},${x.lng}">ver mapa</a> · <a style="color:var(--blue)" href="#/negocio/${esc(x.id)}">ver ficha</a></p>${x.motivo ? `<p class="sm" style="color:#c4203f">Motivo: ${esc(x.motivo)}</p>` : ''}${admBtns('negocios', x)}${full ? planCtl('negocios', x) : ''}</div></div>`;
const admPerf = (x, full) => `<div class="li"><div class="th" style="border-radius:50%;background-image:url('${safeImg(x.foto)}')"></div><div class="tx"><b>${esc(x.nombre)}</b> ${estTag(x.estado)}<p class="sm">${esc(x.titular)}</p><p class="sm muted">${esc(clip(x.resumen, 160))} · <a style="color:var(--blue)" href="#/perfil/${esc(x.id)}">ver perfil</a></p>${x.motivo ? `<p class="sm" style="color:#c4203f">Motivo: ${esc(x.motivo)}</p>` : ''}${admBtns('perfiles', x)}${full ? planCtl('perfiles', x) : ''}</div></div>`;
const admEmp = x => `<div class="li"><div class="tx"><b>💼 ${esc(x.titulo)}</b> ${estTag(x.estado)}<span class="tag">${esc(x.negocioNombre)}</span><p class="sm">${esc(clip(x.descripcion, 220))}</p><p class="sm muted">${esc(x.tipo)} ${x.sueldo ? '· ' + esc(x.sueldo) : ''} · vence ${fdate(x.venceAt)}</p>${admBtns('empleos', x)}</div></div>`;
const admSol = x => `<div class="li"><div class="tx"><b>Plan ${PLAN_NAME[x.plan]}</b> · ${esc(x.tipo)} · <b>${esc(x.refNombre)}</b> <span class="tag ${x.estado === 'activada' ? 'g' : x.estado === 'rechazada' ? 'r' : 'y'}">${esc(x.estado)}</span><p class="sm muted">${esc(x.ownerEmail)} · ${x.meses} mes(es) · ${fdate(x.createdAt)}${x.nota ? ' · “' + esc(x.nota) + '”' : ''}</p>${safeImg(x.comprobante) ? `<img src="${safeImg(x.comprobante)}" style="max-height:140px;border-radius:10px;margin-top:6px;cursor:zoom-in" data-act="zoom">` : '<p class="sm muted">Sin comprobante</p>'}
  ${x.estado === 'pendiente' ? `<div class="bt"><button class="btn mini green" data-act="activar" data-id="${esc(x.id)}">✅ Activar plan</button><button class="btn mini red" data-act="rechsol" data-id="${esc(x.id)}">Rechazar</button></div>` : ''}</div></div>`;
const admAjustes = () => { const c = S.cfg; return `<form class="form" id="cf" style="margin:14px 0"><h3>Ajustes generales</h3>
  <div class="row2"><div class="f"><label>Precio Pro ($/mes)</label><input type="number" step="0.5" name="precioPro" value="${esc(c.precioPro)}"></div><div class="f"><label>Precio Premium ($/mes)</label><input type="number" step="0.5" name="precioPremium" value="${esc(c.precioPremium)}"></div></div>
  <div class="f"><label>Precio Perfil Premium ($/mes)</label><input type="number" step="0.5" name="precioPerfilPremium" value="${esc(c.precioPerfilPremium)}"></div>
  <div class="f"><label>Tu WhatsApp (administrador)</label><input type="tel" name="whatsappAdmin" value="${esc(c.whatsappAdmin)}"></div>
  <div class="f"><label>Datos de pago (banco, cuenta, titular)</label><textarea name="datosPago">${esc(c.datosPago)}</textarea></div>
  <div class="f"><label>Anuncio en la barra superior (opcional)</label><input type="text" name="anuncio" maxlength="120" value="${esc(c.anuncio)}" placeholder="🎉 Black Friday: Premium a mitad de precio"></div>
  <button class="btn green block" style="margin-top:16px">Guardar ajustes</button></form>`; };
function admAfter() {
  const cf = $('#cf'); if (cf) cf.onsubmit = async e => { e.preventDefault(); const v = Object.fromEntries(new FormData(cf)); const d = { ...v, precioPro: +v.precioPro, precioPremium: +v.precioPremium, precioPerfilPremium: +v.precioPerfilPremium }; try { await setDoc(doc(db, 'config', 'general'), d); S.cfg = { ...S.cfg, ...d }; toast('✅ Ajustes guardados'); } catch (err) { toast('Error: ' + err.code); } };
}
const admRefresh = () => { $('#app').innerHTML = admHtml(); admAfter(); };
const admFind = (c, id) => S.adm[{ negocios: 'neg', perfiles: 'perf', empleos: 'emp' }[c]].find(x => x.id === id);
async function admSet(c, id, patch) { await updateDoc(doc(db, c, id), patch); Object.assign(admFind(c, id), patch); S.t = 0; }

/* ---------- acciones (delegación de eventos) ---------- */
const ACT = {
  cerrar: () => closeModal(),
  fav: (t, e) => { e.preventDefault(); e.stopPropagation(); const id = t.dataset.id; let f = favs(); f = f.includes(id) ? f.filter(x => x !== id) : [...f, id]; localStorage.setItem('mc_favs', JSON.stringify(f)); $$(`[data-act=fav][data-id="${CSS.escape(id)}"]`).forEach(b => b.classList.toggle('on', f.includes(id))); toast(f.includes(id) ? '❤️ Guardado en favoritos' : 'Quitado de favoritos'); if (S.f.fav && S.pintarNeg) S.pintarNeg(); },
  cat: t => { S.f.cat = t.dataset.v; if (location.hash.startsWith('#/negocios') && S.pintarNeg) S.pintarNeg(); else { S.f.q = ''; go('#/negocios'); } },
  flt: t => { const k = t.dataset.f; if (k === 'cerca' && !S.f.cerca && !S.loc) { navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => { S.loc = [p.coords.latitude, p.coords.longitude]; S.f.cerca = true; S.pintarNeg(); }, () => toast('Activa el permiso de ubicación')) : toast('Tu navegador no permite ubicación'); return; } S.f[k] = !S.f[k]; S.pintarNeg(); },
  share: async t => { const u = location.href, m = `${t.dataset.t} · Milagro Conecta`; if (navigator.share) { try { await navigator.share({ title: m, url: u }); } catch { } } else window.open('https://wa.me/?text=' + encodeURIComponent(m + '\n' + u), '_blank'); },
  zoom: t => modal(`<img src="${esc(t.src)}" style="width:100%;border-radius:14px"><button class="btn block" style="margin-top:10px" data-act="cerrar">Cerrar</button>`),
  print: () => window.print(),
  needlogin: () => { S.next = location.hash; toast('Inicia sesión para ver el contacto'); go('#/ingresar'); },
  plan: t => abrirPlan(t.dataset.t, t.dataset.p, t.dataset.id),
  atab: t => { S.mode = t.dataset.v; $$('.tabs button').forEach(b => b.classList.toggle('on', b === t)); const up = S.mode === 'up'; $('#fn').hidden = !up; $('#ab').textContent = up ? 'Crear mi cuenta' : 'Ingresar'; $('#ap').autocomplete = up ? 'new-password' : 'current-password'; },
  google: async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (err) { toast(authMsg(err)); } },
  reset: async (t, e) => { e.preventDefault(); const em = $('#ae').value.trim(); if (!em) return toast('Escribe tu correo arriba'); try { await sendPasswordResetEmail(auth, em); toast('📧 Te enviamos un correo para restablecer'); } catch (err) { toast(authMsg(err)); } },
  logout: async () => { await signOut(auth); toast('Sesión cerrada'); go('#/'); },
  mygps: () => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => S.setPin(p.coords.latitude, p.coords.longitude), () => toast('Activa el permiso de ubicación')) : toast('Sin soporte de ubicación'),
  rmgal: t => S.rmgal(+t.dataset.i),
  addexp: () => S.pf.addexp(), addedu: () => S.pf.addedu(), rmexp: t => S.pf.rmexp(+t.dataset.i), rmedu: t => S.pf.rmedu(+t.dataset.i),
  delneg: async t => { if (!confirm('¿Eliminar este negocio? No se puede deshacer.')) return; await deleteDoc(doc(db, 'negocios', t.dataset.id)); S.t = 0; toast('Negocio eliminado'); router(); },
  delperf: async () => { if (!confirm('¿Eliminar tu perfil?')) return; try { await deleteDoc(doc(db, 'perfiles', S.user.uid, 'contacto', 'datos')); } catch { } await deleteDoc(doc(db, 'perfiles', S.user.uid)); S.t = 0; toast('Perfil eliminado'); router(); },
  delemp: async t => { if (!confirm('¿Eliminar esta oferta?')) return; await deleteDoc(doc(db, 'empleos', t.dataset.id)); S.t = 0; toast('Oferta eliminada'); router(); },
  atabadm: t => { S.admTab = t.dataset.v; admRefresh(); },
  aprob: async t => { try { await admSet(t.dataset.c, t.dataset.id, { estado: 'aprobado', motivo: '' }); toast('✅ Aprobado'); admRefresh(); } catch (e) { toast('Error: ' + e.code); } },
  rech: async t => { const m = prompt('Motivo del rechazo (el usuario lo verá):', 'Falta información o la foto no es clara'); if (m === null) return; try { await admSet(t.dataset.c, t.dataset.id, { estado: 'rechazado', motivo: m }); toast('Rechazado'); admRefresh(); } catch (e) { toast('Error: ' + e.code); } },
  admdel: async t => { if (!confirm('¿Eliminar definitivamente?')) return; try { if (t.dataset.c === 'perfiles') { try { await deleteDoc(doc(db, 'perfiles', t.dataset.id, 'contacto', 'datos')); } catch { } } await deleteDoc(doc(db, t.dataset.c, t.dataset.id)); const k = { negocios: 'neg', perfiles: 'perf', empleos: 'emp' }[t.dataset.c]; S.adm[k] = S.adm[k].filter(x => x.id !== t.dataset.id); S.t = 0; admRefresh(); toast('Eliminado'); } catch (e) { toast('Error: ' + e.code); } },
  setplan: async t => { const id = t.dataset.id, pl = $(`[data-pl="${CSS.escape(id)}"]`).value, ms = +$(`[data-mes="${CSS.escape(id)}"]`).value; const patch = pl === 'gratis' ? { plan: 'gratis', planHasta: 0 } : { plan: pl, planHasta: Date.now() + ms * 30 * DAY }; try { await admSet(t.dataset.c, id, patch); toast('✅ Plan actualizado'); admRefresh(); } catch (e) { toast('Error: ' + e.code); } },
  destacar: async t => { const x = admFind('negocios', t.dataset.id); try { await admSet('negocios', x.id, { destacado: !x.destacado }); admRefresh(); } catch (e) { toast('Error: ' + e.code); } },
  activar: async t => { const s = S.adm.sol.find(x => x.id === t.dataset.id), col = s.tipo === 'perfil' ? 'perfiles' : 'negocios'; try { const cur = (await getDoc(doc(db, col, s.refId))).data() || {}; const base = Math.max(Date.now(), cur.planHasta || 0); await updateDoc(doc(db, col, s.refId), { plan: s.plan, planHasta: base + s.meses * 30 * DAY }); await updateDoc(doc(db, 'solicitudes', s.id), { estado: 'activada' }); s.estado = 'activada'; S.t = 0; toast('✅ Plan activado'); admRefresh(); } catch (e) { toast('Error: ' + e.code); } },
  rechsol: async t => { const s = S.adm.sol.find(x => x.id === t.dataset.id); await updateDoc(doc(db, 'solicitudes', s.id), { estado: 'rechazada' }); s.estado = 'rechazada'; admRefresh(); }
};
document.addEventListener('click', e => {
  const tr = e.target.closest('[data-track]'); if (tr) track('negocios', tr.dataset.id, tr.dataset.track);
  const t = e.target.closest('[data-act]'); if (t && ACT[t.dataset.act]) ACT[t.dataset.act](t, e);
});

/* ---------- PWA ---------- */
let dip; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); dip = e; $('#btnInstalar').hidden = false; });
$('#btnInstalar').onclick = async () => { if (!dip) return; dip.prompt(); await dip.userChoice; dip = null; $('#btnInstalar').hidden = true; };
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
