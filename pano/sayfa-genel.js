/* ==========================================================================
   İK DASHBOARD 2.0 · GENEL BAKIŞ  (pano/sayfa-genel.js)
   --------------------------------------------------------------------------
   Diğer sayfaların ŞABLONU. Akış (BRIEF): (1) Özet — kaput + gösterge panosu
   (2) Trend — zaman içindeki değişim (3) Kırılım — dağılımlar (4) Liste — tablo.
   Firebase import ETMEZ; tüm veri B (bağlam) ile gelir. Sözleşme: pano/KABUK.md
   Değerler index.html Genel Bakış ile AYNI kuralla hesaplanır (ozet || dizi uzunluğu;
   filtre seçiliyken dizi uzunlukları; turnover/kıdem oranları paketten, yeniden hesaplanmaz).
   ========================================================================== */
import * as O from './ortak.js';

export const meta = { id: 'ov', baslik: 'Genel Bakış', ikon: O.ikon('genel') };

/* Yeniden çizimler (filtre değişimi) arasında korunan sayfa içi seçimler */
const durum = { kidemDept: '', kidemBolum: '' };

export function ciz(kok, B) {
  const M = hesapla(B);
  ozetCiz(kok, B, M);
  trendCiz(kok, B, M);
  kirilimCiz(kok, B, M);
  listeCiz(kok, B, M);
  notlarCiz(kok, B);
}
export function temizle() { /* grafikleri kabuk temizler (O.grafikleriTemizle); bu sayfanın ek kaynağı yok */ }

/* ==========================================================================
   HESAP — index.html renderOV (+ filtre sarmalayıcısı) ile aynı kurallar
   ========================================================================== */
function hesapla(B) {
  const D = B.D, oz = D.ozet || {}, F = B.filtreli, fa = B.filtreAktif;
  const cl = F.normal, st = F.stajyer, gc = F.gecici, vi = F.vi, ay = F.ayrilanlar, ia = F.isealim;
  const pw = !fa && oz.prev_week ? oz.prev_week : null;            /* haftalık fark yalnız şirket geneli için anlamlı */
  const aktif = fa ? cl.length : (oz.personel_mevcudu || cl.length);
  const stajyer = fa ? st.length : (oz.stajyer_sayisi || st.length);
  const analist = fa ? gc.length : (oz.analist_sayisi || gc.length);
  const viSayi = fa ? vi.length : (oz.vi_sayisi || vi.length);   /* filtrede V.İ. kapsam dışı (B4 düzeltmesi) */
  const cikis = fa ? ay.length : (oz.ytd_cikis || ay.length);
  const giris = fa ? ia.length : (oz.ytd_giris || ia.length);
  const istifa = ay.filter((d) => d.neden === 'İstifa').length;
  const aylar = O.aylar(D);
  return {
    D, oz, fa, cl, ay, ia, aylar,
    aktif, stajyer, analist, vi: viSayi, toplam: aktif + stajyer + analist + viSayi,
    cikis, giris, net: giris - cikis,
    istifa, istifaOran: ay.length ? Math.round(istifa / ay.length * 100) : null,
    yogun: O.enYogunAy(ay),
    ytd: oz.ytd_turnover || null,
    simule: oz.simule_yilsonu || null,
    kidem: oz.sirket_kidemi || null,
    istenen: oz.ytd_istenen != null ? { yuzde: oz.ytd_istenen } : (oz.istenen_count != null ? { sayi: oz.istenen_count } : null),
    istenmeyen: oz.ytd_istenmeyen != null ? { yuzde: oz.ytd_istenmeyen } : (oz.istenmeyen_count != null ? { sayi: oz.istenmeyen_count } : null),
    aySayisi: O.aySayisi(D),
    dAktif: pw ? O.haftalikFark(aktif, pw.personel_mevcudu) : null,
    dStajyer: pw ? O.haftalikFark(stajyer, pw.stajyer_sayisi) : null,
    dCikis: pw ? O.haftalikFark(cikis, pw.ytd_cikis) : null,
    dGiris: pw ? O.haftalikFark(giris, pw.ytd_giris) : null,
    dYtd: pw ? O.haftalikFark(oz.ytd_turnover, pw.ytd_turnover, true) : null,
    trendCikis: O.aySay(ay, aylar),
    trendGiris: O.aySay(ia, aylar)
  };
}

