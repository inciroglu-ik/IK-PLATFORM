/* ==========================================================================
   İK DASHBOARD 2.0 · TURNOVER ANALİZİ  (pano/sayfa-turnover.js)
   --------------------------------------------------------------------------
   Akış (BRIEF): (1) Özet — kaput + gösterge panosu (2) Trend (3) Kırılım (4) Liste.
   Firebase import ETMEZ; tüm veri B (bağlam) ile gelir. Sözleşme: pano/KABUK.md
   index.html renderTV (+ filtre sarmalayıcısı) ile AYNI kurallar:
   • Oranlar ozet'ten gelir, yeniden HESAPLANMAZ (ytd, simüle, istenen/istenmeyen, ort. çıkış/ay, 2025 kapanış)
   • Toplam çıkış = ozet.ytd_cikis || Σ turnover.cikis · toplam giriş = ozet.ytd_giris || Σ turnover.giris
   • Aylık ort. oran = Σ(oran_asil || oran) / dönem sayısı (paketteki tüm dönemler; mevcut kural)
   • Aylık oran = oran_asil || oran · tablo değerlendirmesi mevcut eşiklerle (turnoverRiski: >4 / >2,5)
   • Global filtre seçiliyken index.html'deki gibi yaklaşık hesap (turnoverFiltreli): çıkış / seçili kapsamdaki
     aktif personel. DÜZELTME (B3/B15): yıl sonu simülasyonu 6 aya sabit değil, ay sayısı VERİDEN (ozet.ay_sayisi).
   Diğer düzeltmeler: istenen ?? istened (B1) · aylık istenen/istenmeyen seçili kapsamın listesinden · filtreliyken
   aylık giriş seçili kapsamın işe alımlarından (eskiden 0 yazılıyordu) · 2025 değerleri pakette yoksa "—"
   (koda gömülü yedek sayı kullanılmaz) · veri gelmemiş aylar grafikte boş, tabloda "Veri yok".
   Ortak kitaplıkta olmayan, bu modülde yazılan yardımcılar: yığılmış çubuk değer etiketleri (icEtiket/toplamEtiket),
   aylık tabloyu Excel'e aktarma (excelAktar).
   ========================================================================== */
import * as O from './ortak.js';

export const meta = { id: 'tv', baslik: 'Turnover Analizi', ikon: O.ikon('donus') };

export function ciz(kok, B) {
  kok.append(O.el('style', { 'data-sayfa-stil': 'tv', text: STIL }));
  const M = hesapla(B);
  ozetCiz(kok, B, M);
  trendCiz(kok, M);
  kirilimCiz(kok, M);
  listeCiz(kok, B, M);
  notlarCiz(kok, B, M);
}
export function temizle() { /* grafikleri kabuk temizler; bu sayfanın ek kaynağı yok */ }

/* ==========================================================================
   HESAP — index.html renderTV ile aynı kurallar
   ========================================================================== */
const bos = (v) => O.bosMu(v) || isNaN(+v);
const deger = (v) => (bos(v) ? null : +v);
const ilkDolu = (...a) => { for (const v of a) if (!bos(v)) return +v; return null; };

