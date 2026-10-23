/* ==========================================================================
   İK DASHBOARD 2.0 · İZİN & ÇALIŞANLAR  (pano/sayfa-izin.js)
   --------------------------------------------------------------------------
   Akış (BRIEF): (1) Özet — kaput + gösterge panosu (2) Trend — aktif kadronun aylara göre seyri
   (izin verisi tek tarih itibarıyladır) (3) Kırılım — departman bakiyesi, bölüm, bakiye durumu, kıdem
   (4) Liste — izin detay listesi + çalışan listesi (aktif / stajyer / analist öğrenci / V.İ.).
   Firebase import ETMEZ. Sözleşme: pano/KABUK.md
   Değerler index.html renderIZ ile AYNI kuralla hesaplanır:
     Aktif personel = ozet.personel_mevcudu || liste (filtre seçiliyken filtreli liste)
     Ort. bakiye    = Σ geçerli bakiye / aktif personel liste uzunluğu (1 hane)
     Negatif        = bakiye < 0 · 30+ gün = bakiye ≥ 30 · departman bakiyesi = pozitif bakiyelerin toplamı (ilk 10)
     Durum etiketi  = O.izinDurumu (Borçta < 0 · Az bakiye < 5 · Risk ≥ 30 · Normal)
   index.html'den bilinçli fark (B14): filtre seçiliyken Ort. bakiye paydası ve kadro bölüm dağılımı seçili kapsama göredir.
   ========================================================================== */
import * as O from './ortak.js';

export const meta = { id: 'iz', baslik: 'İzin & Çalışanlar', ikon: O.ikon('izin') };

/* Yeniden çizimler arasında korunan sayfa içi seçimler */
const durum = { izinBolum: '', izinDurum: '', kategori: 'normal' };

const KATEGORILER = [
  { k: 'normal', ad: 'Aktif personel', kisa: 'Aktif' },
  { k: 'stajyer', ad: 'Stajyer', kisa: 'Stajyer' },
  { k: 'gecici', ad: 'Analist öğrenci', kisa: 'Analist öğrenci' },
  { k: 'vi', ad: 'V.İ. personeli', kisa: 'V.İ.' }
];
/* O.izinDurumu sınıfı → görünüm (kural mevcut panodaki izTbl ile aynı; renk tek başına anlam taşımaz) */
const DURUMLAR = [
  { k: 'borc', ad: 'Borçta', kural: '0 günün altında', renk: O.RENK.g3, koyu: O.RENK.gk3, cip: 'cip-ht' },
  { k: 'az', ad: 'Az bakiye', kural: '0–5 gün (5 hariç)', renk: O.RENK.g2, koyu: O.RENK.gk2, cip: 'cip-uy' },
  { k: 'normal', ad: 'Normal', kural: '5–30 gün (30 hariç)', renk: O.RENK.g1, koyu: O.RENK.gk1, cip: 'cip-ok' },
  { k: 'risk', ad: 'Risk', kural: '30 gün ve üzeri birikmiş', renk: O.RENK.g6, koyu: O.RENK.gk6, cip: 'cip-uy' },
  { k: 'yok', ad: 'Bakiye yok', kural: 'kayıtta bakiye bulunmuyor', renk: O.RENK.diger, koyu: O.RENK.n400, cip: '' }
];
const durumBul = (k) => DURUMLAR.find((d) => d.k === k) || DURUMLAR[4];
const gecerliBakiye = (v) => v !== null && v !== undefined && v !== '' && !isNaN(+v);
const durumAnahtari = (r) => (gecerliBakiye(r.bakiye) ? (O.izinDurumu(+r.bakiye).sinif || 'yok') : 'yok');

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

function stilEkle(kok) {
  kok.append(O.el('style', { text:
    '.iz-arac{display:flex;gap:8px;flex-wrap:wrap;align-items:center}'
    + '.iz-tek-kolon{grid-template-columns:minmax(0,1fr)}'
    + '.iz-kural{color:var(--metin-3);font-weight:400;font-size:11.5px}'
    + '.iz-durum-cip{white-space:nowrap}'
    + '@media (max-width:760px){.iz-arac .alan{width:calc(50% - 4px)!important}.iz-kat .bolumlu{flex-wrap:wrap}}' }));
}