/* ==========================================================================
   (1) ÖZET — kaput (başlık + tek cümle + 3 kadran) ve gruplu gösterge panosu
   ========================================================================== */
const b = (v) => '<b>' + v + '</b>';
const anahtar = (renk) => '<i style="background:' + renk + '"></i>';

function ozetCumlesi(B, M) {
  const e = B.etiket || {};
  if (M.fa) {
    return 'Seçili kapsamda (' + O.esc(O.filtreMetni(B.filtre)) + ') ' + b(O.sayi(M.aktif)) + ' aktif personel; 2026’da ' + b(O.sayi(M.giris)) + ' giriş, '
      + b(O.sayi(M.cikis)) + ' çıkış (net ' + O.isaretli(M.net) + '). Turnover ve kıdem oranları şirket geneline aittir.';
  }
  let s = (e.hafta ? O.esc(e.hafta) + ' itibarıyla ' : '') + b(O.sayi(M.aktif)) + ' aktif personel';
  if (M.dAktif) s += ' (geçen haftaya göre ' + O.isaretli(M.dAktif.fark) + ')';
  s += '; 2026’da ' + b(O.sayi(M.giris)) + ' giriş, ' + b(O.sayi(M.cikis)) + ' çıkış (net ' + O.isaretli(M.net) + ')';
  if (M.ytd != null) {
    s += ' ve yılbaşından bu yana ' + b(O.yuzde(M.ytd)) + ' turnover';
    if (M.simule != null) s += ' — mevcut trendle yıl sonu projeksiyonu ' + b(O.yuzde(M.simule));
  }
  return s + '.';
}

