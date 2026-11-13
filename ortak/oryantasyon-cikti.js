/* =============================================================================
   İnciroğlu Otomotiv · Oryantasyon Formları — EXCEL (.xlsx) ve PDF ÇIKTISI (build'siz)
   • Excel: ham OOXML + kendi ZIP yazıcısı (dış kütüphane yok; satis-panosu excel-pano.js yöntemi).
   • PDF : pdfmake (cdnjs, yalnız PDF istenince yüklenir; Roboto yazı tipi Türkçe karakterleri içerir).
   Düzen İK'nın özgün Excel formuyla aynıdır: PERSONELİN bilgi alanları; solda dikey bölüm adı; Sıra · Gün Planı ·
   Kapsam · Tarih · Saat · Süre (dk) · Oryantasyon Sorumlusu · Açıklama; yatay A4, tek sayfa genişliğinde.
   İşaretli çıktı (İK incelemesi): değişen hücre sarı + altında "Önceki:", eklenen satır yeşil, silinen satır üstü
   çizili kırmızı, "Değişiklik" sütunu ve ayrıntılı "Değişiklik Notları". Tüm işaretler farkHesapla'dan gelir
   (ekrandaki sayılarla birebir aynı).
   ============================================================================= */
import * as F from './oryantasyon-fark.js';

const PDF_JS = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js';
const PDF_FONT = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js';
const KURUM = 'İNCİROĞLU OTOMOTİV';
const ALT_SUTUN = ['kapsam', 'termin', 'saat', 'sure', 'sorumlu', 'aciklama'];
/* Renkler (kurumsal lacivert / pirinç paleti) */
const R = { LAC9: '132A46', LAC7: '1B3A5E', LAC1: 'E2E9F3', LAC05: 'F1F5FA', PIR: 'B98B37', PIR1: 'E9D5A8', MET1: '151A23', MET2: '4F5868',
  MET3: '66707F', CIZ: 'C9D1DC', BEYAZ: 'FFFFFF', SARI: 'FFF3CD', SARI7: '8A6A12', YESIL: 'E2F4E6', YESIL7: '2F7D43', KIR: 'FDF3F1', KIR7: '8A4038' };

