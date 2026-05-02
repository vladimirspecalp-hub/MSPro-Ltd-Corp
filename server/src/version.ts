import { createRequire } from "node:module";

type PackageJson = {
  version?: string;
};

type TauriConf = {
  version?: string;
};

const require = createRequire(import.meta.url);

function loadServerVersion(): string {
  const envVersion = process.env.MSPROLTD_VERSION?.trim();
  if (envVersion) return envVersion;

  try {
    const tauri = require("../../src-tauri/tauri.conf.json") as TauriConf;
    if (tauri?.version) return tauri.version;
  } catch {
    // tauri.conf.json may be absent in some packaging modes — fall through
  }

  try {
    const pkg = require("../package.json") as PackageJson;
    if (pkg?.version) return pkg.version;
  } catch {
    // fall through
  }

  return "0.0.0";
}

export const serverVersion = loadServerVersion();
