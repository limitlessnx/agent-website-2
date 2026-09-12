import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const source = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const destination = path.join(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "compiled",
  "@vercel",
  "og",
  "Geist-Regular.ttf",
);

try {
  await access(source);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  console.log("Prepared Flux Social ImageResponse runtime font.");
} catch {
  // Local/Vercel installs do not require this Trigger runtime compatibility copy.
}