function hesapla(B) {
  const D = B.D || {}, oz0 = D.ozet || {}, F = B.filtreli || {}, fa = !!B.filtreAktif;
  const aySayisi = O.aySayisi(D);
  const ayr = F.ayrilanlar || [];
  let oz = oz0, tv = D.turnover || [], aktifKisi = null, hesapYok = false;
  if (fa) {
    aktifKisi = (F.normal || []).length;
    const f = O.turnoverFiltreli(ayr, F.normal || [], F.isealim || [], oz0, { simAy: aySayisi });
    oz = f.ozet;
    /* index.html filtreliyken her aya giriş = 0 yazıyordu; seçili kapsamın işe alımları sayılır */
    const girisAy = O.aySay(F.isealim || [], f.turnover.map((t) => O.donemAyi(t.donem)));
    tv = f.turnover.map((t, i) => Object.assign({}, t, { giris: girisAy[i] }));
    /* seçili kapsamın aylık ortalama çıkışı (paket değeri şirket geneline ait) */
    oz.ort_cikis_ay = Math.round((oz.ytd_cikis || 0) / aySayisi * 10) / 10;
    hesapYok = !aktifKisi; /* aktif personel yoksa oran anlamsız (payda 1'e düşer) */
  }
  const oranAl = (k) => (hesapYok ? null : deger(oz[k]));
  const satirlar = tv.map((t) => {
    const ay = O.donemAyi(t.donem);
    const veriYok = !t.calisan && !t.calisan_asil && !t.cikis && !t.cikis_asil;
    const oran = veriYok || hesapYok ? null : (t.oran_asil || t.oran || 0);
    const ayAyr = ayr.filter((x) => +x.ay === ay);
    const ist = ayAyr.filter(O.istenenMi).length;
    const risk = oran == null ? null : O.turnoverRiski(oran);
    const yil = String(t.donem || '').split('-')[0];
    return {
      donem: t.donem, ay, adUzun: O.ayAdi(ay) ? O.ayAdi(ay) + ' ' + yil : String(t.donem || '—'), kisa: O.ayKisa(ay) || String(t.donem || ''),
      calisan: veriYok ? null : (t.calisan_asil || t.calisan), giris: veriYok ? null : (t.giris || 0),
      cikis: veriYok ? null : (t.cikis_asil != null ? t.cikis_asil : t.cikis), oran,
      istenen: veriYok ? null : ist, istenmeyen: veriYok ? null : ayAyr.length - ist,
      veriYok, risk, riskMetin: risk ? risk.metin.replace(/^[^0-9A-Za-zÇĞİÖŞÜçğıöşü]+/u, '').trim() : ''
    };
  });
  const veriliSatir = satirlar.filter((r) => !r.veriYok);
  const ilk = O.aylar(D)[0], son = aySayisi;
  return {
    D, oz, fa, hesapYok, aktifKisi, aySayisi, ayr, tv, satirlar, veriliSatir,
    donem: O.ayAdi(ilk) + (son !== ilk ? '–' + O.ayAdi(son) : '') + ' 2026',
    ytd: oranAl('ytd_turnover'), simule: oranAl('simule_yilsonu'),
    istY: hesapYok ? null : ilkDolu(oz.ytd_istenen, oz.ytd_istened), istmY: oranAl('ytd_istenmeyen'),
    simIst: hesapYok ? null : ilkDolu(oz.simule_istenen, oz.simule_istened), simIstm: oranAl('simule_istenmeyen'),
    istSay: ilkDolu(oz.istenen_count, oz.istened_count, 0), istmSay: ilkDolu(oz.istenmeyen_count, 0),
    cikis: oz.ytd_cikis || tv.reduce((a, t) => a + (+t.cikis || 0), 0),
    giris: oz.ytd_giris || tv.reduce((a, t) => a + (+t.giris || 0), 0),
    ortCikis: deger(oz.ort_cikis_ay),
    avgO: tv.length && !hesapYok ? Math.round(tv.reduce((a, t) => a + (+(t.oran_asil || t.oran) || 0), 0) / tv.length * 100) / 100 : null,
    /* 2025 değerleri şirket geneli (filtre uygulanmaz); pakette yoksa "—" */
    kapanis: deger(oz0.kapanis_2025_turnover), cikis2025: deger(oz0.cikis_2025), giris2025: deger(oz0.giris_2025), avgCal: deger(oz0.avg_calisan),
    pw: !fa && oz0.prev_week ? oz0.prev_week : null
  };
}

/* ==========================================================================
   (1) ÖZET — kaput (başlık + tek cümle + 3 kadran) ve gruplu gösterge panosu
   ========================================================================== */
const b = (v) => '<b>' + v + '</b>';

function ozetCumlesi(B, M) {
  if (M.fa) {
    const on = 'Seçili kapsamda (' + O.esc(O.filtreMetni(B.filtre)) + ') ';
    if (M.hesapYok) return on + 'aktif personel bulunmadığından turnover oranı hesaplanamıyor; ' + M.donem + ' döneminde ' + b(O.sayi(M.cikis)) + ' çıkış kaydı var.';
    let s = on + M.donem + ' döneminde yaklaşık turnover ' + b(O.yuzde(M.ytd)) + ' (' + O.sayi(M.cikis) + ' çıkış / ' + O.sayi(M.aktifKisi) + ' aktif personel); '
      + O.sayi(M.aySayisi) + ' aylık trendle yıl sonu projeksiyonu ' + b(O.yuzde(M.simule)) + '.';
    if (M.kapanis != null) s += ' 2025 kapanışı (şirket geneli) ' + b(O.yuzde(M.kapanis)) + '.';
    return s;
  }
  if (M.ytd == null) return 'Bu haftanın paket özetinde YTD turnover değeri bulunmuyor; aylık oranlar aşağıda.';
  let s = M.donem + ' döneminde (' + O.sayi(M.aySayisi) + ' ay) V.İ. hariç turnover ' + b(O.yuzde(M.ytd));
  if (M.simule != null) s += '; mevcut trendle yıl sonu projeksiyonu ' + b(O.yuzde(M.simule));
  if (M.kapanis != null) s += ' — 2025 kapanışı ' + b(O.yuzde(M.kapanis));
  s += '.';
  if (M.istY != null && M.istmY != null) s += ' İstenen turnover ' + b(O.yuzde(M.istY)) + ', istenmeyen turnover ' + b(O.yuzde(M.istmY)) + '.';
  return s;
}

