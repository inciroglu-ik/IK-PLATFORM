/* =============================================================================
   İnciroğlu Otomotiv · İşten Ayrılış Anketi — BAĞLANTI ORTAK MODÜLÜ (saf + arayüz; Firebase içermez)
   Kullananlar: ayrilis.html (İşten Ayrılış Anketleri) ve index.html (İK Dashboard › Personel hareketi / haftalık yükleme).
   • Hangi çıkışta anket bağlantısı otomatik oluşur: ANKET_NEDENLERI (kullanıcı kararı 13.11.2026) · yalnız tam zamanlı
     personel (stajyer / analist öğrenci / V.İ. hariç).
   • Kişi ↔ anket kaydı eşleştirmesi (mükerrer bağlantı oluşmasın): aynı ad (Türkçe katlamalı) + yakın çıkış tarihi.
   • Bağlantı penceresi: her kişi için bağlantı + hazır mesaj; "Kopyala", WhatsApp, e-posta.
   ============================================================================= */
import * as O from '../pano/ortak.js';

/** Otomatik anket bağlantısı açılan resmî (SGK) ayrılış nedenleri — paketteki / hareket kaydındaki yazımla aynı */
export const ANKET_NEDENLERI = ['İstifa', 'Deneme (İşçi)', 'Emeklilik', 'Askerlik'];
/** Bu çıkış için anket bağlantısı gerekir mi? (liste verilmişse yalnız 'normal' = tam zamanlı) */
export function anketGerekir(neden, dept, liste) {
  return ANKET_NEDENLERI.indexOf(neden) >= 0 && !O.isVI(dept || '') && (liste === undefined || liste === null || liste === 'normal');
}

/* ---------------------------------------------------------------- tarih / ad eşleştirme */
export function tarihCoz(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  if (typeof s.toDate === 'function') return s.toDate();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(String(s));
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
export const isoGun = (d) => (d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : '');
export const gunYaz = (d) => (d ? String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear() : '—');
export const adAnahtari = (s) => O.katla(s).replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
function lev(a, b) {
  if (a === b) return 0;
  const p = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let onceki = p[0]; p[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = p[j]; p[j] = Math.min(p[j] + 1, p[j - 1] + 1, onceki + (a[i - 1] === b[j - 1] ? 0 : 1)); onceki = t; }
  }
  return p[b.length];
}
/** Anket kaydı ({ad, cikis}) ↔ ayrılan kişi ({ad, tarih}): aynı ad ve ≤45 gün, ya da küçük yazım farkı (≤2) ve ≤10 gün */
export function eslesir(kayit, a) {
  const x = adAnahtari(kayit.ad), y = adAnahtari(a.ad);
  const t1 = tarihCoz(kayit.cikis), t2 = tarihCoz(a.tarih);
  if (!t1 || !t2) return x === y;
  const gun = Math.abs(t1 - t2) / 864e5;
  return (x === y && gun <= 45) || (lev(x, y) <= 2 && gun <= 10);
}

/* ---------------------------------------------------------------- bağlantı ve mesaj */
export function anketLinki(id, sayfa) { return new URL('anket.html', sayfa || location.href).href.split('#')[0].split('?')[0] + '#' + id; }
export function davetMesaji(ad, link) {
  const ilk = String(ad || '').trim().split(/\s+/)[0] || '';
  return 'Merhaba ' + O.trBaslik(ilk) + ',\n\nİnciroğlu Otomotiv’de birlikte çalıştığımız süre için teşekkür ederiz. Ayrılış nedenlerinizi anlamak ve çalışma koşullarımızı iyileştirmek için hazırladığımız kısa anketi (yaklaşık 5 dakika) doldurmanızı rica ederiz:\n\n' + link + '\n\nBağlantı size özeldir ve tek kullanımlıktır.\nİnciroğlu Otomotiv · İnsan Kaynakları';
}
const temiz = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
/** Bekleyen anket kaydının alanları (olusturma = sunucu saati ve belge kimliği çağıran tarafta eklenir).
    kisi: { ad, dept, unvan, tarih (çıkış), giris } — tarihler Date ya da GG.AA.YYYY / YYYY-AA-GG */
export function kayitVerisi(kisi, olusturan) {
  return {
    ad: temiz(O.trBaslik(kisi.ad || ''), 80), departman: temiz(kisi.dept || '', 80), pozisyon: temiz(O.trBaslik(kisi.unvan || ''), 120),
    giris: isoGun(tarihCoz(kisi.giris)), cikis: isoGun(tarihCoz(kisi.tarih)), durum: 'bekliyor', kaynak: 'link', olusturan: temiz(olusturan || '', 80)
  };
}

/* ---------------------------------------------------------------- kopyala */
export async function kopyala(metin, bildirim) {
  try { await navigator.clipboard.writeText(metin); }
  catch (e) {
    const t = document.createElement('textarea'); t.value = metin; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.append(t); t.select(); try { document.execCommand('copy'); } catch (e2) { /* elle kopyalanır */ } t.remove();
  }
  O.bildirim(bildirim || 'Kopyalandı');
}

