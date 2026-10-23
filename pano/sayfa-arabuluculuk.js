/* ==========================================================================
   İK DASHBOARD 2.0 · ARABULUCULUK  (pano/sayfa-arabuluculuk.js)
   --------------------------------------------------------------------------
   Akış (BRIEF): (1) Özet — kaput + gösterge panosu (2) Trend (3) Kırılım (4) Liste.
   Firebase import ETMEZ; tüm veri B (bağlam) ile gelir. Sözleşme: pano/KABUK.md
   index.html renderARB / arbFilter / arbTbl ile AYNI kurallar:
   • Yapıldı / Yapılmadı = arabulucu alanı · yüzde round(x / toplam × 100) (toplam 0 → "—", B8)
   • Yapılmadı nedenleri = yalnız yapılmayan kayıtların not_ alanı (boş → DİĞER), çoktan aza — veriden DİNAMİK
   • "6 Ay Altı Kıdem" göstergesi = yapılmayanlar içinde not_ = 6 AY ALTI KIDEM (veriden sayılır)
   • Departman dağılımı = dept alanı (boş hariç), çoktan aza
   • Durum, bölüm ve arama yalnız LİSTEYİ süzer; göstergeler ve grafikler değişmez (bugünkü davranış)
   Düzeltmeler: bölüm seçimi kaydın BÖLÜM alanıyla (d.bolum = Servis/Satış/İdari) karşılaştırılır — eskiden
   departmanla kıyaslanıp hep 0 kayıt dönüyordu · global filtre kabukta doğru alanlarla (dept/bolum) uygulanır ·
   boş/eksik dizi koruması · Türkçe karakterli metin. Yeni: paketteki risk alanından "riskli kayıtlar" (eşik yok).
   Ortak kitaplıkta olmayan, bu modülde yazılan yardımcılar: yığılmış sütun değer etiketleri (icEtiket/toplamEtiket),
   listeyi Excel'e aktarma (excelAktar), liste üstü süzgeçler (durum/bölüm/risk).
   ========================================================================== */
import * as O from './ortak.js';

export const meta = { id: 'arb', baslik: 'Arabuluculuk', ikon: O.ikon('terazi') };

/* Yeniden çizimler arasında korunan liste süzgeçleri */
const durum = { dur: '', bolum: '', risk: '' };

export function ciz(kok, B) {
  kok.append(O.el('style', { 'data-sayfa-stil': 'arb', text: STIL }));
  const M = hesapla(B);
  ozetCiz(kok, B, M);
  if (!M.paketteVar) {
    const k = O.el('div', { class: 'kart' });
    kok.append(k);
    O.bosDurum(k, { ikon: 'terazi', baslik: 'Arabuluculuk verisi yok', metin: 'Bu haftanın paketinde arabuluculuk listesi bulunmuyor. Veri yüklendiğinde bu sayfa otomatik dolar.' });
    notlarCiz(kok, B);
    return;
  }
  trendCiz(kok, M);
  kirilimCiz(kok, M);
  listeCiz(kok, M);
  notlarCiz(kok, B);
}
export function temizle() { /* grafikleri kabuk temizler; bu sayfanın ek kaynağı yok */ }

/* ==========================================================================
   HESAP
   ========================================================================== */
const NOT_ETIKET = { '6 AY ALTI KIDEM': '6 ay altı kıdem', 'ASKERLİK SEBEBİYLE': 'Askerlik sebebiyle', 'HAKLI FESİH': 'Haklı fesih', 'İHTAR': 'İhtar', 'DİĞER': 'Diğer', 'YAPILDI': 'Yapıldı', 'YAPILMADI': 'Yapılmadı' };
const NOT_RENK = { '6 AY ALTI KIDEM': O.RENK.g2, 'ASKERLİK SEBEBİYLE': O.RENK.g5, 'HAKLI FESİH': O.RENK.g3, 'İHTAR': O.RENK.g6, 'DİĞER': O.RENK.diger };
const NOT_RENK_KOYU = { '6 AY ALTI KIDEM': O.RENK.gk2, 'ASKERLİK SEBEBİYLE': O.RENK.gk5, 'HAKLI FESİH': O.RENK.gk3, 'İHTAR': O.RENK.gk6, 'DİĞER': O.RENK.lac300 };
const YEDEK = [O.RENK.g4, O.RENK.g1, O.RENK.lac500, O.RENK.pir600], YEDEK_KOYU = [O.RENK.gk4, O.RENK.gk1, O.RENK.lac400, O.RENK.pir400];
/* Seri renkleri: durum renkleri (ok/ht) seri olarak kullanılmaz */
const R_YAP = O.RENK.g7, R_YAPM = O.RENK.g8, RK_YAP = O.RENK.gk7, RK_YAPM = O.RENK.gk8;

