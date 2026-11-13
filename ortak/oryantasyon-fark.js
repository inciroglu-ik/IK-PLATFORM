/* =============================================================================
   İnciroğlu Otomotiv · Oryantasyon Formları — VERİ YAPISI ve KARŞILAŞTIRMA (saf; Firebase içermez)
   oryantasyon.html kullanır. Ana form (İK) ile bir müdürün düzenlediği kopya arasındaki farkı çıkarır:
   değişen alanlar, eklenen / silinen maddeler, yeri (sırası ya da bölümü) değişen maddeler, bölüm adı
   değişiklikleri, eklenen / silinen bölümler, üst bilgi alanı değişiklikleri.

   Form yapısı:
   { alanlar:  [{ id, ad }],                                   // formun üstündeki personel bilgi alanları
     bolumler: [{ id, ad, maddeler: [{ id, plan, kapsam, termin, saat, sure, sorumlu, aciklama }] }] }
   Kimlikler (id) kalıcıdır; karşılaştırma kimlikle yapılır.
   TUTARLILIK İLKESİ: sayaçtaki her sayı, inceleme ekranında aynı sayıda işarete karşılık gelir
   (sarı = degisen, yeşil = eklenen, üstü çizili = silinen, "Yeri değişti" = sira, bölüm işaretleri = bolum*).
   ============================================================================= */

/** İlk etap: 2026'da en çok alım yapılan 5 unvan (İK Dashboard › İşe Alım › En çok alınan 5 unvan)
    + satış müdürü ve servis müdürü (13.11.2026) */
export const UNVANLAR = [
  { kod: 'otomotiv-mekanikcisi', ad: 'Otomotiv Mekanikçisi' },
  { kod: 'satis-danismani', ad: 'Satış Danışmanı' },
  { kod: 'oto-yikama-elemani', ad: 'Oto Yıkama Elemanı' },
  { kod: 'servis-danismani', ad: 'Servis Danışmanı' },
  { kod: 'resepsiyonist', ad: 'Resepsiyonist' },
  { kod: 'satis-muduru', ad: 'Satış Müdürü' },
  { kod: 'servis-muduru', ad: 'Servis Müdürü' }
];

/** Madde alanları (Excel formundaki sütunlar) — sıra = ekrandaki sıra */
export const ALANLAR = [
  { k: 'plan', ad: 'Gün planı' },
  { k: 'kapsam', ad: 'Kapsam' },
  { k: 'termin', ad: 'Tarih / termin' },
  { k: 'saat', ad: 'Saat' },
  { k: 'sure', ad: 'Süre (dk)' },
  { k: 'sorumlu', ad: 'Oryantasyon sorumlusu' },
  { k: 'aciklama', ad: 'Açıklama / yorum' }
];
export const ALAN_AD = Object.fromEntries(ALANLAR.map((a) => [a.k, a.ad]));
export const SINIR = 2000;            /* bir alanın en fazla karakteri */
export const EN_FAZLA = { alan: 30, bolum: 40 };   /* güvenlik kuralıyla aynı */

