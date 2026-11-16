/* ============================================================================
   İnciroğlu Otomotiv · Personel Talepleri ve Açık Pozisyonlar   (ortak/personel-talep.js)
   ----------------------------------------------------------------------------
   Sayfa: personel-talep.html. Güvenlik kuralı: guvenlik/firestore.rules → "PERSONEL TALEPLERİ".
   Bu dosyadaki seçenek listeleri ve alan adları kuraldakilerle BİREBİR aynı olmalıdır
   (kural listeyi ve alanları sunucuda denetler; burada değişen bir metin kuralda da değişmeli).
   Kişi adı, e-posta ya da başka kişisel veri bu dosyada YOKTUR (depo herkese açık);
   onay zinciri İK'nın Firestore'a yüklediği talepAyar/zincir kaydından gelir.
   ============================================================================ */

/* ---------------------------------------------------------------- form seçenekleri (kuralla birebir) */
export const NEDENLER = ['Ek kadro', 'İş hacmi artışı', 'Yeni kadro açılması', 'Personel yedekleme', 'Organizasyonel revizyon', 'Yerine alım'];
export const IC_ADAY = ['İç aday değerlendirilebilir', 'İç aday talebi yoktur', 'Geliştirilebilir iç aday değerlendirilebilir'];
export const DEVAM = ['Sürdürülebilir', 'Kısa vadede sürdürülebilir', 'Sürdürülemez'];
export const RISKLER = ['İş kaybı', 'Müşteri memnuniyeti', 'Kalite etkisi'];
export const MARKA = ['Zorunlu kadro', 'Tavsiye edilen kadro', 'Zorunluluk yok'];
export const CINSIYET = ['Fark etmez', 'Kadın', 'Erkek'];
export const MEZUNIYET_ONERI = ['İlköğretim', 'Lise', 'Meslek lisesi', 'Ön lisans', 'Lisans', 'Yüksek lisans'];
export const FORM_ALANLARI = ['tarih', 'pozisyon', 'deneyim', 'mezuniyet', 'cinsiyet', 'beklentiler', 'sertifikalar', 'adayAd', 'adayYok',
  'gorevTanimi', 'nedenler', 'yerineKim', 'yerineCikis', 'aciklama', 'icAday', 'devam', 'devamAciklama', 'riskler', 'riskAciklama',
  'ucretYonetici', 'butceYillik', 'butceKullanilan', 'marka', 'markaDayanak'];
/* Metin alanlarının en fazla uzunluğu (kuraldaki metin(v, n) sınırlarıyla aynı) */
export const SINIR = {
  pozisyon: 120, deneyim: 300, mezuniyet: 200, beklentiler: 2000, sertifikalar: 500, adayAd: 120, gorevTanimi: 4000,
  yerineKim: 300, aciklama: 4000, devamAciklama: 1000, riskAciklama: 2000, markaDayanak: 1000, not: 1000, ikNot: 2000
};
export const UCRET_UST = 100000000;   /* TL; kuraldaki üst sınır */

/* ---------------------------------------------------------------- süreç */
export const ASAMALAR = [
  { kod: 'talep', ad: 'Talep eden yönetici', kisa: 'Talep eden' },
  { kod: 'direktor', ad: 'Onay veren direktör', kisa: 'Direktör' },
  { kod: 'ik', ad: 'İnsan Kaynakları Direktörü', kisa: 'İK Direktörü' },
  { kod: 'ceo', ad: 'CEO', kisa: 'CEO' }
];
export const KARARLAR = { direktor: ['onay', 'revize', 'red'], ik: ['onay', 'revize', 'red'], ceo: ['onay', 'revize', 'erteleme', 'red'] };
export const KARAR_SECIM = { onay: 'Onaylıyorum', revize: 'Revize istiyorum', red: 'Reddediyorum', erteleme: 'Erteliyorum' };
/* CEO sisteme girmez (kullanıcı kararı 16.11): kararını İK (İK rolü ya da İK Direktörü) işaretler */
export const CEO_SECIM = { onay: 'CEO onay verdi', revize: 'CEO revize istedi', erteleme: 'CEO erteledi', red: 'CEO reddetti' };
export const KARAR_SONUC = { onay: 'Onayladı', revize: 'Revize istedi', red: 'Reddetti', erteleme: 'Erteledi' };
export const SONRAKI = {
  direktor: { onay: 'ik', revize: 'revize', red: 'reddedildi' },
  ik: { onay: 'ceo', revize: 'revize', red: 'reddedildi' },
  ceo: { onay: 'onaylandi', revize: 'revize', erteleme: 'ertelendi', red: 'reddedildi' }
};
export const DURUM = {
  direktor: { ad: 'Direktör onayında', sinif: 'bekliyor', surecte: true },
  ik: { ad: 'İK Direktörü onayında', sinif: 'bekliyor', surecte: true },
  ceo: { ad: 'CEO kararı bekleniyor', sinif: 'bekliyor', surecte: true },
  onaylandi: { ad: 'Onaylandı', sinif: 'onay' },
  revize: { ad: 'Revize istendi', sinif: 'revize' },
  ertelendi: { ad: 'Ertelendi', sinif: 'revize' },
  reddedildi: { ad: 'Reddedildi', sinif: 'red' },
  iptal: { ad: 'İptal edildi', sinif: 'kapali' }
};
export const durumAdi = (d) => (DURUM[d] || { ad: d || '—' }).ad;
export const surecteMi = (d) => !!(DURUM[d] && DURUM[d].surecte);
/* Açık Pozisyonlar ekranındaki ONAY DURUMU (kullanıcı kararı 16.11): 4 aşamadan onaylı geçen → ONAYLI; CEO kararı
   verilmemiş (süreçte, revize, ertelenen) → ONAY AŞAMASINDA; reddedilen → ONAYLI DEĞİL. İptal edilen talep listelenmez. */