/* ------------------------------------------------------------------ ortak model */
const sade = F.sade;
const dosyaAdi = (s) => String(s || 'Oryantasyon Formu').replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
function indir(blob, ad) {
  window.__ORY_INDIRME = { ad, blob };          /* test kancası: son üretilen dosya */
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = ad; a.style.display = 'none';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function maddeNotu(fm, i) {
  const p = [];
  if (fm.tur === 'yeni') p.push('Eklendi');
  if (fm.tur === 'degisti') p.push('Düzenlendi: ' + Object.keys(fm.eski).map((k) => F.ALAN_AD[k]).join(', '));
  if (fm.tasindi) p.push('Başka bölümden taşındı (önceki bölüm: ' + (fm.eskiBolum || '—') + ')');
  else if (fm.siraDegisti) p.push('Yeri değişti (bölümde ana formdaki ' + (Number(fm.eskiSira) + 1) + '. sıradan ' + (i + 1) + '. sıraya)');
  return p.join(' · ');
}
/** Çıktı modeli: bölümler ve satırlar. İşaretliyse silinen maddeler bölüm sonunda, silinen bölümler en sonda (ekrandaki gibi). */
function model(form, fark) {
  const bolumler = []; let no = 0;
  form.bolumler.forEach((b) => {
    const fb = fark ? (fark.bolum[b.id] || { tur: 'ayni' }) : { tur: 'ayni' };
    const satir = [];
    b.maddeler.forEach((m, i) => {
      no++;
      const fm = fark ? (fark.madde[m.id] || { tur: 'ayni', eski: {} }) : { tur: 'ayni', eski: {} };
      satir.push({ no, m, tur: fm.tur, eski: fm.eski || {}, not: fark ? maddeNotu(fm, i) : '' });
    });
    if (fark) fark.silinenMaddeler.filter((s) => s.bolumId === b.id)
      .forEach((s) => satir.push({ no: null, m: s.madde, tur: 'silindi', eski: {}, not: 'Silindi (ana formda bu bölümün ' + (s.sira + 1) + '. maddesi)' }));
    bolumler.push({ ad: b.ad, tur: fb.tur, eskiAd: fb.eskiAd, satir });
  });
  if (fark) fark.silinenBolumler.forEach((s) => bolumler.push({ ad: s.bolum.ad, tur: 'silindi',
    satir: s.maddeler.map((m) => ({ no: null, m, tur: 'bolumle', eski: {}, not: 'Bölümle birlikte silindi' })) }));
  return bolumler;
}
/** Üst bilgi alanları (işaretliyse silinenler en sonda) */
function alanModel(form, fark) {
  const a = form.alanlar.map((x) => { const f = fark ? (fark.alan[x.id] || { tur: 'ayni' }) : { tur: 'ayni' }; return { ad: x.ad, tur: f.tur, eskiAd: f.eskiAd }; });
  if (fark) fark.silinenAlanlar.forEach((s) => a.push({ ad: s.alan.ad, tur: 'silindi' }));
  return a;
}
/** Ayrıntılı değişiklik notları (Excel "Değişiklik Notları" sayfası ve PDF son bölümü). Sayılar sayaçla birebir. */
export function degisiklikNotlari(fark, form) {
  const n = [];
  fark.silinenMaddeler.forEach((x) => n.push({ tur: 'Silindi', bolum: x.bolumAd, madde: x.madde.plan, ayrinti: sade(x.madde.sorumlu) ? 'Sorumlu: ' + x.madde.sorumlu : '' }));
  fark.silinenBolumler.forEach((x) => n.push({ tur: 'Bölüm silindi', bolum: x.bolum.ad, madde: '', ayrinti: 'İçindeki ' + x.maddeler.length + ' maddeyle' + (x.maddeler.length ? ': ' + x.maddeler.map((m) => m.plan || '(adsız)').join('; ') : '') }));
  fark.silinenAlanlar.forEach((x) => n.push({ tur: 'Üst bilgi alanı silindi', bolum: '', madde: x.alan.ad, ayrinti: '' }));
  form.bolumler.forEach((b) => b.maddeler.forEach((m) => { const f = fark.madde[m.id]; if (f && f.tur === 'yeni') n.push({ tur: 'Eklendi', bolum: b.ad, madde: m.plan, ayrinti: sade(m.sorumlu) ? 'Sorumlu: ' + m.sorumlu : '' }); }));
  form.bolumler.forEach((b) => b.maddeler.forEach((m, i) => { const f = fark.madde[m.id]; if (!f) return;
    if (f.tasindi) n.push({ tur: 'Taşındı', bolum: b.ad, madde: m.plan, ayrinti: 'Önceki bölüm: ' + (f.eskiBolum || '—') });
    else if (f.siraDegisti) n.push({ tur: 'Yeri değişti', bolum: b.ad, madde: m.plan, ayrinti: 'Ana formda ' + (Number(f.eskiSira) + 1) + '. sıradaydı, şimdi ' + (i + 1) + '.' }); }));
  form.bolumler.forEach((b) => { const f = fark.bolum[b.id]; if (!f) return;
    if (f.tur === 'yeni') n.push({ tur: 'Yeni bölüm', bolum: b.ad, madde: '', ayrinti: b.maddeler.length + ' madde' });
    if (f.tur === 'degisti') n.push({ tur: 'Bölüm adı değişti', bolum: b.ad, madde: '', ayrinti: 'Önceki: ' + (f.eskiAd || '') }); });
  form.alanlar.forEach((a) => { const f = fark.alan[a.id]; if (!f) return;
    if (f.tur === 'yeni') n.push({ tur: 'Üst bilgi alanı eklendi', bolum: '', madde: a.ad, ayrinti: '' });
    if (f.tur === 'degisti') n.push({ tur: 'Üst bilgi alanı değişti', bolum: '', madde: a.ad, ayrinti: 'Önceki: ' + (f.eskiAd || '') }); });
  form.bolumler.forEach((b) => b.maddeler.forEach((m) => { const f = fark.madde[m.id]; if (!f || f.tur !== 'degisti') return;
    n.push({ tur: 'Düzenlendi', bolum: b.ad, madde: m.plan, ayrinti: Object.keys(f.eski).map((k) => F.ALAN_AD[k] + ': “' + (sade(f.eski[k]) || '(boştu)') + '” → “' + (sade(m[k]) || '(boş)') + '”').join(' · ') }); }));
  return n;
}
const LEJANT = 'Sarı: değiştirildi (altında önceki hâli) · Yeşil: eklendi · Kırmızı, üstü çizili: silindi · Değişiklik sütununda ayrıntı';

/* ================================================================== EXCEL (.xlsx) */
const X = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const KOL = (n) => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const H = (c, r) => KOL(c) + r;
const XML_BAS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

/* ZIP (deflate: tarayıcının CompressionStream'i; yoksa sıkıştırmasız) */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u) => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC_T[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
async function sikistir(u) {
  if (typeof CompressionStream === 'undefined') return null;
  try { const cs = new CompressionStream('deflate-raw'); const w = cs.writable.getWriter(); w.write(u); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); }
  catch (e) { return null; }
}
async function zipYap(dosyalar) {
  const enc = new TextEncoder(), parca = [], merkez = []; let ofs = 0;
  const d = new Date(), saat = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), gun = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const [ad, metin] of dosyalar) {
    const adB = enc.encode(ad), ham = enc.encode(metin), crc = crc32(ham);
    let veri = await sikistir(ham), yontem = 8;
    if (!veri || veri.length >= ham.length) { veri = ham; yontem = 0; }
    const y = new DataView(new ArrayBuffer(30));
    y.setUint32(0, 0x04034b50, true); y.setUint16(4, 20, true); y.setUint16(6, 0, true); y.setUint16(8, yontem, true); y.setUint16(10, saat, true); y.setUint16(12, gun, true);
    y.setUint32(14, crc, true); y.setUint32(18, veri.length, true); y.setUint32(22, ham.length, true); y.setUint16(26, adB.length, true); y.setUint16(28, 0, true);
    parca.push(new Uint8Array(y.buffer), adB, veri);
    const m = new DataView(new ArrayBuffer(46));
    m.setUint32(0, 0x02014b50, true); m.setUint16(4, 20, true); m.setUint16(6, 20, true); m.setUint16(8, 0, true); m.setUint16(10, yontem, true); m.setUint16(12, saat, true); m.setUint16(14, gun, true);
    m.setUint32(16, crc, true); m.setUint32(20, veri.length, true); m.setUint32(24, ham.length, true); m.setUint16(28, adB.length, true);
    m.setUint16(30, 0, true); m.setUint16(32, 0, true); m.setUint16(34, 0, true); m.setUint16(36, 0, true); m.setUint32(38, 0, true); m.setUint32(42, ofs, true);
    merkez.push(new Uint8Array(m.buffer), adB);
    ofs += 30 + adB.length + veri.length;
  }
  const mBoy = merkez.reduce((s, x) => s + x.length, 0), son = new DataView(new ArrayBuffer(22));
  son.setUint32(0, 0x06054b50, true); son.setUint16(8, dosyalar.length, true); son.setUint16(10, dosyalar.length, true); son.setUint32(12, mBoy, true); son.setUint32(16, ofs, true);
  return new Blob([...parca, ...merkez, new Uint8Array(son.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
/* Stil kaydı */
function stilKaydi() {
  const fonts = ['<font><sz val="10"/><color rgb="FF151A23"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>'];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const yer = (arr, x) => { let i = arr.indexOf(x); if (i < 0) { arr.push(x); i = arr.length - 1; } return i; };
  const fontXml = (f) => `<font>${f.b ? '<b/>' : ''}${f.i ? '<i/>' : ''}${f.st ? '<strike/>' : ''}<sz val="${f.sz || 10}"/><color rgb="FF${f.renk || R.MET1}"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>`;
  const kenar = (k) => { const s = (ad, v) => (v ? `<${ad} style="${v[1] || 'thin'}"><color rgb="FF${v[0]}"/></${ad}>` : `<${ad}/>`);
    return `<border>${s('left', k.sol)}${s('right', k.sag)}${s('top', k.ust)}${s('bottom', k.alt)}<diagonal/></border>`; };
  function xf(o) {
    const fontId = o.font ? yer(fonts, fontXml(o.font)) : 0;
    const fillId = o.dolgu ? yer(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${o.dolgu}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const borderId = o.kenar ? yer(borders, kenar(o.kenar)) : 0;
    const hiz = (o.h || o.v || o.sar || o.girinti || o.don) ? `<alignment${o.h ? ` horizontal="${o.h}"` : ''}${o.v ? ` vertical="${o.v}"` : ''}${o.don ? ` textRotation="${o.don}"` : ''}${o.sar ? ' wrapText="1"' : ''}${o.girinti ? ` indent="${o.girinti}"` : ''}/>` : '';
    return yer(xfs, `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"${fontId ? ' applyFont="1"' : ''}${fillId ? ' applyFill="1"' : ''}${borderId ? ' applyBorder="1"' : ''}${hiz ? ' applyAlignment="1">' + hiz + '</xf>' : '/>'}`);
  }
  const xml = () => XML_BAS + `<styleSheet xmlns="${NS_MAIN}">`
    + `<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders>`
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>`
    + '<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>';
  return { xf, xml };
}
/* Paylaşılan metinler (düz ya da zengin: [{t, b, i, st, sz, renk}]) */
function metinKaydi() {
  const list = [], map = new Map(); let say = 0;
  const rpr = (p) => `<rPr>${p.b ? '<b/>' : ''}${p.i ? '<i/>' : ''}${p.st ? '<strike/>' : ''}<sz val="${p.sz || 10}"/><color rgb="FF${p.renk || R.MET1}"/><rFont val="Calibri"/><family val="2"/><scheme val="minor"/></rPr>`;
  return {
    no(v) {
      const xml = Array.isArray(v) ? v.filter((p) => p.t !== '').map((p) => `<r>${rpr(p)}<t xml:space="preserve">${X(p.t)}</t></r>`).join('') : `<t xml:space="preserve">${X(v)}</t>`;
      say++; let i = map.get(xml); if (i === undefined) { i = list.length; list.push(xml); map.set(xml, i); } return i;
    },
    xml: () => XML_BAS + `<sst xmlns="${NS_MAIN}" count="${say}" uniqueCount="${list.length}">` + list.map((s) => `<si>${s}</si>`).join('') + '</sst>'
  };
}
function sayfaYazici(sst) {
  const satirlar = new Map(), birlesik = [];
  const satir = (r) => { if (!satirlar.has(r)) satirlar.set(r, { ht: null, h: new Map() }); return satirlar.get(r); };
  return {
    metin(c, r, v, s) { const bos = Array.isArray(v) ? !v.some((p) => p.t) : (v === null || v === undefined || v === '');
      satir(r).h.set(c, bos ? (s ? `<c r="${H(c, r)}" s="${s}"/>` : '') : `<c r="${H(c, r)}"${s ? ` s="${s}"` : ''} t="s"><v>${sst.no(v)}</v></c>`); },
    stil(c, r, s) { const x = satir(r); if (!x.h.get(c)) x.h.set(c, `<c r="${H(c, r)}" s="${s}"/>`); },
    yukseklik(r, ht) { satir(r).ht = ht; },
    birlestir(c1, r1, c2, r2) { if (c1 !== c2 || r1 !== r2) birlesik.push(H(c1, r1) + ':' + H(c2, r2)); },
    xml(o) {
      const rs = [...satirlar.keys()].sort((a, b) => a - b);
      const son = rs.length ? rs[rs.length - 1] : 1;
      const sd = rs.map((r) => { const x = satirlar.get(r); const cs = [...x.h.keys()].sort((a, b) => a - b).map((c) => x.h.get(c)).join('');
        return `<row r="${r}"${x.ht ? ` ht="${x.ht}" customHeight="1"` : ''}>${cs}</row>`; }).join('');
      return XML_BAS + `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`
        + `<dimension ref="A1:${H(o.genislik.length - 1, son)}"/>`
        + `<sheetViews><sheetView showGridLines="0" workbookViewId="0"${o.ilk ? ' tabSelected="1"' : ''} zoomScale="90" zoomScaleNormal="90"/></sheetViews>`
        + '<sheetFormatPr defaultRowHeight="15"/>'
        + `<cols>${o.genislik.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
        + `<sheetData>${sd}</sheetData>`
        + (birlesik.length ? `<mergeCells count="${birlesik.length}">${birlesik.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '')
        + '<printOptions horizontalCentered="1"/><pageMargins left="0.35" right="0.35" top="0.45" bottom="0.55" header="0.2" footer="0.25"/>'
        + '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
        + `<headerFooter><oddFooter>${X('&L&8' + o.altBilgi.replace(/&/g, '&&') + '&R&8Sayfa &P / &N')}</oddFooter></headerFooter></worksheet>`;
    }
  };
}
/* Satır yüksekliği tahmini (sarılan metin; Excel kaydedilmiş yüksekliği kullanır) */
const satirSay = (metin, gen, oran = 1.12) => { const cpl = Math.max(3, Math.floor(gen * oran)); return String(metin || '').split('\n').reduce((s, p) => s + Math.max(1, Math.ceil(p.length / cpl)), 0); };

/** Excel dosyası üretir ve indirir.
    g = { unvan, form (formuDuzenle'den geçmiş), fark (yalnız işaretli çıktıda), meta (alt başlık), dosya (uzantısız ad) } */
export async function excelIndir(g) {
  const blob = await excelUret(g);
  indir(blob, dosyaAdi(g.dosya) + '.xlsx');
  return blob;
}
export async function excelUret(g) {
  const isaretli = !!g.fark;
  const st = stilKaydi(), sst = metinKaydi(), ws = sayfaYazici(sst);
  const ince = [R.CIZ, 'thin'];
  const kutu = { sol: ince, sag: ince, ust: ince, alt: ince };
  const GEN = [6.5, 5, 32, 46, 12, 7.5, 8, 24, 28].concat(isaretli ? [34] : []);
  const SON = GEN.length - 1;
  const S = {
    baslik: st.xf({ font: { b: true, sz: 15, renk: R.BEYAZ }, dolgu: R.LAC9, v: 'center', girinti: 1 }),
    ustEtiket: st.xf({ font: { b: true, sz: 9, renk: R.PIR1 }, dolgu: R.LAC9, v: 'center', girinti: 1 }),
    unvan: st.xf({ font: { b: true, sz: 13, renk: R.LAC9 }, v: 'center', girinti: 1, kenar: { alt: [R.PIR, 'medium'] } }),
    meta: st.xf({ font: { sz: 9, renk: R.MET3 }, v: 'center', girinti: 1, sar: true }),
    lejant: st.xf({ font: { i: true, sz: 9, renk: R.MET2 }, v: 'center', girinti: 1, sar: true }),
    pBaslik: st.xf({ font: { b: true, sz: 10, renk: R.LAC9 }, dolgu: R.LAC1, v: 'center', girinti: 1, kenar: kutu }),
    pEtiket: st.xf({ font: { sz: 10, renk: R.MET2 }, dolgu: R.LAC05, v: 'center', girinti: 1, kenar: kutu, sar: true }),
    pEtiketDeg: st.xf({ font: { sz: 10, renk: R.MET1 }, dolgu: R.SARI, v: 'center', girinti: 1, kenar: kutu, sar: true }),
    pEtiketYeni: st.xf({ font: { sz: 10, renk: R.MET1 }, dolgu: R.YESIL, v: 'center', girinti: 1, kenar: kutu, sar: true }),
    pEtiketSil: st.xf({ font: { sz: 10, renk: R.KIR7, st: true }, dolgu: R.KIR, v: 'center', girinti: 1, kenar: kutu, sar: true }),
    pDeger: st.xf({ kenar: kutu }),
    pNot: st.xf({ font: { sz: 9, renk: R.MET2 }, v: 'center', kenar: kutu, sar: true }),
    tBaslik: st.xf({ font: { b: true, sz: 10, renk: R.BEYAZ }, dolgu: R.LAC7, h: 'center', v: 'center', sar: true, kenar: { sol: [R.LAC9], sag: [R.LAC9], ust: [R.LAC9], alt: [R.LAC9] } })
  };
  const govdeStil = {};
  const gs = (tur, hiza) => {          /* tur: ayni | yeni | degisti | silindi */
    const k = tur + '|' + hiza; if (govdeStil[k] != null) return govdeStil[k];
    const o = { kenar: kutu, v: 'center', sar: true, h: hiza, font: { sz: 10 } };
    if (tur === 'yeni') o.dolgu = R.YESIL;
    if (tur === 'degisti') o.dolgu = R.SARI;
    if (tur === 'silindi') { o.dolgu = R.KIR; o.font = { sz: 10, st: true, renk: R.KIR7 }; }
    if (tur === 'not') { o.font = { sz: 9, renk: R.MET2 }; }
    return (govdeStil[k] = st.xf(o));
  };
  const bolumStil = (tur) => st.xf({ font: { b: true, sz: 10, renk: tur === 'silindi' ? R.KIR7 : R.LAC9, st: tur === 'silindi' }, dolgu: tur === 'yeni' ? R.YESIL : tur === 'degisti' ? R.SARI : tur === 'silindi' ? R.KIR : R.LAC1,
    h: 'center', v: 'center', sar: true, don: 90, kenar: kutu });

  let r = 1;
  /* başlık bandı */
  ws.metin(0, r, KURUM + '  ·  İNSAN KAYNAKLARI', S.ustEtiket); for (let c = 1; c <= SON; c++) ws.stil(c, r, S.ustEtiket); ws.birlestir(0, r, SON, r); ws.yukseklik(r, 18); r++;
  ws.metin(0, r, 'ORYANTASYON FORMU', S.baslik); for (let c = 1; c <= SON; c++) ws.stil(c, r, S.baslik); ws.birlestir(0, r, SON, r); ws.yukseklik(r, 30); r++;
  ws.metin(0, r, g.unvan, S.unvan); for (let c = 1; c <= SON; c++) ws.stil(c, r, S.unvan); ws.birlestir(0, r, SON, r); ws.yukseklik(r, 24); r++;
  ws.metin(0, r, g.meta, S.meta); ws.birlestir(0, r, SON, r); ws.yukseklik(r, 18); r++;
  if (isaretli) { ws.metin(0, r, LEJANT + ' · ' + F.ozetMetni(g.fark.sayac), S.lejant); ws.birlestir(0, r, SON, r); ws.yukseklik(r, 30); r++; }
  ws.yukseklik(r, 8); r++;
  /* PERSONELİN */
  const alanlar = alanModel(g.form, g.fark);
  if (alanlar.length) {
    const pSon = isaretli ? SON - 1 : SON;
    ws.metin(1, r, 'PERSONELİN', S.pBaslik); for (let c = 2; c <= SON; c++) ws.stil(c, r, S.pBaslik); ws.birlestir(1, r, SON, r); ws.yukseklik(r, 20); r++;
    alanlar.forEach((a) => {
      const sEt = a.tur === 'degisti' ? S.pEtiketDeg : a.tur === 'yeni' ? S.pEtiketYeni : a.tur === 'silindi' ? S.pEtiketSil : S.pEtiket;
      const etiket = a.tur === 'degisti' ? [{ t: a.ad || '' }, { t: '\nÖnceki: ' + (sade(a.eskiAd) || '(boştu)'), i: true, sz: 8, renk: R.SARI7 }] : (a.ad || '');
      ws.metin(1, r, etiket, sEt); ws.stil(2, r, sEt); ws.birlestir(1, r, 2, r);
      for (let c = 3; c <= pSon; c++) ws.stil(c, r, S.pDeger); ws.birlestir(3, r, pSon, r);
      if (isaretli) ws.metin(SON, r, a.tur === 'degisti' ? 'Alan adı değişti' : a.tur === 'yeni' ? 'Alan eklendi' : a.tur === 'silindi' ? 'Alan silindi' : '', S.pNot);
      ws.yukseklik(r, a.tur === 'degisti' ? 30 : 20); r++;
    });
    ws.yukseklik(r, 10); r++;
  }
  /* tablo başlığı */
  const BAS = ['Bölüm', 'Sıra', 'Gün Planı', 'Kapsam', 'Tarih / Termin', 'Saat', 'Süre (dk)', 'Oryantasyon Sorumlusu', 'Açıklama / Yorum'].concat(isaretli ? ['Değişiklik'] : []);
  const basSatir = r;
  BAS.forEach((t, c) => ws.metin(c, r, t, S.tBaslik)); ws.yukseklik(r, 30); r++;
  /* gövde */
  const ALAN_KOL = { plan: 2, kapsam: 3, termin: 4, saat: 5, sure: 6, sorumlu: 7, aciklama: 8 };
  const HIZA = { plan: 'left', kapsam: 'left', termin: 'center', saat: 'center', sure: 'center', sorumlu: 'center', aciklama: 'left' };
  model(g.form, g.fark).forEach((b) => {
    const ilk = r;
    const satirlar = b.satir.length ? b.satir : [null];
    satirlar.forEach((s) => {
      let ht = 1;
      if (s) {
        const silik = s.tur === 'silindi' || s.tur === 'bolumle';
        ws.metin(1, r, s.no == null ? '–' : String(s.no), gs(silik ? 'silindi' : s.tur === 'yeni' ? 'yeni' : 'ayni', 'center'));
        F.ALANLAR.forEach((a) => {
          const c = ALAN_KOL[a.k]; const v = s.m[a.k] || '';
          const deg = s.tur === 'degisti' && a.k in s.eski;
          const tur = silik ? 'silindi' : s.tur === 'yeni' ? 'yeni' : deg ? 'degisti' : 'ayni';
          const icerik = deg ? [{ t: v }, { t: (v ? '\n' : '') + 'Önceki: ' + (sade(s.eski[a.k]) || '(boştu)'), i: true, sz: 8, renk: R.SARI7 }] : v;
          ws.metin(c, r, icerik, gs(tur, HIZA[a.k]));
          ht = Math.max(ht, satirSay(v, GEN[c]) + (deg ? satirSay('Önceki: ' + (s.eski[a.k] || '(boştu)'), GEN[c], 1.3) : 0));
        });
        if (isaretli) { ws.metin(SON, r, s.not, gs('not', 'left')); ht = Math.max(ht, satirSay(s.not, GEN[SON], 1.25)); }
      } else for (let c = 1; c <= SON; c++) ws.stil(c, r, gs('ayni', 'left'));
      ws.yukseklik(r, Math.max(22, Math.round(ht * 13.2 + 7)));
      r++;
    });
    const ad = b.tur === 'degisti' ? (b.ad || '') + '\n(önceki: ' + (b.eskiAd || '') + ')' : b.tur === 'yeni' ? (b.ad || '') + '\n(yeni bölüm)' : b.tur === 'silindi' ? (b.ad || '') + '\n(bölüm silindi)' : (b.ad || '');
    ws.metin(0, ilk, ad, bolumStil(b.tur));
    for (let rr = ilk + 1; rr < r; rr++) ws.stil(0, rr, bolumStil(b.tur));
    ws.birlestir(0, ilk, 0, r - 1);
  });
  const altBilgi = 'İnciroğlu Otomotiv · Oryantasyon Formu · ' + g.unvan;
  const dosyalar = [];
  const sayfa1 = ws.xml({ genislik: GEN, altBilgi, ilk: true });
  /* İşaretli çıktı: ayrıntılı değişiklik notları sayfası */
  let sayfa2 = null;
  if (isaretli) {
    const ws2 = sayfaYazici(sst);
    const G2 = [5, 24, 30, 44, 70];
    let r2 = 1;
    ws2.metin(0, r2, 'DEĞİŞİKLİK NOTLARI · ' + g.unvan, S.baslik); for (let c = 1; c < G2.length; c++) ws2.stil(c, r2, S.baslik); ws2.birlestir(0, r2, G2.length - 1, r2); ws2.yukseklik(r2, 28); r2++;
    ws2.metin(0, r2, g.meta + ' · ' + F.ozetMetni(g.fark.sayac), S.meta); ws2.birlestir(0, r2, G2.length - 1, r2); ws2.yukseklik(r2, 30); r2++;
    ws2.yukseklik(r2, 8); r2++;
    ['#', 'Değişiklik', 'Bölüm', 'Madde / Alan', 'Ayrıntı'].forEach((t, c) => ws2.metin(c, r2, t, S.tBaslik)); ws2.yukseklik(r2, 22); r2++;
    const notlar = degisiklikNotlari(g.fark, g.form);
    if (!notlar.length) { ws2.metin(0, r2, 'Değişiklik yok: form ana formla aynı.', gs('ayni', 'left')); for (let c = 1; c < G2.length; c++) ws2.stil(c, r2, gs('ayni', 'left')); ws2.birlestir(0, r2, G2.length - 1, r2); ws2.yukseklik(r2, 22); }
    notlar.forEach((n, i) => {
      const tur = /silindi/i.test(n.tur) ? 'silindi' : /Eklendi|Yeni|eklendi/.test(n.tur) ? 'yeni' : /Düzenlendi|değişti/.test(n.tur) ? 'degisti' : 'ayni';
      ws2.metin(0, r2, String(i + 1), gs('ayni', 'center'));
      ws2.metin(1, r2, n.tur, gs(tur === 'silindi' ? 'ayni' : tur, 'left'));
      ws2.metin(2, r2, n.bolum || '', gs('ayni', 'left'));
      ws2.metin(3, r2, n.madde || '', gs('ayni', 'left'));
      ws2.metin(4, r2, n.ayrinti || '', gs('ayni', 'left'));
      ws2.yukseklik(r2, Math.max(20, Math.round(Math.max(satirSay(n.madde, G2[3]), satirSay(n.ayrinti, G2[4]), satirSay(n.bolum, G2[2])) * 13.2 + 7)));
      r2++;
    });
    sayfa2 = ws2.xml({ genislik: G2, altBilgi: altBilgi + ' · Değişiklik notları' });
  }
  const SAYFA_AD = ['Oryantasyon Formu'].concat(sayfa2 ? ['Değişiklik Notları'] : []);
  dosyalar.push(['[Content_Types].xml', XML_BAS + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + SAYFA_AD.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
    + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>']);
  dosyalar.push(['_rels/.rels', XML_BAS + `<Relationships xmlns="${NS_REL}">`
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>']);
  dosyalar.push(['docProps/core.xml', XML_BAS + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    + `<dc:title>${X('Oryantasyon Formu · ' + g.unvan)}</dc:title><dc:creator>İnciroğlu Otomotiv · İnsan Kaynakları</dc:creator>`
    + `<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>`]);
  dosyalar.push(['xl/workbook.xml', XML_BAS + `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000"/></bookViews>`
    + `<sheets>${SAYFA_AD.map((ad, i) => `<sheet name="${X(ad)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>`
    + `<definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'${X(SAYFA_AD[0])}'!$${basSatir}:$${basSatir}</definedName></definedNames></workbook>`]);
  const n = SAYFA_AD.length;
  dosyalar.push(['xl/_rels/workbook.xml.rels', XML_BAS + `<Relationships xmlns="${NS_REL}">`
    + SAYFA_AD.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + `<Relationship Id="rId${n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`]);
  dosyalar.push(['xl/worksheets/sheet1.xml', sayfa1]);
  if (sayfa2) dosyalar.push(['xl/worksheets/sheet2.xml', sayfa2]);
  dosyalar.push(['xl/styles.xml', st.xml()]);
  dosyalar.push(['xl/sharedStrings.xml', sst.xml()]);
  return zipYap(dosyalar);
}

/* ================================================================== PDF (pdfmake) */
let PDF_YUK = null;
function betikYukle(src) {
  return new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => ok(); s.onerror = () => { s.remove(); no(new Error('PDF bileşeni indirilemedi; internet bağlantınızı kontrol edip tekrar deneyin.')); };
    document.head.append(s);
  });
}
function pdfMakeYukle() {
  if (window.pdfMake && window.pdfMake.createPdf && window.pdfMake.vfs && Object.keys(window.pdfMake.vfs).length) return Promise.resolve(window.pdfMake);
  if (!PDF_YUK) PDF_YUK = (async () => {
    if (!window.pdfMake || !window.pdfMake.createPdf) await betikYukle(PDF_JS);
    await betikYukle(PDF_FONT);
    if (!window.pdfMake || !window.pdfMake.createPdf || !window.pdfMake.vfs) throw new Error('PDF bileşeni yüklenemedi.');
    return window.pdfMake;
  })().catch((e) => { PDF_YUK = null; throw e; });
  return PDF_YUK;
}
const RK = (h) => '#' + h;

/** PDF dosyası üretir ve indirir. g: excelIndir ile aynı. */
export async function pdfIndir(g) {
  const blob = await pdfUret(g);
  indir(blob, dosyaAdi(g.dosya) + '.pdf');
  return blob;
}
export async function pdfUret(g) {
  const pdfMake = await pdfMakeYukle();
  const dd = pdfTanimi(g);
  return new Promise((ok, no) => {
    try { pdfMake.createPdf(dd).getBlob((b) => ok(b)); } catch (e) { no(e); }
  });
}
function pdfTanimi(g) {
  const isaretli = !!g.fark;
  const ciz = RK(R.CIZ);
  const tabloDuzen = { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => ciz, vLineColor: () => ciz, paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 3, paddingBottom: () => 3 };
  const icerik = [];
  /* başlık bandı */
  icerik.push({ table: { widths: ['*'], body: [[{ fillColor: RK(R.LAC9), margin: [12, 9, 12, 10], stack: [
    { text: KURUM + '  ·  İNSAN KAYNAKLARI', fontSize: 7.5, bold: true, color: RK(R.PIR1), characterSpacing: 0.8 },
    { text: 'Oryantasyon Formu · ' + g.unvan, fontSize: 17, bold: true, color: '#FFFFFF', margin: [0, 3, 0, 0] },
    { text: g.meta, fontSize: 8, color: '#C9D4E5', margin: [0, 3, 0, 0] }] }]] }, layout: 'noBorders', margin: [0, 0, 0, 8] });
  if (isaretli) icerik.push({ margin: [0, 0, 0, 8], fontSize: 8, text: [{ text: 'İşaretli çıktı · ', bold: true, color: RK(R.LAC9) }, { text: F.ozetMetni(g.fark.sayac) + '\n', color: RK(R.MET1) },
    { text: ' Değiştirildi (altında önceki hâli) ', background: RK(R.SARI), color: RK(R.MET1) }, { text: '   ' },
    { text: ' Eklendi ', background: RK(R.YESIL), color: RK(R.MET1) }, { text: '   ' },
    { text: ' Silindi ', background: RK(R.KIR), color: RK(R.KIR7), decoration: 'lineThrough' }] });
  /* PERSONELİN: iki sütunlu bilgi alanları (elle doldurmaya uygun boş alanlar) */
  const alanlar = alanModel(g.form, g.fark);
  if (alanlar.length) {
    const hucre = (a) => {
      const dolgu = a.tur === 'degisti' ? RK(R.SARI) : a.tur === 'yeni' ? RK(R.YESIL) : a.tur === 'silindi' ? RK(R.KIR) : RK(R.LAC05);
      const st = a.tur === 'silindi' ? { decoration: 'lineThrough', color: RK(R.KIR7) } : { color: RK(R.MET2) };
      const etk = a.tur === 'degisti' ? { stack: [Object.assign({ text: a.ad || '' }, st), { text: 'Önceki: ' + (sade(a.eskiAd) || '(boştu)'), fontSize: 6.5, italics: true, color: RK(R.SARI7) }] } : Object.assign({ text: a.ad || '' }, st);
      return [Object.assign(etk, { fillColor: dolgu, fontSize: 8.5 }), { text: '' }];
    };
    const govde = [];
    for (let i = 0; i < alanlar.length; i += 2) {
      const sol = hucre(alanlar[i]), sag = alanlar[i + 1] ? hucre(alanlar[i + 1]) : [{ text: '', border: [false, false, false, false] }, { text: '', border: [false, false, false, false] }];
      govde.push(sol.concat(sag));
    }
    icerik.push({ text: 'PERSONELİN', bold: true, fontSize: 9, color: RK(R.LAC9), characterSpacing: 0.6, margin: [0, 2, 0, 3] });
    icerik.push({ table: { widths: [120, '*', 120, '*'], body: govde }, layout: Object.assign({}, tabloDuzen, { paddingTop: () => 5, paddingBottom: () => 5 }), margin: [0, 0, 0, 10] });
  }
  /* ana tablo */
  const W = isaretli ? [20, 100, '*', 46, 28, 30, 82, 92, 112] : [22, 118, '*', 52, 30, 32, 100, 122];
  const nKol = W.length;
  /* pdfmake hücre nesnelerine iç alan yazar: her tabloya YENİ başlık satırı verilir */
  const basSatiri = () => ['Sıra', 'Gün Planı', 'Kapsam', 'Tarih / Termin', 'Saat', 'Süre (dk)', 'Oryantasyon Sorumlusu', 'Açıklama / Yorum'].concat(isaretli ? ['Değişiklik'] : [])
    .map((t) => ({ text: t, bold: true, color: '#FFFFFF', fillColor: RK(R.LAC7), alignment: 'center', fontSize: 7.5 }));
  const ALAN_SIRA = ['plan', 'kapsam', 'termin', 'saat', 'sure', 'sorumlu', 'aciklama'];
  const ORTA = { termin: 1, saat: 1, sure: 1, sorumlu: 1 };
  /* Her bölüm ayrı tablo: sütun başlığı + bölüm bandı başlık satırıdır; bölüm sayfaya bölünürse ikisi de yeni sayfada
     tekrar eder, bant sayfa sonunda tek başına kalmaz (keepWithHeaderRows) */
  model(g.form, g.fark).forEach((b, bi) => {
    const govde = [basSatiri()];
    const dolgu = b.tur === 'yeni' ? RK(R.YESIL) : b.tur === 'degisti' ? RK(R.SARI) : b.tur === 'silindi' ? RK(R.KIR) : RK(R.LAC1);
    const ek = b.tur === 'degisti' ? '   (önceki ad: ' + (b.eskiAd || '') + ')' : b.tur === 'yeni' ? '   · yeni bölüm' : b.tur === 'silindi' ? '   · bölüm silindi (içindeki ' + b.satir.length + ' maddeyle)' : '';
    const bant = [{ text: [{ text: b.ad || '—', bold: true, decoration: b.tur === 'silindi' ? 'lineThrough' : undefined }, { text: ek, italics: true, fontSize: 7.5, color: b.tur === 'silindi' ? RK(R.KIR7) : RK(R.MET2) }],
      colSpan: nKol, fillColor: dolgu, color: b.tur === 'silindi' ? RK(R.KIR7) : RK(R.LAC9), fontSize: 9, margin: [2, 2, 2, 2] }];
    for (let i = 1; i < nKol; i++) bant.push({});
    govde.push(bant);
    b.satir.forEach((s) => {
      const silik = s.tur === 'silindi' || s.tur === 'bolumle';
      const satirDolgu = silik ? RK(R.KIR) : s.tur === 'yeni' ? RK(R.YESIL) : undefined;
      const silStil = silik ? { decoration: 'lineThrough', color: RK(R.KIR7) } : {};
      const row = [Object.assign({ text: s.no == null ? '–' : String(s.no), alignment: 'center', fillColor: satirDolgu }, silik ? { color: RK(R.KIR7) } : {})];
      ALAN_SIRA.forEach((k) => {
        const v = s.m[k] || '';
        const deg = s.tur === 'degisti' && k in s.eski;
        const temel = Object.assign({ alignment: ORTA[k] ? 'center' : 'left', fillColor: deg ? RK(R.SARI) : satirDolgu }, k === 'plan' ? { bold: true } : {});
        if (deg) row.push(Object.assign(temel, { stack: [{ text: v }, { text: 'Önceki: ' + (sade(s.eski[k]) || '(boştu)'), fontSize: 6.5, italics: true, color: RK(R.SARI7), margin: [0, 1, 0, 0] }] }));
        else row.push(Object.assign(temel, { text: v }, silStil));
      });
      if (isaretli) row.push({ text: s.not, fontSize: 7, color: RK(R.MET2), fillColor: satirDolgu });
      govde.push(row);
    });
    if (!b.satir.length) { const bos = [{ text: '(bu bölümde madde yok)', italics: true, color: RK(R.MET3), colSpan: nKol }]; for (let i = 1; i < nKol; i++) bos.push({}); govde.push(bos); }
    icerik.push({ table: { headerRows: 2, keepWithHeaderRows: 1, dontBreakRows: true, widths: W, body: govde }, layout: tabloDuzen, margin: [0, bi ? 8 : 0, 0, 0] });
  });
  /* işaretli: değişiklik notları */
  if (isaretli) {
    const notlar = degisiklikNotlari(g.fark, g.form);
    icerik.push({ text: 'Değişiklik notları', fontSize: 11, bold: true, color: RK(R.LAC9), margin: [0, 14, 0, 4], pageBreak: notlar.length > 8 ? 'before' : undefined });
    if (!notlar.length) icerik.push({ text: 'Değişiklik yok: form ana formla aynı.', color: RK(R.MET2) });
    else icerik.push({ table: { headerRows: 1, dontBreakRows: true, widths: [16, 92, 120, 170, '*'], body: [
      ['#', 'Değişiklik', 'Bölüm', 'Madde / Alan', 'Ayrıntı'].map((t) => ({ text: t, bold: true, color: '#FFFFFF', fillColor: RK(R.LAC7), fontSize: 7.5 }))
    ].concat(notlar.map((n, i) => [String(i + 1), { text: n.tur, bold: true, color: /silindi/i.test(n.tur) ? RK(R.KIR7) : /Eklendi|Yeni|eklendi/.test(n.tur) ? RK(R.YESIL7) : RK(R.MET1) }, n.bolum || '', n.madde || '', n.ayrinti || ''])) }, layout: tabloDuzen });
  }
  return {
    pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [24, 34, 24, 30],
    info: { title: 'Oryantasyon Formu · ' + g.unvan, author: 'İnciroğlu Otomotiv · İnsan Kaynakları', subject: 'Oryantasyon Formu', creator: 'İK Portalı' },
    defaultStyle: { font: 'Roboto', fontSize: 7.8, color: RK(R.MET1), lineHeight: 1.12 },
    header: (p) => (p === 1 ? null : { margin: [24, 14, 24, 0], columns: [
      { text: KURUM + ' · İNSAN KAYNAKLARI', fontSize: 6.5, bold: true, color: RK(R.LAC7), characterSpacing: 0.5 },
      { text: 'Oryantasyon Formu · ' + g.unvan, fontSize: 6.5, color: RK(R.MET3), alignment: 'right' }] }),
    footer: (p, n) => ({ margin: [24, 8, 24, 0], columns: [
      { text: g.meta, fontSize: 6.5, color: RK(R.MET3) },
      { text: 'Sayfa ' + p + ' / ' + n, fontSize: 6.5, color: RK(R.MET3), alignment: 'right', width: 70 }] }),
    content: icerik
  };
}
