import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import dgram from "node:dgram";
import path from "node:path";
import started from "electron-squirrel-startup";
import { writeLog } from "./lib/logger";
import {
  parseOpcode101,
  parseOpcode102,
  parseOpcode103,
  parseOpcode104,
  parseOpcode105,
  parseOpcode106,
  parseOpcode122,
} from "./lib/udpParser";

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let promptWindow: BrowserWindow | null = null;
let udpSocket: dgram.Socket | null = null;
let latestNodes: Array<any> = [];
let udpConfig: { host: string; port: number } | null = null;

ipcMain.handle("udp-request-latest", async () => {
  return latestNodes;
});

function setupUdpClient(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      udpSocket = dgram.createSocket("udp4");

      udpSocket.on("error", (err) => {
        console.error("[UDP] error:", err);
        reject(err);
      });

      udpSocket.on("message", (msg) => {
        const rawMsgStr = `raw message: ${JSON.stringify(Array.from(msg))}`;
        console.log(rawMsgStr);
        writeLog(rawMsgStr);

        const isAsciiBinary = msg.every((byte) => byte === 48 || byte === 49);
        const isAsciiStr = `isAsciiBinary: ${isAsciiBinary}`;
        console.log(isAsciiStr);
        writeLog(isAsciiStr);

        const bin = isAsciiBinary
          ? msg.toString("utf8").trim()
          : Array.from(msg)
              .map((b) => b.toString(2).padStart(8, "0"))
              .join("");
        const readBits = (start: number, len: number) =>
          parseInt(bin.slice(start, start + len), 2);

        const binStr = `bin: ${bin}`;
        console.log(binStr);
        writeLog(binStr);

        const readBitsStr = `readBits: ${readBits(0, 8)}`;
        console.log(readBitsStr);
        writeLog(readBitsStr);

        const readI16 = (start: number) => {
          let v = readBits(start, 16);
          return v & 0x8000 ? v - 0x10000 : v;
        };

        const readU32 = (start: number) => readBits(start, 32);

        const header = {
          msgId: readBits(0, 8),
          opcode: readBits(8, 8),
          reserved0: readBits(16, 32),
          reserved1: readBits(48, 32),
          reserved2: readBits(80, 32),
        };

        const opcode = header.opcode;

        let parsedData: any[] | null = null;

        switch (opcode) {
          case 101:
            parsedData = parseOpcode101(readBits, readI16, readU32);
            break;
          case 102:
            parsedData = parseOpcode102(readBits, readI16, readU32);
            break;
          case 103:
            parsedData = parseOpcode103(readBits, readI16, readU32);
            break;
          case 104:
            parsedData = parseOpcode104(readBits, readI16, readU32);
            break;
          case 105:
            parsedData = parseOpcode105(readBits, readI16, readU32);
            break;
          case 106:
            parsedData = parseOpcode106(readBits, readI16, readU32);
            break;
          case 122:
            parsedData = parseOpcode122(readBits, readI16, readU32);
            break;
        }

        if (parsedData) {
          latestNodes = parsedData;
          if (mainWindow) {
            mainWindow.webContents.send("data-from-main", parsedData);
          }
          if (opcode === 102) {
            console.log("Network Members (102):", parsedData);
          }
        }
      });

      udpSocket.bind(port, () => {
        udpSocket.setBroadcast(true); // important for receiving broadcasts
        console.log(`[UDP] Listening for broadcast on port ${port}`);
        resolve();
      });
    } catch (e) {
      console.error("[UDP] setup failed:", e);
      reject(e);
    }
  });
}

