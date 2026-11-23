/* ============================================================================
   AJAN OFİSİ · VİDEO STÜDYOSU — Video Editörünün sahne planını tuvale çizer,
   ElevenLabs ile seslendirir ve MediaRecorder ile video dosyası üretir (build yok).
   Kurumsal çerçeve: üst marka bandı + sahne sayacı, alt altyazı (seslendirme metni),
   bilgi veren görsel sahneler: form ekranı, akış şeması, rol tablosu, karşılaştırma.
   ============================================================================ */
const VW = 1920, VH = 1080;
const R = {
  lacivert: '#16294a', koyu: '#0d1a30', orta: '#1f3a66', acik: '#2c4f86', pirinc: '#b08d57', acikPirinc: '#d9bf8f',
  beyaz: '#ffffff', gri: '#c9d3e0', soluk: '#8b98ad', zemin: '#f3f5f8', cizgi: '#d9e0ea', metin: '#1b2433', yesil: '#2f7a53', sari: '#b7832f', kirmizi: '#a8423d'
};
const SANS = 'Inter, "Segoe UI", sans-serif', SERIF = '"Source Serif 4", Georgia, serif';
const UST_BANT = 96, ALT_PAY = 170;       /* içerik alanı: UST_BANT .. VH-ALT_PAY */

/* ---------------------------------------------------------------- ses önbelleği (IndexedDB, isteğe bağlı) */
function idb() {
  return new Promise((coz) => {
    try {
      const r = indexedDB.open('ajan-ofisi-ses', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('ses');
      r.onsuccess = () => coz(r.result); r.onerror = () => coz(null);
    } catch (e) { coz(null); }
  });
}
async function onbellekAl(k) { const d = await idb(); if (!d) return null; return new Promise((coz) => { try { const q = d.transaction('ses').objectStore('ses').get(k); q.onsuccess = () => coz(q.result || null); q.onerror = () => coz(null); } catch (e) { coz(null); } }); }
async function onbellekKoy(k, v) { const d = await idb(); if (!d) return; try { d.transaction('ses', 'readwrite').objectStore('ses').put(v, k); } catch (e) { /* önbellek isteğe bağlı */ } }
async function ozet(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32); }

/* konuşma hızı: ofis sahibi "çok çok az daha hızlı" istedi (17.11.2026) → 1,07 (ElevenLabs aralığı 0,7–1,2) */
const SES_HIZI = 1.07;
/* Okunuş (23.11.2026, ofis sahibi): "İK" kısaltması seslendirmede bir yerde "ik", başka yerde "i-ka" okundu; her yerde "i-ka"
   okunsun. Yalnız sese giden metin değişir; altyazı ve ekrandaki yazı "İK" kalır. "İK'nın", "İK Portalı" da kapsanır. */
export function okunus(metin) {
  return String(metin == null ? '' : metin).replace(/(^|[^\p{L}\p{N}])İK(?![\p{L}\p{N}])/gu, '$1İ-Ka');
}
export async function seslendir(metin, { anahtar, sesId }) {
  metin = okunus(metin);
  const k = await ozet(sesId + '|' + SES_HIZI + '|' + metin);
  const eski = await onbellekAl(k);
  if (eski) return eski;
  const iste = (ayarli) => fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(sesId) + '?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': anahtar, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(Object.assign({ text: metin, model_id: 'eleven_multilingual_v2' },
      ayarli ? { voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: SES_HIZI } } : {}))
  });
  let r = await iste(true);
  /* hesap/ses hız ayarını kabul etmezse ayarsız (normal hız) dene; video yine sesli çıksın */
  if (r.status === 400 || r.status === 422) r = await iste(false);
  if (!r.ok) {
    let ayr = ''; try { ayr = (await r.text()).slice(0, 160); } catch (e) { /* yok */ }
    throw new Error(r.status === 401 ? 'ElevenLabs anahtarı geçersiz.' : r.status === 404 ? 'ElevenLabs ses kimliği (Voice ID) bulunamadı.' : 'ElevenLabs hatası ' + r.status + (ayr ? ': ' + ayr : ''));
  }
  const ab = await r.arrayBuffer();
  await onbellekKoy(k, ab);
  return ab;
}

/* ---------------------------------------------------------------- çizim yardımcıları */
function sar(ctx, metin, maxW) {
  const kelimeler = String(metin || '').split(/\s+/).filter(Boolean); const satirlar = []; let s = '';
  for (const k of kelimeler) { const d = s ? s + ' ' + k : k; if (ctx.measureText(d).width > maxW && s) { satirlar.push(s); s = k; } else s = d; }
  if (s) satirlar.push(s);
  return satirlar;
}
function kisalt(ctx, metin, maxW) {
  let s = String(metin || ''); if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
const yumusak = (t) => t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3);
function kutu(ctx, x, y, w, h, r, dolgu, cizgi, kalinlik) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  if (dolgu) { ctx.fillStyle = dolgu; ctx.fill(); }
  if (cizgi) { ctx.strokeStyle = cizgi; ctx.lineWidth = kalinlik || 2; ctx.stroke(); }
}
function yazi(ctx, metin, x, y, font, renk, hiza) { ctx.font = font; ctx.fillStyle = renk; ctx.textAlign = hiza || 'left'; ctx.fillText(metin, x, y); }
function tik(ctx, x, y, s, renk) { ctx.save(); ctx.strokeStyle = renk; ctx.lineWidth = s * 0.18; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - s * 0.4, y); ctx.lineTo(x - s * 0.1, y + s * 0.3); ctx.lineTo(x + s * 0.45, y - s * 0.35); ctx.stroke(); ctx.restore(); }
function ok(ctx, x1, y, x2, renk) { ctx.save(); ctx.strokeStyle = renk; ctx.fillStyle = renk; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2 - 14, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2 - 18, y - 10); ctx.lineTo(x2 - 18, y + 10); ctx.closePath(); ctx.fill(); ctx.restore(); }

