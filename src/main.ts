import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import dgram from "node:dgram";
import path from "node:path";
import started from "electron-squirrel-startup";

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let promptWindow: BrowserWindow | null = null;
let udpSocket: dgram.Socket | null = null;
let latestNodes: Array<any> = [];
let udpConfig: { host: string; port: number } | null = null;

// Resolution Values for Opcode 101
const LATITUDE_RESOLUTION_101 = 0.000000083819;
const LONGITUDE_RESOLUTION_101 = 0.000000083819;
const ALTITUDE_RESOLUTION_101 = 1.0;
const VEIN_RESOLUTION = 0.03662221137119663;
const VEIE_RESOLUTION = 0.03662221137119663;
const VEIU_RESOLUTION = 0.03662221137119663;
const TRUE_HEADING_RESOLUTION = 0.0054932;

// Resolution Values for Opcode 102
const TRACK_ID_RESOLUTION = 1.0;
const BARO_ALTITUDE_RESOLUTION = 1.0;
const GROUND_SPEED_RESOLUTION_102 = 0.0625;
const MACH_RESOLUTION = 0.00012207;
const RADAR_ZONE_COVERAGE_AZ = 0.4705882353;
const RADAR_ZONE_COVERAGE_EL = 0.4705882353;
const RADAR_ZONE_CENTER_AZ = 1.417322835;
const RADAR_ZONE_CENTER_EL = 1.417322835;
const FUEL_RESOLUTION = 50.0;

// Resolution values for Opcode 103
const DMAX1_RESOLUTION = 0.015625;
const DMAX2_RESOLUTION = 0.015625;
const DMIN_RESOLUTION = 0.015625;

