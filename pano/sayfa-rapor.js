/* ==========================================================================
   İK DASHBOARD 2.0 · RAPOR OLUŞTUR  (pano/sayfa-rapor.js)
   --------------------------------------------------------------------------
   Sürükle-bırak alan bazlı rapor oluşturucu — index.html (RP_FIELDS, rpLib, rpAddField, rpDrop,
   rpRenderDrop, rpBuild, rpClear, rpExportCSV) işlevleriyle BİREBİR; görünüm yeni dilde.
   Akış (sayfanın doğasına göre): (1) Özet — kaput + kaynak seçimi (2) Alanlar — kütüphane ve rapor alanı
   (3) Önizleme — en fazla 300 satır; CSV filtrelenmiş TÜM satırları içerir (";" ayraçlı, BOM'lu, tırnaklı).
   Global departman filtresi bu sayfayı etkilemez (index.html ile aynı); süzgeç rapor alanındaki Departman/Bölüm seçimidir.
   Firebase import ETMEZ. Sözleşme: pano/KABUK.md
   index.html'den bilinçli fark: seçilen alanlar kaynak başına tutulur (eskiden kaynak değişince başka kaynağın
   alanları rapor alanında kalıyor ve aynı anahtarlı alan diğer kaynakta eklenemiyordu).
   ========================================================================== */
import * as O from './ortak.js';

export const meta = { id: 'rp', baslik: 'Rapor Oluştur', ikon: O.ikon('rapor') };

/* Alan tanımları — index.html RP_FIELDS ile birebir */
const RP_FIELDS = {
  normal: { label: 'Aktif Çalışanlar', groups: [
    { g: 'Kimlik', fields: [{ k: 'ad', l: 'Ad Soyad' }] },
    { g: 'Organizasyon', fields: [{ k: 'dept', l: 'Departman' }, { k: 'bolum', l: 'Bölüm' }, { k: 'unvan', l: 'Unvan' }] },
    { g: 'Çalışma Bilgisi', fields: [{ k: 'cs', l: 'Çalışma Şekli' }] }
  ] },
  ayrilanlar: { label: 'İşten Ayrılanlar', groups: [
    { g: 'Kimlik', fields: [{ k: 'ad', l: 'Ad Soyad' }] },
    { g: 'Organizasyon', fields: [{ k: 'dept', l: 'Departman' }, { k: 'bolum', l: 'Bölüm' }, { k: 'unvan', l: 'Unvan' }] },
    { g: 'Ayrılış Bilgisi', fields: [{ k: 'tarih', l: 'Ayrılış Tarihi' }, { k: 'neden', l: 'Ayrılma Nedeni (Kısa)' }, { k: 'neden_raw', l: 'Ayrılma Nedeni (Detay)' }, { k: 'sure', l: 'Kıdem (Süre)' }, { k: 'ay', l: 'Ayrılış Ayı (No)' }] }
  ] },
  isealim: { label: 'İşe Alım', groups: [
    { g: 'Kimlik', fields: [{ k: 'ad', l: 'Ad Soyad' }] },
    { g: 'Organizasyon', fields: [{ k: 'dept', l: 'Departman' }, { k: 'bolum', l: 'Bölüm' }, { k: 'unvan', l: 'Unvan' }] },
    { g: 'İşe Giriş Bilgisi', fields: [{ k: 'tarih', l: 'İşe Başlama Tarihi' }, { k: 'ay', l: 'Giriş Ayı (No)' }] }
  ] },
  izin: { label: 'İzin & Bakiye', groups: [
    { g: 'Kimlik', fields: [{ k: 'ad', l: 'Ad Soyad' }] },
    { g: 'Organizasyon', fields: [{ k: 'dept', l: 'Departman' }, { k: 'bolum', l: 'Bölüm' }] },
    { g: 'İzin Bilgisi', fields: [{ k: 'bakiye', l: 'Güncel Bakiye (gün)' }, { k: 'kullanilan', l: 'Toplam Kullanılan (gün)' }] }
  ] }
};
const KAYNAKLAR = ['normal', 'ayrilanlar', 'isealim', 'izin'];
const KAYNAK_IKON = { normal: 'kisiler', ayrilanlar: 'kapi', isealim: 'alim', izin: 'izin' };
const SINIR = 300;   /* önizleme satır sınırı (index.html ile aynı) */
const ARTI = '<svg class="ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 5.5v13M5.5 12h13"/></svg>';

