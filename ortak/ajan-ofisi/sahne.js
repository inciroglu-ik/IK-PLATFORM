/* ============================================================================
   AJAN OFİSİ · SAHNE — SVG kat planı, yürüyen karakterler, konuşma balonları
   Koordinatlar viewBox 1600×900 birimindedir. Bu modül iş mantığı bilmez;
   akis.js "yürü / konuş / çalış / dosya taşı" komutlarını verir.
   ============================================================================ */
import { ROLLER, ROL, ODALAR, kademeBilgisi } from './kadro.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 1600, H = 900, CY = 380;
const P = new URLSearchParams(location.search);
export const HIZ = Math.max(0.25, Math.min(200, Number(P.get('hiz')) || 1));

/* ---------------------------------------------------------------- kat planı */
const ODA_PLAN = {
  arastirma: { x: 20, y: 20, w: 450, h: 300, kapi: { x: 245, y: 320 }, ky: 250 },
  kreatif: { x: 490, y: 20, w: 590, h: 300, kapi: { x: 785, y: 320 }, ky: 250 },
  gm: { x: 1100, y: 20, w: 480, h: 300, kapi: { x: 1250, y: 320 }, ky: 262 },
  strateji: { x: 20, y: 440, w: 360, h: 440, kapi: { x: 200, y: 440 }, ky: 505 },
  toplanti: { x: 400, y: 440, w: 500, h: 440, kapi: { x: 650, y: 440 }, ky: 500 },
  teknoloji: { x: 920, y: 440, w: 320, h: 440, kapi: { x: 1080, y: 440 }, ky: 505 },
  yonetim: { x: 1260, y: 440, w: 320, h: 440, kapi: { x: 1420, y: 440 }, ky: 505 }
};
const MASA = {
  icerik_avcisi: { x: 130, y: 175 }, rakip_analisti: { x: 360, y: 175 },
  model_fotografcisi: { x: 600, y: 175 }, video_editor: { x: 785, y: 175 }, reklam_kreatifcisi: { x: 970, y: 175 },
  genel_mudur: { x: 1440, y: 92, via: [{ x: 1566, y: 92 }, { x: 1566, y: 262 }] },
  mentalite_kocu: { x: 110, y: 560 }, viral_tahmincisi: { x: 290, y: 560 },
  web_gelistirici: { x: 1010, y: 560 }, yazilimci: { x: 1160, y: 560 },
  ofis_muduru: { x: 1350, y: 560 }, muhasebeci: { x: 1500, y: 560 }
};
const SANDALYE = [
  { x: 560, y: 548 }, { x: 605, y: 548 }, { x: 650, y: 548 }, { x: 695, y: 548 }, { x: 740, y: 548 },
  { x: 497, y: 600 }, { x: 497, y: 645 }, { x: 497, y: 690 },
  { x: 803, y: 600 }, { x: 803, y: 645 }, { x: 803, y: 690 }
];
const ALT_ODA = (oda) => ODA_PLAN[oda].y > 300;

export const KONUM = {
  masa: (rol) => Object.assign({ oda: ROL[rol].oda }, MASA[rol]),
  masaOnu: (rol) => {
    if (rol === 'genel_mudur') return { oda: 'gm', x: 1440, y: 232 };
    const m = MASA[rol]; const alt = ALT_ODA(ROL[rol].oda);
    return { oda: ROL[rol].oda, x: m.x + 46, y: alt ? m.y - 6 : m.y + 8 };
  },
  sandalye: (i) => Object.assign({ oda: 'toplanti' }, SANDALYE[i % SANDALYE.length]),
  tahtaOnu: () => ({ oda: 'toplanti', x: 650, y: 772, via: [{ x: 862, y: 772 }, { x: 862, y: 500 }] }),
  pano: () => ({ oda: 'koridor', x: 96, y: 392 }),
  kahve: (i) => ({ oda: 'koridor', x: i ? 946 : 876, y: 398 }),
  giris: () => ({ oda: 'koridor', x: 26, y: CY })
};

