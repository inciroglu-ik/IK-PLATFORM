/* ==========================================================================
   İK DASHBOARD 2.0 · ORTAK KİTAPLIK  (pano/ortak.js · ES module, build yok)
   --------------------------------------------------------------------------
   Kabuk (pano.html) ve tüm sayfa modülleri (pano/sayfa-*.js) bunu kullanır.
   Firebase / kimlik İMPORT ETMEZ. Görsel dil: kokpit.css + pano.css.
   Bölümler:  1 Biçim · 2 Türkçe metin · 3 Sabitler/renkler · 4 Saf hesaplar (A07)
              5 Veri & filtre · 6 DOM & ikon · 7 Hareket · 8 Bileşenler
              9 Grafik · 10 Tablo · 11 Dışa aktarma
   API özeti ve örnekler: pano/KABUK.md
   ========================================================================== */

/* ==========================================================================
   1. BİÇİM (tr-TR)
   ========================================================================== */
const _nf = new Map();
function nf(min, max) {
  const k = min + ':' + max;
  let f = _nf.get(k);
  if (!f) { f = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: min, maximumFractionDigits: max }); _nf.set(k, f); }
  return f;
}
/** Değer boş mu? (null, undefined, '', NaN/Infinity) */
export function bosMu(v) { return v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v)); }
/** sayi(1234.5) → "1.235" · sayi(41.5, 2) → "41,50" · sayi(41.5, 'oto') → "41,5" (0–2 hane) · boş → "—" */
export function sayi(n, ondalik = 0) {
  if (bosMu(n) || isNaN(+n)) return '—';
  if (ondalik === null || ondalik === 'oto') return nf(0, 2).format(+n);
  return nf(ondalik, ondalik).format(+n);
}
/** yuzde(41.52) → "%41,52" · yuzde(50) → "%50" · yuzde(7.456, 1) → "%7,5" (Türkçede % başta) */
export function yuzde(n, ondalik = 'oto') { return bosMu(n) || isNaN(+n) ? '—' : '%' + sayi(n, ondalik); }
/** isaretli(5) → "+5" · isaretli(-3) → "−3" · isaretli(0) → "0" */
export function isaretli(n, ondalik = 0) {
  if (bosMu(n) || isNaN(+n)) return '—';
  const v = +n, s = sayi(Math.abs(v), ondalik);
  if (s === sayi(0, ondalik)) return s;
  return v > 0 ? '+' + s : '−' + s;
}
/** para(12345.6) → "12.346 TL" */
export function para(n, ondalik = 0) { return bosMu(n) || isNaN(+n) ? '—' : sayi(n, ondalik) + ' TL'; }
/** kisaSayi(12345) → "12,3 B" (bin) · 1250000 → "1,3 Mn" */
const _kisa = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 });
export function kisaSayi(n) { return bosMu(n) || isNaN(+n) ? '—' : _kisa.format(+n); }
/** "9.03.2026" / "09.03.2026" / "2026-03-09" / Date → Date (yerel) ya da null */
export function tarihCoz(s) {
  if (s instanceof Date) return isNaN(s) ? null : s;
  if (bosMu(s)) return null;
  const t = String(s).trim();
  let m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) { const d = new Date(+m[3], +m[2] - 1, +m[1]); return isNaN(d) ? null : d; }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3]); return isNaN(d) ? null : d; }
  return null;
}
/** tarih("9.03.2026") → "09.03.2026" (çözülemezse metnin kendisi, boşsa "—") */
export function tarih(x) {
  const d = tarihCoz(x);
  if (d) return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return bosMu(x) ? '—' : String(x);
}
/** Tablo sıralaması için tarihi sayıya çevirir (çözülemezse null) */
export function tarihSirasi(x) { const d = tarihCoz(x); return d ? d.getTime() : null; }
/** Dosya adları için YEREL tarih: "2026-10-22" (UTC değil — gece yarısı kayması yok) */
export function bugunDosya(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
/** HTML kaçışı — veriden gelen her metin innerHTML'e esc() ile girer */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** kisalt("ÇOK UZUN UNVAN ADI", 10) → "ÇOK UZUN U…" */
export function kisalt(s, n = 22) { s = String(s ?? ''); return s.length > n ? s.substring(0, n) + '…' : s; }

/* ==========================================================================
   2. TÜRKÇE METİN (küçük/büyük harf, arama anahtarı, sıralama)
   ========================================================================== */
/** trKucuk("İSTİFA") → "istifa" (JS toLowerCase "i̇stifa" üretir — bilinen İ hatası) */
export const trKucuk = (s) => String(s ?? '').toLocaleLowerCase('tr');
/** trBuyuk("istifa") → "İSTİFA" */
export const trBuyuk = (s) => String(s ?? '').toLocaleUpperCase('tr');
export const trLower = trKucuk;
export const trUpper = trBuyuk;
/** trBaslik("ŞUBAT") → "Şubat" (ay adları için; kısaltmalarda kullanmayın: "İK" → "İk") */
export function trBaslik(s) { return trKucuk(s).replace(/(^|[\s\-/(.'’])([^\s\-/(.'’])/gu, (m, a, b) => a + trBuyuk(b)); }
/** Türkçe karakterleri katlar: "Şule ÇİĞDEM ıIİi" → "sule cigdem iiii" (arama/eşleştirme için) */
export function katla(s) { return trKucuk(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i'); }
/** Arama anahtarı: katlanmış + tek boşluk. "ibrahim" ↔ "İBRAHİM", "sule" ↔ "ŞULE" eşleşir */
export function aramaAnahtari(s) { return katla(s).replace(/\s+/g, ' ').trim(); }
/** aramaEslesir("Ayşe ÖRNEK · BMW", "ayse") → true (sorgu boşsa true) */
export function aramaEslesir(metin, sorgu) { const q = aramaAnahtari(sorgu); return !q || aramaAnahtari(metin).includes(q); }
/** Türkçe alfabetik karşılaştırma (sayılar doğal sırada) — dizi.sort(trKarsilastir) */
export function trKarsilastir(a, b) { return String(a ?? '').localeCompare(String(b ?? ''), 'tr', { numeric: true, sensitivity: 'base' }); }

/* ==========================================================================
   3. SABİTLER VE RENKLER
   ========================================================================== */
/** 1 tabanlı ay adları (index.html MN ile aynı) */
export const MN = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const ayAdi = (m) => MN[+m] || '';
/** ayKisa(2) → "Şub" (index.html ile aynı: MN[m].substring(0,3)) */
export const ayKisa = (m) => (MN[+m] || '').substring(0, 3);
export const BOLUMLER = ['Servis', 'Satış', 'İdari'];
/** İstenen ayrılış nedenleri (index.html ISTENEN_NED — değiştirmeyin) */
export const ISTENEN_NED = ['İşveren Feshi', 'Deneme (İşveren)', 'Askerlik', '25. Madde', 'Emeklilik', 'Belirli Süreli'];
export const SILINECEK = ['OTO YIKAMA YÖNETİCİSİ', 'FİAT SERVİS MÜDÜRÜ', 'KOLAY DESTEK'];
/** Resmî ayrılma nedeni kategorileri (catR çıktıları, sabit sıra) */
export const NEDENLER = ['İstifa', 'İşveren Feshi', 'Deneme (İşveren)', 'Deneme (İşçi)', 'Askerlik', 'Emeklilik', '25. Madde', 'Diğer'];
/** Mesai ay adı → mesai_kisi alan adı (ASCII) */
export const MES_AY_KEY = { 'Ocak': 'ocak', 'Şubat': 'subat', 'Mart': 'mart', 'Nisan': 'nisan', 'Mayıs': 'mayis', 'Haziran': 'haziran', 'Temmuz': 'temmuz', 'Ağustos': 'agustos', 'Eylül': 'eylul', 'Ekim': 'ekim', 'Kasım': 'kasim', 'Aralık': 'aralik' };

/** Renkler — kokpit.css tokenlerinin JS karşılığı (Chart.js CSS değişkeni okuyamaz).
    g1..g8: açık zeminde kategorik sıra (SABİT, döngü yok) · gk1..gk8: lacivert kokpit zemininde. */
export const RENK = {
  g1: '#2f6db5', g2: '#c08a2e', g3: '#b4446c', g4: '#3a93c6', g5: '#5f8f2e', g6: '#6c5fd0', g7: '#1f9e89', g8: '#d9682f',
  gk1: '#4f86cc', gk2: '#b88d3f', gk3: '#c45a82', gk4: '#3c9bd0', gk5: '#5f9a2e', gk6: '#8579e0', gk7: '#1f9a88', gk8: '#d0703a',
  lac900: '#0a182c', lac850: '#0e1f37', lac800: '#132a46', lac700: '#1b3a5e', lac600: '#25507e', lac500: '#33649a', lac400: '#5a83b5', lac300: '#8ea8cc', lac200: '#bfcde2', lac100: '#e2e9f3', lac50: '#f1f5fa',
  pir700: '#7d5c1f', pir600: '#9c7428', pir500: '#b98b37', pir400: '#cfa75a', pir300: '#e0c38a', pir200: '#eddcb6', pir100: '#f6eedb',
  n50: '#f5f7fa', n100: '#edf0f4', n150: '#e4e8ee', n200: '#d8dde5', n300: '#bcc4cf', n400: '#929cab', n500: '#66707f', n600: '#4f5868', n700: '#384150', n800: '#252c38', n900: '#151a23',
  ok: '#23955f', uy: '#c9831c', ht: '#cc4444',
  /* anlamsal seri renkleri (tüm sayfalarda aynı anlam) */
  giris: '#2f6db5', cikis: '#b4446c', y2025: '#929cab', y2026: '#132a46', diger: '#929cab', istenen: '#6c5fd0', istenmeyen: '#c08a2e'
};
/** Ayrılma nedeni → sabit renk (her sayfada aynı neden aynı renk) */
export const NEDEN_RENK = {
  'İstifa': RENK.g1, 'İşveren Feshi': RENK.g2, 'Deneme (İşveren)': RENK.g3, 'Deneme (İşçi)': RENK.g4, 'Askerlik': RENK.g5,
  'Emeklilik': RENK.g6, '25. Madde': RENK.g7, 'Belirli Süreli': RENK.g8, 'Diğer': RENK.diger
};
export const nedenRengi = (n) => NEDEN_RENK[n] || RENK.diger;
/** Bölüm → sabit renk */
export const BOLUM_RENK = { 'Servis': RENK.g1, 'Satış': RENK.g2, 'İdari': RENK.g7 };
export const bolumRengi = (b) => BOLUM_RENK[b] || RENK.diger;
/** renkSaydam("#b4446c", .1) → "rgba(180,68,108,0.1)" (alan dolgusu için) */
export function renkSaydam(hex, a = 0.1) {
  const h = String(hex).replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ==========================================================================
   4. SAF HESAPLAR — index.html ile AYNI sonuç (A07 listesi). DOM'a dokunmaz.
   ========================================================================== */
/** SILINECEK listesindeki ifadelerden birini içeriyor mu? (DÜZELTME: trBuyuk — "Fiat Servis Müdürü" artık eşleşir) */
export function isSil(ad) { const u = trBuyuk(ad); return SILINECEK.some((s) => u.indexOf(s) >= 0); }
/** Neden → rozet sınıfı (index.html bCls ile birebir) */
export function bCls(n) {
  return { 'İstifa': 'bi', 'İşveren Feshi': 'biv', 'Deneme (İşveren)': 'bd', 'Deneme (İşçi)': 'bd', 'Askerlik': 'ba', 'Emeklilik': 'be', '25. Madde': 'bm' }[n] || 'bd';
}
/** Resmî SGK çıkış metni → 7 kategori. Kural SIRASI index.html ile aynı.
    DÜZELTME (bilinen İ hatası): metin trKucuk + Türkçe katlama ile karşılaştırılır; "İstifa", "İSTİFA",
    "ASKERLİK", "ISTIFA" artık doğru kategoriye düşer. Küçük harfli metinlerde sonuç değişmez. */
export function catR(r) {
  var s = katla(r || '');
  if (s.indexOf('istifa') >= 0) return 'İstifa';
  if (s.indexOf('deneme') >= 0 && (s.indexOf('isverence') >= 0 || s.indexOf('isveren') >= 0)) return 'Deneme (İşveren)';
  if (s.indexOf('deneme') >= 0 && s.indexOf('isci') >= 0) return 'Deneme (İşçi)';
  if ((s.indexOf('hakli') >= 0 || s.indexOf('derhal') >= 0 || s.indexOf('ihbar') >= 0) && (s.indexOf('isveren') >= 0 || s.indexOf('fesih') >= 0)) return 'İşveren Feshi';
  if (s.indexOf('askerlik') >= 0) return 'Askerlik';
  if (s.indexOf('emekli') >= 0) return 'Emeklilik';
  if (s.indexOf('25') >= 0 || s.indexOf('guven') >= 0 || s.indexOf('hirsiz') >= 0) return '25. Madde';
  return 'Diğer';
}
/** istenen bayrağı (B1 düzeltmesi: istenen ?? istened) */
export function istenenMi(a) { return !!(a && (a.istenen ?? a.istened)); }
/** "X yıl Y ay Z gün / N gün" → N/365 · yalnız rakam → N/365 · aksi null (index.html _gunToYil) */
export function gunToYil(sure) {
  var s = String(sure || '');
  var m = s.match(/\/\s*(\d+)\s*gün/);
  if (m) return +m[1] / 365;
  m = s.match(/^(\d+)$/);
  if (m) return +m[1] / 365;
  return null;
}
/** sure → toplam gün; bulunamazsa 0 (index.html ayChrt içindeki gd ile aynı — boş sure 0 sayılır) */
export function kidemGun(s) { var m = String(s || '').match(/(\d+) gün$/); return m ? +m[1] : 0; }
/** Kıdem kovaları (index.html ay-kidem): ≤60 · ≤180 · ≤365 · ≤730 · ≤1095 · üstü */
export const KIDEM_KOVALARI = ['0-2A', '2-6A', '6-12A', '1-2Y', '2-3Y', '3+Y'];
export const KIDEM_KOVA_ADLARI = ['0–2 ay', '2–6 ay', '6–12 ay', '1–2 yıl', '2–3 yıl', '3+ yıl'];
export function kidemKovasi(v) { return v <= 60 ? 0 : v <= 180 ? 1 : v <= 365 ? 2 : v <= 730 ? 3 : v <= 1095 ? 4 : 5; }
/** Ayrılanların kıdem kova sayıları [6] (gd + eşikler; boş sure 0-2A'ya düşer — index.html ile aynı) */
export function kidemKovaSayilari(dizi) { const bk = [0, 0, 0, 0, 0, 0]; (dizi || []).forEach((x) => { bk[kidemKovasi(kidemGun(x.sure))]++; }); return bk; }
/** Ayrılan kıdem özeti (index.html ayKidemOzet; boş sure atlanır) → { kisi, ortYil, ortAy, minAy, maxAy } | null */
export function ayrilanKidemOzeti(dizi) {
  var yils = (dizi || []).map(function (x) { return gunToYil(x.sure); }).filter(function (x) { return x !== null; });
  if (!yils.length) return null;
  var ort = yils.reduce(function (a, b) { return a + b; }, 0) / yils.length;
  return { kisi: yils.length, ortYil: ort, ortAy: ort * 12, minAy: Math.min.apply(null, yils) * 12, maxAy: Math.max.apply(null, yils) * 12 };
}
/** Departman + bölüm kıdem aracı (index.html ovKidemHesapla): aktif personel kidem_gun/365 → { kisi, eksik, havuz, ort, min, max } */
export function kidemAraci(normal, dept, bolum) {
  var pool = (normal || []).filter(function (x) { if (dept && x.dept !== dept) return false; if (bolum && x.bolum !== bolum) return false; return true; });
  var yils = pool.map(function (x) { return x.kidem_gun != null ? x.kidem_gun / 365 : null; }).filter(function (x) { return x !== null; });
  var eksik = pool.length - yils.length;
  if (!yils.length) return { kisi: 0, eksik: eksik, havuz: pool.length, ort: null, min: null, max: null };
  var ort = yils.reduce(function (a, b) { return a + b; }, 0) / yils.length;
  return { kisi: yils.length, eksik: eksik, havuz: pool.length, ort: ort, min: Math.min.apply(null, yils), max: Math.max.apply(null, yils) };
}
/** Gerçek ayrılma nedeni (aciklama) → 12 kategori (index.html gercekKat ile birebir) */
export function gercekKat(ac) {
  if (!ac) return null; var u = String(ac).toLocaleUpperCase('tr');
  if (u.indexOf('PERFORMANS') >= 0) return 'Performans (İşveren Feshi)';
  if (u.indexOf('DENEME') >= 0) return 'Deneme Süresinde İşveren Feshi';
  if (u.indexOf('TASARRUF') >= 0) return 'Tasarruf Tedbiri (İşveren Feshi)';
  if (u.indexOf('ARABUCU') >= 0 || u.indexOf('ARABULUCU') >= 0 || u.indexOf('25/2') >= 0 || u.indexOf('ANLAŞMA İLE') >= 0) return 'Anlaşmalı Çıkış / Arabuluculuk';
  if (u.indexOf('İHTAR') >= 0 || u.indexOf('IHTAR') >= 0) return 'İhtar Sonrası Ayrılış';
  if (u.indexOf('ASKERL') >= 0) return 'Askerlik';
  if (u.indexOf('KENDİ İŞ') >= 0 || u.indexOf('KENDI IS') >= 0) return 'Kendi İşini Kurma';
  if (u.indexOf('ŞEHİR') >= 0 || u.indexOf('SEHIR') >= 0) return 'Şehir Değişikliği (İstifa)';
  if (u.indexOf('STAJ') >= 0) return 'Staj Bitimi';
  if (u.indexOf('EVLİL') >= 0 || u.indexOf('ÖZEL SEBEP') >= 0 || u.indexOf('OZEL SEBEP') >= 0) return 'Özel Sebepler';
  if (u.indexOf('DEĞİŞİK') >= 0 || u.indexOf('ÜCRET') >= 0 || u.indexOf('UCRET') >= 0) return 'İş / Ücret Değişikliği (İstifa)';
  return 'Diğer İstifa';
}
export const GERCEK_KATEGORILER = ['İş / Ücret Değişikliği (İstifa)', 'Performans (İşveren Feshi)', 'Deneme Süresinde İşveren Feshi', 'Tasarruf Tedbiri (İşveren Feshi)',
  'Kendi İşini Kurma', 'Askerlik', 'Anlaşmalı Çıkış / Arabuluculuk', 'İhtar Sonrası Ayrılış', 'Şehir Değişikliği (İstifa)', 'Özel Sebepler', 'Staj Bitimi', 'Diğer İstifa'];
/** Haftalık karşılaştırma metni (index.html cmpTrend ile birebir): " (↑2)" · " (↓0.71pp)" · "" */
export function cmpTrend(curr, prev, isPercent) {
  if (prev === undefined || prev === null || curr === undefined || curr === null) return '';
  var diff = curr - prev;
  if (Math.abs(diff) < 0.01) return '';
  var up = diff > 0;
  var arrow = up ? String.fromCharCode(8593) : String.fromCharCode(8595);
  var txt = isPercent ? Math.abs(diff).toFixed(2) + 'pp' : Math.abs(diff);
  return ' (' + arrow + txt + ')';
}
/** cmpTrend'in yapısal hâli (aynı eşik): → { fark, ondalik, birim } | null — deltaEl() ile gösterilir */
export function haftalikFark(curr, prev, yuzdeMi) {
  if (prev === undefined || prev === null || curr === undefined || curr === null) return null;
  var diff = curr - prev;
  if (Math.abs(diff) < 0.01) return null;
  return { fark: yuzdeMi ? Math.round(diff * 100) / 100 : diff, ondalik: yuzdeMi ? 2 : 0, birim: yuzdeMi ? 'puan' : '' };
}
/** V.İ. tespiti (index.html isVI / excludeVI ile birebir) */
export function isVI(dept) {
  if (!dept) return false;
  var d = dept.toString().toUpperCase().trim();
  return d === 'V.İ.' || d === 'V.I.' || d === 'VI';
}
export function excludeVI(arr) { return (arr || []).filter(function (x) { return !isVI(x.dept); }); }
/** oran_asil = round(cikis_asil / calisan_asil × 10000) / 100 (calisan 0 → 0) */
export function oranAsil(cikisAsil, calisanAsil) { return calisanAsil ? Math.round(cikisAsil / calisanAsil * 10000) / 100 : 0; }
/** Excel kesri → % (index.html readOzetFromExcel pct) */
export function pct(v) { return v !== null ? Math.round(v * 10000) / 100 : null; }
/** Turnover aylık risk sınıfı (index.html renderTV rc/rl — koddaki MEVCUT eşikler) */
export function turnoverRiski(r) { return { sinif: r > 4 ? 'rr' : r > 2.5 ? 'ry' : 'rg', metin: r > 4 ? '⚠️ Yüksek Risk' : r > 2.5 ? '⚡ Dikkat' : '✅ Normal' }; }
/** İzin bakiyesi durumu (index.html izTbl ile birebir) */
export function izinDurumu(b) {
  if (b === null || b === undefined) return { metin: '—', sinif: '' };
  return b < 0 ? { metin: '⚠️ Borçta', sinif: 'borc' } : b < 5 ? { metin: '⚡ Az Bakiye', sinif: 'az' } : b >= 30 ? { metin: '🔺 Risk', sinif: 'risk' } : { metin: '✅ Normal', sinif: 'normal' };
}
/** En yoğun ay (eşitlikte küçük ay — index.html ile aynı) → { ay, sayi } | null */
export function enYogunAy(dizi) {
  var mc = {};
  (dizi || []).forEach(function (d) { if (d.ay > 0) mc[d.ay] = (mc[d.ay] || 0) + 1; });
  var pm = Object.entries(mc).sort(function (a, b) { return b[1] - a[1]; })[0];
  return pm ? { ay: +pm[0], sayi: pm[1] } : null;
}
export function ortalama(a) { const v = (a || []).filter((x) => !bosMu(x)); return v.length ? v.reduce((s, x) => s + +x, 0) / v.length : null; }
/** Uyarı kuralları (index.html getAlerts; metinler Türkçe karakterli) → [{ type:'danger'|'warning'|'info', title, msg }] */
export function uyarilar(D) {
  var oz = (D && D.ozet) || {};
  var alerts = [];
  if (oz.ytd_turnover && oz.ytd_turnover > 15) alerts.push({ type: 'danger', title: 'Yüksek turnover', msg: 'YTD turnover ' + yuzde(oz.ytd_turnover) + ' — kritik eşik (%15) üzerinde' });
  var negIzin = ((D && D.izin) || []).filter(function (i) { return i.bakiye !== null && i.bakiye < 0; });
  if (negIzin.length > 0) alerts.push({ type: 'warning', title: negIzin.length + ' kişide negatif izin', msg: negIzin.slice(0, 3).map(function (i) { return i.ad + ' (' + i.bakiye + ')'; }).join(', ') });
  var deptCount = {};
  ((D && D.ayrilanlar) || []).forEach(function (a) { deptCount[a.dept] = (deptCount[a.dept] || 0) + 1; });
  Object.keys(deptCount).forEach(function (d) { if (deptCount[d] >= 5) alerts.push({ type: 'warning', title: d + ' — yüksek çıkış', msg: '2026 yılında ' + deptCount[d] + ' kişi ayrıldı' }); });
  var highIzin = ((D && D.izin) || []).filter(function (i) { return i.bakiye !== null && i.bakiye >= 30; });
  if (highIzin.length > 0) alerts.push({ type: 'info', title: highIzin.length + ' kişide 30+ gün birikmiş izin', msg: highIzin.slice(0, 3).map(function (i) { return i.ad + ' (' + i.bakiye + ')'; }).join(', ') });
  return alerts;
}
/** Filtreli turnover (index.html renderTV filtre sarmalayıcısı, V25): aylık çıkış / filtreli aktif sayısı.
    Varsayılan simAy=6 index.html ile AYNI sonucu verir; B3 düzeltmesi için { simAy: ozet.ay_sayisi } verin.
    → { turnover:[{donem,calisan,giris:0,cikis,oran,calisan_asil,cikis_asil,oran_asil}], ozet:{…kopya, ytd_*, simule_*, *_count} } */
export function turnoverFiltreli(filtAy, filtCl, filtIa, ozet, { simAy = 6 } = {}) {
  var oz = ozet || {};
  var avgCl = (filtCl || []).length || 1;
  var _ayN = oz.ay_sayisi || 6;
  var ayIsim = {}; for (var i = 1; i <= 12; i++) ayIsim[i] = '2026-' + String(i).padStart(2, '0');
  var months = {};
  (filtAy || []).forEach(function (a) { if (a.ay && a.ay >= 1 && a.ay <= _ayN) months[a.ay] = (months[a.ay] || 0) + 1; });
  var msArr = []; for (var j = 1; j <= _ayN; j++) msArr.push(j);
  var turnover = msArr.map(function (ay) {
    var cikis = months[ay] || 0;
    var oran = Math.round(cikis / avgCl * 10000) / 100;
    return { donem: ayIsim[ay], calisan: avgCl, giris: 0, cikis: cikis, oran: oran, calisan_asil: avgCl, cikis_asil: cikis, oran_asil: oran };
  });
  var topCikis = (filtAy || []).length;
  var ytdOran = Math.round(topCikis / avgCl * 10000) / 100;
  var y = JSON.parse(JSON.stringify(oz));
  y.ytd_turnover = ytdOran;
  y.simule_yilsonu = Math.round(ytdOran / simAy * 12 * 100) / 100;
  y.ytd_cikis = topCikis;
  y.ytd_giris = (filtIa || []).length;
  var istAy = (filtAy || []).filter(istenenMi);
  var istOran = Math.round(istAy.length / avgCl * 10000) / 100;
  y.ytd_istened = istOran; y.ytd_istenen = istOran;
  y.simule_istened = Math.round(istOran / simAy * 12 * 100) / 100; y.simule_istenen = y.simule_istened;
  var istnmAy = (filtAy || []).filter(function (a) { return !istenenMi(a); });
  var istnmOran = Math.round(istnmAy.length / avgCl * 10000) / 100;
  y.ytd_istenmeyen = istnmOran;
  y.simule_istenmeyen = Math.round(istnmOran / simAy * 12 * 100) / 100;
  y.istened_count = istAy.length; y.istenen_count = istAy.length; y.istenmeyen_count = istnmAy.length;
  return { turnover: turnover, ozet: y };
}

/* ==========================================================================
   5. VERİ VE FİLTRE YARDIMCILARI
   ========================================================================== */
/** grupSay(dizi, 'dept' | x => x.unvan || '—') → [[anahtar, adet], …] azalan (eşitlikte ilk görülen önce — index.html ile aynı) */
export function grupSay(dizi, alan) {
  const m = {};
  (dizi || []).forEach((x) => { const k = typeof alan === 'function' ? alan(x) : (x ? x[alan] : undefined); m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
/** bolumSay(dizi) → { Servis, Satış, İdari } (yalnız bu üç anahtar sayılır — V10) */
export function bolumSay(dizi) {
  const bc = { 'Servis': 0, 'Satış': 0, 'İdari': 0 };
  (dizi || []).forEach((d) => { if (bc[d.bolum] !== undefined) bc[d.bolum]++; });
  return bc;
}
/** Ay ekseni uzunluğu: ozet.ay_sayisi || 6 (index.html V6) */
export function aySayisi(D) { return (D && D.ozet && D.ozet.ay_sayisi) || 6; }
/** [1..aySayisi] */
export function aylar(D) { const n = aySayisi(D), a = []; for (let i = 1; i <= n; i++) a.push(i); return a; }
/** aySay(dizi, [1,2,3]) → her ay için d.ay === m sayısı */
export function aySay(dizi, ayListesi) { return ayListesi.map((m) => (dizi || []).filter((d) => d.ay === m).length); }
/** "2026-03" → 3 */
export function donemAyi(donem) { return +String(donem || '').split('-')[1] || 0; }
/** Mesai ayları VERİDEN: [{ ad:'Ocak', key:'ocak' }, …] (D.mesai_aylik sırasıyla) */
export function mesaiAylari(D) {
  return ((D && D.mesai_aylik) || []).map(function (x) { return { ad: x.ay, key: MES_AY_KEY[x.ay] || String(x.ay || '').toLowerCase() }; });
}
function gecerliDept(d) {
  if (d === null || d === undefined) return false;
  const s = String(d).trim();
  if (!s || s === '-' || s === '—') return false;
  const u = s.toUpperCase();
  return !(u === 'V.İ.' || u === 'V.I.' || u === 'VI');
}
/** Departman seçenekleri VERİDEN (tüm dizilerin birleşimi; V.İ. ve "-" hariç).
    aktif = D.normal sayısı (bölüm verilirse yalnız o bölüm). Sıra: aktif azalan, sonra ad. → [{ ad, aktif }] */
export function departmanListesi(D, { bolum = '' } = {}) {
  const say = new Map();
  ['normal', 'stajyer', 'gecici', 'ayrilanlar', 'isealim', 'izin', 'mesai_kisi', 'arabuluculuk'].forEach((k) => {
    ((D && D[k]) || []).forEach((p) => { if (p && gecerliDept(p.dept) && !say.has(p.dept)) say.set(p.dept, 0); });
  });
  ((D && D.normal) || []).forEach((p) => {
    if (!p || !gecerliDept(p.dept)) return;
    if (bolum && p.bolum !== bolum) return;
    say.set(p.dept, (say.get(p.dept) || 0) + 1);
  });
  return [...say.entries()].map(([ad, aktif]) => ({ ad, aktif })).sort((a, b) => b.aktif - a.aktif || trKarsilastir(a.ad, b.ad));
}
/** Filtre etkin mi? filtre = { departmanlar:Set, bolum:'' } */
export function filtreAktifMi(f) { return !!(f && ((f.departmanlar && f.departmanlar.size) || f.bolum)); }
/** Global filtre (index.html filterData'nın çoklu seçimli hâli): filtre yoksa dizinin KENDİSİ döner;
    varsa V.İ. çıkarılır, dept ∈ seçim ve bolum eşleşmesi aranır. Arabuluculukta da dept=departman, bolum=bölüm. */
export function filtreUygula(dizi, f) {
  if (!Array.isArray(dizi)) return [];
  if (!filtreAktifMi(f)) return dizi;
  const set = f.departmanlar, dAktif = !!(set && set.size), bolum = f.bolum || '';
  return dizi.filter((p) => {
    if (!p) return false;
    const d = p.dept === undefined || p.dept === null ? '' : String(p.dept);
    if (d && (d.toUpperCase() === 'V.İ.' || d.toUpperCase() === 'V.I.')) return false;
    if (dAktif && !set.has(p.dept)) return false;
    if (bolum && p.bolum !== bolum) return false;
    return true;
  });
}
/** Kabuk bunu B.filtreli olarak verir. Aylık toplam diziler (turnover, mesai_aylik, mes_bolum, mesai_dept) filtrelenmez. */
export const FILTRELI_DIZILER = ['normal', 'stajyer', 'gecici', 'vi', 'ayrilanlar', 'isealim', 'izin', 'mesai_kisi', 'arabuluculuk'];
export function filtreliVeri(D, f) {
  const o = {};
  FILTRELI_DIZILER.forEach((k) => { o[k] = filtreUygula((D && D[k]) || [], f); });
  return o;
}
/** "BMW, FIAT · Satış" */
export function filtreMetni(f) {
  if (!filtreAktifMi(f)) return 'Tüm departmanlar';
  const p = [];
  if (f.departmanlar && f.departmanlar.size) p.push([...f.departmanlar].sort(trKarsilastir).join(', '));
  if (f.bolum) p.push(f.bolum);
  return p.join(' · ');
}

/* ==========================================================================
   6. DOM VE İKONLAR
   ========================================================================== */
/** el('div', { class, text, html, style:{}, on:{click}, data:{}, '--css-degisken':v, diğer öznitelikler }, ...çocuklar) */
export function el(etiket, oz, ...cocuklar) {
  const e = document.createElement(etiket);
  if (oz) {
    for (const k of Object.keys(oz)) {
      const v = oz[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k === 'on') { for (const o of Object.keys(v)) e.addEventListener(o, v[o]); }
      else if (k === 'data') { for (const d of Object.keys(v)) e.dataset[d] = v[d]; }
      else if (k.startsWith('--')) e.style.setProperty(k, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of cocuklar.flat()) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c instanceof Node ? c : String(c));
  }
  return e;
}
export const $ = (sec, kok = document) => kok.querySelector(sec);
/** İnce çizgili ikonlar (1.7 px; emoji yerine) */
export const IKONLAR = {
  hedef: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  performans: '<path d="M4 19.5h16"/><path d="M6.5 16v-4M11 16V8M15.5 16v-6M20 16V5" />',
  excel: '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5"/><path d="m9 12 4 5M13 12l-4 5"/>',
  indir: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>',
  yukle: '<path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M5 19.5h14"/>',
  anahtar: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>',
  cikis: '<path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3"/><path d="M10 16.5 5.5 12 10 7.5"/><path d="M5.5 12h10"/>',
  sifirla: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>',
  kilit: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  onay: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  carpi: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  uyari: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  bilgi: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".7" fill="currentColor"/>',
  siralama: '<path d="M8 5v14M4.5 15.5 8 19l3.5-3.5"/><path d="M16 19V5M12.5 8.5 16 5l3.5 3.5"/>',
  yukari: '<path d="m7 14 5-5 5 5"/>', asagi: '<path d="m7 10 5 5 5-5"/>',
  ok: '<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
  takvim: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  kisi: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  kisiler: '<circle cx="9" cy="9" r="3.4"/><path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0"/><path d="M15.5 5.8a3.3 3.3 0 0 1 0 6.4M17.5 14.2a6.2 6.2 0 0 1 3.7 5.3"/>',
  genel: '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="4.5" rx="1.6"/><rect x="13" y="11" width="7" height="9" rx="1.6"/><rect x="4" y="13.5" width="7" height="6.5" rx="1.6"/>',
  kapi: '<path d="M5 20.5h14"/><path d="M7 20.5V4.5h8.5v16"/><path d="M15.5 6.5l3 1v13"/><circle cx="12.6" cy="12.8" r=".8" fill="currentColor"/>',
  alim: '<circle cx="10" cy="8.5" r="3.6"/><path d="M3.5 19.5a6.5 6.5 0 0 1 11.6-4"/><path d="M18 13.5v6M15 16.5h6"/>',
  donus: '<path d="M4.5 9.5a7.5 7.5 0 0 1 13.4-3"/><path d="M18.5 3.5v3.6h-3.6"/><path d="M19.5 14.5a7.5 7.5 0 0 1-13.4 3"/><path d="M5.5 20.5v-3.6h3.6"/>',
  izin: '<path d="M4 19.5h16"/><path d="M12 19.5V9"/><path d="M12 9c-1-3.5-4.5-5-8-4 1 3.5 4.5 5 8 4zM12 9c1-3.5 4.5-5 8-4-1 3.5-4.5 5-8 4z"/>',
  saat: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  terazi: '<path d="M12 4v16M7 20h10M5 7.5h14"/><path d="m5 7.5-2.5 6a2.8 2.8 0 0 0 5 0zM19 7.5l-2.5 6a2.8 2.8 0 0 0 5 0z"/>',
  rapor: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 15.5v-3M12 15.5v-7M16 15.5v-5"/>',
  ara: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  filtre: '<path d="M4 5.5h16l-6.2 7.3v5.4l-3.6 1.8v-7.2z"/>',
  dosya: '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5"/>',
  pano: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9h17M9 9v10.5"/>',
  kidem: '<path d="M12 3.5 4.5 7v5c0 4.2 3.2 7.6 7.5 8.5 4.3-.9 7.5-4.3 7.5-8.5V7z"/><path d="m9 12 2 2 4-4"/>',
  harita: '<path d="M4 6.5 9 4.5l6 2 5-2v13l-5 2-6-2-5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
  yildiz: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
  zil: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>'
};
/** ikon('ara') → SVG metni (innerHTML için) */
export function ikon(ad, cls = '') {
  return `<svg class="ikon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKONLAR[ad] || ''}</svg>`;
}

/* ==========================================================================
   7. HAREKET (sayaç — EKLER KORUNUR)
   ========================================================================== */
export const azHareket = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const egri = (t) => 1 - Math.pow(1 - t, 4);
/** Sayaç: 0'dan hedefe sayar; önek/sonek/işaret animasyon boyunca ve SONUNDA korunur (B1/B9 düzeltmesi).
    Son kare = biçimlenmiş hedefin kendisi. ondalik: sayı ya da 'oto' (0–2 hane). */
export function sayac(el, hedef, { ondalik = 0, onek = '', sonek = '', sure = 1100, isaret = false, bicim = null } = {}) {
  if (!el) return;
  if (bosMu(hedef) || isNaN(+hedef)) { el.textContent = '—'; return; }
  const h = +hedef;
  const ara = ondalik === 'oto' || ondalik === null ? 2 : ondalik;
  const yaz = (v, son) => {
    const o = son ? ondalik : ara;
    el.textContent = bicim ? bicim(v, son) : onek + (isaret ? isaretli(v, o) : sayi(v, o)) + sonek;
  };
  if (el._sayacRaf) cancelAnimationFrame(el._sayacRaf);
  if (azHareket() || !sure || h === 0) { yaz(h, true); return; }
  const t0 = performance.now();
  const adim = (now) => {
    const t = Math.min(1, (now - t0) / sure);
    if (t < 1) { yaz(h * egri(t), false); el._sayacRaf = requestAnimationFrame(adim); }
    else { yaz(h, true); el._sayacRaf = null; }
  };
  yaz(0, false);
  el._sayacRaf = requestAnimationFrame(adim);
  /* Sekme arka plandayken rAF durabilir: süre sonunda son değeri garanti et */
  setTimeout(() => { if (el._sayacRaf) { cancelAnimationFrame(el._sayacRaf); el._sayacRaf = null; yaz(h, true); } }, sure + 400);
}

/* ==========================================================================
   8. BİLEŞENLER
   ========================================================================== */
/* ---------- 8.1 İpucu (tooltip) ve bildirim ---------- */
let ipEl = null;
function ipHazir() { if (!ipEl) { ipEl = el('div', { class: 'ipucu', role: 'tooltip' }); document.body.appendChild(ipEl); } return ipEl; }
/** ipucuGoster(x, y, { baslik, satirlar:[{ etiket, deger, renk?, buyuk? }] }) — değer önde, etiket arkada */
export function ipucuGoster(x, y, { baslik = '', satirlar = [] } = {}) {
  const e = ipHazir(); e.textContent = '';
  if (baslik) e.append(el('div', { class: 'ip-etiket', text: baslik, style: { marginBottom: '6px' } }));
  for (const s of satirlar) {
    const sol = el('span', { class: 'ip-etiket' });
    if (s.renk) { const k = el('i', { class: 'ip-anahtar' }); k.style.background = s.renk; sol.append(k); }
    sol.append(document.createTextNode(s.etiket || ''));
    e.append(el('div', { class: 'ip-satir' }, sol, el('span', { class: s.buyuk ? 'ip-deger' : '', text: s.deger ?? '', style: { fontWeight: '600' } })));
  }
  const w = e.offsetWidth || 200, h = e.offsetHeight || 80;
  let L = x + 14, T = y + 14;
  if (L + w > innerWidth - 8) L = x - w - 14;
  if (T + h > innerHeight - 8) T = y - h - 14;
  e.style.left = Math.max(8, L) + 'px'; e.style.top = Math.max(8, T) + 'px'; e.classList.add('acik');
}
export function ipucuGizle() { if (ipEl) ipEl.classList.remove('acik'); }
/** Bir öğeye hover/odak ipucu bağlar: ipucuBagla(el, () => ({ baslik, satirlar })) */
export function ipucuBagla(hedef, icerik) {
  hedef.addEventListener('pointermove', (e) => ipucuGoster(e.clientX, e.clientY, icerik()));
  hedef.addEventListener('pointerleave', ipucuGizle);
  hedef.addEventListener('focus', () => { const r = hedef.getBoundingClientRect(); ipucuGoster(r.right, r.bottom, icerik()); });
  hedef.addEventListener('blur', ipucuGizle);
}
let bdEl = null, bdZ = null;
/** Bildirim (toast) — altta ortada, ~3,6 sn */
export function bildirim(metin) {
  if (!bdEl) { bdEl = el('div', { class: 'bildirim', role: 'status' }); document.body.appendChild(bdEl); }
  bdEl.innerHTML = ikon('bilgi'); bdEl.append(el('span', { text: metin }));
  requestAnimationFrame(() => bdEl.classList.add('acik'));
  clearTimeout(bdZ); bdZ = setTimeout(() => bdEl.classList.remove('acik'), 3600);
}

/* ---------- 8.2 Kadran (halka gösterge) ---------- */
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(ad, oz) { const e = document.createElementNS(SVGNS, ad); for (const k in oz) e.setAttribute(k, oz[k]); return e; }
/** Halka gösterge (270° ark, ölçü çizgileri). İki kip:
    • doluluk: { deger, max } — ark deger/max kadar dolar (pirinç)
    • bileşim: { parcalar:[{ ad, deger, renk, metin? }] } — ark parçaların payına bölünür (parça-bütün)
    Ortak: { etiket, merkez (ortadaki sayı; yoksa deger), onek, sonek, ondalik, isaret, boyut, acik (açık zemin) } */
export function kadran(kap, o = {}) {
  const { deger = 0, max = 100, parcalar = null, etiket = '', onek = '', sonek = '', ondalik = 0, isaret = false, boyut = 148, kalinlik = 7, acik = false, renk = null } = o;
  const merkez = o.merkez === undefined ? deger : o.merkez;
  kap.textContent = '';
  kap.classList.add('gosterge'); if (acik) kap.classList.add('acik');
  kap.style.width = boyut + 'px'; kap.style.height = boyut + 'px';
  const C = 100, R = 76, CEVRE = 2 * Math.PI * R, YAY = CEVRE * 0.75, BAS = 135, SUP = 270;
  const svg = svgEl('svg', { viewBox: '0 0 200 200', width: boyut, height: boyut, 'aria-hidden': 'true' });
  const nokta = (a, r) => [C + r * Math.cos(a * Math.PI / 180), C + r * Math.sin(a * Math.PI / 180)];
  const cizgiler = [];
  for (let i = 0; i <= 54; i++) {
    const a = BAS + i * 5, ana = i % 9 === 0;
    const [x1, y1] = nokta(a, ana ? 86 : 88), [x2, y2] = nokta(a, ana ? 97 : 93);
    const l = svgEl('line', { x1, y1, x2, y2, class: 'g-cizgi' + (ana ? ' ana' : ''), 'stroke-width': ana ? 1.6 : 1, 'stroke-linecap': 'round' });
    l.dataset.oran = i / 54; svg.appendChild(l); cizgiler.push(l);
  }
  const ortak = { cx: C, cy: C, r: R, fill: 'none', 'stroke-width': kalinlik, transform: `rotate(${BAS} ${C} ${C})` };
  svg.appendChild(svgEl('circle', { ...ortak, class: 'g-iz', 'stroke-dasharray': `${YAY} ${CEVRE}`, 'stroke-linecap': 'round' }));
  const gecerli = Array.isArray(parcalar) ? parcalar.filter((p) => +p.deger > 0) : [];
  const bilesik = gecerli.length > 0;
  const segler = [];
  let uc = null;
  if (bilesik) {
    const top = gecerli.reduce((s, p) => s + +p.deger, 0);
    const ara = gecerli.length > 1 ? 3 : 0;
    let bas = 0;
    gecerli.forEach((p) => {
      const uzun = YAY * (+p.deger / top);
      const c = svgEl('circle', { ...ortak, class: 'g-parca', stroke: p.renk || RENK.pir400, 'stroke-dasharray': `0.001 ${CEVRE}`, 'stroke-dashoffset': String(-(bas + ara / 2)) });
      svg.appendChild(c);
      segler.push({ c, bas, uzun: Math.max(0.001, uzun - ara) });
      bas += uzun;
    });
  } else if (!Array.isArray(parcalar)) {
    const dolu = svgEl('circle', { ...ortak, class: 'g-dolu', 'stroke-dasharray': `0.001 ${CEVRE}` });
    if (renk) dolu.style.stroke = renk;
    svg.appendChild(dolu); segler.push({ c: dolu, tek: true });
    uc = svgEl('circle', { r: 4.2, class: 'g-uc', cx: nokta(BAS, R)[0], cy: nokta(BAS, R)[1] });
    svg.appendChild(uc);
  }
  kap.appendChild(svg);
  const dg = el('div', { class: 'g-deger' }); dg.style.fontSize = Math.round(boyut * 0.2) + 'px';
  /* Etiket halkanın iç çapına sığar: gerekirse iki satıra iner */
  const et = el('div', { class: 'g-etiket', text: etiket, style: { maxWidth: Math.round(boyut * 0.6) + 'px', fontSize: (boyut < 120 ? 8.5 : 10) + 'px' } });
  kap.appendChild(el('div', { class: 'g-merkez' }, dg, et));
  const oranSon = bilesik ? 1 : (Array.isArray(parcalar) ? 0 : Math.max(0, Math.min(1, (+deger || 0) / (max || 1))));
  const bosMerkez = bosMu(merkez) || isNaN(+merkez);
  const yazDeger = (v, son) => {
    dg.textContent = '';
    if (bosMerkez) { dg.textContent = '—'; return; }
    const od = son ? ondalik : (ondalik === 'oto' ? 2 : ondalik);
    if (onek) dg.appendChild(el('span', { class: 'g-birim', text: onek }));
    dg.appendChild(document.createTextNode(isaret ? isaretli(v, od) : sayi(v, od)));
    if (sonek) dg.appendChild(el('span', { class: 'g-birim', text: sonek, style: { marginLeft: '2px' } }));
  };
  const ciz = (t, son) => {
    const goster = YAY * t;
    for (const s of segler) {
      if (s.tek) s.c.setAttribute('stroke-dasharray', `${Math.max(0.001, YAY * oranSon * t)} ${CEVRE}`);
      else s.c.setAttribute('stroke-dasharray', `${Math.max(0.001, Math.min(s.uzun, goster - s.bas))} ${CEVRE}`);
    }
    if (uc) { const [x, y] = nokta(BAS + SUP * oranSon * t, R); uc.setAttribute('cx', x); uc.setAttribute('cy', y); }
    const yanik = bilesik ? t : oranSon * t;
    for (const l of cizgiler) l.classList.toggle('yanik', +l.dataset.oran <= yanik + 0.0001 && yanik > 0);
    yazDeger(bosMerkez ? 0 : +merkez * (son ? 1 : t), son);
  };
  const parcaMetni = gecerli.map((p) => p.ad + ' ' + (p.metin || sayi(p.deger))).join(', ');
  kap.setAttribute('role', 'img');
  kap.setAttribute('aria-label', etiket + ': ' + (bosMerkez ? '—' : onek + sayi(merkez, ondalik) + sonek) + (parcaMetni ? ' (' + parcaMetni + ')' : ''));
  if (bilesik) ipucuBagla(kap, () => ({ baslik: etiket, satirlar: gecerli.map((p) => ({ etiket: p.ad, deger: p.metin || sayi(p.deger), renk: p.renk })) }));
  if (azHareket()) { ciz(1, true); return kap; }
  const t0 = performance.now(), sure = 1400;
  const adim = (now) => { const t = Math.min(1, (now - t0) / sure); if (t < 1) { ciz(egri(t), false); requestAnimationFrame(adim); } else ciz(1, true); };
  ciz(0, false);
  requestAnimationFrame(adim);
  setTimeout(() => ciz(1, true), sure + 450);
  return kap;
}

/* ---------- 8.3 Kaput (sayfa başı koyu bant) ---------- */
/** kaput(kok, { B, ustEtiket, baslik, ozetHtml | ozet, meta:[{ ikon, html | metin }], kadranlar:[kadran seçenekleri + alt (HTML)], bindirme })
    Kabukta #kaputYuva varsa kaput oraya (üst bant ile aynı koyu alana) çizilir; yoksa kok'un başına.
    B verilirse etkin global filtre çip olarak gösterilir (× ile kaldırılır). bindirme:true → ilk içerik bloğu
    (sınıfı "bindir") kaputun alt kenarına biner. */
export function kaput(kok, o = {}) {
  const yuva = document.getElementById('kaputYuva');
  const alan = yuva ? yuva.closest('.ust-alan') : null;
  if (yuva) yuva.textContent = '';
  const k = el('section', { class: 'kaput' + (yuva ? '' : ' kaput-bagimsiz kokpit'), 'aria-label': (o.baslik || 'Sayfa') + ' özeti' });
  const ic = el('div', { class: 'ic kaput-govde' });
  const sol = el('div', { class: 'kaput-baslik' });
  if (o.ustEtiket) sol.append(el('div', { class: 'ust-etiket', text: o.ustEtiket }));
  sol.append(el('h1', { class: 'sayfa-baslik', text: o.baslik || '' }));
  if (o.ozetHtml) sol.append(el('p', { class: 'kaput-ozet', html: o.ozetHtml }));
  else if (o.ozet) sol.append(el('p', { class: 'kaput-ozet', text: o.ozet }));
  if (o.meta && o.meta.length) {
    const m = el('div', { class: 'kaput-meta' });
    o.meta.forEach((x) => m.append(el('span', { html: (x.ikon ? ikon(x.ikon) : '') + (x.html != null ? x.html : esc(x.metin)) })));
    sol.append(m);
  }
  const B = o.B;
  if (B && B.filtreAktif && B.filtre) {
    const f = el('div', { class: 'kaput-filtre' }, el('span', { class: 'kaput-filtre-et', html: ikon('filtre') + 'Filtre' }));
    const cipler = [...B.filtre.departmanlar].sort(trKarsilastir).map((d) => ({ metin: d, kaldir: () => B.filtreKaldir('dept', d) }));
    if (B.filtre.bolum) cipler.push({ metin: 'Bölüm: ' + B.filtre.bolum, kaldir: () => B.filtreKaldir('bolum') });
    filtreCipleri(f, cipler);
    f.append(el('button', { class: 'kaput-filtre-temizle', type: 'button', on: { click: () => B.filtreTemizle() } }, 'Tümünü kaldır'));
    sol.append(f);
  }
  ic.append(sol);
  if (o.kadranlar && o.kadranlar.length) {
    const kume = el('div', { class: 'kadran-kume', role: 'group', 'aria-label': 'Ana göstergeler' });
    const kucuk = window.matchMedia('(max-width: 760px)').matches;
    o.kadranlar.forEach((kd) => {
      const g = el('div');
      const h = el('div', { class: 'kadran-hucre' }, g);
      if (kd.alt) h.append(el('div', { class: 'kadran-alt', html: kd.alt }));
      kume.append(h);
      kadran(g, Object.assign({ boyut: kucuk ? 100 : 146 }, kd));
    });
    ic.append(kume);
  }
  k.append(ic);
  if (yuva) yuva.append(k); else kok.prepend(k);
  if (alan) alan.classList.toggle('bindirmeli', !!o.bindirme);
  return k;
}

/* ---------- 8.4 Akış başlığı, ızgara, kart ---------- */
/** akisBaslik(kok, { no:'02', baslik:'Trend', aciklama }) — sayfa akışındaki bölüm başlığı */
export function akisBaslik(kok, { no = '', baslik = '', aciklama = '' } = {}) {
  const h = el('header', { class: 'akis-baslik' },
    no ? el('span', { class: 'akis-no', text: no }) : null,
    el('h2', { text: baslik }),
    aciklama ? el('span', { class: 'aciklama', text: aciklama }) : null,
    el('span', { class: 'akis-cizgi', 'aria-hidden': 'true' }));
  kok.append(h); return h;
}
/** 12 sütunlu ızgara: kartlara sinif 's3'…'s12' verin */
export function izgara(kok, sinif = '') { const g = el('section', { class: 'izgara ' + sinif }); kok.append(g); return g; }
/** kart(kap, { baslik, aciklama, sinif:'s6', sag:Node, id }) → { kart, ust, govde } */
export function kart(kap, { baslik = '', aciklama = '', sinif = '', sag = null, id = null } = {}) {
  const k = el('article', { class: 'kart ' + sinif, id });
  const bas = el('div', { class: 'kart-bas' }, el('h3', { class: 'kart-baslik', text: baslik }), aciklama ? el('div', { class: 'kart-alt', text: aciklama }) : null);
  const ust = el('div', { class: 'kart-ust' }, bas);
  if (sag) ust.append(sag);
  const govde = el('div', { class: 'kart-govde' });
  k.append(ust, govde);
  kap.append(k);
  return { kart: k, ust, govde };
}
/** Kart altı not satırı (ikon + metin) */
export function kartNot(kap, metin) { const n = el('div', { class: 'kart-not', html: ikon('bilgi') }); n.append(el('span', { text: metin })); kap.append(n); return n; }

/* ---------- 8.5 KPI ---------- */
function degerEl(o) {
  const ham = o.metin !== undefined ? (o.metin ?? '') : (bosMu(o.deger) ? '' : String(o.deger));
  const dg = el('div', { class: 'kpi-deger' + (o.ton ? ' ' + o.ton : ''), 'data-kpi': o.anahtar || null, 'data-deger': ham });
  dg.append(el('span', { class: 'v', text: '—' }));
  if (o.birim) dg.append(el('small', { text: o.birim }));
  return dg;
}
function degerYaz(dg, o) {
  const v = dg.querySelector('.v');
  if (o.metin !== undefined) { v.textContent = bosMu(o.metin) ? '—' : String(o.metin); return; }
  sayac(v, o.deger, { ondalik: o.ondalik ?? 0, onek: o.onek || '', sonek: o.sonek || '', isaret: !!o.isaret });
}
/** deltaEl({ fark, ondalik, birim, iyiYon:'yukari'|'asagi'|null, metin }) — ok + değer; renk = yön × iyi yön */
export function deltaEl(d) {
  const yon = d.fark > 0 ? 'yukari' : 'asagi';
  const sinif = !d.iyiYon ? 'delta-notr' : (yon === d.iyiYon ? 'delta-iyi' : 'delta-kotu');
  const s = el('span', { class: 'delta ' + sinif, html: ikon(yon) });
  s.append(document.createTextNode(sayi(Math.abs(d.fark), d.ondalik ?? 0) + (d.birim ? ' ' + d.birim : '')));
  return el('span', { class: 'delta-kap' }, s, d.metin ? el('span', { class: 'delta-metin', text: d.metin }) : null);
}
function altEl(o) {
  const a = el('div', { class: 'kpi-alt' });
  if (o.delta) a.append(deltaEl(o.delta));
  if (o.altHtml) a.append(el('span', { html: o.altHtml }));
  else if (o.alt) a.append(el('span', { text: o.alt }));
  return a;
}
/** KPI öğesi (kpiPanel ve kpiKart ortak):
    { anahtar, etiket, deger, ondalik (sayı|'oto'), onek, sonek, isaret, birim, metin (sayısal olmayan değer),
      alt | altHtml, delta:{…deltaEl}, ton:'iyi'|'kotu', ipucu, ikon, renk, olcek (0–1) } */
/** Gösterge panosu: gruplu satırlar hâlinde KPI'lar (Genel Bakış'taki gibi)
    satirlar: [{ grup:{ baslik, alt, ikon }, ogeler:[KPI öğesi…] }] */
export function kpiPanel(kap, satirlar, { sinif = '' } = {}) {
  const p = el('section', { class: 'kpi-panel ' + sinif, 'aria-label': 'Özet göstergeler' });
  let i = 0;
  satirlar.forEach((s) => {
    const r = el('div', { class: 'kpi-satiri', '--n': s.ogeler.length });
    if (s.grup) r.append(el('div', { class: 'kpi-grup' }, el('b', { html: (s.grup.ikon ? ikon(s.grup.ikon) : '') + esc(s.grup.baslik) }), s.grup.alt ? el('small', { text: s.grup.alt }) : null));
    s.ogeler.forEach((o) => {
      const h = el('div', { class: 'kpi-hucre belir', title: o.ipucu || null, '--i': i++ });
      const dg = degerEl(o);
      h.append(el('span', { class: 'ust-etiket', text: o.etiket }), dg, altEl(o));
      r.append(h);
      degerYaz(dg, o);
    });
    p.append(r);
  });
  kap.append(p);
  return p;
}
/** Tek KPI kartı (kokpit .kart.kpi): sol renk çizgisi, üst etiket, ikon, sayaçlı değer, alt metin, isteğe bağlı ölçek */
export function kpiKart(kap, o = {}) {
  const k = el('div', { class: 'kart kpi derin belir', '--kpi-renk': o.renk || 'var(--pir-500)', '--i': o.sira || 0, title: o.ipucu || null });
  k.append(el('div', { class: 'kpi-ust' }, el('span', { class: 'ust-etiket', text: o.etiket || '' }), o.ikon ? el('span', { class: 'kpi-ikon', html: ikon(o.ikon) }) : null));
  const dg = degerEl(o);
  k.append(dg, altEl(o));
  if (o.olcek !== undefined && o.olcek !== null) k.append(el('div', { class: 'kpi-olcek' }, el('i', { '--o': Math.max(0, Math.min(1, +o.olcek || 0)) })));
  kap.append(k);
  degerYaz(dg, o);
  return k;
}
/** KPI kartı satırı: kpiSatiri(kok, [öğe, öğe, …], { kolon:4, sinif }) */
export function kpiSatiri(kap, ogeler, { kolon = 0, sinif = '' } = {}) {
  const s = el('section', { class: 'kpi-satir ' + sinif, '--kolon': kolon || ogeler.length, 'aria-label': 'Özet göstergeler' });
  ogeler.forEach((o, i) => kpiKart(s, Object.assign({ sira: i }, o)));
  kap.append(s);
  return s;
}

/* ---------- 8.6 Lejant, çubuk listesi, dağılım şeridi ---------- */
/** lejant(kap, [{ ad, renk, tip:'kutu'|'cizgi' }]) */
export function lejant(kap, ogeler) {
  const l = el('div', { class: 'lejant' });
  ogeler.forEach((o) => { const i = el('i', { class: o.tip === 'cizgi' ? 'cizgi' : null }); i.style.background = o.renk; l.append(el('span', null, i, o.ad)); });
  kap.append(l);
  return l;
}
/** Yatay çubuk listesi (HTML): satirlar [{ ad, deger, renk?, ipucu?, alt? }]
    seçenekler { max, bicim:(v,s)=>metin, renk, kaydir:px (yükseklik sınırı), seriler:[{ k, ad, renk }] (satır başına birden çok çubuk), bos, adGenislik } */
export function cubukListe(kap, satirlar, o = {}) {
  const { max = null, bicim = (v) => sayi(v), renk = RENK.g1, kaydir = 0, seriler = null, bos = 'Veri yok', adGenislik = null } = o;
  const liste = el('div', { class: 'cubuk-liste' + (kaydir ? ' kaydir' : '') + (seriler ? ' coklu' : ''), role: 'list', '--kaydir': kaydir ? kaydir + 'px' : null, '--ad-gen': adGenislik });
  if (!satirlar || !satirlar.length) { bosDurum(liste, { ikon: 'filtre', baslik: bos, kucuk: true }); kap.append(liste); return liste; }
  const tumDeger = seriler ? satirlar.flatMap((s) => seriler.map((se) => +s[se.k] || 0)) : satirlar.map((s) => +s.deger || 0);
  const mx = max || Math.max(1, ...tumDeger);
  satirlar.forEach((s, i) => {
    const r = el('div', { class: 'cubuk-satir', role: 'listitem' });
    r.append(el('span', { class: 'cubuk-ad', text: s.ad, title: s.ad }));
    if (seriler) {
      const izler = el('span', { class: 'cubuk-izler' });
      const degerler = el('span', { class: 'cubuk-deger cok' });
      seriler.forEach((se) => {
        const v = +s[se.k] || 0;
        izler.append(el('span', { class: 'cubuk-iz' }, el('i', { '--o': v / mx, '--i': i, style: { background: se.renk } })));
        degerler.append(el('span', { text: bicim(v, s, se) }));
      });
      r.append(izler, degerler);
    } else {
      r.append(el('span', { class: 'cubuk-iz' }, el('i', { '--o': (+s.deger || 0) / mx, '--i': i, style: { background: s.renk || renk } })));
      r.append(el('span', { class: 'cubuk-deger', text: bicim(s.deger, s) }));
    }
    if (s.ipucu) r.title = s.ipucu;
    liste.append(r);
  });
  kap.append(liste);
  return liste;
}
/** Parça-bütün şeridi (%100 yığılmış tek çubuk): parcalar [{ ad, deger, renk }] */
export function dagilimSeridi(kap, parcalar, { bicim = null } = {}) {
  const top = parcalar.reduce((s, p) => s + (+p.deger || 0), 0);
  const s = el('div', { class: 'serit', role: 'img', 'aria-label': parcalar.map((p) => p.ad + ': ' + sayi(p.deger)).join(', ') });
  parcalar.filter((p) => +p.deger > 0).forEach((p, i) => {
    const parca = el('i', { '--i': i, style: { flexGrow: String(+p.deger), background: p.renk } });
    ipucuBagla(parca, () => ({ baslik: p.ad, satirlar: [{ etiket: 'Kişi', deger: bicim ? bicim(p.deger) : sayi(p.deger), buyuk: true, renk: p.renk }, { etiket: 'Pay', deger: yuzde(top ? p.deger / top * 100 : 0, 0) }] }));
    s.append(parca);
  });
  kap.append(s);
  return s;
}

/* ---------- 8.7 Denetimler: bölümlü düğme, seçim, filtre çipleri ---------- */
/** bolumlu(kap, { secenekler:[{ v, ad, ipucu? }], deger, degisince(v), etiket, kucuk, koyu }) → { el, deger(), ayarla(v) } */
export function bolumlu(kap, { secenekler = [], deger = '', degisince = null, etiket = '', kucuk = false, koyu = false } = {}) {
  const g = el('div', { class: 'bolumlu' + (kucuk ? ' kucuk' : '') + (koyu ? ' koyu' : ''), role: 'group', 'aria-label': etiket || null });
  let cur = deger;
  const isaretle = () => g.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(cur))));
  secenekler.forEach((s) => {
    const b = el('button', { type: 'button', 'data-v': String(s.v), title: s.ipucu || null, text: s.ad });
    b.addEventListener('click', () => { if (String(cur) === String(s.v)) return; cur = s.v; isaretle(); if (degisince) degisince(s.v); });
    g.append(b);
  });
  isaretle();
  kap.append(g);
  return { el: g, deger: () => cur, ayarla: (v) => { cur = v; isaretle(); } };
}
let _sid = 0;
/** secim(kap, { etiket, secenekler:[{ v, ad }], deger, degisince(v), genislik }) → <select> (kokpit .alan/.secim) */
export function secim(kap, { etiket = '', secenekler = [], deger = '', degisince = null, genislik = null, id = null } = {}) {
  const sid = id || 'secim-' + (++_sid);
  const a = el('div', { class: 'alan', style: genislik ? { width: genislik } : null });
  if (etiket) a.append(el('label', { for: sid, text: etiket }));
  const s = el('select', { class: 'secim', id: sid });
  secenekler.forEach((x) => s.append(el('option', { value: x.v, text: x.ad })));
  s.value = deger;
  if (degisince) s.addEventListener('change', () => degisince(s.value));
  a.append(s);
  kap.append(a);
  return s;
}
/** filtreCipleri(kap, [{ metin, kaldir(), sabit? }]) — × ile kaldırılan etkin filtre çipleri */
export function filtreCipleri(kap, cipler) {
  cipler.forEach((c) => {
    const b = el('button', { class: 'filtre-cip' + (c.sabit ? ' sabit' : ''), type: 'button', title: c.sabit ? null : 'Filtreyi kaldır' }, c.metin);
    if (!c.sabit) { b.insertAdjacentHTML('beforeend', ikon('carpi')); b.addEventListener('click', c.kaldir); }
    kap.append(b);
  });
}

/* ---------- 8.8 Boş durum, notlar ---------- */
/** bosDurum(kap, { ikon, baslik, metin, eylem:{ metin, fn | href }, kucuk }) */
export function bosDurum(kap, { ikon: ik = 'bilgi', baslik = 'Kayıt bulunamadı', metin = '', eylem = null, kucuk = false } = {}) {
  const d = el('div', { class: 'bos-durum' + (kucuk ? ' kucuk' : '') });
  d.append(el('div', { class: 'bos-ikon', html: ikon(ik) }), el('h3', { text: baslik }));
  if (metin) d.append(el('p', { text: metin }));
  if (eylem) d.append(eylem.href ? el('a', { class: 'btn', href: eylem.href }, eylem.metin) : el('button', { class: 'btn', type: 'button', on: { click: eylem.fn } }, eylem.metin));
  kap.append(d);
  return d;
}
/** Sayfa sonu "Notlar · Kaynak" kutusu */
export function notlar(kok, maddeler, baslik = 'Notlar · Kaynak') {
  const f = el('footer', { class: 'notlar' }, el('h3', { text: baslik }));
  const ul = el('ul');
  maddeler.forEach((m) => ul.append(el('li', { text: m })));
  f.append(ul);
  kok.append(f);
  return f;
}

/* ==========================================================================
   9. GRAFİK (Chart.js 4.4.1 + datalabels 2.2.0 — kabuk CDN'den yükler)
   ========================================================================== */
const GRAFIKLER = new Set();
let _varsayilan = false;
/** Ortak Chart.js görünümü — kabuk bir kez çağırır (tekrar çağrı zararsız) */
export function grafikVarsayilan() {
  const C = window.Chart;
  if (!C || _varsayilan) return;
  _varsayilan = true;
  if (window.ChartDataLabels) { C.register(window.ChartDataLabels); C.defaults.plugins.datalabels.display = false; }
  C.defaults.font.family = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
  C.defaults.font.size = 11;
  C.defaults.color = RENK.n500;
  C.defaults.borderColor = RENK.n150;
  C.defaults.responsive = true;
  C.defaults.maintainAspectRatio = false;
  C.defaults.plugins.legend.display = false;
  C.defaults.animation.duration = 900;
  C.defaults.animation.easing = 'easeOutQuart';
  /* Okunur ipucu (B10): koyu zemin + açık başlık/gövde */
  Object.assign(C.defaults.plugins.tooltip, {
    backgroundColor: '#0a182c', titleColor: '#bfcde2', bodyColor: '#f3f6fb', footerColor: '#bfcde2',
    borderColor: 'rgba(191,205,226,.16)', borderWidth: 1, padding: 10, cornerRadius: 10, caretSize: 5,
    boxWidth: 10, boxHeight: 10, boxPadding: 4, usePointStyle: false, displayColors: true,
    titleFont: { weight: '500', size: 11 }, bodyFont: { weight: '600', size: 12 }, footerFont: { weight: '500', size: 11 }
  });
  C.defaults.elements.bar.borderRadius = 4;
  C.defaults.elements.bar.borderSkipped = 'start';
  C.defaults.elements.line.borderWidth = 2;
  C.defaults.elements.line.tension = 0.3;
  C.defaults.elements.point.radius = 4;
  C.defaults.elements.point.hoverRadius = 6;
  C.defaults.elements.point.borderWidth = 2;
  C.defaults.elements.point.borderColor = '#fff';
  if (azHareket()) C.defaults.animation = false;
}
/** grafik(canvas, config) → Chart (aynı tuvaldeki eskisini yok eder; kabuk sayfa değişince hepsini temizler) */
export function grafik(canvas, config) {
  if (!canvas) return null;
  if (!window.Chart) {
    const k = canvas.parentElement;
    if (k) { k.textContent = ''; bosDurum(k, { ikon: 'uyari', baslik: 'Grafik yüklenemedi', metin: 'Grafik kitaplığına ulaşılamadı. Bağlantınızı kontrol edip sayfayı yenileyin.', kucuk: true }); }
    return null;
  }
  grafikVarsayilan();
  const eski = window.Chart.getChart(canvas);
  if (eski) { GRAFIKLER.delete(eski); eski.destroy(); }
  const c = new window.Chart(canvas, config);
  GRAFIKLER.add(c);
  return c;
}
/** Bu sayfadaki tüm grafikleri yok eder (kabuk her çizimden önce çağırır) */
export function grafikleriTemizle() { GRAFIKLER.forEach((c) => { try { c.destroy(); } catch (e) { /* zaten yok */ } }); GRAFIKLER.clear(); }
function birlestir(a, b) {
  const o = Array.isArray(a) ? a.slice() : Object.assign({}, a);
  Object.keys(b || {}).forEach((k) => {
    const v = b[k];
    o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? birlestir(o[k], v) : v;
  });
  return o;
}
/** Kategori ekseni (ızgara yok, kılcal taban çizgisi) */
export function eksenX(ek = {}) { return birlestir({ grid: { display: false }, border: { color: RENK.n200 }, ticks: { color: RENK.n500, padding: 6, maxRotation: 0, autoSkip: true, font: { size: 11 } } }, ek); }
/** Değer ekseni (0'dan başlar, kılcal düz ızgara, tr-TR sayılar) */
export function eksenY(ek = {}) { return birlestir({ beginAtZero: true, grid: { color: RENK.n100 }, border: { display: false }, ticks: { color: RENK.n500, padding: 8, precision: 0, font: { size: 11 }, callback: (v) => sayi(v, 'oto') } }, ek); }
/* Değer etiketi görünürlüğü: yer yetiyorsa hepsi; yetmiyorsa yalnız en büyük ve son değer (seçici etiket) */
function etiketGorunur(ctx, secimTuru, minPx) {
  const v = ctx.dataset.data[ctx.dataIndex];
  if (v === null || v === undefined || v === 0) return false;
  if (secimTuru === 'hepsi') return true;
  const ch = ctx.chart, n = (ch.data.labels || []).length || 1;
  const yatay = ch.options.indexAxis === 'y';
  const a = ch.chartArea;
  const uzunluk = a ? (yatay ? a.bottom - a.top : a.right - a.left) : (yatay ? ch.height : ch.width);
  const tip = ctx.dataset.type || ch.config.type;
  const yigin = ch.options.scales && ch.options.scales.x && ch.options.scales.x.stacked;
  const grup = tip === 'bar' && !yigin ? ch.data.datasets.filter((d, i) => ch.isDatasetVisible(i) && (d.type || ch.config.type) === 'bar').length || 1 : 1;
  if (secimTuru !== 'uclar' && uzunluk / (n * grup) >= minPx) return true;
  let mx = -Infinity, mi = -1, son = -1;
  ctx.dataset.data.forEach((x, i) => { if (x === null || x === undefined) return; if (+x > mx) { mx = +x; mi = i; } son = i; });
  return ctx.dataIndex === mi || ctx.dataIndex === son;
}
function etiketBicim(o) { return (v) => (v === null || v === undefined ? '' : (o.onek || '') + sayi(v, o.ondalik ?? 0) + (o.sonek || '')); }
/** Datalabels hazır ayarları — veri kümesine `datalabels: etiket.ust()` olarak verin.
    seçenekler { secim:'otomatik'|'hepsi'|'uclar', minPx, onek, sonek, ondalik, renk, alt (nokta: altta) } */
export const etiket = {
  /** Sütun ucunda değer */
  ust: (o = {}) => ({ display: (ctx) => etiketGorunur(ctx, o.secim || 'otomatik', o.minPx || 24), anchor: 'end', align: 'end', offset: 2, clamp: true, color: o.renk || RENK.n700, font: { family: 'Inter', size: o.boyut || 10.5, weight: '600' }, formatter: etiketBicim(o) }),
  /** Yatay çubuk ucunda (sağda) değer */
  sag: (o = {}) => ({ display: (ctx) => etiketGorunur(ctx, o.secim || 'hepsi', o.minPx || 14), anchor: 'end', align: 'end', offset: 4, clamp: true, color: o.renk || RENK.n700, font: { family: 'Inter', size: o.boyut || 10.5, weight: '600' }, formatter: etiketBicim(o) }),
  /** Çizgi noktasında değer (beyaz konturlu; çizgiyle çakışsa da okunur) */
  nokta: (o = {}) => ({ display: (ctx) => etiketGorunur(ctx, o.secim || 'otomatik', o.minPx || 40), anchor: 'center', align: o.align || (o.alt ? 'bottom' : 'top'), offset: 7, clamp: true, color: o.renk || RENK.n800, textStrokeColor: '#fff', textStrokeWidth: 3, font: { family: 'Inter', size: o.boyut || 10.5, weight: '600' }, formatter: etiketBicim(o) })
};

/** grafikKarti(kap, { baslik, aciklama, sinif, yukseklik, lejant:[…], tablo:()=>({ sutunlar, satirlar }), not, etiket })
    → { kart, govde, canvas, kap } · tablo verilirse kart başında "Grafik | Tablo" geçişi olur (tablo ikizi) */
export function grafikKarti(kap, o = {}) {
  const { baslik = '', aciklama = '', sinif = '', yukseklik = 280, lejant: lj = null, tablo: tabloFn = null, not = '', etiket: aria = '' } = o;
  let sag = null;
  let gorunum = null;
  if (tabloFn) { sag = el('div', { class: 'kart-arac' }); }
  const { kart: k, govde } = kart(kap, { baslik, aciklama, sinif: sinif + ' grafik-kart', sag });
  const ljKap = lj && lj.length ? lejant(govde, lj) : null;
  const gk = el('div', { class: 'grafik-kap', '--yuk': yukseklik + 'px' });
  const canvas = el('canvas', { role: 'img', 'aria-label': aria || baslik });
  gk.append(canvas);
  govde.append(gk);
  let tk = null;
  if (tabloFn) {
    gorunum = bolumlu(sag, {
      secenekler: [{ v: 'grafik', ad: 'Grafik' }, { v: 'tablo', ad: 'Tablo' }], deger: 'grafik', kucuk: true, etiket: 'Görünüm',
      degisince: (v) => {
        if (v === 'tablo') {
          if (!tk) { tk = el('div', { class: 'tablo-kap ikiz', '--yuk': yukseklik + 'px' }); gk.after(tk); }
          tk.textContent = '';
          basitTablo(tk, tabloFn());
          tk.hidden = false; gk.hidden = true; if (ljKap) ljKap.hidden = true;
        } else { gk.hidden = false; if (tk) tk.hidden = true; if (ljKap) ljKap.hidden = false; }
      }
    });
  }
  if (not) kartNot(govde, not);
  return { kart: k, govde, canvas, kap: gk, gorunum };
}

/* ==========================================================================
   10. TABLO
   ========================================================================== */
/** Basit statik tablo (grafik "Tablo" görünümü için): { sutunlar:[{ ad, sag }], satirlar:[[…], …] } */
export function basitTablo(kap, { sutunlar = [], satirlar = [] } = {}) {
  const t = el('table', { class: 'tablo' });
  const tr = el('tr');
  sutunlar.forEach((s) => tr.append(el('th', { class: s.sag ? 'sag' : null, text: s.ad })));
  t.append(el('thead', null, tr));
  const tb = el('tbody');
  satirlar.forEach((r) => { const satir = el('tr'); r.forEach((v, i) => satir.append(el('td', { class: sutunlar[i] && sutunlar[i].sag ? 'sag' : null, text: v ?? '—' }))); tb.append(satir); });
  t.append(tb);
  kap.append(t);
  return t;
}
/** Aranabilir, sıralanabilir, sayfalı tablo.
    tablo(kap, {
      sutunlar: [{ k, ad, tip:'metin'|'sayi'|'tarih', sag, bicim:(v,r)=>metin|Node, html:true (bicim HTML döndürürse),
                   sinif:'ad-hucre', hucreSinif:(v,r)=>'', siralanamaz, ilkYon:'artan'|'azalan', siralamaDegeri:(r)=>… }],
      satirlar: [{…}], sayfaBoyu:12, siraNo:true, ara:true, araYer:'Ara…', araAlanlari:['ad','dept'],
      varsayilanSira:{ k, y:'artan'|'azalan' }, altMetin:(n, toplam)=>'', bos:{ baslik, metin }, toplamSatir:{ k:değer… }, aracEk:Node
    }) → { kok, guncelle(satirlar), ciz(), durum }
    Sıralama döngüsü: ilk tık (sayı → azalan, metin → artan; ilkYon ile değişir) → ters → orijinal sıra.
    null/boş değerler sayısal sıralamada en küçük sayılır (index.html izin sıralamasıyla aynı). */
export function tablo(kap, o = {}) {
  const sut = o.sutunlar || [];
  const PS = o.sayfaBoyu || 12;
  const yonSay = (y) => (y === 'artan' || y === 1 ? 1 : y === 'azalan' || y === -1 ? -1 : 0);
  const S = { q: '', k: o.varsayilanSira ? o.varsayilanSira.k : null, y: o.varsayilanSira ? yonSay(o.varsayilanSira.y) || -1 : 0, s: 1 };
  let veri = (o.satirlar || []).slice();
  const kok = el('div', { class: 'tablo-bilesen' });
  let sayacEl = null;
  if (o.ara !== false) {
    const arac = el('div', { class: 'tablo-arac' });
    const ak = el('label', { class: 'ara-kutu', html: ikon('ara') });
    const girdi = el('input', { class: 'girdi', type: 'search', placeholder: o.araYer || 'Ara…', 'aria-label': o.araYer || 'Tabloda ara', autocomplete: 'off' });
    ak.append(girdi);
    sayacEl = el('span', { class: 'tablo-sayac' });
    arac.append(ak);
    if (o.aracEk) arac.append(o.aracEk);
    arac.append(sayacEl);
    kok.append(arac);
    let z = null;
    girdi.addEventListener('input', () => { clearTimeout(z); z = setTimeout(() => { S.q = girdi.value; S.s = 1; ciz(); }, 120); });
  }
  const tk = el('div', { class: 'tablo-kap' });
  const t = el('table', { class: 'tablo' });
  tk.append(t);
  kok.append(tk);
  const altSol = el('span', { class: 'tablo-alt-metin' });
  const geri = el('button', { class: 'btn', type: 'button' }, '← Önceki');
  const ileri = el('button', { class: 'btn', type: 'button' }, 'Sonraki →');
  const sb = el('span', { class: 'sayfa-bilgi' });
  const sayfalama = el('div', { class: 'sayfalama' }, geri, sb, ileri);
  kok.append(el('div', { class: 'tablo-alt' }, altSol, sayfalama));
  geri.addEventListener('click', () => { if (S.s > 1) { S.s--; ciz(); } });
  ileri.addEventListener('click', () => { S.s++; ciz(); });
  kap.append(kok);
  const araAlan = o.araAlanlari || sut.filter((c) => c.tip !== 'sayi').map((c) => c.k);
  const ilkYon = (c) => (c.ilkYon ? yonSay(c.ilkYon) : c.tip === 'sayi' ? -1 : 1);
  function suz() {
    let d = veri;
    if (S.q.trim()) { const q = aramaAnahtari(S.q); d = d.filter((r) => araAlan.some((k) => aramaAnahtari(r[k]).includes(q))); }
    if (S.k && S.y) {
      const c = sut.find((x) => x.k === S.k) || {};
      const deg = c.siralamaDegeri || ((r) => (c.tip === 'tarih' ? tarihSirasi(r[S.k]) : r[S.k]));
      const sayisal = c.tip === 'sayi' || c.tip === 'tarih';
      const nv = (x) => (x === null || x === undefined || x === '' || isNaN(+x) ? -Infinity : +x);
      d = d.map((r, i) => [r, i]).sort((a, b) => {
        const x = deg(a[0]), y = deg(b[0]);
        let r = sayisal ? nv(x) - nv(y) : trKarsilastir(x, y);
        if (isNaN(r)) r = 0;
        return (r * S.y) || (a[1] - b[1]);
      }).map((p) => p[0]);
    }
    return d;
  }
  function hucre(c, r) {
    const v = r[c.k];
    const td = el('td', { class: [c.sag ? 'sag' : '', c.sinif || '', c.hucreSinif ? c.hucreSinif(v, r) : ''].join(' ').trim() || null });
    const b = c.bicim ? c.bicim(v, r) : (c.tip === 'sayi' ? sayi(v) : c.tip === 'tarih' ? tarih(v) : (bosMu(v) ? '—' : String(v)));
    if (b instanceof Node) td.append(b); else if (c.html) td.innerHTML = b; else td.textContent = b;
    return td;
  }
  function ciz() {
    const d = suz();
    const tp = Math.max(1, Math.ceil(d.length / PS));
    if (S.s > tp) S.s = tp;
    t.textContent = '';
    const htr = el('tr');
    if (o.siraNo) htr.append(el('th', { class: 'sira', text: '#' }));
    sut.forEach((c) => {
      const th = el('th', { class: c.sag ? 'sag' : null, scope: 'col' });
      if (c.siralanamaz) th.textContent = c.ad;
      else {
        if (S.k === c.k && S.y) th.setAttribute('aria-sort', S.y > 0 ? 'ascending' : 'descending');
        const b = el('button', { class: 'th-sirala', type: 'button', title: 'Sırala' }, c.ad);
        b.insertAdjacentHTML('beforeend', ikon(S.k === c.k && S.y ? 'yukari' : 'siralama'));
        b.addEventListener('click', () => {
          if (S.k !== c.k || !S.y) { S.k = c.k; S.y = ilkYon(c); }
          else if (S.y === ilkYon(c)) S.y = -S.y;
          else { S.k = null; S.y = 0; }
          S.s = 1; ciz();
        });
        th.append(b);
      }
      htr.append(th);
    });
    t.append(el('thead', null, htr));
    const tb = el('tbody');
    const dilim = d.slice((S.s - 1) * PS, S.s * PS);
    if (!dilim.length) {
      const td = el('td', { class: 'nod', colspan: String(sut.length + (o.siraNo ? 1 : 0)) });
      bosDurum(td, { ikon: 'filtre', baslik: (o.bos && o.bos.baslik) || 'Kayıt bulunamadı', metin: (o.bos && o.bos.metin) || (S.q ? 'Aramayı değiştirin ya da filtreleri temizleyin.' : ''), kucuk: true });
      tb.append(el('tr', null, td));
    } else {
      dilim.forEach((r, i) => {
        const tr = el('tr');
        if (o.siraNo) tr.append(el('td', { class: 'sira', text: String((S.s - 1) * PS + i + 1) }));
        sut.forEach((c) => tr.append(hucre(c, r)));
        if (o.satirTikla) { tr.classList.add('tiklanir'); tr.addEventListener('click', () => o.satirTikla(r)); }
        tb.append(tr);
      });
    }
    t.append(tb);
    if (o.toplamSatir) {
      const tr = el('tr');
      if (o.siraNo) tr.append(el('td', { class: 'sira' }));
      sut.forEach((c) => tr.append(hucre(c, o.toplamSatir)));
      t.append(el('tfoot', null, tr));
    }
    const n = d.length;
    if (sayacEl) sayacEl.textContent = n === veri.length ? sayi(n) + ' kayıt' : sayi(n) + ' / ' + sayi(veri.length) + ' kayıt';
    altSol.textContent = o.altMetin ? o.altMetin(n, veri.length) : sayi(n) + ' kayıt';
    sb.textContent = 'Sayfa ' + S.s + ' / ' + tp;
    geri.disabled = S.s <= 1;
    ileri.disabled = S.s >= tp;
    sayfalama.hidden = tp <= 1;
  }
  ciz();
  return { kok, ciz, durum: S, guncelle(yeni) { veri = (yeni || []).slice(); S.s = 1; ciz(); } };
}

/* ==========================================================================
   11. DIŞA AKTARMA (.xls — index.html ile aynı başlık, sütun ve dosya adları; V.İ. hariç; global filtre uygulanmaz)
   ========================================================================== */
export const DISA_AKTAR = [
  { id: 'ozet', ad: 'Genel Özet', aciklama: 'Tüm KPI değerleri tek sayfada', ikon: 'genel' },
  { id: 'ayrilan', ad: 'İşten Ayrılanlar', aciklama: 'Tüm ayrılan personel detayları', ikon: 'kapi' },
  { id: 'isealim', ad: 'İşe Alımlar', aciklama: 'Tüm yeni işe alım kayıtları', ikon: 'alim' },
  { id: 'turnover', ad: 'Turnover Analizi', aciklama: 'Aylık turnover oranları', ikon: 'donus' },
  { id: 'izin', ad: 'İzin Durumu', aciklama: 'Tüm çalışanların izin bakiyeleri', ikon: 'izin' },
  { id: 'mesai', ad: 'Mesai Raporu', aciklama: 'Kişi bazlı mesai, aylar veriden', ikon: 'saat' },
  { id: 'tumu', ad: 'Tüm Veriler', aciklama: 'Yukarıdakilerin hepsi tek dosyada', ikon: 'dosya' }
];
/** HTML tabanlı Excel (.xls) indirir — index.html downloadXlsx ile aynı biçim */
export function xlsIndir(sheets, filename) {
  var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
  html += '<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>';
  sheets.forEach(function (sh) { html += '<x:ExcelWorksheet><x:Name>' + sh.name.substring(0, 31) + '</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>'; });
  html += '</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->';
  html += '<style>';
  html += 'table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;}';
  html += 'td{border:1px solid #D1D5DB;padding:6px 10px;font-size:11pt;}';
  html += '.title{background:#1E3A8A;color:#FFFFFF;font-size:16pt;font-weight:bold;padding:10px;}';
  html += '.subtitle{color:#64748B;font-style:italic;font-size:9pt;padding:4px 10px;background:#F8FAFC;}';
  html += '.sectiontitle{color:#1E3A8A;font-weight:bold;font-size:12pt;background:#DBEAFE;padding:6px 10px;}';
  html += '.header{background:#2563EB;color:#FFFFFF;font-weight:bold;text-align:center;padding:8px;border:1px solid #1E40AF;}';
  html += '.label{background:#F1F5F9;font-weight:bold;color:#1E293B;}';
  html += '.value{text-align:right;color:#0F172A;}';
  html += '.zebra{background:#F8FAFC;}';
  html += '.bad{color:#DC2626;font-weight:bold;}';
  html += '.warn{color:#D97706;font-weight:bold;}';
  html += '.good{color:#059669;font-weight:bold;}';
  html += '</style></head><body>';
  sheets.forEach(function (sh, si) {
    html += '<table>';
    sh.rows.forEach(function (row, ri) {
      var cls = (sh.rowClasses && sh.rowClasses[ri]) || '';
      var isZebra = sh.zebraStart !== undefined && ri >= sh.zebraStart && (ri - sh.zebraStart) % 2 === 1;
      html += '<tr>';
      row.forEach(function (cell, ci) {
        var cellClass = cls;
        if (isZebra && !cls) cellClass = 'zebra';
        if (sh.cellClasses) { var key = ri + '_' + ci; if (sh.cellClasses[key]) cellClass = sh.cellClasses[key]; }
        var val = (cell === undefined || cell === null) ? '' : cell;
        html += '<td' + (cellClass ? ' class="' + cellClass + '"' : '') + '>' + String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</td>';
      });
      html += '</tr>';
    });
    html += '</table>';
    if (si < sheets.length - 1) html += '<br>';
  });
  html += '</body></html>';
  var blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.replace('.xlsx', '.xls');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function () { URL.revokeObjectURL(link.href); }, 4000);
}
/** disaAktar('ozet'|'ayrilan'|'isealim'|'turnover'|'izin'|'mesai'|'tumu', D) — index.html exportReport ile aynı içerik.
    Düzeltmeler: dosya tarihi YEREL (B18) · mesai ayları VERİDEN (tüm aylar) · "İstenen mi" istenen ?? istened (B1). */
export function disaAktar(type, D) {
  var oz = D.ozet || {};
  var tarihStr = bugunDosya();
  var tarihGosterim = new Date().toLocaleDateString('tr-TR');
  var ayrilanlarF = excludeVI(D.ayrilanlar);
  var isealimF = excludeVI(D.isealim);
  var izinF = excludeVI(D.izin);
  var mesaiF = excludeVI(D.mesai_kisi);
  function ozetSheet() {
    var rows = [
      ['İNCİROĞLU OTOMOTİV'],
      ['Genel Özet Raporu  ·  ' + tarihGosterim],
      [],
      ['METRİK', 'DEĞER'],
      ['Aktif Personel', oz.personel_mevcudu || D.normal.length],
      ['Stajyer', oz.stajyer_sayisi || D.stajyer.length],
      ['Analist Öğrenci', oz.analist_sayisi || D.gecici.length],
      ['2026 Toplam Çıkış (V.İ. Hariç)', ayrilanlarF.length],
      ['2026 Toplam Giriş (V.İ. Hariç)', isealimF.length],
      ['Net Değişim', isealimF.length - ayrilanlarF.length],
      ['YTD Turnover (%)', oz.ytd_turnover || 0],
      ['Simüle Yıl Sonu Turnover (%)', oz.simule_yilsonu || 0],
      ['İstenen Turnover YTD (%)', oz.ytd_istenen || 0],
      ['İstenmeyen Turnover YTD (%)', oz.ytd_istenmeyen || 0]
    ];
    var rowClasses = { 0: 'title', 1: 'subtitle', 3: 'header' };
    for (var r = 4; r < rows.length; r++) rowClasses[r] = '';
    var cellClasses = {};
    for (var r2 = 4; r2 < rows.length; r2++) { cellClasses[r2 + '_0'] = 'label'; cellClasses[r2 + '_1'] = 'value'; }
    return { name: 'Genel Özet', rows: rows, rowClasses: rowClasses, cellClasses: cellClasses, zebraStart: 4 };
  }
  function ayrilanSheet() {
    var headers = ['Ad Soyad', 'Departman', 'Bölüm', 'Unvan', 'Ayrılış Tarihi', 'Neden', 'Çalışma Süresi', 'İstenen mi'];
    var rows = [['İŞTEN AYRILANLAR DETAY RAPORU'], ['Toplam: ' + ayrilanlarF.length + ' kişi (V.İ. hariç)  ·  ' + tarihGosterim], [], headers];
    var rowClasses = { 0: 'title', 1: 'subtitle', 3: 'header' };
    ayrilanlarF.forEach(function (a) { rows.push([a.ad, a.dept, a.bolum, a.unvan, a.tarih, a.neden, a.sure || '', istenenMi(a) ? 'Evet' : 'Hayır']); });
    return { name: 'İşten Ayrılanlar', rows: rows, rowClasses: rowClasses, zebraStart: 4 };
  }
  function isealimSheet() {
    var headers = ['Ad Soyad', 'Departman', 'Bölüm', 'Unvan', 'Başlama Tarihi'];
    var rows = [['İŞE ALIMLAR DETAY RAPORU'], ['Toplam: ' + isealimF.length + ' kişi (V.İ. hariç)  ·  ' + tarihGosterim], [], headers];
    var rowClasses = { 0: 'title', 1: 'subtitle', 3: 'header' };
    isealimF.forEach(function (a) { rows.push([a.ad, a.dept, a.bolum, a.unvan, a.tarih]); });
    return { name: 'İşe Alımlar', rows: rows, rowClasses: rowClasses, zebraStart: 4 };
  }
  function turnoverSheet() {
    var rows = [
      ['TURNOVER ANALİZ RAPORU'], ['V.İ. hariç  ·  ' + tarihGosterim], [], ['ÖZET ORANLAR'],
      ['YTD Turnover (%)', oz.ytd_turnover || 0],
      ['Simüle Yıl Sonu Turnover (%)', oz.simule_yilsonu || 0],
      ['İstenen Turnover YTD (%)', oz.ytd_istenen || 0],
      ['Simüle İstenen Turnover (%)', oz.simule_istenen || 0],
      ['İstenmeyen Turnover YTD (%)', oz.ytd_istenmeyen || 0],
      ['Simüle İstenmeyen Turnover (%)', oz.simule_istenmeyen || 0],
      [], ['AYLIK ÇIKIŞ DAĞILIMI'], ['Dönem', 'Çıkış Sayısı', 'Oran (%)']
    ];
    var rowClasses = { 0: 'title', 1: 'subtitle', 3: 'sectiontitle', 11: 'sectiontitle', 12: 'header' };
    for (var r = 4; r <= 9; r++) rowClasses[r] = '';
    var cellClasses = {};
    for (var r2 = 4; r2 <= 9; r2++) { cellClasses[r2 + '_0'] = 'label'; cellClasses[r2 + '_1'] = 'value'; }
    var ayAdlari = { '01': 'Ocak', '02': 'Şubat', '03': 'Mart', '04': 'Nisan', '05': 'Mayıs', '06': 'Haziran', '07': 'Temmuz', '08': 'Ağustos', '09': 'Eylül', '10': 'Ekim', '11': 'Kasım', '12': 'Aralık' };
    (D.turnover || []).forEach(function (t) {
      var ayKey = String(t.donem || '').split('-')[1];
      var ayAd = ayAdlari[ayKey] || t.donem;
      rows.push([ayAd, t.cikis_asil !== undefined ? t.cikis_asil : t.cikis, t.oran_asil || t.oran || 0]);
    });
    return { name: 'Turnover', rows: rows, rowClasses: rowClasses, cellClasses: cellClasses, zebraStart: 13 };
  }
  function izinSheet() {
    var headers = ['Ad Soyad', 'Departman', 'Bölüm', 'Güncel Bakiye', 'Toplam Kullanılan'];
    var rows = [['İZİN DURUM RAPORU'], ['Toplam: ' + izinF.length + ' kişi (V.İ. hariç)  ·  ' + tarihGosterim], [], headers];
    var rowClasses = { 0: 'title', 1: 'subtitle', 3: 'header' };
    var cellClasses = {};
    izinF.forEach(function (i, idx) {
      rows.push([i.ad, i.dept, i.bolum, i.bakiye !== null && i.bakiye !== undefined ? i.bakiye : '-', i.kullanilan !== null && i.kullanilan !== undefined ? i.kullanilan : '-']);
      var rIdx = 4 + idx;
      if (i.bakiye !== null && i.bakiye !== undefined && i.bakiye < 0) cellClasses[rIdx + '_3'] = 'bad';
      else if (i.bakiye !== null && i.bakiye !== undefined && i.bakiye >= 30) cellClasses[rIdx + '_3'] = 'warn';
    });
    return { name: 'İzin Durumu', rows: rows, rowClasses: rowClasses, cellClasses: cellClasses, zebraStart: 4 };
  }
  function mesaiSheet() {
    var _ayX = mesaiAylari(D);
    var headers = ['Ad Soyad', 'Departman', 'Bölüm', 'Unvan'].concat(_ayX.map(function (a) { return a.ad; }), ['Toplam', '%']);
    var rows = [['MESAİ RAPORU (BRÜT)'], ['V.İ. hariç  ·  ' + tarihGosterim], [], headers];
    var rowClasses = { 0: 'title', 1: 'subtitle', 3: 'header' };
    mesaiF.forEach(function (m) { rows.push([m.ad, m.dept, m.bolum, m.unvan].concat(_ayX.map(function (a) { return m[a.key] || 0; }), [m.toplam || 0, m.pct || 0])); });
    return { name: 'Mesai', rows: rows, rowClasses: rowClasses, zebraStart: 4 };
  }
  if (type === 'ozet') xlsIndir([ozetSheet()], 'IK_Genel_Ozet_' + tarihStr + '.xlsx');
  else if (type === 'ayrilan') xlsIndir([ayrilanSheet()], 'IK_Isten_Ayrilanlar_' + tarihStr + '.xlsx');
  else if (type === 'isealim') xlsIndir([isealimSheet()], 'IK_Ise_Alimlar_' + tarihStr + '.xlsx');
  else if (type === 'turnover') xlsIndir([turnoverSheet()], 'IK_Turnover_' + tarihStr + '.xlsx');
  else if (type === 'izin') xlsIndir([izinSheet()], 'IK_Izin_Durumu_' + tarihStr + '.xlsx');
  else if (type === 'mesai') xlsIndir([mesaiSheet()], 'IK_Mesai_' + tarihStr + '.xlsx');
  else if (type === 'tumu') xlsIndir([ozetSheet(), ayrilanSheet(), isealimSheet(), turnoverSheet(), izinSheet(), mesaiSheet()], 'IK_Tum_Veriler_' + tarihStr + '.xlsx');
}