const norm = (v) => O.trBuyuk(String(v ?? '').trim());
const yapildi = (x) => norm(x.arabulucu) === 'YAPILDI';
const yapilmadi = (x) => norm(x.arabulucu) === 'YAPILMADI';
const notAnahtar = (x) => norm(x.not_) || 'DİĞER';
const notEtiketi = (k) => NOT_ETIKET[k] || O.trBaslik(k);
const riskliMi = (x) => O.aramaAnahtari(x.risk) === 'riskli';
const yuzdeTam = (x, t) => (t ? O.yuzde(Math.round(x / t * 100), 0) : '—');
/* Çıkış ayı: çıkış tarihinden; çözülemezse kaydın ay alanı */
function cikisAyi(x) { const d = O.tarihCoz(x.cikis); return d ? d.getMonth() + 1 : (+x.ay || 0); }
/* "0-2 AY" · "2-6 AY" · "1-2 YIL" → sıralama için ay karşılığı */
function kidemSira(s) {
  const k = O.katla(s), m = k.match(/(\d+)/);
  if (!m) return 9999;
  return +m[1] * (/yil/.test(k) && !/ay/.test(k.slice(0, k.indexOf('yil'))) ? 12 : 1);
}
const kidemEtiket = (s) => (O.bosMu(s) ? '—' : O.trKucuk(String(s).trim()).replace(/(\d)\s*-\s*(\d)/g, '$1–$2'));

function hesapla(B) {
  const D = B.D || {};
  const paketteVar = Array.isArray(D.arabuluculuk);
  const arb = ((B.filtreli && B.filtreli.arabuluculuk) || []).filter(Boolean);
  const tot = arb.length;
  const yap = arb.filter(yapildi).length, yapm = arb.filter(yapilmadi).length;
  const ynCnt = {};
  arb.forEach((x) => { if (yapilmadi(x)) { const k = notAnahtar(x); ynCnt[k] = (ynCnt[k] || 0) + 1; } });
  let yedek = 0;
  const nedenler = Object.keys(ynCnt).sort((a, b) => ynCnt[b] - ynCnt[a]).map((k) => {
    const i = NOT_RENK[k] ? -1 : yedek++;
    return { k, ad: notEtiketi(k), sayi: ynCnt[k], renk: NOT_RENK[k] || YEDEK[i % YEDEK.length], renkKoyu: NOT_RENK_KOYU[k] || YEDEK_KOYU[i % YEDEK_KOYU.length] };
  });
  const riskVar = arb.some((x) => !O.bosMu(x.risk));
  const riskli = arb.filter(riskliMi);
  /* aylık: çıkış ayına göre (veride görülen ilk aydan son aya, kesintisiz) */
  const aySet = arb.map(cikisAyi).filter((m) => m >= 1 && m <= 12);
  const aylar = [];
  if (aySet.length) for (let m = Math.min(...aySet); m <= Math.max(...aySet); m++) aylar.push(m);
  return {
    D, paketteVar, arb, tot, yap, yapm, ynCnt, nedenler, alti6: ynCnt['6 AY ALTI KIDEM'] || 0,
    riskVar, riskli, aylar, fa: !!B.filtreAktif, filtre: B.filtre
  };
}

/* ==========================================================================
   (1) ÖZET — kaput + gösterge panosu
   ========================================================================== */
const b = (v) => '<b>' + v + '</b>';
const anahtar = (renk) => '<i style="background:' + renk + '"></i>';

function ozetCumlesi(M) {
  const on = M.fa ? 'Seçili kapsamda (' + O.esc(O.filtreMetni(M.filtre)) + ') ' : '';
  if (!M.paketteVar) return 'Bu haftanın paketinde arabuluculuk listesi bulunmuyor.';
  if (!M.tot) return on + 'arabuluculuk kaydı yok.';
  let s = on + '2026 işten ayrılma kayıtlarında (' + O.sayi(M.tot) + ' kişi) arabuluculuk ' + b(O.sayi(M.yap)) + ' kayıtta yapıldı (' + yuzdeTam(M.yap, M.tot)
    + '), ' + b(O.sayi(M.yapm)) + ' kayıtta yapılmadı (' + yuzdeTam(M.yapm, M.tot) + ').';
  if (M.nedenler.length) s += ' Yapılmamasının en sık nedeni ' + b(O.esc(M.nedenler[0].ad.toLocaleLowerCase('tr'))) + ' (' + O.sayi(M.nedenler[0].sayi) + ' kayıt)';
  if (M.riskVar) s += (M.nedenler.length ? '; ' : ' ') + b(O.sayi(M.riskli.length)) + ' kayıt riskli olarak işaretli';
  if (M.nedenler.length || M.riskVar) s += '.';
  return s;
}

