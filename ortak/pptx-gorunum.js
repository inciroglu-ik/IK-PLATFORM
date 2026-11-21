/* ============================================================================
   PowerPoint (.pptx) görüntüleyici — İK Portalı · Organizasyon Şeması (org-sema.html) · 21.11.2026
   ----------------------------------------------------------------------------
   Build'siz: .pptx (ZIP + XML) tarayıcıda JSZip ile açılır; sayfalardaki PowerPoint şekilleri
   (dikdörtgen, yuvarlatılmış dikdörtgen, elips ve diğer hazır şekiller, çizgi/bağlayıcı, metin kutusu,
   grup, resim, serbest çizim) HTML + SVG olarak AYNI konum, renk ve yazı boyutuyla çizilir.
   Dosya hiçbir sunucuya gönderilmez. Bu depoda şema verisi YOKTUR: dosyayı İK yükler, Firestore'da
   (orgSemasi/guncel) durur; kural: guvenlik/firestore.rules → ORGANİZASYON ŞEMASI.
   Gösterilemeyen öğeler (tablo, grafik, SmartArt, video) sayfa başına sayılır (slayt.atlanan).

   Dışa açılanlar:
     jszipYukle()            → JSZip kütüphanesini CDN'den bir kez yükler
     pptxOku(veri)           → Promise<model>  (veri: ArrayBuffer | Uint8Array)
                                model = { w, h (pt), slaytlar: [{ no, baslik, zemin, sekiller, atlanan }], urller }
     slaytCiz(slayt, model)  → HTMLElement (doğal boyut: 1 pt = 4/3 px; ölçek dışarıda CSS transform ile)
     modelBirak(model)       → resimler için açılan geçici adresleri (blob:) serbest bırakır
   ============================================================================ */

const JSZIP_JS = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const EMU = 12700;          /* 1 pt = 12700 EMU */
const PX = 4 / 3;           /* 1 pt = 4/3 CSS px */
const SATIR = 1.2;          /* PowerPoint "tek satır" aralığı ≈ yazı boyutunun 1,2 katı */
/* Yazı tipleri: Office yazılarının harf genişlikleri BİREBİR aynı açık kaynak eşleri (Google Fonts) kullanılır. Böylece satır
   kırılmaları PowerPoint'le aynı kalır ve küçük ölçekte Windows'taki Arial Kalın harf boşlukları ("YU SUF") görülmez.
   Eş yüklenemezse (bağlantı yok) asıl Office yazısına düşülür. */
const YAZI_YEDEK = 'Arimo, Arial, "Liberation Sans", "Helvetica Neue", Helvetica, sans-serif';
const YAZI_ES = { arial: 'Arimo', helvetica: 'Arimo', 'arial nova': 'Arimo', calibri: 'Carlito', cambria: 'Caladea', 'times new roman': 'Tinos', 'courier new': 'Cousine' };
const YAZI_CSS = 'https://fonts.googleapis.com/css2?family=Arimo:ital,wght@0,400;0,700;1,400;1,700&family=Carlito:ital,wght@0,400;0,700;1,400;1,700&family=Caladea:ital,wght@0,400;0,700;1,400;1,700&family=Tinos:ital,wght@0,400;0,700;1,400;1,700&family=Cousine:ital,wght@0,400;0,700;1,400;1,700&display=swap';
function yaziAilesi(ad) {
  const a = String(ad || '').replace(/"/g, '').trim();
  if (!a || /^arial$/i.test(a)) return null;                      /* varsayılan (.ps-slayt) zaten Arimo/Arial */
  const es = YAZI_ES[a.toLowerCase()];
  return (es ? '"' + es + '", ' : '') + '"' + a + '", ' + YAZI_YEDEK;
}

let jszipSozu = null;
export function jszipYukle() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!jszipSozu) {
    jszipSozu = new Promise((ok, red) => {
      const s = document.createElement('script');
      s.src = JSZIP_JS; s.async = true;
      s.onload = () => (window.JSZip ? ok(window.JSZip) : red(new Error('PowerPoint okuyucu (JSZip) yüklenemedi.')));
      s.onerror = () => { jszipSozu = null; red(new Error('PowerPoint okuyucu indirilemedi; internet bağlantısını kontrol edip yeniden deneyin.')); };
      document.head.appendChild(s);
    });
  }
  return jszipSozu;
}

