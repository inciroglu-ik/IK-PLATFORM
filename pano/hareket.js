/* ==========================================================================
   pano/hareket.js — PERSONEL HAREKETLERİ (işe giriş / işten çıkış) MOTORU
   Firebase IMPORT ETMEZ; saf hesaptır. Haftalık paket (Excel'in resmî verisi) + İK'nın panodan girdiği
   hareketler → güncel D ve MONTHLY_HC. Kurallar kullanıcı onayıyla (24.10.2026) — ayrıntı pano/KABUK.md §8.

   İLKELER
   • Excel resmî kaynaktır. Hareket yokken paket AYNEN gösterilir (hiçbir şey yeniden hesaplanmaz).
   • Hareket varsa Excel'in kendi formülleri, Excel'in sayıları TABAN alınarak uygulanır (TURNOVER R sayfası):
       YTD turnover   = (çıkış − V.İ. çıkışı) ÷ ((Ocak personeli + güncel personel) ÷ 2)
       Yıl sonu sim.  = YTD ÷ hafta no × 52            (hafta no: içinde bulunulan ISO hafta)
       İstenen/istenmeyen YTD aynı payda ile; taban kişi sayıları Excel'deki orandan geri çözülür.
   • Haftalık paket yüklenince Excel'e işlenmiş hareketler kendiliğinden "pakette" sayılır, iki kez uygulanmaz:
       çıkış → kişi paketin aktif listelerinde yoksa · giriş → kişi paketin aktif listelerinde (ya da
       giriş tarihinden sonra ayrılanlarda) varsa.
   • Turnover ve ayrılanlara yalnız tam zamanlı personel girer; stajyer / analist öğrenci / V.İ. kendi sayısından
     düşer (V.İ. çıkışı TURNOVER "İşten Çıkan" sütununa girer ama turnover payına girmez — Excel'deki gibi).
   • Kapanmış ayların ay sonu kadro sayıları değişmez; yalnız içinde bulunulan ayınki güncel personele eşitlenir.
   ========================================================================== */
import * as O from './ortak.js';

/** Aktif listeler ve ekrandaki adları */
export const LISTE_AD = { normal: 'Tam zamanlı', stajyer: 'Stajyer', gecici: 'Analist öğrenci', vi: 'V.İ.' };
const LISTELER = ['normal', 'stajyer', 'gecici', 'vi'];
/** Listeye göre ozet sayacı (Excel DASHBOARD D6–D9) */
const SAYAC = { normal: 'personel_mevcudu', stajyer: 'stajyer_sayisi', gecici: 'analist_sayisi', vi: 'vi_sayisi' };
/** Resmî (SGK) ayrılış nedenleri — paketteki neden değerleriyle aynı yazım */
export const RESMI_NEDENLER = ['İstifa', 'İşveren Feshi', 'Deneme (İşveren)', 'Deneme (İşçi)', 'Askerlik', '25. Madde', 'Emeklilik', 'Belirli Süreli', 'Diğer'];
/** Arabuluculuk yapılmadı nedenleri (paketteki not_ değerleri) */
export const ARB_NEDENLER = ['6 AY ALTI KIDEM', 'ASKERLİK SEBEBİYLE', 'HAKLI FESİH', 'İHTAR', 'DİĞER'];

const kopya = (o) => JSON.parse(JSON.stringify(o));
const yuv2 = (n) => Math.round(n * 100) / 100;
const iki = (n) => String(n).padStart(2, '0');
export const anahtar = (ad) => O.aramaAnahtari(ad);
export const istenenMi = (neden) => O.ISTENEN_NED.indexOf(neden) >= 0;
/** Date → "GG.AA.YYYY" (paketin tarih biçimi) */
export const tarihMetni = (d) => iki(d.getDate()) + '.' + iki(d.getMonth() + 1) + '.' + d.getFullYear();
const gunBasi = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const gunFarki = (a, b) => Math.round((gunBasi(b) - gunBasi(a)) / 86400000);