/* ==========================================================================
   HESAP
   ========================================================================== */
function hesapla(B) {
  const D = B.D, oz = D.ozet || {}, F = B.filtreli, fa = B.filtreAktif;
  const cl = F.normal || [], st = F.stajyer || [], gc = F.gecici || [], vi = F.vi || [], iz = F.izin || [];
  const pw = !fa && oz.prev_week ? oz.prev_week : null;
  const aktif = fa ? cl.length : (oz.personel_mevcudu || cl.length);
  const stajyer = fa ? st.length : (oz.stajyer_sayisi || st.length);
  const analist = fa ? gc.length : (oz.analist_sayisi || gc.length);
  const viSayi = fa ? vi.length : (oz.vi_sayisi || vi.length);   /* filtrede V.İ. kapsam dışı */
  const gecerli = iz.filter((x) => gecerliBakiye(x.bakiye));
  const topBak = gecerli.reduce((s, x) => s + +x.bakiye, 0);
  const durumSay = { borc: 0, az: 0, normal: 0, risk: 0, yok: 0 };
  iz.forEach((x) => { durumSay[durumAnahtari(x)]++; });
  /* Departman bakiyesi (index iz-dept): pozitif bakiyelerin toplamı, en yüksek 10 */
  const di = {};
  iz.forEach((x) => { if (gecerliBakiye(x.bakiye) && +x.bakiye > 0) di[x.dept] = (di[x.dept] || 0) + +x.bakiye; });
  const deptBakiye = Object.entries(di).sort((p, q) => q[1] - p[1]);
  const kidem = O.kidemAraci(cl, '', '');
  const kovalar = [0, 0, 0, 0, 0, 0];
  cl.forEach((p) => { if (p.kidem_gun != null && !isNaN(+p.kidem_gun)) kovalar[O.kidemKovasi(+p.kidem_gun)]++; });
  return {
    D, oz, fa, cl, iz,
    aktif, stajyer, analist, vi: viSayi, toplam: aktif + stajyer + analist + viSayi,
    listeler: { normal: cl, stajyer: st, gecici: gc, vi },
    ortBakiye: cl.length ? topBak / cl.length : null,
    neg: gecerli.filter((x) => +x.bakiye < 0).length,
    yuksek: gecerli.filter((x) => +x.bakiye >= 30).length,
    gecerliSayi: gecerli.length,
    durumSay,
    birikmis: deptBakiye.reduce((s, x) => s + x[1], 0),
    kullanilan: iz.reduce((s, x) => s + (gecerliBakiye(x.kullanilan) ? +x.kullanilan : 0), 0),
    deptBakiye,
    kadroBolum: O.grupSay(cl, (x) => x.bolum || '—'),
    kidem, kovalar,
    dAktif: pw ? O.haftalikFark(aktif, pw.personel_mevcudu) : null
  };
}

/* ==========================================================================
   (1) ÖZET
   ========================================================================== */
function ozetCumlesi(B, M) {
  const e = B.etiket || {};
  let s = M.fa ? 'Seçili kapsamda (' + O.esc(O.filtreMetni(B.filtre)) + ') ' : (e.hafta ? O.esc(e.hafta) + ' itibarıyla ' : '');
  s += b(O.sayi(M.aktif)) + ' aktif personel';
  if (M.ortBakiye != null) s += '; kişi başı ortalama izin bakiyesi ' + b(O.sayi(M.ortBakiye, 1) + ' gün');
  s += '. ' + b(O.sayi(M.neg)) + ' kişi borçta, ' + b(O.sayi(M.yuksek)) + ' kişide 30 gün ve üzeri birikmiş izin var';
  if (M.kidem.kisi) s += '; aktif personelin ortalama kıdemi ' + b(O.sayi(M.kidem.ort, 1) + ' yıl');
  return s + '.';
}

