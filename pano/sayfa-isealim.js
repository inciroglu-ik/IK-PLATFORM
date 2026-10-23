/* ==========================================================================
   İK DASHBOARD 2.0 · İŞE ALIM  (pano/sayfa-isealim.js)
   --------------------------------------------------------------------------
   Akış (BRIEF): (1) Özet — kaput + gösterge panosu (2) Trend — aylık alım, giriş/çıkış
   (3) Kırılım — bölüm, unvan, departman (4) Liste — aranabilir, süzülebilir tablo.
   Firebase import ETMEZ; tüm veri B (bağlam) ile gelir. Sözleşme: pano/KABUK.md
   Değerler index.html renderIA ile AYNI kuralla hesaplanır:
     Toplam alım = ozet.ytd_giris || liste uzunluğu (filtre seçiliyken liste uzunluğu — Genel Bakış ile aynı)
     Bölüm payı  = round(bölüm adedi / liste uzunluğu × 100) · En yoğun ay = O.enYogunAy · ay ekseni veriden.
   index.html'den bilinçli fark (B14): filtre seçiliyken giriş/çıkış grafiğindeki çıkış serisi de seçili kapsama göredir.
   ========================================================================== */
import * as O from './ortak.js';

export const meta = { id: 'ia', baslik: 'İşe Alım', ikon: O.ikon('alim') };

/* Yeniden çizimler (global filtre değişimi) arasında korunan liste seçimleri */
const durum = { ay: '', bolum: '' };
const DIGER = 'Diğer';

export function ciz(kok, B) {
  stilEkle(kok);
  const M = hesapla(B);
  ozetCiz(kok, B, M);
  trendCiz(kok, B, M);
  kirilimCiz(kok, B, M);
  listeCiz(kok, B, M);
  notlarCiz(kok, B);
}
export function temizle() { /* grafikleri kabuk temizler (O.grafikleriTemizle); bu sayfanın ek kaynağı yok */ }

const b = (v) => '<b>' + v + '</b>';
const anahtar = (renk) => '<i style="background:' + renk + '"></i>';
const bolumAdi = (d) => (O.BOLUMLER.indexOf(d && d.bolum) >= 0 ? d.bolum : DIGER);
const bolumRenk = (x) => (x === DIGER ? O.RENK.diger : O.bolumRengi(x));

/* Sayfaya özel küçük stiller (ortak sınıflarda karşılığı olmayanlar) */
function stilEkle(kok) {
  kok.append(O.el('style', { text:
    '.ia-iki-kolon{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 40px;align-items:start}'
    + '.ia-tek-kolon{grid-template-columns:minmax(0,1fr)}'
    + '.ia-arac{display:flex;gap:8px;flex-wrap:wrap;align-items:center}'
    + '@media (max-width:760px){.ia-iki-kolon{grid-template-columns:minmax(0,1fr);gap:7px}.ia-arac .alan{width:calc(50% - 4px)!important}}' }));
}

/* ==========================================================================
   HESAP — index.html renderIA (+ filtre sarmalayıcısı) ile aynı kurallar
   ========================================================================== */
function hesapla(B) {
  const D = B.D, oz = D.ozet || {}, F = B.filtreli, fa = B.filtreAktif;
  const ia = F.isealim || [], ay = F.ayrilanlar || [];
  const n = ia.length;
  const pw = !fa && oz.prev_week ? oz.prev_week : null;
  const toplam = fa ? n : (oz.ytd_giris || n);
  const cikis = fa ? ay.length : (oz.ytd_cikis || ay.length);
  const bc = O.bolumSay(ia);
  const diger = n - O.BOLUMLER.reduce((s, x) => s + bc[x], 0);
  const pay = {};
  O.BOLUMLER.forEach((x) => { pay[x] = n ? Math.round(bc[x] / n * 100) : null; });
  const aylar = O.aylar(D);
  const seriler = O.BOLUMLER.concat(diger > 0 ? [DIGER] : []);
  const trendBolum = {};
  seriler.forEach((x) => { trendBolum[x] = aylar.map((m) => ia.filter((d) => d.ay === m && bolumAdi(d) === x).length); });
  const unvanTum = O.grupSay(ia.filter((x) => x.unvan), 'unvan');   /* index: yalnız unvanı dolu kayıtlar */
  return {
    D, oz, fa, ia, ay, n, toplam, cikis, net: toplam - cikis, bc, diger, pay, aylar, seriler, trendBolum,
    yogun: O.enYogunAy(ia),
    dToplam: pw ? O.haftalikFark(toplam, pw.ytd_giris) : null,
    trendGiris: O.aySay(ia, aylar),
    trendCikis: O.aySay(ay, aylar),
    depts: O.grupSay(ia, (x) => x.dept || '—'),
    unvanlar: unvanTum.slice(0, 5),
    unvanSayisi: unvanTum.length
  };
}

