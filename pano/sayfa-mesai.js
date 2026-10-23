/* ==========================================================================
   İK DASHBOARD 2.0 · MESAİ ANALİZİ (BRÜT)  (pano/sayfa-mesai.js)
   --------------------------------------------------------------------------
   Akış (BRIEF): (1) Özet — kaput + gösterge panosu (2) Trend — aylık tutar ve kişi
   (3) Kırılım — bölüm × departman (yığılmış) ve departman toplamları (4) Liste — kişi bazlı mesai.
   Firebase import ETMEZ. Sözleşme: pano/KABUK.md
   AYLAR VERİDEN: D.mesai_aylik sırası (O.mesaiAylari → MES_AY_KEY eşlemesi; index.html mesAylar/mesBaslik ile aynı).
   Değerler index.html renderMES ile AYNI kuralla: Toplam brüt = Σ mesai_aylik.toplam · Toplam kişi = Σ mesai_aylik.kisi
   (aylık kişi sayılarının toplamı) · En yüksek ay = toplamı en büyük ay (eşitlikte ilk) · departman = mesai_dept azalan.
   Global filtre: kişi listesi ve "Seçili kapsam" göstergesi süzülür; aylık toplamlar, mes_bolum ve mesai_dept şirket geneli.
   ========================================================================== */
import * as O from './ortak.js';

export const meta = { id: 'mes', baslik: 'Mesai', ikon: O.ikon('saat') };

const durum = { bolum: '' };
const BOLUM_ANAHTAR = [{ k: 'servis', ad: 'Servis' }, { k: 'satis', ad: 'Satış' }, { k: 'idari', ad: 'İdari' }];
const DEPT_RENK = [O.RENK.g1, O.RENK.g2, O.RENK.g3, O.RENK.g4, O.RENK.g5, O.RENK.g6, O.RENK.g7, O.RENK.g8];

export function ciz(kok, B) {
  stilEkle(kok);
  const M = hesapla(B);
  ozetCiz(kok, B, M);
  trendCiz(kok, B, M);
  kirilimCiz(kok, B, M);
  listeCiz(kok, B, M);
  notlarCiz(kok, B);
}
export function temizle() { /* grafikleri kabuk temizler; ek kaynak yok */ }

const b = (v) => '<b>' + v + '</b>';
const anahtar = (renk) => '<i style="background:' + renk + '"></i>';
const kisaTL = (v) => (O.bosMu(v) ? '—' : O.kisaSayi(v) + ' TL');
const ayKisalt = (ad) => String(ad || '').substring(0, 3);
const sayiMi = (v) => v !== null && v !== undefined && v !== '' && !isNaN(+v);

function stilEkle(kok) {
  kok.append(O.el('style', { text:
    '.mes-arac{display:flex;gap:8px;flex-wrap:wrap;align-items:center}'
    + '.tablo td.mes-toplam{font-weight:600;color:var(--pir-700)}'
    + '.tablo td.mes-pay{color:var(--lac-600);font-weight:600}'
    + '@media (max-width:760px){.mes-arac .alan{width:100%!important}}' }));
}

/* Kadran merkezi için ölçek: 2.345.678 → "2,35 Mn" · 412.345 → "412 B" */
function olcekli(v) {
  if (O.bosMu(v) || isNaN(+v)) return { merkez: null, sonek: '', ondalik: 0 };
  const a = Math.abs(+v);
  if (a >= 1e6) return { merkez: +v / 1e6, sonek: ' Mn', ondalik: 2 };
  if (a >= 1e3) return { merkez: +v / 1e3, sonek: ' B', ondalik: 0 };
  return { merkez: +v, sonek: '', ondalik: 0 };
}

/* ==========================================================================
   HESAP — index.html renderMES ile aynı kurallar
   ========================================================================== */