// Resolution values for Opcode 104
const LATITUDE_RESOLUTION_104 = 0.000000083819;
const LONGITUDE_RESOLUTION_104 = 0.0000000838190317;
const ALTITUDE_RESOLUTION_104 = 1.0;
const HEADING_RESOLUTION = 0.0054932;
const GROUND_SPEED_RESOLUTION_104 = 0.0625;
const RANGE_RESOLUTION = 0.048828125;

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
        //   console.log("message:", msg);
        const isAsciiBinary = msg.every((byte) => byte === 48 || byte === 49);
        const bin = isAsciiBinary
          ? msg.toString("utf8").trim()
          : Array.from(msg)
              .map((b) => b.toString(2).padStart(8, "0"))
              .join("");
        const readBits = (start: number, len: number) =>
          parseInt(bin.slice(start, start + len), 2);

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

        if (opcode === 101) {
          const numMembers = readBits(128, 8); // byte 16
          let offset = 160; // skip reserved[3]

          const members = [];

          for (let i = 0; i < numMembers; i++) {
            const m = {
              globalId: readU32(offset),
              latitude: readU32(offset + 32) * LATITUDE_RESOLUTION_101,
              longitude: readU32(offset + 64) * LONGITUDE_RESOLUTION_101,
              altitude: readI16(offset + 96) * ALTITUDE_RESOLUTION_101,
              veIn: readI16(offset + 112) * VEIN_RESOLUTION,
              veIe: readI16(offset + 128) * VEIE_RESOLUTION,
              veIu: readI16(offset + 144) * VEIU_RESOLUTION,
              trueHeading: readI16(offset + 160) * TRUE_HEADING_RESOLUTION,
              reserved: readI16(offset + 176),
              opcode: 101,
            };

            members.push(m);
            offset += 192; // 24 bytes = 192 bits
          }

          latestNodes = members;
          if (mainWindow)
            mainWindow.webContents.send("data-from-main", members);
          return;
        }

        if (opcode === 104) {
          const numTargets = readBits(128, 16); // bytes 16–17
          let offset = 160; // skip reserved[2]

          const targets = [];

          for (let i = 0; i < numTargets; i++) {
            const t = {
              globalId: readU32(offset),
              latitude: readU32(offset + 32) * LATITUDE_RESOLUTION_104,
              longitude: readU32(offset + 64) * LONGITUDE_RESOLUTION_104,
              altitude: readI16(offset + 96) * ALTITUDE_RESOLUTION_104,
              heading: readI16(offset + 112) * HEADING_RESOLUTION,
              groundSpeed: readI16(offset + 128) * GROUND_SPEED_RESOLUTION_104,
              reserved0: readBits(offset + 144, 8),
              reserved1: readBits(offset + 152, 8),
              range: readU32(offset + 160) * RANGE_RESOLUTION,
              opcode: 104,
            };

            targets.push(t);
            offset += 192; // 24 bytes = 192 bits
          }

          latestNodes = targets;
          if (mainWindow)
            mainWindow.webContents.send("data-from-main", targets);
          return;
        }

        if (opcode === 106) {
          const senderGlobalId = readU32(128); // bytes 16-19
          const numOfThreats = readBits(160, 8); // byte 20
          let offset = 192; // skip reserved[3] (bytes 21-23)

          const threats = [];

          for (let i = 0; i < numOfThreats; i++) {
            const t = {
              threatId: readBits(offset, 8),
              isSearchMode: readBits(offset + 8, 8),
              isLockOn: readBits(offset + 16, 8),
              threatType: readBits(offset + 24, 8),
              threatRange: readBits(offset + 32, 8),
              reserved: readBits(offset + 40, 24),
              threatAzimuth: readBits(offset + 64, 16),
              threatFrequency: readBits(offset + 80, 16),
              opcode: 106,
            };

            threats.push(t);
            offset += 96; // 12 bytes = 96 bits
          }

          latestNodes = threats;
          if (mainWindow)
            mainWindow.webContents.send("data-from-main", threats);
          return;
        }

        if (opcode === 102) {
          const numOfNetworkMembers = readBits(128, 8); // byte 16 (offset 17 in struct, but 0-indexed from header start)
          let offset = 160; // skip reserved[3] (bytes 18-20, which is 144-159 bits, but we start at 160 after header)

          const networkMembers = [];

          for (let i = 0; i < numOfNetworkMembers; i++) {
            // opcode102B globalData (40 bytes = 320 bits)
            const globalId = readU32(offset); // 4 bytes (0-3)
            // Read callsign (6 bytes, offset 4-9)
            const callsignBytes = [];
            for (let j = 0; j < 6; j++) {
              callsignBytes.push(readBits(offset + 32 + j * 8, 8));
            }
            const callsign = String.fromCharCode(
              ...callsignBytes.filter((b) => b !== 0)
            ).trim();
            const callsignId = readBits(offset + 80, 16); // 2 bytes (10-11)

            // opcode102F radioData (24 bytes = 192 bits, offset 12-35)
            const radioOffset = offset + 96; // 12 bytes = 96 bits
            // legacyFreq1 (8 bytes)
            const legacyFreq1 = {
              D1: readBits(radioOffset, 8),
              D2: readBits(radioOffset + 8, 8),
              D3: readBits(radioOffset + 16, 8),
              D4: readBits(radioOffset + 24, 8),
              D5: readBits(radioOffset + 32, 8),
              D6: readBits(radioOffset + 40, 8),
              reserved: readBits(radioOffset + 48, 16),
            };
            // legacyFreq2 (8 bytes)
            const legacyFreq2 = {
              D1: readBits(radioOffset + 64, 8),
              D2: readBits(radioOffset + 72, 8),
              D3: readBits(radioOffset + 80, 8),
              D4: readBits(radioOffset + 88, 8),
              D5: readBits(radioOffset + 96, 8),
              D6: readBits(radioOffset + 104, 8),
              reserved: readBits(radioOffset + 112, 16),
            };
            const manetLNetId = readBits(radioOffset + 128, 8); // byte 16
            const manetU1NetId = readBits(radioOffset + 136, 8); // byte 17
            const manetU2NetId = readBits(radioOffset + 144, 8); // byte 18
            const satcomMode = readBits(radioOffset + 152, 8); // byte 19
            const guardBand = readBits(radioOffset + 160, 8); // byte 20
            // reserved[3] at offset 168-191 (bytes 21-23)

            // opcode102C internalData (4 bytes, offset 40-43)
            const internalOffset = offset + 320; // 40 bytes = 320 bits
            const isMotherAc = readBits(internalOffset, 8); // byte 0
            const trackId = readI16(internalOffset + 8) * TRACK_ID_RESOLUTION; // 2 bytes (1-2), using I16 for signed
            // reserved at offset 24 (byte 3)

            // opcode102D regionalData
            const regionalOffset = offset + 352; // 44 bytes = 352 bits
            const isValid = readBits(regionalOffset, 8); // byte 0
            const role = readBits(regionalOffset + 8, 8); // byte 1
            const idnTag = readBits(regionalOffset + 16, 8); // byte 2
            const acCategory = readBits(regionalOffset + 24, 8); // byte 3
            const isMissionLeader = readBits(regionalOffset + 32, 8); // byte 4
            const isRogue = readBits(regionalOffset + 40, 8); // byte 5
            const isFormation = readBits(regionalOffset + 48, 8); // byte 6
            const recoveryEmergency = readBits(regionalOffset + 56, 8); // byte 7
            const displayId = readBits(regionalOffset + 64, 16); // 2 bytes (8-9)
            const acType = readBits(regionalOffset + 80, 16); // 2 bytes (10-11)
            const bimg = readBits(regionalOffset + 96, 16); // 2 bytes (12-13)
            const timg = readBits(regionalOffset + 112, 16); // 2 bytes (14-15)
            const c2Critical = readBits(regionalOffset + 128, 8); // byte 16
            const controllingNodeId = readBits(regionalOffset + 136, 8); // byte 17
            // reserved at offset 144 (byte 18)
            // ctn[5] (5 bytes, offset 19-23)
            const ctnBytes = [];
            for (let j = 0; j < 5; j++) {
              ctnBytes.push(readBits(regionalOffset + 152 + j * 8, 8));
            }
            const ctn = String.fromCharCode(
              ...ctnBytes.filter((b) => b !== 0)
            ).trim();
            // opcode102G metadata (8 bytes)
            const metadataOffset = regionalOffset + 192; // 24 bytes = 192 bits
            const baroAltitude =
              readI16(metadataOffset) * BARO_ALTITUDE_RESOLUTION; // 2 bytes (0-1)
            const groundSpeed =
              readI16(metadataOffset + 16) * GROUND_SPEED_RESOLUTION_102; // 2 bytes (2-3)
            const mach = readI16(metadataOffset + 32) * MACH_RESOLUTION; // 2 bytes (4-5)
            // reserved[2] at offset 48-63 (bytes 6-7)

            // opcode102E battleGroupData
            const battleOffset = regionalOffset + 256; // 32 bytes = 256 bits from regional start
            const battleIsValid = readBits(battleOffset, 8); // byte 0
            const q1LockFinalizationState = readBits(battleOffset + 8, 8); // byte 1
            const q2LockFinalizationState = readBits(battleOffset + 16, 8); // byte 2
            const fuelState = readBits(battleOffset + 24, 8); // byte 3
            const q1LockGlobalId = readU32(battleOffset + 32); // 4 bytes (4-7)
            const q2LockGlobalId = readU32(battleOffset + 64); // 4 bytes (8-11)
            const radarLockGlobalId = readU32(battleOffset + 96); // 4 bytes (12-15)
            const radarZoneCoverageAz =
              readBits(battleOffset + 128, 8) * RADAR_ZONE_COVERAGE_AZ; // byte 16 (double as 1 byte seems wrong, but following struct)
            const radarZoneCoverageEl =
              readBits(battleOffset + 136, 8) * RADAR_ZONE_COVERAGE_EL; // byte 17
            const radarZoneCenterAz =
              readBits(battleOffset + 144, 8) * RADAR_ZONE_CENTER_AZ; // byte 18
            const radarZoneCenterEl =
              readBits(battleOffset + 152, 8) * RADAR_ZONE_CENTER_EL; // byte 19
            const combatEmergency = readBits(battleOffset + 160, 8); // byte 20
            const chaffRemaining = readBits(battleOffset + 168, 8); // byte 21
            const flareRemaining = readBits(battleOffset + 176, 8); // byte 22
            const masterArmStatus = readBits(battleOffset + 184, 8); // byte 23
            const acsStatus = readBits(battleOffset + 192, 8); // byte 24
            const fuel = readBits(battleOffset + 200, 8) * FUEL_RESOLUTION; // byte 25 (double as 1 byte seems wrong, but following struct)
            const numOfWeapons = readBits(battleOffset + 208, 8); // byte 26
            const numOfSensors = readBits(battleOffset + 216, 8); // byte 27

            // Read weaponsData vector (opcode102H, 4 bytes each)
            const weaponsData = [];
            let weaponsOffset = battleOffset + 224; // 28 bytes = 224 bits
            for (let w = 0; w < numOfWeapons; w++) {
              weaponsData.push({
                code: readBits(weaponsOffset, 8), // byte 0
                value: readBits(weaponsOffset + 8, 8), // byte 1
                reserved: readBits(weaponsOffset + 16, 16), // 2 bytes (2-3)
              });
              weaponsOffset += 32; // 4 bytes = 32 bits
            }

            // Read sensorsData vector (opcode102I, 4 bytes each)
            const sensorsData = [];
            let sensorsOffset = weaponsOffset;
            for (let s = 0; s < numOfSensors; s++) {
              sensorsData.push({
                code: readBits(sensorsOffset, 8), // byte 0
                value: readBits(sensorsOffset + 8, 8), // byte 1
                reserved: readBits(sensorsOffset + 16, 16), // 2 bytes (2-3)
              });
              sensorsOffset += 32; // 4 bytes = 32 bits
            }

            const member = {
              globalId,
              callsign,
              callsignId,
              radioData: {
                legacyFreq1,
                legacyFreq2,
                manetLNetId,
                manetU1NetId,
                manetU2NetId,
                satcomMode,
                guardBand,
              },
              internalData: {
                isMotherAc,
                trackId,
              },
              regionalData: {
                isValid,
                role,
                idnTag,
                acCategory,
                isMissionLeader,
                isRogue,
                isFormation,
                recoveryEmergency,
                displayId,
                acType,
                bimg,
                timg,
                c2Critical,
                controllingNodeId,
                ctn,
                metadata: {
                  baroAltitude,
                  groundSpeed,
                  mach,
                },
              },
              battleGroupData: {
                isValid: battleIsValid,
                q1LockFinalizationState,
                q2LockFinalizationState,
                fuelState,
                q1LockGlobalId,
                q2LockGlobalId,
                radarLockGlobalId,
                radarZoneCoverageAz,
                radarZoneCoverageEl,
                radarZoneCenterAz,
                radarZoneCenterEl,
                combatEmergency,
                chaffRemaining,
                flareRemaining,
                masterArmStatus,
                acsStatus,
                fuel,
                numOfWeapons,
                numOfSensors,
                weaponsData,
                sensorsData,
              },
              opcode: 102,
            };
            member.globalId = 10;
            console.log("Member:", member.regionalData.metadata);
            networkMembers.push(member);
            // Move offset to next member (after all data including variable length vectors)
            offset = sensorsOffset;
          }

          latestNodes = networkMembers;
          if (mainWindow)
            mainWindow.webContents.send("data-from-main", networkMembers);
          console.log("Network Members (102):", networkMembers);
          return;
        }

        if (opcode === 103) {
          const numOfEngagingNetworkMember = readBits(128, 8); // byte 16
          let offset = 160; // skip reserved[3] (bytes 17-19, which is 136-159 bits)

          const engagingMembers = [];

          for (let i = 0; i < numOfEngagingNetworkMember; i++) {
            // opcode103A structure (20 bytes = 160 bits)
            const globalId = readU32(offset); // 4 bytes (0-3)
            const engagementTargetGid = readU32(offset + 32); // 4 bytes (4-7)
            const weaponLaunch = readBits(offset + 64, 8); // 1 byte (8)
            const hangFire = readBits(offset + 72, 8); // 1 byte (9)
            const tth = readBits(offset + 80, 8); // 1 byte (10)
            const tta = readBits(offset + 88, 8); // 1 byte (11)
            const engagementTargetWeaponCode = readBits(offset + 96, 8); // 1 byte (12)
            // reserved at offset 104 (byte 13)
            const dMax1 = readI16(offset + 112); // 2 bytes (14-15), using I16 for signed
            const dMax2 = readI16(offset + 128); // 2 bytes (16-17), using I16 for signed
            const dmin = readI16(offset + 144); // 2 bytes (18-19), using I16 for signed

            const member = {
              globalId,
              engagementTargetGid,
              weaponLaunch,
              hangFire,
              tth,
              tta,
              engagementTargetWeaponCode,
              dMax1,
              dMax2,
              dmin,
              opcode: 103,
            };

            engagingMembers.push(member);
            offset += 160; // 20 bytes = 160 bits
          }

          latestNodes = engagingMembers;
          if (mainWindow)
            mainWindow.webContents.send("data-from-main", engagingMembers);
          return;
        }

        if (opcode === 105) {
          const numOfTargets = readBits(128, 16); // 2 bytes (16-17)
          let offset = 160; // skip reserved[2] (bytes 18-19, which is 144-159 bits)

          const targets = [];

          for (let i = 0; i < numOfTargets; i++) {
            // opcode105A structure (40 bytes fixed + variable contributors)
            const globalId = readU32(offset); // 4 bytes (0-3)
            const displayId = readBits(offset + 32, 16); // 2 bytes (4-5)
            // Read callSign (6 bytes, offset 6-11)
            const callsignBytes = [];
            for (let j = 0; j < 6; j++) {
              callsignBytes.push(readBits(offset + 48 + j * 8, 8));
            }
            const callSign = String.fromCharCode(
              ...callsignBytes.filter((b) => b !== 0)
            ).trim();
            const callsignId = readBits(offset + 96, 16); // 2 bytes (12-13)
            const iffSensor = readBits(offset + 112, 8); // 1 byte (14)
            const trackSource = readBits(offset + 120, 8); // 1 byte (15)
            const grouped = readBits(offset + 128, 8); // 1 byte (16)
            const isLocked = readBits(offset + 136, 8); // 1 byte (17)
            const localTrackNumber = readBits(offset + 144, 16); // 2 bytes (18-19)
            const saLeader = readU32(offset + 160); // 4 bytes (20-23)
            const acType = readBits(offset + 192, 16); // 2 bytes (24-25)
            const acCategory = readBits(offset + 208, 8); // 1 byte (26)
            const nodeId = readBits(offset + 216, 8); // 1 byte (27)
            const idnTag = readBits(offset + 224, 8); // 1 byte (28)
            const nctr = readBits(offset + 232, 8); // 1 byte (29)
            const jam = readBits(offset + 240, 8); // 1 byte (30)
            const numOfContributors = readBits(offset + 248, 8); // 1 byte (31)
            const lno = readBits(offset + 256, 8); // 1 byte (32)
            // Read ctn (5 bytes, offset 33-37)
            const ctnBytes = [];
            for (let j = 0; j < 5; j++) {
              ctnBytes.push(readBits(offset + 264 + j * 8, 8));
            }
            const ctn = String.fromCharCode(
              ...ctnBytes.filter((b) => b !== 0)
            ).trim();
            // reserved[2] at offset 304-319 (bytes 38-39)

            // Read contributors vector (opcode105B, 4 bytes each)
            const contributors = [];
            let contributorsOffset = offset + 320; // 40 bytes = 320 bits
            for (let c = 0; c < numOfContributors; c++) {
              contributors.push({
                displayId: readBits(contributorsOffset, 16), // 2 bytes (0-1)
                lno: readBits(contributorsOffset + 16, 8), // 1 byte (2)
                reserved: readBits(contributorsOffset + 24, 8), // 1 byte (3)
              });
              contributorsOffset += 32; // 4 bytes = 32 bits
            }

            const target = {
              globalId,
              displayId,
              callSign,
              callsignId,
              iffSensor,
              trackSource,
              grouped,
              isLocked,
              localTrackNumber,
              saLeader,
              acType,
              acCategory,
              nodeId,
              idnTag,
              nctr,
              jam,
              numOfContributors,
              lno,
              ctn,
              contributors,
              opcode: 105,
            };

            targets.push(target);
            // Move offset to next target (after all data including variable length contributors)
            offset = contributorsOffset;
          }

          latestNodes = targets;
          if (mainWindow)
            mainWindow.webContents.send("data-from-main", targets);
          return;
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
