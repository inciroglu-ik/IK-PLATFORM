/* ============================================================================
   SAVUNMA TALEPLERİ · ortak mantık (25.11.2026) — Firebase import ETMEZ (saf işlevler; testte tarayıcıda denenir)
   - Durumlar, konu listesi, alan sınırları (kural: guvenlik/firestore.rules SAVUNMA bölümü ile birebir)
   - Hukukçu şablonları (27.11.2026: şirket hukuk biriminin örnek formlarına göre yeniden yazıldı):
       · SAVUNMA TALEBİ + 4857 m.109 tebliğ tutanağı (+ çalışanın yazılı savunması sayfası)
       · UYARI BİLDİRİMİ + m.109 tebliğ tutanağı (talep kapandıktan sonra, İK uyarıya karar verirse)
       · olay tespit tutanağı, imtina tutanağı
     Örnek formlardaki olaya özgü kalıplar (kamera kaydı, yaralanma, zarar tutarı, ticari itibar) şablona ALINMADI: olay
     yalnız müdürün bildirdiği metinden gelir. Bilinmeyen bilgi "[BİRİM MÜDÜRÜ / İK TEYİDİ GEREKLİ: …]" ile işaretlenir;
     işaret kalan belge onaylanamaz / indirilemez (teyitEksikleri).
     Şablon talep bilgileriyle ANINDA doldurulur; ofis sahibi "ofis" yazınca Ajan Ofisi'ndeki Hukukçu taslağı talebe
     özel gözden geçirip `kaynak:'hukukcu'` olarak yeniden yazar (İK Kontrol Notu + kontrol listesiyle). İK düzeltip onaylar.
   - İK Kontrol Notu (kontrolNotu): form türü ve gerekçesi, dayanak, 6 iş günü / 1 yıl süreleri, eksik bilgi, kontrol listesi.
   - Belge modeli: { baslik, ust:[[etiket, değer]], paragraflar:[metin], ozel:'savunma'|'uyari'|null, imzalar:[{ baslik, ad, unvan }] }
     Aynı model hem ekranda (HTML önizleme) hem PDF'te (pdfmake, Roboto: Türkçe karakterli) kullanılır. m.109 tebliğ tutanağı
     sabit metindir, PDF'e otomatik eklenir (düzenlenemez, eksiksiz kalır).
   - Hukuki görüş değildir; İK'nın onaylayacağı taslaktır. İşyeri Çalışma ve Disiplin Yönetmeliği / TİS varsa İK uyarlar.
   ============================================================================ */

export const DURUM = {
  ik_onayinda: { ad: 'İK onayında', kisa: 'İK onayında', sinif: 'uy', sira: 1 },
  revizyon: { ad: 'Müdürde düzeltmede (eksik bilgi)', kisa: 'Düzeltmede', sinif: 'uy', sira: 1 },
  onaylandi: { ad: 'Onaylandı · imza bekleniyor', kisa: 'İmza bekleniyor', sinif: 'bilgi', sira: 2 },
  kapandi: { ad: 'Tamamlandı', kisa: 'Tamamlandı', sinif: 'ok', sira: 3 },
  reddedildi: { ad: 'Reddedildi', kisa: 'Reddedildi', sinif: 'ht', sira: 4 },
  iptal: { ad: 'Geri çekildi', kisa: 'Geri çekildi', sinif: 'n', sira: 5 }
};
export const KONULAR = [
  'Devamsızlık (izinsiz işe gelmeme)',
  'İşe geç gelme / erken ayrılma',
  'Görev ve talimatlara aykırı davranış',
  'Görevin ihmali veya özensiz yapılması',
  'İş sağlığı ve güvenliği kurallarına aykırılık',
  'Müşteriye karşı uygunsuz davranış',
  'İş arkadaşına karşı uygunsuz davranış',
  'Şirket varlığına zarar / kayıp',
  'Kılık kıyafet kurallarına aykırılık',
  'İşyeri kurallarına aykırılık',
  'Diğer'
];
/* kural ile birebir: metin sınırları */
/* aciklamaEnAz: müdürün uygunsuz durum anlatımı için ekrandaki alt sınır (27.11.2026; kural tabanı 20 karakter kalır) */
export const SINIR = { aciklama: 3000, aciklamaEnAz: 120, yer: 120, tanik: 80, not: 1000, paragraf: 2500, paragrafSay: 12, ad: 120, beyan: 1500 };
export const SURE_VARSAYILAN = 3;          /* savunma için tebliğden itibaren iş günü (hukuk birimi formu: üç iş günü; İK değiştirebilir, 1–7) */
export const SIRKET = 'İnciroğlu Otomotiv San. ve Tic. A.Ş.';
/* KULLANICI KURALLARI (27.11.2026): belgelerde TİS'e atıf YOK; şirkette disiplin kurulu olmadığından yevmiye (ücret kesme) cezası
   UYGULANMAZ — yaptırım uyarı ya da fesihtir. "İş arkadaşına karşı uygunsuz davranış" talebinde olayın diğer tarafı ve olayın
   karşılıklı olup olmadığı yazılmadan talep gönderilemez / onaylanamaz. */
export const KONU_IS_ARKADASI = 'İş arkadaşına karşı uygunsuz davranış';
export const KARSILIKLI = [
  { v: 'tek', ad: 'Hayır, tek taraflı (diğer taraf karşılık vermedi)' },
  { v: 'karsilikli', ad: 'Evet, karşılıklı (iki taraf da tartıştı / sataştı)' }
];
export const karsilikliAdi = (v) => (KARSILIKLI.find((x) => x.v === v) || { ad: '' }).ad;
/* Müdürün "daha önce benzer bir durum yaşandı mı" bilgi notu (sözlü uyarı dahil) */
export const ONCEKI_DURUM = [
  { v: 'yok', ad: 'Hayır, bildiğim kadarıyla ilk kez' },
  { v: 'sozlu', ad: 'Evet, daha önce sözlü olarak uyarıldı' },
  { v: 'yazili', ad: 'Evet, daha önce yazılı uyarı / savunma var' }
];
export const oncekiDurumAdi = (v) => (ONCEKI_DURUM.find((x) => x.v === v) || { ad: '' }).ad;
/** İş arkadaşı talebinde olmazsa olmazlar tamam mı (diğer taraf + karşılıklılık) */
export const isArkadasiEksik = (t) => {
  const o = (t && t.olay) || {};
  if (o.konu !== KONU_IS_ARKADASI) return [];
  const e = [];
  if (!String(o.karsiTaraf || '').trim()) e.push('Olayın diğer tarafının (iş arkadaşının) adı soyadı');
  if (['tek', 'karsilikli'].indexOf(o.karsilikli) < 0) e.push('Olayın tek taraflı mı yoksa karşılıklı mı gerçekleştiği');
  return e;
};
/* Uyarı bildirimi türleri (hukuk biriminin uyarı formları). Kural: guvenlik/firestore.rules svUyariTurleri ile birebir. */
export const UYARI_TURLERI = [
  { v: 'israr', ad: 'Tekrar: hatırlatıldığı halde ısrar (25/II-h)' },
  { v: 'devamsizlik', ad: 'Devamsızlık' },
  { v: 'gorev', ad: 'Görevini gereği gibi yerine getirmeme / talimata aykırılık' },
  { v: 'kiyafet', ad: 'Kılık kıyafete aykırı davranış' },
  { v: 'dogruluk', ad: 'Doğruluk ve bağlılığa uymayan davranış' },
  { v: 'zarar', ad: 'Mala zarar verme' },
  { v: 'isg', ad: 'İş güvenliğini tehlikeye düşürme' },
  { v: 'genel', ad: 'Genel (işyeri kurallarına aykırılık)' }
];
const KONU_UYARI = {
  'Devamsızlık (izinsiz işe gelmeme)': 'devamsizlik', 'İşe geç gelme / erken ayrılma': 'genel', 'Görev ve talimatlara aykırı davranış': 'gorev',
  'Görevin ihmali veya özensiz yapılması': 'gorev', 'İş sağlığı ve güvenliği kurallarına aykırılık': 'isg', 'Müşteriye karşı uygunsuz davranış': 'dogruluk',
  'İş arkadaşına karşı uygunsuz davranış': 'genel', 'Şirket varlığına zarar / kayıp': 'zarar', 'Kılık kıyafet kurallarına aykırılık': 'kiyafet',
  'İşyeri kurallarına aykırılık': 'genel', 'Diğer': 'genel'
};
/** Konuya göre önerilen uyarı türü (İK değiştirebilir) */
export const uyariTuruOner = (konu) => KONU_UYARI[konu] || 'genel';
export const uyariTurAdi = (v) => (UYARI_TURLERI.find((x) => x.v === v) || { ad: v || '' }).ad;
/* Eksik bilgi işareti: belgede kalırsa onay / PDF engellenir */
export const teyit = (s) => '[BİRİM MÜDÜRÜ / İK TEYİDİ GEREKLİ: ' + s + ']';
const TEYIT_RE = /\[[^\]]*TEYİDİ GEREKLİ[^\]]*\]/g;
/** Belgede kalan teyit işaretleri (paragraflar, üst bilgi, imza adları) — boş dizi = belge gönderilebilir */
export function teyitEksikleri(d) {
  if (!d) return [];
  const metinler = [d.baslik].concat(d.paragraflar || [], (d.ust || []).map((r) => (Array.isArray(r) ? r[1] : r && r.d)), (d.imzalar || []).map((i) => i && i.ad));
  const out = [];
  metinler.forEach((m) => { (String(m || '').match(TEYIT_RE) || []).forEach((x) => { if (out.indexOf(x) < 0) out.push(x); }); });
  return out;
}

