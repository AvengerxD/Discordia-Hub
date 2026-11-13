const { app, BrowserWindow, session, desktopCapturer, ipcMain, shell, Tray, Menu, nativeImage, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");

app.commandLine.appendSwitch("disable-features", "WebRtcHideLocalIpsWithMdns");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.setAppUserModelId("com.seugrupo.salap2p");

let win = null;
let tray = null;
let chosen = null;     // fonte de tela escolhida na janela da página
let saindo = false;    // true quando o app deve fechar de verdade
let avisou = false;    // aviso do "segundo plano" mostrado uma vez por sessão
let capturando = false; // true enquanto microfone, câmera ou tela estão ativos
let cfg = { segundoPlano: true };
let autoUpdater = null;  // electron-updater (só quando o repositório está configurado no package.json)
let baixada = false;     // atualização já baixada, pronta para instalar
let origem = ""; // endereço local (http://localhost:PORTA) de onde a página é servida

const PERMITIDAS = new Set(["media", "display-capture", "fullscreen", "clipboard-sanitized-write"]);
const arquivoCfg = () => path.join(app.getPath("userData"), "config.json");
function lerCfg() {
  try { cfg = Object.assign({ segundoPlano: true }, JSON.parse(fs.readFileSync(arquivoCfg(), "utf8"))); } catch (e) { /* usa o padrão */ }
}
function salvarCfg() {
  try { fs.writeFileSync(arquivoCfg(), JSON.stringify(cfg)); } catch (e) { /* ignora */ }
}

// Os players do YouTube, Twitch, Spotify e TikTok não funcionam em páginas abertas como arquivo (file://).
// Por isso a página é servida por um servidor mínimo, só neste computador (127.0.0.1) e só com o sala.html.
const PORTA = 47318;
function ouvir(srv, porta) {
  return new Promise((ok, no) => {
    srv.once("error", no);
    srv.listen(porta, "127.0.0.1", () => { srv.removeListener("error", no); ok(srv.address().port); });
  });
}
async function iniciarServidor() {
  const html = fs.readFileSync(path.join(__dirname, "sala.html"));
  const srv = http.createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/" || req.url.startsWith("/?"))) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(html);
    } else {
      res.writeHead(404); res.end();
    }
  });
  let porta;
  try { porta = await ouvir(srv, PORTA); } catch (e) { porta = await ouvir(srv, 0); }
  return "http://localhost:" + porta;
}

// Atualização automática: usa as Releases do GitHub (repositório público). Só liga no programa instalado e
// depois que "owner" e "repo" forem preenchidos em package.json > build > publish.
function iniciarAtualizador() {
  if (!app.isPackaged) return;
  try {
    const pub = (require("./package.json").build || {}).publish;
    const p = Array.isArray(pub) ? pub[0] : pub;
    if (!p || !p.owner || /SEU-/.test(p.owner) || /SEU-/.test(p.repo || "")) return;
    autoUpdater = require("electron-updater").autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("update-downloaded", (info) => {
      baixada = true;
      if (win) win.webContents.send("upd:pronta", String(info.version));
      if (Notification.isSupported()) new Notification({ title: "DiscórdiaHub", body: "A versão " + info.version + " está pronta. Abra o app e clique em reiniciar." }).show();
    });
    autoUpdater.on("error", () => { /* sem internet ou sem Release: tenta de novo mais tarde */ });
    const verificar = () => autoUpdater.checkForUpdates().catch(() => {});
    verificar();
    setInterval(verificar, 6 * 60 * 60 * 1000);
  } catch (e) { autoUpdater = null; }
}

function mostrar() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

const textoBandeja = () => capturando ? "DiscórdiaHub: microfone, câmera ou tela ATIVOS" : "DiscórdiaHub";
const doApp = (url) => typeof url === "string" && origem !== "" && url.startsWith(origem + "/");
const confiavel = (e) => !!(e && e.senderFrame && doApp(e.senderFrame.url));

function criarBandeja() {
  if (tray) return;
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "icone.ico")));
  tray.setToolTip(textoBandeja());
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir o DiscórdiaHub", click: mostrar },
    { type: "separator" },
    { label: "Sair", click: () => { saindo = true; app.quit(); } },
  ]));
  tray.on("click", mostrar);
}