/* ==========================================================================
   (1) ÖZET — kaput (başlık + tek cümle + 3 kadran) ve gösterge panosu
   ========================================================================== */
function ozetCumlesi(B, M) {
  const e = B.etiket || {};
  let s = M.fa ? 'Seçili kapsamda (' + O.esc(O.filtreMetni(B.filtre)) + ') ' : (e.hafta ? O.esc(e.hafta) + ' itibarıyla ' : '');
  s += '2026’da ' + b(O.sayi(M.toplam)) + ' kişi işe başladı';
  if (M.dToplam) s += ' (geçen haftaya göre ' + O.isaretli(M.dToplam.fark) + ')';
  if (M.n) {
    s += '. Bölüm payları: ' + O.BOLUMLER.map((x) => O.esc(x) + ' ' + b(O.yuzde(M.pay[x], 0))).join(', ');
    if (M.yogun) s += '; en yoğun ay ' + b(O.ayAdi(M.yogun.ay)) + ' (' + O.sayi(M.yogun.sayi) + ' kişi)';
  }
  return s + '.';
}

function ozetCiz(kok, B, M) {
  const e = B.etiket || {}, oz = M.oz;
  const meta = [];
  const parantez = String(e.label || '').match(/\((.*)\)/);
  if (e.short || e.label) meta.push({ ikon: 'takvim', html: 'Veri dönemi: ' + b(O.esc((e.short || e.label) + (e.short && parantez ? ' (' + parantez[1] + ')' : ''))) + ' itibarıyla' });
  if (!M.fa && oz.hafta_giris != null) meta.push({ ikon: 'alim', html: 'Bu hafta: ' + b(O.sayi(oz.hafta_giris)) + ' yeni giriş' });
  meta.push({ ikon: 'kisiler', html: b(O.sayi(M.depts.length)) + ' departmana alım' + (M.fa ? ' · seçili kapsam' : '') });

  const bolumParca = M.seriler.map((x, i) => ({ ad: x, deger: x === DIGER ? M.diger : M.bc[x], renk: x === DIGER ? O.RENK.n400 : [O.RENK.gk1, O.RENK.gk2, O.RENK.gk7][i] }))
    .map((p) => Object.assign(p, { metin: O.sayi(p.deger) + ' kişi' }));
  const yogunPay = M.yogun && M.n ? Math.round(M.yogun.sayi / M.n * 100) : null;
  O.kaput(kok, {
    B, bindirme: true,
    ustEtiket: 'İnsan Kaynakları · ' + (e.hafta || '2026'),
    baslik: 'İşe Alım',
    ozetHtml: ozetCumlesi(B, M),
    meta,
    kadranlar: [
      { etiket: 'Toplam alım', merkez: M.toplam, parcalar: bolumParca,
        alt: bolumParca.length ? bolumParca.map((p) => anahtar(p.renk) + O.esc(p.ad) + ' ' + b(O.sayi(p.deger))).join(' · ').replace(/ · (?=[^·]*$)/, '<br>') : 'alım kaydı yok' },
      { etiket: 'Net değişim', merkez: M.net, isaret: true,
        parcalar: [{ ad: 'Giriş', deger: M.toplam, renk: O.RENK.gk1, metin: O.sayi(M.toplam) + ' kişi' }, { ad: 'Çıkış', deger: M.cikis, renk: O.RENK.gk3, metin: O.sayi(M.cikis) + ' kişi' }],
        alt: anahtar(O.RENK.gk1) + 'Giriş ' + b(O.sayi(M.toplam)) + ' · ' + anahtar(O.RENK.gk3) + 'Çıkış ' + b(O.sayi(M.cikis)) },
      M.yogun
        ? { etiket: 'En yoğun ay', deger: M.yogun.sayi, max: M.n || 1, merkez: M.yogun.sayi,
          alt: b(O.ayAdi(M.yogun.ay)) + ' · toplam alım içinde ' + b(O.yuzde(yogunPay, 0)) }
        : { etiket: 'En yoğun ay', merkez: null, parcalar: [], alt: 'alım kaydı yok' }
    ]
  });

  const payMetni = (x) => (M.n ? b(O.yuzde(M.pay[x], 0)) + ' ' + O.trKucuk(x) + ' bölümü' : 'bölüm payı');
  O.kpiPanel(kok, [
    { grup: { baslik: 'İşe alım', alt: M.fa ? 'seçili kapsam' : '2026 · yılbaşından bugüne', ikon: 'alim' }, ogeler: [
      { anahtar: 'toplam', etiket: 'Toplam alım', deger: M.toplam, alt: '2026 yılında',
        delta: M.dToplam ? Object.assign({ iyiYon: null, metin: 'geçen haftaya göre' }, M.dToplam) : null },
      { anahtar: 'servis', etiket: 'Servis alım', deger: M.bc['Servis'], altHtml: payMetni('Servis') },
      { anahtar: 'satis', etiket: 'Satış alım', deger: M.bc['Satış'], altHtml: payMetni('Satış') },
      { anahtar: 'idari', etiket: 'İdari alım', deger: M.bc['İdari'], altHtml: payMetni('İdari') },
      { anahtar: 'yogun', etiket: 'En yoğun ay', metin: M.yogun ? O.ayAdi(M.yogun.ay) : '—', alt: M.yogun ? O.sayi(M.yogun.sayi) + ' kişi işe başladı' : 'alım kaydı yok' }
    ] }
  ], { sinif: 'bindir' });
}