/* Yeniden çizimler (global filtre değişimi) arasında korunan seçimler */
const durum = { kaynak: 'normal', alanlar: { normal: [], ayrilanlar: [], isealim: [], izin: [] }, dept: '', bolum: '' };
let G = null;   /* bu çizimin DOM başvuruları */

export function ciz(kok, B) {
  stilEkle(kok);
  if (!RP_FIELDS[durum.kaynak]) durum.kaynak = 'normal';
  const D = B.D || {};
  G = { B, D, kok };
  ozetCiz(kok, B, D);
  alanlarCiz(kok, D);
  onizlemeKartiCiz(kok);
  O.notlar(kok, [
    'Kaynak: haftalık İK pano paketi' + (B.etiket && B.etiket.label ? ' (' + B.etiket.label + ')' : '') + '. Rapor, paketteki listelerin süzülmemiş hâlinden oluşturulur.',
    'Global departman filtresi bu sayfayı etkilemez; departman ve bölüm seçimini rapor alanındaki süzgeçlerden yapın.',
    'CSV dosyası noktalı virgül (;) ayraçlı ve UTF-8 (BOM) kodludur; Excel’de doğrudan açılır. Dosya adı rapor_<kaynak>.csv biçimindedir.',
    'Önizleme ilk ' + SINIR + ' satırı gösterir; CSV süzülmüş tüm satırları içerir. Değerler paketteki hâliyle yazılır, boş değer önizlemede “—” görünür.'
  ]);
  tumunuGuncelle();
}
export function temizle() { G = null; }

const b = (v) => '<b>' + v + '</b>';
const bildir = (m) => { if (G && G.B && typeof G.B.bildir === 'function') G.B.bildir(m); else O.bildirim(m); };
const alanSayisi = (src) => RP_FIELDS[src].groups.reduce((s, g) => s + g.fields.length, 0);

function stilEkle(kok) {
  kok.append(O.el('style', { text:
    '.rp-kaynaklar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}'
    + '.rp-kaynak{appearance:none;-webkit-appearance:none;border:0;font:inherit;text-align:left;cursor:pointer;width:100%;color:inherit;position:relative}'
    + '.rp-kaynak:focus-visible{outline:2px solid var(--pir-500);outline-offset:2px}'
    + '.rp-kaynak[aria-pressed="true"]{box-shadow:0 0 0 2px var(--pir-500),var(--gol-2)}'
    + '.rp-kaynak .kpi-deger small{margin-left:4px}'
    + '.rp-kaynak .rp-durum{margin-left:auto}'
    + '.rp-grup{margin-bottom:14px}.rp-grup:last-child{margin-bottom:0}'
    + '.rp-grup-baslik{font-size:var(--fs-2xs);font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--metin-3);margin-bottom:8px}'
    + '.rp-haplar{display:flex;flex-wrap:wrap;gap:8px}'
    + '.rp-hap{appearance:none;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px 0 9px;border-radius:999px;border:1px solid var(--cizgi-2);'
    + 'background:var(--yuzey-kart);color:var(--metin-1);font:inherit;font-size:12.5px;font-weight:500;cursor:grab;transition:border-color .15s,box-shadow .15s,background .15s}'
    + '.rp-hap:hover{border-color:var(--pir-400);box-shadow:var(--gol-1)}'
    + '.rp-hap:active{cursor:grabbing}'
    + '.rp-hap:focus-visible{outline:2px solid var(--pir-500);outline-offset:2px}'
    + '.rp-hap .ikon{width:14px;height:14px;color:var(--pir-600)}'
    + '.rp-hap[aria-pressed="true"]{background:var(--lac-50);border-color:var(--lac-200);color:var(--lac-700);cursor:default}'
    + '.rp-hap[aria-pressed="true"] .ikon{color:var(--lac-600)}'
    + '.rp-birak{min-height:128px;border:2px dashed var(--cizgi-3);border-radius:12px;padding:12px;display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start;'
    + 'background:var(--n-25,#fafbfc);transition:border-color .15s,background .15s}'
    + '.rp-birak.uzerinde{border-color:var(--pir-500);background:var(--pir-50,#fbf7ee)}'
    + '.rp-bos{width:100%;align-self:center;text-align:center;color:var(--metin-3);font-size:12.5px;padding:28px 8px}'
    + '.rp-secili{display:inline-flex;align-items:center;gap:4px;height:32px;padding:0 4px 0 12px;border-radius:999px;background:var(--lac-800);color:#fff;font-size:12.5px;font-weight:500}'
    + '.rp-secili button{appearance:none;border:0;background:transparent;color:var(--lac-200);width:24px;height:24px;border-radius:999px;display:grid;place-items:center;cursor:pointer;padding:0}'
    + '.rp-secili button:hover{background:rgba(255,255,255,.12);color:#fff}'
    + '.rp-secili button .ikon{width:13px;height:13px}'
    + '.rp-secili .rp-no{font-size:10.5px;color:var(--lac-200);font-variant-numeric:tabular-nums}'
    + '.rp-denetim{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}'
    + '.rp-dugmeler{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}'
    + '.rp-dugmeler .btn .ikon{width:15px;height:15px}'
    + '.rp-sayac{font-size:12.5px;font-weight:600;color:var(--metin-2);white-space:nowrap}'
    + '.rp-onizleme .tablo-kap{max-height:620px}'
    + '@media (max-width:1180px){.rp-kaynaklar{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    + '@media (max-width:760px){.rp-kaynaklar{gap:10px}.rp-denetim{grid-template-columns:minmax(0,1fr)}.rp-dugmeler .btn{flex:1 1 auto;justify-content:center}}'
    + '@media print{.rp-kaynaklar,.rp-kutuphane-kart,.rp-dugmeler,.rp-denetim{display:none!important}.rp-onizleme .tablo-kap{max-height:none;overflow:visible}}' }));
}

