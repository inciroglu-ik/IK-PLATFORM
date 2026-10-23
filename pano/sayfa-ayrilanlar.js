/* ==========================================================================
   İK DASHBOARD 2.0 · İŞTEN AYRILANLAR  (pano/sayfa-ayrilanlar.js)
   --------------------------------------------------------------------------
   Akış (BRIEF): (1) Özet — kaput + gösterge panosu (2) Trend (3) Kırılım (4) Liste.
   Firebase import ETMEZ; tüm veri B (bağlam) ile gelir. Sözleşme: pano/KABUK.md
   index.html renderAY / ayFilter / ayKPI / ayChrt / ayTbl / ayKidemOzet ile AYNI kurallar:
   • KPI yüzdeleri round(x / n × 100) · Diğer = İstifa ve İşveren Feshi dışı · Aylık ort. = n / çıkış görülen ay sayısı
   • kıdem kovaları ≤60 / ≤180 / ≤365 / ≤730 / ≤1095 gün (boş süre 0–2 ay kovasına düşer); kıdem özeti boş süreyi atlar
   • gerçek neden = gercekKat(aciklama), yüzde paydası tüm kayıtlar · unvan ilk 5 · departman çoktan aza
   Düzeltmeler: ay hapları VERİDEN (B3/B7) · istenen ?? istened (B1/B5) · seçenekler her çizimde güncel
   kapsamdan (B13/B14) · Türkçe karakterli metin ve Türkçe duyarlı arama.
   Sayfa filtreleri (ay, bölüm, neden, unvan, istenen, arama) göstergeleri, grafikleri, kıdem kutusunu ve
   listeyi birlikte süzer (bugünkü davranış). Kaput, seçili departman kapsamının tamamını özetler.
   Ortak kitaplıkta olmayan, bu modülde yazılan yardımcılar: kişi ayrıntısı penceresi (kisiAc),
   görünen listeyi Excel'e aktarma (excelAktar), yığılmış sütun değer etiketleri (icEtiket/toplamEtiket),
   kısmi yeniden çizimde grafik silme (grafikleriSil).
   ========================================================================== */
import * as O from './ortak.js';

export const meta = { id: 'ay', baslik: 'İşten Ayrılanlar', ikon: O.ikon('kapi') };

/* Yeniden çizimler (global filtre değişimi) arasında korunan sayfa içi seçimler */
const durum = { ay: 0, bolum: '', neden: '', unvan: '', istenen: '', q: '' };
let grafikler = [];
let pencere = null;
let araZaman = null;

export function ciz(kok, B) {
  stilEkle(kok);
  const T = taban(B);
  durumDogrula(T);
  ozetCiz(kok, B, T);
  const kpiYuva = O.el('div', { class: 'bindir' });
  kok.append(kpiYuva);
  const fc = filtreCubugu(kok, T, () => yenile());
  const dinamik = O.el('div', { class: 'ay-dinamik' });
  kok.append(dinamik);
  notlarCiz(kok, B);

  /* Sayfa filtresi değişince yalnız bağımlı bölümler yeniden çizilir (arama kutusu odağını korur) */
  function yenile() {
    grafikleriSil();
    const d = suz(T.tum);
    kpiYuva.textContent = '';
    dinamik.textContent = '';
    kpiCiz(kpiYuva, T, d);
    trendCiz(dinamik, T, d);
    kirilimCiz(dinamik, T, d);
    listeCiz(dinamik, B, T, d);
    fc.guncelle(d);
  }
  yenile();
}
export function temizle() {
  clearTimeout(araZaman);
  kisiKapat(true);
  grafikler = []; /* grafikleri kabuk siler (O.grafikleriTemizle) */
}

/* ==========================================================================
   VERİ — kapsam, seçenekler ve sayfa filtresi
   ========================================================================== */
function taban(B) {
  const D = B.D || {}, tum = (B.filtreli && B.filtreli.ayrilanlar) || [];
  /* Ay ekseni VERİDEN: 1..ozet.ay_sayisi; kayıtlarda daha ileri bir ay varsa eksen uzar */
  const aylar = O.aylar(D).slice();
  const enBuyuk = tum.reduce((m, x) => Math.max(m, +x.ay || 0), 0);
  for (let m = aylar.length + 1; m <= Math.min(12, enBuyuk); m++) aylar.push(m);
  const nedenler = O.NEDENLER.slice();
  tum.forEach((x) => { if (x.neden && nedenler.indexOf(x.neden) < 0) nedenler.push(x.neden); });
  const unvanlar = [...new Set(tum.map((x) => x.unvan).filter(Boolean))].sort(O.trKarsilastir);
  const bolumler = O.BOLUMLER.filter((b) => tum.some((x) => x.bolum === b));
  return { D, tum, aylar, nedenler, unvanlar, bolumler, fa: !!B.filtreAktif, filtre: B.filtre };
}
function durumDogrula(T) {
  if (durum.ay && T.aylar.indexOf(durum.ay) < 0) durum.ay = 0;
  if (durum.bolum && T.bolumler.indexOf(durum.bolum) < 0) durum.bolum = '';
  if (durum.neden && T.nedenler.indexOf(durum.neden) < 0) durum.neden = '';
  if (durum.unvan && T.unvanlar.indexOf(durum.unvan) < 0) durum.unvan = '';
}
function suz(dizi) {
  const q = O.aramaAnahtari(durum.q);
  return dizi.filter((d) => {
    if (durum.ay && +d.ay !== durum.ay) return false;
    if (durum.bolum && d.bolum !== durum.bolum) return false;
    if (durum.neden && d.neden !== durum.neden) return false;
    if (durum.unvan && d.unvan !== durum.unvan) return false;
    if (durum.istenen === 'evet' && !O.istenenMi(d)) return false;
    if (durum.istenen === 'hayir' && O.istenenMi(d)) return false;
    if (q && !O.aramaAnahtari([d.ad, d.dept, d.bolum, d.unvan].join(' ')).includes(q)) return false;
    return true;
  });
}
function yerelFiltreMetni() {
  const p = [];
  if (durum.ay) p.push(O.ayAdi(durum.ay));
  if (durum.bolum) p.push(durum.bolum);
  if (durum.neden) p.push(durum.neden);
  if (durum.unvan) p.push(durum.unvan);
  if (durum.istenen) p.push(durum.istenen === 'evet' ? 'İstenen' : 'İstenmeyen');
  if (durum.q.trim()) p.push('“' + durum.q.trim() + '”');
  return p.join(' · ');
}
const yerelAktif = () => !!(durum.ay || durum.bolum || durum.neden || durum.unvan || durum.istenen || durum.q.trim());
function kapsamEki(T) { const y = yerelFiltreMetni(); return (T.fa ? ' · seçili kapsam' : '') + (y ? ' · filtre: ' + y : ''); }
function donemMetni(T) {
  const ilk = T.aylar[0], son = T.aylar[T.aylar.length - 1];
  return O.ayAdi(ilk) + (son !== ilk ? '–' + O.ayAdi(son) : '') + ' 2026';
}