/* ==========================================================================
   (2) TREND — aylık işe alım (bölüm kırılımlı) · giriş ve çıkış
   ========================================================================== */
function sutun(label, data, renk) {
  return { label, data, backgroundColor: renk, hoverBackgroundColor: renk, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22,
    categoryPercentage: 0.66, barPercentage: 0.9, datalabels: O.etiket.ust() };
}
/* Yığılmış sütun: yalnız en üstteki dolu dilimin üst köşeleri yuvarlak; toplam etiketi en üst veri kümesinde */
function ustDilimMi(ctx) {
  const ds = ctx.chart.data.datasets, i = ctx.dataIndex;
  if (i === undefined || !(+ds[ctx.datasetIndex].data[i] > 0)) return false;
  for (let k = ctx.datasetIndex + 1; k < ds.length; k++) if (+ds[k].data[i] > 0) return false;
  return true;
}
const yiginToplami = (ctx) => ctx.chart.data.datasets.reduce((s, d) => s + (+d.data[ctx.dataIndex] || 0), 0);
function yiginKumesi(ad, veri, renk, enUst) {
  return {
    label: ad, data: veri, backgroundColor: renk, hoverBackgroundColor: renk, maxBarThickness: 22, categoryPercentage: 0.62, barPercentage: 0.9,
    borderSkipped: false, borderRadius: (ctx) => (ustDilimMi(ctx) ? { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 } : 0),
    datalabels: enUst ? {
      display: (ctx) => yiginToplami(ctx) > 0, anchor: 'end', align: 'end', offset: 2, clamp: true, color: O.RENK.n700,
      font: { family: 'Inter', size: 10.5, weight: '600' }, formatter: (v, ctx) => O.sayi(yiginToplami(ctx))
    } : { display: false }
  };
}