/* ==========================================================================
   (1) ÖZET — kaput + kaynak seçimi (index: rp-kaynak)
   ========================================================================== */
function ozetCiz(kok, B, D) {
  const e = B.etiket || {};
  const toplamAlan = KAYNAKLAR.reduce((s, k) => s + alanSayisi(k), 0);
  const meta = [{ ikon: 'dosya', html: b('4') + ' kaynak · ' + b(O.sayi(toplamAlan)) + ' alan' }];
  if (e.short || e.label) meta.push({ ikon: 'takvim', html: 'Veri dönemi: ' + b(O.esc(e.short || e.label)) });
  meta.push({ ikon: 'indir', html: 'CSV · noktalı virgül ayraçlı · UTF-8' });
  /* B verilmez: global filtre bu sayfaya uygulanmadığından çip gösterilmez (yanıltmasın) */
  O.kaput(kok, {
    bindirme: true,
    ustEtiket: 'İnsan Kaynakları · Rapor',
    baslik: 'Rapor Oluştur',
    ozetHtml: 'İstediğiniz alanları soldan sürükleyip sağdaki rapor alanına bırakın, ardından filtreleyip dışa aktarın.'
      + (B.filtreAktif ? ' ' + b('Not:') + ' global departman filtresi bu sayfayı etkilemez; departman ve bölümü rapor alanından seçin.' : ''),
    meta
  });
  const kap = O.el('section', { class: 'rp-kaynaklar bindir', role: 'group', 'aria-label': 'Rapor kaynağı' });
  G.kartlar = {};
  KAYNAKLAR.forEach((src, i) => {
    const sayi = Array.isArray(D[src]) ? D[src].length : 0;
    const v = O.el('span', { class: 'v', text: '—' });
    const durumYer = O.el('span', { class: 'rp-durum' });
    const k = O.el('button', { class: 'kart kpi derin belir rp-kaynak', type: 'button', 'data-kaynak': src, '--i': i, '--kpi-renk': 'var(--lac-500)',
      on: { click: () => kaynakSec(src) } },
      O.el('span', { class: 'kpi-ust' }, O.el('span', { class: 'ust-etiket', text: 'Kaynak · ' + RP_FIELDS[src].label }), O.el('span', { class: 'kpi-ikon', html: O.ikon(KAYNAK_IKON[src]) })),
      O.el('span', { class: 'kpi-deger', 'data-kpi': 'rp-' + src, 'data-deger': String(sayi) }, v, O.el('small', { text: 'kayıt' })),
      O.el('span', { class: 'kpi-alt' }, O.el('span', { text: alanSayisi(src) + ' alan · ' + RP_FIELDS[src].groups.length + ' grup' }), durumYer));
    G.kartlar[src] = { k, durumYer };
    kap.append(k);
    O.sayac(v, sayi);
  });
  kok.append(kap);
}