function ozetCiz(kok, B, M) {
  const e = B.etiket || {};
  const meta = [];
  if (e.short || e.label) meta.push({ ikon: 'takvim', html: 'Veri dönemi: ' + b(O.esc(e.short || e.label)) });
  meta.push({ ikon: 'izin', html: 'Birikmiş izin ' + b(O.sayi(Math.round(M.birikmis)) + ' gün') + ' · kullanılan ' + b(O.sayi(M.kullanilan, 'oto') + ' gün') });
  meta.push({ ikon: 'kisiler', html: b(O.sayi(M.toplam)) + ' toplam kayıt' + (M.fa ? ' · seçili kapsam' : '') });

  const kadro = [
    { ad: 'Aktif', deger: M.aktif, renk: O.RENK.gk1 },
    { ad: 'Stajyer', deger: M.stajyer, renk: O.RENK.gk2 },
    { ad: 'Analist', deger: M.analist, renk: O.RENK.gk7 },
    { ad: 'V.İ.', deger: M.vi, renk: O.RENK.gk6 }
  ].map((p) => Object.assign(p, { metin: O.sayi(p.deger) + ' kişi' }));
  const bakiye = DURUMLAR.slice(0, 4).map((d) => ({ ad: d.ad, deger: M.durumSay[d.k], renk: d.koyu, metin: O.sayi(M.durumSay[d.k]) + ' kişi' }));
  const kidemParca = O.KIDEM_KOVA_ADLARI.map((ad, i) => ({ ad, deger: M.kovalar[i], renk: [O.RENK.gk1, O.RENK.gk4, O.RENK.gk7, O.RENK.gk5, O.RENK.gk2, O.RENK.gk6][i], metin: O.sayi(M.kovalar[i]) + ' kişi' }));
  O.kaput(kok, {
    B, bindirme: true,
    ustEtiket: 'İnsan Kaynakları · ' + (e.hafta || '2026'),
    baslik: 'İzin & Çalışanlar',
    ozetHtml: ozetCumlesi(B, M),
    meta,
    kadranlar: [
      { etiket: 'Toplam kayıt', merkez: M.toplam, parcalar: kadro,
        alt: anahtar(O.RENK.gk1) + 'Aktif ' + b(O.sayi(M.aktif)) + ' · ' + anahtar(O.RENK.gk2) + 'Stajyer ' + b(O.sayi(M.stajyer)) + '<br>'
          + anahtar(O.RENK.gk7) + 'Analist ' + b(O.sayi(M.analist)) + ' · ' + anahtar(O.RENK.gk6) + 'V.İ. ' + b(O.sayi(M.vi)) },
      { etiket: 'Ort. izin bakiyesi', merkez: M.ortBakiye, ondalik: 1, sonek: ' gün', parcalar: bakiye,
        alt: anahtar(O.RENK.gk3) + 'Borçta ' + b(O.sayi(M.neg)) + ' · ' + anahtar(O.RENK.gk6) + '30+ gün ' + b(O.sayi(M.yuksek)) },
      { etiket: 'Ort. kıdem', merkez: M.kidem.ort, ondalik: 1, sonek: ' yıl', parcalar: kidemParca,
        alt: M.kidem.kisi ? b(O.sayi(M.kidem.kisi)) + ' kişi · en uzun ' + b(O.sayi(M.kidem.max, 1)) + ' yıl' : 'kıdem verisi yok' }
    ]
  });

  O.kpiPanel(kok, [
    { grup: { baslik: 'İzin bakiyesi', alt: M.fa ? 'seçili kapsam' : (e.hafta ? e.hafta + ' itibarıyla' : 'güncel'), ikon: 'izin' }, ogeler: [
      { anahtar: 'ort-bakiye', etiket: 'Ort. bakiye', deger: M.ortBakiye, ondalik: 1, birim: 'gün', alt: 'gün / kişi · aktif personel başına' },
      { anahtar: 'negatif', etiket: 'Negatif bakiye', deger: M.neg, ton: M.neg > 0 ? 'kotu' : null, alt: 'kişi borçta' },
      { anahtar: 'yuksek', etiket: '30+ gün birikmiş', deger: M.yuksek, alt: 'yüksek bakiye' },
      { anahtar: 'birikmis', etiket: 'Toplam birikmiş', deger: Math.round(M.birikmis), birim: 'gün', alt: 'pozitif bakiyelerin toplamı' },
      { anahtar: 'kullanilan', etiket: 'Toplam kullanılan', deger: M.kullanilan, ondalik: 'oto', birim: 'gün', alt: 'kayıtlı kullanılan izin' }
    ] },
    { grup: { baslik: 'Kadro', alt: M.fa ? 'seçili kapsam' : 'çalışan listeleri', ikon: 'kisiler' }, ogeler: [
      { anahtar: 'aktif', etiket: 'Aktif personel', deger: M.aktif, alt: 'tam zamanlı normal', delta: M.dAktif ? Object.assign({ iyiYon: null, metin: 'geçen haftaya göre' }, M.dAktif) : null },
      { anahtar: 'stajyer', etiket: 'Stajyer', deger: M.stajyer, alt: 'aktif stajyer' },
      { anahtar: 'analist', etiket: 'Analist öğrenci', deger: M.analist, alt: 'geçici çalışan' },
      { anahtar: 'vi', etiket: 'V.İ. personeli', deger: M.vi, alt: M.fa ? 'filtre kapsamı dışında' : 'yat, bahçe, engelli' },
      { anahtar: 'kidem', etiket: 'Ort. kıdem', deger: M.kidem.ort, ondalik: 1, birim: 'yıl', alt: M.kidem.kisi ? 'aktif personel · ' + O.sayi(M.kidem.kisi) + ' kişi' : 'kıdem verisi yok' }
    ] }
  ], { sinif: 'bindir' });
}

