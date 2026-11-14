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
  azamiTahmin, VARSAYILAN_MODEL, MOTOR_CC, CC_TUR_ROL, ccIsDosyasi, ccSonucTemizle, maasHesap, sahipKadroKarari
} from './kadro.js';

const rastgele = (d) => d[Math.floor(Math.random() * d.length)];
const kisalt = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };
const para = (n) => '$' + (Number(n) || 0).toFixed((Number(n) || 0) < 1 ? 3 : 2);

export function akisKur({ sahne, beyin, veri, durum, kayit, bildir, kopru }) {
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
        const yeni = { ad: yeniAd, kademe: k.yeniKademe, no: (eski.no || 1) + 1, iseGirisMs: Date.now(), puanlar: [], maasEk: Math.max(0, eski.maasEk | 0) };
        const kayitG = { tarihMs: Date.now(), rol: k.rol, cikan: eski.ad, giren: yeniAd, ort: k.ort, eskiKademe: k.eskiKademe, yeniKademe: k.yeniKademe, eskiMaas: maasHesap(eski), yeniMaas: maasHesap(yeni), neden: 'İşe girişten beri ortalama ' + ortMetni + ' (eşik 60)' };
        const yeniKadro = { calisanlar: Object.assign({}, guncel.calisanlar, { [k.rol]: yeni }), gecmis: (guncel.gecmis || []).concat([kayitG]).slice(-60), surum: guncel.surum || 'eski' };
        try { await veri.kadroKaydet(yeniKadro); }
        catch (e) { await sahne.konus(gm, 'Kadro kaydı yapılamadı (' + beyin.hataMetni(e) + '); kararı erteliyorum.', 2600); mesgulYap([k.rol], false); continue; }
        await degisimOyna(k.rol, kayitG, k.ad + ', işe girdiğinden beri ortalaman ' + ortMetni + '; beklentimiz en az 60. Yollarımızı ayırıyoruz. Emeğin için teşekkürler.', 'Hoş geldin ' + yeniAd + '. Masan hazır.');
        mesgulYap([k.rol], false);
      }
      await sahne.yuru(gm, K.masa(gm));
    } finally { mesgulYap([gm], false); }
  }

  /* Çıkış + işe giriş sahnesi (kadro kaydı ÖNCE yazılmış olmalı). GM çalışanın masasının önünde. */
  async function degisimOyna(rol, kayit, ayrilikMetni, hosgeldinMetni) {
    const gm = 'genel_mudur';
    await sahne.konus(gm, ayrilikMetni, null);
    await sahne.konus(rol, 'Anlıyorum. Ekibe başarılar dilerim.', 1800);
    sahne.kutu(rol, true);
    await sahne.yuru(rol, K.giris());
    sahne.kutu(rol, false); sahne.gizle(rol, true);
    olay({ tur: 'kadro', metin: kayit.cikan + ' ayrıldı, yerine ' + kayit.giren + ' (' + unvan(rol, kayit.yeniKademe) + ') geldi' });
    bildir({ tur: 'kadro', kayit });
    sahne.isimGuncelle(rol, kayit.giren, kayit.yeniKademe);
    sahne.isinlan(rol, K.giris()); sahne.gizle(rol, false);
    await sahne.yuru(rol, K.masaOnu(rol));
    const kb = kademeBilgisi(kayit.yeniKademe);
    await sahne.konus(rol, 'Merhaba, ben ' + kayit.giren + '. Yeni ' + unvan(rol, kayit.yeniKademe) + ' olarak başlıyorum. ' + (kayit.yeniKademe > kayit.eskiKademe ? 'Daha derin çalışacağım (' + kb.effort + ').' : 'Çalışma derinliğim: ' + kb.effort + '.'), null);
    await sahne.konus(gm, hosgeldinMetni, 2400);
    await sahne.yuru(rol, K.masa(rol));
  }

  /* Ofis sahibinin doğrudan kadro kararı (Claude Code sonucu: kadroKarari) */
  async function ccKadroKarari(s, st) {
    const gm = 'genel_mudur', k = s.kadroKarari;
    st.bitti = true;
    const r = sahipKadroKarari(durum.kadro(), k, Date.now());
    const arsiv = async () => { if (s.dosya) await kopru.arsivle(s.dosya).catch(() => {}); };
    if (r.hata) { await isHatasi(s.isId, gm, new Error(r.hata), { asama: 'cc' }); await veri.isGuncelle(s.isId, { oynatma: Object.assign({}, st) }).catch(() => {}); await arsiv(); return; }
    /* Önce kayıt: yazılamazsa kimse çıkarılmaz */
    try { await veri.kadroKaydet(r.yeniKadro); }
    catch (e) { st.bitti = false; await isHatasi(s.isId, gm, new Error('Kadro kaydı yapılamadı: ' + beyin.hataMetni(e)), { asama: 'cc' }); await arsiv(); return; }
    const baslik = 'Kadro kararı: ' + ROL[k.rol].ad;
    await veri.isGuncelle(s.isId, { durum: 'tamam', plan: { baslik, konusma: '', adimlar: [] }, kadroKarari: r.kayit, bitisMs: Date.now(), maliyet: 0, oynatma: Object.assign({}, st) }).catch(() => {});
    const tl = (n) => Number(n).toLocaleString('tr-TR') + ' TL';
    mesgulYap([gm, k.rol], true);
    try {
      await sahne.konus(gm, 'Ofis sahibinden kadro talimatı geldi.', 2200);
      await sahne.yuru(gm, K.masaOnu(k.rol));
      await degisimOyna(k.rol, r.kayit,
        r.eski.ad + ', ' + (k.neden ? kisalt(k.neden, 110) + ' ' : '') + 'Ofis sahibinin kararıyla yollarımızı ayırıyoruz. Emeğin için teşekkürler.',
        'Hoş geldin ' + r.yeni.ad + '. Maaşın ' + tl(r.kayit.yeniMaas) + (r.kayit.yeniMaas > r.kayit.eskiMaas ? ' (önceki ' + tl(r.kayit.eskiMaas) + ')' : '') + '. Beklentimiz kurumsal, bilgi veren, görselle desteklenmiş işler.');
      await sahne.yuru(gm, K.masa(gm));
    } finally { mesgulYap([gm, k.rol], false); }
    olay({ tur: 'kadro', metin: baslik + ' · ' + r.kayit.cikan + ' → ' + r.kayit.giren + ' · ' + tl(r.kayit.yeniMaas) });
    await arsiv();
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

  /* ================================================ CLAUDE CODE KÖPRÜSÜ (API'siz, abonelikle)
     İş dosyası klasöre yazılır; Claude Code sonucu adım adım yazar; burada sonuç içe aktarılıp OYNATILIR.
     Oynatma durumu iş kaydında (oynatma: {plan, adim, puan, bitti}) tutulur: sayfa yenilense de tekrar oynamaz. */
  const ccSon = new Map();       /* isId → en güncel temiz sonuç (kuyrukta bekleyen oynatma bunu kullanır) */
  const ccSirada = new Set();    /* kuyrukta oynatması bekleyen işler */
  const ccDurumlar = new Map();  /* isId → oynatma durumu (bellek) */
  let ccBekleyenRol = null;      /* sonucu beklenen ve "çalışıyor" görünen çalışan */
  function ccBekleyen(rol) {
    if (ccBekleyenRol && ccBekleyenRol !== rol) { sahne.durum(ccBekleyenRol, 'bos'); mesgulYap([ccBekleyenRol], false); }
    ccBekleyenRol = rol || null;
    if (rol) { mesgulYap([rol], true); sahne.durum(rol, 'calisiyor'); }
  }

  async function ccIsVer(metin) {
    if (!kopru || kopru.durum() !== 'hazir') { const e = new Error('Ajan Ofisi klasörü bağlı değil. Ayarlar’dan “Klasörü bağla”ya basın.'); e.kod = 'klasor'; throw e; }
    const id = await veri.isOlustur({ metin, durum: 'sirada', motor: MOTOR_CC, olusturmaMs: Date.now(), oynatma: { plan: false, adim: 0, puan: false, bitti: false } });
    await kopru.isYaz(id + '.json', ccIsDosyasi({ isId: id, tur: 'is', metin, kadro: durum.kadro(), ayar: durum.ayar() }));
    olay({ tur: 'is', metin: 'Yeni iş Claude Code’a iletildi: ' + kisalt(metin, 70) });
    kuyruk('İş tahtaya asıldı', async () => {
      const gm = 'genel_mudur';
      mesgulYap([gm], true);
      try { await sahne.konus(gm, 'İşi aldım ve Claude Code ekibine ilettim. Ekip başlayınca herkesi toplantıya çağıracağım.', 3200); }
      finally { mesgulYap([gm], false); }
    });
    bildir({ tur: 'cc-bekliyor', id });
    return id;
  }

  /* Zamanlanmış / tek seferlik görevler (içerik, rakip, muhasebe, strateji, ofis raporu) için iş dosyası */
  async function ccGorevIste(tur, { anahtar, ek } = {}) {
    if (!kopru || kopru.durum() !== 'hazir') { const e = new Error('Ajan Ofisi klasörü bağlı değil.'); e.kod = 'klasor'; throw e; }
    const ank = anahtar || (tur === 'rakip' ? isoHafta() : trTarih());
    const id = tur + '-' + ank + (anahtar ? '' : '-' + Date.now().toString(36));
    await kopru.isYaz(id + '.json', ccIsDosyasi({ isId: id, tur, anahtar: ank, kadro: durum.kadro(), ayar: durum.ayar(), ek }));
    olay({ tur: 'is', rol: CC_TUR_ROL[tur], metin: (ZAMANLI_ISLER.find((z) => z.id === tur) || { ad: tur }).ad + ' Claude Code’a iletildi' });
    return id;
  }
  /* Ofis açıkken vadesi gelen günlük/haftalık işleri Claude Code’a bırakır (bir kez) */
  async function ccZamanKontrol(zaman) {
    if (!kopru || kopru.durum() !== 'hazir') return;
    for (const v of vadesiGelenler(zaman)) {
      const z = (zaman || {})[v.id] || {};
      if (z.istendi === v.anahtar) continue;
      const ad = v.id + '-' + v.anahtar;
      if (await kopru.dosyaVarMi('isler', ad + '.json')) continue;
      const ek = v.id === 'muhasebe' ? { harcamaOzeti: harcamaOzeti(await veri.harcamaListesi(30)) } : null;
      await ccGorevIste(v.id, { anahtar: v.anahtar, ek });
      await veri.zamanIstendi(v.id, v.anahtar);
    }
  }

  /* Sayfa, sonuclar\ klasöründe yeni/değişmiş dosya görünce çağırır */
  function ccSonuc(ham, dosyaAdi) {
    const s = ccSonucTemizle(ham);
    if (!s) return false;
    s.dosya = dosyaAdi;
    ccSon.set(s.isId, s);
    if (ccSirada.has(s.isId)) return true;
    ccSirada.add(s.isId);
    kuyruk('Claude Code: ' + (s.plan ? s.plan.baslik : (ZAMANLI_ISLER.find((z) => z.id === s.tur) || { ad: s.tur }).ad), async () => {
      ccSirada.delete(s.isId);
      const son = ccSon.get(s.isId);
      if (son.tur === 'is') await ccIsOyna(son); else await ccNotOyna(son);
    });
    return true;
  }

  async function toplantiOyna(plan) {
    const gm = 'genel_mudur'; const herkes = ROLLER.map((r) => r.id);
    mesgulYap(herkes, true);
    try {
      await sahne.konus(gm, 'Ekip işe başladı. Herkes toplantı salonuna lütfen!', 2400);
      sahne.tahta({ baslik: plan.baslik, adimlar: [] });
      const yuru = [sahne.yuru(gm, K.tahtaOnu())]; let i = 0;
      for (const r of ROLLER) if (r.id !== gm) yuru.push(sahne.yuru(r.id, K.sandalye(i++)));
      await Promise.all(yuru);
      sahne.tahta(plan);
      await sahne.konus(gm, plan.konusma || ('Bugünkü işimiz: ' + plan.baslik + '.'), null);
      for (const [k, a] of plan.adimlar.entries()) {
        sahne.tahta(Object.assign({}, plan, { aktif: k }));
        await sahne.konus(gm, (k + 1) + '. adım ' + calisan(a.rol).ad + ' (' + ROL[a.rol].ad + '): ' + kisalt(a.gorev, 130), null);
        await sahne.konus(a.rol, rastgele(ONAYLAR), 1500);
      }
      await sahne.konus(gm, plan.adimlar.length > 1 ? 'Dosya sırayla elden ele geçecek. Herkes odasına, kolay gelsin!' : 'Herkes odasına, kolay gelsin!', 2200);
      sahne.tahta(Object.assign({}, plan, { kart: false }));
      await Promise.all(ROLLER.map((r) => sahne.yuru(r.id, K.masa(r.id))));
    } finally { mesgulYap(herkes, false); }
  }

  async function ccIsOyna(s) {
    const gm = 'genel_mudur', vt = 'viral_tahmincisi';
    const kayitli = durum.isler().find((x) => x.id === s.isId) || null;
    const st = ccDurumlar.get(s.isId) || Object.assign({ plan: false, adim: 0, puan: false, bitti: false }, (kayitli && kayitli.oynatma) || {});
    ccDurumlar.set(s.isId, st);
    if (st.bitti) {
      if (s.duzeltme && s.puan && kayitli) await ccPuanDuzelt(s, kayitli);
      if (s.dosya) await kopru.arsivle(s.dosya).catch(() => {});
      return;
    }
    const metin = (kayitli && kayitli.metin) || '';
    if (s.kadroKarari && s.durum === 'tamam') { ccBekleyen(null); await ccKadroKarari(s, st); return; }
    if (s.durum === 'hata') {
      ccBekleyen(null);
      st.bitti = true;
      await isHatasi(s.isId, gm, new Error(s.hata || 'Claude Code işi tamamlayamadı.'), { asama: 'cc' });
      await veri.isGuncelle(s.isId, { oynatma: st }).catch(() => {});
      if (s.dosya) await kopru.arsivle(s.dosya).catch(() => {});
      return;
    }
    let plan = st.plan ? ((kayitli && kayitli.plan) || s.plan) : s.plan;
    if (!plan || !plan.adimlar || !plan.adimlar.length) return;            /* plan henüz yazılmadı */
    if (!st.plan) {
      await toplantiOyna(plan);
      st.plan = true;
      await veri.isGuncelle(s.isId, { plan, durum: 'calisiyor', oynatma: Object.assign({}, st), nabizMs: Date.now() });
      bildir({ tur: 'plan', id: s.isId, plan });
      ccBekleyen(plan.adimlar[0].rol);
    }
    let kayitlar = ((kayitli && kayitli.adimlar) || []).slice(0, st.adim);
    while (st.adim < plan.adimlar.length && st.adim < s.adimlar.length) {
      const k = st.adim, a = s.adimlar[k], rol = plan.adimlar[k].rol, c = calisan(rol);
      ccBekleyen(null);
      mesgulYap([rol], true);
      sahne.durum(rol, 'calisiyor'); await sahne.bekle(2200); sahne.durum(rol, 'bos');
      const kayitA = {
        rol, ad: c.ad, no: c.no || 1, kademe: c.kademe | 0, gorev: plan.adimlar[k].gorev, cikti: a.cikti, teslimNotu: a.teslimNotu, kaynaklar: a.kaynaklar,
        maliyet: 0, token: null, sureMs: a.sureSn * 1000, model: MOTOR_CC, effort: kademeBilgisi(c.kademe).effort, kesildi: false, bitisMs: Date.now()
      };
      kayitlar = kayitlar.slice(0, k).concat([kayitA]);
      st.adim = k + 1;
      await veri.isGuncelle(s.isId, { adimlar: kayitlar, oynatma: Object.assign({}, st), nabizMs: Date.now() });
      veri.harcamaEkle({ rol, ad: c.ad, kademe: c.kademe | 0, model: MOTOR_CC, effort: kayitA.effort, giris: 0, cikis: 0, okuma: 0, yazma: 0, arama: 0, maliyet: 0, sureMs: kayitA.sureMs, isId: s.isId, tur: 'adim', hata: null, ay: ayAnahtari(), tsMs: Date.now(), motor: MOTOR_CC }).catch(() => {});
      if (rol === 'model_fotografcisi') { const html = kodBlogu(a.cikti, 'html'); if (html) await veri.notEkle({ tur: 'model', rol, ad: c.ad, baslik: plan.baslik, icerik: a.cikti, html, isId: s.isId, maliyet: 0, kaynak: MOTOR_CC }); }
      if (rol === 'video_editor') { const vp = videoPlaniAyir(a.cikti); if (vp) await veri.notEkle({ tur: 'video', rol, ad: c.ad, baslik: vp.baslik || plan.baslik, icerik: a.cikti, plan: vp, isId: s.isId, maliyet: 0, kaynak: MOTOR_CC }); }
      olay({ tur: 'calisma', rol, metin: c.ad + ' (' + ROL[rol].ad + ') teslim etti' });
      mesgulYap([rol], false);
      const sonraki = plan.adimlar[k + 1];
      await teslimEt(rol, sonraki ? sonraki.rol : gm, a.teslimNotu || (sonraki ? 'Benim kısmım hazır, dosya sende.' : 'İş tamamlandı, dosya sizde.'));
      if (sonraki) ccBekleyen(sonraki.rol);
    }
    if (st.adim >= plan.adimlar.length && s.puan && !st.puan) {
      ccBekleyen(null);
      const puan = puanTemizle(s.puan, plan.adimlar.length);
      mesgulYap([gm, vt], true);
      try {
        await sahne.konus(gm, calisan(vt).ad + ', bu işi puanlar mısın?', 2000);
        await sahne.yuru(vt, K.masaOnu(gm)); sahne.dosya(vt, true);
        await sahne.yuru(vt, K.masa(vt)); sahne.dosya(vt, false);
        sahne.durum(vt, 'calisiyor'); await sahne.bekle(2400); sahne.durum(vt, 'bos');
        st.puan = true; st.bitti = true;
        await veri.isGuncelle(s.isId, { durum: 'tamam', puan, bitisMs: Date.now(), maliyet: 0, oynatma: Object.assign({}, st) });
        sahne.dosya(vt, true);
        await sahne.yuru(vt, K.masaOnu(gm)); sahne.dosya(vt, false);
        const eksi = puan.eksiler.slice().sort((x, y) => y.puan_kaybi - x.puan_kaybi)[0];
        await sahne.konus(vt, 'Puan: ' + puan.toplam + '/100. ' + kisalt(puan.ozet, 90) + (eksi ? ' En büyük eksi: ' + kisalt(eksi.neden, 70) + ' (−' + eksi.puan_kaybi + ').' : ''), null);
        sahne.yuru(vt, K.masa(vt)).then(() => mesgulYap([vt], false));
        await sahne.konus(gm, puan.toplam >= 80 ? 'Harika iş, herkese teşekkürler!' : puan.toplam >= 60 ? 'Fena değil, ama daha iyisini yapabiliriz.' : 'Bu iş beklentinin altında kaldı; nedenlerini konuşacağız.', 2400);
      } finally { mesgulYap([gm], false); }
      olay({ tur: 'puan', metin: plan.baslik + ' · ' + puan.toplam + '/100' });
      bildir({ tur: 'is-bitti', id: s.isId, baslik: plan.baslik, puan: puan.toplam, maliyet: null });
      try { await veri.kadroKaydet(kadroPuanIsle(durum.kadro(), kayitlar, puan)); } catch (e) { olay({ tur: 'hata', metin: 'Puanlar kadroya işlenemedi.' }); }
      await tesvikTuru(kayitlar, puan);
      await kadroGozdenGecir({ id: s.isId, adimlar: kayitlar, puan, olusturmaMs: Date.now() });
      if (s.dosya) await kopru.arsivle(s.dosya).catch(() => {});
    }
  }

  /* Bitmiş işin puanını düzeltir (ofis sahibinin geri bildirimiyle): iş kaydı + çalışanların puan geçmişi */
  async function ccPuanDuzelt(s, kayitli) {
    const gm = 'genel_mudur', vt = 'viral_tahmincisi';
    const adimlar = kayitli.adimlar || [];
    const yeni = puanTemizle(s.puan, adimlar.length);
    const eski = kayitli.puan || null;
    if (eski && eski.toplam === yeni.toplam && kayitli.puanDuzeltmeMs) return;
    await veri.isGuncelle(s.isId, { puan: yeni, ilkPuan: eski, puanDuzeltmeMs: Date.now(), puanDuzeltmeNotu: kisalt(s.duzeltmeNotu || '', 300) });
    const kd = durum.kadro(); const calisanlar = {};
    for (const [r, c] of Object.entries(kd.calisanlar || {})) calisanlar[r] = Object.assign({}, c, { puanlar: Array.isArray(c.puanlar) ? c.puanlar.slice() : [] });
    adimlar.forEach((a, i) => {
      const c = calisanlar[a.rol]; const yk = yeni.katkilar[i] ? yeni.katkilar[i].puan : null;
      if (!c || yk == null || c.ad !== a.ad || (c.no || 1) !== (a.no || 1)) return;
      const ek = eski && eski.katkilar && eski.katkilar[i] ? eski.katkilar[i].puan : null;
      const yer = ek == null ? -1 : c.puanlar.lastIndexOf(ek);
      if (yer >= 0) c.puanlar[yer] = yk; else c.puanlar.push(yk);
    });
    try { await veri.kadroKaydet(Object.assign({}, kd, { calisanlar })); } catch (e) { olay({ tur: 'hata', metin: 'Düzeltilen puanlar kadroya işlenemedi.' }); }
    const baslik = (kayitli.plan && kayitli.plan.baslik) || 'İş';
    mesgulYap([gm, vt], true);
    try {
      await sahne.yuru(vt, K.masaOnu(gm));
      await sahne.konus(vt, 'Puan düzeltmesi: “' + kisalt(baslik, 50) + '” ' + (eski ? eski.toplam : '—') + ' → ' + yeni.toplam + '. ' + kisalt(s.duzeltmeNotu || yeni.ozet, 110), null);
      await sahne.konus(gm, 'Teşekkürler Melis. Ölçütümüz artık bu; kurumsal ve bilgi veren iş olmadan yüksek puan yok.', 3000);
      sahne.yuru(vt, K.masa(vt));
    } finally { mesgulYap([gm, vt], false); }
    olay({ tur: 'puan', metin: baslik + ' · puan düzeltildi: ' + (eski ? eski.toplam : '—') + ' → ' + yeni.toplam });
    bildir({ tur: 'puan-duzeltme', baslik, eski: eski ? eski.toplam : null, yeni: yeni.toplam });
    await kadroGozdenGecir({ id: s.isId, adimlar, puan: yeni, olusturmaMs: kayitli.olusturmaMs || Date.now() });
  }

  async function ccNotOyna(s) {
    const rol = CC_TUR_ROL[s.tur]; if (!rol) return;
    if (s.durum === 'hata') {
      olay({ tur: 'hata', rol, metin: (s.hata || 'Görev yapılamadı') });
      if (s.dosya) await kopru.arsivle(s.dosya).catch(() => {});
      return;
    }
    if (s.durum !== 'tamam' || !s.not) return;          /* henüz bitmedi */
    const c = calisan(rol);
    mesgulYap([rol], true);
    try {
      sahne.durum(rol, 'calisiyor'); await sahne.bekle(2000); sahne.durum(rol, 'bos');
      const ek = {};
      await veri.notEkle(Object.assign({ tur: s.tur, rol, ad: c.ad, baslik: s.not.baslik || ((ZAMANLI_ISLER.find((z) => z.id === s.tur) || { ad: s.tur }).ad + ' · ' + trTarih()), icerik: s.not.icerik, kaynaklar: s.not.kaynaklar, maliyet: 0, kaynak: MOTOR_CC }, ek));
      if (ZAMANLI_ISLER.some((z) => z.id === s.tur) && s.anahtar) await veri.zamanTamam(s.tur, s.anahtar).catch(() => {});
      if (s.dosya) await kopru.arsivle(s.dosya).catch(() => {});
    } finally { mesgulYap([rol], false); }
    await panoyaAs(rol, s.tur === 'icerik' ? 'Bugünkü içerik notunuz panoda.' : s.tur === 'rakip' ? 'Haftalık rakip raporu panoya asıldı.' : s.tur === 'muhasebe' ? 'Muhasebe raporu panoda.' : s.tur === 'strateji' ? 'Hedeflerin için stratejini hazırladım, panoda.' : 'Ofis performans raporu panoda.');
    bildir({ tur: 'not', baslik: s.not.baslik || '' });
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

  /* Motor seçimi: ayar.motor 'claude-code' (varsayılan) ya da 'api' */
  const ccMi = () => (durum.ayar().motor || MOTOR_CC) === MOTOR_CC;
  return {
    isVer: (metin) => (ccMi() ? ccIsVer(String(metin || '').trim()) : isVer(metin)),
    zamanKontrol: (zaman) => (ccMi() ? ccZamanKontrol(zaman).catch(() => {}) : zamanKontrol(zaman)),
    simdiCalistir: async (id) => {
      if (!ccMi()) return simdiCalistir(id);
      const ek = id === 'muhasebe' ? { harcamaOzeti: harcamaOzeti(await veri.harcamaListesi(30)) } : null;
      return ccGorevIste(id, { ek });
    },
    stratejiIste: (h) => (ccMi() ? ccGorevIste('strateji', { ek: { hedefler: h } }) : stratejiIste(h)),
    ofisRaporuIste: () => {
      if (!ccMi()) return ofisRaporuIste();
      const perf = performans(durum.isler(), durum.kadro());
      const veriOzet = ROLLER.map((r) => { const x = perf[r.id]; const k = calisan(r.id); return { departman: r.ad, calisan: k.ad, unvan: unvan(r.id, k.kademe), katki: x.katki, ortPuan: x.ortPuan, iseGiristenBeriOrt: x.girisOrt, calismaDk: Math.round(x.sureSn / 60), durum: x.durum }; });
      return ccGorevIste('ofis', { ek: { performans: veriOzet } });
    },
    ccSonuc, ccMi, mesgulMu, sohbet: (v) => { sohbetAcik = !!v; }, cagir
  };
}