export const ONAY_DURUMU = {
  onayli: { ad: 'ONAYLI', sinif: 'onay' },
  asamada: { ad: 'ONAY AŞAMASINDA', sinif: 'bekliyor' },
  degil: { ad: 'ONAYLI DEĞİL', sinif: 'red' }
};
export function onayDurumu(durum) {
  if (durum === 'onaylandi') return 'onayli';
  if (durum === 'reddedildi') return 'degil';
  if (durum === 'iptal') return null;
  return 'asamada';
}
/** Talebin hangi aşamada beklediği (ONAY AŞAMASINDA alt metni) */
export const ASAMA_ACIKLAMA = { direktor: 'Direktörde', ik: 'İK Direktöründe', ceo: 'CEO kararı bekleniyor', revize: 'Revize istendi', ertelendi: 'CEO erteledi' };

/* Açık pozisyon */
export const POZ_DURUM = {
  acik: { ad: 'Açık', sinif: 'bekliyor', acik: true },
  ilanda: { ad: 'İlanda', sinif: 'bekliyor', acik: true },
  gorusme: { ad: 'Görüşmeler sürüyor', sinif: 'bekliyor', acik: true },
  teklif: { ad: 'Teklif aşamasında', sinif: 'bekliyor', acik: true },
  dolduruldu: { ad: 'Dolduruldu', sinif: 'onay' },
  iptal: { ad: 'İptal edildi', sinif: 'kapali' }
};
export const POZ_SIRA = ['acik', 'ilanda', 'gorusme', 'teklif', 'dolduruldu', 'iptal'];
export const KANALLAR = ['Kariyer.net', 'LinkedIn', 'Şirket içi duyuru', 'Referans', 'Distribütör / marka portalı', 'Diğer'];
export const pozAcikMi = (d) => !!(POZ_DURUM[d] && POZ_DURUM[d].acik);