/* index.html ayKPI ile aynı sayımlar (+ istenen/istenmeyen) */
function kpiHesap(d) {
  const n = d.length;
  const ist = d.filter((x) => x.neden === 'İstifa').length;
  const iv = d.filter((x) => x.neden === 'İşveren Feshi').length;
  const dig = d.filter((x) => x.neden !== 'İstifa' && x.neden !== 'İşveren Feshi').length;
  const aySet = new Set(d.filter((x) => x.ay > 0).map((x) => x.ay));
  const istenen = d.filter(O.istenenMi).length;
  return {
    n, ist, iv, dig,
    pIst: n ? Math.round(ist / n * 100) : null,
    aySay: aySet.size, ort: aySet.size ? n / aySet.size : null,
    pk: O.enYogunAy(d),
    istenen, istenmeyen: n - istenen
  };
}

/* ==========================================================================
   (1) ÖZET — kaput (seçili departman kapsamının tamamı) + gösterge panosu (sayfa filtreli)
   ========================================================================== */
const b = (v) => '<b>' + v + '</b>';
const anahtar = (renk) => '<i style="background:' + renk + '"></i>';

function ozetCiz(kok, B, T) {
  const e = B.etiket || {}, n = T.tum.length, k = kpiHesap(T.tum);
  const kid = O.ayrilanKidemOzeti(T.tum);
  const say = O.grupSay(T.tum, (x) => x.neden || 'Diğer');
  const on = T.fa ? 'Seçili kapsamda (' + O.esc(O.filtreMetni(T.filtre)) + ') ' : '';
  let s;
  if (!n) s = on + donemMetni(T) + ' döneminde ayrılan personel kaydı yok.';
  else {
    s = on + donemMetni(T) + ' döneminde ' + b(O.sayi(n)) + ' kişi ayrıldı; en sık neden ' + b(O.esc(say[0][0]))
      + ' (' + b(O.yuzde(Math.round(say[0][1] / n * 100), 0)) + '). Ayrılışların istenen payı ' + b(O.yuzde(Math.round(k.istenen / n * 100), 0))
      + ', istenmeyen payı ' + b(O.yuzde(Math.round(k.istenmeyen / n * 100), 0));
    if (k.pk) s += '; en yoğun ay ' + b(O.ayAdi(k.pk.ay)) + ' (' + O.sayi(k.pk.sayi) + ' kişi)';
    s += '.';
  }
  const aciklamali = T.tum.filter((x) => O.gercekKat(x.aciklama)).length;
  const meta = [];
  if (e.short || e.label) meta.push({ ikon: 'takvim', html: 'Veri dönemi: ' + b(O.esc(e.short || e.label)) });
  meta.push({ ikon: 'dosya', html: 'Gerçek nedeni girilmiş: ' + b(O.sayi(aciklamali)) + ' / ' + O.sayi(n) + ' kayıt' });

  const parca = n ? [
    { ad: 'İstenen', deger: k.istenen, renk: O.RENK.gk6, metin: O.sayi(k.istenen) + ' kişi' },
    { ad: 'İstenmeyen', deger: k.istenmeyen, renk: O.RENK.gk2, metin: O.sayi(k.istenmeyen) + ' kişi' }
  ] : [];
  O.kaput(kok, {
    B, bindirme: true,
    ustEtiket: 'İnsan Kaynakları · ' + (e.hafta || '2026'),
    baslik: 'İşten Ayrılanlar',
    ozetHtml: s,
    meta,
    kadranlar: [
      { etiket: 'Ayrılan', merkez: n, parcalar: parca,
        alt: parca.length ? parca.map((p) => anahtar(p.renk) + p.ad + ' ' + b(p.metin)).join('<br>') : 'kayıt yok' },
      { etiket: 'İstifa payı', deger: k.pIst, max: 100, onek: '%',
        alt: n ? b(O.sayi(k.ist)) + ' / ' + O.sayi(n) + ' çıkış istifa' : 'kayıt yok' },
      { etiket: 'Ort. kıdem', deger: kid ? kid.ortAy : null, max: kid ? Math.max(kid.maxAy, 1) : 1, merkez: kid ? kid.ortAy : null, sonek: ' ay',
        alt: kid ? '≈ ' + b(O.sayi(kid.ortYil, 1)) + ' yıl · min–maks ' + b(O.sayi(kid.minAy) + '–' + O.sayi(kid.maxAy)) + ' ay' : 'kıdem verisi yok' }
    ]
  });
}

function kpiCiz(kap, T, d) {
  const k = kpiHesap(d), n = k.n;
  const pay = (x) => (n ? O.yuzde(Math.round(x / n * 100), 0) + ' toplam çıkışın' : 'kayıt yok');
  const y = yerelFiltreMetni();
  O.kpiPanel(kap, [{
    grup: { baslik: 'Ayrılış özeti', alt: (y ? 'Filtre: ' + y : 'Tüm kayıtlar · ' + donemMetni(T)) + (T.fa ? ' · seçili kapsam' : ''), ikon: 'kapi' },
    ogeler: [
      { anahtar: 'ay-toplam', etiket: 'Toplam', deger: n, alt: 'kişi ayrıldı' },
      { anahtar: 'ay-istifa', etiket: 'İstifa', deger: k.ist, alt: pay(k.ist) },
      { anahtar: 'ay-isveren', etiket: 'İşveren feshi', deger: k.iv, alt: pay(k.iv) },
      { anahtar: 'ay-diger', etiket: 'Diğer nedenler', deger: k.dig, alt: pay(k.dig), ipucu: 'İstifa ve işveren feshi dışındaki tüm nedenler' },
      { anahtar: 'ay-ort', etiket: 'Aylık ort.', deger: k.ort, ondalik: 1, alt: k.aySay ? 'kişi/ay · ' + O.sayi(k.aySay) + ' ay' : 'kayıt yok' },
      { anahtar: 'ay-yogun', etiket: 'En yoğun ay', metin: k.pk ? O.ayAdi(k.pk.ay) : '—', alt: k.pk ? O.sayi(k.pk.sayi) + ' kişi ayrıldı' : 'kayıt yok' }
    ]
  }]);
}

