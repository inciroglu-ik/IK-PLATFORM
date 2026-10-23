# İK Dashboard 2.0 · Kabuk kılavuzu (sayfa ajanları için)

Bağlayıcı: `tasarim-2026/BRIEF_IK.md`. Şablon sayfa: `pano/sayfa-genel.js` (Genel Bakış), önce onu okuyun.

## 1. Dosyalar ve kurallar
| Dosya | Görev |
|---|---|
| `pano.html` | Kabuk: oturum, veri okuma, sol menü + üst bant, global filtre, haftalık yükleme, dışa aktarma, yönlendirme. **Firebase/kimlik importu YALNIZ burada.** |
| `pano/kokpit.css` | Satış Panosu `kokpit.css` BİREBİR kopyası (tokenler). **Düzenlemeyin.** |
| `pano/pano.css` | Kabuk + ortak bileşen stilleri. Sayfaya özel küçük stil gerekiyorsa sayfa modülü kendi `<style>`'ını `kok` içine ekleyebilir. Önce mevcut sınıfları kullanın. |
| `pano/ortak.js` | Ortak kitaplık (aşağıda). |
| `pano/sayfa-<ad>.js` | Her sekme bir modül. |

**Dosya adları kabukta kayıtlı (`pano.html` → `SAYFALAR`)**: `ov`→`sayfa-genel.js` · `ay`→`sayfa-ayrilanlar.js` · `ia`→`sayfa-isealim.js` · `tv`→`sayfa-turnover.js` · `iz`→`sayfa-izin.js` · `mes`→`sayfa-mesai.js` · `arb`→`sayfa-arabuluculuk.js` · `rp`→`sayfa-rapor.js`. Dosya yoksa ya da hata verirse kabuk "Sayfa hazırlanıyor" yer tutucusu gösterir. Pano çökmez.

Yasaklar: Firebase/kimlik import etmek, `index.html` ya da `kokpit.css` dosyasına dokunmak, iş kuralı eşiği uydurmak (kaynak yoksa eşik/renk bandı yok), ozet metriklerini (turnover %, simülasyon, istenen %, kıdem) yeniden hesaplamak. Veri metni `innerHTML`'e yalnız `O.esc()` ile girer.

## 2. Sayfa sözleşmesi
```js
// pano/sayfa-<ad>.js
import * as O from './ortak.js';            // kabuğun kullandığı modülle aynı örnek (aynı URL)
export const meta = { id: 'ay', baslik: 'İşten Ayrılanlar', ikon: O.ikon('kapi') };
const durum = { /* filtre değişince korunacak sayfa içi seçimler */ };
export function ciz(kok, B) { /* kok: boş <section class="pg on" id="p-ay"> */ }
export function temizle() { /* isteğe bağlı: zamanlayıcı/dinleyici sök. Grafikleri kabuk siler. */ }
```
**Bağlam `B`**
| Alan | Anlam |
|---|---|
| `B.D` | Paketin `D` nesnesi, filtresiz. `ozet`, `turnover`, `mesai_aylik`, `mes_bolum`, `mesai_dept` buradan okunur. |
| `B.filtreli` | Global filtre uygulanmış diziler: `normal, stajyer, gecici, vi, ayrilanlar, isealim, izin, mesai_kisi, arabuluculuk`. Filtre boşsa D'deki dizinin kendisi gelir. Filtre doluysa V.İ. çıkar, `dept ∈ seçim`, `bolum` eşleşir. Arabuluculukta da `dept` = departman, `bolum` = bölüm. |
| `B.filtreAktif`, `B.filtre` | `true/false`, `{ departmanlar:Set, bolum:'' }` |
| `B.etiket` | `{ label, short, hafta, foot }` |
| `B.MONTHLY_HC` | `{ labels, y2025, y2026 }` ya da `null` |
| `B.rol`, `B.roller`, `B.ad`, `B.ik` | `'ik'/'direktor'/'idari_mudur'`, tüm roller, ad, İK mi |
| `B.yenidenCiz()` | Aktif sayfayı yeniden çizer (kaydırma korunur) |
| `B.git(id)` · `B.bildir(m)` | Sayfa değiştir · bildirim göster |
| `B.filtreKaldir('dept', ad)` · `B.filtreKaldir('bolum')` · `B.filtreTemizle()` | Global filtreyi değiştir (kabuk yeniden çizer) |

