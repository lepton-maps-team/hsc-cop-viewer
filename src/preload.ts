import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("udp", {
  onDataFromMain: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners("data-from-main");
    ipcRenderer.on("data-from-main", (_event, data) => {
      try {
        callback(data);
      } catch (e) {
        console.error("udp.onDataFromMain callback error", e);
      }
    });
  },
});

contextBridge.exposeInMainWorld("udpRequest", {
  requestLatest: () => ipcRenderer.invoke("udp-request-latest"),
});
