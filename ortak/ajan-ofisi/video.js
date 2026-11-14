/* ============================================================================
   AJAN OFİSİ · VİDEO STÜDYOSU — Video Editörünün sahne planını tuvale çizer,
   ElevenLabs ile seslendirir ve MediaRecorder ile video dosyası üretir (build yok).
   ============================================================================ */
const VW = 1920, VH = 1080;
const RENK = { lacivert: '#16294a', koyu: '#0d1a30', pirinc: '#b08d57', acikPirinc: '#d9bf8f', beyaz: '#ffffff', gri: '#c9d3e0' };

/* ---------------------------------------------------------------- ses önbelleği (IndexedDB, isteğe bağlı) */
function idb() {
  return new Promise((coz) => {
    try {
      const r = indexedDB.open('ajan-ofisi-ses', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('ses');
      r.onsuccess = () => coz(r.result); r.onerror = () => coz(null);
    } catch (e) { coz(null); }
  });
}
async function onbellekAl(k) { const d = await idb(); if (!d) return null; return new Promise((coz) => { try { const q = d.transaction('ses').objectStore('ses').get(k); q.onsuccess = () => coz(q.result || null); q.onerror = () => coz(null); } catch (e) { coz(null); } }); }
async function onbellekKoy(k, v) { const d = await idb(); if (!d) return; try { d.transaction('ses', 'readwrite').objectStore('ses').put(v, k); } catch (e) { /* önbellek isteğe bağlı */ } }
async function ozet(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32); }

export async function seslendir(metin, { anahtar, sesId }) {
  const k = await ozet(sesId + '|' + metin);
  const eski = await onbellekAl(k);
  if (eski) return eski;
  const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(sesId) + '?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': anahtar, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: metin, model_id: 'eleven_multilingual_v2' })
  });
  if (!r.ok) {
    let ayr = ''; try { ayr = (await r.text()).slice(0, 160); } catch (e) { /* yok */ }
    throw new Error(r.status === 401 ? 'ElevenLabs anahtarı geçersiz.' : r.status === 404 ? 'ElevenLabs ses kimliği (Voice ID) bulunamadı.' : 'ElevenLabs hatası ' + r.status + (ayr ? ': ' + ayr : ''));
  }
  const ab = await r.arrayBuffer();
  await onbellekKoy(k, ab);
  return ab;
}