/* Sayfa filtre çubuğu — kalıcıdır; değişiklikte yalnız bağımlı bölümler yeniden çizilir */
function filtreCubugu(kok, T, yenile) {
  const sayac = O.el('span', { class: 'ay-sayac', 'aria-live': 'polite' });
  const temizleBtn = O.el('button', { class: 'btn btn-hayalet', type: 'button', html: O.ikon('sifirla') + '<span>Filtreleri temizle</span>' });
  const { govde } = O.kart(kok, {
    baslik: 'Sayfa filtreleri', aciklama: 'Göstergeler, grafikler, kıdem kutusu ve liste birlikte süzülür', sinif: 'ay-filtre',
    sag: O.el('div', { class: 'ay-filtre-sag' }, sayac, temizleBtn)
  });
  /* Ay hapları — veriden */
  const ayAlan = O.el('div', { class: 'alan ay-alan' }, O.el('span', { class: 'alan-etiket', text: 'Ay' }));
  const hapKap = O.el('div', { class: 'ay-haplar' });
  ayAlan.append(hapKap);
  const ayB = O.bolumlu(hapKap, {
    secenekler: [{ v: 0, ad: 'Tümü' }].concat(T.aylar.map((m) => ({ v: m, ad: O.ayKisa(m), ipucu: O.ayAdi(m) + ' 2026' }))),
    deger: durum.ay, kucuk: true, etiket: 'Ay', degisince: (v) => { durum.ay = +v || 0; yenile(); }
  });
  govde.append(ayAlan);
  const satir = O.el('div', { class: 'ay-filtre-satir' });
  govde.append(satir);
  const bolS = O.secim(satir, { etiket: 'Bölüm', secenekler: [{ v: '', ad: 'Tüm bölümler' }].concat(T.bolumler.map((x) => ({ v: x, ad: x }))), deger: durum.bolum, degisince: (v) => { durum.bolum = v; yenile(); } });
  const nedS = O.secim(satir, { etiket: 'Neden', secenekler: [{ v: '', ad: 'Tüm nedenler' }].concat(T.nedenler.map((x) => ({ v: x, ad: x }))), deger: durum.neden, degisince: (v) => { durum.neden = v; yenile(); } });
  const unvS = O.secim(satir, { etiket: 'Unvan', secenekler: [{ v: '', ad: 'Tüm unvanlar' }].concat(T.unvanlar.map((x) => ({ v: x, ad: x }))), deger: durum.unvan, degisince: (v) => { durum.unvan = v; yenile(); } });
  unvS.parentElement.classList.add('ay-unvan');
  const istAlan = O.el('div', { class: 'alan ay-tur' }, O.el('span', { class: 'alan-etiket', text: 'Ayrılış türü' }));
  const istB = O.bolumlu(istAlan, {
    secenekler: [{ v: '', ad: 'Tümü' }, { v: 'evet', ad: 'İstenen', ipucu: 'İşveren feshi, deneme (işveren), askerlik, 25. madde, emeklilik, belirli süreli' }, { v: 'hayir', ad: 'İstenmeyen' }],
    deger: durum.istenen, kucuk: true, etiket: 'Ayrılış türü', degisince: (v) => { durum.istenen = v; yenile(); }
  });
  satir.append(istAlan);
  const araAlan = O.el('div', { class: 'alan ay-ara' }, O.el('span', { class: 'alan-etiket', text: 'Ara' }));
  const araKutu = O.el('label', { class: 'ara-kutu', html: O.ikon('ara') });
  const girdi = O.el('input', { class: 'girdi', type: 'search', placeholder: 'Ad, departman, bölüm, unvan…', 'aria-label': 'Ayrılanlarda ara', autocomplete: 'off', value: durum.q });
  araKutu.append(girdi);
  araAlan.append(araKutu);
  satir.append(araAlan);
  girdi.addEventListener('input', () => { clearTimeout(araZaman); araZaman = setTimeout(() => { durum.q = girdi.value; yenile(); }, 180); });
  temizleBtn.addEventListener('click', () => {
    clearTimeout(araZaman);
    Object.assign(durum, { ay: 0, bolum: '', neden: '', unvan: '', istenen: '', q: '' });
    ayB.ayarla(0); istB.ayarla(''); bolS.value = ''; nedS.value = ''; unvS.value = ''; girdi.value = '';
    yenile();
  });
  return {
    guncelle(d) {
      sayac.textContent = d.length === T.tum.length ? O.sayi(d.length) + ' kayıt' : O.sayi(d.length) + ' / ' + O.sayi(T.tum.length) + ' kayıt';
      temizleBtn.disabled = !yerelAktif();
    }
  };
}

/* ==========================================================================
   GRAFİK YARDIMCILARI
   ========================================================================== */
function grafik(canvas, cfg) { const c = O.grafik(canvas, cfg); if (c) grafikler.push(c); return c; }
function grafikleriSil() { grafikler.forEach((c) => { try { c.destroy(); } catch (e) { /* zaten silinmiş */ } }); grafikler = []; }
function bosGrafik(g, baslik, metin) { g.kap.textContent = ''; O.bosDurum(g.kap, { ikon: 'filtre', baslik, metin: metin || 'Filtreleri değiştirin ya da temizleyin.', kucuk: true }); }
/* Yığılmış sütunda dilim içi değer (yer yetiyorsa) */
function icEtiket(minPx) {
  return {
    display: (ctx) => {
      const v = ctx.dataset.data[ctx.dataIndex];
      if (!v) return false;
      const el = ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.dataIndex];
      if (!el) return false;
      const p = el.getProps(['x', 'y', 'base'], true);
      const boy = ctx.chart.options.indexAxis === 'y' ? Math.abs(p.x - p.base) : Math.abs(p.base - p.y);
      return boy >= (minPx || 16);
    },
    anchor: 'center', align: 'center', clamp: true, color: '#fff', font: { family: 'Inter', size: 10.5, weight: '600' }, formatter: (v) => O.sayi(v)
  };
}
/* Yığının ucunda toplam (son veri kümesine eklenir) */
function toplamEtiket(toplamlar, yatay) {
  return {
    display: (ctx) => (toplamlar[ctx.dataIndex] || 0) > 0,
    anchor: 'end', align: 'end', offset: yatay ? 6 : 3, clamp: true, color: O.RENK.n800, font: { family: 'Inter', size: 10.5, weight: '700' },
    formatter: (v, ctx) => O.sayi(toplamlar[ctx.dataIndex])
  };
}
function sutun(label, data, renk, ek) {
  return Object.assign({ label, data, backgroundColor: renk, hoverBackgroundColor: renk, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22, categoryPercentage: 0.66, barPercentage: 0.9 }, ek || {});
}

/* ==========================================================================
   (2) TREND — aylık çıkış (en yoğun ay vurgulu) · nedene göre aylık çıkış
   ========================================================================== */
