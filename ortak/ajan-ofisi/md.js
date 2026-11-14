/* ============================================================================
   AJAN OFİSİ · güvenli küçük Markdown gösterici
   Model çıktısı (web içeriğinden etkilenmiş olabilir) burada GÜVENSİZ kabul edilir:
   1) Kod parçaları ve bağlantılar HAM metinden çıkarılıp yer tutucuya çevrilir.
      Bağlantı adresi new URL() ile doğrulanır; yalnız http/https, tırnak/ayraç/açılı ayraç içermeyen adres.
   2) Kalan metin TÜMÜYLE kaçışlanır; yalnız kalın/italik uygulanır.
   3) Yer tutucular en sonda, kaçışlanmış güvenli HTML ile değiştirilir.
   Üretilen HTML hiçbir zaman yeniden düzenli ifadeden geçmez (öznitelik enjeksiyonu olmaz).
   ============================================================================ */
export function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const YASAK_URL = /["'<>`\s()\\]/;
export function guvenliUrl(ham) {
  const s = String(ham || '').trim();
  if (!s || s.length > 2000 || YASAK_URL.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password) return null;
    return u.href;
  } catch (e) { return null; }
}
function baglanti(url, metin) {
  return '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer nofollow">' + esc(metin) + '</a>';
}

function satirIci(ham) {
  const parca = [];
  const tut = (html) => '\u0001' + (parca.push(html) - 1) + '\u0002';
  let s = String(ham == null ? '' : ham).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  s = s.replace(/`([^`]{1,500})`/g, (m, k) => tut('<code>' + esc(k) + '</code>'));
  s = s.replace(/\[([^\]\n]{1,300})\]\(([^)\n]{1,2000})\)/g, (m, metin, adres) => {
    const u = guvenliUrl(adres);
    return u ? tut(baglanti(u, metin)) : tut(esc(metin));
  });
  s = s.replace(/https?:\/\/[^\s<>"'`()\\\u0001\u0002]+/g, (m) => {
    const sonNokta = /[.,;:!?]+$/.exec(m); const govde = sonNokta ? m.slice(0, -sonNokta[0].length) : m;
    const u = guvenliUrl(govde);
    return (u ? tut(baglanti(u, govde)) : esc(govde)) + (sonNokta ? sonNokta[0] : '');
  });
  let t = esc(s);
  t = t.replace(/\*\*([^*\u0001\u0002]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s\u0001\u0002][^*\u0001\u0002]*)\*/g, '$1<em>$2</em>');
  return t.replace(/\u0001(\d+)\u0002/g, (m, i) => (parca[+i] != null ? parca[+i] : ''));
}

export function md(metin) {
  const satirlar = String(metin || '').replace(/\r/g, '').split('\n');
  const out = []; let liste = null; let kod = null; let tablo = null;
  const listeKapat = () => { if (liste) { out.push('</' + liste + '>'); liste = null; } };
  const tabloKapat = () => {
    if (!tablo) return;
    const [bas, ...gov] = tablo.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r));
    const hucre = (r) => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((x) => satirIci(x.trim()));
    out.push('<div class="md-tablo"><table><thead><tr>' + hucre(bas).map((h) => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' +
      gov.map((r) => '<tr>' + hucre(r).map((h) => '<td>' + h + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
    tablo = null;
  };
  for (const s of satirlar) {
    if (kod) {
      if (/^```/.test(s)) { out.push('<pre class="md-kod"><code>' + esc(kod.metin.join('\n')) + '</code></pre>'); kod = null; }
      else kod.metin.push(s);
      continue;
    }
    if (/^```/.test(s)) { listeKapat(); tabloKapat(); kod = { metin: [] }; continue; }
    if (/^\s*\|.*\|\s*$/.test(s)) { listeKapat(); (tablo = tablo || []).push(s); continue; } else tabloKapat();
    let m;
    if ((m = /^(#{1,4})\s+(.*)$/.exec(s))) { listeKapat(); const n = Math.min(4, m[1].length + 1); out.push('<h' + n + '>' + satirIci(m[2]) + '</h' + n + '>'); continue; }
    if ((m = /^\s*[-*•]\s+(.*)$/.exec(s))) { if (liste !== 'ul') { listeKapat(); liste = 'ul'; out.push('<ul>'); } out.push('<li>' + satirIci(m[1]) + '</li>'); continue; }
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(s))) { if (liste !== 'ol') { listeKapat(); liste = 'ol'; out.push('<ol>'); } out.push('<li>' + satirIci(m[1]) + '</li>'); continue; }
    if (/^\s*(---|\*\*\*)\s*$/.test(s)) { listeKapat(); out.push('<hr>'); continue; }
    if (!s.trim()) { listeKapat(); continue; }
    listeKapat();
    out.push('<p>' + satirIci(s) + '</p>');
  }
  if (kod) out.push('<pre class="md-kod"><code>' + esc(kod.metin.join('\n')) + '</code></pre>');
  listeKapat(); tabloKapat();
  return out.join('\n');
}
