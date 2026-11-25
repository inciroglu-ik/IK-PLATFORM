/* ============================================================================
   AJAN OFİSİ · 3B SAHNE (25.11.2026) — three.js (CDN, build yok)
   sahne.js ile AYNI dış API: yuru / konus / durum / dosya / kutu / gizle / isimGuncelle / isinlan / yuruyorMu /
   panoSayisi / tahta / fikirSayisi / fikirKarti + kamera (gezinme). Kat planı (oda, masa, yol) sahne.js'ten gelir;
   iş akışı (akis.js) hiçbir değişiklik olmadan iki sahnede de çalışır.
   Koordinat: kat planı 1600×900 birim = 16×9 m (1 birim = 1 cm); plan x → X, plan y → Z, yükseklik → Y.
   Gezinme: ok tuşları / WASD ilerle, Q/E dön, R/F eğim, +/− yakınlaş, fare sürükle (döndür), sağ tuş ya da
   Shift + sürükle (kaydır), tekerlek (yakınlaş), kişiye çift tıkla (takip), oda düğmeleri (kamera odaya uçar).
   ============================================================================ */
import { ROLLER, ROL, ODALAR } from './kadro.js';
import { KONUM, rota, HIZ, ODA_PLAN, MASA, SANDALYE, TOPLANTI_MASASI, masaMerkezi, W, H, KADIN, TEN, SAC, tohum } from './sahne.js';

const THREE_ADRES = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const OLCEK = 0.01;
const X = (x) => (x - W / 2) * OLCEK;
const Z = (y) => (y - H / 2) * OLCEK;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ODA_ZEMIN = { arastirma: '#f2f5f9', kreatif: '#f6f3ee', gm: '#efe6d6', strateji: '#f3f2f8', toplanti: '#e8edf4', teknoloji: '#eef3f8', yonetim: '#f1f5f0' };
export const GEZINTI_ODALARI = [
  ['genel', 'Genel görünüm'], ['arastirma', 'Araştırma'], ['kreatif', 'Kreatif'], ['gm', 'Genel Müdür'],
  ['strateji', 'Strateji'], ['toplanti', 'Toplantı'], ['teknoloji', 'Teknoloji'], ['yonetim', 'Yönetim'], ['kahve', 'Kahve']
];

export function webglVar() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
  catch (e) { return false; }
}