/* ------------------------------------------------------------------ XML yardımcıları */
function c(e, ad) { if (!e) return null; for (const k of e.children) if (k.localName === ad) return k; return null; }
function cs(e, ad) { const r = []; if (e) for (const k of e.children) if (!ad || k.localName === ad) r.push(k); return r; }
function yolC(e, ...adlar) { let x = e; for (const a of adlar) { x = c(x, a); if (!x) return null; } return x; }
function at(e, a, d = null) { return e && e.hasAttribute(a) ? e.getAttribute(a) : d; }
function sayi(v, d = 0) { return v === null || v === undefined || v === '' || isNaN(+v) ? d : +v; }
function rAt(e, a) { if (!e) return null; return e.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', a) || e.getAttribute('r:' + a); }
function yolCoz(taban, hedef) {
  if (!hedef) return null;
  if (hedef.charAt(0) === '/') return hedef.slice(1);
  const p = taban.split('/'); p.pop();
  for (const s of hedef.split('/')) { if (s === '..') p.pop(); else if (s && s !== '.') p.push(s); }
  return p.join('/');
}

/* ------------------------------------------------------------------ renk */
const SISTEM = { windowText: '000000', window: 'FFFFFF', btnFace: 'F0F0F0', btnText: '000000', grayText: '6D6D6D', highlight: '0078D7', highlightText: 'FFFFFF' };
const HAZIR_RENK = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080', silver: 'C0C0C0', navy: '000080', orange: 'FFA500', darkGray: 'A9A9A9', lightGray: 'D3D3D3', darkBlue: '00008B', darkRed: '8B0000', darkGreen: '006400' };
function hexRgb(h) { h = String(h || '000000').replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); const n = parseInt(h.slice(0, 6), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const srgb = (v) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
function rgbHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslRgb([h, s, l]) {
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const RENK_AD = /^(srgbClr|schemeClr|sysClr|prstClr|scrgbClr|hslClr)$/;
/* kap: renk öğesini çocuk olarak taşıyan öğe (solidFill, gs, lnRef, fontRef, outerShdw ...) */
function renkCoz(kap, bag) {
  const e = kap && cs(kap).find((k) => RENK_AD.test(k.localName));
  if (!e) return null;
  let rgb = [0, 0, 0], a = 1;
  switch (e.localName) {
    case 'srgbClr': rgb = hexRgb(at(e, 'val')); break;
    case 'sysClr': rgb = hexRgb(at(e, 'lastClr') || SISTEM[at(e, 'val')] || '000000'); break;
    case 'prstClr': rgb = hexRgb(HAZIR_RENK[at(e, 'val')] || '000000'); break;
    case 'scrgbClr': rgb = ['r', 'g', 'b'].map((k) => srgb(Math.min(1, Math.max(0, sayi(at(e, k)) / 100000)))); break;
    case 'hslClr': rgb = hslRgb([sayi(at(e, 'hue')) / 60000 / 360, sayi(at(e, 'sat')) / 100000, sayi(at(e, 'lum')) / 100000]); break;
    case 'schemeClr': {
      let v = at(e, 'val');
      if (v === 'phClr') { if (bag && bag.ph) { rgb = bag.ph.rgb.slice(); a = bag.ph.a; } break; }
      v = (bag && bag.harita && bag.harita[v]) || v;
      rgb = hexRgb((bag && bag.tema && bag.tema.renk[v]) || '000000');
      break;
    }
  }
  for (const m of cs(e)) {
    const v = sayi(at(m, 'val')) / 100000;
    let hsl;
    switch (m.localName) {
      case 'alpha': a = v; break;
      case 'alphaMod': a *= v; break;
      case 'alphaOff': a += v; break;
      case 'shade': rgb = rgb.map((x) => srgb(lin(x) * v)); break;
      case 'tint': rgb = rgb.map((x) => srgb(lin(x) * v + (1 - v))); break;
      case 'lumMod': hsl = rgbHsl(rgb); hsl[2] *= v; rgb = hslRgb(hsl); break;
      case 'lumOff': hsl = rgbHsl(rgb); hsl[2] += v; rgb = hslRgb(hsl); break;
      case 'satMod': hsl = rgbHsl(rgb); hsl[1] *= v; rgb = hslRgb(hsl); break;
      case 'satOff': hsl = rgbHsl(rgb); hsl[1] += v; rgb = hslRgb(hsl); break;
      case 'hueOff': hsl = rgbHsl(rgb); hsl[0] = (hsl[0] + sayi(at(m, 'val')) / 60000 / 360 + 1) % 1; rgb = hslRgb(hsl); break;
      case 'hueMod': hsl = rgbHsl(rgb); hsl[0] = (hsl[0] * v) % 1; rgb = hslRgb(hsl); break;
      case 'comp': hsl = rgbHsl(rgb); hsl[0] = (hsl[0] + 0.5) % 1; rgb = hslRgb(hsl); break;
      case 'inv': rgb = rgb.map((x) => 255 - x); break;
      case 'gray': { const g = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]; rgb = [g, g, g]; break; }
    }
    if (hsl) { hsl[1] = Math.min(1, Math.max(0, hsl[1])); hsl[2] = Math.min(1, Math.max(0, hsl[2])); rgb = hslRgb(hsl); }
  }
  return { rgb: rgb.map((x) => Math.max(0, Math.min(255, Math.round(x)))), a: Math.max(0, Math.min(1, a)) };
}
function semaRenk(ad, bag) { const v = (bag && bag.harita && bag.harita[ad]) || ad; return { rgb: hexRgb((bag && bag.tema && bag.tema.renk[v]) || '000000'), a: 1 }; }
function css(r) {
  if (!r) return 'transparent';
  return r.a >= 0.999 ? '#' + r.rgb.map((x) => x.toString(16).padStart(2, '0')).join('') : 'rgba(' + r.rgb.join(',') + ',' + +r.a.toFixed(3) + ')';
}

/* ------------------------------------------------------------------ dolgu / çizgi / gölge */
function gradyan(g, bag) {
  const d = cs(c(g, 'gsLst'), 'gs').map((s) => ({ p: sayi(at(s, 'pos')) / 1000, r: renkCoz(s, bag) })).filter((x) => x.r).sort((x, y) => x.p - y.p);
  if (!d.length) return null;
  const duraklar = d.map((x) => css(x.r) + ' ' + x.p.toFixed(1) + '%').join(', ');
  if (c(g, 'path')) return 'radial-gradient(ellipse at center, ' + duraklar + ')';
  const lin_ = c(g, 'lin'), aci = lin_ ? sayi(at(lin_, 'ang')) / 60000 : 90;   /* DrawingML 0° = soldan sağa, saat yönünde */
  return 'linear-gradient(' + ((aci + 90) % 360).toFixed(1) + 'deg, ' + duraklar + ')';
}
/* Açık dolgu (spPr) yoksa undefined döner; noFill → { yok: true } */
function acikDolgu(kap, bag) {
  if (!kap) return undefined;
  for (const k of cs(kap)) {
    switch (k.localName) {
      case 'noFill': return { yok: true };
      case 'solidFill': { const r = renkCoz(k, bag); return r ? { renk: css(r), r } : { yok: true }; }
      case 'gradFill': { const g = gradyan(k, bag); return g ? { gradyan: g } : { yok: true }; }
      case 'pattFill': { const r = renkCoz(c(k, 'fgClr'), bag); return r ? { renk: css(r), r } : { yok: true }; }
      case 'blipFill': return { resimId: rAt(c(k, 'blip'), 'embed'), kirp: kirpOku(c(k, 'srcRect')) };
      case 'grpFill': return bag.grupDolgu || { yok: true };
    }
  }
  return undefined;
}
function stilDolgu(stil, bag) {
  const ref = stil && c(stil, 'fillRef');
  if (!ref) return undefined;
  const i = sayi(at(ref, 'idx'));
  if (!i) return { yok: true };
  const r = renkCoz(ref, bag);
  return r ? { renk: css(r), r } : { yok: true };
}
function cizgiCoz(spPrler, stil, bag) {
  let ln = null;
  for (const sp of spPrler) { const l = c(sp, 'ln'); if (l) { ln = l; break; } }
  if (ln && c(ln, 'noFill')) return null;
  let w = ln && ln.hasAttribute('w') ? sayi(at(ln, 'w')) / EMU : null;
  let renk = null;
  if (ln) {
    const sf = c(ln, 'solidFill'), gf = c(ln, 'gradFill');
    if (sf) renk = renkCoz(sf, bag);
    else if (gf) { const s = cs(c(gf, 'gsLst'), 'gs')[0]; renk = s ? renkCoz(s, bag) : null; }
  }
  if (!renk) {
    const ref = stil && c(stil, 'lnRef'), i = ref ? sayi(at(ref, 'idx')) : 0;
    if (i > 0) { renk = renkCoz(ref, bag); if (w === null) w = bag.tema.cizgiW[i - 1] != null ? bag.tema.cizgiW[i - 1] : 0.75; }
  }
  if (!renk) return null;
  if (w === null) w = 0.75;
  const uc = (e) => (e ? { tur: at(e, 'type', 'none'), w: at(e, 'w', 'med'), l: at(e, 'len', 'med') } : null);
  const bas = uc(c(ln, 'headEnd')), son = uc(c(ln, 'tailEnd'));
  return { w, css: css(renk), kesik: at(c(ln, 'prstDash'), 'val', 'solid'), uc: at(ln, 'cap', 'flat'), bas: bas && bas.tur !== 'none' ? bas : null, son: son && son.tur !== 'none' ? son : null };
}
function golgeCoz(spPr, bag) {
  const s = yolC(spPr, 'effectLst', 'outerShdw');
  if (!s) return null;
  const r = renkCoz(s, bag); if (!r) return null;
  const bl = sayi(at(s, 'blurRad')) / EMU, uz = sayi(at(s, 'dist')) / EMU, yon = sayi(at(s, 'dir')) / 60000 * Math.PI / 180;
  return (Math.cos(yon) * uz * PX).toFixed(2) + 'px ' + (Math.sin(yon) * uz * PX).toFixed(2) + 'px ' + (bl * PX).toFixed(2) + 'px ' + css(r);
}
function kirpOku(e) { return e ? { l: sayi(at(e, 'l')) / 100000, t: sayi(at(e, 't')) / 100000, r: sayi(at(e, 'r')) / 100000, b: sayi(at(e, 'b')) / 100000 } : null; }

/* ------------------------------------------------------------------ konum (EMU) */
function xfrmOku(x) {
  const o = c(x, 'off'), e = c(x, 'ext');
  return { x: sayi(at(o, 'x')), y: sayi(at(o, 'y')), w: sayi(at(e, 'cx')), h: sayi(at(e, 'cy')), rot: sayi(at(x, 'rot')) / 60000, fh: at(x, 'flipH') === '1', fv: at(x, 'flipV') === '1' };
}
const BIRIM = (k) => k;
function grupDonusum(ust, x) {
  const o = c(x, 'off'), e = c(x, 'ext'), co = c(x, 'chOff'), ce = c(x, 'chExt');
  const ox = sayi(at(o, 'x')), oy = sayi(at(o, 'y')), ew = sayi(at(e, 'cx')), eh = sayi(at(e, 'cy'));
  const cx0 = sayi(at(co, 'x')), cy0 = sayi(at(co, 'y')), cw = sayi(at(ce, 'cx')), ch = sayi(at(ce, 'cy'));
  const sx = cw ? ew / cw : 1, sy = ch ? eh / ch : 1;
  return (k) => ust({ x: ox + (k.x - cx0) * sx, y: oy + (k.y - cy0) * sy, w: k.w * sx, h: k.h * sy, rot: k.rot, fh: k.fh, fv: k.fv });
}

/* ------------------------------------------------------------------ metin */
function aralik(e) {
  if (!e) return null;
  const p = c(e, 'spcPct'), t = c(e, 'spcPts');
  if (p) return { oran: sayi(at(p, 'val'), 100000) / 100000 };
  if (t) return { pt: sayi(at(t, 'val')) / 100 };
  return null;
}
function yaziCoz(ad, bag) {
  if (!ad) return null;
  if (ad.charAt(0) === '+') return ad.indexOf('mj') === 1 ? bag.tema.yazi.major : bag.tema.yazi.minor;
  return ad;
}
/* zincir: öncelik sırasıyla rPr / defRPr öğeleri. haric: şeklin kendi yazı rengi (style › fontRef) varken renk için
   atlanacak sunum geneli varsayılanı (PowerPoint'te şekil stili sunum varsayılanından önce gelir). */
function kosuOku(zincir, metin, bag, varsayilanRenk, haric) {
  const g = (a, d) => { for (const x of zincir) if (x.hasAttribute(a)) return x.getAttribute(a); return d; };
  let dolgu;
  for (const x of zincir) { if (x === haric) continue; const d = acikDolgu(x, bag); if (d !== undefined) { dolgu = d; break; } }
  let renk = dolgu ? (dolgu.yok ? 'transparent' : dolgu.renk || null) : null;
  if (!renk) renk = varsayilanRenk;
  let yazi = null;
  for (const x of zincir) { const l = c(x, 'latin'); if (l && at(l, 'typeface')) { yazi = yaziCoz(at(l, 'typeface'), bag); break; } }
  if (!yazi) yazi = bag.tema.yazi.minor;
  const ac = (v) => v === '1' || v === 'true';
  return {
    t: metin, sz: sayi(g('sz', 1800), 1800) / 100, b: ac(g('b', '0')), i: ac(g('i', '0')),
    u: g('u', 'none') !== 'none', s: g('strike', 'noStrike') !== 'noStrike', cap: g('cap', 'none'),
    bl: sayi(g('baseline', 0)) / 1000, spc: sayi(g('spc', 0)) / 100, renk, yazi
  };
}
function metinOku(tx, bag, o) {
  if (!tx) return null;
  const bpler = [c(tx, 'bodyPr'), o.phL && yolC(o.phL, 'txBody', 'bodyPr'), o.phM && yolC(o.phM, 'txBody', 'bodyPr')].filter(Boolean);
  const bAt = (a, d) => { for (const b of bpler) if (b.hasAttribute(a)) return b.getAttribute(a); return d; };
  const ins = [['lIns', 91440], ['tIns', 45720], ['rIns', 91440], ['bIns', 45720]].map(([a, d]) => sayi(bAt(a, d), d) / EMU);
  let olcek = 1, azalt = 0;
  for (const b of bpler) { const n = c(b, 'normAutofit'); if (n) { olcek = sayi(at(n, 'fontScale'), 100000) / 100000; azalt = sayi(at(n, 'lnSpcReduction'), 0) / 100000; break; } if (c(b, 'noAutofit') || c(b, 'spAutoFit')) break; }
  const taban = o.ph ? bag.txStil(o.ph) : bag.varsayilanStil;
  const lstler = [c(tx, 'lstStyle'), o.phL && yolC(o.phL, 'txBody', 'lstStyle'), o.phM && yolC(o.phM, 'txBody', 'lstStyle'), taban].filter(Boolean);
  const fontRef = o.stil && c(o.stil, 'fontRef');
  const fr = fontRef ? renkCoz(fontRef, bag) : null;
  const varsayilanRenk = css(fr || semaRenk('tx1', bag));
  const paragraflar = [], sayac = {};
  let dolu = false;
  for (const p of cs(tx, 'p')) {
    const pPr = c(p, 'pPr'), duzey = Math.min(8, sayi(at(pPr, 'lvl'))), lvAd = 'lvl' + (duzey + 1) + 'pPr';
    const pz = [pPr, ...lstler.map((l) => c(l, lvAd))].filter(Boolean);
    const pAt = (a, d) => { for (const x of pz) if (x.hasAttribute(a)) return x.getAttribute(a); return d; };
    const pC = (ad) => { for (const x of pz) { const y = c(x, ad); if (y) return y; } return null; };
    const rz = pz.map((x) => c(x, 'defRPr')).filter(Boolean);
    const haric = fr && taban ? c(c(taban, lvAd), 'defRPr') : null;
    const kosular = [];
    for (const r of cs(p)) {
      if (r.localName === 'r' || r.localName === 'fld') {
        const t = (c(r, 't') || { textContent: '' }).textContent;
        if (/\S/.test(t)) dolu = true;
        kosular.push(kosuOku([c(r, 'rPr'), ...rz].filter(Boolean), t, bag, varsayilanRenk, haric));
      } else if (r.localName === 'br') {
        const k = kosuOku([c(r, 'rPr'), ...rz].filter(Boolean), '', bag, varsayilanRenk, haric); k.br = true; kosular.push(k);
      }
    }
    const son = kosuOku([c(p, 'endParaRPr'), ...rz].filter(Boolean), '', bag, varsayilanRenk, haric);
    /* madde işareti: zincirde ilk bulunan buNone / buChar / buAutoNum */
    let madde = null;
    for (const x of pz) {
      if (c(x, 'buNone')) break;
      const bc = c(x, 'buChar'), ba = c(x, 'buAutoNum');
      if (bc) { madde = { k: at(bc, 'char', '•') }; break; }
      if (ba) { const tur = at(ba, 'type', 'arabicPeriod'); sayac[duzey] = (sayac[duzey] || sayi(at(ba, 'startAt'), 1) - 1) + 1; madde = { k: numara(tur, sayac[duzey]) }; break; }
    }
    if (madde && kosular.some((k) => /\S/.test(k.t))) {
      const br = pC('buClr'), bs = pC('buSzPct');
      madde.renk = br ? css(renkCoz(br, bag)) : null;
      madde.oran = bs ? sayi(at(bs, 'val'), 100000) / 100000 : 1;
    } else madde = null;
    paragraflar.push({
      hiza: pAt('algn', 'l'), marL: sayi(pAt('marL', 0)) / EMU, girinti: sayi(pAt('indent', 0)) / EMU,
      satir: aralik(pC('lnSpc')), once: aralik(pC('spcBef')), sonra: aralik(pC('spcAft')), madde, kosular, son
    });
  }
  if (!dolu) return null;
  return { ins, capa: bAt('anchor', 't'), sar: bAt('wrap', 'square'), dikey: bAt('vert', 'horz'), olcek, azalt, paragraflar };
}
function numara(tur, n) {
  const roma = (x) => { const t = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let s = ''; for (const [v, h] of t) while (x >= v) { s += h; x -= v; } return s; };
  const harf = (x) => { let s = ''; while (x > 0) { x--; s = String.fromCharCode(97 + (x % 26)) + s; x = Math.floor(x / 26); } return s; };
  let g = String(n);
  if (/^romanLc/.test(tur)) g = roma(n); else if (/^romanUc/.test(tur)) g = roma(n).toUpperCase();
  else if (/^alphaLc/.test(tur)) g = harf(n); else if (/^alphaUc/.test(tur)) g = harf(n).toUpperCase();
  if (/ParenBoth$/.test(tur)) return '(' + g + ')';
  if (/ParenR$/.test(tur)) return g + ')';
  if (/Plain$/.test(tur)) return g;
  return g + '.';
}

/* ------------------------------------------------------------------ serbest çizim (custGeom) */
function ozelYolOku(cust) {
  const r = [];
  for (const p of cs(c(cust, 'pathLst'), 'path')) {
    const w = sayi(at(p, 'w')), h = sayi(at(p, 'h'));
    let d = '', cx = 0, cy = 0, sx = 0, sy = 0, gecerli = true;
    const nk = (e) => { const x = at(e, 'x'), y = at(e, 'y'); if (isNaN(+x) || isNaN(+y)) gecerli = false; return [+x, +y]; };
    for (const k of cs(p)) {
      switch (k.localName) {
        case 'moveTo': { const [x, y] = nk(c(k, 'pt')); d += 'M' + x + ' ' + y; cx = sx = x; cy = sy = y; break; }
        case 'lnTo': { const [x, y] = nk(c(k, 'pt')); d += 'L' + x + ' ' + y; cx = x; cy = y; break; }
        case 'cubicBezTo': { const q = cs(k, 'pt').map(nk); if (q.length === 3) { d += 'C' + q.map((z) => z.join(' ')).join(' '); [cx, cy] = q[2]; } break; }
        case 'quadBezTo': { const q = cs(k, 'pt').map(nk); if (q.length === 2) { d += 'Q' + q.map((z) => z.join(' ')).join(' '); [cx, cy] = q[1]; } break; }
        case 'arcTo': {
          const wR = sayi(at(k, 'wR')), hR = sayi(at(k, 'hR')), st = sayi(at(k, 'stAng')) / 60000 * Math.PI / 180, sw = sayi(at(k, 'swAng')) / 60000 * Math.PI / 180;
          const mx = cx - wR * Math.cos(st), my = cy - hR * Math.sin(st);
          const ex = mx + wR * Math.cos(st + sw), ey = my + hR * Math.sin(st + sw);
          d += 'A' + wR + ' ' + hR + ' 0 ' + (Math.abs(sw) > Math.PI ? 1 : 0) + ' ' + (sw > 0 ? 1 : 0) + ' ' + ex + ' ' + ey; cx = ex; cy = ey; break;
        }
        case 'close': d += 'Z'; cx = sx; cy = sy; break;
      }
    }
    if (gecerli && d) r.push({ w, h, d, dolgu: at(p, 'fill', 'norm') !== 'none', cizgi: at(p, 'stroke', '1') !== '0' && at(p, 'stroke', '1') !== 'false' });
  }
  return r.length ? r : null;
}

/* ------------------------------------------------------------------ okuma */
const CIZGI_GEOM = /^(line|straightConnector1|bentConnector[2-5]|curvedConnector[2-5])$/;
export async function pptxOku(veri) {
  const JSZip = await jszipYukle();
  let zip;
  try { zip = await JSZip.loadAsync(veri); } catch (e) { throw new Error('Dosya açılamadı: geçerli bir PowerPoint (.pptx) dosyası değil. Eski biçimdeki (.ppt) dosyaları PowerPoint\'te "Farklı Kaydet › .pptx" ile dönüştürün.'); }
  const xmlOnbellek = new Map();
  const xml = async (yol) => {
    if (!yol) return null;
    if (xmlOnbellek.has(yol)) return xmlOnbellek.get(yol);
    const f = zip.file(yol); let d = null;
    if (f) { d = new DOMParser().parseFromString(await f.async('string'), 'application/xml'); if (d.getElementsByTagName('parsererror').length) d = null; }
    xmlOnbellek.set(yol, d); return d;
  };
  const iliskiler = async (yol) => {
    const i = yol.lastIndexOf('/'), x = await xml(yol.slice(0, i) + '/_rels/' + yol.slice(i + 1) + '.rels'), m = {};
    if (x) for (const r of x.getElementsByTagName('Relationship')) m[r.getAttribute('Id')] = { hedef: r.getAttribute('TargetMode') === 'External' ? null : yolCoz(yol, r.getAttribute('Target')), tur: (r.getAttribute('Type') || '').split('/').pop() };
    return m;
  };
  const sunum = await xml('ppt/presentation.xml');
  if (!sunum) throw new Error('Bu dosya bir PowerPoint sunusu değil (ppt/presentation.xml bulunamadı).');
  const sk = sunum.documentElement;
  const boy = c(sk, 'sldSz');
  const W = sayi(at(boy, 'cx'), 12192000), H = sayi(at(boy, 'cy'), 6858000);
  const sIl = await iliskiler('ppt/presentation.xml');
  const varsayilanStil = c(sk, 'defaultTextStyle');
  const urller = [];
  const medyaOnbellek = new Map();
  const medya = async (yol) => {
    if (!yol) return null;
    if (medyaOnbellek.has(yol)) return medyaOnbellek.get(yol);
    const f = zip.file(yol); let u = null;
    const uz = (yol.split('.').pop() || '').toLowerCase();
    const tur = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff' }[uz];
    if (f && tur) { u = URL.createObjectURL(new Blob([await f.async('uint8array')], { type: tur })); urller.push(u); }
    medyaOnbellek.set(yol, u); return u;
  };

  /* tema + ana slayt + düzen önbellekleri */
  const temaOku = async (yol) => {
    const t = await xml(yol), k = t && t.documentElement, sema = k && k.getElementsByTagNameNS('*', 'clrScheme')[0];
    const renk = {};
    if (sema) for (const e of cs(sema)) { const r = cs(e)[0]; if (r) renk[e.localName] = r.localName === 'sysClr' ? (at(r, 'lastClr') || SISTEM[at(r, 'val')] || '000000') : (at(r, 'val') || '000000'); }
    const fs = k && k.getElementsByTagNameNS('*', 'fontScheme')[0];
    const yz = (ad) => { const e = fs && c(fs, ad); const l = e && c(e, 'latin'); return (l && at(l, 'typeface')) || 'Calibri'; };
    const lst = k && k.getElementsByTagNameNS('*', 'lnStyleLst')[0];
    return { renk, yazi: { major: yz('majorFont'), minor: yz('minorFont') }, cizgiW: cs(lst, 'ln').map((l) => sayi(at(l, 'w'), 9525) / EMU) };
  };
  const phHaritasi = (agac) => {
    const m = { idx: {}, tur: {} };
    if (!agac) return m;
    for (const e of agac.getElementsByTagNameNS('*', 'ph')) {
      let sp = e; while (sp && sp.localName !== 'sp') sp = sp.parentElement;
      if (!sp) continue;
      const tur = at(e, 'type', 'body'), idx = at(e, 'idx');
      if (idx !== null && !(idx in m.idx)) m.idx[idx] = sp;
      if (!(tur in m.tur)) m.tur[tur] = sp;
    }
    return m;
  };
  const anaOnbellek = new Map(), duzenOnbellek = new Map();
  const anaOku = async (yol) => {
    if (anaOnbellek.has(yol)) return anaOnbellek.get(yol);
    const x = await xml(yol), k = x.documentElement, il = await iliskiler(yol);
    const temaYol = Object.values(il).find((r) => r.tur === 'theme');
    const harita = {}; const cm = c(k, 'clrMap'); if (cm) for (const a of cm.attributes) harita[a.name] = a.value;
    const tx = c(k, 'txStyles');
    const a = { yol, k, il, tema: await temaOku(temaYol && temaYol.hedef), harita, ph: phHaritasi(c(c(k, 'cSld'), 'spTree')), baslikStil: c(tx, 'titleStyle'), govdeStil: c(tx, 'bodyStyle'), digerStil: c(tx, 'otherStyle') };
    anaOnbellek.set(yol, a); return a;
  };
  const duzenOku = async (yol) => {
    if (duzenOnbellek.has(yol)) return duzenOnbellek.get(yol);
    const x = await xml(yol), k = x.documentElement, il = await iliskiler(yol);
    const anaYol = Object.values(il).find((r) => r.tur === 'slideMaster');
    const d = { yol, k, il, ana: await anaOku(anaYol.hedef), ph: phHaritasi(c(c(k, 'cSld'), 'spTree')) };
    duzenOnbellek.set(yol, d); return d;
  };

  const phBul = (harita, ph, anaMi) => {
    const tur = at(ph, 'type', 'body'), idx = at(ph, 'idx');
    if (!anaMi && idx !== null && harita.idx[idx]) return harita.idx[idx];
    if (harita.tur[tur]) return harita.tur[tur];
    if (anaMi) {
      if (tur === 'ctrTitle') return harita.tur.title || null;
      if (tur === 'subTitle' || tur === 'obj' || tur === 'tbl' || tur === 'chart' || tur === 'pic' || tur === 'media' || tur === 'clipArt' || tur === 'dgm') return harita.tur.body || null;
    } else if (tur === 'ctrTitle' && harita.tur.title) return harita.tur.title;
    return null;
  };

  const arkaPlan = async (k, bag, il) => {
    const bg = c(c(k, 'cSld'), 'bg');
    if (!bg) return undefined;
    const bp = c(bg, 'bgPr');
    if (bp) {
      const d = acikDolgu(bp, bag);
      if (!d || d.yok) return '#FFFFFF';
      if (d.renk) return d.renk;
      if (d.gradyan) return d.gradyan;
      if (d.resimId) { const u = await medya(il[d.resimId] && il[d.resimId].hedef); return u ? 'center / cover no-repeat url("' + u + '")' : '#FFFFFF'; }
    }
    const br = c(bg, 'bgRef');
    if (br) { const r = renkCoz(br, bag); return r ? css(r) : '#FFFFFF'; }
    return undefined;
  };

  /* şekil ağacı → düz liste (çizim sırasıyla) */
  async function agacOku(agac, bag, T, cikti, katman, atlanan) {
    for (const e of cs(agac)) {
      const ad = e.localName;
      if (ad === 'sp' || ad === 'cxnSp') await sekilOku(e, bag, T, cikti, katman);
      else if (ad === 'grpSp') {
        const gp = c(e, 'grpSpPr'), x = c(gp, 'xfrm');
        const gd = acikDolgu(gp, bag);
        const altBag = Object.assign({}, bag, { grupDolgu: gd && !gd.yok ? gd : bag.grupDolgu });
        await agacOku(e, altBag, x ? grupDonusum(T, x) : T, cikti, katman, atlanan);
      } else if (ad === 'pic') await resimOku(e, bag, T, cikti);
      else if (ad === 'graphicFrame') atlanan.n++;
      else if (ad === 'AlternateContent') {
        const s = c(e, 'Fallback') || c(e, 'Choice');              /* Fallback: her okuyucunun anladığı eski biçim */
        if (s) await agacOku(s, bag, T, cikti, katman, atlanan);
      } else if (ad === 'contentPart') atlanan.n++;
    }
  }
  async function sekilOku(e, bag, T, cikti, katman) {
    const nv = c(e, 'nvSpPr') || c(e, 'nvCxnSpPr');
    if (at(c(nv, 'cNvPr'), 'hidden') === '1') return;
    const ph = yolC(nv, 'nvPr', 'ph');
    if (ph && katman !== 'slayt') return;                       /* düzen/ana slayt yer tutucuları sayfada çizilmez */
    const phL = ph && bag.duzen ? phBul(bag.duzen.ph, ph, false) : null;
    const phM = ph ? phBul(bag.ana.ph, ph, true) : null;
    const spPr = c(e, 'spPr'), stil = c(e, 'style');
    const spPrler = [spPr, phL && c(phL, 'spPr'), phM && c(phM, 'spPr')].filter(Boolean);
    let xfrm = null; for (const s of spPrler) { xfrm = c(s, 'xfrm'); if (xfrm) break; }
    if (!xfrm) return;
    const k = T(xfrmOku(xfrm));
    let geomE = null; for (const s of spPrler) { geomE = c(s, 'prstGeom') || c(s, 'custGeom'); if (geomE) break; }
    const ozel = geomE && geomE.localName === 'custGeom';
    const geom = ozel ? 'ozel' : at(geomE, 'prst', 'rect');
    const ayar = {};
    if (geomE && !ozel) for (const gd of cs(c(geomE, 'avLst'), 'gd')) { const m = /val\s+(-?\d+)/.exec(at(gd, 'fmla', '')); if (m) ayar[at(gd, 'name')] = +m[1]; }
    let dolgu; for (const s of spPrler) { dolgu = acikDolgu(s, bag); if (dolgu !== undefined) break; }
    if (dolgu === undefined) dolgu = stilDolgu(stil, bag);
    if (dolgu && dolgu.resimId) { const r = bag.il[dolgu.resimId]; dolgu = { resim: await medya(r && r.hedef), kirp: dolgu.kirp }; if (!dolgu.resim) dolgu = null; }
    if (dolgu && dolgu.yok) dolgu = null;
    const cizgi = cizgiCoz(spPrler, stil, bag);
    const metin = metinOku(c(e, 'txBody'), bag, { ph, phL, phM, stil });
    const s = { k: pt(k), geom, ayar, dolgu, cizgi, golge: golgeCoz(spPr, bag), metin, yol: ozel ? ozelYolOku(geomE) : null };
    s.tur = CIZGI_GEOM.test(geom) ? 'cizgi' : 'sekil';
    if (s.tur === 'sekil' && !s.dolgu && !s.cizgi && !s.metin) return;
    if (s.tur === 'cizgi' && !s.cizgi) return;
    cikti.push(s);
  }
  async function resimOku(e, bag, T, cikti) {
    const bf = c(e, 'blipFill'), x = yolC(e, 'spPr', 'xfrm');
    if (!bf || !x) return;
    if (at(yolC(e, 'nvPicPr', 'cNvPr'), 'hidden') === '1') return;
    const r = bag.il[rAt(c(bf, 'blip'), 'embed')];
    const u = await medya(r && r.hedef);
    if (!u) return;
    cikti.push({ tur: 'resim', k: pt(T(xfrmOku(x))), url: u, kirp: kirpOku(c(bf, 'srcRect')), cizgi: cizgiCoz([c(e, 'spPr')], c(e, 'style'), bag) });
  }
  const pt = (k) => ({ x: k.x / EMU, y: k.y / EMU, w: k.w / EMU, h: k.h / EMU, rot: k.rot, fh: k.fh, fv: k.fv });

  const slaytlar = [];
  const liste = cs(c(sk, 'sldIdLst'), 'sldId');
  for (let i = 0; i < liste.length; i++) {
    const r = sIl[rAt(liste[i], 'id')];
    if (!r || !r.hedef) continue;
    const x = await xml(r.hedef);
    if (!x) continue;
    const k = x.documentElement;
    if (at(k, 'show') === '0') continue;                         /* gizlenmiş sayfa */
    const il = await iliskiler(r.hedef);
    const dy = Object.values(il).find((q) => q.tur === 'slideLayout');
    const duzen = dy ? await duzenOku(dy.hedef) : null;
    const ana = duzen ? duzen.ana : null;
    if (!ana) continue;
    let harita = ana.harita;
    const ovr = c(c(k, 'clrMapOvr'), 'overrideClrMapping');
    if (ovr) { harita = {}; for (const a of ovr.attributes) harita[a.name] = a.value; }
    const txStil = (ph) => { const t = at(ph, 'type', 'body'); return t === 'title' || t === 'ctrTitle' ? ana.baslikStil : (t === 'body' || t === 'subTitle' || t === 'obj' ? ana.govdeStil : ana.digerStil); };
    const ortak = { tema: ana.tema, harita, ana, duzen, txStil, varsayilanStil };
    const sekiller = [], atlanan = { n: 0 };
    const anaSekil = at(k, 'showMasterSp') !== '0';
    if (anaSekil && at(duzen.k, 'showMasterSp') !== '0') await agacOku(c(c(ana.k, 'cSld'), 'spTree'), Object.assign({ il: ana.il }, ortak), BIRIM, sekiller, 'ana', { n: 0 });
    if (anaSekil) await agacOku(c(c(duzen.k, 'cSld'), 'spTree'), Object.assign({ il: duzen.il }, ortak), BIRIM, sekiller, 'duzen', { n: 0 });
    await agacOku(c(c(k, 'cSld'), 'spTree'), Object.assign({ il }, ortak), BIRIM, sekiller, 'slayt', atlanan);
    let zemin = await arkaPlan(k, Object.assign({ il }, ortak), il);
    if (zemin === undefined) zemin = await arkaPlan(duzen.k, Object.assign({ il: duzen.il }, ortak), duzen.il);
    if (zemin === undefined) zemin = await arkaPlan(ana.k, Object.assign({ il: ana.il }, ortak), ana.il);
    slaytlar.push({ no: slaytlar.length + 1, zemin: zemin || '#FFFFFF', sekiller, atlanan: atlanan.n, baslik: baslikBul(sekiller, H / EMU) });
  }
  if (!slaytlar.length) throw new Error('Sunuda gösterilecek sayfa bulunamadı.');
  return { w: W / EMU, h: H / EMU, slaytlar, urller };
}
export function modelBirak(m) { if (m && m.urller) m.urller.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) { /* zaten kapalı */ } }); }