/* ---------------------------------------------------------------- yol bulma (koridor ağı) */
function koridordanCikis(k) {
  if (k.oda === 'koridor') return [{ x: k.x, y: CY }];
  const o = ODA_PLAN[k.oda];
  const ic = k.via ? k.via.slice() : [{ x: k.x, y: o.ky }];
  return ic.concat([{ x: o.kapi.x, y: o.ky }, { x: o.kapi.x, y: o.kapi.y }, { x: o.kapi.x, y: CY }]);
}
function koridordanGiris(k) {
  if (k.oda === 'koridor') return [{ x: k.x, y: CY }, { x: k.x, y: k.y }];
  const o = ODA_PLAN[k.oda];
  const ic = k.via ? k.via.slice().reverse() : [{ x: k.x, y: o.ky }];
  return [{ x: o.kapi.x, y: CY }, { x: o.kapi.x, y: o.kapi.y }, { x: o.kapi.x, y: o.ky }].concat(ic, [{ x: k.x, y: k.y }]);
}
export function rota(a, b) {
  let yol;
  if (a.oda === b.oda && a.oda !== 'koridor') {
    const o = ODA_PLAN[a.oda];
    const cik = a.via ? a.via.slice() : [{ x: a.x, y: o.ky }];
    const gir = b.via ? b.via.slice().reverse() : [{ x: b.x, y: o.ky }];
    yol = cik.concat(gir, [{ x: b.x, y: b.y }]);
  } else if (a.oda === 'koridor' && b.oda === 'koridor') {
    yol = [{ x: a.x, y: CY }, { x: b.x, y: CY }, { x: b.x, y: b.y }];
  } else {
    yol = koridordanCikis(a).concat(koridordanGiris(b));
  }
  const temiz = [];
  for (const p of yol) { const s = temiz[temiz.length - 1]; if (!s || Math.abs(s.x - p.x) > 0.5 || Math.abs(s.y - p.y) > 0.5) temiz.push({ x: p.x, y: p.y }); }
  return temiz;
}

/* ---------------------------------------------------------------- SVG yardımcıları */
function el(tag, at, ebeveyn) {
  const e = document.createElementNS(NS, tag);
  for (const k in at || {}) if (at[k] != null) e.setAttribute(k, at[k]);
  if (ebeveyn) ebeveyn.appendChild(e);
  return e;
}
function yazi(ebeveyn, x, y, metin, at) { const t = el('text', Object.assign({ x, y }, at || {}), ebeveyn); t.textContent = metin; return t; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const KADIN = new Set(['Selin', 'Deniz', 'Ece', 'Defne', 'Melis', 'Irmak', 'Sinem', 'Nazlı', 'İpek', 'Derya', 'Sude', 'Lale', 'Asya', 'Ezgi', 'Damla', 'Nehir', 'Gizem', 'Tuba', 'Ilgın', 'Yağmur', 'Beren']);
const TEN = ['#f2cfac', '#e6b48a', '#c98d5f', '#f6dcc3', '#d9a273'];
const SAC = ['#2a1c12', '#4a3324', '#6e4f33', '#1d1d1f', '#8b6a49', '#3a2a22'];
function tohum(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); }