function ozetCiz(kok, B, M) {
  const e = B.etiket || {}, oz = M.oz;
  const meta = [];
  if (e.short || e.label) meta.push({ ikon: 'takvim', html: 'Veri dönemi: ' + b(O.esc(e.short || e.label)) });
  if (!M.fa && (oz.hafta_giris != null || oz.hafta_cikis != null)) meta.push({ ikon: 'donus', html: 'Bu hafta: ' + b(O.sayi(oz.hafta_giris)) + ' giriş · ' + b(O.sayi(oz.hafta_cikis)) + ' çıkış' });
  meta.push({ ikon: 'kisiler', html: b(O.sayi(M.toplam)) + ' toplam kayıt' + (M.fa ? ' · seçili kapsam' : '') });

  const ist = M.istenen, istm = M.istenmeyen;
  const ytdParca = ist && istm ? [
    { ad: 'İstenen', deger: ist.yuzde ?? ist.sayi, renk: O.RENK.gk6, metin: ist.yuzde != null ? O.yuzde(ist.yuzde) : O.sayi(ist.sayi) + ' kişi' },
    { ad: 'İstenmeyen', deger: istm.yuzde ?? istm.sayi, renk: O.RENK.gk2, metin: istm.yuzde != null ? O.yuzde(istm.yuzde) : O.sayi(istm.sayi) + ' kişi' }
  ] : [];
  O.kaput(kok, {
    B, bindirme: true,
    ustEtiket: 'İnsan Kaynakları · ' + (e.hafta || '2026'),
    baslik: 'Genel Bakış',
    ozetHtml: ozetCumlesi(B, M),
    meta,
    kadranlar: [
      { etiket: 'Aktif personel', deger: M.aktif, max: M.toplam || 1, merkez: M.aktif,
        alt: b(O.sayi(M.toplam)) + ' toplam kayıt · aktif payı ' + b(O.yuzde(M.toplam ? M.aktif / M.toplam * 100 : null, 0)) },
      { etiket: M.fa ? 'YTD turnover · şirket' : 'YTD turnover', merkez: M.ytd, onek: '%', ondalik: 'oto', parcalar: ytdParca,
        alt: ytdParca.length ? ytdParca.map((p) => anahtar(p.renk) + p.ad + ' ' + b(p.metin)).join('<br>') : 'paket özetinde yok' },
      { etiket: 'Net değişim', merkez: M.net, isaret: true,
        parcalar: [{ ad: 'Giriş', deger: M.giris, renk: O.RENK.gk1, metin: O.sayi(M.giris) + ' kişi' }, { ad: 'Çıkış', deger: M.cikis, renk: O.RENK.gk3, metin: O.sayi(M.cikis) + ' kişi' }],
        alt: anahtar(O.RENK.gk1) + 'Giriş ' + b(O.sayi(M.giris)) + ' · ' + anahtar(O.RENK.gk3) + 'Çıkış ' + b(O.sayi(M.cikis)) }
    ]
  });

  const haftalik = (f, iyiYon) => (f ? Object.assign({ iyiYon, metin: 'geçen haftaya göre' }, f) : null);
  const oranOgesi = (anahtarAd, etiket, x, alt, ipucu) => {
    if (!x) return { anahtar: anahtarAd, etiket, deger: null, alt, ipucu };
    return x.yuzde != null ? { anahtar: anahtarAd, etiket, deger: x.yuzde, onek: '%', ondalik: 'oto', alt, ipucu } : { anahtar: anahtarAd, etiket, deger: x.sayi, birim: 'kişi', alt, ipucu };
  };
  O.kpiPanel(kok, [
    { grup: { baslik: 'Kadro', alt: M.fa ? 'seçili kapsam' : (e.hafta ? e.hafta + ' itibarıyla' : 'güncel'), ikon: 'kisiler' }, ogeler: [
      { anahtar: 'aktif', etiket: 'Aktif personel', deger: M.aktif, alt: 'tam zamanlı', delta: haftalik(M.dAktif, null) },
      { anahtar: 'stajyer', etiket: 'Stajyer', deger: M.stajyer, alt: 'aktif stajyer', delta: haftalik(M.dStajyer, null) },
      { anahtar: 'analist', etiket: 'Analist öğrenci', deger: M.analist, alt: 'geçici çalışan' },
      { anahtar: 'vi', etiket: 'V.İ. personeli', deger: M.vi, alt: M.fa ? 'filtre kapsamı dışında' : 'yat, bahçe, engelli' },
      { anahtar: 'toplam', etiket: 'Toplam kayıt', deger: M.toplam, alt: 'tüm kategoriler' }
    ] },
    { grup: { baslik: 'Hareket', alt: '2026 · yılbaşından bugüne', ikon: 'donus' }, ogeler: [
      { anahtar: 'cikis', etiket: 'Toplam çıkış', deger: M.cikis, alt: '2026 yılında', delta: haftalik(M.dCikis, null) },
      { anahtar: 'giris', etiket: 'İşe alım', deger: M.giris, alt: '2026 yılında', delta: haftalik(M.dGiris, null) },
      { anahtar: 'net', etiket: 'Net değişim', deger: M.net, isaret: true, ton: M.net >= 0 ? 'iyi' : 'kotu', alt: 'alım − çıkış' },
      { anahtar: 'istifa', etiket: 'İstifa oranı', deger: M.istifaOran, onek: '%', alt: M.ay.length ? O.sayi(M.istifa) + ' / ' + O.sayi(M.ay.length) + ' çıkış istifa' : 'çıkışların yüzdesi' },
      { anahtar: 'yogun', etiket: 'En yoğun ay', metin: M.yogun ? O.ayAdi(M.yogun.ay) : '—', alt: M.yogun ? O.sayi(M.yogun.sayi) + ' kişi ayrıldı' : 'çıkış kaydı yok' }
    ] },
    { grup: { baslik: 'Turnover ve kıdem', alt: M.fa ? 'şirket geneli · filtre uygulanmaz' : 'haftalık paket özeti', ikon: 'performans' }, ogeler: [
      { anahtar: 'ytd', etiket: 'YTD turnover', deger: M.ytd, onek: '%', ondalik: 'oto', alt: 'yılbaşından bugüne', delta: haftalik(M.dYtd, 'asagi') },
      { anahtar: 'simule', etiket: 'Simüle yıl sonu', deger: M.simule, onek: '%', ondalik: 'oto', alt: M.aySayisi + ' aylık trend ile projeksiyon' },
      oranOgesi('istenen', 'İstenen (YTD)', M.istenen, 'ayrılış · askerlik, deneme, işveren feshi vb.', 'İstenen ayrılış (YTD)'),
      oranOgesi('istenmeyen', 'İstenmeyen (YTD)', M.istenmeyen, 'ayrılış · şirket için kayıp kabul edilen', 'İstenmeyen ayrılış (YTD)'),
      { anahtar: 'kidem', etiket: 'Şirket ort. kıdemi', deger: M.kidem, ondalik: 1, birim: 'yıl', alt: 'tüm aktif personel' }
    ] }
  ], { sinif: 'bindir' });
}

