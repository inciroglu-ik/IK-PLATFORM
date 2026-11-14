/* ============================================================================
   AJAN OFİSİ · KÖPRÜ — Claude Code ile masaüstü klasörü üzerinden iş alışverişi
   Chrome/Edge File System Access API: kullanıcı "Ajan Ofisi" klasörünü bir kez seçer, tutamak
   IndexedDB'de saklanır; sonraki açılışlarda izin tek tıkla yenilenir. Ağ yok, sunucu yok.
     isler\<kimlik>.json      ofis → Claude Code
     sonuclar\<kimlik>.json   Claude Code → ofis (adım adım güncellenir)
     islenen\                 ofisin içe aktarıp kaldırdığı sonuçlar (arşiv)
   ============================================================================ */
const DB_AD = 'ajan-ofisi-kopru', DEPO = 'tutamak', ANAHTAR = 'kok';

function idb() {
  return new Promise((coz) => {
    try {
      const r = indexedDB.open(DB_AD, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(DEPO);
      r.onsuccess = () => coz(r.result); r.onerror = () => coz(null);
    } catch (e) { coz(null); }
  });
}
async function tutamakAl() {
  const d = await idb(); if (!d) return null;
  return new Promise((coz) => { try { const q = d.transaction(DEPO).objectStore(DEPO).get(ANAHTAR); q.onsuccess = () => coz(q.result || null); q.onerror = () => coz(null); } catch (e) { coz(null); } });
}
async function tutamakKoy(h) {
  const d = await idb(); if (!d) return;
  await new Promise((coz) => { try { const t = d.transaction(DEPO, 'readwrite'); t.objectStore(DEPO).put(h, ANAHTAR); t.oncomplete = coz; t.onerror = coz; } catch (e) { coz(); } });
}

export function kopruKur() {
  let kok = null, durum = 'yok';
  const mock = typeof window !== 'undefined' && window.__KLASOR_MOCK;
  const destek = !!mock || (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function');

  async function alt(ad) { return kok.getDirectoryHandle(ad, { create: true }); }
  async function altKlasorler() { for (const a of ['isler', 'sonuclar', 'islenen']) await alt(a); }
  async function yaz(klasor, ad, metin) {
    const d = await alt(klasor);
    const f = await d.getFileHandle(ad, { create: true });
    const w = await f.createWritable();
    await w.write(metin); await w.close();
  }
  const guvenliAd = (ad) => String(ad || '').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);

  return {
    destek,
    durum: () => durum,
    klasorAdi: () => (kok && kok.name) || '',
    async baslat() {
      if (mock) { kok = mock; durum = 'hazir'; await altKlasorler(); return durum; }
      if (!destek) return (durum = 'desteklenmiyor');
      kok = await tutamakAl();
      if (!kok) return (durum = 'yok');
      try { durum = (await kok.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'hazir' : 'izin'; }
      catch (e) { durum = 'izin'; }
      if (durum === 'hazir') { try { await altKlasorler(); } catch (e) { durum = 'izin'; } }
      return durum;
    },
    /* Kullanıcı tıklamasıyla çağrılmalı (tarayıcı izni) */
    async bagla() {
      if (!destek) throw new Error('Bu tarayıcı klasör erişimini desteklemiyor. Chrome ya da Edge kullanın.');
      const h = await window.showDirectoryPicker({ id: 'ajan-ofisi', mode: 'readwrite', startIn: 'desktop' });
      kok = h; await tutamakKoy(h); await altKlasorler(); durum = 'hazir';
      return durum;
    },
    async izinIste() {
      if (!kok) return this.bagla();
      durum = (await kok.requestPermission({ mode: 'readwrite' })) === 'granted' ? 'hazir' : 'izin';
      if (durum === 'hazir') await altKlasorler();
      return durum;
    },
    async isYaz(ad, veri) { await yaz('isler', guvenliAd(ad), JSON.stringify(veri, null, 2)); },
    async dosyaVarMi(klasor, ad) { try { const d = await alt(klasor); await d.getFileHandle(guvenliAd(ad)); return true; } catch (e) { return false; } },
    async bekleyenIsler() {
      const d = await alt('isler'); const l = [];
      for await (const [ad, h] of d.entries()) if (h.kind === 'file' && /\.json$/i.test(ad)) l.push(ad);
      return l;
    },
    /* sonuclar\*.json — { ad, degisme, metin() } */
    async sonuclar() {
      const d = await alt('sonuclar'); const l = [];
      for await (const [ad, h] of d.entries()) {
        if (h.kind !== 'file' || !/\.json$/i.test(ad)) continue;
        const f = await h.getFile();
        l.push({ ad, degisme: f.lastModified, boyut: f.size, metin: () => f.text() });
      }
      return l;
    },
    /* İçe aktarılan sonucu islenen\ altına kopyalar, sonuclar\ içinden kaldırır */
    async arsivle(ad) {
      const d = await alt('sonuclar');
      let metin = '';
      try { metin = await (await (await d.getFileHandle(ad)).getFile()).text(); } catch (e) { return; }
      await yaz('islenen', new Date().toISOString().slice(0, 10) + '_' + guvenliAd(ad), metin);
      try { await d.removeEntry(ad); } catch (e) { /* zaten yok */ }
    }
  };
}