function ozetCiz(kok, B, M) {
  const e = B.etiket || {};
  const meta = [];
  if (e.short || e.label) meta.push({ ikon: 'takvim', html: 'Veri dönemi: ' + b(O.esc(e.short || e.label)) });
  if (M.aylar.length) meta.push({ ikon: 'kapi', html: 'Çıkış ayları: ' + b(O.ayAdi(M.aylar[0]) + (M.aylar.length > 1 ? '–' + O.ayAdi(M.aylar[M.aylar.length - 1]) : '')) });
  const durumParca = M.tot ? [
    { ad: 'Yapıldı', deger: M.yap, renk: RK_YAP, metin: O.sayi(M.yap) + ' kayıt' },
    { ad: 'Yapılmadı', deger: M.yapm, renk: RK_YAPM, metin: O.sayi(M.yapm) + ' kayıt' }
  ] : [];
  const nedenParca = M.nedenler.map((n) => ({ ad: n.ad, deger: n.sayi, renk: n.renkKoyu, metin: O.sayi(n.sayi) + ' kayıt' }));
  const ilk2 = M.nedenler.slice(0, 2).map((n) => anahtar(n.renkKoyu) + O.esc(n.ad) + ' ' + b(O.sayi(n.sayi))).join('<br>');
  O.kaput(kok, {
    B, bindirme: true,
    ustEtiket: 'İnsan Kaynakları · ' + (e.hafta || '2026'),
    baslik: 'Arabuluculuk',
    ozetHtml: ozetCumlesi(M),
    meta,
    kadranlar: [
      { etiket: 'Yapılma oranı', merkez: M.tot ? Math.round(M.yap / M.tot * 100) : null, onek: '%', parcalar: durumParca,
        alt: durumParca.length ? durumParca.map((p) => anahtar(p.renk) + p.ad + ' ' + b(O.sayi(p.deger))).join('<br>') : 'kayıt yok' },
      { etiket: 'Yapılmadı', merkez: M.tot ? M.yapm : null, parcalar: nedenParca,
        alt: ilk2 ? ilk2 + (M.nedenler.length > 2 ? '<br>+' + O.sayi(M.nedenler.length - 2) + ' neden daha' : '') : 'yapılmayan kayıt yok' },
      { etiket: 'Riskli kayıt', deger: M.riskVar ? M.riskli.length : null, max: M.tot || 1, merkez: M.riskVar ? M.riskli.length : null,
        alt: M.riskVar ? b(yuzdeTam(M.riskli.length, M.tot)) + ' toplam kaydın<br>paketteki risk alanından' : 'pakette risk alanı yok' }
    ]
  });
  O.kpiPanel(kok, [{
    grup: { baslik: 'Kayıtlar', alt: '2026 · işten ayrılma arabuluculuk' + (M.fa ? ' · seçili kapsam' : ''), ikon: 'terazi' },
    ogeler: [
      { anahtar: 'arb-toplam', etiket: 'Toplam kayıt', deger: M.tot, alt: 'toplam çalışan' },
      { anahtar: 'arb-yapildi', etiket: 'Arabuluculuk yapıldı', deger: M.yap, alt: M.tot ? yuzdeTam(M.yap, M.tot) + ' oran' : 'kayıt yok' },
      { anahtar: 'arb-yapilmadi', etiket: 'Yapılmadı', deger: M.yapm, alt: M.tot ? yuzdeTam(M.yapm, M.tot) + ' oran' : 'kayıt yok' },
      { anahtar: 'arb-6ay', etiket: '6 ay altı kıdem', deger: M.alti6, alt: 'yapılmadı nedeni', ipucu: 'Yapılmayan kayıtlarda not alanı “6 AY ALTI KIDEM” olanlar' },
      { anahtar: 'arb-riskli', etiket: 'Riskli kayıt', deger: M.riskVar ? M.riskli.length : null, alt: M.riskVar ? yuzdeTam(M.riskli.length, M.tot) + ' toplam kaydın' : 'pakette risk alanı yok', ipucu: 'Paketteki risk alanı “Riskli” olan kayıtlar' }
    ]
  }], { sinif: 'bindir' });
}

/* ==========================================================================
   GRAFİK YARDIMCILARI
   ========================================================================== */
