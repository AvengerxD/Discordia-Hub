// Cria (uma vez) as pastas android/ e ios/ com o Capacitor e aplica os ajustes do DiscórdiaHub:
// permissões de microfone e câmera, serviço de call em segundo plano (Android) e modo áudio em segundo plano (iOS).
// Pode rodar de novo sem problema: cada ajuste só é aplicado se ainda não estiver lá.
// Uso: npm run mobile:init   (ou: node mobile/init.js android | ios)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const raiz = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(raiz, 'capacitor.config.json'), 'utf8'));
const appId = cfg.appId;
const alvo = process.argv[2]; // "android", "ios" ou vazio (os dois, onde der)
const quer = (p) => !alvo || alvo === p;
const run = (c) => { console.log('> ' + c); cp.execSync(c, { cwd: raiz, stdio: 'inherit' }); };
const ler = (f) => fs.readFileSync(f, 'utf8');

function androidManifest() {
  const f = path.join(raiz, 'android/app/src/main/AndroidManifest.xml');
  let m = ler(f);
  const perms = [
    'android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE', 'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS', 'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE', 'android.permission.FOREGROUND_SERVICE_CAMERA', 'android.permission.POST_NOTIFICATIONS',
  ];
  const faltam = perms.filter((p) => !m.includes('"' + p + '"'));
  let extra = faltam.map((p) => '    <uses-permission android:name="' + p + '" />').join('\n');
  if (!m.includes('android.hardware.camera')) extra += '\n    <uses-feature android:name="android.hardware.camera" android:required="false" />';
  if (!m.includes('android.hardware.microphone')) extra += '\n    <uses-feature android:name="android.hardware.microphone" android:required="false" />';
  if (extra.trim()) m = m.replace('<application', extra.trim() + '\n\n    <application');
  if (!m.includes('.CallService')) {
    m = m.replace('</application>', '    <service android:name=".CallService" android:exported="false" android:foregroundServiceType="microphone|camera" />\n    </application>');
  }
  fs.writeFileSync(f, m);
}

function android() {
  const dir = path.join(raiz, 'android/app/src/main/java', ...appId.split('.'));
  fs.mkdirSync(dir, { recursive: true });
  for (const n of ['MainActivity.java', 'CallService.java', 'CallServicePlugin.java']) {
    fs.writeFileSync(path.join(dir, n), ler(path.join(__dirname, 'android', n)).replace(/__APP_ID__/g, appId));
  }
  androidManifest();
  console.log('Android ajustado.');
}

function ios() {
  const f = path.join(raiz, 'ios/App/App/Info.plist');
  let p = ler(f);
  const add = (chave, xml) => { if (!p.includes('<key>' + chave + '</key>')) p = p.replace(/<\/dict>\s*<\/plist>\s*$/, xml + '\n</dict>\n</plist>\n'); };
  add('NSMicrophoneUsageDescription', '\t<key>NSMicrophoneUsageDescription</key>\n\t<string>O DiscórdiaHub usa o microfone para a conversa por voz com seus amigos.</string>');
  add('NSCameraUsageDescription', '\t<key>NSCameraUsageDescription</key>\n\t<string>O DiscórdiaHub usa a câmera para você aparecer na call.</string>');
  add('UIBackgroundModes', '\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>audio</string>\n\t</array>');
  fs.writeFileSync(f, p);
  console.log('iOS ajustado.');
}

run('node mobile/build-web.js');
if (quer('android')) { if (!fs.existsSync(path.join(raiz, 'android'))) run('npx cap add android'); android(); }
if (quer('ios')) {
  if (process.platform !== 'darwin') console.log('iOS: pulado (só dá para criar o projeto iOS num Mac).');
  else { if (!fs.existsSync(path.join(raiz, 'ios'))) run('npx cap add ios'); ios(); }
}
try { run('npx capacitor-assets generate --iconBackgroundColor "#14161F" --iconBackgroundColorDark "#14161F" --splashBackgroundColor "#14161F" --splashBackgroundColorDark "#14161F"'); }
catch (e) { console.log('Aviso: não consegui gerar os ícones agora (o app usa o ícone padrão). Rode de novo com internet.'); }
run('npx cap sync' + (alvo ? ' ' + alvo : ''));
