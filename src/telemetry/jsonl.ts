import fs from "node:fs";
import path from "node:path";
import { sanitizeTelemetryData } from "./redaction.js";

export class JsonlSink {
  private filePath?: string;

  constructor(filePath?: string) {
    if (filePath) {
      this.filePath = path.resolve(filePath);
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  public write(record: Record<string, unknown>): void {
    if (!this.filePath) return;
    try {
      const sanitized = sanitizeTelemetryData(record);
      const line = JSON.stringify(sanitized) + "\n";
      fs.appendFileSync(this.filePath, line, "utf8");
    } catch {
      // Fail-open: ignore sink write errors to avoid interrupting application
    }
  }
}