export async function sahne3dKur(kap, { kadro, onAjanTik, kayit, klavyeIzni } = {}) {
  if (!webglVar()) return null;
  let THREE;
  try { THREE = await import(THREE_ADRES); } catch (e) { return null; }

  kap.innerHTML = '';
  kap.classList.add('ofis-sahne', 'ofis-3b');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  const tuval = renderer.domElement;
  tuval.className = 'ofis-tuval'; tuval.tabIndex = 0;
  tuval.setAttribute('role', 'application');
  tuval.setAttribute('aria-label', 'Üç boyutlu ofis. Ok tuşları ya da W A S D ile gezinin, Q ve E ile dönün, fareyle sürükleyin, tekerlekle yaklaşın.');
  kap.appendChild(tuval);
  const katman = document.createElement('div'); katman.className = 'ofis-katman'; kap.appendChild(katman);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dde3ec');
  scene.fog = new THREE.Fog('#dde3ec', 30, 55);
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 140);

  /* ------------------------------------------------------------ ışık */
  scene.add(new THREE.HemisphereLight('#ffffff', '#aab6c8', 0.85));
  const gunes = new THREE.DirectionalLight('#fff4e3', 1.55);
  gunes.position.set(-5.5, 14, 8.5); gunes.castShadow = true;
  gunes.shadow.mapSize.set(2048, 2048);
  Object.assign(gunes.shadow.camera, { left: -10, right: 10, top: 7, bottom: -7, near: 1, far: 40 });
  gunes.shadow.bias = -0.0004; gunes.shadow.normalBias = 0.025;
  scene.add(gunes);
  const dolgu = new THREE.DirectionalLight('#dbe6ff', 0.35); dolgu.position.set(9, 7, -7); scene.add(dolgu);

  /* ------------------------------------------------------------ malzeme + geometri yardımcıları */
  const M = (renk, o) => new THREE.MeshStandardMaterial(Object.assign({ color: renk, roughness: 0.75, metalness: 0 }, o || {}));
  const mat = {
    cam: new THREE.MeshStandardMaterial({ color: '#d6e7f6', transparent: true, opacity: 0.12, roughness: 0.08, metalness: 0.1, depthWrite: false }),
    cerceve: M('#b3bdca', { metalness: 0.45, roughness: 0.4 }), duvar: M('#f4f6f9', { roughness: 0.9 }), supurgelik: M('#c7d0dc'),
    masa: M('#f8f9fb', { roughness: 0.45 }), masaAyak: M('#3a4352', { metalness: 0.45, roughness: 0.45 }),
    ahsap: M('#a98457', { roughness: 0.55 }), ahsapKoyu: M('#7a5a37', { roughness: 0.6 }), sandalye: M('#2f3b4f', { roughness: 0.6 }),
    monitor: M('#1f2b3d', { roughness: 0.35, metalness: 0.2 }), klavye: M('#d6dce5'), saksi: M('#c9b48f'), yaprak: M('#5f8f5a'), yaprak2: M('#79a873'),
    hali: M('#e1e7ef', { roughness: 0.95 }), beyaz: M('#ffffff', { roughness: 0.5 }), kanepe: M('#6f839e', { roughness: 0.85 }), kumas: M('#8197b3', { roughness: 0.9 }),
    metal: M('#b8c3d3', { metalness: 0.6, roughness: 0.3 }), makine: M('#2a2f38', { metalness: 0.5, roughness: 0.35 }), tezgah: M('#5b4636', { roughness: 0.6 }),
    kagit: M('#fbf8f0', { roughness: 0.9 }), pirinc: M('#b08d57', { metalness: 0.5, roughness: 0.35 }), kutu: M('#c9a77a', { roughness: 0.9 }), lacivert: M('#16294a', { roughness: 0.6 })
  };
  function ekle(me, ebeveyn, golge) { me.castShadow = golge !== false; me.receiveShadow = true; (ebeveyn || scene).add(me); return me; }
  function kutu(w, h, d, m, x, y, z, ebeveyn, golge) { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); return ekle(me, ebeveyn, golge); }
  function silindir(rt, rb, h, m, x, y, z, ebeveyn, seg) { const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 24), m); me.position.set(x, y, z); return ekle(me, ebeveyn); }
  function kure(r, m, x, y, z, ebeveyn) { const me = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); me.position.set(x, y, z); return ekle(me, ebeveyn); }
  /* plan dikdörtgeni → kutu (alt yükseklik y0, yükseklik h) */
  function planKutu(px, py, pw, ph, h, m, y0, golge) { return kutu(pw * OLCEK, h, ph * OLCEK, m, X(px + pw / 2), (y0 || 0) + h / 2, Z(py + ph / 2), null, golge); }

  /* Yazı dokuları Inter yüklenmeden çizilirse yedek fontla kalır → font hazır olunca sabit etiketler yeniden çizilir */
  const SABIT_DOKULAR = [];
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const t of SABIT_DOKULAR) if (!t.userData.dinamik) dokuYenile(t); }).catch(() => {});
  /* tuval yazısı → doku (Türkçe karakterler doğrudan, keskin olsun diye 2×) */
  function yaziDokusu(gen, yuk, ciz) {
    const c = document.createElement('canvas'); c.width = gen; c.height = yuk; const g = c.getContext('2d');
    ciz(g, gen, yuk);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.userData = { c, g, ciz };
    return t;
  }
  function dokuYenile(t, ciz) { const { c, g } = t.userData; g.clearRect(0, 0, c.width, c.height); (ciz || t.userData.ciz)(g, c.width, c.height); t.needsUpdate = true; }
  function etiketSprite(metin, { yaziRengi, zemin, boy, genislik, harf } = {}) {
    const gen = genislik || 1024, yuk = 160;
    const ciz = (g, w, h) => {
      g.font = '600 ' + (harf || 64) + 'px Inter, "Segoe UI", sans-serif';
      const tw = Math.min(w - 20, g.measureText(metin).width + 60);
      if (zemin) { g.fillStyle = zemin; const r = 26, x0 = (w - tw) / 2, y0 = 28; g.beginPath(); g.roundRect(x0, y0, tw, h - 56, r); g.fill(); }
      g.fillStyle = yaziRengi || '#3f5370'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.letterSpacing = '6px'; g.fillText(metin, w / 2, h / 2 + 2);
    };
    const t = yaziDokusu(gen, yuk, ciz); SABIT_DOKULAR.push(t);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    const b = boy || 0.42; s.scale.set(b * gen / yuk, b, 1); s.renderOrder = 5;
    s.userData.doku = t;
    return s;
  }

  /* zemine yazılı işaret (oda adları): yatay düzlem, yazı tuvalden */
  function zeminYazisi(metin, x, z, genislik, renk) {
    const gen = 1024, yuk = 128;
    const ciz = (g, w, h) => {
      g.font = '700 60px Inter, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '10px';
      g.fillStyle = renk || '#4a5d7a'; g.globalAlpha = 0.82; g.fillText(metin, w / 2, h / 2 + 2); g.globalAlpha = 1;
    };
    const t = yaziDokusu(gen, yuk, ciz); SABIT_DOKULAR.push(t);
    const gw = Math.max(1.4, genislik || 2.4), gh = gw * yuk / gen;
    const me = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    me.rotation.x = -Math.PI / 2; me.position.set(x, 0.026, z); me.renderOrder = 1; scene.add(me);
    return me;
  }
  /* ------------------------------------------------------------ zemin, dış duvarlar, koridor */
  const zeminDoku = yaziDokusu(512, 512, (g, w) => {
    g.fillStyle = '#eef1f5'; g.fillRect(0, 0, w, w); g.strokeStyle = '#dfe5ed'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, w); g.stroke(); g.beginPath(); g.moveTo(0, i * w / 4); g.lineTo(w, i * w / 4); g.stroke(); }
  });
  zeminDoku.wrapS = zeminDoku.wrapT = THREE.RepeatWrapping; zeminDoku.repeat.set(8, 4.5);
  const zemin = new THREE.Mesh(new THREE.PlaneGeometry(16.4, 9.4), M('#ffffff', { map: zeminDoku, roughness: 0.92 }));
  zemin.rotation.x = -Math.PI / 2; zemin.receiveShadow = true; scene.add(zemin);
  /* çevre (dış zemin) */
  const dis = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), M('#d3dae4', { roughness: 1 })); dis.rotation.x = -Math.PI / 2; dis.position.y = -0.02; dis.receiveShadow = true; scene.add(dis);
  planKutu(12, 330, 1576, 100, 0.012, mat.hali, 0, false);
  /* dış duvarlar: arka + iki yan tam boy; ön kesik (içeri bakılır) */
  planKutu(10, 2, 1580, 12, 2.7, mat.duvar, 0);
  planKutu(-2, 2, 12, 343, 2.7, mat.duvar, 0); planKutu(-2, 417, 12, 483, 2.7, mat.duvar, 0);
  planKutu(1590, 2, 12, 896, 2.7, mat.duvar, 0);
  planKutu(10, 888, 1580, 10, 0.14, mat.supurgelik, 0);
  /* giriş */
  planKutu(-2, 340, 14, 6, 2.4, mat.pirinc, 0); planKutu(-2, 412, 14, 6, 2.4, mat.pirinc, 0); planKutu(-2, 340, 14, 78, 0.12, mat.pirinc, 2.3);
  planKutu(14, 352, 70, 56, 0.01, mat.lacivert, 0.012, false);
  const girisEt = etiketSprite('GİRİŞ', { yaziRengi: '#8a6a45', boy: 0.3 }); girisEt.position.set(X(40), 2.75, Z(380)); scene.add(girisEt);

  /* ------------------------------------------------------------ odalar (cam bölme, kapı boşluğu) */
  function camDuvar(x1, y1, x2, y2) {
    const yatay = Math.abs(y1 - y2) < 0.5; const uz = (yatay ? Math.abs(x2 - x1) : Math.abs(y2 - y1)) * OLCEK; if (uz < 0.06) return;
    const g = new THREE.Group(); g.position.set(X((x1 + x2) / 2), 0, Z((y1 + y2) / 2)); if (!yatay) g.rotation.y = Math.PI / 2;
    const cam = new THREE.Mesh(new THREE.BoxGeometry(uz, 2.26, 0.025), mat.cam); cam.position.y = 1.17; cam.renderOrder = 2; g.add(cam);
    kutu(uz, 0.08, 0.06, mat.cerceve, 0, 0.04, 0, g, false); kutu(uz, 0.035, 0.05, mat.cerceve, 0, 2.31, 0, g, false);
    /* dikmeler seyrek (yaklaşık 2,4 m'de bir): kuşbakışı görüntü kalabalıklaşmasın */
    const n = Math.max(1, Math.round(uz / 2.4)); for (let i = 0; i <= n; i++) kutu(0.03, 2.3, 0.05, mat.cerceve, -uz / 2 + uz * i / n, 1.17, 0, g, false);
    scene.add(g);
  }
  const ODA_ETIKET = {};
  for (const [id, o] of Object.entries(ODA_PLAN)) {
    planKutu(o.x, o.y, o.w, o.h, 0.008, M(ODA_ZEMIN[id] || '#f4f6f9', { roughness: 0.9 }), 0.012, false);
    const kapiYari = 46;
    const kenarlar = [[o.x, o.y, o.x + o.w, o.y], [o.x, o.y + o.h, o.x + o.w, o.y + o.h], [o.x, o.y, o.x, o.y + o.h], [o.x + o.w, o.y, o.x + o.w, o.y + o.h]];
    for (const [x1, y1, x2, y2] of kenarlar) {
      const yatay = y1 === y2;
      if (yatay && Math.abs(o.kapi.y - y1) < 2) {
        camDuvar(x1, y1, o.kapi.x - kapiYari, y1); camDuvar(o.kapi.x + kapiYari, y1, x2, y2);
        planKutu(o.kapi.x - kapiYari - 4, y1 - 4, 8, 8, 2.34, mat.cerceve, 0); planKutu(o.kapi.x + kapiYari - 4, y1 - 4, 8, 8, 2.34, mat.cerceve, 0);
      } else camDuvar(x1, y1, x2, y2);
    }
    /* oda adı: kapı tarafında zemine yazılı işaret (havada asılı etiket ad etiketleriyle çakışıyordu) */
    const kapiAltta = Math.abs(o.kapi.y - (o.y + o.h)) < 2;
    const ez = kapiAltta ? o.y + o.h - 42 : o.y + 34;
    ODA_ETIKET[id] = zeminYazisi(((ODALAR[id] || {}).ad || id).toLocaleUpperCase('tr'), X(o.x + o.w / 2), Z(ez), Math.min(o.w * OLCEK * 0.78, 3.0), id === 'gm' ? '#8a6a45' : '#4a5d7a');
  }

  /* ------------------------------------------------------------ mobilya */
  function bitki(px, py, r) {
    const s = (r || 14) / 14;
    silindir(0.16 * s, 0.12 * s, 0.34 * s, mat.saksi, X(px), 0.17 * s, Z(py));
    kure(0.26 * s, mat.yaprak, X(px), 0.55 * s, Z(py)); kure(0.17 * s, mat.yaprak2, X(px) - 0.08 * s, 0.72 * s, Z(py) - 0.05 * s);
  }
  function ofisSandalyesi(px, py, yonY, ebeveyn) {
    const g = new THREE.Group(); g.position.set(X(px), 0, Z(py)); g.rotation.y = yonY;
    silindir(0.03, 0.03, 0.4, mat.metal, 0, 0.22, 0, g);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const k = kutu(0.3, 0.025, 0.04, mat.masaAyak, Math.sin(a) * 0.14, 0.03, Math.cos(a) * 0.14, g, false); k.rotation.y = a + Math.PI / 2; }
    kutu(0.46, 0.08, 0.46, mat.sandalye, 0, 0.46, 0, g);
    kutu(0.46, 0.5, 0.06, mat.sandalye, 0, 0.78, -0.24, g);
    (ebeveyn || scene).add(g); return g;
  }
  const ekranMat = {};
  function calismaMasasi(rol) {
    const m = MASA[rol], mm = masaMerkezi(rol); if (!m || !mm) return;
    const asagi = mm.y > m.y;            /* masa çalışanın güneyinde mi (alt odalar) */
    const yon = Math.atan2(mm.x - m.x, mm.y - m.y);
    const g = new THREE.Group(); g.position.set(X(mm.x), 0, Z(mm.y)); scene.add(g);
    kutu(1.4, 0.04, 0.62, mat.masa, 0, 0.74, 0, g);
    for (const sx of [-0.64, 0.64]) for (const sz of [-0.25, 0.25]) kutu(0.04, 0.72, 0.04, mat.masaAyak, sx, 0.36, sz, g);
    kutu(1.3, 0.3, 0.02, mat.masaAyak, 0, 0.55, asagi ? 0.28 : -0.28, g, false);   /* modesty panel */
    const ekranZ = asagi ? 0.16 : -0.16, ekranYon = asagi ? Math.PI : 0;
    const ekG = new THREE.Group(); ekG.position.set(0, 0.76, ekranZ); ekG.rotation.y = ekranYon; g.add(ekG);
    kutu(0.18, 0.015, 0.14, mat.monitor, 0, 0.008, 0, ekG); kutu(0.04, 0.2, 0.03, mat.monitor, 0, 0.11, -0.02, ekG);
    kutu(0.64, 0.38, 0.035, mat.monitor, 0, 0.36, 0, ekG);
    const em = new THREE.MeshStandardMaterial({ color: '#1b2a3d', emissive: new THREE.Color('#3e6d9c'), emissiveIntensity: 0.35, roughness: 0.3 });
    ekranMat[rol] = em;
    const yuz = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.32), em); yuz.position.set(0, 0.36, 0.019); yuz.userData.dinamik = true; ekG.add(yuz);
    kutu(0.42, 0.02, 0.14, mat.klavye, 0.02, 0.77, asagi ? -0.12 : 0.12, g, false);
    silindir(0.04, 0.035, 0.09, mat.beyaz, -0.5, 0.8, asagi ? -0.08 : 0.08, g);
    kutu(0.22, 0.01, 0.3, mat.kagit, 0.48, 0.765, asagi ? -0.05 : 0.05, g, false).rotation.y = 0.2;
    ofisSandalyesi(m.x, m.y + (asagi ? -6 : 6), yon);   /* oturan kişi 6 birim geriye kayar (pozUygula) */
  }
  for (const r of ROLLER) if (r.id !== 'genel_mudur') calismaMasasi(r.id);
  /* Genel Müdür odası */
  (function gmOdasi() {
    const mm = masaMerkezi('genel_mudur');
    const g = new THREE.Group(); g.position.set(X(mm.x), 0, Z(mm.y)); scene.add(g);
    kutu(2.0, 0.06, 0.66, mat.ahsap, 0, 0.75, 0, g); kutu(1.9, 0.7, 0.04, mat.ahsapKoyu, 0, 0.38, 0.3, g); kutu(0.05, 0.72, 0.6, mat.ahsapKoyu, -0.95, 0.37, 0, g); kutu(0.05, 0.72, 0.6, mat.ahsapKoyu, 0.95, 0.37, 0, g);
    /* monitör masanın uzak kenarında, ekran Genel Müdür'e (kuzeye) bakar */
    const ekG = new THREE.Group(); ekG.position.set(0, 0.78, 0.14); ekG.rotation.y = Math.PI; g.add(ekG);
    kutu(0.22, 0.015, 0.16, mat.monitor, 0, 0.008, 0, ekG); kutu(0.04, 0.22, 0.03, mat.monitor, 0, 0.12, -0.02, ekG); kutu(0.74, 0.42, 0.035, mat.monitor, 0, 0.4, 0, ekG);
    const em = new THREE.MeshStandardMaterial({ color: '#1b2a3d', emissive: new THREE.Color('#3e6d9c'), emissiveIntensity: 0.35, roughness: 0.3 }); ekranMat.genel_mudur = em;
    const yuz = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.36), em); yuz.position.set(0, 0.4, 0.019); yuz.userData.dinamik = true; ekG.add(yuz);
    /* yüksek arkalıklı koltuk (masaya, güneye bakar) */
    const k = ofisSandalyesi(1440, 86, 0);
    kutu(0.5, 0.42, 0.06, mat.lacivert, 0, 1.18, -0.24, k);
    /* kitaplık */
    planKutu(1300, 30, 270, 34, 1.9, mat.ahsapKoyu, 0);
    const kitap = ['#b9774c', '#5f7f9f', '#c6a46b', '#4f6f5a', '#9b5a5a', '#5a5f8f', '#8a6a45'].map((c) => M(c));
    for (let raf = 0; raf < 4; raf++) for (let i = 0; i < 12; i++) planKutu(1308 + i * 21.5, 46, 16, 14, 0.26 + ((i * 7 + raf * 3) % 5) * 0.03, kitap[(i + raf * 2) % kitap.length], 0.12 + raf * 0.45, false);
    /* kanepe + sehpa */
    planKutu(1140, 70, 70, 150, 0.42, mat.kanepe, 0); planKutu(1140, 70, 18, 150, 0.8, mat.kanepe, 0); planKutu(1148, 80, 54, 130, 0.08, mat.kumas, 0.42);
    silindir(0.27, 0.27, 0.05, mat.ahsap, X(1253), 0.42, Z(145)); silindir(0.04, 0.04, 0.4, mat.metal, X(1253), 0.2, Z(145));
    planKutu(1300, 228, 120, 10, 0.01, mat.pirinc, 0.02, false);
    bitki(1130, 290, 16); bitki(1560, 290, 14);
  })();
  /* toplantı salonu: elips masa, sandalyeler, tahta */
  const TM = TOPLANTI_MASASI;
  const tMasa = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 64), mat.ahsap); tMasa.scale.set(TM.rx * OLCEK, 1, TM.ry * OLCEK); tMasa.position.set(X(TM.x), 0.75, Z(TM.y)); ekle(tMasa);
  const tIc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.005, 64), M('#b9966a', { roughness: 0.5 })); tIc.scale.set(TM.rx * OLCEK * 0.7, 1, TM.ry * OLCEK * 0.55); tIc.position.set(X(TM.x), 0.783, Z(TM.y)); ekle(tIc, null, false);
  silindir(0.08, 0.14, 0.72, mat.masaAyak, X(TM.x - 70), 0.36, Z(TM.y)); silindir(0.08, 0.14, 0.72, mat.masaAyak, X(TM.x + 70), 0.36, Z(TM.y));
  for (const s of SANDALYE) {
    const yon = Math.atan2(TM.x - s.x, TM.y - s.y);
    const g = new THREE.Group(); g.position.set(X(s.x), 0, Z(s.y)); g.rotation.y = yon; scene.add(g);
    kutu(0.44, 0.07, 0.44, mat.lacivert, 0, 0.46, 0, g); kutu(0.44, 0.46, 0.05, mat.lacivert, 0, 0.74, -0.21, g);
    for (const sx of [-0.18, 0.18]) for (const sz of [-0.18, 0.18]) kutu(0.03, 0.44, 0.03, mat.metal, sx, 0.22, sz, g, false);
  }
  /* tahta (dokusu iş planıyla güncellenir) */
  const tahtaDoku = yaziDokusu(1024, 420, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#a3afc1'; g.font = '600 46px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TOPLANTI TAHTASI', w / 2, h / 2); });
  (function tahtaKur() {
    const g = new THREE.Group(); g.position.set(X(650), 0, Z(842)); g.rotation.y = Math.PI; scene.add(g);
    kutu(2.7, 1.16, 0.05, mat.cerceve, 0, 1.45, 0, g);
    const yuz = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.07), M('#ffffff', { map: tahtaDoku, roughness: 0.4 })); yuz.position.set(0, 1.45, 0.027); g.add(yuz);
    kutu(2.6, 0.04, 0.12, mat.cerceve, 0, 0.86, 0.05, g); for (const sx of [-1.2, 1.2]) kutu(0.05, 0.9, 0.05, mat.cerceve, sx, 0.45, 0, g);
  })();
  /* fikir masası: toplantı masasındaki kâğıt destesi + sayı etiketi */
  const fikirDeste = new THREE.Group(); fikirDeste.position.set(X(TM.x), 0.79, Z(TM.y - 22)); fikirDeste.userData.dinamik = true; scene.add(fikirDeste); fikirDeste.visible = false;
  const fikirEt = etiketSprite('FİKİR MASASI', { yaziRengi: '#ffffff', zemin: 'rgba(22,41,74,.92)', boy: 0.24 }); fikirEt.position.set(X(TM.x), 1.32, Z(TM.y)); scene.add(fikirEt); fikirEt.visible = false;
  fikirEt.userData.doku.userData.dinamik = true;   /* sayı içerir: font yenilemesinde ilk hâline dönmesin */
  function desteKur(n) {
    while (fikirDeste.children.length) fikirDeste.remove(fikirDeste.children[0]);
    const k = Math.min(n, 8);
    for (let i = 0; i < k; i++) { const s = kutu(0.3, 0.006, 0.4, i % 2 ? mat.kagit : mat.beyaz, ((i * 37) % 7 - 3) * 0.012, i * 0.007, ((i * 53) % 5 - 2) * 0.012, fikirDeste, false); s.rotation.y = ((i * 29) % 9 - 4) * 0.05; }
    fikirDeste.visible = n > 0; fikirEt.visible = n > 0;
  }
  /* diğer odalar: kanepeler, dolaplar, bitkiler */
  for (const [x, y] of [[60, 760], [950, 760], [1290, 760]]) { planKutu(x, y, 120, 46, 0.42, mat.kanepe, 0); planKutu(x, y + 36, 120, 10, 0.82, mat.kanepe, 0); planKutu(x + 6, y + 4, 108, 32, 0.08, mat.kumas, 0.42); }
  for (const [x, y, w] of [[210, 700, 130], [1110, 700, 110], [1440, 700, 120]]) planKutu(x, y, w, 26, 0.72, mat.ahsapKoyu, 0);
  for (const [x, y] of [[440, 290], [46, 290], [1050, 290], [46, 850], [355, 850], [880, 850], [1215, 850], [1555, 850]]) bitki(x, y);
  /* kahve köşesi */
  planKutu(864, 410, 94, 34, 0.92, mat.tezgah, 0); planKutu(860, 406, 102, 40, 0.04, mat.ahsap, 0.92);
  planKutu(896, 414, 26, 22, 0.36, mat.makine, 0.96); silindir(0.035, 0.03, 0.08, mat.beyaz, X(940), 1.0, Z(425)); silindir(0.035, 0.03, 0.08, mat.beyaz, X(880), 1.0, Z(425));
  const kahveEt = etiketSprite('KAHVE', { yaziRengi: '#8a6a45', boy: 0.22 }); kahveEt.position.set(X(911), 1.75, Z(425)); scene.add(kahveEt);
  /* notlar panosu */
  const panoDoku = yaziDokusu(512, 300, (g, w, h) => panoCiz(g, w, h, 0));
  function panoCiz(g, w, h, n) {
    g.fillStyle = '#16294a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f6f1e8'; g.fillRect(16, 16, w - 32, h - 32);
    g.fillStyle = '#16294a'; g.font = '700 54px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NOTLARINIZ', w / 2, h / 2 - (n ? 30 : 0));
    if (n) { g.fillStyle = '#a8423d'; g.beginPath(); g.arc(w / 2, h / 2 + 62, 40, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = '700 46px Inter, sans-serif'; g.fillText(String(n), w / 2, h / 2 + 64); }
  }
  (function panoKur() {
    const g = new THREE.Group(); g.position.set(X(99), 0, Z(436)); g.rotation.y = Math.PI; scene.add(g);
    kutu(0.96, 0.62, 0.04, mat.lacivert, 0, 1.42, 0, g);
    const yuz = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.53), M('#ffffff', { map: panoDoku, roughness: 0.6 })); yuz.position.set(0, 1.42, 0.022); g.add(yuz);
    for (const sx of [-0.42, 0.42]) kutu(0.04, 1.12, 0.04, mat.cerceve, sx, 0.56, -0.02, g);
  })();

  /* ------------------------------------------------------------ sabit mobilyayı birleştir (performans)
     Yüzlerce küçük kutu (masa ayağı, dikme, kitap…) aynı malzemeyi paylaşır → malzeme başına tek ağ. Görüntü aynı kalır,
     çizim çağrısı ~900'den birkaç düzineye iner (dizüstü ekran kartında akıcı). Değişen ağlar (ekran, fikir destesi)
     userData.dinamik ile birleştirmeye girmez. */
  (function statikBirlestir() {
    scene.updateMatrixWorld(true);
    const gruplar = new Map();
    scene.traverse((o) => {
      if (!o.isMesh || o.userData.dinamik) return;
      for (let p = o.parent; p; p = p.parent) if (p.userData && p.userData.dinamik) return;
      const g = o.geometry; if (!g || !g.attributes.position || !g.attributes.normal || !g.attributes.uv) return;
      const anahtar = o.material.uuid + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + '|' + o.renderOrder;
      if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
      gruplar.get(anahtar).push(o);
    });
    for (const liste of gruplar.values()) {
      if (liste.length < 2) continue;
      let nV = 0, nI = 0;
      const parcalar = liste.map((o) => { const g = o.geometry.clone().applyMatrix4(o.matrixWorld); nV += g.attributes.position.count; nI += g.index ? g.index.count : g.attributes.position.count; return g; });
      const poz = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), ind = new Uint32Array(nI);
      let v = 0, ix = 0;
      for (const g of parcalar) {
        poz.set(g.attributes.position.array, v * 3); nor.set(g.attributes.normal.array, v * 3); uv.set(g.attributes.uv.array, v * 2);
        const c = g.attributes.position.count;
        if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) ind[ix++] = a[i] + v; } else for (let i = 0; i < c; i++) ind[ix++] = i + v;
        v += c; g.dispose();
      }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(poz, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); bg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      bg.setIndex(new THREE.BufferAttribute(ind, 1)); bg.computeBoundingSphere();
      const ilk = liste[0];
      const me = new THREE.Mesh(bg, ilk.material); me.castShadow = ilk.castShadow; me.receiveShadow = ilk.receiveShadow; me.renderOrder = ilk.renderOrder;
      scene.add(me);
      for (const o of liste) { o.parent.remove(o); o.geometry.dispose(); }
    }
  })();

  /* ------------------------------------------------------------ karakterler */
  const GEO = {
    bacak: new THREE.CapsuleGeometry(0.068, 0.3, 4, 12), kol: new THREE.CapsuleGeometry(0.052, 0.2, 4, 10), onkol: new THREE.CapsuleGeometry(0.046, 0.18, 4, 10),
    govde: new THREE.CapsuleGeometry(0.19, 0.34, 6, 18), bas: new THREE.SphereGeometry(0.142, 28, 20),
    sac: new THREE.SphereGeometry(0.152, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), uzunSac: new THREE.CapsuleGeometry(0.115, 0.2, 4, 14),
    goz: new THREE.SphereGeometry(0.016, 8, 6), el: new THREE.SphereGeometry(0.048, 12, 10), ayakkabi: new THREE.BoxGeometry(0.1, 0.07, 0.22),
    boyun: new THREE.CylinderGeometry(0.052, 0.058, 0.1, 14), yaka: new THREE.BoxGeometry(0.11, 0.12, 0.02), kravat: new THREE.BoxGeometry(0.035, 0.24, 0.015),
    dosya: new THREE.BoxGeometry(0.24, 0.31, 0.03), kutu: new THREE.BoxGeometry(0.42, 0.28, 0.32)
  };
  const gozMat = M('#1d1d1f', { roughness: 0.3 }), ayakkabiMat = M('#1c2028', { roughness: 0.5 });
  function karakterKur(rol, ad) {
    const t = tohum(ad + rol), kadin = KADIN.has(ad);
    const ten = M(TEN[t % TEN.length], { roughness: 0.62 }), sac = M(SAC[(t >> 3) % SAC.length], { roughness: 0.85 });
    const kiyafet = M(ROL[rol].renk, { roughness: 0.72 }), alt = M(kadin ? '#3a3f4b' : '#2c3446', { roughness: 0.85 });
    const kok = new THREE.Group(); const govde = new THREE.Group(); kok.add(govde);
    const parca = (geo, m, x, y, z, eb) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; me.userData.rol = rol; (eb || govde).add(me); return me; };
    const bacak = [-1, 1].map((s) => {
      const kalca = new THREE.Group(); kalca.position.set(0.09 * s, 0.86, 0); govde.add(kalca);
      parca(GEO.bacak, alt, 0, -0.21, 0, kalca);
      const diz = new THREE.Group(); diz.position.y = -0.43; kalca.add(diz);
      parca(GEO.bacak, alt, 0, -0.2, 0, diz);
      parca(GEO.ayakkabi, ayakkabiMat, 0, -0.4, 0.04, diz);
      return { kalca, diz };
    });
    const g = parca(GEO.govde, kiyafet, 0, 1.19, 0); g.scale.set(kadin ? 0.92 : 1, 1, 0.72);
    parca(GEO.yaka, mat.beyaz, 0, 1.45, 0.122);
    if (rol === 'genel_mudur') parca(GEO.kravat, mat.pirinc, 0, 1.32, 0.135);
    parca(GEO.boyun, ten, 0, 1.6, 0);
    const basG = new THREE.Group(); basG.position.set(0, 1.76, 0); govde.add(basG);
    const bas = parca(GEO.bas, ten, 0, 0, 0, basG); bas.scale.y = 1.07;
    const s1 = parca(GEO.sac, sac, 0, 0.025, -0.012, basG); s1.rotation.x = -0.16;
    if (kadin) { parca(GEO.uzunSac, sac, 0, -0.14, -0.07, basG); }
    parca(GEO.goz, gozMat, -0.05, 0.015, 0.128, basG); parca(GEO.goz, gozMat, 0.05, 0.015, 0.128, basG);
    const kol = [-1, 1].map((s) => {
      const omuz = new THREE.Group(); omuz.position.set(0.245 * s, 1.45, 0); govde.add(omuz);
      parca(GEO.kol, kiyafet, 0, -0.15, 0, omuz);
      const dirsek = new THREE.Group(); dirsek.position.y = -0.29; omuz.add(dirsek);
      parca(GEO.onkol, kiyafet, 0, -0.12, 0, dirsek);
      parca(GEO.el, ten, 0, -0.25, 0, dirsek);
      return { omuz, dirsek };
    });
    const dosya = parca(GEO.dosya, mat.pirinc, 0, -0.24, 0.09, kol[1].dirsek); dosya.visible = false;
    const kutuMe = parca(GEO.kutu, mat.kutu, 0, 1.05, 0.33); kutuMe.visible = false;
    kok.scale.setScalar(0.93);
    return { kok, govde, bacak, kol, basG, dosya, kutu: kutuMe };
  }

  /* --- ajanlar + HTML etiketleri */
  const A = {};
  const balonlar = new Map();
  function etiketKur(a) {
    const d = document.createElement('div'); d.className = 'ajan3d-ad'; d.dataset.rol = a.rol;
    d.innerHTML = '<i style="background:' + ROL[a.rol].renk + '"></i>' + esc(a.ad) + '<span class="ajan3d-nokta"><b></b><b></b><b></b></span>';
    d.title = ROL[a.rol].ad + ' · ' + a.ad + ' (tıkla: kart · çift tıkla: takip et)';
    d.addEventListener('click', () => onAjanTik && onAjanTik(a.rol));
    d.addEventListener('dblclick', (e) => { e.preventDefault(); api.kamera.takip(a.rol); });
    katman.appendChild(d); return d;
  }
  for (const r of ROLLER) {
    const c = (kadro && kadro.calisanlar && kadro.calisanlar[r.id]) || { ad: r.baslangicAd, kademe: r.baslangicKademe };
    const k = KONUM.masa(r.id);
    const a = { rol: r.id, ad: c.ad, kademe: c.kademe, x: k.x, y: k.y, konum: k, yol: [], coz: null, durum: 'bos', gorunur: true, faz: Math.random() * 6, yon: 0, dosyaVar: false, kutuVar: false, konusmaBitis: 0, poz: {} };
    a.m = karakterKur(r.id, c.ad); scene.add(a.m.kok);
    a.etiket = etiketKur(a);
    A[r.id] = a;
  }
  function karakterYenile(a) {
    const eski = a.m.kok; scene.remove(eski);
    a.m = karakterKur(a.rol, a.ad); a.m.kok.position.copy(eski.position); a.m.kok.rotation.y = eski.rotation.y; a.m.kok.visible = a.gorunur;
    a.m.dosya.visible = a.dosyaVar; a.m.kutu.visible = a.kutuVar; scene.add(a.m.kok);
    a.etiket.innerHTML = '<i style="background:' + ROL[a.rol].renk + '"></i>' + esc(a.ad) + '<span class="ajan3d-nokta"><b></b><b></b><b></b></span>';
  }

  /* ------------------------------------------------------------ kamera + gezinme */
  const GENEL = { x: 0, z: 0.45, yaw: 0, pitch: 0.86, dist: 15.2 };
  /* Genel görünüm uzaklığı ekran oranına göre: dar (telefon) ekranda da ofisin tamamı sığsın */
  function genelGorunum() {
    const a = camera.aspect || 16 / 9;
    if (a >= 1.6) return Object.assign({}, GENEL);
    const yarim = Math.atan(Math.tan(19 * Math.PI / 180) * a);                     /* yatay görüş açısının yarısı */
    /* dikey (telefon) ekran: ofisin uzun kenarı ekranın boyuna gelsin (90° dönük bakış) */
    if (a < 1) return { x: 0, z: 0.2, yaw: Math.PI / 2, pitch: 0.95, dist: Math.min(30, 5.4 / Math.tan(yarim)) };
    return Object.assign({}, GENEL, { dist: Math.min(30, 8.6 / Math.tan(yarim)) });
  }
  const kam = { x: GENEL.x, z: GENEL.z, yaw: GENEL.yaw, pitch: GENEL.pitch, dist: GENEL.dist };
  const kamS = Object.assign({}, kam);
  let takipRol = null;
  const basili = new Set();
  const sinirla = (v, a, b) => Math.max(a, Math.min(b, v));
  function kamSinirla() { kam.x = sinirla(kam.x, -8.6, 8.6); kam.z = sinirla(kam.z, -4.9, 4.9); kam.dist = sinirla(kam.dist, 2.2, 32); kam.pitch = sinirla(kam.pitch, 0.16, 1.45); }
  function odaOdagi(id) {
    const yaw = (camera.aspect || 1.78) < 1 ? Math.PI / 2 : 0;
    if (id === 'kahve') return { x: X(911), z: Z(400), dist: 5.2, pitch: 0.62, yaw };
    const o = ODA_PLAN[id]; if (!o) return null;
    return { x: X(o.x + o.w / 2), z: Z(o.y + o.h / 2), dist: sinirla(Math.max(o.w, o.h * 1.6) * 0.0135 + 2.4, 5, 10.5), pitch: 0.74, yaw };
  }
  function kameraGuncelle(dt) {
    if (basili.size) {
      const hiz = kam.dist * 0.62 * dt, ileri = [-Math.sin(kam.yaw), -Math.cos(kam.yaw)], sag = [Math.cos(kam.yaw), -Math.sin(kam.yaw)];
      let dx = 0, dz = 0;
      if (basili.has('ileri')) { dx += ileri[0]; dz += ileri[1]; } if (basili.has('geri')) { dx -= ileri[0]; dz -= ileri[1]; }
      if (basili.has('sag')) { dx += sag[0]; dz += sag[1]; } if (basili.has('sol')) { dx -= sag[0]; dz -= sag[1]; }
      if (dx || dz) { takipRol = null; kam.x += dx * hiz; kam.z += dz * hiz; }
      if (basili.has('solaDon')) kam.yaw += 1.3 * dt; if (basili.has('sagaDon')) kam.yaw -= 1.3 * dt;
      if (basili.has('yukari')) kam.pitch += 0.9 * dt; if (basili.has('asagi')) kam.pitch -= 0.9 * dt;
      if (basili.has('yakin')) kam.dist *= 1 - 0.9 * dt; if (basili.has('uzak')) kam.dist *= 1 + 0.9 * dt;
    }
    if (takipRol && A[takipRol]) { kam.x = X(A[takipRol].x); kam.z = Z(A[takipRol].y); }
    kamSinirla();
    const k = 1 - Math.exp(-dt * 6.5);
    for (const a of ['x', 'z', 'pitch', 'dist']) kamS[a] += (kam[a] - kamS[a]) * k;
    let dy = kam.yaw - kamS.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; kamS.yaw += dy * k;
    const cp = Math.cos(kamS.pitch), sp = Math.sin(kamS.pitch);
    camera.position.set(kamS.x + Math.sin(kamS.yaw) * cp * kamS.dist, sp * kamS.dist + 0.4, kamS.z + Math.cos(kamS.yaw) * cp * kamS.dist);
    camera.lookAt(kamS.x, 0.55, kamS.z);
    scene.fog.near = kamS.dist + 14; scene.fog.far = kamS.dist + 40;
  }
  const TUS = { ArrowUp: 'ileri', KeyW: 'ileri', ArrowDown: 'geri', KeyS: 'geri', ArrowLeft: 'sol', KeyA: 'sol', ArrowRight: 'sag', KeyD: 'sag', KeyQ: 'solaDon', KeyE: 'sagaDon', KeyR: 'yukari', KeyF: 'asagi', Equal: 'yakin', NumpadAdd: 'yakin', Minus: 'uzak', NumpadSubtract: 'uzak', Slash: 'uzak' };
  function yaziAlaniMi(e) { const t = e.target; return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))); }
  function klavyeAcik(e) { return !yaziAlaniMi(e) && !(klavyeIzni && !klavyeIzni()) && kap.isConnected && kap.offsetParent !== null; }
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !klavyeAcik(e)) return;
    if (e.code === 'Home' || e.code === 'Digit0' || e.code === 'Numpad0') { e.preventDefault(); api.kamera.genel(); return; }
    const t = TUS[e.code] || (e.key === '+' ? 'yakin' : e.key === '-' ? 'uzak' : null);
    if (!t) return;
    e.preventDefault(); basili.add(t); ipucuGizle();
  });
  window.addEventListener('keyup', (e) => { const t = TUS[e.code] || (e.key === '+' ? 'yakin' : e.key === '-' ? 'uzak' : null); if (t) basili.delete(t); });
  window.addEventListener('blur', () => basili.clear());
  /* fare / dokunma */
  const imlec = new Map(); let surukle = null; let pinch = null;
  tuval.addEventListener('contextmenu', (e) => e.preventDefault());
  tuval.addEventListener('pointerdown', (e) => {
    tuval.focus({ preventScroll: true }); tuval.setPointerCapture(e.pointerId);
    imlec.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (imlec.size === 2) { const [p, q] = [...imlec.values()]; pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), dist: kam.dist }; surukle = null; return; }
    surukle = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, kaydir: e.button === 2 || e.shiftKey, tasindi: false };
  });
  tuval.addEventListener('pointermove', (e) => {
    if (!imlec.has(e.pointerId)) return;
    imlec.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && imlec.size === 2) { const [p, q] = [...imlec.values()]; const d = Math.hypot(p.x - q.x, p.y - q.y); if (d > 10) kam.dist = pinch.dist * pinch.d / d; return; }
    if (!surukle) return;
    const dx = e.clientX - surukle.x, dy = e.clientY - surukle.y; surukle.x = e.clientX; surukle.y = e.clientY;
    if (Math.abs(e.clientX - surukle.sx) + Math.abs(e.clientY - surukle.sy) > 4) surukle.tasindi = true;
    if (!surukle.tasindi) return;
    ipucuGizle();
    if (surukle.kaydir) {
      takipRol = null;
      const k = kam.dist * 0.0016, sag = [Math.cos(kam.yaw), -Math.sin(kam.yaw)], ileri = [-Math.sin(kam.yaw), -Math.cos(kam.yaw)];
      kam.x -= (sag[0] * dx - ileri[0] * dy) * k; kam.z -= (sag[1] * dx - ileri[1] * dy) * k;
    } else { kam.yaw -= dx * 0.0055; kam.pitch += dy * 0.0042; }
  });
  function birak(e) {
    imlec.delete(e.pointerId); if (imlec.size < 2) pinch = null;
    if (surukle && !surukle.tasindi && e.type === 'pointerup') { const rol = ajanBul(e.clientX, e.clientY); if (rol && onAjanTik) onAjanTik(rol); }
    if (!imlec.size) surukle = null;
  }
  tuval.addEventListener('pointerup', birak); tuval.addEventListener('pointercancel', birak);
  tuval.addEventListener('dblclick', (e) => { const rol = ajanBul(e.clientX, e.clientY); if (rol) api.kamera.takip(rol); });
  tuval.addEventListener('wheel', (e) => { e.preventDefault(); ipucuGizle(); kam.dist *= Math.exp(e.deltaY * 0.0011); }, { passive: false });
  const isin = new THREE.Raycaster(), fareV = new THREE.Vector2();
  function ajanBul(cx, cy) {
    const r = tuval.getBoundingClientRect(); fareV.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    isin.setFromCamera(fareV, camera);
    const hedefler = Object.values(A).filter((a) => a.gorunur).map((a) => a.m.kok);
    const v = isin.intersectObjects(hedefler, true)[0];
    let o = v && v.object; while (o && !o.userData.rol) o = o.parent;
    return o ? o.userData.rol : null;
  }

  /* --- gezinme araç çubuğu + ipucu (sahnenin içinde) */
  const arac = document.createElement('div'); arac.className = 'ofis-3b-arac';
  arac.innerHTML = GEZINTI_ODALARI.map(([id, ad]) => '<button type="button" data-oda3b="' + id + '"' + (id === 'genel' ? ' class="aktif"' : '') + '>' + esc(ad) + '</button>').join('') +
    '<button type="button" data-takip-birak hidden>Takibi bırak</button>';
  kap.appendChild(arac);
  arac.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-takip-birak')) { api.kamera.birak(); return; }
    const id = b.dataset.oda3b; if (id === 'genel') api.kamera.genel(); else api.kamera.odaya(id);
  });
  function aracAktif(id) { arac.querySelectorAll('[data-oda3b]').forEach((b) => b.classList.toggle('aktif', b.dataset.oda3b === id)); }
  const ipucu = document.createElement('div'); ipucu.className = 'ofis-3b-ipucu';
  const dokunmatik = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  ipucu.innerHTML = dokunmatik
    ? '<b>Gezinme</b> Tek parmakla sürükle: döndür · İki parmakla aç/kapat: yakınlaş · Alttaki düğmeler: odaya git · Kişiye çift dokun: takip et'
    : '<b>Gezinme</b> Ok tuşları / W A S D ilerle · Q E dön · R F eğ · + − yakınlaş · Fare: sürükle döndür, sağ tuş kaydır, tekerlek yakınlaş · Kişiye çift tıkla: takip et · 0: genel görünüm';
  kap.appendChild(ipucu);
  /* dar ekranda yardım kendiliğinden açılmaz (sahneyi kapatmasın); "?" ile açılır */
  if (kap.clientWidth < 700) ipucu.classList.add('gizle');
  let ipucuZaman = setTimeout(ipucuGizle, 14000);
  function ipucuGizle() { clearTimeout(ipucuZaman); ipucu.classList.add('gizle'); }
  const ipucuDugme = document.createElement('button'); ipucuDugme.type = 'button'; ipucuDugme.className = 'ofis-3b-yardim'; ipucuDugme.textContent = '?'; ipucuDugme.title = 'Gezinme tuşları';
  ipucuDugme.addEventListener('click', () => { ipucu.classList.toggle('gizle'); }); kap.appendChild(ipucuDugme);

  /* ------------------------------------------------------------ boyut */
  let ilkBoyut = true;
  function boyutla() {
    const w = Math.max(10, kap.clientWidth), h = Math.max(10, kap.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (ilkBoyut) { ilkBoyut = false; const g = genelGorunum(); Object.assign(kam, g); Object.assign(kamS, g); }
  }
  boyutla();
  if (typeof ResizeObserver === 'function') new ResizeObserver(boyutla).observe(kap); else window.addEventListener('resize', boyutla);

  /* ------------------------------------------------------------ duruş + yürüyüş */
  const yaklas = (cur, hedef, k) => cur + (hedef - cur) * k;
  function aciFark(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
  function pozUygula(a, dt, t) {
    const m = a.m, k = 1 - Math.exp(-dt * 12);
    const yuruyor = a.yol.length > 0;
    const otur = !yuruyor && a.konum && (a.konum.tur === 'masa' || a.konum.tur === 'sandalye');
    const calis = otur && a.durum === 'calisiyor';
    const konusuyor = performance.now() < a.konusmaBitis;
    const h = { k0: 0, k1: 0, d0: 0, d1: 0, o0: 0.05, o1: 0.05, e0: -0.12, e1: -0.12, y: 0, bas: 0 };
    if (yuruyor) {
      const s = Math.sin(a.faz), c = Math.cos(a.faz);
      h.k0 = -s * 0.5; h.k1 = s * 0.5; h.d0 = Math.max(0, s) * 0.75; h.d1 = Math.max(0, -s) * 0.75;
      h.o0 = s * 0.42; h.o1 = -s * 0.42; h.e0 = -0.25; h.e1 = -0.25; h.y = Math.abs(c) * 0.035;
    } else if (otur) {
      h.k0 = h.k1 = -1.5; h.d0 = h.d1 = 1.5; h.y = -0.4;
      if (calis) { h.o0 = -0.95 + Math.sin(t * 15) * 0.05; h.o1 = -0.95 + Math.sin(t * 15 + 1.7) * 0.05; h.e0 = h.e1 = -0.6; h.bas = 0.12 + Math.sin(t * 1.3) * 0.03; }
      else { h.o0 = h.o1 = -0.35; h.e0 = h.e1 = -0.95; }
    } else {
      h.y = Math.sin(t * 1.6 + a.faz) * 0.006;
    }
    if (konusuyor && !calis) { h.o1 = -0.55 + Math.sin(t * 5.2) * 0.22; h.e1 = -0.7 + Math.sin(t * 4.1) * 0.15; h.bas = Math.sin(t * 6) * 0.05; }
    if (a.kutuVar) { h.o0 = h.o1 = -0.85; h.e0 = h.e1 = -0.45; }
    else if (a.dosyaVar) { h.o1 = -0.45; h.e1 = -1.05; }
    const p = a.poz;
    for (const [ad, deger] of Object.entries(h)) p[ad] = yaklas(p[ad] == null ? deger : p[ad], deger, k);
    m.bacak[0].kalca.rotation.x = p.k0; m.bacak[1].kalca.rotation.x = p.k1; m.bacak[0].diz.rotation.x = p.d0; m.bacak[1].diz.rotation.x = p.d1;
    m.kol[0].omuz.rotation.x = p.o0; m.kol[1].omuz.rotation.x = p.o1; m.kol[0].dirsek.rotation.x = p.e0; m.kol[1].dirsek.rotation.x = p.e1;
    m.kol[0].omuz.rotation.z = -0.09; m.kol[1].omuz.rotation.z = 0.09;
    m.govde.position.y = p.y; m.basG.rotation.x = p.bas;
    /* yön: yürürken gidiş yönü, dururken konumun baktığı nokta */
    let hedefYon = a.yon;
    if (yuruyor) { const n = a.yol[0]; const dx = n.x - a.x, dy = n.y - a.y; if (Math.abs(dx) + Math.abs(dy) > 0.5) hedefYon = Math.atan2(dx, dy); }
    else if (a.konum && a.konum.bak) hedefYon = Math.atan2(a.konum.bak.x - a.x, a.konum.bak.y - a.y);
    a.yon += aciFark(a.yon, hedefYon) * (1 - Math.exp(-dt * 10));
    m.kok.rotation.y = a.yon;
    /* oturan, sandalyenin oturağına otursun (sandalye masadan 22 birim geride) */
    let ox = 0, oz = 0;
    if (otur && a.konum.tur === 'masa' && a.rol !== 'genel_mudur') { ox = Math.sin(a.yon) * -0.06; oz = Math.cos(a.yon) * -0.06; }
    m.kok.position.set(X(a.x) + ox, 0, Z(a.y) + oz);
  }

  /* ------------------------------------------------------------ HTML katmanı (ad etiketleri, balonlar) */
  const v3 = new THREE.Vector3();
  function ekranKonumu(a, yuk) {
    v3.set(X(a.x), yuk, Z(a.y)).project(camera);
    const w = kap.clientWidth, h = kap.clientHeight;
    return { x: (v3.x + 1) / 2 * w, y: (1 - v3.y) / 2 * h, on: v3.z < 1 && v3.z > -1 && Math.abs(v3.x) < 1.15 && Math.abs(v3.y) < 1.2 };
  }
  const basYuk = (a) => (a.yol.length || !(a.konum && (a.konum.tur === 'masa' || a.konum.tur === 'sandalye')) ? 1.98 : 1.6);
  /* balon sahnenin içinde kalsın: yanlarda sıkıştır, üste sığmazsa başın altına dön */
  function balonKonumla(b, a, p) {
    p = p || ekranKonumu(a, basYuk(a));
    const W2 = kap.clientWidth, H2 = kap.clientHeight, bw = b.offsetWidth || 180, bh = b.offsetHeight || 60;
    const x = Math.max(bw / 2 + 6, Math.min(W2 - bw / 2 - 6, p.x));
    let alt = p.y - 22, asagi = false;
    if (alt - bh < 4) { alt = p.y + 26 + bh; asagi = true; }
    alt = Math.max(bh + 4, Math.min(H2 - 4, alt));
    b.style.left = x.toFixed(1) + 'px'; b.style.top = alt.toFixed(1) + 'px'; b.classList.toggle('asagi', asagi);
    b.style.visibility = a.gorunur && p.on ? '' : 'hidden';
  }
  function katmanGuncelle() {
    for (const a of Object.values(A)) {
      const p = ekranKonumu(a, basYuk(a));
      const d = camera.position.distanceTo(v3.set(X(a.x), 1, Z(a.y)));
      const gor = a.gorunur && p.on;
      a.etiket.style.display = gor ? '' : 'none';
      if (gor) { a.etiket.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px) translate(-50%,-100%)'; a.etiket.style.opacity = d > 22 ? '0.55' : '1'; }
      const b = balonlar.get(a.rol);
      if (b) balonKonumla(b, a, p);
    }
  }

  /* ------------------------------------------------------------ kare döngüsü */
  let onceki = performance.now(), kameraOnceki = 0;
  function kare(t) {
    requestAnimationFrame(kare);
    const dt = Math.min(0.1, (t - onceki) / 1000); onceki = t;
    for (const a of Object.values(A)) {
      if (a.yol.length) {
        let kalan = 150 * HIZ * dt;
        while (kalan > 0 && a.yol.length) {
          const h = a.yol[0]; const dx = h.x - a.x, dy = h.y - a.y; const d = Math.hypot(dx, dy);
          if (d <= kalan) { a.x = h.x; a.y = h.y; a.yol.shift(); kalan -= d; } else { a.x += dx / d * kalan; a.y += dy / d * kalan; kalan = 0; }
        }
        if (!a.yol.length && a.coz) { const c = a.coz; a.coz = null; c(true); }
      }
      a.faz += dt * (a.yol.length ? 9 * Math.min(HIZ, 3) : 1);
      pozUygula(a, dt, t / 1000);
      const em = ekranMat[a.rol];
      if (em) { const acik = a.durum === 'calisiyor'; em.emissive.set(acik ? '#8ccaff' : '#3e6d9c'); em.emissiveIntensity = acik ? 0.75 + Math.sin(t / 220) * 0.18 : 0.32; }
    }
    if (document.hidden) return;
    /* kamera gerçek geçen süreyle hareket eder (yavaş karede tuş basılıyken de doğru mesafe) */
    kameraGuncelle(Math.min(0.5, kameraOnceki ? (t - kameraOnceki) / 1000 : dt)); kameraOnceki = t;
    renderer.render(scene, camera);
    katmanGuncelle();
  }
  requestAnimationFrame(kare);

  /* ------------------------------------------------------------ dış API (sahne.js ile aynı) */
  const api = {
    HIZ, KONUM, ucBoyut: true,
    ajan: (rol) => A[rol],
    /* çizim yükü (test ve performans takibi) */
    istatistik: () => { let n = 0; scene.traverse((o) => { if (o.isMesh) n++; }); return { nesne: n, cizim: renderer.info.render.calls, ucgen: renderer.info.render.triangles }; },
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
      a.konusmaBitis = performance.now() + Math.max(60, sure / HIZ);
      const id = (b._id = (b._id || 0) + 1);
      kayit && kayit({ tur: 'konusma', rol, ad: a.ad, metin: String(metin) });
      return new Promise((r) => setTimeout(() => { if (b._id === id) { b.classList.remove('goster'); b.classList.add('gizle'); } r(); }, Math.max(60, sure / HIZ)));
    },
    durum(rol, d) {
      const a = A[rol]; if (!a) return; a.durum = d;
      a.etiket.classList.toggle('calisiyor', d === 'calisiyor' || d === 'dusunuyor');
    },
    dosya(rol, var_) { const a = A[rol]; if (a) { a.dosyaVar = !!var_; a.m.dosya.visible = !!var_; } },
    kutu(rol, var_) { const a = A[rol]; if (a) { a.kutuVar = !!var_; a.m.kutu.visible = !!var_; } },
    gizle(rol, gizli) { const a = A[rol]; if (a) { a.gorunur = !gizli; a.m.kok.visible = !gizli; } },
    isimGuncelle(rol, ad, kademe) { const a = A[rol]; if (!a) return; a.ad = ad; if (kademe != null) a.kademe = kademe; karakterYenile(a); },
    isinlan(rol, k) { const a = A[rol]; if (!a) return; if (a.coz) { const c = a.coz; a.coz = null; c(false); } a.yol = []; a.konum = k; a.x = k.x; a.y = k.y; },
    yuruyorMu(rol) { const a = A[rol]; return !!(a && a.yol.length); },
    panoSayisi(n) { dokuYenile(panoDoku, (g, w, h) => panoCiz(g, w, h, n | 0)); },
    fikirSayisi(n) { desteKur(n | 0); dokuYenile(fikirEt.userData.doku, (g, w, h) => { const metin = 'FİKİR MASASI' + (n ? ' · ' + n : ''); g.font = '600 64px Inter, "Segoe UI", sans-serif'; const tw = Math.min(w - 20, g.measureText(metin).width + 60); g.fillStyle = 'rgba(22,41,74,.92)'; g.beginPath(); g.roundRect((w - tw) / 2, 28, tw, h - 56, 26); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(metin, w / 2, h / 2 + 2); }); },
    fikirKarti(f) {
      let k = katman.querySelector('.ofis-fikir');
      if (!f) { if (k) k.classList.add('gizle'); return; }
      if (!k) { k = document.createElement('div'); k.className = 'ofis-fikir'; katman.appendChild(k); }
      k.classList.remove('gizle');
      k.innerHTML = '<div class="of-ust">Fikir turu' + (f.durum ? ' · ' + esc(f.durum) : '') + '</div><div class="of-konu">' + esc(f.konu || '') + '</div>' +
        '<div class="of-kisiler">' + (f.katilimcilar || []).map((r) => '<span style="--r:' + (ROL[r] ? ROL[r].renk : '#16294a') + '">' + esc((A[r] && A[r].ad) || '') + '</span>').join('') + '</div>';
    },
    tahta(t) {
      dokuYenile(tahtaDoku, (g, w, h) => {
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.textBaseline = 'middle';
        if (!t) { g.fillStyle = '#a3afc1'; g.font = '600 46px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('TOPLANTI TAHTASI', w / 2, h / 2); return; }
        g.textAlign = 'left'; g.fillStyle = '#16294a'; g.font = '700 50px Inter, sans-serif'; g.fillText(String(t.baslik || '').slice(0, 34), 40, 62);
        g.fillStyle = '#b08d57'; g.fillRect(40, 100, 160, 6);
        g.font = '500 36px Inter, sans-serif';
        (t.adimlar || []).slice(0, 5).forEach((s, i) => { g.fillStyle = i === t.aktif ? '#16294a' : '#3b4b66'; g.fillText((i + 1) + '. ' + (ROL[s.rol] ? ROL[s.rol].ad : s.rol), 50, 152 + i * 52); });
      });
      let kart = katman.querySelector('.ofis-tahta');
      if (!t) { if (kart) kart.classList.add('gizle'); return; }
      if (t.kart === false) { if (kart) kart.classList.add('gizle'); return; }
      if (!kart) { kart = document.createElement('div'); kart.className = 'ofis-tahta'; katman.appendChild(kart); }
      kart.classList.remove('gizle');
      kart.innerHTML = '<div class="ot-ust">Toplantı tahtası</div><div class="ot-baslik">' + esc(t.baslik || 'Yeni iş') + '</div>' +
        (t.adimlar && t.adimlar.length ? '<ol>' + t.adimlar.map((s, i) => '<li class="' + (i === t.aktif ? 'aktif' : '') + '"><span class="ot-rol" style="--r:' + (ROL[s.rol] ? ROL[s.rol].renk : '#16294a') + '">' + esc(ROL[s.rol] ? ROL[s.rol].ad : s.rol) + '</span>' + esc(s.gorev || '') + '</li>').join('') + '</ol>' : '<div class="ot-bekle">Genel Müdür işi inceliyor…</div>');
    },
    kamera: {
      genel() { takipRol = null; Object.assign(kam, genelGorunum()); aracAktif('genel'); takipDugme(); },
      odaya(id) { const o = odaOdagi(id); if (!o) return; takipRol = null; Object.assign(kam, o); aracAktif(id); takipDugme(); },
      takip(rol) { if (!A[rol]) return; takipRol = rol; kam.dist = 4.4; kam.pitch = 0.5; aracAktif(''); takipDugme(); },
      birak() { takipRol = null; takipDugme(); },
      durum: () => ({ x: kam.x, z: kam.z, yaw: kam.yaw, pitch: kam.pitch, dist: kam.dist, takip: takipRol }),
      tus: (ad, basik) => { if (basik) basili.add(ad); else basili.delete(ad); }
    }
  };
  function takipDugme() { const b = arac.querySelector('[data-takip-birak]'); if (b) b.hidden = !takipRol; }
  return api;
}