function promptForUdpConfig(): Promise<{ host: string; port: number }> {
  return new Promise((resolve, reject) => {
    if (promptWindow) {
      promptWindow.focus();
      return;
    }

    promptWindow = new BrowserWindow({
      width: 420,
      height: 320,
      resizable: false,
      title: "UDP Configuration",
      modal: true,
      show: false,
      parent: null,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    promptWindow.removeMenu();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background: #0f172a;
              color: #e2e8f0;
            }
            h1 {
              margin-top: 0;
              font-size: 20px;
            }
            label {
              display: block;
              margin-top: 16px;
              font-weight: 600;
            }
            input {
              width: 100%;
              padding: 8px;
              margin-top: 4px;
              border-radius: 4px;
              border: 1px solid #334155;
              background: #1e293b;
              color: #e2e8f0;
            }
            .actions {
              margin-top: 24px;
              display: flex;
              justify-content: flex-end;
              gap: 12px;
            }
            button {
              padding: 8px 16px;
              border-radius: 4px;
              border: none;
              cursor: pointer;
              font-weight: 600;
            }
            .primary {
              background: #2563eb;
              color: white;
            }
            .secondary {
              background: #475569;
              color: white;
            }
          </style>
        </head>
        <body>
          <h1>UDP Server Configuration</h1>
          <p>Enter the UDP server address and port to connect.</p>
          <form id="udp-config-form">
            <label>
              Host
              <input type="text" id="udp-host" value="127.0.0.1" required />
            </label>
            <label>
              Port
              <input type="number" id="udp-port" value="5005" min="1" max="65535" required />
            </label>
            <div class="actions">
              <button type="button" class="secondary" id="udp-cancel">Cancel</button>
              <button type="submit" class="primary">Connect</button>
            </div>
          </form>
          <script>
            const { ipcRenderer } = require('electron');
            const form = document.getElementById('udp-config-form');
            const hostInput = document.getElementById('udp-host');
            const portInput = document.getElementById('udp-port');
            const cancelBtn = document.getElementById('udp-cancel');

            form.addEventListener('submit', (event) => {
              event.preventDefault();
              const host = hostInput.value.trim();
              const port = parseInt(portInput.value, 10);
              if (!host || Number.isNaN(port) || port < 1 || port > 65535) {
                alert('Please provide a valid host and port (1-65535).');
                return;
              }
              ipcRenderer.send('udp-config-submitted', { host, port });
            });

            cancelBtn.addEventListener('click', () => {
              ipcRenderer.send('udp-config-cancelled');
            });
          </script>
        </body>
      </html>
    `;

    promptWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
    );

    promptWindow.once("ready-to-show", () => {
      promptWindow?.show();
    });

    let handled = false;

    const cleanup = () => {
      ipcMain.removeAllListeners("udp-config-submitted");
      ipcMain.removeAllListeners("udp-config-cancelled");
    };

    const closePrompt = () => {
      if (promptWindow) {
        const win = promptWindow;
        promptWindow = null;
        win.close();
      }
    };

    promptWindow.on("closed", () => {
      cleanup();
      if (!handled) {
        reject(new Error("UDP configuration window was closed"));
      }
      promptWindow = null;
    });

    ipcMain.once("udp-config-submitted", (_event, data) => {
      handled = true;
      cleanup();
      closePrompt();
      resolve({ host: data.host, port: Number(data.port) });
    });

    ipcMain.once("udp-config-cancelled", () => {
      handled = true;
      cleanup();
      closePrompt();
      reject(new Error("UDP configuration cancelled"));
    });
  });
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      devTools: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  mainWindow.webContents.once("did-finish-load", () => {
    if (latestNodes.length > 0) {
      mainWindow?.webContents.send("udp-nodes", latestNodes);
    }
  });

  globalShortcut.register("F11", () => {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });

  globalShortcut.register("Escape", () => {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
  });

  globalShortcut.register("Alt+F4", () => {
    app.quit();
  });
};

app.whenReady().then(async () => {
  try {
    udpConfig = await promptForUdpConfig();
  } catch (error) {
    console.error("UDP configuration was not provided:", error);
    app.quit();
    return;
  }

  try {
    await setupUdpClient(udpConfig.host, udpConfig.port);
    console.log(`UDP connected to ${udpConfig.host}:${udpConfig.port}`);
  } catch (err) {
    console.error("Failed to connect UDP:", err);
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    try {
      console.log("Closing UDP socket");
      udpSocket?.close();
      udpSocket = null;
    } catch {}
    app.quit();
  }
});