/* ---------------------------------------------------------------- yardımcılar */
const trUst = (s) => String(s == null ? '' : s).replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
/** Ad karşılaştırma anahtarı: Türkçe katlanmış, büyük/küçük ve boşluk duyarsız ("Ali  ÖZ" = "ALİ ÖZ" = "ali öz") */
export function adAnahtari(s) {
  return String(s == null ? '' : s).replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
/** "AHMET YILMAZ" → "Ahmet Yılmaz" (karışık yazım korunur) */
export function adGoster(s) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const kucuk = t.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
  if (t !== trUst(t) && t !== kucuk) return t;
  return kucuk.split(' ').map((w) => (w ? (w[0] === 'i' ? 'İ' : w[0] === 'ı' ? 'I' : w[0].toUpperCase()) + w.slice(1) : w)).join(' ');
}
/** Departman / unvan (Kolay İK büyük harf yazar): "BMW" → "BMW", "HASAR" → "Hasar", "SATIŞ DANIŞMANI" → "Satış Danışmanı",
    "YIKAMA, TESLİMAT VE SHOWROOM BİRİMİ" → "Yıkama, Teslimat ve Showroom Birimi". 4 harfe kadar sözcükler (BMW, PSA, FIAT, ARJ) korunur. */
export function depGoster(s) {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  if (!t || t !== trUst(t)) return t;
  return t.split(' ').map((w, i) => {
    const k = w.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
    if (i > 0 && (k === 've' || k === 'ile')) return k;
    if (w.replace(/[^\p{L}]/gu, '').length <= 4 && /\p{L}/u.test(w)) return w;
    return k ? (k[0] === 'i' ? 'İ' : k[0] === 'ı' ? 'I' : k[0].toUpperCase()) + k.slice(1) : w;
  }).join(' ');
}
export function tarihTr(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
export function bugunIso(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
export const epostaGecerli = (s) => /^[a-z0-9._%+-]+@inciroglu\.com\.tr$/i.test(String(s || '').trim());
/** Talep numarası: yıl + kimliğin ilk 5 karakteri (ör. SV-2026-7KQ2D) */
export const talepNo = (id, yil) => 'SV-' + (yil || new Date().getFullYear()) + '-' + String(id || '').slice(0, 5).toUpperCase();
const temiz = (s, n) => Array.from(String(s == null ? '' : s).replace(/[<>]/g, '').replace(/[ \t]+/g, ' ').trim()).slice(0, n).join('');

/* ---------------------------------------------------------------- şablonlar */
/** İşe giriş tarihi: "05.03.2024" ya da "2024-03-05" → "05.03.2024"; yoksa '' */
export function girisTr(s) {
  const t = String(s == null ? '' : s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return tarihTr(t);
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(t);
  return m ? m[1].padStart(2, '0') + '.' + m[2].padStart(2, '0') + '.' + m[3] : '';
}
function bilgi(t) {
  const c = t.calisan || {}, o = t.olay || {};
  return {
    ad: adGoster(c.ad), unvan: depGoster(c.unvan), dep: depGoster(c.departman), bolum: c.bolum || '', giris: girisTr(c.giris),
    tarih: tarihTr(o.tarih), saat: o.saat || '', yer: o.yer || '', konu: o.konu || '', aciklama: String(o.aciklama || '').trim(),
    taniklar: (o.taniklar || []).filter(Boolean).map(adGoster), mudur: adGoster((t.mudur || {}).ad), mudurUnvan: (t.mudur || {}).unvan || 'Yönetici',
    karsiTaraf: adGoster(o.karsiTaraf || ''), karsilikli: o.karsilikli || '', onceki: o.onceki || null
  };
}
/* ---------------------------------------------------------------- ARŞİV (27.11.2026)
   Aynı çalışanın önceki savunma talepleri (talepler koleksiyonundan; İK ekibi hepsini görür). Eşleşme: ad (Türkçe katlanmış) +
   unvan aynıysa ya da ad tek ise. Yalnız savunması istenmiş talepler (onaylandi / kapandi) arşive girer. */
export function oncekiSavunmalar(t, talepler) {
  const c = (t && t.calisan) || {}, k = adAnahtari(c.ad), u = adAnahtari(c.unvan);
  if (!k) return [];
  return (talepler || []).filter((x) => x && x.id !== t.id && adAnahtari((x.calisan || {}).ad) === k
      && (!u || !adAnahtari((x.calisan || {}).unvan) || adAnahtari((x.calisan || {}).unvan) === u)
      && (x.durum === 'onaylandi' || x.durum === 'kapandi'))
    .map((x) => ({ id: x.id, no: x.no || '', tarih: (x.olay || {}).tarih || '', konu: (x.olay || {}).konu || '', durum: x.durum,
      imtina: !!(x.kapanis && x.kapanis.tur === 'imtina'), uyari: x.uyari ? x.uyari.tur : '' }))
    .filter((x) => !((t.olay || {}).tarih) || !x.tarih || x.tarih <= (t.olay || {}).tarih)
    .sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0));
}
/** Aynı konudan (aynı eylemden) önceki savunma var mı → 2. ve sonrakinde 25/II-h "ısrar" altyapısı */
export const ayniKonuOnceki = (t, onceki) => (onceki || []).filter((x) => x.konu === ((t.olay || {}).konu || ''));
/* "Dosyanızda daha önce 05.11.2026 tarihinde “Devamsızlık” başlıklı savunmanız bulunmaktadır." */
function dosyaCumlesi(onceki) {
  const l = (onceki || []).filter((x) => x.durum === 'kapandi' || x.durum === 'onaylandi');
  if (!l.length) return '';
  const p = l.map((x) => tarihTr(x.tarih) + ' tarihinde “' + x.konu + '” başlıklı savunma' + (x.imtina ? ' talebi (savunma vermekten imtina edilmiştir)' : (x.durum === 'onaylandi' ? ' talebi' : 'nız')));
  return 'Dosyanızda daha önce ' + (p.length === 1 ? p[0] : p.slice(0, -1).join(', ') + ' ve ' + p[p.length - 1]) + ' bulunmaktadır.';
}
/* İş arkadaşı olayında taraflar ve karşılıklılık cümlesi (yoksa teyit işareti: onay engellenir) */
function taraflarCumlesi(b) {
  if (b.konu !== KONU_IS_ARKADASI) return '';
  const karsi = b.karsiTaraf || teyit('olayın diğer tarafının (iş arkadaşının) adı soyadı ve unvanı');
  const kars = b.karsilikli === 'tek' ? 'Olay sırasında iş arkadaşınızın size herhangi bir karşılık vermediği, olayın tek taraflı olarak gerçekleştiği bildirilmiştir.'
    : b.karsilikli === 'karsilikli' ? 'Olayın iki taraf arasında karşılıklı olarak gerçekleştiği bildirilmiş olup diğer taraf hakkında da ayrıca işlem yapılmaktadır.'
      : teyit('olayın tek taraflı mı (iş arkadaşı karşılık vermedi) yoksa karşılıklı mı gerçekleştiği');
  return 'Olayın tarafları: ' + (b.ad || '{calisan}') + ' (ilgili çalışan) ve iş arkadaşınız ' + karsi + ' (olayın diğer tarafı). ' + kars;
}
const zamanMetni = (b) => b.tarih + (b.saat ? ' tarihinde saat ' + b.saat + ' sularında' : ' tarihinde') + (b.yer ? ', ' + b.yer + ' konumunda' : '');
const GUN_YAZI = ['bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi'];
/* "Şirketimiz nezdinde 05.03.2024 tarihinden bu yana Servis Danışmanı olarak çalışmaktasınız." (giriş / unvan bilinmiyorsa teyit işareti) */
const girisCumlesi = (b, kalip) => 'Şirketimiz ' + (kalip || 'nezdinde') + ' ' + (b.giris || teyit('işe giriş tarihi')) + ' tarihinden bu yana ' + (b.unvan || teyit('unvan')) + ' olarak çalışmaktasınız.';
/* Konuya göre fiil cümlesi (hukuk biriminin savunma talebi formları). Olayın ayrıntısı her zaman müdürün metninden ayrı paragrafta gelir. */
function fiilCumlesi(b, uyari) {
  if (b.konu === 'Devamsızlık (izinsiz işe gelmeme)')
    return 'Mesai gününüz olan ' + b.tarih + ' tarihinde yetkili amirinizden izin almaksızın ve haklı bir mazeret bildirmeksizin işinize devam etmediğiniz yöneticiniz tarafından bildirilmiştir.';
  /* mesai saati savunma talebinde teyit edilir; uyarı bildirimi o yazıya dayanır (yeniden işaretlenmez) */
  if (b.konu === 'İşe geç gelme / erken ayrılma')
    return 'Mesai gününüz olan ' + b.tarih + ' tarihinde' + (uyari ? '' : ', mesainizin ' + teyit('mesai başlangıç / bitiş saati') + ' olmasına rağmen') + ' yetkili amirinizden izin almaksızın ve haklı bir mazeret bildirmeksizin '
      + (b.saat ? 'saat ' + b.saat + ' itibarıyla ' : '') + 'çalışma saatlerine uymadığınız (işe geç gelme / işten erken ayrılma) yöneticiniz tarafından bildirilmiştir.';
  if (b.konu === 'Kılık kıyafet kurallarına aykırılık')
    return 'Şirketimizde uygulanan kılık kıyafet kurallarına aykırı olarak ' + b.tarih + ' tarihinde işyerinde bulunduğunuz yöneticiniz tarafından bildirilmiştir.';
  return zamanMetni(b) + ' meydana gelen “' + b.konu + '” konulu olay yöneticiniz tarafından bildirilmiştir.';
}

/** SAVUNMA TALEBİ (hukuk birimi formu). PDF'te ardından TEBLİĞ ALAN bloğu, m.109 tebliğ tutanağı ve çalışanın yazılı savunması sayfası gelir.
    onceki: aynı çalışanın önceki savunmaları (oncekiSavunmalar). Aynı konudan önceki savunma varsa "hatırlatıldığı halde" (25/II-h)
    unsurunun altyapısı için bu yazıya işlenir. */
export function istemSablonu(t, sure, onceki) {
  const b = bilgi(t), gun = Math.min(7, Math.max(1, +sure || SURE_VARSAYILAN));
  const ayni = ayniKonuOnceki(t, onceki);
  const ust = [['Sayın', b.ad], ['Unvanı', b.unvan], ['Departmanı', b.dep + (b.bolum ? ' / ' + b.bolum : '')], ['Konu', 'Savunma talebi hk.']];
  if (b.konu === KONU_IS_ARKADASI) ust.push(['Olayın diğer tarafı', b.karsiTaraf || teyit('olayın diğer tarafı')]);
  const tekrar = ayni.length
    ? dosyaCumlesi(ayni) + ' Aynı konudaki yükümlülükleriniz bu yolla tarafınıza daha önce hatırlatılmış olmasına rağmen aynı davranışın tekrarlandığı bildirilmektedir.'
    : '';
  return {
    baslik: 'SAVUNMA TALEBİ',
    ust,
    paragraflar: [
      girisCumlesi(b) + ' ' + fiilCumlesi(b),
      'Yöneticinizin bildirimine göre olayın özeti: ' + b.aciklama,
      taraflarCumlesi(b),
      tekrar,
      'İşyeri kurallarına ve iş sözleşmenize aykırı olduğu değerlendirilen işbu fiile ilişkin ayrıntılı yazılı savunmanızı, varsa dayanak belgeleriyle birlikte, işbu savunma talebinin tarafınıza tebliğinden itibaren ' + gun + ' (' + GUN_YAZI[gun - 1] + ') iş günü içerisinde Şirketimiz yönetimine (İnsan Kaynakları Departmanına) bildirmenizi rica ederiz. Savunmanızı bu yazının ekindeki “Çalışanın Yazılı Savunması” sayfasına ya da ayrı bir dilekçeye yazabilirsiniz.',
      'Belirtilen süre içinde savunma vermemeniz halinde savunma hakkınızı kullanmaktan vazgeçmiş sayılacağınızı; savunmanızın Şirketimiz nezdinde kabul görmemesi halinde İş Kanunu, iş sözleşmeniz ve İşyeri Çalışma ve Disiplin Yönetmeliği hükümleri çerçevesinde uyarı yaptırımı uygulanması yahut İş Kanunu’nun amir hükümleri uyarınca iş sözleşmesinin feshi yollarına başvurma haklarımızı saklı tuttuğumuzu tarafınıza ihtaren bildiririz.'
    ].filter(Boolean),
    ozel: 'savunma',
    imzalar: [{ baslik: 'İŞVEREN', ad: SIRKET, unvan: '' }]
  };
}

/* Uyarı bildirimi dayanak paragrafları (hukuk biriminin uyarı formlarındaki kanun alıntıları; olaya özgü kalıplar alınmadı) */
const M25 = '4857 sayılı İş Kanunu’nun 25. maddesinde “Süresi belirli olsun veya olmasın işveren, aşağıda yazılı hallerde iş sözleşmesini sürenin bitiminden önce veya bildirim süresini beklemeksizin feshedebilir.” denilmekte; II. fıkranın ';
const B_H = '(h) bendinde “İşçinin yapmakla ödevli bulunduğu görevleri kendisine hatırlatıldığı halde yapmamakta ısrar etmesi”';
const B_I = '(ı) bendinde “İşçinin kendi isteği veya savsaması yüzünden işin güvenliğini tehlikeye düşürmesi, işyerinin malı olan veya malı olmayıp da eli altında bulunan makineleri, tesisatı veya başka eşya ve maddeleri otuz günlük ücretinin tutarıyla ödeyemeyecek derecede hasara ve kayba uğratması”';
const UYARI_DAYANAK = {
  devamsizlik: M25 + '(g) bendinde “İşçinin işverenden izin almaksızın veya haklı bir sebebe dayanmaksızın ardı ardına iki işgünü veya bir ay içinde iki defa herhangi bir tatil gününden sonraki iş günü, yahut bir ayda üç işgünü işine devam etmemesi” haline yer verilmiştir. Mazeretsiz devamsızlık işyerinin işleyişini aksatmakta ve işçi ile işveren arasında bulunması gereken güven ilişkisini zedelemektedir.',
  gorev: M25 + B_H + ' haline yer verilmiştir. Görev tanımınız ve iş sözleşmeniz gereği yerine getirmeniz gereken görevlere ve verilen talimatlara uyulmaması işin akışını olumsuz etkilemekte ve işçi ile işveren arasında bulunması gereken güven ilişkisini zedelemektedir.',
  kiyafet: 'Şirketimizde uygulanan kılık kıyafet kuralları İşyeri Çalışma ve Disiplin Yönetmeliği ile çalışanlarımıza duyurulmuş olup tüm çalışanlar bu kurallara uymakla yükümlüdür. ' + M25 + B_H + ' haline yer verilmiştir. Kurallara aykırılık işyeri düzenini bozmakta ve Şirketimizi müşterilerimiz ile diğer çalışanlarımız nezdinde olumsuz duruma düşürmektedir.',
  dogruluk: M25 + '(e) bendinde “İşçinin, işverenin güvenini kötüye kullanmak, hırsızlık yapmak, işverenin meslek sırlarını ortaya atmak gibi doğruluk ve bağlılığa uymayan davranışlarda bulunması” haline yer verilmiştir. Doğruluk ve bağlılık yükümlülüğü, iş sözleşmesinden doğan sadakat borcunun (6098 sayılı Türk Borçlar Kanunu m.396) bir gereğidir; bu yükümlülüğe aykırı davranışlar iş barışını bozmakta ve işçi ile işveren arasında bulunması gereken güveni sarsmaktadır.',
  zarar: M25 + B_I + ' haline yer verilmiştir. İş görme borcunun yerine getirilmesinde gösterilmesi gereken özen borcuna (6098 sayılı Türk Borçlar Kanunu m.396) aykırı davranışlar Şirketimizin zarara uğramasına yol açmakta ve güven ilişkisini zedelemektedir. Zararın tazminine ilişkin yasal haklarımız saklıdır.',
  isg: '6331 sayılı İş Sağlığı ve Güvenliği Kanunu’nun 19. maddesinde “Çalışanlar, iş sağlığı ve güvenliği ile ilgili aldıkları eğitim ve işverenin bu konudaki talimatları doğrultusunda, kendilerinin ve hareketlerinden veya yaptıkları işten etkilenen diğer çalışanların sağlık ve güvenliklerini tehlikeye düşürmemekle yükümlüdür.” hükmü yer almaktadır. Ayrıca ' + M25 + B_I + ' haline yer verilmiştir.',
  genel: 'İş sözleşmeniz ve İşyeri Çalışma ve Disiplin Yönetmeliği uyarınca işyeri kurallarına ve yöneticilerinizin usule uygun talimatlarına uymakla yükümlüsünüz. ' + M25 + B_H + ' haline yer verilmiştir. Kurallara aykırı davranışlar işyerinin işleyişini aksatmakta ve işçi ile işveren arasında bulunması gereken güven ilişkisini zedelemektedir.',
  /* 27.11.2026 kullanıcı kararı: aynı eylemden 2. ve sonraki savunmada "hatırlatıldığı halde ısrar" (25/II-h) altyapısı */
  israr: M25 + B_H + ' haline yer verilmiştir. Aynı konuda daha önce savunmanız alınarak uymanız gereken kurallar ve yükümlülükleriniz tarafınıza yazılı olarak hatırlatılmış olmasına rağmen aynı davranışın tekrarlanması, yapmakla yükümlü olduğunuz görevlerin hatırlatıldığı halde yerine getirilmemesinde ısrar niteliği taşımakta; işyerinin işleyişini ve işçi ile işveren arasında bulunması gereken güven ilişkisini ağır biçimde zedelemektedir.'
};
/** UYARI BİLDİRİMİ (hukuk birimi formu; talep kapandıktan sonra). o: { tur, beyan, onceki } — beyan = çalışanın yazılı savunmasının kısa özeti;
    onceki = aynı çalışanın önceki savunmaları (arşiv): "Dosyanızda daha önce … başlıklı savunmanız bulunmaktadır." ibaresi yazılır,
    aynı konudan önceki savunma varsa varsayılan tür "israr" (25/II-h). Savunma vermekten imtina edildiyse imtina cümlesi yazılır.
    PDF'te m.109 tebliğ tutanağı otomatik eklenir. */
export function uyariTuruVarsayilan(t, onceki) { return ayniKonuOnceki(t, onceki).length ? 'israr' : uyariTuruOner(((t && t.olay) || {}).konu); }
export function uyariSablonu(t, o) {
  const b = bilgi(t), onceki = (o && o.onceki) || [], tur = (o && o.tur) || uyariTuruVarsayilan(t, onceki);
  const beyan = String((o && o.beyan) || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  const imtina = !!(t.kapanis && t.kapanis.tur === 'imtina');
  const savunma = imtina
    ? 'Tarafınıza tebliğ edilmek istenen ' + (t.no ? t.no + ' sayılı ' : '') + 'savunma talebini imzalamaktan ve yazılı savunma vermekten imtina ettiğiniz tutanakla tespit edilmiştir. Bu nedenle değerlendirme mevcut bilgi ve belgeler üzerinden yapılmıştır.'
    : 'Konuya ilişkin vermiş olduğunuz yazılı savunmanızda ' + (beyan ? '“' + beyan + '”' : teyit('çalışanın savunmadaki beyanının kısa özeti')) + ' şeklinde beyanda bulunmuş olmanıza karşın, bu davranışınızı haklı kılacak geçerli bir gerekçe ve belge sunmadığınız değerlendirilmiştir.';
  return {
    baslik: 'UYARI BİLDİRİMİ',
    ust: [['Sayın', b.ad], ['Unvanı', b.unvan], ['Departmanı', b.dep + (b.bolum ? ' / ' + b.bolum : '')], ['Konu', 'Uyarı bildirimi hk.' + (t.no ? ' (' + t.no + ')' : '')]],
    paragraflar: [
      girisCumlesi(b, 'bünyesinde') + ' ' + fiilCumlesi(b, true) + ' Bu olay nedeniyle tarafınızdan yazılı savunma istenmiştir.',
      'Yöneticinizin bildirimine göre olayın özeti: ' + b.aciklama,
      taraflarCumlesi(b),
      dosyaCumlesi(onceki),
      savunma,
      UYARI_DAYANAK[tur] || UYARI_DAYANAK.genel,
      'Şirket yönetimi bu aşamada iş sözleşmenizin devamına karar vermiş olup davranışınızın işçinin işverene göstermesi gereken bağlılık ve disiplin kurallarına aykırı olduğunu hatırlatmak ve düzeltmenizi sağlamak amacıyla işbu yazı ile tarafınıza YAZILI UYARI yapılmaktadır. Aynı veya benzer davranışların tekrarı halinde, görevlerinizin hatırlatıldığı halde yerine getirilmemesinde ısrar edildiği kabul edilerek iş sözleşmenizin 4857 sayılı İş Kanunu’nun 25/II-(h) maddesi uyarınca haklı nedenle bildirimsiz ve tazminatsız feshi dahil yasal haklarımızı saklı tuttuğumuzu ihtaren bildiririz.'
    ].filter(Boolean),
    ozel: 'uyari',
    imzalar: [{ baslik: 'İŞVEREN', ad: SIRKET, unvan: '' }]
  };
}
/** Olay tespit tutanağı */
export function tutanakSablonu(t) {
  const b = bilgi(t);
  const tanik = b.taniklar.length ? b.taniklar : ['', ''];
  while (tanik.length < 2) tanik.push('');
  return {
    baslik: 'OLAY TESPİT TUTANAĞI',
    ust: [['Olay tarihi', b.tarih + (b.saat ? ' · ' + b.saat : '')], ['Olay yeri', b.yer || '—'], ['İlgili çalışan (olayın tarafı)', b.ad + ' · ' + b.unvan], ['Departmanı', b.dep + (b.bolum ? ' / ' + b.bolum : '')], ['Olayın konusu', b.konu]]
      .concat(b.konu === KONU_IS_ARKADASI ? [['Olayın diğer tarafı', b.karsiTaraf || teyit('olayın diğer tarafı')], ['Karşılıklı eylem', b.karsilikli === 'tek' ? 'Hayır, tek taraflı' : b.karsilikli === 'karsilikli' ? 'Evet, karşılıklı' : teyit('karşılıklı mı')]] : [])
      .concat([['Tutanak tarihi / saati', '……/……/20……   saat ……:……']]),
    paragraflar: [
      zamanMetni(b) + ' aşağıda açıklanan olay tarafımızca görülmüş ve tespit edilmiştir:',
      b.aciklama,
      b.konu === KONU_IS_ARKADASI ? 'Olay sırasında sarf edilen sözler (tanıkların duyduğu şekliyle): “………………………………………………………………………………………………”' : '',
      'İşbu tutanak, olayın aynen tespiti amacıyla düzenlenmiş; okunarak aşağıda adı ve imzası bulunan kişilerce birlikte imza altına alınmıştır. Tutanak konusu çalışanın imzadan imtina etmesi halinde bu durum tutanağa ayrıca yazılır. Tanıkların ayrıntılı beyanları ekteki “Tanık Beyanı” sayfalarındadır.'
    ].filter(Boolean),
    ozel: null,
    imzalar: [{ baslik: 'Tutanağı Düzenleyen', ad: b.mudur, unvan: b.mudurUnvan }].concat(tanik.slice(0, 3).map((a, i) => ({ baslik: (i + 1) + '. Tanık', ad: a, unvan: '' })))
      .concat([{ baslik: 'Tutanak Konusu Çalışan', ad: b.ad, unvan: b.unvan }])
  };
}
/** İmtina tutanağı (müdür "çalışan imzadan / savunma vermekten imtina etti" işaretlediğinde İK indirir) */
export function imtinaSablonu(t) {
  const b = bilgi(t);
  const tanik = b.taniklar.length ? b.taniklar.slice(0, 2) : ['', ''];
  while (tanik.length < 2) tanik.push('');
  return {
    baslik: 'İMTİNA TUTANAĞI',
    ust: [['İlgili çalışan', b.ad + ' · ' + b.unvan], ['Departmanı', b.dep + (b.bolum ? ' / ' + b.bolum : '')], ['Olay tarihi', b.tarih], ['Olayın konusu', b.konu]],
    paragraflar: [
      b.tarih + ' tarihli olayla ilgili olarak düzenlenen savunma talebi yazısı ve olay tespit tutanağı, ……/……/20…… tarihinde saat ……:…… sularında, aşağıda imzası bulunan tanıklar huzurunda ' + b.ad + ' isimli çalışana tebliğ edilmek istenmiştir.',
      'Yazının içeriği çalışana okunmuş ve kendisine yazılı savunma verme hakkı bulunduğu, belirtilen süre içinde savunma vermemesi halinde savunma hakkını kullanmaktan vazgeçmiş sayılacağı sözlü olarak bildirilmiştir.',
      'Çalışan, söz konusu yazıyı tebellüğ etmekten / imzalamaktan ve yazılı savunma vermekten imtina etmiştir.',
      'İşbu tutanak, durumun tespiti amacıyla tarafımızca düzenlenerek birlikte imza altına alınmıştır.'
    ],
    ozel: null,
    imzalar: [{ baslik: 'Tebliğ Eden (Yönetici)', ad: b.mudur, unvan: b.mudurUnvan }].concat(tanik.map((a, i) => ({ baslik: (i + 1) + '. Tanık', ad: a, unvan: '' })))
  };
}
/** Taslak seti (İK ekranının başlangıcı). Kayıtlı taslak (ör. Hukukçu'nun gözden geçirdiği) varsa o kullanılır. */
export function taslakSeti(t, sure, kayitli, onceki) {
  const k = kayitli || {};
  return {
    istem: belgeGecerli(k.istem) ? k.istem : istemSablonu(t, sure, onceki),
    tutanak: belgeGecerli(k.tutanak) ? k.tutanak : tutanakSablonu(t),
    imtina: belgeGecerli(k.imtina) ? k.imtina : imtinaSablonu(t),
    kaynak: k.kaynak || 'sablon'
  };
}
/* ---------------------------------------------------------------- İK KONTROL NOTU (27.11.2026)
   Talimat: belge türü ayrımı, hak düşürücü süreler (4857 m.26), fiilin somutlaştırılması ve isabetli madde eşleştirmesi,
   m.109 tebliğ şekli, eksik bilgi. Kayıt dışı, her açılışta talepten hesaplanır. Hukukçu (Ajan Ofisi) kendi değerlendirmesini
   ayrıca yazar (ik/taslak.hukukcu.degerlendirme); ekranda ikisi birlikte görünür. Yargıtay kararı NUMARASI uydurulmaz:
   yalnız yerleşik ilkeler yazılır. */
const DAYANAK = {
  'Devamsızlık (izinsiz işe gelmeme)': ['4857 m.25/II-g: ardı ardına 2 iş günü, bir ayda 2 kez tatil sonrası iş günü ya da bir ayda 3 iş günü mazeretsiz devamsızlık haklı fesih sebebidir; eşiğin altındaki devamsızlıkta savunma + uyarı / yönetmelikteki kademeli yaptırım değerlendirilir.'],
  'İşe geç gelme / erken ayrılma': ['İş sözleşmesi ve İşyeri Çalışma ve Disiplin Yönetmeliği (çalışma saatleri).', 'Tekrarında 4857 m.25/II-h (hatırlatıldığı halde ısrar) ya da m.18 geçerli neden; tek seferlik gecikmede fesih orantısız sayılabilir.'],
  'Görev ve talimatlara aykırı davranış': ['4857 m.25/II-h: görevin “hatırlatılması” ve buna rağmen “ısrar” unsurları belgelenmelidir.', '6098 TBK m.399 (işverenin talimatlarına uyma borcu).'],
  'Görevin ihmali veya özensiz yapılması': ['6098 TBK m.396 (özen ve sadakat borcu).', '4857 m.18 geçerli neden (davranış / verim); ağır ihmal ve hasarda m.25/II-ı.'],
  'İş sağlığı ve güvenliği kurallarına aykırılık': ['6331 m.19 (çalışanın İSG yükümlülükleri); ilgili İSG eğitimi ve talimatın çalışana verildiği belgelenmelidir.', '4857 m.25/II-ı (işin güvenliğini tehlikeye düşürme).'],
  'Müşteriye karşı uygunsuz davranış': ['6098 TBK m.396 (özen ve sadakat borcu), iş sözleşmesi ve yönetmelik.', 'Ağır hallerde 4857 m.25/II-e (doğruluk ve bağlılığa aykırılık); sözlü ifade tırnak içinde ve tanıkla desteklenmelidir.'],
  'İş arkadaşına karşı uygunsuz davranış': ['4857 m.25/II “ahlak ve iyi niyet kurallarına uymayan haller” ve (d) bendi “işverenin başka bir işçisine sataşması”: iş arkadaşına yönelik küfür ve hakaret yerleşik Yargıtay uygulamasında sataşma sayılarak haklı fesih nedeni kabul edilmektedir.', 'Karşılıklı tartışma ya da diğer tarafın tahriki varsa Yargıtay feshi haklı değil geçerli nedenle sınırlı görebilir: olayın diğer tarafı ve karşılıklı olup olmadığı mutlaka netleştirilmeli, karşılıklıysa iki taraftan da savunma alınmalıdır.'],
  'Şirket varlığına zarar / kayıp': ['4857 m.25/II-ı: otuz günlük ücretle ödenemeyecek hasar / kayıp haklı fesih sebebidir; zarar tutarı yalnız belgeyle yazılır.', '6098 TBK m.400 (işçinin sorumluluğu).'],
  'Kılık kıyafet kurallarına aykırılık': ['İşyeri Çalışma ve Disiplin Yönetmeliği / kıyafet kuralları (çalışana tebliğ edilmiş olmalı).', 'Tekrarında 4857 m.25/II-h.'],
  'İşyeri kurallarına aykırılık': ['İş sözleşmesi ve İşyeri Çalışma ve Disiplin Yönetmeliği.', 'Tekrarında 4857 m.25/II-h ya da m.18 geçerli neden.'],
  'Diğer': ['Fiile göre İK belirler: 4857 m.18 (geçerli neden), m.25/II (haklı neden), yönetmelik.']
};
/** Pazar hariç iş günü sayısı (bas hariç, bit dahil). Resmî tatiller hesaba katılmaz. */
export function isGunuFarki(basIso, bitIso) {
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(basIso || ''), m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bitIso || '');
  if (!m1 || !m2) return null;
  const d = new Date(+m1[1], +m1[2] - 1, +m1[3]), son = new Date(+m2[1], +m2[2] - 1, +m2[3]);
  let n = 0;
  while (d < son) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) n++; }
  return n;
}
/** İK Kontrol ve Hukuki Değerlendirme Notu + Düzeltme ve Onay Kontrol Listesi.
    o: { asama:'savunma'|'uyari', uyariTur, bugun (ISO), sure } */