/* ==========================================================================
   (2) TREND — aktif kadro, aylara göre (MONTHLY_HC; izin verisi tek tarih itibarıyladır)
   ========================================================================== */
function trendCiz(kok, B, M) {
  O.akisBaslik(kok, { no: '02', baslik: 'Trend', aciklama: 'Aktif kadronun aylara göre seyri · izin bakiyeleri tek bir tarih itibarıyladır' });
  const iz = O.izgara(kok);
  const hc = B.MONTHLY_HC;
  const y25 = hc ? hc.y2025 || [] : [], y26 = hc ? hc.y2026 || [] : [];
  const g = O.grafikKarti(iz, {
    baslik: 'Aktif kadro · aylara göre', aciklama: 'Ay sonu personel sayısı · V.İ. hariç · 2025 ile karşılaştırma' + (M.fa ? ' · şirket geneli (filtre uygulanmaz)' : ''), sinif: 's12', yukseklik: 290,
    lejant: [{ ad: '2025', renk: O.RENK.y2025, tip: 'cizgi' }, { ad: '2026', renk: O.RENK.y2026, tip: 'cizgi' }],
    etiket: '2025 ve 2026 ay sonu personel sayısı çizgi grafiği',
    tablo: hc ? () => ({
      sutunlar: [{ ad: 'Ay' }, { ad: '2025', sag: true }, { ad: '2026', sag: true }, { ad: 'Fark', sag: true }],
      satirlar: (hc.labels || []).map((l, i) => [O.trBaslik(l), O.sayi(y25[i]), O.sayi(y26[i]), y25[i] == null || y26[i] == null ? '—' : O.isaretli(y26[i] - y25[i])])
    }) : null
  });
  if (!hc || !(hc.labels || []).length) {
    g.kap.textContent = '';
    O.bosDurum(g.kap, { ikon: 'takvim', baslik: 'Aylık personel verisi yok', metin: 'Bu haftanın paketinde aylık personel sayıları bulunmuyor.', kucuk: true });
    return;
  }
  const hiza = (diger) => (ctx) => { const v = ctx.dataset.data[ctx.dataIndex], o = diger[ctx.dataIndex]; return o == null || v >= o ? 'top' : 'bottom'; };
  O.grafik(g.canvas, {
    type: 'line',
    data: { labels: hc.labels.map((l) => O.trBaslik(l).substring(0, 3)), datasets: [
      { label: '2025', data: y25, borderColor: O.RENK.y2025, backgroundColor: O.RENK.y2025, pointBackgroundColor: O.RENK.y2025, pointRadius: 3.5,
        datalabels: O.etiket.nokta({ align: hiza(y26), renk: O.RENK.n500, minPx: 56 }) },
      { label: '2026', data: y26, borderColor: O.RENK.y2026, backgroundColor: O.RENK.y2026, pointBackgroundColor: O.RENK.y2026, pointRadius: 4.5,
        datalabels: O.etiket.nokta({ align: hiza(y25), minPx: 40 }) }
    ] },
    options: {
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 16, right: 12, left: 4, bottom: 4 } },
      scales: { x: O.eksenX(), y: O.eksenY({ beginAtZero: false, grace: '14%' }) },
      plugins: { tooltip: { callbacks: {
        title: (it) => (it.length ? O.trBaslik(hc.labels[it[0].dataIndex]) : ''),
        label: (c) => ' ' + c.dataset.label + ': ' + O.sayi(c.parsed.y) + ' kişi',
        footer: (it) => { if (!it.length) return ''; const i = it[0].dataIndex; return y25[i] != null && y26[i] != null ? '2025’e göre: ' + O.isaretli(y26[i] - y25[i]) : ''; }
      } } }
    }
  });
  let son = -1;
  y26.forEach((v, i) => { if (v != null) son = i; });
  if (son >= 0) {
    O.kartNot(g.govde, 'Son veri: ' + O.trBaslik(hc.labels[son]) + ' 2026 · ' + O.sayi(y26[son]) + ' kişi'
      + (y25[son] != null ? ' (2025’in aynı ayına göre ' + O.isaretli(y26[son] - y25[son]) + ')' : '') + '. Çizgi grafikte eksen sıfırdan başlamaz.');
  }
}