/** ISO hafta numarası (Pazartesi başlangıçlı) → { yil, hafta } */
export function isoHafta(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const g = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - g);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { yil: t.getUTCFullYear(), hafta: Math.ceil(((t - y0) / 86400000 + 1) / 7) };
}
/** Paketin veri tarihi: etiket.short "12.10.2026 - 18.10.2026" → son gün (yoksa null) */
export function paketTarihi(etiket) {
  const m = String((etiket && etiket.short) || '').match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*$/);
  return m ? O.tarihCoz(m[1]) : null;
}
/** Paketin hafta numarası: etiket.hafta "42. Hafta" → 42 */
export function paketHaftasi(etiket) {
  const m = String((etiket && (etiket.hafta || etiket.label)) || '').match(/(\d{1,2})\.\s*Hafta/i);
  return m ? +m[1] : null;
}
/** İki tarih arası takvim farkı → { yil, ay, gun, toplam } */
export function takvimFarki(bas, son) {
  let y = son.getFullYear() - bas.getFullYear(), a = son.getMonth() - bas.getMonth(), g = son.getDate() - bas.getDate();
  if (g < 0) { a--; g += new Date(son.getFullYear(), son.getMonth(), 0).getDate(); }
  if (a < 0) { y--; a += 12; }
  return { yil: Math.max(0, y), ay: Math.max(0, a), gun: Math.max(0, g), toplam: Math.max(0, gunFarki(bas, son)) };
}
/** Paketteki "sure" biçimi: "X yıl Y ay Z gün / N gün" */
export const sureMetni = (f) => f.yil + ' yıl ' + f.ay + ' ay ' + f.gun + ' gün / ' + f.toplam + ' gün';
/** Arabuluculuk kıdem aralığı (paketteki değerlerle aynı yazım) */
export function kidemAraligi(f) {
  const ay = f.yil * 12 + f.ay;
  if (ay < 2) return '0-2 AY';
  if (ay < 6) return '2-6 AY';
  if (ay < 12) return '6 AY-1 YIL';
  if (f.yil < 2) return '1-2 YIL';
  if (f.yil < 3) return '2-3 YIL';
  if (f.yil < 5) return '3-5 YIL';
  if (f.yil < 10) return '5-10 YIL';
  return '10 YIL ÜZERİ';
}

/** Kişiyi aktif listelerde bulur → { liste, i, kayit } | null */
export function aktifBul(D, ad) {
  const k = anahtar(ad);
  for (const l of LISTELER) {
    const a = (D && D[l]) || [];
    for (let i = 0; i < a.length; i++) if (a[i] && anahtar(a[i].ad) === k) return { liste: l, i, kayit: a[i] };
  }
  return null;
}
/** Kişinin işe giriş tarihi: paket tarihi − kidem_gun (bilinmiyorsa null) */
export function iseGirisTahmini(kayit, etiket) {
  const pt = paketTarihi(etiket);
  if (!pt || !kayit || kayit.kidem_gun === null || kayit.kidem_gun === undefined || isNaN(+kayit.kidem_gun)) return null;
  return new Date(pt.getFullYear(), pt.getMonth(), pt.getDate() - +kayit.kidem_gun);
}

/* --------------------------------------------------------------------------
   UYGULA
   -------------------------------------------------------------------------- */
const sirala = (a, b) => {
  const ta = O.tarihSirasi(a.tarih) || 0, tb = O.tarihSirasi(b.tarih) || 0;
  return ta - tb || String((a.kayit && a.kayit.zaman) || '').localeCompare(String((b.kayit && b.kayit.zaman) || ''));
};

/**
 * Paket + hareketler → güncel veri.
 * @param paket { D, MONTHLY_HC, etiket }  (değiştirilmez)
 * @param hareketler kayıt dizisi (Firestore'daki `hareketler`)
 * @param secenek { bugun: Date, zorla: bool — hareket olmasa da oranları güncel haftayla yeniden hesapla (önizleme tabanı) }
 * @returns { D, MONTHLY_HC, durum: {id: {durum, not}}, uygulanan, pakette, iptal, sorunlu, yeniden }
 */
