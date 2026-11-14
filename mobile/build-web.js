// Prepara a pasta www/ (o que vai dentro do aplicativo de celular): é o mesmo sala.html, como index.html.
const fs = require('fs'), path = require('path');
const { selado } = require('../tests/harness.js');
const raiz = path.join(__dirname, '..');
if (!selado()) { console.error('sala.html desatualizado: rode "npm run selar" antes.'); process.exit(1); }
const www = path.join(raiz, 'www');
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
fs.copyFileSync(path.join(raiz, 'sala.html'), path.join(www, 'index.html'));
console.log('www/index.html pronto.');