function criarJanela() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "DiscórdiaHub",
    icon: path.join(__dirname, "icone.ico"),
    backgroundColor: "#14161F",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false, // a call continua em tempo real com a janela escondida
    },
  });
  win.setMenu(null);
  win.loadURL(origem + "/");
  // Para investigar problemas: abra o app com a variável DISCORDIAHUB_DEBUG=1 (veja o ROTEIRO-DE-TESTE.txt).
  if (process.env.DISCORDIAHUB_DEBUG === "1") win.webContents.openDevTools({ mode: "detach" });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  // A janela só pode mostrar o próprio sala.html; qualquer outra navegação é bloqueada.
  win.webContents.on("will-navigate", (e, url) => { if (!doApp(url)) e.preventDefault(); });
  // Botão X: esconde a janela e mantém tudo rodando (se a opção estiver ligada).
  win.on("close", (e) => {
    if (cfg.segundoPlano && !saindo) {
      e.preventDefault();
      win.hide();
      criarBandeja();
      if (Notification.isSupported()) {
        if (capturando) {
          // Sempre avisa: com a janela escondida é fácil esquecer que o microfone, a câmera ou a tela estão no ar.
          new Notification({ title: "DiscórdiaHub", body: "Atenção: microfone, câmera ou tela continuam ATIVOS em segundo plano. Clique no ícone perto do relógio para abrir." }).show();
        } else if (!avisou) {
          avisou = true;
          new Notification({ title: "DiscórdiaHub", body: "Continua em segundo plano. Clique no ícone perto do relógio para abrir." }).show();
        }
      }
    }
  });
  win.on("closed", () => { win = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", mostrar);
  app.on("before-quit", () => { saindo = true; });

  app.whenReady().then(async () => {
    lerCfg();
    origem = await iniciarServidor();
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((wc, perm, cb) => {
      let origemOk = false;
      try { origemOk = !!wc && doApp(wc.getURL()); } catch (e) { /* nega */ }
      cb(origemOk && PERMITIDAS.has(perm));
    });
    // A verificação também confere a origem de quem pergunta (antes só olhava o tipo de permissão).
    ses.setPermissionCheckHandler((_wc, perm, requestingOrigin) => {
      try { return PERMITIDAS.has(perm) && new URL(requestingOrigin).origin === new URL(origem).origin; } catch (e) { return false; }
    });

    // A página escolhe a fonte (janela própria) e depois pede getDisplayMedia.
    ses.setDisplayMediaRequestHandler(async (_req, callback) => {
      const c = chosen; chosen = null;
      const fontes = await desktopCapturer.getSources({ types: ["screen", "window"] });
      // Só compartilha o que a pessoa escolheu: se a janela sumiu, nega em vez de cair em outra tela.
      const f = c && fontes.find((x) => x.id === c.id);
      if (!f) return callback({});
      callback(c && c.audio ? { video: f, audio: "loopback" } : { video: f });
    });

    ipcMain.handle("srcs", async (e) => {
      if (!confiavel(e)) return [];
      const fontes = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: false,
      });
      return fontes.slice(0, 16).map((x) => ({ id: x.id, name: x.name, thumb: x.thumbnail.toDataURL() }));
    });
    ipcMain.handle("choose", (e, id, audio) => { if (confiavel(e)) chosen = { id: String(id), audio: !!audio }; });
    ipcMain.handle("bg:get", (e) => (confiavel(e) ? cfg.segundoPlano : true));
    ipcMain.handle("bg:set", (e, v) => { if (!confiavel(e)) return cfg.segundoPlano; cfg.segundoPlano = !!v; salvarCfg(); return cfg.segundoPlano; });
    ipcMain.handle("ver", (e) => (confiavel(e) ? app.getVersion() : "?"));
    ipcMain.handle("cap:set", (e, v) => { if (!confiavel(e)) return; capturando = !!v; if (tray) tray.setToolTip(textoBandeja()); });

    ipcMain.handle("upd:check", async (e) => {
      if (!confiavel(e)) return "?";
      if (!app.isPackaged) return "Só funciona no programa instalado.";
      if (!autoUpdater) return "Atualização automática não configurada (veja o LEIA-ME).";
      if (baixada) return "Já baixei uma atualização: clique em reiniciar no alto da tela.";
      try {
        const r = await autoUpdater.checkForUpdates();
        const v = r && r.updateInfo && r.updateInfo.version;
        return v && v !== app.getVersion() ? "Nova versão " + v + " encontrada: baixando…" : "Você já está na versão mais recente (" + app.getVersion() + ").";
      } catch (err) { return "Não consegui verificar agora (sem internet ou repositório privado)."; }
    });
    ipcMain.handle("upd:install", (e) => { if (confiavel(e) && autoUpdater && baixada) { saindo = true; autoUpdater.quitAndInstall(); } });

    criarJanela();
    iniciarAtualizador();
  });

  app.on("window-all-closed", () => app.quit());
}