/* Sayfa başlığı: üst bölümdeki (ilk %30) en büyük yazılı paragraf */
function baslikBul(sekiller, h) {
  let en = null;
  for (const s of sekiller) {
    if (!s.metin || s.k.y > h * 0.3) continue;
    for (const p of s.metin.paragraflar) {
      const t = p.kosular.map((k) => (k.br ? ' ' : k.t)).join('').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const sz = Math.max(...p.kosular.filter((k) => /\S/.test(k.t)).map((k) => k.sz));
      if (!en || sz > en.sz + 0.01) en = { sz, t };
    }
  }
  return en ? (en.t.length > 90 ? en.t.slice(0, 88) + '…' : en.t) : '';
}

/* ------------------------------------------------------------------ çizim */
const STIL_ID = 'pptx-gorunum-stil';
function stilEkle() {
  if (document.getElementById(STIL_ID)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = YAZI_CSS; l.id = STIL_ID + '-yazi';
  document.head.appendChild(l);
  const s = document.createElement('style');
  s.id = STIL_ID;
  s.textContent =
    /* font-size:0 → paragrafın kendi (boş) yazı boyutu satır yüksekliğine karışmaz; her yazı kendi boyutunu taşır */
    '.ps-slayt{position:relative;overflow:hidden;font-family:' + YAZI_YEDEK + ';font-size:0;color:#000;line-height:' + SATIR + ';text-align:left;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:none;text-size-adjust:none;contain:layout paint}' +
    '.ps-slayt *{box-sizing:border-box}' +
    '.ps-s,.ps-r,.ps-c{position:absolute}' +
    '.ps-s>svg,.ps-c{overflow:visible}' +
    '.ps-m{position:absolute;display:flex;flex-direction:column;overflow:visible}' +
    '.ps-p{margin:0;white-space:pre-wrap;overflow-wrap:break-word}' +
    '.ps-p.nw{white-space:pre;display:flex}' +
    '.ps-p.nw>.ps-ic{display:inline-block;flex:none}' +
    '.ps-r{overflow:hidden}.ps-r img{position:absolute;display:block;max-width:none}';
  document.head.appendChild(s);
}
function ogeYap(etiket, sinif) { const e = document.createElement(etiket); if (sinif) e.className = sinif; return e; }
const svgNS = 'http://www.w3.org/2000/svg';
const svgYap = (ad, oz) => { const e = document.createElementNS(svgNS, ad); if (oz) for (const k in oz) if (oz[k] !== null && oz[k] !== undefined) e.setAttribute(k, oz[k]); return e; };
let markaSayac = 0;

export function slaytCiz(slayt, model) {
  stilEkle();
  const kok = ogeYap('div', 'ps-slayt');
  kok.style.width = (model.w * PX).toFixed(2) + 'px';
  kok.style.height = (model.h * PX).toFixed(2) + 'px';
  kok.style.background = slayt.zemin || '#FFFFFF';
  for (const s of slayt.sekiller) {
    const e = s.tur === 'cizgi' ? cizgiCiz(s) : s.tur === 'resim' ? resimCiz(s) : sekilCiz(s);
    if (e) kok.appendChild(e);
  }
  return kok;
}

const KESIK = { dash: [4, 3], sysDash: [3, 1], dot: [1, 1], sysDot: [1, 1], lgDash: [8, 3], dashDot: [4, 3, 1, 3], sysDashDot: [3, 1, 1, 1], lgDashDot: [8, 3, 1, 3], lgDashDotDot: [8, 3, 1, 3, 1, 3], sysDashDotDot: [3, 1, 1, 1, 1, 1] };
function kesikDizi(c_, w) { const k = KESIK[c_.kesik]; return k ? k.map((x) => (x * w * PX).toFixed(2)).join(' ') : null; }
function cssKenar(c_) { return c_.kesik === 'solid' ? 'solid' : /dot/i.test(c_.kesik) && !/dash/i.test(c_.kesik) ? 'dotted' : 'dashed'; }
function donmusNokta(x, y, k) {
  if (k.fh) x = k.w - x;
  if (k.fv) y = k.h - y;
  if (k.rot) { const a = k.rot * Math.PI / 180, cx = k.w / 2, cy = k.h / 2, dx = x - cx, dy = y - cy; x = cx + dx * Math.cos(a) - dy * Math.sin(a); y = cy + dx * Math.sin(a) + dy * Math.cos(a); }
  return [k.x + x, k.y + y];
}

/* Hazır şekil yolları (pt, şeklin kendi kutusunda). Bilinmeyen şekil dikdörtgen çizilir. */
function hazirYol(g, w, h, a) {
  const ss = Math.min(w, h), v = (ad, d) => (a[ad] != null ? a[ad] : d) / 100000;
  const P = (...n) => 'M' + n.map((q, i) => (i % 2 ? '' : (i ? 'L' : '')) + q.toFixed(2) + (i % 2 ? '' : ' ')).join('') + 'Z';
  switch (g) {
    case 'triangle': { const x = w * v('adj', 50000); return P(x, 0, w, h, 0, h); }
    case 'rtTriangle': return P(0, 0, w, h, 0, h);
    case 'diamond': return P(w / 2, 0, w, h / 2, w / 2, h, 0, h / 2);
    case 'parallelogram': { const x = ss * v('adj', 25000); return P(x, 0, w, 0, w - x, h, 0, h); }
    case 'trapezoid': { const x = ss * v('adj', 25000); return P(x, 0, w - x, 0, w, h, 0, h); }
    case 'homePlate': { const x = w - ss * v('adj', 50000); return P(0, 0, x, 0, w, h / 2, x, h, 0, h); }
    case 'chevron': { const x = ss * v('adj', 50000); return P(0, 0, w - x, 0, w, h / 2, w - x, h, 0, h, x, h / 2); }
    case 'pentagon': return P(w / 2, 0, w, h * 0.38, w * 0.81, h, w * 0.19, h, 0, h * 0.38);
    case 'hexagon': { const x = ss * v('adj', 25000); return P(x, 0, w - x, 0, w, h / 2, w - x, h, x, h, 0, h / 2); }
    case 'octagon': { const x = ss * v('adj', 29289); return P(x, 0, w - x, 0, w, x, w, h - x, w - x, h, x, h, 0, h - x, 0, x); }
    case 'plus': { const x = ss * v('adj', 25000); return P(x, 0, w - x, 0, w - x, x, w, x, w, h - x, w - x, h - x, w - x, h, x, h, x, h - x, 0, h - x, 0, x, x, x); }
    case 'rightArrow': { const b = h * v('adj1', 50000) / 2, x = w - ss * v('adj2', 50000); return P(0, h / 2 - b, x, h / 2 - b, x, 0, w, h / 2, x, h, x, h / 2 + b, 0, h / 2 + b); }
    case 'leftArrow': { const b = h * v('adj1', 50000) / 2, x = ss * v('adj2', 50000); return P(w, h / 2 - b, x, h / 2 - b, x, 0, 0, h / 2, x, h, x, h / 2 + b, w, h / 2 + b); }
    case 'upArrow': { const b = w * v('adj1', 50000) / 2, y = ss * v('adj2', 50000); return P(w / 2 - b, h, w / 2 - b, y, 0, y, w / 2, 0, w, y, w / 2 + b, y, w / 2 + b, h); }
    case 'downArrow': { const b = w * v('adj1', 50000) / 2, y = h - ss * v('adj2', 50000); return P(w / 2 - b, 0, w / 2 + b, 0, w / 2 + b, y, w, y, w / 2, h, 0, y, w / 2 - b, y); }
    case 'snip1Rect': { const x = ss * v('adj', 16667); return P(0, 0, w - x, 0, w, x, w, h, 0, h); }
    case 'snip2SameRect': { const x = ss * v('adj1', 16667); return P(x, 0, w - x, 0, w, x, w, h, 0, h, 0, x); }
    case 'flowChartTerminator': { const r = Math.min(h / 2, w / 2); return 'M' + r + ' 0H' + (w - r) + 'A' + r + ' ' + (h / 2) + ' 0 0 1 ' + (w - r) + ' ' + h + 'H' + r + 'A' + r + ' ' + (h / 2) + ' 0 0 1 ' + r + ' 0Z'; }
    case 'flowChartDecision': return P(w / 2, 0, w, h / 2, w / 2, h, 0, h / 2);
    default: return null;
  }
}
const CSS_GEOM = { rect: 1, roundRect: 1, ellipse: 1, flowChartProcess: 1, flowChartAlternateProcess: 1, flowChartConnector: 1, round2SameRect: 1, round1Rect: 1, textBox: 1 };

function sekilCiz(s) {
  const k = s.k, d = ogeYap('div', 'ps-s');
  const cz = s.cizgi, lw = cz ? Math.max(cz.w, 0.25) : 0;
  const yol = s.geom === 'ozel' ? null : CSS_GEOM[s.geom] ? null : hazirYol(s.geom, k.w, k.h, s.ayar);
  const svgli = (s.geom === 'ozel' && s.yol) || yol;
  let ic = 0;                                                       /* metin kutusunun geometri kenarına göre kayması */
  if (svgli) {
    d.style.left = (k.x * PX).toFixed(2) + 'px'; d.style.top = (k.y * PX).toFixed(2) + 'px';
    d.style.width = (k.w * PX).toFixed(2) + 'px'; d.style.height = (k.h * PX).toFixed(2) + 'px';
    const svg = svgYap('svg', { width: (k.w * PX).toFixed(2), height: (k.h * PX).toFixed(2), style: 'position:absolute;left:0;top:0' });
    const dolguCss = s.dolgu ? (s.dolgu.renk || null) : null;
    const yollar = yol ? [{ w: k.w, h: k.h, d: yol, dolgu: true, cizgi: true }] : s.yol;
    for (const y of yollar) {
      const sx = y.w ? k.w * PX / y.w : PX / EMU, sy = y.h ? k.h * PX / y.h : PX / EMU;   /* w/h yazılmamış yol: EMU */
      const g = svgYap('g', { transform: (k.fh || k.fv ? 'translate(' + (k.fh ? k.w * PX : 0) + ' ' + (k.fv ? k.h * PX : 0) + ') scale(' + (k.fh ? -1 : 1) + ' ' + (k.fv ? -1 : 1) + ') ' : '') + 'scale(' + sx + ' ' + sy + ')' });
      const p = svgYap('path', { d: y.d, fill: y.dolgu && dolguCss ? dolguCss : 'none', 'vector-effect': 'non-scaling-stroke' });
      if (y.cizgi && cz) { p.setAttribute('stroke', cz.css); p.setAttribute('stroke-width', (lw * PX).toFixed(2)); const kd = kesikDizi(cz, lw); if (kd) p.setAttribute('stroke-dasharray', kd); p.setAttribute('stroke-linejoin', 'round'); }
      g.appendChild(p); svg.appendChild(g);
    }
    if (s.golge && s.dolgu) svg.style.filter = 'drop-shadow(' + s.golge + ')';
    d.appendChild(svg);
  } else {
    d.style.left = ((k.x - lw / 2) * PX).toFixed(2) + 'px'; d.style.top = ((k.y - lw / 2) * PX).toFixed(2) + 'px';
    d.style.width = ((k.w + lw) * PX).toFixed(2) + 'px'; d.style.height = ((k.h + lw) * PX).toFixed(2) + 'px';
    if (s.dolgu) {
      if (s.dolgu.renk) d.style.backgroundColor = s.dolgu.renk;
      else if (s.dolgu.gradyan) d.style.backgroundImage = s.dolgu.gradyan;
      else if (s.dolgu.resim) { d.style.backgroundImage = 'url("' + s.dolgu.resim + '")'; d.style.backgroundSize = '100% 100%'; }
      d.style.backgroundClip = 'padding-box';
    }
    if (cz) { d.style.border = (lw * PX).toFixed(2) + 'px ' + cssKenar(cz) + ' ' + cz.css; ic = lw / 2; }
    const yc = (r) => ((r + lw / 2) * PX).toFixed(2) + 'px';
    const ss = Math.min(k.w, k.h);
    if (s.geom === 'roundRect' || s.geom === 'flowChartAlternateProcess') d.style.borderRadius = yc(ss * (s.ayar.adj != null ? s.ayar.adj : 16667) / 100000);
    else if (s.geom === 'ellipse' || s.geom === 'flowChartConnector') d.style.borderRadius = '50%';
    else if (s.geom === 'round2SameRect') { const r = yc(ss * (s.ayar.adj1 != null ? s.ayar.adj1 : 16667) / 100000); d.style.borderRadius = r + ' ' + r + ' 0 0'; }
    else if (s.geom === 'round1Rect') d.style.borderTopRightRadius = yc(ss * (s.ayar.adj != null ? s.ayar.adj : 16667) / 100000);
    if (s.golge && s.dolgu) d.style.boxShadow = s.golge;
  }
  if (k.rot) d.style.transform = 'rotate(' + k.rot.toFixed(3) + 'deg)';
  if (s.metin) d.appendChild(metinCiz(s.metin, ic));
  return d;
}

function metinCiz(m, ic) {
  const kap = ogeYap('div', 'ps-m');
  const [l, t, r, b] = m.ins;
  kap.style.left = ((l - ic) * PX).toFixed(2) + 'px'; kap.style.top = ((t - ic) * PX).toFixed(2) + 'px';
  kap.style.right = ((r - ic) * PX).toFixed(2) + 'px'; kap.style.bottom = ((b - ic) * PX).toFixed(2) + 'px';
  kap.style.justifyContent = m.capa === 'ctr' || m.capa === 'just' || m.capa === 'dist' ? 'center' : m.capa === 'b' ? 'flex-end' : 'flex-start';
  if (m.dikey === 'vert' || m.dikey === 'eaVert' || m.dikey === 'vert270' || m.dikey === 'wordArtVert') { kap.style.writingMode = 'vertical-rl'; if (m.dikey === 'vert270') kap.style.transform = 'rotate(180deg)'; }
  const sarma = m.sar !== 'none';
  const ol = m.olcek;
  m.paragraflar.forEach((p, i) => {
    const pe = ogeYap('div', 'ps-p' + (sarma ? '' : ' nw'));
    const hiza = { ctr: 'center', r: 'right', just: 'justify', dist: 'justify', justLow: 'justify', thaiDist: 'justify' }[p.hiza] || 'left';
    const gorunur = p.kosular.filter((k) => !k.br && k.t);
    const enBuyuk = Math.max(p.son.sz, ...gorunur.map((k) => k.sz)) * ol;
    const satirPx = enBuyuk * PX;
    if (p.satir) pe.style.lineHeight = p.satir.pt != null ? (p.satir.pt * PX).toFixed(2) + 'px' : (SATIR * p.satir.oran * (1 - m.azalt)).toFixed(3);
    else if (m.azalt) pe.style.lineHeight = (SATIR * (1 - m.azalt)).toFixed(3);
    const bosluk = (a) => (a ? (a.pt != null ? a.pt * PX : a.oran * satirPx * SATIR) : 0);
    if (i > 0 && p.once) pe.style.paddingTop = bosluk(p.once).toFixed(2) + 'px';
    if (p.sonra) pe.style.paddingBottom = bosluk(p.sonra).toFixed(2) + 'px';
    if (p.marL || p.girinti) {
      pe.style.paddingLeft = (p.marL * PX).toFixed(2) + 'px';
      pe.style.textIndent = (p.girinti * PX).toFixed(2) + 'px';
    }
    let hedef = pe;
    if (!sarma) {
      pe.style.justifyContent = hiza === 'center' ? 'center' : hiza === 'right' ? 'flex-end' : 'flex-start';
      hedef = ogeYap('span', 'ps-ic'); hedef.style.textAlign = hiza; pe.appendChild(hedef);
    } else pe.style.textAlign = hiza;
    if (p.madde) {
      const ilk = gorunur[0] || p.son;
      const me = ogeYap('span');
      me.textContent = p.madde.k;
      me.style.display = 'inline-block';
      me.style.textIndent = '0';
      me.style.minWidth = (Math.max(0, -p.girinti) * PX).toFixed(2) + 'px';
      me.style.fontSize = (ilk.sz * ol * p.madde.oran * PX).toFixed(2) + 'px';
      me.style.color = p.madde.renk || ilk.renk;
      hedef.appendChild(me);
    }
    if (!gorunur.length) {
      const z = ogeYap('span'); z.textContent = '​'; z.style.fontSize = (p.son.sz * ol * PX).toFixed(2) + 'px'; hedef.appendChild(z);
    }
    for (const k of p.kosular) {
      if (k.br) { hedef.appendChild(document.createElement('br')); continue; }
      if (!k.t) continue;
      const sp = ogeYap('span');
      sp.textContent = k.t;
      const st = sp.style;
      st.fontSize = (k.sz * ol * PX).toFixed(2) + 'px';
      if (k.b) st.fontWeight = '700';
      if (k.i) st.fontStyle = 'italic';
      if (k.renk) st.color = k.renk;
      const aile = yaziAilesi(k.yazi); if (aile) st.fontFamily = aile;
      if (k.u || k.s) st.textDecoration = (k.u ? 'underline' : '') + (k.s ? ' line-through' : '');
      if (k.cap === 'all') st.textTransform = 'uppercase'; else if (k.cap === 'small') st.fontVariant = 'small-caps';
      if (k.bl) st.verticalAlign = (k.bl / 100 * k.sz * ol * PX).toFixed(2) + 'px';
      if (k.spc) st.letterSpacing = (k.spc * PX).toFixed(2) + 'px';
      hedef.appendChild(sp);
    }
    kap.appendChild(pe);
  });
  return kap;
}

function cizgiCiz(s) {
  const k = s.k, cz = s.cizgi, lw = Math.max(cz.w, 0.25);
  let yerel;                                                       /* şeklin kendi kutusunda (döndürme/çevirme öncesi) noktalar */
  const g = s.geom, a = (ad, d) => (s.ayar[ad] != null ? s.ayar[ad] : d) / 100000;
  if (/^bentConnector2$/.test(g)) yerel = [[0, 0], [k.w, 0], [k.w, k.h]];
  else if (/^bentConnector[345]$/.test(g)) { const x = k.w * a('adj1', 50000); yerel = [[0, 0], [x, 0], [x, k.h], [k.w, k.h]]; }
  else yerel = [[0, 0], [k.w, k.h]];
  const n = yerel.map(([x, y]) => donmusNokta(x, y, k));
  const egri = /^curvedConnector/.test(g) && n.length === 2;
  const pay = lw * 6 + 2;
  const xs = n.map((q) => q[0]), ys = n.map((q) => q[1]);
  const x0 = Math.min(...xs) - pay, y0 = Math.min(...ys) - pay, gw = Math.max(...xs) + pay - x0, gh = Math.max(...ys) + pay - y0;
  const svg = svgYap('svg', { class: 'ps-c', width: (gw * PX).toFixed(2), height: (gh * PX).toFixed(2), viewBox: '0 0 ' + (gw * PX).toFixed(2) + ' ' + (gh * PX).toFixed(2) });
  svg.style.left = (x0 * PX).toFixed(2) + 'px'; svg.style.top = (y0 * PX).toFixed(2) + 'px';
  const q = n.map(([x, y]) => [((x - x0) * PX).toFixed(2), ((y - y0) * PX).toFixed(2)]);
  let d;
  if (egri) { const mx = ((+q[0][0] + +q[1][0]) / 2).toFixed(2); d = 'M' + q[0].join(' ') + 'C' + mx + ' ' + q[0][1] + ' ' + mx + ' ' + q[1][1] + ' ' + q[1].join(' '); }
  else d = 'M' + q.map((z) => z.join(' ')).join('L');
  const p = svgYap('path', { d, fill: 'none', stroke: cz.css, 'stroke-width': (lw * PX).toFixed(2), 'stroke-linecap': cz.uc === 'rnd' ? 'round' : cz.uc === 'sq' ? 'square' : 'butt', 'stroke-linejoin': 'round' });
  const kd = kesikDizi(cz, lw); if (kd) p.setAttribute('stroke-dasharray', kd);
  const uc = (u, son) => {
    if (!u) return;
    const id = 'psm' + (++markaSayac);
    const boy = { sm: 2, med: 3, lg: 5 };
    const mw = boy[u.w] || 3, ml = boy[u.l] || 3;
    const m = svgYap('marker', { id, viewBox: '0 0 10 10', refX: u.tur === 'oval' || u.tur === 'diamond' ? 5 : 9, refY: 5, markerWidth: ml, markerHeight: mw, orient: 'auto-start-reverse', markerUnits: 'strokeWidth' });
    const sekil = u.tur === 'oval' ? svgYap('circle', { cx: 5, cy: 5, r: 4.5, fill: cz.css }) : u.tur === 'diamond' ? svgYap('path', { d: 'M0 5L5 0L10 5L5 10Z', fill: cz.css }) : u.tur === 'arrow' ? svgYap('path', { d: 'M0 0L10 5L0 10', fill: 'none', stroke: cz.css, 'stroke-width': 1.5 }) : svgYap('path', { d: 'M0 0L10 5L0 10Z', fill: cz.css });
    m.appendChild(sekil);
    let defs = svg.querySelector('defs'); if (!defs) { defs = svgYap('defs'); svg.appendChild(defs); }
    defs.appendChild(m);
    p.setAttribute(son ? 'marker-end' : 'marker-start', 'url(#' + id + ')');
  };
  uc(cz.bas, false); uc(cz.son, true);
  svg.appendChild(p);
  return svg;
}

function resimCiz(s) {
  const k = s.k, d = ogeYap('div', 'ps-r');
  d.style.left = (k.x * PX).toFixed(2) + 'px'; d.style.top = (k.y * PX).toFixed(2) + 'px';
  d.style.width = (k.w * PX).toFixed(2) + 'px'; d.style.height = (k.h * PX).toFixed(2) + 'px';
  const img = document.createElement('img');
  img.src = s.url; img.alt = ''; img.draggable = false;
  const kr = s.kirp || { l: 0, t: 0, r: 0, b: 0 };
  const gw = 1 - kr.l - kr.r || 1, gh = 1 - kr.t - kr.b || 1;
  img.style.width = (k.w * PX / gw).toFixed(2) + 'px'; img.style.height = (k.h * PX / gh).toFixed(2) + 'px';
  img.style.left = (-kr.l * k.w * PX / gw).toFixed(2) + 'px'; img.style.top = (-kr.t * k.h * PX / gh).toFixed(2) + 'px';
  const t = [];
  if (k.fh) t.push('scaleX(-1)');
  if (k.fv) t.push('scaleY(-1)');
  if (t.length) img.style.transform = t.join(' ');
  d.appendChild(img);
  if (s.cizgi) d.style.outline = (Math.max(s.cizgi.w, 0.25) * PX).toFixed(2) + 'px ' + cssKenar(s.cizgi) + ' ' + s.cizgi.css;
  if (k.rot) d.style.transform = 'rotate(' + k.rot.toFixed(3) + 'deg)';
  return d;
}