function sutun(label, data, renk, ek) {
  return Object.assign({ label, data, backgroundColor: renk, hoverBackgroundColor: renk, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22, categoryPercentage: 0.66, barPercentage: 0.9 }, ek || {});
}
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
function toplamEtiket(toplamlar) {
  return {
    display: (ctx) => (toplamlar[ctx.dataIndex] || 0) > 0,
    anchor: 'end', align: 'end', offset: 3, clamp: true, color: O.RENK.n800, font: { family: 'Inter', size: 10.5, weight: '700' },
    formatter: (v, ctx) => O.sayi(toplamlar[ctx.dataIndex])
  };
}
function bosGrafik(g, baslik, metin) { g.kap.textContent = ''; O.bosDurum(g.kap, { ikon: 'terazi', baslik, metin: metin || '', kucuk: true }); }

/* ==========================================================================
   (2) TREND — çıkış ayına göre yapıldı / yapılmadı · aylık yapılma oranı
   ========================================================================== */
function trendCiz(kok, M) {
  const donem = M.aylar.length ? O.ayAdi(M.aylar[0]) + (M.aylar.length > 1 ? '–' + O.ayAdi(M.aylar[M.aylar.length - 1]) : '') + ' 2026' : '2026';
  O.akisBaslik(kok, { no: '02', baslik: 'Trend', aciklama: 'Çıkış ayına göre arabuluculuk durumu · ' + donem + (M.fa ? ' · seçili kapsam' : '') });
  const iz = O.izgara(kok);
  const ay = M.aylar;
  const yap = ay.map((m) => M.arb.filter((x) => cikisAyi(x) === m && yapildi(x)).length);
  const yapm = ay.map((m) => M.arb.filter((x) => cikisAyi(x) === m && yapilmadi(x)).length);
  const top = ay.map((m) => M.arb.filter((x) => cikisAyi(x) === m).length);
  const oran = ay.map((m, i) => (top[i] ? Math.round(yap[i] / top[i] * 100) : null));

  const g1 = O.grafikKarti(iz, {
    baslik: 'Aylık arabuluculuk durumu', aciklama: 'Kayıt sayısı · çıkış ayına göre · dilim içinde durum, üstte ay toplamı', sinif: 's7', yukseklik: 290,
    lejant: [{ ad: 'Yapıldı', renk: R_YAP }, { ad: 'Yapılmadı', renk: R_YAPM }],
    etiket: 'Aylık arabuluculuk durumu yığılmış sütun grafiği',
    tablo: () => ({ sutunlar: [{ ad: 'Ay' }, { ad: 'Yapıldı', sag: true }, { ad: 'Yapılmadı', sag: true }, { ad: 'Toplam', sag: true }, { ad: 'Yapılma oranı', sag: true }],
      satirlar: ay.map((m, i) => [O.ayAdi(m), O.sayi(yap[i]), O.sayi(yapm[i]), O.sayi(top[i]), oran[i] == null ? '—' : O.yuzde(oran[i], 0)]) })
  });
  if (!ay.length) bosGrafik(g1, 'Aylık kayıt yok', 'Kayıtlarda çıkış tarihi bulunamadı.');
  else {
    O.grafik(g1.canvas, {
      type: 'bar',
      data: { labels: ay.map(O.ayKisa), datasets: [
        sutun('Yapıldı', yap, R_YAP, { categoryPercentage: 0.7, barPercentage: 0.92, borderRadius: 0, borderSkipped: false, datalabels: icEtiket(16) }),
        sutun('Yapılmadı', yapm, R_YAPM, { categoryPercentage: 0.7, barPercentage: 0.92, borderRadius: 0, borderSkipped: false, datalabels: { labels: { ic: icEtiket(16), toplam: toplamEtiket(top) } } })
      ] },
      options: {
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 6 } },
        scales: { x: O.eksenX({ stacked: true }), y: O.eksenY({ stacked: true, grace: '16%' }) },
        plugins: { tooltip: { callbacks: {
          title: (it) => O.ayAdi(ay[it[0].dataIndex]) + ' 2026',
          label: (c) => ' ' + c.dataset.label + ': ' + O.sayi(c.parsed.y) + ' kayıt',
          footer: (it) => { const i = it[0].dataIndex; return 'Toplam: ' + O.sayi(top[i]) + (oran[i] == null ? '' : ' · yapılma oranı ' + O.yuzde(oran[i], 0)); }
        } } }
      }
    });
  }

  const g2 = O.grafikKarti(iz, {
    baslik: 'Yapılma oranı', aciklama: 'Aylık % · o ay çıkan kayıtlar içinde arabuluculuk yapılanların payı', sinif: 's5', yukseklik: 290,
    etiket: 'Aylık arabuluculuk yapılma oranı çizgi grafiği',
    tablo: () => ({ sutunlar: [{ ad: 'Ay' }, { ad: 'Yapılma oranı', sag: true }, { ad: 'Yapıldı / toplam', sag: true }],
      satirlar: ay.map((m, i) => [O.ayAdi(m), oran[i] == null ? '—' : O.yuzde(oran[i], 0), O.sayi(yap[i]) + ' / ' + O.sayi(top[i])]) })
  });
  if (!oran.some((v) => v != null)) bosGrafik(g2, 'Oran hesaplanacak kayıt yok');
  else {
    O.grafik(g2.canvas, {
      type: 'line',
      data: { labels: ay.map(O.ayKisa), datasets: [{
        label: 'Yapılma oranı', data: oran, borderColor: R_YAP, backgroundColor: O.renkSaydam(R_YAP, 0.1), fill: 'origin',
        pointBackgroundColor: R_YAP, spanGaps: false, datalabels: O.etiket.nokta({ onek: '%', minPx: 30 })
      }] },
      options: {
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 12, right: 10 } },
        scales: { x: O.eksenX(), y: O.eksenY({ max: 100, ticks: { stepSize: 25, callback: (v) => '%' + O.sayi(v) } }) },
        plugins: { tooltip: { displayColors: false, callbacks: {
          title: (it) => O.ayAdi(ay[it[0].dataIndex]) + ' 2026',
          label: (c) => ' Yapılma oranı: ' + O.yuzde(c.parsed.y, 0),
          footer: (it) => { const i = it[0].dataIndex; return O.sayi(yap[i]) + ' / ' + O.sayi(top[i]) + ' kayıt'; }
        } } }
      }
    });
    O.kartNot(g2.govde, 'Aylık kayıt sayısı küçük olduğunda oran sert değişebilir; sayılar ipucu ve tablo görünümünde.');
  }
}

