/* =============================================================================
   İnciroğlu Otomotiv · İşten Ayrılış Anketi — SORU TANIMLARI
   anket.html (çalışanın doldurduğu sayfa) ve ayrilis.html (yönetim sayfası) ortak kullanır.
   Firebase içermez. Sorular 2025–2026'da kullanılan Google Form ile aynıdır (karşılaştırılabilir kalsın).
   ⚠ Faktör anahtarları, seçenek metinleri ve alan adları guvenlik/firestore.rules → "AYRILIŞ ANKETİ"
     bölümündeki listelerle BİREBİR aynı olmalıdır; birini değiştirirseniz kuralı da güncelleyin.
   ============================================================================= */

/** 6 basamaklı etki ölçeği: dizideki sıra = kaydedilen puan (0–5) */
export const OLCEK = ['Etkisi yok', 'Çok az etkisi var', 'Az etkili', 'Orta düzeyde etkisi var', 'Etkili', 'Çok etkili'];
export const OLCEK_KISA = ['Yok', 'Çok az', 'Az', 'Orta', 'Etkili', 'Çok etkili'];
/** "Etkili" sayılan en düşük puan (Etkili = 4, Çok etkili = 5) */
export const ETKILI_ESIK = 4;

/** Ayrılmada etkili olabilecek nedenler (formdaki sırayla) */
export const FAKTORLER = [
  { k: 'tatmin', ad: 'İş tatminsizliği' },
  { k: 'ucret', ad: 'Ücret' },
  { k: 'gorevBelirsiz', ad: 'Görev tanımındaki belirsizlik' },
  { k: 'kariyer', ad: 'Kariyer beklentilerinin karşılanmaması' },
  { k: 'yanHak', ad: 'Diğer yan haklar (servis, yemek vb.)' },
  { k: 'isyeri', ad: 'İşyeri şartları (çalışma ortamı, uzaklık, konum)' },
  { k: 'yonetici', ad: 'Yönetici ile anlaşmazlık' },
  { k: 'arkadas', ad: 'Çalışma arkadaşları ile ilgili sorunlar' },
  { k: 'egitimYetersiz', ad: 'Eğitim olanaklarının yetersizliği' },
  { k: 'odul', ad: 'Ödüllendirmenin yetersizliği' },
  { k: 'isYuku', ad: 'İş yükünün fazlalığı' },
  { k: 'saat', ad: 'Çalışma saatleri' },
  { k: 'sektor', ad: 'Sektör değişikliği' },
  { k: 'ailevi', ad: 'Ailevi nedenler' },
  { k: 'sirketEgitim', ad: 'Şirketin eğitim olanakları' },
  { k: 'evlilik', ad: 'Evlilik' },
  { k: 'askerlik', ad: 'Askerlik' },
  { k: 'tasinma', ad: 'Taşınma' },
  { k: 'saglik', ad: 'Sağlık sorunları' },
  { k: 'kultur', ad: 'Şirket çalışma kültürü' },
  { k: 'okul', ad: 'Okul durumu (devam edilecek eğitim)' },
  { k: 'gorevDisi', ad: 'Görev tanımı dışındaki işlerin yaptırılması' },
  { k: 'isYasam', ad: 'İş / yaşam dengesini koruyamamak' }
];
export const FAKTOR_AD = Object.fromEntries(FAKTORLER.map((f) => [f.k, f.ad]));

export const KARARLAR = ['Bir hafta içinde', 'Bir ay içinde', 'Altı ay içinde', 'Uzun zamandan beri', 'İşe başladıktan hemen sonra'];
export const KIME = ['Yöneticilerime', 'Mesai arkadaşlarıma'];
export const EVET_HAYIR = ['Evet', 'Hayır'];
export const KVKK = ['ONAYLIYORUM.', 'ONAYLAMIYORUM.'];
export const KVKK_METNI = 'İşten ayrılma görüşmemde paylaştığım yanıtların saklanmasını ve ilgili süreçlerde gerekli iyileştirmelerin yapılması amacıyla anonim olarak veri şeklinde kullanılmasını';

/** Serbest metin sınırları (kuraldaki sınırlarla aynı) */
export const SINIR = { uzun: 1500, yonetici: 120 };

/** Kayıt kaynağı: bağlantıyla kişinin doldurduğu · eski Google Form · İK'nın gerçek nedene göre doldurduğu */
export const KAYNAK_AD = { link: 'Bağlantı', google_form: 'Google Form', ik: 'İK doldurdu' };

/** Tek kullanımlık bağlantı anahtarı: "a_" + 32 onaltılık (128 bit, tahmin edilemez) */
export function anahtarUret() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return 'a_' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
export function anahtarGecerli(t) { return /^a_[0-9a-f]{32}$/.test(String(t || '')); }

/** Kuralın kabul ettiği metin: < > yok, uzunluk sınırlı */
export function metinTemizle(s, n = SINIR.uzun) {
  return String(s == null ? '' : s).replace(/[<>]/g, ' ').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim().slice(0, n);
}
