const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("salaApp", {
  listSources: () => ipcRenderer.invoke("srcs"),
  choose: (id, audio) => ipcRenderer.invoke("choose", id, audio),
  getBg: () => ipcRenderer.invoke("bg:get"),
  setBg: (v) => ipcRenderer.invoke("bg:set", v),
  setCap: (v) => ipcRenderer.invoke("cap:set", !!v),
  getVer: () => ipcRenderer.invoke("ver"),
  onUpdate: (cb) => ipcRenderer.on("upd:pronta", (_e, v) => cb(String(v))),
  installUpdate: () => ipcRenderer.invoke("upd:install"),
  checkUpdate: () => ipcRenderer.invoke("upd:check"),
});