/* ==========================================================================
   (2) TREND — aylık çıkış/giriş · turnover oranı · aylık personel (2025/2026)
   ========================================================================== */
function sutun(label, data, renk) {
  return { label, data, backgroundColor: renk, hoverBackgroundColor: renk, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22,
    categoryPercentage: 0.66, barPercentage: 0.9, datalabels: O.etiket.ust() };
}

function trendCiz(kok, B, M) {
  O.akisBaslik(kok, { no: '02', baslik: 'Trend', aciklama: 'Aylık hareket, turnover oranı ve personel sayısı · 2026' });
  const iz = O.izgara(kok);
  const ilk = M.aylar[0], son = M.aylar[M.aylar.length - 1];
  const donem = O.ayAdi(ilk) + (son !== ilk ? '–' + O.ayAdi(son) : '') + ' 2026';

  /* Çıkış ve giriş (index: ov-trend) */
  const g1 = O.grafikKarti(iz, {
    baslik: 'Çıkış ve giriş', aciklama: 'Aylık kişi sayısı · ' + donem + (M.fa ? ' · seçili kapsam' : ''), sinif: 's7', yukseklik: 290,
    lejant: [{ ad: 'Çıkış', renk: O.RENK.cikis }, { ad: 'Giriş', renk: O.RENK.giris }],
    etiket: 'Aylık çıkış ve giriş sayıları sütun grafiği',
    tablo: () => ({
      sutunlar: [{ ad: 'Ay' }, { ad: 'Çıkış', sag: true }, { ad: 'Giriş', sag: true }, { ad: 'Net', sag: true }],
      satirlar: M.aylar.map((m, i) => [O.ayAdi(m), O.sayi(M.trendCikis[i]), O.sayi(M.trendGiris[i]), O.isaretli(M.trendGiris[i] - M.trendCikis[i])])
    })
  });
  O.grafik(g1.canvas, {
    type: 'bar',
    data: { labels: M.aylar.map(O.ayKisa), datasets: [sutun('Çıkış', M.trendCikis, O.RENK.cikis), sutun('Giriş', M.trendGiris, O.RENK.giris)] },
    options: {
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 6 } },
      scales: { x: O.eksenX(), y: O.eksenY({ grace: '14%' }) },
      plugins: { tooltip: { callbacks: {
        title: (it) => O.ayAdi(M.aylar[it[0].dataIndex]) + ' 2026',
        label: (c) => ' ' + c.dataset.label + ': ' + O.sayi(c.parsed.y) + ' kişi',
        footer: (it) => { const i = it[0].dataIndex; return 'Net: ' + O.isaretli(M.trendGiris[i] - M.trendCikis[i]); }
      } } }
    }
  });
  if (M.yogun) O.kartNot(g1.govde, 'En yoğun çıkış ayı ' + O.ayAdi(M.yogun.ay) + ' (' + O.sayi(M.yogun.sayi) + ' kişi). Sütun üstündeki sayılar kişi sayısıdır.');

  /* Turnover oranı (index: ov-tvt; oran_asil || oran; verisi olmayan gelecek aylar boş bırakılır) */
  const tv = (M.D.turnover || []).map((t) => {
    const veriYok = !t.calisan && !t.calisan_asil && !t.cikis && !t.cikis_asil;
    return { ay: O.donemAyi(t.donem), donem: t.donem, oran: veriYok ? null : (t.oran_asil || t.oran) };
  });
  const g2 = O.grafikKarti(iz, {
    baslik: 'Turnover oranı', aciklama: 'Aylık % · V.İ. hariç' + (M.fa ? ' · şirket geneli (filtre uygulanmaz)' : ''), sinif: 's5', yukseklik: 290,
    etiket: 'Aylık turnover oranı çizgi grafiği',
    tablo: () => ({ sutunlar: [{ ad: 'Ay' }, { ad: 'Turnover', sag: true }], satirlar: tv.map((x) => [O.ayAdi(x.ay) || x.donem, x.oran == null ? '—' : O.yuzde(x.oran)]) })
  });
  if (!tv.length) { g2.kap.textContent = ''; O.bosDurum(g2.kap, { ikon: 'donus', baslik: 'Turnover verisi yok', kucuk: true }); }
  else {
    O.grafik(g2.canvas, {
      type: 'line',
      data: { labels: tv.map((x) => O.ayKisa(x.ay) || x.donem), datasets: [{
        label: 'Turnover', data: tv.map((x) => x.oran), borderColor: O.RENK.cikis, backgroundColor: O.renkSaydam(O.RENK.cikis, 0.1), fill: 'origin',
        pointBackgroundColor: O.RENK.cikis, spanGaps: false, datalabels: O.etiket.nokta({ onek: '%', ondalik: 'oto', minPx: 34 })
      }] },
      options: {
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 12, right: 10 } },
        scales: { x: O.eksenX(), y: O.eksenY({ grace: '18%', ticks: { callback: (v) => '%' + O.sayi(v, 'oto') } }) },
        plugins: { tooltip: { callbacks: { title: (it) => (O.ayAdi(tv[it[0].dataIndex].ay) || tv[it[0].dataIndex].donem) + ' 2026', label: (c) => ' Turnover: ' + O.yuzde(c.parsed.y) } } }
      }
    });
    O.kartNot(g2.govde, 'Aylık çıkış (V.İ. hariç) / ay içindeki çalışan sayısı. Değerler paketten gelir.');
  }

  /* Aylara göre personel sayısı — 2025 / 2026 (index: ov-aylik-hc). Çizgi grafikte eksen sıfırdan başlamak zorunda değil. */
  const hc = B.MONTHLY_HC;
  const y25 = hc ? hc.y2025 || [] : [], y26 = hc ? hc.y2026 || [] : [];
  const g3 = O.grafikKarti(iz, {
    baslik: 'Aylara göre personel sayısı', aciklama: 'Ay sonu · V.İ. hariç · 2025 ile karşılaştırma' + (M.fa ? ' · şirket geneli (filtre uygulanmaz)' : ''), sinif: 's12', yukseklik: 300,
    lejant: [{ ad: '2025', renk: O.RENK.y2025, tip: 'cizgi' }, { ad: '2026', renk: O.RENK.y2026, tip: 'cizgi' }],
    etiket: '2025 ve 2026 ay sonu personel sayısı çizgi grafiği',
    tablo: hc ? () => ({
      sutunlar: [{ ad: 'Ay' }, { ad: '2025', sag: true }, { ad: '2026', sag: true }, { ad: 'Fark', sag: true }],
      satirlar: hc.labels.map((l, i) => [O.trBaslik(l), O.sayi(y25[i]), O.sayi(y26[i]), y25[i] == null || y26[i] == null ? '—' : O.isaretli(y26[i] - y25[i])])
    }) : null
  });
  if (!hc) {
    g3.kap.textContent = '';
    O.bosDurum(g3.kap, { ikon: 'takvim', baslik: 'Aylık personel verisi yok', metin: 'Bu haftanın paketinde aylık personel sayıları bulunmuyor.', kucuk: true });
  } else {
    const hiza = (diger) => (ctx) => { const v = ctx.dataset.data[ctx.dataIndex], o = diger[ctx.dataIndex]; return o == null || v >= o ? 'top' : 'bottom'; };
    O.grafik(g3.canvas, {
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
          title: (it) => O.trBaslik(hc.labels[it[0].dataIndex]),
          label: (c) => ' ' + c.dataset.label + ': ' + O.sayi(c.parsed.y) + ' kişi',
          footer: (it) => { const i = it[0].dataIndex; return y25[i] != null && y26[i] != null ? '2025’e göre: ' + O.isaretli(y26[i] - y25[i]) : ''; }
        } } }
      }
    });
  }
}