function ozetCiz(kok, B, M) {
  const e = B.etiket || {};
  const meta = [];
  if (e.short || e.label) meta.push({ ikon: 'takvim', html: 'Veri dönemi: ' + b(O.esc(e.short || e.label)) });
  meta.push({ ikon: 'donus', html: b(O.sayi(M.aySayisi)) + ' ay veri · V.İ. hariç' });
  if (M.fa) meta.push({ ikon: 'kisiler', html: 'Seçili kapsamda aktif personel: ' + b(O.sayi(M.aktifKisi)) });
  const fark = M.simule != null && M.kapanis != null ? Math.round((M.simule - M.kapanis) * 100) / 100 : null;
  O.kaput(kok, {
    B, bindirme: true,
    ustEtiket: 'İnsan Kaynakları · ' + (e.hafta || '2026'),
    baslik: 'Turnover Analizi',
    ozetHtml: ozetCumlesi(B, M),
    meta,
    /* Üç kadran da 0–100 % ölçeğinde: halkalar birbiriyle doğrudan karşılaştırılabilir (eşik çizilmez) */
    kadranlar: [
      { etiket: M.fa ? 'Turnover · seçili' : 'YTD turnover', deger: M.ytd, max: 100, onek: '%', ondalik: 'oto',
        alt: M.istY != null && M.istmY != null ? 'İstenen ' + b(O.yuzde(M.istY)) + '<br>İstenmeyen ' + b(O.yuzde(M.istmY)) : O.sayi(M.aySayisi) + ' ay · V.İ. hariç' },
      { etiket: 'Simüle yıl sonu', deger: M.simule, max: 100, onek: '%', ondalik: 'oto',
        alt: fark != null ? '2025 kapanışına göre<br>' + b(O.isaretli(fark, 'oto') + ' puan') : 'mevcut trende göre' },
      { etiket: M.fa ? '2025 kapanış · şirket' : '2025 kapanış', deger: M.kapanis, max: 100, onek: '%', ondalik: 'oto',
        alt: b(O.sayi(M.cikis2025)) + ' çıkış<br>' + b(O.sayi(M.avgCal)) + ' kapanış personeli' }
    ]
  });

  const haftalik = (f, iyiYon) => (f ? Object.assign({ iyiYon, metin: 'geçen haftaya göre' }, f) : null);
  const pw = M.pw;
  const oran = (anahtar, etiket, v, alt, ipucu, delta) => ({ anahtar, etiket, deger: v, onek: '%', ondalik: 'oto', alt, ipucu, delta: delta || null });
  O.kpiPanel(kok, [
    { grup: { baslik: 'Yılbaşından bugüne', alt: M.fa ? 'seçili kapsam · yaklaşık hesap' : M.donem + ' · V.İ. hariç', ikon: 'donus' }, ogeler: [
      oran('tv-ytd', 'YTD turnover', M.ytd, O.sayi(M.aySayisi) + ' ay · V.İ. hariç', 'Yılbaşından bugüne turnover', pw ? haftalik(O.haftalikFark(M.ytd, pw.ytd_turnover, true), 'asagi') : null),
      oran('tv-istenen', 'İstenen (YTD)', M.istY, O.sayi(M.istSay) + ' kişi · işveren kararı', 'İşveren feshi, deneme (işveren), askerlik, 25. madde, emeklilik, belirli süreli'),
      oran('tv-istenmeyen', 'İstenmeyen (YTD)', M.istmY, O.sayi(M.istmSay) + ' kişi · istifa vb.', 'İstifa ve diğer istenmeyen ayrılışlar'),
      { anahtar: 'tv-cikis', etiket: '2026 toplam çıkış', deger: M.cikis, altHtml: '2025: ' + b(O.sayi(M.cikis2025)) + ' çıkış', delta: pw ? haftalik(O.haftalikFark(M.cikis, pw.ytd_cikis), null) : null },
      { anahtar: 'tv-giris', etiket: '2026 toplam giriş', deger: M.giris, altHtml: '2025: ' + b(O.sayi(M.giris2025)) + ' giriş', delta: pw ? haftalik(O.haftalikFark(M.giris, pw.ytd_giris), null) : null }
    ] },
    { grup: { baslik: 'Projeksiyon ve ortalama', alt: 'yıl sonu tahmini · aylık ortalamalar', ikon: 'performans' }, ogeler: [
      oran('tv-simule', 'Simüle yıl sonu', M.simule, 'mevcut trende göre · ' + O.sayi(M.aySayisi) + ' ay', 'YTD / ay sayısı × 12'),
      oran('tv-sim-istenen', 'Simüle istenen YS', M.simIst, 'yıl sonu tahmini'),
      oran('tv-sim-istenmeyen', 'Simüle istenmeyen YS', M.simIstm, 'yıl sonu tahmini'),
      { anahtar: 'tv-ort-cikis', etiket: 'Ort. çıkış / ay', deger: M.ortCikis, ondalik: 'oto', alt: O.sayi(M.aySayisi) + ' ay üzerinden' + (M.fa ? ' · seçili kapsam' : '') },
      { anahtar: 'tv-ort-oran', etiket: 'Aylık ort. oran', deger: M.avgO, onek: '%', ondalik: 2, alt: 'V.İ. hariç · ' + O.sayi(M.tv.length) + ' dönem', ipucu: 'Paketteki tüm dönemlerin aylık oran ortalaması' }
    ] }
  ], { sinif: 'bindir' });
}

