# İnciroğlu Otomotiv İK Uygulamaları — Güvenlik Mimarisi

Bu belge, İnsan Kaynakları'nın web uygulamalarının kimlik doğrulama, yetkilendirme ve veri koruma
düzenini IT ekibinin denetimi için özetler. Belge, kodla birlikte bu depoda tutulur ve her güvenlik
değişikliğinde güncellenir.

**Durum:** 10 Ekim 2026 · Tüm uygulamalar (İK Sistemi, İK Analitik Panosu, Personel Listesi, Portal,
Yetenek Havuzu, İşe Alım, Satış Panosu, Servis Panosu) ortak girişe taşındı; veritabanındaki **tüm
koleksiyonlar** rol bazlı kurallarla kilitlendi. Açık kalan konular için bkz. §9.

---

## 1. Genel yapı

| Katman | Teknoloji | Not |
| --- | --- | --- |
| Arayüz | Statik HTML/JavaScript (derleme adımı yok) | GitHub Pages: `https://inciroglu-ik.github.io/<uygulama>/` (HTTPS zorunlu) |
| Kimlik doğrulama | Google **Firebase Authentication** (e-posta/şifre sağlayıcısı) | Şifreler yalnız Firebase'de, tuzlu karma (hash) olarak tutulur |
| Veritabanı | Google **Cloud Firestore** (`yetenek-havuzu` projesi) | Erişim **Firestore Security Rules** ile sunucu tarafında denetlenir |
| Ortak giriş modülü | `IK-PLATFORM/ortak/kimlik.js` | Tüm uygulamalar aynı modülü kullanır |
| Güvenlik kuralları | `IK-PLATFORM/guvenlik/firestore.rules` | Sürüm kontrollü; Firebase konsolundan yayınlanır |

Uygulamalar aynı alan adında çalıştığı için bir kez giriş yapan kullanıcı, yetkili olduğu diğer
uygulamalara yeniden şifre girmeden geçer (tek oturum). Yetki **her istekte** veritabanı kurallarıyla
yeniden denetlenir; arayüzün gösterdiği ya da gizlediği hiçbir şey yetki sayılmaz.

| Uygulama | Adres | Giriş yapabilen roller |
| --- | --- | --- |
| İK Sistemi | `/IK-PLATFORM/ik.html` | `ik` |
| İK Analitik Panosu | `/IK-PLATFORM/index.html` | `ik`, `direktor`, `idari_mudur` |
| Personel Listesi | `/IK-PLATFORM/mr.html` | yönetim rolleri |
| Portal | `/IK-PLATFORM/portal.html` | yönetim rolleri |
| Yetenek Havuzu | `/yetenek-havuzu/` | yönetim rolleri (değerlendirici kapsamı personel listesinden) |
| İşe Alım | `/ise-alim-sureci/` | `ik`; müdürler hesabındaki işe alım departmanıyla |
| Satış Panosu | `/satis-panosu/` | `ik`, `direktor` (salt okunur), `satis_mudur` |
| Servis Panosu | `/servis-panosu/` | `ik`, `direktor` (salt okunur), `servis_mudur` |
| İş başvuru formu | `/ise-alim-sureci/basvuru.html` | herkese açık (yalnız başvuru oluşturur) |
| Portal tanıtım sayfası · erişim talebi formu | `/IK-PLATFORM/tanitim.html` | herkese açık (yalnız `erisimTalepleri` kaydı oluşturur; talepleri yalnız `ik` okur/işler) |
| Aday sınavı | `/ise-alim-sureci/sinav.html?t=…` | bağlantıyı alan aday (128 bit tek kullanımlık anahtar) |

> **Firebase API anahtarı neden kodda?** Firebase web yapılandırmasındaki `apiKey` gizli bir anahtar
> değil, projeyi tanıtan herkese açık bir tanımlayıcıdır (Google Firebase belgeleri). Veriye erişimi
> bu anahtar değil, kimlik doğrulama ve güvenlik kuralları belirler. Ek önlem olarak anahtar, Google
> Cloud konsolunda alan adıyla kısıtlanabilir (bkz. §9).

## 2. Kimlik doğrulama

- **Tek kişi, tek hesap.** Her çalışanın tek hesabı vardır ve TC Kimlik No'suna bağlıdır. Ortak,
  paylaşılan ya da varsayılan şifre **yoktur**. Güncel kaynak kodda hiçbir kullanıcı adı, şifre ya da
  şifre özeti bulunmaz (eski sürümlerin git geçmişi için bkz. §9).