/* ---------------------------------------------------------------- kurumsal çerçeve */
function arkaPlan(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, VW, VH); g.addColorStop(0, R.koyu); g.addColorStop(1, R.lacivert);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.globalAlpha = 0.06; ctx.strokeStyle = R.acikPirinc; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { const r = 300 + i * 130 + Math.sin(t * 0.25 + i) * 14; ctx.beginPath(); ctx.arc(VW * 0.9, VH * 0.12, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
function ustBant(ctx, plan, i, n) {
  ctx.fillStyle = 'rgba(8,16,30,.55)'; ctx.fillRect(0, 0, VW, UST_BANT);
  ctx.fillStyle = R.pirinc; ctx.fillRect(0, UST_BANT - 3, VW, 3);
  kutu(ctx, 96, 26, 44, 44, 8, null, R.acikPirinc, 2.5);
  yazi(ctx, 'İ', 118, 58, '700 28px ' + SERIF, R.acikPirinc, 'center');
  ctx.textBaseline = 'alphabetic';
  yazi(ctx, 'İNCİROĞLU OTOMOTİV', 160, 46, '700 22px ' + SANS, R.beyaz);
  yazi(ctx, 'İnsan Kaynakları', 160, 72, '500 18px ' + SANS, R.gri);
  ctx.font = '500 22px ' + SANS; const bas = kisalt(ctx, plan.baslik || '', 900);
  yazi(ctx, bas, VW - 260, 56, '500 22px ' + SANS, R.gri, 'right');
  kutu(ctx, VW - 220, 30, 124, 40, 20, 'rgba(255,255,255,.08)', 'rgba(217,191,143,.6)', 2);
  yazi(ctx, String(i + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0'), VW - 158, 58, '700 20px ' + SANS, R.acikPirinc, 'center');
}
/* Uzun seslendirme metni ikişer satırlık sayfalara bölünür ve sahne süresince sırayla gösterilir (23.11.2026: tek sahnede
   ~30 kelimelik açılış cümlesi iki satırda kesiliyordu). */
function altyaziSayfa(sat, lt, sure) {
  const sayfa = []; for (let i = 0; i < sat.length; i += 2) sayfa.push(sat.slice(i, i + 2));
  if (sayfa.length < 2) return sayfa[0] || [];
  /* süre, sayfaların metin uzunluğuna göre paylaştırılır (anlatıcının okuma hızına yakın) */
  const uz = sayfa.map((p) => p.join(' ').length), top = uz.reduce((a, b) => a + b, 0);
  let f = Math.max(0, lt) / Math.max(sure, 0.1) * top;
  for (let k = 0; k < sayfa.length - 1; k++) { if (f < uz[k]) return sayfa[k]; f -= uz[k]; }
  return sayfa[sayfa.length - 1];
}
function altyazi(ctx, metin, lt, sure) {
  if (!metin) return;
  const a = Math.min(yumusak(lt / 0.5), 1 - yumusak((lt - (sure - 0.4)) / 0.4));
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = '500 34px ' + SANS;
  const sat = altyaziSayfa(sar(ctx, metin, 1500), lt, sure);
  const h = 30 + sat.length * 46;
  const y0 = VH - 64 - h;
  kutu(ctx, 190, y0, VW - 380, h, 14, 'rgba(8,16,30,.72)', null);
  ctx.fillStyle = R.pirinc; ctx.fillRect(190, y0 + 14, 5, h - 28);
  sat.forEach((s, k) => yazi(ctx, s, VW / 2, y0 + 50 + k * 46, '500 34px ' + SANS, R.beyaz, 'center'));
  ctx.restore();
}
function ilerlemeCiz(ctx, oran) {
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, VH - 10, VW, 10);
  ctx.fillStyle = R.pirinc; ctx.fillRect(0, VH - 10, VW * oran, 10);
}
function bolumBasligi(ctx, s, x, y, kay, genislik) {
  if (s.ust) yazi(ctx, s.ust.toLocaleUpperCase('tr'), x, y + kay, '700 26px ' + SANS, R.acikPirinc);
  ctx.font = '600 56px ' + SERIF; ctx.fillStyle = R.beyaz; ctx.textAlign = 'left';
  const sat = sar(ctx, s.baslik, genislik || 1600).slice(0, 2);
  sat.forEach((x2, i) => ctx.fillText(x2, x, y + 66 + i * 64 + kay));
  return y + 66 + sat.length * 64;
}

/* ---------------------------------------------------------------- sahneler */
function sahneCiz(ctx, s, lt, sure) {
  const giris = yumusak(lt / 0.7); const cikis = 1 - yumusak((lt - (sure - 0.45)) / 0.45);
  const gor = Math.max(0, Math.min(giris, cikis)); const kay = (1 - giris) * 36;
  ctx.save(); ctx.globalAlpha = gor; ctx.textBaseline = 'alphabetic';
  const adimA = (i, gecikme, aralik) => Math.min(yumusak((lt - gecikme - i * aralik) / 0.5), cikis);

  if (s.tur === 'baslik' || s.tur === 'kapanis') {
    if (s.ust) yazi(ctx, s.ust.toLocaleUpperCase('tr'), VW / 2, 400 + kay, '700 32px ' + SANS, R.acikPirinc, 'center');
    ctx.fillStyle = R.pirinc; ctx.fillRect(VW / 2 - 70, 430 + kay, 140, 5);
    ctx.font = '600 96px ' + SERIF; ctx.fillStyle = R.beyaz; ctx.textAlign = 'center';
    sar(ctx, s.baslik, 1500).slice(0, 2).forEach((x, i) => ctx.fillText(x, VW / 2, 540 + i * 108 + kay));
    (s.maddeler || []).slice(0, 3).forEach((m, i) => { ctx.globalAlpha = adimA(i, 0.6, 0.3); yazi(ctx, m, VW / 2, 720 + i * 50, '500 34px ' + SANS, R.gri, 'center'); });
  } else if (s.tur === 'rakam') {
    yazi(ctx, s.rakam || '—', 160, 560 + kay, '700 280px ' + SERIF, R.pirinc);
    ctx.font = '700 280px ' + SERIF; const w = ctx.measureText(s.rakam || '—').width;
    ctx.font = '600 60px ' + SERIF; ctx.fillStyle = R.beyaz; ctx.textAlign = 'left';
    sar(ctx, s.baslik, 1500 - w).slice(0, 2).forEach((x, i) => ctx.fillText(x, 200 + w, 400 + i * 72 + kay));
    (s.maddeler || []).slice(0, 3).forEach((m, i) => { ctx.globalAlpha = adimA(i, 0.7, 0.4); tik(ctx, 222 + w, 520 + i * 60, 28, R.acikPirinc); yazi(ctx, m, 260 + w, 532 + i * 60, '500 36px ' + SANS, R.gri); });
  } else if (s.tur === 'form') {
    /* sol: kısa anlatım · sağ: oryantasyon formu ekranı (gerçek sütun yapısı) */
    /* sol maddeler: satır sayısına göre dizilir (sarılan madde alttakinin üstüne binmez) */
    let my = bolumBasligi(ctx, s, 110, 170, kay, 500) + 40;
    (s.maddeler || []).slice(0, 4).forEach((m, i) => {
      ctx.font = '500 30px ' + SANS; const sat = sar(ctx, m, 470).slice(0, 2);
      ctx.globalAlpha = adimA(i, 0.6, 0.35);
      ctx.fillStyle = R.pirinc; ctx.fillRect(114, my - 13, 12, 12);
      sat.forEach((x, k) => yazi(ctx, x, 142, my + k * 36, '500 30px ' + SANS, R.beyaz));
      my += sat.length * 36 + 24;
    });
    ctx.globalAlpha = gor;
    const fx = 660, fy = 140 + kay * 0.5, fw = 1160;
    const bas = (s.sutunlar && s.sutunlar.length ? s.sutunlar : ['Sıra', 'Konu', 'Kapsam', 'Sorumlu', 'Tarih', 'Saat', 'Süre']).slice(0, 7);
    const satirlar = (s.satirlar || []).slice(0, 8);
    const huc = (r, i) => String(Array.isArray(r) && r[i] != null ? r[i] : '');
    const secmeliMi = (i) => /tarih|saat|süre|sorumlu/i.test(bas[i] || '');
    const F_BAS = '700 20px ' + SANS, F_HUC = '500 20px ' + SANS, F_SIRA = '700 20px ' + SANS, F_CIP = '600 19px ' + SANS;
    /* sütun genişliği içeriğe göre: kısa sütunlar (sıra/tarih/saat/süre/sorumlu) tam görünür, kalan genişlik konu/kapsam'a */
    const iw = fw - 56;
    const dogal = bas.map((b, i) => {
      ctx.font = F_BAS; let w = ctx.measureText(b).width;
      satirlar.forEach((r) => { const d = huc(r, i); if (!d) return; ctx.font = secmeliMi(i) ? F_CIP : (i === 0 ? F_SIRA : F_HUC); w = Math.max(w, ctx.measureText(d).width + (secmeliMi(i) ? 30 : 0)); });
      return w + 22;
    });
    const genisler = bas.map((b, i) => i).filter((i) => /konu|kapsam|açıklama|aciklama|içerik|icerik/i.test(bas[i]));
    const esnek = genisler.length ? genisler : bas.map((b, i) => i);
    const sabit = bas.map((b, i) => i).filter((i) => esnek.indexOf(i) < 0);
    const gen = dogal.map((w, i) => (sabit.indexOf(i) >= 0 ? Math.min(w, 240) : w));
    const sabitTop = sabit.reduce((a, i) => a + gen[i], 0), esnekTop = esnek.reduce((a, i) => a + gen[i], 0) || 1;
    let kalan = iw - sabitTop; const asgari = 150 * esnek.length;
    if (kalan < asgari && sabitTop > 0) { const k = (iw - asgari) / sabitTop; sabit.forEach((i) => { gen[i] *= k; }); kalan = asgari; }
    const esnekOran = esnek.map((i) => gen[i]);
    esnek.forEach((i, j) => { gen[i] = kalan * esnekOran[j] / esnekTop; });
    const xs = []; let ax = fx + 28; for (const w of gen) { xs.push(ax); ax += w; } xs.push(fx + 28 + iw);
    /* uzun hücre iki satıra sarılır; satır yüksekliği buna göre */
    const satirSar = (d, w) => { ctx.font = F_HUC; const l = sar(ctx, d, w); return l.length <= 2 ? l : [l[0], kisalt(ctx, l.slice(1).join(' '), w)]; };
    let iki = satirlar.some((r) => bas.some((b, i) => !secmeliMi(i) && i > 0 && satirSar(huc(r, i), xs[i + 1] - xs[i] - 16).length > 1));
    const hy = fy + 80, ry0 = hy + 56;
    const etiketAlan = s.vurgu && s.vurgu.etiket ? 74 : 0;
    let sh = iki ? 80 : 64;
    const sigan = Math.floor((880 - etiketAlan - 24 - ry0) / Math.max(1, satirlar.length));
    if (sigan < sh) { sh = Math.max(52, sigan); if (sh < 72) iki = false; }
    const fh = ry0 - fy + satirlar.length * sh + 16 + etiketAlan;
    kutu(ctx, fx, fy, fw, fh, 16, R.zemin, null);
    kutu(ctx, fx, fy, fw, 64, 16, R.lacivert, null); ctx.fillStyle = R.lacivert; ctx.fillRect(fx, fy + 40, fw, 24);
    ctx.fillStyle = R.pirinc; ctx.fillRect(fx, fy + 62, fw, 3);
    yazi(ctx, kisaltF(ctx, s.ekranBaslik || 'Oryantasyon Formu', fw - 260, '600 26px ' + SANS), fx + 28, fy + 42, '600 26px ' + SANS, R.beyaz);
    yazi(ctx, 'İK Portalı', fx + fw - 28, fy + 42, '500 20px ' + SANS, R.acikPirinc, 'right');
    kutu(ctx, fx + 20, hy, fw - 40, 46, 8, '#e4e9f1', null);
    bas.forEach((b, i) => yazi(ctx, kisaltF(ctx, b, xs[i + 1] - xs[i] - 16, F_BAS), xs[i] + 8, hy + 30, F_BAS, R.lacivert));
    satirlar.forEach((r, k) => {
      ctx.globalAlpha = adimA(k, 0.5, 0.18);
      const ry = ry0 + k * sh, cy = ry + (sh - 8) / 2;
      kutu(ctx, fx + 20, ry, fw - 40, sh - 8, 8, R.beyaz, R.cizgi, 1.5);
      bas.forEach((b, i) => {
        const deger = huc(r, i); if (!deger) return;
        const cw = xs[i + 1] - xs[i] - 16;
        if (secmeliMi(i)) {
          ctx.font = F_CIP; const tw = Math.min(cw + 8, ctx.measureText(deger).width + 26);
          kutu(ctx, xs[i] + 4, cy - 16, tw, 32, 16, '#eef2f8', '#c9d3e0', 1.2);
          yazi(ctx, kisaltF(ctx, deger, tw - 22, F_CIP), xs[i] + 16, cy + 7, F_CIP, R.orta);
        } else if (i === 0) yazi(ctx, kisaltF(ctx, deger, cw, F_SIRA), xs[i] + 8, cy + 7, F_SIRA, R.metin);
        else {
          const l = iki ? satirSar(deger, cw) : [kisaltF(ctx, deger, cw, F_HUC)];
          l.forEach((t, q) => yazi(ctx, t, xs[i] + 8, (l.length > 1 ? cy - 5 : cy + 7) + q * 24, F_HUC, R.metin));
        }
      });
    });
    ctx.globalAlpha = gor;
    if (s.vurgu && satirlar.length) {
      const nab = 0.6 + 0.4 * Math.sin(lt * 4);
      const sutunVar = Number.isInteger(s.vurgu.sutun) && s.vurgu.sutun < bas.length;
      ctx.save(); ctx.globalAlpha = Math.min(gor, yumusak((lt - 1.4) / 0.5)) * nab;
      if (sutunVar) { const i = s.vurgu.sutun; kutu(ctx, xs[i] - 4, hy - 6, xs[i + 1] - xs[i] + 8, ry0 - hy + satirlar.length * sh + 2, 10, null, R.pirinc, 5); }
      if (Number.isInteger(s.vurgu.satir) && s.vurgu.satir < satirlar.length) { const ry = ry0 + s.vurgu.satir * sh; kutu(ctx, fx + 14, ry - 6, fw - 28, sh + 4, 10, null, R.pirinc, 5); }
      ctx.restore();
      if (s.vurgu.etiket) {
        /* not etiketi: vurgulanan sütunun hemen altında, oku sütunu gösterir */
        ctx.globalAlpha = Math.min(gor, yumusak((lt - 1.6) / 0.5));
        ctx.font = '700 22px ' + SANS; const tw = ctx.measureText(s.vurgu.etiket).width + 40;
        const ey = ry0 + satirlar.length * sh + 14;
        const cx = sutunVar ? (xs[s.vurgu.sutun] + xs[s.vurgu.sutun + 1]) / 2 : fx + fw - 40 - tw / 2;
        const ex = Math.max(fx + 20, Math.min(fx + fw - 20 - tw, cx - tw / 2));
        ctx.fillStyle = R.pirinc; ctx.beginPath(); ctx.moveTo(cx, ey); ctx.lineTo(cx - 11, ey + 13); ctx.lineTo(cx + 11, ey + 13); ctx.closePath(); ctx.fill();
        kutu(ctx, ex, ey + 12, tw, 42, 21, R.pirinc, null);
        yazi(ctx, s.vurgu.etiket, ex + tw / 2, ey + 41, '700 22px ' + SANS, R.beyaz, 'center');
      }
    }
  } else if (s.tur === 'akis') {
    const ust = bolumBasligi(ctx, s, 160, 170, kay, 1600);
    const ad = (s.adimlar || []).slice(0, 5); const n = Math.max(1, ad.length);
    const gw = Math.min(330, (1600 - (n - 1) * 90) / n), bosluk = n > 1 ? (1600 - n * gw) / (n - 1) : 0;
    const F_B = '700 30px ' + SANS, F_A = '500 23px ' + SANS;
    /* açıklama, başlığın bittiği satırdan başlar; kartlar eşit yükseklikte, dikeyde ortalı */
    const sat = ad.map((a) => { ctx.font = F_B; const b = sar(ctx, a.baslik, gw - 44).slice(0, 2); ctx.font = F_A; return { b, t: sar(ctx, a.alt, gw - 44).slice(0, 3) }; });
    const h = Math.max(220, ...sat.map((x) => (x.t.length ? 140 + x.t.length * 28 : 120) + x.b.length * 36));
    const y = Math.max(ust + 50, (ust + 880 - h) / 2);
    ad.forEach((a, i) => {
      const x = 160 + i * (gw + bosluk); const al = adimA(i, 0.5, 0.55);
      ctx.globalAlpha = al;
      kutu(ctx, x, y, gw, h, 18, 'rgba(255,255,255,.07)', i === n - 1 ? R.pirinc : 'rgba(217,191,143,.45)', 2.5);
      ctx.beginPath(); ctx.arc(x + 52, y + 56, 30, 0, Math.PI * 2); ctx.fillStyle = i === n - 1 ? R.pirinc : R.acik; ctx.fill();
      yazi(ctx, String(i + 1), x + 52, y + 67, '700 30px ' + SANS, R.beyaz, 'center');
      sat[i].b.forEach((t, k) => yazi(ctx, t, x + 24, y + 132 + k * 36, F_B, R.beyaz));
      const ay = y + 138 + sat[i].b.length * 36;
      sat[i].t.forEach((t, k) => yazi(ctx, t, x + 24, ay + k * 28, F_A, R.gri));
      if (i < n - 1) { ctx.globalAlpha = Math.min(al, adimA(i, 0.8, 0.55)); ok(ctx, x + gw + 12, y + h / 2, x + gw + bosluk - 12, R.acikPirinc); }
    });
  } else if (s.tur === 'tablo') {
    bolumBasligi(ctx, s, 160, 160, kay, 1600);
    const sut = (s.sutunlar || []).slice(0, 6); const sat = (s.satirlar || []).slice(0, 6);
    const tx = 160, ty = 380, ilk = 520, cw = Math.min(260, (VW - 320 - ilk) / Math.max(1, sut.length)), rh = 74;
    kutu(ctx, tx, ty, ilk + cw * sut.length, 64 + rh * sat.length, 16, 'rgba(255,255,255,.06)', 'rgba(217,191,143,.35)', 2);
    sut.forEach((c, i) => { ctx.font = '700 22px ' + SANS; sar(ctx, c, cw - 20).slice(0, 2).forEach((t, k) => yazi(ctx, t, tx + ilk + i * cw + cw / 2, ty + 30 + k * 24, '700 22px ' + SANS, R.acikPirinc, 'center')); });
    sat.forEach((r, k) => {
      ctx.globalAlpha = adimA(k, 0.5, 0.4);
      const ry = ty + 64 + k * rh;
      ctx.fillStyle = k % 2 ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.07)'; ctx.fillRect(tx + 2, ry, ilk + cw * sut.length - 4, rh);
      yazi(ctx, kisaltF(ctx, r.ad, ilk - 40, '600 28px ' + SANS), tx + 28, ry + 47, '600 28px ' + SANS, R.beyaz);
      (r.degerler || []).slice(0, sut.length).forEach((d, i) => {
        const cx = tx + ilk + i * cw + cw / 2;
        if (d === true) tik(ctx, cx, ry + rh / 2, 34, '#6fd29a');
        else if (d === false || d === '' || d == null) { ctx.fillStyle = 'rgba(201,211,224,.45)'; ctx.fillRect(cx - 14, ry + rh / 2 - 2, 28, 4); }
        else yazi(ctx, kisaltF(ctx, String(d), cw - 20, '600 22px ' + SANS), cx, ry + 46, '600 22px ' + SANS, R.acikPirinc, 'center');
      });
    });
  } else if (s.tur === 'karsilastirma') {
    bolumBasligi(ctx, s, 160, 160, kay, 1600);
    [['sol', 160, 'rgba(255,255,255,.05)', R.soluk], ['sag', 990, 'rgba(176,141,87,.14)', R.pirinc]].forEach(([k, x, dolgu, kenar], j) => {
      const p = s[k] || {}; const a = adimA(j, 0.5, 0.6); ctx.globalAlpha = a;
      kutu(ctx, x, 360, 770, 470, 18, dolgu, kenar, 2.5);
      yazi(ctx, (p.baslik || (j ? 'Şimdi' : 'Eskiden')).toLocaleUpperCase('tr'), x + 40, 420, '700 28px ' + SANS, j ? R.acikPirinc : R.gri);
      (p.maddeler || []).slice(0, 4).forEach((m, i) => {
        ctx.globalAlpha = Math.min(a, adimA(i, 0.9 + j * 0.6, 0.3));
        if (j) tik(ctx, x + 56, 488 + i * 84, 30, '#6fd29a'); else { ctx.fillStyle = R.soluk; ctx.fillRect(x + 42, 486 + i * 84, 28, 4); }
        ctx.font = '500 30px ' + SANS; sar(ctx, m, 620).slice(0, 2).forEach((t, q) => yazi(ctx, t, x + 96, 498 + i * 84 + q * 34, '500 30px ' + SANS, R.beyaz));
      });
    });
  } else if (s.tur === 'goruntu') {
    /* sol: kısa anlatım · sağ: tarayıcı çerçevesinde GERÇEK ekran görüntüsü; vurguya doğru yavaş yakınlaşma, çevresi hafif karartılır */
    let my = bolumBasligi(ctx, s, 110, 170, kay, 440) + 40;
    (s.maddeler || []).slice(0, 3).forEach((m, i) => {
      ctx.font = '500 29px ' + SANS; const sat = sar(ctx, m, 410).slice(0, 3);
      ctx.globalAlpha = adimA(i, 0.8, 0.45);
      ctx.fillStyle = R.pirinc; ctx.fillRect(114, my - 13, 12, 12);
      sat.forEach((x, k) => yazi(ctx, x, 142, my + k * 35, '500 29px ' + SANS, R.beyaz));
      my += sat.length * 35 + 24;
    });
    ctx.globalAlpha = gor;
    const fx = 590, fy = 138 + kay * 0.5, fw = 1230, bar = 40, aw = fw, ah = Math.round(fw * 9 / 16), ax = fx, ay = fy + bar;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 44; ctx.shadowOffsetY = 14; kutu(ctx, fx, fy, fw, bar + ah, 14, '#0b1526', null); ctx.restore();
    kutu(ctx, fx, fy, fw, bar + 16, 14, '#1c2c47', null);
    [0, 1, 2].forEach((i) => { ctx.beginPath(); ctx.arc(fx + 26 + i * 20, fy + 20, 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fill(); });
    kutu(ctx, fx + 110, fy + 9, fw - 220, 23, 11, 'rgba(255,255,255,.07)', null);
    yazi(ctx, PENCERE[s.gorsel] || 'İK Portalı · Oryantasyon Formları', fx + fw / 2, fy + 26, '500 15px ' + SANS, R.gri, 'center');
    const im = GORSEL.get(s.gorsel), v = s.vurgu;
    ctx.save(); ctx.beginPath(); ctx.rect(ax, ay, aw, ah); ctx.clip();
    let kx = 0, ky = 0, kw = 0, kh = 0;
    if (im) {
      const W = im.naturalWidth, H = im.naturalHeight;
      const t = Math.max(0, Math.min(1, (lt - 0.8) / Math.max(1, sure - 1.6))); const p = t * t * (3 - 2 * t);
      const z = 1 + ((s.yakinlik || 1) - 1) * p, sw = W / z, sh = H / z;
      const cx = v ? v.x + v.w / 2 : 0.5, cy = v ? v.y + v.h / 2 : 0.5;
      const sx = Math.max(0, Math.min(W - sw, cx * W - sw / 2)), sy = Math.max(0, Math.min(H - sh, cy * H - sh / 2));
      ctx.drawImage(im, sx, sy, sw, sh, ax, ay, aw, ah);
      if (v) {
        const k = aw / sw; kx = ax + (v.x * W - sx) * k - 6; ky = ay + (v.y * H - sy) * k - 6; kw = v.w * W * k + 12; kh = v.h * H * k + 12;
        const a = Math.min(gor, yumusak((lt - 1.2) / 0.6));
        ctx.save(); ctx.globalAlpha = a * 0.42; ctx.fillStyle = R.koyu; ctx.beginPath(); ctx.rect(ax, ay, aw, ah); ctx.rect(kx, ky, kw, kh); ctx.fill('evenodd'); ctx.restore();
        ctx.save(); ctx.globalAlpha = a * (0.7 + 0.3 * Math.sin(lt * 4)); kutu(ctx, kx, ky, kw, kh, 10, null, R.pirinc, 5); ctx.restore();
      }
    } else {
      ctx.fillStyle = R.zemin; ctx.fillRect(ax, ay, aw, ah);
      yazi(ctx, 'Ekran görüntüsü yüklenemedi', ax + aw / 2, ay + ah / 2, '600 26px ' + SANS, R.soluk, 'center');
    }
    ctx.restore();
    if (im && v && v.etiket) {
      /* not etiketi: vurgunun altında (yer yoksa üstünde), oku vurguyu gösterir; çerçeve içinde kalır */
      ctx.globalAlpha = Math.min(gor, yumusak((lt - 1.6) / 0.6));
      ctx.font = '700 23px ' + SANS; const tw = ctx.measureText(v.etiket).width + 44, th = 44;
      const ox = Math.max(ax + 10, Math.min(ax + aw - 10, kx + kw / 2));
      const alt = ky + kh + 16 + th <= ay + ah - 10;
      const ust = ky - 16 - th >= ay + 10;
      const ey = alt ? ky + kh + 16 : ust ? ky - 16 - th : ay + ah - th - 14;
      const ex = Math.max(ax + 12, Math.min(ax + aw - 12 - tw, ox - tw / 2));
      ctx.fillStyle = R.pirinc; ctx.beginPath();
      if (alt) { ctx.moveTo(ox, ey - 12); ctx.lineTo(ox - 11, ey + 1); ctx.lineTo(ox + 11, ey + 1); }
      else if (ust) { ctx.moveTo(ox, ey + th + 12); ctx.lineTo(ox - 11, ey + th - 1); ctx.lineTo(ox + 11, ey + th - 1); }
      ctx.closePath(); ctx.fill();
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14; kutu(ctx, ex, ey, tw, th, 22, R.pirinc, null); ctx.restore();
      yazi(ctx, v.etiket, ex + tw / 2, ey + 30, '700 23px ' + SANS, R.beyaz, 'center');
    }
  } else if (s.tur === 'ekran') {
    const y = bolumBasligi(ctx, s, 140, 170, kay, 720);
    (s.maddeler || []).slice(0, 3).forEach((m, i) => { ctx.globalAlpha = adimA(i, 0.6, 0.4); tik(ctx, 160, y + 50 + i * 60, 26, R.acikPirinc); yazi(ctx, m, 196, y + 60 + i * 60, '500 32px ' + SANS, R.gri); });
    const x0 = 960, y0 = 160, w = 820, h = 640, a = yumusak((lt - 0.3) / 0.9);
    ctx.globalAlpha = Math.min(a, cikis);
    kutu(ctx, x0, y0 + (1 - a) * 30, w, h, 16, R.zemin, null);
    kutu(ctx, x0, y0 + (1 - a) * 30, w, 64, 16, R.lacivert, null);
    for (let i = 0; i < 3; i++) { kutu(ctx, x0 + 24 + i * 262, y0 + 92 + (1 - a) * 30, 244, 120, 10, R.beyaz, R.cizgi, 1.5); }
    for (let i = 0; i < 8; i++) { const bh = 60 + ((i * 53) % 220) * yumusak((lt - 0.8 - i * 0.08) / 0.6); ctx.fillStyle = i % 3 === 1 ? R.pirinc : '#5d7aa3'; ctx.fillRect(x0 + 60 + i * 90, y0 + h - 40 - bh + (1 - a) * 30, 54, bh); }
  } else {
    /* madde: 1-4 madde ikonlu kartlar halinde yan yana; 5 madde numaralı satır kartları */
    const ust = bolumBasligi(ctx, s, 160, 170, kay, 1600);
    const md = (s.maddeler || []).slice(0, 5); const n = md.length;
    if (n && n <= 4) {
      const gw = (1600 - (n - 1) * 40) / n, F = '500 32px ' + SANS;
      ctx.font = F; const sat = md.map((m) => sar(ctx, m, gw - 72).slice(0, 4));
      const h = 170 + Math.max(...sat.map((x) => x.length)) * 42;
      const y = Math.max(ust + 60, (ust + 880 - h) / 2);
      md.forEach((m, i) => {
        const x = 160 + i * (gw + 40); const a = adimA(i, 0.6, 0.45); ctx.globalAlpha = a; const yy = y + (1 - a) * 24;
        kutu(ctx, x, yy, gw, h, 18, 'rgba(255,255,255,.07)', 'rgba(217,191,143,.45)', 2.5);
        ctx.beginPath(); ctx.arc(x + 72, yy + 74, 34, 0, Math.PI * 2); ctx.fillStyle = R.pirinc; ctx.fill();
        tik(ctx, x + 72, yy + 76, 30, R.beyaz);
        sat[i].forEach((t, k) => yazi(ctx, t, x + 36, yy + 160 + k * 42, F, R.beyaz));
      });
    } else if (n) {
      const rh = 84, y = Math.max(ust + 40, (ust + 880 - (n * rh + (n - 1) * 14)) / 2);
      md.forEach((m, i) => {
        const a = adimA(i, 0.6, 0.4); ctx.globalAlpha = a; const ry = y + i * (rh + 14);
        kutu(ctx, 160 + (1 - a) * 30, ry, 1600, rh, 14, 'rgba(255,255,255,.07)', 'rgba(217,191,143,.35)', 2);
        ctx.beginPath(); ctx.arc(214 + (1 - a) * 30, ry + rh / 2, 26, 0, Math.PI * 2); ctx.fillStyle = R.pirinc; ctx.fill();
        yazi(ctx, String(i + 1), 214 + (1 - a) * 30, ry + rh / 2 + 10, '700 26px ' + SANS, R.beyaz, 'center');
        yazi(ctx, kisaltF(ctx, m, 1440, '500 32px ' + SANS), 266 + (1 - a) * 30, ry + rh / 2 + 11, '500 32px ' + SANS, R.beyaz);
      });
    }
  }
  ctx.restore();
}
function kisaltF(ctx, metin, maxW, font) { ctx.font = font; return kisalt(ctx, metin, maxW); }

/* ================================================================ AÇIK TEMA + ANİMASYONLU SAHNELER (17.11.2026)
   Ofis sahibinin geri bildirimi: lacivert-altın değil; anlatıcı ekrandaki yazıyı okumasın (ekranda yalnız kısa etiket,
   sesli videoda altyazı yok); gerçek ekranlar animasyonla canlansın (kamera, imleç, tıklama, yazma, sürükleme, ekran
   geçişi, bildirim); "neden" anlatılsın (neden / sonuc sahnelerinde hareketli piktogramlar). plan.tema === 'acik'. */
const A = { z1: '#F6F7FB', z2: '#ECEEF8', metin: '#0F172A', metin2: '#475569', soluk: '#94A3B8', cizgi: '#E2E8F0',
  v: '#4F46E5', v2: '#0EA5E9', vAcik: '#EEF2FF', kirmizi: '#E5484D', beyaz: '#FFFFFF' };
const kolay = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const kolay2 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sinir = (v, a, b) => Math.max(a, Math.min(b, v));
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
const YENI_TURLER = new Set(['canli', 'neden', 'sonuc']);

function arkaPlanAcik(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, VW, VH); g.addColorStop(0, A.z1); g.addColorStop(1, A.z2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  [[0.12, 0.3, A.v, 0.10], [0.9, 0.78, A.v2, 0.10]].forEach(([x, y, c, a], i) => {
    const cx = VW * x + Math.sin(t * 0.3 + i * 2) * 70, cy = VH * y + Math.cos(t * 0.24 + i) * 46, r = 640;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, hexA(c, a)); rg.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = rg; ctx.fillRect(0, 0, VW, VH);
  });
}
function ustBantAcik(ctx, plan, i, n) {
  ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(0, 0, VW, UST_BANT);
  ctx.fillStyle = A.cizgi; ctx.fillRect(0, UST_BANT - 1, VW, 1);
  ctx.textBaseline = 'alphabetic';
  kutu(ctx, 96, 26, 44, 44, 12, A.v, null);
  yazi(ctx, 'İ', 118, 58, '700 26px ' + SANS, A.beyaz, 'center');
  yazi(ctx, 'İNCİROĞLU OTOMOTİV', 160, 46, '700 22px ' + SANS, A.metin);
  yazi(ctx, 'İnsan Kaynakları', 160, 72, '500 18px ' + SANS, A.metin2);
  ctx.font = '500 22px ' + SANS; const bas = kisalt(ctx, plan.baslik || '', 900);
  yazi(ctx, bas, VW - 260, 56, '500 22px ' + SANS, A.metin2, 'right');
  kutu(ctx, VW - 220, 30, 124, 40, 20, A.vAcik, null);
  yazi(ctx, String(i + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0'), VW - 158, 58, '700 20px ' + SANS, A.v, 'center');
}
function ilerlemeAcik(ctx, oran) {
  ctx.fillStyle = 'rgba(15,23,42,.06)'; ctx.fillRect(0, VH - 6, VW, 6);
  const g = ctx.createLinearGradient(0, 0, VW, 0); g.addColorStop(0, A.v); g.addColorStop(1, A.v2);
  ctx.fillStyle = g; ctx.fillRect(0, VH - 6, VW * oran, 6);
}
/* yalnız seslendirme yoksa (ses gelmezse metin kaybolmasın) */
function altyaziAcik(ctx, metin, lt, sure) {
  if (!metin) return;
  const a = Math.min(yumusak(lt / 0.5), 1 - yumusak((lt - (sure - 0.4)) / 0.4)); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.font = '500 30px ' + SANS;
  const sat = altyaziSayfa(sar(ctx, metin, 1400), lt, sure), h = 26 + sat.length * 40, y0 = VH - 40 - h;
  ctx.shadowColor = 'rgba(15,23,42,.18)'; ctx.shadowBlur = 24; kutu(ctx, 240, y0, VW - 480, h, 16, 'rgba(255,255,255,.96)', null); ctx.shadowBlur = 0;
  sat.forEach((s, k) => yazi(ctx, s, VW / 2, y0 + 44 + k * 40, '500 30px ' + SANS, A.metin, 'center'));
  ctx.restore();
}
function cip(ctx, metin, x, y, a, dolgu, renk) {
  ctx.save(); ctx.globalAlpha *= a; ctx.font = '700 22px ' + SANS;
  const w = ctx.measureText(metin).width + 40;
  ctx.shadowColor = 'rgba(79,70,229,.28)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  kutu(ctx, x, y, w, 44, 22, dolgu || A.v, null); ctx.shadowColor = 'transparent';
  yazi(ctx, metin, x + w / 2, y + 30, '700 22px ' + SANS, renk || A.beyaz, 'center');
  ctx.restore(); return w;
}

/* ---------------- hareketli piktogramlar (neden / sonuc) — s: kutu ölçüsü, lt: sahne zamanı */
function kisi(ctx, x, y, r, dolgu, cizgi) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = dolgu; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = cizgi; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - 1.5, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = cizgi; ctx.beginPath(); ctx.arc(x, y - r * 0.18, r * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y + r * 0.78, r * 0.62, Math.PI, 0); ctx.fill(); ctx.restore();
}
function belge(ctx, x, y, w, h, cizgiler) {
  kutu(ctx, x - w / 2, y - h / 2, w, h, w * 0.08, A.beyaz, A.cizgi, 2);
  ctx.fillStyle = '#CBD5E1';
  for (let k = 0; k < cizgiler; k++) { const lw = k === 0 ? w * 0.5 : w * (0.66 - (k % 2) * 0.14); ctx.fillRect(x - w / 2 + w * 0.14, y - h / 2 + h * 0.16 + k * h * 0.13, lw, Math.max(2, h * 0.035)); }
}
function ikonCiz(ctx, ikon, cx, cy, s, lt) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (ikon === 'kagit') {
    for (let k = 2; k >= 0; k--) {
      const yuk = k === 0 ? Math.sin(lt * 2.2) * 10 - 8 : 0;
      ctx.save(); ctx.translate(cx + (k - 1) * 18, cy + (k - 1) * 14 + yuk); ctx.rotate((k - 1) * 0.07);
      ctx.shadowColor = 'rgba(15,23,42,.14)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
      belge(ctx, 0, 0, s * 0.5, s * 0.64, k === 0 ? 5 : 0); ctx.restore();
    }
    /* imza karalaması (tamamlanmamış) */
    ctx.strokeStyle = A.metin2; ctx.lineWidth = 3; ctx.beginPath();
    const p = (lt * 0.6) % 1;
    for (let i = 0; i <= 30 * p; i++) { const x = cx - s * 0.18 + i * s * 0.012, y = cy + s * 0.22 + Math.sin(i * 0.9) * 6 + Math.sin(lt * 2.2) * 10 - 8; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  } else if (ikon === 'imza') {
    /* dört kişi; belge elden ele dolaşır, geçtiği kişide onay işareti çıkar, sonra başa döner */
    const d = s * 0.34, y = cy + s * 0.18, P = 3.6, q = (lt % P) / P, adim = q * 3.4;
    ctx.save(); ctx.setLineDash([8, 10]); ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 1.5 * d, y); ctx.lineTo(cx + 1.5 * d, y); ctx.stroke(); ctx.restore();
    for (let i = 0; i < 4; i++) {
      const x = cx + (i - 1.5) * d; kisi(ctx, x, y, s * 0.11, A.vAcik, A.v);
      if (adim >= i + 0.6) { ctx.beginPath(); ctx.arc(x + s * 0.08, y - s * 0.08, s * 0.045, 0, Math.PI * 2); ctx.fillStyle = A.v; ctx.fill(); tik(ctx, x + s * 0.08, y - s * 0.078, s * 0.05, A.beyaz); }
    }
    const seg = Math.min(3, Math.floor(adim)), f = kolay2(Math.min(1, adim - seg));
    const bx = cx + (seg - 1.5 + (seg < 3 ? f : 0)) * d, by = y - s * 0.26 - Math.sin(Math.PI * (seg < 3 ? f : 0)) * s * 0.12;
    ctx.save(); ctx.shadowColor = 'rgba(15,23,42,.18)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; belge(ctx, bx, by, s * 0.2, s * 0.26, 3); ctx.restore();
  } else if (ikon === 'saat') {
    const r = s * 0.32;
    ctx.save(); ctx.shadowColor = 'rgba(15,23,42,.14)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = A.beyaz; ctx.fill(); ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = A.cizgi; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, r1 = r * 0.82, r2 = r * (k % 3 ? 0.9 : 0.94); ctx.strokeStyle = k % 3 ? '#CBD5E1' : A.metin2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke(); }
    const el = (a, l, w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); ctx.stroke(); };
    el(-Math.PI / 2 + lt * 0.5, r * 0.5, 7, A.metin); el(-Math.PI / 2 + lt * 4.2, r * 0.72, 4, A.v);
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fillStyle = A.metin; ctx.fill();
    const b = 1 + 0.08 * Math.sin(lt * 5), bx = cx + r * 0.78, by = cy - r * 0.78;
    ctx.beginPath(); ctx.arc(bx, by, s * 0.085 * b, 0, Math.PI * 2); ctx.fillStyle = A.kirmizi; ctx.fill();
    yazi(ctx, '?', bx, by + s * 0.035, '800 ' + Math.round(s * 0.11 * b) + 'px ' + SANS, A.beyaz, 'center');
  } else if (ikon === 'kagitsiz') {
    ctx.save(); ctx.shadowColor = 'rgba(15,23,42,.12)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6; belge(ctx, cx, cy, s * 0.46, s * 0.6, 5); ctx.restore();
    const p = kolay((lt - 0.7) / 0.6);
    ctx.save(); ctx.globalAlpha *= 0.35 + 0.65 * (1 - p * 0.4); ctx.restore();
    ctx.strokeStyle = A.kirmizi; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(cx - s * 0.3, cy - s * 0.36); ctx.lineTo(cx - s * 0.3 + s * 0.6 * p, cy - s * 0.36 + s * 0.72 * p); ctx.stroke();
  } else if (ikon === 'kayit') {
    const r = s * 0.3, p = kolay((lt - 0.6) / 0.8);
    ctx.lineWidth = 10; ctx.strokeStyle = A.vAcik; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = A.v; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
    if (p > 0.85) tik(ctx, cx, cy + 4, s * 0.3 * kolay((p - 0.85) / 0.15 * 1), A.v);
  } else if (ikon === 'goz') {
    const w = s * 0.42, h = s * 0.22, ix = Math.sin(lt * 1.6) * s * 0.08;
    ctx.lineWidth = 6; ctx.strokeStyle = A.v; ctx.beginPath(); ctx.moveTo(cx - w, cy); ctx.quadraticCurveTo(cx, cy - h * 2, cx + w, cy); ctx.quadraticCurveTo(cx, cy + h * 2, cx - w, cy); ctx.closePath();
    ctx.fillStyle = A.beyaz; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + ix, cy, s * 0.12, 0, Math.PI * 2); ctx.fillStyle = A.v; ctx.fill();
    ctx.beginPath(); ctx.arc(cx + ix, cy, s * 0.05, 0, Math.PI * 2); ctx.fillStyle = A.metin; ctx.fill();
    ctx.beginPath(); ctx.arc(cx + ix - s * 0.04, cy - s * 0.04, s * 0.022, 0, Math.PI * 2); ctx.fillStyle = A.beyaz; ctx.fill();
  }
  ctx.restore();
}
/* neden / sonuc: kısa etiket + kısa büyük cümle + 3 hareketli piktogram kartı (metni anlatıcı açar) */
function ogeSahnesi(ctx, s, lt, sure, gor) {
  const giris = kolay(lt / 0.6);
  ctx.save(); ctx.globalAlpha = gor;
  if (s.etiket) cip(ctx, s.etiket.toLocaleUpperCase('tr'), 160, 150 + (1 - giris) * 20, giris, s.tur === 'neden' ? A.kirmizi : A.v);
  ctx.globalAlpha = gor * giris; ctx.font = '700 64px ' + SANS; ctx.fillStyle = A.metin; ctx.textAlign = 'left';
  sar(ctx, s.baslik, 1600).slice(0, 2).forEach((x, i) => ctx.fillText(x, 160, 270 + i * 76 + (1 - giris) * 24));
  const og = s.ogeler || [], n = og.length || 1, gw = 500, gap = 50, x0 = (VW - (n * gw + (n - 1) * gap)) / 2, y0 = 400, gh = 500;
  og.forEach((g, i) => {
    const a = kolay((lt - 0.5 - i * 0.45) / 0.55); if (a <= 0) return;
    const x = x0 + i * (gw + gap), y = y0 + (1 - a) * 40;
    ctx.save(); ctx.globalAlpha = gor * a;
    ctx.shadowColor = 'rgba(15,23,42,.10)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16; kutu(ctx, x, y, gw, gh, 28, A.beyaz, null); ctx.shadowColor = 'transparent';
    ctx.fillStyle = s.tur === 'neden' ? hexA(A.kirmizi, 0.06) : A.vAcik; kutu(ctx, x + 24, y + 24, gw - 48, 330, 20, ctx.fillStyle, null);
    ikonCiz(ctx, g.ikon, x + gw / 2, y + 24 + 165, 300, lt - 0.5 - i * 0.45);
    ctx.font = '700 34px ' + SANS; const sat = sar(ctx, g.etiket, gw - 60).slice(0, 2);
    sat.forEach((t2, k) => yazi(ctx, t2, x + gw / 2, y + 410 + k * 42, '700 34px ' + SANS, A.metin, 'center'));
    ctx.restore();
  });
  ctx.restore();
}

