/* =============================================================================
   İnciroğlu Otomotiv · KİŞİYE ÖZEL ORYANTASYON FORMU — ortak hesaplar (saf; Firebase içermez)
   Kullananlar: oryantasyon.html (İK: kişi formu, sorumlu bildirimi) · index.html (İK Dashboard: haftalık veri /
   işe giriş hareketinde yeni başlayan için formu otomatik açma + ik@ bildirimi).
   E-postalar Firestore'daki epostaKuyrugu'na yazılır; gönderimi GitHub Actions görevi yapar (ise-alim-sureci deposu,
   scripts/eposta-kuyrugu.js — işe alım hatırlatmalarıyla aynı Gmail altyapısı).
   ============================================================================= */
import * as F from './oryantasyon-fark.js';

/** İK'nın ortak adresi (yeni başlayan bildirimi) ve yalnız bu alan adına e-posta gönderilir (kuralda da aynı) */
export const IK_EPOSTA = 'ik@inciroglu.com.tr';
export const ALAN_ADI = '@inciroglu.com.tr';
export const epostaGecerli = (e) => /^[a-z0-9._%+-]+@inciroglu\.com\.tr$/i.test(String(e || '').trim());

const katla = (s) => String(s == null ? '' : s).toLocaleLowerCase('tr').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
export const adAnahtari = katla;

/** Unvan metni → oryantasyon formu olan unvan kodu (yalnız otomatik açılan 4 unvan) */
const OTOMATIK = [
  { kod: 'satis-danismani', re: /\bsatis danismani\b/ },
  { kod: 'servis-danismani', re: /\bservis danismani\b/ },
  { kod: 'satis-muduru', re: /\bsatis muduru\b/ },
  { kod: 'servis-muduru', re: /\bservis muduru\b/ }
];
/* "Satış Müdürü Yardımcısı", "Yedek Parça Satış Danışmanı" gibi farklı görevler otomatik açılmaz
   (Kıdemli / Hasar / Filo gibi aynı görevin türevleri açılır) */
const OTOMATIK_DISI = /\byardimci|\byedek parca\b/;
export function otomatikUnvanKodu(unvan) {
  const k = katla(unvan);
  if (OTOMATIK_DISI.test(k)) return null;
  const x = OTOMATIK.find((o) => o.re.test(k));
  return x ? x.kod : null;
}

/** Tarih (Date | GG.AA.YYYY | YYYY-AA-GG) → YYYY-AA-GG */
export function isoTarih(v) {
  if (!v) return '';
  if (v instanceof Date) return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(String(v));
  return m ? m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0') : '';
}
/** Aynı kişi + aynı işe giriş (±10 gün) → aynı kişi formu (mükerrer açılmasın) */
export function ayniKisi(a, b) {
  if (katla(a.ad) !== katla(b.ad)) return false;
  const t1 = isoTarih(a.iseGiris), t2 = isoTarih(b.iseGiris);
  if (!t1 || !t2) return true;
  return Math.abs(new Date(t1) - new Date(t2)) / 864e5 <= 10;
}

/** Formdaki her sorumlu → kendisine düşen maddeler [{ bolum, plan, kapsam, termin, saat, sure }] (ad sırasıyla) */
export function sorumluGorevleri(form) {
  /* "Ali Veli" ile "ALİ VELİ" aynı kişidir: harf / büyük-küçük harf duyarsız birleştirilir, ilk yazılışı gösterilir */
  const m = new Map(), ad = new Map();
  ((form && form.bolumler) || []).forEach((b) => (b.maddeler || []).forEach((x) => {
    F.sorumlular(x.sorumlu).forEach((a) => {
      const k = katla(a); if (!k) return;
      if (!ad.has(k)) { ad.set(k, a); m.set(a, []); }
      m.get(ad.get(k)).push({ bolum: b.ad || '', plan: x.plan || '', kapsam: x.kapsam || '', termin: x.termin || '', saat: x.saat || '', sure: x.sure || '' });
    });
  }));
  return m;
}
/** Bir sorumlunun görev listesinin özeti (değişti mi? karşılaştırması için). Tarih / saat / süreyi sorumlu kendisi
    doldurduğundan imzaya girmez: yalnız konu (gün planı + kapsam) değişince yeniden bildirilir. */