- **Giriş:** TC Kimlik No + kişinin kendi belirlediği şifre. Firebase hesabının e-posta adresi sisteme
  özeldir ve rastgele üretilir (`h…@hesap.inciroglu.local`); dışarıya e-posta gönderilmez.
- **İlk giriş ve şifre sıfırlama:** İK, kişi için **tek kullanımlık aktivasyon kodu** üretir
  (12 karakter, 60 bit rastgelelik, `crypto.getRandomValues`). Kod **14 gün** geçerlidir.
  Veritabanında kodun kendisi değil, kişiye bağlı **SHA-256 özeti** saklanır. Kod yalnız üretildiği
  anda İK ekranında bir kez gösterilir ve kişiye basılı olarak iletilir.
- **Kod doğrulaması:** Kişinin girdiği kod tarayıcıda kişiye bağlı özete çevrilir. Hesabın yeni
  oturuma bağlanması, ancak Firestore kuralları bu özetin İK'nın kaydettiği özetle aynı olduğunu,
  kodun süresinin dolmadığını ve kullanılmadığını sunucuda doğrularsa gerçekleşir. Özet yalnız İK
  tarafından okunabilir (İK zaten kod üretme yetkisine sahiptir). Kullanılmış bir kod, eski kayıt
  üzerine yazılarak yeniden canlandırılamaz.
- **Şifre kuralı:** en az 10 karakter, harf ve rakam içermeli; "inciroglu", "123456" gibi kolay
  ifadeler ve TC Kimlik No parçaları reddedilir. (Firebase tarafındaki asgari uzunluk 6'dır; ek kural
  arayüzde uygulanır. Sunucu tarafı politika önerisi için bkz. §9.)
- **Kaba kuvvet:** Art arda hatalı girişler Firebase Authentication tarafından geçici olarak engellenir.
- **Şifre değişikliği:** Kullanıcı, mevcut şifresiyle yeniden doğrulanarak şifresini değiştirebilir.
- **İlk yönetici kurulumu:** İlk İK hesabı, kurallara yalnız SHA-256 özeti yazılı, 100 bit rastgele,
  **tek seferlik** bir kurulum koduyla açılır. `kurulum/tek` kaydı yalnız bir kez oluşturulabildiği
  için kod ikinci kez kullanılamaz; ayrıca 24.10.2026'da kendiliğinden geçersiz olur. Kurulumdan sonra
  bu bölüm kurallardan silinecektir.

## 3. Yetkilendirme (roller)

Yetki, `hesaplar/{hid}` kaydındaki **roller** ve **kapsam** alanlarından gelir. Bu kaydı **yalnız İK**
yazabilir; kural bunu sunucuda zorlar. `hid`, TC Kimlik No'nun SHA-256 özetidir: belge adlarında TC
açıkça yer almaz. Ancak bu bir **anonimleştirme değildir**: TC uzayı küçük olduğu için özet, TC
listesine sahip biri tarafından eşleştirilebilir (bkz. §9, giriş adresi).

| Rol | Açıklama |
| --- | --- |
| `calisan` | Çalışan (self-servis uygulaması: bkz. §9) |
| `ik` | İnsan Kaynakları: tam yetki, hesap ve rol yönetimi |
| `direktor` | Direktör: panoları görüntüleme, Yetenek Havuzu değerlendirmesi |
| `satis_mudur` | Satış müdürü (kapsam: satış markası) |
| `servis_mudur` | Servis müdürü (kapsam: servis markası) |
| `idari_mudur` | İdari müdür |
| `mudur` | Departman müdürü (kapsam: işe alım departmanı) |

"Yönetim rolleri" = `ik`, `direktor`, `satis_mudur`, `servis_mudur`, `idari_mudur`, `mudur`.

**Oturum bağı ve anında iptal.** Firebase oturumu `uidBag/{uid}` kaydıyla hesaba bağlanır. Kurallar her
istekte (1) bağın varlığını, (2) hesabın **aktif** olduğunu ve (3) hesabın **güncel oturumunun** bu
oturum olduğunu denetler. Bu yüzden İK bir hesabı kapattığında ya da yeni kod ürettiğinde, açık
oturumlar **o anda** veritabanına erişemez hale gelir. Firebase'e kendi kendine kayıt olan biri, bir
hesaba bağlı olmadığı için hiçbir veriye erişemez.

## 4. Veri erişim matrisi

