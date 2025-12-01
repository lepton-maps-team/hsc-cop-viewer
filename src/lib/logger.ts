import { app } from "electron";
import path from "node:path";
import fs from "node:fs";

export function getLogFileName(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}.txt`;
}

export function getLogFilePath(): string {
  const logDir = path.join(app.getPath("userData"), "logs");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return path.join(logDir, getLogFileName());
}

export function writeLog(message: string): void {
  try {
    const logPath = getLogFilePath();
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logPath, logEntry, "utf8");
  } catch (error) {
    console.error("Failed to write log:", error);
  }
}