/* ---------------- canlı ekran: gerçek ekran görüntüsü üzerinde animasyon */
function kameraAl(liste, lt) {
  if (!liste || !liste.length) return { x: 0.5, y: 0.5, z: 1 };
  if (lt <= liste[0].t) return liste[0];
  for (let i = 0; i < liste.length - 1; i++) {
    const a = liste[i], b = liste[i + 1];
    if (lt < b.t) { const p = kolay2((lt - a.t) / Math.max(0.01, b.t - a.t)); return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, z: a.z + (b.z - a.z) * p }; }
  }
  return liste[liste.length - 1];
}
function imlecAl(liste, lt) {
  if (!liste || !liste.length || lt < liste[0].t - 0.3) return null;
  if (lt <= liste[0].t) return { x: liste[0].x, y: liste[0].y, a: kolay((lt - liste[0].t + 0.3) / 0.3) };
  for (let i = 0; i < liste.length - 1; i++) {
    const a = liste[i], b = liste[i + 1];
    if (lt < b.t) { const bas = a.t + (a.tik ? 0.25 : 0), p = kolay2((lt - bas) / Math.max(0.01, b.t - bas)); return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, a: 1 }; }
  }
  const s = liste[liste.length - 1]; return { x: s.x, y: s.y, a: 1 };
}
function imlecCiz(ctx, x, y, olcek, a) {
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(olcek, olcek);
  ctx.shadowColor = 'rgba(15,23,42,.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.lineTo(7.5, 23); ctx.lineTo(13, 34); ctx.lineTo(18, 31.5); ctx.lineTo(12.5, 21); ctx.lineTo(22, 21); ctx.closePath();
  ctx.fillStyle = A.beyaz; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.lineWidth = 2.2; ctx.strokeStyle = A.metin; ctx.stroke();
  ctx.restore();
}
function zarf(ctx, x, y, w) {
  const h = w * 0.7; kutu(ctx, x - w / 2, y - h / 2, w, h, 6, A.beyaz, A.v, 3);
  ctx.strokeStyle = A.v; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - w / 2 + 4, y - h / 2 + 5); ctx.lineTo(x, y + 2); ctx.lineTo(x + w / 2 - 4, y - h / 2 + 5); ctx.stroke();
}
function durumAl(s, lt) { let k = 0; s.durumlar.forEach((d, j) => { if (lt >= d.t) k = j; }); return k; }
let ALTYAZI_ACIK = false;   /* altyazı görünüyorsa ekran çerçevesi küçülür, altyazı ekranın üstüne binmez */
function canliCiz(ctx, s, lt, sure, gor) {
  const fw = ALTYAZI_ACIK ? 1360 : 1536, ah = fw * 9 / 16, bar = 36, fx = (VW - fw) / 2, giris = kolay(lt / 0.6), fy = 126 + (1 - giris) * 40;
  const ax = fx, ay = fy + bar, aw = fw;
  ctx.save(); ctx.globalAlpha = gor * giris;
  ctx.save(); ctx.shadowColor = 'rgba(15,23,42,.22)'; ctx.shadowBlur = 54; ctx.shadowOffsetY = 20; kutu(ctx, fx, fy, fw, bar + ah, 18, A.beyaz, null); ctx.restore();
  kutu(ctx, fx, fy, fw, bar + 20, 18, '#F1F3F8', null); ctx.fillStyle = '#F1F3F8'; ctx.fillRect(fx, fy + 18, fw, bar - 18);
  [0, 1, 2].forEach((i) => { ctx.beginPath(); ctx.arc(fx + 24 + i * 18, fy + 18, 5.5, 0, Math.PI * 2); ctx.fillStyle = '#D5D9E2'; ctx.fill(); });
  /* sahne etiketi tarayıcı sekmesi gibi çubukta durur (ekran görüntüsünün üstünü kapatmaz) */
  let px0 = fx + 84;
  if (s.etiket) {
    const et = s.etiket.toLocaleUpperCase('tr'); ctx.font = '700 14px ' + SANS; const ew = ctx.measureText(et).width + 28;
    kutu(ctx, px0, fy + 6, ew, 24, 12, A.v, null); yazi(ctx, et, px0 + ew / 2, fy + 23, '700 14px ' + SANS, A.beyaz, 'center');
    px0 += ew + 14;
  }
  const pw = fx + fw - 120 - px0;
  kutu(ctx, px0, fy + 7, pw, 22, 11, A.beyaz, A.cizgi, 1);
  ctx.font = '500 14px ' + SANS;
  yazi(ctx, kisalt(ctx, s.pencere || PENCERE[(s.durumlar[0] || {}).gorsel] || 'İK Portalı', pw - 30), px0 + pw / 2, fy + 23, '500 14px ' + SANS, A.metin2, 'center');
  const k = durumAl(s, lt), dk = s.durumlar[k], imA = GORSEL.get(dk.gorsel);
  const W = imA ? imA.naturalWidth : 1600, H = imA ? imA.naturalHeight : 900;
  /* uzun (boydan) ekran görüntüsü de olabilir: görünen dilim çerçeve oranında kesilir, kamera y'si sayfada kaydırma olur */
  const kam = kameraAl(s.kamera, lt), sw = W / kam.z, sh = Math.min(H, sw * ah / aw);
  const sx = sinir(kam.x * W - sw / 2, 0, W - sw), sy = sinir(kam.y * H - sh / 2, 0, H - sh), olc = aw / sw;
  const M = (ix, iy) => [ax + (ix * W - sx) * olc, ay + (iy * H - sy) * olc];
  const sonrakiler = [];   /* kırpma alanı dışına taşabilen etiketler en sonda çizilir */
  ctx.save(); ctx.beginPath(); ctx.rect(ax, ay, aw, ah); ctx.clip();
  const goruntu = (im, a) => { if (!im) return; ctx.save(); ctx.globalAlpha = gor * giris * a; ctx.drawImage(im, sx, sy, sw, sh, ax, ay, aw, ah); ctx.restore(); };
  if (!imA) { ctx.fillStyle = A.z1; ctx.fillRect(ax, ay, aw, ah); yazi(ctx, 'Ekran görüntüsü yüklenemedi', ax + aw / 2, ay + ah / 2, '600 26px ' + SANS, A.soluk, 'center'); }
  else if (k > 0 && lt < dk.t + dk.gecis) { goruntu(GORSEL.get(s.durumlar[k - 1].gorsel), 1); goruntu(imA, kolay((lt - dk.t) / dk.gecis)); }
  else goruntu(imA, 1);
  /* kart taşıma: kaynak yerinde boşluk, kartın kopyası imleçle birlikte hedefe gider */
  (s.tasimalar || []).forEach((m) => {
    /* bırakıldıktan sonra 0,6 sn hedefte kalır ve söner (bu arada sonraki ekran durumu belirir; kart yerinden "geri sıçramaz") */
    const TUT = 0.6;
    if (lt < m.t1 || lt > m.t2 + TUT) return;
    const kaynakIm = GORSEL.get(s.durumlar[durumAl(s, m.t1)].gorsel); if (!kaynakIm) return;
    const p = kolay2((lt - m.t1) / Math.max(0.1, m.t2 - m.t1)), son = lt > m.t2 ? 1 - kolay((lt - m.t2) / TUT) : 1;
    const [px, py] = M(m.kaynak.x, m.kaynak.y), w = m.kaynak.w * W * olc, h = m.kaynak.h * H * olc;
    ctx.save(); ctx.globalAlpha *= son; ctx.setLineDash([10, 8]); kutu(ctx, px, py, w, h, 14, '#F1F5F9', '#CBD5E1', 2); ctx.restore();
    const [hx, hy] = M(m.kaynak.x + (m.hedef.x - m.kaynak.x) * p, m.kaynak.y + (m.hedef.y - m.kaynak.y) * p);
    ctx.save(); ctx.globalAlpha *= son; ctx.translate(hx + w / 2, hy + h / 2 - Math.sin(Math.PI * p) * 30); ctx.rotate(0.04 * Math.sin(Math.PI * p)); ctx.scale(1.04, 1.04);
    ctx.shadowColor = 'rgba(15,23,42,.3)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
    ctx.drawImage(kaynakIm, m.kaynak.x * W, m.kaynak.y * H, m.kaynak.w * W, m.kaynak.h * H, -w / 2, -h / 2, w, h);
    ctx.restore();
  });
  /* alana yazma: alanın içi silinir, metin harf harf yazılır, odak çerçevesi ve imleç çubuğu */
  (s.yazilar || []).forEach((y) => {
    if (lt < y.t1 || lt > y.bitis) return;
    const p = sinir((lt - y.t1) / Math.max(0.1, y.t2 - y.t1), 0, 1), n = Math.round(y.metin.length * p);
    const [x0, y0] = M(y.x, y.y), w = y.w * W * olc, h = y.h * H * olc;
    kutu(ctx, x0 + 1.5 * olc, y0 + 1.5 * olc, w - 3 * olc, h - 3 * olc, 8 * olc, A.beyaz, null);
    ctx.save(); ctx.globalAlpha *= 0.22; kutu(ctx, x0 - 3 * olc, y0 - 3 * olc, w + 6 * olc, h + 6 * olc, 12 * olc, null, A.v, 4 * olc); ctx.restore();
    kutu(ctx, x0, y0, w, h, 10 * olc, null, A.v, 1.6 * olc);
    const fs = 14 * olc; ctx.font = '500 ' + fs + 'px ' + SANS; ctx.fillStyle = A.metin; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const tx = y.metin.slice(0, n); ctx.fillText(tx, x0 + 12 * olc, y0 + h / 2);
    if (p < 1 || Math.floor(lt * 2.2) % 2 === 0) { ctx.fillStyle = A.v; ctx.fillRect(x0 + 12 * olc + ctx.measureText(tx).width + 2, y0 + h * 0.27, 1.6 * olc, h * 0.46); }
    ctx.textBaseline = 'alphabetic';
  });
  /* vurgu: çevre hafif kararır, kutu parlar, kısa etiket */
  (s.vurgular || []).forEach((v) => {
    if (lt < v.t1 || lt > v.t2) return;
    const a = Math.min(kolay((lt - v.t1) / 0.4), kolay((v.t2 - lt) / 0.3)), pad = 8;
    const [x0, y0] = M(v.x, v.y), w = v.w * W * olc + pad * 2, h = v.h * H * olc + pad * 2, bx = x0 - pad, by = y0 - pad;
    ctx.save(); ctx.globalAlpha *= a * 0.16; ctx.fillStyle = A.metin; ctx.beginPath(); ctx.rect(ax, ay, aw, ah); ctx.rect(bx, by, w, h); ctx.fill('evenodd'); ctx.restore();
    ctx.save(); ctx.globalAlpha *= a; ctx.shadowColor = hexA(A.v, 0.55); ctx.shadowBlur = 26; kutu(ctx, bx, by, w, h, 14, null, A.v, 4); ctx.restore();
    if (v.etiket) sonrakiler.push(() => {
      ctx.font = '700 22px ' + SANS; const tw = ctx.measureText(v.etiket).width + 40;
      const alt = by + h + 14 + 44 <= ay + ah - 8, ey = alt ? by + h + 14 : Math.max(ay + 8, by - 14 - 44);
      const ex = sinir(bx + w / 2 - tw / 2, ax + 12, ax + aw - 12 - tw);
      cip(ctx, v.etiket, ex, ey + (1 - a) * 10, a);
    });
  });
  ctx.restore();   /* kırpma */
  sonrakiler.forEach((f) => f());
  /* bildirim: zarf düğmeden bildirime uçar, bildirim kartı kayarak gelir */
  if (s.bildirim && lt >= s.bildirim.t) {
    const b = s.bildirim, tx = ax + aw - 460, ty = ay + 26;
    const p = kolay2((lt - b.t) / 0.75);
    if (p < 1) { const [kx, ky] = M(b.kaynak.x, b.kaynak.y), ex = tx + 40, ey = ty + 34; const x = kx + (ex - kx) * p, y = ky + (ey - ky) * p - Math.sin(Math.PI * p) * 160; zarf(ctx, x, y, 54 - 10 * p); }
    const q = kolay((lt - b.t - 0.55) / 0.4);
    if (q > 0) {
      ctx.save(); ctx.globalAlpha *= q; ctx.shadowColor = 'rgba(15,23,42,.22)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
      kutu(ctx, tx, ty - (1 - q) * 18, 430, 68, 18, A.beyaz, null); ctx.shadowColor = 'transparent';
      ctx.beginPath(); ctx.arc(tx + 40, ty + 34 - (1 - q) * 18, 20, 0, Math.PI * 2); ctx.fillStyle = A.v; ctx.fill(); tik(ctx, tx + 40, ty + 36 - (1 - q) * 18, 20, A.beyaz);
      yazi(ctx, b.metin, tx + 74, ty + 42 - (1 - q) * 18, '600 21px ' + SANS, A.metin);
      ctx.restore();
    }
  }
  /* imleç + tıklama dalgası */
  const im = imlecAl(s.imlec, lt);
  (s.imlec || []).forEach((k2) => {
    if (!k2.tik || lt < k2.t || lt > k2.t + 0.55) return;
    const q = (lt - k2.t) / 0.55, [x, y] = M(k2.x, k2.y);
    ctx.save(); ctx.globalAlpha *= (1 - q) * 0.7; ctx.beginPath(); ctx.arc(x, y, 8 + 34 * q, 0, Math.PI * 2); ctx.fillStyle = hexA(A.v, 0.18); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = A.v; ctx.stroke(); ctx.restore();
  });
  if (im) {
    /* kamera hareketi sırasında imleç ekran çerçevesinin dışına taşmaz */
    const [x0, y0] = M(im.x, im.y), x = sinir(x0, ax + 6, ax + aw - 26), y = sinir(y0, ay + 6, ay + ah - 36);
    const basili = (s.imlec || []).some((k2) => k2.tik && lt >= k2.t && lt < k2.t + 0.14); imlecCiz(ctx, x, y, basili ? 0.88 : 1, im.a);
  }
  ctx.restore();
}
/* açık temada eski metin sahneleri yerine sade karşılık (başlık / kapanış / madde) */
function acikMetinSahnesi(ctx, s, lt, sure, gor) {
  const giris = kolay(lt / 0.6); ctx.save(); ctx.globalAlpha = gor * giris;
  if (s.ust) cip(ctx, s.ust.toLocaleUpperCase('tr'), VW / 2 - 200, 330, 1);
  ctx.font = '700 76px ' + SANS; ctx.fillStyle = A.metin; ctx.textAlign = 'center';
  sar(ctx, s.baslik, 1500).slice(0, 2).forEach((x, i) => ctx.fillText(x, VW / 2, 480 + i * 90 + (1 - giris) * 20));
  (s.maddeler || []).slice(0, 3).forEach((m, i) => yazi(ctx, m, VW / 2, 680 + i * 50, '500 34px ' + SANS, A.metin2, 'center'));
  ctx.restore();
}
function yeniSahneCiz(ctx, s, lt, sure) {
  const cikis = 1 - kolay((lt - (sure - 0.45)) / 0.45), gor = Math.max(0, cikis);
  ctx.save(); ctx.textBaseline = 'alphabetic';
  if (s.tur === 'canli') canliCiz(ctx, s, lt, sure, gor);
  else if (s.tur === 'goruntu' && s.gorsel) {
    /* eski "görüntü" sahnesi açık temada: aynı ekran, vurguya yavaş yakınlaşma + vurgu kutusu */
    if (!s._canli) {
      const v = s.vurgu, z = Math.min(1.8, s.yakinlik || 1.25);
      s._canli = { tur: 'canli', etiket: s.ust || '', pencere: PENCERE[s.gorsel] || '', durumlar: [{ gorsel: s.gorsel, t: 0, gecis: 0.6 }],
        kamera: v ? [{ t: 0.4, x: 0.5, y: 0.5, z: 1 }, { t: Math.max(2, sure - 0.6), x: v.x + v.w / 2, y: v.y + v.h / 2, z }] : [],
        imlec: [], yazilar: [], tasimalar: [], bildirim: null,
        vurgular: v ? [{ x: v.x, y: v.y, w: v.w, h: v.h, t1: 1, t2: 99, etiket: v.etiket || '' }] : [] };
    }
    canliCiz(ctx, s._canli, lt, sure, gor);
  }
  else if (s.tur === 'neden' || s.tur === 'sonuc') ogeSahnesi(ctx, s, lt, sure, gor);
  else acikMetinSahnesi(ctx, s, lt, sure, gor);
  ctx.restore();
}

