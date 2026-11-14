/* ============================================================================
   AJAN OFİSİ · BEYİN — tarayıcıdan Claude API (resmî @anthropic-ai/sdk, CDN)
   SDK ilk kullanımda yüklenir (CDN erişilemezse ofis yine açılır).
   Anahtar yalnız ofis sahibinin Firestore kaydında durur; bu modül onu bellekte tutar.
   ============================================================================ */
import { calistir, VARSAYILAN_MODEL, kademeBilgisi } from './kadro.js';

const SDK_ADRESI = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm';
let Anthropic = null, ISTEMCI = null, ANAHTAR = '';

async function sdk() {
  if (!Anthropic) {
    try { Anthropic = (await import(SDK_ADRESI)).default; }
    catch (e) { const h = new Error('Claude kütüphanesi yüklenemedi (internet/CDN). Sayfayı yenileyip tekrar deneyin.'); h.kod = 'sdk'; throw h; }
  }
  return Anthropic;
}

export function anahtarAyarla(a) {
  const yeni = String(a || '').trim();
  if (yeni !== ANAHTAR) { ANAHTAR = yeni; ISTEMCI = null; }
}
export function anahtarVar() { return !!ANAHTAR; }

async function istemci() {
  if (!ANAHTAR) { const e = new Error('Claude API anahtarı girilmemiş (Ayarlar).'); e.kod = 'anahtar'; throw e; }
  const A = await sdk();
  if (!ISTEMCI) {
    ISTEMCI = new A({
      apiKey: ANAHTAR,
      dangerouslyAllowBrowser: true,     /* anahtar yalnız ofis sahibinin kendi tarayıcısında kullanılır */
      maxRetries: 2,
      timeout: 10 * 60 * 1000,
      fetch: (...a) => globalThis.fetch(...a)
    });
  }
  return ISTEMCI;
}

/* SDK hatalarını anlaşılır Türkçeye çevirir (en özelden genele). */
export function hataMetni(e) {
  if (!e) return 'Bilinmeyen hata';
  if (['anahtar', 'ret', 'bicim', 'butce', 'sdk'].indexOf(e.kod) >= 0) return e.message;
  const A = Anthropic;
  if (A) {
    if (e instanceof A.AuthenticationError) return 'API anahtarı geçersiz ya da iptal edilmiş. Ayarlar’dan yeni anahtar girin.';
    if (e instanceof A.PermissionDeniedError) return 'Bu anahtarın bu modele ya da özelliğe izni yok.';
    if (e instanceof A.NotFoundError) return 'Model bulunamadı. Ayarlar’daki model seçimini kontrol edin.';
    if (e instanceof A.RateLimitError) return 'Hız sınırına takıldık; birkaç dakika sonra tekrar deneyin.';
    if (e instanceof A.BadRequestError) return 'İstek reddedildi: ' + String(e.message || '').slice(0, 220);
    if (e instanceof A.InternalServerError) return 'Claude tarafında geçici bir sorun var; biraz sonra tekrar deneyin.';
    if (e instanceof A.APIConnectionError) return 'Claude’a bağlanılamadı. İnternet bağlantınızı kontrol edin.';
    if (e instanceof A.APIError) return 'API hatası ' + (e.status || '') + ': ' + String(e.message || '').slice(0, 220);
  }
  if (e.name === 'AbortError') return 'İşlem durduruldu.';
  return String(e.message || e).slice(0, 300);
}

/* istek: kadro.js istek kurucularından biri. kademe: çalışanın maaş kademesi (effort). */
export async function dusun(istek, { model, kademe, signal } = {}) {
  const effort = kademeBilgisi(kademe == null ? 1 : kademe).effort;
  const sonuc = await calistir(await istemci(), istek, { model: model || VARSAYILAN_MODEL, effort, signal });
  sonuc.effort = effort;
  return sonuc;
}

/* Anahtar testi: Models API (token harcamaz). */
export async function anahtarTest(model) {
  const c = await istemci();
  const m = await c.models.retrieve(model || VARSAYILAN_MODEL);
  return { id: m.id, ad: m.display_name || m.id };
}