/* ==========================================================================
   GRAFİK YARDIMCILARI
   ========================================================================== */
function sutun(label, data, renk, ek) {
  return Object.assign({ label, data, backgroundColor: renk, hoverBackgroundColor: renk, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22, categoryPercentage: 0.66, barPercentage: 0.9 }, ek || {});
}
function icEtiket(minPx, bicim) {
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
    anchor: 'center', align: 'center', clamp: true, color: '#fff', font: { family: 'Inter', size: 10.5, weight: '600' }, formatter: bicim || ((v) => O.sayi(v))
  };
}
function toplamEtiket(toplamlar, yatay, bicim) {
  return {
    display: (ctx) => !bos(toplamlar[ctx.dataIndex]) && toplamlar[ctx.dataIndex] > 0,
    anchor: 'end', align: 'end', offset: yatay ? 6 : 3, clamp: true, color: O.RENK.n800, font: { family: 'Inter', size: 10.5, weight: '700' },
    formatter: (v, ctx) => (bicim ? bicim(toplamlar[ctx.dataIndex]) : O.sayi(toplamlar[ctx.dataIndex]))
  };
}
function bosGrafik(g, baslik, metin) { g.kap.textContent = ''; O.bosDurum(g.kap, { ikon: 'donus', baslik, metin: metin || '', kucuk: true }); }

/* ==========================================================================
   (2) TREND — aylık turnover oranı · giriş ve çıkış
   ========================================================================== */