/* ==========================================================================
   (3) KIRILIM — departman bakiyesi · kadro bölümü · bakiye durumu · kıdem
   ========================================================================== */
function kirilimCiz(kok, B, M) {
  O.akisBaslik(kok, { no: '03', baslik: 'Kırılım', aciklama: 'Departman bakiyesi, kadro bölümü, bakiye durumu ve kıdem' + (M.fa ? ' · seçili kapsam' : '') });
  const iz1 = O.izgara(kok);
  departmanKarti(iz1, M);
  kadroKarti(iz1, M);
  const iz2 = O.izgara(kok);
  durumKarti(iz2, M);
  kidemKarti(iz2, M);
}

/* Departman bazında izin bakiyesi (index iz-dept: pozitif bakiye toplamı, ilk 10, "N gün") */
function departmanKarti(iz, M) {
  const ilk10 = M.deptBakiye.slice(0, 10);
  const { govde } = O.kart(iz, { baslik: 'Departman bazında izin bakiyesi', aciklama: 'Toplam birikmiş izin günleri · en yüksek 10 departman', sinif: 's7' });
  O.cubukListe(govde, ilk10.map(([ad, v]) => ({ ad: ad || '—', deger: Math.round(v) })), { bicim: (v) => O.sayi(v) + ' gün', adGenislik: '38%', bos: 'Pozitif bakiye kaydı yok' });
  if (ilk10.length) {
    const top10 = ilk10.reduce((s, x) => s + x[1], 0);
    govde.append(O.el('div', { class: 'kart-alt-cubuk', html: '<span>İlk ' + ilk10.length + ' departmanın birikmiş izindeki payı: ' + b(O.yuzde(M.birikmis ? Math.round(top10 / M.birikmis * 100) : null, 0)) + '</span><span>' + b(O.sayi(M.deptBakiye.length)) + ' departmanda birikmiş izin var</span>' }));
  }
}

/* Kadro bölüm dağılımı (index iz-kad donut) */
function kadroKarti(iz, M) {
  const n = M.cl.length;
  const { govde } = O.kart(iz, { baslik: 'Kadro bölüm dağılımı', aciklama: 'Aktif tam zamanlı çalışan dağılımı', sinif: 's5' });
  if (!n) { O.bosDurum(govde, { ikon: 'kisiler', baslik: 'Aktif personel kaydı yok', kucuk: true }); return; }
  const parcalar = M.kadroBolum.map(([ad, v]) => ({ ad, deger: v, renk: O.bolumRengi(ad) }));
  O.dagilimSeridi(govde, parcalar, { bicim: (v) => O.sayi(v) + ' kişi' });
  const liste = O.el('div', { class: 'dagilim-liste iz-tek-kolon', role: 'list' });
  parcalar.forEach((p) => {
    const isaret = O.el('i', { class: 'anahtar' });
    isaret.style.background = p.renk;
    liste.append(O.el('div', { class: 'dagilim-satir', role: 'listitem', 'data-bolum': p.ad, 'data-adet': String(p.deger) }, isaret,
      O.el('span', { class: 'ad' }, O.el('span', { text: p.ad })),
      O.el('span', { class: 'adet', text: O.sayi(p.deger) + ' kişi' }),
      O.el('span', { class: 'pay', text: O.yuzde(Math.round(p.deger / n * 100), 0) })));
  });
  govde.append(liste);
  govde.append(O.el('div', { class: 'kart-alt-cubuk', html: '<span>Toplam ' + b(O.sayi(n)) + ' aktif personel (liste)</span><span>Yüzdeler tam sayıya yuvarlanır</span>' }));
}