| Veri (koleksiyon / belge) | Okuma | Yazma |
| --- | --- | --- |
| Özlük, izin, harcama, puantaj, ödeme, mesai, giriş-çıkış, personel listesi (`satisVeri/*`) | İK | İK |
| Personel listesi **özeti** (`satisVeri/mrPersonelOzet`: ad, departman, bölüm, unvan, tarihler; TC, iletişim ve maaş yok) | İK, yönetim rolleri | İK |
| İK Analitik Panosu verisi (`satisVeri/ikPano`) | İK, direktör, idari müdür | İK |
| Satış panosu verisi (`satisVeri/current`: tüm markaların hedef/fiili verisi, danışman işaretleri) | İK, direktör, satış müdürü | İK; satış müdürü yalnız elle girilen alanlar (eski çalışan, elle eklenen danışman, elle düzeltilen fiili) |
| Satış danışmanlarının giriş/çıkış tarihi ve ayrılış notu (`satisVeri/danismanDetay`) | İK, direktör | İK |
| Satış karneleri / tebliğleri | İK, direktör, satış müdürü | İK, satış müdürü (kayıt kimliği harf/rakam ve belgeyle aynı, yıl/ay sayı olmalı) |
| Servis verisi (`servisVeri/current`) | İK, direktör, servis müdürü | İK; servis müdürü yalnız kadro listesi |
| Servis karneleri / tebliğleri | İK, direktör; servis müdürü **yalnız kendi markası** | İK; servis müdürü yalnız kendi markası (silme yalnız İK) |
| Yetenek Havuzu personel listesi, dönem ayarı (`employees`, `managers`) | Yönetim rolleri | İK |
| Yetenek Havuzu değerlendirmeleri (`evaluations`) | Yönetim rolleri | İK; yönetim rolleri kendi oturumu, kendi adı ve sunucu saatiyle imzalayarak (arşiv işareti yalnız İK). **Tamamlanmış** bir değerlendirmeyi yalnız onu tamamlayan kişi ya da İK değiştirebilir; taslaklar yönetim rollerince devam ettirilebilir |
| Aday dosyaları, personel talepleri | İK; müdür **yalnız kendi işe alım departmanı** | İK; müdür yalnız kendi departmanı (silme yalnız İK). Yeni kayıt kimliği yalnız otomatik biçimde (20 harf/rakam) |
| Aday dosyası **oluşturma** (başvuru formu) | — | Herkes; yalnız izin verilen alanlar, uzunluk sınırları, HTML etiketi yok, başlangıç durumu sabit, kimlik otomatik biçimde, CV yalnız PDF/Word (arayüz 600 KB, kural en fazla 650.000 bayt) |
| Aday sınavı (`sinavlar/{anahtar}`) | Anahtarı bilen aday **yalnız sınav tamamlanana kadar**; İK ve ilgili departman | İK, ilgili departman oluşturur; aday yalnız bir kez ve yalnız sonuç alanlarını tamamlar |
| Hesaplar (rol, kapsam, aktiflik, kod özeti) | İK; kişi yalnız kendi kaydını | İK; kişi yalnız aktivasyon alanlarını |
| Oturum bağı (`uidBag`) | Kişinin kendisi, İK | Kişi yalnız geçerli kodla, bir kez |
| Giriş adresi (`girisAdresi`) | Tek belge okunabilir (listelenemez; kişisel veri içermez) | Kişi yalnız kendi hesabı için |
| Yukarıda olmayan her şey | **Red** | **Red** |

Kuralların tam metni: [`firestore.rules`](firestore.rules).

## 5. Uygulama güvenliği

- **Betik enjeksiyonu (XSS):** Ortak giriş aynı alan adındaki tüm uygulamalarda geçerli olduğu için,
  İK dışındaki kullanıcıların ya da dışarıdan gelenlerin yazabildiği veriler üç katmanda korunur:
  1. **Kural:** Herkese açık başvurularda HTML etiketi reddedilir. Yeni aday, talep ve sınav kayıtlarının
     kimliği yalnız harf/rakam biçiminde olabilir.
  2. **Girişte doğrulama:** Satış panosunda müdürlerin yazdığı karne, tebliğ ve elle girilen listeler
     veritabanından geldiği anda doğrulanır: kimlik biçimi denetlenir, yıl/ay sayıya çevrilir,
     metinlerdeki `<` `>` zararsız benzerleriyle değiştirilir.
  3. **Ekrana basarken kaçış:** Yetenek Havuzu, İşe Alım, Satış ve Servis ekranları ad, unvan, not,
     gerekçe, kayıt kimliği ve sınav anahtarı gibi değerleri HTML kaçışından geçirir. Yeni pencerede
     açılan rapor/analiz sayfalarına gömülen veriler `</script>` kaçışına karşı korunur.

  İK'nın kendi girdiği veriler (özlük, puantaj vb.) bu kapsamda güvenilen kaynaktır.