/* ---------------------------------------------------------------- gerçek ekran görüntüleri (aynı köken: tuval kirlenmez, kayıt çalışır) */
const GORSEL = new Map();
/* tarayıcı çerçevesinin başlığı (görsel kimliğine göre; listede yoksa oryantasyon ekranları) */
const PENCERE = {
  'talep-form': 'İK Portalı · Personel Talepleri', 'talep-onay': 'İK Portalı · Personel Talepleri',
  'talep-pozisyon': 'İK Portalı · Açık Pozisyonlar', 'talep-havuz': 'İşe Alım · Aday Havuzu',
  'v2-portal': 'İK Portalı', 'v2-form-bos': 'İK Portalı · Personel Talepleri · Yeni talep', 'v2-form': 'İK Portalı · Personel Talepleri · Yeni talep',
  'v2-form-dep': 'İK Portalı · Personel Talepleri · Yeni talep', 'v2-form-hata': 'İK Portalı · Personel Talepleri · Yeni talep', 'v2-form-tam': 'İK Portalı · Personel Talepleri · Yeni talep',
  'v2-onay-bos': 'İK Portalı · Personel Talepleri · Onay', 'v2-onay-sonra': 'İK Portalı · Personel Talepleri · Onay',
  'v2-poz-bekliyor': 'İK Portalı · Açık Pozisyonlar', 'v2-poz-onayli': 'İK Portalı · Açık Pozisyonlar',
  'v2-havuz-1': 'İşe Alım · Aday Havuzu', 'v2-havuz-2': 'İşe Alım · Aday Havuzu',
  'sp-portal': 'İK Portalı',
  'sp-teblig-liste': 'Servis Panosu · Hedef Tebliğ', 'sp-teblig-bos': 'Servis Panosu · Hedef Tebliğ', 'sp-teblig-dolu': 'Servis Panosu · Hedef Tebliğ',
  'sp-teblig-ik': 'Servis Panosu · Hedef Tebliğ', 'sp-ik-teblig-once': 'Servis Panosu · Hedef Tebliğ (İK)', 'sp-ik-teblig-sonra': 'Servis Panosu · Hedef Tebliğ (İK)',
  'sp-teblig-cikti': 'Hedef Tebliğ Formu · yazdır', 'sp-teblig-imza': 'Hedef Tebliğ Formu · yazdır',
  'sp-karne-bos': 'Servis Panosu · Aylık Karne', 'sp-karne-dolu': 'Servis Panosu · Aylık Karne', 'sp-karne-alt': 'Servis Panosu · Aylık Karne',
  'sp-karne-uyari': 'Servis Panosu · Aylık Karne', 'sp-karne-planli': 'Servis Panosu · Aylık Karne', 'sp-karne-onay': 'Servis Panosu · Aylık Karne', 'sp-karne-gb': 'Servis Panosu · Aylık Karne',
  'sp-gb-cikti': 'Performans Geri Bildirim Formu · yazdır', 'sp-gb-cikti2': 'Performans Geri Bildirim Formu · yazdır',
  'sp-gb-liste': 'Servis Panosu · Geri Bildirim', 'sp-gb-imza': 'Servis Panosu · Geri Bildirim',
  'sp-genel': 'Servis Panosu · Genel Bakış (İK)', 'sp-dash': 'Servis Panosu · Performans Analitiği'
};
export function gorselAdresi(id) { return new URL('./gorsel/' + encodeURIComponent(id) + '.jpg', import.meta.url).href; }
export function gorselleriYukle(plan) {
  const hepsi = [];
  ((plan && plan.sahneler) || []).forEach((s) => {
    if (s.tur === 'goruntu' && s.gorsel) hepsi.push(s.gorsel);
    if (s.tur === 'canli') (s.durumlar || []).forEach((d) => d && d.gorsel && hepsi.push(d.gorsel));
  });
  const idler = [...new Set(hepsi.filter((g) => !GORSEL.has(g)))];
  return Promise.all(idler.map((id) => new Promise((coz) => {
    const im = new Image();
    const bitti = () => { clearTimeout(zs); coz(); };
    const zs = setTimeout(bitti, 15000);
    im.onload = () => { GORSEL.set(id, im); bitti(); }; im.onerror = bitti;
    im.src = gorselAdresi(id);
  })));
}