/* ==========================================================================
   (3) KIRILIM — neden · bölüm · departman · unvan · bölüm × unvan · kıdem aracı
   ========================================================================== */
function kirilimCiz(kok, B, M) {
  O.akisBaslik(kok, { no: '03', baslik: 'Kırılım', aciklama: 'Ayrılma nedeni, bölüm, departman ve unvan dağılımları' + (M.fa ? ' · seçili kapsam' : '') });
  const iz1 = O.izgara(kok);
  nedenKarti(iz1, M);
  bolumKarti(iz1, M);
  const iz2 = O.izgara(kok);
  departmanKarti(iz2, M);
  unvanKarti(iz2, M);
  const iz3 = O.izgara(kok);
  bolumUnvanKarti(iz3, M);
  kidemKarti(iz3, M);
}

/* Ayrılma nedeni (index: ov-neden donut + neden kartları) — parça-bütün şeridi + tüm nedenler (kişi ve %) */
function nedenKarti(iz, M) {
  const n = M.ay.length;
  const { govde } = O.kart(iz, { baslik: 'Ayrılma nedeni', aciklama: '2026 · ' + O.sayi(n) + ' çıkışın resmî nedene göre dağılımı', sinif: 's7' });
  if (!n) { O.bosDurum(govde, { ikon: 'kapi', baslik: 'Çıkış kaydı yok', metin: 'Seçili kapsamda 2026 yılında ayrılan personel bulunmuyor.', kucuk: true }); return; }
  const say = O.grupSay(M.ay, (d) => d.neden || 'Diğer');
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
  const ist = M.ay.filter(O.istenenMi).length;
  govde.append(O.el('div', { class: 'kart-alt-cubuk', html: '<span>İstenen: ' + b(O.sayi(ist)) + ' kişi · İstenmeyen: ' + b(O.sayi(n - ist)) + ' kişi</span><span>Yüzdeler tam sayıya yuvarlanır</span>' }));
}