export function kontrolNotu(t, o = {}) {
  const b = bilgi(t), asama = o.asama === 'uyari' ? 'uyari' : 'savunma', bugun = o.bugun || bugunIso();
  const onceki = o.onceki || [], ayni = ayniKonuOnceki(t, onceki), engeller = isArkadasiEksik(t);
  const olayIso = (t.olay || {}).tarih || '';
  const ig = isGunuFarki(olayIso, bugun);
  const takvim = (() => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(olayIso); if (!m) return null; const a = new Date(+m[1], +m[2] - 1, +m[3]), z = new Date(bugun + 'T00:00:00'); return Math.round((z - a) / 864e5); })();
  const imtina = !!(t.kapanis && t.kapanis.tur === 'imtina');
  const form = asama === 'savunma'
    ? { ad: 'Savunma Talebi', gerekce: 'Davranış nedeniyle uyarı ya da fesih gündeme gelebileceğinden önce çalışanın yazılı savunması alınır (4857 m.19; savunma alınmadan tek taraflı yaptırım / fesih kurgusuna geçilmez). Şirkette disiplin kurulu bulunmadığından ücrete yönelik disiplin yaptırımı uygulanmaz; yaptırım uyarı ya da fesihtir. Uyarı Bildirimi, savunma alındıktan ya da süre dolduktan sonra İK kararıyla hazırlanır.' }
    : { ad: 'Uyarı Bildirimi', gerekce: (imtina ? 'Çalışan savunma vermekten imtina etti (tutanakla); ' : 'Çalışanın yazılı savunması alındı; ') + 'İK savunmayı değerlendirip fesih yerine uyarı yaptırımına karar verirse (orantılılık / kademeli disiplin) Uyarı Bildirimi tebliğ edilir. Seçilen tür: ' + uyariTurAdi(o.uyariTur || uyariTuruVarsayilan(t, onceki)) + '.' };
  const dayanak = (DAYANAK[b.konu] || DAYANAK['Diğer']).slice();
  if (ayni.length) dayanak.push('Dosyada aynı konuda önceki savunma var (' + ayni.map((x) => tarihTr(x.tarih)).join(', ') + '): görev ve kurallar yazılı olarak hatırlatılmış sayılır; tekrarında 4857 m.25/II-h “görevleri kendisine hatırlatıldığı halde yapmamakta ısrar etmesi” haklı fesih nedeni gündeme gelir. Uyarı bildirimi bu kapsamda (ısrar) düzenlenmelidir.');
  dayanak.push('Yerleşik Yargıtay uygulaması: fesih son çare olmalı (orantılılık, kademeli disiplin); davranış nedeniyle fesihten önce savunma alınmalı; tutanak olay anında, tanık imzasıyla düzenlenmeli ve olay soyut değil somut anlatılmalı.');
  const riskler = [], eksikler = [];
  engeller.forEach((x) => eksikler.push(x + ' (eksikken talep onaylanamaz)'));
  if (onceki.length) riskler.push('Arşiv: çalışanın önceki savunmaları — ' + onceki.map((x) => tarihTr(x.tarih) + ' “' + x.konu + '” (' + (x.no || '') + ')').join('; ') + '.');
  if (b.onceki && b.onceki.durum && b.onceki.durum !== 'yok') riskler.push('Müdürün bilgi notu (önceki benzer durum, ' + oncekiDurumAdi(b.onceki.durum) + '): ' + String(b.onceki.not || '').slice(0, 300));
  if (ig != null) {
    if (ig >= 6) riskler.push('Olay tarihinden bu yana yaklaşık ' + ig + ' iş günü geçti (Pazar hariç, resmî tatiller sayılmadı). Haklı nedenle fesih (m.25/II) düşünülüyorsa 4857 m.26’daki 6 iş günlük süre, olayın işverence ÖĞRENİLDİĞİ tarihten başlar: öğrenme tarihini teyit edin. Bu süre uyarı ve geçerli nedenle fesih için aranmaz.');
    else if (ig >= 4) riskler.push('Olay tarihinden bu yana ' + ig + ' iş günü geçti; haklı nedenle fesih düşünülüyorsa 4857 m.26’daki 6 iş günlük süre dolmak üzere (öğrenme tarihinden itibaren).');
    if (takvim != null && takvim > 365) riskler.push('Fiilin üzerinden bir yıldan fazla geçti: 4857 m.26’daki bir yıllık süre dolmuş olabilir (işçinin maddi çıkar sağladığı hal hariç).');
  }
  if (!(t.olay || {}).taniklar || !(t.olay || {}).taniklar.filter(Boolean).length) riskler.push('Tanık bildirilmedi: ispat için olay tespit tutanağı ve varsa kayıt (PDKS, iş emri, sistem kaydı vb.) teyit edilmeli. Girdide olmayan delil (kamera kaydı, zarar tutarı, yaralanma, ticari itibar) belgeye yazılmaz.');
  if (b.aciklama.length < 80) riskler.push('Olay açıklaması kısa: fiil somut değilse (ne, ne zaman, nerede, hangi kurala aykırı) müdürden ayrıntı isteyin.');
  if (b.konu === 'Devamsızlık (izinsiz işe gelmeme)') riskler.push('Devamsızlık gün sayısını ve tarihlerini teyit edin: tek günlük devamsızlık m.25/II-g eşiğini tek başına karşılamaz.');
  if (asama === 'uyari' && !imtina) riskler.push('Uyarı bildiriminde çalışanın savunmadaki beyanı doğru ve kısa özetlenmeli; savunma belgesi talebe yüklü olmalı.');
  riskler.push('Tebliğ sırasında çalışan imzadan / tebellüğden imtina ederse bu durum AYNI ANDA, en az iki şahit huzurunda imtina tutanağıyla tespit edilmeli (4857 m.109 yazılı bildirim).');
  if (!b.giris) eksikler.push('İşe giriş tarihi (personel kaydında yok)');
  if (!b.unvan) eksikler.push('Unvan / görev');
  if (b.konu === 'İşe geç gelme / erken ayrılma' && asama === 'savunma') eksikler.push('İlgili gündeki mesai başlangıç / bitiş saati' + (b.saat ? '' : ' ve işyerine geliş / ayrılış saati'));
  if (!b.yer) eksikler.push('Olay yeri');
  if (!b.onceki) eksikler.push('Daha önce benzer bir durum yaşanıp yaşanmadığı (müdürün bilgi notu)');
  /* Kontrol listesi: her maddenin karşılığı müdürden istenecek eksik bilgi ifadesi (null = yalnız İK'nın kontrolü, müdüre gitmez) */
  const maddeler = [
    ['Çalışanın adı, unvanı ve işe giriş tarihi personel kaydıyla aynı.', 'Çalışanın unvanı / işe giriş tarihi bilgisi eksik ya da hatalıdır.'],
    ['Olay tarihi, saati ve yeri müdürün bildirimiyle aynı.', 'Olayın saati ve yeri bilgisi eksiktir.'],
    ['Belgedeki tüm “[… TEYİDİ GEREKLİ …]” işaretleri dolduruldu (kalırsa onay / PDF düğmesi çalışmaz).', null],
    ['Fiil somut ve tek: ne, ne zaman, nerede, hangi kurala / talimata aykırı.', 'Olayın somut anlatımı (ne oldu, nerede, hangi kurala / talimata aykırı) bilgisi eksiktir.'],
    ['Girdide olmayan kalıp ifade yok (kamera kaydı, zarar tutarı, yaralanma, ticari itibar).', null],
    asama === 'savunma' ? ['Savunma süresi (' + Math.min(7, Math.max(1, +o.sure || SURE_VARSAYILAN)) + ' iş günü) yazıda açıkça yazılı.', null] : ['Uyarı türü (dayanak maddesi) fiille orantılı ve isabetli; aşırı iddialı madde atfı yok.', null],
    asama === 'uyari' ? [(imtina ? 'İmtina tutanağı dosyada.' : 'Çalışanın savunmadaki beyanı doğru özetlendi.'), null] : ['Haklı fesih düşünülüyorsa 6 iş günlük süre (m.26) kontrol edildi.', 'Olayın öğrenildiği tarih bilgisi eksiktir.'],
    ['Tanık varsa her tanık için “Tanık Beyanı” sayfası tutanak PDF’inde; tanık yoksa delil (kayıt, tutanak) teyit edildi.', 'Olayın tanıkları ya da delili (PDKS, iş emri, sistem kaydı) bilgisi eksiktir.'],
    ['Daha önce benzer bir durum yaşanıp yaşanmadığı (müdürün bilgi notu) ve arşivdeki önceki savunmalar kontrol edildi.', 'Daha önce benzer bir durum yaşanıp yaşanmadığı (sözlü uyarı dahil) bilgisi eksiktir.'],
    ['PDF’te m.109 tebliğ tutanağı (Tebliğ Alan / Tebliğ Eden / Şahit) var.', null],
    ['Özel nitelikli kişisel veri (sağlık, din, sendika vb.) yok.', null]
  ];
  if (b.konu === KONU_IS_ARKADASI) maddeler.splice(2, 0, ['Olayın tarafı (ilgili çalışan) ve diğer tarafı yazılı; olayın karşılıklı olup olmadığı netleşti (karşılıklıysa iki taraftan da savunma).', 'Olayın diğer tarafının (iş arkadaşının) adı soyadı ve olayın tek taraflı mı karşılıklı mı gerçekleştiği bilgisi eksiktir.']);
  return { form, dayanak, riskler, eksikler, liste: maddeler.map((m) => m[0]), listeEksik: maddeler.map((m) => m[1]), engeller };
}
/** İK'nın müdürden isteyeceği eksik bilgiler (ön seçim): kontrol listesinde işaretlenmemiş maddeler + belgedeki teyit işaretleri +
    iş arkadaşı olayında taraflar / karşılıklılık. Her madde "… bilgisi eksiktir." biçiminde. */