Filtre değişince kabuk sırayla `temizle()` → `O.grafikleriTemizle()` → `ciz(kok, B)` çalıştırır. Sayfa içi seçimleri modül değişkeninde (`durum`) saklayın.

## 3. Sayfa iskeleti (akış: Özet → Trend → Kırılım → Liste)
```js
export function ciz(kok, B) {
  const F = B.filtreli, oz = B.D.ozet || {};
  // (1) ÖZET — kaput (başlık + 1 cümle + 3 kadran) ve KPI satırı ya da gruplu panel
  O.kaput(kok, { B, bindirme: true, ustEtiket: 'İnsan Kaynakları · ' + (B.etiket.hafta || '2026'),
    baslik: 'İşten Ayrılanlar', ozetHtml: '2026’da <b>' + O.sayi(F.ayrilanlar.length) + '</b> kişi ayrıldı…',
    meta: [{ ikon: 'takvim', html: 'Veri dönemi: <b>' + O.esc(B.etiket.short || '') + '</b>' }],
    kadranlar: [{ etiket: 'İstifa payı', deger: 53, max: 100, onek: '%', alt: '<b>62</b> / 116 çıkış' }] });
  O.kpiSatiri(kok, [ { anahtar: 'toplam', etiket: 'Toplam', deger: F.ayrilanlar.length, alt: 'kişi ayrıldı', ikon: 'kapi', renk: 'var(--g3)' }, /* … */ ], { sinif: 'bindir' });
  // (2) TREND
  O.akisBaslik(kok, { no: '02', baslik: 'Trend', aciklama: 'Aylık çıkış · 2026' });
  const iz = O.izgara(kok);
  const g = O.grafikKarti(iz, { baslik: 'Aylık çıkış', aciklama: 'Kişi sayısı', sinif: 's7', yukseklik: 280,
    tablo: () => ({ sutunlar: [{ ad: 'Ay' }, { ad: 'Çıkış', sag: true }], satirlar: [/* [ay, değer] */] }) });
  O.grafik(g.canvas, { type: 'bar', data: { labels: O.aylar(B.D).map(O.ayKisa),
      datasets: [{ label: 'Çıkış', data: O.aySay(F.ayrilanlar, O.aylar(B.D)), backgroundColor: O.RENK.cikis, maxBarThickness: 22, datalabels: O.etiket.ust() }] },
    options: { scales: { x: O.eksenX(), y: O.eksenY({ grace: '14%' }) } } });
  // (3) KIRILIM
  O.akisBaslik(kok, { no: '03', baslik: 'Kırılım' });
  const { govde } = O.kart(O.izgara(kok), { baslik: 'Departman bazında çıkış', sinif: 's6' });
  O.cubukListe(govde, O.grupSay(F.ayrilanlar, 'dept').map(([ad, deger]) => ({ ad, deger })), { kaydir: 392 });
  // (4) LİSTE
  O.akisBaslik(kok, { no: '04', baslik: 'Liste' });
  const k = O.kart(kok, { baslik: 'Çalışan detay listesi' });
  O.tablo(k.govde, { sutunlar: [{ k: 'ad', ad: 'Ad Soyad', sinif: 'ad-hucre' }, { k: 'tarih', ad: 'Ayrılış', tip: 'tarih' }],
    satirlar: F.ayrilanlar, siraNo: true, araYer: 'Ad, departman ara…', araAlanlari: ['ad', 'dept', 'bolum', 'unvan'] });
  O.notlar(kok, ['Kaynak: haftalık İK pano paketi.']);
}
```
Kurallar: ay ekseni **veriden** gelir (`O.aylar(B.D)` = 1..`ozet.ay_sayisi`, mesai için `O.mesaiAylari(B.D)`). `istenen` bilgisini `O.istenenMi(a)` ile okuyun (`istenen ?? istened`). Filtre seçiliyse ama sayfa bir değeri filtreleyemiyorsa (ozet oranları, aylık toplamlar) etikete "şirket geneli" yazın. Ad hücresi ayrı `<td>`'dir ve içinde yalnız ad bulunur (`sinif:'ad-hucre'`), ileride profil tıklaması bu hücreyi kullanacak.