/* Bölüme göre çıkış (index: ov-bolum) + aynı bölümlere giriş */
function bolumKarti(iz, M) {
  const { govde } = O.kart(iz, { baslik: 'Bölüme göre çıkış ve giriş', aciklama: '2026 · hangi bölümden ayrılıyor, hangi bölüme alım yapılıyor', sinif: 's5' });
  const bc = O.bolumSay(M.ay), bg = O.bolumSay(M.ia);
  O.lejant(govde, [{ ad: 'Çıkış', renk: O.RENK.cikis }, { ad: 'Giriş', renk: O.RENK.giris }]);
  O.cubukListe(govde, O.BOLUMLER.map((x) => ({ ad: x, cikis: bc[x], giris: bg[x] })), {
    seriler: [{ k: 'cikis', ad: 'çıkış', renk: O.RENK.cikis }, { k: 'giris', ad: 'giriş', renk: O.RENK.giris }],
    bicim: (v, s, se) => O.sayi(v) + ' ' + se.ad, adGenislik: '64px'
  });
  const topC = O.BOLUMLER.reduce((s, x) => s + bc[x], 0);
  govde.append(O.el('div', { class: 'kart-alt-cubuk', html: '<span>Çıkış payı: ' + O.BOLUMLER.map((x) => O.esc(x) + ' ' + b(topC ? O.yuzde(Math.round(bc[x] / topC * 100), 0) : '—')).join(' · ') + '</span>' }));
}

/* Departman dağılımı — aktif personel, tüm departmanlar (index: ov-dbars) */
function departmanKarti(iz, M) {
  const say = O.grupSay(M.cl, (x) => x.dept || '—');
  const { govde } = O.kart(iz, { baslik: 'Departman dağılımı', aciklama: 'Aktif personel · tam zamanlı · ' + O.sayi(say.length) + ' departman', sinif: 's5' });
  O.cubukListe(govde, say.map(([k, v]) => ({ ad: k, deger: v })), { kaydir: 392, adGenislik: '44%', bos: 'Aktif personel kaydı yok' });
}

/* Unvan dağılımı — ilk 15 (index: ov-unvan) */
function unvanKarti(iz, M) {
  const say = O.grupSay(M.cl, (x) => x.unvan || '—').slice(0, 15);
  const { govde } = O.kart(iz, { baslik: 'Unvan dağılımı', aciklama: 'Aktif personel · en kalabalık 15 unvan', sinif: 's7' });
  O.cubukListe(govde, say.map(([k, v]) => ({ ad: k, deger: v })), { adGenislik: '46%', bos: 'Aktif personel kaydı yok' });
}

