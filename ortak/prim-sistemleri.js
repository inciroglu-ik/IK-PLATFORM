/* ============================================================================
   Müdür Prim Sistemleri (İK Portalı · prim.html) — Excel okuyucu ve ortak yardımcılar · 19.11.2026
   ----------------------------------------------------------------------------
   • Prim çalışma kitabı (ör. "Müdür Prim Sistemleri 2026.xlsx") TARAYICIDA SheetJS ile okunur ve sayfaların
     tablo hâli "olduğu gibi" düz bir modele çevrilir. Veri bu depoya KONMAZ; yalnız erişim listesindeki kişilere
     açık Firestore belgesine (primSistemleri/veri) JSON metni olarak yazılır (kural: guvenlik/firestore.rules →
     MÜDÜR PRİM SİSTEMLERİ).
   • Sayfa türü başlık satırından anlaşılır (sayfa adı serbesttir):
       ozet       : Marka + Müdür (+ Hak Ediş Kriterleri) — ay sütunu yok        → "Prim Sistemleri"
       marka      : GEREKÇE ya da tam ay adları (OCAK … ARALIK)                    → marka sayfaları (CİTROEN, OPEL…)
       hakedis    : kısa ay adları (Oca … Ara) + "Yıllık Hak Ediş Oranı"           → "2026 Hak Ediş"
       hakedisTL  : aynısı, sayfa adında "TL" geçer                               → "2026 Hak Ediş TL"
       detay      : Konu + Açıklama                                               → "Detaylar"
       kazanc     : Adı Soyadı + Maaş + Prim (Müdür sütunu yok)                    → maaş + prim kazanç tablosu (ayrı dosya olabilir)
     TC Kimlik No sütunu HİÇBİR tabloda okunmaz; kazanç tablosunda Excel'de gizli sütunlar da alınmaz.
     Başlık satırında "Müdür" olmayan sayfalar (Grafik, Listeler…) atlanır.
   • Satır = "Müdür" hücresi dolu satır. Başlığın solundaki sütun (ör. A: "DİSTRİBÜTÖR PRİMLERİ", "İÇ PRİM") satırın
     grubu olur ve aşağı doğru geçerlidir. Tablonun hemen altındaki (en çok 3 satır) metinler sayfa notu olarak alınır.
   ============================================================================ */

export const MODEL_SURUM = 1;
export const AYLAR_UZUN = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
export const AYLAR_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const XLSX_JS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
/** Firestore belgesine yazılacak JSON metninin üst sınırı (kural da aynı sınırı uygular; 1 MiB belge sınırının güvenli altı) */
export const JSON_SINIR = 600000;

/** Türkçe katlama: büyük harf, İ/Ş/Ğ/Ü/Ö/Ç → I/S/G/U/O/C, fazla boşluk tek boşluk. "CİTROEN" = "Citroen" = "CITROEN" */
export function katla(s) {
  return String(s == null ? '' : s).toLocaleUpperCase('tr')
    .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}
const AY_UZUN_K = AYLAR_UZUN.map(katla);
const AY_KISA_K = AYLAR_KISA.map(katla);
/** Başlık bir ay sütunu mu? → { ay: 0-11, uzun: bool } | null */
export function ayBasligi(ad) {
  const k = katla(ad);
  let i = AY_UZUN_K.indexOf(k); if (i >= 0) return { ay: i, uzun: true };
  i = AY_KISA_K.indexOf(k); if (i >= 0) return { ay: i, uzun: false };
  return null;
}

/** Aylık durum metni → 'tuttu' | 'tutmadi' | 'sayilmaz' | 'diger' | '' */
export function durumSinifi(m) {
  const k = katla(m);
  if (!k) return '';
  if (k === 'TUTTU') return 'tuttu';
  if (k === 'TUTMADI') return 'tutmadi';
  if (k.indexOf('SAYILMAZ') >= 0) return 'sayilmaz';
  return 'diger';
}

const trSayi = (n, f = 2) => (+n).toLocaleString('tr-TR', { maximumFractionDigits: f });
/** Sayı biçiminin 3. bölümü boşsa (ör. "0;-0;;@") Excel sıfırı göstermez */
const sifirGizli = (z) => /^[^;]*;[^;]*;;/.test(String(z || ''));

