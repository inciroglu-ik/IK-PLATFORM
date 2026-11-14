/* ============================================================================
   AJAN OFİSİ · AKIŞ — toplantı, görev dağıtımı, çalışma, dosya teslimi, puanlama,
   teşvik, işe alım/çıkarma, zamanlanmış işler ve ofis içi sohbetler.
   Sahne (görsel), beyin (Claude) ve veri (Firestore) dışarıdan verilir.
   ============================================================================ */
import {
  ROLLER, ROL, KADEMELER, kademeBilgisi, unvan, yeniAdSec,
  planIstegi, adimIstegi, puanIstegi, icerikAviIstegi, rakipRaporuIstegi, muhasebeIstegi, stratejiIstegi,
  planTemizle, puanTemizle, teslimNotuAyir, kodBlogu, videoPlaniAyir,
  vadesiGelenler, ZAMANLI_ISLER, trTarih, isoHafta, ayAnahtari, harcamaOzeti, zamanliSonuc,
  performans, kadroKararlari, kadroPuanIsle, SOHBETLER, ROL_SOHBETLERI, TESEKKURLER, ONAYLAR, sistemMetni,
  azamiTahmin, VARSAYILAN_MODEL
} from './kadro.js';

const rastgele = (d) => d[Math.floor(Math.random() * d.length)];
const kisalt = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };
const para = (n) => '$' + (Number(n) || 0).toFixed((Number(n) || 0) < 1 ? 3 : 2);