function trendCiz(kap, T, d) {
  O.akisBaslik(kap, { no: '02', baslik: 'Trend', aciklama: 'Aylık çıkış ve nedenlerin seyri · ' + donemMetni(T) + kapsamEki(T) });
  const iz = O.izgara(kap);
  const ay = T.aylar, n = d.length;
  const say = O.aySay(d, ay);
  const mx = Math.max(0, ...say);
  const acik = O.renkSaydam(O.RENK.cikis, 0.42);
  const pay = (v) => (n ? O.yuzde(Math.round(v / n * 100), 0) : '—');

  /* Aylık çıkış (index: ay-trend — en yüksek ay vurgulu) */
  const g1 = O.grafikKarti(iz, {
    baslik: 'Aylık çıkış', aciklama: 'Kişi sayısı · en yoğun ay koyu renkle vurgulanır', sinif: 's7', yukseklik: 290,
    lejant: [{ ad: 'Çıkış', renk: acik }, { ad: 'En yoğun ay', renk: O.RENK.cikis }],
    etiket: 'Aylık çıkış sayıları sütun grafiği',
    tablo: () => ({ sutunlar: [{ ad: 'Ay' }, { ad: 'Çıkış', sag: true }, { ad: 'Pay', sag: true }], satirlar: ay.map((m, i) => [O.ayAdi(m), O.sayi(say[i]), pay(say[i])]) })
  });
  if (!n) bosGrafik(g1, 'Seçili filtrede çıkış kaydı yok');
  else {
    const renkler = say.map((v) => (v === mx ? O.RENK.cikis : acik));
    grafik(g1.canvas, {
      type: 'bar',
      data: { labels: ay.map(O.ayKisa), datasets: [sutun('Çıkış', say, renkler, { hoverBackgroundColor: renkler, datalabels: O.etiket.ust() })] },
      options: {
        layout: { padding: { top: 6 } },
        scales: { x: O.eksenX(), y: O.eksenY({ grace: '14%' }) },
        plugins: { tooltip: { displayColors: false, callbacks: {
          title: (it) => O.ayAdi(ay[it[0].dataIndex]) + ' 2026',
          label: (c) => ' Çıkış: ' + O.sayi(c.parsed.y) + ' kişi',
          footer: (it) => 'Toplam çıkış içindeki pay: ' + pay(say[it[0].dataIndex])
        } } }
      }
    });
    const pk = O.enYogunAy(d);
    if (pk) O.kartNot(g1.govde, 'En yoğun çıkış ayı ' + O.ayAdi(pk.ay) + ' (' + O.sayi(pk.sayi) + ' kişi). Sütun üstündeki sayılar kişi sayısıdır.');
  }

  /* Nedene göre aylık çıkış — İstifa · İşveren Feshi · diğer nedenler (yığılmış) */
  const seri = [
    { ad: 'İstifa', renk: O.nedenRengi('İstifa'), say: (x) => x.neden === 'İstifa' },
    { ad: 'İşveren Feshi', renk: O.nedenRengi('İşveren Feshi'), say: (x) => x.neden === 'İşveren Feshi' },
    { ad: 'Diğer nedenler', renk: O.RENK.diger, say: (x) => x.neden !== 'İstifa' && x.neden !== 'İşveren Feshi' }
  ];
  const veri = seri.map((s) => ay.map((m) => d.filter((x) => +x.ay === m && s.say(x)).length));
  const top = ay.map((m, i) => veri.reduce((t, r) => t + r[i], 0));
  const g2 = O.grafikKarti(iz, {
    baslik: 'Nedene göre aylık çıkış', aciklama: 'Kişi sayısı · dilim içi neden, üstte ay toplamı', sinif: 's5', yukseklik: 290,
    lejant: seri.map((s) => ({ ad: s.ad, renk: s.renk })),
    etiket: 'Nedene göre aylık çıkış yığılmış sütun grafiği',
    tablo: () => ({ sutunlar: [{ ad: 'Ay' }].concat(seri.map((s) => ({ ad: s.ad, sag: true })), [{ ad: 'Toplam', sag: true }]), satirlar: ay.map((m, i) => [O.ayAdi(m)].concat(veri.map((r) => O.sayi(r[i])), [O.sayi(top[i])])) })
  });
  if (!n) bosGrafik(g2, 'Seçili filtrede çıkış kaydı yok');
  else {
    grafik(g2.canvas, {
      type: 'bar',
      data: { labels: ay.map(O.ayKisa), datasets: seri.map((s, i) => sutun(s.ad, veri[i], s.renk, {
        categoryPercentage: 0.7, barPercentage: 0.92, borderRadius: 0, borderSkipped: false,
        datalabels: i === seri.length - 1 ? { labels: { ic: icEtiket(16), toplam: toplamEtiket(top, false) } } : icEtiket(16)
      })) },
      options: {
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 6 } },
        scales: { x: O.eksenX({ stacked: true }), y: O.eksenY({ stacked: true, grace: '16%' }) },
        plugins: { tooltip: { callbacks: {
          title: (it) => O.ayAdi(ay[it[0].dataIndex]) + ' 2026',
          label: (c) => ' ' + c.dataset.label + ': ' + O.sayi(c.parsed.y) + ' kişi',
          footer: (it) => 'Toplam: ' + O.sayi(top[it[0].dataIndex]) + ' kişi'
        } } }
      }
    });
    O.kartNot(g2.govde, 'Diğer nedenler: deneme süresi, askerlik, emeklilik, 25. madde ve sınıflanmamış çıkışlar.');
  }
}

/* ==========================================================================
   (3) KIRILIM — resmî neden · gerçek neden · bölüm × neden · departman · kıdem · unvan
   ========================================================================== */
function kirilimCiz(kap, T, d) {
  O.akisBaslik(kap, { no: '03', baslik: 'Kırılım', aciklama: 'Resmî ve gerçek ayrılma nedeni, bölüm, departman, kıdem ve unvan' + kapsamEki(T) });
  const iz1 = O.izgara(kap);
  nedenKarti(iz1, d);
  gercekKarti(iz1, d);
  const iz2 = O.izgara(kap);
  bolumNedenKarti(iz2, d);
  departmanKarti(iz2, d);
  const iz3 = O.izgara(kap);
  kidemKarti(iz3, d);
  kidemAraligiKarti(iz3, d);
  unvanKarti(iz3, d);
}

/* Resmî ayrılma nedeni (index: ay-neden donut + ay-neden-detail) — parça-bütün şeridi + kişi ve % */
function nedenKarti(iz, d) {
  const n = d.length;
  const { govde } = O.kart(iz, { baslik: 'Ayrılma nedeni', aciklama: 'Resmî (SGK) nedene göre dağılım · kişi ve toplam çıkış içindeki pay', sinif: 's6' });
  if (!n) { O.bosDurum(govde, { ikon: 'kapi', baslik: 'Kayıt bulunamadı', metin: 'Seçili filtrede ayrılan personel yok.', kucuk: true }); return; }
  const say = O.grupSay(d, (x) => x.neden || 'Diğer');
  O.dagilimSeridi(govde, say.map(([k, v]) => ({ ad: k, deger: v, renk: O.nedenRengi(k) })), { bicim: (v) => O.sayi(v) + ' kişi' });
  const liste = O.el('div', { class: 'dagilim-liste', role: 'list' });
  say.forEach(([k, v]) => {
    const isaret = O.el('i', { class: 'anahtar' });
    isaret.style.background = O.nedenRengi(k);
    const ad = O.el('span', { class: 'ad' }, O.el('span', { text: k }));
    if (O.ISTENEN_NED.indexOf(k) >= 0) ad.append(O.el('span', { class: 'cip cip-ey', text: 'istenen', title: 'İstenen ayrılış nedeni' }));
    liste.append(O.el('div', { class: 'dagilim-satir', role: 'listitem', 'data-neden': k, 'data-adet': String(v) }, isaret, ad,
      O.el('span', { class: 'adet', text: O.sayi(v) + ' kişi' }), O.el('span', { class: 'pay', text: O.yuzde(Math.round(v / n * 100), 0) })));
  });
  govde.append(liste);
  const ist = d.filter(O.istenenMi).length;
  govde.append(O.el('div', { class: 'kart-alt-cubuk', html: '<span>İstenen: ' + b(O.sayi(ist)) + ' kişi · İstenmeyen: ' + b(O.sayi(n - ist)) + ' kişi</span><span>Yüzdeler tam sayıya yuvarlanır</span>' }));
}