- **Herkese açık başvuru formu:** Kural, HTML etiketi (`<`, `>`) içeren alanları reddeder. CV dosyası
  yalnız PDF/Word türünde kabul edilir. İK ekranı CV'yi yalnız PDF olarak açar, diğer her şeyi indirir
  (çalıştırılabilir içerik sitenin adresinde açılmaz).
- **Portal erişim talebi formu:** Yalnız yeni kayıt oluşturur; alan listesi, uzunluklar, e-posta biçimi,
  `durum = yeni`, işaretlenmiş onay (`onay = true`, kayıtta saklanır) ve sunucu saati kuralda zorlanır,
  HTML etiketi reddedilir. Talep hiçbir yetki vermez:
  hesap yine İK tarafından açılır (rol + aktivasyon kodu). Talepler İşe Alım ekranında yalnız İK'ya
  gösterilir ve HTML kaçışından geçirilir.
- **Aday sınavı:** Bağlantı anahtarı 128 bit rastgeledir. Aday yalnız kendi sınav kaydına erişir; aday
  dosyasına ve İK notlarına erişemez. Sınav tamamlandıktan sonra sonuçlar bağlantıyla okunamaz.

## 6. Oturum yönetimi

- Yönetim ve İK hesapları: **30 dakika** işlem yapılmazsa ve en geç **10 saat** sonra oturum kapanır.
- Oturum kapandığında sayfa yenilenir; ekrandaki veriler bellekten silinir. Pano verileri tarayıcı
  depolamasına (localStorage) yazılmaz.
- Not: Süre sınırları istemci tarafında uygulanır. Veri yetkisi her durumda kurallarla sunucuda denetlenir.

## 7. Kaynak kod ve gizli bilgiler

- Depolar GitHub Pages yayını için herkese açıktır. Bu nedenle kaynak kodda **şifre, şifre özeti,
  kişisel veri veya gizli anahtar tutulmaz.** Personel listeleri, danışman bilgileri ve pano verileri
  kaynak koddan çıkarılmıştır; yetkili kullanıcıya girişten sonra veritabanından yüklenir.
- İşe Alım'daki isteğe bağlı yapay zekâ özelliğinin (Google Gemini) API anahtarı kodda değildir.
  Kullanıcının kendi tarayıcısında saklanır. KVKK açısından bkz. §9.

## 8. Değişiklik ve olay yönetimi

- **Kural değişikliği:** `guvenlik/firestore.rules` dosyasında yapılır, git geçmişinde izlenir ve
  Firebase konsolundan (Firestore Database → Kurallar → Yayınla) yayınlanır. Konsol, önceki kural
  sürümlerini de saklar; gerektiğinde tek tıkla geri alınabilir.
- **Hesap kapatma:** İK Sistemi → Ayarlar → Erişim Ayarları → Kullanıcı Hesapları → ⋮ → Hesabı kapat
  (anında etkili).
- **Şüpheli durum / şifre sızıntısı:** İlgili hesaba yeni aktivasyon kodu üretilir; eski şifre ve açık
  oturumlar anında geçersiz olur.
- **Acil durumda tüm erişimi kapatma:** Firebase konsolunda kurallar `allow read, write: if false;`
  ile yayınlanır (tüm istemci erişimi durur, veri korunur).

## 9. Bilinen sınırlar ve yol haritası

