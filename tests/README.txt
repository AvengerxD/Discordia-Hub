TESTES AUTOMÁTICOS DO DISCÓRDIAHUB
==================================
Rodam a página (sala.html) em dois ou três navegadores Chromium de verdade, com microfone, câmera
e tela de mentira, e com servidores de sinalização falsos na sua máquina (nada sai para a internet).

Como rodar
  npm install              (instala o Playwright; já vem no package.json)
  npx playwright install chromium     (baixa o navegador de teste, uma vez só)
  npm test                 (roda suite.js e media-suite.js)

O que cobrem
  suite.js        entrada na sala, avisos sonoros, voz/câmera/tela entre dois computadores, volume,
                  tela cheia, chat, emoji, fotos, nome no chat vindo da presença, limites de memória,
                  código da sala, política de segurança, diagnóstico e recuperação de conexão.
  media-suite.js  player de música e vídeo: reconhecimento de links, sincronia (YouTube e Twitch
                  simulados, arquivo de áudio de verdade), quem entra depois, mensagens maliciosas.

Importante
  - Depois de editar o sala.html, rode "npm run selar": ele atualiza o hash do script na política
    de segurança (sem isso a página não executa). "npm start" e o build já fazem isso sozinhos.
  - Os testes NÃO cobrem a parte Electron (ícone perto do relógio, X escondendo a janela, escolha de
    tela, instalador). Para isso use o ROTEIRO-DE-TESTE.txt, no Windows.
  - O teste do arquivo de áudio gera na hora um certificado descartável com o openssl (se não
    houver openssl, essa parte é pulada e o resto roda normalmente).