/* Tek kare çizimi (önizleme / test): plan, zaman (sn) */
export function kareCiz(ctx, plan, sureler, baslar, t, top) {
  const sahneler = plan.sahneler;
  let i = 0; while (i < sahneler.length - 1 && t >= baslar[i + 1]) i++;
  /* açık tema: plan.tema 'acik' ya da yeni sahne türleri (canlı / neden / sonuç) varsa */
  if (plan.tema === 'acik' || sahneler.some((s) => YENI_TURLER.has(s.tur))) {
    /* anlatıcı konuşuyorsa altyazı yok (ekrandaki yazıyı tekrar etmesin); ses yoksa metin kaybolmasın */
    ALTYAZI_ACIK = (plan.altyazi === 'hep' || !plan._sesli) && !!sahneler[i].seslendirme;
    arkaPlanAcik(ctx, Math.max(0, t));
    if (t >= 0) yeniSahneCiz(ctx, sahneler[i], t - baslar[i], sureler[i]);
    ustBantAcik(ctx, plan, i, sahneler.length);
    if (t >= 0 && ALTYAZI_ACIK) altyaziAcik(ctx, sahneler[i].seslendirme, t - baslar[i], sureler[i]);
    ilerlemeAcik(ctx, Math.max(0, Math.min(1, t / top)));
    return i;
  }
  arkaPlan(ctx, Math.max(0, t));
  if (t >= 0) sahneCiz(ctx, sahneler[i], t - baslar[i], sureler[i]);
  ustBant(ctx, plan, i, sahneler.length);
  if (t >= 0) altyazi(ctx, sahneler[i].seslendirme, t - baslar[i], sureler[i]);
  ilerlemeCiz(ctx, Math.max(0, Math.min(1, t / top)));
  return i;
}