function hesapla(B) {
  const D = B.D, F = B.filtreli, fa = B.filtreAktif;
  const ma = Array.isArray(D.mesai_aylik) ? D.mesai_aylik : [];
  const aylar = O.mesaiAylari(D);
  const topTL = ma.reduce((s, x) => s + (+x.toplam || 0), 0);
  const topKisi = ma.reduce((s, x) => s + (+x.kisi || 0), 0);
  const peak = ma.length ? ma.reduce((a, c) => ((+c.toplam || 0) > (+a.toplam || 0) ? c : a), ma[0]) : null;
  const mb = D.mes_bolum && typeof D.mes_bolum === 'object' ? D.mes_bolum : {};
  const bolumToplam = {};
  BOLUM_ANAHTAR.forEach(({ k, ad }) => {
    bolumToplam[ad] = Object.values(mb[k] || {}).reduce((s, dizi) => s + (Array.isArray(dizi) ? dizi.reduce((t, v) => t + (sayiMi(v) ? +v : 0), 0) : 0), 0);
  });
  const bolumGenel = BOLUM_ANAHTAR.reduce((s, x) => s + bolumToplam[x.ad], 0);
  const md = (Array.isArray(D.mesai_dept) ? D.mesai_dept : []).filter((x) => x && sayiMi(x.toplam)).slice().sort((p, q) => +q.toplam - +p.toplam);
  const mk = Array.isArray(F.mesai_kisi) ? F.mesai_kisi : [];
  const ilk = ma.length ? ma[0].ay : '', son = ma.length ? ma[ma.length - 1].ay : '';
  return {
    D, fa, ma, aylar, topTL, topKisi, peak, mb, bolumToplam, bolumGenel, md, mk,
    donem: ma.length > 1 ? ilk + '–' + son : ilk,          /* index: mes-period ("Ocak-Eylül") */
    kisiBolum: O.bolumSay(mk),
    kapsamTL: mk.reduce((s, r) => s + (sayiMi(r.toplam) ? +r.toplam : 0), 0)
  };
}

/* ==========================================================================
   (1) ÖZET
   ========================================================================== */
function ozetCumlesi(B, M) {
  if (!M.ma.length) return 'Bu haftanın paketinde aylık mesai verisi bulunmuyor.';
  let s = '2026 ' + b(O.esc(M.donem)) + ' döneminde fazla mesai için toplam ' + b(O.para(M.topTL)) + ' brüt tutar oluştu';
  if (M.peak) s += '; en yüksek ay ' + b(O.esc(M.peak.ay)) + ' (' + O.esc(O.para(M.peak.toplam)) + ')';
  if (M.bolumGenel) s += '. Bölüm payları: ' + BOLUM_ANAHTAR.map((x) => O.esc(x.ad) + ' ' + b(O.yuzde(Math.round(M.bolumToplam[x.ad] / M.bolumGenel * 100), 0))).join(', ');
  s += '.';
  if (M.fa) s += ' Seçili kapsamda (' + O.esc(O.filtreMetni(B.filtre)) + ') kişi listesine göre ' + b(O.sayi(M.mk.length)) + ' kişi · ' + b(O.para(M.kapsamTL)) + '; aylık toplamlar şirket geneline aittir.';
  return s;
}

