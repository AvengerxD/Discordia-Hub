// Utilidades comuns dos testes: prepara a página para rodar com servidores de sinalização de mentira.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const HTML = path.join(__dirname, '..', 'sala.html');
const ARGS = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  '--auto-select-desktop-capture-source=Entire screen', '--disable-features=WebRtcHideLocalIpsWithMdns',
  '--autoplay-policy=no-user-gesture-required'];

// Recalcula o hash do script embutido e o escreve na política de segurança (CSP).
function selarCsp(html) {
  const i = html.indexOf('<script>') + 8, j = html.indexOf('</script>', i);
  // O navegador troca CRLF por LF dentro do script antes de conferir o hash (regra do HTML), então o hash tem que
  // ser calculado sobre o texto com LF, mesmo que o Git do Windows tenha gravado o arquivo com CRLF.
  const txt = html.slice(i, j).replace(/\r\n?/g, '\n');
  const h = crypto.createHash('sha256').update(txt, 'utf8').digest('base64');
  return html.replace(/script-src 'sha256-[^']*'/, "script-src 'sha256-" + h + "'");
}
// A página de produção precisa estar selada (rode "npm run selar" depois de editar o sala.html).
function selado() { const h = fs.readFileSync(HTML, 'utf8'); return selarCsp(h) === h; }
// Versão de teste: troca os servidores públicos pelos de mentira e re-sela (a CSP continua estrita).
function paginaDeTeste(brokers) {
  let h = fs.readFileSync(HTML, 'utf8');
  h = h.replace(/connect-src [^;]*;/, 'connect-src ws://127.0.0.1:*;')
       .replace(/const BROKERS=\[.*\];/, 'const BROKERS=' + JSON.stringify(brokers) + ';');
  return selarCsp(h);
}
async function servir(html, porta) {
  const s = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(html); });
  await new Promise(r => s.listen(porta, '127.0.0.1', r));
  return s;
}
// WAV de 90 s (tom de 440 Hz, 8 kHz, mono) gerado na hora
function wavDeTeste() {
  const n = 8000 * 90, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(8000, 24); buf.writeUInt32LE(16000, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(8000 * Math.sin(2 * Math.PI * 440 * i / 8000)), 44 + i * 2);
  return buf;
}
// Certificado descartável (gerado na hora com o openssl, se existir) para servir o áudio de teste por https.
function certDeTeste() {
  const os = require('os'), cp = require('child_process');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dh-cert-')), k = path.join(d, 'k.pem'), c = path.join(d, 'c.pem');
  try {
    cp.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', k, '-out', c, '-days', '2', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
    return { key: fs.readFileSync(k), cert: fs.readFileSync(c) };
  } catch (e) { return null; }
}
module.exports = { certDeTeste, ARGS, HTML, selarCsp, selado, paginaDeTeste, servir, wavDeTeste };
