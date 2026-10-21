/* ============================================================================
   İnciroğlu Otomotiv · Ortak Kimlik Doğrulama Modülü        (ortak/kimlik.js)
   ----------------------------------------------------------------------------
   Aynı alan adındaki (inciroglu-ik.github.io) uygulamalar giriş için bu modülü
   kullanır. Derleme gerektirmez; tarayıcıda ES modülü olarak yüklenir.

   GÜVENLİK MODELİ (ayrıntı: guvenlik/README.md)
   • Kimlik  : Firebase Authentication. Kullanıcı TC Kimlik No + kendi şifresiyle
               girer. Firebase hesabının e-postası sisteme özeldir (dışarıya
               e-posta gönderilmez). Şifreler yalnız Firebase'de, tuzlu ve
               karma (hash) olarak tutulur; kodda ve veritabanında şifre yoktur.
   • Yetki   : Firestore 'hesaplar/{hid}' kaydı (roller + kapsam). Bu kaydı yalnız
               İK yazar. Kim neyi okuyup yazabilir, Firestore güvenlik
               kurallarıyla SUNUCUDA zorlanır (guvenlik/firestore.rules).
               Bu modüldeki rol kontrolleri yalnız ekranı düzenlemek içindir.
   • İlk giriş / şifre sıfırlama: İK'nın ürettiği tek kullanımlık, süreli
               aktivasyon kodu. Kodun kendisi saklanmaz, yalnız SHA-256 özeti.
   • Oturum  : Hareketsizlik ve azami süre dolunca oturum kapanır; açık oturum
               kapanınca sayfa yenilenir (ekrandaki veri bellekten silinir).
   ============================================================================ */
