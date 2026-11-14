// Atualiza o hash do script na política de segurança do sala.html. Rodado automaticamente antes de "npm start" e do build.
const fs = require('fs'), { HTML, selarCsp } = require('./harness.js');
const h = fs.readFileSync(HTML, 'utf8'), n = selarCsp(h);
if (n !== h) { fs.writeFileSync(HTML, n); console.log('sala.html selado (hash atualizado).'); } else console.log('sala.html já estava selado.');
