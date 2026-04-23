import { execSync } from "node:child_process";
import { loadEnvConfig } from "@next/env";

function supabaseCli(): string {
  if (process.env.SUPABASE_CLI) return `"${process.env.SUPABASE_CLI}"`;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return `"${process.env.LOCALAPPDATA}\\supabase\\supabase.exe"`;
  }
  return "supabase";
}

export default async function globalSetup() {
  loadEnvConfig(process.cwd());
  console.log("[integration] Resetting local Supabase...");
  execSync(`${supabaseCli()} db reset --no-seed`, { stdio: "inherit" });
}