export function revizeEksikleri(not, isaretsizIdx, belgeler) {
  const l = [];
  const ekle = (s) => { if (s && l.indexOf(s) < 0) l.push(s); };
  (not.engeller || []).forEach((x) => ekle(x + ' bilgisi eksiktir.'));
  (isaretsizIdx || []).forEach((i) => ekle((not.listeEksik || [])[i]));
  (belgeler || []).forEach((d) => teyitEksikleri(d).forEach((x) => ekle(x.replace(/^\[[^:]*:\s*/, '').replace(/\]$/, '').replace(/^./, (c) => c.toLocaleUpperCase('tr')) + ' bilgisi eksiktir.')));
  return l.slice(0, 15);
}
/** İK Görüş ve Değerlendirmesi (müdüre e-postayla giden bilgilendirme notu): Hukuki dayanak ve Yargıtay yaklaşımı + Hukukçu emsal kararları */
export function ikGorusMetni(not, hukukcu) {
  const d = (hukukcu && hukukcu.degerlendirme) || {};
  const sat = ['Hukuki dayanak ve Yargıtay yaklaşımı:'].concat((Array.isArray(d.dayanak) && d.dayanak.length ? d.dayanak : not.dayanak).map((x) => '• ' + x));
  const em = Array.isArray(d.emsal) ? d.emsal : [];
  if (em.length) { sat.push('', 'Benzer örnek Yargıtay kararları:'); em.forEach((e) => sat.push('• ' + (e.baslik || '') + ': ' + (e.ozet || ''))); }
  return sat.join('\n').replace(/[<>]/g, '').slice(0, 4000);
}