/* ---------------------------------------------------------------- yardımcılar */
export const katla = (s) => String(s ?? '').toLocaleLowerCase('tr').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
export const adAnahtari = (s) => katla(s).replace(/[^a-z0-9]+/g, ' ').trim();
/** Departman anahtarı (Firestore harita anahtarı): "BMW" + "Satış" → "BMW_SATIS" */
export const depKey = (ad, bolum) => katla(String(ad || '') + ' ' + String(bolum || '')).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
/** Metin temizliği: boşluk kırpma, < > işaretlerini benzeriyle değiştirme (kural HTML etiketine izin vermez), uzunluk sınırı */
export function temiz(s, n = 200) {
  return String(s ?? '').replace(/\r\n?/g, '\n').replace(/</g, '‹').replace(/>/g, '›').replace(/[ \t]+\n/g, '\n').trim().slice(0, n);
}
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function trBaslik(s) {
  return String(s ?? '').toLocaleLowerCase('tr').replace(/(^|[\s\-/(.'’])([^\s\-/(.'’])/gu, (m, a, b) => a + b.toLocaleUpperCase('tr'));
}
export function sayiCoz(v) {
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  let s = String(v ?? '').replace(/\s|TL|₺/gi, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');      /* 45.000,50 → 45000.50 */
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');     /* 45.000 → 45000 (binlik ayraç) */
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}
export const tl = (n) => (typeof n === 'number' && isFinite(n) ? n.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' TL' : '—');
export const bugunISO = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export function tarihTR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
}
export function zamanCoz(t) {
  if (!t) return null;
  if (typeof t.toDate === 'function') return t.toDate();
  if (t instanceof Date) return t;
  if (typeof t === 'number') return new Date(t);
  if (typeof t.seconds === 'number') return new Date(t.seconds * 1000);
  return null;
}
export function zamanTR(t, saatli = true) {
  const d = zamanCoz(t);
  if (!d) return '';
  return d.toLocaleDateString('tr-TR') + (saatli ? ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '');
}
export const gunFarki = (a, b = new Date()) => { const d = zamanCoz(a); return d ? Math.max(0, Math.floor((zamanCoz(b) - d) / 86400000)) : null; };
/** Talep numarası: PT-YYAA-XXXX (belge kimliğinden) */
export const talepNo = (id, d = new Date()) => 'PT-' + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
/** Talebi görebilecek hesaplar (kural da birebir aynı diziyi ister). CEO sisteme girmez; CEO kararını İK işaretler. */
export const pidler = (talepEdenPid, zincir) => [talepEdenPid, zincir.direktor.pid, zincir.ik.pid];

/* ---------------------------------------------------------------- form */
export function formBos() {
  return {
    tarih: bugunISO(), pozisyon: '', deneyim: '', mezuniyet: '', cinsiyet: '', beklentiler: '', sertifikalar: '', adayAd: '', adayYok: false,
    gorevTanimi: '', nedenler: [], yerineKim: '', yerineCikis: '', aciklama: '', icAday: '', devam: '', devamAciklama: '', riskler: [], riskAciklama: '',
    ucretYonetici: null, butceYillik: null, butceKullanilan: null, marka: '', markaDayanak: ''
  };
}
/** Sunucuya gidecek formu kurar: yalnız bilinen alanlar, doğru türler, temiz metin */
export function formTemizle(f) {
  const g = Object.assign(formBos(), f || {});
  const say = (v) => { const n = sayiCoz(v); return isFinite(n) ? Math.round(n * 100) / 100 : null; };
  const yerine = (g.nedenler || []).includes('Yerine alım');
  return {
    tarih: /^\d{4}-\d{2}-\d{2}$/.test(g.tarih) ? g.tarih : bugunISO(),
    pozisyon: temiz(g.pozisyon, SINIR.pozisyon), deneyim: temiz(g.deneyim, SINIR.deneyim), mezuniyet: temiz(g.mezuniyet, SINIR.mezuniyet),
    cinsiyet: CINSIYET.includes(g.cinsiyet) ? g.cinsiyet : '', beklentiler: temiz(g.beklentiler, SINIR.beklentiler),
    sertifikalar: temiz(g.sertifikalar, SINIR.sertifikalar),
    adayAd: g.adayYok ? '' : temiz(g.adayAd, SINIR.adayAd), adayYok: !!g.adayYok,
    gorevTanimi: temiz(g.gorevTanimi, SINIR.gorevTanimi),
    nedenler: NEDENLER.filter((n) => (g.nedenler || []).includes(n)),
    yerineKim: yerine ? temiz(g.yerineKim, SINIR.yerineKim) : '', yerineCikis: yerine && /^\d{4}-\d{2}-\d{2}$/.test(g.yerineCikis) ? g.yerineCikis : '',
    aciklama: temiz(g.aciklama, SINIR.aciklama), icAday: IC_ADAY.includes(g.icAday) ? g.icAday : '',
    devam: DEVAM.includes(g.devam) ? g.devam : '', devamAciklama: g.devam === 'Sürdürülemez' ? temiz(g.devamAciklama, SINIR.devamAciklama) : '',
    riskler: RISKLER.filter((r) => (g.riskler || []).includes(r)), riskAciklama: temiz(g.riskAciklama, SINIR.riskAciklama),
    ucretYonetici: say(g.ucretYonetici), butceYillik: say(g.butceYillik), butceKullanilan: say(g.butceKullanilan),
    marka: MARKA.includes(g.marka) ? g.marka : '', markaDayanak: temiz(g.markaDayanak, SINIR.markaDayanak)
  };
}
/** Eksik / hatalı alanlar: [{alan, mesaj}] — boşsa form gönderilebilir. Kullanıcının isteği: HER bilgi eksiksiz girilir. */
export function formDogrula(ham) {
  const f = formTemizle(ham), h = [];
  const bos = (k, m) => { if (!f[k]) h.push({ alan: k, mesaj: m }); };
  bos('pozisyon', 'Pozisyon adını yazın.');
  bos('deneyim', 'Aranan deneyimi yazın.');
  bos('mezuniyet', 'Mezuniyet bilgisini yazın.');
  bos('cinsiyet', 'Cinsiyet tercihini seçin (tercih yoksa “Fark etmez”).');
  bos('beklentiler', 'Beklentileri yazın.');
  bos('sertifikalar', 'Gerekli sertifikaları yazın (gerekmiyorsa “Yok” yazın).');
  if (!f.adayYok && !f.adayAd) h.push({ alan: 'adayAd', mesaj: 'Önerilen adayın adını yazın ya da “Önerilen aday yok” kutusunu işaretleyin.' });
  if (f.gorevTanimi.length < 20) h.push({ alan: 'gorevTanimi', mesaj: 'Görev tanımını yazın (en az 20 karakter).' });
  if (!f.nedenler.length) h.push({ alan: 'nedenler', mesaj: 'En az bir talep nedeni seçin.' });
  if (f.nedenler.includes('Yerine alım')) {
    if (!f.yerineKim) h.push({ alan: 'yerineKim', mesaj: 'Yerine alım: kimin yerine alındığını yazın.' });
    if (!f.yerineCikis) h.push({ alan: 'yerineCikis', mesaj: 'Yerine alım: ayrılan kişinin çıkış tarihini seçin.' });
  }
  if (f.aciklama.length < 20) h.push({ alan: 'aciklama', mesaj: 'Alım talebinin detaylı açıklamasını yazın (en az 20 karakter).' });
  bos('icAday', 'İç aday değerlendirmesini seçin.');
  bos('devam', 'Eksik personelle devam edilebilirlik durumunu seçin.');
  if (f.devam === 'Sürdürülemez' && !f.devamAciklama) h.push({ alan: 'devamAciklama', mesaj: '“Sürdürülemez” seçildi: açıklamasını yazın.' });
  if (!f.riskler.length) h.push({ alan: 'riskler', mesaj: 'Pozisyon alınmazsa oluşacak en az bir riski seçin.' });
  bos('riskAciklama', 'Risklerin açıklamasını yazın (zorunlu alan).');
  const tutar = (k, m) => { const v = f[k]; if (v === null || v < 0 || v > UCRET_UST) h.push({ alan: k, mesaj: m }); };
  tutar('ucretYonetici', 'Yönetici ücret önerisini TL olarak yazın.');
  tutar('butceYillik', 'İlgili birimin yıllık bütçesini TL olarak yazın.');
  tutar('butceKullanilan', 'Bugüne kadar kullanılan bütçeyi TL olarak yazın.');
  bos('marka', 'Distribütör / marka zorunluluğunu seçin.');
  if (f.marka && f.marka !== 'Zorunluluk yok' && !f.markaDayanak) h.push({ alan: 'markaDayanak', mesaj: 'Marka zorunluluğunun dayanağını yazın (marka yazısı, denetim, KPI, sözleşme maddesi vb.).' });
  return h;
}
export const butceKalan = (f) => (typeof f.butceYillik === 'number' && typeof f.butceKullanilan === 'number' ? Math.round((f.butceYillik - f.butceKullanilan) * 100) / 100 : null);

/* ---------------------------------------------------------------- onay zinciri */
/** Bir departmanın onay zinciri (talebe kopyalanır; kural talepAyar/zincir ile BİREBİR eşitliğini ister) */
export function zincirKur(ayar, key) {
  const d = ayar && ayar.departmanlar && ayar.departmanlar[key];
  if (!d || !ayar.ikDirektor || !ayar.ceo) return null;
  return { direktor: d.direktor, ik: ayar.ikDirektor, ceo: ayar.ceo };
}
/** Zincirdeki eksikler (talep oluşturmayı engelleyenler ve yalnız uyarılar) */
export function zincirEksikleri(z) {
  const engel = [], uyari = [];
  if (!z) { engel.push('Bu departmanın onay zinciri tanımlı değil.'); return { engel, uyari }; }
  if (!z.direktor || !z.direktor.pid) engel.push('Departmanın direktörü tanımlı değil.');
  if (!z.ik || !z.ik.pid) engel.push('İnsan Kaynakları Direktörü tanımlı değil.');
  if (!z.ceo || !z.ceo.ad) engel.push('CEO tanımlı değil.');
  if (z.direktor && z.direktor.pid && !z.direktor.eposta) uyari.push('Direktörün e-posta adresi tanımlı değil; talep oluşur ama e-posta gönderilemez.');
  if (z.ik && z.ik.pid && !z.ik.eposta) uyari.push('İK Direktörünün e-posta adresi tanımlı değil.');
  return { engel, uyari };
}
export const EPOSTA_DESEN = /^[a-z0-9._%+-]+@inciroglu\.com\.tr$/;
export const epostaGecerli = (e) => EPOSTA_DESEN.test(String(e || ''));

/* E-posta şablonu bu dosyada DEĞİL: konu ve gövdeyi gönderici (ise-alim-sureci deposu, scripts/personel-talep-eposta.js)
   talep kaydından üretir; tarayıcı yalnız alıcı + şablon adı içeren kuyruk kaydı yazar (kural: ptEposta). */