## 4. `ortak.js` API'si (`import * as O from './ortak.js'`)
**Biçim:** `sayi(n, ondalik=0|'oto')` → `1.234` / `—` · `yuzde(n, ondalik='oto')` → `%41,52` · `isaretli(n)` → `+5` / `−3` · `para(n)` → `12.346 TL` · `kisaSayi(n)` → `12,3 B` · `tarih(x)` → `09.03.2026` · `tarihCoz(s)` → Date · `tarihSirasi(x)` · `bugunDosya()` (yerel `YYYY-AA-GG`) · `esc(s)` · `kisalt(s, n)` · `bosMu(v)`
**Türkçe:** `trKucuk/trLower`, `trBuyuk/trUpper`, `trBaslik('ŞUBAT')`→`Şubat`, `katla(s)`, `aramaAnahtari(s)`, `aramaEslesir(metin, sorgu)` ("ibrahim"↔"İBRAHİM", "sule"↔"ŞULE"), `trKarsilastir(a,b)`
**Sabitler:** `MN` (1 tabanlı), `ayAdi(m)`, `ayKisa(m)` ("Şub"), `BOLUMLER`, `ISTENEN_NED`, `SILINECEK`, `NEDENLER`, `MES_AY_KEY`, `RENK` (g1..g8 açık zemin, gk1..gk8 koyu zemin, `giris`, `cikis`, `y2025`, `y2026`, `istenen`, `istenmeyen`), `NEDEN_RENK`/`nedenRengi(n)`, `BOLUM_RENK`/`bolumRengi(b)`, `renkSaydam(hex, a)`
**Saf hesaplar (index.html ile aynı sonuç):** `catR(metin)` (İ hatası düzeltildi), `bCls(neden)`, `isSil(ad)`, `istenenMi(a)`, `gunToYil(sure)`, `kidemGun(sure)`, `kidemKovasi(gun)`, `KIDEM_KOVALARI`, `KIDEM_KOVA_ADLARI`, `kidemKovaSayilari(dizi)`, `ayrilanKidemOzeti(dizi)` → `{kisi, ortYil, ortAy, minAy, maxAy}`, `kidemAraci(normal, dept, bolum)` → `{kisi, eksik, ort, min, max}`, `gercekKat(aciklama)`, `GERCEK_KATEGORILER`, `cmpTrend(c,p,yuzdeMi)` (metin), `haftalikFark(c,p,yuzdeMi)` (yapı), `isVI`, `excludeVI`, `oranAsil(c, cal)`, `pct(v)`, `turnoverRiski(oran)` → `{sinif:'rr'|'ry'|'rg', metin}`, `izinDurumu(bakiye)` → `{metin, sinif}`, `enYogunAy(dizi)` → `{ay, sayi}`, `ortalama(a)`, `uyarilar(D)`, `turnoverFiltreli(filtAy, filtCl, filtIa, ozet, {simAy:6})` (index.html filtreli TV; B3 düzeltmesi için `simAy: ozet.ay_sayisi`)
**Veri:** `grupSay(dizi, 'alan'|fn)` → `[[anahtar, adet]…]` azalan · `bolumSay(dizi)` → `{Servis, Satış, İdari}` · `aySayisi(D)`, `aylar(D)`, `aySay(dizi, aylar)`, `donemAyi('2026-03')`→3 · `mesaiAylari(D)` → `[{ad:'Ocak', key:'ocak'}…]` · `departmanListesi(D, {bolum})` · `filtreUygula(dizi, filtre)`, `filtreliVeri(D, filtre)`, `filtreAktifMi`, `filtreMetni`
**DOM:** `el(etiket, {class, text, html, style, on, data, '--degisken'}, ...cocuklar)`, `$(sec)`, `ikon(ad)` (genel, kapi, alim, donus, izin, saat, terazi, rapor, kisiler, kisi, takvim, performans, hedef, uyari, bilgi, onay, carpi, ara, filtre, indir, yukle, excel, dosya, anahtar, cikis, kidem, yukari, asagi, siralama …)
**Bileşenler:**
- `kaput(kok, {B, ustEtiket, baslik, ozetHtml|ozet, meta:[{ikon, html}], kadranlar:[…], bindirme})`. Koyu bant üst alana çizilir, etkin filtreyi çip olarak gösterir. `bindirme:true` verilirse ilk blok `sinif:'bindir'` alır.
- `kadran(kap, {deger, max, etiket, onek, sonek, ondalik, isaret, boyut})` doluluk halkası · `{parcalar:[{ad, deger, renk, metin}], merkez}` bileşim halkası (parça-bütün; koyu zeminde `RENK.gk*`)
- `kpiSatiri(kok, [öğe…], {kolon, sinif})` · `kpiKart(kap, öğe)` · `kpiPanel(kok, [{grup:{baslik, alt, ikon}, ogeler:[öğe…]}], {sinif})`. **Öğe:** `{anahtar, etiket, deger, ondalik, onek, sonek, isaret, birim, metin, alt|altHtml, delta:{fark, ondalik, birim, iyiYon:'yukari'|'asagi'|null, metin}, ton:'iyi'|'kotu', ikon, renk, olcek}`. Sayaç ekleri korur; `data-kpi`/`data-deger` testte okunur.
- `akisBaslik(kok, {no, baslik, aciklama})` · `izgara(kok)` (kart sınıfları `s3…s12`) · `kart(kap, {baslik, aciklama, sinif, sag})` → `{kart, ust, govde}` · `kartNot(kap, metin)` · `notlar(kok, [maddeler])`
- `grafikKarti(kap, {baslik, aciklama, sinif, yukseklik, lejant:[{ad, renk, tip:'kutu'|'cizgi'}], tablo:()=>({sutunlar, satirlar}), not})` → `{canvas, govde, kap}` (Grafik | Tablo geçişi)
- `lejant(kap, öğeler)` · `cubukListe(kap, [{ad, deger}], {renk, kaydir, seriler:[{k, ad, renk}], bicim, adGenislik})` · `dagilimSeridi(kap, [{ad, deger, renk}])`
- `bolumlu(kap, {secenekler:[{v, ad}], deger, degisince, kucuk, koyu})` → `{deger(), ayarla(v)}` · `secim(kap, {etiket, secenekler, deger, degisince})` · `filtreCipleri(kap, [{metin, kaldir}])` · `bosDurum(kap, {ikon, baslik, metin, eylem:{metin, fn|href}, kucuk})`
- `tablo(kap, {sutunlar:[{k, ad, tip:'metin'|'sayi'|'tarih', sag, bicim, html, sinif, hucreSinif, siralanamaz, ilkYon, siralamaDegeri}], satirlar, sayfaBoyu:12, siraNo, araYer, araAlanlari, varsayilanSira:{k, y:'artan'|'azalan'}, altMetin, toplamSatir, bos, aracEk, satirTikla})` → `{guncelle(satirlar), ciz(), durum}`. Sıralama döngüsü: ilk tık → ters → orijinal (null değerler en küçük sayılır).
- `ipucuGoster(x, y, {baslik, satirlar})`, `ipucuGizle()`, `ipucuBagla(el, ()=>içerik)`, `bildirim(metin)`, `sayac(el, hedef, {ondalik, onek, sonek, isaret})`, `azHareket()`
**Grafik:** `grafik(canvas, config)` (kabuk sayfa değişince hepsini siler) · `grafikleriTemizle()` · `grafikVarsayilan()` (kabuk çağırır) · `eksenX(ek)`, `eksenY(ek)` · değer etiketi: `datalabels: O.etiket.ust() | .sag() | .nokta({onek, sonek, ondalik, secim:'otomatik'|'hepsi'|'uclar', minPx, align})`. "otomatik" ayarında yer yetiyorsa her değer, yetmiyorsa yalnız en büyük ve son değer yazılır. Sütun ≤22 px, 4 px yuvarlak uç; çizgi 2 px; ikinci y ekseni yok; durum renkleri (ok/uy/ht) seri rengi olarak kullanılmaz.
**Dışa aktarma:** `disaAktar(tur, D)`, `xlsIndir(sayfalar, ad)`, `DISA_AKTAR`