/* Gerçek ayrılma nedeni (index: ay-gercek-detail — gercekKat, azalan, yüzde paydası tüm kayıtlar) */
function gercekKarti(iz, d) {
  const n = d.length;
  const { govde } = O.kart(iz, { baslik: 'Gerçek ayrılma nedeni', aciklama: 'Açıklama alanından kategorilere ayrılmış · kişi ve toplam çıkış içindeki pay', sinif: 's6' });
  const kat = d.map((x) => O.gercekKat(x.aciklama)).filter(Boolean);
  if (!kat.length) { O.bosDurum(govde, { ikon: 'dosya', baslik: 'Veri yok', metin: 'Seçili kayıtlarda gerçek ayrılma nedeni (açıklama) girilmemiş.', kucuk: true }); return; }
  const say = O.grupSay(kat.map((k) => ({ k })), 'k');
  O.cubukListe(govde, say.map(([ad, v]) => ({ ad, deger: v })), {
    renk: O.RENK.lac500, adGenislik: '50%', bicim: (v) => O.sayi(v) + ' kişi · ' + O.yuzde(Math.round(v / n * 100), 0)
  });
  govde.append(O.el('div', { class: 'kart-alt-cubuk', html: '<span>Açıklaması olan: ' + b(O.sayi(kat.length)) + ' / ' + O.sayi(n) + ' kayıt</span><span>Yüzde paydası: toplam çıkış</span>' }));
}

/* Bölüm × neden (index: ay-matrix — dört ana neden; kalan nedenler ayrı dilimde) */
function bolumNedenKarti(iz, d) {
  const seri = ['İstifa', 'İşveren Feshi', 'Deneme (İşveren)', 'Askerlik'];
  const bols = O.BOLUMLER;
  const veri = seri.map((ned) => bols.map((bl) => d.filter((x) => x.bolum === bl && x.neden === ned).length));
  veri.push(bols.map((bl) => d.filter((x) => x.bolum === bl && seri.indexOf(x.neden) < 0).length));
  const adlar = seri.concat(['Diğer nedenler']);
  const renkler = seri.map(O.nedenRengi).concat([O.RENK.diger]);
  const top = bols.map((bl, i) => veri.reduce((t, r) => t + r[i], 0));
  const g = O.grafikKarti(iz, {
    baslik: 'Bölüm × neden', aciklama: 'Servis · Satış · İdari — her bölümde çıkış nedenleri (kişi)', sinif: 's7', yukseklik: 230,
    lejant: adlar.map((a, i) => ({ ad: a, renk: renkler[i] })),
    etiket: 'Bölüme göre ayrılma nedeni yığılmış çubuk grafiği',
    tablo: () => ({ sutunlar: [{ ad: 'Bölüm' }].concat(adlar.map((a) => ({ ad: a, sag: true })), [{ ad: 'Toplam', sag: true }]), satirlar: bols.map((bl, i) => [bl].concat(veri.map((r) => O.sayi(r[i])), [O.sayi(top[i])])) })
  });
  if (!top.some((v) => v > 0)) { bosGrafik(g, 'Seçili filtrede bölüm verisi yok'); return; }
  grafik(g.canvas, {
    type: 'bar',
    data: { labels: bols, datasets: adlar.map((a, i) => sutun(a, veri[i], renkler[i], {
      maxBarThickness: 30, categoryPercentage: 0.72, barPercentage: 0.9, borderRadius: 0, borderSkipped: false,
      datalabels: i === adlar.length - 1 ? { labels: { ic: icEtiket(20), toplam: toplamEtiket(top, true) } } : icEtiket(20)
    })) },
    options: {
      indexAxis: 'y',
      interaction: { mode: 'index', axis: 'y', intersect: false },
      layout: { padding: { right: 10 } },
      scales: { x: O.eksenY({ stacked: true, grace: '10%' }), y: O.eksenX({ stacked: true, ticks: { font: { size: 12, weight: '600' } } }) },
      plugins: { tooltip: { callbacks: {
        title: (it) => bols[it[0].dataIndex],
        label: (c) => ' ' + c.dataset.label + ': ' + O.sayi(c.parsed.x) + ' kişi',
        footer: (it) => 'Toplam: ' + O.sayi(top[it[0].dataIndex]) + ' kişi'
      } } }
    }
  });
  O.kartNot(g.govde, 'Dört ana neden ayrı dilimde; deneme (işçi), emeklilik, 25. madde ve diğerleri “Diğer nedenler” diliminde toplanır.');
}

/* Departman bazında çıkış (index: ay-dbars — çoktan aza) */
function departmanKarti(iz, d) {
  const say = O.grupSay(d, (x) => x.dept || '—');
  const { govde } = O.kart(iz, { baslik: 'Departman bazında çıkış', aciklama: 'En fazla çıkış yaşanan departmanlar · ' + O.sayi(say.length) + ' departman', sinif: 's5' });
  O.cubukListe(govde, say.map(([k, v]) => ({ ad: k, deger: v })), { kaydir: 300, adGenislik: '46%', renk: O.RENK.cikis, bos: 'Seçili filtrede kayıt yok' });
}