export function yeniKimlik(on = 'y') {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return on + '_' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
export const kopya = (o) => JSON.parse(JSON.stringify(o == null ? null : o));
/** Karşılaştırma için metin: boşluklar sadeleşir, baş/son boşluk yok */
export const sade = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
/** Kaydedilecek metin: satır sonları korunur, < > yok, sınırlı */
export const temiz = (v, n = SINIR) => String(v == null ? '' : v).replace(/[<>]/g, ' ').replace(/\r\n?/g, '\n').slice(0, n);

/** Formu kaydetmeden / göstermeden önce düzenler: eksik alanları tamamlar, metinleri temizler,
    boş ya da TEKRARLANAN kimliğe yenisini verir (bozuk bir kayıt ekranı çökertmesin). Aynı girdiye hep aynı çıktıyı verir. */
export function formuDuzenle(f) {
  const g = f && typeof f === 'object' && !Array.isArray(f) ? f : {};
  const gorulen = new Set();
  const kimlik = (v, on) => { let id = v == null || v === '' ? '' : String(v).slice(0, 40); if (!id || gorulen.has(id)) { let i = 1; do { id = on + '_t' + (gorulen.size + i++); } while (gorulen.has(id)); } gorulen.add(id); return id; };
  const dizi = (x) => (Array.isArray(x) ? x : []);
  return {
    alanlar: dizi(g.alanlar).slice(0, EN_FAZLA.alan).map((a) => ({ id: kimlik(a && a.id, 'a'), ad: temiz(a && a.ad, 200) })),
    bolumler: dizi(g.bolumler).slice(0, EN_FAZLA.bolum).map((b) => ({
      id: kimlik(b && b.id, 'b'), ad: temiz(b && b.ad, 200),
      maddeler: dizi(b && b.maddeler).map((m) => {
        const x = { id: kimlik(m && m.id, 'm') };
        ALANLAR.forEach((a) => { x[a.k] = temiz(m && m[a.k]); });
        return x;
      })
    }))
  };
}
export const maddeSayisi = (f) => ((f && f.bolumler) || []).reduce((s, b) => s + ((b.maddeler || []).length), 0);
/** İki form içerik olarak aynı mı (boşluk farkı yok sayılır, sıra dahil) */
export function ayniMi(a, b) { return farkHesapla(a, b).sayac.toplam === 0; }

/* En uzun artan alt dizi: yerinde kalan maddeleri bulur; geri kalanlar "yeri değişti" sayılır (en az hareket).
   Eşitlikte sonraki öğeler yerinde sayılır: yan yana iki madde yer değiştirdiğinde etiket öne (yukarı) gelen maddeye düşer. */
function yerindeKalanlar(dizi) {
  const n = dizi.length, uz = new Array(n).fill(1), once = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) if (dizi[j] < dizi[i] && uz[j] + 1 >= uz[i]) { uz[i] = uz[j] + 1; once[i] = j; }
  let en = -1; for (let i = 0; i < n; i++) if (en < 0 || uz[i] >= uz[en]) en = i;
  const s = new Set(); while (en >= 0) { s.add(en); en = once[en]; }
  return s;
}

/** farkHesapla(taban, yeni) → ayrıntılı karşılaştırma
    {
      madde:  { [maddeId]: { tur:'yeni'|'degisti'|'ayni', eski:{alan:eskiDeger}, siraDegisti:bool, tasindi:bool, eskiBolum, eskiSira (ana formdaki 0 tabanlı sıra) } },
      bolum:  { [bolumId]: { tur:'yeni'|'degisti'|'ayni', eskiAd } },
      alan:   { [alanId]: { tur:'yeni'|'degisti'|'ayni', eskiAd } },
      silinenMaddeler: [{ madde, bolumId, bolumAd, sira }],     // YALNIZ duran bölümlerden silinenler
      silinenBolumler: [{ bolum, sira, maddeler:[…] }],         // bölümle birlikte silinen maddeler burada (ayrıca sayılmaz)
      silinenAlanlar:  [{ alan, sira }],
      sayac: { degisen, eklenen, silinen, sira, bolumDegisen, bolumEklenen, bolumSilinen, bolumMaddeSilinen (bilgi; toplama girmez), alanDegisen, alanEklenen, alanSilinen, toplam }
    } */
