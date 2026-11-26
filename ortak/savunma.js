/* ============================================================================
   SAVUNMA TALEPLERİ · ortak mantık (25.11.2026) — Firebase import ETMEZ (saf işlevler; testte tarayıcıda denenir)
   - Durumlar, konu listesi, alan sınırları (kural: guvenlik/firestore.rules SAVUNMA bölümü ile birebir)
   - Hukukçu şablonları: savunma istem yazısı (+ yazılı savunma alanı), olay tespit tutanağı, imtina tutanağı.
     Şablon talep bilgileriyle ANINDA doldurulur; ofis sahibi "ofis" yazınca Ajan Ofisi'ndeki Hukukçu taslağı talebe
     özel gözden geçirip `kaynak:'hukukcu'` olarak yeniden yazar. İK düzeltip onaylar.
   - Belge modeli: { baslik, ust:[[etiket, değer]], paragraflar:[metin], ozel:'savunma'|'tebellug'|null, imzalar:[{ baslik, ad, unvan }] }
     Aynı model hem ekranda (HTML önizleme) hem PDF'te (pdfmake, Roboto: Türkçe karakterli) kullanılır.
   - Hukuki görüş değildir; şablon dili 4857 sayılı İş Kanunu m.19 (savunma alınmadan fesih yapılamaz) ve yerleşik
     uygulamaya (tebliğ, makul süre, imtina tutanağı) göre yazılmıştır. İşyerine özel TİS/yönetmelik varsa İK uyarlar.
   ============================================================================ */

export const DURUM = {
  ik_onayinda: { ad: 'İK onayında', kisa: 'İK onayında', sinif: 'uy', sira: 1 },
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
  'İşyeri kurallarına aykırılık',
  'Diğer'
];
/* kural ile birebir: metin sınırları */
export const SINIR = { aciklama: 3000, yer: 120, tanik: 80, not: 1000, paragraf: 2500, paragrafSay: 12, ad: 120 };
export const SURE_VARSAYILAN = 2;          /* savunma için tebliğden itibaren iş günü (İK değiştirebilir, 1–7) */

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
function bilgi(t) {
  const c = t.calisan || {}, o = t.olay || {};
  return {
    ad: adGoster(c.ad), unvan: depGoster(c.unvan), dep: depGoster(c.departman), bolum: c.bolum || '',
    tarih: tarihTr(o.tarih), saat: o.saat || '', yer: o.yer || '', konu: o.konu || '', aciklama: String(o.aciklama || '').trim(),
    taniklar: (o.taniklar || []).filter(Boolean).map(adGoster), mudur: adGoster((t.mudur || {}).ad), mudurUnvan: (t.mudur || {}).unvan || 'Yönetici'
  };
}
const zamanMetni = (b) => b.tarih + (b.saat ? ' tarihinde saat ' + b.saat + ' sularında' : ' tarihinde') + (b.yer ? ', ' + b.yer + ' konumunda' : '');