/* ==========================================================================
   (3) KIRILIM — durum + yapılmadı nedenleri · riskli kayıtlar · bölüm · departman · kıdem
   ========================================================================== */
function kirilimCiz(kok, M) {
  O.akisBaslik(kok, { no: '03', baslik: 'Kırılım', aciklama: 'Yapılmama nedenleri, riskli kayıtlar, bölüm, departman ve kıdem' + (M.fa ? ' · seçili kapsam' : '') });
  const iz1 = O.izgara(kok);
  nedenKarti(iz1, M);
  riskliKarti(iz1, M);
  const iz2 = O.izgara(kok);
  ikiliKart(iz2, M, { baslik: 'Bölüme göre', aciklama: 'Servis · Satış · İdari — yapıldı ve yapılmadı', anahtarFn: (x) => x.bolum, sabit: O.BOLUMLER, adGenislik: '64px' });
  departmanKarti(iz2, M);
  ikiliKart(iz2, M, { baslik: 'Kıdem aralığına göre', aciklama: 'Kayıttaki kıdem aralığı — yapıldı ve yapılmadı', anahtarFn: (x) => (O.bosMu(x.sure) ? null : kidemEtiket(x.sure)), sira: (a) => kidemSira(a), adGenislik: '76px' });
}

/* Durum şeridi + Yapılmadı nedenleri (index: arb-durum donut + arb-detail "YAPILMADI NEDENLERİ" — not_ alanından dinamik) */
function nedenKarti(iz, M) {
  const { govde } = O.kart(iz, { baslik: 'Durum ve yapılmama nedenleri', aciklama: 'Yapıldı / yapılmadı dağılımı ve yapılmayan kayıtların not alanındaki nedenler', sinif: 's7' });
  if (!M.tot) { O.bosDurum(govde, { ikon: 'terazi', baslik: 'Kayıt yok', metin: 'Seçili kapsamda arabuluculuk kaydı bulunmuyor.', kucuk: true }); return; }
  O.dagilimSeridi(govde, [{ ad: 'Yapıldı', deger: M.yap, renk: R_YAP }, { ad: 'Yapılmadı', deger: M.yapm, renk: R_YAPM }], { bicim: (v) => O.sayi(v) + ' kayıt' });
  O.lejant(govde, [
    { ad: 'Yapıldı · ' + O.sayi(M.yap) + ' kayıt (' + yuzdeTam(M.yap, M.tot) + ')', renk: R_YAP },
    { ad: 'Yapılmadı · ' + O.sayi(M.yapm) + ' kayıt (' + yuzdeTam(M.yapm, M.tot) + ')', renk: R_YAPM }
  ]);
  govde.append(O.el('div', { class: 'arb-alt-baslik', text: 'Yapılmadı nedenleri' }));
  if (!M.nedenler.length) { O.bosDurum(govde, { ikon: 'onay', baslik: 'Yapılmayan kayıt yok', kucuk: true }); return; }
  const liste = O.el('div', { class: 'dagilim-liste', role: 'list' });
  M.nedenler.forEach((n) => {
    const isaret = O.el('i', { class: 'anahtar' });
    isaret.style.background = n.renk;
    liste.append(O.el('div', { class: 'dagilim-satir', role: 'listitem', 'data-neden': n.k, 'data-adet': String(n.sayi) }, isaret,
      O.el('span', { class: 'ad' }, O.el('span', { text: n.ad })),
      O.el('span', { class: 'adet', text: O.sayi(n.sayi) + ' kayıt' }), O.el('span', { class: 'pay', text: yuzdeTam(n.sayi, M.yapm) })));
  });
  govde.append(liste);
  govde.append(O.el('div', { class: 'kart-alt-cubuk', html: '<span>Yapılmadı: ' + b(O.sayi(M.yapm)) + ' kayıt · nedenler not alanından</span><span>Pay: yapılmayanlar içinde</span>' }));
}