/* Kıdem dağılımı (index: ay-kidem — 6 kova) */
function kidemKarti(iz, d) {
  const bk = O.kidemKovaSayilari(d);
  const n = d.length;
  const g = O.grafikKarti(iz, {
    baslik: 'Kıdem dağılımı', aciklama: 'Ayrılanların şirkette geçirdiği süre · kişi', sinif: 's5', yukseklik: 250,
    etiket: 'Ayrılanların kıdem dağılımı sütun grafiği',
    tablo: () => ({ sutunlar: [{ ad: 'Kıdem' }, { ad: 'Kişi', sag: true }, { ad: 'Pay', sag: true }], satirlar: O.KIDEM_KOVA_ADLARI.map((a, i) => [a, O.sayi(bk[i]), n ? O.yuzde(Math.round(bk[i] / n * 100), 0) : '—']) })
  });
  if (!n) { bosGrafik(g, 'Seçili filtrede kayıt yok'); return; }
  grafik(g.canvas, {
    type: 'bar',
    data: { labels: O.KIDEM_KOVA_ADLARI, datasets: [sutun('Kişi', bk, O.RENK.lac500, { maxBarThickness: 30, datalabels: O.etiket.ust({ secim: 'hepsi' }) })] },
    options: {
      layout: { padding: { top: 6 } },
      scales: { x: O.eksenX({ ticks: { autoSkip: false } }), y: O.eksenY({ grace: '14%' }) },
      plugins: { tooltip: { displayColors: false, callbacks: {
        title: (it) => 'Kıdem ' + O.KIDEM_KOVA_ADLARI[it[0].dataIndex],
        label: (c) => ' ' + O.sayi(c.parsed.y) + ' kişi · ' + O.yuzde(Math.round(c.parsed.y / n * 100), 0)
      } } }
    }
  });
}

/* Seçili filtreye göre kıdem aralığı (index: ayKidemOzet — ay ve yıl) */
function kidemAraligiKarti(iz, d) {
  const z = O.ayrilanKidemOzeti(d);
  const { govde } = O.kart(iz, { baslik: 'Kıdem aralığı', aciklama: 'Seçili filtredeki ayrılanların kıdemi', sinif: 's3' });
  if (!z) { O.bosDurum(govde, { ikon: 'kidem', baslik: 'Seçili filtre için kıdem verisi yok.', kucuk: true }); return; }
  govde.append(O.el('div', { class: 'sonuc-izgara ay-kidem-izgara', 'aria-live': 'polite' },
    O.el('div', { class: 'sonuc vurgu', 'data-kpi': 'ay-kidem-ort', 'data-deger': String(Math.round(z.ortAy)) },
      O.el('small', { text: 'Ort. kıdem' }), O.el('b', { text: O.sayi(z.ortAy) + ' ay' }), O.el('em', { text: '(' + O.sayi(z.ortYil, 1) + ' yıl)' })),
    O.el('div', { class: 'sonuc', 'data-kpi': 'ay-kidem-kisi', 'data-deger': String(z.kisi) }, O.el('small', { text: 'Kişi sayısı' }), O.el('b', { text: O.sayi(z.kisi) })),
    O.el('div', { class: 'sonuc' }, O.el('small', { text: 'Min–maks kıdem' }), O.el('b', { text: O.sayi(z.minAy) + ' – ' + O.sayi(z.maxAy) + ' ay' }))));
  if (z.kisi < d.length) govde.append(O.el('div', { class: 'dipnot', text: '* ' + O.sayi(d.length - z.kisi) + ' kayıtta çalışma süresi boş; aralık hesabına katılmadı.' }));
}

/* En çok çıkış yapılan 5 unvan (index: ay-unvan-top5) */
function unvanKarti(iz, d) {
  const top = O.grupSay(d.filter((x) => x.unvan), 'unvan').slice(0, 5);
  const { govde } = O.kart(iz, { baslik: 'En çok çıkış yapılan 5 unvan', aciklama: 'Unvan bazında ayrılma · kişi', sinif: 's4' });
  O.cubukListe(govde, top.map(([ad, v]) => ({ ad, deger: v })), { adGenislik: '58%', renk: O.RENK.g1, bos: 'Seçili filtrede unvan verisi yok' });
}

/* ==========================================================================
   (4) LİSTE — aranabilir (sayfa filtresi), sıralanabilir, sayfalı tablo + kişi ayrıntısı + Excel
   ========================================================================== */
function nedenRozeti(v) {
  const s = O.el('span', { class: 'neden-rozet' });
  const i = O.el('i');
  i.style.background = O.nedenRengi(v || 'Diğer');
  s.append(i, document.createTextNode(v || '—'));
  return s;
}
const kidemMetni = (sure) => String(sure || '').split('/')[0].trim() || '—';

function listeCiz(kap, B, T, d) {
  O.akisBaslik(kap, { no: '04', baslik: 'Liste', aciklama: 'Ayrılan personel · satıra tıklayınca kişi ayrıntısı açılır' });
  const dugme = O.el('button', { class: 'btn', type: 'button', title: 'Görünen listeyi Excel dosyası olarak indir', html: O.ikon('excel') + '<span>Excel’e aktar</span>' });
  dugme.disabled = !d.length;
  dugme.addEventListener('click', () => excelAktar(T, d));
  const { govde } = O.kart(kap, {
    baslik: 'Çalışan detay listesi',
    aciklama: (yerelAktif() ? 'Sayfa filtresine göre · ' : '') + 'başlığa tıklayarak sıralayın · arama üstteki filtre çubuğundadır',
    sinif: 'kart-liste', sag: dugme
  });
  O.tablo(govde, {
    sutunlar: [
      { k: 'ad', ad: 'Ad Soyad', sinif: 'ad-hucre', bicim: (v) => O.el('button', { class: 'ay-ad', type: 'button', text: v || '—', title: 'Kişi ayrıntısını aç' }) },
      { k: 'dept', ad: 'Departman' },
      { k: 'bolum', ad: 'Bölüm' },
      { k: 'unvan', ad: 'Unvan', bicim: (v) => (v ? O.el('span', { class: 'ay-kirp', title: v, text: v }) : '—') },
      { k: 'tarih', ad: 'Ayrılış', tip: 'tarih' },
      { k: 'neden', ad: 'Neden', bicim: (v) => nedenRozeti(v) },
      { k: 'sure', ad: 'Kıdem', tip: 'sayi', bicim: (v) => kidemMetni(v), siralamaDegeri: (r) => (r.sure ? O.kidemGun(r.sure) : null) },
      { k: 'istenen', ad: 'İstenen', siralamaDegeri: (r) => (O.istenenMi(r) ? 'Evet' : 'Hayır'),
        bicim: (v, r) => (O.istenenMi(r) ? O.el('span', { class: 'cip cip-ey', text: 'Evet' }) : O.el('span', { class: 'soluk', text: 'Hayır' })) },
      { k: 'aciklama', ad: 'Gerçek ayrılma nedeni', hucreSinif: () => 'ay-uzun', bicim: (v) => (v ? O.el('span', { text: v, title: O.gercekKat(v) || '' }) : '—') }
    ],
    satirlar: d,
    sayfaBoyu: 12,
    siraNo: true,
    ara: false,
    altMetin: (n) => O.sayi(n) + ' kayıt' + (yerelAktif() ? ' · sayfa filtresi uygulandı' : '') + (T.fa ? ' · seçili kapsam' : ''),
    bos: { baslik: 'Kayıt bulunamadı', metin: 'Filtreleri değiştirin ya da “Filtreleri temizle” ile sıfırlayın.' },
    satirTikla: (r) => kisiAc(r, B)
  });
}