function trendCiz(kok, B, M) {
  O.akisBaslik(kok, { no: '02', baslik: 'Trend', aciklama: 'Aylık işe alım ve giriş–çıkış karşılaştırması · 2026' });
  const iz = O.izgara(kok);
  const ilk = M.aylar[0], son = M.aylar[M.aylar.length - 1];
  const donem = O.ayAdi(ilk) + (son !== ilk ? '–' + O.ayAdi(son) : '') + ' 2026';
  const kapsam = M.fa ? ' · seçili kapsam' : '';
  const baslikAy = (it) => (it.length ? O.ayAdi(M.aylar[it[0].dataIndex]) + ' 2026' : '');

  /* Aylık işe alım — bölümlere göre yığılmış (index: ia-trend + ia-bol bilgisi) */
  const g1 = O.grafikKarti(iz, {
    baslik: 'Aylık işe alım', aciklama: 'Bölümlere göre kişi sayısı · ' + donem + kapsam, sinif: 's7', yukseklik: 290,
    lejant: M.seriler.map((x) => ({ ad: x === DIGER ? 'Diğer / belirtilmemiş' : x, renk: bolumRenk(x) })),
    etiket: 'Aylık işe alım sayıları, bölümlere göre yığılmış sütun grafiği',
    tablo: () => ({
      sutunlar: [{ ad: 'Ay' }].concat(M.seriler.map((x) => ({ ad: x, sag: true })), [{ ad: 'Toplam', sag: true }]),
      satirlar: M.aylar.map((m, i) => [O.ayAdi(m)].concat(M.seriler.map((x) => O.sayi(M.trendBolum[x][i])), [O.sayi(M.trendGiris[i])]))
    })
  });
  O.grafik(g1.canvas, {
    type: 'bar',
    data: { labels: M.aylar.map(O.ayKisa), datasets: M.seriler.map((x, k) => yiginKumesi(x === DIGER ? 'Diğer' : x, M.trendBolum[x], bolumRenk(x), k === M.seriler.length - 1)) },
    options: {
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 8 } },
      scales: { x: O.eksenX({ stacked: true }), y: O.eksenY({ stacked: true, grace: '14%' }) },
      plugins: { tooltip: {
        filter: (it) => it.parsed.y > 0,
        callbacks: {
          title: baslikAy,
          label: (c) => ' ' + c.dataset.label + ': ' + O.sayi(c.parsed.y) + ' kişi',
          footer: (it) => (it.length ? 'Toplam: ' + O.sayi(M.trendGiris[it[0].dataIndex]) + ' kişi' : '')
        }
      } }
    }
  });
  O.kartNot(g1.govde, (M.yogun ? 'En yoğun ay ' + O.ayAdi(M.yogun.ay) + ' (' + O.sayi(M.yogun.sayi) + ' kişi). ' : '') + 'Sütun üstündeki sayı o ayın toplam alımıdır; dilimler bölümleri gösterir.');

  /* Giriş ve çıkış (index: ia-vs) */
  const g2 = O.grafikKarti(iz, {
    baslik: 'Giriş ve çıkış', aciklama: 'Aylık kişi sayısı · ' + donem + kapsam, sinif: 's5', yukseklik: 290,
    lejant: [{ ad: 'Giriş', renk: O.RENK.giris }, { ad: 'Çıkış', renk: O.RENK.cikis }],
    etiket: 'Aylık giriş ve çıkış sayıları sütun grafiği',
    tablo: () => ({
      sutunlar: [{ ad: 'Ay' }, { ad: 'Giriş', sag: true }, { ad: 'Çıkış', sag: true }, { ad: 'Net', sag: true }],
      satirlar: M.aylar.map((m, i) => [O.ayAdi(m), O.sayi(M.trendGiris[i]), O.sayi(M.trendCikis[i]), O.isaretli(M.trendGiris[i] - M.trendCikis[i])])
    })
  });
  O.grafik(g2.canvas, {
    type: 'bar',
    data: { labels: M.aylar.map(O.ayKisa), datasets: [sutun('Giriş', M.trendGiris, O.RENK.giris), sutun('Çıkış', M.trendCikis, O.RENK.cikis)] },
    options: {
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 6 } },
      scales: { x: O.eksenX(), y: O.eksenY({ grace: '14%' }) },
      plugins: { tooltip: { callbacks: {
        title: baslikAy,
        label: (c) => ' ' + c.dataset.label + ': ' + O.sayi(c.parsed.y) + ' kişi',
        footer: (it) => { if (!it.length) return ''; const i = it[0].dataIndex; return 'Net: ' + O.isaretli(M.trendGiris[i] - M.trendCikis[i]); }
      } } }
    }
  });
  const topG = M.trendGiris.reduce((s, v) => s + v, 0), topC = M.trendCikis.reduce((s, v) => s + v, 0);
  O.kartNot(g2.govde, 'Dönem toplamı: ' + O.sayi(topG) + ' giriş, ' + O.sayi(topC) + ' çıkış (net ' + O.isaretli(topG - topC) + '). Yer darsa yalnız en yüksek ve son değer yazılır; tüm değerler Tablo görünümünde.');
}

/* ==========================================================================
   (3) KIRILIM — bölüm · en çok alınan unvanlar · departman
   ========================================================================== */