/* Riskli kayıtlar — paketteki risk alanı "Riskli" olanlar (eşik hesaplanmaz) */
function riskliKarti(iz, M) {
  const { govde } = O.kart(iz, { baslik: 'Riskli kayıtlar', aciklama: 'Paketteki risk alanı “Riskli” olan kayıtlar', sinif: 's5' });
  if (!M.riskVar) { O.bosDurum(govde, { ikon: 'bilgi', baslik: 'Pakette risk alanı yok', metin: 'Bu haftanın arabuluculuk listesinde risk bilgisi bulunmuyor.', kucuk: true }); return; }
  if (!M.riskli.length) { O.bosDurum(govde, { ikon: 'onay', baslik: 'Riskli kayıt yok', metin: 'Seçili kapsamda risk alanı “Riskli” olan kayıt bulunmuyor.', kucuk: true }); return; }
  O.tablo(govde, {
    sutunlar: [
      { k: 'ad', ad: 'Ad Soyad', sinif: 'ad-hucre' },
      { k: 'dept', ad: 'Departman' },
      { k: 'arabulucu', ad: 'Durum', bicim: (v, r) => durumCipi(r) },
      { k: 'not_', ad: 'Not', bicim: (v, r) => notCipi(r) },
      { k: 'cikis', ad: 'Çıkış', tip: 'tarih' }
    ],
    satirlar: M.riskli,
    sayfaBoyu: 6,
    ara: false,
    altMetin: (n) => O.sayi(n) + ' riskli kayıt · toplam kaydın ' + yuzdeTam(n, M.tot)
  });
}

/* Bölüm / kıdem aralığı: satır başına yapıldı + yapılmadı çubukları */
function ikiliKart(iz, M, o) {
  const { govde } = O.kart(iz, { baslik: o.baslik, aciklama: o.aciklama, sinif: 's4' });
  const harita = new Map();
  (o.sabit || []).forEach((k) => harita.set(k, { ad: k, yap: 0, yapm: 0 }));
  M.arb.forEach((x) => {
    const k = o.anahtarFn(x);
    if (o.sabit && o.sabit.indexOf(k) < 0) return; /* bölümde yalnız üç değer sayılır (index.html ile aynı) */
    if (O.bosMu(k)) return;
    if (!harita.has(k)) harita.set(k, { ad: k, yap: 0, yapm: 0 });
    if (yapildi(x)) harita.get(k).yap++; else if (yapilmadi(x)) harita.get(k).yapm++;
  });
  let satirlar = [...harita.values()];
  if (o.sira) satirlar.sort((a, c) => o.sira(a.ad) - o.sira(c.ad) || O.trKarsilastir(a.ad, c.ad));
  if (!o.sabit) satirlar = satirlar.filter((s) => s.yap + s.yapm > 0);
  O.lejant(govde, [{ ad: 'Yapıldı', renk: R_YAP }, { ad: 'Yapılmadı', renk: R_YAPM }]);
  O.cubukListe(govde, satirlar, {
    seriler: [{ k: 'yap', ad: 'yapıldı', renk: R_YAP }, { k: 'yapm', ad: 'yapılmadı', renk: R_YAPM }],
    bicim: (v, s, se) => O.sayi(v) + ' ' + se.ad, adGenislik: o.adGenislik, bos: 'Kayıt yok'
  });
}

/* Departman dağılımı (index: arb-detail "DEPARTMAN DAĞILIMI" — dept alanı, boş hariç, çoktan aza) */
function departmanKarti(iz, M) {
  const say = O.grupSay(M.arb.filter((x) => x.dept), 'dept');
  const { govde } = O.kart(iz, { baslik: 'Departman dağılımı', aciklama: 'Kayıt sayısı · ' + O.sayi(say.length) + ' departman · üzerine gelince durum', sinif: 's4' });
  O.cubukListe(govde, say.map(([k, v]) => {
    const y = M.arb.filter((x) => x.dept === k && yapildi(x)).length;
    const ym = M.arb.filter((x) => x.dept === k && yapilmadi(x)).length;
    return { ad: k, deger: v, ipucu: k + ' · yapıldı ' + y + ' · yapılmadı ' + ym };
  }), { kaydir: 300, adGenislik: '48%', renk: O.RENK.lac500, bos: 'Departman bilgisi yok' });
}

