import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const manifest = new URL("./limitless-safe-suite-files.txt", import.meta.url);
const files = readFileSync(manifest, "utf8")
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);

if (files.length === 0 || files.some((path) => !path.startsWith("tests/") || path.includes(".."))) {
  console.error("The Limitless-safe test manifest is empty or invalid.");
  process.exit(2);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: process.cwd(),
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