function kirilimCiz(kok, B, M) {
  O.akisBaslik(kok, { no: '03', baslik: 'Kırılım', aciklama: 'Bölüm, unvan ve departman dağılımları' + (M.fa ? ' · seçili kapsam' : '') });
  const iz1 = O.izgara(kok);
  bolumKarti(iz1, M);
  unvanKarti(iz1, M);
  departmanKarti(O.izgara(kok), M);
}

/* Bölüm dağılımı (index: ia-bol donut) — parça-bütün şeridi + kişi ve pay */
function bolumKarti(iz, M) {
  const { govde } = O.kart(iz, { baslik: 'Bölüm dağılımı', aciklama: '2026 · alım yapılan bölümler', sinif: 's5' });
  if (!M.n) { O.bosDurum(govde, { ikon: 'alim', baslik: 'İşe alım kaydı yok', metin: 'Seçili kapsamda 2026 yılında işe başlayan bulunmuyor.', kucuk: true }); return; }
  const parcalar = M.seriler.map((x) => ({ ad: x, deger: x === DIGER ? M.diger : M.bc[x], renk: bolumRenk(x) }));
  O.dagilimSeridi(govde, parcalar, { bicim: (v) => O.sayi(v) + ' kişi' });
  const liste = O.el('div', { class: 'dagilim-liste ia-tek-kolon', role: 'list' });
  parcalar.forEach((p) => {
    const isaret = O.el('i', { class: 'anahtar' });
    isaret.style.background = p.renk;
    liste.append(O.el('div', { class: 'dagilim-satir', role: 'listitem', 'data-bolum': p.ad, 'data-adet': String(p.deger) }, isaret,
      O.el('span', { class: 'ad' }, O.el('span', { text: p.ad === DIGER ? 'Diğer / belirtilmemiş' : p.ad })),
      O.el('span', { class: 'adet', text: O.sayi(p.deger) + ' kişi' }),
      O.el('span', { class: 'pay', text: O.yuzde(Math.round(p.deger / M.n * 100), 0) })));
  });
  govde.append(liste);
  govde.append(O.el('div', { class: 'kart-alt-cubuk', html: '<span>Toplam ' + b(O.sayi(M.n)) + ' kişi</span><span>Yüzdeler tam sayıya yuvarlanır</span>' }));
}

/* En çok alınan 5 unvan (index: ia-unvan-top5) */
function unvanKarti(iz, M) {
  const { govde } = O.kart(iz, { baslik: 'En çok alınan 5 unvan', aciklama: '2026 · unvan bazında işe alım', sinif: 's7' });
  O.cubukListe(govde, M.unvanlar.map(([ad, deger]) => ({ ad, deger })), { bicim: (v) => O.sayi(v) + ' kişi', adGenislik: '46%', bos: 'Unvan bilgisi olan alım kaydı yok' });
  if (M.unvanlar.length && M.n) {
    const top = M.unvanlar.reduce((s, x) => s + x[1], 0);
    govde.append(O.el('div', { class: 'kart-alt-cubuk', html: '<span>İlk ' + M.unvanlar.length + ' unvanın toplam alımdaki payı: ' + b(O.yuzde(Math.round(top / M.n * 100), 0)) + '</span><span>' + b(O.sayi(M.unvanSayisi)) + ' farklı unvan</span>' }));
  }
}

/* Departman bazında alım (index: ia-dept-bars — tüm departmanlar, azalan) — geniş ekranda iki kolon */
function departmanKarti(iz, M) {
  const satirlar = M.depts.map(([ad, deger]) => ({ ad, deger }));
  const { govde } = O.kart(iz, { baslik: 'Departman bazında alım', aciklama: '2026 · ' + O.sayi(satirlar.length) + ' departman · en çok alım yapandan aza', sinif: 's12' });
  const sec = { bicim: (v) => O.sayi(v) + ' kişi', adGenislik: '42%', bos: 'Alım kaydı yok' };
  if (satirlar.length <= 8) { O.cubukListe(govde, satirlar, sec); return; }
  const mx = Math.max(1, ...satirlar.map((s) => +s.deger || 0));
  const yarim = Math.ceil(satirlar.length / 2);
  const kap = O.el('div', { class: 'ia-iki-kolon' });
  govde.append(kap);
  O.cubukListe(kap, satirlar.slice(0, yarim), Object.assign({ max: mx }, sec));
  O.cubukListe(kap, satirlar.slice(yarim), Object.assign({ max: mx }, sec));
}