/* ==========================================================================
   (4) LİSTE — durum/bölüm/risk süzgeçleri yalnız tabloyu süzer (index: arbFilter) + Excel
   ========================================================================== */
function durumCipi(r) {
  const y = yapildi(r);
  return O.el('span', { class: 'cip ' + (y ? 'cip-ok' : 'cip-ht'), text: O.bosMu(r.arabulucu) ? '—' : O.trBaslik(r.arabulucu) });
}
function notCipi(r) {
  const k = notAnahtar(r);
  const sinif = k === 'YAPILDI' ? 'cip-ok' : k === 'YAPILMADI' ? 'cip-ht' : k === '6 AY ALTI KIDEM' ? 'cip-uy' : 'cip-bilgi';
  return O.el('span', { class: 'cip ' + sinif, text: O.bosMu(r.not_) ? '—' : notEtiketi(k) });
}

function listeCiz(kok, M) {
  O.akisBaslik(kok, { no: '04', baslik: 'Liste', aciklama: 'Arabuluculuk detay listesi · süzgeçler yalnız listeyi etkiler' });
  if (!M.riskVar) durum.risk = '';
  const dugme = O.el('button', { class: 'btn', type: 'button', title: 'Görünen listeyi Excel dosyası olarak indir', html: O.ikon('excel') + '<span>Excel’e aktar</span>' });
  const { govde } = O.kart(kok, { baslik: 'Arabuluculuk detay listesi', aciklama: 'Başlığa tıklayarak sıralayın · çıkış nedeninin tamamı üzerine gelince görünür', sinif: 'kart-liste', sag: dugme });
  const arac = O.el('div', { class: 'arb-arac' });
  const suz = () => M.arb.filter((d) => {
    if (durum.dur === 'YAPILDI' && !yapildi(d)) return false;
    if (durum.dur === 'YAPILMADI' && !yapilmadi(d)) return false;
    /* DÜZELTME: seçenekler BÖLÜM (Servis/Satış/İdari) → kaydın bölüm alanıyla karşılaştırılır */
    if (durum.bolum && O.trKucuk(d.bolum) !== O.trKucuk(durum.bolum)) return false;
    if (durum.risk === 'riskli' && !riskliMi(d)) return false;
    return true;
  });
  let api = null;
  const yenile = () => { if (api) api.guncelle(suz()); };
  O.bolumlu(arac, { secenekler: [{ v: '', ad: 'Tümü' }, { v: 'YAPILDI', ad: 'Yapıldı' }, { v: 'YAPILMADI', ad: 'Yapılmadı' }], deger: durum.dur, kucuk: true, etiket: 'Durum', degisince: (v) => { durum.dur = v; yenile(); } });
  const bs = O.secim(arac, { secenekler: [{ v: '', ad: 'Tüm bölümler' }].concat(O.BOLUMLER.map((x) => ({ v: x, ad: x }))), deger: durum.bolum, degisince: (v) => { durum.bolum = v; yenile(); } });
  bs.setAttribute('aria-label', 'Bölüm');
  if (M.riskVar) O.bolumlu(arac, { secenekler: [{ v: '', ad: 'Tüm kayıtlar' }, { v: 'riskli', ad: 'Yalnız riskli' }], deger: durum.risk, kucuk: true, etiket: 'Risk', degisince: (v) => { durum.risk = v; yenile(); } });
  const sutunlar = [
    { k: 'ad', ad: 'Ad Soyad', sinif: 'ad-hucre' },
    { k: 'dept', ad: 'Departman' },
    { k: 'bolum', ad: 'Bölüm' },
    { k: 'unvan', ad: 'Unvan', bicim: (v) => (v ? O.el('span', { class: 'arb-kirp', title: v, text: v }) : '—') },
    { k: 'giris', ad: 'İşe giriş', tip: 'tarih' },
    { k: 'cikis', ad: 'İşten çıkış', tip: 'tarih' },
    { k: 'sure', ad: 'Kıdem', siralamaDegeri: (r) => kidemSira(r.sure), bicim: (v) => String(v ?? '').split('/')[0].trim() || '—' },
    { k: 'neden', ad: 'Çıkış nedeni', bicim: (v) => (v ? O.el('span', { class: 'arb-kirp arb-neden', title: v, text: v }) : '—') },
    { k: 'arabulucu', ad: 'Durum', bicim: (v, r) => durumCipi(r) },
    { k: 'not_', ad: 'Not', bicim: (v, r) => notCipi(r) }
  ];
  if (M.riskVar) sutunlar.push({ k: 'risk', ad: 'Risk', siralamaDegeri: (r) => (riskliMi(r) ? 1 : 0), ilkYon: 'azalan', bicim: (v, r) => (riskliMi(r) ? O.el('span', { class: 'cip cip-ht', html: O.ikon('uyari') + 'Riskli' }) : O.el('span', { class: 'soluk', text: O.bosMu(v) ? '—' : O.trBaslik(v) })) });
  const araAlanlari = ['ad', 'dept', 'unvan', 'neden'];
  api = O.tablo(govde, {
    sutunlar,
    satirlar: suz(),
    sayfaBoyu: 12,
    siraNo: true,
    araYer: 'Ad, departman, unvan ara…',
    araAlanlari,
    aracEk: arac,
    altMetin: (n, t) => (n === M.tot ? O.sayi(n) + ' kayıt' : O.sayi(n) + ' / ' + O.sayi(M.tot) + ' kayıt') + (M.fa ? ' · seçili kapsam' : ''),
    bos: { baslik: 'Kayıt bulunamadı', metin: 'Durum, bölüm ya da arama süzgecini değiştirin.' }
  });
  dugme.disabled = !M.tot;
  dugme.addEventListener('click', () => {
    const q = O.aramaAnahtari(api.durum.q || '');
    const satirlar = suz().filter((r) => !q || araAlanlari.some((k) => O.aramaAnahtari(r[k]).includes(q)));
    excelAktar(M, satirlar);
  });
}

