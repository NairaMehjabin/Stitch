import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ts } from "ts-morph";
import { normalizePath } from "../utils/normalizePath";

export interface StitchConfig {
  scan: string[];
  exclude: string[];
}

export function loadStitchConfig(): StitchConfig {
  const configPath = resolve(process.cwd(), "stitch.config.json");

  return JSON.parse(readFileSync(configPath, "utf8")) as StitchConfig;
}

export function discoverTypeScriptFiles(config: StitchConfig): string[] {
  const includePatterns = config.scan.map((entry) => {
    const normalizedEntry = normalizePath(entry).replace(/\/+$/, "");

    return normalizedEntry.includes("*")
      ? normalizedEntry
      : `${normalizedEntry}/**/*`;
  });

  return ts.sys.readDirectory(
    process.cwd(),
    [".ts", ".tsx"],
    config.exclude.map(normalizePath),
    includePatterns
  );
}