export function farkHesapla(taban, yeni) {
  const T = formuDuzenle(taban), Y = formuDuzenle(yeni);
  const sonuc = { madde: {}, bolum: {}, alan: {}, silinenMaddeler: [], silinenBolumler: [], silinenAlanlar: [],
    sayac: { degisen: 0, eklenen: 0, silinen: 0, sira: 0, bolumDegisen: 0, bolumEklenen: 0, bolumSilinen: 0, bolumMaddeSilinen: 0, alanDegisen: 0, alanEklenen: 0, alanSilinen: 0, toplam: 0 } };
  const S = sonuc.sayac;
  /* üst bilgi alanları */
  const tAlan = new Map(T.alanlar.map((a, i) => [a.id, { a, i }]));
  const yAlanId = new Set(Y.alanlar.map((a) => a.id));
  Y.alanlar.forEach((a) => {
    const t = tAlan.get(a.id);
    if (!t) { sonuc.alan[a.id] = { tur: 'yeni' }; S.alanEklenen++; }
    else if (sade(t.a.ad) !== sade(a.ad)) { sonuc.alan[a.id] = { tur: 'degisti', eskiAd: t.a.ad }; S.alanDegisen++; }
    else sonuc.alan[a.id] = { tur: 'ayni' };
  });
  T.alanlar.forEach((a, i) => { if (!yAlanId.has(a.id)) { sonuc.silinenAlanlar.push({ alan: a, sira: i }); S.alanSilinen++; } });
  /* maddeler */
  const tMadde = new Map();
  T.bolumler.forEach((b) => b.maddeler.forEach((m, i) => tMadde.set(m.id, { m, bolumId: b.id, bolumAd: b.ad, sira: i })));
  const tBolum = new Map(T.bolumler.map((b, i) => [b.id, { b, i }]));
  const yMaddeId = new Set();
  Y.bolumler.forEach((b) => {
    const tb = tBolum.get(b.id);
    if (!tb) { sonuc.bolum[b.id] = { tur: 'yeni' }; S.bolumEklenen++; }
    else if (sade(tb.b.ad) !== sade(b.ad)) { sonuc.bolum[b.id] = { tur: 'degisti', eskiAd: tb.b.ad }; S.bolumDegisen++; }
    else sonuc.bolum[b.id] = { tur: 'ayni' };
    const ayniBolumdeki = [];               /* bu bölümde zaten olan maddeler (sıra karşılaştırması için) */
    b.maddeler.forEach((m) => {
      yMaddeId.add(m.id);
      const t = tMadde.get(m.id);
      if (!t) { sonuc.madde[m.id] = { tur: 'yeni', eski: {}, siraDegisti: false, tasindi: false }; S.eklenen++; return; }
      const eski = {};
      ALANLAR.forEach((a) => { if (sade(t.m[a.k]) !== sade(m[a.k])) eski[a.k] = t.m[a.k]; });
      const tasindi = t.bolumId !== b.id;
      const degisti = Object.keys(eski).length > 0;
      sonuc.madde[m.id] = { tur: degisti ? 'degisti' : 'ayni', eski, siraDegisti: false, tasindi, eskiBolum: tasindi ? t.bolumAd : null, eskiSira: t.sira };
      if (degisti) S.degisen++;
      if (tasindi) S.sira++;
      else ayniBolumdeki.push({ id: m.id, tabanSira: t.sira });
    });
    const yerinde = yerindeKalanlar(ayniBolumdeki.map((x) => x.tabanSira));
    ayniBolumdeki.forEach((x, i) => { if (!yerinde.has(i)) { sonuc.madde[x.id].siraDegisti = true; S.sira++; } });
  });
  const yBolumId = new Set(Y.bolumler.map((b) => b.id));
  T.bolumler.forEach((b, i) => {
    const giden = b.maddeler.filter((m) => !yMaddeId.has(m.id));
    if (!yBolumId.has(b.id)) { sonuc.silinenBolumler.push({ bolum: b, sira: i, maddeler: giden }); S.bolumSilinen++; S.bolumMaddeSilinen += giden.length; return; }
    b.maddeler.forEach((m, j) => { if (!yMaddeId.has(m.id)) { sonuc.silinenMaddeler.push({ madde: m, bolumId: b.id, bolumAd: b.ad, sira: j }); S.silinen++; } });
  });
  S.toplam = S.degisen + S.eklenen + S.silinen + S.sira + S.bolumDegisen + S.bolumEklenen + S.bolumSilinen + S.alanDegisen + S.alanEklenen + S.alanSilinen;
  return sonuc;
}

/** Kısa özet metni: "4 madde düzenlendi · 2 madde eklendi · 1 madde silindi · 1 maddenin yeri değişti" */
export function ozetMetni(s) {
  if (!s || !s.toplam) return 'Değişiklik yok';
  const p = [];
  if (s.degisen) p.push(s.degisen + ' madde düzenlendi');
  if (s.eklenen) p.push(s.eklenen + ' madde eklendi');
  if (s.silinen) p.push(s.silinen + ' madde silindi');
  if (s.sira) p.push(s.sira + ' maddenin yeri değişti');
  if (s.bolumEklenen) p.push(s.bolumEklenen + ' bölüm eklendi');
  if (s.bolumSilinen) p.push(s.bolumSilinen + ' bölüm silindi' + (s.bolumMaddeSilinen ? ' (içindeki ' + s.bolumMaddeSilinen + ' maddeyle)' : ''));
  if (s.bolumDegisen) p.push(s.bolumDegisen + ' bölüm adı değişti');
  const a = (s.alanDegisen || 0) + (s.alanEklenen || 0) + (s.alanSilinen || 0);
  if (a) p.push(a + ' üst bilgi değişikliği');
  return p.join(' · ');
}