/* Bakiye durumu — izin kayıtlarının durum etiketine göre dağılımı (mevcut kural) */
function durumKarti(iz, M) {
  const n = M.iz.length;
  const { govde } = O.kart(iz, { baslik: 'Bakiye durumu', aciklama: O.sayi(n) + ' izin kaydının durum etiketine göre dağılımı', sinif: 's5' });
  if (!n) { O.bosDurum(govde, { ikon: 'izin', baslik: 'İzin kaydı yok', kucuk: true }); return; }
  const parcalar = DURUMLAR.map((d) => ({ ad: d.ad, deger: M.durumSay[d.k], renk: d.renk, d }));
  O.dagilimSeridi(govde, parcalar, { bicim: (v) => O.sayi(v) + ' kişi' });
  const liste = O.el('div', { class: 'dagilim-liste iz-tek-kolon', role: 'list' });
  parcalar.forEach((p) => {
    const isaret = O.el('i', { class: 'anahtar' });
    isaret.style.background = p.renk;
    liste.append(O.el('div', { class: 'dagilim-satir', role: 'listitem', 'data-durum': p.d.k, 'data-adet': String(p.deger) }, isaret,
      O.el('span', { class: 'ad' }, O.el('span', { text: p.ad }), O.el('span', { class: 'iz-kural', text: p.d.kural })),
      O.el('span', { class: 'adet', text: O.sayi(p.deger) + ' kişi' }),
      O.el('span', { class: 'pay', text: O.yuzde(Math.round(p.deger / n * 100), 0) })));
  });
  govde.append(liste);
}

/* Kıdem dağılımı — aktif personel, mevcut kıdem kovaları (O.KIDEM_KOVA_ADLARI) */
function kidemKarti(iz, M) {
  const top = M.kovalar.reduce((s, v) => s + v, 0);
  const g = O.grafikKarti(iz, {
    baslik: 'Kıdem dağılımı', aciklama: 'Aktif personel · gerçek işe giriş tarihine göre · ' + O.sayi(top) + ' kişi', sinif: 's7', yukseklik: 250,
    etiket: 'Aktif personelin kıdem kovalarına göre dağılımı sütun grafiği',
    tablo: () => ({ sutunlar: [{ ad: 'Kıdem' }, { ad: 'Kişi', sag: true }, { ad: 'Pay', sag: true }],
      satirlar: O.KIDEM_KOVA_ADLARI.map((ad, i) => [ad, O.sayi(M.kovalar[i]), top ? O.yuzde(Math.round(M.kovalar[i] / top * 100), 0) : '—']) })
  });
  if (!top) { g.kap.textContent = ''; O.bosDurum(g.kap, { ikon: 'kidem', baslik: 'Kıdem verisi yok', metin: 'Aktif personel kayıtlarında kıdem (çalışma süresi) bilgisi bulunmuyor.', kucuk: true }); return; }
  O.grafik(g.canvas, {
    type: 'bar',
    data: { labels: O.KIDEM_KOVA_ADLARI, datasets: [{ label: 'Kişi', data: M.kovalar, backgroundColor: O.RENK.g4, hoverBackgroundColor: O.RENK.g4, borderRadius: 4, borderSkipped: 'start',
      maxBarThickness: 40, categoryPercentage: 0.7, barPercentage: 0.9, datalabels: O.etiket.ust({ secim: 'hepsi' }) }] },
    options: {
      layout: { padding: { top: 6 } },
      scales: { x: O.eksenX(), y: O.eksenY({ grace: '14%' }) },
      plugins: { tooltip: { callbacks: {
        title: (it) => (it.length ? 'Kıdem: ' + O.KIDEM_KOVA_ADLARI[it[0].dataIndex] : ''),
        label: (c) => ' ' + O.sayi(c.parsed.y) + ' kişi · ' + O.yuzde(Math.round(c.parsed.y / top * 100), 0)
      } } }
    }
  });
  if (M.kidem.kisi) O.kartNot(g.govde, 'Ortalama ' + O.sayi(M.kidem.ort, 1) + ' yıl · en kısa ' + O.sayi(M.kidem.min, 1) + ', en uzun ' + O.sayi(M.kidem.max, 1) + ' yıl' + (M.kidem.eksik ? ' · ' + O.sayi(M.kidem.eksik) + ' kişide kıdem verisi yok' : '') + '.');
}