function ozetCiz(kok, B, M) {
  const e = B.etiket || {};
  const meta = [];
  if (M.donem) meta.push({ ikon: 'takvim', html: 'Mesai dönemi: ' + b(O.esc(M.donem) + ' 2026') + ' · ' + b(O.sayi(M.ma.length)) + ' ay' });
  if (e.short || e.label) meta.push({ ikon: 'dosya', html: 'Veri: ' + b(O.esc(e.short || e.label)) });
  meta.push({ ikon: 'saat', html: 'Tutarlar ' + b('brüt TL') });

  const bolumParca = BOLUM_ANAHTAR.map((x, i) => ({ ad: x.ad, deger: M.bolumToplam[x.ad], renk: [O.RENK.gk1, O.RENK.gk2, O.RENK.gk7][i], metin: O.para(M.bolumToplam[x.ad]) }));
  const kisiParca = O.BOLUMLER.map((x, i) => ({ ad: x, deger: M.kisiBolum[x], renk: [O.RENK.gk1, O.RENK.gk2, O.RENK.gk7][i], metin: O.sayi(M.kisiBolum[x]) + ' kişi' }));
  const t = olcekli(M.topTL), p = olcekli(M.peak ? M.peak.toplam : null);
  const peakPay = M.peak && M.topTL ? Math.round(+M.peak.toplam / M.topTL * 100) : null;
  O.kaput(kok, {
    B, bindirme: true,
    ustEtiket: 'İnsan Kaynakları · Fazla mesai' + (M.fa ? ' · aylık toplamlar şirket geneli' : ''),
    baslik: 'Mesai Analizi',
    ozetHtml: ozetCumlesi(B, M),
    meta,
    kadranlar: [
      { etiket: 'Toplam brüt · TL', merkez: t.merkez, sonek: t.sonek, ondalik: t.ondalik, parcalar: bolumParca,
        alt: BOLUM_ANAHTAR.map((x, i) => anahtar(bolumParca[i].renk) + x.ad + ' ' + b(kisaTL(M.bolumToplam[x.ad]))).join('<br>') },
      M.peak
        ? { etiket: 'En yüksek ay · TL', deger: +M.peak.toplam || 0, max: M.topTL || 1, merkez: p.merkez, sonek: p.sonek, ondalik: p.ondalik,
          alt: b(O.esc(M.peak.ay)) + ' · yıl toplamında ' + b(O.yuzde(peakPay, 0)) }
        : { etiket: 'En yüksek ay', merkez: null, parcalar: [], alt: 'aylık veri yok' },
      { etiket: M.fa ? 'Mesai alan · kapsam' : 'Mesai alan kişi', merkez: M.mk.length, parcalar: kisiParca,
        alt: anahtar(O.RENK.gk1) + 'Servis ' + b(O.sayi(M.kisiBolum['Servis'])) + ' · ' + anahtar(O.RENK.gk2) + 'Satış ' + b(O.sayi(M.kisiBolum['Satış'])) + '<br>' + anahtar(O.RENK.gk7) + 'İdari ' + b(O.sayi(M.kisiBolum['İdari'])) + ' kişi' }
    ]
  });

  const ogeler = [
    { anahtar: 'toplam', etiket: 'Toplam mesai (brüt)', deger: M.ma.length ? M.topTL : null, birim: 'TL', alt: (M.donem ? M.donem + ' 2026' : 'veri yok') + (M.fa ? ' · şirket geneli' : '') },
    { anahtar: 'kisi', etiket: 'Toplam kişi', deger: M.ma.length ? M.topKisi : null, alt: 'aylık mesai alan sayılarının toplamı' },
    { anahtar: 'peak', etiket: 'En yüksek ay', metin: M.peak ? M.peak.ay : '—', alt: M.peak ? O.para(M.peak.toplam) : 'aylık veri yok' },
    { anahtar: 'ort', etiket: 'Aylık ortalama', deger: M.ma.length ? M.topTL / M.ma.length : null, birim: 'TL', alt: 'ay başına brüt tutar' },
    { anahtar: 'liste', etiket: 'Mesai alan kişi', deger: M.mk.length, alt: M.fa ? 'seçili kapsam · kişi listesi' : 'kişi bazlı listede' }
  ];
  if (M.fa) ogeler.push({ anahtar: 'kapsam', etiket: 'Seçili kapsam tutarı', deger: M.kapsamTL, birim: 'TL', alt: 'kişi listesinden · ' + O.filtreMetni(B.filtre) });
  O.kpiPanel(kok, [{ grup: { baslik: 'Mesai', alt: 'brüt · ' + (M.donem ? M.donem + ' 2026' : '2026'), ikon: 'saat' }, ogeler }], { sinif: 'bindir' });
}

/* ==========================================================================
   (2) TREND — aylık mesai tutarı · aylık mesai alan kişi (aylar veriden)
   ========================================================================== */