export function uygula(paket, hareketler, secenek = {}) {
  const bugun = secenek.bugun || new Date();
  const P = paket.D, D = kopya(P), MH = paket.MONTHLY_HC ? kopya(paket.MONTHLY_HC) : null;
  const oz = D.ozet = Object.assign({}, P.ozet);
  const durum = {};
  const say = { uygulanan: 0, pakette: 0, iptal: 0, sorunlu: 0 };
  const d = { cikis: 0, istenen: 0, istenmeyen: 0, giris: 0, kidemCik: [], kidemEkle: [], maxAy: 0 };
  const pHafta = paketHaftasi(paket.etiket), pTarih = paketTarihi(paket.etiket);
  const pYil = pTarih ? pTarih.getFullYear() : 2026;
  const uygulananGiris = new Set();
  const turnoverSatiri = (ay) => (D.turnover || []).find((t) => t && String(t.donem) === pYil + '-' + iki(ay));
  const oranGuncelle = (t) => { if (!t) return; const pay = +t.calisan_asil || 0; if (pay > 0) t.oran_asil = yuv2(t.cikis_asil / pay * 100); };
  const ayniHafta = (tarih) => { const h = isoHafta(tarih); return pHafta && h.hafta === pHafta && h.yil === pYil; };

  (hareketler || []).slice().sort(sirala).forEach((h) => {
    if (!h || !h.id) return;
    if (h.iptal) { durum[h.id] = { durum: 'iptal' }; say.iptal++; return; }
    const tarih = O.tarihCoz(h.tarih);
    if (!tarih || !h.ad) { durum[h.id] = { durum: 'sorunlu', not: 'Tarih ya da ad okunamadı' }; say.sorunlu++; return; }
    const ay = tarih.getMonth() + 1, k = anahtar(h.ad);

    if (h.tur === 'cikis') {
      const paketteAktif = !!aktifBul(P, h.ad);
      if (!paketteAktif && !uygulananGiris.has(k)) { durum[h.id] = { durum: 'pakette' }; say.pakette++; return; }
      const b = aktifBul(D, h.ad);
      if (!b) { durum[h.id] = { durum: 'sorunlu', not: 'Kişi aktif listede bulunamadı (zaten çıkışı girilmiş olabilir)' }; say.sorunlu++; return; }
      D[b.liste].splice(b.i, 1);
      oz[SAYAC[b.liste]] = (+oz[SAYAC[b.liste]] || P[b.liste].length) - 1;
      if (b.liste === 'normal') {
        const ist = istenenMi(h.neden);
        D.ayrilanlar.push({ ad: b.kayit.ad, dept: b.kayit.dept, bolum: b.kayit.bolum, unvan: b.kayit.unvan, tarih: tarihMetni(tarih),
          neden: h.neden || 'Diğer', neden_raw: h.neden_raw || '', sure: h.sure || '', istenen: ist, ay, aciklama: h.aciklama || '', hareket: h.id });
        d.cikis++; if (ist) d.istenen++; else d.istenmeyen++;
        d.maxAy = Math.max(d.maxAy, ay);
        const t = turnoverSatiri(ay); if (t) { t.cikis = (+t.cikis || 0) + 1; t.cikis_asil = (+t.cikis_asil || 0) + 1; oranGuncelle(t); }
        if (ayniHafta(tarih)) oz.hafta_cikis = (+oz.hafta_cikis || 0) + 1;
        if (b.kayit.kidem_gun !== null && b.kayit.kidem_gun !== undefined) d.kidemCik.push(+b.kayit.kidem_gun);
      } else if (b.liste === 'vi') {
        const t = turnoverSatiri(ay); if (t) t.cikis = (+t.cikis || 0) + 1;   /* V.İ.: "İşten Çıkan"a girer, turnover payına girmez */
      }
      /* İzin: kişi listeden çıkar; kalan bakiyesi hareket kaydında saklıdır */
      const iz = (D.izin || []).findIndex((x) => x && anahtar(x.ad) === k);
      if (iz >= 0) { const bk = D.izin[iz].bakiye; D.izin.splice(iz, 1); if (bk !== null && bk !== undefined && oz.yillik_izin_bakiye !== undefined) oz.yillik_izin_bakiye = yuv2(+oz.yillik_izin_bakiye - +bk); }
      /* Arabuluculuk (girildiyse) */
      if (h.arabulucu && Array.isArray(D.arabuluculuk)) {
        D.arabuluculuk.push({ ad: b.kayit.ad, unvan: b.kayit.unvan, dept: b.kayit.dept, bolum: b.kayit.bolum, giris: h.iseGiris || '', cikis: tarihMetni(tarih),
          sure: h.kidemAraligi || '', neden: h.aciklama || '', sebep: h.neden || '', arabulucu: h.arabulucu,
          not_: h.arabulucu === 'YAPILDI' ? 'YAPILDI' : (h.not_ || 'DİĞER'), risk: h.risk || 'Risk Yok', ay: String(ay), hareket: h.id });
      }
      durum[h.id] = { durum: 'uygulandi' }; say.uygulanan++;
      return;
    }

    if (h.tur === 'giris') {
      const ayrildiSonra = (P.ayrilanlar || []).some((x) => x && anahtar(x.ad) === k && (O.tarihSirasi(x.tarih) || 0) >= tarih.getTime());
      if (aktifBul(P, h.ad) || ayrildiSonra) { durum[h.id] = { durum: 'pakette' }; say.pakette++; return; }
      if (aktifBul(D, h.ad)) { durum[h.id] = { durum: 'sorunlu', not: 'Bu adla aktif bir kayıt zaten var' }; say.sorunlu++; return; }
      const liste = LISTELER.indexOf(h.liste) >= 0 ? h.liste : 'normal';
      const kayit = { ad: h.ad, dept: liste === 'vi' ? 'V.İ.' : h.dept, bolum: h.bolum, unvan: h.unvan, cs: liste === 'stajyer' ? 'Stajyer' : 'Tam zamanlı' };
      const kg = Math.max(0, gunFarki(tarih, bugun));
      if (liste === 'normal') kayit.kidem_gun = kg;
      D[liste].push(kayit);
      oz[SAYAC[liste]] = (+oz[SAYAC[liste]] || P[liste].length) + 1;
      if (liste === 'normal') {
        D.isealim.push({ ad: h.ad, dept: h.dept, bolum: h.bolum, unvan: h.unvan, tarih: tarihMetni(tarih), ay, hareket: h.id });
        d.giris++; d.maxAy = Math.max(d.maxAy, ay); d.kidemEkle.push(kg);
        const t = turnoverSatiri(ay); if (t) t.giris = (+t.giris || 0) + 1;
        if (ayniHafta(tarih)) oz.hafta_giris = (+oz.hafta_giris || 0) + 1;
        if (Array.isArray(D.izin)) D.izin.push({ ad: h.ad, dept: h.dept, bolum: h.bolum, bakiye: 0, kullanilan: 0 });
      }
      uygulananGiris.add(k);
      durum[h.id] = { durum: 'uygulandi' }; say.uygulanan++;
      return;
    }
    durum[h.id] = { durum: 'sorunlu', not: 'Bilinmeyen hareket türü' }; say.sorunlu++;
  });

  const yeniden = say.uygulanan > 0 || !!secenek.zorla;
  if (yeniden) {
    const po = P.ozet || {};
    oz.ytd_cikis = (+po.ytd_cikis || P.ayrilanlar.length) + d.cikis;
    oz.ytd_giris = (+po.ytd_giris || P.isealim.length) + d.giris;
    oz.istenen_count = (+po.istenen_count || 0) + d.istenen; oz.istened_count = oz.istenen_count;
    oz.istenmeyen_count = (+po.istenmeyen_count || 0) + d.istenmeyen;
    oz.toplam_kayit = ['personel_mevcudu', 'stajyer_sayisi', 'analist_sayisi', 'vi_sayisi'].reduce((s, x) => s + (+oz[x] || 0), 0);
    if (d.maxAy > (+oz.ay_sayisi || 0)) oz.ay_sayisi = d.maxAy;
    if (po.ort_cikis_ay !== undefined && po.ort_cikis_ay !== null && +oz.ay_sayisi) oz.ort_cikis_ay = Math.round((+po.ort_cikis_ay + d.cikis / +oz.ay_sayisi) * 10) / 10;
    /* Turnover: Excel formülü, Excel'in sayıları taban */
    const hc0 = MH && Array.isArray(MH.y2026) ? +MH.y2026[0] : 0;
    if (hc0 > 0 && po.ytd_turnover !== undefined && po.ytd_turnover !== null && +po.personel_mevcudu) {
      const ort0 = (hc0 + +po.personel_mevcudu) / 2, ort1 = (hc0 + +oz.personel_mevcudu) / 2;
      const taban = (v) => (v === undefined || v === null || isNaN(+v)) ? null : Math.round(+v / 100 * ort0);
      const N0 = taban(po.ytd_turnover), I0 = taban(po.ytd_istenen), M0 = taban(po.ytd_istenmeyen);
      const hb = isoHafta(bugun);
      const hafta = Math.max(1, hb.yil === pYil ? Math.max(hb.hafta, pHafta || 1) : (pHafta || hb.hafta));
      const oran = (n) => yuv2(n / ort1 * 100), sim = (v) => yuv2(v / hafta * 52);
      oz.ytd_turnover = oran(N0 + d.cikis); oz.simule_yilsonu = sim(oz.ytd_turnover);
      if (I0 !== null) { oz.ytd_istenen = oran(I0 + d.istenen); oz.simule_istenen = sim(oz.ytd_istenen); oz.ytd_istened = oz.ytd_istenen; oz.simule_istened = oz.simule_istenen; }
      if (M0 !== null) { oz.ytd_istenmeyen = oran(M0 + d.istenmeyen); oz.simule_istenmeyen = sim(oz.ytd_istenmeyen); }
      oz.hesap_haftasi = hafta;
    }
    /* Şirket ortalama kıdemi: Excel değeri taban, çıkan/giren kişinin kıdemi ortalamadan çıkar/eklenir */
    const n0 = (P.normal || []).filter((x) => x && x.kidem_gun !== null && x.kidem_gun !== undefined).length;
    if (po.sirket_kidemi !== undefined && po.sirket_kidemi !== null && n0) {
      const n1 = n0 - d.kidemCik.length + d.kidemEkle.length;
      const top = +po.sirket_kidemi * n0 - d.kidemCik.reduce((s, x) => s + x, 0) / 365 + d.kidemEkle.reduce((s, x) => s + x, 0) / 365;
      if (n1 > 0) oz.sirket_kidemi = yuv2(top / n1);
    }
    /* İçinde bulunulan ayın kadrosu (doluysa) güncel personele eşitlenir; kapanmış aylar değişmez */
    const ayNo = bugun.getMonth() + 1;
    if (bugun.getFullYear() === pYil && MH && Array.isArray(MH.y2026) && MH.y2026[ayNo - 1] !== null && MH.y2026[ayNo - 1] !== undefined) MH.y2026[ayNo - 1] = +oz.personel_mevcudu;
    const tb = turnoverSatiri(ayNo);
    if (bugun.getFullYear() === pYil && tb && +tb.calisan_asil > 0 && !(+tb.calisan > 0)) { tb.calisan_asil = +oz.personel_mevcudu; oranGuncelle(tb); }
  }
  return Object.assign({ D, MONTHLY_HC: MH, durum, yeniden }, say);
}

/** Ekranda gösterilen ana göstergeler (önizleme karşılaştırması için) */
export function gostergeler(D) {
  const oz = (D && D.ozet) || {};
  return {
    personel: +oz.personel_mevcudu || 0, stajyer: +oz.stajyer_sayisi || 0, analist: +oz.analist_sayisi || 0, vi: +oz.vi_sayisi || 0,
    cikis: +oz.ytd_cikis || 0, giris: +oz.ytd_giris || 0, turnover: oz.ytd_turnover, simule: oz.simule_yilsonu,
    istenen: oz.ytd_istenen, istenmeyen: oz.ytd_istenmeyen, izin: oz.yillik_izin_bakiye, kidem: oz.sirket_kidemi
  };
}