/* ---------------------------------------------------------------- çizim yardımcıları */
function sar(ctx, metin, maxW) {
  const kelimeler = String(metin || '').split(/\s+/); const satirlar = []; let s = '';
  for (const k of kelimeler) { const d = s ? s + ' ' + k : k; if (ctx.measureText(d).width > maxW && s) { satirlar.push(s); s = k; } else s = d; }
  if (s) satirlar.push(s);
  return satirlar;
}
const yumusak = (t) => t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3);
function arkaPlan(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, VW, VH); g.addColorStop(0, RENK.koyu); g.addColorStop(1, RENK.lacivert);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.globalAlpha = 0.07; ctx.strokeStyle = RENK.acikPirinc; ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) { const r = 260 + i * 120 + Math.sin(t * 0.3 + i) * 18; ctx.beginPath(); ctx.arc(VW * 0.86, VH * 0.18, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
function ustBant(ctx) {
  ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, 0, VW, 86);
  ctx.fillStyle = RENK.pirinc; ctx.fillRect(120, 40, 46, 6);
  ctx.font = '600 26px Inter, "Segoe UI", sans-serif'; ctx.fillStyle = RENK.gri; ctx.textBaseline = 'middle';
  ctx.fillText('İNCİROĞLU OTOMOTİV  ·  İNSAN KAYNAKLARI', 186, 44);
}
function ilerlemeCiz(ctx, oran) {
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(120, VH - 70, VW - 240, 6);
  ctx.fillStyle = RENK.pirinc; ctx.fillRect(120, VH - 70, (VW - 240) * oran, 6);
}
function sahneCiz(ctx, s, lt, sure) {
  const giris = yumusak(lt / 0.8); const cikis = 1 - yumusak((lt - (sure - 0.5)) / 0.5);
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(giris, cikis));
  const kay = (1 - giris) * 40;
  ctx.textBaseline = 'alphabetic';
  if (s.tur === 'baslik' || s.tur === 'kapanis') {
    ctx.textAlign = 'center';
    if (s.ust) { ctx.font = '600 34px Inter, "Segoe UI", sans-serif'; ctx.fillStyle = RENK.acikPirinc; ctx.fillText(s.ust.toLocaleUpperCase('tr'), VW / 2, 420 + kay); }
    ctx.font = '600 92px "Source Serif 4", Georgia, serif'; ctx.fillStyle = RENK.beyaz;
    sar(ctx, s.baslik, 1500).slice(0, 3).forEach((sat, i) => ctx.fillText(sat, VW / 2, 540 + i * 108 + kay));
    ctx.fillStyle = RENK.pirinc; ctx.fillRect(VW / 2 - 60, 470 + kay, 120, 5);
    if (s.tur === 'kapanis' && s.maddeler && s.maddeler[0]) { ctx.font = '400 36px Inter, "Segoe UI", sans-serif'; ctx.fillStyle = RENK.gri; ctx.fillText(s.maddeler[0], VW / 2, 860 + kay); }
  } else if (s.tur === 'rakam') {
    ctx.textAlign = 'left';
    ctx.font = '700 260px "Source Serif 4", Georgia, serif'; ctx.fillStyle = RENK.pirinc; ctx.fillText(s.rakam || '—', 140, 520 + kay);
    ctx.font = '600 64px "Source Serif 4", Georgia, serif'; ctx.fillStyle = RENK.beyaz;
    sar(ctx, s.baslik, 1500).slice(0, 2).forEach((sat, i) => ctx.fillText(sat, 150, 650 + i * 76 + kay));
    ctx.font = '400 36px Inter, "Segoe UI", sans-serif'; ctx.fillStyle = RENK.gri;
    (s.maddeler || []).slice(0, 3).forEach((m, i) => { const a = yumusak((lt - 0.8 - i * 0.5) / 0.6); ctx.globalAlpha = Math.min(a, cikis); ctx.fillText('— ' + m, 150, 840 + i * 52); });
  } else if (s.tur === 'ekran') {
    ctx.textAlign = 'left';
    if (s.ust) { ctx.font = '600 30px Inter, "Segoe UI", sans-serif'; ctx.fillStyle = RENK.acikPirinc; ctx.fillText(s.ust.toLocaleUpperCase('tr'), 140, 230 + kay); }
    ctx.font = '600 66px "Source Serif 4", Georgia, serif'; ctx.fillStyle = RENK.beyaz;
    sar(ctx, s.baslik, 720).slice(0, 4).forEach((sat, i) => ctx.fillText(sat, 140, 320 + i * 78 + kay));
    const x0 = 960, y0 = 190, w = 820, h = 640, a = yumusak((lt - 0.3) / 0.9);
    ctx.globalAlpha = Math.min(a, cikis);
    ctx.fillStyle = '#f4f6fa'; ctx.fillRect(x0, y0 + (1 - a) * 30, w, h);
    ctx.fillStyle = RENK.lacivert; ctx.fillRect(x0, y0 + (1 - a) * 30, w, 64);
    ctx.fillStyle = RENK.pirinc; ctx.fillRect(x0 + 24, y0 + 26 + (1 - a) * 30, 120, 12);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + 24 + i * 262, y0 + 92 + (1 - a) * 30, 244, 120); ctx.fillStyle = i === 1 ? RENK.pirinc : RENK.lacivert; ctx.fillRect(x0 + 44 + i * 262, y0 + 130 + (1 - a) * 30, 110, 34); }
    for (let i = 0; i < 8; i++) { const bh = 60 + ((i * 53) % 220) * yumusak((lt - 0.8 - i * 0.08) / 0.6); ctx.fillStyle = i % 3 === 1 ? RENK.pirinc : '#5d7aa3'; ctx.fillRect(x0 + 60 + i * 90, y0 + h - 40 - bh + (1 - a) * 30, 54, bh); }
    ctx.globalAlpha = Math.min(giris, cikis);
    ctx.font = '400 32px Inter, "Segoe UI", sans-serif'; ctx.fillStyle = RENK.gri;
    (s.maddeler || []).slice(0, 3).forEach((m, i) => ctx.fillText('— ' + m, 140, 700 + i * 50));
  } else {
    ctx.textAlign = 'left';
    if (s.ust) { ctx.font = '600 32px Inter, "Segoe UI", sans-serif'; ctx.fillStyle = RENK.acikPirinc; ctx.fillText(s.ust.toLocaleUpperCase('tr'), 140, 260 + kay); }
    ctx.font = '600 76px "Source Serif 4", Georgia, serif'; ctx.fillStyle = RENK.beyaz;
    const sat = sar(ctx, s.baslik, 1620).slice(0, 2);
    sat.forEach((x, i) => ctx.fillText(x, 140, 360 + i * 88 + kay));
    const y = 360 + sat.length * 88 + 40;
    ctx.font = '400 44px Inter, "Segoe UI", sans-serif';
    (s.maddeler || []).slice(0, 5).forEach((m, i) => {
      const a = yumusak((lt - 0.7 - i * 0.55) / 0.5); ctx.globalAlpha = Math.min(a, cikis);
      ctx.fillStyle = RENK.pirinc; ctx.fillRect(146, y + i * 86 - 22, 16, 16);
      ctx.fillStyle = RENK.beyaz; ctx.fillText(m, 190 + (1 - a) * 30, y + i * 86);
    });
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- oynatma / kayıt */
export function desteklenenBicim() {
  const adaylar = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  if (typeof MediaRecorder === 'undefined') return '';
  return adaylar.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
}

/* plan: {baslik, sahneler[]}; ses: {anahtar, sesId} | null; kayit: true ise Blob döner */
export async function videoUret({ plan, tuval, ses, kayit, ilerleme, iptal }) {
  tuval.width = VW; tuval.height = VH;
  const ctx = tuval.getContext('2d');
  const AC = window.AudioContext || window.webkitAudioContext;
  const actx = new AC();
  const sahneler = plan.sahneler.slice();
  const tamponlar = [];
  for (let i = 0; i < sahneler.length; i++) {
    let tampon = null;
    if (ses && ses.anahtar && ses.sesId && sahneler[i].seslendirme) {
      ilerleme && ilerleme({ asama: 'ses', i, n: sahneler.length });
      const ab = await seslendir(sahneler[i].seslendirme, ses);
      tampon = await actx.decodeAudioData(ab.slice(0));
    }
    tamponlar.push(tampon);
  }
  const sureler = sahneler.map((s, i) => Math.max(s.sure, tamponlar[i] ? tamponlar[i].duration + 0.7 : 0));
  const baslar = []; let top = 0; for (const d of sureler) { baslar.push(top); top += d; }
  try { await document.fonts.load('600 92px "Source Serif 4"'); await document.fonts.load('600 30px Inter'); } catch (e) { /* yedek font */ }

  let kaydedici = null, parcalar = [], bicim = '';
  const hedef = actx.createMediaStreamDestination();
  if (kayit) {
    bicim = desteklenenBicim();
    if (!bicim) throw new Error('Bu tarayıcı video kaydını desteklemiyor (Chrome önerilir).');
    const akim = tuval.captureStream(30);
    hedef.stream.getAudioTracks().forEach((t) => akim.addTrack(t));
    kaydedici = new MediaRecorder(akim, { mimeType: bicim, videoBitsPerSecond: 8000000 });
    kaydedici.ondataavailable = (e) => { if (e.data && e.data.size) parcalar.push(e.data); };
  }
  /* Ses bağlamı tarayıcı izniyle açılır; açılmazsa video sessiz ve duvar saatiyle oynar (kayıt takılmaz). */
  await Promise.race([actx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 600))]);
  const sesli = actx.state === 'running';
  const saatAl = sesli ? () => actx.currentTime : () => performance.now() / 1000;
  const t0 = saatAl() + 0.25;
  tamponlar.forEach((b, i) => {
    if (!b || !sesli) return;
    const kaynak = actx.createBufferSource(); kaynak.buffer = b;
    kaynak.connect(actx.destination); kaynak.connect(hedef);
    kaynak.start(t0 + baslar[i] + 0.35);
  });
  if (kaydedici) kaydedici.start(500);
  await new Promise((coz) => {
    function kare() {
      const t = saatAl() - t0;
      if ((iptal && iptal()) || t >= top) { coz(); return; }
      let i = 0; while (i < sahneler.length - 1 && t >= baslar[i + 1]) i++;
      arkaPlan(ctx, Math.max(0, t)); ustBant(ctx);
      if (t >= 0) sahneCiz(ctx, sahneler[i], t - baslar[i], sureler[i]);
      ilerlemeCiz(ctx, Math.max(0, Math.min(1, t / top)));
      ilerleme && ilerleme({ asama: 'oynat', t: Math.max(0, t), top });
      requestAnimationFrame(kare);
    }
    requestAnimationFrame(kare);
  });
  let blob = null;
  if (kaydedici) {
    await new Promise((coz) => { kaydedici.onstop = coz; kaydedici.stop(); });
    blob = new Blob(parcalar, { type: bicim.split(';')[0] });
  }
  try { await actx.close(); } catch (e) { /* kapalı */ }
  return { blob, bicim, sure: top, sesli };
}
export function planSuresi(plan) { return (plan && plan.sahneler ? plan.sahneler : []).reduce((s, x) => s + (Number(x.sure) || 0), 0); }