/* ---------------------------------------------------------------- sahne */
export function sahneKur(kap, { kadro, onAjanTik, kayit } = {}) {
  kap.innerHTML = '';
  kap.classList.add('ofis-sahne');
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Ajan ofisi kat planı', preserveAspectRatio: 'xMidYMid meet' }, kap);
  const katman = document.createElement('div'); katman.className = 'ofis-katman'; kap.appendChild(katman);

  /* --- tanımlar */
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <pattern id="zemin" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#f3f5f8"/><path d="M40 0H0V40" fill="none" stroke="#e6eaf0" stroke-width="1"/></pattern>
    <pattern id="halı" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#e4e9f1"/><circle cx="6" cy="6" r="0.9" fill="#d3dbe6"/></pattern>
    <linearGradient id="cam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dbe9f7" stop-opacity=".55"/><stop offset="1" stop-color="#c9dbee" stop-opacity=".25"/></linearGradient>
    <linearGradient id="gmZemin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f1e8"/><stop offset="1" stop-color="#efe6d6"/></linearGradient>
    <linearGradient id="ahsap" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9a77a"/><stop offset="1" stop-color="#a98457"/></linearGradient>
    <linearGradient id="masaUst" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9edf3"/></linearGradient>
    <filter id="golge" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#1a2a44" flood-opacity=".18"/></filter>
    <radialGradient id="ekranIsik" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9fd0ff" stop-opacity=".55"/><stop offset="1" stop-color="#9fd0ff" stop-opacity="0"/></radialGradient>`;

  /* --- zemin, koridor */
  el('rect', { x: 0, y: 0, width: W, height: H, fill: '#dfe4ec' }, svg);
  el('rect', { x: 10, y: 10, width: W - 20, height: H - 20, rx: 14, fill: 'url(#zemin)', stroke: '#9aa7ba', 'stroke-width': 4 }, svg);
  el('rect', { x: 12, y: 330, width: W - 24, height: 100, fill: 'url(#halı)' }, svg);
  el('rect', { x: 40, y: 370, width: W - 80, height: 20, rx: 10, fill: '#d6deea', opacity: .7 }, svg);
  yazi(svg, 800, 352, 'KORİDOR', { 'text-anchor': 'middle', class: 'sahne-etiket koridor' });

  /* --- odalar (cam duvar) */
  const odaKat = el('g', {}, svg);
  for (const [id, o] of Object.entries(ODA_PLAN)) {
    const g = el('g', { class: 'oda', 'data-oda': id }, odaKat);
    el('rect', { x: o.x, y: o.y, width: o.w, height: o.h, rx: 8, fill: id === 'gm' ? 'url(#gmZemin)' : id === 'toplanti' ? '#f1f4f9' : '#f7f9fc' }, g);
    el('rect', { x: o.x, y: o.y, width: o.w, height: o.h, rx: 8, fill: 'url(#cam)', stroke: '#7fa3c7', 'stroke-width': 3.5, 'stroke-opacity': .85 }, g);
    el('rect', { x: o.x + 4, y: o.y + 4, width: o.w - 8, height: o.h - 8, rx: 6, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.5, 'stroke-opacity': .8 }, g);
    /* kapı boşluğu */
    const alt = o.kapi.y >= o.y + o.h - 1;
    el('rect', { x: o.kapi.x - 30, y: o.kapi.y - 3, width: 60, height: 6, fill: alt ? '#e4e9f1' : '#e4e9f1' }, g);
    el('path', { d: `M${o.kapi.x - 30} ${o.kapi.y} h-6 M${o.kapi.x + 30} ${o.kapi.y} h6`, stroke: '#5f7f9f', 'stroke-width': 4 }, g);
    yazi(g, o.x + 16, o.y + 26, (ODALAR[id] || {}).ad ? ODALAR[id].ad.toLocaleUpperCase('tr') : id, { class: 'sahne-etiket' + (id === 'gm' ? ' gm' : '') });
  }

  /* --- mobilya */
  const mob = el('g', { class: 'mobilya' }, svg);
  const bitki = (x, y, r = 14) => { el('circle', { cx: x, cy: y, r: r + 3, fill: '#c9b48f' }, mob); el('circle', { cx: x, cy: y, r, fill: '#5f8f5a' }, mob); el('circle', { cx: x - r / 3, cy: y - r / 3, r: r / 2, fill: '#79a873' }, mob); };
  const masaCiz = (rol) => {
    const m = MASA[rol]; const alt = ALT_ODA(ROL[rol].oda);
    if (rol === 'genel_mudur') return;
    const my = alt ? m.y + 58 : m.y - 66;
    el('rect', { x: m.x - 70, y: my - 26, width: 140, height: 52, rx: 6, fill: 'url(#masaUst)', stroke: '#b8c3d3', 'stroke-width': 1.5, filter: 'url(#golge)' }, mob);
    const ey = alt ? my + 4 : my - 12;
    el('ellipse', { cx: m.x, cy: ey + 4, rx: 46, ry: 22, fill: 'url(#ekranIsik)', class: 'ekran-isik', 'data-rol': rol }, mob);
    el('rect', { x: m.x - 26, y: ey - 7, width: 52, height: 15, rx: 2.5, fill: '#1f2b3d' }, mob);
    el('rect', { x: m.x - 23, y: ey - 5, width: 46, height: 11, rx: 1.5, fill: '#3e6d9c', class: 'ekran', 'data-rol': rol }, mob);
    el('rect', { x: m.x + 34, y: my - 14, width: 20, height: 14, rx: 2, fill: '#e8dcc6' }, mob);
    el('circle', { cx: m.x - 44, cy: my - 8, r: 6, fill: '#ffffff', stroke: '#b9c4d4' }, mob);
    el('circle', { cx: m.x, cy: m.y + (alt ? -2 : 4), r: 15, fill: '#2f3b4f', opacity: .85 }, mob);
  };
  for (const r of ROLLER) masaCiz(r.id);
  /* genel müdür odası */
  el('rect', { x: 1300, y: 40, width: 270, height: 30, rx: 4, fill: '#8a6a45' }, mob);
  for (let i = 0; i < 6; i++) el('rect', { x: 1306 + i * 44, y: 44, width: 38, height: 22, rx: 2, fill: ['#b9774c', '#5f7f9f', '#c6a46b', '#4f6f5a', '#9b5a5a', '#5a5f8f'][i] }, mob);
  el('rect', { x: 1338, y: 136, width: 204, height: 62, rx: 8, fill: 'url(#ahsap)', stroke: '#7a5a37', 'stroke-width': 2, filter: 'url(#golge)' }, mob);
  el('rect', { x: 1404, y: 143, width: 72, height: 18, rx: 3, fill: '#1f2b3d' }, mob);
  el('rect', { x: 1407, y: 145, width: 66, height: 14, rx: 2, fill: '#3e6d9c', class: 'ekran', 'data-rol': 'genel_mudur' }, mob);
  el('circle', { cx: 1440, cy: 88, r: 19, fill: '#3a2d22' }, mob);
  el('rect', { x: 1140, y: 70, width: 70, height: 150, rx: 14, fill: '#6f839e' }, mob);
  el('rect', { x: 1148, y: 78, width: 54, height: 134, rx: 10, fill: '#8197b3' }, mob);
  el('rect', { x: 1226, y: 118, width: 54, height: 54, rx: 27, fill: 'url(#ahsap)' }, mob);
  el('rect', { x: 1300, y: 230, width: 120, height: 8, rx: 4, fill: '#b08d57', opacity: .5 }, mob);
  bitki(1130, 290, 16); bitki(1560, 290, 14);
  /* toplantı salonu */
  el('rect', { x: 520, y: 575, width: 260, height: 140, rx: 70, fill: 'url(#ahsap)', stroke: '#7a5a37', 'stroke-width': 2, filter: 'url(#golge)' }, mob);
  el('rect', { x: 560, y: 610, width: 180, height: 70, rx: 35, fill: '#b9966a', opacity: .55 }, mob);
  SANDALYE.forEach((s) => el('circle', { cx: s.x, cy: s.y, r: 13, fill: '#41506a', opacity: .9 }, mob));
  const tahtaG = el('g', { class: 'tahta' }, mob);
  el('rect', { x: 466, y: 798, width: 368, height: 72, rx: 5, fill: '#ffffff', stroke: '#8f9bb0', 'stroke-width': 3, filter: 'url(#golge)' }, tahtaG);
  el('rect', { x: 466, y: 866, width: 368, height: 6, rx: 2, fill: '#b9c3d2' }, tahtaG);
  const tahtaYazi = el('g', {}, tahtaG);
  yazi(tahtaYazi, 650, 840, 'TOPLANTI TAHTASI', { 'text-anchor': 'middle', class: 'tahta-bos' });
  /* diğer odalar */
  bitki(440, 290); bitki(46, 290); bitki(1050, 290); bitki(46, 850); bitki(355, 850); bitki(880, 850); bitki(1215, 850); bitki(1555, 850);
  for (const [x, y] of [[60, 760], [950, 760], [1290, 760]]) { el('rect', { x, y, width: 120, height: 46, rx: 10, fill: '#7d8fa8' }, mob); el('rect', { x: x + 6, y: y + 6, width: 108, height: 34, rx: 8, fill: '#93a5bd' }, mob); }
  el('rect', { x: 210, y: 700, width: 130, height: 26, rx: 4, fill: '#8a6a45' }, mob);
  el('rect', { x: 1110, y: 700, width: 110, height: 26, rx: 4, fill: '#8a6a45' }, mob);
  el('rect', { x: 1440, y: 700, width: 120, height: 26, rx: 4, fill: '#8a6a45' }, mob);
  /* kahve köşesi, giriş, sahip panosu */
  el('rect', { x: 884, y: 406, width: 54, height: 20, rx: 4, fill: '#5b4636' }, mob);
  el('rect', { x: 900, y: 398, width: 22, height: 14, rx: 3, fill: '#2a2f38' }, mob);
  yazi(mob, 911, 440, 'KAHVE', { 'text-anchor': 'middle', class: 'sahne-etiket kucuk' });
  el('rect', { x: 6, y: 345, width: 12, height: 70, rx: 3, fill: '#b08d57' }, mob);
  yazi(mob, 28, 346, 'GİRİŞ', { class: 'sahne-etiket kucuk' });
  el('rect', { x: 60, y: 404, width: 78, height: 22, rx: 3, fill: '#16294a' }, mob);
  el('rect', { x: 63, y: 407, width: 72, height: 16, rx: 2, fill: '#f6f1e8' }, mob);
  yazi(mob, 99, 419, 'NOTLARINIZ', { 'text-anchor': 'middle', class: 'pano-yazi' });
  const panoSay = yazi(mob, 140, 402, '', { class: 'pano-say', 'text-anchor': 'middle' });

  /* --- karakterler */
  const ajanKat = el('g', { class: 'ajanlar' }, svg);
  const A = {};
  function govdeCiz(a) {
    const g = a.govde; g.innerHTML = '';
    const ad = a.ad; const t = tohum(ad + a.rol);
    const ten = TEN[t % TEN.length], sac = SAC[(t >> 3) % SAC.length], kadin = KADIN.has(ad);
    el('ellipse', { cx: 0, cy: 18, rx: 15, ry: 5, fill: '#1a2a44', opacity: .18 }, g);
    if (kadin) el('path', { d: 'M-11 -14 Q-14 4 -9 8 L9 8 Q14 4 11 -14 Z', fill: sac }, g);
    el('path', { d: 'M-13 16 Q-13 0 0 0 Q13 0 13 16 Z', fill: ROL[a.rol].renk }, g);
    el('path', { d: 'M-4 2 L0 8 L4 2 Z', fill: '#ffffff', opacity: .9 }, g);
    el('circle', { cx: 0, cy: -9, r: 9.5, fill: ten }, g);
    el('path', { d: kadin ? 'M-10 -9 Q-10 -21 0 -20 Q10 -21 10 -9 Q6 -16 0 -15 Q-6 -16 -10 -9 Z' : 'M-9.5 -10 Q-10 -20 0 -20 Q10 -20 9.5 -10 Q5 -15 0 -14 Q-5 -15 -9.5 -10 Z', fill: sac }, g);
    el('circle', { cx: -3.2, cy: -8.5, r: 1.1, fill: '#1d1d1f' }, g); el('circle', { cx: 3.2, cy: -8.5, r: 1.1, fill: '#1d1d1f' }, g);
    a.etiket.textContent = ad;
  }
  for (const r of ROLLER) {
    const c = (kadro && kadro.calisanlar && kadro.calisanlar[r.id]) || { ad: r.baslangicAd, kademe: r.baslangicKademe };
    const m = KONUM.masa(r.id);
    const g = el('g', { class: 'ajan', 'data-rol': r.id, tabindex: 0, role: 'button', 'aria-label': r.ad + ' ' + c.ad }, ajanKat);
    const ic = el('g', {}, g);
    const govde = el('g', {}, ic);
    const dosya = el('g', { class: 'ajan-dosya', visibility: 'hidden' }, ic);
    el('rect', { x: 8, y: 2, width: 15, height: 12, rx: 1.5, fill: '#b08d57', stroke: '#7a5a37' }, dosya);
    el('rect', { x: 8, y: 0, width: 7, height: 4, rx: 1, fill: '#c9a46c' }, dosya);
    const kutu = el('g', { class: 'ajan-kutu', visibility: 'hidden' }, ic);
    el('rect', { x: -14, y: 2, width: 28, height: 16, rx: 2, fill: '#c9a77a', stroke: '#8a6a45' }, kutu);
    const nokta = el('g', { class: 'ajan-nokta', visibility: 'hidden' }, ic);
    el('rect', { x: -16, y: -44, width: 32, height: 15, rx: 7.5, fill: '#ffffff', stroke: '#c9d3e0' }, nokta);
    [-7, 0, 7].forEach((dx, i) => el('circle', { cx: dx, cy: -36.5, r: 2.2, fill: '#16294a', class: 'nk nk' + i }, nokta));
    const etiket = yazi(g, 0, 36, c.ad, { 'text-anchor': 'middle', class: 'ajan-ad' });
    const a = { rol: r.id, ad: c.ad, kademe: c.kademe, g, ic, govde, dosyaG: dosya, kutuG: kutu, noktaG: nokta, etiket, x: m.x, y: m.y, konum: m, yol: [], coz: null, durum: 'bos', gorunur: true, faz: Math.random() * 6 };
    A[r.id] = a; govdeCiz(a);
    g.addEventListener('click', () => onAjanTik && onAjanTik(r.id));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAjanTik && onAjanTik(r.id); } });
  }

  /* --- balonlar (HTML katmanı) */
  const balonlar = new Map();
  function balonKonumla(b, a) { b.style.left = (a.x / W * 100) + '%'; b.style.top = ((a.y - 30) / H * 100) + '%'; }

  /* --- canlandırma döngüsü */
  let onceki = performance.now();
  function kare(t) {
    const dt = Math.min(0.1, (t - onceki) / 1000); onceki = t;
    for (const a of Object.values(A)) {
      let yuruyor = false;
      if (a.yol.length) {
        yuruyor = true;
        let kalan = 150 * HIZ * dt;
        while (kalan > 0 && a.yol.length) {
          const h = a.yol[0]; const dx = h.x - a.x, dy = h.y - a.y; const d = Math.hypot(dx, dy);
          if (d <= kalan) { a.x = h.x; a.y = h.y; a.yol.shift(); kalan -= d; } else { a.x += dx / d * kalan; a.y += dy / d * kalan; kalan = 0; }
          if (Math.abs(dx) > 0.5) a.yon = dx < 0 ? -1 : 1;
        }
        if (!a.yol.length && a.coz) { const c = a.coz; a.coz = null; c(true); }
      }
      a.faz += dt * (yuruyor ? 12 : 2);
      const zipla = yuruyor ? Math.abs(Math.sin(a.faz)) * -3 : Math.sin(a.faz) * 0.6;
      a.g.setAttribute('transform', `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)})`);
      a.ic.setAttribute('transform', `translate(0 ${zipla.toFixed(2)})`);
      const b = balonlar.get(a.rol); if (b) balonKonumla(b, a);
    }
    requestAnimationFrame(kare);
  }
  requestAnimationFrame(kare);

  /* --- dış API */
  const api = {
    HIZ, KONUM,
    ajan: (rol) => A[rol],
    bekle: (ms) => new Promise((r) => setTimeout(r, Math.max(20, ms / HIZ))),
    yuru(rol, hedef) {
      const a = A[rol]; if (!a) return Promise.resolve(false);
      if (a.coz) { const c = a.coz; a.coz = null; c(false); }
      const yol = rota(a.konum, hedef);
      a.konum = hedef;
      if (document.hidden || HIZ >= 60) { const s = yol[yol.length - 1] || hedef; a.x = s.x; a.y = s.y; a.yol = []; return Promise.resolve(true); }
      a.yol = yol;
      return new Promise((coz) => { a.coz = coz; });
    },
    konus(rol, metin, ms) {
      const a = A[rol]; if (!a || !metin) return Promise.resolve();
      const sure = ms || Math.min(9000, 1800 + String(metin).length * 45);
      let b = balonlar.get(rol);
      if (!b) { b = document.createElement('div'); b.className = 'ofis-balon'; katman.appendChild(b); balonlar.set(rol, b); }
      const kisa = String(metin).length > 170 ? String(metin).slice(0, 167).trim() + '…' : String(metin);
      b.innerHTML = '<b>' + esc(a.ad) + '</b>' + esc(kisa);
      b.classList.toggle('gm', rol === 'genel_mudur');
      balonKonumla(b, a);
      b.classList.remove('gizle'); void b.offsetWidth; b.classList.add('goster');
      const id = (b._id = (b._id || 0) + 1);
      kayit && kayit({ tur: 'konusma', rol, ad: a.ad, metin: String(metin) });
      return new Promise((r) => setTimeout(() => { if (b._id === id) { b.classList.remove('goster'); b.classList.add('gizle'); } r(); }, Math.max(60, sure / HIZ)));
    },
    durum(rol, d) {
      const a = A[rol]; if (!a) return; a.durum = d;
      a.noktaG.setAttribute('visibility', d === 'calisiyor' || d === 'dusunuyor' ? 'visible' : 'hidden');
      a.g.classList.toggle('calisiyor', d === 'calisiyor'); a.g.classList.toggle('dusunuyor', d === 'dusunuyor');
      svg.querySelectorAll(`.ekran[data-rol="${rol}"], .ekran-isik[data-rol="${rol}"]`).forEach((e) => e.classList.toggle('acik', d === 'calisiyor'));
    },
    dosya(rol, var_) { const a = A[rol]; if (a) a.dosyaG.setAttribute('visibility', var_ ? 'visible' : 'hidden'); },
    kutu(rol, var_) { const a = A[rol]; if (a) a.kutuG.setAttribute('visibility', var_ ? 'visible' : 'hidden'); },
    gizle(rol, gizli) { const a = A[rol]; if (a) { a.g.style.display = gizli ? 'none' : ''; a.gorunur = !gizli; } },
    isimGuncelle(rol, ad, kademe) { const a = A[rol]; if (!a) return; a.ad = ad; if (kademe != null) a.kademe = kademe; a.g.setAttribute('aria-label', ROL[rol].ad + ' ' + ad); govdeCiz(a); },
    isinlan(rol, k) { const a = A[rol]; if (!a) return; if (a.coz) { const c = a.coz; a.coz = null; c(false); } a.yol = []; a.konum = k; a.x = k.x; a.y = k.y; },
    yuruyorMu(rol) { const a = A[rol]; return !!(a && a.yol.length); },
    panoSayisi(n) { panoSay.textContent = n ? String(n) : ''; },
    tahta(t) {
      tahtaYazi.innerHTML = '';
      let kart = katman.querySelector('.ofis-tahta');
      if (!t) { yazi(tahtaYazi, 650, 840, 'TOPLANTI TAHTASI', { 'text-anchor': 'middle', class: 'tahta-bos' }); if (kart) kart.classList.add('gizle'); return; }
      yazi(tahtaYazi, 478, 818, (t.baslik || '').slice(0, 46), { class: 'tahta-baslik' });
      (t.adimlar || []).slice(0, 4).forEach((s, i) => yazi(tahtaYazi, 478 + (i % 2) * 180, 838 + Math.floor(i / 2) * 18, (i + 1) + '. ' + (ROL[s.rol] ? ROL[s.rol].ad : s.rol), { class: 'tahta-satir' }));
      if (t.kart === false) { if (kart) kart.classList.add('gizle'); return; }
      if (!kart) { kart = document.createElement('div'); kart.className = 'ofis-tahta'; katman.appendChild(kart); }
      kart.classList.remove('gizle');
      kart.innerHTML = '<div class="ot-ust">Toplantı tahtası</div><div class="ot-baslik">' + esc(t.baslik || 'Yeni iş') + '</div>' +
        (t.adimlar && t.adimlar.length ? '<ol>' + t.adimlar.map((s, i) => '<li class="' + (i === t.aktif ? 'aktif' : '') + '"><span class="ot-rol" style="--r:' + (ROL[s.rol] ? ROL[s.rol].renk : '#16294a') + '">' + esc(ROL[s.rol] ? ROL[s.rol].ad : s.rol) + '</span>' + esc(s.gorev || '') + '</li>').join('') + '</ol>' : '<div class="ot-bekle">Genel Müdür işi inceliyor…</div>');
    }
  };
  return api;
}

export function kademeEtiketi(k) { const b = kademeBilgisi(k); return b.ad + ' · ' + b.effort; }