export function belgeGecerli(d) {
  return !!(d && typeof d.baslik === 'string' && Array.isArray(d.paragraflar) && d.paragraflar.length >= 1 && d.paragraflar.length <= SINIR.paragrafSay
    && d.paragraflar.every((p) => typeof p === 'string' && p.length <= SINIR.paragraf) && Array.isArray(d.ust) && Array.isArray(d.imzalar));
}
/** Üst bilgi satırı: şablon/Hukukçu [etiket, değer] dizisi yazar; Firestore'da { e, d } nesnesi durur (Firestore dizi içinde
    dizi kabul etmez — 26.11.2026 hatası). Ekran ve PDF iki biçimi de bununla okur. */
export const ustSatir = (r) => (Array.isArray(r) ? [r[0], r[1]] : [r && r.e, r && r.d]);
/** Firestore'a yazılacak belge (temizlenmiş, sınırlı; üst bilgi satırları { e, d } nesnesi) */
export function belgeTemizle(d) {
  return {
    baslik: temiz(d.baslik, 80),
    ust: (d.ust || []).slice(0, 8).map((r) => { const s = ustSatir(r); return { e: temiz(s[0], 40), d: temiz(s[1], 200) }; }),
    paragraflar: (d.paragraflar || []).slice(0, SINIR.paragrafSay).map((p) => Array.from(String(p == null ? '' : p).replace(/[<>]/g, '').replace(/\r/g, '').trim()).slice(0, SINIR.paragraf).join('')).filter((p) => p),
    ozel: d.ozel === 'savunma' || d.ozel === 'uyari' ? d.ozel : null,
    imzalar: (d.imzalar || []).slice(0, 6).map((i) => ({ baslik: temiz(i.baslik, 60), ad: temiz(i.ad, 80), unvan: temiz(i.unvan, 80) }))
  };
}