/* Görünen (filtreli) listeyi .xls olarak indirir — sütunlar Dışa Aktar "İşten Ayrılanlar" raporu + gerçek neden */
function excelAktar(T, d) {
  const satirlar = O.excludeVI(d);
  const y = yerelFiltreMetni();
  const kapsam = [T.fa ? O.filtreMetni(T.filtre) : '', y].filter(Boolean).join(' · ') || 'Tüm kayıtlar';
  const rows = [
    ['İŞTEN AYRILANLAR DETAY RAPORU'],
    ['Toplam: ' + satirlar.length + ' kişi (V.İ. hariç)  ·  Kapsam: ' + kapsam + '  ·  ' + new Date().toLocaleDateString('tr-TR')],
    [],
    ['Ad Soyad', 'Departman', 'Bölüm', 'Unvan', 'Ayrılış Tarihi', 'Neden', 'Çalışma Süresi', 'İstenen mi', 'Gerçek Ayrılma Nedeni', 'Gerçek Neden Kategorisi']
  ];
  satirlar.forEach((a) => rows.push([a.ad, a.dept, a.bolum, a.unvan, a.tarih, a.neden, a.sure || '', O.istenenMi(a) ? 'Evet' : 'Hayır', a.aciklama || '', O.gercekKat(a.aciklama) || '']));
  O.xlsIndir([{ name: 'İşten Ayrılanlar', rows, rowClasses: { 0: 'title', 1: 'subtitle', 3: 'header' }, zebraStart: 4 }], 'IK_Isten_Ayrilanlar_Liste_' + O.bugunDosya() + '.xlsx');
  O.bildirim('İşten ayrılanlar listesi indiriliyor (' + O.sayi(satirlar.length) + ' kayıt).');
}

/* ---------- Kişi ayrıntısı (index.html openProfile içeriği + ayrılışa özgü alanlar) ---------- */
function kisiAc(r, B) {
  kisiKapat(true);
  const D = B.D || {}, ad = r.ad;
  const bul = (dizi) => { const a = dizi || []; for (let i = 0; i < a.length; i++) if (a[i] && a[i].ad === ad) return a[i]; return null; };
  const personel = bul([].concat(D.normal || [], D.stajyer || [], D.gecici || []));
  const isealim = bul(D.isealim), izin = bul(D.izin), mesai = bul(D.mesai_kisi), arb = bul(D.arabuluculuk);
  const ist = O.istenenMi(r);
  const onceki = document.activeElement;
  const harf = String(ad || '').trim().split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join('');
  const kapatX = O.el('button', { class: 'btn btn-hayalet ay-kapat-x', type: 'button', 'aria-label': 'Kapat', html: O.ikon('carpi') });
  const ust = O.el('div', { class: 'modal-ust' },
    O.el('div', { class: 'ay-avatar', 'aria-hidden': 'true', text: O.trBuyuk(harf) || '?' }),
    O.el('div', { class: 'ay-kisi-bas' },
      O.el('h3', { id: 'ayKisiBaslik', text: ad || '—' }),
      O.el('p', { text: [r.unvan, r.dept, r.bolum].filter(Boolean).join(' · ') || '—' }),
      O.el('div', { class: 'ay-cipler' },
        O.el('span', { class: 'cip cip-ht', text: 'İşten ayrıldı' }),
        O.el('span', { class: 'cip ' + (ist ? 'cip-ey' : 'cip-pirinc'), text: ist ? 'İstenen ayrılış' : 'İstenmeyen ayrılış' }))),
    kapatX);
  const govde = O.el('div', { class: 'modal-govde' });
  const bolum = (baslik, satirlar) => {
    const s = O.el('section', { class: 'ay-kisi-bolum' }, O.el('h4', { text: baslik }));
    satirlar.forEach(([et, deger]) => {
      const dd = O.el('b');
      if (deger instanceof Node) dd.append(deger); else dd.textContent = O.bosMu(deger) ? '—' : String(deger);
      s.append(O.el('div', { class: 'ay-kisi-satir' }, O.el('span', { text: et }), dd));
    });
    govde.append(s);
  };
  const info = personel || r;
  bolum('Çalışan bilgileri', [['Departman', info.dept], ['Bölüm', info.bolum], ['Unvan', info.unvan], ['Çalışma şekli', personel ? personel.cs : null]]);
  const gun = r.sure ? O.kidemGun(r.sure) : 0;
  bolum('Ayrılış', [
    ['Ayrılış tarihi', O.tarih(r.tarih)],
    ['Neden', nedenRozeti(r.neden)],
    ['Resmî çıkış metni', r.neden_raw],
    ['Çalışma süresi', r.sure ? kidemMetni(r.sure) + (gun ? ' (' + O.sayi(gun) + ' gün)' : '') : null],
    ['İstenen', ist ? 'Evet' : 'Hayır']
  ]);
  const gs = O.el('section', { class: 'ay-kisi-bolum' }, O.el('h4', { text: 'Gerçek ayrılma nedeni' }));
  gs.append(O.el('p', { class: 'ay-kisi-not', text: r.aciklama || 'Açıklama girilmemiş.' }));
  if (r.aciklama) gs.append(O.el('div', { class: 'ay-kisi-satir' }, O.el('span', { text: 'Kategori' }), O.el('b', { text: O.gercekKat(r.aciklama) })));
  govde.append(gs);
  if (arb) bolum('Arabuluculuk', [['Durum', arb.arabulucu], ['Not', arb.not_], ['İşe giriş', O.tarih(arb.giris)], ['Kıdem aralığı', arb.sure], ['Risk', arb.risk ? O.trBaslik(arb.risk) : null]]);
  if (isealim) bolum('İşe alım', [['Başlama', O.tarih(isealim.tarih)]]);
  if (izin) bolum('İzin', [['Bakiye', O.bosMu(izin.bakiye) ? null : O.sayi(izin.bakiye, 'oto') + ' gün'], ['Kullanılan', O.bosMu(izin.kullanilan) ? null : O.sayi(izin.kullanilan, 'oto') + ' gün']]);
  if (mesai) bolum('Mesai', [['Toplam', O.para(mesai.toplam)], ['Şirket payı', O.yuzde(mesai.pct)]]);
  const kapatBtn = O.el('button', { class: 'btn btn-lacivert', type: 'button', text: 'Kapat' });
  const pen = O.el('div', { class: 'modal ay-kisi', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ayKisiBaslik' }, ust, govde, O.el('div', { class: 'modal-alt' }, kapatBtn));
  const ort = O.el('div', { class: 'modal-ort ay-modal' }, pen);
  const tus = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); kisiKapat(false); return; }
    if (e.key !== 'Tab') return;
    const od = [...pen.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
    if (!od.length) return;
    const ilk = od[0], son = od[od.length - 1];
    if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
    else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
  };
  ort.addEventListener('click', (e) => { if (e.target === ort) kisiKapat(false); });
  kapatX.addEventListener('click', () => kisiKapat(false));
  kapatBtn.addEventListener('click', () => kisiKapat(false));
  document.addEventListener('keydown', tus, true);
  document.body.append(ort);
  document.body.classList.add('ay-modal-acik');
  pencere = { ort, onceki, tus };
  requestAnimationFrame(() => { ort.classList.add('acik'); kapatBtn.focus({ preventScroll: true }); });
}
function kisiKapat(hemen) {
  if (!pencere) return;
  const p = pencere;
  pencere = null;
  document.removeEventListener('keydown', p.tus, true);
  document.body.classList.remove('ay-modal-acik');
  p.ort.classList.remove('acik');
  if (hemen || O.azHareket()) p.ort.remove(); else setTimeout(() => p.ort.remove(), 260);
  if (!hemen && p.onceki && document.contains(p.onceki) && typeof p.onceki.focus === 'function') p.onceki.focus({ preventScroll: true });
}