/* Bölüm × unvan — her bölümde ilk 6 (index: ov-unvan-detail) */
function bolumUnvanKarti(iz, M) {
  const { govde } = O.kart(iz, { baslik: 'Bölüm × unvan', aciklama: 'Servis · Satış · İdari — her bölümde en kalabalık 6 unvan', sinif: 's8' });
  const kol = O.el('div', { class: 'uc-kolon' });
  O.BOLUMLER.forEach((x) => {
    const bp = M.cl.filter((p) => p.bolum === x);
    if (!bp.length) return;
    const isaret = O.el('i');
    isaret.style.background = O.bolumRengi(x);
    const k = O.el('div', { class: 'kolon' }, O.el('div', { class: 'kolon-baslik' }, O.el('b', null, isaret, x), O.el('span', { text: O.sayi(bp.length) + ' kişi' })));
    O.cubukListe(k, O.grupSay(bp, (p) => p.unvan || '—').slice(0, 6).map(([u, v]) => ({ ad: u, deger: v })), { renk: O.bolumRengi(x), adGenislik: '54%' });
    kol.append(k);
  });
  if (kol.children.length) govde.append(kol);
  else O.bosDurum(govde, { ikon: 'kisiler', baslik: 'Aktif personel kaydı yok', kucuk: true });
}

/* Departman + bölüm kıdemi aracı (index: ovKidemHesapla — aktif personelin kidem_gun / 365) */
function kidemKarti(iz, M) {
  const { govde } = O.kart(iz, { baslik: 'Departman ve bölüm kıdemi', aciklama: 'Bir departman ve/veya bölüm seçerek aktif personelin ortalama kıdemini görün', sinif: 's4' });
  const depts = [...new Set(M.cl.map((x) => x.dept).filter((x) => x && x !== '-'))].sort(O.trKarsilastir);
  if (durum.kidemDept && depts.indexOf(durum.kidemDept) < 0) durum.kidemDept = '';
  const arac = O.el('div', { class: 'arac-satiri' });
  O.secim(arac, { etiket: 'Departman', secenekler: [{ v: '', ad: 'Tüm departmanlar' }].concat(depts.map((d) => ({ v: d, ad: d }))), deger: durum.kidemDept, degisince: (v) => { durum.kidemDept = v; sonucCiz(); } });
  O.secim(arac, { etiket: 'Bölüm', secenekler: [{ v: '', ad: 'Tüm bölümler' }].concat(O.BOLUMLER.map((x) => ({ v: x, ad: x }))), deger: durum.kidemBolum, degisince: (v) => { durum.kidemBolum = v; sonucCiz(); } });
  const sonuc = O.el('div', { class: 'kidem-sonuc', 'aria-live': 'polite' });
  govde.append(arac, sonuc, O.el('div', { class: 'dipnot', text: '* Aktif personelin gerçek işe giriş tarihine göre (ÇALIŞMA SÜRESİ verisi) hesaplanmıştır.' }));
  function sonucCiz() {
    sonuc.textContent = '';
    const r = O.kidemAraci(M.cl, durum.kidemDept, durum.kidemBolum);
    if (!r.kisi) { O.bosDurum(sonuc, { ikon: 'kidem', baslik: 'Bu seçim için kıdem verisi bulunamadı.', kucuk: true }); return; }
    sonuc.append(O.el('div', { class: 'sonuc-izgara' },
      O.el('div', { class: 'sonuc vurgu', 'data-kpi': 'kidem-ort', 'data-deger': String(r.ort) }, O.el('small', { text: 'Ortalama kıdem' }), O.el('b', { text: O.sayi(r.ort, 1) + ' yıl' })),
      O.el('div', { class: 'sonuc' }, O.el('small', { text: 'Kişi sayısı' }), O.el('b', { text: O.sayi(r.kisi) }), r.eksik ? O.el('em', { text: '(' + O.sayi(r.eksik) + ' kişide veri yok)' }) : null),
      O.el('div', { class: 'sonuc' }, O.el('small', { text: 'Min–Maks' }), O.el('b', { text: O.sayi(r.min, 1) + ' – ' + O.sayi(r.max, 1) + ' yıl' }))));
  }
  sonucCiz();
}

/* ==========================================================================
   (4) LİSTE — departman özeti (aranabilir, sıralanabilir, sayfalı)
   ========================================================================== */