| Konu | Durum |
| --- | --- |
| Satış panosunda marka ayrımı arayüzde yapılır: satış müdürü kurallar gereği diğer markaların karne/tebliğlerini de okuyabilir. Elle girilen listeler (eski çalışan, elle danışman, elle fiili) tek belgede tutulduğu için kural bunları marka bazında ayıramaz | Bilinen sınır. Karne/tebliğe marka alanı + marka bazlı kural eklenmesi planlanabilir |
| Servis panosunda kadro listesi tek belgededir: servis müdürü elle danışman eklerken listenin tamamını yazar | Bilinen sınır. Elle eklenenlerin marka bazlı ayrı kayda taşınması planlanabilir |
| Yetenek Havuzu'nda değerlendirici kapsamı (kimi değerlendireceği) arayüzde personel listesinden belirlenir; kural tüm yönetim rollerinin değerlendirmeleri okumasına ve **taslak** değerlendirmeleri güncellemesine izin verir (son kaydeden ve zamanı sunucuda imzalanır) | Bilinen sınır. Kapsam hesaba yazılırsa kurala taşınabilir |
| Aday sınavı puanları adayın tarayıcısında hesaplanır ve sınav sayfası herkese açıktır: bağlantıya sahip teknik bilgili biri sonucu değiştirerek gönderebilir | Bilinen sınır. Puanlar **ön değerlendirme** amaçlıdır; karar, mülakat ve İK değerlendirmesiyle verilir. Sunucu tarafı puanlama ileride eklenebilir |
| Başvuru formu ve portal erişim talebi formu herkese açıktır: toplu sahte kayıt (spam) mümkündür | Firebase **App Check** (reCAPTCHA) önerilir |
| Erişim talebindeki e-posta doğrulanmaz: biri başkası adına talep açabilir | Talep hiçbir yetki vermez; hesap İK tarafından TC ile açılır ve aktivasyon kodu kişiye bilinen bir kanaldan (telefon, yüz yüze) iletilir. İşlenmiş talepler İK'nın belirleyeceği saklama süresi sonunda silinir |
| Giriş adresi kaydı, bir TC Kimlik No ile etkin hesap olup olmadığını belli eder (şifre ya da kişisel veri içermez) | Bilinen sınır. Kaba kuvvete karşı Firebase engeli ve 10 karakter şifre kuralı geçerli |
| İşe Alım'daki yapay zekâ özelliği aday CV/metnini Google Gemini'ye gönderir | **KVKK: IT/hukuk ile değerlendirilecek.** Yurt dışına aktarım ve ücretsiz katmanın veri kullanım koşulları nedeniyle aday aydınlatma metni güncellenmeli, ücretli katman kullanılmalı ya da özellik kapatılmalı |
| Tüm uygulamalar aynı alan adındadır (`inciroglu-ik.github.io`); bir uygulamadaki açık diğerlerinin oturumunu etkileyebilir | İK uygulamalarının ayrı bir alan adına (kurumsal alt alan adı) taşınması önerilir |
| Eski sürümlerde kaynak koda gömülü kalmış kişisel verilerin ve eski şifre özetlerinin **git geçmişinden** temizlenmesi | ⏳ Planlandı (geçmiş yeniden yazılacak, GitHub önbelleği temizletilecek). Eski şifre özetlerinin ait olduğu giriş yöntemi yeni sistemde kullanılmaz |
| Eski sistemden kalan veriler: servis panosundaki eski kullanıcı/şifre özeti listesi (İK'nın ilk açılışında otomatik silinir), eski çalışan giriş listesi (`mrCalisanAuth`, İK Sistemi'nden silinir), eski Firebase kullanıcıları (hesaba bağlı olmadıkları için hiçbir veriye erişemez; konsoldan devre dışı bırakılmalı) | Canlıya geçiş adımlarında temizlenir |
| Çalışan self-servis uygulamasının yeni girişle açılması | ⏳ Dalga 3 (uygulama geçici olarak bilgilendirme sayfasıdır) |
| API anahtarının Google Cloud konsolunda alan adıyla (HTTP referrer) kısıtlanması | Öneri |
| Sunucu tarafı parola politikası (Identity Platform) ve iki adımlı doğrulama (MFA) | Öneri |
| Firestore yedekleme (zamanlanmış yedek / zaman içinde geri yükleme) | Öneri (ücretli plan gerektirir) |
| Firestore veri konumu ve KVKK yurt dışı aktarım değerlendirmesi | IT/hukuk ile değerlendirilecek |
| Firebase projesi ve GitHub organizasyonu yöneticilerinde iki adımlı doğrulama, yetki gözden geçirmesi | Öneri |

## 10. Sorumluluk

- **Uygulamalar ve kurallar:** İnsan Kaynakları (sistem sahibi), bu depo üzerinden.
- **Altyapı:** Google Firebase / Google Cloud (kimlik ve veritabanı) ve GitHub (barındırma).
- Firebase projesi ve GitHub organizasyonu erişimleri, şirket hesaplarıyla ve iki adımlı doğrulamayla
  yönetilmelidir. IT ekibinin denetim için okuma yetkisiyle eklenmesi önerilir.