function trendCiz(kok, B, M) {
  O.akisBaslik(kok, { no: '02', baslik: 'Trend', aciklama: 'Aylık brüt mesai tutarı ve mesai alan kişi sayısı · ' + (M.donem ? M.donem + ' 2026' : '2026') });
  const iz = O.izgara(kok);
  const sirket = M.fa ? ' · şirket geneli' : '';
  const etiketler = M.ma.map((x) => ayKisalt(x.ay));
  const baslikAy = (it) => (it.length ? (M.ma[it[0].dataIndex] || {}).ay + ' 2026' : '');

  const g1 = O.grafikKarti(iz, {
    baslik: 'Aylık mesai tutarı', aciklama: 'Brüt TL · ' + (M.donem || '') + ' 2026' + sirket, sinif: 's7', yukseklik: 290,
    etiket: 'Aylık brüt mesai tutarı sütun grafiği',
    tablo: () => ({
      sutunlar: [{ ad: 'Ay' }, { ad: 'Tutar (TL)', sag: true }, { ad: 'Kişi', sag: true }, { ad: 'Kişi başı (TL)', sag: true }],
      satirlar: M.ma.map((x) => [x.ay, O.sayi(x.toplam, 'oto'), O.sayi(x.kisi), +x.kisi ? O.sayi(+x.toplam / +x.kisi) : '—'])
    })
  });
  if (!M.ma.length) { g1.kap.textContent = ''; O.bosDurum(g1.kap, { ikon: 'saat', baslik: 'Aylık mesai verisi yok', metin: 'Bu haftanın paketinde mesai_aylik bulunmuyor.', kucuk: true }); }
  else {
    O.grafik(g1.canvas, {
      type: 'bar',
      data: { labels: etiketler, datasets: [{ label: 'Tutar', data: M.ma.map((x) => +x.toplam || 0), backgroundColor: O.RENK.g1, hoverBackgroundColor: O.RENK.g1,
        borderRadius: 4, borderSkipped: 'start', maxBarThickness: 30, categoryPercentage: 0.7, barPercentage: 0.9,
        datalabels: Object.assign(O.etiket.ust({ minPx: 46 }), { formatter: (v) => O.kisaSayi(v) }) }] },
      options: {
        layout: { padding: { top: 8 } },
        scales: { x: O.eksenX(), y: O.eksenY({ grace: '14%', ticks: { callback: (v) => O.kisaSayi(v) } }) },
        plugins: { tooltip: { callbacks: {
          title: baslikAy,
          label: (c) => ' Tutar: ' + O.para(c.parsed.y),
          footer: (it) => { if (!it.length) return ''; const x = M.ma[it[0].dataIndex] || {}; return +x.kisi ? 'Mesai alan: ' + O.sayi(x.kisi) + ' kişi\nKişi başı: ' + O.para(+x.toplam / +x.kisi) : ''; }
        } } }
      }
    });
    O.kartNot(g1.govde, (M.peak ? 'En yüksek ay ' + M.peak.ay + ' (' + O.para(M.peak.toplam) + '). ' : '') + 'Sütun üstündeki tutarlar kısaltılmıştır (B = bin, Mn = milyon TL); tam tutar ipucunda ve Tablo görünümünde.');
  }

  const g2 = O.grafikKarti(iz, {
    baslik: 'Aylık mesai alan kişi', aciklama: 'Kişi sayısı · ' + (M.donem || '') + ' 2026' + sirket, sinif: 's5', yukseklik: 290,
    etiket: 'Aylık mesai alan kişi sayısı sütun grafiği',
    tablo: () => ({ sutunlar: [{ ad: 'Ay' }, { ad: 'Kişi', sag: true }], satirlar: M.ma.map((x) => [x.ay, O.sayi(x.kisi)]) })
  });
  if (!M.ma.length) { g2.kap.textContent = ''; O.bosDurum(g2.kap, { ikon: 'kisiler', baslik: 'Aylık kişi verisi yok', kucuk: true }); }
  else {
    O.grafik(g2.canvas, {
      type: 'bar',
      data: { labels: etiketler, datasets: [{ label: 'Kişi', data: M.ma.map((x) => +x.kisi || 0), backgroundColor: O.RENK.g7, hoverBackgroundColor: O.RENK.g7,
        borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22, categoryPercentage: 0.7, barPercentage: 0.9, datalabels: O.etiket.ust() }] },
      options: {
        layout: { padding: { top: 6 } },
        scales: { x: O.eksenX(), y: O.eksenY({ grace: '14%' }) },
        plugins: { tooltip: { callbacks: { title: baslikAy, label: (c) => ' Mesai alan: ' + O.sayi(c.parsed.y) + ' kişi' } } }
      }
    });
    O.kartNot(g2.govde, 'Toplam ' + O.sayi(M.topKisi) + ' (aylık sayıların toplamı; aynı kişi birden çok ayda sayılabilir).');
  }
}

/* ==========================================================================
   (3) KIRILIM — bölüm × departman yığılmış grafikler (mes_bolum) ve departman toplamları (mesai_dept)
   ========================================================================== */