/* ---------------------------------------------------------------- MP4 süre düzeltmesi
   Chrome MediaRecorder MP4'ü parçalı (fMP4) yazar ve başlıktaki süre alanlarına yalnız ilk parçanın süresini koyar;
   Windows oynatıcıları ve Gezgin videoyu ~1 sn sanar. Kayıt bitince her izin gerçek örnek sürelerini (moof/trun)
   toplayıp mvhd / tkhd / mdhd süre alanlarına yazar. Başka bayta dokunmaz (boyut ve ofsetler aynı kalır);
   bir şey anlaşılamazsa dosyayı olduğu gibi döndürür. Dönüş: { buf, sureSn } */
export function mp4SureDuzelt(buf) {
  try {
    const d = new DataView(buf), u8 = new Uint8Array(buf), N = buf.byteLength;
    const tip = (p) => String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
    const KAP = { moov: 1, trak: 1, mdia: 1, minf: 1, stbl: 1, mvex: 1, moof: 1, traf: 1, edts: 1, dinf: 1 };
    const kutular = [];
    const gez = (bas, son, ust) => {
      let p = bas;
      while (p + 8 <= son) {
        let s = d.getUint32(p), bas2 = 8;
        if (s === 1) { s = Number(d.getBigUint64(p + 8)); bas2 = 16; } else if (s === 0) s = son - p;
        if (s < 8 || p + s > son) break;
        const k = { tip: tip(p), p, s, ust }; kutular.push(k);
        if (KAP[k.tip]) gez(p + bas2, p + s, k);
        p += s;
      }
    };
    gez(0, N, null);
    const altlar = (k, t) => kutular.filter((x) => x.ust === k && x.tip === t);
    const v = (p) => u8[p + 8];
    const mvhd = kutular.find((x) => x.tip === 'mvhd'); if (!mvhd) return { buf, sureSn: null };
    const tsFilm = v(mvhd.p) === 1 ? d.getUint32(mvhd.p + 28) : d.getUint32(mvhd.p + 20);
    if (!tsFilm) return { buf, sureSn: null };
    /* izler: track_ID → { tkhd, mdhd, ts, son } */
    const izler = {};
    for (const trak of kutular.filter((x) => x.tip === 'trak')) {
      const tkhd = altlar(trak, 'tkhd')[0]; const mdia = altlar(trak, 'mdia')[0]; const mdhd = mdia && altlar(mdia, 'mdhd')[0];
      if (!tkhd || !mdhd) continue;
      const id = v(tkhd.p) === 1 ? d.getUint32(tkhd.p + 28) : d.getUint32(tkhd.p + 20);
      const ts = v(mdhd.p) === 1 ? d.getUint32(mdhd.p + 28) : d.getUint32(mdhd.p + 20);
      izler[id] = { tkhd, mdhd, ts, son: 0, varsayilan: 0 };
    }
    for (const trex of kutular.filter((x) => x.tip === 'trex')) { const iz = izler[d.getUint32(trex.p + 12)]; if (iz) iz.varsayilan = d.getUint32(trex.p + 20); }
    /* parçalar: tfdt (başlangıç) + trun örnek süreleri */
    for (const traf of kutular.filter((x) => x.tip === 'traf')) {
      const tfhd = altlar(traf, 'tfhd')[0]; if (!tfhd) continue;
      const tf = d.getUint32(tfhd.p + 8) & 0xFFFFFF; const iz = izler[d.getUint32(tfhd.p + 12)]; if (!iz) continue;
      let q = tfhd.p + 16; if (tf & 0x01) q += 8; if (tf & 0x02) q += 4;
      const varsayilan = tf & 0x08 ? d.getUint32(q) : iz.varsayilan;
      const tfdt = altlar(traf, 'tfdt')[0];
      let t = tfdt ? (v(tfdt.p) === 1 ? Number(d.getBigUint64(tfdt.p + 12)) : d.getUint32(tfdt.p + 12)) : iz.son;
      for (const trun of altlar(traf, 'trun')) {
        const fl = d.getUint32(trun.p + 8) & 0xFFFFFF, n = d.getUint32(trun.p + 12);
        let r = trun.p + 16; if (fl & 0x001) r += 4; if (fl & 0x004) r += 4;
        for (let i = 0; i < n; i++) {
          if (r > trun.p + trun.s) break;
          t += fl & 0x100 ? d.getUint32(r) : varsayilan;
          r += ((fl & 0x100) ? 4 : 0) + ((fl & 0x200) ? 4 : 0) + ((fl & 0x400) ? 4 : 0) + ((fl & 0x800) ? 4 : 0);
        }
      }
      iz.son = Math.max(iz.son, t);
    }
    const yaz = (k, ofs1, ofs0, deger) => { if (v(k.p) === 1) d.setBigUint64(k.p + ofs1, BigInt(Math.round(deger))); else d.setUint32(k.p + ofs0, Math.min(0xFFFFFFFF, Math.round(deger))); };
    let filmSon = 0;
    for (const iz of Object.values(izler)) {
      if (!iz.son || !iz.ts) continue;
      const filmBirim = iz.son / iz.ts * tsFilm;
      yaz(iz.mdhd, 32, 24, iz.son);
      yaz(iz.tkhd, 36, 28, filmBirim);
      filmSon = Math.max(filmSon, filmBirim);
    }
    if (!filmSon) return { buf, sureSn: null };
    yaz(mvhd, 32, 24, filmSon);
    return { buf, sureSn: filmSon / tsFilm };
  } catch (e) { return { buf, sureSn: null }; }
}