export const gorevImzasi = (liste) => JSON.stringify((liste || []).map((g) => [g.plan, g.kapsam]));

/* ---------------------------------------------------------------- sorumlu doldurma bağlantısı (oryantasyonYetki/{y_…})
   Her sorumluya kişiye özel bağlantı: oryantasyon-sorumlu.html#y_<32 onaltılık>. Kayıtta formun tamamı (gorunum)
   ve sorumlunun kendi satırları (satirlar) durur (yalnız İK yazar). Sorumlu kendi satırlarının Tarih / Saat / Süre /
   Not değerlerini satır başına ayrı kayda yazar: oryantasyonYetki/{y_…}/oryGirdi/{maddeKimligi} (kural: yalnız kendi
   satırı, yalnız izinli biçimler, zaman sunucu saati). İK ekranı girdileri forma uygular. */
export const GIRDI_NOT_SINIRI = 500;
/** Satır "dolduruldu" sayılır: tarihi ve saati var (liste sütunu, sorumlu sayfası sayacı aynı tanımı kullanır) */
export const satirDolu = (m) => !!(m && m.termin && m.saat);
export const yetkiAnahtariGecerli = (t) => /^y_[0-9a-f]{32}$/.test(String(t || ''));
export function yetkiAnahtariUret() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return 'y_' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
/** Sorumlunun girdiği değerler — yalnız geçerli biçimler alınır (kural iç değerleri denetleyemez, burada temizlenir) */
export function girdiTemizle(g) {
  g = g || {};
  return {
    termin: /^\d{4}-\d{2}-\d{2}$/.test(String(g.termin || '')) ? g.termin : '',
    saat: F.SAATLER.indexOf(g.saat) >= 0 ? g.saat : '',
    sure: F.SURELER.indexOf(g.sure) >= 0 ? g.sure : '',
    aciklama: F.temiz(g.aciklama || '', GIRDI_NOT_SINIRI)
  };
}
/** Zaman → milisaniye (Firestore zaman damgası, {seconds}, ISO metin) */
export const zamanMs = (z) => {
  if (!z) return 0;
  if (typeof z.toMillis === 'function') return z.toMillis();
  if (typeof z.seconds === 'number') return z.seconds * 1000 + Math.floor((z.nanoseconds || 0) / 1e6);
  const t = Date.parse(z); return isNaN(t) ? 0 : t;
};
/** Bir satırın sahibi mi? (satırın sorumluları arasında bu ad var mı — harf duyarsız) */
export const satirSahibi = (madde, ad) => F.sorumlular(madde && madde.sorumlu).some((a) => katla(a) === katla(ad));
/** Sorumlunun formdaki satırları (madde kimlikleri) */
export function sahipSatirlari(form, ad) {
  const r = [];
  ((form && form.bolumler) || []).forEach((b) => (b.maddeler || []).forEach((m) => { if (satirSahibi(m, ad)) r.push(m.id); }));
  return r;
}
/** Etkin form: kişi formu + sorumluların kendi satırlarına girdiği değerler (satır şu an o sorumlunun ise; birden çok
    sorumlu girdiyse en son girilen). bilgi: satır → { ad, zaman } (ekranda "sorumlu girdi" etiketi için) */