## 5. CSS sınıf sözlüğü
Yerleşim: `.ic` (içerik genişliği) · `.pg` (sayfa kökü, 20 px boşluklu ızgara) · `.izgara` + `.s3…s12` · `.bindir` (kaputa binen ilk blok) · `.akis-baslik` · `.notlar`
Kart: `.kart` · `.kart-ust` · `.kart-baslik` · `.kart-alt` · `.kart-govde` · `.kart-not` · `.kart-alt-cubuk` · `.grafik-kap` (yükseklik `--yuk`) · `.lejant`
KPI: `.kpi-satir` (`--kolon`) · `.kart.kpi` · `.kpi-ust` · `.kpi-deger` (`.iyi`/`.kotu`) · `.kpi-alt` · `.delta` (`-iyi`/`-kotu`/`-notr`) · `.kpi-olcek` · `.kpi-panel` · `.kpi-satiri` · `.kpi-grup` · `.kpi-hucre`
Liste/dağılım: `.cubuk-liste` (`.kaydir`, `--ad-gen`) · `.cubuk-satir` · `.serit` · `.dagilim-liste` / `.dagilim-satir` · `.uc-kolon` / `.kolon-baslik` · `.sonuc-izgara` / `.sonuc` (`.vurgu`) · `.arac-satiri` · `.dipnot`
Denetim (kokpit): `.btn` (`-pirinc`, `-lacivert`, `-hayalet`) · `.alan` + `.secim` · `.girdi` · `.bolumlu` (`.kucuk`, `.koyu`) · `.filtre-cip` · `.cip` (`-ok`, `-uy`, `-ht`, `-ey`, `-bilgi`, `-pirinc`) · `.rozet`
Tablo: `.tablo-kap` · `.tablo` (`.sag`, `.orta`, `.soluk`, `td.ad-hucre`, `td.pozitif`/`.negatif`) · `.tablo-arac` · `.ara-kutu` · `.tablo-alt` · `.sayfalama`
Durum: `.bos-durum` (`.kucuk`) · `.yer-tutucu`