/** Savunma istem yazısı (2. bölüm: çalışanın yazılı savunması için boş alan + tebellüğ) */
export function istemSablonu(t, sure) {
  const b = bilgi(t), gun = Math.min(7, Math.max(1, +sure || SURE_VARSAYILAN));
  return {
    baslik: 'SAVUNMA İSTEM YAZISI',
    ust: [['Sayın', b.ad], ['Unvanı', b.unvan], ['Departmanı', b.dep + (b.bolum ? ' / ' + b.bolum : '')], ['Konu', 'Yazılı savunmanızın istenmesi hk.']],
    paragraflar: [
      zamanMetni(b) + ' meydana geldiği tespit edilen ve aynı tarihli olay tespit tutanağı ile kayıt altına alınan "' + b.konu + '" konulu olayla ilgili olarak yöneticiniz tarafından İnsan Kaynakları Departmanına bildirimde bulunulmuştur.',
      'Olayın özeti: ' + b.aciklama,
      'Söz konusu davranışın iş sözleşmeniz, işyeri kuralları ve 4857 sayılı İş Kanunu hükümleri çerçevesinde değerlendirilebilmesi için yazılı savunmanızın alınmasına karar verilmiştir.',
      'İşbu yazının tarafınıza tebliğinden itibaren ' + gun + ' (' + ['bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi'][gun - 1] + ') iş günü içinde olayla ilgili yazılı savunmanızı bu yazının ikinci sayfasındaki bölüme ya da ayrı bir dilekçe ile yazarak yöneticinize veya İnsan Kaynakları Departmanına teslim etmeniz gerekmektedir. Savunmanızda olaya ilişkin açıklamalarınızı, varsa tanıklarınızı ve belgelerinizi belirtebilirsiniz.',
      'Belirtilen süre içinde yazılı savunma vermemeniz halinde savunma hakkınızı kullanmaktan vazgeçmiş sayılacağınızı ve durumun mevcut bilgi ve belgeler üzerinden değerlendirileceğini bilgilerinize sunarız.'
    ],
    ozel: 'savunma',
    imzalar: [{ baslik: 'İşveren / İşveren Vekili', ad: '', unvan: '' }, { baslik: 'Tebliğ Eden (Yönetici)', ad: b.mudur, unvan: b.mudurUnvan }]
  };
}
/** Olay tespit tutanağı */
export function tutanakSablonu(t) {
  const b = bilgi(t);
  const tanik = b.taniklar.length ? b.taniklar : ['', ''];
  while (tanik.length < 2) tanik.push('');
  return {
    baslik: 'OLAY TESPİT TUTANAĞI',
    ust: [['Olay tarihi', b.tarih + (b.saat ? ' · ' + b.saat : '')], ['Olay yeri', b.yer || '—'], ['İlgili çalışan', b.ad + ' · ' + b.unvan], ['Departmanı', b.dep + (b.bolum ? ' / ' + b.bolum : '')], ['Olayın konusu', b.konu],
      ['Tutanak tarihi / saati', '……/……/20……   saat ……:……']],
    paragraflar: [
      zamanMetni(b) + ' aşağıda açıklanan olay tarafımızca görülmüş ve tespit edilmiştir:',
      b.aciklama,
      'İşbu tutanak, olayın aynen tespiti amacıyla düzenlenmiş; okunarak aşağıda adı ve imzası bulunan kişilerce birlikte imza altına alınmıştır. Tutanak konusu çalışanın imzadan imtina etmesi halinde bu durum tutanağa ayrıca yazılır.'
    ],
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
      b.tarih + ' tarihli olayla ilgili olarak düzenlenen savunma istem yazısı ve olay tespit tutanağı, ……/……/20…… tarihinde saat ……:…… sularında, aşağıda imzası bulunan tanıklar huzurunda ' + b.ad + ' isimli çalışana tebliğ edilmek istenmiştir.',
      'Yazının içeriği çalışana okunmuş ve kendisine yazılı savunma verme hakkı bulunduğu, belirtilen süre içinde savunma vermemesi halinde savunma hakkını kullanmaktan vazgeçmiş sayılacağı sözlü olarak bildirilmiştir.',
      'Çalışan, söz konusu yazıyı tebellüğ etmekten / imzalamaktan ve yazılı savunma vermekten imtina etmiştir.',
      'İşbu tutanak, durumun tespiti amacıyla tarafımızca düzenlenerek birlikte imza altına alınmıştır.'
    ],
    ozel: null,
    imzalar: [{ baslik: 'Tebliğ Eden (Yönetici)', ad: b.mudur, unvan: b.mudurUnvan }].concat(tanik.map((a, i) => ({ baslik: (i + 1) + '. Tanık', ad: a, unvan: '' })))
  };
}
/** Taslak seti (İK ekranının başlangıcı). Kayıtlı taslak (ör. Hukukçu'nun gözden geçirdiği) varsa o kullanılır. */
export function taslakSeti(t, sure, kayitli) {
  const k = kayitli || {};
  return {
    istem: belgeGecerli(k.istem) ? k.istem : istemSablonu(t, sure),
    tutanak: belgeGecerli(k.tutanak) ? k.tutanak : tutanakSablonu(t),
    imtina: belgeGecerli(k.imtina) ? k.imtina : imtinaSablonu(t),
    kaynak: k.kaynak || 'sablon'
  };
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
    ozel: d.ozel === 'savunma' ? 'savunma' : null,
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
  /* imzalar (yazıyı düzenleyen / tebliğ eden / tanıklar) metnin hemen altında */
  const imz = d.imzalar || [];
  if (imz.length) {
    const sat = [];
    for (let i = 0; i < imz.length; i += 3) sat.push(imz.slice(i, i + 3));
    sat.forEach((s) => {
      while (s.length < 3) s.push(null);
      icerik.push({ columns: s.map((k) => (k ? { stack: [{ text: k.baslik, bold: true, fontSize: 9.5, color: LAC }, { text: k.ad || 'Ad Soyad: ……………………', fontSize: 9.5, margin: [0, 3, 0, 0] }, { text: k.unvan ? k.unvan : ' ', fontSize: 8.5, color: GRI }, { text: 'İmza:', fontSize: 9.5, margin: [0, 18, 0, 0] }] } : { text: '' })), columnGap: 18, margin: [0, 10, 0, 6], unbreakable: true });
    });
  }
  /* savunma istem yazısı: 1. sayfanın sonunda tebellüğ; 2. sayfa çalışanın yazılı savunması */
  if (d.ozel === 'savunma') {
    icerik.push({ stack: [
      { text: 'TEBELLÜĞ', bold: true, fontSize: 10.5, color: LAC, margin: [0, 0, 0, 4] },
      { text: 'İşbu yazının bir nüshasını ……/……/20…… tarihinde saat ……:…… da elden teslim aldım.', fontSize: 10, margin: [0, 0, 0, 6] },
      { columns: [{ text: 'Tebellüğ eden çalışan: ' + (o.calisan || ''), fontSize: 10 }, { text: 'İmza:', fontSize: 10, alignment: 'right' }] }
    ], margin: [0, 16, 0, 0], unbreakable: true });
    icerik.push({ text: 'ÇALIŞANIN YAZILI SAVUNMASI', bold: true, fontSize: 12, color: LAC, alignment: 'center', margin: [0, 0, 0, 4], pageBreak: 'before' });
    icerik.push({ text: (o.no ? o.no + ' numaralı ' : '') + 'savunma istem yazısına cevaben. Savunmanızı bu sayfaya ya da ayrı bir dilekçeye yazabilirsiniz.', fontSize: 9, color: GRI, alignment: 'center', margin: [0, 0, 0, 12] });
    icerik.push({ table: { widths: ['*'], body: Array.from({ length: 22 }, () => [{ text: ' ', fontSize: 11, margin: [0, 5, 0, 5] }]) },
      layout: { hLineColor: () => ACIK, vLineWidth: () => 0, hLineWidth: (i) => (i === 0 ? 0 : 0.6) }, margin: [0, 0, 0, 14] });
    icerik.push({ columns: [{ text: 'Tarih: ……/……/20……', fontSize: 10 }, { text: 'Çalışan Ad Soyad: ' + (o.calisan || '') + '\nİmza:', fontSize: 10, alignment: 'right', lineHeight: 1.6 }], unbreakable: true });
  }
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
      .map((p) => ({ ad: temiz(p.ad, 120), departman: temiz(p.departman, 80), bolum: temiz(p.bolum, 40), unvan: temiz(p.unvan, 120), direktor: temiz(p.direktor, 120) }))
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