/* ---------------------------------------------------------------- PDF (pdfmake belge tanımı) */
const LAC = '#132a46', GRI = '#4f5868', ACIK = '#d8dde5';
export function pdfTanimi(d, o = {}) {
  const icerik = [];
  icerik.push({ columns: [{ text: [{ text: 'İNCİROĞLU OTOMOTİV\n', bold: true, fontSize: 11, color: LAC }, { text: 'İnsan Kaynakları', fontSize: 8.5, color: GRI }] },
    { text: (o.no ? 'Talep No: ' + o.no + '\n' : '') + (o.tarih ? 'Düzenleme: ' + o.tarih : ''), alignment: 'right', fontSize: 8.5, color: GRI }], margin: [0, 0, 0, 6] });
  icerik.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 1, lineColor: LAC }], margin: [0, 0, 0, 16] });
  icerik.push({ text: d.baslik, alignment: 'center', bold: true, fontSize: 14, color: LAC, margin: [0, 0, 0, 14] });
  if (d.ust && d.ust.length) {
    icerik.push({ table: { widths: [110, '*'], body: d.ust.map(ustSatir).map((r) => [{ text: r[0] || '', bold: true, color: GRI, fontSize: 9.5 }, { text: r[1] || '—', fontSize: 10 }]) },
      layout: { hLineColor: () => ACIK, vLineColor: () => ACIK, paddingTop: () => 4, paddingBottom: () => 4 }, margin: [0, 0, 0, 14] });
  }
  d.paragraflar.forEach((p) => icerik.push({ text: p, alignment: 'justify', fontSize: 10.5, lineHeight: 1.3, margin: [0, 0, 0, 8] }));
  /* imzalar (yazıyı düzenleyen / tebliğ eden / tanıklar) metnin hemen altında. Savunma talebi ve uyarı bildiriminde hukuk birimi
     formundaki gibi solda TEBLİĞ ALAN (çalışan; T.C. kimlik no elle yazılır, sistemde tutulmaz), sağda İŞVEREN. */
  const tebligli = d.ozel === 'savunma' || d.ozel === 'uyari';
  const kutu = (k) => (k ? { stack: [{ text: k.baslik, bold: true, fontSize: 9.5, color: LAC }, { text: k.ad || 'Ad Soyad: ……………………', fontSize: 9.5, margin: [0, 3, 0, 0] }, { text: k.unvan ? k.unvan : ' ', fontSize: 8.5, color: GRI }]
    .concat(k.tc ? [{ text: '(T.C. Kimlik No: ……………………)', fontSize: 8.5, color: GRI }] : [], k.tarih ? [{ text: 'Tarih: ……/……/20……', fontSize: 9, margin: [0, 4, 0, 0] }] : [], [{ text: 'İmza:', fontSize: 9.5, margin: [0, k.tc || k.tarih ? 14 : 18, 0, 0] }]) } : { text: '' });
  const imz = (tebligli ? [{ baslik: 'TEBLİĞ ALAN', ad: o.calisan || '', unvan: '', tc: true, tarih: true }] : []).concat(d.imzalar || []);
  if (imz.length) {
    const sat = [];
    for (let i = 0; i < imz.length; i += 3) sat.push(imz.slice(i, i + 3));
    sat.forEach((s) => {
      while (s.length < 3) s.push(null);
      if (tebligli && s.length === 3 && s[2] === null && s[1]) { s[2] = s[1]; s[1] = null; }   /* İŞVEREN sağa */
      icerik.push({ columns: s.map(kutu), columnGap: 18, margin: [0, 10, 0, 6], unbreakable: true });
    });
  }
  /* 4857 m.109 tebliğ tutanağı (hukuk birimi formu): sabit metin, ayrı sayfa, düzenlenemez */
  if (tebligli) {
    const yazi = d.ozel === 'uyari' ? 'Uyarı Bildirimi' : 'Savunma Talebi';
    icerik.push({ text: 'TUTANAK', alignment: 'center', bold: true, fontSize: 14, color: LAC, margin: [0, 0, 0, 2], pageBreak: 'before' });
    icerik.push({ text: (o.no ? o.no + ' · ' : '') + yazi + ' tebliğ tutanağı (4857 sayılı İş Kanunu m.109)', alignment: 'center', fontSize: 9, color: GRI, margin: [0, 0, 0, 16] });
    icerik.push({ text: '……/……/20…… tarihinde ' + SIRKET + ' nezdinde ' + (o.unvan ? o.unvan + ' olarak ' : '') + 'çalışan ' + (o.calisan || '……………………') + ' isimli personele ekte bir örneği yer alan ' + yazi + ' yazısı tebliğ edilmiştir. İşbu tutanak aşağıda imzası bulunan kişiler huzurunda ve İş Kanunu’nun 109. maddesi gereğince ……/……/20…… tarihinde imza altına alınmıştır.', alignment: 'justify', fontSize: 10.5, lineHeight: 1.35, margin: [0, 0, 0, 18] });
    icerik.push({ columns: [kutu({ baslik: 'TEBLİĞ ALAN', ad: o.calisan || '', unvan: '', tc: true }), kutu({ baslik: 'TEBLİĞ EDEN', ad: '', unvan: '' }), kutu({ baslik: 'ŞAHİT', ad: '', unvan: '' })], columnGap: 18, margin: [0, 6, 0, 6], unbreakable: true });
  }
  /* savunma talebi: tutanaktan sonra çalışanın yazılı savunması sayfası */
  if (d.ozel === 'savunma') {
    icerik.push({ text: 'ÇALIŞANIN YAZILI SAVUNMASI', bold: true, fontSize: 12, color: LAC, alignment: 'center', margin: [0, 0, 0, 4], pageBreak: 'before' });
    icerik.push({ text: (o.no ? o.no + ' numaralı ' : '') + 'savunma talebine cevaben. Savunmanızı bu sayfaya ya da ayrı bir dilekçeye yazabilirsiniz.', fontSize: 9, color: GRI, alignment: 'center', margin: [0, 0, 0, 12] });
    icerik.push({ table: { widths: ['*'], body: Array.from({ length: 22 }, () => [{ text: ' ', fontSize: 11, margin: [0, 5, 0, 5] }]) },
      layout: { hLineColor: () => ACIK, vLineWidth: () => 0, hLineWidth: (i) => (i === 0 ? 0 : 0.6) }, margin: [0, 0, 0, 14] });
    icerik.push({ columns: [{ text: 'Tarih: ……/……/20……', fontSize: 10 }, { text: 'Çalışan Ad Soyad: ' + (o.calisan || '') + '\nİmza:', fontSize: 10, alignment: 'right', lineHeight: 1.6 }], unbreakable: true });
  }
  /* 27.11.2026: tanık alanı doluysa olay tespit tutanağının ardına her tanık için "TANIK BEYANI" sayfası (tanık kendi ifadesini yazar) */
  (Array.isArray(o.tanikBeyani) ? o.tanikBeyani : []).filter(Boolean).slice(0, 3).forEach((ad, i) => {
    icerik.push({ text: 'TANIK BEYANI', alignment: 'center', bold: true, fontSize: 14, color: LAC, margin: [0, 0, 0, 2], pageBreak: 'before' });
    icerik.push({ text: (o.no ? o.no + ' · ' : '') + (i + 1) + '. tanık', alignment: 'center', fontSize: 9, color: GRI, margin: [0, 0, 0, 12] });
    const s = [['Tanık ad soyad', ad], ['Unvanı / görevi', '……………………………………'], ['Olay tarihi', o.olayTarihi || '……/……/20……'], ['Olayın konusu', o.konu || ''],
      ['Olayın tarafı (ilgili çalışan)', o.calisan || '']].concat(o.karsiTaraf ? [['Olayın diğer tarafı', o.karsiTaraf]] : []);
    icerik.push({ table: { widths: [130, '*'], body: s.map((r) => [{ text: r[0], bold: true, color: GRI, fontSize: 9.5 }, { text: r[1] || '—', fontSize: 10 }]) },
      layout: { hLineColor: () => ACIK, vLineColor: () => ACIK, paddingTop: () => 4, paddingBottom: () => 4 }, margin: [0, 0, 0, 10] });
    icerik.push({ text: 'Olaya ilişkin gördüğünüzü ve duyduğunuzu, olayın nasıl başladığını ve geliştiğini, varsa sarf edilen sözleri tırnak içinde, kendi ifadenizle yazınız.', fontSize: 9.5, color: GRI, margin: [0, 0, 0, 8] });
    icerik.push({ table: { widths: ['*'], body: Array.from({ length: 18 }, () => [{ text: ' ', fontSize: 11, margin: [0, 5, 0, 5] }]) },
      layout: { hLineColor: () => ACIK, vLineWidth: () => 0, hLineWidth: (j) => (j === 0 ? 0 : 0.6) }, margin: [0, 0, 0, 10] });
    icerik.push({ text: 'Yukarıdaki beyanımın gördüğüm ve duyduğum şekliyle doğru olduğunu ve kendi irademle verdiğimi beyan ederim.', fontSize: 9.5, margin: [0, 0, 0, 10] });
    icerik.push({ columns: [{ text: 'Tarih: ……/……/20……', fontSize: 10 }, { text: 'Tanık Ad Soyad: ' + ad + '\nİmza:', fontSize: 10, alignment: 'right', lineHeight: 1.6 }], unbreakable: true });
  });
  return {
    pageSize: 'A4', pageMargins: [56, 48, 56, 56],
    info: { title: d.baslik + (o.no ? ' · ' + o.no : ''), author: 'İnciroğlu Otomotiv İK' },
    defaultStyle: { font: 'Roboto', fontSize: 10.5, color: '#151a23' },
    footer: (cur, top) => ({ text: (o.no ? o.no + ' · ' : '') + d.baslik + ' · ' + cur + ' / ' + top, alignment: 'center', fontSize: 8, color: GRI, margin: [0, 18, 0, 0] }),
    content: icerik
  };
}
/** Dosya adı: "SV-2026-ABCDE_Savunma_Istem_Yazisi.pdf" (Türkçe karakter ve boşluk yok) */
export function dosyaAdi(no, baslik) {
  const a = String(baslik || 'Belge').replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ş/g, 'S').replace(/ş/g, 's').replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U').replace(/ü/g, 'u').replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c')
    .toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return (no ? no + '_' : '') + a + '.pdf';
}