/* ==========================================================================
   (4) LİSTE — izin detay listesi (index iz-tb) + çalışan listesi (normal / stajyer / geçici / V.İ.)
   ========================================================================== */
function listeCiz(kok, B, M) {
  O.akisBaslik(kok, { no: '04', baslik: 'Liste', aciklama: 'İzin bakiyeleri ve çalışan listeleri · aranabilir, sıralanabilir' });
  izinListesi(kok, M);
  calisanListesi(kok, B, M);
}

function durumCipi(r) {
  const k = durumAnahtari(r);
  if (k === 'yok') return O.el('span', { class: 'soluk', text: '—' });
  const d = durumBul(k);
  return O.el('span', { class: 'cip iz-durum-cip ' + d.cip, title: d.kural, text: d.ad });
}

function izinListesi(kok, M) {
  if (durum.izinBolum && O.BOLUMLER.indexOf(durum.izinBolum) < 0) durum.izinBolum = '';
  const suz = () => M.iz.filter((r) => (!durum.izinBolum || r.bolum === durum.izinBolum) && (!durum.izinDurum || durumAnahtari(r) === durum.izinDurum));
  const arac = O.el('div', { class: 'iz-arac' });
  const s1 = O.secim(arac, { secenekler: [{ v: '', ad: 'Tüm bölümler' }].concat(O.BOLUMLER.map((x) => ({ v: x, ad: x }))), deger: durum.izinBolum, genislik: '150px',
    degisince: (v) => { durum.izinBolum = v; t.guncelle(suz()); } });
  const s2 = O.secim(arac, { secenekler: [{ v: '', ad: 'Tüm durumlar' }].concat(DURUMLAR.map((d) => ({ v: d.k, ad: d.ad }))), deger: durum.izinDurum, genislik: '150px',
    degisince: (v) => { durum.izinDurum = v; t.guncelle(suz()); } });
  s1.setAttribute('aria-label', 'Bölüm süzgeci');
  s2.setAttribute('aria-label', 'Durum süzgeci');
  const gun = (v) => (gecerliBakiye(v) ? O.sayi(+v, 'oto') + ' gün' : '—');
  const { govde } = O.kart(kok, { baslik: 'İzin detay listesi', aciklama: O.sayi(M.iz.length) + ' kayıt' + (M.fa ? ' · seçili kapsam' : '') + ' · Güncel bakiye: ilk tık artan, ikinci azalan, üçüncü özgün sıra', sinif: 'kart-liste' });
  const t = O.tablo(govde, {
    sutunlar: [
      { k: 'ad', ad: 'Ad Soyad', sinif: 'ad-hucre' },
      { k: 'dept', ad: 'Departman' },
      { k: 'bolum', ad: 'Bölüm' },
      { k: 'bakiye', ad: 'Güncel bakiye', tip: 'sayi', sag: true, ilkYon: 'artan', bicim: gun, hucreSinif: (v) => (gecerliBakiye(v) && +v < 0 ? 'negatif' : '') },
      { k: 'kullanilan', ad: 'Toplam kullanılan', tip: 'sayi', sag: true, bicim: gun, hucreSinif: () => 'soluk' },
      { k: 'durum', ad: 'Durum', tip: 'sayi', siralamaDegeri: (r) => DURUMLAR.findIndex((d) => d.k === durumAnahtari(r)), ilkYon: 'artan', bicim: (v, r) => durumCipi(r) }
    ],
    satirlar: suz(),
    sayfaBoyu: 12,
    siraNo: true,
    araYer: 'Ad, departman ara…',
    araAlanlari: ['ad', 'dept', 'bolum'],
    aracEk: arac,
    altMetin: (n, top) => (n === top ? O.sayi(n) : O.sayi(n) + ' / ' + O.sayi(top)) + ' kayıt' + (durum.izinBolum || durum.izinDurum ? ' · liste süzgeci açık' : ''),
    bos: { baslik: 'Kayıt bulunamadı', metin: 'Bölüm, durum ya da arama seçimini değiştirin.' }
  });
}

