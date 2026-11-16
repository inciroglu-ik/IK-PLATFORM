/* ==========================================================================
   İK DASHBOARD 2.0 · YÖNETİCİ ÖZETİ  (pano/sayfa-ozet.js)
   --------------------------------------------------------------------------
   Kurula gidecek TEK EKRANLIK özet: 16:9 tuval (1600×900), kaydırma yok, kişi adı yok.
   • Sayılar haftalık paketten okunur; ozet metrikleri (turnover %, kıdem) YENİDEN HESAPLANMAZ (KABUK §1).
   • Global departman filtresi bu sayfayı ETKİLEMEZ: özet her zaman şirket geneli (B.D, filtresiz).
   • Bölüm dağılımı ozet.bolum_mevcut'tan okunur (Excel Dashboard'da içinde bulunulan ayın Satış/Servis/
     İdari satırı). Paket bu alanı taşımıyorsa "—" yazılır; çalışan listesinden SAYILMAZ (liste serbest
     çalışanı içermediği için toplam personel mevcuduyla tutmaz).
   • Stajyer sayısı: ozet.stajyer_elle varsa o (ofis sahibinin elle verdiği sayı, 16.11.2026), yoksa
     ozet.stajyer_sayisi. Elle sayı varken "Toplam kayıt" aynı sayfada tutarlı olsun diye bileşenlerden kurulur.
   • 16.11.2026 yönetici geri bildirimi: istenen/istenmeyen ve simüle yıl sonu kartları ile "Öne çıkanlar"
     paneli KALDIRILDI; V.İ. ve stajyer ayrı kart; personel grafiğinde 2025/2026 ayrımı ay adlarıyla altta.
   • Çıktı: Sunum görünümü (tam ekran) · Görseli indir (PNG 3200×1800, html2canvas cdnjs, yalnız tıklayınca
     yüklenir) · Yazdır (A4 yatay tek sayfa, ölçek CSS'te).
   Firebase import ETMEZ. Sözleşme: pano/KABUK.md
   ========================================================================== */
import * as O from './ortak.js';

export const meta = { id: 'oz', baslik: 'Yönetici Özeti', ikon: O.ikon('performans') };

const W = 1600, H = 900, BASKI_GENISLIK = 1040; /* A4 yatay, 8 mm kenar ≈ 1060 px; küçük pay */
const H2C = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
const BOLUM_SIRA = ['Satış', 'Servis', 'İdari'];

let gozlem = null, sahneEl = null, tuvalEl = null, h2cSoz = null;
const dinleyiciler = [];

export function ciz(kok, B) {
  const M = hesapla(B);
  kok.append(O.el('style', { text: STIL }));
  aracCiz(kok, B, M);
  sahneEl = O.el('div', { class: 'oz-sahne' });
  tuvalEl = O.el('div', { class: 'oz-tuval', 'aria-label': 'Yönetici özeti · ' + (M.hafta || '') });
  sahneEl.append(tuvalEl);
  kok.append(sahneEl);
  bantCiz(tuvalEl, M);
  kpiCiz(tuvalEl, M);
  grafiklerCiz(tuvalEl, M);
  panellerCiz(tuvalEl, M);
  tuvalEl.append(O.el('div', { class: 'oz-dip' },
    O.el('span', { text: 'Kaynak: ' + (M.hafta ? M.hafta + ' ' : '') + 'İK raporu · şirket geneli · kişi bilgisi içermez' }),
    O.el('span', { text: M.ayDevam ? '* ' + O.ayAdi(M.sonAy) + ' ayı devam ediyor' : '' })));
  olcekle();
  if (window.ResizeObserver) { gozlem = new ResizeObserver(() => requestAnimationFrame(olcekle)); gozlem.observe(kok); }
  dinle(window, 'resize', olcekle);
  dinle(document, 'fullscreenchange', olcekle);
  dinle(window, 'beforeprint', baskiOlcek);
  dinle(window, 'afterprint', olcekle);
}

export function temizle() {
  if (gozlem) { gozlem.disconnect(); gozlem = null; }
  while (dinleyiciler.length) { const [h, o, f] = dinleyiciler.pop(); h.removeEventListener(o, f); }
  if (document.fullscreenElement && document.fullscreenElement === sahneEl) { try { document.exitFullscreen(); } catch (e) { /* zaten kapalı */ } }
  sahneEl = null; tuvalEl = null;
}
function dinle(hedef, olay, fn) { hedef.addEventListener(olay, fn); dinleyiciler.push([hedef, olay, fn]); }