function trendCiz(kok, M) {
  O.akisBaslik(kok, { no: '02', baslik: 'Trend', aciklama: 'Aylık turnover oranı ve personel hareketi · ' + M.donem + (M.fa ? ' · seçili kapsam (yaklaşık)' : '') });
  const iz = O.izgara(kok);
  const S = M.satirlar;
  const etiketler = S.map((r) => r.kisa);

  /* Aylık turnover oranı (index: tv-rate — oran_asil || oran; veri gelmemiş ay boş) */
  const g1 = O.grafikKarti(iz, {
    baslik: 'Aylık turnover oranı', aciklama: 'Aylık % · V.İ. hariç' + (M.fa ? ' · çıkış / seçili kapsam aktif personel' : ' · çıkış / ay içindeki çalışan'), sinif: 's7', yukseklik: 290,
    etiket: 'Aylık turnover oranı çizgi grafiği',
    tablo: () => ({ sutunlar: [{ ad: 'Ay' }, { ad: 'Turnover', sag: true }, { ad: 'Çıkış', sag: true }, { ad: 'Çalışan', sag: true }],
      satirlar: S.map((r) => [r.adUzun, r.oran == null ? '—' : O.yuzde(r.oran), O.sayi(r.cikis), O.sayi(r.calisan)]) })
  });
  if (!S.some((r) => r.oran != null)) bosGrafik(g1, M.hesapYok ? 'Oran hesaplanamıyor' : 'Aylık turnover verisi yok', M.hesapYok ? 'Seçili kapsamda aktif personel yok.' : 'Bu haftanın paketinde aylık oran bulunmuyor.');
  else {
    O.grafik(g1.canvas, {
      type: 'line',
      data: { labels: etiketler, datasets: [{
        label: 'Turnover', data: S.map((r) => r.oran), borderColor: O.RENK.cikis, backgroundColor: O.renkSaydam(O.RENK.cikis, 0.1), fill: 'origin',
        pointBackgroundColor: O.RENK.cikis, spanGaps: false, datalabels: O.etiket.nokta({ onek: '%', ondalik: 'oto', minPx: 34 })
      }] },
      options: {
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 12, right: 10 } },
        scales: { x: O.eksenX(), y: O.eksenY({ grace: '18%', ticks: { callback: (v) => '%' + O.sayi(v, 'oto') } }) },
        plugins: { tooltip: { displayColors: false, callbacks: {
          title: (it) => S[it[0].dataIndex].adUzun,
          label: (c) => ' Turnover: ' + O.yuzde(c.parsed.y),
          footer: (it) => { const r = S[it[0].dataIndex]; return 'Çıkış ' + O.sayi(r.cikis) + ' · çalışan ' + O.sayi(r.calisan); }
        } } }
      }
    });
    O.kartNot(g1.govde, M.fa ? 'Seçili kapsam için yaklaşık oran: aylık çıkış / seçili kapsamdaki aktif personel (' + O.sayi(M.aktifKisi) + ').' : 'Aylık çıkış (V.İ. hariç) / ay içindeki çalışan sayısı (V.İ. hariç). Değerler paketten gelir.');
  }

  /* Giriş ve çıkış (index: tv-mv — çıkış = cikis_asil ?? cikis) */
  const g2 = O.grafikKarti(iz, {
    baslik: 'Giriş ve çıkış', aciklama: 'Aylık kişi sayısı · çıkış V.İ. hariç' + (M.fa ? ' · seçili kapsam' : ''), sinif: 's5', yukseklik: 290,
    lejant: [{ ad: 'Giriş', renk: O.RENK.giris }, { ad: 'Çıkış (V.İ. hariç)', renk: O.RENK.cikis }],
    etiket: 'Aylık giriş ve çıkış sütun grafiği',
    tablo: () => ({ sutunlar: [{ ad: 'Ay' }, { ad: 'Giriş', sag: true }, { ad: 'Çıkış', sag: true }, { ad: 'Net', sag: true }],
      satirlar: S.map((r) => [r.adUzun, O.sayi(r.giris), O.sayi(r.cikis), r.veriYok ? '—' : O.isaretli(r.giris - r.cikis)]) })
  });
  if (!M.veriliSatir.length) bosGrafik(g2, 'Aylık hareket verisi yok');
  else {
    O.grafik(g2.canvas, {
      type: 'bar',
      data: { labels: etiketler, datasets: [
        sutun('Giriş', S.map((r) => r.giris), O.RENK.giris, { datalabels: O.etiket.ust() }),
        sutun('Çıkış (V.İ. hariç)', S.map((r) => r.cikis), O.RENK.cikis, { datalabels: O.etiket.ust() })
      ] },
      options: {
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 6 } },
        scales: { x: O.eksenX(), y: O.eksenY({ grace: '14%' }) },
        plugins: { tooltip: { callbacks: {
          title: (it) => S[it[0].dataIndex].adUzun,
          label: (c) => ' ' + c.dataset.label + ': ' + O.sayi(c.parsed.y) + ' kişi',
          footer: (it) => { const r = S[it[0].dataIndex]; return r.veriYok ? '' : 'Net: ' + O.isaretli(r.giris - r.cikis); }
        } } }
      }
    });
    if (M.fa) O.kartNot(g2.govde, 'Seçili kapsam: giriş işe alım listesinden, çıkış işten ayrılanlar listesinden sayılır.');
  }
}

/* ==========================================================================
   (3) KIRILIM — turnover bileşimi (ozet) · aylık istenen / istenmeyen çıkış (liste)
   ========================================================================== */
function kirilimCiz(kok, M) {
  O.akisBaslik(kok, { no: '03', baslik: 'Kırılım', aciklama: 'İstenen ve istenmeyen turnover; 2026 ile 2025 kapanışı' + (M.fa ? ' · seçili kapsam (yaklaşık)' : '') });
  const iz = O.izgara(kok);
  bilesimKarti(iz, M);
  istenenAylikKarti(iz, M);
}