/* ==========================================================================
   NOTLAR · SAYFA STİLİ
   ========================================================================== */
function notlarCiz(kok, B) {
  const e = B.etiket || {};
  O.notlar(kok, [
    'Kaynak: haftalık İK pano paketi' + (e.label ? ' (' + e.label + ')' : '') + '. V.İ. personeli ve silinecek kayıtlar listede yer almaz.',
    'Sayfa filtreleri (ay, bölüm, neden, unvan, ayrılış türü, arama) göstergeleri, grafikleri, kıdem kutusunu ve listeyi birlikte süzer; kaputtaki özet seçili departman kapsamının tamamını gösterir.',
    'Yüzdeler toplam çıkışa göre hesaplanır ve tam sayıya yuvarlanır. Aylık ortalama = kayıt sayısı / çıkış görülen ay sayısı.',
    'İstenen ayrılış: işveren feshi, deneme süresi (işveren), askerlik, 25. madde, emeklilik ve belirli süreli sözleşme; diğer nedenler istenmeyen sayılır.',
    'Gerçek ayrılma nedeni, açıklama alanındaki anahtar kelimelerle kategorilere ayrılır; açıklaması olmayan kayıtlar dağılımda görünmez ama yüzde paydasına dahildir.',
    'Kıdem, çalışma süresi alanındaki toplam gündür. Süresi boş kayıt kıdem dağılımında 0–2 ay diliminde sayılır, kıdem aralığı hesabına katılmaz (mevcut panoyla aynı kural).'
  ]);
}

const STIL = `
.ay-dinamik { display: contents; }
.ay-filtre .kart-ust { margin-bottom: 12px; }
.ay-filtre .kart-govde { gap: 14px; }
.ay-filtre-sag { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ay-sayac { font-size: 12px; color: var(--metin-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.ay-filtre-sag .btn { height: 32px; padding: 0 10px; font-size: 12.5px; }
.ay-filtre-sag .btn[disabled] { opacity: .45; cursor: default; box-shadow: none; }
.ay-alan { min-width: 0; }
.ay-haplar { max-width: 100%; overflow-x: auto; scrollbar-width: thin; padding-bottom: 2px; }
.ay-haplar .bolumlu { white-space: nowrap; }
.ay-filtre-satir { display: flex; flex-wrap: wrap; gap: 12px 14px; align-items: flex-end; }
.ay-filtre-satir > .alan { flex: 1 1 150px; min-width: 0; }
.ay-filtre-satir > .alan.ay-unvan { flex: 1.4 1 200px; }
.ay-filtre-satir > .alan.ay-ara { flex: 2 1 230px; }
.ay-filtre-satir > .alan.ay-tur { flex: 0 0 auto; }
.ay-filtre-satir .ara-kutu { max-width: none; flex: 0 0 auto; }
.ay-filtre-satir .secim { width: 100%; }
.ay-kidem-izgara { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.ay-kidem-izgara .sonuc.vurgu { grid-column: auto; }
.ay-kidem-izgara .sonuc.vurgu b { font-size: 26px; }
.neden-rozet { display: inline-flex; align-items: center; gap: 7px; }
.neden-rozet i { width: 8px; height: 8px; border-radius: 2px; flex: none; }
.ay-kirp { display: inline-block; max-width: 170px; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; }
.tablo td.ay-uzun { white-space: normal; min-width: 200px; max-width: 300px; color: var(--metin-2); font-size: 12.5px; line-height: 1.4; }
.ay-ad { border: 0; background: none; padding: 0; font: inherit; font-weight: 600; color: var(--metin-marka); cursor: pointer; text-align: left; }
.ay-ad:hover { text-decoration: underline; text-underline-offset: 3px; }
.ay-ad:focus-visible { outline: 2px solid var(--pir-500); outline-offset: 2px; border-radius: 3px; }
body.ay-modal-acik { overflow: hidden; }
.ay-modal .modal { width: min(620px, 100%); }
.ay-modal .modal-ust { align-items: center; }
.ay-avatar { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--lac-800); color: #fff; font-weight: 600; font-size: 16px; letter-spacing: .02em; box-shadow: inset 0 0 0 2px var(--pir-400); }
.ay-kisi-bas { flex: 1; min-width: 0; }
.ay-kisi-bas h3 { overflow-wrap: anywhere; }
.ay-cipler { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ay-kapat-x { width: 34px; height: 34px; padding: 0; justify-content: center; flex: none; align-self: flex-start; }
.ay-kisi-bolum h4 { font-size: var(--fs-2xs); font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--pir-700); margin-bottom: 4px; }
.ay-kisi-satir { display: grid; grid-template-columns: minmax(0, 42%) minmax(0, 1fr); gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--cizgi-1); font-size: 13px; }
.ay-kisi-satir > span { color: var(--metin-3); }
.ay-kisi-satir > b { font-weight: 600; color: var(--metin-1); text-align: right; overflow-wrap: anywhere; display: flex; justify-content: flex-end; }
.ay-kisi-not { margin: 4px 0 2px; padding: 10px 12px; border-radius: 10px; background: var(--n-50); box-shadow: inset 0 0 0 1px var(--cizgi-1); font-size: 13px; line-height: 1.5; color: var(--metin-1); }
@media (max-width: 760px) {
  .ay-filtre-sag { width: 100%; justify-content: space-between; }
  .ay-filtre-satir > .alan, .ay-filtre-satir > .alan.ay-unvan, .ay-filtre-satir > .alan.ay-ara, .ay-filtre-satir > .alan.ay-tur { flex: 1 1 100%; }
  .ay-kisi-satir { grid-template-columns: minmax(0, 1fr); gap: 2px; }
  .ay-kisi-satir > b { text-align: left; justify-content: flex-start; }
}
`;
function stilEkle(kok) { kok.append(O.el('style', { 'data-sayfa-stil': 'ay', text: STIL })); }