/* ==========================================================================
   (4) LİSTE — işe alım listesi (index: ia-tb; ay + bölüm süzgeci eklendi, aylar veriden)
   ========================================================================== */
function listeCiz(kok, B, M) {
  O.akisBaslik(kok, { no: '04', baslik: 'Liste', aciklama: '2026’da işe başlayanlar · ay ve bölüme göre süzün, başlığa tıklayarak sıralayın' });
  const ayVar = [...new Set(M.aylar.concat(M.ia.map((d) => d.ay).filter((m) => m >= 1 && m <= 12)))].sort((x, y) => x - y);
  if (durum.ay && ayVar.indexOf(+durum.ay) < 0) durum.ay = '';
  if (durum.bolum && M.seriler.indexOf(durum.bolum) < 0) durum.bolum = '';
  const suz = () => M.ia.filter((d) => (!durum.ay || d.ay === +durum.ay) && (!durum.bolum || bolumAdi(d) === durum.bolum));

  const arac = O.el('div', { class: 'ia-arac' });
  const sAy = O.secim(arac, { secenekler: [{ v: '', ad: 'Tüm aylar' }].concat(ayVar.map((m) => ({ v: String(m), ad: O.ayAdi(m) }))), deger: durum.ay, genislik: '150px',
    degisince: (v) => { durum.ay = v; t.guncelle(suz()); } });
  const sBol = O.secim(arac, { secenekler: [{ v: '', ad: 'Tüm bölümler' }].concat(M.seriler.map((x) => ({ v: x, ad: x === DIGER ? 'Diğer / belirtilmemiş' : x }))), deger: durum.bolum, genislik: '170px',
    degisince: (v) => { durum.bolum = v; t.guncelle(suz()); } });
  sAy.setAttribute('aria-label', 'Ay süzgeci');
  sBol.setAttribute('aria-label', 'Bölüm süzgeci');

  const { govde } = O.kart(kok, { baslik: 'İşe alım listesi', aciklama: '2026 · ' + O.sayi(M.n) + ' kayıt' + (M.fa ? ' · seçili kapsam' : '') + ' · varsayılan sıra: en yeni başlayan üstte', sinif: 'kart-liste' });
  const t = O.tablo(govde, {
    sutunlar: [
      { k: 'ad', ad: 'Ad Soyad', sinif: 'ad-hucre' },
      { k: 'dept', ad: 'Departman' },
      { k: 'bolum', ad: 'Bölüm' },
      { k: 'unvan', ad: 'Unvan', hucreSinif: () => 'soluk' },
      { k: 'tarih', ad: 'İşe başlama', tip: 'tarih' }
    ],
    satirlar: suz(),
    sayfaBoyu: 12,
    siraNo: true,
    araYer: 'Ad, departman, bölüm, unvan ara…',
    araAlanlari: ['ad', 'dept', 'bolum', 'unvan'],
    varsayilanSira: { k: 'tarih', y: 'azalan' },
    aracEk: arac,
    altMetin: (n, top) => (n === top ? O.sayi(n) : O.sayi(n) + ' / ' + O.sayi(top)) + ' kayıt' + (durum.ay || durum.bolum ? ' · liste süzgeci açık' : ''),
    bos: { baslik: 'Kayıt bulunamadı', metin: 'Ay, bölüm ya da arama seçimini değiştirin.' }
  });
}

function notlarCiz(kok, B) {
  const e = B.etiket || {};
  O.notlar(kok, [
    'Kaynak: haftalık İK pano paketi' + (e.label ? ' (' + e.label + ')' : '') + '. Toplam alım paketteki yılbaşından bugüne giriş sayısıdır; departman filtresi seçiliyken liste kayıtlarından sayılır.',
    'Bölüm payları, en yoğun ay, unvan ve departman dağılımları işe alım listesinden hesaplanır; yüzdeler tam sayıya yuvarlanır.',
    'Giriş ve çıkış grafiğinde çıkışlar İşten Ayrılanlar listesinden sayılır; departman filtresi seçiliyken iki seri de seçili kapsama aittir.',
    'Ay ekseni paketteki ay sayısından gelir. Liste süzgeçleri (ay, bölüm, arama) yalnız tabloyu süzer; göstergeler ve grafikler değişmez.'
  ]);
}