function kaynakSec(src) {
  if (!RP_FIELDS[src] || durum.kaynak === src) return;
  durum.kaynak = src;
  tumunuGuncelle();
}

/* ==========================================================================
   (2) ALANLAR — kütüphane (index rpLib) · rapor alanı (rpRenderDrop + denetimler)
   ========================================================================== */
function alanlarCiz(kok, D) {
  O.akisBaslik(kok, { no: '02', baslik: 'Alanlar', aciklama: 'Sürükleyip bırakın ya da tıklayarak ekleyin · süzün · dışa aktarın' });
  const iz = O.izgara(kok);
  const lib = O.kart(iz, { baslik: 'Alan kütüphanesi', aciklama: 'Alt başlıklara ayrılmış detaylı alanlar — sürükleyip sağa bırakın ya da tıklayarak ekleyin', sinif: 's5 rp-kutuphane-kart' });
  G.kutuphane = lib.govde;
  G.kutuphaneAlt = lib.kart.querySelector('.kart-alt');

  const alan = O.kart(iz, { baslik: 'Rapor alanı', aciklama: 'Buraya bırakılan alanlar rapor tablosunu oluşturur', sinif: 's7' });
  G.alanAlt = alan.kart.querySelector('.kart-alt');
  const birak = O.el('div', { class: 'rp-birak', role: 'list', 'aria-label': 'Rapor alanları (bırakma bölgesi)' });
  birak.addEventListener('dragover', (ev) => { ev.preventDefault(); if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy'; birak.classList.add('uzerinde'); });
  birak.addEventListener('dragleave', (ev) => { if (!birak.contains(ev.relatedTarget)) birak.classList.remove('uzerinde'); });
  birak.addEventListener('drop', (ev) => {
    ev.preventDefault();
    birak.classList.remove('uzerinde');
    try { const d = JSON.parse(ev.dataTransfer.getData('text/plain')); alanEkle(d.src, d.key, d.label); } catch (x) { /* index.html: geçersiz bırakma yok sayılır */ }
  });
  G.birak = birak;
  alan.govde.append(birak);

  /* Denetimler: Departman (D.normal'den) · Bölüm · Temizle · CSV İndir · Yazdır */
  const depts = [...new Set((D.normal || []).map((x) => x.dept).filter((x) => x && x !== '-'))].sort(O.trKarsilastir);
  if (durum.dept && depts.indexOf(durum.dept) < 0) durum.dept = '';
  if (durum.bolum && O.BOLUMLER.indexOf(durum.bolum) < 0) durum.bolum = '';
  const den = O.el('div', { class: 'rp-denetim' });
  O.secim(den, { etiket: 'Departman', id: 'rp-dept-f', secenekler: [{ v: '', ad: 'Tüm departmanlar' }].concat(depts.map((d) => ({ v: d, ad: d }))), deger: durum.dept, degisince: (v) => { durum.dept = v; onizlemeGuncelle(); } });
  O.secim(den, { etiket: 'Bölüm', id: 'rp-bolum-f', secenekler: [{ v: '', ad: 'Tüm bölümler' }].concat(O.BOLUMLER.map((x) => ({ v: x, ad: x }))), deger: durum.bolum, degisince: (v) => { durum.bolum = v; onizlemeGuncelle(); } });
  const dugmeler = O.el('div', { class: 'rp-dugmeler' },
    O.el('button', { class: 'btn btn-hayalet', type: 'button', id: 'rp-temizle', html: O.ikon('sifirla') + 'Temizle', on: { click: temizleTum } }),
    O.el('button', { class: 'btn btn-pirinc', type: 'button', id: 'rp-csv', html: O.ikon('indir') + 'CSV indir', on: { click: csvIndir } }),
    O.el('button', { class: 'btn', type: 'button', id: 'rp-yazdir', html: O.ikon('dosya') + 'Yazdır', on: { click: () => window.print() } }));
  alan.govde.append(den, dugmeler);
}

function kutuphaneCiz() {
  const src = durum.kaynak, def = RP_FIELDS[src], secili = durum.alanlar[src];
  G.kutuphane.textContent = '';
  if (G.kutuphaneAlt) G.kutuphaneAlt.textContent = def.label + ' · ' + alanSayisi(src) + ' alan — sürükleyip sağa bırakın ya da tıklayarak ekleyin';
  def.groups.forEach((grp) => {
    const haplar = O.el('div', { class: 'rp-haplar' });
    grp.fields.forEach((f) => {
      const ekli = secili.some((x) => x.key === f.k);
      const hap = O.el('button', { class: 'rp-hap', type: 'button', draggable: 'true', 'data-alan': f.k, 'aria-pressed': String(ekli),
        title: ekli ? 'Rapor alanında' : 'Rapor alanına ekle', html: (ekli ? O.ikon('onay') : ARTI) });
      hap.append(document.createTextNode(f.l));
      hap.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', JSON.stringify({ src, key: f.k, label: f.l })); ev.dataTransfer.effectAllowed = 'copy'; });
      hap.addEventListener('click', () => alanEkle(src, f.k, f.l));
      haplar.append(hap);
    });
    G.kutuphane.append(O.el('div', { class: 'rp-grup' }, O.el('div', { class: 'rp-grup-baslik', text: grp.g }), haplar));
  });
}

/* index rpAddField: farklı kaynak uyarısı · aynı alan ikinci kez eklenmez */
function alanEkle(src, key, label) {
  if (!RP_FIELDS[src]) return;
  if (src !== durum.kaynak) { bildir('Önce kaynağı “' + RP_FIELDS[src].label + '” olarak seçin'); return; }
  const liste = durum.alanlar[src];
  if (liste.some((f) => f.key === key)) return;
  liste.push({ src, key, label });
  kutuphaneCiz(); birakCiz(); onizlemeGuncelle();
}
function alanKaldir(key) {
  const src = durum.kaynak;
  durum.alanlar[src] = durum.alanlar[src].filter((f) => f.key !== key);
  kutuphaneCiz(); birakCiz(); onizlemeGuncelle();
}
/* index rpClear: tüm seçili alanlar kaldırılır */
function temizleTum() {
  KAYNAKLAR.forEach((k) => { durum.alanlar[k] = []; });
  kutuphaneCiz(); birakCiz(); onizlemeGuncelle();
}

function birakCiz() {
  const alanlar = durum.alanlar[durum.kaynak];
  G.birak.textContent = '';
  if (G.alanAlt) G.alanAlt.textContent = 'Kaynak: ' + RP_FIELDS[durum.kaynak].label + ' · ' + (alanlar.length ? alanlar.length + ' alan seçildi' : 'buraya bırakılan alanlar rapor tablosunu oluşturur');
  if (!alanlar.length) { G.birak.append(O.el('div', { class: 'rp-bos', text: 'Soldan bir alan sürükleyin veya tıklayın' })); return; }
  alanlar.forEach((f, i) => {
    const sil = O.el('button', { type: 'button', title: 'Kaldır', 'aria-label': f.label + ' alanını kaldır', html: O.ikon('carpi'), on: { click: () => alanKaldir(f.key) } });
    G.birak.append(O.el('span', { class: 'rp-secili', role: 'listitem', 'data-alan': f.key }, O.el('span', { class: 'rp-no', text: String(i + 1) }), O.el('span', { text: f.label }), sil));
  });
}

/* ==========================================================================
   (3) ÖNİZLEME — index rpBuild (ilk 300 satır) · CSV (rpExportCSV) tüm satırlar
   ========================================================================== */
function onizlemeKartiCiz(kok) {
  O.akisBaslik(kok, { no: '03', baslik: 'Önizleme', aciklama: 'Oluşturulan rapor · en fazla ' + SINIR + ' satır gösterilir, CSV tüm satırları içerir' });
  const sayac = O.el('span', { class: 'rp-sayac', id: 'rp-ti', 'aria-live': 'polite' });
  const k = O.kart(kok, { baslik: 'Oluşturulan rapor', aciklama: '', sag: sayac, sinif: 'kart-liste rp-onizleme' });
  G.sayac = sayac;
  G.onizlemeAlt = k.kart.querySelector('.kart-alt');
  if (!G.onizlemeAlt) { G.onizlemeAlt = O.el('div', { class: 'kart-alt' }); k.ust.querySelector('.kart-bas').append(G.onizlemeAlt); }
  G.onizleme = k.govde;
}

/* index rpBuild/rpExportCSV ile aynı süzgeç: dept ve bölüm birebir eşitlik; global filtre uygulanmaz */
function satirlar(src) {
  const rows = Array.isArray(G.D[src]) ? G.D[src] : [];
  return rows.filter((r) => !((durum.dept && r.dept !== durum.dept) || (durum.bolum && r.bolum !== durum.bolum)));
}

function onizlemeGuncelle() {
  if (!G) return;
  const src = durum.kaynak, alanlar = durum.alanlar[src], rows = satirlar(src);
  G.sayac.textContent = O.sayi(alanlar.length) + ' alan · ' + O.sayi(rows.length) + ' kayıt' + (rows.length > SINIR ? ' (ilk ' + SINIR + ' gösteriliyor)' : '');
  const sec = ['Kaynak: ' + RP_FIELDS[src].label, durum.dept ? 'Departman: ' + durum.dept : 'Tüm departmanlar', durum.bolum ? 'Bölüm: ' + durum.bolum : 'Tüm bölümler'];
  G.onizlemeAlt.textContent = sec.join(' · ');
  G.onizleme.textContent = '';
  if (!alanlar.length) {
    O.bosDurum(G.onizleme, { ikon: 'rapor', baslik: 'Rapor alanı seçilmedi', metin: 'Soldan bir alan sürükleyin veya tıklayın; tablo burada oluşur.', kucuk: true });
    return;
  }
  const deger = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));
  O.tablo(G.onizleme, {
    sutunlar: alanlar.map((f) => ({ k: f.key, ad: f.label, siralanamaz: true, bicim: deger, sinif: f.key === 'ad' ? 'ad-hucre' : '' })),
    satirlar: rows.slice(0, SINIR),
    sayfaBoyu: SINIR,
    siraNo: true,
    ara: false,
    altMetin: (n) => O.sayi(n) + ' satır gösteriliyor' + (rows.length > SINIR ? ' · CSV’de süzülmüş tüm ' + O.sayi(rows.length) + ' kayıt yer alır' : ''),
    bos: { baslik: 'Kayıt bulunamadı', metin: 'Departman ya da bölüm seçimini değiştirin.' }
  });
}