/* ---------------------------------------------------------------- oynatma / kayıt */
export function desteklenenBicim() {
  const adaylar = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  if (typeof MediaRecorder === 'undefined') return '';
  return adaylar.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
}

/* ---------------------------------------------------------------- hızlı ve eksiksiz kayıt (WebCodecs + mp4-muxer)
   Kareler gerçek zamanlı yakalanmaz: her kare tam 1/30 sn aralıkla tek tek çizilip kodlanır, ses tek izde karıştırılır,
   süresi doğru yazılmış standart (parçasız, fastStart) MP4 çıkar. Kare atlanmaz, sekme değişse de etkilenmez. */
const MP4_MUXER = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.mjs';
const FPS = 30, SES_HZ = 44100;
async function hizliKayitAyari(sesVar) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
  let video = null;
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.420028']) {
    const c = { codec, width: VW, height: VH, bitrate: 4000000, bitrateMode: 'variable', framerate: FPS };
    try { if ((await VideoEncoder.isConfigSupported(c)).supported) { video = c; break; } } catch (e) { /* sıradaki */ }
  }
  if (!video) return null;
  let ses = null;
  if (sesVar) {
    if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined' || typeof OfflineAudioContext === 'undefined') return null;
    const c = { codec: 'mp4a.40.2', sampleRate: SES_HZ, numberOfChannels: 1, bitrate: 128000 };
    try { if ((await AudioEncoder.isConfigSupported(c)).supported) ses = c; } catch (e) { /* yok */ }
    if (!ses) return null;                 /* ses kaybolmasın: eski (gerçek zamanlı) yönteme dönülür */
  }
  return { video, ses };
}
async function hizliKayit({ plan, tuval, tamponlar, sureler, baslar, top, ayar, ilerleme, iptal }) {
  const { Muxer, ArrayBufferTarget } = await import(MP4_MUXER);
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: VW, height: VH, frameRate: FPS },
    audio: ayar.ses ? { codec: 'aac', numberOfChannels: 1, sampleRate: SES_HZ } : undefined,
    fastStart: 'in-memory', firstTimestampBehavior: 'offset'
  });
  let hata = null;
  const venc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: (e) => { hata = e; } });
  venc.configure(ayar.video);
  if (ayar.ses) {
    /* seslendirmeler, gerçek zamanlı oynatmadaki gibi sahne başından 0,4 sn sonra başlar */
    const oac = new OfflineAudioContext(1, Math.ceil(top * SES_HZ), SES_HZ);
    tamponlar.forEach((b, i) => { if (!b) return; const k = oac.createBufferSource(); k.buffer = b; k.connect(oac.destination); k.start(baslar[i] + 0.4); });
    const karisim = (await oac.startRendering()).getChannelData(0);
    const aenc = new AudioEncoder({ output: (ch, meta) => muxer.addAudioChunk(ch, meta), error: (e) => { hata = e; } });
    aenc.configure(ayar.ses);
    for (let o = 0; o < karisim.length; o += SES_HZ) {
      const n = Math.min(SES_HZ, karisim.length - o);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: SES_HZ, numberOfFrames: n, numberOfChannels: 1, timestamp: Math.round(o / SES_HZ * 1e6), data: karisim.slice(o, o + n) });
      aenc.encode(ad); ad.close();
    }
    await aenc.flush(); aenc.close();
  }
  const ctx = tuval.getContext('2d');
  const kareSay = Math.ceil(top * FPS), adim = 1e6 / FPS;
  for (let i = 0; i < kareSay; i++) {
    if (hata) throw hata;
    if (iptal && iptal()) { try { venc.close(); } catch (e) { /* kapalı */ } return null; }
    const t = i / FPS;
    kareCiz(ctx, plan, sureler, baslar, t, top);
    const kare = new VideoFrame(tuval, { timestamp: Math.round(i * adim), duration: Math.round(adim) });
    venc.encode(kare, { keyFrame: i % (FPS * 2) === 0 }); kare.close();
    /* kodlayıcı kuyruğu dolmasın; ekran ve ilerleme yazısı arada güncellensin */
    while (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 4));
    if (i % 6 === 0) { ilerleme && ilerleme({ asama: 'oynat', t, top }); await new Promise((r) => setTimeout(r, 0)); }
  }
  await venc.flush(); venc.close();
  if (hata) throw hata;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}