function calisanListesi(kok, B, M) {
  if (!KATEGORILER.some((k) => k.k === durum.kategori)) durum.kategori = 'normal';
  const sag = O.el('div', { class: 'iz-kat' });
  const { govde, ust } = O.kart(kok, { baslik: 'Çalışan listesi', aciklama: 'Aktif personel, stajyer, analist öğrenci ve V.İ. personeli · kıdem aktif personelde gerçek işe giriş tarihine göredir', sag, sinif: 'kart-liste' });
  ust.style.flexWrap = 'wrap';
  ust.style.gap = '12px';
  O.bolumlu(sag, {
    etiket: 'Çalışan kategorisi', kucuk: true, deger: durum.kategori,
    secenekler: KATEGORILER.map((k) => ({ v: k.k, ad: k.kisa + ' (' + O.sayi(M.listeler[k.k].length) + ')' })),
    degisince: (v) => { durum.kategori = v; listeyiCiz(); }
  });
  const yer = O.el('div');
  govde.append(yer);
  function listeyiCiz() {
    yer.textContent = '';
    const kat = KATEGORILER.find((k) => k.k === durum.kategori);
    const satirlar = M.listeler[kat.k] || [];
    const kidemVar = satirlar.some((r) => r.kidem_gun != null && !isNaN(+r.kidem_gun));
    const sutunlar = [
      { k: 'ad', ad: 'Ad Soyad', sinif: 'ad-hucre' },
      { k: 'dept', ad: 'Departman' },
      { k: 'bolum', ad: 'Bölüm' },
      { k: 'unvan', ad: 'Unvan', hucreSinif: () => 'soluk' },
      { k: 'cs', ad: 'Çalışma şekli' }
    ];
    if (kidemVar) sutunlar.push({ k: 'kidem_gun', ad: 'Kıdem', tip: 'sayi', sag: true, bicim: (v) => (v == null || isNaN(+v) ? '—' : O.sayi(+v / 365, 1) + ' yıl') });
    O.tablo(yer, {
      sutunlar, satirlar, sayfaBoyu: 12, siraNo: true,
      araYer: kat.ad + ' içinde ara…',
      araAlanlari: ['ad', 'dept', 'bolum', 'unvan'],
      altMetin: (n, top) => (n === top ? O.sayi(n) : O.sayi(n) + ' / ' + O.sayi(top)) + ' kişi · ' + kat.ad,
      bos: (M.fa && kat.k === 'vi')
        ? { baslik: 'V.İ. personeli kapsam dışında', metin: 'Departman filtresi seçiliyken V.İ. personeli listelenmez. Filtreyi kaldırarak görebilirsiniz.' }
        : { baslik: 'Kayıt bulunamadı', metin: 'Bu kategoride ya da aramada kayıt yok.' }
    });
  }
  listeyiCiz();
}

function notlarCiz(kok, B) {
  const e = B.etiket || {};
  O.notlar(kok, [
    'Kaynak: haftalık İK pano paketi' + (e.label ? ' (' + e.label + ')' : '') + '. İzin bakiyeleri paketin hazırlandığı tarih itibarıyladır; pakette aylık izin hareketi bulunmaz.',
    'Ort. bakiye = geçerli bakiyelerin toplamı / aktif personel sayısı (bakiyesi olmayan kişiler sıfır sayılır). Departman filtresi seçiliyken payda seçili kapsamın aktif personelidir.',
    'Durum etiketleri mevcut panodaki kurala göredir: 0’ın altı Borçta, 5 günden az Az bakiye, 30 gün ve üzeri Risk, diğerleri Normal. Renk tek başına anlam taşımaz; etiket her zaman yazılıdır.',
    'Departman filtresi seçiliyken V.İ. personeli kapsam dışıdır; aylık kadro grafiği şirket geneline aittir.',
    'Kıdem, aktif personelin gerçek işe giriş tarihine göre (ÇALIŞMA SÜRESİ verisi) hesaplanır; kovalar İşten Ayrılanlar sayfasındakilerle aynıdır.'
  ]);
}
