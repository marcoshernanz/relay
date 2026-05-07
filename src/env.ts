import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

export type AppEnv = {
  OPENROUTER_API_KEY: string;
};
export type AppEnvName = keyof AppEnv;

const envFilePath = resolve(
  dirname(dirname(fileURLToPath(import.meta.url))),
  ".env",
);

loadLocalEnvFile();

export const env: AppEnv = {
  get OPENROUTER_API_KEY() {
    return requiredEnvValue("OPENROUTER_API_KEY");
  },
};

function loadLocalEnvFile(): void {
  if (existsSync(envFilePath)) {
    loadEnvFile(envFilePath);
  }
}

export function requiredEnvValue(name: AppEnvName): string {
  const value = process.env[name]?.trim();

  if (value === undefined || value === "") {
    throw new Error(
      `Missing required environment variable ${name}. Set it in .env or export it before running.`,
    );
  }

  return value;
}