/* plan: {baslik, sahneler[]}; ses: {anahtar, sesId} | null; kayit: true ise Blob döner */
export async function videoUret({ plan, tuval, ses, kayit, ilerleme, iptal }) {
  tuval.width = VW; tuval.height = VH;
  const ctx = tuval.getContext('2d');
  const AC = window.AudioContext || window.webkitAudioContext;
  const actx = new AC();
  const sahneler = plan.sahneler.slice();
  const tamponlar = [];
  for (let i = 0; i < sahneler.length; i++) {
    let tampon = null;
    if (ses && ses.anahtar && ses.sesId && sahneler[i].seslendirme) {
      ilerleme && ilerleme({ asama: 'ses', i, n: sahneler.length });
      const ab = await seslendir(sahneler[i].seslendirme, ses);
      tampon = await actx.decodeAudioData(ab.slice(0));
    }
    tamponlar.push(tampon);
  }
  plan._sesli = tamponlar.some(Boolean);
  const sureler = sahneler.map((s, i) => Math.max(s.sure, tamponlar[i] ? tamponlar[i].duration + 0.9 : 0));
  const baslar = []; let top = 0; for (const d of sureler) { baslar.push(top); top += d; }
  try { await document.fonts.load('600 96px "Source Serif 4"'); await document.fonts.load('600 30px Inter'); } catch (e) { /* yedek font */ }
  await gorselleriYukle(plan);

  /* Dosya üretimi: önce hızlı ve eksiksiz yol (kare kare kodlama); desteklenmezse gerçek zamanlı kayda dönülür */
  if (kayit) {
    let ayar = null;
    try { ayar = await hizliKayitAyari(tamponlar.some(Boolean)); } catch (e) { ayar = null; }
    if (ayar) {
      try {
        const blob = await hizliKayit({ plan, tuval, tamponlar, sureler, baslar, top, ayar, ilerleme, iptal });
        try { await actx.close(); } catch (e) { /* kapalı */ }
        return { blob, bicim: 'video/mp4', sure: top, sesli: !!ayar.ses, dosyaSure: blob ? top : null, yontem: 'kare-kare' };
      } catch (e) { console.warn('Kare kare kayıt yapılamadı, gerçek zamanlı kayda dönülüyor', e); }
    }
  }

  let kaydedici = null, parcalar = [], bicim = '', dosyaSure = null;
  const hedef = actx.createMediaStreamDestination();
  if (kayit) {
    bicim = desteklenenBicim();
    if (!bicim) throw new Error('Bu tarayıcı video kaydını desteklemiyor (Chrome önerilir).');
    const akim = tuval.captureStream(30);
    hedef.stream.getAudioTracks().forEach((t) => akim.addTrack(t));
    kaydedici = new MediaRecorder(akim, { mimeType: bicim, videoBitsPerSecond: 8000000 });
    kaydedici.ondataavailable = (e) => { if (e.data && e.data.size) parcalar.push(e.data); };
  }
  /* Ses bağlamı tarayıcı izniyle açılır; açılmazsa video sessiz ve duvar saatiyle oynar (kayıt takılmaz). */
  await Promise.race([actx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 600))]);
  const sesli = actx.state === 'running';
  plan._sesli = sesli && tamponlar.some(Boolean);   /* ses çalınamıyorsa altyazı geri gelir */
  const saatAl = sesli ? () => actx.currentTime : () => performance.now() / 1000;
  const t0 = saatAl() + 0.25;
  tamponlar.forEach((b, i) => {
    if (!b || !sesli) return;
    const kaynak = actx.createBufferSource(); kaynak.buffer = b;
    kaynak.connect(actx.destination); kaynak.connect(hedef);
    kaynak.start(t0 + baslar[i] + 0.4);
  });
  if (kaydedici) kaydedici.start(500);
  await new Promise((coz) => {
    function kare() {
      const t = saatAl() - t0;
      if ((iptal && iptal()) || t >= top) { coz(); return; }
      kareCiz(ctx, plan, sureler, baslar, t, top);
      ilerleme && ilerleme({ asama: 'oynat', t: Math.max(0, t), top });
      requestAnimationFrame(kare);
    }
    requestAnimationFrame(kare);
  });
  let blob = null;
  if (kaydedici) {
    await new Promise((coz) => { kaydedici.onstop = coz; kaydedici.stop(); });
    blob = new Blob(parcalar, { type: bicim.split(';')[0] });
    /* MP4 başlığındaki süreyi gerçek süreyle düzelt (yoksa Windows videoyu ~1 sn gösterir) */
    if (bicim.indexOf('mp4') >= 0) {
      try { const r = mp4SureDuzelt(await blob.arrayBuffer()); if (r.sureSn) { blob = new Blob([r.buf], { type: 'video/mp4' }); dosyaSure = r.sureSn; } } catch (e) { /* düzeltilemezse ham dosya */ }
    }
  }
  try { await actx.close(); } catch (e) { /* kapalı */ }
  return { blob, bicim, sure: top, sesli, dosyaSure, yontem: kayit ? 'gercek-zamanli' : 'onizleme' };
}
export function planSuresi(plan) { return (plan && plan.sahneler ? plan.sahneler : []).reduce((s, x) => s + (Number(x.sure) || 0), 0); }