/* index rpExportCSV ile birebir: başlık + satırlar, ";" ayraç, çift tırnak, BOM, "\n", rapor_<kaynak>.csv */
function csvIndir() {
  const src = durum.kaynak, fields = durum.alanlar[src];
  if (!fields.length) { bildir('Önce rapor alanı seçin'); return; }
  const rows = satirlar(src);
  const lines = [fields.map((f) => '"' + f.label + '"').join(';')];
  rows.forEach((r) => { lines.push(fields.map((f) => { const v = r[f.key]; return '"' + (v === null || v === undefined ? '' : String(v).replace(/"/g, '""')) + '"'; }).join(';')); });
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'rapor_' + src + '.csv';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  bildir('CSV hazırlandı: rapor_' + src + '.csv (' + O.sayi(rows.length) + ' kayıt)');
}

function tumunuGuncelle() {
  if (!G) return;
  KAYNAKLAR.forEach((src) => {
    const x = G.kartlar && G.kartlar[src];
    if (!x) return;
    const sec = src === durum.kaynak;
    x.k.setAttribute('aria-pressed', String(sec));
    x.durumYer.textContent = '';
    if (sec) x.durumYer.append(O.el('span', { class: 'cip cip-pirinc', html: O.ikon('onay') + 'Seçili' }));
  });
  kutuphaneCiz();
  birakCiz();
  onizlemeGuncelle();
}