/* Turnover bileşimi — YTD ve simüle yıl sonu: istenen + istenmeyen; 2025 kapanış (ayrım yok) */
function bilesimKarti(iz, M) {
  const satir = [
    { ad: M.fa ? 'YTD · seçili' : 'YTD 2026', ist: M.istY, istm: M.istmY, top: M.ytd },
    { ad: 'Simüle yıl sonu', ist: M.simIst, istm: M.simIstm, top: M.simule },
    { ad: '2025 kapanış', kap: M.kapanis, top: M.kapanis }
  ];
  const lj = [{ ad: 'İstenen', renk: O.RENK.istenen }, { ad: 'İstenmeyen', renk: O.RENK.istenmeyen }, { ad: '2025 (ayrım yok)', renk: O.RENK.y2025 }];
  const g = O.grafikKarti(iz, {
    baslik: 'Turnover bileşimi', aciklama: 'Yüzde · istenen ve istenmeyen turnover toplamı genel oranı verir', sinif: 's5', yukseklik: 230,
    lejant: lj, etiket: 'Turnover bileşimi yığılmış çubuk grafiği',
    tablo: () => ({ sutunlar: [{ ad: 'Dönem' }, { ad: 'İstenen', sag: true }, { ad: 'İstenmeyen', sag: true }, { ad: 'Toplam', sag: true }],
      satirlar: satir.map((s) => [s.ad, O.yuzde(s.ist), O.yuzde(s.istm), O.yuzde(s.top)]) })
  });
  if (!satir.some((s) => s.top != null)) { bosGrafik(g, 'Özet oranlar pakette yok'); return; }
  const top = satir.map((s) => s.top);
  const yb = (v) => O.yuzde(v);
  O.grafik(g.canvas, {
    type: 'bar',
    data: { labels: satir.map((s) => s.ad), datasets: [
      sutun('İstenen', satir.map((s) => (s.ist == null ? null : s.ist)), O.RENK.istenen, { maxBarThickness: 30, categoryPercentage: 0.72, borderRadius: 0, borderSkipped: false, datalabels: icEtiket(46, yb) }),
      sutun('İstenmeyen', satir.map((s) => (s.istm == null ? null : s.istm)), O.RENK.istenmeyen, { maxBarThickness: 30, categoryPercentage: 0.72, borderRadius: 0, borderSkipped: false, datalabels: icEtiket(46, yb) }),
      sutun('2025 (ayrım yok)', satir.map((s) => (s.kap == null ? null : s.kap)), O.RENK.y2025, { maxBarThickness: 30, categoryPercentage: 0.72, borderRadius: 0, borderSkipped: false, datalabels: { display: false } }),
      /* görünmez toplam dilimi: yığının ucuna toplam oranı yazar */
      sutun('Toplam', satir.map(() => 0), 'rgba(0,0,0,0)', { maxBarThickness: 30, categoryPercentage: 0.72, datalabels: toplamEtiket(top, true, yb) })
    ] },
    options: {
      indexAxis: 'y',
      interaction: { mode: 'index', axis: 'y', intersect: false },
      layout: { padding: { right: 12 } },
      scales: { x: O.eksenY({ stacked: true, grace: '14%', ticks: { callback: (v) => '%' + O.sayi(v, 'oto') } }), y: O.eksenX({ stacked: true, ticks: { font: { size: 12, weight: '600' } } }) },
      plugins: { tooltip: {
        filter: (it) => it.dataset.label !== 'Toplam' && it.raw != null,
        callbacks: {
          title: (it) => satir[it[0].dataIndex].ad,
          label: (c) => ' ' + c.dataset.label + ': ' + O.yuzde(c.parsed.x),
          footer: (it) => 'Toplam: ' + O.yuzde(top[it[0].dataIndex])
        }
      } }
    }
  });
  O.kartNot(g.govde, (M.fa ? 'Seçili kapsam için yaklaşık hesap; 2025 kapanışı şirket geneli. ' : 'Değerler paket özetinden gelir, pano yeniden hesaplamaz. ') + '2025 için istenen/istenmeyen ayrımı pakette yok.');
}

