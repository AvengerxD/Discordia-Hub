// Cria (uma vez) a chave que assina o APK do Android. Guarde o arquivo discordiahub.keystore: perdendo a chave,
// ninguém consegue mais atualizar por cima do app já instalado (teria que desinstalar e instalar de novo).
// Uso: npm run mobile:chave   (precisa do Java/keytool: vem com o Android Studio ou o JDK)
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const raiz = path.join(__dirname, '..');
const arq = path.join(raiz, 'discordiahub.keystore');
if (fs.existsSync(arq)) { console.error('Já existe ' + arq + ' (não vou sobrescrever a chave).'); process.exit(1); }
const senha = crypto.randomBytes(18).toString('base64').replace(/[^A-Za-z0-9]/g, 'x');
const alias = 'discordiahub';
cp.execFileSync('keytool', ['-genkeypair', '-v', '-keystore', arq, '-alias', alias, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '36500',
  '-storepass', senha, '-keypass', senha, '-dname', 'CN=DiscordiaHub, O=Grupo, C=BR'], { stdio: 'inherit' });
const b64 = fs.readFileSync(arq).toString('base64');
fs.writeFileSync(path.join(raiz, 'discordiahub-keystore-base64.txt'), b64);
console.log('\nPronto. Agora, no GitHub: Settings > Secrets and variables > Actions > New repository secret, crie estes 4:\n');
console.log('  ANDROID_KEYSTORE_BASE64   = (todo o conteúdo do arquivo discordiahub-keystore-base64.txt)');
console.log('  ANDROID_KEYSTORE_PASSWORD = ' + senha);
console.log('  ANDROID_KEY_ALIAS         = ' + alias);
console.log('  ANDROID_KEY_PASSWORD      = ' + senha);
console.log('\nGuarde uma cópia de discordiahub.keystore e da senha num lugar seguro. NÃO envie esses arquivos ao GitHub (já estão no .gitignore).');