import { initializeApp, getApps, deleteApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, initializeAuth, inMemoryPersistence, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { initializeFirestore, getFirestore, doc, getDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/* Firebase istemci yapılandırması herkese açık bir tanımlayıcıdır (gizli anahtar değildir);
   erişim, kimlik doğrulama + güvenlik kurallarıyla denetlenir. */
const firebaseConfig = {
  apiKey: "AIzaSyCWlB0nU-ETZxuo9xa6gG4VMYVu09P3fnE",
  authDomain: "yetenek-havuzu.firebaseapp.com",
  projectId: "yetenek-havuzu",
  storageBucket: "yetenek-havuzu.firebasestorage.app",
  messagingSenderId: "714642441227",
  appId: "1:714642441227:web:bf49ac51367c6d9437b30e"
};
/* Adlandırılmış uygulama: oturum, eski (adı verilmemiş) Firebase uygulamalarınınkinden ayrı tutulur. */
const APP_ADI = "inciroglu-kimlik";
export const app = getApps().find((a) => a.name === APP_ADI) || initializeApp(firebaseConfig, APP_ADI);
export const auth = getAuth(app);
/* LONG-POLLING: Kaspersky / kurumsal güvenlik duvarları Firestore'un varsayılan akış (WebChannel)
   bağlantısını bozup okumaları askıda bırakabiliyor; long-polling düz HTTPS istekleriyle çalışır. */
function veritabani(a) {
  try { return initializeFirestore(a, { experimentalForceLongPolling: true }); }
  catch (e) { return getFirestore(a); }
}
export const db = veritabani(app);

export const ROLLER = {
  calisan: "Çalışan",
  ik: "İnsan Kaynakları (tam yetki)",
  direktor: "Direktör",
  satis_mudur: "Satış Müdürü",
  servis_mudur: "Servis Müdürü",
  idari_mudur: "İdari Müdür",
  mudur: "Departman Müdürü"
};
export const KOD_GECERLILIK_GUN = 14;
const HESAP_ALANI = "hesap.inciroglu.local";
const SON_ISLEM = "inc_kimlik_son", GIRIS_ANI = "inc_kimlik_giris", MESAJ = "inc_kimlik_mesaj";

/* ---------------------------------------------------------------- yardımcılar */
const enc = new TextEncoder();
export async function sha256hex(metin) {
  const b = await crypto.subtle.digest("SHA-256", enc.encode(String(metin)));
  return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
}
export function tcTemizle(t) { return String(t == null ? "" : t).replace(/\D/g, ""); }
export function tcBicimGecerli(t) { return /^[1-9][0-9]{10}$/.test(t); }
/* Resmî TC Kimlik No algoritması (yalnız uyarı amaçlı kullanılır; kayıttaki TC esas alınır) */
export function tcAlgoritmaGecerli(t) {
  if (!tcBicimGecerli(t)) return false;
  const d = t.split("").map(Number);
  const on = (((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10 + 10) % 10;
  if (on !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}
/* Hesap kimliği: TC'nin SHA-256 özeti. Belge kimliklerinde TC açık yazılmaz. */
export function hesapId(tc) { return sha256hex("inciroglu-hesap|" + tcTemizle(tc)); }
export function kodNormal(k) { return String(k == null ? "" : k).toUpperCase().replace(/[^A-Z0-9]/g, ""); }
/* Aktivasyon kodu özeti kişiye bağlıdır: aynı kod başka bir hesapta işe yaramaz. */
export function kodOzeti(hid, kod) { return sha256hex("inciroglu-kod|" + hid + "|" + kodNormal(kod)); }
const ALFABE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   /* 32 simge; 0/O ve 1/I karışmasın diye yok */
/* 12 simge × 5 bit = 60 bit rastgelelik (crypto.getRandomValues; 256/32 tam bölünür → sapma yok) */
export function kodUret() {
  const r = crypto.getRandomValues(new Uint8Array(12));
  let s = "";
  for (const x of r) s += ALFABE[x & 31];
  return s.match(/.{4}/g).join("-");
}
function rastgele(n) {
  const r = crypto.getRandomValues(new Uint8Array(n));
  let s = "";
  for (const x of r) s += "abcdefghjkmnpqrstuvwxyz23456789"[x % 31];
  return s;
}
const ZAYIF = ["inciroglu", "inciroğlu", "sifre", "şifre", "parola", "password", "123456", "qwerty", "abc123"];
export function sifreKurali(pw, tc) {
  pw = String(pw || "");
  if (pw.length < 10) return "Şifre en az 10 karakter olmalı.";
  if (pw.length > 128) return "Şifre en fazla 128 karakter olabilir.";
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(pw) || !/[0-9]/.test(pw)) return "Şifrede en az bir harf ve bir rakam olmalı.";
  if (/^(.)\1+$/.test(pw)) return "Şifre tek bir karakterin tekrarı olamaz.";
  const k = pw.toLocaleLowerCase("tr");
  if (ZAYIF.some((w) => k.includes(w))) return "Şifre kolay tahmin edilen bir ifade (ör. “inciroglu”, “123456”) içermemeli.";
  if (tc && tc.length === 11 && pw.includes(tc.slice(5))) return "Şifre TC Kimlik No’nuzun bir bölümünü içermemeli.";
  return "";
}
export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ------------------------------------------------- oturum süresi (istemci) */
const BELLEK = {};
function oku(k) { try { const v = localStorage.getItem(k); if (v != null) return +v || 0; } catch (e) {} return BELLEK[k] || 0; }
function yaz(k, v) { BELLEK[k] = v; try { localStorage.setItem(k, String(v)); } catch (e) {} }
function sil(k) { delete BELLEK[k]; try { localStorage.removeItem(k); } catch (e) {} }
export function yonetimHesabiMi(h) { return !!(h && Array.isArray(h.roller) && h.roller.some((r) => r !== "calisan")); }
/* Yönetim/İK hesapları: 30 dk hareketsizlik, en fazla 10 saat. Yalnız çalışan hesapları
   (kişisel telefondan giriş-çıkış): 14 gün hareketsizlik, en fazla 30 gün. */
function sinirlar(h) {
  return yonetimHesabiMi(h) ? { bosta: 30 * 60e3, azami: 10 * 3600e3 } : { bosta: 14 * 864e5, azami: 30 * 864e5 };
}
function sureDurumu(h) {
  const n = Date.now(), s = sinirlar(h), son = oku(SON_ISLEM), gir = oku(GIRIS_ANI);
  if (!son || !gir) return "yok";
  if (n - gir > s.azami) return "sure";
  if (n - son > s.bosta) return "hareketsiz";
  return "";
}
const NEDEN_METNI = {
  hareketsiz: "Uzun süre işlem yapılmadığı için oturumunuz güvenlik amacıyla kapatıldı. Lütfen tekrar giriş yapın.",
  sure: "Oturum süreniz doldu. Lütfen tekrar giriş yapın.",
  yok: "Güvenliğiniz için lütfen tekrar giriş yapın.",
  cikis: "Çıkış yaptınız.",
  sifre: "Şifreniz değiştirildi. Yeni şifrenizle giriş yapın."
};

/* ------------------------------------------------------------------ arayüz */
const CSS = `
#inc-kimlik{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px 16px;box-sizing:border-box;overflow-y:auto;
 background:radial-gradient(900px 520px at 12% 8%,rgba(181,137,47,.16),transparent 62%),linear-gradient(158deg,#0a1c31 0%,#122a45 52%,#1b3858 100%);
 font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1c2530;-webkit-font-smoothing:antialiased;text-align:left;line-height:1.4}
#inc-kimlik.inck-gizli{display:none}
#inc-kimlik.inck-pencere{background:rgba(8,20,36,.55);backdrop-filter:blur(3px)}
#inc-kimlik *{box-sizing:border-box;font-family:inherit;letter-spacing:normal;text-transform:none;float:none}
#inc-kimlik .inck-kart{width:100%;max-width:420px;margin:auto;background:#fff;border-radius:18px;box-shadow:0 32px 80px rgba(2,10,22,.45);overflow:hidden}
#inc-kimlik .inck-bas{padding:26px 30px 18px;border-bottom:1px solid #edf0f3;display:flex;align-items:center;gap:13px}
#inc-kimlik .inck-amblem{flex:0 0 44px;width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#173252,#0a1c31);color:#d6b061;display:flex;align-items:center;justify-content:center;font:700 22px "Source Serif 4",Georgia,serif;box-shadow:inset 0 0 0 1px rgba(214,176,97,.38)}
#inc-kimlik .inck-unvan b{display:block;font:600 19px/1.2 "Source Serif 4",Georgia,serif;color:#0a1c31;margin:0}
#inc-kimlik .inck-unvan span{display:block;font-size:12.5px;color:#6b7785;margin-top:3px}
#inc-kimlik .inck-govde{padding:22px 30px 24px}
#inc-kimlik h2{margin:0 0 4px;padding:0;font:600 17px/1.3 Inter,system-ui,sans-serif;color:#0a1c31;border:0;background:none}
#inc-kimlik .inck-alt{margin:0 0 6px;font-size:13px;color:#5a6672;line-height:1.55}
#inc-kimlik label{display:block;font-size:11.5px;font-weight:600;color:#3d4954;text-transform:uppercase;letter-spacing:.5px;margin:15px 0 6px;padding:0}
#inc-kimlik input{display:block;width:100%;height:auto;margin:0;padding:11px 13px;border:1px solid #d3dae2;border-radius:10px;font:500 14.5px Inter,system-ui,sans-serif;color:#1c2530;background:#fbfcfd;outline:none;box-shadow:none;transition:border-color .15s,box-shadow .15s}
#inc-kimlik input:focus{border-color:#b5892f;box-shadow:0 0 0 3px rgba(181,137,47,.18);background:#fff}
#inc-kimlik .inck-sar{position:relative}
#inc-kimlik .inck-sar input{padding-right:46px}
#inc-kimlik .inck-goz{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:34px;height:34px;margin:0;padding:0;border:0;background:transparent;cursor:pointer;color:#7a8692;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:none}
#inc-kimlik .inck-goz:hover{background:#f0f3f6}
#inc-kimlik .inck-goz.inck-acik{color:#b5892f}
#inc-kimlik .inck-goz svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#inc-kimlik button.inck-dugme{display:block;width:100%;margin:20px 0 0;padding:12px 14px;border:0;border-radius:10px;background:linear-gradient(135deg,#173252,#0a1c31);color:#fff;font:600 14.5px Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 16px rgba(10,28,49,.25);text-align:center;height:auto;line-height:1.3}
#inc-kimlik button.inck-dugme:hover{filter:brightness(1.08)}
#inc-kimlik button.inck-dugme:disabled{opacity:.6;cursor:default;filter:none}
#inc-kimlik button.inck-ikincil{background:#fff;color:#173252;border:1px solid #cdd5de;box-shadow:none;margin-top:10px}
#inc-kimlik .inck-mesaj{min-height:18px;margin-top:12px;font-size:13px;line-height:1.5}
#inc-kimlik .inck-mesaj.inck-hata{color:#b3261e}
#inc-kimlik .inck-mesaj.inck-ok{color:#1e7a4c}
#inc-kimlik .inck-mesaj.inck-bilgi{color:#3d4954}
#inc-kimlik .inck-baglanti{margin-top:16px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px 14px;font-size:12.5px}
#inc-kimlik .inck-baglanti a{color:#8a6418;text-decoration:none;font-weight:600;cursor:pointer}
#inc-kimlik .inck-baglanti a:hover{text-decoration:underline}
#inc-kimlik .inck-ipucu{font-size:12px;color:#6b7785;margin-top:7px;line-height:1.5}
#inc-kimlik .inck-kutu{margin-top:14px;padding:12px 14px;border-radius:10px;background:#f6f8fa;border:1px solid #e8ecf0;font-size:12.8px;color:#3d4954;line-height:1.55}
#inc-kimlik .inck-kutu b{color:#0a1c31}
#inc-kimlik .inck-kutu ol{margin:6px 0 0;padding-left:18px}
#inc-kimlik .inck-altbilgi{padding:13px 30px;background:#f6f8fa;border-top:1px solid #edf0f3;font-size:11.5px;color:#7a8692;line-height:1.55}
#inc-kimlik .inck-donen{width:28px;height:28px;border:3px solid #e3e8ee;border-top-color:#b5892f;border-radius:50%;animation:inckd .8s linear infinite;margin:10px auto 12px}
@keyframes inckd{to{transform:rotate(360deg)}}
#inc-kimlik .inck-merkez{text-align:center}
#inc-kimlik [hidden]{display:none!important}
@media (max-width:480px){#inc-kimlik .inck-bas,#inc-kimlik .inck-govde,#inc-kimlik .inck-altbilgi{padding-left:20px;padding-right:20px}}
`;
const GOZ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
function sifreAlani(id, ad, otomatik) {
  return `<div class="inck-sar"><input id="${id}" name="${ad}" type="password" autocomplete="${otomatik}" required>`
    + `<button type="button" class="inck-goz" data-goz="${id}" title="Şifreyi göster" aria-label="Şifreyi göster">${GOZ}</button></div>`;
}
const HTML = `
<div class="inck-kart" role="dialog" aria-modal="true" aria-labelledby="inck-baslik">
  <div class="inck-bas"><div class="inck-amblem">İ</div><div class="inck-unvan"><b>İnciroğlu Otomotiv</b><span id="inck-uyg"></span></div></div>

  <section class="inck-govde" data-v="yuk">
    <div class="inck-merkez"><div class="inck-donen"></div><div class="inck-alt" id="inck-yuk-m">Oturum denetleniyor…</div></div>
  </section>

  <section class="inck-govde" data-v="giris" hidden>
    <h2 id="inck-baslik">Giriş</h2>
    <p class="inck-alt">TC Kimlik No’nuz ve kendi belirlediğiniz şifrenizle giriş yapın.</p>
    <form id="inck-gf" autocomplete="on" novalidate>
      <label for="inck-gtc">TC Kimlik No</label>
      <input id="inck-gtc" name="username" inputmode="numeric" autocomplete="username" maxlength="14" placeholder="11 haneli" required>
      <label for="inck-gpw">Şifre</label>
      ${sifreAlani("inck-gpw", "password", "current-password")}
      <button class="inck-dugme" id="inck-gbtn" type="submit">Giriş Yap</button>
      <div class="inck-mesaj" id="inck-gm" role="alert"></div>
    </form>
    <div class="inck-baglanti"><a data-git="etk">İlk giriş · Hesabımı etkinleştir</a><a data-git="unuttum">Şifremi unuttum</a></div>
  </section>

  <section class="inck-govde" data-v="etk" hidden>
    <h2>Hesabımı etkinleştir</h2>
    <p class="inck-alt">İK’dan aldığınız <b>aktivasyon kodu</b> ile kendi şifrenizi belirleyin. Kod tek kullanımlıktır; şifrenizi unutursanız İK’dan yeni kod isteyin.</p>
    <form id="inck-ef" autocomplete="on" novalidate>
      <label for="inck-etc">TC Kimlik No</label>
      <input id="inck-etc" name="username" inputmode="numeric" autocomplete="username" maxlength="14" placeholder="11 haneli" required>
      <label for="inck-ekod">Aktivasyon kodu</label>
      <input id="inck-ekod" name="aktivasyon" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH-JKLM" required>
      <div id="inck-ead-k" hidden><label for="inck-ead">Ad Soyad</label><input id="inck-ead" name="adsoyad" autocomplete="name"></div>
      <label for="inck-es1">Yeni şifre</label>
      ${sifreAlani("inck-es1", "new-password", "new-password")}
      <label for="inck-es2">Yeni şifre (tekrar)</label>
      ${sifreAlani("inck-es2", "new-password-2", "new-password")}
      <div class="inck-ipucu">En az 10 karakter; en az bir harf ve bir rakam. TC’nizi, “inciroglu”, “123456” gibi kolay ifadeleri kullanmayın.</div>
      <button class="inck-dugme" id="inck-ebtn" type="submit">Hesabımı Etkinleştir</button>
      <div class="inck-mesaj" id="inck-em" role="alert"></div>
    </form>
    <div class="inck-baglanti"><a data-git="giris">← Girişe dön</a></div>
  </section>

  <section class="inck-govde" data-v="unuttum" hidden>
    <h2>Şifremi unuttum</h2>
    <div class="inck-kutu">Güvenlik gereği şifreler kimse tarafından görülemez ve e-postayla gönderilmez.
      <ol><li>İnsan Kaynakları’ndan <b>yeni bir aktivasyon kodu</b> isteyin.</li><li>Bu ekranda <b>“Hesabımı etkinleştir”</b> ile kodu ve yeni şifrenizi girin.</li></ol>
      Yeni kod üretildiği anda eski şifreniz geçersiz olur.</div>
    <div class="inck-baglanti"><a data-git="etk">Kodum var · Hesabımı etkinleştir</a><a data-git="giris">← Girişe dön</a></div>
  </section>

  <section class="inck-govde" data-v="yetkisiz" hidden>
    <h2>Bu uygulamaya erişim yetkiniz yok</h2>
    <p class="inck-alt" id="inck-ym"></p>
    <button class="inck-dugme inck-ikincil" type="button" data-cikis>Çıkış yap</button>
  </section>

  <section class="inck-govde" data-v="sifre" hidden>
    <h2>Şifremi değiştir</h2>
    <p class="inck-alt">Önce mevcut şifrenizi, sonra yeni şifrenizi girin.</p>
    <form id="inck-sf" autocomplete="on" novalidate>
      <input type="text" name="username" autocomplete="username" id="inck-sus" hidden>
      <label for="inck-s0">Mevcut şifre</label>
      ${sifreAlani("inck-s0", "password", "current-password")}
      <label for="inck-s1">Yeni şifre</label>
      ${sifreAlani("inck-s1", "new-password", "new-password")}
      <label for="inck-s2">Yeni şifre (tekrar)</label>
      ${sifreAlani("inck-s2", "new-password-2", "new-password")}
      <div class="inck-ipucu">En az 10 karakter; en az bir harf ve bir rakam.</div>
      <button class="inck-dugme" id="inck-sbtn" type="submit">Şifreyi Değiştir</button>
      <button class="inck-dugme inck-ikincil" type="button" id="inck-skapat">Vazgeç</button>
      <div class="inck-mesaj" id="inck-sm" role="alert"></div>
    </form>
  </section>

  <div class="inck-altbilgi">Bu sistem yalnız yetkili İnciroğlu Otomotiv çalışanları içindir. Kişisel veriler 6698 sayılı KVKK kapsamında korunur.</div>
</div>`;

let KOK = null;
const $ = (id) => KOK && KOK.querySelector("#" + id);
function arayuzKur() {
  if (KOK) return;
  if (!document.querySelector('link[data-inck-font]')) {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.setAttribute("data-inck-font", "1");
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap";
    document.head.appendChild(l);
  }
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);
  KOK = document.createElement("div");
  KOK.id = "inc-kimlik";
  KOK.innerHTML = HTML;
  (document.body || document.documentElement).appendChild(KOK);
  $("inck-uyg").textContent = SECENEK.uygulama;
  KOK.querySelectorAll("[data-git]").forEach((a) => a.addEventListener("click", () => goster(a.getAttribute("data-git"))));
  KOK.querySelectorAll("[data-goz]").forEach((b) => b.addEventListener("click", () => {
    const i = $(b.getAttribute("data-goz")); const ac = i.type === "password";
    i.type = ac ? "text" : "password"; b.classList.toggle("inck-acik", ac);
    b.title = ac ? "Şifreyi gizle" : "Şifreyi göster"; b.setAttribute("aria-label", b.title);
  }));
  KOK.querySelectorAll("[data-cikis]").forEach((b) => b.addEventListener("click", () => cikisYap("cikis")));
  $("inck-gf").addEventListener("submit", girisGonder);
  $("inck-ef").addEventListener("submit", etkinlestirGonder);
  $("inck-sf").addEventListener("submit", sifreGonder);
  $("inck-skapat").addEventListener("click", () => { gozleriKapat(); temizle(["inck-s0", "inck-s1", "inck-s2"]); arayuzGizle(); });
  /* Kurulum kodu (20 simge) yazılırsa Ad Soyad alanı açılır */
  $("inck-ekod").addEventListener("input", () => { $("inck-ead-k").hidden = kodNormal($("inck-ekod").value).length !== 20; });
  ["inck-gtc", "inck-etc"].forEach((id) => $(id).addEventListener("input", () => { const v = tcTemizle($(id).value).slice(0, 11); if ($(id).value !== v) $(id).value = v; }));
}
function gozleriKapat() {
  if (!KOK) return;
  KOK.querySelectorAll("[data-goz]").forEach((b) => { const i = $(b.getAttribute("data-goz")); if (i) i.type = "password"; b.classList.remove("inck-acik"); });
}
function temizle(ids) { ids.forEach((id) => { const i = $(id); if (i) i.value = ""; }); }
function goster(v, metin) {
  arayuzKur();
  KOK.classList.remove("inck-gizli", "inck-pencere");
  KOK.querySelectorAll("section[data-v]").forEach((s) => { s.hidden = s.getAttribute("data-v") !== v; });
  if (v === "yuk" && metin) $("inck-yuk-m").textContent = metin;
  ["inck-gm", "inck-em", "inck-sm"].forEach((id) => mesaj(id, "", ""));
  const odak = { giris: "inck-gtc", etk: "inck-etc", sifre: "inck-s0" }[v];
  if (odak) setTimeout(() => { const i = $(odak); if (i && !i.value) i.focus(); else if (v === "giris") $("inck-gpw").focus(); }, 60);
}
function arayuzGizle() { if (KOK) KOK.classList.add("inck-gizli"); }
function mesaj(id, metin, tur) { const m = $(id); if (!m) return; m.textContent = metin || ""; m.className = "inck-mesaj" + (tur ? " inck-" + tur : ""); }
function mesgul(id, evet, yazi) { const b = $(id); if (!b) return; b.disabled = !!evet; if (yazi) b.textContent = yazi; }
function hataMetni(e) {
  const c = (e && e.code) || "";
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return "TC Kimlik No veya şifre hatalı.";
  if (/too-many-requests/.test(c)) return "Çok fazla hatalı deneme yapıldı. Güvenlik için birkaç dakika bekleyip tekrar deneyin.";
  if (/network-request-failed|unavailable/.test(c)) return "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";
  if (/user-disabled/.test(c)) return "Hesabınız devre dışı bırakılmış. İK ile görüşün.";
  if (/weak-password/.test(c)) return "Şifre çok zayıf; daha uzun ve karmaşık bir şifre seçin.";
  if (/requires-recent-login/.test(c)) return "Güvenlik için tekrar giriş yapmanız gerekiyor.";
  if (/permission-denied/.test(c)) return "Bu işlem için yetkiniz yok.";
  return "Beklenmeyen bir hata oluştu" + (c ? " (" + c + ")" : "") + ". Tekrar deneyin.";
}

/* --------------------------------------------------------------- akış */
let SECENEK = { uygulama: "İnciroğlu Otomotiv", roller: [] };
let DURUM = { user: null, hid: null, hesap: null };
let ISLEM = false, YETKILI = false, BASLADI = false, COZ = null;
let SIRA = 0;            /* üst üste gelen oturum olaylarında yalnız en sonuncusu ekrana yansır */
let BEKLEYEN = null;     /* oturum kapatılırken giriş ekranında gösterilecek mesaj */

/* Uygulama girişi: oturum + (verildiyse) gerekli rollerden biri sağlanınca çözülür.
   secenek = { uygulama: "İK Sistemi", roller: ["ik"] }  (roller boşsa her geçerli hesap) */
export function kimlikBaslat(secenek) {
  SECENEK = Object.assign({ uygulama: "İnciroğlu Otomotiv", roller: [] }, secenek || {});
  return new Promise((resolve) => {
    if (YETKILI && DURUM.hesap) { resolve({ user: DURUM.user, hid: DURUM.hid, hesap: DURUM.hesap }); return; }
    COZ = resolve;
    const basla = () => {
      arayuzKur();
      goster("yuk");
      if (BASLADI) return;
      BASLADI = true;
      onAuthStateChanged(auth, (u) => { if (!ISLEM) durumDegisti(u); });
    };
    if (document.body) basla(); else document.addEventListener("DOMContentLoaded", basla, { once: true });
  });
}

async function durumDegisti(u) {
  const sira = ++SIRA;
  /* Açık (yetkili) oturum kapandıysa ya da başka bir sekmede FARKLI bir kullanıcıyla giriş yapıldıysa
     sayfa yenilenir: önceki kullanıcının verisi ekranda/bellekte kalmaz. */
  if (YETKILI && (!u || !DURUM.user || u.uid !== DURUM.user.uid)) { location.reload(); return; }
  if (!u) {
    DURUM = { user: null, hid: null, hesap: null };
    goster("giris");
    let m = "";
    try { m = sessionStorage.getItem(MESAJ) || ""; sessionStorage.removeItem(MESAJ); } catch (e) {}
    if (BEKLEYEN) { mesaj("inck-gm", BEKLEYEN.metin, BEKLEYEN.tur); BEKLEYEN = null; }
    else if (m && NEDEN_METNI[m]) mesaj("inck-gm", NEDEN_METNI[m], m === "cikis" || m === "sifre" ? "ok" : "bilgi");
    return;
  }
  goster("yuk", "Hesabınız denetleniyor…");
  let s;
  try { s = await hesapYukle(u); }
  catch (e) {
    if (sira !== SIRA) return;
    goster("giris");
    mesaj("inck-gm", e && /unavailable|network/.test(e.code || e.message || "") ? hataMetni({ code: "network-request-failed" }) : "Hesap bilgisi okunamadı. Sayfayı yenileyip tekrar deneyin.", "hata");
    return;
  }
  if (sira !== SIRA) return;
  if (!s.ok) {
    BEKLEYEN = { metin: s.mesaj, tur: "hata" };
    await oturumuKapat();
    return;
  }
  const neden = sureDurumu(s.hesap);
  if (neden) { await cikisYap(neden); return; }
  if (sira !== SIRA) return;
  DURUM = { user: u, hid: s.hid, hesap: s.hesap };
  const izinli = !SECENEK.roller.length || s.hesap.roller.some((r) => SECENEK.roller.indexOf(r) >= 0);
  if (!izinli) {
    goster("yetkisiz");
    $("inck-ym").textContent = (s.hesap.ad ? s.hesap.ad + " olarak giriş yaptınız. " : "") + "Bu ekran için gerekli yetki hesabınızda tanımlı değil. Yetki gerekiyorsa İnsan Kaynakları ile görüşün.";
    return;
  }
  arayuzGizle();
  YETKILI = true;
  hareketTakibi();
  if (COZ) { const c = COZ; COZ = null; c({ user: u, hid: s.hid, hesap: s.hesap }); }
}

async function hesapYukle(u) {
  const red = (e) => e && e.code === "permission-denied";
  let bag;
  try { bag = await getDoc(doc(db, "uidBag", u.uid)); }
  catch (e) { if (red(e)) return { ok: false, mesaj: "Oturum doğrulanamadı. Tekrar giriş yapın." }; throw e; }
  if (!bag.exists()) return { ok: false, mesaj: "Bu oturum bir İnciroğlu hesabına bağlı değil. TC Kimlik No ve şifrenizle giriş yapın." };
  const hid = bag.data().hid;
  let h;
  try { h = await getDoc(doc(db, "hesaplar", hid)); }
  catch (e) {
    if (red(e)) return { ok: false, mesaj: "Hesabınız kapatılmış ya da yeni bir aktivasyon koduyla yeniden etkinleştirilmesi gerekiyor. İnsan Kaynakları ile görüşün." };
    throw e;
  }
  const d = h.exists() ? h.data() : null;
  if (!d || d.aktif !== true || d.uid !== u.uid) return { ok: false, mesaj: "Hesabınız kapatılmış ya da yeniden etkinleştirilmesi gerekiyor. İnsan Kaynakları ile görüşün." };
  return { ok: true, hid, hesap: Object.assign({}, d, { roller: Array.isArray(d.roller) ? d.roller.slice() : [], kapsam: d.kapsam || {} }) };
}

async function girisGonder(ev) {
  ev.preventDefault();
  const tc = tcTemizle($("inck-gtc").value), pw = $("inck-gpw").value || "";
  if (!tcBicimGecerli(tc)) return mesaj("inck-gm", "TC Kimlik No 11 haneli olmalı.", "hata");
  if (!pw) return mesaj("inck-gm", "Şifrenizi girin.", "hata");
  mesgul("inck-gbtn", true, "Giriş yapılıyor…"); mesaj("inck-gm", "", "");
  try {
    const hid = await hesapId(tc);
    let adres;
    try { adres = await getDoc(doc(db, "girisAdresi", hid)); }
    catch (e) {
      if (e && e.code === "permission-denied") { mesaj("inck-gm", "Giriş sistemi şu anda güncelleniyor. Birkaç dakika sonra tekrar deneyin.", "hata"); return; }
      throw e;
    }
    if (!adres.exists() || !adres.data().e) {
      mesaj("inck-gm", "Bu TC Kimlik No ile etkinleştirilmiş bir hesap bulunamadı. İlk girişinizse “Hesabımı etkinleştir” bağlantısını kullanın.", "hata");
      return;
    }
    yaz(GIRIS_ANI, Date.now()); yaz(SON_ISLEM, Date.now());
    await signInWithEmailAndPassword(auth, adres.data().e, pw);
    gozleriKapat(); temizle(["inck-gpw"]);
  } catch (e) {
    sil(GIRIS_ANI);
    mesaj("inck-gm", hataMetni(e), "hata");
  } finally { mesgul("inck-gbtn", false, "Giriş Yap"); }
}

async function etkinlestirGonder(ev) {
  ev.preventDefault();
  const tc = tcTemizle($("inck-etc").value), kod = kodNormal($("inck-ekod").value);
  const p1 = $("inck-es1").value || "", p2 = $("inck-es2").value || "";
  const kurulum = kod.length === 20, ad = ($("inck-ead").value || "").trim().replace(/\s+/g, " ");
  if (!tcBicimGecerli(tc)) return mesaj("inck-em", "TC Kimlik No 11 haneli olmalı.", "hata");
  if (kod.length !== 12 && !kurulum) return mesaj("inck-em", "Aktivasyon kodu 12 karakterdir (ör. ABCD-EFGH-JKLM).", "hata");
  if (kurulum && ad.length < 5) return mesaj("inck-em", "Ad Soyad girin.", "hata");
  const k = sifreKurali(p1, tc); if (k) return mesaj("inck-em", k, "hata");
  if (p1 !== p2) return mesaj("inck-em", "Girdiğiniz iki şifre aynı değil.", "hata");
  mesgul("inck-ebtn", true, "Etkinleştiriliyor…"); mesaj("inck-em", "", "");
  /* Etkinleştirme, belleğe bağlı (kalıcı olmayan) AYRI bir Firebase uygulamasında yapılır: başarılı olana kadar
     bu ve diğer sekmelerdeki açık oturum etkilenmez; başarısız olursa yarım hesap silinir. */
  const ikinci = initializeApp(firebaseConfig, "inck-aktivasyon-" + Date.now() + "-" + rastgele(4));
  const a2 = initializeAuth(ikinci, { persistence: inMemoryPersistence });
  const db2 = veritabani(ikinci);
  let cred = null, tamam = false, eposta = "";
  try {
    const hid = await hesapId(tc);
    eposta = "h" + hid.slice(0, 16) + "." + rastgele(10) + "@" + HESAP_ALANI;
    cred = await createUserWithEmailAndPassword(a2, eposta, p1);
    const uid = cred.user.uid, b = writeBatch(db2);
    if (kurulum) {
      /* TEK SEFERLİK KURULUM: ilk İK yöneticisi. Kural; kodu özetle doğrular, süreyi denetler ve
         kurulum/tek kaydı yalnız BİR KEZ oluşturulabildiği için ikinci kez kullanılamaz. */
      b.set(doc(db2, "kurulum", "tek"), { kod, uid });
      b.set(doc(db2, "hesaplar", hid), {
        ad: ad.toLocaleUpperCase("tr"), tc, roller: ["calisan", "ik"], kapsam: {}, aktif: true, uid,
        kodHash: null, kodSon: null, kodDurum: "kullanildi", olusturan: "kurulum", olusturma: serverTimestamp(),
        guncelleyen: "kurulum", guncelleme: serverTimestamp(), aktivasyon: serverTimestamp()
      });
      b.set(doc(db2, "uidBag", uid), { hid, kodHash: "kurulum", ts: serverTimestamp() });
    } else {
      b.set(doc(db2, "uidBag", uid), { hid, kodHash: await kodOzeti(hid, kod), ts: serverTimestamp() });
      b.update(doc(db2, "hesaplar", hid), { uid, kodDurum: "kullanildi", aktivasyon: serverTimestamp() });
    }
    b.set(doc(db2, "girisAdresi", hid), { e: eposta });
    await b.commit();
    tamam = true;
  } catch (e) {
    if (cred) { try { await deleteUser(cred.user); } catch (x) {} }
    mesaj("inck-em", e && e.code === "permission-denied"
      ? "Aktivasyon kodu hatalı, daha önce kullanılmış ya da süresi dolmuş. Kodu ve TC Kimlik No’yu kontrol edin; sorun sürerse İK’dan yeni kod isteyin."
      : hataMetni(e), "hata");
  } finally {
    try { await deleteApp(ikinci); } catch (x) {}
    mesgul("inck-ebtn", false, "Hesabımı Etkinleştir");
  }
  if (!tamam) return;
  /* Hesap etkin: ana uygulamada yeni hesapla oturum açılır (dinleyici ekranı devralır) */
  gozleriKapat(); temizle(["inck-ekod", "inck-es1", "inck-es2", "inck-ead"]);
  yaz(GIRIS_ANI, Date.now()); yaz(SON_ISLEM, Date.now());
  try { await signInWithEmailAndPassword(auth, eposta, p1); }
  catch (e) { goster("giris"); mesaj("inck-gm", "Hesabınız etkinleştirildi. TC Kimlik No’nuz ve yeni şifrenizle giriş yapın.", "ok"); }
}

/* Uygulamanın "Şifremi değiştir" düğmesi bunu çağırır */
export function sifreDegistir() {
  if (!auth.currentUser || !YETKILI) return;
  goster("sifre");
  KOK.classList.add("inck-pencere");
  $("inck-sus").value = (DURUM.hesap && DURUM.hesap.tc) || "";
}
async function sifreGonder(ev) {
  ev.preventDefault();
  const u = auth.currentUser; if (!u) return;
  const p0 = $("inck-s0").value || "", p1 = $("inck-s1").value || "", p2 = $("inck-s2").value || "";
  if (!p0) return mesaj("inck-sm", "Mevcut şifrenizi girin.", "hata");
  const k = sifreKurali(p1, DURUM.hesap && DURUM.hesap.tc); if (k) return mesaj("inck-sm", k, "hata");
  if (p1 !== p2) return mesaj("inck-sm", "Girdiğiniz iki yeni şifre aynı değil.", "hata");
  if (p1 === p0) return mesaj("inck-sm", "Yeni şifre mevcut şifreyle aynı olamaz.", "hata");
  mesgul("inck-sbtn", true, "Değiştiriliyor…");
  try {
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, p0));
    await updatePassword(u, p1);
    temizle(["inck-s0", "inck-s1", "inck-s2"]); gozleriKapat();
    mesaj("inck-sm", "Şifreniz değiştirildi.", "ok");
    setTimeout(arayuzGizle, 1400);
  } catch (e) {
    mesaj("inck-sm", /invalid-credential|wrong-password/.test((e && e.code) || "") ? "Mevcut şifre hatalı." : hataMetni(e), "hata");
  } finally { mesgul("inck-sbtn", false, "Şifreyi Değiştir"); }
}

/* Çıkış (uygulamanın "Çıkış" düğmesi de bunu çağırır). Diğer sekme/çerçevelerde de oturum kapanır. */
export async function cikisYap(neden) {
  try { sessionStorage.setItem(MESAJ, neden || "cikis"); } catch (e) {}
  sil(GIRIS_ANI); sil(SON_ISLEM);
  await oturumuKapat();
}
/* Oturum açıksa kapatır (dinleyici giriş ekranını/yenilemeyi üstlenir); kapalıysa giriş ekranını doğrudan gösterir. */
async function oturumuKapat() {
  const vardi = !!auth.currentUser;
  try { await signOut(auth); } catch (e) {}
  if (!vardi && !YETKILI) durumDegisti(null);
}

let TAKIP = false, SON_YAZ = 0;
function hareketTakibi() {
  if (TAKIP) return;
  TAKIP = true;
  const isle = () => { const n = Date.now(); if (n - SON_YAZ > 15000) { SON_YAZ = n; yaz(SON_ISLEM, n); } };
  ["click", "keydown", "mousemove", "scroll", "touchstart", "wheel"].forEach((e) => window.addEventListener(e, isle, { passive: true, capture: true }));
  isle();
  const denetle = () => { if (!DURUM.hesap || !auth.currentUser) return; const n = sureDurumu(DURUM.hesap); if (n) cikisYap(n); };
  setInterval(denetle, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) denetle(); });
}

/* Uygulamaların okuyabileceği güncel hesap bilgisi (yalnız arayüz için) */
export function aktifHesap() { return DURUM.hesap ? Object.assign({ hid: DURUM.hid }, DURUM.hesap) : null; }
export function rolVar(r) { return !!(DURUM.hesap && DURUM.hesap.roller.indexOf(r) >= 0); }
export function adBasliklari(ad) {
  return String(ad || "").toLocaleLowerCase("tr").replace(/(^|[\s\-'])([a-zçğıöşü])/g, (m, a, b) => a + b.toLocaleUpperCase("tr"));
}