/* Aylık istenen / istenmeyen çıkış — işten ayrılanlar listesinden (index: tv-tb İstenen/İstenmeyen sütunları) */
function istenenAylikKarti(iz, M) {
  const S = M.veriliSatir;
  const top = S.map((r) => r.istenen + r.istenmeyen);
  const g = O.grafikKarti(iz, {
    baslik: 'Aylık istenen ve istenmeyen çıkış', aciklama: 'Kişi sayısı · dilim içinde tür, üstte ay toplamı' + (M.fa ? ' · seçili kapsam' : ''), sinif: 's7', yukseklik: 230,
    lejant: [{ ad: 'İstenen', renk: O.RENK.istenen }, { ad: 'İstenmeyen', renk: O.RENK.istenmeyen }],
    etiket: 'Aylık istenen ve istenmeyen çıkış yığılmış sütun grafiği',
    tablo: () => ({ sutunlar: [{ ad: 'Ay' }, { ad: 'İstenen', sag: true }, { ad: 'İstenmeyen', sag: true }, { ad: 'Toplam', sag: true }, { ad: 'İstenen payı', sag: true }],
      satirlar: S.map((r, i) => [r.adUzun, O.sayi(r.istenen), O.sayi(r.istenmeyen), O.sayi(top[i]), top[i] ? O.yuzde(Math.round(r.istenen / top[i] * 100), 0) : '—']) })
  });
  if (!top.some((v) => v > 0)) { bosGrafik(g, 'Çıkış kaydı yok'); return; }
  O.grafik(g.canvas, {
    type: 'bar',
    data: { labels: S.map((r) => r.kisa), datasets: [
      sutun('İstenen', S.map((r) => r.istenen), O.RENK.istenen, { categoryPercentage: 0.7, barPercentage: 0.92, borderRadius: 0, borderSkipped: false, datalabels: icEtiket(16) }),
      sutun('İstenmeyen', S.map((r) => r.istenmeyen), O.RENK.istenmeyen, { categoryPercentage: 0.7, barPercentage: 0.92, borderRadius: 0, borderSkipped: false, datalabels: { labels: { ic: icEtiket(16), toplam: toplamEtiket(top, false) } } })
    ] },
    options: {
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 6 } },
      scales: { x: O.eksenX({ stacked: true }), y: O.eksenY({ stacked: true, grace: '16%' }) },
      plugins: { tooltip: { callbacks: {
        title: (it) => S[it[0].dataIndex].adUzun,
        label: (c) => ' ' + c.dataset.label + ': ' + O.sayi(c.parsed.y) + ' kişi',
        footer: (it) => { const i = it[0].dataIndex; return 'Toplam: ' + O.sayi(top[i]) + ' kişi' + (top[i] ? ' · istenen payı ' + O.yuzde(Math.round(S[i].istenen / top[i] * 100), 0) : ''); }
      } } }
    }
  });
  O.kartNot(g.govde, 'İşten ayrılanlar listesindeki istenen bayrağından sayılır. İstenen: işveren feshi, deneme (işveren), askerlik, 25. madde, emeklilik, belirli süreli.');
}

/* ==========================================================================
   (4) LİSTE — aylık özet tablosu (index: tv-tb, 8 sütun) + Excel
   ========================================================================== */
const RISK_CIP = { rr: 'cip-ht', ry: 'cip-uy', rg: 'cip-ok' };
const RISK_IKON = { rr: 'uyari', ry: 'bilgi', rg: 'onay' };

function listeCiz(kok, B, M) {
  O.akisBaslik(kok, { no: '04', baslik: 'Liste', aciklama: 'Aylık özet tablosu · değerlendirme mevcut panonun eşikleriyle' });
  const dugme = O.el('button', { class: 'btn', type: 'button', title: 'Aylık özet tablosunu Excel dosyası olarak indir', html: O.ikon('excel') + '<span>Excel’e aktar</span>' });
  dugme.disabled = !M.satirlar.length;
  dugme.addEventListener('click', () => excelAktar(B, M));
  const { govde } = O.kart(kok, {
    baslik: 'Aylık özet tablosu',
    aciklama: 'Dönem bazında çalışan, giriş, çıkış, oran ve istenen/istenmeyen dağılımı' + (M.fa ? ' · seçili kapsam (yaklaşık)' : ' · V.İ. hariç'),
    sinif: 'kart-liste', sag: dugme
  });
  const V = M.veriliSatir;
  const topla = (k) => V.reduce((a, r) => a + (+r[k] || 0), 0);
  O.tablo(govde, {
    sutunlar: [
      { k: 'adUzun', ad: 'Dönem', siralamaDegeri: (r) => r.donem, sinif: 'tv-donem',
        bicim: (v, r) => (r._toplam ? 'Toplam' : O.el('span', null, O.el('b', { text: v }), O.el('small', { text: r.donem }))) },
      { k: 'calisan', ad: 'Çalışan (V.İ. hariç)', tip: 'sayi', sag: true },
      { k: 'giris', ad: 'Giriş', tip: 'sayi', sag: true, bicim: (v) => (v == null ? '—' : v > 0 ? '+' + O.sayi(v) : '0'), hucreSinif: (v) => (v > 0 ? 'pozitif' : '') },
      { k: 'cikis', ad: 'Çıkış (asıl)', tip: 'sayi', sag: true, bicim: (v) => (v == null ? '—' : v > 0 ? '−' + O.sayi(v) : '0'), hucreSinif: (v) => (v > 0 ? 'negatif' : '') },
      { k: 'oran', ad: 'Turnover %', tip: 'sayi', sag: true, bicim: (v, r) => (v == null ? '—' : O.el('b', { class: 'tv-oran ' + (r.risk ? r.risk.sinif : ''), text: O.yuzde(v) })) },
      { k: 'istenen', ad: 'İstenen', tip: 'sayi', sag: true },
      { k: 'istenmeyen', ad: 'İstenmeyen', tip: 'sayi', sag: true },
      { k: 'riskMetin', ad: 'Değerlendirme', siralamaDegeri: (r) => r.oran, ilkYon: 'azalan',
        bicim: (v, r) => {
          if (r._toplam) return '';
          if (!r.risk) return O.el('span', { class: 'soluk', text: r.veriYok ? 'Veri yok' : '—' });
          return O.el('span', { class: 'cip ' + RISK_CIP[r.risk.sinif], html: O.ikon(RISK_IKON[r.risk.sinif]) + O.esc(r.riskMetin) });
        } }
    ],
    satirlar: M.satirlar,
    sayfaBoyu: 12,
    ara: false,
    altMetin: () => O.sayi(V.length) + ' dönem veri içeriyor' + (M.satirlar.length > V.length ? ' · ' + O.sayi(M.satirlar.length - V.length) + ' dönem henüz veri gelmedi' : ''),
    toplamSatir: { _toplam: true, adUzun: 'Toplam', donem: '', calisan: null, giris: topla('giris'), cikis: topla('cikis'), oran: null, istenen: topla('istenen'), istenmeyen: topla('istenmeyen'), riskMetin: '' },
    bos: { baslik: 'Aylık turnover verisi yok', metin: 'Bu haftanın paketinde aylık dönem bulunmuyor.' }
  });
}