function kirilimCiz(kok, B, M) {
  O.akisBaslik(kok, { no: '03', baslik: 'Kırılım', aciklama: 'Bölümlerin aylık mesaisi departman kırılımıyla ve departman toplamları' + (M.fa ? ' · şirket geneli' : '') });
  const iz1 = O.izgara(kok);
  bolumGrafigi(iz1, M, { k: 'servis', ad: 'Servis', sinif: 's7', detay: true });
  departmanKarti(iz1, M);
  const iz2 = O.izgara(kok);
  bolumGrafigi(iz2, M, { k: 'satis', ad: 'Satış', sinif: 's6', detay: false });
  bolumGrafigi(iz2, M, { k: 'idari', ad: 'İdari', sinif: 's6', detay: true });
}

/* Departman bazında mesai (index mes-dept-bars: mesai_dept azalan, YTD) */
function departmanKarti(iz, M) {
  const { govde } = O.kart(iz, { baslik: 'Departman bazında mesai', aciklama: 'Toplam brüt tutar · YTD · ' + O.sayi(M.md.length) + ' departman', sinif: 's5' });
  O.cubukListe(govde, M.md.map((x) => ({ ad: x.dept || '—', deger: +x.toplam, ipucu: (x.dept || '—') + ': ' + O.para(x.toplam) })), { bicim: kisaTL, kaydir: 348, adGenislik: '40%', renk: O.RENK.g2, bos: 'Departman mesai verisi yok' });
  if (M.md.length) {
    const top = M.md.reduce((s, x) => s + +x.toplam, 0);
    govde.append(O.el('div', { class: 'kart-alt-cubuk', html: '<span>Toplam ' + b(O.para(top)) + '</span><span>Tam tutar için satırın üzerine gelin</span>' }));
  }
}

/* Yığılmış sütun yardımcıları */
function ustDilimMi(ctx) {
  const ds = ctx.chart.data.datasets, i = ctx.dataIndex;
  if (i === undefined || !(+ds[ctx.datasetIndex].data[i] > 0)) return false;
  for (let k = ctx.datasetIndex + 1; k < ds.length; k++) if (+ds[k].data[i] > 0) return false;
  return true;
}
const yiginToplami = (ctx) => ctx.chart.data.datasets.reduce((s, d) => s + (+d.data[ctx.dataIndex] || 0), 0);
const toplamEtiketi = () => ({
  display: (ctx) => yiginToplami(ctx) > 0, anchor: 'end', align: 'end', offset: 2, clamp: true, color: O.RENK.n700,
  font: { family: 'Inter', size: 10, weight: '600' }, formatter: (v, ctx) => O.kisaSayi(yiginToplami(ctx))
});
/* Dilim içi tutar (index: Servis ve İdari'de 2.500 TL ve üzeri dilimler) — dilim yeterince yüksekse yazılır, bin TL */
const dilimEtiketi = () => ({
  display: (ctx) => {
    const v = +ctx.dataset.data[ctx.dataIndex];
    if (!(v >= 2500)) return false;
    const y = ctx.chart.scales && ctx.chart.scales.y;
    return !!y && Math.abs(y.getPixelForValue(0) - y.getPixelForValue(v)) >= 15;
  },
  anchor: 'center', align: 'center', color: O.RENK.n900, textStrokeColor: 'rgba(255,255,255,.92)', textStrokeWidth: 3,
  font: { family: 'Inter', size: 9, weight: '600' }, formatter: (v) => O.sayi(v / 1000, v >= 10000 ? 0 : 1)
});