export function akisKur({ sahne, beyin, veri, durum, kayit, bildir }) {
  const K = sahne.KONUM;
  const mesgul = new Map();                 /* rol → sayaç (sohbet döngüsü bunlara dokunmaz) */
  const sohbette = new Map();               /* rol → sohbet jetonu; iş bu kişiyi isterse sohbet kesilir */
  const mesgulYap = (roller, v) => {
    for (const r of roller) {
      if (v && sohbette.has(r)) sohbette.get(r).kesildi = true;
      const n = (mesgul.get(r) || 0) + (v ? 1 : -1); if (n > 0) mesgul.set(r, n); else mesgul.delete(r);
    }
  };
  const bosMu = (r) => !mesgul.has(r) && !sohbette.has(r) && !sahne.yuruyorMu(r);
  const calisan = (rol) => (durum.kadro().calisanlar || {})[rol] || { ad: ROL[rol].baslangicAd, kademe: ROL[rol].baslangicKademe, no: 1 };
  const olay = (o) => { kayit && kayit(o); };

  /* ------------------------------------------------ iş kuyruğu (aynı anda tek iş) */
  let zincir = Promise.resolve(); let bekleyen = 0; let aktifEtiket = '';
  function kuyruk(etiket, fn) {
    bekleyen++; bildir({ tur: 'kuyruk', bekleyen, aktif: aktifEtiket });
    const p = zincir.then(async () => {
      aktifEtiket = etiket; bildir({ tur: 'kuyruk', bekleyen, aktif: etiket });
      try { await fn(); } catch (e) { olay({ tur: 'hata', metin: beyin.hataMetni(e) }); bildir({ tur: 'hata', metin: beyin.hataMetni(e) }); }
      finally { bekleyen--; aktifEtiket = ''; bildir({ tur: 'kuyruk', bekleyen, aktif: '' }); }
    });
    zincir = p.catch(() => {});
    return p;
  }
  const mesgulMu = () => bekleyen > 0;

  /* ------------------------------------------------ Claude çağrısı + bütçe + harcama defteri */
  async function cagir(rol, istek, { isId, tur } = {}) {
    const ayar = durum.ayar(); const butce = Number(ayar.aylikButce) || 0; const harcanan = durum.ayHarcama();
    if (butce > 0 && harcanan >= butce) {
      const e = new Error('Aylık bütçe doldu (' + para(harcanan) + ' / ' + para(butce) + '). Ayarlar’dan bütçeyi artırabilirsiniz.'); e.kod = 'butce'; throw e;
    }
    /* En kötü durum ön kontrolü: bu çağrı bütçeyi aşabilecekse başlatma */
    const tahmin = azamiTahmin(ayar.model || VARSAYILAN_MODEL, istek, 16000);
    if (butce > 0 && harcanan + tahmin > butce) {
      const e = new Error('Kalan aylık bütçe (' + para(butce - harcanan) + ') bu çağrının olası en yüksek maliyetine (' + para(tahmin) + ') yetmiyor. Ayarlar’dan bütçeyi artırabilirsiniz.'); e.kod = 'butce'; throw e;
    }
    const c = calisan(rol);
    const kaydet = (k, sure, model, effort, hata) => veri.harcamaEkle({
      rol, ad: c.ad, kademe: c.kademe | 0, model: model || ayar.model, effort: effort || kademeBilgisi(c.kademe).effort,
      giris: k.giris, cikis: k.cikis, okuma: k.okuma, yazma: k.yazma, arama: k.arama, maliyet: k.maliyet,
      sureMs: sure || 0, isId: isId || null, tur: tur || 'is', hata: hata || null, ay: ayAnahtari(), tsMs: Date.now()
    }).catch(() => { olay({ tur: 'hata', metin: 'Harcama kaydı yazılamadı (' + para(k.maliyet) + ').' }); });
    try {
      const s = await beyin.dusun(istek, { model: ayar.model, kademe: c.kademe });
      await kaydet(s.kullanim, s.sure, s.model, s.effort, null);
      return s;
    } catch (e) {
      if (e && e.kullanim) await kaydet(e.kullanim, e.sure, null, null, e.kod || 'hata');
      throw e;
    }
  }

  /* ------------------------------------------------ küçük sahne yardımcıları */
  async function teslimEt(kimden, kime, not) {
    if (kimden === kime) { await sahne.konus(kimden, 'Bir sonraki adım da bende, devam ediyorum.', 1800); return; }
    mesgulYap([kimden, kime], true);
    sahne.dosya(kimden, true);
    await sahne.yuru(kimden, K.masaOnu(kime));
    olay({ tur: 'teslim', rol: kimden, kime, metin: not });
    await sahne.konus(kimden, not || 'Dosya hazır, sende.', null);
    sahne.dosya(kimden, false); sahne.dosya(kime, true);
    await sahne.konus(kime, rastgele(TESEKKURLER), 1700);
    sahne.dosya(kime, false);
    sahne.yuru(kimden, K.masa(kimden)).then(() => mesgulYap([kimden], false));
    mesgulYap([kime], false);
  }
  async function panoyaAs(rol, cumle) {
    mesgulYap([rol], true);
    sahne.dosya(rol, true);
    await sahne.yuru(rol, K.pano());
    sahne.dosya(rol, false);
    await sahne.konus(rol, cumle, 2600);
    await sahne.yuru(rol, K.masa(rol));
    mesgulYap([rol], false);
  }

  /* ------------------------------------------------ ANA AKIŞ: ofis sahibinin verdiği iş */
  function isVer(metin) {
    const temiz = String(metin || '').trim();
    if (!temiz) return null;
    const p = (async () => {
      const id = await veri.isOlustur({ metin: temiz, durum: 'sirada', olusturmaMs: Date.now() });
      olay({ tur: 'is', metin: 'Yeni iş alındı: ' + kisalt(temiz, 80) });
      kuyruk('İş: ' + kisalt(temiz, 40), () => isYurut(id, temiz));
      return id;
    })();
    return p;
  }

  async function isYurut(id, metin) {
    const gm = 'genel_mudur';
    const herkes = ROLLER.map((r) => r.id);
    let adimlar = [], planMaliyet = 0, puanMaliyet = 0, plan = null;
    const toplamMaliyet = () => +(adimlar.reduce((s, a) => s + (a.maliyet || 0), 0) + planMaliyet + puanMaliyet).toFixed(6);
    mesgulYap(herkes, true);
    /* Nabız: sekme kapanır / bağlantı koparsa iş "yarıda kaldı" olarak tanınır (sayfa açılışında temizlenir) */
    const nabiz = setInterval(() => { veri.isGuncelle(id, { nabizMs: Date.now() }).catch(() => {}); }, 60000);
    try {
      /* 1) toplantı çağrısı — plan isteği yürüyüşle eşzamanlı başlar */
      sahne.durum(gm, 'dusunuyor');
      await sahne.konus(gm, 'Yeni bir iş geldi. Herkes toplantı salonuna lütfen!', 2400);
      const planP = cagir(gm, planIstegi(metin), { isId: id, tur: 'plan' });
      planP.catch(() => {});
      sahne.tahta({ baslik: kisalt(metin, 60), adimlar: [] });
      await veri.isGuncelle(id, { durum: 'toplanti', nabizMs: Date.now() });
      const yuru = [sahne.yuru(gm, K.tahtaOnu())]; let i = 0;
      for (const r of ROLLER) if (r.id !== gm) yuru.push(sahne.yuru(r.id, K.sandalye(i++)));
      await Promise.all(yuru);
      await sahne.konus(gm, 'İşi inceliyorum, bir dakika…', 1800);
      let ps;
      try { ps = await planP; } catch (e) { await isHatasi(id, gm, e, { asama: 'plan' }); return; }
      planMaliyet = ps.kullanim.maliyet;
      plan = planTemizle(ps.json);
      sahne.durum(gm, 'bos');
      if (!plan.adimlar.length) { await isHatasi(id, gm, new Error('Plan boş geldi; işi biraz daha açık yazar mısınız?'), { asama: 'plan' }); return; }
      await veri.isGuncelle(id, { plan, durum: 'calisiyor', planMaliyet });
      sahne.tahta(plan);
      bildir({ tur: 'plan', id, plan });
      await sahne.konus(gm, plan.konusma || ('Bugünkü işimiz: ' + plan.baslik + '.'), null);
      for (const [k, a] of plan.adimlar.entries()) {
        sahne.tahta(Object.assign({}, plan, { aktif: k }));
        await sahne.konus(gm, (k + 1) + '. adım ' + calisan(a.rol).ad + ' (' + ROL[a.rol].ad + '): ' + kisalt(a.gorev, 130), null);
        await sahne.konus(a.rol, rastgele(ONAYLAR), 1500);
      }
      await sahne.konus(gm, plan.adimlar.length > 1 ? 'Dosya sırayla elden ele geçecek. Herkes odasına, kolay gelsin!' : 'Herkes odasına, kolay gelsin!', 2200);
      sahne.tahta(Object.assign({}, plan, { kart: false }));
      await Promise.all(ROLLER.map((r) => sahne.yuru(r.id, K.masa(r.id))));
      mesgulYap(herkes, false);

      /* 2) adımlar */
      const oncekiler = [];
      for (const [k, a] of plan.adimlar.entries()) {
        const rol = a.rol; const c = calisan(rol);
        mesgulYap([rol], true);
        sahne.durum(rol, 'calisiyor');
        bildir({ tur: 'adim', id, aktif: k, plan });
        olay({ tur: 'calisma', rol, metin: c.ad + ' (' + ROL[rol].ad + ') çalışmaya başladı' });
        let s;
        try { s = await cagir(rol, adimIstegi({ isMetni: metin, plan, adimNo: k, oncekiler, kadro: durum.kadro(), ayar: durum.ayar() }), { isId: id, tur: 'adim' }); }
        catch (e) { sahne.durum(rol, 'bos'); mesgulYap([rol], false); adimlar = oncekiler; await isHatasi(id, rol, e, { asama: 'adim', plan, adimlar: oncekiler }); return; }
        sahne.durum(rol, 'bos');
        const { govde, not } = teslimNotuAyir(s.metin);
        const kayitA = {
          rol, ad: c.ad, no: c.no || 1, kademe: c.kademe | 0, gorev: a.gorev, cikti: govde, teslimNotu: not, kaynaklar: s.kaynaklar,
          maliyet: s.kullanim.maliyet, token: { giris: s.kullanim.giris, cikis: s.kullanim.cikis, okuma: s.kullanim.okuma, arama: s.kullanim.arama },
          sureMs: s.sure, model: s.model, effort: s.effort, kesildi: !!s.kesildi, bitisMs: Date.now()
        };
        oncekiler.push(kayitA); adimlar = oncekiler;
        await veri.isGuncelle(id, { adimlar: oncekiler.slice(), nabizMs: Date.now() });
        if (rol === 'model_fotografcisi') { const html = kodBlogu(govde, 'html'); if (html) await veri.notEkle({ tur: 'model', rol, ad: c.ad, baslik: plan.baslik, icerik: govde, html, isId: id, maliyet: s.kullanim.maliyet }); }
        if (rol === 'video_editor') { const vp = videoPlaniAyir(govde); if (vp) await veri.notEkle({ tur: 'video', rol, ad: c.ad, baslik: vp.baslik || plan.baslik, icerik: govde, plan: vp, isId: id, maliyet: s.kullanim.maliyet }); }
        mesgulYap([rol], false);
        const sonraki = plan.adimlar[k + 1];
        await teslimEt(rol, sonraki ? sonraki.rol : gm, not || (sonraki ? 'Benim kısmım hazır, dosya sende.' : 'İş tamamlandı, dosya sizde.'));
      }

      /* 3) puanlama */
      const vt = 'viral_tahmincisi';
      mesgulYap([gm, vt], true);
      await sahne.konus(gm, calisan(vt).ad + ', bu işi puanlar mısın?', 2000);
      await sahne.yuru(vt, K.masaOnu(gm)); sahne.dosya(vt, true);
      await sahne.yuru(vt, K.masa(vt)); sahne.dosya(vt, false);
      sahne.durum(vt, 'calisiyor');
      let puan;
      try {
        const ps2 = await cagir(vt, puanIstegi({ isMetni: metin, plan, adimlar: oncekiler }), { isId: id, tur: 'puan' });
        puanMaliyet = ps2.kullanim.maliyet;
        puan = puanTemizle(ps2.json, oncekiler.length);
      } catch (e) {
        sahne.durum(vt, 'bos'); mesgulYap([gm, vt], false);
        await veri.isGuncelle(id, { durum: 'tamam', puan: null, puanHata: beyin.hataMetni(e), bitisMs: Date.now(), maliyet: toplamMaliyet() });
        await sahne.konus(vt, 'Puanlayamadım: ' + beyin.hataMetni(e), 3500);
        bildir({ tur: 'is-bitti', id, baslik: plan.baslik, puan: null });
        return;
      }
      sahne.durum(vt, 'bos');
      await veri.isGuncelle(id, { durum: 'tamam', puan, bitisMs: Date.now(), maliyet: toplamMaliyet(), puanMaliyet });
      sahne.dosya(vt, true);
      await sahne.yuru(vt, K.masaOnu(gm)); sahne.dosya(vt, false);
      const eksi = puan.eksiler.slice().sort((x, y) => y.puan_kaybi - x.puan_kaybi)[0];
      await sahne.konus(vt, 'Puan: ' + puan.toplam + '/100. ' + kisalt(puan.ozet, 90) + (eksi ? ' En büyük eksi: ' + kisalt(eksi.neden, 70) + ' (−' + eksi.puan_kaybi + ').' : ''), null);
      sahne.yuru(vt, K.masa(vt)).then(() => mesgulYap([vt], false));
      await sahne.konus(gm, puan.toplam >= 80 ? 'Harika iş, herkese teşekkürler!' : puan.toplam >= 60 ? 'Fena değil, ama daha iyisini yapabiliriz.' : 'Bu iş beklentinin altında kaldı; nedenlerini konuşacağız.', 2400);
      mesgulYap([gm], false);
      olay({ tur: 'puan', metin: plan.baslik + ' · ' + puan.toplam + '/100 · ' + para(toplamMaliyet()) });
      bildir({ tur: 'is-bitti', id, baslik: plan.baslik, puan: puan.toplam, maliyet: toplamMaliyet() });

      /* 4) puanlar çalışanların kaydına (işe girişten beri) + ofis müdürü teşviki + 5) genel müdürün kadro kararları */
      try { await veri.kadroKaydet(kadroPuanIsle(durum.kadro(), oncekiler, puan)); } catch (e) { olay({ tur: 'hata', metin: 'Puanlar kadroya işlenemedi: ' + beyin.hataMetni(e) }); }
      await tesvikTuru(oncekiler, puan);
      await kadroGozdenGecir({ id, adimlar: oncekiler, puan, olusturmaMs: Date.now() });
    } finally {
      clearInterval(nabiz);
      mesgulYap(herkes, false);
      for (const r of herkes) { if (mesgul.has(r)) mesgul.delete(r); sahne.durum(r, 'bos'); sahne.dosya(r, false); }
    }
  }

  async function isHatasi(id, rol, e, { asama, plan, adimlar } = {}) {
    const m = beyin.hataMetni(e);
    sahne.durum(rol, 'bos');
    await veri.isGuncelle(id, { durum: 'hata', hata: m, hataAsama: asama || '', bitisMs: Date.now() }).catch(() => {});
    olay({ tur: 'hata', rol, metin: m });
    bildir({ tur: 'hata', metin: m });
    await sahne.konus(rol, 'Bir sorun çıktı: ' + m, 4200);
    if (asama === 'plan') {
      sahne.tahta(null);
      await Promise.all(ROLLER.map((r) => sahne.yuru(r.id, K.masa(r.id))));
    }
  }

  async function tesvikTuru(adimlar, puan) {
    const om = 'ofis_muduru';
    const katkilar = adimlar.map((a, i) => ({ a, p: puan.katkilar[i] })).filter((x) => x.p && x.p.puan != null && x.a.rol !== om);
    if (!katkilar.length) return;
    const sirali = katkilar.slice().sort((x, y) => x.p.puan - y.p.puan);
    const enDusuk = sirali[0], enYuksek = sirali[sirali.length - 1];
    mesgulYap([om], true);
    try {
      if (enDusuk.p.puan < 70) {
        await sahne.yuru(om, K.masaOnu(enDusuk.a.rol));
        await sahne.konus(om, enDusuk.a.ad + ', bu işte katkı puanın ' + enDusuk.p.puan + '. ' + (enDusuk.p.yorum ? 'Viral’in notu: “' + kisalt(enDusuk.p.yorum, 90) + '”. ' : '') + 'Bir sonrakinde toparlarız, sana güveniyorum.', null);
        await sahne.konus(enDusuk.a.rol, 'Haklısın, bir dahaki sefere daha dikkatli olacağım.', 1900);
      }
      if (enYuksek.p.puan >= 85 && enYuksek !== enDusuk) {
        await sahne.yuru(om, K.masaOnu(enYuksek.a.rol));
        await sahne.konus(om, enYuksek.a.ad + ', ' + enYuksek.p.puan + ' puan! Tebrikler, ekibe örnek oldun.', 2600);
        await sahne.konus(enYuksek.a.rol, 'Teşekkürler, ekip işi!', 1500);
      }
      await sahne.yuru(om, K.masa(om));
    } finally { mesgulYap([om], false); }
  }

  async function kadroGozdenGecir(sonIs) {
    const kadro = durum.kadro();
    const isler = durum.isler().filter((x) => x.id !== sonIs.id).concat([sonIs]);
    const perf = performans(isler, kadro);
    const kararlar = kadroKararlari(perf, kadro);
    if (!kararlar.length) return;
    const gm = 'genel_mudur';
    mesgulYap([gm], true);
    try {
      for (const k of kararlar) {
        mesgulYap([k.rol], true);
        await sahne.yuru(gm, K.masaOnu(k.rol));
        const ortMetni = String(k.ort).replace('.', ',');
        if (k.tur === 'uyari') {
          await sahne.konus(gm, k.ad + ', işe girdiğinden beri ortalaman ' + ortMetni + '. Zaten en üst kademedesin; bir sonraki işlerde toparlanmanı bekliyorum.', null);
          await sahne.konus(k.rol, 'Anlaşıldı, toparlayacağım.', 1600);
          mesgulYap([k.rol], false);
          continue;
        }
        /* Önce kayıt: yazılamazsa kimse çıkarılmaz (sahnede gizli kalan çalışan olmaz) */
        const guncel = durum.kadro();
        const eski = guncel.calisanlar[k.rol];
        const yeniAd = yeniAdSec(guncel, Date.now());
        const yeni = { ad: yeniAd, kademe: k.yeniKademe, no: (eski.no || 1) + 1, iseGirisMs: Date.now(), puanlar: [] };
        const kayitG = { tarihMs: Date.now(), rol: k.rol, cikan: eski.ad, giren: yeniAd, ort: k.ort, eskiKademe: k.eskiKademe, yeniKademe: k.yeniKademe, neden: 'İşe girişten beri ortalama ' + ortMetni + ' (eşik 60)' };
        const yeniKadro = { calisanlar: Object.assign({}, guncel.calisanlar, { [k.rol]: yeni }), gecmis: (guncel.gecmis || []).concat([kayitG]).slice(-60), surum: guncel.surum || 'eski' };
        try { await veri.kadroKaydet(yeniKadro); }
        catch (e) { await sahne.konus(gm, 'Kadro kaydı yapılamadı (' + beyin.hataMetni(e) + '); kararı erteliyorum.', 2600); mesgulYap([k.rol], false); continue; }
        await sahne.konus(gm, k.ad + ', işe girdiğinden beri ortalaman ' + ortMetni + '; beklentimiz en az 60. Yollarımızı ayırıyoruz. Emeğin için teşekkürler.', null);
        await sahne.konus(k.rol, 'Anlıyorum. Ekibe başarılar dilerim.', 1800);
        sahne.kutu(k.rol, true);
        await sahne.yuru(k.rol, K.giris());
        sahne.kutu(k.rol, false); sahne.gizle(k.rol, true);
        olay({ tur: 'kadro', metin: eski.ad + ' ayrıldı, yerine ' + yeniAd + ' (' + unvan(k.rol, k.yeniKademe) + ') geldi' });
        bildir({ tur: 'kadro', kayit: kayitG });
        sahne.isimGuncelle(k.rol, yeniAd, k.yeniKademe);
        sahne.isinlan(k.rol, K.giris()); sahne.gizle(k.rol, false);
        await sahne.yuru(k.rol, K.masaOnu(k.rol));
        const kb = kademeBilgisi(k.yeniKademe);
        await sahne.konus(k.rol, 'Merhaba, ben ' + yeniAd + '. Yeni ' + unvan(k.rol, k.yeniKademe) + ' olarak başlıyorum. Daha derin çalışacağım (' + kb.effort + ').', null);
        await sahne.konus(gm, 'Hoş geldin ' + yeniAd + '. Masan hazır.', 1800);
        await sahne.yuru(k.rol, K.masa(k.rol));
        mesgulYap([k.rol], false);
      }
      await sahne.yuru(gm, K.masa(gm));
    } finally { mesgulYap([gm], false); }
  }

  /* ------------------------------------------------ zamanlanmış işler (sayfa açıkken telafi) */
  async function zamanliIs(id, anahtar, { zorla } = {}) {
    const tanim = ZAMANLI_ISLER.find((z) => z.id === id); if (!tanim) return;
    const kilitId = await veri.zamanKilitAl(id, anahtar, !!zorla);
    if (!kilitId) return;
    const rol = tanim.rol; const c = calisan(rol); const ayar = durum.ayar();
    mesgulYap([rol], true);
    sahne.durum(rol, 'calisiyor');
    olay({ tur: 'calisma', rol, metin: c.ad + ' · ' + tanim.ad + ' başladı' });
    try {
      let istek;
      if (id === 'icerik') istek = icerikAviIstegi(trTarih(), ayar);
      else if (id === 'rakip') istek = rakipRaporuIstegi(isoHafta(), ayar);
      else {
        const kayitlar = await veri.harcamaListesi(30);
        istek = muhasebeIstegi(harcamaOzeti(kayitlar));
      }
      const s = await cagir(rol, istek, { tur: id });
      const z = zamanliSonuc(id, s);
      if (z.ayarYamasi) await veri.ayarGuncelle(z.ayarYamasi);
      const baslik = z.baslik;
      await veri.notEkle(Object.assign({ tur: id, rol, ad: c.ad, baslik, icerik: z.icerik, kaynaklar: s.kaynaklar, maliyet: s.kullanim.maliyet, kaynak: 'sayfa' }, z.ek));
      await veri.zamanBitir(id, anahtar, kilitId);
      sahne.durum(rol, 'bos');
      await panoyaAs(rol, id === 'icerik' ? 'Bugünkü içerik notunuz panoda.' : id === 'rakip' ? 'Haftalık rakip raporu panoya asıldı.' : 'Muhasebe raporu ve tasarruf ayarları hazır.');
      bildir({ tur: 'not', baslik });
    } catch (e) {
      sahne.durum(rol, 'bos');
      await veri.zamanBirak(id, kilitId, (e && e.kod) || 'hata').catch(() => {});
      await sahne.konus(rol, 'Bugünkü görevi yapamadım: ' + beyin.hataMetni(e), 4000);
      throw e;
    } finally { mesgulYap([rol], false); }
  }
  const planlanan = new Set();          /* aynı oturumda aynı vade iki kez sıraya girmesin */
  function zamanKontrol(zaman) {
    if (!beyin.anahtarVar()) return;
    for (const v of vadesiGelenler(zaman)) {
      const k = v.id + '|' + v.anahtar;
      if (planlanan.has(k)) continue;
      planlanan.add(k);
      kuyruk(ZAMANLI_ISLER.find((z) => z.id === v.id).ad, () => zamanliIs(v.id, v.anahtar).catch((e) => { planlanan.delete(k); throw e; }));
    }
  }
  function simdiCalistir(id) {
    const anahtar = id === 'rakip' ? isoHafta() : trTarih();
    return kuyruk(ZAMANLI_ISLER.find((z) => z.id === id).ad, () => zamanliIs(id, anahtar, { zorla: true }));
  }

  function stratejiIste(hedefler) {
    return kuyruk('Strateji', async () => {
      const rol = 'mentalite_kocu'; const c = calisan(rol);
      mesgulYap([rol], true); sahne.durum(rol, 'calisiyor');
      try {
        const s = await cagir(rol, stratejiIstegi(hedefler, durum.ayar()), { tur: 'strateji' });
        await veri.notEkle({ tur: 'strateji', rol, ad: c.ad, baslik: 'Hedeflerin için strateji · ' + trTarih(), icerik: s.metin, maliyet: s.kullanim.maliyet, kaynak: 'sayfa' });
        sahne.durum(rol, 'bos'); mesgulYap([rol], false);
        await panoyaAs(rol, 'Hedeflerin için stratejini hazırladım, panoda.');
        bildir({ tur: 'not', baslik: 'Strateji hazır' });
      } finally { sahne.durum(rol, 'bos'); if (mesgul.has(rol)) mesgulYap([rol], false); }
    });
  }
  function ofisRaporuIste() {
    return kuyruk('Ofis raporu', async () => {
      const rol = 'ofis_muduru'; const c = calisan(rol);
      const perf = performans(durum.isler(), durum.kadro());
      const veriOzet = ROLLER.map((r) => { const x = perf[r.id]; const k = calisan(r.id); return { departman: r.ad, calisan: k.ad, unvan: unvan(r.id, k.kademe), katki: x.katki, ortPuan: x.ortPuan, iseGiristenBeriOrt: x.girisOrt, calismaDk: Math.round(x.sureSn / 60), maliyetUsd: x.maliyet, durum: x.durum }; });
      mesgulYap([rol], true); sahne.durum(rol, 'calisiyor');
      try {
        const istek = { rol, sistem: sistemMetni(rol), mesaj: '# Performans verisi (gerçek kayıtlardan)\n```json\n' + JSON.stringify(veriOzet, null, 1) + '\n```\n\n# İstenen\nOfis performans raporu: kim ne kadar çalıştı, kim verimli, kim gelişmeli; her çalışana bir cümlelik teşvik. Yalnız bu veriyi kullan.', araclar: [], sema: null };
        const s = await cagir(rol, istek, { tur: 'ofis' });
        await veri.notEkle({ tur: 'ofis', rol, ad: c.ad, baslik: 'Ofis performans raporu · ' + trTarih(), icerik: s.metin, maliyet: s.kullanim.maliyet, kaynak: 'sayfa' });
        sahne.durum(rol, 'bos'); mesgulYap([rol], false);
        await panoyaAs(rol, 'Ofis performans raporu panoda.');
      } finally { sahne.durum(rol, 'bos'); if (mesgul.has(rol)) mesgulYap([rol], false); }
    });
  }

  /* ------------------------------------------------ ofis içi sohbet döngüsü (olgu iddiası içermez) */
  let sohbetAcik = true;
  async function sohbetTuru() {
    const bos = ROLLER.map((r) => r.id).filter((r) => bosMu(r) && sahne.ajan(r).gorunur);
    if (bos.length < 2) return;
    const senaryo = Math.random();
    const a = rastgele(bos);
    let b;
    if (senaryo < 0.45) {
      const ayniOda = bos.filter((r) => r !== a && ROL[r].oda === ROL[a].oda);
      if (!ayniOda.length) return;
      b = rastgele(ayniOda);
    } else if (senaryo < 0.75) {
      b = rastgele(bos.filter((r) => r !== a));
    } else {
      b = rastgele(bos.filter((r) => r !== a && ROL[r].oda !== ROL[a].oda && r !== 'genel_mudur'));
    }
    if (!b) return;
    /* Jeton: bu kişilerden biri işe çağrılırsa (mesgulYap) sohbet olduğu yerde biter;
       sohbet onları geri yürütmez — iş akışı kendi hedefine götürür. */
    const j = { kesildi: false };
    sohbette.set(a, j); sohbette.set(b, j);
    const devam = () => !j.kesildi;
    try {
      if (senaryo < 0.45) {
        const s = gununNotuSatiri(a) || rastgele((ROL_SOHBETLERI[ROL[a].oda] || []).concat(SOHBETLER));
        await sahne.konus(a, s[0], null); if (devam()) await sahne.konus(b, s[1], null);
      } else if (senaryo < 0.75) {
        await Promise.all([sahne.yuru(a, K.kahve(0)), sahne.yuru(b, K.kahve(1))]);
        const s = rastgele(SOHBETLER);
        if (devam()) await sahne.konus(a, s[0], null);
        if (devam()) await sahne.konus(b, s[1], null);
        await Promise.all([a, b].map((r) => (mesgul.has(r) ? null : sahne.yuru(r, K.masa(r)))));
      } else {
        await sahne.yuru(a, K.masaOnu(b));
        const s = rastgele(SOHBETLER);
        if (devam()) await sahne.konus(a, s[0], null);
        if (devam()) await sahne.konus(b, s[1], null);
        if (!mesgul.has(a)) await sahne.yuru(a, K.masa(a));
      }
    } finally { if (sohbette.get(a) === j) sohbette.delete(a); if (sohbette.get(b) === j) sohbette.delete(b); }
  }
  function gununNotuSatiri(rol) {
    if (rol !== 'icerik_avcisi' && rol !== 'rakip_analisti') return null;
    const bugun = trTarih();
    const n = (durum.notlar() || []).find((x) => x.rol === rol && x.tarihMs && trTarih(new Date(x.tarihMs)) === bugun);
    if (!n) return null;
    return ['Bugünkü notumun başlığı: “' + kisalt(n.baslik, 60) + '”. Panoya astım.', 'Okuyacağım, sonra konuşalım.'];
  }
  (async function dongu() {
    for (;;) {
      await new Promise((r) => setTimeout(r, (9000 + Math.random() * 9000) / Math.min(sahne.HIZ, 20)));
      if (!sohbetAcik || document.hidden) continue;
      try { await sohbetTuru(); } catch (e) { /* sohbet hatası akışı durdurmaz */ }
    }
  })();

  return { isVer, zamanKontrol, simdiCalistir, stratejiIste, ofisRaporuIste, mesgulMu, sohbet: (v) => { sohbetAcik = !!v; }, cagir };
}