function excelAktar(B, M) {
  const rows = [
    ['TURNOVER AYLIK ÖZET TABLOSU'],
    ['V.İ. hariç  ·  Kapsam: ' + (M.fa ? O.filtreMetni(B.filtre) + ' (yaklaşık hesap)' : 'Şirket geneli') + '  ·  ' + new Date().toLocaleDateString('tr-TR')],
    [],
    ['Dönem', 'Çalışan (V.İ. Hariç)', 'Giriş', 'Çıkış (Asıl)', 'Turnover %', 'İstenen', 'İstenmeyen', 'Değerlendirme']
  ];
  const cellClasses = {};
  M.satirlar.forEach((r, i) => {
    rows.push([r.donem, r.calisan ?? '', r.giris ?? '', r.cikis ?? '', r.oran ?? '', r.istenen ?? '', r.istenmeyen ?? '', r.veriYok ? 'Veri yok' : r.riskMetin]);
    if (r.risk) cellClasses[(4 + i) + '_4'] = r.risk.sinif === 'rr' ? 'bad' : r.risk.sinif === 'ry' ? 'warn' : 'good';
  });
  O.xlsIndir([{ name: 'Turnover Aylık', rows, rowClasses: { 0: 'title', 1: 'subtitle', 3: 'header' }, cellClasses, zebraStart: 4 }], 'IK_Turnover_Aylik_' + O.bugunDosya() + '.xlsx');
  O.bildirim('Aylık turnover tablosu indiriliyor.');
}

function notlarCiz(kok, B, M) {
  const e = B.etiket || {};
  O.notlar(kok, [
    'Kaynak: haftalık İK pano paketi' + (e.label ? ' (' + e.label + ')' : '') + '. YTD turnover, yıl sonu projeksiyonu, istenen/istenmeyen oranları, aylık ortalama çıkış ve 2025 kapanış değerleri paket özetinden gelir; pano yeniden hesaplamaz. Pakette olmayan değer “—” görünür.',
    'Departman filtresi seçiliyken oranlar yaklaşık hesaplanır: seçili kapsamdaki çıkış / seçili kapsamdaki aktif personel; yıl sonu projeksiyonu = YTD / ' + O.sayi(M.aySayisi) + ' × 12 (ay sayısı veriden). 2025 kapanışı şirket geneline aittir.',
    'Aylık ortalama oran, paketteki tüm dönemlerin aylık oran ortalamasıdır; veri gelmemiş aylar 0 sayılır (mevcut panoyla aynı kural).',
    'Değerlendirme eşikleri mevcut panodaki kuraldır: aylık oran %4 üstü “Yüksek risk”, %2,5 üstü “Dikkat”, diğerleri “Normal”. Grafiklerde eşik çizilmez.',
    'Kadranlar 0–100 % ölçeğindedir; aylık istenen/istenmeyen sayıları işten ayrılanlar listesindeki istenen bayrağından sayılır.'
  ]);
}

const STIL = `
.tablo td.tv-donem b { font-weight: 600; color: var(--metin-1); }
.tablo td.tv-donem small { display: block; font-size: 11px; color: var(--metin-3); font-variant-numeric: tabular-nums; margin-top: 1px; }
.tv-oran { font-weight: 600; font-variant-numeric: tabular-nums; }
.tv-oran.rr { color: var(--ht-700); } .tv-oran.ry { color: var(--uy-700); } .tv-oran.rg { color: var(--ok-700); }
`;