function bolumGrafigi(iz, M, o) {
  const veri = (M.mb && M.mb[o.k]) || {};
  const n = M.aylar.length;
  const tumu = Object.keys(veri).map((d) => {
    const dizi = Array.isArray(veri[d]) ? veri[d] : [];
    const seri = M.aylar.map((a, i) => (sayiMi(dizi[i]) ? +dizi[i] : null));       /* dizi ay sayısı kadar; eksik ay boş */
    return { ad: d, seri, top: seri.reduce((s, v) => s + (v || 0), 0) };
  }).sort((p, q) => q.top - p.top);
  /* Renk döngüsü yok: 8'den fazla departmanda en küçükler "Diğer" altında toplanır (tümü Tablo görünümünde) */
  let gorunen = tumu;
  if (tumu.length > 8) {
    const kalan = tumu.slice(7);
    gorunen = tumu.slice(0, 7).concat([{ ad: 'Diğer (' + kalan.length + ' departman)', diger: true,
      seri: M.aylar.map((a, i) => kalan.reduce((s, d) => s + (d.seri[i] || 0), 0)), top: kalan.reduce((s, d) => s + d.top, 0) }]);
  }
  const renk = (d, i) => (d.diger ? O.RENK.diger : DEPT_RENK[i]);
  const genel = tumu.reduce((s, d) => s + d.top, 0);
  const g = O.grafikKarti(iz, {
    baslik: o.ad + ' · aylık mesai', aciklama: 'Brüt TL · departman kırılımı · ' + (M.donem || '') + ' 2026' + (genel ? ' · toplam ' + kisaTL(genel) : ''), sinif: o.sinif, yukseklik: 290,
    lejant: gorunen.map((d, i) => ({ ad: d.ad, renk: renk(d, i) })),
    etiket: o.ad + ' bölümü aylık mesai tutarı, departmanlara göre yığılmış sütun grafiği',
    tablo: () => ({
      sutunlar: [{ ad: 'Departman' }].concat(M.aylar.map((a) => ({ ad: ayKisalt(a.ad), sag: true })), [{ ad: 'Toplam', sag: true }]),
      satirlar: tumu.map((d) => [d.ad].concat(d.seri.map((v) => (v ? O.sayi(v, 'oto') : '—')), [O.sayi(d.top, 'oto')]))
    })
  });
  if (!tumu.length || !n) {
    g.kap.textContent = '';
    O.bosDurum(g.kap, { ikon: 'saat', baslik: o.ad + ' için mesai verisi yok', metin: 'Paketteki bölüm kırılımında (mes_bolum) bu bölüm bulunmuyor.', kucuk: true });
    return;
  }
  const son = gorunen.length - 1;
  O.grafik(g.canvas, {
    type: 'bar',
    data: { labels: M.aylar.map((a) => ayKisalt(a.ad)), datasets: gorunen.map((d, i) => {
      const etiketler = {};
      if (o.detay) etiketler.dilim = dilimEtiketi();
      if (i === son) etiketler.toplam = toplamEtiketi();
      return {
        label: d.ad, data: d.seri, backgroundColor: renk(d, i), hoverBackgroundColor: renk(d, i),
        maxBarThickness: 22, categoryPercentage: 0.62, barPercentage: 0.9, borderSkipped: false,
        borderRadius: (ctx) => (ustDilimMi(ctx) ? { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 } : 0),
        datalabels: Object.keys(etiketler).length ? { labels: etiketler } : { display: false }
      };
    }) },
    options: {
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 8 } },
      scales: { x: O.eksenX({ stacked: true }), y: O.eksenY({ stacked: true, grace: '12%', ticks: { callback: (v) => O.kisaSayi(v) } }) },
      plugins: { tooltip: {
        filter: (it) => it.parsed.y > 0,
        itemSort: (p, q) => q.parsed.y - p.parsed.y,
        callbacks: {
          title: (it) => (it.length ? (M.aylar[it[0].dataIndex] || {}).ad + ' 2026 · ' + o.ad : ''),
          label: (c) => ' ' + c.dataset.label + ': ' + O.para(c.parsed.y),
          footer: (it) => (it.length ? 'Toplam: ' + O.para(gorunen.reduce((s, d) => s + (d.seri[it[0].dataIndex] || 0), 0)) : '')
        }
      } }
    }
  });
  O.kartNot(g.govde, o.detay
    ? 'Sütun üstü: ayın toplamı (B = bin TL). Sütun içi: yeterince büyük departman dilimlerinin tutarı, bin TL.'
    : 'Sütun üstü: ayın toplamı (B = bin TL). Departman tutarları ipucunda ve Tablo görünümünde.');
}

/* ==========================================================================
   (4) LİSTE — kişi bazlı mesai detayı (index mes-tb; ay sütunları VERİDEN)
   ========================================================================== */