## 6. Test (A10 düzeneği, SENTETİK veri)
```powershell
# Test kopyası + pano/ klasörü + sunucu + rol/ekran/karşılaştırma (port 8941-8949):
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\ik\Desktop\tarama\tasarim-2026\test\ik\pano_test.ps1"
# Yalnız test kopyası:
powershell -NoProfile -ExecutionPolicy Bypass -File "...\test\ik\harness_olustur.ps1" -Kaynak "C:\Users\ik\Desktop\tarama\ik-platform-repo\pano.html" -Ad pano2
#   ardından ik-platform-repo\pano\ klasörünü test\ik\calisan\pano\ altına kopyalayın (dinamik importlar otomatik kopyalanmaz)
# Tarayıcıda: http://localhost:<port>/calisan/pano2.html?rol=ik|direktor|idari_mudur&hosgeldin=0[&veri=bos|hata][#ay]
```
Hazır işareti: kabuk her çizimden sonra `window.__TEST_HAZIR = true` yapar. Sekme düğmeleri `#t-<id>` (A10 `__TEST.sekme(id)` çalışır). Konsol hatası 0 olmalı. Eksik modülün 404 kaydı tek beklenen istisnadır.

## 7. Ana adres, sürüm ve kabuk pencereleri (23.10.2026)
- Yeni pano **ana adreste**: `index.html` (eski adı `pano.html` artık yalnız `./`'e yönlendirir). Eski pano `klasik.html`
  (Dışa Aktar menüsü → "Klasik panoda aç"). İkisi aynı veriyi (`satisVeri/ikPano`) okur.
- **Sürüm kontrolü:** `index.html` başındaki `<meta name="version">` ile hemen altındaki betikteki `v` değeri BİRLİKTE
  artırılır (telefonlarda önbellekte kalan eski kopya, oturum başına bir kez sunucudaki sürümle kıyaslanıp yenilenir).
- **Çalışan ara** (üst bant "Ara" düğmesi / Ctrl+K): klasik panodaki 6 liste (normal, stajyer, gecici, vi, ayrilanlar,
  isealim), Türkçe katlamalı eşleşme, en fazla 15 sonuç; başı eşleşenler üstte. Sonuca tıklayınca profil kartı açılır.
- **Profil kartı** (`profilAc(ad)`): çalışan bilgileri · ayrılış · arabuluculuk · işe alım · izin (renk: <0 kırmızı, 30+ amber,
  diğer yeşil — klasik kural) · mesai. Tablolarda `td.ad-hucre` hücresindeki kişi adları otomatik tıklanabilir olur
  (MutationObserver; içinde düğme olan hücreler — ör. İşten Ayrılanlar — kendi kişi kartını kullanır).
- **🔔 Uyarılar**: `O.uyarilar(D)` (klasik getAlerts ile aynı kurallar); zil üstündeki sayı = uyarı adedi.