/* ---------------------------------------------------------------- kadro (müdürün ekibi) */
/** Personel listesi (İK Sistemi mrPersonel.aktif) + hesaplar → her yönetici hesabı için ekip listesi.
    Eşleşme: çalışanın "Müdürlük" alanı (Kolay İK; kişinin adı) = hesabın adı. İK'nın "ek müdürlük" eşlemesi (vekâlet) eklenir. */
export function kadroKur(personel, hesaplar, ekMudurluk) {
  const ek = ekMudurluk || {};
  const sonuc = {};
  const yonetici = (hesaplar || []).filter((h) => h && h.aktif !== false && Array.isArray(h.roller) && h.roller.some((r) => ['mudur', 'satis_mudur', 'servis_mudur', 'idari_mudur', 'direktor'].indexOf(r) >= 0));
  yonetici.forEach((h) => {
    const anahtarlar = new Set([adAnahtari(h.ad)].concat((ek[h.hid] || []).map(adAnahtari)).filter(Boolean));
    const liste = (personel || []).filter((p) => p && p.ad && anahtarlar.has(adAnahtari(p.mudurluk)) && adAnahtari(p.ad) !== adAnahtari(h.ad))
      .map((p) => ({ ad: temiz(p.ad, 120), departman: temiz(p.departman, 80), bolum: temiz(p.bolum, 40), unvan: temiz(p.unvan, 120), direktor: temiz(p.direktor, 120), giris: girisTr(p.giris) }))
      .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    if (liste.length) sonuc[h.hid] = { ad: temiz(h.ad, 120), liste: liste.slice(0, 200), adlar: liste.slice(0, 200).map((p) => p.ad) };
  });
  return sonuc;
}
/** Personel listesindeki farklı müdürlük ve direktör adları (ayarlar ekranı için) */
export function yoneticiAdlari(personel) {
  const m = new Map(), d = new Map();
  (personel || []).forEach((p) => { if (p.mudurluk) m.set(adAnahtari(p.mudurluk), p.mudurluk); if (p.direktor) d.set(adAnahtari(p.direktor), p.direktor); });
  const s = (x) => Array.from(x.values()).sort((a, b) => a.localeCompare(b, 'tr'));
  return { mudurlukler: s(m), direktorler: s(d) };
}