function listeCiz(kok, B, M) {
  O.akisBaslik(kok, { no: '04', baslik: 'Liste', aciklama: 'Kişi bazlı mesai detayı · her ay için ayrı sütun · başlığa tıklayarak sıralayın' });
  if (durum.bolum && O.BOLUMLER.indexOf(durum.bolum) < 0) durum.bolum = '';
  const suz = () => M.mk.filter((r) => !durum.bolum || r.bolum === durum.bolum);
  const arac = O.el('div', { class: 'mes-arac' });
  const s = O.secim(arac, { secenekler: [{ v: '', ad: 'Tüm bölümler' }].concat(O.BOLUMLER.map((x) => ({ v: x, ad: x }))), deger: durum.bolum, genislik: '150px',
    degisince: (v) => { durum.bolum = v; t.guncelle(suz()); } });
  s.setAttribute('aria-label', 'Bölüm süzgeci');

  const ayKol = M.aylar.map((a) => ({ k: a.key, ad: ayKisalt(a.ad), tip: 'sayi', sag: true, bicim: (v) => (sayiMi(v) && +v ? O.sayi(+v, 'oto') : '—'), hucreSinif: (v) => (sayiMi(v) && +v ? '' : 'soluk') }));
  const toplamSatir = { ad: 'Liste toplamı', dept: ' ', bolum: ' ', unvan: ' ' };
  M.aylar.forEach((a) => { toplamSatir[a.key] = M.mk.reduce((sum, r) => sum + (sayiMi(r[a.key]) ? +r[a.key] : 0), 0); });
  toplamSatir.toplam = M.kapsamTL;
  toplamSatir.pct = Math.round(M.mk.reduce((sum, r) => sum + (sayiMi(r.pct) ? +r.pct : 0), 0) * 10) / 10;

  const { govde } = O.kart(kok, { baslik: 'Kişi bazlı mesai detayı', aciklama: O.sayi(M.mk.length) + ' kişi' + (M.fa ? ' · seçili kapsam' : '') + ' · tutarlar brüt TL · Pay: kişinin şirket toplamındaki payı', sinif: 'kart-liste' });
  const t = O.tablo(govde, {
    sutunlar: [
      { k: 'ad', ad: 'Ad Soyad', sinif: 'ad-hucre' },
      { k: 'dept', ad: 'Departman' },
      { k: 'bolum', ad: 'Bölüm' },
      { k: 'unvan', ad: 'Unvan', hucreSinif: () => 'soluk' }
    ].concat(ayKol, [
      { k: 'toplam', ad: 'Toplam (brüt)', tip: 'sayi', sag: true, bicim: (v) => O.sayi(v, 'oto'), hucreSinif: () => 'mes-toplam' },
      { k: 'pct', ad: 'Pay', tip: 'sayi', sag: true, bicim: (v) => O.yuzde(v), hucreSinif: () => 'mes-pay' }
    ]),
    satirlar: suz(),
    sayfaBoyu: 12,
    siraNo: true,
    araYer: 'Ad, departman, unvan ara…',
    araAlanlari: ['ad', 'dept', 'bolum', 'unvan'],
    aracEk: arac,
    toplamSatir: M.mk.length ? toplamSatir : null,
    altMetin: (n, top) => (n === top ? O.sayi(n) : O.sayi(n) + ' / ' + O.sayi(top)) + ' kişi' + (durum.bolum ? ' · ' + durum.bolum : '') + ' · alt satır tüm listenin toplamıdır',
    bos: { baslik: M.mk.length ? 'Kayıt bulunamadı' : 'Kişi bazlı mesai verisi yok', metin: M.mk.length ? 'Bölüm ya da arama seçimini değiştirin.' : 'Bu haftanın paketinde (ya da seçili kapsamda) mesai_kisi kaydı bulunmuyor.' }
  });
}

function notlarCiz(kok, B) {
  const e = B.etiket || {};
  O.notlar(kok, [
    'Kaynak: haftalık İK pano paketi' + (e.label ? ' (' + e.label + ')' : '') + '. Tutarlar brüt TL’dir; ay listesi paketteki aylık mesai verisinden gelir, yeni ay eklendiğinde kendiliğinden görünür.',
    'Toplam kişi, her ay mesai alan kişi sayılarının toplamıdır (aynı kişi birden çok ayda sayılabilir); “Mesai alan kişi” kişi bazlı listedeki kişi sayısıdır.',
    'Departman filtresi seçiliyken kişi listesi ve “Seçili kapsam” göstergesi süzülür; aylık toplamlar, bölüm ve departman grafikleri şirket geneline aittir.',
    'Bölüm grafiklerinde 8’den fazla departman varsa en küçükler “Diğer” altında toplanır; tüm departmanlar Tablo görünümündedir. Renk tek başına anlam taşımaz; değerler ipucunda ve tabloda yazılıdır.'
  ]);
}