/* ---------------------------------------------------------------- bağlantı listesi (pencere gövdesi) */
const SVG = (yol) => '<svg class="ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + yol + '</svg>';
const IK_KOPYA = SVG('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>');
const IK_GONDER = SVG('<path d="M20.5 3.5 3.5 10.5l7 3 3 7z"/><path d="m10.5 13.5 4-4"/>');
function stilEkle() {
  if (document.getElementById('ab-stil')) return;
  const s = document.createElement('style'); s.id = 'ab-stil';
  s.textContent = [
    '.ab-modal .modal{width:min(680px,100%)}',
    '.ab-modal .modal-ust{align-items:flex-start}',
    '.ab-modal .modal-govde{display:grid;gap:12px}',
    '.ab-liste{display:grid;gap:12px}',
    '.ab-kisi{border:1px solid var(--cizgi-1,#e4e8ee);border-radius:14px;padding:12px 14px;background:var(--yuzey-kart,#fff);display:grid;gap:8px}',
    '.ab-kisi-ust{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}',
    '.ab-kisi-ust b{font-size:14.5px;color:var(--metin-1,#151a23)}',
    '.ab-kisi-ust small{font-size:12px;color:var(--metin-3,#66707f)}',
    '.ab-kisi-ust .cip{margin-left:auto}',
    '.ab-link{display:flex;gap:8px;align-items:center;background:var(--n-50,#f5f7fa);border:1px solid var(--cizgi-1,#e4e8ee);border-radius:10px;padding:6px 6px 6px 10px}',
    '.ab-link code{flex:1;min-width:0;font-size:12px;color:var(--metin-2,#4f5868);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ab-eylem{display:flex;gap:6px;flex-wrap:wrap}',
    '.ab-eylem .btn,.ab-link .btn{height:32px;padding:0 12px;font-size:12.5px}',
    '.ab-eylem .btn svg,.ab-link .btn svg{width:14px;height:14px}',
    '.ab-hata{font-size:12.5px;color:#9b3a2e}',
    '.ab-bilgi{font-size:12.5px;line-height:1.55;color:var(--metin-2,#4f5868);margin:0}'
  ].join('');
  document.head.append(s);
}
/** kisiler: [{ ad, dept, unvan, tarih, id?, durum:'yeni'|'vardi', hata? }] → liste düğümü (pencere gövdesine konur) */
export function baglantiListesi(kisiler, sayfa) {
  stilEkle();
  const l = O.el('div', { class: 'ab-liste' });
  kisiler.forEach((k) => {
    const kart = O.el('div', { class: 'ab-kisi', 'data-ab': k.id || '' });
    kart.append(O.el('div', { class: 'ab-kisi-ust' }, O.el('b', { text: O.trBaslik(k.ad || '') }),
      O.el('small', { text: [k.dept, k.unvan ? O.trBaslik(k.unvan) : '', 'Çıkış ' + gunYaz(tarihCoz(k.tarih))].filter(Boolean).join(' · ') }),
      k.hata ? null : O.el('span', { class: 'cip ' + (k.durum === 'yeni' ? 'cip-ok' : 'cip-bilgi'), text: k.durum === 'yeni' ? 'Bağlantı oluşturuldu' : 'Bağlantısı zaten vardı' })));
    if (k.hata) { kart.append(O.el('div', { class: 'ab-hata', text: 'Bağlantı oluşturulamadı: ' + (k.hata.code === 'permission-denied' ? 'yetki reddedildi (güvenlik kuralı yayınlanmamış olabilir).' : (k.hata.message || 'bilinmeyen hata')) + ' İşten Ayrılış Anketleri sayfasından elle oluşturabilirsiniz.' })); l.append(kart); return; }
    const link = anketLinki(k.id, sayfa), mesaj = davetMesaji(k.ad, link);
    kart.append(O.el('div', { class: 'ab-link' }, O.el('code', { text: link, title: link }),
      O.el('button', { class: 'btn', type: 'button', 'data-kopya': 'link', html: IK_KOPYA + '<span>Bağlantı</span>', on: { click: () => kopyala(link, 'Bağlantı kopyalandı') } })));
    kart.append(O.el('div', { class: 'ab-eylem' },
      O.el('button', { class: 'btn btn-pirinc', type: 'button', 'data-kopya': 'mesaj', html: IK_KOPYA + '<span>Mesajı kopyala</span>', on: { click: () => kopyala(mesaj, 'Mesaj kopyalandı · yapıştırıp gönderebilirsiniz') } }),
      O.el('a', { class: 'btn', href: 'https://wa.me/?text=' + encodeURIComponent(mesaj), target: '_blank', rel: 'noopener', html: IK_GONDER + '<span>WhatsApp</span>' }),
      O.el('a', { class: 'btn', href: 'mailto:?subject=' + encodeURIComponent('İşten Ayrılış Anketi · İnciroğlu Otomotiv') + '&body=' + encodeURIComponent(mesaj), html: O.ikon('dosya') + '<span>E-posta</span>' })));
    l.append(kart);
  });
  return l;
}