export function etkinForm(form, yetkiler) {
  const f = JSON.parse(JSON.stringify(form || { alanlar: [], bolumler: [] }));
  const bilgi = new Map();
  (f.bolumler || []).forEach((b) => (b.maddeler || []).forEach((m) => {
    let son = null;
    (yetkiler || []).forEach((y) => {
      if (!y || (y.satirlar || []).indexOf(m.id) < 0 || !satirSahibi(m, y.ad)) return;
      const g = y.girdiler && y.girdiler[m.id]; if (!g) return;
      const z = zamanMs(g.zaman);
      if (!son || z > son.z) son = { g, z, ad: g.ik ? 'İnsan Kaynakları' : y.ad };
    });
    if (son) { Object.assign(m, girdiTemizle(son.g)); bilgi.set(m.id, { ad: son.ad, zaman: son.z }); }
  }));
  return { form: f, bilgi };
}
/** Sorumlu sayfasında gösterilen görünüm (formun tamamı; yalnız gerekli alanlar) */
export function gorunumYap(form) {
  return { bolumler: ((form && form.bolumler) || []).map((b) => ({ ad: b.ad || '', maddeler: (b.maddeler || []).map((m) => ({
    id: m.id, plan: m.plan || '', kapsam: m.kapsam || '', sorumlu: m.sorumlu || '', termin: m.termin || '', saat: m.saat || '', sure: m.sure || '', aciklama: m.aciklama || '' })) })) };
}
/** Anahtar sırasından bağımsız karşılaştırma metni (Firestore haritaları farklı sırayla döndürebilir) */
export function kanonik(v) {
  if (Array.isArray(v)) return '[' + v.map(kanonik).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + kanonik(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
/** Önceki bildirimin durumu: yok → 'yeni' · e-postası gönderilemedi / iptal → 'hata' · görevleri değişti → 'degisti' · aynı → 'ayni'
    (basarisiz: gönderilemeyen ya da iptal edilen kuyruk kayıtlarının kimlikleri) */
export function bildirimDurumu(onceki, imza, basarisiz) {
  if (!onceki) return 'yeni';
  if (onceki.kuyruk && basarisiz && basarisiz.has(onceki.kuyruk)) return 'hata';
  return onceki.imza !== imza ? 'degisti' : 'ayni';
}

/** Ad → e-posta (yüklenen e-posta listesinden; Türkçe harf ve büyük/küçük harf duyarsız) */
export function epostaBul(liste, ad) {
  const k = katla(ad);
  const x = (liste || []).find((e) => katla(e.ad) === k);
  return x && epostaGecerli(x.eposta) ? String(x.eposta).trim().toLowerCase() : '';
}

/* ---------------------------------------------------------------- e-posta metinleri (kurumsal, tablo tabanlı HTML) */
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FONT = "font-family:'Segoe UI',Calibri,Arial,sans-serif;";
function kabuk(baslik, altBaslik, govde) {
  return '<div style="background:#f3f5f8;padding:20px 10px;"><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:100%;background:#ffffff;border:1px solid #d8dde5;margin:0 auto;">'
    + '<tr><td style="background:#132a46;padding:18px 26px;"><div style="' + FONT + 'font-size:11px;letter-spacing:1.4px;font-weight:bold;color:#e9d5a8;">İNCİROĞLU OTOMOTİV · İNSAN KAYNAKLARI</div>'
    + '<div style="' + FONT + 'font-size:21px;line-height:27px;font-weight:bold;color:#ffffff;padding-top:5px;">' + esc(baslik) + '</div>'
    + (altBaslik ? '<div style="' + FONT + 'font-size:13px;color:#c9d4e5;padding-top:3px;">' + esc(altBaslik) + '</div>' : '') + '</td></tr>'
    + '<tr><td style="height:4px;background:#b98b37;font-size:0;line-height:0;">&nbsp;</td></tr>'
    + '<tr><td style="padding:22px 26px 24px 26px;' + FONT + 'font-size:14px;line-height:22px;color:#151a23;">' + govde
    + '<p style="margin:18px 0 0 0;">Saygılarımızla,<br><b>İnsan Kaynakları</b><br><span style="color:#66707f;">İnciroğlu Otomotiv</span></p></td></tr>'
    + '<tr><td style="background:#f3f5f8;padding:10px 26px;border-top:1px solid #d8dde5;' + FONT + 'font-size:11px;color:#66707f;">Bu e-posta İK Portalı’ndaki Oryantasyon Formları sisteminden otomatik gönderilmiştir.</td></tr></table></div>';
}
const ilkAd = (ad) => { const p = String(ad || '').trim().split(/\s+/); return p[0] ? p[0].charAt(0).toLocaleUpperCase('tr') + p[0].slice(1) : ''; };
/** Sorumluya: "X isimli kişi Y pozisyonunda işe başlamıştır; aşağıdaki konularda oryantasyon sorumlusu olarak seçildiniz" */
export function sorumluEpostasi({ sorumlu, kisi, unvan, dept, iseGiris, gorevler, guncelleme, baglanti }) {
  const satir = (g, i) => '<tr><td style="padding:8px 10px;border-bottom:1px solid #e4e8ee;' + FONT + 'font-size:13px;color:#66707f;" valign="top">' + (i + 1) + '</td>'
    + '<td style="padding:8px 10px;border-bottom:1px solid #e4e8ee;' + FONT + 'font-size:13px;color:#151a23;" valign="top"><b>' + esc(g.plan) + '</b>' + (g.kapsam ? '<br><span style="color:#4f5868;">' + esc(g.kapsam) + '</span>' : '') + '</td>'
    + '<td style="padding:8px 10px;border-bottom:1px solid #e4e8ee;' + FONT + 'font-size:13px;color:#151a23;white-space:nowrap;" valign="top">' + esc(F.tarihGoster(g.termin) || '—') + '</td>'
    + '<td style="padding:8px 10px;border-bottom:1px solid #e4e8ee;' + FONT + 'font-size:13px;color:#151a23;white-space:nowrap;" valign="top">' + esc(g.saat || '—') + '</td>'
    + '<td style="padding:8px 10px;border-bottom:1px solid #e4e8ee;' + FONT + 'font-size:13px;color:#151a23;white-space:nowrap;" valign="top">' + esc(g.sure || '—') + '</td></tr>';
  const bas = (t) => '<td style="padding:8px 10px;background:#1b3a5e;' + FONT + 'font-size:12px;font-weight:bold;color:#ffffff;">' + t + '</td>';
  const govde = '<p style="margin:0 0 12px 0;">Sayın ' + esc(sorumlu) + ',</p>'
    + '<p style="margin:0 0 12px 0;">' + (iseGiris ? esc(F.tarihGoster(iseGiris)) + ' tarihinde ' : '') + '<b>' + esc(kisi) + '</b> isimli çalışma arkadaşımız <b>' + esc(unvan) + '</b> pozisyonunda' + (dept ? ' (' + esc(dept) + ')' : '') + ' işe başlamıştır. '
    + 'Kendisine verilecek aşağıdaki konularda <b>oryantasyon sorumlusu</b> olarak seçildiniz.' + (guncelleme ? ' <i>(Oryantasyon planında sizinle ilgili güncelleme yapıldı; güncel liste aşağıdadır.)</i>' : '') + '</p>'
    + (baglanti ? '<p style="margin:0 0 12px 0;">Bu konuların <b>tarih, saat ve süresini</b> aşağıdaki bağlantıdan siz belirleyiniz. Aynı sayfada oryantasyon planının tamamını da görebilirsiniz; yalnız kendi konularınızı düzenleyebilirsiniz.</p>' : '')
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #d8dde5;border-collapse:collapse;"><tr>' + bas('#') + bas('Konu') + bas('Tarih') + bas('Saat') + bas('Süre') + '</tr>'
    + gorevler.map(satir).join('') + '</table>'
    + (baglanti ? '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;"><tr><td style="background:#1b3a5e;padding:11px 18px;' + FONT + 'font-size:14px;font-weight:bold;"><a href="' + esc(baglanti) + '" style="color:#ffffff;text-decoration:none;">Oryantasyon planını aç ve kendi konularımı doldur &rarr;</a></td></tr></table>'
      + '<p style="margin:8px 0 0 0;font-size:12px;color:#66707f;">Bağlantı size özeldir, lütfen başkasıyla paylaşmayınız.</p>' : '')
    + '<p style="margin:14px 0 0 0;">Oryantasyonu verdikten sonra formdaki ilgili satırı imzalamanızı rica ederiz. Sorularınız için İnsan Kaynakları ile iletişime geçebilirsiniz.</p>';
  return { konu: 'Oryantasyon sorumluluğu · ' + kisi + ' (' + unvan + ')', html: kabuk('Oryantasyon sorumluluğu', kisi + ' · ' + unvan, govde) };
}
/** İK'ya: "xx.xx.xxxx tarihinde Y isimli personel Z pozisyonunda işe başlamıştır; oryantasyon formunu hazırlayınız" */
export function yeniBaslayanEpostasi({ ad, unvan, dept, iseGiris, sayfa }) {
  const govde = '<p style="margin:0 0 12px 0;">Merhaba,</p>'
    + '<p style="margin:0 0 12px 0;">' + (iseGiris ? '<b>' + esc(F.tarihGoster(iseGiris)) + '</b> tarihinde ' : '') + '<b>' + esc(ad) + '</b> isimli personel <b>' + esc(unvan) + '</b> pozisyonunda' + (dept ? ' (' + esc(dept) + ')' : '') + ' işe başlamıştır.</p>'
    + '<p style="margin:0 0 12px 0;">Kişiye özel oryantasyon formu, unvanın ana formundan oluşturuldu ve İK Portalı › Oryantasyon Formları sayfasında “Hazırlanacak” olarak sizi bekliyor. '
    + 'Oryantasyon sorumlularını, tarih ve saatleri belirleyerek formu hazırlamanızı rica ederiz.</p>'
    + (sayfa ? '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;"><tr><td style="background:#1b3a5e;padding:9px 16px;' + FONT + 'font-size:13px;font-weight:bold;"><a href="' + esc(sayfa) + '" style="color:#ffffff;text-decoration:none;">Oryantasyon formunu aç &rarr;</a></td></tr></table>' : '');
  return { konu: 'Yeni başlayan · ' + ad + ' (' + unvan + ') · oryantasyon formu hazırlanacak', html: kabuk('Yeni başlayan personel', ad + ' · ' + unvan, govde) };
}
/** Yeni başlayan danışmanın marka müdürü(leri): aynı departmanda Satış Müdürü (satış danışmanı için) ya da Servis Müdürü
    (servis danışmanı için). Müdür işe başladığında otomatik müdür bildirimi yok (direktörlerin markası veride yok).
    liste: aktif personel [{ ad, dept, unvan }] → müdür adları */
export function markaMudurleri(liste, kisi) {
  const kod = otomatikUnvanKodu(kisi && kisi.unvan);
  const re = kod === 'satis-danismani' ? /\bsatis muduru\b/ : kod === 'servis-danismani' ? /\bservis muduru\b/ : null;
  if (!re || !kisi.dept) return [];
  const d = katla(kisi.dept), kendi = katla(kisi.ad), gor = new Set();
  return (liste || []).filter((p) => p && p.ad && katla(p.dept) === d && re.test(katla(p.unvan)) && !OTOMATIK_DISI.test(katla(p.unvan)) && katla(p.ad) !== kendi)
    .map((p) => String(p.ad).trim()).filter((a) => { const k = katla(a); if (gor.has(k)) return false; gor.add(k); return true; });
}
/** Marka müdürüne: "X isimli çalışma arkadaşımız Y pozisyonunda ekibinize katılmıştır; oryantasyon formu İK tarafından hazırlanıyor" */
export function mudurBilgiEpostasi({ mudur, ad, unvan, dept, iseGiris }) {
  const govde = '<p style="margin:0 0 12px 0;">Sayın ' + esc(mudur) + ',</p>'
    + '<p style="margin:0 0 12px 0;">' + (iseGiris ? '<b>' + esc(F.tarihGoster(iseGiris)) + '</b> tarihinde ' : '') + '<b>' + esc(ad) + '</b> isimli çalışma arkadaşımız <b>' + esc(unvan) + '</b> pozisyonunda' + (dept ? ' (' + esc(dept) + ')' : '') + ' ekibinize katılmıştır.</p>'
    + '<p style="margin:0 0 12px 0;">Kişiye özel oryantasyon formu İnsan Kaynakları tarafından hazırlanmaktadır. Oryantasyonda sorumlu olarak seçildiğiniz konular, tarih ve saatleriyle birlikte ayrıca e-postayla bildirilecektir.</p>'
    + '<p style="margin:0;">Yeni çalışma arkadaşımızın ilk günlerinde ekibe uyumu için desteğinizi rica ederiz.</p>';
  return { konu: 'Ekibinize katılım · ' + ad + ' (' + unvan + ')', html: kabuk('Ekibinize yeni katılım', ad + ' · ' + unvan, govde) };
}
/** E-posta kuyruğu kaydı (kural: epostaKuyrugu — alanlar ve sınırlar burada ve kuralda aynı; görünen adda @ , ; " olamaz) */
export function kuyrukKaydi({ kime, kimeAd, konu, html, kaynak, ilgili }) {
  return { kime: String(kime).trim().toLowerCase(), kimeAd: String(kimeAd || '').replace(/[<>@,;"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120), konu: String(konu || '').replace(/[<>]/g, ' ').slice(0, 200),
    html: String(html || '').slice(0, 60000), kaynak: kaynak || 'oryantasyon', ilgili: String(ilgili || '').slice(0, 120), durum: 'bekliyor' };
}