/** SheetJS hücresi → { m: ekranda görünen metin, n: sayı|null, hata: bool } */
export function hucreDegeri(XLSX, c) {
  if (!c) return { m: '', n: null, hata: false };
  if (c.t === 'e') return { m: '', n: null, hata: true };
  if (c.t === 'n') {
    const v = +c.v, z = String(c.z || '');
    if (!isFinite(v)) return { m: '', n: null, hata: true };
    if (/%/.test(z)) return { m: '%' + trSayi(v * 100), n: v, hata: false };
    if (v === 0 && sifirGizli(z)) return { m: '', n: 0, hata: false };
    let tarihMi = false;
    try { tarihMi = !!(z && XLSX && XLSX.SSF && XLSX.SSF.is_date(z)); } catch (e) { tarihMi = false; }
    if (tarihMi) {
      /* tarih Türkçe GG.AA.YYYY (Excel'in yerel biçim kodu dosyada ABD biçimiyle saklanabilir) */
      try { const d = XLSX.SSF.parse_date_code(v); if (d && d.y) return { m: String(d.d).padStart(2, '0') + '.' + String(d.m).padStart(2, '0') + '.' + d.y, n: v, hata: false }; } catch (e) { /* aşağıya */ }
      return { m: String(c.w || ''), n: null, hata: false };
    }
    /* ondalık hane sayısı ve tırnaklı sonek (ör. 0,0 "AY") biçim kodundan: Excel'de görünen metinle aynı olsun */
    const ilk = z.split(';')[0];
    const ond = ((/\.(0+)/.exec(ilk.replace(/"[^"]*"/g, '')) || [])[1] || '').length;
    const ek = ((/"([^"]+)"\s*$/.exec(ilk) || [])[1] || '').trim();
    const m = ond ? v.toLocaleString('tr-TR', { minimumFractionDigits: ond, maximumFractionDigits: ond }) : trSayi(v);
    return { m: ek ? m + ' ' + ek : m, n: v, hata: false };
  }
  if (c.t === 'b') return { m: c.v ? 'DOĞRU' : 'YANLIŞ', n: null, hata: false };
  if (c.t === 'd') { const d = c.v instanceof Date ? c.v : new Date(c.v); return { m: isNaN(d) ? String(c.w || '') : d.toLocaleDateString('tr-TR'), n: null, hata: false }; }
  return { m: String(c.v == null ? '' : c.v).replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim(), n: null, hata: false };
}

/* kazanç tablosu (maaş + prim): anahtar sütun "Adı Soyadı" */
const AD_SOYAD = ['ADI SOYADI', 'AD SOYAD', 'ADI SOYAD', 'AD SOYADI', 'AD-SOYAD', 'ADI-SOYADI', 'PERSONEL'];
const anahtarBaslik = (k) => k === 'MUDUR' || AD_SOYAD.indexOf(k) >= 0;
/** TC Kimlik No sütunu: HİÇBİR tabloda okunmaz, saklanmaz, gösterilmez */
export function tcBasligi(ad) {
  const k = katla(ad).replace(/[.\s]/g, '');
  return k === 'TC' || k === 'TCNO' || k.indexOf('KIMLIK') >= 0 || k === 'TCKN';
}
/** Sayfa türü (başlık adlarından) */
export function sayfaTuru(sayfaAdi, basliklar) {
  const k = basliklar.map(katla);
  if (k.indexOf('MUDUR') < 0 && k.some((x) => AD_SOYAD.indexOf(x) >= 0)) {
    return k.some((x) => x.indexOf('MAAS') >= 0) && k.some((x) => x.indexOf('PRIM') >= 0) ? 'kazanc' : null;
  }
  if (k.indexOf('MUDUR') < 0) return null;
  const ay = basliklar.map(ayBasligi).filter(Boolean);
  const uzun = ay.filter((a) => a.uzun).length, kisa = ay.filter((a) => !a.uzun).length;
  if (k.indexOf('KONU') >= 0 && k.indexOf('ACIKLAMA') >= 0) return 'detay';
  if (kisa >= 6 && k.some((x) => x.indexOf('YILLIK HAK EDIS') >= 0)) return /(^|[^A-Z])TL([^A-Z]|$)/.test(katla(sayfaAdi)) ? 'hakedisTL' : 'hakedis';
  if (uzun >= 6 || k.indexOf('GEREKCE') >= 0) return 'marka';
  if (k.indexOf('MARKA') >= 0) return 'ozet';
  return null;
}

/** Bir çalışma sayfasını tabloya çevirir → { sayfa, tur, baslik, aciklama, sutunlar[], satirlar[{ g, h[], n[] }], notlar[], uyarilar[] } | null */
export function sayfaOku(XLSX, ws, sayfaAdi) {
  if (!ws || !ws['!ref']) return null;
  const R = XLSX.utils.decode_range(ws['!ref']);
  const hucre = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
  const deger = (r, c) => hucreDegeri(XLSX, hucre(r, c));
  /* başlık satırı: ilk 25 satırda "Müdür" (prim tabloları) ya da "Adı Soyadı" (kazanç tablosu) hücresi olan satır */
  let hr = -1;
  for (let r = R.s.r; r <= Math.min(R.e.r, R.s.r + 25) && hr < 0; r++) {
    for (let c = R.s.c; c <= R.e.c; c++) { if (anahtarBaslik(katla(deger(r, c).m))) { hr = r; break; } }
  }
  if (hr < 0) return null;
  let bas = [];
  for (let c = R.s.c; c <= R.e.c; c++) { const t = deger(hr, c).m.replace(/\s+/g, ' ').trim(); if (t) bas.push({ c, ad: t }); }
  const tur = sayfaTuru(sayfaAdi, bas.map((b) => b.ad));
  if (!tur) return null;
  /* TC sütunu hiçbir zaman alınmaz; kazanç tablosunda Excel'de gizli sütunlar da alınmaz (olduğu gibi) */
  const tcAtlanan = bas.filter((b) => tcBasligi(b.ad)).map((b) => b.ad);
  const gizliKol = (c) => !!(ws['!cols'] && ws['!cols'][c] && ws['!cols'][c].hidden);
  const gizliSutun = tur === 'kazanc' ? bas.filter((b) => !tcBasligi(b.ad) && gizliKol(b.c)).map((b) => b.ad) : [];
  bas = bas.filter((b) => !tcBasligi(b.ad) && !(tur === 'kazanc' && gizliKol(b.c)));
  if (!bas.length) return null;
  const ilkC = bas[0].c, sonC = bas[bas.length - 1].c;
  const anahtar = bas.find((b) => anahtarBaslik(katla(b.ad)));
  if (!anahtar) return null;
  const mudurC = anahtar.c;
  /* satırın Excel'deki kırmızı işareti (anahtar hücrenin dolgusu; SheetJS cellStyles) */
  const kirmizi = (x) => {
    const f = x && x.s && x.s.fgColor; const rgb = f && typeof f.rgb === 'string' ? f.rgb.slice(-6) : '';
    if (!/^[0-9a-f]{6}$/i.test(rgb) || (x.s.patternType && x.s.patternType !== 'solid')) return false;
    const r = parseInt(rgb.slice(0, 2), 16), g = parseInt(rgb.slice(2, 4), 16), b = parseInt(rgb.slice(4, 6), 16);
    return r >= 190 && g <= 110 && b <= 110;
  };
  /* başlık ve açıklama: başlık satırının üstündeki ilk iki dolu satır */
  const ust = [];
  for (let r = R.s.r; r < hr && ust.length < 2; r++) {
    for (let c = R.s.c; c <= R.e.c; c++) { const t = deger(r, c).m; if (t) { ust.push(t); break; } }
  }
  /* grup sütunu (başlığın solu). Birleştirilmiş hücre kullanılmışsa grup YALNIZ o birleşik alanın içinde geçerlidir
     (alan dışındaki boş hücre = grup yazılmamış); hiç birleşik hücre yoksa etiket aşağı doğru geçerli sayılır. */
  const birlesik = (ws['!merges'] || []).filter((m) => m.e.c < ilkC && m.e.r > hr);   /* yalnız grup sütununun kendi birleşik alanları (A11:K11 gibi not birleşimleri değil) */
  const grupHucresi = (r) => {
    for (let c = R.s.c; c < ilkC; c++) {
      let t = deger(r, c).m;
      if (!t) { const m = birlesik.find((x) => r >= x.s.r && r <= x.e.r && c >= x.s.c && c <= x.e.c); if (m) t = deger(m.s.r, m.s.c).m; }
      if (t) return t;
    }
    return '';
  };
  const satirlar = [], uyarilar = [];
  const yer = (r) => sayfaAdi + ' sayfası ' + (r + 1) + '. satır';
  let sonVeri = hr, grup = '', bosSeri = 0;
  for (let r = hr + 1; r <= R.e.r; r++) {
    const mudur = deger(r, mudurC).m;
    const g = grupHucresi(r);
    if (!mudur) {
      const dolu = bas.map((b) => hucre(r, b.c)).filter((c) => c && (c.t === 'e' || String(c.v == null ? '' : c.v).trim() !== ''));
      if (!dolu.length && !g) { if (++bosSeri >= 3 && satirlar.length) break; continue; }
      bosSeri = 0;
      /* tablonun içinde ya da hemen altında: numarası / metni olup müdürü yazılmamış satır alınmaz, uyarılır */
      const metin = dolu.filter((c) => c.t === 's' || c.t === 'str').length;
      const numara = dolu.some((c) => c.t === 'n');
      if (satirlar.length && (metin >= 2 || (numara && dolu.length >= 2)) && r <= sonVeri + 3) uyarilar.push(yer(r) + ': ' + (tur === 'kazanc' ? 'ad soyad' : 'müdür adı') + ' yazılmamış, satır alınmadı.');
      continue;
    }
    bosSeri = 0;
    grup = birlesik.length ? g : (g || grup);
    const h = [], n = [];
    bas.forEach((b) => {
      const d = deger(r, b.c); h.push(d.m); n.push(d.n);
      if (d.hata) uyarilar.push(yer(r) + ', "' + b.ad + '" hücresinde Excel hatası var (boş gösterilir).');
    });
    const satir = { g: grup, h, n };
    if (tur === 'kazanc' && kirmizi(hucre(r, mudurC))) satir.isaret = 'kirmizi';
    satirlar.push(satir);
    sonVeri = r;
  }
  /* sayfa notları: tablonun hemen altındaki 3 satırdaki metinler (grup sütunu dahil) */
  const notlar = [];
  for (let r = sonVeri + 1; r <= Math.min(R.e.r, sonVeri + 3); r++) {
    const parca = [];
    for (let c = R.s.c; c <= sonC; c++) {
      const x = hucre(r, c);
      if (x && (x.t === 's' || x.t === 'str')) { const t = String(x.v).replace(/\s+/g, ' ').trim(); if (t.length >= 3) parca.push(t); }
    }
    if (parca.length) notlar.push(parca.join(' · '));
  }
  const t = { sayfa: sayfaAdi, tur, baslik: ust[0] || '', aciklama: ust[1] || '', sutunlar: bas.map((b) => b.ad), satirlar, notlar, uyarilar };
  if (tcAtlanan.length) t.tcAtlandi = true;                       /* yalnız işaret: değerleri hiç okunmadı */
  if (gizliSutun.length) t.gizliSutun = gizliSutun;
  return t;
}

/** Çalışma kitabı → model { surum, dosya, okunma, tablolar[], atlanan[] (görünür ama tablo değil), gizli[] (Excel'de gizli
    sayfalar: "olduğu gibi" kuralı gereği portala ALINMAZ), uyarilar[] } */
export function kitapOku(XLSX, wb, dosya) {
  const tablolar = [], atlanan = [], gizliler = [], uyarilar = [];
  (wb.SheetNames || []).forEach((ad) => {
    const ws = wb.Sheets[ad];
    const gizli = !!(wb.Workbook && wb.Workbook.Sheets && (wb.Workbook.Sheets.find((s) => s.name === ad) || {}).Hidden);
    if (gizli) { gizliler.push(ad); return; }
    let t = null;
    try { t = sayfaOku(XLSX, ws, ad); } catch (e) { uyarilar.push(ad + ': okunamadı (' + (e && e.message ? e.message : e) + ')'); }
    if (!t) { atlanan.push(ad); return; }
    if (!t.satirlar.length && t.tur !== 'detay' && t.tur !== 'hakedisTL') uyarilar.push(ad + ': tabloda satır yok.');
    t.uyarilar.forEach((u) => uyarilar.push(u));
    delete t.uyarilar;
    tablolar.push(t);
  });
  return { surum: MODEL_SURUM, dosya: String(dosya || ''), okunma: new Date().toISOString(), tablolar, atlanan, gizli: gizliler, uyarilar };
}
/** Excel'de görünür bir "Grafik" sayfası var mı (portal grafiği yalnız o zaman çizer; gizliyse çizmez — olduğu gibi) */
export function grafikGorunur(m) { return !!(m && Array.isArray(m.atlanan) && m.atlanan.some((s) => katla(s).indexOf('GRAFIK') >= 0)); }

export const PRIM_TURLERI = ['ozet', 'marka', 'hakedis', 'hakedisTL', 'detay'];
const primVar = (m) => !!(m && Array.isArray(m.tablolar) && m.tablolar.some((t) => (t.tur === 'ozet' || t.tur === 'marka') && Array.isArray(t.satirlar) && t.satirlar.length));
const kazancVar = (m) => !!(m && Array.isArray(m.tablolar) && m.tablolar.some((t) => t.tur === 'kazanc' && Array.isArray(t.satirlar) && t.satirlar.length));
/** Modelin kullanılabilir olup olmadığı (prim tabloları ya da kazanç tablosu) */
export function modelGecerli(m) {
  return !!(m && m.surum === MODEL_SURUM && Array.isArray(m.tablolar) && (primVar(m) || kazancVar(m)));
}
/** Yeni okunan dosyayı portaldaki veriyle birleştirir: prim çalışma kitabı yalnız prim kısmını, kazanç (maaş + prim) dosyası
    yalnız kazanç kısmını değiştirir; diğer kısım korunur. → { model, primYeni, kazancYeni } */
export function modelBirlestir(eski, yeni) {
  const primYeni = primVar(yeni), kazancYeni = kazancVar(yeni);
  const e = eski && Array.isArray(eski.tablolar) ? eski : null;
  const kaynak = (m, tur) => (m && m.kaynaklar && m.kaynaklar[tur]) || (m && tur === 'prim' && primVar(m) ? { dosya: m.dosya || '', okunma: m.okunma || '' } : null);
  const ePrim = e ? e.tablolar.filter((t) => PRIM_TURLERI.indexOf(t.tur) >= 0) : [], eKaz = e ? e.tablolar.filter((t) => t.tur === 'kazanc') : [];
  const model = {
    surum: MODEL_SURUM, dosya: yeni.dosya, okunma: yeni.okunma,
    tablolar: (primYeni ? yeni.tablolar.filter((t) => PRIM_TURLERI.indexOf(t.tur) >= 0) : ePrim).concat(kazancYeni ? yeni.tablolar.filter((t) => t.tur === 'kazanc') : eKaz),
    atlanan: primYeni ? yeni.atlanan : (e && e.atlanan) || [], gizli: primYeni ? yeni.gizli : (e && e.gizli) || [], uyarilar: primYeni ? yeni.uyarilar : (e && e.uyarilar) || [],
    kaynaklar: { prim: primYeni ? { dosya: yeni.dosya, okunma: yeni.okunma } : kaynak(e, 'prim'), kazanc: kazancYeni ? { dosya: yeni.dosya, okunma: yeni.okunma } : kaynak(e, 'kazanc') }
  };
  return { model, primYeni, kazancYeni };
}

/** SheetJS'i bir kez yükler (cdnjs) */
let XLSX_YUK = null;
export function xlsxYukle() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!XLSX_YUK) {
    XLSX_YUK = new Promise((ok, no) => {
      const s = document.createElement('script');
      /* bütünlük özeti ik.html ile aynı (aynı dosya, aynı sürüm) */
      s.src = XLSX_JS; s.async = true; s.crossOrigin = 'anonymous';
      s.integrity = 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw';
      s.onload = () => (window.XLSX ? ok(window.XLSX) : no(new Error('Excel okuyucu yüklenemedi')));
      s.onerror = () => { XLSX_YUK = null; no(new Error('Excel okuyucu yüklenemedi (internet bağlantısını kontrol edin)')); };
      document.head.appendChild(s);
    });
  }
  return XLSX_YUK;
}

/** Dosya (File/ArrayBuffer) → model */
export async function dosyaOku(dosya) {
  const XLSX = await xlsxYukle();
  const buf = dosya instanceof ArrayBuffer ? dosya : await dosya.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellNF: true, cellText: true, cellDates: false, cellFormula: false, cellStyles: true });   /* cellStyles: gizli sütunlar (!cols) ve kırmızı satır işareti için */
  return kitapOku(XLSX, wb, dosya && dosya.name ? dosya.name : '');
}