/* ==========================================================================
   HESAP — yalnız okuma; ozet değerleri olduğu gibi
   ========================================================================== */
const sayiMi = (v) => v !== null && v !== undefined && v !== '' && !isNaN(+v);
const n = (v) => (sayiMi(v) ? +v : null);

function tarihAraligi(short) {
  const m = String(short || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\D+(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  return { b: new Date(+m[3], +m[2] - 1, +m[1]), s: new Date(+m[6], +m[5] - 1, +m[4]) };
}
function aralikMetni(t) {
  if (!t) return '';
  const { b, s } = t;
  if (b.getMonth() === s.getMonth() && b.getFullYear() === s.getFullYear()) return b.getDate() + ' – ' + s.getDate() + ' ' + O.ayAdi(s.getMonth() + 1) + ' ' + s.getFullYear();
  return b.getDate() + ' ' + O.ayAdi(b.getMonth() + 1) + ' – ' + s.getDate() + ' ' + O.ayAdi(s.getMonth() + 1) + ' ' + s.getFullYear();
}

function hesapla(B) {
  const D = B.D || {}, oz = D.ozet || {}, pw = oz.prev_week || {};
  const aylar = O.aylar(D), sonAy = aylar[aylar.length - 1] || 0;
  const tv = D.turnover || [];
  const cikisAy = aylar.map((m) => { const t = tv.find((x) => O.donemAyi(x.donem) === m); return t ? (n(t.cikis_asil) ?? n(t.cikis) ?? 0) : 0; });
  const girisAy = O.aySay(D.isealim || [], aylar); /* Turnover sayfasıyla aynı yöntem: girişler işe alım listesinden */
  const hc = B.MONTHLY_HC || {};
  const aralik = tarihAraligi(B.etiket && B.etiket.short);
  /* Haftanın son günü ayın son günü değilse ve son veri ayı o aysa: ay devam ediyor (*) */
  let ayDevam = false;
  if (aralik && sonAy === aralik.s.getMonth() + 1) { const ayinSonu = new Date(aralik.s.getFullYear(), aralik.s.getMonth() + 1, 0).getDate(); ayDevam = aralik.s.getDate() < ayinSonu; }
  /* çoktan aza; "Diğer" her zaman en sonda */
  const nedenler = O.grupSay(D.ayrilanlar || [], (a) => a.neden || 'Diğer').sort((x, y) => (x[0] === 'Diğer') - (y[0] === 'Diğer') || y[1] - x[1]);
  const bm = oz.bolum_mevcut && typeof oz.bolum_mevcut === 'object' ? oz.bolum_mevcut : null;
  const personel = n(oz.personel_mevcudu), vi = n(oz.vi_sayisi), analist = n(oz.analist_sayisi);
  const stajyerElle = n(oz.stajyer_elle);
  const stajyer = stajyerElle ?? n(oz.stajyer_sayisi);
  const toplam = stajyerElle !== null && personel !== null && vi !== null
    ? personel + vi + stajyer + (analist || 0)
    : n(oz.toplam_kayit);
  return {
    hafta: (B.etiket && B.etiket.hafta) || '', aralik, aralikMetni: aralikMetni(aralik) || (B.etiket && B.etiket.short) || '',
    personel, pwPersonel: n(pw.personel_mevcudu), vi, stajyer, stajyerElle: stajyerElle !== null, analist, toplam,
    ytd: n(oz.ytd_turnover), pwYtd: n(pw.ytd_turnover), kapanis: n(oz.kapanis_2025_turnover),
    haftaGiris: n(oz.hafta_giris), haftaCikis: n(oz.hafta_cikis),
    giris: n(oz.ytd_giris), cikis: n(oz.ytd_cikis), pwGiris: n(pw.ytd_giris), pwCikis: n(pw.ytd_cikis),
    kidem: n(oz.sirket_kidemi),
    bolum: bm ? BOLUM_SIRA.map((b) => [b, n(bm[b])]) : null,
    aylar, sonAy, ayDevam, cikisAy, girisAy,
    hc25: (hc.y2025 || []).slice(0, 12).map(n), hc26: (hc.y2026 || []).slice(0, 12).map(n),
    nedenler, nedenToplam: nedenler.reduce((t, x) => t + x[1], 0)
  };
}

/* ==========================================================================
   ARAÇ ÇUBUĞU (tuval dışında; çıktıya girmez)
   ========================================================================== */
function aracCiz(kok, B, M) {
  const arac = O.el('div', { class: 'oz-arac' });
  arac.append(O.el('div', { class: 'oz-arac-sol' },
    O.el('div', { class: 'oz-arac-ust', text: 'İnsan Kaynakları · ' + (M.hafta || '2026') }),
    O.el('h1', { class: 'oz-arac-baslik', text: 'Yönetici Özeti' }),
    O.el('div', { class: 'oz-arac-alt', text: 'Kurula gönderilecek tek sayfa. Şirket geneli' + (B.filtreAktif ? ' gösteriliyor; departman filtresi bu sayfaya uygulanmaz.' : '; departman filtresi uygulanmaz.') })));
  const sag = O.el('div', { class: 'oz-arac-sag' });
  const tam = O.el('button', { class: 'btn btn-hayalet', type: 'button', text: 'Sunum görünümü', on: { click: tamEkran } });
  const png = O.el('button', { class: 'btn btn-pirinc', type: 'button', html: O.ikon('indir') + '<span>Görseli indir (PNG)</span>', on: { click: () => pngIndir(B, png) } });
  const yaz = O.el('button', { class: 'btn btn-hayalet', type: 'button', text: 'Yazdır', on: { click: () => window.print() } });
  tam.dataset.test = 'oz-tam'; png.dataset.test = 'oz-png'; yaz.dataset.test = 'oz-yazdir';
  sag.append(tam, png, yaz);
  arac.append(sag);
  kok.append(arac);
}

/* ==========================================================================
   TUVAL
   ========================================================================== */
function bantCiz(t, M) {
  t.append(O.el('div', { class: 'oz-bant' },
    O.el('div', { class: 'oz-bant-sol' },
      /* PNG sürümü: html2canvas SVG amblemi (maskeli) çizemiyor; 192 px PNG 2× çıktıda da net */
      O.el('img', { class: 'oz-amblem', src: new URL('./amblem-192.png', import.meta.url).href, alt: '', width: '46', height: '46' }),
      O.el('div', {},
        O.el('div', { class: 'oz-bant-ust', text: 'İNSAN KAYNAKLARI · YÖNETİCİ ÖZETİ' }),
        O.el('div', { class: 'oz-bant-baslik', html: O.esc(M.hafta || 'Haftalık özet') + (M.aralikMetni ? ' <span>· ' + O.esc(M.aralikMetni) + '</span>' : '') }))),
    O.el('div', { class: 'oz-bant-sag' },
      O.el('div', { text: 'İnciroğlu Otomotiv' }),
      O.el('div', { class: 'oz-bant-soluk', text: 'Şirket geneli · haftalık İK raporu' }))));
}

/** Fark satırı: yön oku + fark + "geçen hafta …"; iyiYon 'asagi' | 'yukari' | null (nötr) */
function farkHtml(c, p, { birim = '', ondalik = 0, iyiYon = null, bicim = (v) => O.sayi(v, ondalik), etiket = 'geçen hafta' } = {}) {
  if (c === null || p === null) return '';
  const k = Math.pow(10, ondalik === 0 ? 0 : 2), f = Math.round((c - p) * k) / k;
  if (f === 0) return '<span class="oz-fark notr">= </span>' + etiket + ' ' + O.esc(bicim(p));
  const yukari = f > 0;
  const ton = iyiYon === null ? 'notr' : ((yukari && iyiYon === 'yukari') || (!yukari && iyiYon === 'asagi') ? 'iyi' : 'kotu');
  return '<span class="oz-fark ' + ton + '">' + (yukari ? '▲ ' : '▼ ') + O.esc(O.sayi(Math.abs(f), ondalik)) + (birim ? ' ' + birim : '') + '</span> ' + etiket + ' ' + O.esc(bicim(p));
}
function ciftDeger(a, b, ra, rb) {
  return '<span style="color:' + ra + '">' + O.esc(O.sayi(a)) + '</span><span class="oz-ayrac"> / </span><span style="color:' + rb + '">' + O.esc(O.sayi(b)) + '</span>';
}
function kpi(kap, { k, etiket, degerHtml, satir1 = '', satir2 = '', serit = '' }) {
  kap.append(O.el('div', { class: 'oz-kpi', '--serit': serit, data: { k } },
    O.el('div', { class: 'oz-kpi-etiket', text: etiket }),
    O.el('div', { class: 'oz-kpi-deger', html: degerHtml }),
    O.el('div', { class: 'oz-kpi-s1', html: satir1 }),
    O.el('div', { class: 'oz-kpi-s2', html: satir2 })));
}
function kpiCiz(t, M) {
  const s = O.el('div', { class: 'oz-kpiler' });
  const R = O.RENK;
  kpi(s, { k: 'personel', etiket: 'Personel mevcudu', serit: 'var(--lac-800)', degerHtml: O.esc(O.sayi(M.personel)),
    satir1: farkHtml(M.personel, M.pwPersonel), satir2: 'V.İ. ve stajyer hariç' });
  kpi(s, { k: 'vi', etiket: 'V.İ. sayısı', serit: 'var(--g4)', degerHtml: O.esc(O.sayi(M.vi)),
    satir1: 'personel mevcuduna dahil değil' });
  kpi(s, { k: 'stajyer', etiket: 'Stajyer sayısı', serit: 'var(--g6)', degerHtml: O.esc(O.sayi(M.stajyer)),
    satir1: 'personel mevcuduna dahil değil' });
  kpi(s, { k: 'ytd', etiket: 'Turnover · yıl başından', serit: 'var(--ht-600)', degerHtml: O.esc(O.yuzde(M.ytd, 2)),
    satir1: farkHtml(M.ytd, M.pwYtd, { birim: 'puan', ondalik: 2, iyiYon: 'asagi', bicim: (v) => O.yuzde(v, 2) }),
    satir2: M.kapanis !== null ? '2025 kapanış ' + O.esc(O.yuzde(M.kapanis, 2)) : '' });
  kpi(s, { k: 'hafta', etiket: 'Bu hafta giriş / çıkış', serit: R.giris, degerHtml: ciftDeger(M.haftaGiris, M.haftaCikis, R.giris, R.cikis),
    satir1: O.esc(M.aralikMetni), satir2: 'V.İ. dahil' });
  /* Yan karttaki haftalık sayılarla çelişen "bu hafta eklenen" farkı YAZILMAZ; yalnız geçen haftanın değerleri */
  kpi(s, { k: 'yil', etiket: 'Yıl başından giriş / çıkış', serit: R.giris, degerHtml: ciftDeger(M.giris, M.cikis, R.giris, R.cikis),
    satir1: M.pwGiris !== null && M.pwCikis !== null ? 'geçen hafta ' + O.esc(O.sayi(M.pwGiris)) + ' / ' + O.esc(O.sayi(M.pwCikis)) : '',
    satir2: 'V.İ. hariç' });
  t.append(s);
}

function grafikKutu(kap, { baslik, aciklama, lejant = [] }) {
  const kutu = O.el('div', { class: 'oz-kutu oz-grafik-kutu' });
  const ust = O.el('div', { class: 'oz-kutu-ust' },
    O.el('div', {}, O.el('div', { class: 'oz-kutu-baslik', text: baslik }), O.el('div', { class: 'oz-kutu-alt', html: aciklama })),
    O.el('div', { class: 'oz-lejant' }, ...lejant.map(([ad, renk]) => O.el('span', {}, O.el('i', { style: { background: renk } }), ad))));
  const gk = O.el('div', { class: 'oz-grafik' });
  kutu.append(ust, gk);
  kap.append(kutu);
  /* 16.11 canlı hata: tuval CSS transform ile ölçeklendiği için Chart.js'in kendi ölçümü (getBoundingClientRect)
     ÖLÇEKLİ boyutu okuyor; pencere boyutu değişince grafik kutudan taşıyor ya da küçülüyor. Çözüm: boyut sabit,
     düzen boyutundan (clientWidth/Height transform'dan etkilenmez) ve responsive:false. Tuval zaten sabit 1600×900. */
  const w = Math.max(200, gk.clientWidth || 720), h = Math.max(120, gk.clientHeight || 250);
  const c = O.el('canvas', { role: 'img', 'aria-label': baslik, width: String(w), height: String(h), style: { width: w + 'px', height: h + 'px', display: 'block' } });
  gk.append(c);
  return c;
}
function grafiklerCiz(t, M) {
  const s = O.el('div', { class: 'oz-satir oz-grafikler' });
  t.append(s);
  const R = O.RENK, yildiz = (m) => O.ayKisa(m) + (M.ayDevam && m === M.sonAy ? '*' : '');
  const ortak = (ekX) => ({
    animation: false, responsive: false, maintainAspectRatio: false, devicePixelRatio: Math.max(2, window.devicePixelRatio || 1), layout: { padding: { top: 20, left: 4, right: 4 } },
    scales: { x: O.eksenX(Object.assign({ ticks: { font: { size: 12 } } }, ekX)), y: O.eksenY({ display: false, grace: '10%' }) },
    plugins: { tooltip: { callbacks: { label: (it) => it.dataset.label + ': ' + O.sayi(it.raw) } } }
  });
  /* 1 — Aylara göre personel (Excel Dashboard'daki alışılmış grafik): 2025 gri, 2026 lacivert.
     Yıl ayrımı üstte lejant yerine her sütunun ALTINDA ("25" / "26"), ay adı onun altında (yönetici isteği 16.11). */
  const c1 = grafikKutu(s, { baslik: 'Aylara göre personel sayısı', aciklama: 'Ay sonu personel mevcudu · her ayda <b style="color:' + R.n500 + '">25</b> = 2025, <b style="color:' + R.y2026 + '">26</b> = 2026' });
  const ay12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const yilEtiketi = (yil, renk) => ({ display: (ctx) => ctx.dataset.data[ctx.dataIndex] !== null && ctx.dataset.data[ctx.dataIndex] !== undefined,
    anchor: 'start', align: 'bottom', offset: 5, clamp: false, clip: false, color: renk, font: { family: 'Inter', size: 11, weight: '700' }, formatter: () => yil });
  const g1 = O.grafik(c1, { type: 'bar', data: { labels: ay12.map(yildiz), datasets: [
    { label: '2025', data: ay12.map((m) => M.hc25[m - 1] ?? null), backgroundColor: R.y2025, maxBarThickness: 22, categoryPercentage: 0.8, barPercentage: 0.88,
      datalabels: { labels: { deger: O.etiket.ust({ secim: 'hepsi', boyut: 10.5, renk: R.n500 }), yil: yilEtiketi('25', R.n500) } } },
    { label: '2026', data: ay12.map((m) => M.hc26[m - 1] ?? null), backgroundColor: R.y2026, maxBarThickness: 22, categoryPercentage: 0.8, barPercentage: 0.88,
      datalabels: { labels: { deger: O.etiket.ust({ secim: 'hepsi', boyut: 10.5, renk: R.y2026 }), yil: yilEtiketi('26', R.y2026) } } }
  ] }, options: ortak({ ticks: { font: { size: 12, weight: '600' }, padding: 22 } }) });
  /* 2 — 2026 aylık giriş ve çıkış (Turnover sayfasıyla aynı kaynaklar) */
  const c2 = grafikKutu(s, { baslik: '2026 aylık giriş ve çıkış', aciklama: 'Kişi sayısı, V.İ. hariç · girişler işe alım listesinden, çıkışlar turnover tablosundan', lejant: [['Giriş', R.giris], ['Çıkış', R.cikis]] });
  const g2 = O.grafik(c2, { type: 'bar', data: { labels: M.aylar.map(yildiz), datasets: [
    { label: 'Giriş', data: M.girisAy, backgroundColor: R.giris, maxBarThickness: 22, categoryPercentage: 0.8, barPercentage: 0.88, datalabels: O.etiket.ust({ secim: 'hepsi', boyut: 11, renk: R.giris }) },
    { label: 'Çıkış', data: M.cikisAy, backgroundColor: R.cikis, maxBarThickness: 22, categoryPercentage: 0.8, barPercentage: 0.88, datalabels: O.etiket.ust({ secim: 'hepsi', boyut: 11, renk: R.cikis }) }
  ] }, options: ortak() });
  /* responsive:false + animasyonsuz grafik tek seferde çizilir; Inter henüz yüklenmediyse değer etiketleri yedek (serif)
     yazıyla kalır. Yazı tipi yüklenince bir kez yeniden çiz (sayfa değiştiyse grafik yok edilmiştir: ctx null). */
  if (document.fonts && document.fonts.load) {
    Promise.all(['600 11px Inter', '700 11px Inter', '400 12px Inter'].map((f) => document.fonts.load(f)))
      .then(() => [g1, g2].forEach((g) => { try { if (g && g.ctx) g.update('none'); } catch (e) { /* sayfa kapandı */ } }))
      .catch(() => { /* yazı tipi yüklenemezse sistem yazısı kalır */ });
  }
}

function panellerCiz(t, M) {
  const s = O.el('div', { class: 'oz-satir oz-paneller' });
  t.append(s);
  /* A — Kadro bileşimi */
  const a = O.el('div', { class: 'oz-kutu', data: { k: 'kadro' } });
  a.append(O.el('div', { class: 'oz-kutu-baslik', text: 'Kadro bileşimi' }),
    O.el('div', { class: 'oz-kutu-alt', html: 'Toplam kayıt <b>' + O.esc(O.sayi(M.toplam)) + '</b>' + (M.kidem !== null ? ' · ortalama şirket kıdemi <b>' + O.esc(O.sayi(M.kidem, 2)) + ' yıl</b>' : '') }));
  const parca = [['personel', M.personel, 'var(--lac-800)'], ['V.İ.', M.vi, 'var(--g4)'], ['stajyer', M.stajyer, 'var(--g6)'], ['analist', M.analist, 'var(--g5)']];
  const tp = parca.reduce((x, p) => x + (p[1] || 0), 0);
  if (tp) a.append(O.el('div', { class: 'oz-bilesim' }, ...parca.filter((p) => p[1]).map((p) => O.el('i', { style: { width: (p[1] / tp * 100) + '%', background: p[2] } }))));
  a.append(O.el('div', { class: 'oz-bilesim-lejant' }, ...parca.map((p) => O.el('span', { html: '<i style="background:' + p[2] + '"></i><b>' + O.esc(O.sayi(p[1])) + '</b> ' + O.esc(p[0]) }))));
  a.append(O.el('div', { class: 'oz-bolum-baslik', text: 'Personel mevcudunun bölümlere dağılımı' }));
  const bk = O.el('div', { class: 'oz-bolumler' });
  (M.bolum || BOLUM_SIRA.map((b) => [b, null])).forEach(([ad, v]) => bk.append(O.el('div', { class: 'oz-bolum', data: { b: ad } }, O.el('div', { class: 'oz-bolum-ad', text: ad }), O.el('div', { class: 'oz-bolum-deger', text: O.sayi(v) }))));
  a.append(bk);
  if (!M.bolum) a.append(O.el('div', { class: 'oz-kucuk-not', text: 'Bölüm dağılımı bu haftanın veri paketinde yok.' }));
  s.append(a);

  /* B — Çıkış nedenleri (V.İ. hariç; toplam = yıl çıkışı) */
  const b = O.el('div', { class: 'oz-kutu', data: { k: 'nedenler' } });
  const esit = M.cikis !== null && M.nedenToplam === M.cikis;
  b.append(O.el('div', { class: 'oz-kutu-baslik', text: '2026 çıkış nedenleri' }),
    O.el('div', { class: 'oz-kutu-alt', text: 'V.İ. hariç · toplam ' + O.sayi(M.nedenToplam) + (esit ? ' = yıl çıkışı' : (M.cikis !== null ? ' (yıl çıkışı ' + O.sayi(M.cikis) + ')' : '')) }));
  let liste = M.nedenler.slice();
  if (liste.length > 7) { const kalan = liste.slice(6).reduce((x, r) => x + r[1], 0); liste = liste.slice(0, 6).concat([['Diğer', kalan]]); }
  const mx = Math.max(1, ...liste.map((r) => r[1]));
  const ul = O.el('div', { class: 'oz-nedenler' });
  liste.forEach(([ad, v]) => ul.append(O.el('div', { class: 'oz-neden', data: { ad } },
    O.el('span', { class: 'oz-neden-ad', text: ad }),
    O.el('span', { class: 'oz-neden-ray' }, O.el('i', { style: { width: Math.max(2, v / mx * 100) + '%', background: O.nedenRengi(ad) } })),
    O.el('b', { text: O.sayi(v) }))));
  b.append(ul);
  s.append(b);
}

/* ==========================================================================
   ÖLÇEK · SUNUM · YAZDIR · PNG
   ========================================================================== */
function olcekle() {
  if (!sahneEl || !tuvalEl) return;
  const tam = document.fullscreenElement === sahneEl;
  const w = tam ? window.innerWidth : sahneEl.clientWidth;
  const h = tam ? window.innerHeight : Infinity;
  if (!w) return;
  const s = Math.min(w / W, h / H);
  tuvalEl.style.transform = 'scale(' + s + ')';
  tuvalEl.style.left = tam ? Math.round((w - W * s) / 2) + 'px' : '0px';
  tuvalEl.style.top = tam ? Math.round((window.innerHeight - H * s) / 2) + 'px' : '0px';
  sahneEl.style.height = tam ? '' : Math.ceil(H * s) + 'px';
}
function baskiOlcek() {
  if (!sahneEl || !tuvalEl) return;
  const s = BASKI_GENISLIK / W;
  tuvalEl.style.transform = 'scale(' + s + ')'; tuvalEl.style.left = '0px'; tuvalEl.style.top = '0px';
  sahneEl.style.height = Math.ceil(H * s) + 'px';
}
function tamEkran() {
  if (!sahneEl) return;
  if (document.fullscreenElement) { document.exitFullscreen(); return; }
  if (!sahneEl.requestFullscreen) { O.bildirim('Tarayıcı tam ekranı desteklemiyor; F11 ile tam ekrana geçebilirsiniz.'); return; }
  sahneEl.requestFullscreen().catch(() => O.bildirim('Tam ekran açılamadı; F11 ile tam ekrana geçebilirsiniz.'));
}
function h2cYukle() {
  if (window.html2canvas) return Promise.resolve();
  if (h2cSoz) return h2cSoz;
  h2cSoz = new Promise((coz, red) => {
    const s = document.createElement('script');
    s.src = H2C; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => (window.html2canvas ? coz() : red(new Error('html2canvas yok')));
    s.onerror = () => { h2cSoz = null; s.remove(); red(new Error('html2canvas yüklenemedi')); };
    document.head.append(s);
  });
  return h2cSoz;
}
function dosyaAdi(hafta) {
  const tr = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' };
  const s = String(hafta || O.bugunDosya()).replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => tr[c]).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return 'Yonetici_Ozeti_' + (s || 'hafta') + '.png';
}
/** Tuvali 2× çözünürlükte PNG yapar (test için sonucu döndürür). */
export async function pngUret() {
  await h2cYukle();
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const kaynak = tuvalEl;
  if (!kaynak) throw new Error('tuval yok');
  return window.html2canvas(kaynak, {
    scale: 2, backgroundColor: '#f5f7fa', width: W, height: H, windowWidth: Math.max(W + 400, window.innerWidth), logging: false, useCORS: true,
    onclone: (doc) => { const t = doc.querySelector('.oz-tuval'); if (t) { t.style.transform = 'none'; t.style.left = '0px'; t.style.top = '0px'; } }
  });
}
async function pngIndir(B, dugme) {
  const ad = dosyaAdi(B.etiket && B.etiket.hafta);
  const eski = dugme.innerHTML;
  dugme.disabled = true; dugme.textContent = 'Hazırlanıyor…';
  try {
    const cv = await pngUret();
    await new Promise((coz, red) => cv.toBlob((blob) => {
      if (!blob) { red(new Error('boş görsel')); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ad; a.hidden = true;
      document.body.append(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      coz();
    }, 'image/png'));
    O.bildirim('Görsel indirildi: ' + ad + ' (İndirilenler klasörü)');
  } catch (e) {
    console.warn('Yönetici özeti PNG', e);
    O.bildirim('Görsel oluşturulamadı. "Sunum görünümü"nü açıp Windows + Shift + S ile ekran görüntüsü alabilirsiniz.');
  } finally { dugme.disabled = false; dugme.innerHTML = eski; }
}

/* ==========================================================================
   STİL (sayfaya özel; tokenlar kokpit.css'ten)
   ========================================================================== */
const STIL = `
.oz-arac{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.oz-arac-ust{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--metin-3);font-weight:600}
.oz-arac-baslik{font-family:var(--font-serif);font-size:26px;font-weight:600;color:var(--metin-marka);margin:2px 0}
.oz-arac-alt{font-size:13px;color:var(--metin-2)}
.oz-arac-sag{display:flex;gap:8px;flex-wrap:wrap}
.oz-arac-sag .btn svg{width:16px;height:16px}
.oz-arac-sag .btn-hayalet{border:1px solid var(--cizgi-3);color:var(--n-700);background:var(--n-0)}
.oz-arac-sag .btn-hayalet:hover{border-color:var(--lac-400);color:var(--lac-800)}
.oz-sahne{position:relative;width:100%;overflow:hidden}
.oz-sahne:fullscreen{background:#0e1218;width:100vw;height:100vh}
.oz-tuval{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;box-sizing:border-box;padding:22px 26px 14px;
  background:var(--n-50);font-family:var(--font-sans);color:var(--metin-1);display:flex;flex-direction:column;gap:12px;
  border-radius:14px;box-shadow:0 0 0 1px var(--cizgi-2);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.oz-bant{flex:none;height:76px;border-radius:14px;background:linear-gradient(100deg,var(--lac-950) 0%,var(--lac-850) 55%,var(--lac-800) 100%);
  display:flex;align-items:center;justify-content:space-between;padding:0 26px;color:var(--metin-ters-1)}
.oz-bant-sol{display:flex;align-items:center;gap:16px}
.oz-amblem{width:46px;height:46px;flex:none;display:block;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.28)}
.oz-bant-ust{font-size:12px;letter-spacing:.16em;color:var(--lac-300);font-weight:600}
.oz-bant-baslik{font-family:var(--font-serif);font-size:28px;font-weight:600;line-height:1.2}
.oz-bant-baslik span{font-weight:400;font-size:21px;color:var(--lac-200)}
.oz-bant-sag{text-align:right;font-size:15px;font-weight:600}
.oz-bant-soluk{font-size:13px;font-weight:400;color:var(--lac-200);margin-top:2px}
.oz-kpiler{flex:none;display:grid;grid-template-columns:repeat(6,1fr);gap:12px;height:132px}
.oz-kpi{background:var(--n-0);border:1px solid var(--cizgi-2);border-top:4px solid var(--serit,var(--lac-800));border-radius:14px;padding:12px 16px;box-sizing:border-box;display:flex;flex-direction:column;min-width:0}
.oz-kpi-etiket{font-size:14px;font-weight:600;color:var(--n-600)}
.oz-kpi-deger{font-size:40px;font-weight:700;color:var(--lac-800);line-height:1.15;letter-spacing:-.01em;white-space:nowrap;font-variant-numeric:tabular-nums}
.oz-ayrac{color:var(--n-300);font-weight:400}
.oz-kpi-s1{font-size:13px;color:var(--n-600);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oz-kpi-s2{font-size:12px;color:var(--n-500);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oz-fark{font-weight:700}.oz-fark.iyi{color:var(--ok-600)}.oz-fark.kotu{color:var(--ht-600)}.oz-fark.notr{color:var(--n-600)}
.oz-satir{display:grid;gap:12px}
.oz-grafikler{grid-template-columns:1fr 1fr;flex:none;height:326px}
.oz-paneller{grid-template-columns:1fr 1fr;flex:1;min-height:0}
.oz-kutu{background:var(--n-0);border:1px solid var(--cizgi-2);border-radius:14px;padding:14px 18px;box-sizing:border-box;min-width:0;min-height:0;display:flex;flex-direction:column}
.oz-kutu-ust{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.oz-kutu-baslik{font-size:17px;font-weight:700;color:var(--lac-800)}
.oz-kutu-alt{font-size:13px;color:var(--n-500);margin-top:2px}
.oz-lejant{display:flex;gap:14px;font-size:13px;color:var(--n-600);white-space:nowrap}
.oz-lejant i,.oz-bilesim-lejant i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.oz-grafik{position:relative;flex:1;min-height:0;margin-top:6px}
.oz-bilesim{display:flex;height:14px;border-radius:7px;overflow:hidden;margin-top:14px;background:var(--n-100)}
.oz-bilesim i{display:block;height:100%}
.oz-bilesim-lejant{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;color:var(--n-700);margin-top:8px}
.oz-bolum-baslik{font-size:12px;font-weight:600;color:var(--n-500);margin-top:auto;margin-bottom:6px;letter-spacing:.02em}
.oz-bolumler{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.oz-bolum{background:var(--lac-50);border-radius:10px;padding:8px 12px}
.oz-bolum-ad{font-size:12px;font-weight:600;color:var(--n-600)}
.oz-bolum-deger{font-size:26px;font-weight:700;color:var(--lac-800);font-variant-numeric:tabular-nums}
.oz-kucuk-not{font-size:11px;color:var(--n-500);margin-top:4px}
.oz-nedenler{display:flex;flex-direction:column;gap:7px;margin-top:12px}
.oz-neden{display:grid;grid-template-columns:170px 1fr 44px;align-items:center;gap:12px;font-size:13.5px;color:var(--n-700)}
.oz-neden-ad{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oz-neden-ray{height:11px;border-radius:6px;background:var(--n-100);overflow:hidden}
.oz-neden-ray i{display:block;height:100%;border-radius:6px}
.oz-neden b{text-align:right;color:var(--metin-1);font-variant-numeric:tabular-nums}
.oz-dip{flex:none;display:flex;justify-content:space-between;font-size:12px;color:var(--n-500)}
@media print{
  @page{size:A4 landscape;margin:8mm}
  /* ölçek yalnız CSS ile (beforeprint her yazdırmada tetiklenmeyebilir): 1600 × 0,65 = 1040 px ≤ A4 yatay yazdırılabilir genişlik */
  .ust-alan,.oz-arac{display:none!important}
  .icerik,.pg,#p-oz{padding:0!important;margin:0!important}
  .oz-sahne{width:${BASKI_GENISLIK}px!important;height:${Math.ceil(H * BASKI_GENISLIK / W)}px!important;overflow:hidden!important;margin:18mm auto 0!important}
  .oz-tuval{transform:scale(${BASKI_GENISLIK / W})!important;left:0!important;top:0!important;box-shadow:none}
}
`;