function excelAktar(M, satirlar) {
  const sec = [durum.dur ? notEtiketi(durum.dur) : '', durum.bolum, durum.risk ? 'Yalnız riskli' : ''].filter(Boolean);
  const kapsam = [M.fa ? O.filtreMetni(M.filtre) : ''].concat(sec).filter(Boolean).join(' · ') || 'Tüm kayıtlar';
  const bas = ['Ad Soyad', 'Departman', 'Bölüm', 'Unvan', 'İşe Giriş', 'İşten Çıkış', 'Kıdem', 'Çıkış Nedeni', 'Durum', 'Not'].concat(M.riskVar ? ['Risk'] : []);
  const rows = [['ARABULUCULUK DETAY LİSTESİ'], ['Toplam: ' + satirlar.length + ' kayıt  ·  Kapsam: ' + kapsam + '  ·  ' + new Date().toLocaleDateString('tr-TR')], [], bas];
  satirlar.forEach((r) => rows.push([r.ad, r.dept, r.bolum, r.unvan, r.giris, r.cikis, r.sure, r.neden, r.arabulucu, r.not_].concat(M.riskVar ? [r.risk || ''] : [])));
  O.xlsIndir([{ name: 'Arabuluculuk', rows, rowClasses: { 0: 'title', 1: 'subtitle', 3: 'header' }, zebraStart: 4 }], 'IK_Arabuluculuk_' + O.bugunDosya() + '.xlsx');
  O.bildirim('Arabuluculuk listesi indiriliyor (' + O.sayi(satirlar.length) + ' kayıt).');
}

function notlarCiz(kok, B) {
  const e = B.etiket || {};
  O.notlar(kok, [
    'Kaynak: haftalık İK pano paketi' + (e.label ? ' (' + e.label + ')' : '') + ', arabuluculuk listesi. Departman filtresi kaydın departman ve bölüm alanlarıyla uygulanır.',
    'Durum, bölüm, risk ve arama süzgeçleri yalnız listeyi süzer; göstergeler ve grafikler seçili departman kapsamının tamamını gösterir (mevcut panoyla aynı).',
    'Bölüm seçimi kaydın bölüm alanıyla (Servis / Satış / İdari) karşılaştırılır.',
    'Yapılmadı nedenleri, yapılmayan kayıtların not alanından okunur; not boşsa “Diğer” sayılır. “6 ay altı kıdem” göstergesi yalnız yapılmayan kayıtlarda sayılır.',
    'Riskli kayıt, paketteki risk alanı “Riskli” olan kayıttır; pano risk eşiği hesaplamaz. Yüzdeler toplam kayda göre, tam sayıya yuvarlanır.'
  ]);
}

const STIL = `
.arb-alt-baslik { font-size: var(--fs-2xs); font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--metin-3); margin-top: 4px; }
.arb-arac { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.arb-arac .alan { min-width: 150px; }
.arb-kirp { display: inline-block; max-width: 170px; overflow: hidden; text-overflow: ellipsis; vertical-align: bottom; }
.arb-neden { max-width: 200px; color: var(--metin-2); }
@media (max-width: 760px) { .arb-arac { width: 100%; } .arb-arac .alan { flex: 1 1 100%; } }
`;