function listeCiz(kok, B, M) {
  O.akisBaslik(kok, { no: '04', baslik: 'Liste', aciklama: 'Departman bazında kadro, hareket ve kıdem özeti' });
  const F = B.filtreli;
  const harita = new Map();
  const satir = (d) => { if (!harita.has(d)) harita.set(d, { dept: d, aktif: 0, stajyer: 0, giris: 0, cikis: 0, kt: 0, kk: 0 }); return harita.get(d); };
  const gecerli = (d) => d && d !== '-' && !O.isVI(d);
  F.normal.forEach((p) => { if (!gecerli(p.dept)) return; const s = satir(p.dept); s.aktif++; if (p.kidem_gun != null) { s.kt += p.kidem_gun / 365; s.kk++; } });
  F.stajyer.forEach((p) => { if (gecerli(p.dept)) satir(p.dept).stajyer++; });
  F.ayrilanlar.forEach((p) => { if (gecerli(p.dept)) satir(p.dept).cikis++; });
  F.isealim.forEach((p) => { if (gecerli(p.dept)) satir(p.dept).giris++; });
  const satirlar = [...harita.values()].map((s) => ({ dept: s.dept, aktif: s.aktif, stajyer: s.stajyer, giris: s.giris, cikis: s.cikis, net: s.giris - s.cikis, kidem: s.kk ? s.kt / s.kk : null }));
  const top = satirlar.reduce((a, s) => ({ aktif: a.aktif + s.aktif, stajyer: a.stajyer + s.stajyer, giris: a.giris + s.giris, cikis: a.cikis + s.cikis }), { aktif: 0, stajyer: 0, giris: 0, cikis: 0 });
  const genel = O.kidemAraci(F.normal, '', '');
  const { govde } = O.kart(kok, { baslik: 'Departman özeti', aciklama: '2026 · aktif kadro, stajyer, giriş–çıkış ve ortalama kıdem · başlığa tıklayarak sıralayın', sinif: 'kart-liste' });
  O.tablo(govde, {
    sutunlar: [
      { k: 'dept', ad: 'Departman', sinif: 'ad-hucre' },
      { k: 'aktif', ad: 'Aktif', tip: 'sayi', sag: true },
      { k: 'stajyer', ad: 'Stajyer', tip: 'sayi', sag: true },
      { k: 'giris', ad: 'Giriş (2026)', tip: 'sayi', sag: true },
      { k: 'cikis', ad: 'Çıkış (2026)', tip: 'sayi', sag: true },
      { k: 'net', ad: 'Net', tip: 'sayi', sag: true, bicim: (v) => O.isaretli(v), hucreSinif: (v) => (v > 0 ? 'pozitif' : v < 0 ? 'negatif' : '') },
      { k: 'kidem', ad: 'Ort. kıdem', tip: 'sayi', sag: true, bicim: (v) => (v == null ? '—' : O.sayi(v, 1) + ' yıl') }
    ],
    satirlar,
    sayfaBoyu: 12,
    siraNo: true,
    araYer: 'Departman ara…',
    varsayilanSira: { k: 'aktif', y: 'azalan' },
    altMetin: (n, t) => (n === t ? O.sayi(n) : O.sayi(n) + ' / ' + O.sayi(t)) + ' departman · liste kayıtlarından sayılır',
    toplamSatir: { dept: 'Toplam', aktif: top.aktif, stajyer: top.stajyer, giris: top.giris, cikis: top.cikis, net: top.giris - top.cikis, kidem: genel.ort },
    bos: { baslik: 'Departman bulunamadı', metin: 'Aramayı değiştirin ya da departman filtresini temizleyin.' }
  });
}

function notlarCiz(kok, B) {
  const e = B.etiket || {};
  O.notlar(kok, [
    'Kaynak: haftalık İK pano paketi' + (e.label ? ' (' + e.label + ')' : '') + '. Veriyi İnsan Kaynakları yükler; yüklendiği anda tüm yetkililer görür.',
    'YTD turnover, yıl sonu projeksiyonu, istenen/istenmeyen oranları ve şirket ortalama kıdemi paketteki özet değerlerdir; pano bu oranları yeniden hesaplamaz.',
    'Departman filtresi seçiliyken kadro, hareket, dağılımlar ve tablo seçili departmanlara göre sayılır; turnover oranları ve aylık personel sayısı şirket geneline aittir.',
    'Departman özeti liste kayıtlarından sayılır; Aktif personel göstergesi paketteki özet değeri kullandığından küçük farklar olabilir (ör. serbest çalışanlar).',
    'İstifa oranı = istifa ile ayrılan / toplam çıkış. Renk hiçbir yerde tek başına anlam taşımaz; değer ve etiket her zaman yazılıdır.'
  ]);
}
